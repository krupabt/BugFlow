import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X,
  Bug,
  Edit,
  Send,
  Paperclip,
  Upload,
  Download,
  Trash2,
  FileText,
  FileCode,
  Image as ImageIcon,
  File,
  Layers,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  ArrowRightCircle,
  Clock,
  User,
  History,
  MessageSquare,
  MoreVertical,
  Check,
  ExternalLink
} from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import GitHubActivitySection from './GitHubActivitySection';

const WORKFLOW_STAGES = ["Open", "In Progress", "Testing", "Resolved", "Closed"];

const VALID_TRANSITIONS = {
  "Open": ["In Progress"],
  "In Progress": ["Testing"],
  "Testing": ["Resolved", "In Progress"],
  "Resolved": ["Closed", "In Progress"],
  "Closed": ["Open"]
};

const ALLOWED_EXTENSIONS = ['png', 'jpg', 'jpeg', 'pdf', 'txt', 'log', 'doc', 'docx', 'csv'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

function formatDateTime(isoString) {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  } catch {
    return isoString;
  }
}

function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function getFileIcon(filename) {
  const ext = (filename || '').split('.').pop().toLowerCase();
  if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)) {
    return <ImageIcon size={18} color="#2563EB" />;
  }
  if (['log', 'txt', 'json'].includes(ext)) {
    return <FileCode size={18} color="#D97706" />;
  }
  if (['doc', 'docx', 'pdf', 'csv'].includes(ext)) {
    return <FileText size={18} color="#059669" />;
  }
  return <File size={18} color="#6B7280" />;
}

