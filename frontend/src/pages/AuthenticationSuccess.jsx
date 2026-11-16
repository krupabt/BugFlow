import React from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import {
  CheckCircle2,
  ShieldCheck,
  ArrowRight,
  Bug,
  User,
  Shield
} from 'lucide-react';
import { useAuth, getRoleDashboardPath, formatRole } from '../context/AuthContext';

export default function AuthenticationSuccess() {
  const { user, token, loading } = useAuth();
  const navigate = useNavigate();

  // If session is being restored / verified from backend /auth/me
  if (loading) {
    return (
      <div className="loading-container" style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner"></div>
        <p style={{ marginTop: '16px', color: '#64748B', fontWeight: 500 }}>
          Verifying authenticated session...
        </p>
      </div>
    );
  }

  // Prevent unauthorized / unauthenticated access: redirect to login
  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  const roleDisplay = formatRole(user.role);
  const targetDashboard = getRoleDashboardPath(user.role);

  const handleProceed = () => {
    navigate(targetDashboard, { replace: true });
  };

  return (
    <div className="auth-split-wrapper">
      {/* LEFT SIDE: Brand & SaaS Hero Panel */}
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
            Enterprise defect and issue management platform with robust role-based workflows and real-time project metrics.
          </p>

          <div className="auth-workflow-timeline">
            <div className="workflow-step">
              <span className="workflow-step-num">✓</span>
              <span className="workflow-step-text">Identity & Access Verified</span>
            </div>
            <div className="workflow-step">
              <span className="workflow-step-num">✓</span>
              <span className="workflow-step-text">Role-Based Workspace Activated</span>
            </div>
            <div className="workflow-step">
              <span className="workflow-step-num">✓</span>
              <span className="workflow-step-text">Secure Session Established</span>
            </div>
          </div>
        </div>

        <div className="auth-hero-footer">
          <span>&copy; {new Date().getFullYear()} BugFlow Inc. Enterprise Edition</span>
        </div>
      </aside>

      {/* RIGHT SIDE: Authentication Successful Card */}
      <main className="auth-form-panel">
        <div className="auth-card auth-success-card">
          {/* Large Green Checkmark Icon with Celadon Accent */}
          <div className="auth-success-icon-badge" aria-label="Authentication Successful">
            <CheckCircle2 size={50} color="#2B6647" strokeWidth={2.4} />
          </div>

          <h1 className="auth-success-title">Login Successful!</h1>
          <p className="auth-success-subtitle">
            Welcome back, <strong>{user.name}</strong>!
          </p>

          {/* Clean Information Panel */}
          <div className="auth-success-info-panel">
            <div className="auth-success-info-row">
              <span className="auth-success-info-label">
                <User size={15} style={{ marginRight: 6, verticalAlign: 'middle', color: '#817B86' }} />
                User Account:
              </span>
              <span className="auth-success-info-val">
                {user.name} ({user.id})
              </span>
            </div>

            <div className="auth-success-info-row">
              <span className="auth-success-info-label">
                <Shield size={15} style={{ marginRight: 6, verticalAlign: 'middle', color: '#817B86' }} />
                Role:
              </span>
              <span className="auth-success-info-val">
                <span className="auth-role-tag">{roleDisplay}</span>
              </span>
            </div>

            <div className="auth-success-info-row">
              <span className="auth-success-info-label">
                <ShieldCheck size={15} style={{ marginRight: 6, verticalAlign: 'middle', color: '#2B6647' }} />
                Authentication:
              </span>
              <span className="auth-success-info-val">
                <span className="auth-success-badge-verified">
                  <ShieldCheck size={14} /> Verified
                </span>
              </span>
            </div>
          </div>

          {/* Primary Blue Button: OK – Go to Dashboard */}
          <button
            type="button"
            className="auth-success-btn"
            onClick={handleProceed}
            id="btn-goto-dashboard"
          >
            <span>OK – Go to Dashboard</span>
            <ArrowRight size={18} />
          </button>
        </div>
      </main>
    </div>
  );
}
