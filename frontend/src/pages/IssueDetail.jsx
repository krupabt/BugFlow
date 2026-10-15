import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  User,
  Clock,
  Layers,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  History,
  Send,
  Edit,
  ArrowRightCircle,
  ShieldCheck,
  Tag
} from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

const WORKFLOW_STAGES = ["Open", "In Progress", "Testing", "Resolved", "Closed"];

export default function IssueDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [issue, setIssue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newComment, setNewComment] = useState('');
  const [commentSubmitting, setCommentSubmitting] = useState(false);

  // Status transition state
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [targetStatus, setTargetStatus] = useState('Open');
  const [statusComment, setStatusComment] = useState('');
  const [resolutionSummary, setResolutionSummary] = useState('');
  const [notice, setNotice] = useState('');

  const loadIssue = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getIssue(id);
      setIssue(data);
      setTargetStatus(data.status);
    } catch (err) {
      setError(err.message || 'Failed to load issue details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadIssue();
  }, [id]);

  const handleCommentSubmit = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    setCommentSubmitting(true);
    try {
      await api.addComment(id, newComment.trim());
      setNewComment('');
      setNotice('Comment added successfully!');
      setTimeout(() => setNotice(''), 3000);
      loadIssue();
    } catch (err) {
      setError(err.message || 'Failed to add comment');
    } finally {
      setCommentSubmitting(false);
    }
  };

  const handleStatusTransition = async (e) => {
    e.preventDefault();
    try {
      await api.updateStatus(id, targetStatus, statusComment, resolutionSummary);
      setNotice(`Issue transitioned to ${targetStatus}!`);
      setTimeout(() => setNotice(''), 3000);
      setStatusModalOpen(false);
      setStatusComment('');
      setResolutionSummary('');
      loadIssue();
    } catch (err) {
      setError(err.message || 'Failed to update status');
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading issue details...</p>
      </div>
    );
  }

  if (error || !issue) {
    return (
      <div>
        <button className="btn btn-secondary" style={{ marginBottom: '16px' }} onClick={() => navigate('/issues')}>
          <ArrowLeft size={16} /> Back to Issues
        </button>
        <div className="toast-notice toast-error">
          <AlertCircle size={18} />
          <span>{error || 'Issue not found.'}</span>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Back button & Action Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <button className="btn btn-secondary" onClick={() => navigate('/issues')}>
          <ArrowLeft size={16} /> Back to Issues
        </button>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-primary" onClick={() => setStatusModalOpen(true)}>
            <ArrowRightCircle size={16} />
            <span>Update Status</span>
          </button>
        </div>
      </div>

      {notice && (
        <div className="toast-notice toast-success">
          <CheckCircle2 size={18} />
          <span>{notice}</span>
        </div>
      )}

      {/* Main Grid: Details (Left) + Meta/Sidebar (Right) */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
        
        {/* Left Column: Details, Technical info, Comments */}
        <div>
          <div className="card">
            {/* Key + Title */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#6754E8' }}>{issue.id}</span>
              <span className={`badge badge-${(issue.status || 'Open').toLowerCase().replace(' ', '-')}`}>
                {issue.status}
              </span>
              <span className={`badge badge-${(issue.priority || 'P2').toLowerCase()}`}>
                {issue.priority}
              </span>
            </div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '16px', color: '#24243B' }}>
              {issue.title}
            </h1>

            {/* Description */}
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#74748B', textTransform: 'uppercase', marginBottom: '6px' }}>
                Description
              </h3>
              <p style={{ fontSize: '0.92rem', color: '#24243B', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                {issue.description || 'No description provided.'}
              </p>
            </div>

            {/* Technical Reproduction Details */}
            <div style={{ borderTop: '1px solid #E9E7F0', paddingTop: '20px', marginBottom: '24px' }}>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '14px', color: '#24243B' }}>
                Technical & Reproduction Details
              </h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '14px' }}>
                <div>
                  <span style={{ fontSize: '0.78rem', color: '#74748B', display: 'block', fontWeight: 600 }}>Component</span>
                  <span style={{ fontSize: '0.88rem', fontWeight: 500 }}>{issue.component || 'Not specified'}</span>
                </div>
                <div>
                  <span style={{ fontSize: '0.78rem', color: '#74748B', display: 'block', fontWeight: 600 }}>Environment</span>
                  <span style={{ fontSize: '0.88rem', fontWeight: 500 }}>{issue.environment || 'Not specified'}</span>
                </div>
              </div>

              {issue.steps_to_reproduce && (
                <div style={{ marginBottom: '14px' }}>
                  <span style={{ fontSize: '0.78rem', color: '#74748B', display: 'block', fontWeight: 600, marginBottom: '4px' }}>
                    Steps to Reproduce
                  </span>
                  <div style={{ background: '#F8F9FD', padding: '10px 14px', borderRadius: '6px', fontSize: '0.85rem', border: '1px solid #E9E7F0' }}>
                    {issue.steps_to_reproduce}
                  </div>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '14px' }}>
                {issue.expected_result && (
                  <div>
                    <span style={{ fontSize: '0.78rem', color: '#74748B', display: 'block', fontWeight: 600, marginBottom: '4px' }}>Expected Result</span>
                    <div style={{ background: '#F8F9FD', padding: '8px 12px', borderRadius: '6px', fontSize: '0.84rem' }}>
                      {issue.expected_result}
                    </div>
                  </div>
                )}
                {issue.actual_result && (
                  <div>
                    <span style={{ fontSize: '0.78rem', color: '#74748B', display: 'block', fontWeight: 600, marginBottom: '4px' }}>Actual Result</span>
                    <div style={{ background: '#F8F9FD', padding: '8px 12px', borderRadius: '6px', fontSize: '0.84rem' }}>
                      {issue.actual_result}
                    </div>
                  </div>
                )}
              </div>

              {issue.business_impact && (
                <div>
                  <span style={{ fontSize: '0.78rem', color: '#74748B', display: 'block', fontWeight: 600 }}>Business Impact</span>
                  <span style={{ fontSize: '0.88rem', fontWeight: 500 }}>{issue.business_impact}</span>
                </div>
              )}
            </div>

            {/* Resolution Information if Resolved */}
            {(issue.resolution_summary || issue.root_cause) && (
              <div style={{ borderTop: '1px solid #E9E7F0', paddingTop: '20px', background: '#F0FDF4', padding: '16px', borderRadius: '8px', border: '1px solid #BBF7D0', marginBottom: '24px' }}>
                <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#15803D', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <ShieldCheck size={18} /> Resolution Details
                </h3>
                {issue.resolution_summary && (
                  <div style={{ marginBottom: '8px' }}>
                    <span style={{ fontSize: '0.78rem', color: '#166534', fontWeight: 600, display: 'block' }}>Resolution Summary</span>
                    <p style={{ fontSize: '0.88rem', color: '#14532D' }}>{issue.resolution_summary}</p>
                  </div>
                )}
                {issue.root_cause && (
                  <div>
                    <span style={{ fontSize: '0.78rem', color: '#166534', fontWeight: 600, display: 'block' }}>Root Cause</span>
                    <p style={{ fontSize: '0.88rem', color: '#14532D' }}>{issue.root_cause}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Comments Section */}
          <div className="card">
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <MessageSquare size={18} /> Comments ({issue.comments?.length || 0})
            </h3>

            {/* Existing Comments */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
              {(issue.comments || []).length === 0 ? (
                <p style={{ color: '#74748B', fontSize: '0.85rem' }}>No comments posted yet. Start the discussion below.</p>
              ) : (
                issue.comments.map((c) => (
                  <div key={c.id} style={{ padding: '12px 16px', background: '#F8F9FD', borderRadius: '8px', border: '1px solid #E9E7F0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{c.user_name}</span>
                      <span style={{ fontSize: '0.75rem', color: '#74748B' }}>
                        {c.created_at ? new Date(c.created_at).toLocaleString() : ''}
                      </span>
                    </div>
                    <p style={{ fontSize: '0.88rem', color: '#24243B', whiteSpace: 'pre-wrap' }}>{c.content}</p>
                  </div>
                ))
              )}
            </div>

            {/* Add Comment Form */}
            <form onSubmit={handleCommentSubmit}>
              <div className="form-group">
                <textarea
                  className="form-textarea"
                  rows="3"
                  placeholder="Write a comment or technical update..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                />
              </div>
              <button type="submit" className="btn btn-primary" disabled={commentSubmitting || !newComment.trim()}>
                <Send size={15} />
                <span>{commentSubmitting ? 'Posting...' : 'Post Comment'}</span>
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: Metadata & History Timeline */}
        <div>
          {/* Metadata Card */}
          <div className="card" style={{ marginBottom: '24px' }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '16px' }}>Issue Properties</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '0.85rem' }}>
              <div>
                <span style={{ color: '#74748B', display: 'block', fontSize: '0.75rem', fontWeight: 600 }}>Project</span>
                <span style={{ fontWeight: 600 }}>{issue.project_name}</span>
              </div>
              <div>
                <span style={{ color: '#74748B', display: 'block', fontSize: '0.75rem', fontWeight: 600 }}>Issue Type</span>
                <span>{issue.issue_type}</span>
              </div>
              <div>
                <span style={{ color: '#74748B', display: 'block', fontSize: '0.75rem', fontWeight: 600 }}>Severity</span>
                <span className={`badge badge-${(issue.severity || 'Medium').toLowerCase()}`}>{issue.severity}</span>
              </div>
              <div>
                <span style={{ color: '#74748B', display: 'block', fontSize: '0.75rem', fontWeight: 600 }}>Priority</span>
                <span className={`badge badge-${(issue.priority || 'P2').toLowerCase()}`}>{issue.priority}</span>
              </div>
              <div>
                <span style={{ color: '#74748B', display: 'block', fontSize: '0.75rem', fontWeight: 600 }}>Assigned Developer</span>
                <span style={{ fontWeight: 600 }}>{issue.assignee_name || 'Unassigned'}</span>
              </div>
              <div>
                <span style={{ color: '#74748B', display: 'block', fontSize: '0.75rem', fontWeight: 600 }}>Reported By</span>
                <span>{issue.reporter_name || 'System'}</span>
              </div>
              <div>
                <span style={{ color: '#74748B', display: 'block', fontSize: '0.75rem', fontWeight: 600 }}>Sprint</span>
                <span>{issue.sprint_name || issue.sprint_id || 'Backlog'}</span>
              </div>
              <div>
                <span style={{ color: '#74748B', display: 'block', fontSize: '0.75rem', fontWeight: 600 }}>Reopen Count</span>
                <span style={{ fontWeight: 600, color: issue.reopen_count > 0 ? '#EF4444' : '#24243B' }}>
                  {issue.reopen_count || 0}
                </span>
              </div>
              <div>
                <span style={{ color: '#74748B', display: 'block', fontSize: '0.75rem', fontWeight: 600 }}>Created Date</span>
                <span>{issue.created_date || (issue.created_at ? issue.created_at.slice(0, 10) : '—')}</span>
              </div>
              {issue.resolved_date && (
                <div>
                  <span style={{ color: '#74748B', display: 'block', fontSize: '0.75rem', fontWeight: 600 }}>Resolved Date</span>
                  <span style={{ color: '#16A34A', fontWeight: 600 }}>{issue.resolved_date}</span>
                </div>
              )}
            </div>
          </div>

          {/* Audit History Timeline */}
          <div className="card">
            <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <History size={16} /> Status History
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {(issue.status_history || []).length === 0 ? (
                <p style={{ color: '#74748B', fontSize: '0.8rem' }}>No status changes recorded yet.</p>
              ) : (
                issue.status_history.map((h) => (
                  <div key={h.id} style={{ borderLeft: '2px solid #6754E8', paddingLeft: '10px', fontSize: '0.8rem' }}>
                    <div style={{ fontWeight: 600 }}>
                      {h.old_status ? `${h.old_status} → ` : ''}<strong>{h.new_status}</strong>
                    </div>
                    {h.comment && <div style={{ color: '#74748B', margin: '2px 0' }}>{h.comment}</div>}
                    <div style={{ fontSize: '0.72rem', color: '#A3A3BA' }}>
                      By {h.changed_by} • {h.created_at ? new Date(h.created_at).toLocaleDateString() : ''}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Status Transition Modal */}
      {statusModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h2 className="modal-title">Transition Issue Status</h2>
              <button className="btn-icon" onClick={() => setStatusModalOpen(false)}>×</button>
            </div>
            <form onSubmit={handleStatusTransition}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">New Status *</label>
                  <select
                    className="form-select"
                    value={targetStatus}
                    onChange={(e) => setTargetStatus(e.target.value)}
                  >
                    {WORKFLOW_STAGES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                {(targetStatus === 'Resolved' || targetStatus === 'Closed') && (
                  <div className="form-group">
                    <label className="form-label">Resolution Summary</label>
                    <textarea
                      className="form-textarea"
                      rows="2"
                      placeholder="Explain fix..."
                      value={resolutionSummary}
                      onChange={(e) => setResolutionSummary(e.target.value)}
                    />
                  </div>
                )}
                <div className="form-group">
                  <label className="form-label">Transition Comment</label>
                  <textarea
                    className="form-textarea"
                    rows="2"
                    placeholder="Audit reason..."
                    value={statusComment}
                    onChange={(e) => setStatusComment(e.target.value)}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setStatusModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Transition
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
