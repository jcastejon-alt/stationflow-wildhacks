import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Coffee, ChefHat, UtensilsCrossed, LockKeyhole } from 'lucide-react';
import { useAuth } from './AuthContext';
import { ErrorBox, Loading } from './App';
import './worker-panel.css';

type Venue = { id: string; name: string; detail: string; icon: typeof ChefHat };
const venues: Venue[] = [
  { id: 'cafeteria', name: 'Cafeteria', detail: 'All Cafeteria orders', icon: UtensilsCrossed },
  { id: 'hub', name: 'The Hub', detail: 'The Hub orders', icon: ChefHat },
  { id: 'starbucks', name: 'Starbucks', detail: 'Starbucks orders', icon: Coffee },
  { id: 'frothy', name: 'Frothy Monkey', detail: 'Coffee and café orders', icon: Coffee },
];

export default function StaffLoginPage() {
  const { loading, login, error: sessionError } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [managerName, setManagerName] = useState('manager');
  const [managerPassword, setManagerPassword] = useState('CampusDemo!26');

  async function enter(account: string) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const next = await login(account, 'CampusDemo!26');
      if (next.role !== 'staff') throw new Error('This account is not assigned to a worker queue.');
      navigate(`/panel/${account}`, { replace: true });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not open this queue. Try again.');
    } finally {
      setBusy(false);
    }
  }

  async function enterManager(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const next = await login(managerName.trim(), managerPassword);
      if (next.role !== 'manager') throw new Error('Manager access is required for demo setup.');
      navigate('/kitchen', { replace: true });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not open demo setup.');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Loading />;
  return <section className="worker-entry">
    <Link className="back-link" to="/login"><ArrowLeft size={16} /> Student ordering</Link>
    <div className="worker-entry-intro"><span className="eyebrow">STAFF DEMO</span><h1>Choose your counter.</h1><p>Open the orders arriving at your station.</p></div>
    {(error || sessionError) && <ErrorBox message={error || sessionError} />}
    <div className="worker-venue-grid" aria-label="Choose a dining location">
      {venues.map(({ id, name, detail, icon: Icon }) => <div className="worker-venue-wrap" key={id}>
        <button type="button" className="worker-venue" disabled={busy} onClick={() => void enter(id)}>
          <span className="worker-venue-icon"><Icon size={27} strokeWidth={1.6} /></span><span className="worker-venue-copy"><strong>{name}</strong><small>{detail}</small></span><ArrowRight className="worker-venue-arrow" size={20} />
        </button>
      </div>)}
    </div>
    <p className="worker-entry-note">Local prototype · fictional orders and payment confirmation.</p>
    <details className="worker-manager-entry"><summary><LockKeyhole size={15} /> Manager / demo setup</summary>
      <form onSubmit={event => void enterManager(event)}>
        <label>Username<input value={managerName} autoComplete="username" disabled={busy} onChange={event => setManagerName(event.target.value)} required /></label>
        <label>Password<input type="password" value={managerPassword} autoComplete="current-password" disabled={busy} onChange={event => setManagerPassword(event.target.value)} required /></label>
        <button className="button primary" disabled={busy} type="submit">Open demo setup <ArrowRight size={16} /></button>
      </form>
    </details>
  </section>;
}
