import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Bug,
  Lock,
  Mail,
  AlertCircle,
  ArrowRight,
  Eye,
  EyeOff,
  CheckCircle2,
  ShieldCheck,
  Layers
} from 'lucide-react';
import { useAuth, getRoleDashboardPath } from '../context/AuthContext';

const DEMO_PRESETS = [
  { role: 'Admin', email: 'krupa@example.org', name: 'Krupa' },
  { role: 'Project Manager', email: 'Arun@example.org', name: 'Arun' },
  { role: 'Developer', email: 'Priya.Sharma@example.org', name: 'Priya Sharma' },
  { role: 'Tester', email: 'Sunil.clark@example.org', name: 'Sunil' },
];

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => localStorage.getItem('bugflow_remember') === 'true');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Please enter both email address and password.');
      return;
    }
    setError('');
    setLoading(true);

    try {
      const user = await login(email.trim(), password);
      if (rememberMe) {
        localStorage.setItem('bugflow_remember', 'true');
        localStorage.setItem('bugflow_saved_email', email.trim());
      } else {
        localStorage.removeItem('bugflow_remember');
        localStorage.removeItem('bugflow_saved_email');
      }

      // Role-Based Redirection
      const redirectPath = getRoleDashboardPath(user?.role);
      navigate(redirectPath, { replace: true });
    } catch (err) {
      setError(err.message || 'Invalid email/username or password. Please verify credentials.');
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
    <div className="auth-split-wrapper">
      {/* LEFT SECTION: Premium Violet Brand Hero */}
      <aside className="auth-hero-panel">
        <div className="auth-hero-brand">
          <div className="auth-hero-brand-icon">
            <Bug size={24} color="#FFFFFF" />
          </div>
          <div className="auth-hero-brand-name">BugFlow</div>
        </div>

        <div className="auth-hero-center">
          <h1 className="auth-hero-title">Track Smarter. Resolve Faster.</h1>
          <p className="auth-hero-desc">
            A collaborative platform for managing software issues from reporting to resolution.
          </p>

          {/* Subtle Decorative Workflow Illustration */}
          <div className="auth-workflow-timeline">
            <div className="workflow-step">
              <span className="workflow-step-num">1</span>
              <span className="workflow-step-text">Report & Triage Software Defects</span>
            </div>
            <div className="workflow-step">
              <span className="workflow-step-num">2</span>
              <span className="workflow-step-text">Sprint Planning & Role Allocation</span>
            </div>
            <div className="workflow-step">
              <span className="workflow-step-num">3</span>
              <span className="workflow-step-text">Developer Fix & Status Lifecycle</span>
            </div>
            <div className="workflow-step">
              <span className="workflow-step-num">4</span>
              <span className="workflow-step-text">Tester Verification & Close Out</span>
            </div>
          </div>
        </div>

        <div className="auth-hero-footer">
          <ShieldCheck size={16} />
          <span>Role-Based Access Control • PostgreSQL Realtime Sync</span>
        </div>
      </aside>

      {/* RIGHT SECTION: White + Violet Form Interface */}
      <main className="auth-form-panel">
        <div className="auth-card">
          <h2 className="auth-card-title">Welcome back</h2>
          <p className="auth-card-subtitle">Sign in to continue to BugFlow.</p>

          {error && (
            <div className="toast-notice toast-error" style={{ marginBottom: '18px', padding: '10px 12px', fontSize: '0.82rem' }}>
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            {/* Email Address */}
            <div className="form-group">
              <label className="form-label" htmlFor="login-email">Email Address</label>
              <div className="form-input-container">
                <span className="form-input-icon">
                  <Mail size={16} />
                </span>
                <input
                  id="login-email"
                  type="email"
                  className={`form-input-field ${error ? 'input-error' : ''}`}
                  placeholder="name@example.org"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div className="form-group">
              <label className="form-label" htmlFor="login-password">Password</label>
              <div className="form-input-container">
                <span className="form-input-icon">
                  <Lock size={16} />
                </span>
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  className={`form-input-field ${error ? 'input-error' : ''}`}
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  title={showPassword ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Remember Me */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', fontSize: '0.82rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: '#24243B' }}>
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  style={{ accentColor: '#6754E8' }}
                />
                <span>Remember me</span>
              </label>
            </div>

            {/* Sign In Button */}
            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', padding: '11px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}
              disabled={loading}
            >
              {loading ? (
                <>
                  <div className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px', borderColor: '#FFFFFF', borderTopColor: 'transparent' }} />
                  <span>Signing In...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          {/* Quick 1-Click Role Switcher for Mentor Demonstration */}
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
                  <div style={{ fontWeight: 700, color: '#6754E8' }}>{p.role}</div>
                  <div style={{ fontSize: '0.72rem', color: '#74748B' }}>{p.name}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Sign Up Link */}
          <div style={{ marginTop: '24px', textAlign: 'center', fontSize: '0.84rem', color: '#74748B' }}>
            Don't have an account?{' '}
            <Link to="/register" style={{ color: '#6754E8', fontWeight: 600, textDecoration: 'none' }}>
              Create an account
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
