import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Bug, AlertCircle, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Register() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'Developer'
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.password) {
      setError('Please fill in all required fields.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await register(formData);
      setSuccess('Account created successfully! Redirecting...');
      setTimeout(() => navigate('/'), 1200);
    } catch (err) {
      setError(err.message || 'Registration failed. Email may already be in use.');
    } finally {
      setLoading(false);
    }
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
            <div className="brand-tagline">Create an Account</div>
          </div>
        </div>

        <h1 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '6px' }}>Sign up for BugFlow</h1>
        <p style={{ fontSize: '0.84rem', color: '#74748B', marginBottom: '20px' }}>
          Join your team to track, resolve, and verify software defects.
        </p>

        {error && (
          <div className="toast-notice toast-error" style={{ padding: '10px 12px', fontSize: '0.82rem' }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="toast-notice toast-success" style={{ padding: '10px 12px', fontSize: '0.82rem' }}>
            <CheckCircle2 size={16} />
            <span>{success}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Full Name *</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. John Doe"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Email Address *</label>
            <input
              type="email"
              className="form-input"
              placeholder="e.g. john@example.org"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password *</label>
            <input
              type="password"
              className="form-input"
              placeholder="••••••••••••"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Role *</label>
            <select
              className="form-select"
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
            >
              <option value="Developer">Developer</option>
              <option value="Tester">Tester</option>
              <option value="Project Manager">Project Manager</option>
            </select>
            <p style={{ fontSize: '0.72rem', color: '#74748B', marginTop: '4px' }}>
              Note: Administrator accounts can only be provisioned by existing Admins.
            </p>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '12px', padding: '11px' }}
            disabled={loading}
          >
            {loading ? 'Creating account...' : 'Create Account'}
            <ArrowRight size={16} />
          </button>
        </form>

        <div style={{ marginTop: '20px', textAlign: 'center', fontSize: '0.82rem', color: '#74748B' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: '#6754E8', fontWeight: 600, textDecoration: 'none' }}>
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
