import { useState, type FormEvent } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, ChefHat, MapPin, Ticket, Utensils } from 'lucide-react';
import { staffHomePath, studentReturnTo, useAuth } from './AuthContext';
import { ErrorBox, Loading } from './App';

export default function LoginPage() {
  const { user, loading, loginStudent, logout, error: sessionError } = useAuth();
  const [params] = useSearchParams();
  const [studentId, setStudentId] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (loading) return <Loading />;
  if (user?.role === 'student') return <Navigate to={studentReturnTo(params.get('returnTo'))} replace />;
  if (user) {
    return (
      <section className="role-switch-card panel">
        <span className="entry-icon"><Utensils size={25} /></span>
        <span className="eyebrow">STUDENT ORDERING</span>
        <h1>Start with your student ID.</h1>
        <p>You’re currently signed in as {user.displayName}. Switch to the student experience or return to your workspace.</p>
        {sessionError && <ErrorBox message={sessionError} />}
        <button className="button primary" onClick={() => void logout()}>Switch to student entry <ArrowRight size={16} /></button>
        <Link to={staffHomePath(user)} className="button secondary">Open my panel</Link>
      </section>
    );
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (!/^\d{5}$/.test(studentId)) {
      setError('Enter a five-digit demo ID: 10001 or 10002.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await loginStudent(studentId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'We couldn’t open that demo profile. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="student-entry">
      <div className="student-entry-story">
        <span className="eyebrow entry-campus-label"><MapPin size={14} /> A LITTLE MORE TIME FOR CAMPUS</span>
        <h1>Good food.<br /><em>On your time.</em></h1>
        <p>Your campus favorites, made your way.<br />Order ahead. We’ll let you know when it’s ready.</p>
        <div className="entry-composition" aria-hidden="true">
          <div className="entry-paper">
            <div className="entry-paper-brand"><Utensils size={16} /> stationflow<span>✳</span></div>
            <div className="entry-paper-rule" />
            <span className="entry-paper-label">THE PLAN IS SIMPLE</span>
            <strong>A good meal.<br />A little more time.</strong>
            <div className="entry-paper-rule" />
            <div className="entry-paper-steps"><span>01 Order</span><span>02 Follow</span><span>03 Pick up</span></div>
          </div>
          <div className="entry-campus-seal"><span>LESS WAITING</span><strong>More<br /><em>living.</em></strong><span>THAT’S THE IDEA</span></div>
        </div>
        <div className="entry-places-line"><span>Cafeteria</span><i /> <span>The Hub</span><i /><span>Frothy</span><i /><span>Starbucks</span></div>
      </div>
      <div className="student-entry-card panel">
        <div className="entry-card-top"><span className="entry-icon"><Ticket size={24} /></span><span className="entry-card-label">YOUR CAMPUS. YOUR PICKUP.</span></div>
        <span className="eyebrow">WELCOME TO STATIONFLOW</span>
        <h2>What sounds good?</h2>
        <p>Enter your student ID to find your next favorite.</p>
        <form noValidate onSubmit={event => void submit(event)}>
          <label className="student-id-field" htmlFor="student-id">Student ID</label>
          <input
            id="student-id"
            className="student-id-input"
            inputMode="numeric"
            autoComplete="off"
            pattern="[0-9]{5}"
            maxLength={5}
            placeholder="10001"
            value={studentId}
            onChange={event => { setStudentId(event.target.value.replace(/\D/g, '')); setError(''); }}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? 'student-id-help student-id-error' : 'student-id-help'}
            required
            disabled={busy}
          />
          <p className="student-id-help" id="student-id-help">Try demo ID <strong>10001</strong> or <strong>10002</strong>.</p>
          {(error || sessionError) && <ErrorBox id={error ? 'student-id-error' : undefined} message={error || sessionError} />}
          <button type="submit" className="button primary full entry-submit" disabled={busy}>
            {busy ? 'Opening your profile…' : 'Choose where to eat'} <ArrowRight size={18} />
          </button>
        </form>
        <p className="entry-demo-note"><strong>Demo profiles are public.</strong> Use only the IDs above; entering an ID does not verify identity.</p>
        <Link className="staff-entry-link" to="/staff/login"><ChefHat size={16} /> Staff sign-in <ArrowRight size={14} /></Link>
      </div>
    </section>
  );
}
