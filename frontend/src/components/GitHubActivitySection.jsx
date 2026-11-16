import React, { useState, useEffect } from 'react';
import {
  GitBranch,
  GitCommit,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  FileCode,
  Copy,
  Check,
  X,
  RefreshCw,
  FolderGit2,
  Link2,
  Unlink
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../api';

export default function GitHubActivitySection({ issueId, issueTitle, affectedModule }) {
  const [loading, setLoading] = useState(true);
  const [activityData, setActivityData] = useState(null);
  const [error, setError] = useState('');
  const [copiedSha, setCopiedSha] = useState('');
  const [selectedCommitDiff, setSelectedCommitDiff] = useState(null);
  const [diffModalOpen, setDiffModalOpen] = useState(false);
  const [linkShaInput, setLinkShaInput] = useState('');
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linking, setLinking] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (issueId) {
      loadActivity();
    }
  }, [issueId]);

  const loadActivity = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await api.getIssueGithubActivity(issueId);
      setActivityData(data);
    } catch (err) {
      console.error('Failed to load GitHub activity:', err);
      setError(err.message || 'Failed to fetch GitHub activity.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedSha(text);
    setTimeout(() => setCopiedSha(''), 2000);
  };

  const handleViewChanges = async (commit) => {
    try {
      if (commit.diff_content) {
        setSelectedCommitDiff(commit);
        setDiffModalOpen(true);
      } else {
        // Fetch detailed diff from API
        const res = await api.getCommitDetails(commit.commit_sha || commit.commit_id);
        setSelectedCommitDiff(res.commit || commit);
        setDiffModalOpen(true);
      }
    } catch (err) {
      console.warn('Error fetching diff:', err);
      setSelectedCommitDiff(commit);
      setDiffModalOpen(true);
    }
  };

  const handleLinkCommit = async (e) => {
    e.preventDefault();
    if (!linkShaInput.trim()) return;
    try {
      setLinking(true);
      setError('');
      const res = await api.linkCommitToIssue(issueId, linkShaInput.trim());
      setNotice(res.message || 'Commit linked successfully.');
      setLinkShaInput('');
      setShowLinkInput(false);
      await loadActivity();
      setTimeout(() => setNotice(''), 4000);
    } catch (err) {
      setError(err.message || 'Failed to link commit.');
    } finally {
      setLinking(false);
    }
  };

  const handleUnlink = async (commitSha) => {
    try {
      setLoading(true);
      await api.unlinkCommitFromIssue(issueId, commitSha);
      setNotice('Commit unlinked successfully.');
      await loadActivity();
      setTimeout(() => setNotice(''), 4000);
    } catch (err) {
      setError(err.message || 'Failed to unlink commit.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '36px', textAlign: 'center', color: '#64748B' }}>
        <RefreshCw size={24} className="spin" style={{ margin: '0 auto 12px auto', display: 'block', color: '#2563EB' }} />
        <span>Loading GitHub activity and linked commits for {issueId}...</span>
      </div>
    );
  }

  const isConnected = activityData?.is_connected === true;
  const primaryCommit = activityData?.primary_commit || activityData?.commits?.[0];
  const commits = activityData?.commits || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* 1. GITHUB INTEGRATION CARD */}
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
            padding: '16px 20px',
            background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
            color: '#FFFFFF',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: 'rgba(255,255,255,0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <GitBranch size={20} color="#38BDF8" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '8px' }}>
                GitHub Integration
              </h3>
              <div style={{ fontSize: '0.78rem', color: '#94A3B8' }}>
                Repository & Version Control Synchronization
              </div>
            </div>
          </div>

          {/* Real Connection Status Indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {isConnected ? (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: '#ECFDF5',
                  color: '#059669',
                  border: '1px solid #A7F3D0',
                  padding: '4px 12px',
                  borderRadius: '9999px',
                  fontSize: '0.78rem',
                  fontWeight: 700
                }}
              >
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10B981' }} />
                {commits.length > 0 ? 'Linked' : 'Connected'}
              </span>
            ) : (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: '#FEF3C7',
                  color: '#92400E',
                  border: '1px solid #FCD34D',
                  padding: '4px 12px',
                  borderRadius: '9999px',
                  fontSize: '0.78rem',
                  fontWeight: 700
                }}
              >
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#F59E0B' }} />
                Not Connected
              </span>
            )}

            <a
              href={activityData?.repository_url || 'https://github.com/krupabt/BugFlow'}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.2)',
                color: '#F8FAFC',
                padding: '5px 12px',
                borderRadius: '6px',
                fontSize: '0.78rem',
                fontWeight: 600,
                textDecoration: 'none'
              }}
            >
              <span>Repository</span>
              <ExternalLink size={13} />
            </a>
          </div>
        </div>

        {/* Card Content Grid */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '16px',
              background: '#F8FAFC',
              padding: '16px',
              borderRadius: '8px',
              border: '1px solid #E2E8F0'
            }}
          >
            <div>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: '4px' }}>
                Repository Name
              </div>
              <div style={{ fontSize: '0.92rem', fontWeight: 600, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FolderGit2 size={16} color="#4F46E5" />
                <span>{activityData?.repository_name || 'krupabt/BugFlow'}</span>
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: '4px' }}>
                Status
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.88rem', fontWeight: 600, color: isConnected ? '#059669' : '#D97706' }}>
                {isConnected ? <CheckCircle2 size={16} color="#059669" /> : <AlertCircle size={16} color="#D97706" />}
                <span>{isConnected ? 'Verified GitHub Connection' : 'Credentials Not Configured'}</span>
              </div>
            </div>

            {primaryCommit ? (
              <>
                <div>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: '4px' }}>
                    Linked Commit ID
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <code
                      style={{
                        background: '#EDE9FE',
                        color: '#6D28D9',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontFamily: 'monospace',
                        fontSize: '0.82rem',
                        fontWeight: 700
                      }}
                    >
                      {primaryCommit.short_sha || (primaryCommit.commit_sha || '').slice(0, 7)}
                    </code>
                    <button
                      type="button"
                      onClick={() => handleCopy(primaryCommit.commit_sha || primaryCommit.commit_id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: '#64748B' }}
                      title="Copy Commit SHA"
                    >
                      {copiedSha ? <Check size={14} color="#059669" /> : <Copy size={14} />}
                    </button>
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: '4px' }}>
                    Commit Author
                  </div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#0F172A' }}>
                    {primaryCommit.author_name || 'Krupa B T'}
                  </div>
                </div>
              </>
            ) : (
              <div>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: '4px' }}>
                  Linked Commits
                </div>
                <div style={{ fontSize: '0.88rem', color: '#64748B' }}>
                  0 Commits linked
                </div>
              </div>
            )}
          </div>

          {/* Not Connected Guidance Banner */}
          {!isConnected && (
            <div
              style={{
                background: '#FFFBEB',
                border: '1px solid #FDE68A',
                borderRadius: '8px',
                padding: '14px 18px',
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <AlertCircle size={20} color="#D97706" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#92400E' }}>
                    GitHub Personal Access Token Not Configured
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#B45309', marginTop: '2px', lineHeight: 1.4 }}>
                    To see genuine GitHub commits, file diffs, and automated CI/CD runs, configure GITHUB_TOKEN in backend/.env or use the GitHub page to connect.
                  </div>
                </div>
              </div>

              <Link
                to="/github"
                style={{
                  background: '#D97706',
                  color: '#FFFFFF',
                  padding: '6px 14px',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  textDecoration: 'none'
                }}
              >
                Connect GitHub
              </Link>
            </div>
          )}

          {/* Primary Commit Highlight */}
          {primaryCommit && (
            <div
              style={{
                padding: '14px 18px',
                background: '#F1F5F9',
                borderRadius: '8px',
                borderLeft: '4px solid #2563EB',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px'
              }}
            >
              <div style={{ flex: 1, minWidth: '260px' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '4px' }}>
                  Commit Message
                </div>
                <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#0F172A', lineHeight: 1.4 }}>
                  {primaryCommit.commit_message}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => handleViewChanges(primaryCommit)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: '#2563EB',
                    color: '#FFFFFF',
                    border: 'none',
                    padding: '6px 14px',
                    borderRadius: '6px',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  <FileCode size={14} />
                  <span>View Changes</span>
                </button>

                <a
                  href={primaryCommit.view_url || primaryCommit.html_url || `https://github.com/krupabt/BugFlow/commit/${primaryCommit.commit_sha || primaryCommit.commit_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: '#FFFFFF',
                    border: '1px solid #CBD5E1',
                    color: '#1E293B',
                    padding: '6px 14px',
                    borderRadius: '6px',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    textDecoration: 'none'
                  }}
                >
                  <span>View on GitHub</span>
                  <ExternalLink size={13} />
                </a>
              </div>
            </div>
          )}
        </div>
      </div>

      {notice && (
        <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', color: '#065F46', padding: '10px 16px', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CheckCircle2 size={16} color="#059669" />
          <span>{notice}</span>
        </div>
      )}

      {error && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B', padding: '10px 16px', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertCircle size={16} color="#DC2626" />
          <span>{error}</span>
        </div>
      )}

      {/* 2. COMMIT DETAILS TABLE & LINK ACTION */}
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
            padding: '16px 20px',
            borderBottom: '1px solid #E2E8F0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '10px'
          }}
        >
          <div>
            <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <GitCommit size={18} color="#2563EB" />
              Commit Details ({commits.length})
            </h4>
            <span style={{ fontSize: '0.78rem', color: '#64748B' }}>
              Verified commits linked to issue {issueId}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={() => setShowLinkInput(!showLinkInput)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                background: '#EFF6FF',
                border: '1px solid #BFDBFE',
                color: '#1D4ED8',
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '0.78rem',
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              <Link2 size={13} />
              <span>Link Commit SHA</span>
            </button>

            <button
              type="button"
              onClick={loadActivity}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                background: '#F1F5F9',
                border: '1px solid #E2E8F0',
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '0.78rem',
                color: '#334155',
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              <RefreshCw size={13} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Link Input Row */}
        {showLinkInput && (
          <form onSubmit={handleLinkCommit} style={{ padding: '12px 20px', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569' }}>Commit SHA:</span>
            <input
              type="text"
              placeholder="e.g. 7c3a9f0 or full 40-character SHA"
              value={linkShaInput}
              onChange={(e) => setLinkShaInput(e.target.value)}
              style={{ flex: 1, padding: '6px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.82rem' }}
            />
            <button
              type="submit"
              disabled={linking}
              style={{ background: '#2563EB', color: '#FFFFFF', border: 'none', padding: '6px 14px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
            >
              {linking ? 'Linking...' : 'Add Link'}
            </button>
          </form>
        )}

        {commits.length === 0 ? (
          <div style={{ padding: '36px', textAlign: 'center', color: '#64748B' }}>
            <GitCommit size={28} style={{ margin: '0 auto 8px auto', display: 'block', color: '#94A3B8' }} />
            <p style={{ margin: '0 0 6px 0', fontWeight: 600, color: '#334155' }}>No commits currently linked to this issue.</p>
            <span style={{ fontSize: '0.8rem' }}>
              Commits referencing <code>[{issueId}]</code> in their commit message on GitHub will automatically link here, or you can link a commit SHA above.
            </span>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase' }}>
                  <th style={{ padding: '12px 16px' }}>Commit ID</th>
                  <th style={{ padding: '12px 16px' }}>Commit Message</th>
                  <th style={{ padding: '12px 16px' }}>Author</th>
                  <th style={{ padding: '12px 16px' }}>Date</th>
                  <th style={{ padding: '12px 16px' }}>Files Changed</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {commits.map((c) => (
                  <tr key={c.id || c.commit_sha || c.commit_id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <code
                        style={{
                          background: '#EDE9FE',
                          color: '#6D28D9',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontFamily: 'monospace',
                          fontSize: '0.8rem',
                          fontWeight: 700
                        }}
                      >
                        {c.short_sha || (c.commit_sha || c.commit_id || '').slice(0, 7)}
                      </code>
                    </td>
                    <td style={{ padding: '12px 16px', maxWidth: '320px' }}>
                      <div style={{ fontWeight: 600, color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={c.commit_message}>
                        {c.commit_message}
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', color: '#334155', fontWeight: 500 }}>
                      {c.author_name}
                    </td>
                    <td style={{ padding: '12px 16px', color: '#64748B', whiteSpace: 'nowrap' }}>
                      {c.committed_at ? new Date(c.committed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {c.files_changed_count !== null && c.files_changed_count !== undefined ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontWeight: 600, color: '#1E293B' }}>{c.files_changed_count} files</span>
                          <span style={{ fontSize: '0.75rem', color: '#059669', fontWeight: 600 }}>+{c.additions || 0}</span>
                          <span style={{ fontSize: '0.75rem', color: '#DC2626', fontWeight: 600 }}>-{c.deletions || 0}</span>
                        </div>
                      ) : (
                        <span style={{ color: '#94A3B8' }}>Verified</span>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
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
                          <FileCode size={13} />
                          <span>View Changes</span>
                        </button>
                        <a
                          href={c.view_url || c.html_url || `https://github.com/krupabt/BugFlow/commit/${c.commit_sha || c.commit_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            background: '#F8FAFC',
                            color: '#475569',
                            border: '1px solid #E2E8F0',
                            padding: '4px 8px',
                            borderRadius: '5px',
                            fontSize: '0.75rem',
                            textDecoration: 'none'
                          }}
                          title="View on GitHub"
                        >
                          <ExternalLink size={12} />
                        </a>
                        {c.linked_method === 'MANUAL' && (
                          <button
                            type="button"
                            onClick={() => handleUnlink(c.commit_sha || c.commit_id)}
                            style={{
                              background: '#FEF2F2',
                              color: '#DC2626',
                              border: '1px solid #FECACA',
                              padding: '4px 6px',
                              borderRadius: '5px',
                              cursor: 'pointer'
                            }}
                            title="Unlink from this issue"
                          >
                            <Unlink size={12} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 3. VIEW CHANGES MODAL / DIFF VIEWER */}
      {diffModalOpen && selectedCommitDiff && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
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
              maxWidth: '840px',
              maxHeight: '85vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
              overflow: 'hidden'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '16px 20px',
                background: '#0F172A',
                color: '#FFFFFF',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <code style={{ background: '#334155', color: '#38BDF8', padding: '2px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 700 }}>
                    {selectedCommitDiff.short_sha || (selectedCommitDiff.commit_sha || selectedCommitDiff.commit_id || '').slice(0, 7)}
                  </code>
                  <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#F8FAFC' }}>
                    Commit Diff & Changes
                  </span>
                </div>
                <div style={{ fontSize: '0.8rem', color: '#94A3B8' }}>
                  {selectedCommitDiff.commit_message}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setDiffModalOpen(false)}
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  border: 'none',
                  color: '#FFFFFF',
                  borderRadius: '6px',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer'
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Subheader with Stats */}
            <div
              style={{
                padding: '12px 20px',
                background: '#F8FAFC',
                borderBottom: '1px solid #E2E8F0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '10px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.82rem', color: '#475569' }}>
                <span>Author: <strong style={{ color: '#0F172A' }}>{selectedCommitDiff.author_name}</strong></span>
                {selectedCommitDiff.files_changed_count && (
                  <>
                    <span>•</span>
                    <span>{selectedCommitDiff.files_changed_count} file(s) changed</span>
                  </>
                )}
              </div>

              {(selectedCommitDiff.additions || selectedCommitDiff.deletions) && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ background: '#DCFCE7', color: '#166534', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700 }}>
                    +{selectedCommitDiff.additions || 0}
                  </span>
                  <span style={{ background: '#FEE2E2', color: '#991B1B', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700 }}>
                    -{selectedCommitDiff.deletions || 0}
                  </span>
                </div>
              )}
            </div>

            {/* Diff Content Box */}
            <div style={{ padding: '20px', overflowY: 'auto', flex: 1, background: '#090D16' }}>
              <pre
                style={{
                  margin: 0,
                  fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                  fontSize: '0.82rem',
                  lineHeight: 1.5,
                  color: '#E2E8F0',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all'
                }}
              >
                {(selectedCommitDiff.diff_content || 'No unified diff patch available for this commit.')
                  .split('\n')
                  .map((line, idx) => {
                    let color = '#94A3B8';
                    let bg = 'transparent';
                    if (line.startsWith('+') && !line.startsWith('+++')) {
                      color = '#4ADE80';
                      bg = 'rgba(74, 222, 128, 0.1)';
                    } else if (line.startsWith('-') && !line.startsWith('---')) {
                      color = '#F87171';
                      bg = 'rgba(248, 113, 113, 0.1)';
                    } else if (line.startsWith('@@')) {
                      color = '#38BDF8';
                      bg = 'rgba(56, 189, 248, 0.08)';
                    } else if (line.startsWith('diff') || line.startsWith('index')) {
                      color = '#FBBF24';
                    }
                    return (
                      <div key={idx} style={{ color, background: bg, padding: '1px 6px', borderRadius: '2px' }}>
                        {line}
                      </div>
                    );
                  })}
              </pre>
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: '14px 20px',
                borderTop: '1px solid #E2E8F0',
                background: '#FFFFFF',
                display: 'flex',
                justifyContent: 'flex-end',
                alignItems: 'center',
                gap: '10px'
              }}
            >
              <a
                href={selectedCommitDiff.view_url || selectedCommitDiff.html_url || `https://github.com/krupabt/BugFlow/commit/${selectedCommitDiff.commit_sha || selectedCommitDiff.commit_id}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: '#F1F5F9',
                  border: '1px solid #CBD5E1',
                  color: '#1E293B',
                  padding: '7px 14px',
                  borderRadius: '6px',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  textDecoration: 'none'
                }}
              >
                <span>View Full Commit on GitHub</span>
                <ExternalLink size={14} />
              </a>

              <button
                type="button"
                onClick={() => setDiffModalOpen(false)}
                style={{
                  background: '#2563EB',
                  color: '#FFFFFF',
                  border: 'none',
                  padding: '7px 16px',
                  borderRadius: '6px',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Close Diff
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
