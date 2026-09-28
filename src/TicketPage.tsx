import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Bell, BellRing, Check, CheckCircle2, ChefHat, Clock3, Copy, MapPin, ShieldCheck, Ticket, Users, X } from 'lucide-react';
import { api, time, usePoll, windowLabel, writeStorage } from './api';
import type { Order, Status } from './types';
import { ErrorBox, Loading } from './App';
import { accountStorageKey, useAuth } from './AuthContext';
import './order-flow.css';
import './ticket-cart.css';
import { isCafeteriaStation, isGrillStation } from './cafeteria';
const statusLabels: Record<Status, string> = {
  received: 'Order sent',
  entered: 'Your order has been entered.',
  preparing: 'Your order is being prepared.',
  ready: 'Your order is ready for pickup.',
  picked_up: 'Enjoy your good thing.',
  cancelled: 'This order was cancelled.'
};
const statusDescription: Record<Status, string> = {
  received: 'Your ticket has reached the team. We’ll update it when staff enters the order.',
  entered: 'Staff entered your order. We’ll update this ticket when preparation begins.',
  preparing: 'Staff started preparing your order. Keep this ticket open for the ready notice.',
  ready: 'Head to your station and show the pickup code below.',
  picked_up: 'Your pickup is complete. A little time back, a good thing to go.',
  cancelled: 'No payment or real meal swipe was taken. You can start a new order anytime.'
};
const cafeteriaSteps = ['Order sent', 'Accepted at station', 'Preparing', 'Ready for pickup', 'Picked up'];
const retailSteps = ['Order sent', 'Entered', 'Payment received', 'Preparing', 'Ready for pickup', 'Picked up'];
export default function TicketPage() {
  const {
    user
  } = useAuth();
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const {
    token = ''
  } = useParams();
  const activeToken = useRef(token);
  activeToken.current = token;
  const staff = user?.role === 'staff' || user?.role === 'manager';
  const {
    data,
    error,
    loading,
    refresh,
    setData
  } = usePoll<{
    order: Order;
  }>(`/orders/${encodeURIComponent(token)}`);
  const order = data?.order;
  const [readyToastDismissed, setReadyToastDismissed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [copied, setCopied] = useState(false);
  const [cancelPrompt, setCancelPrompt] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | 'unsupported'>(() => window.isSecureContext && 'Notification' in window ? Notification.permission : 'unsupported');
  const notifying = useRef(false);
  const notified = useRef<string | null>(null);
  useEffect(() => {
    setBusy(false);
    setActionError('');
    setCopied(false);
    setCancelPrompt(false);
    setNotificationMessage('');
  }, [token]);
  useEffect(() => {
    setReadyToastDismissed(false);
  }, [order?.status, token]);
  useEffect(() => {
    if (order && token && user) writeStorage(accountStorageKey(user, 'last-ticket'), token);
  }, [order?.id, token, user?.id]);
  async function notifyReady(current: Order) {
    if (!window.isSecureContext || !mounted.current || notifying.current || notified.current === token || notificationPermission !== 'granted') return;
    try {
      if (sessionStorage.getItem(`stationflow:notified:${token}`) === '1') return;
    } catch {/* Notification deduplication is also held in memory. */}
    notifying.current = true;
    try {
      const options = {
        body: `Pickup ${current.pickupCode} · ${current.stationName}. Open your ticket for details.`,
        tag: `stationflow-${current.id}`,
        data: {
          url: `/ticket/${encodeURIComponent(token)}`
        }
      };
      const registration = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : undefined;
      if (!mounted.current || activeToken.current !== token) return;
      if (registration?.active) {
        await registration.showNotification('Your demo order is ready', options);
      } else {
        const notification = new Notification('Your demo order is ready', options);
        notification.onclick = () => {
          window.focus();
          notification.close();
        };
      }
      notified.current = token;
      try {
        sessionStorage.setItem(`stationflow:notified:${token}`, '1');
      } catch {/* Optional browser metadata only. */}
      setNotificationMessage('Ready alert sent while this ticket was open.');
    } catch {
      setNotificationMessage('A system alert could not be shown here. Your live ready notice is still active on this page.');
    } finally {
      notifying.current = false;
    }
  }
  useEffect(() => {
    if (order?.status === 'ready') void notifyReady(order);
  }, [order?.status, notificationPermission, token]);
  async function enableNotifications() {
    if (!window.isSecureContext) {
      setNotificationMessage('For this local Wi-Fi demo, keep this page open. Ready alerts appear here.');
      return;
    }
    if (!('Notification' in window)) {
      setNotificationMessage('This browser does not support system alerts here. Keep this ticket open for the ready notice.');
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      if (permission === 'granted') {
        if ('serviceWorker' in navigator) {
          try {
            await navigator.serviceWorker.register('/sw.js');
          } catch {/* Notification constructor is the foreground fallback. */}
        }
        setNotificationMessage('Alerts enabled for this open ticket. Keep this page open; background push is not connected in this draft.');
      } else if (permission === 'denied') {
        setNotificationMessage('System alerts are blocked. Your in-app ready notice will still work while this ticket is open.');
      } else {
        setNotificationMessage('No problem. Keep this ticket open and watch for the ready notice.');
      }
    } catch {
      setNotificationMessage('System alerts are unavailable in this browser. Your live ticket still updates automatically.');
    }
  }
  async function cancel() {
    const requestedToken = token;
    const isCurrent = () => mounted.current && activeToken.current === requestedToken;
    setBusy(true);
    setActionError('');
    try {
      const result = await api<{ order: Order }>(`/orders/${encodeURIComponent(requestedToken)}/cancel`, { method: 'POST' });
      if (!isCurrent()) return;
      setData(result);
      setCancelPrompt(false);
      void refresh();
    } catch (error) {
      if (!isCurrent()) return;
      setActionError(error instanceof Error ? error.message : 'Unable to cancel this order.');
      void refresh();
    } finally {
      if (isCurrent()) setBusy(false);
    }
  }
  async function copyLink() {
    const requestedToken = token;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/ticket/${encodeURIComponent(requestedToken)}`);
      if (mounted.current && activeToken.current === requestedToken) setCopied(true);
    } catch {
      if (mounted.current && activeToken.current === requestedToken) setActionError('Your browser could not copy this link. Save the address from the address bar instead.');
    }
  }
  if (loading) return <Loading />;
  if (!order) return <section className="page-intro"><Link to="/" className="back-link"><ArrowLeft size={15} /> All stations</Link><h1>We couldn’t open this ticket.</h1><ErrorBox message={error || 'This ticket link may be incomplete or belong to another demo profile.'} retry={() => void refresh()} /><p>Your short pickup code cannot open a ticket. Open My orders from the demo profile used to place this order.</p></section>;
  const panelPath = `/panel/${isCafeteriaStation(order.stationId) ? 'cafeteria' : order.stationId}`;
  const studentId = order.studentId || order.payment?.studentId;
  const retail = !isCafeteriaStation(order.stationId) && order.payment?.method !== 'cafeteria_entry';
  const steps = (retail ? retailSteps : cafeteriaSteps).map((step, index) => index === 0 && order.source === 'walk_in' ? 'Order received' : step);
  const paymentConfirmed = order.payment?.status === 'approved';
  const paymentDeclined = retail && order.payment?.status === 'declined';
  const entered = ['entered', 'preparing', 'ready', 'picked_up'].includes(order.status);
  const preparing = ['preparing', 'ready', 'picked_up'].includes(order.status);
  const ready = ['ready', 'picked_up'].includes(order.status);
  const pickedUp = order.status === 'picked_up';
  const completedSteps = retail
    ? [true, entered, paymentConfirmed, preparing, ready, pickedUp]
    : [true, entered, preparing, ready, pickedUp];
  // Payment on an older ticket may already be approved while its status is still received.
  // Keep that milestone complete without claiming that staff entered the order.
  const activeStep = retail ? {
    received: 0,
    entered: paymentConfirmed ? 2 : 1,
    preparing: 3,
    ready: 4,
    picked_up: 5,
    cancelled: -1
  }[order.status] : {
    received: 0,
    entered: 1,
    preparing: 2,
    ready: 3,
    picked_up: 4,
    cancelled: -1
  }[order.status];
  const finished = ['picked_up', 'cancelled'].includes(order.status);
  const items = order.items?.length ? order.items : [{ itemId: order.itemId, itemName: order.itemName, quantity: 1, selectionSummary: order.selectionSummary, exclusions: order.exclusions, unitPricing: order.pricing }];
  const paymentWaiting = retail && order.status === 'entered' && !paymentConfirmed && !paymentDeclined;
  const headline = paymentDeclined && !preparing ? 'Payment not confirmed' : retail && order.status === 'received' && paymentConfirmed ? 'Payment received (demo)' : !retail && order.status === 'entered' ? 'Your order was accepted at the station.' : statusLabels[order.status];
  const description = paymentDeclined && !preparing ? 'Staff could not confirm the simulated payment, so preparation will not begin.' : retail && order.status === 'received' && paymentConfirmed ? 'Staff confirmed the simulated payment. We’ll update this ticket when they enter your order.' : !retail && order.status === 'received' ? 'Your ticket has reached the team. We’ll update it when staff accepts your order at the station.' : !retail && order.status === 'entered' ? 'Station staff accepted your order. We’ll update this ticket when preparation begins.' : statusDescription[order.status];
  return <div className="ticket-flow"><section className="page-intro ticket-intro"><Link className="back-link" to={staff ? panelPath : '/my-orders'}><ArrowLeft size={15} />{staff ? 'Back to location panel' : 'My orders'}</Link><span className="eyebrow">{studentId ? `ORDER FOR STUDENT ${studentId}` : 'YOUR LIVE PICKUP TICKET'}</span><h1 aria-live="polite">{headline}</h1><p>{description}</p></section>
 <div className={`ticket-layout ${order.status === 'ready' && !readyToastDismissed && !staff ? 'has-ready-toast' : ''}`}><div>{error && <ErrorBox message={`Updates disconnected. The information below may be out of date. ${error}`} retry={() => void refresh()} />}<div className={`ready-announcement ${order.status === 'ready' ? 'visible' : ''}`}>{order.status === 'ready' && <><BellRing size={25} /><div><strong>Good news — it’s ready!</strong><span>Pick up {order.pickupCode} at {order.stationName}.</span></div></>}</div>
 {order.status === 'entered' && <div className="entered-announcement" role="status" aria-live="polite"><ChefHat size={25} /><div><strong>{retail ? 'Your order has been entered.' : 'Your order was accepted at the station.'}</strong><span>{retail && !paymentConfirmed ? 'Staff will confirm the simulated payment before preparation starts.' : 'We’ll update this ticket when preparation starts.'}</span></div></div>}
 <section className={`live-ticket panel ticket-status-${order.status}`}><div className="live-ticket-header"><span className="receipt-brand"><Ticket size={20} /> stationflow</span><span className={`ticket-live-indicator ${error ? 'offline' : ''}`}><span className="dot" />{error ? 'Updates disconnected' : finished ? 'Completed ticket' : 'Live updates'}</span></div><div className="pickup-code-block" id="pickup-code"><span className="field-eyebrow">YOUR PICKUP CODE</span><strong>{order.pickupCode}</strong><span>Show this at {order.stationName}</span>{retail && studentId && <span className="ticket-student-label">Student {studentId}</span>}</div><div className="ticket-divider"><span /><span /></div><div className="ticket-meta"><div><MapPin size={19} /><span><small>Pick up here</small><strong>{order.stationName}</strong><span>{order.location !== order.stationName ? order.location : null}</span></span></div><div><Clock3 size={19} /><span><small>{order.timingMode === 'asap' ? 'Right now · estimated pickup' : 'Scheduled pickup'}</small><strong>{windowLabel(order.slot)}</strong><span>{order.timingMode === 'asap' ? 'First available window when accepted' : 'America/Chicago · Demo window'}</span></span></div></div>
 {order.status !== 'cancelled' && <section className="order-tracker" aria-label="Demo order tracking"><div className="tracker-caption"><span>YOUR ORDER, STEP BY STEP</span><strong>Demo tracking · No real payment</strong></div><ol className={`progress-track ${retail ? 'retail-progress' : ''}`} aria-label="Order progress">{steps.map((label, index) => {
                const blocked = paymentDeclined && retail && index === 2;
                const complete = completedSteps[index];
                const connected = completedSteps.slice(0, index + 1).every(Boolean);
                return <li key={label} className={`${complete ? 'complete' : ''} ${connected ? 'connected' : ''} ${blocked ? 'payment-blocked' : ''}`} aria-current={index === activeStep ? 'step' : undefined}><span className="progress-dot">{blocked ? <X size={12} /> : complete && index !== activeStep ? <Check size={12} /> : index + 1}</span><span className="progress-step-label">{label}{retail && index === 2 && <small>{paymentDeclined ? 'Not confirmed' : paymentConfirmed ? 'Confirmed (demo)' : entered ? 'Awaiting staff confirmation' : 'After order entry'}</small>}</span></li>;
              })}</ol>{paymentWaiting && <p className="tracker-current-note"><Clock3 size={14} /> Order entered. Waiting for staff to confirm the simulated payment before preparation.</p>}{paymentDeclined && <p className="tracker-current-note tracker-blocked-note"><X size={14} /> Payment not confirmed. This order will not move to preparation.</p>}</section>}
 {retail && paymentConfirmed && order.status === 'ready' && <div className="pickup-responsibility"><ShieldCheck size={17} /><div><strong>Already paid in this demo.</strong><span>Pickup remains your responsibility. No automatic refund for an uncollected order.</span><small>No real funds or meal swipe were used.</small></div></div>}{order.status === 'cancelled' && <div className="cancelled-banner"><X size={17} /> Cancelled · No real charge or meal swipe</div>}{!finished && order.status !== 'ready' && order.source === 'online' && <div className="queue-insight"><Users size={18} /><div><strong>{order.queueAhead === 0 ? 'You’re next in the digital queue' : `${order.queueAhead} digital ${order.queueAhead === 1 ? 'order' : 'orders'} ahead`}</strong><span>{isGrillStation(order.stationId) ? 'Earlier digital orders at this shared grill still awaiting or in preparation today, with pickup at or before yours. This does not estimate the physical line.' : 'Earlier digital orders at this station still awaiting or in preparation today, with pickup at or before yours. This does not estimate the physical line.'}</span></div></div>}
 <div className="ticket-order-detail">
   <span className="field-eyebrow">MADE YOUR WAY</span>
   <div className="ticket-items" aria-label="Items in this order">{items.map((item, index) => <section className="ticket-item" key={`${item.itemId}-${index}`}>
     <h2><span className="ticket-item-quantity">{item.quantity}×</span>{item.itemName}</h2>
     {item.selectionSummary.map((group, groupIndex) => <div className="ticket-detail-line" key={`${group.kind || ''}-${group.group}-${groupIndex}`}><span>{group.label}</span><strong>{group.values.join(', ') || 'None'}</strong></div>)}
     {item.exclusions.length > 0 && <div className="ticket-exclusions"><strong><MinusMark /> LEAVE OUT</strong><span>{item.exclusions.join(' · ')}</span></div>}
   </section>)}</div>
   {order.pricing && <div className="ticket-detail-line ticket-order-total"><span>{order.pricing.status === 'meal_swipe' ? 'Order' : 'Order total'}</span><strong>{order.pricing.status === 'meal_swipe' ? '1 meal swipe' : order.pricing.status === 'included' ? 'Included' : order.pricing.amountCents === null ? 'Price to confirm' : `${order.pricing.status === 'demo' ? 'Demo · ' : ''}$${(order.pricing.amountCents / 100).toFixed(2)}`}</strong></div>}
   <div className="ticket-method"><span>{order.payment?.method === 'cafeteria_entry' ? 'Included after dining hall entrance' : order.payment?.method === 'counter' ? 'Counter payment (demo)' : order.paymentMode === 'meal_exchange' ? 'Meal exchange (demo · fictional eligibility)' : 'Campus account (demo)'}</span><span>{order.source === 'walk_in' ? 'Walk-in entry' : 'Ordered online'}</span></div><div className="ticket-no-charge"><ShieldCheck size={14} /> No payment or real meal swipe was taken.</div>
 </div><div className="ticket-bottom"><span>Created at {time(order.createdAt)}</span><span>One good thing, coming up.</span></div></section>
 <div className="ticket-actions"><button className="button secondary" onClick={() => void copyLink()}><Copy size={16} />{copied ? 'Ticket link copied' : 'Copy ticket link'}</button>{finished && <Link className="button primary" to="/">Find another good thing <ArrowRight size={16} /></Link>}</div><p className="private-link-note">Saved to your demo profile. Find it again in My orders after entering the same demo Student ID.</p>{actionError && <ErrorBox message={actionError} />}</div>
 <aside className="ticket-sidebar"><PaymentStatus order={order} />{!finished && order.status !== 'ready' && <section className="panel alert-panel"><span className="big-icon"><Bell size={26} /></span><h2>We’ll keep you<br />in the loop.</h2><p>Keep this ticket open. We’ll show your pickup alert when the team marks it ready.</p><div className="inapp-alert-enabled"><CheckCircle2 size={17} /><span>In-app pickup alerts are active</span></div>{!window.isSecureContext ? <div className="note local-wifi-notice">For this local Wi-Fi demo, keep this page open. Ready alerts appear here.</div> : notificationPermission === 'granted' ? <div className="notification-enabled"><CheckCircle2 size={17} /> Browser alerts allowed</div> : notificationPermission === 'denied' ? <div className="note">System alerts are blocked. In-app updates are active.</div> : notificationPermission === 'unsupported' ? <div className="note">Use the live notice here; this browser does not support system alerts.</div> : <button className="button secondary full" onClick={() => void enableNotifications()}><Bell size={15} /> Enable browser alerts</button>}{notificationMessage && <p className="notification-feedback" role="status">{notificationMessage}</p>}<p className="notification-limits">Keep this page open and your screen awake for the demo. It will not notify you with the browser closed or the phone locked.</p></section>}
 <section className="ticket-help"><ChefHat size={21} /><h3>About this demo</h3><p>Your order is part of this demo. No real payment or meal swipe is taken.</p>{staff ? <Link className="text-button" to={panelPath}>Open location panel <ArrowRight size={14} /></Link> : <Link className="text-button" to="/my-orders">All my orders <ArrowRight size={14} /></Link>}</section>
 {order.status === 'received' && !staff && order.payment?.status !== 'approved' && <section className="cancel-section">{cancelPrompt ? <><p>Cancel this demo order before the kitchen starts preparing it?</p><div><button className="button danger" onClick={() => void cancel()} disabled={busy}>{busy ? 'Cancelling…' : 'Yes, cancel order'}</button><button className="text-button" onClick={() => setCancelPrompt(false)} disabled={busy}>Keep order</button></div></> : <button className="text-button cancel-link" onClick={() => setCancelPrompt(true)}>Cancel this demo order</button>}</section>}
 </aside></div>{order.status === 'ready' && !readyToastDismissed && !staff && <div className="pickup-ready-toast" role="alert" aria-live="assertive" aria-atomic="true"><span className="pickup-toast-icon"><BellRing size={23} /></span><div><strong>Ready for pickup</strong><span>{order.pickupCode} · {order.stationName}</span><button type="button" onClick={() => {
          document.getElementById('pickup-code')?.scrollIntoView({
            block: 'center',
            behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
          });
          setReadyToastDismissed(true);
        }}>View pickup code <ArrowRight size={13} /></button></div><button className="pickup-toast-dismiss" type="button" aria-label="Dismiss pickup alert" onClick={() => setReadyToastDismissed(true)}><X size={17} /></button></div>}</div>;
}
function PaymentStatus({
  order
}: {
  order: Order;
}) {
  const payment = order.payment;
  if (!payment) return null;
  if (order.status === 'cancelled') return <section className="ticket-payment payment-not_required"><ShieldCheck size={23} /><h3>No payment action needed</h3><p>This demo order was cancelled. No real charge or meal swipe occurred, and preparation will not begin.</p></section>;
  const approvedProgress = order.status === 'picked_up' ? 'Pickup is complete.' : order.status === 'ready' ? 'Your order is ready for pickup.' : order.status === 'preparing' ? 'Your order is being prepared.' : order.status === 'entered' ? 'Your order is waiting for preparation to begin.' : 'Your order is waiting for staff to enter it.';
  const messages = {
    not_required: {
      title: 'No extra station payment',
      description: 'Dining hall access is checked at the entrance. This station does not require another ID check, charge, or swipe.'
    },
    pending: {
      title: payment.method === 'counter' ? 'Awaiting staff payment confirmation' : 'Waiting for staff to accept',
      description: payment.method === 'counter' ? 'After entering the order, staff will record a simulated counter payment before preparation starts.' : 'The worker accepts after entering your linked demo ID in the separate POS. Accept confirms the fictional payment and starts preparation.'
    },
    approved: {
      title: 'Demo payment approved',
      description: `Staff confirmed the simulated payment. ${approvedProgress} No real charge was made.`
    },
    declined: {
      title: 'Demo payment declined',
      description: 'Preparation will not start. You can cancel this ticket and create a new order. Nothing was charged and no automatic payment retry will occur.'
    }
  };
  const message = messages[payment.status];
  return <section className={`ticket-payment payment-${payment.status}`} aria-live="polite"><ShieldCheck size={23} /><h3>{message.title}</h3><p>{message.description}</p>{payment.method !== 'cafeteria_entry' && <span>{payment.method === 'meal_exchange' ? 'Fictional meal exchange' : payment.method === 'counter' ? 'Counter payment simulation' : 'Campus account simulation'}</span>}</section>;
}
function MinusMark() {
  return <span aria-hidden="true">−</span>;
}
