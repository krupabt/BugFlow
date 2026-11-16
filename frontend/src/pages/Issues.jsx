import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, useParams } from 'react-router-dom';
import {
  Plus,
  Search,
  Filter,
  Kanban,
  Table as TableIcon,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  Edit,
  Trash2,
  UserCheck,
  ArrowRightCircle,
  ExternalLink,
  CheckCircle,
  AlertTriangle,
  Clock,
  Bug,
  X
} from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import IssueDetailPanel from '../components/IssueDetailPanel';

const WORKFLOW_STAGES = ["Open", "In Progress", "Testing", "Resolved", "Closed"];
const PRIORITIES = [
  { value: "P1", label: "P1 – Urgent" },
  { value: "P2", label: "P2 – High" },
  { value: "P3", label: "P3 – Medium" },
  { value: "P4", label: "P4 – Low" }
];
const SEVERITIES = ["Critical", "High", "Medium", "Low"];
const ISSUE_TYPES = ["Bug", "Feature Request", "Enhancement", "Technical Debt"];
const AFFECTED_MODULES = [
  "Login",
  "Dashboard",
  "Registration",
  "User Management",
  "Projects",
  "Payment",
  "Reports",
  "Sprint Management",
  "Issue Management",
  "Other"
];

export default function Issues() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { id: routeIssueId } = useParams();

  // Slide-out panel state
  const [panelIssueId, setPanelIssueId] = useState(routeIssueId || null);
  const [isPanelOpen, setIsPanelOpen] = useState(!!routeIssueId);

  useEffect(() => {
    if (routeIssueId) {
      setPanelIssueId(routeIssueId);
      setIsPanelOpen(true);
    }
  }, [routeIssueId]);

  const handleOpenIssuePanel = (issueId) => {
    setPanelIssueId(issueId);
    setIsPanelOpen(true);
    window.history.pushState(null, '', `/issues/${issueId}`);
  };

  const handleCloseIssuePanel = () => {
    setIsPanelOpen(false);
    window.history.pushState(null, '', '/issues');
  };

  const handleIssueUpdatedFromPanel = (updatedIssue) => {
    setIssues(prev => prev.map(item => item.id === updatedIssue.id ? { ...item, ...updatedIssue } : item));
  };

  const normRole = (user?.role || '').toUpperCase().replace(/ /g, '_');
  const isAdmin = normRole === 'ADMIN' || normRole === 'ADMINISTRATOR';
  const isPM = normRole === 'PROJECT_MANAGER';
  const isDev = normRole === 'DEVELOPER';
  const isTester = normRole === 'TESTER';
  const canManageIssue = isAdmin || isPM;

  const [testerView, setTesterView] = useState('all'); // 'all' | 'reported' | 'tests'
  const [testerReportedCount, setTesterReportedCount] = useState(0);
  const [testerTestsCount, setTesterTestsCount] = useState(0);

  const [issues, setIssues] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'kanban'
  const [summaryStats, setSummaryStats] = useState({
    total: 0,
    open: 0,
    in_progress: 0,
    resolved: 0,
    closed: 0,
    testing: 0
  });

  // Lookups
  const [projects, setProjects] = useState([]);
  const [developers, setDevelopers] = useState([]);
  const [sprints, setSprints] = useState([]);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedProject, setSelectedProject] = useState(searchParams.get('project_id') || '');
  const [selectedStatus, setSelectedStatus] = useState(searchParams.get('status') || '');
  const [selectedPriority, setSelectedPriority] = useState('');
  const [selectedSeverity, setSelectedSeverity] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [selectedModule, setSelectedModule] = useState('');
  const [sortBy, setSortBy] = useState('id');
  const [sortDir, setSortDir] = useState('asc');

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(searchParams.get('action') === 'create');
  const [editModalIssue, setEditModalIssue] = useState(null);
  const [assignModalIssue, setAssignModalIssue] = useState(null);
  const [statusModalIssue, setStatusModalIssue] = useState(null);
  const [deleteModalIssue, setDeleteModalIssue] = useState(null);

  // Notifications
  const [notice, setNotice] = useState({ type: '', text: '' });

  // Form states
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    project_id: '',
    issue_type: 'Bug',
    affected_module: 'Login',
    custom_module: '',
    severity: 'Medium',
    priority: 'P2',
    assigned_to: '',
    component: '',
    environment: 'Development',
    steps_to_reproduce: '',
    expected_result: '',
    actual_result: '',
    business_impact: 'Medium',
    sprint_id: ''
  });

  const [newStatus, setNewStatus] = useState('Open');
  const [statusComment, setStatusComment] = useState('');
  const [resolutionSummary, setResolutionSummary] = useState('');
  const [selectedAssignee, setSelectedAssignee] = useState('');

  // Initial lookup loading
  useEffect(() => {
    async function fetchLookups() {
      try {
        const [projRes, devRes, spRes] = await Promise.all([
          api.getProjects({ include_stats: false }),
          api.getUsers({ active: 'true' }),
          api.getSprints()
        ]);
        setProjects(projRes);
        setDevelopers(devRes);
        setSprints(spRes);
      } catch (err) {
        console.error('Lookup load error:', err);
      }
    }
    fetchLookups();
  }, []);

  // Fetch issues
  const loadIssues = async () => {
    setLoading(true);
    try {
      const params = {
        page: viewMode === 'kanban' ? 1 : page,
        per_page: viewMode === 'kanban' ? 100 : 15,
        sort_by: sortBy,
        sort_dir: sortDir,
        q: search || undefined,
        project_id: selectedProject || undefined,
        status: selectedStatus || undefined,
        priority: selectedPriority || undefined,
        severity: selectedSeverity || undefined,
        issue_type: selectedType || undefined,
        affected_module: selectedModule || undefined,
      };

      // Check URL query parameters for shortcuts
      if (searchParams.get('assigned_to') === 'my' && user?.id) {
        params.assigned_to = user.id;
      }
      if (searchParams.get('reporter') === 'my' && user?.id) {
        params.reporter_id = user.id;
      }

      if (isTester && testerView && testerView !== 'all') {
        params.tester_view = testerView;
      }

      const res = await api.getIssues(params);
      setIssues(res.issues || []);
      setTotal(res.total || 0);
      setTotalPages(res.pages || 1);
      if (res.summary) {
        setSummaryStats(res.summary);
      }
      if (res.reported_count !== undefined) {
        setTesterReportedCount(res.reported_count);
      }
      if (res.tests_count !== undefined) {
        setTesterTestsCount(res.tests_count);
      }
    } catch (err) {
      setNotice({ type: 'error', text: err.message || 'Failed to load issues' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadIssues();
  }, [page, sortBy, sortDir, selectedProject, selectedStatus, selectedPriority, selectedSeverity, selectedType, selectedModule, viewMode, testerView]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    loadIssues();
  };

  // Create issue handler
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    try {
      const moduleToSave = formData.affected_module === 'Other'
        ? (formData.custom_module?.trim() || 'Other')
        : (formData.affected_module || 'Other');
      const payload = {
        ...formData,
        affected_module: moduleToSave,
        component: formData.component?.trim() || moduleToSave
      };
      const created = await api.createIssue(payload);
      setNotice({ type: 'success', text: `Issue ${created.issue?.id} created successfully!` });
      setCreateModalOpen(false);
      setFormData({
        title: '',
        description: '',
        project_id: projects[0]?.id || '',
        issue_type: 'Bug',
        affected_module: 'Login',
        custom_module: '',
        severity: 'Medium',
        priority: 'P2',
        assigned_to: '',
        component: '',
        environment: 'Development',
        steps_to_reproduce: '',
        expected_result: '',
        actual_result: '',
        business_impact: 'Medium',
        sprint_id: ''
      });
      loadIssues();
    } catch (err) {
      setNotice({ type: 'error', text: err.message || 'Failed to create issue' });
    }
  };

  // Edit issue handler
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editModalIssue) return;
    try {
      const moduleToSave = editModalIssue.affected_module === 'Other'
        ? (editModalIssue.custom_module?.trim() || 'Other')
        : (editModalIssue.affected_module || 'Other');
      const payload = {
        ...editModalIssue,
        affected_module: moduleToSave
      };
      await api.updateIssue(editModalIssue.id, payload);
      setNotice({ type: 'success', text: `Issue ${editModalIssue.id} updated successfully!` });
      setEditModalIssue(null);
      loadIssues();
    } catch (err) {
      setNotice({ type: 'error', text: err.message || 'Failed to update issue' });
    }
  };

  // Assign issue handler
  const handleAssignSubmit = async (e) => {
    e.preventDefault();
    if (!assignModalIssue) return;
    try {
      await api.assignIssue(assignModalIssue.id, selectedAssignee);
      setNotice({ type: 'success', text: `Issue ${assignModalIssue.id} reassigned successfully!` });
      setAssignModalIssue(null);
      loadIssues();
    } catch (err) {
      setNotice({ type: 'error', text: err.message || 'Failed to assign issue' });
    }
  };

  // Status transition handler
  const handleStatusSubmit = async (e) => {
    e.preventDefault();
    if (!statusModalIssue) return;
    try {
      await api.updateStatus(statusModalIssue.id, newStatus, statusComment, resolutionSummary);
      setNotice({ type: 'success', text: `Issue ${statusModalIssue.id} transitioned to ${newStatus}!` });
      setStatusModalIssue(null);
      setStatusComment('');
      setResolutionSummary('');
      loadIssues();
    } catch (err) {
      setNotice({ type: 'error', text: err.message || 'Status transition failed' });
    }
  };

  // Delete issue handler
  const handleDeleteConfirm = async () => {
    if (!deleteModalIssue) return;
    try {
      await api.deleteIssue(deleteModalIssue.id);
      setNotice({ type: 'success', text: `Issue ${deleteModalIssue.id} deleted permanently.` });
      setDeleteModalIssue(null);
      loadIssues();
    } catch (err) {
      setNotice({ type: 'error', text: err.message || 'Failed to delete issue' });
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            {isDev ? 'My Assigned Issues' : isTester ? 'Tester Workspace' : isPM ? 'Project Issues' : 'Issue Management'}
          </h1>
          <p className="page-subtitle">
            {isDev
              ? `Displaying ${total} issues assigned directly to you across your active projects`
              : isTester
              ? `Displaying ${total} issues (${testerReportedCount} reported, ${testerTestsCount} ready for testing)`
              : isPM
              ? `Displaying ${total} issues across your managed projects`
              : `Showing ${total} issues in real-time`}
          </p>
        </div>
        <div className="header-actions">
          {/* Toggle Table / Kanban Board */}
          <div style={{ display: 'flex', border: '1px solid #EAE5E0', borderRadius: '8px', overflow: 'hidden', background: '#FFFFFF' }}>
            <button
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 12px',
                border: 'none',
                background: viewMode === 'table' ? '#E97862' : '#FFFFFF',
                color: viewMode === 'table' ? '#FFFFFF' : '#817B86',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.82rem'
              }}
              onClick={() => setViewMode('table')}
            >
              <TableIcon size={15} />
              <span>Table</span>
            </button>
            <button
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 12px',
                border: 'none',
                background: viewMode === 'kanban' ? '#E97862' : '#FFFFFF',
                color: viewMode === 'kanban' ? '#FFFFFF' : '#817B86',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.82rem'
              }}
              onClick={() => setViewMode('kanban')}
            >
              <Kanban size={15} />
              <span>Workflow Board</span>
            </button>
          </div>

          <button className="btn btn-primary" onClick={() => navigate('/issues/create')}>
            <Plus size={16} />
            <span>Create Issue</span>
          </button>
        </div>
      </div>

      {/* Notice alert */}
      {notice.text && (
        <div className={`toast-notice ${notice.type === 'error' ? 'toast-error' : 'toast-success'}`}>
          {notice.type === 'error' ? <AlertTriangle size={18} /> : <CheckCircle size={18} />}
          <span>{notice.text}</span>
          <button style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer' }} onClick={() => setNotice({ type: '', text: '' })}>
            <X size={16} />
          </button>
        </div>
      )}

      {/* PART 1.A: Issue Dashboard Summary Cards (Calculated from PostgreSQL) */}
      <div className="stat-grid" style={{ marginBottom: '20px', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        <div 
          className="stat-card" 
          onClick={() => { setSelectedStatus(''); setPage(1); }}
          style={{ cursor: 'pointer', border: selectedStatus === '' ? '2px solid #2563EB' : '1px solid #EAE5E0' }}
          title="Click to view all issues"
        >
          <div className="stat-header">
            <span className="stat-title">Total Issues</span>
            <div className="stat-icon primary"><Bug size={18} /></div>
          </div>
          <div className="stat-value">{summaryStats.total}</div>
          <div className="stat-trend"><span style={{ color: '#2563EB', fontWeight: 600 }}>All Tracked Issues</span></div>
        </div>

        <div 
          className="stat-card" 
          onClick={() => { setSelectedStatus('Open'); setPage(1); }}
          style={{ cursor: 'pointer', border: selectedStatus === 'Open' ? '2px solid #E97862' : '1px solid #EAE5E0' }}
          title="Click to filter by Open status"
        >
          <div className="stat-header">
            <span className="stat-title">Open Issues</span>
            <div className="stat-icon" style={{ background: '#FDF2F0', color: '#E97862' }}><AlertTriangle size={18} /></div>
          </div>
          <div className="stat-value">{summaryStats.open}</div>
          <div className="stat-trend"><span style={{ color: '#E97862', fontWeight: 600 }}>Awaiting Work / Triage</span></div>
        </div>

        <div 
          className="stat-card" 
          onClick={() => { setSelectedStatus('In Progress'); setPage(1); }}
          style={{ cursor: 'pointer', border: selectedStatus === 'In Progress' ? '2px solid #D97706' : '1px solid #EAE5E0' }}
          title="Click to filter by In Progress status"
        >
          <div className="stat-header">
            <span className="stat-title">In Progress Issues</span>
            <div className="stat-icon" style={{ background: '#FEF3C7', color: '#D97706' }}><Clock size={18} /></div>
          </div>
          <div className="stat-value">{summaryStats.in_progress}</div>
          <div className="stat-trend"><span style={{ color: '#D97706', fontWeight: 600 }}>Active Development</span></div>
        </div>

        <div 
          className="stat-card" 
          onClick={() => { setSelectedStatus('Resolved'); setPage(1); }}
          style={{ cursor: 'pointer', border: selectedStatus === 'Resolved' || selectedStatus === 'Closed' ? '2px solid #16A34A' : '1px solid #EAE5E0' }}
          title="Click to filter by Resolved status"
        >
          <div className="stat-header">
            <span className="stat-title">Resolved Issues</span>
            <div className="stat-icon" style={{ background: '#DCFCE7', color: '#16A34A' }}><CheckCircle size={18} /></div>
          </div>
          <div className="stat-value">{summaryStats.resolved + (summaryStats.closed || 0)}</div>
          <div className="stat-trend"><span style={{ color: '#16A34A', fontWeight: 600 }}>{summaryStats.resolved} Resolved • {summaryStats.closed || 0} Closed</span></div>
        </div>
      </div>

      {/* Tester Tabs: My Reported Issues vs My Tests */}
      {isTester && (
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          <button
            type="button"
            className={`btn ${testerView === 'all' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '6px 14px', fontSize: '0.82rem', fontWeight: 600 }}
            onClick={() => { setTesterView('all'); setPage(1); }}
          >
            All Scoped Issues ({total})
          </button>
          <button
            type="button"
            className={`btn ${testerView === 'reported' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '6px 14px', fontSize: '0.82rem', fontWeight: 600 }}
            onClick={() => { setTesterView('reported'); setPage(1); }}
          >
            My Reported Issues ({testerReportedCount})
          </button>
          <button
            type="button"
            className={`btn ${testerView === 'tests' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '6px 14px', fontSize: '0.82rem', fontWeight: 600 }}
            onClick={() => { setTesterView('tests'); setPage(1); }}
          >
            My Tests (Ready for Verification) ({testerTestsCount})
          </button>
        </div>
      )}

      {/* Issue Status Filter Tabs: All, Open, In Progress, Testing */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', borderBottom: '1px solid #E2E8F0', paddingBottom: '12px', flexWrap: 'wrap' }}>
        {[
          { key: '', label: 'All' },
          { key: 'Open', label: 'Open' },
          { key: 'In Progress', label: 'In Progress' },
          { key: 'Testing', label: 'Testing' }
        ].map(tab => {
          const isActive = selectedStatus === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => { setSelectedStatus(tab.key); setPage(1); }}
              style={{
                padding: '7px 20px',
                borderRadius: '8px',
                border: isActive ? '1px solid #2563EB' : '1px solid #E2E8F0',
                background: isActive ? '#EFF6FF' : '#FFFFFF',
                color: isActive ? '#2563EB' : '#64748B',
                fontWeight: isActive ? 700 : 600,
                fontSize: '0.86rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Filters Bar */}
      <div className="filter-bar">
        {/* Search Input */}
        <form onSubmit={handleSearchSubmit} className="search-input-wrapper">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Search by ID, title, component, or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </form>

        {/* Project Filter */}
        <select
          className="form-select"
          style={{ width: 'auto', minWidth: '150px' }}
          value={selectedProject}
          onChange={(e) => { setSelectedProject(e.target.value); setPage(1); }}
        >
          <option value="">All Projects</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>

        {/* Status Filter */}
        <select
          className="form-select"
          style={{ width: 'auto', minWidth: '130px' }}
          value={selectedStatus}
          onChange={(e) => { setSelectedStatus(e.target.value); setPage(1); }}
        >
          <option value="">All Statuses</option>
          {WORKFLOW_STAGES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        {/* Priority Filter */}
        <select
          className="form-select"
          style={{ width: 'auto', minWidth: '120px' }}
          value={selectedPriority}
          onChange={(e) => { setSelectedPriority(e.target.value); setPage(1); }}
        >
          <option value="">All Priorities</option>
          {PRIORITIES.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>

        {/* Severity Filter */}
        <select
          className="form-select"
          style={{ width: 'auto', minWidth: '120px' }}
          value={selectedSeverity}
          onChange={(e) => { setSelectedSeverity(e.target.value); setPage(1); }}
        >
          <option value="">All Severities</option>
          {SEVERITIES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        {/* Issue Type Filter */}
        <select
          className="form-select"
          style={{ width: 'auto', minWidth: '130px' }}
          value={selectedType}
          onChange={(e) => { setSelectedType(e.target.value); setPage(1); }}
        >
          <option value="">All Types</option>
          {ISSUE_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>

        {/* Affected Module Filter */}
        <select
          className="form-select"
          style={{ width: 'auto', minWidth: '150px' }}
          value={selectedModule}
          onChange={(e) => { setSelectedModule(e.target.value); setPage(1); }}
        >
          <option value="">All Modules</option>
          {AFFECTED_MODULES.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>

        {/* Sort Dropdown */}
        <select
          className="form-select"
          style={{ width: 'auto', minWidth: '170px' }}
          value={`${sortBy}:${sortDir}`}
          onChange={(e) => {
            const [field, dir] = e.target.value.split(':');
            setSortBy(field);
            setSortDir(dir);
            setPage(1);
          }}
        >
          <option value="id:asc">Issue ID Ascending</option>
          <option value="id:desc">Issue ID Descending</option>
          <option value="created_at:desc">Newest First</option>
          <option value="created_at:asc">Oldest First</option>
          <option value="priority:asc">Priority</option>
        </select>

        {/* Reset */}
        {(selectedProject || selectedStatus || selectedPriority || selectedSeverity || selectedType || selectedModule || search) && (
          <button
            className="btn btn-secondary"
            style={{ padding: '6px 12px', fontSize: '0.8rem' }}
            onClick={() => {
              setSelectedProject('');
              setSelectedStatus('');
              setSelectedPriority('');
              setSelectedSeverity('');
              setSelectedType('');
              setSelectedModule('');
              setSearch('');
              setPage(1);
            }}
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Main Content: Table or Kanban */}
      {loading ? (
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading issues from database...</p>
        </div>
      ) : viewMode === 'table' ? (
        <>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ cursor: 'pointer', width: '110px' }} onClick={() => { setSortBy('id'); setSortDir(sortDir === 'asc' ? 'desc' : 'asc'); }}>
                    Issue ID {sortBy === 'id' && (sortDir === 'asc' ? '↑' : '↓')}
                  </th>
                  <th>Title</th>
                  <th>Issue Type</th>
                  <th>Severity</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Assigned Developer</th>
                  <th>Created Date</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {issues.length === 0 ? (
                  <tr>
                    <td colSpan="9" style={{ textAlign: 'center', padding: '40px', color: '#817B86' }}>
                      No issues matched your filter criteria.
                    </td>
                  </tr>
                ) : (
                  issues.map((i) => (
                    <tr
                      key={i.id}
                      onClick={() => handleOpenIssuePanel(i.id)}
                      style={{
                        cursor: 'pointer',
                        background: panelIssueId === i.id && isPanelOpen ? '#EFF6FF' : undefined,
                        transition: 'background 0.15s ease'
                      }}
                    >
                      <td style={{ fontWeight: 700, color: '#2563EB', whiteSpace: 'nowrap' }}>
                        <a
                          href={`/issues/${i.id}`}
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleOpenIssuePanel(i.id); }}
                          style={{ color: '#2563EB', textDecoration: 'none' }}
                        >
                          {i.id}
                        </a>
                      </td>
                      <td style={{ fontWeight: 600, maxWidth: '280px' }}>
                        <div
                          style={{ cursor: 'pointer', color: '#1E293B' }}
                          onClick={(e) => { e.stopPropagation(); handleOpenIssuePanel(i.id); }}
                          title={i.description}
                        >
                          {i.title}
                        </div>
                        <div style={{ fontSize: '0.74rem', color: '#817B86', marginTop: '2px', display: 'flex', gap: '6px', alignItems: 'center' }}>
                          <span>{i.project_name}</span>
                          {i.affected_module && <span>• {i.affected_module}</span>}
                        </div>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.8rem', color: '#6A6470', fontWeight: 500 }}>{i.issue_type}</span>
                      </td>
                      <td>
                        <span className={`badge badge-sev-${(i.severity || 'Medium').toLowerCase()}`}>
                          {i.severity}
                        </span>
                      </td>
                      <td>
                        <span className={`badge badge-pri-${(i.priority || 'P2').toLowerCase()}`}>
                          {i.priority}
                        </span>
                      </td>
                      <td>
                        <span className={`badge badge-${(i.status || 'Open').toLowerCase().replace(' ', '-')}`}>
                          {i.status}
                        </span>
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {i.assignee_name !== 'Unassigned' ? (
                          <span style={{ fontWeight: 500 }}>{i.assignee_name}</span>
                        ) : (
                          <span style={{ color: '#A8A3AF', fontStyle: 'italic' }}>Unassigned</span>
                        )}
                      </td>
                      <td style={{ color: '#817B86', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                        {i.created_date || (i.created_at ? i.created_at.substring(0, 10) : '—')}
                      </td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'inline-flex', gap: '4px' }}>
                          {/* View Details */}
                          <button
                            className="btn-icon"
                            title="View Details in Slide-Out Panel"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenIssuePanel(i.id);
                            }}
                          >
                            <ExternalLink size={15} />
                          </button>

                          {/* Update Status */}
                          <button
                            className="btn-icon"
                            title="Update Status"
                            onClick={(e) => {
                              e.stopPropagation();
                              setStatusModalIssue(i);
                              setNewStatus(i.status);
                            }}
                          >
                            <ArrowRightCircle size={15} />
                          </button>

                          {/* Assign Issue */}
                          {canManageIssue && (
                            <button
                              className="btn-icon"
                              title="Assign Developer"
                              onClick={(e) => {
                                e.stopPropagation();
                                setAssignModalIssue(i);
                                setSelectedAssignee(i.assigned_to || '');
                              }}
                            >
                              <UserCheck size={15} />
                            </button>
                          )}

                          {/* Edit Issue */}
                          <button
                            className="btn-icon"
                            title="Edit Issue"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/issues/${i.id}/edit`);
                            }}
                          >
                            <Edit size={15} />
                          </button>

                          {/* Delete Issue (Admin & PM only) */}
                          {canManageIssue && (
                            <button
                              className="btn-icon"
                              title="Delete Issue"
                              style={{ color: '#EF4444' }}
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteModalIssue(i);
                              }}
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="pagination">
            <div style={{ fontSize: '0.84rem', color: '#74748B' }}>
              Showing {issues.length} of {total} issues (Page {page} of {totalPages})
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className="pagination-btn"
                disabled={page <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
              >
                <ChevronLeft size={16} style={{ verticalAlign: 'middle' }} /> Previous
              </button>
              <button
                className="pagination-btn"
                disabled={page >= totalPages}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              >
                Next <ChevronRight size={16} style={{ verticalAlign: 'middle' }} />
              </button>
            </div>
          </div>
        </>
      ) : (
        /* KANBAN VISUAL WORKFLOW BOARD (5 COLUMNS) */
        <div className="kanban-board">
          {WORKFLOW_STAGES.map((stage) => {
            const stageIssues = issues.filter(i => i.status === stage);
            return (
              <div className="kanban-col" key={stage}>
                <div className="kanban-col-header">
                  <span>{stage}</span>
                  <span className="kanban-col-count">{stageIssues.length}</span>
                </div>
                <div className="kanban-cards">
                  {stageIssues.map((issue) => (
                    <div
                      className="kanban-card"
                      key={issue.id}
                      onClick={() => handleOpenIssuePanel(issue.id)}
                    >
                      <div className="kanban-card-key">{issue.id}</div>
                      <div className="kanban-card-title">{issue.title}</div>
                      <div className="kanban-card-footer">
                        <span className={`badge badge-${(issue.priority || 'P2').toLowerCase()}`}>
                          {issue.priority}
                        </span>
                        <span>{issue.assignee_name || 'Unassigned'}</span>
                      </div>
                    </div>
                  ))}
                  {stageIssues.length === 0 && (
                    <div style={{ padding: '24px 12px', textAlign: 'center', color: '#A3A3BA', fontSize: '0.75rem' }}>
                      No issues in {stage}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* MODAL 1: CREATE ISSUE MODAL                          */}
      {/* ---------------------------------------------------- */}
      {createModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '680px' }}>
            <div className="modal-header">
              <h2 className="modal-title">Create New Issue</h2>
              <button className="btn-icon" onClick={() => setCreateModalOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateSubmit}>
              <div className="modal-body">
                <div className="form-grid-2">
                  <div className="form-group">
                    <label className="form-label">Project *</label>
                    <select
                      className="form-select"
                      required
                      value={formData.project_id}
                      onChange={(e) => setFormData({ ...formData, project_id: e.target.value })}
                    >
                      <option value="">Select Target Project</option>
                      {projects.map(p => (
                        <option key={p.id} value={p.id}>{p.name} ({p.id})</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Issue Type *</label>
                    <select
                      className="form-select"
                      value={formData.issue_type}
                      onChange={(e) => setFormData({ ...formData, issue_type: e.target.value })}
                    >
                      {ISSUE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Issue Title *</label>
                  <input
                    type="text"
                    className="form-input"
                    required
                    placeholder="Concise summary of the bug or task..."
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea
                    className="form-textarea"
                    rows="3"
                    placeholder="Provide full context, symptoms, and impact..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>

                <div className="form-grid-3">
                  <div className="form-group">
                    <label className="form-label">Severity *</label>
                    <select
                      className="form-select"
                      required
                      value={formData.severity}
                      onChange={(e) => setFormData({ ...formData, severity: e.target.value })}
                    >
                      {SEVERITIES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Priority *</label>
                    <select
                      className="form-select"
                      required
                      value={formData.priority}
                      onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    >
                      {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Assign To</label>
                    <select
                      className="form-select"
                      value={formData.assigned_to}
                      onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
                    >
                      <option value="">Unassigned</option>
                      {developers.map(d => (
                        <option key={d.id} value={d.id}>{d.name} ({d.role})</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-grid-2">
                  <div className="form-group">
                    <label className="form-label">Affected Module *</label>
                    <select
                      className="form-select"
                      required
                      value={formData.affected_module || 'Login'}
                      onChange={(e) => setFormData({ ...formData, affected_module: e.target.value })}
                    >
                      {AFFECTED_MODULES.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  {formData.affected_module === 'Other' ? (
                    <div className="form-group">
                      <label className="form-label">Custom Module Name *</label>
                      <input
                        type="text"
                        className="form-input"
                        required
                        placeholder="Enter custom module name..."
                        value={formData.custom_module || ''}
                        onChange={(e) => setFormData({ ...formData, custom_module: e.target.value })}
                      />
                    </div>
                  ) : (
                    <div className="form-group">
                      <label className="form-label">Environment</label>
                      <select
                        className="form-select"
                        value={formData.environment}
                        onChange={(e) => setFormData({ ...formData, environment: e.target.value })}
                      >
                        <option value="Development">Development</option>
                        <option value="QA">QA</option>
                        <option value="Staging">Staging</option>
                        <option value="Production">Production</option>
                      </select>
                    </div>
                  )}
                </div>

                {formData.affected_module === 'Other' && (
                  <div className="form-group">
                    <label className="form-label">Environment</label>
                    <select
                      className="form-select"
                      value={formData.environment}
                      onChange={(e) => setFormData({ ...formData, environment: e.target.value })}
                    >
                      <option value="Development">Development</option>
                      <option value="QA">QA</option>
                      <option value="Staging">Staging</option>
                      <option value="Production">Production</option>
                    </select>
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Steps to Reproduce</label>
                  <textarea
                    className="form-textarea"
                    rows="2"
                    placeholder="1. Open app... 2. Click checkout... 3. Error occurs"
                    value={formData.steps_to_reproduce}
                    onChange={(e) => setFormData({ ...formData, steps_to_reproduce: e.target.value })}
                  />
                </div>

                <div className="form-grid-2">
                  <div className="form-group">
                    <label className="form-label">Expected Result</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="What should happen..."
                      value={formData.expected_result}
                      onChange={(e) => setFormData({ ...formData, expected_result: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Actual Result</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="What actually happened..."
                      value={formData.actual_result}
                      onChange={(e) => setFormData({ ...formData, actual_result: e.target.value })}
                    />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setCreateModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Create Issue
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* MODAL 2: EDIT ISSUE MODAL                            */}
      {/* ---------------------------------------------------- */}
      {editModalIssue && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '640px' }}>
            <div className="modal-header">
              <h2 className="modal-title">Edit Issue #{editModalIssue.id}</h2>
              <button className="btn-icon" onClick={() => setEditModalIssue(null)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleEditSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Title</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editModalIssue.title || ''}
                    onChange={(e) => setEditModalIssue({ ...editModalIssue, title: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea
                    className="form-textarea"
                    rows="3"
                    value={editModalIssue.description || ''}
                    onChange={(e) => setEditModalIssue({ ...editModalIssue, description: e.target.value })}
                  />
                </div>
                <div className="form-grid-3">
                  <div className="form-group">
                    <label className="form-label">Issue Type *</label>
                    <select
                      className="form-select"
                      required
                      value={editModalIssue.issue_type || 'Bug'}
                      onChange={(e) => setEditModalIssue({ ...editModalIssue, issue_type: e.target.value })}
                    >
                      {ISSUE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Severity *</label>
                    <select
                      className="form-select"
                      required
                      value={editModalIssue.severity || 'Medium'}
                      onChange={(e) => setEditModalIssue({ ...editModalIssue, severity: e.target.value })}
                    >
                      {SEVERITIES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Priority *</label>
                    <select
                      className="form-select"
                      required
                      value={editModalIssue.priority || 'P2'}
                      onChange={(e) => setEditModalIssue({ ...editModalIssue, priority: e.target.value })}
                    >
                      {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                    </select>
                  </div>
                </div>

                <div className="form-grid-2">
                  <div className="form-group">
                    <label className="form-label">Affected Module *</label>
                    <select
                      className="form-select"
                      required
                      value={AFFECTED_MODULES.includes(editModalIssue.affected_module) ? editModalIssue.affected_module : (editModalIssue.affected_module ? 'Other' : 'Login')}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === 'Other') {
                          setEditModalIssue({
                            ...editModalIssue,
                            affected_module: 'Other',
                            custom_module: AFFECTED_MODULES.includes(editModalIssue.affected_module) ? '' : (editModalIssue.affected_module || '')
                          });
                        } else {
                          setEditModalIssue({ ...editModalIssue, affected_module: val, custom_module: '' });
                        }
                      }}
                    >
                      {AFFECTED_MODULES.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  {(editModalIssue.affected_module === 'Other' || (!AFFECTED_MODULES.includes(editModalIssue.affected_module) && editModalIssue.affected_module)) ? (
                    <div className="form-group">
                      <label className="form-label">Custom Module Name *</label>
                      <input
                        type="text"
                        className="form-input"
                        required
                        placeholder="Enter custom module name..."
                        value={editModalIssue.custom_module !== undefined ? editModalIssue.custom_module : (!AFFECTED_MODULES.includes(editModalIssue.affected_module) ? editModalIssue.affected_module : '')}
                        onChange={(e) => setEditModalIssue({ ...editModalIssue, custom_module: e.target.value })}
                      />
                    </div>
                  ) : (
                    <div className="form-group">
                      <label className="form-label">Component</label>
                      <input
                        type="text"
                        className="form-input"
                        value={editModalIssue.component || ''}
                        onChange={(e) => setEditModalIssue({ ...editModalIssue, component: e.target.value })}
                      />
                    </div>
                  )}
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setEditModalIssue(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* MODAL 3: ASSIGN ISSUE MODAL                          */}
      {/* ---------------------------------------------------- */}
      {assignModalIssue && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <h2 className="modal-title">Assign Issue #{assignModalIssue.id}</h2>
              <button className="btn-icon" onClick={() => setAssignModalIssue(null)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleAssignSubmit}>
              <div className="modal-body">
                <p style={{ fontSize: '0.85rem', color: '#74748B', marginBottom: '14px' }}>
                  Select an eligible developer to assign this issue:
                </p>
                <div className="form-group">
                  <label className="form-label">Assignee</label>
                  <select
                    className="form-select"
                    value={selectedAssignee}
                    onChange={(e) => setSelectedAssignee(e.target.value)}
                  >
                    <option value="">Unassigned</option>
                    {developers.map(d => (
                      <option key={d.id} value={d.id}>{d.name} ({d.role})</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setAssignModalIssue(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Confirm Assignment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* MODAL 4: STATUS UPDATE MODAL                         */}
      {/* ---------------------------------------------------- */}
      {statusModalIssue && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h2 className="modal-title">Update Workflow Status</h2>
              <button className="btn-icon" onClick={() => setStatusModalIssue(null)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleStatusSubmit}>
              <div className="modal-body">
                <div style={{ marginBottom: '14px' }}>
                  <span style={{ fontSize: '0.82rem', color: '#74748B' }}>Current Status: </span>
                  <span className={`badge badge-${statusModalIssue.status.toLowerCase().replace(' ', '-')}`}>
                    {statusModalIssue.status}
                  </span>
                </div>
                <div className="form-group">
                  <label className="form-label">New Status *</label>
                  <select
                    className="form-select"
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value)}
                  >
                    {WORKFLOW_STAGES.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                {(newStatus === 'Resolved' || newStatus === 'Closed') && (
                  <div className="form-group">
                    <label className="form-label">Resolution Summary</label>
                    <textarea
                      className="form-textarea"
                      rows="2"
                      placeholder="Briefly describe what fix was applied..."
                      value={resolutionSummary}
                      onChange={(e) => setResolutionSummary(e.target.value)}
                    />
                  </div>
                )}
                <div className="form-group">
                  <label className="form-label">Transition Comment / Reason</label>
                  <textarea
                    className="form-textarea"
                    rows="2"
                    placeholder="Optional notes for the status audit history..."
                    value={statusComment}
                    onChange={(e) => setStatusComment(e.target.value)}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setStatusModalIssue(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Transition Status
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* MODAL 5: DELETE CONFIRMATION MODAL                   */}
      {/* ---------------------------------------------------- */}
      {deleteModalIssue && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <h2 className="modal-title" style={{ color: '#EF4444' }}>Delete Issue</h2>
              <button className="btn-icon" onClick={() => setDeleteModalIssue(null)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '1rem', fontWeight: 600, color: '#393442', marginBottom: '8px' }}>
                Are you sure you want to delete this issue?
              </p>
              <div style={{ background: '#FAF8F5', padding: '12px 14px', borderRadius: '8px', border: '1px solid #EAE5E0', fontSize: '0.84rem' }}>
                <div><strong>Issue ID:</strong> {deleteModalIssue.id}</div>
                <div style={{ marginTop: '4px' }}><strong>Title:</strong> {deleteModalIssue.title}</div>
                <div style={{ marginTop: '4px' }}><strong>Project:</strong> {deleteModalIssue.project_name}</div>
              </div>
              <p style={{ fontSize: '0.78rem', color: '#EF4444', marginTop: '12px' }}>
                Warning: This action cannot be undone and will permanently remove the issue and its comments.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDeleteModalIssue(null)}>
                Cancel
              </button>
              <button className="btn btn-danger" onClick={handleDeleteConfirm}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* RIGHT-SIDE ISSUE DETAILS SLIDE-OUT PANEL             */}
      {/* ---------------------------------------------------- */}
      <IssueDetailPanel
        issueId={panelIssueId}
        isOpen={isPanelOpen}
        onClose={handleCloseIssuePanel}
        onIssueUpdated={handleIssueUpdatedFromPanel}
      />
    </div>
  );
}
