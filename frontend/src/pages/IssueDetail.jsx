import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Edit,
  CheckCircle2,
  AlertCircle,
  Clock,
  ShieldCheck,
  MessageSquare,
  Send,
  Paperclip,
  Upload,
  Download,
  Trash2,
  History,
  Link2,
  ExternalLink,
  ArrowRightCircle,
  Plus,
  ChevronRight,
  UserCheck,
  FolderGit2,
  X,
  FileText,
  FileCode,
  Image as ImageIcon,
  File,
  Layers,
  HelpCircle,
  MoreVertical,
  Copy,
  RefreshCw,
  Check,
  GitBranch
} from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import GitHubActivitySection from '../components/GitHubActivitySection';

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

export default function IssueDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const fileUploadInputRef = useRef(null);
  const composerFileInputRef = useRef(null);

  const [issue, setIssue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [actionsMenuOpen, setActionsMenuOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Active tab: 'details', 'comments', 'attachments', 'activity', 'related'
  const [activeTab, setActiveTab] = useState('details');

  // Status update modal
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [targetStatus, setTargetStatus] = useState('');
  const [statusComment, setStatusComment] = useState('');
  const [resolutionSummary, setResolutionSummary] = useState('');
  const [rootCause, setRootCause] = useState('');
  const [transitionSubmitting, setTransitionSubmitting] = useState(false);

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

  // Related issues state
  const [relatedIssues, setRelatedIssues] = useState([]);
  const [relatedLoading, setRelatedLoading] = useState(false);

  const normRole = (user?.role || '').toUpperCase().replace(/ /g, '_');
  const isAuthorizedManager = normRole === 'ADMIN' || normRole === 'PROJECT_MANAGER';

  const loadIssue = async () => {
    setLoading(true);
    try {
      const data = await api.getIssue(id);
      setIssue(data);
      setComments(data.comments || []);
      setAttachments(data.attachments || []);
      if (data.status_history) {
        setActivities(data.status_history);
      }
    } catch (err) {
      setError(err.message || 'Failed to load issue');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadIssue();
  }, [id]);

  // Load tab-specific data when tab is changed
  useEffect(() => {
    if (activeTab === 'activity' && issue) {
      loadActivity();
    } else if (activeTab === 'related' && issue) {
      loadRelated();
    } else if (activeTab === 'attachments' && issue) {
      loadAttachments();
    } else if (activeTab === 'comments' && issue) {
      loadComments();
    }
  }, [activeTab, issue?.id]);

  const loadComments = async () => {
    try {
      const res = await api.getComments(id);
      setComments(res || []);
    } catch {
      // fallback to issue.comments
    }
  };

  const loadAttachments = async () => {
    try {
      const res = await api.getAttachments(id);
      setAttachments(res || []);
    } catch {
      // fallback
    }
  };

  const loadActivity = async () => {
    setActivityLoading(true);
    try {
      const res = await api.getIssueActivity(id);
      setActivities(res || []);
    } catch {
      // fallback
    } finally {
      setActivityLoading(false);
    }
  };

  const loadRelated = async () => {
    setRelatedLoading(true);
    try {
      const res = await api.getRelatedIssues(id);
      setRelatedIssues(res || []);
    } catch {
      // fallback
    } finally {
      setRelatedLoading(false);
    }
  };

  // Status transition helpers
  const currentStatusIndex = WORKFLOW_STAGES.indexOf(issue?.status || 'Open');
  const allowedNextStatuses = VALID_TRANSITIONS[issue?.status] || [];

  const handleOpenStatusModal = () => {
    const firstOption = allowedNextStatuses[0] || '';
    setTargetStatus(firstOption);
    setStatusComment('');
    setResolutionSummary(issue?.resolution_summary || '');
    setRootCause(issue?.root_cause || '');
    setStatusModalOpen(true);
  };

  const handleStatusTransition = async (e) => {
    e.preventDefault();
    if (!targetStatus) return;
    setTransitionSubmitting(true);
    try {
      await api.updateStatus(id, targetStatus, statusComment, resolutionSummary, rootCause);
      setNotice(`Issue transitioned to ${targetStatus}!`);
      setTimeout(() => setNotice(''), 3500);
      setStatusModalOpen(false);
      await loadIssue();
      await loadActivity();
    } catch (err) {
      setError(err.message || 'Failed to update status');
      setTimeout(() => setError(''), 4000);
    } finally {
      setTransitionSubmitting(false);
    }
  };

  // Comments handlers
  const handleCommentSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!newComment.trim()) return;
    setCommentSubmitting(true);
    try {
      const res = await api.addComment(id, newComment.trim());
      setNewComment('');
      setComments(prev => [...prev, res.comment]);
      setNotice('Comment posted successfully!');
      setTimeout(() => setNotice(''), 3000);
      loadActivity();
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
      const res = await api.updateComment(id, commentId, editingCommentContent.trim());
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
      await api.deleteComment(id, commentId);
      setComments(comments.filter(c => c.id !== commentId));
      setNotice('Comment deleted!');
      setTimeout(() => setNotice(''), 3000);
      loadActivity();
    } catch (err) {
      setError(err.message || 'Failed to delete comment');
      setTimeout(() => setError(''), 4000);
    }
  };

  // Attachments handlers
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

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
      const res = await api.uploadAttachment(id, file);
      setAttachments(prev => [res.attachment, ...prev]);
      setNotice(`Uploaded "${res.attachment.filename}" successfully!`);
      setTimeout(() => setNotice(''), 3000);
      loadActivity();
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
      await api.deleteAttachment(id, attachmentId);
      setAttachments(attachments.filter(a => a.id !== attachmentId));
      setNotice(`Attachment "${filename}" removed.`);
      setTimeout(() => setNotice(''), 3000);
      loadActivity();
    } catch (err) {
      setError(err.message || 'Failed to delete attachment');
      setTimeout(() => setError(''), 4000);
    }
  };

  const handleDownloadAttachment = async (attachment) => {
    try {
      await api.downloadAttachment(id, attachment.id, attachment.filename);
    } catch (err) {
      setError(err.message || 'Failed to download file');
      setTimeout(() => setError(''), 4000);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setActionsMenuOpen(false);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  if (loading) {
    return (
      <div className="loading-container" style={{ height: '70vh' }}>
        <div className="spinner"></div>
        <p>Loading issue #{id}...</p>
      </div>
    );
  }

  if (error && !issue) {
    return (
      <div style={{ padding: '24px', maxWidth: '1000px', margin: '0 auto' }}>
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
    <div className="page-container" style={{ maxWidth: '1360px', margin: '0 auto', padding: '24px 20px' }}>
      
      {/* TOP SECTION: Breadcrumb, Issue ID, Title, Priority, Actions */}
      <div style={{ marginBottom: '20px' }}>
        {/* Breadcrumb & Navigation */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.88rem', color: '#64748B' }}>
            <Link to="/issues" style={{ color: '#2563EB', textDecoration: 'none', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <ArrowLeft size={15} /> Issues
            </Link>
            <span>&gt;</span>
            <span style={{ fontWeight: 700, color: '#1E293B' }}>{issue.id}</span>
          </div>

          {/* Action Buttons: Edit Issue & Three-dot menu */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', position: 'relative' }}>
            <button
              className="btn btn-secondary"
              onClick={() => navigate(`/issues/${issue.id}/edit`)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', padding: '7px 14px' }}
            >
              <Edit size={15} />
              <span>Edit Issue</span>
            </button>

            {/* Three-dot dropdown menu */}
            <div style={{ position: 'relative' }}>
              <button
                className="btn btn-secondary"
                onClick={() => setActionsMenuOpen(!actionsMenuOpen)}
                style={{ padding: '7px 10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                title="More actions"
              >
                <MoreVertical size={16} />
              </button>

              {actionsMenuOpen && (
                <div style={{
                  position: 'absolute',
                  right: 0,
                  top: '110%',
                  background: '#FFFFFF',
                  border: '1px solid #E2E8F0',
                  borderRadius: '8px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                  zIndex: 40,
                  minWidth: '180px',
                  padding: '6px 0'
                }}>
                  <button
                    onClick={handleCopyLink}
                    style={{
                      width: '100%',
                      padding: '8px 14px',
                      background: 'none',
                      border: 'none',
                      textAlign: 'left',
                      fontSize: '0.84rem',
                      color: '#1E293B',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      cursor: 'pointer'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#F8FAFC'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                  >
                    {copiedLink ? <Check size={14} color="#10B981" /> : <Copy size={14} />}
                    <span>{copiedLink ? 'Link Copied!' : 'Copy Issue Link'}</span>
                  </button>

                  <button
                    onClick={() => {
                      setActionsMenuOpen(false);
                      loadIssue();
                      loadActivity();
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 14px',
                      background: 'none',
                      border: 'none',
                      textAlign: 'left',
                      fontSize: '0.84rem',
                      color: '#1E293B',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      cursor: 'pointer'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#F8FAFC'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                  >
                    <RefreshCw size={14} />
                    <span>Refresh Issue</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Issue ID, Title, Priority Badge, Description Header */}
        <div className="card" style={{ padding: '22px 26px', background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)', marginBottom: '22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#2563EB', letterSpacing: '-0.01em' }}>
              {issue.id}
            </span>
            <span className={`badge badge-pri-${(issue.priority_level || issue.priority || 'P2').toLowerCase()}`} style={{ fontSize: '0.82rem', padding: '4px 10px' }}>
              {issue.priority_display || issue.priority}
            </span>
            <span style={{ fontSize: '0.84rem', color: '#64748B' }}>
              Project: <strong style={{ color: '#1E293B' }}>{issue.project_name}</strong>
            </span>
            {issue.sprint_name && (
              <span style={{ fontSize: '0.84rem', color: '#64748B' }}>
                · Sprint: <strong style={{ color: '#1E293B' }}>{issue.sprint_name}</strong>
              </span>
            )}
          </div>

          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0F172A', margin: '0 0 10px 0', lineHeight: 1.35 }}>
            {issue.title}
          </h1>

          <p style={{ fontSize: '0.92rem', color: '#475569', margin: 0, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
            {issue.description || 'No description provided.'}
          </p>
        </div>
      </div>

      {/* Notices */}
      {notice && (
        <div className="toast-notice toast-success" style={{ marginBottom: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CheckCircle2 size={18} />
          <span>{notice}</span>
        </div>
      )}
      {error && (
        <div className="toast-notice toast-error" style={{ marginBottom: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* TWO-COLUMN LAYOUT: MAIN COLUMN (LEFT) + INFORMATION CARDS STACK (RIGHT) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.8fr) minmax(320px, 1fr)', gap: '24px', alignItems: 'start' }}>
        
        {/* ========================================================================= */}
        {/* LEFT SIDE (MAIN COLUMN): Info Card + 5 Main Content Tabs                  */}
        {/* ========================================================================= */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
          
          {/* 1. ISSUE INFORMATION CARD (Single card, 2 rows) */}
          <div className="card" style={{ padding: '22px 24px', background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', boxShadow: '0 2px 6px rgba(0,0,0,0.03)' }}>
            <h2 style={{ fontSize: '0.92rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 16px 0' }}>
              Issue Information
            </h2>

            {/* ROW 1: Issue Type, Severity, Priority, Status */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', paddingBottom: '16px', borderBottom: '1px solid #F1F5F9' }}>
              <div>
                <span style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 600, display: 'block', marginBottom: '6px' }}>Issue Type</span>
                <span className="badge badge-type" style={{ fontSize: '0.82rem' }}>
                  {issue.issue_type}
                </span>
              </div>

              <div>
                <span style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 600, display: 'block', marginBottom: '6px' }}>Severity</span>
                <span className={`badge badge-sev-${(issue.severity || 'Medium').toLowerCase()}`} style={{ fontSize: '0.82rem' }}>
                  {issue.severity}
                </span>
              </div>

              <div>
                <span style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 600, display: 'block', marginBottom: '6px' }}>Priority</span>
                <span className={`badge badge-pri-${(issue.priority_level || issue.priority || 'P2').toLowerCase()}`} style={{ fontSize: '0.82rem' }}>
                  {issue.priority_display || issue.priority}
                </span>
              </div>

              <div>
                <span style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 600, display: 'block', marginBottom: '6px' }}>Status</span>
                <span className={`badge badge-${(issue.status || 'open').toLowerCase().replace(' ', '-')}`} style={{ fontSize: '0.82rem' }}>
                  ● {issue.status}
                </span>
              </div>
            </div>

            {/* ROW 2: Affected Module, Environment, Created By, Assigned To */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', paddingTop: '16px' }}>
              <div>
                <span style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Affected Module</span>
                <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#1E293B' }}>
                  {issue.affected_module || issue.component || 'Other'}
                </span>
              </div>

              <div>
                <span style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Environment</span>
                <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#1E293B' }}>
                  {issue.environment || 'Development'}
                </span>
              </div>

              <div>
                <span style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Created By</span>
                <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#1E293B' }}>
                  {issue.reporter_name || 'System'}
                </span>
              </div>

              <div>
                <span style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Assigned To</span>
                <span style={{ fontSize: '0.88rem', fontWeight: 700, color: issue.assignee_name && issue.assignee_name !== 'Unassigned' ? '#2563EB' : '#94A3B8' }}>
                  {issue.assignee_name || 'Unassigned'}
                </span>
              </div>
            </div>
          </div>

          {/* 2. MAIN CONTENT TABS (5 Tabs) */}
          <div className="card" style={{ padding: '0', background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', overflow: 'hidden', boxShadow: '0 2px 6px rgba(0,0,0,0.03)' }}>
            
            {/* Tabs Header Navigation */}
            <div style={{ display: 'flex', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', overflowX: 'auto' }}>
              {[
                { id: 'details', label: 'Description', icon: FileText },
                { id: 'github', label: 'GitHub Activity', icon: GitBranch },
                { id: 'comments', label: `Comments (${comments.length})`, icon: MessageSquare },
                { id: 'attachments', label: `Attachments (${attachments.length})`, icon: Paperclip },
                { id: 'activity', label: 'Activity History', icon: History },
                { id: 'related', label: 'Related Issues', icon: Link2 }
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '14px 20px',
                      border: 'none',
                      borderBottom: isActive ? '3px solid #2563EB' : '3px solid transparent',
                      background: isActive ? '#FFFFFF' : 'transparent',
                      color: isActive ? '#2563EB' : '#64748B',
                      fontWeight: isActive ? 700 : 600,
                      fontSize: '0.9rem',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    <Icon size={16} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* TAB CONTENT PANELS */}
            <div style={{ padding: '24px' }}>

              {/* ----------------- TAB 1: DESCRIPTION / DETAILS ----------------- */}
              {(activeTab === 'details' || activeTab === 'description') && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div>
                    <h3 style={{ fontSize: '0.88rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px' }}>
                      Detailed Summary
                    </h3>
                    <p style={{ fontSize: '0.94rem', color: '#1E293B', lineHeight: 1.65, whiteSpace: 'pre-wrap', margin: 0 }}>
                      {issue.description || 'No detailed summary provided.'}
                    </p>
                  </div>

                  {/* Technical & Reproduction Details */}
                  <div style={{ background: '#F8FAFC', padding: '18px 20px', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1E293B', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Layers size={17} color="#2563EB" /> Technical & Reproduction Details
                    </h3>

                    {issue.steps_to_reproduce ? (
                      <div style={{ marginBottom: '16px' }}>
                        <span style={{ fontSize: '0.78rem', color: '#64748B', display: 'block', fontWeight: 700, marginBottom: '6px' }}>
                          Steps to Reproduce
                        </span>
                        <div style={{ background: '#FFFFFF', padding: '12px 16px', borderRadius: '8px', fontSize: '0.88rem', color: '#1E293B', border: '1px solid #E2E8F0', whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>
                          {issue.steps_to_reproduce}
                        </div>
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.84rem', color: '#94A3B8', marginBottom: '14px', fontStyle: 'italic' }}>
                        No specific reproduction steps documented.
                      </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '14px' }}>
                      <div>
                        <span style={{ fontSize: '0.78rem', color: '#64748B', display: 'block', fontWeight: 700, marginBottom: '6px' }}>
                          Expected Result
                        </span>
                        <div style={{ background: '#FFFFFF', padding: '10px 14px', borderRadius: '8px', fontSize: '0.86rem', color: '#1E293B', border: '1px solid #E2E8F0' }}>
                          {issue.expected_result || '—'}
                        </div>
                      </div>

                      <div>
                        <span style={{ fontSize: '0.78rem', color: '#64748B', display: 'block', fontWeight: 700, marginBottom: '6px' }}>
                          Actual Result
                        </span>
                        <div style={{ background: '#FFFFFF', padding: '10px 14px', borderRadius: '8px', fontSize: '0.86rem', color: '#1E293B', border: '1px solid #E2E8F0' }}>
                          {issue.actual_result || '—'}
                        </div>
                      </div>
                    </div>

                    {issue.business_impact && (
                      <div>
                        <span style={{ fontSize: '0.78rem', color: '#64748B', display: 'block', fontWeight: 700, marginBottom: '4px' }}>
                          Business Impact
                        </span>
                        <div style={{ fontSize: '0.88rem', color: '#334155' }}>
                          {issue.business_impact}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Resolution & Root Cause summary if resolved */}
                  {(issue.resolution_summary || issue.root_cause) && (
                    <div style={{ background: '#F0FDF4', padding: '18px 20px', borderRadius: '10px', border: '1px solid #BBF7D0' }}>
                      <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#15803D', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <ShieldCheck size={18} /> Resolution & Root Cause
                      </h3>
                      {issue.resolution_summary && (
                        <div style={{ marginBottom: '10px' }}>
                          <span style={{ fontSize: '0.78rem', color: '#166534', fontWeight: 700, display: 'block' }}>Resolution Summary</span>
                          <p style={{ fontSize: '0.88rem', color: '#14532D', margin: '4px 0 0 0' }}>{issue.resolution_summary}</p>
                        </div>
                      )}
                      {issue.root_cause && (
                        <div>
                          <span style={{ fontSize: '0.78rem', color: '#166534', fontWeight: 700, display: 'block' }}>Root Cause Analysis</span>
                          <p style={{ fontSize: '0.88rem', color: '#14532D', margin: '4px 0 0 0' }}>{issue.root_cause}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ----------------- TAB: GITHUB ACTIVITY (Milestone 3) ----------------- */}
              {activeTab === 'github' && (
                <GitHubActivitySection
                  issueId={issue.id}
                  issueTitle={issue.title}
                  affectedModule={issue.affected_module}
                />
              )}

              {/* ----------------- TAB 2: COMMENTS ----------------- */}
              {activeTab === 'comments' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#1E293B', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <MessageSquare size={18} color="#2563EB" /> Comments ({comments.length})
                    </h3>
                  </div>

                  {/* Comments List */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '24px' }}>
                    {comments.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '36px 16px', background: '#F8FAFC', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                        <MessageSquare size={32} style={{ color: '#94A3B8', marginBottom: '8px' }} />
                        <div style={{ fontWeight: 600, color: '#1E293B', fontSize: '0.92rem' }}>No comments yet</div>
                        <div style={{ fontSize: '0.82rem', color: '#64748B', marginTop: '2px' }}>
                          Be the first to share an update, technical note, or reproduction verification.
                        </div>
                      </div>
                    ) : (
                      comments.map((c) => {
                        const isAuthor = String(c.user_id) === String(user?.id);
                        const canModify = isAuthor || isAuthorizedManager;
                        const isEditing = editingCommentId === c.id;
                        const avatarBg = getAvatarColor(c.user_name);
                        const initials = getInitials(c.user_name);

                        return (
                          <div
                            key={c.id}
                            style={{
                              padding: '16px 18px',
                              background: '#FFFFFF',
                              borderRadius: '10px',
                              border: '1px solid #E2E8F0',
                              boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                              {/* Avatar, Author Name, Role, Date */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{
                                  width: '34px',
                                  height: '34px',
                                  borderRadius: '50%',
                                  background: avatarBg,
                                  color: '#FFFFFF',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '0.82rem',
                                  fontWeight: 700,
                                  flexShrink: 0
                                }}>
                                  {initials}
                                </div>

                                <div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ fontWeight: 700, fontSize: '0.88rem', color: '#1E293B' }}>
                                      {c.user_name}
                                    </span>
                                    {c.author_role && (
                                      <span className="badge" style={{ fontSize: '0.7rem', padding: '2px 8px', background: '#F1F5F9', color: '#475569' }}>
                                        {c.author_role}
                                      </span>
                                    )}
                                  </div>
                                  <div style={{ fontSize: '0.76rem', color: '#94A3B8' }}>
                                    {formatDateTime(c.created_at)}
                                    {c.updated_at && c.updated_at !== c.created_at && (
                                      <span style={{ fontStyle: 'italic', marginLeft: '6px' }}>(edited)</span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Three-dot menu for edit/delete */}
                              {canModify && !isEditing && (
                                <div style={{ position: 'relative' }}>
                                  <button
                                    type="button"
                                    onClick={() => setCommentMenuOpenId(commentMenuOpenId === c.id ? null : c.id)}
                                    style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: '4px' }}
                                  >
                                    <MoreVertical size={16} />
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
                                      minWidth: '120px',
                                      overflow: 'hidden'
                                    }}>
                                      <button
                                        type="button"
                                        onClick={() => handleEditCommentStart(c)}
                                        style={{ width: '100%', padding: '8px 12px', background: 'none', border: 'none', textAlign: 'left', fontSize: '0.8rem', color: '#1E293B', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                                      >
                                        <Edit size={13} /> Edit
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteComment(c.id)}
                                        style={{ width: '100%', padding: '8px 12px', background: 'none', border: 'none', textAlign: 'left', fontSize: '0.8rem', color: '#EF4444', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                                      >
                                        <Trash2 size={13} /> Delete
                                      </button>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>

                            {isEditing ? (
                              <div style={{ marginTop: '10px' }}>
                                <textarea
                                  className="form-textarea"
                                  rows="3"
                                  value={editingCommentContent}
                                  onChange={(e) => setEditingCommentContent(e.target.value)}
                                />
                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
                                  <button className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '0.8rem' }} onClick={() => setEditingCommentId(null)}>
                                    Cancel
                                  </button>
                                  <button className="btn btn-primary" style={{ padding: '4px 12px', fontSize: '0.8rem' }} onClick={() => handleEditCommentSave(c.id)}>
                                    Save Changes
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <p style={{ fontSize: '0.9rem', color: '#334155', whiteSpace: 'pre-wrap', margin: 0, lineHeight: 1.55 }}>
                                {c.content}
                              </p>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Bottom Comment Composer */}
                  <form onSubmit={handleCommentSubmit} style={{ background: '#F8FAFC', padding: '16px', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                    <div style={{ marginBottom: '10px' }}>
                      <textarea
                        className="form-textarea"
                        rows="3"
                        placeholder="Write a comment, share reproduction details or test logs..."
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        style={{ background: '#FFFFFF' }}
                      />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      {/* Attachment Icon in composer */}
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
                          style={{ padding: '6px 12px', fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                          title="Attach file to issue"
                          disabled={uploadingFile}
                        >
                          <Paperclip size={15} />
                          <span>{uploadingFile ? 'Uploading...' : 'Attach File'}</span>
                        </button>
                      </div>

                      {/* Post Comment Button */}
                      <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={commentSubmitting || !newComment.trim()}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 16px', fontSize: '0.85rem' }}
                      >
                        <Send size={14} />
                        <span>{commentSubmitting ? 'Posting...' : 'Post Comment'}</span>
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* ----------------- TAB 3: ATTACHMENTS ----------------- */}
              {activeTab === 'attachments' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                    <div>
                      <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#1E293B', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Paperclip size={18} color="#2563EB" /> All Attached Files ({attachments.length})
                      </h3>
                      <span style={{ fontSize: '0.8rem', color: '#64748B' }}>
                        Supported formats: PNG, JPG, PDF, TXT, LOG, DOC, DOCX, CSV (up to 10 MB).
                      </span>
                    </div>

                    <label className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.84rem' }}>
                      <Upload size={15} />
                      <span>{uploadingFile ? 'Uploading...' : 'Upload File'}</span>
                      <input
                        type="file"
                        onChange={handleFileUpload}
                        style={{ display: 'none' }}
                        disabled={uploadingFile}
                      />
                    </label>
                  </div>

                  {uploadError && (
                    <div className="toast-notice toast-error" style={{ marginBottom: '14px' }}>
                      <AlertCircle size={16} />
                      <span>{uploadError}</span>
                    </div>
                  )}

                  {/* Attachments List */}
                  {attachments.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '44px 16px', background: '#F8FAFC', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                      <Paperclip size={32} style={{ color: '#94A3B8', marginBottom: '8px' }} />
                      <div style={{ fontWeight: 600, color: '#1E293B', fontSize: '0.92rem' }}>No attachments yet</div>
                      <div style={{ fontSize: '0.82rem', color: '#64748B', marginTop: '2px' }}>
                        Upload screenshots, logs, or reproduction documents to this issue.
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px' }}>
                      {attachments.map((a) => {
                        const canDelete = isAuthorizedManager || String(a.user_id) === String(user?.id);
                        return (
                          <div
                            key={a.id}
                            style={{
                              padding: '14px',
                              background: '#FFFFFF',
                              borderRadius: '8px',
                              border: '1px solid #E2E8F0',
                              display: 'flex',
                              flexDirection: 'column',
                              justifyContent: 'space-between',
                              gap: '10px'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                              <div style={{
                                width: '36px',
                                height: '36px',
                                borderRadius: '6px',
                                background: '#EFF6FF',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0
                              }}>
                                {getFileIcon(a.filename)}
                              </div>
                              <div style={{ minWidth: 0, flex: 1 }}>
                                <div style={{ fontWeight: 600, fontSize: '0.86rem', color: '#1E293B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={a.filename}>
                                  {a.filename}
                                </div>
                                <div style={{ fontSize: '0.74rem', color: '#64748B', marginTop: '2px' }}>
                                  {a.file_size_formatted || formatFileSize(a.file_size)} · {formatDateTime(a.created_at)}
                                </div>
                                <div style={{ fontSize: '0.72rem', color: '#94A3B8', marginTop: '1px' }}>
                                  Uploaded by {a.user_name || 'System'}
                                </div>
                              </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px', borderTop: '1px solid #F1F5F9', paddingTop: '8px' }}>
                              <button
                                type="button"
                                onClick={() => handleDownloadAttachment(a)}
                                className="btn btn-secondary"
                                style={{ padding: '4px 8px', fontSize: '0.76rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                              >
                                <Download size={13} /> Download
                              </button>
                              {canDelete && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteAttachment(a.id, a.filename)}
                                  className="btn btn-secondary"
                                  style={{ padding: '4px 8px', fontSize: '0.76rem', color: '#EF4444', borderColor: '#FEE2E2', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                >
                                  <Trash2 size={13} />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ----------------- TAB 4: ACTIVITY HISTORY ----------------- */}
              {activeTab === 'activity' && (
                <div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#1E293B', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <History size={18} color="#2563EB" /> Complete Activity & Audit Trail
                  </h3>

                  {activityLoading ? (
                    <div className="loading-container" style={{ padding: '30px' }}>
                      <div className="spinner"></div>
                      <p>Loading activity logs...</p>
                    </div>
                  ) : activities.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '36px', color: '#64748B', background: '#F8FAFC', borderRadius: '8px' }}>
                      No activity recorded for this issue.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {activities.map((act) => (
                        <div
                          key={act.id}
                          style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '12px',
                            padding: '12px 16px',
                            background: '#F8FAFC',
                            borderRadius: '8px',
                            border: '1px solid #E2E8F0'
                          }}
                        >
                          <div style={{
                            width: '30px',
                            height: '30px',
                            borderRadius: '50%',
                            background: act.action_type === 'STATUS_CHANGE' ? '#2563EB' : (act.action_type === 'ATTACHMENT' ? '#10B981' : (act.action_type === 'COMMENT' ? '#8B5CF6' : '#F59E0B')),
                            color: '#FFFFFF',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                            fontSize: '0.75rem',
                            fontWeight: 700
                          }}>
                            {act.action_type === 'STATUS_CHANGE' ? '⚡' : (act.action_type === 'ATTACHMENT' ? '📎' : (act.action_type === 'COMMENT' ? '💬' : '👤'))}
                          </div>

                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px', flexWrap: 'wrap', gap: '6px' }}>
                              <span style={{ fontWeight: 700, fontSize: '0.86rem', color: '#1E293B' }}>
                                {act.description || `${act.changed_by} updated issue`}
                              </span>
                              <span style={{ fontSize: '0.76rem', color: '#94A3B8' }}>
                                {formatDateTime(act.created_at)}
                              </span>
                            </div>

                            {act.reason && (
                              <div style={{ fontSize: '0.82rem', color: '#475569', background: '#FFFFFF', padding: '6px 10px', borderRadius: '6px', border: '1px solid #E2E8F0', marginTop: '4px' }}>
                                <em>Note:</em> {act.reason}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ----------------- TAB 5: RELATED ISSUES ----------------- */}
              {activeTab === 'related' && (
                <div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#1E293B', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Link2 size={18} color="#2563EB" /> Related Issues in Project ({relatedIssues.length})
                  </h3>

                  {relatedLoading ? (
                    <div className="loading-container" style={{ padding: '30px' }}>
                      <div className="spinner"></div>
                      <p>Loading related issues...</p>
                    </div>
                  ) : relatedIssues.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '36px', color: '#64748B', background: '#F8FAFC', borderRadius: '8px' }}>
                      No other issues found in project {issue.project_name}.
                    </div>
                  ) : (
                    <div className="table-container">
                      <table className="table">
                        <thead>
                          <tr>
                            <th>Issue ID</th>
                            <th>Title</th>
                            <th>Type</th>
                            <th>Severity</th>
                            <th>Priority</th>
                            <th>Status</th>
                            <th>Assignee</th>
                            <th style={{ textAlign: 'right' }}>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {relatedIssues.map((rel) => (
                            <tr key={rel.id}>
                              <td style={{ fontWeight: 700, color: '#2563EB' }}>{rel.id}</td>
                              <td style={{ fontWeight: 600, maxWidth: '240px' }}>{rel.title}</td>
                              <td>
                                <span className="badge badge-type" style={{ fontSize: '0.74rem' }}>{rel.issue_type}</span>
                              </td>
                              <td>
                                <span className={`badge badge-sev-${(rel.severity || 'Medium').toLowerCase()}`}>
                                  {rel.severity}
                                </span>
                              </td>
                              <td>
                                <span className={`badge badge-pri-${(rel.priority_level || rel.priority || 'P2').toLowerCase()}`}>
                                  {rel.priority}
                                </span>
                              </td>
                              <td>
                                <span className={`badge badge-${(rel.status || 'open').toLowerCase().replace(' ', '-')}`}>
                                  {rel.status}
                                </span>
                              </td>
                              <td>{rel.assignee_name || 'Unassigned'}</td>
                              <td style={{ textAlign: 'right' }}>
                                <Link to={`/issues/${rel.id}`} className="btn btn-secondary" style={{ padding: '3px 8px', fontSize: '0.76rem' }}>
                                  View Details →
                                </Link>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* RIGHT SIDE: 3 Information Cards Stacked                                   */}
        {/* 1. Attachments Card                                                       */}
        {/* 2. Activity History Card                                                  */}
        {/* 3. Status Workflow Card                                                   */}
        {/* ========================================================================= */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* CARD 1: ATTACHMENTS CARD */}
          <div className="card" style={{ padding: '20px', background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', boxShadow: '0 2px 6px rgba(0,0,0,0.03)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Paperclip size={17} color="#2563EB" />
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1E293B', margin: 0 }}>
                  Attachments
                </h3>
                <span className="badge" style={{ fontSize: '0.72rem', padding: '2px 6px', background: '#EFF6FF', color: '#2563EB' }}>
                  {attachments.length}
                </span>
              </div>

              <div>
                <input
                  type="file"
                  ref={fileUploadInputRef}
                  style={{ display: 'none' }}
                  onChange={handleFileUpload}
                  disabled={uploadingFile}
                />
                <button
                  type="button"
                  onClick={() => fileUploadInputRef.current?.click()}
                  className="btn btn-primary"
                  style={{ padding: '5px 12px', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                  disabled={uploadingFile}
                >
                  <Upload size={13} />
                  <span>{uploadingFile ? 'Uploading...' : 'Upload'}</span>
                </button>
              </div>
            </div>

            {/* List of Attachments */}
            {attachments.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 12px', background: '#F8FAFC', borderRadius: '8px', border: '1px dashed #CBD5E1' }}>
                <Paperclip size={24} style={{ color: '#94A3B8', marginBottom: '4px' }} />
                <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#475569' }}>No attachments</div>
                <div style={{ fontSize: '0.74rem', color: '#94A3B8', marginTop: '2px' }}>
                  Click Upload to add diagnostic files or screenshots.
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '280px', overflowY: 'auto' }}>
                {attachments.map((a) => {
                  const canDelete = isAuthorizedManager || String(a.user_id) === String(user?.id);
                  return (
                    <div
                      key={a.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 10px',
                        background: '#F8FAFC',
                        borderRadius: '6px',
                        border: '1px solid #E2E8F0',
                        fontSize: '0.82rem'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                        <div style={{ flexShrink: 0 }}>
                          {getFileIcon(a.filename)}
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontWeight: 600, color: '#1E293B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={a.filename}>
                            {a.filename}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: '#64748B' }}>
                            {a.file_size_formatted || formatFileSize(a.file_size)} · {formatDateTime(a.created_at)}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '6px' }}>
                        <button
                          type="button"
                          onClick={() => handleDownloadAttachment(a)}
                          style={{ background: 'none', border: 'none', color: '#2563EB', cursor: 'pointer', padding: '4px' }}
                          title="Download file"
                        >
                          <Download size={14} />
                        </button>
                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => handleDeleteAttachment(a.id, a.filename)}
                            style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', padding: '4px' }}
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

          {/* CARD 2: ACTIVITY HISTORY CARD */}
          <div className="card" style={{ padding: '20px', background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', boxShadow: '0 2px 6px rgba(0,0,0,0.03)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <History size={17} color="#2563EB" />
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1E293B', margin: 0 }}>
                  Activity History
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('activity')}
                style={{ background: 'none', border: 'none', color: '#2563EB', fontSize: '0.78rem', cursor: 'pointer', fontWeight: 600 }}
              >
                View All
              </button>
            </div>

            {/* Vertical timeline of events */}
            {activities.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 12px', background: '#F8FAFC', borderRadius: '8px', color: '#94A3B8', fontSize: '0.8rem' }}>
                No recent activity recorded
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '300px', overflowY: 'auto', paddingRight: '4px' }}>
                {activities.slice(0, 6).map((act) => (
                  <div key={act.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <div style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      background: act.action_type === 'STATUS_CHANGE' ? '#EFF6FF' : (act.action_type === 'ATTACHMENT' ? '#ECFDF5' : (act.action_type === 'COMMENT' ? '#F5F3FF' : '#FEF3C7')),
                      color: act.action_type === 'STATUS_CHANGE' ? '#2563EB' : (act.action_type === 'ATTACHMENT' ? '#059669' : (act.action_type === 'COMMENT' ? '#7C3AED' : '#D97706')),
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      marginTop: '2px'
                    }}>
                      {act.action_type === 'STATUS_CHANGE' ? '⚡' : (act.action_type === 'ATTACHMENT' ? '📎' : (act.action_type === 'COMMENT' ? '💬' : '👤'))}
                    </div>

                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#1E293B', lineHeight: 1.35 }}>
                        {act.description || `${act.changed_by} made changes`}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#94A3B8', marginTop: '2px' }}>
                        {formatDateTime(act.created_at)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* CARD 3: STATUS WORKFLOW CARD */}
          <div className="card" style={{ padding: '20px', background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', boxShadow: '0 2px 6px rgba(0,0,0,0.03)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <ArrowRightCircle size={17} color="#2563EB" />
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1E293B', margin: 0 }}>
                  Status Workflow
                </h3>
              </div>
              <span className={`badge badge-${(issue.status || 'open').toLowerCase().replace(' ', '-')}`} style={{ fontSize: '0.78rem' }}>
                {issue.status}
              </span>
            </div>

            {/* Horizontal 5-stage progress indicator: Open -> In Progress -> Testing -> Resolved -> Closed */}
            <div style={{ marginBottom: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
                {WORKFLOW_STAGES.map((stage, idx) => {
                  const isCurrent = idx === currentStatusIndex;
                  const isPast = idx < currentStatusIndex;

                  let nodeBg = '#F1F5F9';
                  let nodeColor = '#64748B';
                  let borderStyle = '1px solid #CBD5E1';

                  if (isCurrent) {
                    nodeBg = '#2563EB'; // Vibrant Blue
                    nodeColor = '#FFFFFF';
                    borderStyle = '2px solid #1D4ED8';
                  } else if (isPast) {
                    nodeBg = '#10B981'; // Completed Green
                    nodeColor = '#FFFFFF';
                    borderStyle = '1px solid #059669';
                  }

                  return (
                    <div key={stage} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, position: 'relative' }}>
                      {/* Connecting line between nodes */}
                      {idx > 0 && (
                        <div style={{
                          position: 'absolute',
                          top: '13px',
                          left: '-50%',
                          width: '100%',
                          height: '2px',
                          background: idx <= currentStatusIndex ? '#10B981' : '#E2E8F0',
                          zIndex: 1
                        }} />
                      )}

                      {/* Circle Node */}
                      <div style={{
                        width: '26px',
                        height: '26px',
                        borderRadius: '50%',
                        background: nodeBg,
                        color: nodeColor,
                        border: borderStyle,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        zIndex: 2,
                        boxShadow: isCurrent ? '0 0 0 3px rgba(37, 99, 235, 0.25)' : 'none',
                        transition: 'all 0.2s'
                      }}>
                        {isPast ? '✓' : idx + 1}
                      </div>

                      {/* Stage Label */}
                      <span style={{
                        fontSize: '0.7rem',
                        marginTop: '6px',
                        fontWeight: isCurrent ? 700 : 500,
                        color: isCurrent ? '#2563EB' : (isPast ? '#10B981' : '#94A3B8'),
                        textAlign: 'center',
                        whiteSpace: 'nowrap'
                      }}>
                        {stage}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Update Status Button */}
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleOpenStatusModal}
              disabled={allowedNextStatuses.length === 0}
              style={{
                width: '100%',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '9px 16px',
                fontSize: '0.88rem',
                fontWeight: 600,
                background: allowedNextStatuses.length > 0 ? '#2563EB' : '#94A3B8',
                borderColor: allowedNextStatuses.length > 0 ? '#1D4ED8' : '#94A3B8'
              }}
              title={allowedNextStatuses.length === 0 ? "Terminal stage or no valid transitions available" : "Transition to next lifecycle stage"}
            >
              <ArrowRightCircle size={16} />
              <span>Update Status</span>
            </button>
          </div>

        </div>
      </div>

      {/* UPDATE STATUS WORKFLOW MODAL */}
      {statusModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <h2 className="modal-title">Transition Workflow Status</h2>
              <button className="btn-icon" onClick={() => setStatusModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleStatusTransition}>
              <div className="modal-body">
                <div style={{ background: '#F8FAFC', padding: '12px 16px', borderRadius: '8px', border: '1px solid #E2E8F0', marginBottom: '16px' }}>
                  <div style={{ fontSize: '0.76rem', color: '#64748B', fontWeight: 600 }}>Current Status</div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#2563EB', marginTop: '2px' }}>
                    {issue.status}
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Next Workflow Stage <span style={{ color: '#EF4444' }}>*</span>
                  </label>
                  <select
                    className="form-select"
                    required
                    value={targetStatus}
                    onChange={(e) => setTargetStatus(e.target.value)}
                  >
                    {allowedNextStatuses.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  <span style={{ fontSize: '0.74rem', color: '#64748B', marginTop: '4px', display: 'block' }}>
                    Transitions strictly enforce BugFlow lifecycle rules for role <strong>{user?.role}</strong>.
                  </span>
                </div>

                {(targetStatus === 'Resolved' || targetStatus === 'Closed') && (
                  <>
                    <div className="form-group">
                      <label className="form-label">Resolution Summary</label>
                      <textarea
                        className="form-textarea"
                        rows="2"
                        placeholder="Describe the solution applied, patch details, or commit references..."
                        value={resolutionSummary}
                        onChange={(e) => setResolutionSummary(e.target.value)}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Root Cause Analysis</label>
                      <textarea
                        className="form-textarea"
                        rows="2"
                        placeholder="Technical explanation of the defect origin..."
                        value={rootCause}
                        onChange={(e) => setRootCause(e.target.value)}
                      />
                    </div>
                  </>
                )}

                <div className="form-group">
                  <label className="form-label">Transition Comment / Audit Reason</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Verified on staging environment, test pass complete."
                    value={statusComment}
                    onChange={(e) => setStatusComment(e.target.value)}
                  />
                  <span style={{ fontSize: '0.74rem', color: '#64748B', marginTop: '4px', display: 'block' }}>
                    Recorded in activity audit log
                  </span>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setStatusModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={transitionSubmitting || !targetStatus}>
                  {transitionSubmitting ? 'Updating...' : `Confirm Transition to ${targetStatus}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
