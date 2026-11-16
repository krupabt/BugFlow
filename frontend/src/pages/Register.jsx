import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Bug,
  Lock,
  Mail,
  User,
  AlertCircle,
  ArrowRight,
  Eye,
  EyeOff,
  CheckCircle2,
  ShieldCheck,
  Info
} from 'lucide-react';
import { useAuth, getRoleDashboardPath } from '../context/AuthContext';

export default function Register() {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { register } = useAuth();
  const navigate = useNavigate();

  // Password strength calculation
  const getPasswordStrength = (pwd) => {
    if (!pwd) return 0;
    let score = 0;
    if (pwd.length >= 6) score += 1;
    if (pwd.length >= 10) score += 1;
    if (/[A-Z]/.test(pwd) && /[0-9]/.test(pwd)) score += 1;
    if (/[^A-Za-z0-9]/.test(pwd)) score += 1;
    return Math.min(score, 3);
  };

  const strengthScore = getPasswordStrength(formData.password);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { fullName, email, password, confirmPassword } = formData;

    // Client-side validations
    if (!fullName.trim()) {
      setError('Please enter your full name.');
      return;
    }
    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }
    const emailRegex = /^[\w\.-]+@[\w\.-]+\.\w+$/;
    if (!emailRegex.test(email.trim())) {
      setError('Please enter a valid email address.');
      return;
    }
    if (!password) {
      setError('Please create a password.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match. Please verify both fields.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const user = await register({
        full_name: fullName.trim(),
        email: email.trim(),
        password: password,
        role: 'DEVELOPER' // Safe default role: elevated roles require Administrator assignment
      });

      // Redirect to the Authentication Successful confirmation screen
      navigate('/auth/success', { replace: true });
    } catch (err) {
      setError(err.message || 'Registration failed. Please check your details and try again.');
    } finally {
      setLoading(false);
    }
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
            Join software teams managing sprints, issue assignments, and quality assurance workflows.
          </p>

          <div className="auth-workflow-timeline">
            <div className="workflow-step">
              <span className="workflow-step-num">✓</span>
              <span className="workflow-step-text">Team Collaboration & Sprint Tracking</span>
            </div>
            <div className="workflow-step">
              <span className="workflow-step-num">✓</span>
              <span className="workflow-step-text">End-to-End Bug Resolution Lifecycle</span>
            </div>
            <div className="workflow-step">
              <span className="workflow-step-num">✓</span>
              <span className="workflow-step-text">Realtime Activity & Audit History</span>
            </div>
          </div>
        </div>

        <div className="auth-hero-footer">
          <ShieldCheck size={16} />
          <span>Role-Based Access Control • Enterprise Issue Intelligence</span>
        </div>
      </aside>

      {/* RIGHT SECTION: White + Violet Form Interface */}
      <main className="auth-form-panel">
        <div className="auth-card" style={{ maxWidth: '460px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <div style={{ width: '38px', height: '38px', background: '#E97862', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFFFFF', boxShadow: '0 2px 8px rgba(233, 120, 98, 0.3)' }}>
              <Bug size={20} />
            </div>
            <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#393442', letterSpacing: '-0.02em' }}>BugFlow</span>
          </div>

          <h2 className="auth-card-title">Create Your Account</h2>
          <p className="auth-card-subtitle">Join BugFlow to manage issues and collaborate with your team.</p>

          {error && (
            <div className="toast-notice toast-error" style={{ marginBottom: '18px', padding: '10px 12px', fontSize: '0.82rem' }}>
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            {/* Full Name */}
            <div className="form-group">
              <label className="form-label" htmlFor="register-name">Full Name *</label>
              <div className="form-input-container">
                <span className="form-input-icon">
                  <User size={16} />
                </span>
                <input
                  id="register-name"
                  type="text"
                  className="form-input-field"
                  placeholder="e.g. Krupa"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  required
                />
              </div>
            </div>

            {/* Email Address */}
            <div className="form-group">
              <label className="form-label" htmlFor="register-email">Email Address *</label>
              <div className="form-input-container">
                <span className="form-input-icon">
                  <Mail size={16} />
                </span>
                <input
                  id="register-email"
                  type="email"
                  className="form-input-field"
                  placeholder="name@example.org"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div className="form-group">
              <label className="form-label" htmlFor="register-password">Password (min 6 characters) *</label>
              <div className="form-input-container">
                <span className="form-input-icon">
                  <Lock size={16} />
                </span>
                <input
                  id="register-password"
                  type={showPassword ? 'text' : 'password'}
                  className="form-input-field"
                  placeholder="••••••••••••"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
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

              {/* Password Strength Indicator */}
              {formData.password && (
                <div className="password-strength-bar">
                  <div className={`strength-segment ${strengthScore >= 1 ? (strengthScore === 1 ? 'strength-weak' : strengthScore === 2 ? 'strength-medium' : 'strength-strong') : ''}`} />
                  <div className={`strength-segment ${strengthScore >= 2 ? (strengthScore === 2 ? 'strength-medium' : 'strength-strong') : ''}`} />
                  <div className={`strength-segment ${strengthScore >= 3 ? 'strength-strong' : ''}`} />
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div className="form-group">
              <label className="form-label" htmlFor="register-confirm">Confirm Password *</label>
              <div className="form-input-container">
                <span className="form-input-icon">
                  <Lock size={16} />
                </span>
                <input
                  id="register-confirm"
                  type={showConfirmPassword ? 'text' : 'password'}
                  className="form-input-field"
                  placeholder="••••••••••••"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  required
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  title={showConfirmPassword ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                >
                  {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Safe Role Notice */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '10px 12px', background: '#FAF8F5', border: '1px solid #EAE5E0', borderRadius: '8px', marginBottom: '20px', fontSize: '0.76rem', color: '#817B86' }}>
              <Info size={16} color="#E97862" style={{ flexShrink: 0, marginTop: '2px' }} />
              <span>
                New registrations are provisioned with <strong>Developer</strong> permissions. Administrative and Project Manager roles require authorized elevation by an existing Administrator.
              </span>
            </div>

            {/* Register Button */}
            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', padding: '11px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}
              disabled={loading}
            >
              {loading ? (
                <>
                  <div className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px', borderColor: '#FFFFFF', borderTopColor: 'transparent' }} />
                  <span>Registering...</span>
                </>
              ) : (
                <>
                  <span>Register</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          {/* Already have an account? Login */}
          <div style={{ marginTop: '24px', textAlign: 'center', fontSize: '0.84rem', color: '#817B86' }}>
            Already have an account?{' '}
            <Link to="/login" style={{ color: '#E97862', fontWeight: 600, textDecoration: 'none' }}>
              Login
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
