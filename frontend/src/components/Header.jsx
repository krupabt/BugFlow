import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Activity } from 'lucide-react';
import { api } from '../api';

export default function Header({ title, onNewIssue }) {
  const navigate = useNavigate();
  const [backendStatus, setBackendStatus] = useState('checking');

  useEffect(() => {
    async function check() {
      try {
        await api.checkHealth();
        setBackendStatus('connected');
      } catch (err) {
        setBackendStatus('disconnected');
      }
    }
    check();
  }, []);

  return (
    <header className="header">
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <h1 className="header-title">{title}</h1>
        {backendStatus === 'connected' ? (
          <span className="badge" style={{ backgroundColor: '#ecfdf5', color: '#047857' }}>
            <Activity size={12} /> API Online
          </span>
        ) : backendStatus === 'disconnected' ? (
          <span className="badge" style={{ backgroundColor: '#fef2f2', color: '#b91c1c' }}>
            <Activity size={12} /> API Offline
          </span>
        ) : null}
      </div>

      <div className="header-actions">
        <button
          className="btn btn-primary"
          onClick={() => {
            if (onNewIssue) onNewIssue();
            else navigate('/issues?create=true');
          }}
        >
          <Plus size={16} />
          <span>New Issue</span>
        </button>
      </div>
    </header>
  );
}
