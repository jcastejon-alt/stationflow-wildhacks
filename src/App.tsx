import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, NavLink, Route, Routes, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, ArrowRight, ChefHat, LoaderCircle, MapPin, Ticket, Utensils } from 'lucide-react';
import { readStorage, usePoll } from './api';
import { AuthGate, accountStorageKey, staffHomePath, useAuth } from './AuthContext';
import type { Catalog } from './types';
import OrderPage from './OrderPage';
import TicketPage from './TicketPage';
import KitchenPage from './Kitchen';
import LoginPage from './LoginPage';
import StaffLoginPage from './StaffLoginPage';
import WorkerPanel from './WorkerPanel';
import MyOrdersPage from './MyOrdersPage';
import LocationPage, { ClockNotice, PlaceCards } from './Places';

export function ErrorBox({ message, retry, id }: { message: string; retry?: () => void; id?: string }) {
  return (
    <div className="error-box" role="alert" id={id}>
      <AlertCircle size={20} />
      <div>{message}{retry && <button className="text-button" onClick={retry}>Try again <ArrowRight size={14} /></button>}</div>
    </div>
  );
}

export function Loading() {
  return <div className="loading" role="status"><LoaderCircle className="spin" /> Getting things ready…</div>;
}

function CampusHome() {
  const { data, error, loading, refresh } = usePoll<Catalog>('/catalog');
  const { user } = useAuth();
  const lastTicket = user ? readStorage(accountStorageKey(user, 'last-ticket')) : null;

  return (
    <section className="campus-home">
      <div className="campus-welcome">
        <div>
          <span className="eyebrow">YOUR NEXT GOOD THING</span>
          <h1>Where are we eating?</h1>
          <p>Explore each place. Order when service is open. We’ll keep you posted.</p>
        </div>
        <span className="campus-context"><MapPin size={14} /> Trevecca campus</span>
      </div>
      <div className="campus-utility-row">
      {lastTicket && (
        <Link className="resume-order-link" to={`/ticket/${encodeURIComponent(lastTicket)}`}>
          <span className="resume-order-icon"><Ticket size={19} /></span>
          <span><strong>Your latest order</strong><small>View order details</small></span>
          <ArrowRight size={17} />
        </Link>
      )}
      {data && <ClockNotice catalog={data} />}
      </div>
      {error && <ErrorBox message={error} retry={() => void refresh()} />}
      {loading && <Loading />}
      {data && <PlaceCards catalog={data} />}
      <div className="campus-how">
        <span><strong>01</strong> Choose your place</span>
        <ArrowRight size={13} />
        <span><strong>02</strong> Make your order</span>
        <ArrowRight size={13} />
        <span><strong>03</strong> Pick up when ready</span>
      </div>
    </section>
  );
}

function HomeRoute() {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'student') return <Navigate to={staffHomePath(user)} replace />;
  return <AuthGate role="student"><CampusHome /></AuthGate>;
}

function OrderRoute() {
  const [params] = useSearchParams();
  return <AuthGate role={params.get('staff') === '1' ? 'staff' : 'student'}><OrderPage /></AuthGate>;
}

function TicketRoute() {
  const [params] = useSearchParams();
  return <AuthGate role={params.get('staff') === '1' ? 'staff' : undefined}><TicketPage /></AuthGate>;
}

