import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Bug, Lock, Mail, AlertCircle, ArrowRight, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const DEMO_PRESETS = [
  { role: 'Admin', email: 'alex.morgan@example.org', name: 'Alex Morgan' },
  { role: 'Project Manager', email: 'jordan.lee@example.org', name: 'Jordan Lee' },
  { role: 'Developer', email: 'riley.chen@example.org', name: 'Riley Chen' },
  { role: 'Tester', email: 'emerson.clark@example.org', name: 'Emerson Clark' },
];

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.message || 'Invalid credentials. Please verify your email and password.');
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (demoEmail) => {
    setEmail(demoEmail);
    setPassword('BugFlow@2026');
    setError('');
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-box">
        {/* Brand */}
        <div className="auth-brand">
          <div className="brand-icon">
            <Bug size={24} />
          </div>
          <div>
            <div className="brand-title">BugFlow</div>
            <div className="brand-tagline">Role-Based Issue Tracking</div>
          </div>
        </div>

        <h1 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '6px' }}>Sign in to your account</h1>
        <p style={{ fontSize: '0.84rem', color: '#74748B', marginBottom: '20px' }}>
          Enter your credentials or choose a demonstration profile below.
        </p>

        {error && (
          <div className="toast-notice toast-error" style={{ padding: '10px 12px', fontSize: '0.82rem' }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email or Username</label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. alex.morgan@example.org"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type="password"
                className="form-input"
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '8px', padding: '11px' }}
            disabled={loading}
          >
            {loading ? 'Authenticating...' : 'Sign In'}
            <ArrowRight size={16} />
          </button>
        </form>

        {/* Mentor Demo Switcher */}
        <div className="demo-account-pills">
          <div className="demo-pill-title">Mentor Demo – 1-Click Role Switcher</div>
          <div className="demo-pill-row">
            {DEMO_PRESETS.map((p) => (
              <button
                type="button"
                key={p.role}
                className="demo-pill-btn"
                onClick={() => fillDemo(p.email)}
              >
                <div><strong>{p.role}</strong></div>
                <div style={{ fontSize: '0.7rem', color: '#74748B' }}>{p.name}</div>
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginTop: '20px', textAlign: 'center', fontSize: '0.82rem', color: '#74748B' }}>
          Don't have an account?{' '}
          <Link to="/register" style={{ color: '#6754E8', fontWeight: 600, textDecoration: 'none' }}>
            Register here
          </Link>
        </div>
      </div>
    </div>
  );
}
