import React, { useState, useEffect } from 'react';
import {
  GitBranch,
  GitCommit,
  FolderGit2,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Search,
  Copy,
  Check,
  ShieldCheck,
  Key,
  X,
  LogOut,
  Info
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

export default function GitHubPage() {
  const { user } = useAuth();
  const isAdmin = (user?.role || '').toUpperCase().replace(/ /g, '_') === 'ADMIN';

  const [loading, setLoading] = useState(true);
  const [statusData, setStatusData] = useState(null);
  const [commits, setCommits] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedSha, setCopiedSha] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  // Connect Modal state
  const [connectModalOpen, setConnectModalOpen] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const [ownerInput, setOwnerInput] = useState('krupabt');
  const [repoInput, setRepoInput] = useState('BugFlow');
  const [secretInput, setSecretInput] = useState('');
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    loadGitHubOverview();
  }, []);

  const loadGitHubOverview = async () => {
    try {
      setLoading(true);
      setError('');
      const statusRes = await api.getGithubStatus();
      setStatusData(statusRes);

      if (statusRes.connected) {
        const commitsRes = await api.getGithubCommits({ limit: 30 });
        setCommits(commitsRes.commits || []);
      } else {
        setCommits([]);
      }
    } catch (err) {
      console.error('Failed to load GitHub overview:', err);
      setError(err.message || 'Failed to connect to GitHub service.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (sha) => {
    navigator.clipboard.writeText(sha);
    setCopiedSha(sha);
    setTimeout(() => setCopiedSha(''), 2000);
  };

  const handleSync = async () => {
    try {
      setSyncing(true);
      setNotice('Verifying connection and fetching latest repository data...');
      await loadGitHubOverview();
      setNotice('Repository status updated from GitHub API.');
      setTimeout(() => setNotice(''), 4000);
    } catch (err) {
      setError(err.message || 'Sync failed.');
    } finally {
      setSyncing(false);
    }
  };

  const handleConnectSubmit = async (e) => {
    e.preventDefault();
    if (!tokenInput.trim()) {
      setError('Please enter a GitHub Personal Access Token.');
      return;
    }

    try {
      setConnecting(true);
      setError('');
      const res = await api.connectGithub({
        token: tokenInput.trim(),
        owner: ownerInput.trim(),
        repo: repoInput.trim(),
        webhook_secret: secretInput.trim() || undefined
      });
      setNotice(res.message || 'Successfully connected to GitHub repository!');
      setConnectModalOpen(false);
      setTokenInput('');
      await loadGitHubOverview();
      setTimeout(() => setNotice(''), 5000);
    } catch (err) {
      setError(err.message || 'Failed to connect to GitHub. Check token and permissions.');
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm('Are you sure you want to disconnect this GitHub repository?')) return;
    try {
      setLoading(true);
      await api.disconnectGithub();
      setNotice('GitHub repository disconnected.');
      await loadGitHubOverview();
      setTimeout(() => setNotice(''), 4000);
    } catch (err) {
      setError(err.message || 'Disconnect failed.');
    } finally {
      setLoading(false);
    }
  };

  const filteredCommits = commits.filter(c =>
    (c.commit_message || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.short_sha || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.author_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.issue_id || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="page-container" style={{ padding: '32px', textAlign: 'center', color: '#64748B' }}>
        <RefreshCw size={28} className="spin" style={{ margin: '0 auto 16px auto', display: 'block', color: '#2563EB' }} />
        <h3>Checking GitHub repository integration status...</h3>
      </div>
    );
  }

  const isConnected = statusData?.connected === true;

  return (
    <div className="page-container" style={{ padding: '28px', maxWidth: '1440px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              background: '#0F172A',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
            }}
          >
            <GitBranch size={22} color="#38BDF8" />
          </div>
          <div>
            <h1 style={{ fontSize: '1.45rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
              GitHub Integration & Activity
            </h1>
            <p style={{ fontSize: '0.82rem', color: '#64748B', margin: '2px 0 0 0' }}>
              Connected VCS repository, branch synchronization, and defect commit linkages
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {isAdmin && (
            isConnected ? (
              <button
                type="button"
                onClick={handleDisconnect}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: '#FEF2F2',
                  border: '1px solid #FECACA',
                  color: '#DC2626',
                  padding: '8px 14px',
                  borderRadius: '8px',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                <LogOut size={14} />
                <span>Disconnect</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setConnectModalOpen(true)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)',
                  border: 'none',
                  color: '#FFFFFF',
                  padding: '9px 18px',
                  borderRadius: '8px',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(37,99,235,0.25)'
                }}
              >
                <Key size={15} />
                <span>Connect Repository</span>
              </button>
            )
          )}

          <button
            type="button"
            onClick={handleSync}
            disabled={syncing}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: '#F1F5F9',
              border: '1px solid #CBD5E1',
              color: '#334155',
              padding: '8px 16px',
              borderRadius: '8px',
              fontSize: '0.84rem',
              fontWeight: 600,
              cursor: syncing ? 'not-allowed' : 'pointer'
            }}
          >
            <RefreshCw size={14} className={syncing ? 'spin' : ''} />
            <span>{syncing ? 'Verifying...' : 'Refresh'}</span>
          </button>

          <a
            href={statusData?.repository_url || 'https://github.com/krupabt/BugFlow'}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: '#0F172A',
              color: '#FFFFFF',
              border: 'none',
              padding: '9px 18px',
              borderRadius: '8px',
              fontSize: '0.85rem',
              fontWeight: 700,
              textDecoration: 'none',
              boxShadow: '0 2px 8px rgba(15,23,42,0.2)'
            }}
          >
            <span>View on GitHub</span>
            <ExternalLink size={14} />
          </a>
        </div>
      </div>

      {notice && (
        <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', color: '#065F46', padding: '12px 18px', borderRadius: '8px', fontSize: '0.88rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CheckCircle2 size={18} color="#059669" />
          <span>{notice}</span>
        </div>
      )}

      {error && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B', padding: '12px 18px', borderRadius: '8px', fontSize: '0.88rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertCircle size={18} color="#DC2626" />
          <span>{error}</span>
        </div>
      )}

      {/* 4 Summary Stat Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px'
        }}
      >
        <div style={{ background: '#FFFFFF', padding: '18px 20px', borderRadius: '12px', border: '1px solid #E2E8F0', boxShadow: '0 2px 6px rgba(0,0,0,0.03)' }}>
          <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Target Repository</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0F172A', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FolderGit2 size={20} color="#4F46E5" />
            <span>{statusData?.repository_name || 'krupabt/BugFlow'}</span>
          </div>
          <div style={{ fontSize: '0.76rem', color: isConnected ? '#059669' : '#D97706', fontWeight: 700, marginTop: '4px' }}>
            {isConnected ? '● Connected & Verified' : '● Not Connected'}
          </div>
        </div>

        <div style={{ background: '#FFFFFF', padding: '18px 20px', borderRadius: '12px', border: '1px solid #E2E8F0', boxShadow: '0 2px 6px rgba(0,0,0,0.03)' }}>
          <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Authenticated Account</div>
          <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0F172A', marginTop: '6px' }}>
            {statusData?.authenticated_user || 'None'}
          </div>
          <div style={{ fontSize: '0.76rem', color: '#64748B', marginTop: '4px' }}>
            {isConnected ? 'Token identity verified' : 'No token active'}
          </div>
        </div>

        <div style={{ background: '#FFFFFF', padding: '18px 20px', borderRadius: '12px', border: '1px solid #E2E8F0', boxShadow: '0 2px 6px rgba(0,0,0,0.03)' }}>
          <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Default Branch</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0F172A', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <GitBranch size={20} color="#059669" />
            <code>{statusData?.default_branch || 'main'}</code>
          </div>
          <div style={{ fontSize: '0.76rem', color: '#64748B', marginTop: '4px' }}>Production stream</div>
        </div>

        <div style={{ background: '#FFFFFF', padding: '18px 20px', borderRadius: '12px', border: '1px solid #E2E8F0', boxShadow: '0 2px 6px rgba(0,0,0,0.03)' }}>
          <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Linked Issues</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#7C3AED', marginTop: '4px' }}>
            {statusData?.linked_issues_count || 0}
          </div>
          <div style={{ fontSize: '0.76rem', color: '#64748B', marginTop: '2px' }}>Defects linked to commits</div>
        </div>
      </div>

      {/* Truthful Not Connected Banner & Setup Guide */}
      {!isConnected && (
        <div
          style={{
            background: '#FFFFFF',
            borderRadius: '12px',
            border: '1px solid #FCD34D',
            padding: '24px',
            boxShadow: '0 4px 12px rgba(245, 158, 11, 0.08)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#FEF3C7', color: '#D97706', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <AlertCircle size={24} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#92400E' }}>
                GitHub Integration is Not Connected
              </h3>
              <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: '#B45309', lineHeight: 1.5 }}>
                BugFlow requires a valid GitHub Personal Access Token to fetch genuine commits, unified diffs, and GitHub Actions workflow runs from <strong>https://github.com/krupabt/BugFlow</strong>.
              </p>
            </div>
          </div>

          <div style={{ background: '#F8FAFC', padding: '18px', borderRadius: '8px', border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ fontSize: '0.86rem', fontWeight: 700, color: '#1E293B' }}>
              How to configure your connection:
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '0.82rem', color: '#475569' }}>
              <span style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#2563EB', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: 800, flexShrink: 0 }}>1</span>
              <span>Create a GitHub Personal Access Token at <a href="https://github.com/settings/tokens" target="_blank" rel="noopener noreferrer" style={{ color: '#2563EB', fontWeight: 600 }}>GitHub Settings → Personal Access Tokens</a> with <code>repo</code> and <code>workflow</code> scopes.</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '0.82rem', color: '#475569' }}>
              <span style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#2563EB', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: 800, flexShrink: 0 }}>2</span>
              <span><strong>Option A (Admin UI):</strong> Click the "Connect Repository" button above and paste your token. It will be encrypted and securely stored in PostgreSQL.</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '0.82rem', color: '#475569' }}>
              <span style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#2563EB', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: 800, flexShrink: 0 }}>3</span>
              <span><strong>Option B (Environment Variable):</strong> Add <code>GITHUB_TOKEN=your_token_here</code> inside <code>backend/.env</code> and restart the backend server.</span>
            </div>
          </div>
        </div>
      )}

      {/* Commits List Table (if connected) */}
      {isConnected && (
        <div
          style={{
            background: '#FFFFFF',
            borderRadius: '12px',
            border: '1px solid #E2E8F0',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
            overflow: 'hidden'
          }}
        >
          <div
            style={{
              padding: '16px 24px',
              borderBottom: '1px solid #E2E8F0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px'
            }}
          >
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <GitCommit size={20} color="#2563EB" />
                Live Repository Commits ({filteredCommits.length})
              </h3>
              <span style={{ fontSize: '0.78rem', color: '#64748B' }}>
                Retrieved directly via GitHub REST API from {statusData?.repository_name}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#F8FAFC', padding: '6px 12px', borderRadius: '8px', border: '1px solid #CBD5E1' }}>
              <Search size={15} color="#64748B" />
              <input
                type="text"
                placeholder="Search commits or issue IDs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '0.85rem', width: '220px' }}
              />
            </div>
          </div>

          {filteredCommits.length === 0 ? (
            <div style={{ padding: '36px', textAlign: 'center', color: '#64748B' }}>
              <p style={{ margin: '0 0 4px', fontWeight: 600 }}>No commits found matching query.</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase' }}>
                    <th style={{ padding: '12px 20px' }}>Commit SHA</th>
                    <th style={{ padding: '12px 20px' }}>Commit Message</th>
                    <th style={{ padding: '12px 20px' }}>Linked Issue</th>
                    <th style={{ padding: '12px 20px' }}>Author</th>
                    <th style={{ padding: '12px 20px' }}>Date</th>
                    <th style={{ padding: '12px 20px', textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCommits.map((c) => (
                    <tr key={c.commit_sha || c.commit_id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '14px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <code style={{ background: '#EDE9FE', color: '#6D28D9', padding: '2px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 700 }}>
                            {c.short_sha}
                          </code>
                          <button
                            type="button"
                            onClick={() => handleCopy(c.commit_sha || c.commit_id)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: '#64748B' }}
                            title="Copy SHA"
                          >
                            {copiedSha === (c.commit_sha || c.commit_id) ? <Check size={13} color="#059669" /> : <Copy size={13} />}
                          </button>
                        </div>
                      </td>
                      <td style={{ padding: '14px 20px', maxWidth: '380px' }}>
                        <div style={{ fontWeight: 600, color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {c.commit_message}
                        </div>
                      </td>
                      <td style={{ padding: '14px 20px' }}>
                        {c.issue_id ? (
                          <span style={{ background: '#EFF6FF', color: '#1D4ED8', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700 }}>
                            {c.issue_id}
                          </span>
                        ) : (
                          <span style={{ color: '#94A3B8', fontSize: '0.78rem' }}>—</span>
                        )}
                      </td>
                      <td style={{ padding: '14px 20px', color: '#334155', fontWeight: 500 }}>
                        {c.author_name}
                      </td>
                      <td style={{ padding: '14px 20px', color: '#64748B', whiteSpace: 'nowrap' }}>
                        {c.committed_at ? new Date(c.committed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                      </td>
                      <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                        <a
                          href={c.view_url || `https://github.com/krupabt/BugFlow/commit/${c.commit_sha || c.commit_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            background: '#F1F5F9',
                            color: '#334155',
                            border: '1px solid #CBD5E1',
                            padding: '4px 10px',
                            borderRadius: '5px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            textDecoration: 'none'
                          }}
                        >
                          <span>GitHub</span>
                          <ExternalLink size={12} />
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Connect Repository Modal */}
      {connectModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(3px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
          onClick={() => setConnectModalOpen(false)}
        >
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: '12px',
              width: '100%',
              maxWidth: '540px',
              padding: '24px',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
              display: 'flex',
              flexDirection: 'column',
              gap: '18px'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #E2E8F0', paddingBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <GitBranch size={20} color="#2563EB" />
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#0F172A' }}>
                  Connect GitHub Repository
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setConnectModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleConnectSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '6px' }}>
                  Personal Access Token *
                </label>
                <input
                  type="password"
                  placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  required
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.88rem' }}
                />
                <span style={{ fontSize: '0.72rem', color: '#64748B', marginTop: '4px', display: 'block' }}>
                  Token will be encrypted with AES before storage. Never saved in plaintext.
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '6px' }}>
                    Repository Owner
                  </label>
                  <input
                    type="text"
                    value={ownerInput}
                    onChange={(e) => setOwnerInput(e.target.value)}
                    required
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.88rem' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '6px' }}>
                    Repository Name
                  </label>
                  <input
                    type="text"
                    value={repoInput}
                    onChange={(e) => setRepoInput(e.target.value)}
                    required
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.88rem' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '6px' }}>
                  Webhook Secret (Optional)
                </label>
                <input
                  type="password"
                  placeholder="Secret for HMAC-SHA256 signature verification"
                  value={secretInput}
                  onChange={(e) => setSecretInput(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.88rem' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setConnectModalOpen(false)}
                  style={{ background: '#F1F5F9', border: '1px solid #CBD5E1', color: '#475569', padding: '9px 16px', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={connecting}
                  style={{ background: '#2563EB', color: '#FFFFFF', border: 'none', padding: '9px 20px', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 700, cursor: connecting ? 'not-allowed' : 'pointer' }}
                >
                  {connecting ? 'Verifying with GitHub...' : 'Verify & Connect'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
