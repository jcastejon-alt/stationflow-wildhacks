import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { api, bumpAuthRevision } from './api';

export type DemoUser = {
  id: string;
  displayName: string;
  role: 'student' | 'staff' | 'manager';
  studentId?: string;
  stationIds: string[];
};

type AuthValue = {
  user: DemoUser | null;
  loading: boolean;
  error: string;
  login: (identifier: string, password: string) => Promise<DemoUser>;
  loginStudent: (studentId: string) => Promise<DemoUser>;
  logout: () => Promise<boolean>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);
const AUTH_EVENT = 'stationflow:auth-changed';
const stationLocations: Record<string, string> = {
  omelet: 'grill',
  hamburger: 'grill',
  sandwich: 'sandwich',
  hub: 'hub',
  frothy: 'frothy',
  starbucks: 'starbucks',
};

function broadcast() {
  try {
    localStorage.setItem(AUTH_EVENT, `${Date.now()}-${Math.random()}`);
  } catch {
    // Cross-tab notification only. The server session remains authoritative.
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<DemoUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const revision = useRef(0);
  const loggingOut = useRef(false);

  const refresh = useCallback(async () => {
    const current = ++revision.current;
    bumpAuthRevision();
    setLoading(true);
    setUser(null);
    try {
      const response = await api<{ user: DemoUser | null }>('/auth/me');
      if (current === revision.current) {
        setUser(response.user);
        setError('');
      }
    } catch (cause) {
      if (current === revision.current) {
        setError(cause instanceof Error ? cause.message : 'Unable to check your session.');
      }
    } finally {
      if (current === revision.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const unauthorized = () => {
      if (loggingOut.current) return;
      revision.current++;
      bumpAuthRevision();
      setUser(null);
      setLoading(false);
      setError('Your session ended. Enter your demo ID or sign in again.');
    };
    const changed = (event: StorageEvent) => {
      if (event.key === AUTH_EVENT) void refresh();
    };
    window.addEventListener('stationflow:unauthorized', unauthorized);
    window.addEventListener('storage', changed);
    return () => {
      revision.current++;
      window.removeEventListener('stationflow:unauthorized', unauthorized);
      window.removeEventListener('storage', changed);
    };
  }, [refresh]);

  function acceptSession(nextUser: DemoUser) {
    revision.current++;
    bumpAuthRevision();
    setUser(nextUser);
    setError('');
    setLoading(false);
    broadcast();
    return nextUser;
  }

  async function login(identifier: string, password: string) {
    bumpAuthRevision();
    const response = await api<{ user: DemoUser }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password }),
    });
    return acceptSession(response.user);
  }

  async function loginStudent(studentId: string) {
    bumpAuthRevision();
    const response = await api<{ user: DemoUser }>('/auth/student', {
      method: 'POST',
      body: JSON.stringify({ studentId }),
    });
    return acceptSession(response.user);
  }

  async function logout() {
    if (loggingOut.current) return false;
    loggingOut.current = true;
    revision.current++;
    bumpAuthRevision();
    setLoading(true);
    try {
      await api('/auth/logout', { method: 'POST' });
      setUser(null);
      setError('');
      broadcast();
      return true;
    } catch {
      setError('Sign-out could not be confirmed. Retry before sharing this browser.');
      return false;
    } finally {
      loggingOut.current = false;
      setLoading(false);
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, error, login, loginStudent, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth requires AuthProvider');
  return value;
}

export function accountStorageKey(user: DemoUser, key: string) {
  return `stationflow:${encodeURIComponent(user.id)}:${key}`;
}

export function staffHomePath(user: DemoUser) {
  if (user.role === 'manager') return '/kitchen';
  const locationId = user.stationIds.length === 3 && ['omelet', 'hamburger', 'sandwich'].every(id => user.stationIds.includes(id))
    ? 'cafeteria' : user.stationIds.map(id => stationLocations[id]).find(Boolean);
  const queueIds: Record<string, string[]> = { cafeteria: ['omelet', 'hamburger', 'sandwich'], grill: ['omelet', 'hamburger'], sandwich: ['sandwich'], hub: ['hub'], frothy: ['frothy'], starbucks: ['starbucks'] };
  const assigned = locationId ? queueIds[locationId] : undefined;
  return assigned && assigned.length === user.stationIds.length && assigned.every(id => user.stationIds.includes(id))
    ? `/panel/${locationId}` : '/kitchen';
}

export function safeReturnTo(value: string | null, fallback = '/') {
  if (!value || !value.startsWith('/') || value.startsWith('//') || /[\\\u0000-\u0020]/.test(value)) {
    return fallback;
  }
  try {
    const target = new URL(value, window.location.origin);
    const isEntry = /^\/(?:login|staff(?:\/login)?)(?:[/?#]|$)/.test(target.pathname);
    return target.origin === window.location.origin && !isEntry
      ? target.pathname + target.search + target.hash
      : fallback;
  } catch {
    return fallback;
  }
}

export function studentReturnTo(value: string | null) {
  const target = safeReturnTo(value);
  return target === '/' || /^\/(?:locations|order|ticket)(?:\/|$)/.test(target) || /^\/my-orders(?:[?#]|$)/.test(target)
    ? target
    : '/';
}

export function staffReturnTo(value: string | null, fallback: string) {
  const target = safeReturnTo(value, fallback);
  return /^\/kitchen(?:[?#]|$)/.test(target) || /^\/panel\/(?:cafeteria|grill|sandwich|hub|frothy|starbucks)(?:[?#]|$)/.test(target)
    ? target
    : fallback;
}

export function AuthGate({ children, role }: { children: ReactNode; role?: 'student' | 'staff' }) {
  const { user, loading, error, refresh } = useAuth();
  const location = useLocation();
  if (loading) return <div className="loading" role="status">Getting things ready…</div>;
  if (!user) {
    if (error && !error.includes('session ended')) {
      return (
        <section className="auth-gate-error panel">
          <h2>We couldn’t reconnect</h2>
          <p>{error}</p>
          <button className="button secondary" onClick={() => void refresh()}>Try again</button>
        </section>
      );
    }
    const entry = role === 'staff' ? '/staff/login' : '/login';
    return <Navigate to={`${entry}?returnTo=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  }
  if (role === 'student' && user.role !== 'student') {
    return (
      <section className="role-switch-card panel">
        <h1>Ordering as a student?</h1>
        <p>You’re signed in to a staff workspace. Switch profiles to start a student order.</p>
        <Link to="/login" className="button primary">Use a student ID</Link>
        <Link to={staffHomePath(user)} className="button secondary">Back to my panel</Link>
      </section>
    );
  }
  if (role === 'staff' && user.role === 'student') {
    return (
      <section className="role-switch-card panel">
        <h1>Behind the counter</h1>
        <p>This workspace needs a staff sign-in. Your current student profile stays active until you switch.</p>
        <Link to={`/staff/login?returnTo=${encodeURIComponent(location.pathname + location.search)}`} className="button primary">Staff sign-in</Link>
        <Link to="/" className="button secondary">Back to dining</Link>
      </section>
    );
  }
  return <div key={user.id} className="authenticated-content">{children}</div>;
}