function pageTitle(pathname: string) {
  if (pathname === '/') return 'Campus dining';
  if (pathname === '/login') return 'Student entry';
  if (pathname === '/staff' || pathname === '/staff/login') return 'Staff sign-in';
  if (pathname.startsWith('/locations/')) return 'Dining location';
  if (pathname === '/my-orders') return 'My orders';
  if (pathname.startsWith('/order/')) return 'Build your order';
  if (pathname.startsWith('/ticket/')) return 'Order details';
  if (pathname === '/kitchen' || pathname.startsWith('/panel/')) return 'Staff panel';
  return 'Page not found';
}

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loading, error, logout, refresh } = useAuth();
  const [switchingAccount, setSwitchingAccount] = useState<{ entry: string; fromKey: string } | null>(null);
  const mainRef = useRef<HTMLElement>(null);
  const previousPath = useRef(location.pathname);
  const isStaff = Boolean(user && user.role !== 'student');
  const isEntry = ['/login', '/staff', '/staff/login'].includes(location.pathname);
  const isPanel = location.pathname === '/kitchen' || location.pathname.startsWith('/panel/');

  useEffect(() => {
    document.title = `${pageTitle(location.pathname)} | StationFlow`;
    window.scrollTo(0, 0);
    const changed = previousPath.current !== location.pathname;
    previousPath.current = location.pathname;
    if (!changed) return;
    const frame = window.requestAnimationFrame(() => mainRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [location.pathname]);

  useEffect(() => {
    if (
      switchingAccount &&
      location.key !== switchingAccount.fromKey &&
      location.pathname === switchingAccount.entry &&
      !location.search
    ) {
      setSwitchingAccount(null);
    }
  }, [location.key, location.pathname, location.search, switchingAccount]);

  async function switchAccount() {
    const entry = isStaff ? '/staff/login' : '/login';
    setSwitchingAccount({ entry, fromKey: location.key });
    if (await logout()) navigate(entry, { replace: true });
    else setSwitchingAccount(null);
  }

  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <div className="prototype-strip">
        <span>Independent prototype · Demo orders only</span>
        <span className="draft-label">A CAMPUS DINING CONCEPT</span>
      </div>
      <header className="site-header">
        <Link to="/" className="brand" aria-label="StationFlow home">
          <span className="brand-symbol"><Utensils size={21} /></span>stationflow<span className="brand-dot">.</span>
        </Link>
        <nav aria-label="Main navigation" className="journey-nav">
          {user?.role === 'student' ? (
            <>
              <NavLink to="/" end className="journey-nav-link">Order</NavLink>
              <NavLink to="/my-orders" className="journey-nav-link"><Ticket size={16} /> My orders</NavLink>
            </>
          ) : user ? (
            <NavLink to={staffHomePath(user)} className="journey-nav-link"><ChefHat size={17} /> My panel</NavLink>
          ) : !loading && (
            <Link to={location.pathname.startsWith('/staff') ? '/login' : '/staff/login'} className="journey-nav-link entry-nav-link">
              {location.pathname.startsWith('/staff') ? <><Utensils size={15} /> Student ordering</> : <><ChefHat size={15} /> Staff</>}
            </Link>
          )}
        </nav>
      </header>
      {user && (
        <div className="journey-account-bar">
          <span>{user.role === 'student' && user.studentId ? `Student ${user.studentId}` : user.displayName}</span>
          <button onClick={() => void switchAccount()}>{isStaff ? 'Sign out' : 'Switch ID'} <ArrowRight size={12} /></button>
        </div>
      )}
      {error && !isEntry && (
        <div className="auth-status-error" role="status">
          {error}<button className="text-button" onClick={() => void refresh()}>Check session</button>
        </div>
      )}
      <main id="main" ref={mainRef} tabIndex={-1} className={isPanel ? 'main-shell kitchen-shell' : 'main-shell'}>
        {switchingAccount ? <Loading /> : <Routes>
          <Route path="/" element={<HomeRoute />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/staff" element={<StaffLoginPage />} />
          <Route path="/staff/login" element={<StaffLoginPage />} />
          <Route path="/locations/:locationId" element={<AuthGate role="student"><LocationPage /></AuthGate>} />
          <Route path="/my-orders" element={<AuthGate role="student"><MyOrdersPage /></AuthGate>} />
          <Route path="/order/:stationId" element={<OrderRoute />} />
          <Route path="/ticket/:token" element={<TicketRoute />} />
          <Route path="/panel/:locationId" element={<AuthGate role="staff"><WorkerPanel /></AuthGate>} />
          <Route path="/kitchen" element={<AuthGate role="staff"><KitchenPage /></AuthGate>} />
          <Route path="*" element={<section className="empty-state"><Ticket /><h1>This page took a detour.</h1><Link to="/" className="button primary">Back to campus <ArrowRight size={18} /></Link></section>} />
        </Routes>}
      </main>
      <footer className="site-footer">
        <Link className="footer-brand" to="/">stationflow.</Link>
        <span>More time for the moments between meals.</span>
        <span>Student concept · Not an official dining service</span>
      </footer>
    </>
  );
}
