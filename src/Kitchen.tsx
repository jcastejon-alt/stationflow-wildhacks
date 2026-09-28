import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertCircle, ArrowRight, CheckCircle2, Clock3, Laptop, MapPin, Pause, Play, Plus, RefreshCw, Settings2, ShoppingBag, Users, WifiOff } from 'lucide-react';
import { api, ApiError, readStorage, writeStorage } from './api';
import { accountStorageKey, useAuth } from './AuthContext';
import { isCafeteriaStation, isGrillStation, physicalStationKey } from './cafeteria';
import './kitchen.css';

type Status = 'received' | 'entered' | 'preparing' | 'ready' | 'picked_up' | 'cancelled';
type Service = { open: boolean; acceptingOrders: boolean; label: string; closesAt: string | null; nextOpensAt: string | null; scheduleNote: string };
type Station = { physicalStationId?: string; queueGroupId?: string; id: string; name: string; location: string; locationId: string; description: string; paused: boolean; capacity: number; onlineCapacity: number; service: Service };
type DiningLocation = { id: string; name: string; building: string; description: string; hoursLabel: string; hoursSource: string; hoursNote: string };
type ClockMode = 'live' | 'breakfast' | 'transition' | 'lunch' | 'near_close' | 'closed';
type ServiceClock = { mode: string; now: string; label: string };
type MenuItem = { id: string; stationId: string; name: string; available: boolean; groups: { id: string; label: string; options: { id: string; label: string; available: boolean }[] }[] };
type Payment = { status: 'not_required' | 'pending' | 'approved' | 'declined'; method: 'cafeteria_entry' | 'campus_account' | 'meal_exchange' | 'counter'; studentId?: string; authorized: boolean; updatedAt: string | null };
type Pricing = { amountCents: number | null; status: 'published' | 'unverified' | 'demo' | 'meal_swipe' | 'included'; currency: 'USD'; sourceUrl: string | null; note: string };
type OrderItem = { itemId: string; itemName: string; quantity: number; selectionSummary: { group: string; label: string; values: string[] }[]; exclusions: string[]; unitPricing?: Pricing };
type Order = { timingMode?: 'asap' | 'scheduled'; workflowVersion?: number; physicalStationId?: string; queueGroupId?: string; id: string; pickupCode: string; studentId?: string; itemName: string; items?: OrderItem[]; stationId: string; stationName: string; location: string; source: 'online' | 'walk_in'; status: Status; paymentMode: 'regular' | 'meal_exchange'; payment?: Payment; pricing?: Pricing; simulated?: boolean; createdAt: string; slot: { startsAt: string; endsAt: string }; selectionSummary: { group: string; label: string; values: string[] }[]; exclusions: string[] };
type Catalog = { stations: Station[]; items: MenuItem[]; locations: DiningLocation[]; serviceClock: ServiceClock; demo: true };
type SlotSummary = { totalRemaining: number };
type Mutation = (path: string, body: Record<string, unknown>, success: string) => Promise<void>;
type PendingRush = { stationId: string; idempotencyKey: string };
type Lane = 'new' | 'payment' | 'standby' | 'preparing' | 'ready';
const lanes: { id: Lane; label: string; description: string; empty: string }[] = [
  { id: 'new', label: 'New orders', description: 'Received · waiting for staff entry', empty: 'New orders will arrive here.' },
  { id: 'payment', label: 'Payment check', description: 'Entered · confirm or decline', empty: 'Entered orders needing payment will appear here.' },
  { id: 'standby', label: 'Standby', description: 'Entered · ready to prepare', empty: 'Entered orders will wait here.' },
  { id: 'preparing', label: 'Preparing', description: 'In the kitchen now', empty: 'Start an order when you are ready.' },
  { id: 'ready', label: 'Ready', description: 'Waiting for pickup', empty: 'Finished orders will appear here.' },
];
const isCafeteriaOrder = (order: Order) => isCafeteriaStation(order.stationId) || order.payment?.method === 'cafeteria_entry';
const orderLane = (order: Order): Lane | null => {
  if (order.status === 'received') return 'new';
  if (order.status === 'entered') return isCafeteriaOrder(order) || order.payment?.status === 'approved' || order.payment?.status === 'not_required' ? 'standby' : 'payment';
  return order.status === 'preparing' || order.status === 'ready' ? order.status : null;
};