function getAvatarColor(name) {
  const colors = ['#2563EB', '#7C3AED', '#059669', '#D97706', '#DB2777', '#0891B2', '#4F46E5'];
  if (!name) return colors[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

function getInitials(name) {
  if (!name) return 'U';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export default function IssueDetailPanel({ issueId, isOpen, onClose, onIssueUpdated }) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const fileInputRef = useRef(null);
  const composerFileInputRef = useRef(null);

  const [issue, setIssue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Active tab: 'details', 'comments', 'activity'
  const [activeTab, setActiveTab] = useState('details');

  // Comments state
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editingCommentContent, setEditingCommentContent] = useState('');
  const [commentMenuOpenId, setCommentMenuOpenId] = useState(null);

  // Attachments state
  const [attachments, setAttachments] = useState([]);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadError, setUploadError] = useState('');

  // Activity history state
  const [activities, setActivities] = useState([]);
  const [activityLoading, setActivityLoading] = useState(false);

  // Update Status state (bottom of Activity History tab)
  const [targetStatus, setTargetStatus] = useState('');
  const [statusComment, setStatusComment] = useState('');
  const [resolutionSummary, setResolutionSummary] = useState('');
  const [rootCause, setRootCause] = useState('');
  const [transitionSubmitting, setTransitionSubmitting] = useState(false);
  const [statusNotice, setStatusNotice] = useState('');
  const [statusError, setStatusError] = useState('');

  const normRole = (user?.role || '').toUpperCase().replace(/ /g, '_');
  const isAuthorizedManager = normRole === 'ADMIN' || normRole === 'PROJECT_MANAGER';

  // Fetch issue details whenever issueId changes
  useEffect(() => {
    if (!issueId || !isOpen) return;

    let isMounted = true;
    async function fetchIssue() {
      setLoading(true);
      setError('');
      try {
        const data = await api.getIssue(issueId);
        if (!isMounted) return;
        setIssue(data);
        setComments(data.comments || []);
        setAttachments(data.attachments || []);
        if (data.status_history) {
          setActivities(data.status_history);
        }
        // Initialize default target status
        const validNext = VALID_TRANSITIONS[data.status] || [];
        setTargetStatus(validNext[0] || '');
        setResolutionSummary(data.resolution_summary || '');
        setRootCause(data.root_cause || '');
      } catch (err) {
        if (!isMounted) return;
        setError(err.message || 'Failed to load issue details');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchIssue();
    return () => {
      isMounted = false;
    };
  }, [issueId, isOpen]);

  // Load activities when switching to activity tab
  const loadActivityHistory = async () => {
    if (!issueId) return;
    setActivityLoading(true);
    try {
      const res = await api.getIssueActivity(issueId);
      setActivities(res || []);
    } catch {
      // fallback
    } finally {
      setActivityLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'activity' && issueId) {
      loadActivityHistory();
    }
  }, [activeTab, issueId]);

  // Handle comment submit
  const handleCommentSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!newComment.trim() || !issueId) return;
    setCommentSubmitting(true);
    try {
      const res = await api.addComment(issueId, newComment.trim());
      setNewComment('');
      setComments(prev => [...prev, res.comment]);
      setNotice('Comment posted successfully!');
      setTimeout(() => setNotice(''), 3000);
      loadActivityHistory();
    } catch (err) {
      setError(err.message || 'Failed to post comment');
      setTimeout(() => setError(''), 4000);
    } finally {
      setCommentSubmitting(false);
    }
  };

  const handleEditCommentStart = (c) => {
    setEditingCommentId(c.id);
    setEditingCommentContent(c.content);
    setCommentMenuOpenId(null);
  };

  const handleEditCommentSave = async (commentId) => {
    if (!editingCommentContent.trim()) return;
    try {
      const res = await api.updateComment(issueId, commentId, editingCommentContent.trim());
      setComments(comments.map(c => c.id === commentId ? res.comment : c));
      setEditingCommentId(null);
      setNotice('Comment updated!');
      setTimeout(() => setNotice(''), 3000);
    } catch (err) {
      setError(err.message || 'Failed to update comment');
      setTimeout(() => setError(''), 4000);
    }
  };

  const handleDeleteComment = async (commentId) => {
    setCommentMenuOpenId(null);
    if (!window.confirm('Are you sure you want to delete this comment?')) return;
    try {
      await api.deleteComment(issueId, commentId);
      setComments(comments.filter(c => c.id !== commentId));
      setNotice('Comment deleted!');
      setTimeout(() => setNotice(''), 3000);
      loadActivityHistory();
    } catch (err) {
      setError(err.message || 'Failed to delete comment');
      setTimeout(() => setError(''), 4000);
    }
  };

  // Attachments handlers
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !issueId) return;

    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      setUploadError(`Invalid file format. Allowed: ${ALLOWED_EXTENSIONS.map(s => s.toUpperCase()).join(', ')}.`);
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setUploadError(`File size exceeds 10 MB limit (${formatFileSize(file.size)}).`);
      return;
    }

    setUploadingFile(true);
    setUploadError('');
    try {
      const res = await api.uploadAttachment(issueId, file);
      setAttachments(prev => [res.attachment, ...prev]);
      setNotice(`Uploaded "${res.attachment.filename}" successfully!`);
      setTimeout(() => setNotice(''), 3000);
      loadActivityHistory();
    } catch (err) {
      setUploadError(err.message || 'Failed to upload attachment');
    } finally {
      setUploadingFile(false);
      e.target.value = '';
    }
  };

  const handleDeleteAttachment = async (attachmentId, filename) => {
    if (!window.confirm(`Delete attachment "${filename}"?`)) return;
    try {
      await api.deleteAttachment(issueId, attachmentId);
      setAttachments(attachments.filter(a => a.id !== attachmentId));
      setNotice(`Attachment "${filename}" removed.`);
      setTimeout(() => setNotice(''), 3000);
      loadActivityHistory();
    } catch (err) {
      setError(err.message || 'Failed to delete attachment');
      setTimeout(() => setError(''), 4000);
    }
  };

  const handleDownloadAttachment = async (attachment) => {
    try {
      await api.downloadAttachment(issueId, attachment.id, attachment.filename);
    } catch (err) {
      setError(err.message || 'Failed to download file');
      setTimeout(() => setError(''), 4000);
    }
  };

  // Status transition handler (Update Status Card)
  const allowedNextStatuses = VALID_TRANSITIONS[issue?.status] || [];

  const handleStatusTransition = async (e) => {
    e.preventDefault();
    if (!targetStatus || !issueId) return;
    setTransitionSubmitting(true);
    setStatusNotice('');
    setStatusError('');
    try {
      const updated = await api.updateStatus(issueId, targetStatus, statusComment, resolutionSummary, rootCause);
      setStatusNotice(`Status updated successfully to ${targetStatus}!`);
      setTimeout(() => setStatusNotice(''), 3500);

      // Update local issue state
      setIssue(prev => ({
        ...prev,
        status: targetStatus,
        resolution_summary: resolutionSummary,
        root_cause: rootCause
      }));

      // Set next target status
      const nextAllowed = VALID_TRANSITIONS[targetStatus] || [];
      setTargetStatus(nextAllowed[0] || '');
      setStatusComment('');

      // Refresh activity timeline
      await loadActivityHistory();

      // Notify parent list to update row immediately
      if (onIssueUpdated) {
        onIssueUpdated(updated.issue || { id: issueId, status: targetStatus });
      }
    } catch (err) {
      setStatusError(err.message || 'Failed to update status. Transition not permitted.');
      setTimeout(() => setStatusError(''), 4000);
    } finally {
      setTransitionSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* 1. SUBTLE OVERLAY / DIMMING EFFECT */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.42)',
          backdropFilter: 'blur(2px)',
          zIndex: 1000,
          transition: 'opacity 0.25s ease'
        }}
      />

      {/* 2. LARGE RIGHT-SIDE SLIDE-OUT PANEL */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: 'min(58vw, 860px)',
          minWidth: '540px',
          height: '100vh',
          background: '#FFFFFF',
          borderTopLeftRadius: '16px',
          borderBottomLeftRadius: '16px',
          boxShadow: '-8px 0 36px rgba(15, 23, 42, 0.16)',
          zIndex: 1001,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <style>{`
          @keyframes slideInRight {
            from { transform: translateX(100%); }
            to { transform: translateX(0); }
          }
        `}</style>

        {loading ? (
          <div className="loading-container" style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div className="spinner"></div>
            <p style={{ marginTop: '14px', color: '#64748B' }}>Loading issue #{issueId}...</p>
          </div>
        ) : error && !issue ? (
          <div style={{ padding: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '1.2rem', color: '#0F172A' }}>Issue Details</h2>
              <button className="btn-icon" onClick={onClose}>
                <X size={20} />
              </button>
            </div>
            <div className="toast-notice toast-error">
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          </div>
        ) : (
          <>
            {/* 3. PANEL HEADER */}
            <div style={{ padding: '20px 24px 16px 24px', borderBottom: '1px solid #E2E8F0', background: '#FFFFFF' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '14px', marginBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {/* BugFlow Issue Icon */}
                  <div style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '8px',
                    background: '#EFF6FF',
                    color: '#2563EB',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <Bug size={20} />
                  </div>

                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '1.15rem', fontWeight: 800, color: '#2563EB', letterSpacing: '-0.01em' }}>
                        {issue.id}
                      </span>
                      <span className={`badge badge-${(issue.status || 'open').toLowerCase().replace(' ', '-')}`} style={{ fontSize: '0.78rem' }}>
                        ● {issue.status}
                      </span>
                      <span className={`badge badge-pri-${(issue.priority_level || issue.priority || 'P2').toLowerCase()}`} style={{ fontSize: '0.78rem' }}>
                        {issue.priority_display || issue.priority}
                      </span>
                      {issue.affected_module && (
                        <span className="badge badge-module" style={{ fontSize: '0.76rem' }}>
                          Module: {issue.affected_module}
                        </span>
                      )}
                    </div>

                    <div style={{ fontSize: '0.82rem', color: '#64748B', marginTop: '3px' }}>
                      Project: <strong style={{ color: '#1E293B' }}>{issue.project_name}</strong> ({issue.project_id})
                    </div>
                  </div>
                </div>

                {/* Header Actions: Edit Issue & Close button */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    className="btn btn-secondary"
                    onClick={() => navigate(`/issues/${issue.id}/edit`)}
                    style={{ padding: '5px 10px', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                    title="Edit Issue"
                  >
                    <Edit size={13} />
                    <span>Edit</span>
                  </button>

                  <button
                    className="btn-icon"
                    onClick={onClose}
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#64748B',
                      background: '#F1F5F9',
                      border: 'none',
                      cursor: 'pointer'
                    }}
                    title="Close Panel"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Title */}
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0F172A', margin: '4px 0 0 0', lineHeight: 1.35 }}>
                {issue.title}
              </h2>
            </div>

            {/* Notification Toasts in Panel */}
            {notice && (
              <div className="toast-notice toast-success" style={{ margin: '12px 24px 0 24px', padding: '8px 12px', fontSize: '0.84rem' }}>
                <CheckCircle2 size={16} />
                <span>{notice}</span>
              </div>
            )}
            {error && (
              <div className="toast-notice toast-error" style={{ margin: '12px 24px 0 24px', padding: '8px 12px', fontSize: '0.84rem' }}>
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            {/* 4. TABS NAVIGATION (Description, GitHub Activity, Comments, Activity History) */}
            <div style={{ display: 'flex', background: '#FFFFFF', borderBottom: '2px solid #E2E8F0', padding: '0 24px', overflowX: 'auto' }}>
              {[
                { id: 'details', label: 'Description' },
                { id: 'github', label: 'GitHub Activity' },
                { id: 'comments', label: `Comments (${comments.length})` },
                { id: 'activity', label: 'Activity History' }
              ].map(tab => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    style={{
                      padding: '12px 18px',
                      border: 'none',
                      background: 'none',
                      borderBottom: isActive ? '3px solid #2563EB' : '3px solid transparent',
                      color: isActive ? '#2563EB' : '#64748B',
                      fontWeight: isActive ? 700 : 600,
                      fontSize: '0.88rem',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      marginBottom: '-2px'
                    }}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* PANEL BODY CONTENT (Scrollable) */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
              
              {/* ============================================================= */}
              {/* TAB 1: DETAILS TAB                                            */}
              {/* ============================================================= */}
              {activeTab === 'details' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                  
                  {/* Issue Description */}
                  <div style={{ background: '#F8FAFC', padding: '16px', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                    <div style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px' }}>
                      Description
                    </div>
                    <p style={{ fontSize: '0.9rem', color: '#1E293B', lineHeight: 1.6, whiteSpace: 'pre-wrap', margin: 0 }}>
                      {issue.description || 'No description provided.'}
                    </p>
                  </div>

                  {/* Properties Information Grid */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: '14px',
                    background: '#FFFFFF',
                    padding: '16px',
                    borderRadius: '10px',
                    border: '1px solid #E2E8F0'
                  }}>
                    <div>
                      <span style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 600, display: 'block' }}>Issue Type</span>
                      <span className="badge badge-type" style={{ marginTop: '2px', display: 'inline-block', fontSize: '0.76rem' }}>
                        {issue.issue_type}
                      </span>
                    </div>

                    <div>
                      <span style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 600, display: 'block' }}>Severity</span>
                      <span className={`badge badge-sev-${(issue.severity || 'Medium').toLowerCase()}`} style={{ marginTop: '2px', display: 'inline-block', fontSize: '0.76rem' }}>
                        {issue.severity}
                      </span>
                    </div>

                    <div>
                      <span style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 600, display: 'block' }}>Priority</span>
                      <span className={`badge badge-pri-${(issue.priority_level || issue.priority || 'P2').toLowerCase()}`} style={{ marginTop: '2px', display: 'inline-block', fontSize: '0.76rem' }}>
                        {issue.priority_display || issue.priority}
                      </span>
                    </div>

                    <div>
                      <span style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 600, display: 'block' }}>Affected Module</span>
                      <span style={{ fontSize: '0.86rem', fontWeight: 600, color: '#1E293B' }}>
                        {issue.affected_module || issue.component || 'Other'}
                      </span>
                    </div>

                    <div>
                      <span style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 600, display: 'block' }}>Environment</span>
                      <span style={{ fontSize: '0.86rem', fontWeight: 600, color: '#1E293B' }}>
                        {issue.environment || 'Development'}
                      </span>
                    </div>

                    <div>
                      <span style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 600, display: 'block' }}>Assigned Developer</span>
                      <span style={{ fontSize: '0.86rem', fontWeight: 700, color: issue.assignee_name && issue.assignee_name !== 'Unassigned' ? '#2563EB' : '#94A3B8' }}>
                        {issue.assignee_name || 'Unassigned'}
                      </span>
                    </div>

                    <div>
                      <span style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 600, display: 'block' }}>Created By</span>
                      <span style={{ fontSize: '0.86rem', fontWeight: 600, color: '#1E293B' }}>
                        {issue.reporter_name || 'System'}
                      </span>
                    </div>

                    <div>
                      <span style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 600, display: 'block' }}>Project</span>
                      <span style={{ fontSize: '0.86rem', fontWeight: 600, color: '#1E293B' }}>
                        {issue.project_name} ({issue.project_id})
                      </span>
                    </div>

                    <div>
                      <span style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 600, display: 'block' }}>Created Date</span>
                      <span style={{ fontSize: '0.82rem', color: '#475569' }}>
                        {formatDateTime(issue.created_at)}
                      </span>
                    </div>

                    <div>
                      <span style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 600, display: 'block' }}>Updated Date</span>
                      <span style={{ fontSize: '0.82rem', color: '#475569' }}>
                        {formatDateTime(issue.updated_at || issue.updated_date)}
                      </span>
                    </div>
                  </div>

                  {/* Technical & Reproduction Details */}
                  {(issue.steps_to_reproduce || issue.expected_result || issue.actual_result) && (
                    <div style={{ background: '#F8FAFC', padding: '16px', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                      <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1E293B', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Layers size={15} color="#2563EB" /> Technical & Reproduction
                      </div>

                      {issue.steps_to_reproduce && (
                        <div style={{ marginBottom: '10px' }}>
                          <span style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Steps to Reproduce</span>
                          <div style={{ background: '#FFFFFF', padding: '10px 12px', borderRadius: '6px', fontSize: '0.84rem', border: '1px solid #E2E8F0', whiteSpace: 'pre-wrap' }}>
                            {issue.steps_to_reproduce}
                          </div>
                        </div>
                      )}

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        {issue.expected_result && (
                          <div>
                            <span style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Expected Result</span>
                            <div style={{ background: '#FFFFFF', padding: '8px 10px', borderRadius: '6px', fontSize: '0.82rem', border: '1px solid #E2E8F0' }}>
                              {issue.expected_result}
                            </div>
                          </div>
                        )}
                        {issue.actual_result && (
                          <div>
                            <span style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Actual Result</span>
                            <div style={{ background: '#FFFFFF', padding: '8px 10px', borderRadius: '6px', fontSize: '0.82rem', border: '1px solid #E2E8F0' }}>
                              {issue.actual_result}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Resolution & Root Cause summary if resolved */}
                  {(issue.resolution_summary || issue.root_cause) && (
                    <div style={{ background: '#F0FDF4', padding: '14px 16px', borderRadius: '10px', border: '1px solid #BBF7D0' }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#15803D', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <ShieldCheck size={16} /> Resolution & Root Cause
                      </div>
                      {issue.resolution_summary && (
                        <div style={{ marginBottom: '6px' }}>
                          <span style={{ fontSize: '0.72rem', color: '#166534', fontWeight: 700 }}>Resolution Summary: </span>
                          <span style={{ fontSize: '0.84rem', color: '#14532D' }}>{issue.resolution_summary}</span>
                        </div>
                      )}
                      {issue.root_cause && (
                        <div>
                          <span style={{ fontSize: '0.72rem', color: '#166534', fontWeight: 700 }}>Root Cause: </span>
                          <span style={{ fontSize: '0.84rem', color: '#14532D' }}>{issue.root_cause}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Attachments Section */}
                  <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Paperclip size={16} color="#2563EB" />
                        <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1E293B' }}>
                          Attachments ({attachments.length})
                        </span>
                      </div>

                      <div>
                        <input
                          type="file"
                          ref={fileInputRef}
                          style={{ display: 'none' }}
                          onChange={handleFileUpload}
                          disabled={uploadingFile}
                        />
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => fileInputRef.current?.click()}
                          style={{ padding: '4px 10px', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          disabled={uploadingFile}
                        >
                          <Upload size={13} />
                          <span>{uploadingFile ? 'Uploading...' : 'Upload Attachment'}</span>
                        </button>
                      </div>
                    </div>

                    {uploadError && (
                      <div className="toast-notice toast-error" style={{ marginBottom: '10px', padding: '6px 10px', fontSize: '0.8rem' }}>
                        <AlertCircle size={14} />
                        <span>{uploadError}</span>
                      </div>
                    )}

                    {/* Attachments List */}
                    {attachments.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '24px 12px', background: '#F8FAFC', borderRadius: '8px', border: '1px dashed #CBD5E1', color: '#94A3B8', fontSize: '0.8rem' }}>
                        No attachments uploaded for this issue.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {attachments.map(a => {
                          const canDelete = isAuthorizedManager || String(a.user_id) === String(user?.id);
                          return (
                            <div
                              key={a.id}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '8px 12px',
                                background: '#F8FAFC',
                                borderRadius: '6px',
                                border: '1px solid #E2E8F0'
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                                <div style={{ flexShrink: 0 }}>
                                  {getFileIcon(a.filename)}
                                </div>
                                <div style={{ minWidth: 0, flex: 1 }}>
                                  <div style={{ fontWeight: 600, fontSize: '0.82rem', color: '#1E293B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={a.filename}>
                                    {a.filename}
                                  </div>
                                  <div style={{ fontSize: '0.7rem', color: '#64748B' }}>
                                    {a.file_size_formatted || formatFileSize(a.file_size)} · {formatDateTime(a.created_at)}
                                  </div>
                                </div>
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '6px' }}>
                                <button
                                  type="button"
                                  onClick={() => handleDownloadAttachment(a)}
                                  className="btn-icon"
                                  style={{ color: '#2563EB', padding: '4px' }}
                                  title="Download file"
                                >
                                  <Download size={14} />
                                </button>
                                {canDelete && (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteAttachment(a.id, a.filename)}
                                    className="btn-icon"
                                    style={{ color: '#EF4444', padding: '4px' }}
                                    title="Delete file"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ============================================================= */}
              {/* TAB: GITHUB ACTIVITY (Milestone 3)                            */}
              {/* ============================================================= */}
              {activeTab === 'github' && (
                <div style={{ paddingTop: '4px' }}>
                  <GitHubActivitySection
                    issueId={issue.id}
                    issueTitle={issue.title}
                    affectedModule={issue.affected_module}
                  />
                </div>
              )}

              {/* ============================================================= */}
              {/* TAB 2: COMMENTS TAB                                           */}
              {/* ============================================================= */}
              {activeTab === 'comments' && (
                <div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1E293B', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <MessageSquare size={16} color="#2563EB" /> Comments ({comments.length})
                  </div>

                  {/* Comments Feed */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
                    {comments.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '36px 16px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                        <MessageSquare size={28} style={{ color: '#94A3B8', marginBottom: '6px' }} />
                        <div style={{ fontWeight: 600, color: '#1E293B', fontSize: '0.88rem' }}>No comments yet</div>
                        <div style={{ fontSize: '0.78rem', color: '#64748B', marginTop: '2px' }}>
                          Add notes, status updates, or reproduction steps below.
                        </div>
                      </div>
                    ) : (
                      comments.map(c => {
                        const isAuthor = String(c.user_id) === String(user?.id);
                        const canModify = isAuthor || isAuthorizedManager;
                        const isEditing = editingCommentId === c.id;
                        const avatarBg = getAvatarColor(c.user_name);
                        const initials = getInitials(c.user_name);

                        return (
                          <div
                            key={c.id}
                            style={{
                              padding: '12px 14px',
                              background: '#FFFFFF',
                              borderRadius: '8px',
                              border: '1px solid #E2E8F0',
                              boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{
                                  width: '28px',
                                  height: '28px',
                                  borderRadius: '50%',
                                  background: avatarBg,
                                  color: '#FFFFFF',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '0.74rem',
                                  fontWeight: 700,
                                  flexShrink: 0
                                }}>
                                  {initials}
                                </div>

                                <div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ fontWeight: 700, fontSize: '0.84rem', color: '#1E293B' }}>{c.user_name}</span>
                                    {c.author_role && (
                                      <span className="badge" style={{ fontSize: '0.66rem', padding: '1px 6px', background: '#F1F5F9', color: '#475569' }}>
                                        {c.author_role}
                                      </span>
                                    )}
                                  </div>
                                  <div style={{ fontSize: '0.72rem', color: '#94A3B8' }}>
                                    {formatDateTime(c.created_at)}
                                  </div>
                                </div>
                              </div>

                              {canModify && !isEditing && (
                                <div style={{ position: 'relative' }}>
                                  <button
                                    type="button"
                                    onClick={() => setCommentMenuOpenId(commentMenuOpenId === c.id ? null : c.id)}
                                    style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: '3px' }}
                                  >
                                    <MoreVertical size={14} />
                                  </button>

                                  {commentMenuOpenId === c.id && (
                                    <div style={{
                                      position: 'absolute',
                                      right: 0,
                                      top: '100%',
                                      background: '#FFFFFF',
                                      border: '1px solid #E2E8F0',
                                      borderRadius: '6px',
                                      boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                                      zIndex: 20,
                                      minWidth: '110px',
                                      overflow: 'hidden'
                                    }}>
                                      <button
                                        type="button"
                                        onClick={() => handleEditCommentStart(c)}
                                        style={{ width: '100%', padding: '6px 10px', background: 'none', border: 'none', textAlign: 'left', fontSize: '0.76rem', color: '#1E293B', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}
                                      >
                                        <Edit size={12} /> Edit
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteComment(c.id)}
                                        style={{ width: '100%', padding: '6px 10px', background: 'none', border: 'none', textAlign: 'left', fontSize: '0.76rem', color: '#EF4444', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}
                                      >
                                        <Trash2 size={12} /> Delete
                                      </button>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>

                            {isEditing ? (
                              <div>
                                <textarea
                                  className="form-textarea"
                                  rows="2"
                                  value={editingCommentContent}
                                  onChange={(e) => setEditingCommentContent(e.target.value)}
                                  style={{ fontSize: '0.84rem' }}
                                />
                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px', marginTop: '6px' }}>
                                  <button className="btn btn-secondary" style={{ padding: '3px 8px', fontSize: '0.74rem' }} onClick={() => setEditingCommentId(null)}>
                                    Cancel
                                  </button>
                                  <button className="btn btn-primary" style={{ padding: '3px 10px', fontSize: '0.74rem' }} onClick={() => handleEditCommentSave(c.id)}>
                                    Save
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <p style={{ fontSize: '0.86rem', color: '#334155', whiteSpace: 'pre-wrap', margin: 0, lineHeight: 1.5 }}>
                                {c.content}
                              </p>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Comment Composer Box */}
                  <form onSubmit={handleCommentSubmit} style={{ background: '#F8FAFC', padding: '14px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                    <textarea
                      className="form-textarea"
                      rows="3"
                      placeholder="Write a comment..."
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      style={{ background: '#FFFFFF', fontSize: '0.86rem', marginBottom: '8px' }}
                    />

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <input
                          type="file"
                          ref={composerFileInputRef}
                          style={{ display: 'none' }}
                          onChange={handleFileUpload}
                          disabled={uploadingFile}
                        />
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => composerFileInputRef.current?.click()}
                          style={{ padding: '5px 10px', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          disabled={uploadingFile}
                          title="Attach file to issue"
                        >
                          <Paperclip size={14} />
                          <span>Attach File</span>
                        </button>
                      </div>

                      <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={commentSubmitting || !newComment.trim()}
                        style={{ padding: '6px 14px', fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                      >
                        <Send size={13} />
                        <span>{commentSubmitting ? 'Posting...' : 'Post Comment'}</span>
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* ============================================================= */}
              {/* TAB 3: ACTIVITY HISTORY TAB (Timeline + Update Status Card)   */}
              {/* ============================================================= */}
              {activeTab === 'activity' && (
                <div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1E293B', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <History size={16} color="#2563EB" /> Audit History & Events
                  </div>

                  {/* Chronological Timeline (Newest First) */}
                  {activityLoading ? (
                    <div className="loading-container" style={{ padding: '24px' }}>
                      <div className="spinner"></div>
                      <p style={{ fontSize: '0.8rem', color: '#64748B' }}>Loading activity logs...</p>
                    </div>
                  ) : activities.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '24px', color: '#94A3B8', fontSize: '0.82rem', background: '#F8FAFC', borderRadius: '8px' }}>
                      No activity recorded for this issue.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
                      {activities.map(act => (
                        <div
                          key={act.id}
                          style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '10px',
                            padding: '10px 14px',
                            background: '#F8FAFC',
                            borderRadius: '8px',
                            border: '1px solid #E2E8F0'
                          }}
                        >
                          <div style={{
                            width: '26px',
                            height: '26px',
                            borderRadius: '50%',
                            background: act.action_type === 'STATUS_CHANGE' ? '#EFF6FF' : (act.action_type === 'ATTACHMENT' ? '#ECFDF5' : (act.action_type === 'COMMENT' ? '#F5F3FF' : '#FEF3C7')),
                            color: act.action_type === 'STATUS_CHANGE' ? '#2563EB' : (act.action_type === 'ATTACHMENT' ? '#059669' : (act.action_type === 'COMMENT' ? '#7C3AED' : '#D97706')),
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            marginTop: '2px'
                          }}>
                            {act.action_type === 'STATUS_CHANGE' ? '⚡' : (act.action_type === 'ATTACHMENT' ? '📎' : (act.action_type === 'COMMENT' ? '💬' : '👤'))}
                          </div>

                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                              <span style={{ fontWeight: 700, fontSize: '0.84rem', color: '#1E293B' }}>
                                {act.description || `${act.changed_by} modified issue`}
                              </span>
                              <span style={{ fontSize: '0.72rem', color: '#94A3B8' }}>
                                {formatDateTime(act.created_at)}
                              </span>
                            </div>

                            {act.reason && (
                              <div style={{ fontSize: '0.78rem', color: '#475569', background: '#FFFFFF', padding: '4px 8px', borderRadius: '4px', border: '1px solid #E2E8F0', marginTop: '4px' }}>
                                <em>Note:</em> {act.reason}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* 5. BLUE-TINTED UPDATE STATUS CARD (at the bottom of Activity History) */}
                  <div style={{
                    background: '#EFF6FF',
                    borderRadius: '12px',
                    border: '1px solid #BFDBFE',
                    padding: '18px 20px',
                    boxShadow: '0 2px 6px rgba(37, 99, 235, 0.05)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <ArrowRightCircle size={18} color="#2563EB" />
                        <h4 style={{ fontSize: '0.94rem', fontWeight: 800, color: '#1E3A8A', margin: 0 }}>
                          Update Status
                        </h4>
                      </div>
                      <span className={`badge badge-${(issue.status || 'open').toLowerCase().replace(' ', '-')}`} style={{ fontSize: '0.76rem' }}>
                        Current: {issue.status}
                      </span>
                    </div>

                    {statusNotice && (
                      <div className="toast-notice toast-success" style={{ marginBottom: '10px', padding: '6px 10px', fontSize: '0.8rem' }}>
                        <CheckCircle2 size={14} />
                        <span>{statusNotice}</span>
                      </div>
                    )}
                    {statusError && (
                      <div className="toast-notice toast-error" style={{ marginBottom: '10px', padding: '6px 10px', fontSize: '0.8rem' }}>
                        <AlertCircle size={14} />
                        <span>{statusError}</span>
                      </div>
                    )}

                    {/* Allowed Transition Information */}
                    <div style={{ background: '#FFFFFF', padding: '8px 12px', borderRadius: '6px', border: '1px solid #DBEAFE', marginBottom: '12px', fontSize: '0.78rem', color: '#1E40AF' }}>
                      <strong>Allowed Transition: </strong>
                      {allowedNextStatuses.length > 0 ? (
                        <span>
                          {issue.status} → {allowedNextStatuses.join(', ')}
                        </span>
                      ) : (
                        <span style={{ color: '#64748B' }}>No further lifecycle transitions permitted from this stage</span>
                      )}
                    </div>

                    <form onSubmit={handleStatusTransition}>
                      <div style={{ marginBottom: '10px' }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#1E3A8A', display: 'block', marginBottom: '4px' }}>
                          Next Workflow Status *
                        </label>
                        <select
                          className="form-select"
                          value={targetStatus}
                          onChange={(e) => setTargetStatus(e.target.value)}
                          required
                          disabled={allowedNextStatuses.length === 0}
                          style={{ background: '#FFFFFF', fontSize: '0.84rem' }}
                        >
                          {allowedNextStatuses.length === 0 ? (
                            <option value="">No valid transitions available</option>
                          ) : (
                            allowedNextStatuses.map(s => (
                              <option key={s} value={s}>{s}</option>
                            ))
                          )}
                        </select>
                      </div>

                      {/* Resolution summary / root cause fields when moving to Resolved or Closed */}
                      {(targetStatus === 'Resolved' || targetStatus === 'Closed') && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '10px' }}>
                          <div>
                            <label style={{ fontSize: '0.74rem', fontWeight: 700, color: '#1E3A8A', display: 'block', marginBottom: '3px' }}>
                              Resolution Summary
                            </label>
                            <input
                              type="text"
                              className="form-input"
                              placeholder="Describe solution applied or fix verified..."
                              value={resolutionSummary}
                              onChange={(e) => setResolutionSummary(e.target.value)}
                              style={{ background: '#FFFFFF', fontSize: '0.82rem' }}
                            />
                          </div>

                          <div>
                            <label style={{ fontSize: '0.74rem', fontWeight: 700, color: '#1E3A8A', display: 'block', marginBottom: '3px' }}>
                              Root Cause Analysis
                            </label>
                            <input
                              type="text"
                              className="form-input"
                              placeholder="Technical cause of the bug..."
                              value={rootCause}
                              onChange={(e) => setRootCause(e.target.value)}
                              style={{ background: '#FFFFFF', fontSize: '0.82rem' }}
                            />
                          </div>
                        </div>
                      )}

                      <div style={{ marginBottom: '12px' }}>
                        <label style={{ fontSize: '0.74rem', fontWeight: 700, color: '#1E3A8A', display: 'block', marginBottom: '3px' }}>
                          Transition Comment / Audit Note
                        </label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="e.g. Verified by QA, ready for staging deployment..."
                          value={statusComment}
                          onChange={(e) => setStatusComment(e.target.value)}
                          style={{ background: '#FFFFFF', fontSize: '0.82rem' }}
                        />
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => {
                            setTargetStatus(allowedNextStatuses[0] || '');
                            setStatusComment('');
                            setStatusNotice('');
                            setStatusError('');
                          }}
                          style={{ padding: '5px 12px', fontSize: '0.8rem' }}
                        >
                          Cancel
                        </button>

                        <button
                          type="submit"
                          className="btn btn-primary"
                          disabled={transitionSubmitting || !targetStatus || allowedNextStatuses.length === 0}
                          style={{ padding: '6px 16px', fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                        >
                          <ArrowRightCircle size={14} />
                          <span>{transitionSubmitting ? 'Updating...' : `Update Status to ${targetStatus || 'Next'}`}</span>
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

            </div>
          </>
        )}
      </div>
    </>
  );
}
