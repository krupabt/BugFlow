import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Bug,
  Clock,
  User,
  FolderGit2,
  CheckCircle,
  MessageSquare,
  History,
  Sparkles,
  AlertCircle,
  Send,
} from 'lucide-react';
import Header from '../components/Header';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

export default function IssueDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [issue, setIssue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Status transition state
  const [newStatus, setNewStatus] = useState('');
  const [statusComment, setStatusComment] = useState('');
  const [resolutionText, setResolutionText] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // New comment state
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  const loadIssue = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getIssue(id);
      setIssue(data);
      setNewStatus(data.status);
      setResolutionText(data.resolution || '');
    } catch (err) {
      setError(err.message || 'Issue not found.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadIssue();
  }, [id]);

  const handleStatusChange = async (e) => {
    e.preventDefault();
    if (newStatus === issue.status) return;

    setUpdatingStatus(true);
    try {
      await api.updateStatus(issue.id, newStatus, statusComment, resolutionText);
      setStatusComment('');
      loadIssue();
    } catch (err) {
      alert(`Error updating status: ${err.message}`);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    setSubmittingComment(true);
    try {
      await api.addComment(issue.id, commentText);
      setCommentText('');
      loadIssue();
    } catch (err) {
      alert(`Error posting comment: ${err.message}`);
    } finally {
      setSubmittingComment(false);
    }
  };

  if (loading) {
    return (
      <div>
        <Header title="Defect Details" />
        <div className="content-body" style={{ textAlign: 'center', padding: '60px', color: '#64748b' }}>
          Loading issue #{id} from PostgreSQL database...
        </div>
      </div>
    );
  }

  if (error || !issue) {
    return (
      <div>
        <Header title="Defect Details" />
        <div className="content-body">
          <div className="alert alert-error">
            <AlertCircle size={18} />
            <span>{error || 'Issue not found'}</span>
          </div>
          <Link to="/issues" className="btn btn-secondary">
            <ArrowLeft size={16} />
            <span>Back to Issues</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Header title={`Issue Details: ${issue.issue_key}`} />

      <div className="content-body">
        {/* Back Link */}
        <div style={{ marginBottom: '20px' }}>
          <Link
            to="/issues"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              textDecoration: 'none',
              color: '#64748b',
              fontSize: '0.88rem',
              fontWeight: '500',
            }}
          >
            <ArrowLeft size={16} />
            <span>Back to all issues</span>
          </Link>
        </div>

        {/* Top Header Card */}
        <div className="card" style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <span style={{ fontSize: '1.25rem', fontWeight: '700', color: '#2563eb' }}>
                  {issue.issue_key}
                </span>
                <span className={`badge badge-${issue.status.toLowerCase().replace(' ', '')}`}>
                  {issue.status}
                </span>
                <span className={`badge badge-${issue.severity.toLowerCase()}`}>
                  {issue.severity} Severity
                </span>
                {issue.is_historical && (
                  <span className="badge badge-historical">Historical Imported</span>
                )}
              </div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: '700', color: '#0f172a' }}>
                {issue.title}
              </h2>
            </div>

            {/* Quick Assistant Shortcut */}
            <button
              className="btn btn-secondary"
              onClick={() => {
                navigate(
                  `/assistant?title=${encodeURIComponent(issue.title)}&desc=${encodeURIComponent(issue.description || '')}`
                );
              }}
            >
              <Sparkles size={16} color="#2563eb" />
              <span>Diagnose in Resolution Assistant</span>
            </button>
          </div>
        </div>

        {/* 2 Column Layout: Details + Sidebar Actions */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
          {/* Left Column: Description, Discussion & Audit Timeline */}
          <div>
            {/* Description */}
            <div className="card" style={{ marginBottom: '24px' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '14px', color: '#0f172a' }}>
                Description & Reproduction Details
              </h3>
              <div
                style={{
                  fontSize: '0.92rem',
                  lineHeight: '1.6',
                  color: '#334155',
                  whiteSpace: 'pre-wrap',
                  backgroundColor: '#f8fafc',
                  padding: '16px',
                  borderRadius: '6px',
                  border: '1px solid #e2e8f0',
                }}
              >
                {issue.description || 'No detailed description provided for this defect report.'}
              </div>

              {issue.resolution && (
                <div style={{ marginTop: '20px', padding: '16px', backgroundColor: '#ecfdf5', borderRadius: '6px', border: '1px solid #a7f3d0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#065f46', fontWeight: '600', marginBottom: '4px' }}>
                    <CheckCircle size={18} />
                    <span>Resolution Details</span>
                  </div>
                  <p style={{ fontSize: '0.9rem', color: '#047857' }}>{issue.resolution}</p>
                </div>
              )}
            </div>

            {/* Comments & Discussion */}
            <div className="card" style={{ marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <MessageSquare size={18} color="#2563eb" />
                <h3 style={{ fontSize: '1rem', fontWeight: '600' }}>
                  Developer Discussion ({issue.comments?.length || 0})
                </h3>
              </div>

              {/* Comment List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
                {issue.comments && issue.comments.length > 0 ? (
                  issue.comments.map((c) => (
                    <div
                      key={c.id}
                      style={{
                        padding: '14px 16px',
                        backgroundColor: '#f8fafc',
                        borderRadius: '6px',
                        border: '1px solid #e2e8f0',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <span style={{ fontWeight: '600', fontSize: '0.88rem', color: '#0f172a' }}>
                          {c.user_name}
                        </span>
                        <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                          {c.created_at ? new Date(c.created_at).toLocaleString() : ''}
                        </span>
                      </div>
                      <p style={{ fontSize: '0.88rem', color: '#334155', lineHeight: '1.5' }}>
                        {c.content}
                      </p>
                    </div>
                  ))
                ) : (
                  <p style={{ color: '#64748b', fontSize: '0.88rem', fontStyle: 'italic' }}>
                    No comments yet. Start the technical discussion below.
                  </p>
                )}
              </div>

              {/* Add Comment Form */}
              <form onSubmit={handleAddComment}>
                <div className="form-group" style={{ marginBottom: '10px' }}>
                  <textarea
                    className="form-textarea"
                    placeholder="Write a comment, share root-cause findings, or update the team..."
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    rows={3}
                    required
                  />
                </div>
                <button type="submit" className="btn btn-primary btn-sm" disabled={submittingComment}>
                  <Send size={14} />
                  <span>{submittingComment ? 'Posting...' : 'Post Comment'}</span>
                </button>
              </form>
            </div>

            {/* Audit Log / Status History Timeline */}
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <History size={18} color="#2563eb" />
                <h3 style={{ fontSize: '1rem', fontWeight: '600' }}>Lifecycle & Status History</h3>
              </div>

              {issue.status_history && issue.status_history.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {issue.status_history.map((h) => (
                    <div
                      key={h.id}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '12px',
                        fontSize: '0.85rem',
                        borderLeft: '2px solid #3b82f6',
                        paddingLeft: '14px',
                      }}
                    >
                      <div>
                        <div>
                          <strong>{h.changed_by}</strong> updated status from{' '}
                          <span style={{ color: '#64748b' }}>{h.old_status || 'Creation'}</span> to{' '}
                          <span style={{ fontWeight: '600', color: '#0f172a' }}>{h.new_status}</span>
                        </div>
                        {h.comment && (
                          <div style={{ color: '#64748b', marginTop: '2px', fontStyle: 'italic' }}>
                            "{h.comment}"
                          </div>
                        )}
                        <div style={{ color: '#94a3b8', fontSize: '0.78rem', marginTop: '3px' }}>
                          {h.created_at ? new Date(h.created_at).toLocaleString() : ''}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: '#64748b', fontSize: '0.85rem' }}>No status transitions recorded.</p>
              )}
            </div>
          </div>

          {/* Right Column: Metadata & Status Controls */}
          <div>
            {/* Status Update Card */}
            <div className="card" style={{ marginBottom: '24px' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: '600', marginBottom: '14px' }}>
                Workflow Transition
              </h3>

              <form onSubmit={handleStatusChange}>
                <div className="form-group">
                  <label className="form-label">Update Status</label>
                  <select
                    className="form-select"
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value)}
                  >
                    <option value="Open">Open</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Resolved">Resolved</option>
                    <option value="Closed">Closed</option>
                  </select>
                </div>

                {(newStatus === 'Resolved' || newStatus === 'Closed') && (
                  <div className="form-group">
                    <label className="form-label">Resolution Details</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Fixed in commit #a8f12, verified by QA"
                      value={resolutionText}
                      onChange={(e) => setResolutionText(e.target.value)}
                    />
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Transition Note</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Optional note for the audit timeline"
                    value={statusComment}
                    onChange={(e) => setStatusComment(e.target.value)}
                  />
                </div>

                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ width: '100%' }}
                  disabled={updatingStatus || newStatus === issue.status}
                >
                  {updatingStatus ? 'Updating...' : 'Apply Status Change'}
                </button>
              </form>
            </div>

            {/* Defect Metadata Card */}
            <div className="card">
              <h3 style={{ fontSize: '0.95rem', fontWeight: '600', marginBottom: '16px' }}>
                Ticket Attributes
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.88rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Project:</span>
                  <span style={{ fontWeight: '600' }}>{issue.project_name || issue.project_key}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Priority:</span>
                  <span style={{ fontWeight: '600' }}>{issue.priority}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Assignee:</span>
                  <span style={{ fontWeight: '600' }}>{issue.assignee_name || 'Unassigned'}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Reporter:</span>
                  <span style={{ fontWeight: '600' }}>{issue.reporter_name || 'System'}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Reported At:</span>
                  <span>{issue.created_at ? new Date(issue.created_at).toLocaleDateString() : '-'}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Last Updated:</span>
                  <span>{issue.updated_at ? new Date(issue.updated_at).toLocaleDateString() : '-'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
