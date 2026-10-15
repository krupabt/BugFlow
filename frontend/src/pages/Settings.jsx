import React from 'react';
import { Settings as SettingsIcon, Shield, Database, Server, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Settings() {
  const { user } = useAuth();

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">System & Account Settings</h1>
          <p className="page-subtitle">Configure application preferences, database status, and security keys</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px' }}>
        {/* Account Info */}
        <div className="card">
          <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <User size={18} /> Profile Information
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.88rem' }}>
            <div>
              <span style={{ color: '#74748B', display: 'block', fontSize: '0.78rem', fontWeight: 600 }}>User ID</span>
              <strong>{user?.id}</strong>
            </div>
            <div>
              <span style={{ color: '#74748B', display: 'block', fontSize: '0.78rem', fontWeight: 600 }}>Full Name</span>
              <strong>{user?.name}</strong>
            </div>
            <div>
              <span style={{ color: '#74748B', display: 'block', fontSize: '0.78rem', fontWeight: 600 }}>Email Address</span>
              <strong>{user?.email}</strong>
            </div>
            <div>
              <span style={{ color: '#74748B', display: 'block', fontSize: '0.78rem', fontWeight: 600 }}>System Role</span>
              <span className="user-role-badge">{user?.role_display || user?.role}</span>
            </div>
          </div>
        </div>

        {/* Database & Environment Info */}
        <div className="card">
          <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Database size={18} /> Database Integration Status
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.88rem' }}>
            <div>
              <span style={{ color: '#74748B', display: 'block', fontSize: '0.78rem', fontWeight: 600 }}>Database Engine</span>
              <span>PostgreSQL 17 (localhost:5432)</span>
            </div>
            <div>
              <span style={{ color: '#74748B', display: 'block', fontSize: '0.78rem', fontWeight: 600 }}>Database Name</span>
              <span>bugflow_db</span>
            </div>
            <div>
              <span style={{ color: '#74748B', display: 'block', fontSize: '0.78rem', fontWeight: 600 }}>Initial Source Dataset</span>
              <span>Synthetic BugFlow CSV Bundle (730 Issues, 8 Projects, 48 Sprints, 20 Users, 5 Workflow States)</span>
            </div>
            <div>
              <span style={{ color: '#74748B', display: 'block', fontSize: '0.78rem', fontWeight: 600 }}>Workflow Pipeline</span>
              <span>Open → In Progress → Testing → Resolved → Closed</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
