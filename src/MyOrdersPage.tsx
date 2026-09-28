import { Link } from 'react-router-dom';
import { ArrowRight, MapPin, Ticket, Clock3, ShoppingBag } from 'lucide-react';
import { usePoll, windowLabel } from './api';
import { useAuth } from './AuthContext';
import type { Order, Status } from './types';
import { ErrorBox, Loading } from './App';
import './order-flow.css';
import './ticket-cart.css';
const labels: Record<Status, string> = {
  received: 'Order sent',
  entered: 'Entered by staff',
  preparing: 'Preparing',
  ready: 'Ready for pickup',
  picked_up: 'Picked up',
  cancelled: 'Cancelled'
};
const itemsLabel = (order: Order) => order.items?.length
  ? order.items.map(item => `${item.quantity}× ${item.itemName}`).join(' · ')
  : order.itemName;
export default function MyOrdersPage() {
  const {
    user
  } = useAuth();
  const {
    data,
    error,
    loading,
    refresh
  } = usePoll<{
    orders: Order[];
  }>('/my/orders');
  const orders = data?.orders || [];
  return <div className="my-orders-flow"><section className="page-intro"><span className="eyebrow">YOUR GOOD THINGS, ALL TOGETHER</span><h1>My orders</h1><p>Orders for Student {user?.studentId}. Choose a ticket to follow its progress.</p></section><section className="my-orders-content">{error && <ErrorBox message={error} retry={() => void refresh()} />} {loading && <Loading />}{!loading && !error && orders.length === 0 && <div className="empty-orders panel"><span className="big-icon"><ShoppingBag size={26} /></span><h2>Your next good thing is waiting.</h2><p>Choose a campus place and make something yours. Your demo orders will appear here.</p><Link className="button primary" to="/">Explore campus dining <ArrowRight size={16} /></Link></div>}<div className="my-orders-list">{orders.map(order => <Link className={`order-history-card status-${order.status}`} key={order.id} to={order.token ? `/ticket/${encodeURIComponent(order.token)}` : '/my-orders'}><div className="order-history-icon"><Ticket size={25} /></div><div className="order-history-main"><div><span className={`history-status history-${order.status}`}>{labels[order.status]}</span>{order.status !== 'cancelled' && order.payment && ['pending', 'approved', 'declined'].includes(order.payment.status) && <span className={`history-payment history-payment-${order.payment.status}`}>{order.payment.status === 'approved' ? 'Payment received (demo)' : order.payment.status === 'declined' ? 'Payment not confirmed (demo)' : 'Awaiting payment (demo)'}</span>}<span className="history-date">{new Intl.DateTimeFormat('en-US', {
                  month: 'short',
                  day: 'numeric',
                  timeZone: 'America/Chicago'
                }).format(new Date(order.createdAt))}</span></div><h2>{itemsLabel(order)}</h2><span><MapPin size={12} />{order.stationName}{order.location !== order.stationName && ` · ${order.location}`}</span><span><Clock3 size={12} />{order.timingMode === 'asap' ? 'Right now · ' : 'Scheduled · '}{windowLabel(order.slot)}</span></div><div className="order-history-code"><small>PICKUP CODE</small><strong>{order.pickupCode}</strong><ArrowRight size={20} /></div></Link>)}</div></section></div>;
}