const activeStatuses: Status[] = ['received', 'entered', 'preparing', 'ready'];
const statusLabels: Record<Status, string> = { received: 'Received', entered: 'Entered', preparing: 'Preparing', ready: 'Ready', picked_up: 'Picked up', cancelled: 'Cancelled' };
const nextActions: Partial<Record<Status, { status: Status; label: string }>> = {
  entered: { status: 'preparing', label: 'Start preparing' },
  preparing: { status: 'ready', label: 'Mark ready' },
  ready: { status: 'picked_up', label: 'Complete pickup' },
};
const clockModes: { mode: ClockMode; name: string; description: string }[] = [
  { mode: 'live', name: 'Live time', description: 'Use the current local time' },
  { mode: 'breakfast', name: 'Breakfast', description: 'Monday, September 28 · 8:30 AM' },
  { mode: 'transition', name: '11 AM switch', description: 'Monday, September 28 · grill becomes Hamburger' },
  { mode: 'lunch', name: 'Lunch', description: 'Monday, September 28 · noon' },
  { mode: 'near_close', name: 'Near closing', description: 'Monday, September 28 · 3:45 PM' },
  { mode: 'closed', name: 'After hours', description: 'Monday, September 28 · 11:00 PM' },
];
const time = (value: string) => new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Chicago' }).format(new Date(value));
const dateTime = (value: string) => new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Chicago' }).format(new Date(value));
const messageOf = (error: unknown) => error instanceof Error ? error.message : 'The demo request could not be completed.';
const pricingLabel = (pricing: Pricing) => pricing.status === 'meal_swipe' ? '1 meal swipe' : pricing.status === 'included' ? 'Included' : pricing.amountCents === null ? 'Price to confirm' : `${pricing.status === 'demo' ? 'Demo · ' : ''}$${(pricing.amountCents / 100).toFixed(2)}`;
const openMenuAtSharedStation = (station: Station, stations: Station[]) => stations.find(candidate => candidate.service.open && physicalStationKey(candidate) === physicalStationKey(station)) || station;
function elapsedSinceReceived(createdAt: string, clockNow?: string) {
  const elapsedMinutes = Math.floor((Date.parse(clockNow || '') - Date.parse(createdAt)) / 60000);
  if (!Number.isFinite(elapsedMinutes) || elapsedMinutes < 0) return '';
  if (elapsedMinutes < 1) return 'Less than 1 min since received';
  if (elapsedMinutes < 60) return `${elapsedMinutes} min since received`;
  const hours = Math.floor(elapsedMinutes / 60);
  const minutes = elapsedMinutes % 60;
  return `${hours} hr${hours === 1 ? '' : 's'}${minutes ? ` ${minutes} min` : ''} since received`;
}
function readPendingRush(key: string): PendingRush | null {
  try {
    const value = JSON.parse(readStorage(key) || 'null');
    return value && typeof value.stationId === 'string' && value.stationId.length > 0 && typeof value.idempotencyKey === 'string' && value.idempotencyKey.length > 0 ? { stationId: value.stationId, idempotencyKey: value.idempotencyKey } : null;
  } catch { return null; }
}

