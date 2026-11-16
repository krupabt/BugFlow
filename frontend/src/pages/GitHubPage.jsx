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
  Info,
  PlayCircle,
  FileCode,
  Clock,
  Layers,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

export default function GitHubPage() {
  const { user } = useAuth();
  const isAdmin = (user?.role || '').toUpperCase().replace(/ /g, '_') === 'ADMIN';

  const [loading, setLoading] = useState(true);
  const [statusData, setStatusData] = useState(null);
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState('main');
  const [commits, setCommits] = useState([]);
  const [latestRuns, setLatestRuns] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedSha, setCopiedSha] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  // Diff modal
  const [selectedCommitDiff, setSelectedCommitDiff] = useState(null);
  const [diffModalOpen, setDiffModalOpen] = useState(false);
  const [diffLoading, setDiffLoading] = useState(false);

  // Connect Modal state
  const [connectModalOpen, setConnectModalOpen] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const [ownerInput, setOwnerInput] = useState('krupabt');
  const [repoInput, setRepoInput] = useState('BugFlow');
  const [secretInput, setSecretInput] = useState('');
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    loadGitHubOverview(selectedBranch);
  }, [selectedBranch]);

  const loadGitHubOverview = async (branch = 'main') => {
    try {
      setLoading(true);
      setError('');
      const statusRes = await api.getGithubStatus();
      setStatusData(statusRes);

      if (statusRes.connected) {
        // Parallel fetch branches, commits, and workflow runs
        const [branchesRes, commitsRes, runsRes] = await Promise.all([
          api.getGithubBranches().catch(() => ({ branches: [{ name: 'main' }] })),
          api.getGithubCommits({ limit: 35, branch }).catch(() => ({ commits: [] })),
          api.getCicdRuns({ limit: 5 }).catch(() => ({ runs: [] }))
        ]);

        if (branchesRes?.branches?.length > 0) {
          setBranches(branchesRes.branches);
        }
        setCommits(commitsRes.commits || []);
        setLatestRuns(runsRes.runs || []);
      } else {
        setCommits([]);
        setBranches([{ name: 'main' }]);
        setLatestRuns([]);
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
      await loadGitHubOverview(selectedBranch);
      setNotice('Repository status and commits updated from GitHub API.');
      setTimeout(() => setNotice(''), 4000);
    } catch (err) {
      setError(err.message || 'Sync failed.');
    } finally {
      setSyncing(false);
    }
  };

  const handleViewChanges = async (commit) => {
    try {
      setDiffLoading(true);
      setDiffModalOpen(true);
      const res = await api.getCommitDetails(commit.commit_sha || commit.commit_id);
      setSelectedCommitDiff(res.commit || commit);
    } catch (err) {
      console.warn('Error fetching diff:', err);
      setSelectedCommitDiff(commit);
    } finally {
      setDiffLoading(false);
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
      await loadGitHubOverview(selectedBranch);
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
      await loadGitHubOverview(selectedBranch);
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
      <div className="page-container" style={{ padding: '40px', textAlign: 'center', color: '#64748B' }}>
        <RefreshCw size={32} className="spin" style={{ margin: '0 auto 16px auto', display: 'block', color: '#2563EB' }} />
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1E293B' }}>Connecting to GitHub REST API...</h3>
        <p style={{ fontSize: '0.85rem', color: '#64748B' }}>Fetching live repository status, commits, and workflows</p>
      </div>
    );
  }

  const isConnected = statusData?.connected === true;

  return (
    <div className="page-container" style={{ padding: '28px', maxWidth: '1440px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '10px',
              background: '#0F172A',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
            }}
          >
            <GitBranch size={24} color="#38BDF8" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h1 style={{ fontSize: '1.45rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                GitHub Integration & CI/CD
              </h1>
              <span
                style={{
                  background: isConnected ? '#ECFDF5' : '#FEF3C7',
                  color: isConnected ? '#059669' : '#D97706',
                  border: `1px solid ${isConnected ? '#A7F3D0' : '#FDE68A'}`,
                  borderRadius: '20px',
                  padding: '2px 10px',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px'
                }}
              >
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: isConnected ? '#059669' : '#D97706' }} />
                {isConnected ? 'Verified Connected' : 'Not Connected'}
              </span>
            </div>
            <p style={{ fontSize: '0.82rem', color: '#64748B', margin: '3px 0 0 0' }}>
              Genuine VCS repository integration, branch tracking, commit-defect mapping, and automated CI/CD runs
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
            <span>{syncing ? 'Syncing...' : 'Refresh'}</span>
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
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
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
            {isConnected ? '● Connected & Synced' : '● Not Connected'}
          </div>
        </div>

        <div style={{ background: '#FFFFFF', padding: '18px 20px', borderRadius: '12px', border: '1px solid #E2E8F0', boxShadow: '0 2px 6px rgba(0,0,0,0.03)' }}>
          <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Authenticated Account</div>
          <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0F172A', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            {statusData?.user_avatar_url ? (
              <img
                src={statusData.user_avatar_url}
                alt="GitHub Avatar"
                style={{ width: '22px', height: '22px', borderRadius: '50%' }}
              />
            ) : null}
            <span>{statusData?.authenticated_user || 'None'}</span>
          </div>
          <div style={{ fontSize: '0.76rem', color: '#64748B', marginTop: '4px' }}>
            {isConnected ? 'Token verified via GitHub REST API' : 'No token active'}
          </div>
        </div>

        <div style={{ background: '#FFFFFF', padding: '18px 20px', borderRadius: '12px', border: '1px solid #E2E8F0', boxShadow: '0 2px 6px rgba(0,0,0,0.03)' }}>
          <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Active Branch</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0F172A', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <GitBranch size={20} color="#059669" />
            <code>{selectedBranch}</code>
          </div>
          <div style={{ fontSize: '0.76rem', color: '#64748B', marginTop: '4px' }}>
            {branches.length} branch{branches.length !== 1 ? 'es' : ''} available
          </div>
        </div>

        <div style={{ background: '#FFFFFF', padding: '18px 20px', borderRadius: '12px', border: '1px solid #E2E8F0', boxShadow: '0 2px 6px rgba(0,0,0,0.03)' }}>
          <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Linked Issue Commits</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#7C3AED', marginTop: '4px' }}>
            {statusData?.linked_issues_count || 0}
          </div>
          <div style={{ fontSize: '0.76rem', color: '#64748B', marginTop: '2px' }}>
            Last Synced: {statusData?.last_synced_at ? new Date(statusData.last_synced_at).toLocaleTimeString() : 'Just now'}
          </div>
        </div>
      </div>

      {/* GitHub Actions Live Pipeline Overview */}
      {isConnected && latestRuns.length > 0 && (
        <div
          style={{
            background: '#FFFFFF',
            borderRadius: '12px',
            border: '1px solid #E2E8F0',
            padding: '20px 24px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <PlayCircle size={20} color="#2563EB" />
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0F172A' }}>
                GitHub Actions CI/CD Pipeline Status
              </h3>
            </div>
            <Link
              to="/cicd"
              style={{
                fontSize: '0.82rem',
                fontWeight: 700,
                color: '#2563EB',
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <span>View Full CI/CD Dashboard</span>
              <ExternalLink size={13} />
            </Link>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '12px'
            }}
          >
            {latestRuns.slice(0, 3).map((run) => {
              const isSuccess = (run.status || '').toUpperCase() === 'SUCCESS' || (run.conclusion || '').toUpperCase() === 'SUCCESS';
              const isInProgress = (run.status || '').toUpperCase() === 'IN_PROGRESS';
              return (
                <div
                  key={run.id || run.run_id}
                  style={{
                    background: '#F8FAFC',
                    border: '1px solid #E2E8F0',
                    borderRadius: '8px',
                    padding: '12px 16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1E293B' }}>
                      Run #{run.run_number || run.id}
                    </span>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        background: isSuccess ? '#DCFCE7' : isInProgress ? '#DBEAFE' : '#FEE2E2',
                        color: isSuccess ? '#166534' : isInProgress ? '#1E40AF' : '#991B1B'
                      }}
                    >
                      {isSuccess ? 'PASSED' : isInProgress ? 'RUNNING' : 'FAILED'}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#475569', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {run.commit_message || run.name || 'CI/CD Automation'}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem', color: '#64748B', marginTop: '2px' }}>
                    <span>Branch: <code>{run.branch || 'main'}</code></span>
                    <span>{run.duration_seconds ? `${run.duration_seconds}s` : 'Realtime'}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Commits List Table (if connected) */}
      {isConnected ? (
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

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {/* Branch Selector */}
              {branches.length > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <GitBranch size={15} color="#64748B" />
                  <select
                    value={selectedBranch}
                    onChange={(e) => setSelectedBranch(e.target.value)}
                    style={{
                      padding: '6px 10px',
                      borderRadius: '8px',
                      border: '1px solid #CBD5E1',
                      background: '#FFFFFF',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      color: '#1E293B',
                      outline: 'none'
                    }}
                  >
                    {branches.map(b => (
                      <option key={b.name} value={b.name}>{b.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Search Filter */}
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
                    <th style={{ padding: '12px 20px' }}>Linked Defect</th>
                    <th style={{ padding: '12px 20px' }}>Author</th>
                    <th style={{ padding: '12px 20px' }}>Date</th>
                    <th style={{ padding: '12px 20px', textAlign: 'right' }}>Actions</th>
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
                        <div
                          onClick={() => handleViewChanges(c)}
                          style={{
                            fontWeight: 600,
                            color: '#0F172A',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            cursor: 'pointer'
                          }}
                          title="Click to view diff"
                        >
                          {c.commit_message}
                        </div>
                      </td>
                      <td style={{ padding: '14px 20px' }}>
                        {c.issue_id ? (
                          <Link
                            to={`/issues/${c.issue_id}`}
                            style={{
                              background: '#EFF6FF',
                              color: '#1D4ED8',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              textDecoration: 'none'
                            }}
                          >
                            {c.issue_id}
                          </Link>
                        ) : (
                          <span style={{ color: '#94A3B8', fontSize: '0.78rem' }}>—</span>
                        )}
                      </td>
                      <td style={{ padding: '14px 20px', color: '#334155', fontWeight: 500 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {c.author_avatar ? (
                            <img src={c.author_avatar} alt="" style={{ width: '18px', height: '18px', borderRadius: '50%' }} />
                          ) : null}
                          <span>{c.author_name}</span>
                        </div>
                      </td>
                      <td style={{ padding: '14px 20px', color: '#64748B', whiteSpace: 'nowrap' }}>
                        {c.committed_at ? new Date(c.committed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                      </td>
                      <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                          <button
                            type="button"
                            onClick={() => handleViewChanges(c)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              background: '#EFF6FF',
                              color: '#1D4ED8',
                              border: '1px solid #BFDBFE',
                              padding: '4px 10px',
                              borderRadius: '5px',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              cursor: 'pointer'
                            }}
                          >
                            <FileCode size={12} />
                            <span>Diff</span>
                          </button>
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
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* Truthful Not Connected Banner */
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
        </div>
      )}

      {/* Diff Viewer Modal */}
      {diffModalOpen && selectedCommitDiff && (
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
          onClick={() => setDiffModalOpen(false)}
        >
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: '12px',
              width: '100%',
              maxWidth: '850px',
              maxHeight: '85vh',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: '18px 24px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F8FAFC' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <code style={{ background: '#EDE9FE', color: '#6D28D9', padding: '2px 8px', borderRadius: '4px', fontSize: '0.82rem', fontWeight: 700 }}>
                    {selectedCommitDiff.short_sha || (selectedCommitDiff.commit_sha || '').slice(0, 7)}
                  </code>
                  <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0F172A' }}>
                    Commit Diff & Changes
                  </span>
                </div>
                <div style={{ fontSize: '0.82rem', color: '#475569', marginTop: '4px' }}>
                  {selectedCommitDiff.commit_message}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDiffModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {diffLoading ? (
                <div style={{ padding: '30px', textAlign: 'center', color: '#64748B' }}>
                  <RefreshCw size={24} className="spin" style={{ margin: '0 auto 10px', display: 'block', color: '#2563EB' }} />
                  <span>Loading unified diff from GitHub API...</span>
                </div>
              ) : selectedCommitDiff.diff_content ? (
                <pre
                  style={{
                    background: '#0F172A',
                    color: '#F8FAFC',
                    padding: '16px',
                    borderRadius: '8px',
                    fontSize: '0.78rem',
                    fontFamily: 'monospace',
                    overflowX: 'auto',
                    lineHeight: 1.5,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all'
                  }}
                >
                  {selectedCommitDiff.diff_content}
                </pre>
              ) : selectedCommitDiff.files_summary && selectedCommitDiff.files_summary.length > 0 ? (
                <div>
                  <h4 style={{ margin: '0 0 10px', fontSize: '0.85rem', fontWeight: 700, color: '#475569' }}>
                    Files Changed ({selectedCommitDiff.files_summary.length})
                  </h4>
                  {selectedCommitDiff.files_summary.map((f, idx) => (
                    <div key={idx} style={{ padding: '8px 12px', borderBottom: '1px solid #E2E8F0', fontSize: '0.8rem', display: 'flex', justifyContent: 'space-between' }}>
                      <code>{f.filename}</code>
                      <span style={{ color: '#059669', fontWeight: 600 }}>+{f.additions} -{f.deletions}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ padding: '20px', textAlign: 'center', color: '#64748B' }}>
                  <p>No unified diff patch available for this commit.</p>
                </div>
              )}
            </div>

            <div style={{ padding: '14px 24px', borderTop: '1px solid #E2E8F0', background: '#F8FAFC', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.78rem', color: '#64748B' }}>
                Author: {selectedCommitDiff.author_name}
              </span>
              <a
                href={selectedCommitDiff.view_url || `https://github.com/krupabt/BugFlow/commit/${selectedCommitDiff.commit_sha || selectedCommitDiff.commit_id}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: '#0F172A',
                  color: '#FFFFFF',
                  padding: '6px 14px',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  textDecoration: 'none'
                }}
              >
                <span>Open Commit on GitHub</span>
                <ExternalLink size={13} />
              </a>
            </div>
          </div>
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
                  Token will be encrypted with Fernet AES before storage. Never saved in plaintext.
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
