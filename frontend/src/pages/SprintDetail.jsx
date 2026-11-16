import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Layers,
  Calendar,
  Clock,
  AlertCircle,
  Plus,
  Trash2,
  Search,
  User,
  ArrowRight,
  Edit,
  FolderGit2,
  X,
  CheckCircle2,
  Check,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  BarChart2,
  Filter,
  CheckSquare,
  RefreshCw,
  FolderPlus,
  Info
} from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import IssueDetailPanel from '../components/IssueDetailPanel';

function formatDate(isoStr) {
  if (!isoStr) return '—';
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return isoStr;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return isoStr;
  }
}

export default function SprintDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [sprint, setSprint] = useState(null);
  const [availableSprints, setAvailableSprints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Search & filter within sprint board
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState('All');
  const [priorityFilter, setPriorityFilter] = useState('All');

  // Show More / Show Less expanded states for each of the 4 sections
  const [expandedCols, setExpandedCols] = useState({
    todo: false,
    inprogress: false,
    testing: false,
    done: false
  });

  const toggleExpand = (colKey) => {
    setExpandedCols(prev => ({
      ...prev,
      [colKey]: !prev[colKey]
    }));
  };

  // Drag and drop state
  const [draggedCardId, setDraggedCardId] = useState(null);
  const [dragOverCol, setDragOverCol] = useState(null);

  // Slide-out Issue Details Panel state
  const [panelIssueId, setPanelIssueId] = useState(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  // Edit Sprint Modal state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    goal: '',
    start_date: '',
    end_date: '',
    status: 'PLANNED'
  });
  const [editSubmitting, setEditSubmitting] = useState(false);

  // View Details Modal state
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);

  // Add Backlog Issues Modal state
  const [backlogModalOpen, setBacklogModalOpen] = useState(false);
  const [backlogIssues, setBacklogIssues] = useState([]);
  const [backlogLoading, setBacklogLoading] = useState(false);
  const [backlogSearch, setBacklogSearch] = useState('');

  const normRole = (user?.role || '').toUpperCase().replace(/ /g, '_');
  const canManageSprint = normRole === 'ADMIN' || normRole === 'PROJECT_MANAGER';

  // 1. Fetch Sprint Details
  const loadSprint = async () => {
    setLoading(true);
    try {
      const data = await api.getSprint(id);
      setSprint(data);
      setEditForm({
        name: data.sprint_name || data.name || '',
        goal: data.goal || '',
        start_date: data.start_date || '',
        end_date: data.end_date || '',
        status: data.status || 'PLANNED'
      });

      // Load sibling sprints for quick switcher
      try {
        const allSprints = await api.getSprints({ project_id: data.project_id });
        setAvailableSprints(allSprints || []);
      } catch {
        // non-blocking
      }
    } catch (err) {
      setError(err.message || 'Failed to load sprint from database.');
    } finally {
      setLoading(false);
    }
  };

  // 2. Fetch Backlog Issues (Project issues not in this sprint)
  const loadBacklog = async (search = '') => {
    setBacklogLoading(true);
    try {
      const res = await api.getSprintBacklog(id, { q: search || undefined });
      setBacklogIssues(res || []);
    } catch (err) {
      console.error('Failed to load backlog issues:', err);
    } finally {
      setBacklogLoading(false);
    }
  };

  useEffect(() => {
    loadSprint();
  }, [id]);

  useEffect(() => {
    if (backlogModalOpen) {
      loadBacklog(backlogSearch);
    }
  }, [backlogModalOpen, backlogSearch]);

  // Open Slide-out panel for an issue
  const handleOpenIssue = (issueId) => {
    setPanelIssueId(issueId);
    setIsPanelOpen(true);
  };

  const handleClosePanel = () => {
    setIsPanelOpen(false);
    setPanelIssueId(null);
  };

  const handleIssueUpdated = () => {
    loadSprint();
  };

  // Status mapping and calculation
  // LEFT COLUMN:
  // 1. To Do = Open
  // 2. In Progress = In Progress
  // RIGHT COLUMN:
  // 1. Testing = Testing
  // 2. Done = Resolved or Closed
  const sprintIssues = useMemo(() => {
    return sprint?.issues || [];
  }, [sprint]);

  const todoIssues = useMemo(() => {
    return sprintIssues.filter(i => (i.status || '').toLowerCase() === 'open');
  }, [sprintIssues]);

  const inProgressIssues = useMemo(() => {
    return sprintIssues.filter(i => (i.status || '').toLowerCase() === 'in progress');
  }, [sprintIssues]);

  const testingIssues = useMemo(() => {
    return sprintIssues.filter(i => (i.status || '').toLowerCase() === 'testing');
  }, [sprintIssues]);

  const doneIssues = useMemo(() => {
    return sprintIssues.filter(i => {
      const s = (i.status || '').toLowerCase();
      return s === 'resolved' || s === 'closed';
    });
  }, [sprintIssues]);

  // Exact math:
  // Total Issues = To Do + In Progress + Testing + Done
  // Done = Resolved + Closed
  // Remaining = To Do + In Progress + Testing
  // Progress % = (Done / Total) * 100
  const totalCount = todoIssues.length + inProgressIssues.length + testingIssues.length + doneIssues.length;
  const doneCount = doneIssues.length;
  const inProgressCount = inProgressIssues.length;
  const testingCount = testingIssues.length;
  const remainingCount = todoIssues.length + inProgressIssues.length + testingIssues.length;
  const progressPercent = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  // Filtered issues for board view based on live search & filter
  const filterIssueList = (list) => {
    return list.filter(i => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesId = (i.id || '').toLowerCase().includes(q);
        const matchesTitle = (i.title || '').toLowerCase().includes(q);
        const matchesModule = (i.affected_module || '').toLowerCase().includes(q);
        const matchesAssignee = (i.assignee_name || '').toLowerCase().includes(q);
        if (!matchesId && !matchesTitle && !matchesModule && !matchesAssignee) return false;
      }
      if (severityFilter !== 'All' && i.severity !== severityFilter) return false;
      if (priorityFilter !== 'All') {
        const pri = (i.priority || i.priority_level || '').toUpperCase();
        if (!pri.includes(priorityFilter.toUpperCase())) return false;
      }
      return true;
    });
  };

  const filteredTodo = useMemo(() => filterIssueList(todoIssues), [todoIssues, searchQuery, severityFilter, priorityFilter]);
  const filteredInProgress = useMemo(() => filterIssueList(inProgressIssues), [inProgressIssues, searchQuery, severityFilter, priorityFilter]);
  const filteredTesting = useMemo(() => filterIssueList(testingIssues), [testingIssues, searchQuery, severityFilter, priorityFilter]);
  const filteredDone = useMemo(() => filterIssueList(doneIssues), [doneIssues, searchQuery, severityFilter, priorityFilter]);

  // Move issue status handler
  const handleUpdateStatus = async (issueId, targetStatus) => {
    try {
      await api.updateSprintIssueStatus(id, issueId, targetStatus);
      setNotice(`Issue ${issueId} moved to ${targetStatus}`);
      setTimeout(() => setNotice(''), 3000);
      await loadSprint();
    } catch (err) {
      setError(err.message || `Failed to move issue to ${targetStatus}`);
      setTimeout(() => setError(''), 4000);
    }
  };

  // Add issue to sprint from backlog
  const handleAddIssueToSprint = async (issueId) => {
    try {
      await api.addIssueToSprint(id, issueId);
      setNotice(`Issue ${issueId} added to sprint!`);
      setTimeout(() => setNotice(''), 3000);
      await loadSprint();
      loadBacklog(backlogSearch);
    } catch (err) {
      setError(err.message || 'Failed to add issue to sprint');
      setTimeout(() => setError(''), 4000);
    }
  };

  // Remove issue from sprint back to backlog
  const handleRemoveIssueFromSprint = async (issueId, e) => {
    if (e) e.stopPropagation();
    if (!window.confirm(`Remove issue ${issueId} from this sprint back to the project backlog?`)) return;
    try {
      await api.removeIssueFromSprint(id, issueId);
      setNotice(`Issue ${issueId} removed from sprint and moved to backlog.`);
      setTimeout(() => setNotice(''), 3000);
      await loadSprint();
      if (backlogModalOpen) loadBacklog(backlogSearch);
    } catch (err) {
      setError(err.message || 'Failed to remove issue from sprint');
      setTimeout(() => setError(''), 4000);
    }
  };

  // Edit Sprint Submit
  const handleEditSprintSubmit = async (e) => {
    e.preventDefault();
    if (editForm.start_date && editForm.end_date && editForm.end_date < editForm.start_date) {
      setError('End date cannot be earlier than start date.');
      return;
    }
    setEditSubmitting(true);
    try {
      await api.updateSprint(id, editForm);
      setNotice('Sprint updated successfully!');
      setTimeout(() => setNotice(''), 3000);
      setEditModalOpen(false);
      loadSprint();
    } catch (err) {
      setError(err.message || 'Failed to update sprint');
    } finally {
      setEditSubmitting(false);
    }
  };

  // Drag and drop handlers
  const handleDragStart = (e, issueId) => {
    setDraggedCardId(issueId);
    e.dataTransfer.setData('text/plain', issueId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, colKey) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverCol !== colKey) {
      setDragOverCol(colKey);
    }
  };

  const handleDragLeave = () => {
    setDragOverCol(null);
  };

  const handleDrop = async (e, targetStatus) => {
    e.preventDefault();
    setDragOverCol(null);
    const issueId = draggedCardId || e.dataTransfer.getData('text/plain');
    if (!issueId) return;

    let destinationStatus = 'Open';
    if (targetStatus === 'todo') destinationStatus = 'Open';
    else if (targetStatus === 'inprogress') destinationStatus = 'In Progress';
    else if (targetStatus === 'testing') destinationStatus = 'Testing';
    else if (targetStatus === 'done') destinationStatus = 'Resolved';

    await handleUpdateStatus(issueId, destinationStatus);
    setDraggedCardId(null);
  };

  if (loading) {
    return (
      <div className="loading-container" style={{ height: '70vh' }}>
        <div className="spinner"></div>
        <p>Loading sprint #{id}...</p>
      </div>
    );
  }

  if (error && !sprint) {
    return (
      <div style={{ padding: '24px', maxWidth: '960px', margin: '0 auto' }}>
        <button className="btn btn-secondary" style={{ marginBottom: '16px' }} onClick={() => navigate('/sprints')}>
          <ArrowLeft size={16} /> Back to Sprints
        </button>
        <div className="toast-notice toast-error">
          <AlertCircle size={18} />
          <span>{error || 'Sprint not found.'}</span>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '20px' }}>
      
      {/* ========================================================================= */}
      {/* TOP NAVIGATION & SPRINT QUICK SWITCHER                                    */}
      {/* ========================================================================= */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        {/* Breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.88rem', color: '#64748B' }}>
          <Link
            to="/sprints"
            style={{ color: '#2563EB', textDecoration: 'none', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
          >
            <ArrowLeft size={15} /> Sprints
          </Link>
          <span>&gt;</span>
          <span style={{ color: '#64748B' }}>{sprint.project_name}</span>
          <span>&gt;</span>
          <span style={{ fontWeight: 700, color: '#1E293B' }}>{sprint.sprint_name || sprint.name}</span>
        </div>

        {/* Sprint Switcher Dropdown */}
        {availableSprints.length > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.8rem', color: '#64748B', fontWeight: 600 }}>Switch Sprint:</span>
            <select
              value={sprint.id}
              onChange={(e) => navigate(`/sprints/${e.target.value}`)}
              style={{
                padding: '5px 10px',
                fontSize: '0.82rem',
                fontWeight: 600,
                borderRadius: '6px',
                border: '1px solid #CBD5E1',
                background: '#FFFFFF',
                color: '#1E293B',
                cursor: 'pointer'
              }}
            >
              {availableSprints.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.project_name} – {s.name || s.sprint_name} ({formatDate(s.start_date)} – {formatDate(s.end_date)}) [{s.status}]
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Notice messages */}
      {notice && (
        <div className="toast-notice toast-success" style={{ marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CheckCircle2 size={17} />
          <span>{notice}</span>
        </div>
      )}
      {error && (
        <div className="toast-notice toast-error" style={{ marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertCircle size={17} />
          <span>{error}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SPRINT DETAILS – ONE SINGLE OUTER SPRINT CONTAINER                        */}
      {/* ========================================================================= */}
      <div
        className="sprint-outer-container card"
        style={{
          background: '#FFFFFF',
          borderRadius: '12px',
          border: '1px solid #E2E8F0',
          padding: '24px 28px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.04)',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px'
        }}
      >
        
        {/* ======================================================================= */}
        {/* A. SPRINT HEADER                                                        */}
        {/* ======================================================================= */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            gap: '18px',
            paddingBottom: '18px',
            borderBottom: '1px solid #F1F5F9'
          }}
        >
          {/* Left: Icon, Sprint Name, ID, Project, Status Badge, Dates, Duration, Goal */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', flex: 1, minWidth: '320px' }}>
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '10px',
                background: '#EFF6FF',
                color: '#2563EB',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <Layers size={26} />
            </div>

            <div style={{ flex: 1 }}>
              {/* Sprint Name, ID, Project, Status Badge */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '6px' }}>
                <h1 style={{ fontSize: '1.45rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                  {sprint.sprint_name || sprint.name}
                </h1>
                <span
                  style={{
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '5px',
                    background: '#F1F5F9',
                    color: '#475569',
                    border: '1px solid #E2E8F0'
                  }}
                >
                  {sprint.id}
                </span>
                <span style={{ fontSize: '0.85rem', color: '#64748B', fontWeight: 500 }}>
                  Project: <strong style={{ color: '#1E293B' }}>{sprint.project_name}</strong>
                </span>
                <span
                  className={`badge badge-${
                    sprint.status === 'COMPLETED' ? 'resolved' : sprint.status === 'ACTIVE' ? 'progress' : 'open'
                  }`}
                  style={{ fontSize: '0.76rem', padding: '3px 10px' }}
                >
                  ● {sprint.status}
                </span>
              </div>

              {/* Start Date, End Date, Duration */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '0.84rem', color: '#64748B', flexWrap: 'wrap', marginBottom: '8px' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                  <Calendar size={14} color="#2563EB" />
                  <strong>Start:</strong> {formatDate(sprint.start_date)}
                </span>
                <span>·</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                  <Calendar size={14} color="#2563EB" />
                  <strong>End:</strong> {formatDate(sprint.end_date)}
                </span>
                <span>·</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                  <Clock size={14} color="#2563EB" />
                  <strong>Duration:</strong> {sprint.duration_label || '14 days'}
                </span>
              </div>

              {/* Sprint Goal */}
              <p style={{ fontSize: '0.88rem', color: '#475569', margin: 0, lineHeight: 1.45, maxWidth: '780px' }}>
                <strong style={{ color: '#1E293B' }}>Sprint Goal:</strong>{' '}
                {sprint.goal || 'No specific goal recorded for this sprint.'}
              </p>
            </div>
          </div>

          {/* Right: Action Buttons (Edit Sprint, View Details, Add from Backlog) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {canManageSprint && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setBacklogModalOpen(true)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '0.84rem',
                  padding: '7px 14px'
                }}
              >
                <FolderPlus size={15} />
                <span>Add from Backlog</span>
              </button>
            )}

            {canManageSprint && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setEditModalOpen(true)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '0.84rem',
                  padding: '7px 14px'
                }}
              >
                <Edit size={14} />
                <span>Edit Sprint</span>
              </button>
            )}

            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setDetailsModalOpen(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.84rem',
                padding: '7px 14px'
              }}
            >
              <Info size={14} />
              <span>View Details</span>
            </button>
          </div>
        </div>

        {/* ======================================================================= */}
        {/* B. SPRINT STATISTICS (Summary Cards + Progress Bar)                     */}
        {/* ======================================================================= */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Summary Cards in one horizontal row */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(5, 1fr)',
              gap: '12px'
            }}
          >
            {/* 1. Total Issues */}
            <div
              style={{
                padding: '12px 16px',
                background: '#F8FAFC',
                borderRadius: '8px',
                border: '1px solid #E2E8F0',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                justifyContent: 'center'
              }}
            >
              <span style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Total Issues
              </span>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0F172A', marginTop: '2px' }}>
                {totalCount}
              </div>
              <span style={{ fontSize: '0.7rem', color: '#94A3B8' }}>
                To Do + In Prog + Test + Done
              </span>
            </div>

            {/* 2. Done */}
            <div
              style={{
                padding: '12px 16px',
                background: '#F0FDF4',
                borderRadius: '8px',
                border: '1px solid #BBF7D0',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                justifyContent: 'center'
              }}
            >
              <span style={{ fontSize: '0.72rem', color: '#166534', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Done
              </span>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#15803D', marginTop: '2px' }}>
                {doneCount}
              </div>
              <span style={{ fontSize: '0.7rem', color: '#16A34A' }}>
                Resolved & Closed
              </span>
            </div>

            {/* 3. In Progress */}
            <div
              style={{
                padding: '12px 16px',
                background: '#FEFCE8',
                borderRadius: '8px',
                border: '1px solid #FEF08A',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                justifyContent: 'center'
              }}
            >
              <span style={{ fontSize: '0.72rem', color: '#854D0E', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                In Progress
              </span>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#A16207', marginTop: '2px' }}>
                {inProgressCount}
              </div>
              <span style={{ fontSize: '0.7rem', color: '#CA8A04' }}>
                Active development
              </span>
            </div>

            {/* 4. Remaining */}
            <div
              style={{
                padding: '12px 16px',
                background: '#EFF6FF',
                borderRadius: '8px',
                border: '1px solid #BFDBFE',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                justifyContent: 'center'
              }}
            >
              <span style={{ fontSize: '0.72rem', color: '#1E40AF', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Remaining
              </span>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#2563EB', marginTop: '2px' }}>
                {remainingCount}
              </div>
              <span style={{ fontSize: '0.7rem', color: '#3B82F6' }}>
                To Do + In Prog + Test
              </span>
            </div>

            {/* 5. Progress */}
            <div
              style={{
                padding: '12px 16px',
                background: '#F0FDF4',
                borderRadius: '8px',
                border: '1px solid #BBF7D0',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                justifyContent: 'center'
              }}
            >
              <span style={{ fontSize: '0.72rem', color: '#166534', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Progress
              </span>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#15803D', marginTop: '2px' }}>
                {progressPercent}%
              </div>
              <span style={{ fontSize: '0.7rem', color: '#16A34A' }}>
                {doneCount} of {totalCount} completed
              </span>
            </div>
          </div>

          {/* Clean Progress Bar */}
          <div
            style={{
              background: '#F8FAFC',
              borderRadius: '8px',
              border: '1px solid #E2E8F0',
              padding: '10px 16px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1E293B' }}>Sprint Completion</span>
                <span style={{ fontSize: '0.76rem', color: '#64748B' }}>
                  ({doneCount} of {totalCount} issues completed)
                </span>
              </div>
              <span style={{ fontSize: '0.84rem', fontWeight: 800, color: '#15803D' }}>
                {progressPercent}%
              </span>
            </div>
            <div style={{ width: '100%', height: '8px', background: '#E2E8F0', borderRadius: '4px', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${Math.min(100, progressPercent)}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, #10B981 0%, #059669 100%)',
                  borderRadius: '4px',
                  transition: 'width 0.4s ease'
                }}
              />
            </div>
          </div>
        </div>

        {/* ======================================================================= */}
        {/* BOARD CONTROLS / SEARCH WITHIN SPRINT                                   */}
        {/* ======================================================================= */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            background: '#FAF8F5',
            padding: '10px 14px',
            borderRadius: '8px',
            border: '1px solid #EAE5E0'
          }}
        >
          {/* Live Search */}
          <div style={{ position: 'relative', flex: 1, minWidth: '240px', maxWidth: '380px' }}>
            <Search size={15} style={{ position: 'absolute', left: '10px', top: '9px', color: '#94A3B8' }} />
            <input
              type="text"
              placeholder="Search issues within sprint..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="form-input"
              style={{
                paddingLeft: '32px',
                height: '34px',
                fontSize: '0.82rem',
                background: '#FFFFFF',
                borderRadius: '6px'
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={{ position: 'absolute', right: '8px', top: '8px', border: 'none', background: 'transparent', cursor: 'pointer', color: '#94A3B8' }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Quick Filters */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ fontSize: '0.78rem', color: '#64748B', fontWeight: 600 }}>Severity:</span>
              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                style={{ padding: '4px 8px', fontSize: '0.78rem', borderRadius: '5px', border: '1px solid #CBD5E1', background: '#FFFFFF' }}
              >
                <option value="All">All Severities</option>
                <option value="Critical">Critical</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ fontSize: '0.78rem', color: '#64748B', fontWeight: 600 }}>Priority:</span>
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                style={{ padding: '4px 8px', fontSize: '0.78rem', borderRadius: '5px', border: '1px solid #CBD5E1', background: '#FFFFFF' }}
              >
                <option value="All">All Priorities</option>
                <option value="P1">P1</option>
                <option value="P2">P2</option>
                <option value="P3">P3</option>
                <option value="P4">P4</option>
              </select>
            </div>

            {(searchQuery || severityFilter !== 'All' || priorityFilter !== 'All') && (
              <button
                type="button"
                className="btn btn-secondary"
                style={{ padding: '4px 8px', fontSize: '0.76rem' }}
                onClick={() => {
                  setSearchQuery('');
                  setSeverityFilter('All');
                  setPriorityFilter('All');
                }}
              >
                Reset Filters
              </button>
            )}
          </div>
        </div>

        {/* ======================================================================= */}
        {/* C. EXACTLY TWO MAIN COLUMNS SIDE BY SIDE                                */}
        {/* LEFT COLUMN: 1. To Do, 2. In Progress (stacked vertically)              */}
        {/* RIGHT COLUMN: 1. Testing, 2. Done (stacked vertically)                  */}
        {/* ======================================================================= */}
        <div
          className="sprint-board-two-columns"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: '20px',
            alignItems: 'start'
          }}
        >
          
          {/* =================================================================== */}
          {/* LEFT MAIN COLUMN: 1. To Do (top), 2. In Progress (bottom)           */}
          {/* =================================================================== */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* ----------------------------------------------------------------- */}
            {/* SECTION 1: TO DO (Light blue background: #EFF6FF)                 */}
            {/* ----------------------------------------------------------------- */}
            <div
              onDragOver={(e) => handleDragOver(e, 'todo')}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, 'todo')}
              style={{
                background: dragOverCol === 'todo' ? '#DBEAFE' : '#EFF6FF',
                borderRadius: '10px',
                border: `1px solid ${dragOverCol === 'todo' ? '#2563EB' : '#BFDBFE'}`,
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                transition: 'background-color 0.15s ease, border-color 0.15s ease'
              }}
            >
              {/* Header: Title, Count badge, Status */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '14px',
                  paddingBottom: '8px',
                  borderBottom: '1px solid #BFDBFE'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontWeight: 800, fontSize: '0.96rem', color: '#1E3A8A' }}>TO DO ({filteredTodo.length})</span>
                </div>
                <span style={{ fontSize: '0.74rem', color: '#3B82F6', fontWeight: 600 }}>Open</span>
              </div>

              {/* Issue Cards */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {filteredTodo.length === 0 ? (
                  <div
                    style={{
                      textAlign: 'center',
                      padding: '36px 16px',
                      color: '#64748B',
                      fontSize: '0.84rem',
                      fontWeight: 600,
                      border: '1px dashed #93C5FD',
                      borderRadius: '8px',
                      background: 'rgba(255, 255, 255, 0.6)'
                    }}
                  >
                    No issues in To Do
                  </div>
                ) : (
                  (expandedCols.todo ? filteredTodo : filteredTodo.slice(0, 2)).map((issue) => (
                    <IssueCard
                      key={issue.id}
                      issue={issue}
                      canManageSprint={canManageSprint}
                      onOpen={() => handleOpenIssue(issue.id)}
                      onDragStart={(e) => handleDragStart(e, issue.id)}
                      onRemove={(e) => handleRemoveIssueFromSprint(issue.id, e)}
                      actions={
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUpdateStatus(issue.id, 'In Progress');
                          }}
                          className="btn btn-secondary"
                          style={{
                            width: '100%',
                            padding: '4px 8px',
                            fontSize: '0.74rem',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '5px'
                          }}
                          title="Start work on this issue"
                        >
                          <span>Start Work</span>
                          <ArrowRight size={12} />
                        </button>
                      }
                    />
                  ))
                )}
              </div>

              {/* Show More / Show Less for To Do */}
              {filteredTodo.length > 2 && (
                <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px dashed #BFDBFE', textAlign: 'center' }}>
                  <button
                    type="button"
                    onClick={() => toggleExpand('todo')}
                    style={{
                      background: '#FFFFFF',
                      border: '1px solid #BFDBFE',
                      borderRadius: '6px',
                      padding: '4px 12px',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      color: '#1D4ED8',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px'
                    }}
                  >
                    {expandedCols.todo ? (
                      <>
                        <span>Show Less</span>
                        <ChevronUp size={14} />
                      </>
                    ) : (
                      <>
                        <span>Show More ({filteredTodo.length - 2} more)</span>
                        <ChevronDown size={14} />
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* ----------------------------------------------------------------- */}
            {/* SECTION 2: IN PROGRESS (Light yellow background: #FEF9C3)         */}
            {/* ----------------------------------------------------------------- */}
            <div
              onDragOver={(e) => handleDragOver(e, 'inprogress')}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, 'inprogress')}
              style={{
                background: dragOverCol === 'inprogress' ? '#FEF08A' : '#FEF9C3',
                borderRadius: '10px',
                border: `1px solid ${dragOverCol === 'inprogress' ? '#CA8A04' : '#FEF08A'}`,
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                transition: 'background-color 0.15s ease, border-color 0.15s ease'
              }}
            >
              {/* Header: Title, Count badge, Status */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '14px',
                  paddingBottom: '8px',
                  borderBottom: '1px solid #FEF08A'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontWeight: 800, fontSize: '0.96rem', color: '#713F12' }}>IN PROGRESS ({filteredInProgress.length})</span>
                </div>
                <span style={{ fontSize: '0.74rem', color: '#A16207', fontWeight: 600 }}>Active</span>
              </div>

              {/* Issue Cards */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {filteredInProgress.length === 0 ? (
                  <div
                    style={{
                      textAlign: 'center',
                      padding: '36px 16px',
                      color: '#854D0E',
                      fontSize: '0.84rem',
                      fontWeight: 600,
                      border: '1px dashed #FDE047',
                      borderRadius: '8px',
                      background: 'rgba(255, 255, 255, 0.6)'
                    }}
                  >
                    No issues in Progress
                  </div>
                ) : (
                  (expandedCols.inprogress ? filteredInProgress : filteredInProgress.slice(0, 2)).map((issue) => (
                    <IssueCard
                      key={issue.id}
                      issue={issue}
                      canManageSprint={canManageSprint}
                      onOpen={() => handleOpenIssue(issue.id)}
                      onDragStart={(e) => handleDragStart(e, issue.id)}
                      onRemove={(e) => handleRemoveIssueFromSprint(issue.id, e)}
                      actions={
                        <div style={{ display: 'flex', gap: '6px', width: '100%' }}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUpdateStatus(issue.id, 'Open');
                            }}
                            className="btn btn-secondary"
                            style={{
                              padding: '3px 6px',
                              fontSize: '0.72rem'
                            }}
                            title="Move back to To Do"
                          >
                            ← To Do
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUpdateStatus(issue.id, 'Testing');
                            }}
                            className="btn btn-secondary"
                            style={{
                              flex: 1,
                              padding: '3px 6px',
                              fontSize: '0.72rem',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '4px',
                              background: '#FAF5FF',
                              color: '#7E22CE',
                              borderColor: '#E9D5FF'
                            }}
                            title="Send to Testing"
                          >
                            <span>To QA</span>
                            <ArrowRight size={11} />
                          </button>
                        </div>
                      }
                    />
                  ))
                )}
              </div>

              {/* Show More / Show Less for In Progress */}
              {filteredInProgress.length > 2 && (
                <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px dashed #FEF08A', textAlign: 'center' }}>
                  <button
                    type="button"
                    onClick={() => toggleExpand('inprogress')}
                    style={{
                      background: '#FFFFFF',
                      border: '1px solid #FEF08A',
                      borderRadius: '6px',
                      padding: '4px 12px',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      color: '#854D0E',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px'
                    }}
                  >
                    {expandedCols.inprogress ? (
                      <>
                        <span>Show Less</span>
                        <ChevronUp size={14} />
                      </>
                    ) : (
                      <>
                        <span>Show More ({filteredInProgress.length - 2} more)</span>
                        <ChevronDown size={14} />
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

          </div>

          {/* =================================================================== */}
          {/* RIGHT MAIN COLUMN: 1. Testing (top), 2. Done (bottom)               */}
          {/* =================================================================== */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* ----------------------------------------------------------------- */}
            {/* SECTION 1: TESTING (Light purple background: #FAF5FF)             */}
            {/* ----------------------------------------------------------------- */}
            <div
              onDragOver={(e) => handleDragOver(e, 'testing')}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, 'testing')}
              style={{
                background: dragOverCol === 'testing' ? '#E9D5FF' : '#FAF5FF',
                borderRadius: '10px',
                border: `1px solid ${dragOverCol === 'testing' ? '#9333EA' : '#E9D5FF'}`,
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                transition: 'background-color 0.15s ease, border-color 0.15s ease'
              }}
            >
              {/* Header: Title, Count badge, Status */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '14px',
                  paddingBottom: '8px',
                  borderBottom: '1px solid #E9D5FF'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontWeight: 800, fontSize: '0.96rem', color: '#581C87' }}>TESTING ({filteredTesting.length})</span>
                </div>
                <span style={{ fontSize: '0.74rem', color: '#9333EA', fontWeight: 600 }}>QA Review</span>
              </div>

              {/* Issue Cards */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {filteredTesting.length === 0 ? (
                  <div
                    style={{
                      textAlign: 'center',
                      padding: '36px 16px',
                      color: '#7E22CE',
                      fontSize: '0.84rem',
                      fontWeight: 600,
                      border: '1px dashed #D8B4FE',
                      borderRadius: '8px',
                      background: 'rgba(255, 255, 255, 0.6)'
                    }}
                  >
                    No issues in Testing
                  </div>
                ) : (
                  (expandedCols.testing ? filteredTesting : filteredTesting.slice(0, 2)).map((issue) => (
                    <IssueCard
                      key={issue.id}
                      issue={issue}
                      canManageSprint={canManageSprint}
                      onOpen={() => handleOpenIssue(issue.id)}
                      onDragStart={(e) => handleDragStart(e, issue.id)}
                      onRemove={(e) => handleRemoveIssueFromSprint(issue.id, e)}
                      actions={
                        <div style={{ display: 'flex', gap: '6px', width: '100%' }}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUpdateStatus(issue.id, 'In Progress');
                            }}
                            className="btn btn-secondary"
                            style={{
                              padding: '3px 6px',
                              fontSize: '0.72rem'
                            }}
                            title="Reject / Fail back to In Progress"
                          >
                            ← Fail
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUpdateStatus(issue.id, 'Resolved');
                            }}
                            className="btn btn-primary"
                            style={{
                              flex: 1,
                              padding: '3px 6px',
                              fontSize: '0.72rem',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '4px',
                              background: '#10B981',
                              borderColor: '#059669'
                            }}
                            title="Pass testing and mark Resolved"
                          >
                            <Check size={12} />
                            <span>Pass (Done)</span>
                          </button>
                        </div>
                      }
                    />
                  ))
                )}
              </div>

              {/* Show More / Show Less for Testing */}
              {filteredTesting.length > 2 && (
                <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px dashed #E9D5FF', textAlign: 'center' }}>
                  <button
                    type="button"
                    onClick={() => toggleExpand('testing')}
                    style={{
                      background: '#FFFFFF',
                      border: '1px solid #E9D5FF',
                      borderRadius: '6px',
                      padding: '4px 12px',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      color: '#7E22CE',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px'
                    }}
                  >
                    {expandedCols.testing ? (
                      <>
                        <span>Show Less</span>
                        <ChevronUp size={14} />
                      </>
                    ) : (
                      <>
                        <span>Show More ({filteredTesting.length - 2} more)</span>
                        <ChevronDown size={14} />
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* ----------------------------------------------------------------- */}
            {/* SECTION 2: DONE (Light green background: #F0FDF4)                 */}
            {/* ----------------------------------------------------------------- */}
            <div
              onDragOver={(e) => handleDragOver(e, 'done')}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, 'done')}
              style={{
                background: dragOverCol === 'done' ? '#BBF7D0' : '#F0FDF4',
                borderRadius: '10px',
                border: `1px solid ${dragOverCol === 'done' ? '#16A34A' : '#BBF7D0'}`,
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                transition: 'background-color 0.15s ease, border-color 0.15s ease'
              }}
            >
              {/* Header: Title, Count badge, Status */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '14px',
                  paddingBottom: '8px',
                  borderBottom: '1px solid #BBF7D0'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontWeight: 800, fontSize: '0.96rem', color: '#14532D' }}>DONE ({filteredDone.length})</span>
                </div>
                <span style={{ fontSize: '0.74rem', color: '#16A34A', fontWeight: 600 }}>Resolved / Closed</span>
              </div>

              {/* Issue Cards */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {filteredDone.length === 0 ? (
                  <div
                    style={{
                      textAlign: 'center',
                      padding: '36px 16px',
                      color: '#15803D',
                      fontSize: '0.84rem',
                      fontWeight: 600,
                      border: '1px dashed #86EFAC',
                      borderRadius: '8px',
                      background: 'rgba(255, 255, 255, 0.6)'
                    }}
                  >
                    No completed issues
                  </div>
                ) : (
                  (expandedCols.done ? filteredDone : filteredDone.slice(0, 2)).map((issue) => (
                    <IssueCard
                      key={issue.id}
                      issue={issue}
                      canManageSprint={canManageSprint}
                      onOpen={() => handleOpenIssue(issue.id)}
                      onDragStart={(e) => handleDragStart(e, issue.id)}
                      onRemove={(e) => handleRemoveIssueFromSprint(issue.id, e)}
                      actions={
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUpdateStatus(issue.id, 'In Progress');
                          }}
                          className="btn btn-secondary"
                          style={{
                            width: '100%',
                            padding: '4px 8px',
                            fontSize: '0.72rem',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '4px'
                          }}
                          title="Reopen issue into In Progress"
                        >
                          <span>← Re-open Issue</span>
                        </button>
                      }
                    />
                  ))
                )}
              </div>

              {/* Show More / Show Less for Done */}
              {filteredDone.length > 2 && (
                <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px dashed #BBF7D0', textAlign: 'center' }}>
                  <button
                    type="button"
                    onClick={() => toggleExpand('done')}
                    style={{
                      background: '#FFFFFF',
                      border: '1px solid #BBF7D0',
                      borderRadius: '6px',
                      padding: '4px 12px',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      color: '#15803D',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px'
                    }}
                  >
                    {expandedCols.done ? (
                      <>
                        <span>Show Less</span>
                        <ChevronUp size={14} />
                      </>
                    ) : (
                      <>
                        <span>Show More ({filteredDone.length - 2} more)</span>
                        <ChevronDown size={14} />
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

          </div>

        </div>

      </div>

      {/* ========================================================================= */}
      {/* RIGHT-SIDE SLIDE-OUT ISSUE DETAILS PANEL                                  */}
      {/* ========================================================================= */}
      <IssueDetailPanel
        issueId={panelIssueId}
        isOpen={isPanelOpen}
        onClose={handleClosePanel}
        onIssueUpdated={handleIssueUpdated}
      />

      {/* ========================================================================= */}
      {/* MODAL 1: EDIT SPRINT DETAILS                                              */}
      {/* ========================================================================= */}
      {editModalOpen && (
        <div className="modal-overlay" onClick={() => setEditModalOpen(false)}>
          <div className="modal-content" style={{ maxWidth: '480px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Edit Sprint Details</h2>
              <button className="btn-icon" onClick={() => setEditModalOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleEditSprintSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Sprint Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    required
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Sprint Status</label>
                  <select
                    className="form-select"
                    value={editForm.status}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                  >
                    <option value="PLANNED">PLANNED</option>
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="COMPLETED">COMPLETED</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Sprint Goal</label>
                  <textarea
                    className="form-textarea"
                    rows="3"
                    value={editForm.goal}
                    onChange={(e) => setEditForm({ ...editForm, goal: e.target.value })}
                    placeholder="Enter main sprint objectives and milestones..."
                  />
                </div>

                <div className="form-grid-2">
                  <div className="form-group">
                    <label className="form-label">Start Date</label>
                    <input
                      type="date"
                      className="form-input"
                      value={editForm.start_date || ''}
                      onChange={(e) => setEditForm({ ...editForm, start_date: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">End Date</label>
                    <input
                      type="date"
                      className="form-input"
                      value={editForm.end_date || ''}
                      onChange={(e) => setEditForm({ ...editForm, end_date: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setEditModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={editSubmitting}>
                  {editSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: VIEW SPRINT DETAILS                                              */}
      {/* ========================================================================= */}
      {detailsModalOpen && (
        <div className="modal-overlay" onClick={() => setDetailsModalOpen(false)}>
          <div className="modal-content" style={{ maxWidth: '520px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Layers size={18} color="#2563EB" />
                <h2 className="modal-title">{sprint.sprint_name || sprint.name}</h2>
              </div>
              <button className="btn-icon" onClick={() => setDetailsModalOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ background: '#F8FAFC', padding: '10px 12px', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
                  <div style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 600 }}>SPRINT ID</div>
                  <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#1E293B', marginTop: '2px' }}>{sprint.id}</div>
                </div>
                <div style={{ background: '#F8FAFC', padding: '10px 12px', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
                  <div style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 600 }}>STATUS</div>
                  <div style={{ fontSize: '0.92rem', fontWeight: 700, color: sprint.status === 'ACTIVE' ? '#16A34A' : '#1E293B', marginTop: '2px' }}>
                    {sprint.status}
                  </div>
                </div>
                <div style={{ background: '#F8FAFC', padding: '10px 12px', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
                  <div style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 600 }}>PROJECT</div>
                  <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#1E293B', marginTop: '2px' }}>{sprint.project_name}</div>
                </div>
                <div style={{ background: '#F8FAFC', padding: '10px 12px', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
                  <div style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 600 }}>DURATION</div>
                  <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#1E293B', marginTop: '2px' }}>{sprint.duration_label || '14 days'}</div>
                </div>
              </div>

              <div style={{ background: '#F8FAFC', padding: '10px 12px', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
                <div style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 600 }}>SPRINT DATES</div>
                <div style={{ fontSize: '0.86rem', fontWeight: 600, color: '#1E293B', marginTop: '2px' }}>
                  {formatDate(sprint.start_date)} – {formatDate(sprint.end_date)}
                </div>
              </div>

              <div style={{ background: '#F8FAFC', padding: '10px 12px', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
                <div style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 600, marginBottom: '4px' }}>SPRINT GOAL</div>
                <div style={{ fontSize: '0.86rem', color: '#334155', lineHeight: 1.5 }}>
                  {sprint.goal || 'No specific goal recorded for this sprint.'}
                </div>
              </div>

              <div style={{ background: '#F8FAFC', padding: '10px 12px', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
                <div style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 600, marginBottom: '6px' }}>BREAKDOWN</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', textAlign: 'center', gap: '6px' }}>
                  <div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0F172A' }}>{totalCount}</div>
                    <div style={{ fontSize: '0.68rem', color: '#64748B' }}>Total</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#15803D' }}>{doneCount}</div>
                    <div style={{ fontSize: '0.68rem', color: '#15803D' }}>Done</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#A16207' }}>{inProgressCount}</div>
                    <div style={{ fontSize: '0.68rem', color: '#A16207' }}>In Prog</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#9333EA' }}>{testingCount}</div>
                    <div style={{ fontSize: '0.68rem', color: '#9333EA' }}>Testing</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#2563EB' }}>{remainingCount}</div>
                    <div style={{ fontSize: '0.68rem', color: '#2563EB' }}>Remaining</div>
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setDetailsModalOpen(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: ADD ISSUES FROM BACKLOG                                          */}
      {/* ========================================================================= */}
      {backlogModalOpen && (
        <div className="modal-overlay" onClick={() => setBacklogModalOpen(false)}>
          <div className="modal-content" style={{ maxWidth: '680px', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FolderPlus size={18} color="#2563EB" />
                <h2 className="modal-title">Add Issues to Sprint from Project Backlog</h2>
              </div>
              <button className="btn-icon" onClick={() => setBacklogModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '12px 20px', borderBottom: '1px solid #E2E8F0', background: '#F8FAFC' }}>
              <div style={{ position: 'relative' }}>
                <Search size={15} style={{ position: 'absolute', left: '10px', top: '9px', color: '#94A3B8' }} />
                <input
                  type="text"
                  className="form-input"
                  style={{ paddingLeft: '32px', height: '34px', fontSize: '0.82rem', background: '#FFFFFF' }}
                  placeholder="Search project backlog issues by ID, title, module..."
                  value={backlogSearch}
                  onChange={(e) => setBacklogSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="modal-body" style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {backlogLoading ? (
                <div style={{ textAlign: 'center', padding: '30px', color: '#64748B' }}>
                  <div className="spinner" style={{ margin: '0 auto 8px auto' }}></div>
                  <p style={{ margin: 0, fontSize: '0.84rem' }}>Loading project backlog...</p>
                </div>
              ) : backlogIssues.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94A3B8' }}>
                  <CheckSquare size={32} style={{ margin: '0 auto 8px auto', opacity: 0.5 }} />
                  <p style={{ margin: 0, fontSize: '0.88rem', fontWeight: 600, color: '#475569' }}>
                    No unassigned backlog issues found for {sprint.project_name}.
                  </p>
                  <p style={{ margin: '4px 0 0 0', fontSize: '0.78rem' }}>
                    All issues are currently assigned to active or planned sprints.
                  </p>
                </div>
              ) : (
                backlogIssues.map((issue) => (
                  <div
                    key={issue.id}
                    style={{
                      background: '#FFFFFF',
                      borderRadius: '8px',
                      border: '1px solid #E2E8F0',
                      padding: '12px 14px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '12px',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                        <span style={{ fontWeight: 800, fontSize: '0.84rem', color: '#2563EB' }}>{issue.id}</span>
                        <span className={`badge badge-pri-${(issue.priority_level || issue.priority || 'P2').toLowerCase()}`} style={{ fontSize: '0.66rem', padding: '1px 6px' }}>
                          {issue.priority}
                        </span>
                        <span className="badge badge-type" style={{ fontSize: '0.66rem', padding: '1px 6px' }}>
                          {issue.issue_type}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1E293B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {issue.title}
                      </div>
                      <div style={{ fontSize: '0.74rem', color: '#64748B', marginTop: '3px', display: 'flex', gap: '12px' }}>
                        <span>Module: <strong>{issue.affected_module || 'General'}</strong></span>
                        <span>Assignee: <strong>{issue.assignee_name || 'Unassigned'}</strong></span>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => handleAddIssueToSprint(issue.id)}
                      style={{ padding: '6px 12px', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}
                    >
                      <Plus size={14} />
                      <span>Add to Sprint</span>
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setBacklogModalOpen(false)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// =============================================================================
// D. COMPACT & READABLE ISSUE CARD COMPONENT                                   
// - Issue ID, Title, Priority badge, Type badge, Severity badge, Assignee, Date
// - Clicking opens right-side slide-out panel
// =============================================================================
function IssueCard({ issue, canManageSprint, onOpen, onDragStart, onRemove, actions }) {
  const priRaw = (issue.priority_level || issue.priority || 'P2').toUpperCase();
  const priClass = priRaw.includes('P1') ? 'p1' : priRaw.includes('P2') ? 'p2' : priRaw.includes('P3') ? 'p3' : 'p4';

  return (
    <div
      draggable={true}
      onDragStart={onDragStart}
      onClick={onOpen}
      style={{
        background: '#FFFFFF',
        borderRadius: '8px',
        border: '1px solid #E2E8F0',
        padding: '11px 13px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
        display: 'flex',
        flexDirection: 'column',
        gap: '7px',
        cursor: 'pointer',
        transition: 'transform 0.12s ease, box-shadow 0.12s ease, border-color 0.12s ease'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = '0 4px 10px rgba(0,0,0,0.07)';
        e.currentTarget.style.borderColor = '#93C5FD';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'none';
        e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.03)';
        e.currentTarget.style.borderColor = '#E2E8F0';
      }}
    >
      {/* Header: Issue ID & Priority badge */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span
          style={{
            fontWeight: 800,
            fontSize: '0.84rem',
            color: '#2563EB',
            letterSpacing: '0.01em'
          }}
        >
          {issue.id}
        </span>
        <span
          className={`badge badge-pri-${priClass}`}
          style={{ fontSize: '0.68rem', padding: '1px 7px', fontWeight: 700 }}
        >
          {issue.priority || 'P2'}
        </span>
      </div>

      {/* Title */}
      <div
        style={{
          fontWeight: 600,
          fontSize: '0.85rem',
          color: '#1E293B',
          lineHeight: 1.35,
          wordBreak: 'break-word'
        }}
      >
        {issue.title}
      </div>

      {/* Badges: Issue Type & Severity */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
        <span
          className="badge badge-type"
          style={{ fontSize: '0.68rem', padding: '1px 6px', fontWeight: 600 }}
        >
          {issue.issue_type || 'Bug'}
        </span>
        <span
          className={`badge badge-sev-${(issue.severity || 'Medium').toLowerCase()}`}
          style={{ fontSize: '0.68rem', padding: '1px 6px', fontWeight: 600 }}
        >
          {issue.severity || 'Medium'}
        </span>
      </div>

      {/* Assignee & Updated Date */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderTop: '1px solid #F1F5F9',
          paddingTop: '7px',
          fontSize: '0.74rem',
          color: '#64748B'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '65%' }}>
          <User size={13} color="#64748B" />
          <span style={{ fontWeight: 500, color: '#334155', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {issue.assignee_name || 'Unassigned'}
          </span>
        </div>
        <span style={{ fontSize: '0.7rem', color: '#94A3B8' }}>
          {formatDate(issue.updated_date || issue.updated_at || issue.created_date)}
        </span>
      </div>

      {/* Action Row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          borderTop: '1px solid #F8FAFC',
          paddingTop: '6px'
        }}
      >
        <div style={{ flex: 1 }}>{actions}</div>
        {canManageSprint && (
          <button
            type="button"
            onClick={onRemove}
            className="btn-icon"
            style={{ color: '#EF4444', padding: '4px', borderRadius: '4px' }}
            title="Remove from sprint to backlog"
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>
    </div>
  );
}