function OrderCard({ order, busy, mutate, clockNow }: { order: Order; busy: boolean; mutate: Mutation; clockNow?: string }) {
  const cafeteria = isCafeteriaOrder(order);
  const payment = order.payment;
  const lane = orderLane(order);
  const studentId = order.source === 'online' && !cafeteria ? order.studentId || payment?.studentId : undefined;
  const [confirmedStudentId, setConfirmedStudentId] = useState('');
  const needsStudentId = order.status === 'received' && order.source === 'online' && !cafeteria && Boolean(studentId);
  const idMatches = Boolean(studentId && confirmedStudentId.trim() === studentId);
  const finished = order.status === 'picked_up' || order.status === 'cancelled';
  const legacyWithoutId = order.status === 'received' && !order.workflowVersion && !cafeteria && payment?.status === 'approved' && !studentId;
  const action = legacyWithoutId ? { status: 'preparing' as Status, label: 'Start preparing legacy order' } : order.status === 'received' ? { status: 'entered' as Status, label: cafeteria ? 'Accept station order' : order.source === 'walk_in' ? 'Enter counter order' : 'Entered in POS with student ID' } : nextActions[order.status];
  const preparationBlocked = order.status === 'entered' && !cafeteria && payment?.status !== 'approved' && payment?.status !== 'not_required';
  const identity = order.simulated ? 'Rush simulation' : order.source === 'walk_in' ? 'Walk-in order' : cafeteria ? 'Station order' : studentId ? `Student ${studentId}` : 'Online order';
  const items = order.items?.length ? order.items : [{ itemId: 'legacy', itemName: order.itemName, quantity: 1, selectionSummary: order.selectionSummary, exclusions: order.exclusions }];
  const elapsed = order.status === 'received' || order.status === 'preparing' ? elapsedSinceReceived(order.createdAt, clockNow) : '';
  return <article className={`kitchen-ticket kitchen-ticket-${lane || order.status}`}>
    <div className="kitchen-ticket-top"><div><span className="kitchen-order-kind">{order.simulated ? 'Fictional queue ticket' : order.source === 'walk_in' ? 'At the counter' : cafeteria ? 'At the station' : 'Student ID'}</span><h3 className={`kitchen-order-identity ${studentId ? 'kitchen-private-id' : ''}`}>{identity}</h3></div><div className="kitchen-pickup-reference"><span>Pickup code</span><strong>#{order.pickupCode}</strong></div></div>
    {order.simulated && <p className="kitchen-rush-ticket"><Users size={14} aria-hidden="true" />{studentId || 'QUEUE-DEMO'} · fictional account</p>}
    <p className="kitchen-ticket-station"><MapPin size={14} aria-hidden="true" />{order.stationName}</p>
    <p className="kitchen-ticket-window"><Clock3 size={15} aria-hidden="true" /><span>{order.timingMode === 'asap' ? 'Right now · ' : 'Scheduled · '}{time(order.slot.startsAt)}–{time(order.slot.endsAt)}</span></p>
    {order.pricing && <p className="kitchen-ticket-pricing">{pricingLabel(order.pricing)}</p>}
    <div className="kitchen-ticket-items" aria-label="Order items">{items.map((item, index) => <section className="kitchen-ticket-item" key={`${item.itemId}-${index}`}><h4 className="kitchen-item-name"><span className="kitchen-item-quantity">{item.quantity}×</span>{item.itemName}</h4><dl className="kitchen-modifiers">{item.selectionSummary.map((group, groupIndex) => <div key={`${group.group}-${groupIndex}`}><dt>{group.label}</dt><dd>{group.values.join(', ') || 'None'}</dd></div>)}</dl>{item.exclusions.length > 0 && <div className="kitchen-exclusions"><strong>Leave out</strong><span>{item.exclusions.join(', ')}</span></div>}</section>)}</div>
    {needsStudentId && <div className="kitchen-pos-entry"><label htmlFor={`kitchen-student-id-${order.id}`}>Student ID used for manual POS entry</label><p>Use the student ID shown on this ticket for the separate POS step, then type it here to confirm. This demo has no POS connection.</p><input id={`kitchen-student-id-${order.id}`} className="kitchen-payment-id" type="text" inputMode="numeric" autoComplete="off" value={confirmedStudentId} onChange={event => setConfirmedStudentId(event.target.value)} disabled={busy} aria-invalid={Boolean(confirmedStudentId && !idMatches)} aria-describedby={`kitchen-id-help-${order.id}`} /><small id={`kitchen-id-help-${order.id}`}>{confirmedStudentId && !idMatches ? 'Student ID does not match this ticket.' : 'The ID must match before marking this order entered.'}</small></div>}
    {order.status === 'received' && !cafeteria && order.source === 'online' && !studentId && !legacyWithoutId && <p className="kitchen-inline-error" role="alert">Student ID is missing from this ticket. Refresh or ask a manager to review it.</p>}
    {!finished && cafeteria && <p className="kitchen-station-entry">{order.status === 'received' ? 'Waiting for station acceptance' : 'Accepted at station'}</p>}
    {!finished && !cafeteria && <div className={`kitchen-payment kitchen-payment-${payment?.status || 'pending'}${lane === 'standby' ? ' kitchen-payment-standby' : ''}`}>
      <>
        <div className="kitchen-payment-title"><strong>{payment?.status === 'approved' ? 'Payment received' : payment?.status === 'declined' ? 'Payment declined' : order.status === 'received' ? 'Enter order before payment' : 'Awaiting payment confirmation'}</strong><span>Demo</span></div>
        {order.paymentMode === 'meal_exchange' && <p>Meal exchange · sample eligibility</p>}
        {order.status === 'received' && payment?.status === 'pending' && <p>{order.source === 'walk_in' ? 'Mark the counter order entered first. Payment can be confirmed afterward.' : 'Mark the manual POS entry first. Confirm the simulated payment afterward.'}</p>}
        {order.status === 'entered' && payment?.status === 'pending' && <p>{payment?.method === 'counter' ? 'Confirm the simulated counter payment before preparation.' : <>Confirm the simulated payment for {studentId ? <span className="kitchen-private-id">student ID {studentId}</span> : 'this ticket'} before preparation.</>}</p>}
        {payment?.status === 'declined' && <p>Preparation is blocked. Cancel this order to remove it from the active queue.</p>}
        {order.simulated && <p>Fictional payment approval for the queue demo.</p>}
        {payment?.status === 'pending' && order.status === 'entered' && <div className="kitchen-payment-actions"><button type="button" className="kitchen-payment-confirm" disabled={busy} onClick={() => void mutate(`/staff/orders/${order.id}/payment`, { status: 'approved', expectedStatus: 'pending' }, `Ticket ${order.pickupCode}: payment confirmed, now on standby.`)}>Payment received</button><button type="button" className="kitchen-payment-decline" disabled={busy} onClick={() => void mutate(`/staff/orders/${order.id}/payment`, { status: 'declined', expectedStatus: 'pending' }, `Ticket ${order.pickupCode}: demo payment declined.`)}>Decline payment</button></div>}
        {payment?.status === 'declined' && order.status === 'entered' && <div className="kitchen-payment-actions"><button type="button" className="kitchen-payment-decline" disabled={busy} onClick={() => void mutate(`/staff/orders/${order.id}`, { status: 'cancelled', expectedStatus: 'entered' }, `Ticket ${order.pickupCode}: cancelled after declined payment.`)}>Cancel declined order</button></div>}
      </>
    </div>}
    <p className="kitchen-ticket-meta">Received {time(order.createdAt)}{finished ? ` · ${statusLabels[order.status]}` : ''}</p>
    {elapsed && <p className="kitchen-ticket-elapsed"><Clock3 size={14} aria-hidden="true" />{elapsed}</p>}
    {action && <button type="button" className={`kitchen-action kitchen-action-${order.status}`} disabled={busy || preparationBlocked || (order.status === 'received' && order.source === 'online' && !cafeteria && !legacyWithoutId && !idMatches)} onClick={() => void mutate(`/staff/orders/${order.id}`, { status: action.status, expectedStatus: order.status, ...(needsStudentId ? { studentId: confirmedStudentId.trim() } : {}) }, action.status === 'entered' ? `Ticket ${order.pickupCode}: ${cafeteria ? 'station order accepted' : 'manual POS entry marked'}.` : `Ticket ${order.pickupCode}: ${statusLabels[action.status].toLowerCase()}.`)}>{action.label}<ArrowRight size={17} aria-hidden="true" /></button>}
  </article>;
}

