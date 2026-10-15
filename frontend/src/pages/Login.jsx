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
  ShieldCheck,
  CheckCircle2,
  X
} from 'lucide-react';
import { useAuth, getRoleDashboardPath } from '../context/AuthContext';

export default function Login() {
  const [email, setEmail] = useState(() => localStorage.getItem('bugflow_saved_email') || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => localStorage.getItem('bugflow_remember') === 'true');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showForgotModal, setShowForgotModal] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setError('Please enter your email address.');
      return;
    }
    if (!password) {
      setError('Please enter your password.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      // Validate credentials through Flask backend & PostgreSQL
      const user = await login(cleanEmail, password);

      // Handle remember me preference
      if (rememberMe) {
        localStorage.setItem('bugflow_remember', 'true');
        localStorage.setItem('bugflow_saved_email', cleanEmail);
      } else {
        localStorage.removeItem('bugflow_remember');
        localStorage.removeItem('bugflow_saved_email');
      }

      // Automatically identify user role from database and redirect
      const targetDashboard = getRoleDashboardPath(user?.role);
      navigate(targetDashboard, { replace: true });
    } catch (err) {
      setError(err.message || 'Invalid email/username or password. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-split-wrapper">
      {/* LEFT SIDE: Brand & Value Proposition Hero */}
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
            A collaborative issue tracking platform designed to streamline software defect reporting, prioritization, fixing, and quality verification.
          </p>

          {/* Minimal Elegant Visual Feature Points */}
          <div className="auth-workflow-timeline">
            <div className="workflow-step">
              <span className="workflow-step-num">✓</span>
              <span className="workflow-step-text">Role-Based Access Control (Admin, PM, Dev, Tester)</span>
            </div>
            <div className="workflow-step">
              <span className="workflow-step-num">✓</span>
              <span className="workflow-step-text">Comprehensive Issue & Sprint Management</span>
            </div>
            <div className="workflow-step">
              <span className="workflow-step-num">✓</span>
              <span className="workflow-step-text">Real-time PostgreSQL Auditing & Analytics</span>
            </div>
          </div>
        </div>

        <div className="auth-hero-footer">
          <ShieldCheck size={16} />
          <span>Enterprise Issue Tracking • Secured with JWT</span>
        </div>
      </aside>

      {/* RIGHT SIDE: SaaS Sign-In Form */}
      <main className="auth-form-panel">
        <div className="auth-card">
          <h2 className="auth-card-title">Welcome back</h2>
          <p className="auth-card-subtitle">Sign in to your BugFlow account.</p>

          {error && (
            <div className="toast-notice toast-error" style={{ marginBottom: '20px', padding: '10px 14px', fontSize: '0.82rem' }}>
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
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
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  autoFocus
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
                  placeholder="Enter your password"
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
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Remember me & Forgot Password */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', fontSize: '0.82rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: '#24243B' }}>
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  style={{ accentColor: '#6754E8' }}
                />
                <span>Remember me</span>
              </label>

              <button
                type="button"
                onClick={() => setShowForgotModal(true)}
                style={{ background: 'none', border: 'none', color: '#6754E8', fontWeight: 600, cursor: 'pointer', padding: 0, fontSize: '0.82rem' }}
              >
                Forgot password?
              </button>
            </div>

            {/* Sign In Button */}
            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', padding: '11px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', fontSize: '0.9rem' }}
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

          {/* Create Account Link */}
          <div style={{ marginTop: '28px', textAlign: 'center', fontSize: '0.84rem', color: '#74748B' }}>
            Don't have an account?{' '}
            <Link to="/register" style={{ color: '#6754E8', fontWeight: 600, textDecoration: 'none' }}>
              Create account
            </Link>
          </div>
        </div>
      </main>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="modal-backdrop" onClick={() => setShowForgotModal(false)}>
          <div className="modal-card" style={{ maxWidth: '420px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Password Recovery</h3>
              <button className="btn-icon" onClick={() => setShowForgotModal(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body" style={{ fontSize: '0.85rem', color: '#74748B', lineHeight: 1.6 }}>
              <p style={{ marginBottom: '12px' }}>
                For enterprise security, password resets are centrally managed by workspace administrators.
              </p>
              <div style={{ padding: '12px', background: '#F8F9FD', border: '1px solid #E9E7F0', borderRadius: '8px', color: '#24243B' }}>
                <div><strong>System Administrator:</strong> Krupa</div>
                <div style={{ fontSize: '0.8rem', color: '#74748B' }}>Contact: krupa@example.org</div>
              </div>
            </div>
            <div className="modal-footer" style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-primary" onClick={() => setShowForgotModal(false)}>
                Understood
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
