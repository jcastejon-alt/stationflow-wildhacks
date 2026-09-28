import { useRef, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { ArrowRight, Check, Clock3, RefreshCw } from 'lucide-react';
import { api, usePoll, windowLabel } from './api';
import { staffHomePath, useAuth } from './AuthContext';
import type { Order, Status } from './types';
import { ErrorBox, Loading } from './App';
import './worker-panel.css';

type Queue = { name: string; station: string; ids: string[] };
const queues: Record<string, Queue> = {
  cafeteria: { name: 'Cafeteria', station: '', ids: ['omelet', 'hamburger', 'sandwich'] },
  grill: { name: 'Cafeteria · Grill', station: 'omelet', ids: ['omelet', 'hamburger'] },
  sandwich: { name: 'Cafeteria · Sandwich', station: 'sandwich', ids: ['sandwich'] },
  hub: { name: 'The Hub', station: 'hub', ids: ['hub'] },
  frothy: { name: 'Frothy Monkey', station: 'frothy', ids: ['frothy'] },
  starbucks: { name: 'Starbucks', station: 'starbucks', ids: ['starbucks'] },
};
const lanes: { title: string; statuses: Status[]; empty: string }[] = [
  { title: 'Pending', statuses: ['received', 'entered'], empty: 'New orders will appear here.' },
  { title: 'Preparing', statuses: ['preparing'], empty: 'Accepted orders will appear here.' },
  { title: 'Done', statuses: ['ready'], empty: 'Ready orders will appear here.' },
];
function Ticket({ order, busy, act, cafeteria }: { order: Order; busy: string; act: (order: Order) => void; cafeteria: boolean }) {
  const items = order.items?.length ? order.items : [{ itemId: order.itemId, itemName: order.itemName, quantity: 1, selectionSummary: order.selectionSummary, exclusions: order.exclusions }];
  const action = order.status === 'received' || order.status === 'entered' ? 'Accept' : order.status === 'preparing' ? 'Mark ready' : null;
  const mealSwipe = order.payment?.method === 'meal_exchange' || order.paymentMode === 'meal_exchange';
  const paymentLabel = mealSwipe ? '1 demo meal swipe' : order.pricing?.amountCents == null ? 'Campus account · Price to confirm' : `Campus account · $${(order.pricing.amountCents / 100).toFixed(2)} demo`;
  const paymentStatus = order.payment?.status === 'approved' ? 'Confirmed (demo)' : order.payment?.status === 'declined' ? 'Not confirmed' : 'Pending confirmation';
  return <article className="worker-ticket">
    <div className="worker-ticket-top"><span className="worker-ticket-id">#{order.pickupCode}</span><span className="worker-ticket-time"><Clock3 size={16} /> {windowLabel(order.slot)}</span></div>
    {cafeteria && <p className="worker-ticket-station">{order.stationId === 'sandwich' ? 'Sandwich Station' : `Grill · ${order.stationId === 'omelet' ? 'Omelet' : 'Hamburger'}`}</p>}
    <div className="worker-ticket-person"><small>Student ID</small><strong>{order.studentId || order.payment?.studentId || (order.source === 'walk_in' ? 'Counter order' : '—')}</strong></div>
    {!cafeteria && <div className="worker-ticket-payment"><strong>{paymentLabel}</strong><span>{paymentStatus}</span></div>}
    <ul className="worker-ticket-items">{items.map((item, index) => <li key={`${item.itemId}-${index}`}><strong>{item.quantity}× {item.itemName}</strong>{item.selectionSummary?.map((group, i) => <span key={`${group.group}-${i}`}>{group.label}: {group.values.join(', ') || 'None'}</span>)}{item.exclusions?.length > 0 && <span className="worker-ticket-exclude">No {item.exclusions.join(', ')}</span>}</li>)}</ul>
    {action && <button type="button" className={`worker-ticket-action ${action === 'Mark ready' ? 'is-ready' : ''}`} disabled={Boolean(busy)} onClick={() => act(order)} aria-label={`${action} order ${order.pickupCode}`}>
      {busy === order.id ? 'Updating…' : action} {action === 'Mark ready' ? <Check size={17} /> : <ArrowRight size={17} />}
    </button>}
    {order.status === 'ready' && <div className="worker-ticket-done"><Check size={16} /> Ready for pickup</div>}
  </article>;
}

function QueuePanel({ queue }: { queue: Queue }) {
  const cafeteria = queue.ids.includes('omelet') || queue.station === 'sandwich';
  const { data, error, loading, refresh, setData } = usePoll<{ orders: Order[] }>(queue.station ? `/staff/orders?currentDay=true&stationId=${encodeURIComponent(queue.station)}` : '/staff/orders?currentDay=true');
  const [busy, setBusy] = useState('');
  const actionInFlight = useRef(false);
  const [actionError, setActionError] = useState('');
  const orders = (data?.orders || []).filter(order => queue.ids.includes(order.stationId) && order.source === 'online' && ['received', 'entered', 'preparing', 'ready'].includes(order.status));

  async function act(order: Order) {
    if (actionInFlight.current) return;
    actionInFlight.current = true;
    setBusy(order.id);
    setActionError('');
    try {
      const accepting = order.status === 'received' || order.status === 'entered';
      const response = await api<{ order: Order }>(accepting ? `/staff/orders/${encodeURIComponent(order.id)}/accept` : `/staff/orders/${encodeURIComponent(order.id)}`, {
        method: accepting ? 'POST' : 'PATCH',
        body: JSON.stringify(accepting ? { expectedStatus: order.status } : { expectedStatus: 'preparing', status: 'ready' }),
      });
      setData(current => current ? { orders: current.orders.map(item => item.id === order.id ? response.order : item) } : current);
      await refresh();
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Could not update the order.');
      await refresh();
    } finally {
      actionInFlight.current = false;
      setBusy('');
    }
  }

  function refreshQueue() {
    setActionError('');
    void refresh();
  }

  return <section className="worker-panel" aria-label={`${queue.name} orders`}>
    <div className="worker-panel-head"><div><span className="eyebrow">YOUR COUNTER</span><h1>{queue.name}</h1><p>New order → Accept → Mark ready</p></div><button type="button" className="worker-refresh" onClick={refreshQueue} aria-label="Refresh orders"><RefreshCw size={18} /> Refresh</button></div>
    <p className="worker-panel-explain">{cafeteria
      ? 'Accept means this station has taken the order and started preparing it. No extra student ID or payment is needed here.'
      : 'Accept after entering the student ID in the separate POS. In this demo, that confirms fictional payment and starts preparation.'}</p>
    {(error || actionError) && <ErrorBox message={actionError || error} retry={refreshQueue} />}
    {loading && !data ? <Loading /> : <div className="worker-board">
      {lanes.map(lane => { const tickets = orders.filter(order => lane.statuses.includes(order.status)); if (lane.title === 'Done') tickets.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()); return <section className="worker-lane" key={lane.title} aria-label={`${lane.title} orders`}><header><h2>{lane.title}</h2><span>{tickets.length}</span></header><div className="worker-lane-tickets">{tickets.length ? tickets.map(order => <Ticket key={order.id} order={order} busy={busy} act={act} cafeteria={cafeteria} />) : <p className="worker-lane-empty">{lane.empty}</p>}</div></section>; })}
    </div>}
    <p className="worker-panel-foot">Updates every few seconds · <Link to="/staff/login">Change counter</Link></p>
  </section>;
}

export default function WorkerPanel() {
  const { locationId = '' } = useParams();
  const { user } = useAuth();
  const queue = queues[locationId];
  if (!user) return null;
  if (!queue || user.role === 'manager' || user.stationIds.length !== queue.ids.length || !queue.ids.every(id => user.stationIds.includes(id))) return <Navigate to={staffHomePath(user)} replace />;
  return <QueuePanel key={`${user.id}:${locationId}`} queue={queue} />;
}