function CapacityForm({ station, busy, mutate }: { station: Station; busy: boolean; mutate: Mutation }) {
  const [total, setTotal] = useState(String(station.capacity));
  const [online, setOnline] = useState(String(station.onlineCapacity));
  const [error, setError] = useState('');
  useEffect(() => { setTotal(String(station.capacity)); setOnline(String(station.onlineCapacity)); setError(''); }, [station.id, station.capacity, station.onlineCapacity]);
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const capacity = Number(total), onlineCapacity = Number(online);
    if (![capacity, onlineCapacity].every(value => Number.isInteger(value) && value > 0 && value <= 10000) || onlineCapacity > capacity) {
      setError('Use positive whole numbers. Online capacity cannot exceed total capacity.'); return;
    }
    setError('');
    void mutate(`/staff/stations/${station.id}`, { capacity, onlineCapacity }, 'Pickup window capacities updated.');
  };
  return <form className="kitchen-capacity-form" onSubmit={submit}>
    <h3>Orders per 10-minute window</h3><p>Keep room at the counter. Lowering limits leaves accepted tickets unchanged.</p>
    <div className="kitchen-capacity-fields"><label>Total capacity<input type="number" min="1" max="10000" step="1" value={total} onChange={event => setTotal(event.target.value)} required disabled={busy} /></label><label>Online capacity<input type="number" min="1" max="10000" step="1" value={online} onChange={event => setOnline(event.target.value)} required disabled={busy} /></label><button type="submit" className="kitchen-outline-button" disabled={busy}>Save capacities</button></div>
    {error && <p className="kitchen-inline-error" role="alert">{error}</p>}
    <p className="kitchen-small-note">Accepted reservations keep their capacity after cancellation or pickup.</p>
  </form>;
}

export default function Kitchen() {
  const { user } = useAuth();
  const { locationId: panelLocationId } = useParams<{ locationId: string }>();
  const userId = user?.id || '';
  const isManager = user?.role === 'manager';
  const canManage = isManager || user?.role === 'staff';
  const [locationId, setLocationId] = useState('all');
  const [stationId, setStationId] = useState('all');
  const [controlStationId, setControlStationId] = useState('');
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadedUserId, setLoadedUserId] = useState('');
  const [controlSlots, setControlSlots] = useState<{ stationId: string; slots: SlotSummary[] }>({ stationId: '', slots: [] });
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState('');
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');
  const [lastSync, setLastSync] = useState('');
  const [showCompleted, setShowCompleted] = useState(false);
  const [operationsOpen, setOperationsOpen] = useState(false);
  const rushStorageKey = user ? accountStorageKey(user, 'pending-rush') : '';
  const [rushPending, setRushPending] = useState<PendingRush | null>(null);
  const [rushSending, setRushSending] = useState(false);
  const currentUser = useRef(userId);
  const currentControl = useRef(controlStationId);
  const manuallySelectedControl = useRef(false);
  const requestSequence = useRef(0);
  const controllerRef = useRef<AbortController | null>(null);
  const busyLock = useRef(false);
  const mounted = useRef(true);
  currentUser.current = userId;
  currentControl.current = controlStationId;

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; controllerRef.current?.abort(); }; }, []);
  useEffect(() => {
    manuallySelectedControl.current = false;
    setLocationId('all'); setStationId('all'); setControlStationId(''); setCatalog(null); setOrders([]); setLoadedUserId('');
    setControlSlots({ stationId: '', slots: [] }); setShowCompleted(false); setActionError(''); setNotice(''); setLastSync('');
    const saved = isManager && rushStorageKey ? readPendingRush(rushStorageKey) : null;
    setRushPending(saved); setRushSending(false);
    if (saved) setControlStationId(saved.stationId);
  }, [userId, isManager, rushStorageKey]);
  useEffect(() => { manuallySelectedControl.current = false; setLocationId('all'); setStationId('all'); setShowCompleted(false); setOperationsOpen(false); setActionError(''); setNotice(''); }, [panelLocationId]);

  const load = useCallback(async (force = false) => {
    if (!canManage || !userId) return;
    if (controllerRef.current && !force) return;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const sequence = ++requestSequence.current;
    const timeout = window.setTimeout(() => controller.abort(), 12000);
    if (mounted.current) setSyncing(true);
    try {
      const [nextCatalog, result, slotsResult] = await Promise.all([
        api<Catalog>('/catalog', { signal: controller.signal }),
        api<{ orders: Order[] }>('/staff/orders', { signal: controller.signal }),
        controlStationId ? api<{ slots: SlotSummary[] }>(`/slots?stationId=${encodeURIComponent(controlStationId)}`, { signal: controller.signal }) : Promise.resolve({ slots: [] }),
      ]);
      if (controller.signal.aborted || !mounted.current || currentUser.current !== userId || sequence !== requestSequence.current) return;
      setCatalog(nextCatalog); setOrders(result.orders); setLoadedUserId(userId); setSyncError(''); setLastSync(new Date().toISOString());
      if (currentControl.current === controlStationId) setControlSlots({ stationId: controlStationId, slots: slotsResult.slots });
    } catch (error) {
      if (mounted.current && currentUser.current === userId && sequence === requestSequence.current) {
        setSyncError(controller.signal.aborted ? 'The kitchen connection timed out. Automatic retries continue.' : messageOf(error));
        if (error instanceof ApiError && (error.status === 401 || error.status === 403)) { setOrders([]); setCatalog(null); setLoadedUserId(''); }
      }
    } finally {
      window.clearTimeout(timeout);
      if (controllerRef.current === controller) controllerRef.current = null;
      if (mounted.current && sequence === requestSequence.current) setSyncing(false);
    }
  }, [userId, canManage, controlStationId]);
  useEffect(() => {
    void load(true);
    const interval = window.setInterval(() => void load(), 3000);
    return () => { requestSequence.current++; controllerRef.current?.abort(); controllerRef.current = null; window.clearInterval(interval); };
  }, [load]);

  const mutate: Mutation = async (path, body, success) => {
    if (busyLock.current || !canManage || !currentCatalog || !panelAllowed) return;
    const actor = userId;
    busyLock.current = true; setBusy(true); setActionError(''); setNotice('');
    try {
      await api(path, { method: 'PATCH', body: JSON.stringify(body) });
      if (mounted.current && currentUser.current === actor) setNotice(success);
    } catch (error) {
      if (mounted.current && currentUser.current === actor) setActionError(messageOf(error));
    } finally {
      if (mounted.current && currentUser.current === actor) await load(true);
      busyLock.current = false; if (mounted.current) setBusy(false);
    }
  };
  const currentCatalog = loadedUserId === userId ? catalog : null;
  const allAssignedStations = (currentCatalog?.stations || []).filter(station => isManager || user?.stationIds.includes(station.id));
  const assignedLocations = (currentCatalog?.locations || []).filter(location => allAssignedStations.some(station => station.locationId === location.id));
  const panelLocation = currentCatalog?.locations.find(location => location.id === panelLocationId);
  const assignedStations = allAssignedStations.filter(station => !panelLocationId || station.locationId === panelLocationId);
  const hasSharedGrill = assignedStations.some(station => station.id === 'omelet') && assignedStations.some(station => station.id === 'hamburger');
  const panelAllowed = !panelLocationId || Boolean(panelLocation && assignedStations.length);
  const locationStations = assignedStations.filter(station => locationId === 'all' || station.locationId === locationId);
  const groupedStations = new Map<string, Station>();
  for (const station of locationStations) {
    const key = physicalStationKey(station);
    const existing = groupedStations.get(key);
    if (!existing || (!existing.service.open && station.service.open)) groupedStations.set(key, station);
  }
  const stationGroups = [...groupedStations.values()];
  const filterStation = locationStations.find(station => station.id === stationId);
  const visibleStations = locationStations.filter(station => stationId === 'all' || (filterStation && physicalStationKey(station) === physicalStationKey(filterStation)));
  const visibleIds = new Set(visibleStations.map(station => station.id));
  const visibleOrders = loadedUserId === userId ? orders.filter(order => visibleIds.has(order.stationId)) : [];
  const active = visibleOrders.filter(order => activeStatuses.includes(order.status)).sort((a, b) => Date.parse(a.slot.startsAt) - Date.parse(b.slot.startsAt) || Date.parse(a.createdAt) - Date.parse(b.createdAt));
  const completed = visibleOrders.filter(order => !activeStatuses.includes(order.status)).reverse();
  const controlStation = assignedStations.find(station => station.id === controlStationId);
  const stationItems = (currentCatalog?.items || []).filter(item => item.stationId === controlStationId);
  const serviceClock = currentCatalog?.serviceClock;
  const blocked = busy || Boolean(syncError);
  const walkInAvailable = Boolean(controlStation?.service?.open && controlSlots.stationId === controlStationId && controlSlots.slots.some(slot => slot.totalRemaining > 0));
  const rushAvailable = Boolean(controlStation?.service?.open && controlStation.service.acceptingOrders && !controlStation.paused);
  const rushStation = allAssignedStations.find(station => station.id === rushPending?.stationId);
  const rushStationName = rushStation?.name || rushPending?.stationId;
  const rushInPanel = !rushPending || assignedStations.some(station => station.id === rushPending.stationId);
  const panelTitle = panelLocation?.name || (assignedLocations.length === 1 ? assignedLocations[0].name : 'Kitchen overview');
  const showStationTabs = stationGroups.length > 1;
  const boardLanes = lanes.filter(lane => lane.id !== 'payment' || visibleStations.some(station => station.locationId !== 'cafeteria'));

  async function simulateRush() {
    const savedRequest = rushPending || readPendingRush(rushStorageKey);
    if (busyLock.current || !isManager || !userId || !panelAllowed) return;
    if (savedRequest && !assignedStations.some(station => station.id === savedRequest.stationId)) { setRushPending(savedRequest); setActionError('A simulation is pending at another location. Open its location below to recover the original request.'); return; }
    if (!savedRequest && (!controlStation || blocked || !rushAvailable)) return;
    const actor = userId;
    const request = savedRequest || { stationId: controlStationId, idempotencyKey: typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Array.from(crypto.getRandomValues(new Uint8Array(24)), byte => byte.toString(16).padStart(2, '0')).join('') };
    if (!savedRequest && !writeStorage(rushStorageKey, JSON.stringify(request))) { setActionError('Enable site storage before simulating orders so an interrupted connection can recover the same request.'); return; }
    setRushPending(request); setControlStationId(request.stationId);
    busyLock.current = true; setBusy(true); setRushSending(true); setActionError(''); setNotice('');
    const clearRequest = () => { try { if (readPendingRush(rushStorageKey)?.idempotencyKey === request.idempotencyKey) localStorage.removeItem(rushStorageKey); } catch { /* A successful replay remains safe if local cleanup is unavailable. */ } setRushPending(null); };
    try {
      const result = await api<{ created: number; orders: Order[]; message: string }>('/staff/demo-rush', { method: 'POST', body: JSON.stringify(request) });
      if (!mounted.current || currentUser.current !== actor) return;
      clearRequest();
      setNotice(result.message || `${result.created} fictional queue ${result.created === 1 ? 'ticket' : 'tickets'} added. No real orders or payments.`);
    } catch (error) {
      if (!mounted.current || currentUser.current !== actor) return;
      const definitive = error instanceof ApiError && error.status >= 400 && error.status < 500 && ![401, 403, 429].includes(error.status);
      if (definitive) { clearRequest(); setActionError(messageOf(error)); }
      else setActionError('The simulation may already have added tickets. Recover this simulation before starting another; recovery reuses the original request and station.');
    } finally {
      if (mounted.current && currentUser.current === actor) await load(true);
      busyLock.current = false;
      if (mounted.current && currentUser.current === actor) { setBusy(false); setRushSending(false); }
    }
  }

  useEffect(() => {
    if (!assignedStations.length || rushPending) return;
    const selected = assignedStations.find(station => station.id === controlStationId);
    const next = selected
      ? manuallySelectedControl.current ? selected : openMenuAtSharedStation(selected, assignedStations)
      : openMenuAtSharedStation(assignedStations[0], assignedStations);
    if (next.id !== controlStationId) setControlStationId(next.id);
  }, [assignedStations, controlStationId, rushPending]);

  if (!canManage) return <section className="kitchen-page"><h1>Staff sign-in required</h1><p>Use a demo staff account to see its assigned stations.</p><Link className="kitchen-primary-link" to="/staff/login">Staff sign in</Link></section>;
  if (currentCatalog && !panelAllowed) return <section className="kitchen-page kitchen-access-state"><AlertCircle size={32} aria-hidden="true" /><h1>{panelLocation ? 'This location is not assigned to you.' : 'Location not found.'}</h1><p>Open a location assigned to your staff account to see its queue.</p><div>{assignedLocations.map(location => <Link key={location.id} className="kitchen-primary-link" to={`/panel/${location.id}`}>{location.name}<ArrowRight size={16} /></Link>)}</div></section>;

  return <section className="kitchen-page" aria-labelledby="kitchen-title">
    <header className="kitchen-heading">
      <div><p className="kitchen-eyebrow">Staff workspace</p><h1 id="kitchen-title">{panelTitle}</h1><p className="kitchen-intro">{panelLocation?.building || 'Your assigned locations, in one view.'}</p></div>
      <div className="kitchen-header-tools"><span className="kitchen-demo-label">Demo</span><div className={syncError ? 'kitchen-disconnected' : 'kitchen-connected'}>{syncError ? <WifiOff size={15} aria-hidden="true" /> : <span className="kitchen-live-dot" />}<span>{syncError ? 'Updates disconnected' : lastSync ? `Synced ${time(lastSync)}` : 'Connecting…'}</span></div><button type="button" className="kitchen-icon-button" aria-label="Refresh kitchen" title="Refresh kitchen" onClick={() => void load(true)} disabled={syncing || busy}><RefreshCw size={18} className={syncing ? 'kitchen-spinning' : ''} aria-hidden="true" /></button></div>
    </header>
    <div className="kitchen-demo-notice"><AlertCircle size={16} aria-hidden="true" /><p>Fictional IDs and orders. Payment confirmations are simulated; no real POS charges or meal swipes.</p></div>
    {syncError && <p className="kitchen-error" role="alert">{syncError} Tickets may be out of date. <Link to="/staff/login">Staff sign in</Link></p>}
    {actionError && <p className="kitchen-error" role="alert">{actionError}</p>}
    {notice && <p className="kitchen-announcement" role="status" aria-live="polite"><CheckCircle2 size={17} aria-hidden="true" />{notice}</p>}
    {currentCatalog ? <>
      <div className="kitchen-queue-toolbar">
        <div className="kitchen-queue-title"><ShoppingBag size={18} aria-hidden="true" /><span>Order queue</span></div>
        {!panelLocationId && assignedLocations.length > 1 && <label className="kitchen-location-filter">Location<select value={locationId} disabled={busy} onChange={event => { setLocationId(event.target.value); setStationId('all'); }}><option value="all">All assigned locations</option>{assignedLocations.map(location => <option value={location.id} key={location.id}>{location.name}</option>)}</select></label>}
        {showStationTabs && <div className="kitchen-station-tabs" role="group" aria-label="Filter the queue by station"><button type="button" aria-pressed={stationId === 'all'} disabled={busy} onClick={() => setStationId('all')}>All<span>{orders.filter(order => locationStations.some(station => station.id === order.stationId) && activeStatuses.includes(order.status)).length}</span></button>{stationGroups.map(station => <button type="button" key={physicalStationKey(station)} aria-pressed={Boolean(filterStation && physicalStationKey(filterStation) === physicalStationKey(station))} disabled={busy} onClick={() => { setStationId(station.id); if (!rushPending) { manuallySelectedControl.current = false; setControlStationId(openMenuAtSharedStation(station, assignedStations).id); } }}>{isGrillStation(station.id) ? 'Grill · Omelet + Hamburger' : station.name.replace(/ Station$/, '')}<span>{orders.filter(order => locationStations.some(candidate => candidate.id === order.stationId && physicalStationKey(candidate) === physicalStationKey(station)) && activeStatuses.includes(order.status)).length}</span></button>)}</div>}
        <div className="kitchen-view-total"><strong>{active.length}</strong><span>active {active.length === 1 ? 'order' : 'orders'}{showStationTabs && stationId !== 'all' ? ' in this view' : ''}</span></div>
      </div>
      <div className="kitchen-service-strip">{visibleStations.map(station => <span key={station.id} className={station.service?.acceptingOrders && !station.paused ? 'is-open' : 'is-closed'}><span className="kitchen-service-dot" />{visibleStations.length > 1 ? `${station.name.replace(/ Station$/, '')} · ` : ''}{station.paused ? 'Online paused' : station.service?.label || 'Checking hours'}{station.service?.open && station.service.closesAt ? ` · closes ${time(station.service.closesAt)}` : ''}</span>)}</div>
      {serviceClock && <div className={`kitchen-clock-line ${serviceClock.mode !== 'live' ? 'is-simulated' : ''}`}><Clock3 size={15} aria-hidden="true" /><strong>{serviceClock.mode === 'live' ? 'Live service time' : 'Simulated service time'}</strong><span>{dateTime(serviceClock.now)} · Central</span></div>}
      <div className={`kitchen-board kitchen-board-${boardLanes.length}`}>{boardLanes.map(column => {
        const laneOrders = active.filter(order => orderLane(order) === column.id);
        return <section key={column.id} className={`kitchen-lane kitchen-lane-${column.id}`} aria-labelledby={`kitchen-lane-${column.id}`}><div className="kitchen-lane-heading"><div><h2 id={`kitchen-lane-${column.id}`}><span className={`kitchen-status-dot kitchen-status-${column.id}`} />{column.label}<span className="kitchen-count">{laneOrders.length}</span></h2><p>{column.description}</p></div></div>{laneOrders.length ? laneOrders.map(order => <OrderCard key={order.id} order={order} busy={blocked} mutate={mutate} clockNow={serviceClock?.now} />) : <div className="kitchen-empty"><CheckCircle2 size={25} aria-hidden="true" /><p>{column.empty}</p></div>}</section>;
      })}</div>
      <p className="kitchen-small-note kitchen-board-note">Received orders need staff entry before preparation. Entered orders stay in the queue after closing.</p>
      <div className="kitchen-history"><button type="button" className="kitchen-text-button" aria-expanded={showCompleted} aria-controls="kitchen-completed" onClick={() => setShowCompleted(!showCompleted)}>{showCompleted ? 'Hide' : 'View'} completed & cancelled<span>{completed.length}</span></button>{showCompleted && <div id="kitchen-completed" className="kitchen-completed-grid">{completed.length ? completed.slice(0, 24).map(order => <OrderCard key={order.id} order={order} busy={blocked} mutate={mutate} clockNow={serviceClock?.now} />) : <p className="kitchen-small-note">No completed or cancelled orders in this view.</p>}{completed.length > 24 && <p className="kitchen-small-note">Showing the most recent 24 completed or cancelled orders.</p>}</div>}</div>
      {rushPending && <div className="kitchen-recovery-banner" role="status"><AlertCircle size={18} aria-hidden="true" /><div><strong>Unconfirmed queue simulation · {rushStationName}</strong><p>Recover the original request before starting another simulation.</p>{rushInPanel ? <button type="button" className="kitchen-text-button" disabled={busy} onClick={() => { setOperationsOpen(true); void simulateRush(); }}>Recover simulation<ArrowRight size={15} /></button> : <Link className="kitchen-text-button" to={rushStation ? `/panel/${rushStation.locationId}` : '/kitchen'}>Open its location<ArrowRight size={15} /></Link>}</div></div>}
      <details className="kitchen-operations" open={operationsOpen} onToggle={event => setOperationsOpen(event.currentTarget.open)}><summary><Settings2 size={19} aria-hidden="true" /><span>Station controls<small>Walk-ins, availability & capacity{isManager ? ' · demo tools' : ''}</small></span></summary><div className="kitchen-operations-body">
        {isManager && <section className="kitchen-clock-controls"><h3>Demo service clock</h3><p>Presets advance in real time. Accepted orders keep their pickup windows.</p><div>{clockModes.map(preset => <button key={preset.mode} type="button" className={serviceClock?.mode === preset.mode ? 'selected' : ''} aria-pressed={serviceClock?.mode === preset.mode} disabled={blocked} onClick={() => void mutate('/staff/demo-clock', { mode: preset.mode }, preset.mode === 'live' ? 'Service clock returned to live local time.' : `Simulated ${preset.name.toLowerCase()} clock is active.`)}><strong>{preset.name}</strong><span>{preset.description}</span></button>)}</div></section>}
        <div className="kitchen-operations-heading"><h3>Manage station</h3>{assignedStations.length > 1 ? <label><span className="kitchen-sr-only">Station to manage</span><select value={controlStationId} disabled={busy || Boolean(rushPending && rushInPanel)} onChange={event => { manuallySelectedControl.current = true; setControlStationId(event.target.value); }}>{assignedStations.map(station => <option value={station.id} key={station.id}>{isGrillStation(station.id) ? `Grill · ${station.id === 'omelet' ? 'Omelet' : 'Hamburger'} (${station.service.open ? 'open' : 'closed'})` : station.name}</option>)}</select></label> : <span>{controlStation?.name}</span>}</div>
        {controlStation && <>
          {hasSharedGrill && isGrillStation(controlStation.id) && <p className="kitchen-shared-grill-note">Omelet and Hamburger use the same physical grill and queue. These controls apply to the selected menu; use the menu selector to inspect either one.</p>}
          <div className="kitchen-station-bar"><div><p className="kitchen-location">{controlStation.location}</p><h3>{controlStation.name}</h3><p>{controlStation.onlineCapacity} online / {controlStation.capacity} total per window</p><p className="kitchen-service-line">{controlStation.service?.label}</p></div><div className="kitchen-station-actions"><button type="button" className="kitchen-outline-button" disabled={blocked} onClick={() => void mutate(`/staff/stations/${controlStation.id}`, { paused: !controlStation.paused }, controlStation.paused ? 'Online ordering resumed when service is open.' : 'New online orders paused. Accepted orders stay in the queue.')}>{controlStation.paused ? <Play size={16} aria-hidden="true" /> : <Pause size={16} aria-hidden="true" />}{controlStation.paused ? 'Resume online orders' : 'Pause online orders'}</button>{walkInAvailable && !blocked ? <Link to={`/order/${controlStationId}?staff=1`} className="kitchen-primary-link"><Plus size={17} aria-hidden="true" />Add walk-in</Link> : <button type="button" className="kitchen-primary-link" disabled><Plus size={17} aria-hidden="true" />{controlStation.service?.open ? 'No walk-in window' : 'Walk-ins closed'}</button>}</div></div>
          {controlStation.paused && <p className="kitchen-pause-notice">Online ordering is paused. Walk-ins can use remaining total capacity while service is open.</p>}
          <CapacityForm station={controlStation} busy={blocked} mutate={mutate} />
          <div className="kitchen-inventory"><h3>Menu availability</h3><p>Accepted orders keep their original choices.</p>{stationItems.map(item => <details className="kitchen-inventory-item" key={item.id}><summary><span>{item.name}</span><span className={item.available ? 'kitchen-available-label' : 'kitchen-soldout-label'}>{item.available ? 'Available' : 'Sold out'}</span></summary><div className="kitchen-inventory-content"><label className="kitchen-toggle-row"><span>Accept orders for this item</span><input type="checkbox" checked={item.available} disabled={blocked} onChange={() => void mutate(`/staff/items/${item.id}`, { available: !item.available }, `${item.name} ${item.available ? 'marked sold out' : 'available again'}.`)} /></label>{item.groups.map(group => <fieldset key={group.id}><legend>{group.label}</legend><div className="kitchen-option-grid">{group.options.map(option => <label className="kitchen-option" key={option.id}><input type="checkbox" checked={option.available} disabled={blocked} onChange={() => void mutate(`/staff/items/${item.id}/groups/${group.id}/options/${option.id}`, { available: !option.available }, `${option.label} ${option.available ? 'marked sold out' : 'available again'}.`)} /><span>{option.label}</span><span className="kitchen-option-state">{option.available ? 'Available' : 'Sold out'}</span></label>)}</div></fieldset>)}</div></details>)}</div>
          {controlStation.service?.scheduleNote && <details className="kitchen-hours-note"><summary>Hours & prototype policy</summary><p>{controlStation.service.scheduleNote}</p></details>}
        </>}
        {isManager && <div className="kitchen-rush-controls"><div><span className="kitchen-eyebrow">Manager simulation</span><h3>Try a busy queue</h3><p id="kitchen-rush-description">Adds fictional queue tickets to this station. No real orders or payments.</p><small>Up to 3 tickets in the first available window, within remaining capacity.</small></div><button type="button" className="kitchen-outline-button" aria-describedby="kitchen-rush-description" disabled={busy || !rushInPanel || (!rushPending && (blocked || !rushAvailable))} onClick={() => void simulateRush()}><Users size={17} aria-hidden="true" />{rushSending ? 'Checking simulation…' : rushPending ? 'Recover simulation' : 'Simulate 3 orders'}</button></div>}
      </div></details>
      <p className="kitchen-footer-note"><Laptop size={16} aria-hidden="true" />Use a shared iPad per location or a laptop for multiple stations. Counts reflect demo orders, not the physical line. Times are Central.</p>
    </> : <div className="kitchen-loading"><ShoppingBag size={30} aria-hidden="true" /><p>{syncError ? 'Restore the connection to see your kitchen.' : 'Loading your assigned queue…'}</p></div>}
  </section>;
}
