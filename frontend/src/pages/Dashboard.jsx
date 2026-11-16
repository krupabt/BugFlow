import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import {
  Users,
  FolderGit2,
  Bug,
  AlertCircle,
  Clock,
  CheckCircle2,
  Activity,
  Layers,
  Plus,
  ArrowRight,
  Shield,
  FileCheck2,
  UserCheck,
  X,
  History,
  MessageSquare,
  Paperclip,
  Download,
  Search,
  Calendar,
  Bell,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  FileText,
  FileCode,
  Image as ImageIcon,
  File,
  Info,
  TrendingUp,
  BarChart3,
  RefreshCw,
  GitBranch,
  GitCommit,
  Workflow,
  Rocket,
  Cpu
} from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import IssueDetailPanel from '../components/IssueDetailPanel';

function formatDateTime(isoString) {
  if (!isoString) return 'Just now';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return 'Recently';
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  } catch {
    return 'Recently';
  }
}

function formatDateOnly(isoString) {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  } catch {
    return isoString;
  }
}

function getActivityIcon(actionType) {
  switch ((actionType || '').toUpperCase()) {
    case 'ASSIGNMENT':
      return <UserCheck size={14} color="#E97862" />;
    case 'PRIORITY_CHANGE':
      return <AlertCircle size={14} color="#B45309" />;
    case 'SEVERITY_CHANGE':
      return <Shield size={14} color="#C85038" />;
    case 'STATUS_CHANGE':
      return <Clock size={14} color="#5B4870" />;
    case 'CREATED':
      return <Plus size={14} color="#2B6647" />;
    case 'COMMENT_ADDED':
      return <MessageSquare size={14} color="#E97862" />;
    case 'ATTACHMENT_UPLOADED':
      return <Paperclip size={14} color="#292338" />;
    case 'SPRINT_ASSIGNED':
      return <Layers size={14} color="#2B6647" />;
    default:
      return <Activity size={14} color="#E97862" />;
  }
}

function getFileIcon(filename = '') {
  const ext = (filename.split('.').pop() || '').toLowerCase();
  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext)) {
    return <ImageIcon size={15} color="#E97862" />;
  }
  if (['pdf'].includes(ext)) {
    return <FileText size={15} color="#C85038" />;
  }
  if (['doc', 'docx', 'txt', 'rtf'].includes(ext)) {
    return <FileText size={15} color="#5B4870" />;
  }
  if (['js', 'jsx', 'ts', 'tsx', 'py', 'json', 'html', 'css', 'sql'].includes(ext)) {
    return <FileCode size={15} color="#2B6647" />;
  }
  return <File size={15} color="#817B86" />;
}

function formatSprintDates(startStr, endStr) {
  if (!startStr || !endStr) return '—';
  try {
    const s = new Date(startStr);
    const e = new Date(endStr);
    const sStr = s.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
    const eStr = e.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
    return `${sStr} – ${eStr}`;
  } catch {
    return `${startStr} – ${endStr}`;
  }
}

function getSprintStatusBadge(status) {
  const s = (status || '').toUpperCase();
  if (s === 'COMPLETED') {
    return (
      <span
        style={{
          fontSize: '0.68rem',
          fontWeight: 700,
          padding: '2px 8px',
          borderRadius: '4px',
          background: '#EDF6F1',
          color: '#2B6647',
          border: '1px solid #B7D8C8',
          display: 'inline-block'
        }}
      >
        Completed
      </span>
    );
  }
  if (s === 'ACTIVE') {
    return (
      <span
        style={{
          fontSize: '0.68rem',
          fontWeight: 700,
          padding: '2px 8px',
          borderRadius: '4px',
          background: '#EFF6FF',
          color: '#1D4ED8',
          border: '1px solid #BFDBFE',
          display: 'inline-block'
        }}
      >
        Active
      </span>
    );
  }
  return (
    <span
      style={{
        fontSize: '0.68rem',
        fontWeight: 700,
        padding: '2px 8px',
        borderRadius: '4px',
        background: '#F5F1EC',
        color: '#6A6470',
        border: '1px solid #EAE5E0',
        display: 'inline-block'
      }}
    >
      {status || 'Planned'}
    </span>
  );
}

const ISSUE_TYPES = ["Bug", "Feature Request", "Enhancement", "Technical Debt"];
const SEVERITIES = ["Critical", "High", "Medium", "Low"];
const PRIORITIES = [
  { value: "P1", label: "P1 – Urgent" },
  { value: "P2", label: "P2 – High" },
  { value: "P3", label: "P3 – Medium" },
  { value: "P4", label: "P4 – Low" }
];
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
  "Product Catalog",
  "Order History",
  "Checkout API",
  "Other"
];

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Create New Issue Modal state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createFormData, setCreateFormData] = useState({
    project_id: '',
    title: '',
    description: '',
    issue_type: 'Bug',
    severity: 'Medium',
    priority: 'P2',
    affected_module: 'Login',
    custom_module: '',
    assigned_to: '',
    environment: 'Development',
    steps_to_reproduce: '',
    expected_result: '',
    actual_result: ''
  });
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createError, setCreateError] = useState('');
  const [createSuccessNotice, setCreateSuccessNotice] = useState('');
  const [modalProjects, setModalProjects] = useState([]);
  const [modalDevelopers, setModalDevelopers] = useState([]);

  // Dashboard Stats & Sprints
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedSprintId, setSelectedSprintId] = useState('');

  // Slide-out panel state
  const [panelIssueId, setPanelIssueId] = useState(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  // Issues Table in Left Section (5 items per page to keep viewport compact)
  const [issues, setIssues] = useState([]);
  const [issuesLoading, setIssuesLoading] = useState(false);
  const [issuesTotal, setIssuesTotal] = useState(0);
  const [issuesPage, setIssuesPage] = useState(1);
  const issuesPerPage = 5;

  // Filters for Issues Table
  const [filterProject, setFilterProject] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Activity History & Modal
  const [recentActivity, setRecentActivity] = useState([]);
  const [showAllActivityModal, setShowAllActivityModal] = useState(false);
  const [allActivityList, setAllActivityList] = useState([]);
  const [loadingAllActivity, setLoadingAllActivity] = useState(false);

  // Recent Comments & Attachments
  const [recentComments, setRecentComments] = useState([]);
  const [recentAttachments, setRecentAttachments] = useState([]);

  // Notifications popup toggle
  const [showNotifications, setShowNotifications] = useState(false);

  // GitHub & CI/CD Status
  const [githubInfo, setGithubInfo] = useState(null);
  const [cicdInfo, setCicdInfo] = useState(null);

  // Admin Dashboard Filters
  const [adminProjectFilter, setAdminProjectFilter] = useState('All');
  const [adminDateRangeFilter, setAdminDateRangeFilter] = useState('all');
  const [adminStartDate, setAdminStartDate] = useState('');
  const [adminEndDate, setAdminEndDate] = useState('');

  // Show More / Show Less for Sprint Overview status boxes
  const [expandedSprintCols, setExpandedSprintCols] = useState({
    todo: false,
    inprogress: false,
    testing: false,
    done: false
  });

  const toggleSprintCol = (colKey) => {
    setExpandedSprintCols(prev => ({
      ...prev,
      [colKey]: !prev[colKey]
    }));
  };

  const normRole = (user?.role || '').toUpperCase().replace(/ /g, '_');
  const isAdmin = normRole === 'ADMIN' || normRole === 'ADMINISTRATOR';
  const isPM = normRole === 'PROJECT_MANAGER';
  const isDev = normRole === 'DEVELOPER';
  const isTester = normRole === 'TESTER';
  const displayRole = user?.role_display || (isAdmin ? 'Admin' : isPM ? 'Project Manager' : isDev ? 'Developer' : isTester ? 'Tester' : (user?.role || 'Member'));

  const currentDateDisplay = useMemo(() => {
    return new Date().toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }, []);

  // Open Issue Detail Slide-Out Panel
  const handleOpenIssue = (issueId) => {
    if (!issueId) return;
    setPanelIssueId(issueId);
    setIsPanelOpen(true);
  };

  // Close Slide-Out Panel
  const handleClosePanel = () => {
    setIsPanelOpen(false);
    setPanelIssueId(null);
  };

  // Load Dashboard Core Stats & Sprints
  const loadDashboardStats = async (sprintIdOverride, projectIdOverride, dateRangeOverride, customStartOverride, customEndOverride) => {
    try {
      const params = {};
      const pid = projectIdOverride !== undefined ? projectIdOverride : (isAdmin ? adminProjectFilter : filterProject);
      if (pid && pid !== 'All') params.project_id = pid;

      const dr = dateRangeOverride !== undefined ? dateRangeOverride : adminDateRangeFilter;
      if (dr && dr !== 'all') params.date_range = dr;

      const s = customStartOverride !== undefined ? customStartOverride : adminStartDate;
      const e = customEndOverride !== undefined ? customEndOverride : adminEndDate;
      if (s) params.start_date = s;
      if (e) params.end_date = e;

      if (sprintIdOverride) params.sprint_id = sprintIdOverride;
      else if (selectedSprintId && projectIdOverride === undefined) params.sprint_id = selectedSprintId;

      const stats = await api.getDashboardStats(params);
      setData(stats);

      if (stats.recent_comments) {
        setRecentComments(stats.recent_comments);
      }
      if (stats.recent_attachments) {
        setRecentAttachments(stats.recent_attachments);
      }
      if (stats.current_sprint) {
        setSelectedSprintId(stats.current_sprint.id);
      }
    } catch (err) {
      console.error('Failed to load dashboard stats:', err);
      setError(err.message || 'Failed to load dashboard data');
    }
  };

  // Load Recent Activity (latest 5 activities as requested)
  const loadRecentActivity = async () => {
    try {
      const act = await api.getRecentActivity({ limit: 5 });
      setRecentActivity(act || []);
    } catch (err) {
      console.warn('Failed to load recent activity:', err);
    }
  };

  // Load Issues for Left Table (with role-scoping, filters, and pagination)
  const loadIssues = async () => {
    setIssuesLoading(true);
    try {
      const params = {
        page: issuesPage,
        per_page: issuesPerPage
      };
      if (filterProject && filterProject !== 'All') params.project_id = filterProject;
      if (filterStatus && filterStatus !== 'All') params.status = filterStatus;
      if (searchQuery.trim()) params.search = searchQuery.trim();

      const res = await api.getIssues(params);
      setIssues(res.issues || []);
      setIssuesTotal(res.total || 0);
    } catch (err) {
      console.error('Failed to load issues for dashboard table:', err);
    } finally {
      setIssuesLoading(false);
    }
  };

  // Load Recent Comments & Attachments
  const loadCommentsAndAttachments = async () => {
    try {
      if (typeof api.getDashboardRecentComments === 'function') {
        const c = await api.getDashboardRecentComments({ limit: 4 });
        if (c && Array.isArray(c)) setRecentComments(c);
      }
      if (typeof api.getDashboardRecentAttachments === 'function') {
        const a = await api.getDashboardRecentAttachments({ limit: 4 });
        if (a && Array.isArray(a)) setRecentAttachments(a);
      }
    } catch (err) {
      console.warn('Comments/Attachments load warning:', err);
    }
  };

  // Load DevOps Stats (GitHub & CI/CD)
  const loadDevOpsStats = async () => {
    try {
      const [gh, ci] = await Promise.all([
        api.getGithubStatus().catch(() => null),
        api.getCicdLatest().catch(() => null)
      ]);
      if (gh) setGithubInfo(gh);
      if (ci?.run) setCicdInfo(ci.run);
    } catch (err) {
      console.warn('DevOps stats load warning:', err);
    }
  };

  // Initial Load
  useEffect(() => {
    setLoading(true);
    setError('');
    Promise.all([
      loadDashboardStats(),
      loadRecentActivity(),
      loadCommentsAndAttachments(),
      loadDevOpsStats()
    ]).finally(() => {
      setLoading(false);
    });
  }, [user?.id, user?.role]);

  // Reload issues whenever page or filters change
  useEffect(() => {
    loadIssues();
  }, [issuesPage, filterProject, filterStatus, searchQuery]);

  // Handle Sprint Switcher Change
  const handleSprintChange = (sprintId) => {
    setSelectedSprintId(sprintId);
    loadDashboardStats(sprintId);
  };

  // Handle Full Activity Modal
  const handleOpenAllActivity = async () => {
    setShowAllActivityModal(true);
    setLoadingAllActivity(true);
    try {
      const full = await api.getRecentActivity({ all: true });
      setAllActivityList(full || []);
    } catch (err) {
      console.error('Failed to load all activity:', err);
    } finally {
      setLoadingAllActivity(false);
    }
  };

  // Handle Attachment Download
  const handleDownloadAttachment = async (e, att) => {
    e.stopPropagation();
    try {
      await api.downloadAttachment(att.issue_id, att.id, att.filename);
    } catch (err) {
      alert(`Download failed: ${err.message}`);
    }
  };

  // Load Project and Developer Lookups for Create Issue Modal
  const loadCreateLookups = async () => {
    try {
      const [projRes, devRes] = await Promise.all([
        api.getProjects({ include_stats: false }),
        api.getUsers({ role: 'DEVELOPER', active: 'true' })
      ]);
      setModalProjects(projRes || []);
      setModalDevelopers(devRes || []);
      if (projRes && projRes.length > 0 && !createFormData.project_id) {
        setCreateFormData(prev => ({ ...prev, project_id: projRes[0].id }));
      }
    } catch (err) {
      console.error('Failed to load project/dev lookups for create modal:', err);
    }
  };

  useEffect(() => {
    loadCreateLookups();
  }, []);

  useEffect(() => {
    if (searchParams.get('action') === 'create') {
      loadCreateLookups();
      setCreateModalOpen(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams]);

  const handleCreateIssueSubmit = async (e) => {
    e.preventDefault();
    setCreateSubmitting(true);
    setCreateError('');
    try {
      const payload = {
        ...createFormData,
        affected_module: createFormData.affected_module === 'Other' && createFormData.custom_module
          ? createFormData.custom_module
          : (createFormData.affected_module || 'Login'),
        priority: createFormData.priority || 'P2'
      };
      const created = await api.createIssue(payload);
      const issueIdentifier = created.issue?.id || created.id || '';
      setCreateSuccessNotice(`Issue ${issueIdentifier} created successfully!`);
      setTimeout(() => setCreateSuccessNotice(''), 4000);
      setCreateModalOpen(false);
      setCreateFormData({
        project_id: modalProjects[0]?.id || '',
        title: '',
        description: '',
        issue_type: 'Bug',
        severity: 'Medium',
        priority: 'P2',
        affected_module: 'Login',
        custom_module: '',
        assigned_to: '',
        environment: 'Development',
        steps_to_reproduce: '',
        expected_result: '',
        actual_result: ''
      });
      loadIssues();
      loadDashboardStats();
      loadRecentActivity();
    } catch (err) {
      setCreateError(err.message || 'Failed to create issue.');
    } finally {
      setCreateSubmitting(false);
    }
  };

  // Callback when an issue is updated inside the slide-out panel
  const handleIssueUpdated = () => {
    loadDashboardStats();
    loadIssues();
    loadRecentActivity();
    loadCommentsAndAttachments();
  };

  if (loading) {
    return (
      <div className="loading-container" style={{ minHeight: '50vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner"></div>
        <p style={{ marginTop: '12px', color: '#817B86', fontSize: '0.88rem', fontWeight: 600 }}>
          Loading your {displayRole} workspace...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '28px 20px', textAlign: 'center', background: '#FFFFFF', borderRadius: '12px', border: '1px solid #EAE5E0', maxWidth: '480px', margin: '30px auto', boxShadow: '0 2px 8px rgba(41, 35, 56, 0.04)' }}>
        <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: '#FDF2F0', color: '#E97862', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px auto' }}>
          <AlertCircle size={24} />
        </div>
        <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#393442', marginBottom: '6px' }}>
          Unable to Load Dashboard
        </h2>
        <p style={{ color: '#817B86', fontSize: '0.86rem', marginBottom: '20px', lineHeight: 1.5 }}>
          {error}
        </p>
        <button
          className="btn btn-primary"
          onClick={() => {
            setLoading(true);
            loadDashboardStats().finally(() => setLoading(false));
          }}
          style={{ margin: '0 auto', background: '#E97862', borderColor: '#E97862' }}
        >
          Retry Loading
        </button>
      </div>
    );
  }

  // Row 2: 5 Summary Cards configuration (BugFlow Editorial styling)
  const summaryCards = [
    {
      title: 'Total Issues',
      count: data?.totals?.total_issues ?? 0,
      label: 'All tracked',
      icon: Layers,
      color: '#292338',
      bg: '#F5F1EC',
      border: '#EAE5E0'
    },
    {
      title: 'Open Issues',
      count: data?.totals?.open_issues ?? 0,
      label: 'Awaiting triage',
      icon: AlertCircle,
      color: '#E97862',
      bg: '#FDF2F0',
      border: '#F8C8BE'
    },
    {
      title: 'In Progress',
      count: data?.totals?.in_progress ?? 0,
      label: 'Active development',
      icon: Clock,
      color: '#B45309',
      bg: '#FFF8EB',
      border: '#FEE3B8'
    },
    {
      title: 'Resolved',
      count: data?.totals?.resolved ?? 0,
      label: 'Pending verification',
      icon: CheckCircle2,
      color: '#2B6647',
      bg: '#EDF6F1',
      border: '#B7D8C8'
    },
    {
      title: 'Closed',
      count: data?.totals?.closed ?? 0,
      label: 'Verified & complete',
      icon: Shield,
      color: '#6A6470',
      bg: '#F4F1EC',
      border: '#E5E0D8'
    }
  ];

  const currentSprint = data?.current_sprint;
  const availableSprints = data?.available_sprints || [];
  const scopedProjects = data?.scoped_projects || [];
  const totalPages = Math.ceil(issuesTotal / issuesPerPage) || 1;

  return (
    <div style={{ maxWidth: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {isAdmin ? (
        <>
          {/* ==================================================== */}
          {/* DAY 4 – ADMIN DASHBOARD HEADER                       */}
          {/* ==================================================== */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px',
              paddingBottom: '16px',
              borderBottom: '1px solid #EAE5E0'
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#1E293B', margin: 0, letterSpacing: '-0.02em' }}>
                  Admin Dashboard
                </h1>
                <span
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    color: '#2563EB',
                    background: '#EFF6FF',
                    border: '1px solid #BFDBFE',
                    padding: '2px 8px',
                    borderRadius: '6px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.03em'
                  }}
                >
                  Administrator
                </span>
              </div>
              <p style={{ fontSize: '0.84rem', color: '#64748B', margin: '3px 0 0 0', fontWeight: 500 }}>
                Project Analytics & Quality Insights
              </p>
            </div>

            {/* Header Controls: Project Dropdown, Date Filter, Bell, Profile, Create Issue */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              {/* Project Selection Dropdown */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FolderGit2 size={15} color="#64748B" />
                <select
                  value={adminProjectFilter}
                  onChange={(e) => {
                    const val = e.target.value;
                    setAdminProjectFilter(val);
                    loadDashboardStats(null, val, adminDateRangeFilter, adminStartDate, adminEndDate);
                  }}
                  style={{
                    padding: '6px 12px',
                    fontSize: '0.82rem',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    background: '#FFFFFF',
                    color: '#1E293B',
                    fontWeight: 600,
                    outline: 'none',
                    cursor: 'pointer',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
                  }}
                >
                  <option value="All">All Projects</option>
                  {scopedProjects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date Range Filter */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Calendar size={15} color="#64748B" />
                <select
                  value={adminDateRangeFilter}
                  onChange={(e) => {
                    const val = e.target.value;
                    setAdminDateRangeFilter(val);
                    loadDashboardStats(null, adminProjectFilter, val, adminStartDate, adminEndDate);
                  }}
                  style={{
                    padding: '6px 12px',
                    fontSize: '0.82rem',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    background: '#FFFFFF',
                    color: '#1E293B',
                    fontWeight: 600,
                    outline: 'none',
                    cursor: 'pointer',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
                  }}
                >
                  <option value="all">All Time</option>
                  <option value="7d">Last 7 Days</option>
                  <option value="30d">Last 30 Days</option>
                  <option value="90d">Last 90 Days</option>
                  <option value="this_year">This Year</option>
                  <option value="custom">Custom Date Range</option>
                </select>
              </div>

              {/* Custom Date Range Inline Inputs */}
              {adminDateRangeFilter === 'custom' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#FFFFFF', padding: '4px 8px', borderRadius: '8px', border: '1px solid #CBD5E1' }}>
                  <input
                    type="date"
                    value={adminStartDate}
                    onChange={(e) => {
                      setAdminStartDate(e.target.value);
                      loadDashboardStats(null, adminProjectFilter, 'custom', e.target.value, adminEndDate);
                    }}
                    style={{ fontSize: '0.78rem', border: 'none', outline: 'none', color: '#1E293B' }}
                  />
                  <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>to</span>
                  <input
                    type="date"
                    value={adminEndDate}
                    onChange={(e) => {
                      setAdminEndDate(e.target.value);
                      loadDashboardStats(null, adminProjectFilter, 'custom', adminStartDate, e.target.value);
                    }}
                    style={{ fontSize: '0.78rem', border: 'none', outline: 'none', color: '#1E293B' }}
                  />
                </div>
              )}

              {/* Notifications Icon with Badge */}
              <div style={{ position: 'relative' }}>
                <button
                  type="button"
                  onClick={() => setShowNotifications(!showNotifications)}
                  style={{
                    position: 'relative',
                    background: '#FFFFFF',
                    border: '1px solid #CBD5E1',
                    borderRadius: '8px',
                    width: '36px',
                    height: '36px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: '#334155',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
                  }}
                  title="Notifications"
                >
                  <Bell size={16} />
                  <span
                    style={{
                      position: 'absolute',
                      top: '7px',
                      right: '7px',
                      width: '7px',
                      height: '7px',
                      borderRadius: '50%',
                      background: '#E97862'
                    }}
                  />
                </button>

                {showNotifications && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '44px',
                      right: 0,
                      width: '270px',
                      background: '#FFFFFF',
                      border: '1px solid #E2E8F0',
                      borderRadius: '10px',
                      boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                      zIndex: 100,
                      padding: '12px 14px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', borderBottom: '1px solid #F1F5F9', paddingBottom: '6px' }}>
                      <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1E293B' }}>Notifications</span>
                      <span style={{ fontSize: '0.72rem', color: '#16A34A', fontWeight: 600 }}>• Live System Active</span>
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#64748B', lineHeight: 1.4 }}>
                      <p style={{ margin: '0 0 4px 0' }}>All dashboard statistics are updated in real-time.</p>
                      <p style={{ margin: 0, color: '#1E293B', fontWeight: 600 }}>Logged in as: Administrator</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Admin Profile Menu */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: '#FFFFFF',
                  border: '1px solid #CBD5E1',
                  padding: '4px 12px 4px 6px',
                  borderRadius: '999px',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
                }}
              >
                <div
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    background: '#1E293B',
                    color: '#FFFFFF',
                    fontWeight: 700,
                    fontSize: '0.78rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  {(user?.name || 'A')[0].toUpperCase()}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1E293B', lineHeight: 1.2 }}>
                    {user?.name || 'Administrator'}
                  </span>
                  <span style={{ fontSize: '0.68rem', color: '#64748B', fontWeight: 600 }}>
                    Administrator
                  </span>
                </div>
              </div>

              {/* Create Issue Button */}
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  loadCreateLookups();
                  setCreateModalOpen(true);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '0.82rem',
                  padding: '7px 14px',
                  background: '#E97862',
                  borderColor: '#E97862',
                  borderRadius: '8px',
                  color: '#FFFFFF',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                <Plus size={15} />
                <span>Create Issue</span>
              </button>
            </div>
          </div>

          {/* Success Notice Banner */}
          {createSuccessNotice && (
            <div className="toast-notice toast-success" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle2 size={16} />
              <span>{createSuccessNotice}</span>
            </div>
          )}

          {/* ==================================================== */}
          {/* ROW 1 – FOUR ISSUE SUMMARY CARDS                     */}
          {/* ==================================================== */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '16px'
            }}
          >
            {/* Card 1: Total Issues */}
            <div
              style={{
                background: '#FFFFFF',
                borderRadius: '12px',
                border: '1px solid #EAE5E0',
                padding: '16px 18px',
                boxShadow: '0 1px 3px rgba(41, 35, 56, 0.03)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: '#2563EB' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                  Total Issues
                </span>
                <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: '#EFF6FF', color: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #BFDBFE' }}>
                  <Bug size={16} />
                </div>
              </div>
              <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#1E293B', lineHeight: 1, letterSpacing: '-0.02em', margin: '4px 0 6px 0' }}>
                {data?.totals?.total_issues ?? 0}
              </div>
              <div style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#2563EB' }} />
                <span>{adminProjectFilter === 'All' ? 'Across all projects' : 'Selected project'}</span>
              </div>
            </div>

            {/* Card 2: Open Issues */}
            <div
              style={{
                background: '#FFFFFF',
                borderRadius: '12px',
                border: '1px solid #EAE5E0',
                padding: '16px 18px',
                boxShadow: '0 1px 3px rgba(41, 35, 56, 0.03)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: '#E97862' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                  Open Issues
                </span>
                <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: '#FDF2F0', color: '#E97862', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #F8C8BE' }}>
                  <AlertCircle size={16} />
                </div>
              </div>
              <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#1E293B', lineHeight: 1, letterSpacing: '-0.02em', margin: '4px 0 6px 0' }}>
                {data?.totals?.open_issues ?? 0}
              </div>
              <div style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#E97862' }} />
                <span>Awaiting triage & work</span>
              </div>
            </div>

            {/* Card 3: In Progress */}
            <div
              style={{
                background: '#FFFFFF',
                borderRadius: '12px',
                border: '1px solid #EAE5E0',
                padding: '16px 18px',
                boxShadow: '0 1px 3px rgba(41, 35, 56, 0.03)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: '#D97706' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                  In Progress
                </span>
                <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: '#FFF8EB', color: '#D97706', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #FEE3B8' }}>
                  <Clock size={16} />
                </div>
              </div>
              <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#1E293B', lineHeight: 1, letterSpacing: '-0.02em', margin: '4px 0 6px 0' }}>
                {data?.totals?.in_progress ?? 0}
              </div>
              <div style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#D97706' }} />
                <span>Active development</span>
              </div>
            </div>

            {/* Card 4: Resolved Issues */}
            <div
              style={{
                background: '#FFFFFF',
                borderRadius: '12px',
                border: '1px solid #EAE5E0',
                padding: '16px 18px',
                boxShadow: '0 1px 3px rgba(41, 35, 56, 0.03)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: '#16A34A' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                  Resolved Issues
                </span>
                <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: '#DCFCE7', color: '#16A34A', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #BBF7D0' }}>
                  <CheckCircle2 size={16} />
                </div>
              </div>
              <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#1E293B', lineHeight: 1, letterSpacing: '-0.02em', margin: '4px 0 6px 0' }}>
                {data?.totals?.resolved_total ?? (data?.totals?.resolved ?? 0) + (data?.totals?.closed ?? 0)}
              </div>
              <div style={{ fontSize: '0.74rem', color: '#16A34A', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#16A34A' }} />
                <span>{data?.totals?.resolved ?? 0} Resolved • {data?.totals?.closed ?? 0} Closed</span>
              </div>
            </div>
          </div>

          {/* ==================================================== */}
          {/* ROW 2 – THREE VISUALIZATION CHARTS                   */}
          {/* ==================================================== */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: '16px',
              alignItems: 'stretch'
            }}
          >
            {/* Chart 1: Issue Status Distribution (Donut Chart) */}
            <div
              style={{
                background: '#FFFFFF',
                borderRadius: '12px',
                border: '1px solid #EAE5E0',
                padding: '18px 20px',
                boxShadow: '0 1px 3px rgba(41, 35, 56, 0.03)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <div>
                    <h2 style={{ fontSize: '0.98rem', fontWeight: 700, color: '#1E293B', margin: 0 }}>
                      Issue Status Distribution
                    </h2>
                    <p style={{ fontSize: '0.76rem', color: '#64748B', margin: '2px 0 0' }}>
                      Breakdown across workflow stages
                    </p>
                  </div>
                  <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#2563EB', background: '#EFF6FF', padding: '2px 8px', borderRadius: '6px', border: '1px solid #BFDBFE' }}>
                    Total: {data?.status_total ?? data?.totals?.total_issues ?? 0}
                  </span>
                </div>

                <div style={{ height: '220px', width: '100%', position: 'relative' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data?.status_distribution || []}
                        cx="50%"
                        cy="50%"
                        innerRadius={62}
                        outerRadius={92}
                        paddingAngle={3}
                        dataKey="count"
                        nameKey="name"
                      >
                        {(data?.status_distribution || []).map((entry, index) => (
                          <Cell key={`status-cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(val, name, item) => [`${val} issues (${item.payload.percentage}%)`, name]}
                        contentStyle={{ backgroundColor: '#FFFFFF', borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '0.82rem' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>

                  {/* Centered Total Count */}
                  <div
                    style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      textAlign: 'center',
                      pointerEvents: 'none'
                    }}
                  >
                    <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#1E293B', lineHeight: 1 }}>
                      {data?.status_total ?? data?.totals?.total_issues ?? 0}
                    </div>
                    <div style={{ fontSize: '0.66rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase', marginTop: '3px' }}>
                      Total Issues
                    </div>
                  </div>
                </div>
              </div>

              {/* Status Breakdown Legend & Percentages */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))', gap: '8px', marginTop: '12px', paddingTop: '10px', borderTop: '1px solid #F1F5F9' }}>
                {(data?.status_distribution || []).map((item) => (
                  <div key={item.name} style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: item.color }} />
                      <span style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 600 }}>{item.name}</span>
                    </div>
                    <div style={{ fontSize: '0.86rem', fontWeight: 800, color: '#1E293B', marginLeft: '13px' }}>
                      {item.count} <span style={{ fontSize: '0.7rem', color: '#94A3B8', fontWeight: 500 }}>({item.percentage}%)</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Chart 2: Severity-wise Issues (Bar Chart) */}
            <div
              style={{
                background: '#FFFFFF',
                borderRadius: '12px',
                border: '1px solid #EAE5E0',
                padding: '18px 20px',
                boxShadow: '0 1px 3px rgba(41, 35, 56, 0.03)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <div>
                    <h2 style={{ fontSize: '0.98rem', fontWeight: 700, color: '#1E293B', margin: 0 }}>
                      Severity-wise Issues
                    </h2>
                    <p style={{ fontSize: '0.76rem', color: '#64748B', margin: '2px 0 0' }}>
                      Volume grouped by operational severity
                    </p>
                  </div>
                  <span style={{ fontSize: '0.74rem', fontWeight: 600, color: '#64748B' }}>
                    Counts above bars
                  </span>
                </div>

                <div style={{ height: '220px', width: '100%' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={data?.severity_distribution || []}
                      margin={{ top: 20, right: 10, left: -20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                      <XAxis dataKey="severity" tick={{ fill: '#64748B', fontSize: 11 }} />
                      <YAxis tick={{ fill: '#64748B', fontSize: 11 }} allowDecimals={false} />
                      <Tooltip
                        formatter={(val, name, item) => [`${val} issues (${item.payload.percentage}%)`, 'Defects']}
                        contentStyle={{ backgroundColor: '#FFFFFF', borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '0.82rem' }}
                      />
                      <Bar
                        dataKey="count"
                        radius={[4, 4, 0, 0]}
                        label={{ position: 'top', fill: '#1E293B', fontSize: 11, fontWeight: 700 }}
                      >
                        {(data?.severity_distribution || []).map((entry, index) => (
                          <Cell key={`sev-cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Severity Legend */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', marginTop: '12px', paddingTop: '10px', borderTop: '1px solid #F1F5F9', textAlign: 'center' }}>
                {(data?.severity_distribution || []).map((item) => (
                  <div key={item.severity} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.7rem', color: item.color, fontWeight: 700 }}>
                      {item.severity}
                    </span>
                    <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#1E293B' }}>
                      {item.count}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Chart 3: Monthly Defect Trend (Line Chart) */}
            <div
              style={{
                background: '#FFFFFF',
                borderRadius: '12px',
                border: '1px solid #EAE5E0',
                padding: '18px 20px',
                boxShadow: '0 1px 3px rgba(41, 35, 56, 0.03)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <div>
                    <h2 style={{ fontSize: '0.98rem', fontWeight: 700, color: '#1E293B', margin: 0 }}>
                      Monthly Defect Trend
                    </h2>
                    <p style={{ fontSize: '0.76rem', color: '#64748B', margin: '2px 0 0' }}>
                      Created vs resolved defect trajectory
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.74rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#2563EB' }} />
                      <span style={{ color: '#475569', fontWeight: 600 }}>Created</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#16A34A' }} />
                      <span style={{ color: '#475569', fontWeight: 600 }}>Resolved</span>
                    </div>
                  </div>
                </div>

                <div style={{ height: '220px', width: '100%' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={data?.monthly_defect_trend || []}
                      margin={{ top: 15, right: 15, left: -20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                      <XAxis dataKey="label" tick={{ fill: '#64748B', fontSize: 11 }} />
                      <YAxis tick={{ fill: '#64748B', fontSize: 11 }} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#FFFFFF', borderRadius: '8px', border: '1px solid #E2E8F0', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', fontSize: '0.82rem' }}
                      />
                      <Line
                        type="monotone"
                        dataKey="created"
                        name="Total Issues Created"
                        stroke="#2563EB"
                        strokeWidth={2.5}
                        dot={{ r: 4, fill: '#2563EB' }}
                        activeDot={{ r: 6 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="resolved"
                        name="Issues Resolved"
                        stroke="#16A34A"
                        strokeWidth={2.5}
                        dot={{ r: 4, fill: '#16A34A' }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Monthly Trend Footer */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', paddingTop: '10px', borderTop: '1px solid #F1F5F9', fontSize: '0.74rem' }}>
                <span style={{ color: '#64748B' }}>
                  Aggregated from actual database dates
                </span>
                <span style={{ color: '#16A34A', fontWeight: 700 }}>
                  Active resolution velocity
                </span>
              </div>
            </div>
          </div>

          {/* ==================================================== */}
          {/* ROW 3 – QUALITY METRICS, MODULES, RECENT ACTIVITY    */}
          {/* ==================================================== */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: '16px',
              alignItems: 'stretch'
            }}
          >
            {/* Card 1: Project Quality Metrics */}
            <div
              style={{
                background: '#FFFFFF',
                borderRadius: '12px',
                border: '1px solid #EAE5E0',
                padding: '18px 20px',
                boxShadow: '0 1px 3px rgba(41, 35, 56, 0.03)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                  <TrendingUp size={18} color="#2563EB" />
                  <div>
                    <h2 style={{ fontSize: '0.98rem', fontWeight: 700, color: '#1E293B', margin: 0 }}>
                      Project Quality Metrics
                    </h2>
                    <p style={{ fontSize: '0.74rem', color: '#64748B', margin: '2px 0 0' }}>
                      Key engineering benchmarks
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {/* Metric 1: Average Resolution Time */}
                  <div style={{ padding: '10px 12px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '6px', background: '#EFF6FF', color: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Clock size={16} />
                      </div>
                      <div>
                        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1E293B' }}>
                          Average Resolution Time
                        </div>
                        <div style={{ fontSize: '0.7rem', color: '#64748B' }}>
                          {data?.quality_metrics?.average_resolution_time?.days || 0} days equivalent duration
                        </div>
                      </div>
                    </div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#2563EB' }}>
                      {data?.quality_metrics?.average_resolution_time?.display || '0.0 hrs'}
                    </div>
                  </div>

                  {/* Metric 2: Resolution Rate */}
                  <div style={{ padding: '10px 12px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '6px', background: '#DCFCE7', color: '#16A34A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <CheckCircle2 size={16} />
                      </div>
                      <div>
                        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1E293B' }}>
                          Resolution Rate
                        </div>
                        <div style={{ fontSize: '0.7rem', color: '#64748B' }}>
                          Defect resolution efficiency
                        </div>
                      </div>
                    </div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#16A34A' }}>
                      {data?.quality_metrics?.resolution_rate?.display || '0%'}
                    </div>
                  </div>

                  {/* Metric 3: Total Pending Issues */}
                  <div style={{ padding: '10px 12px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '6px', background: '#FFF8EB', color: '#D97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <AlertCircle size={16} />
                      </div>
                      <div>
                        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1E293B' }}>
                          Total Pending Issues
                        </div>
                        <div style={{ fontSize: '0.7rem', color: '#64748B' }}>
                          Open, in progress & testing backlog
                        </div>
                      </div>
                    </div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#D97706' }}>
                      {data?.quality_metrics?.total_pending_issues ?? 0}
                    </div>
                  </div>

                  {/* Metric 4: Defect Density (Explicitly Data Unavailable) */}
                  <div style={{ padding: '10px 12px', background: '#FDF2F2', borderRadius: '8px', border: '1px solid #F8D7DA', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '6px', background: '#FFFFFF', color: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Info size={16} />
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1E293B' }}>
                            Defect Density
                          </span>
                          <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#DC2626', background: '#FEE2E2', padding: '1px 6px', borderRadius: '4px' }}>
                            Data unavailable
                          </span>
                        </div>
                        <div style={{ fontSize: '0.7rem', color: '#7F1D1D', marginTop: '2px', lineHeight: 1.3 }}>
                          Project size (KLOC) metric is required to calculate defect density.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Card 2: Top Modules by Defects */}
            <div
              style={{
                background: '#FFFFFF',
                borderRadius: '12px',
                border: '1px solid #EAE5E0',
                padding: '18px 20px',
                boxShadow: '0 1px 3px rgba(41, 35, 56, 0.03)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <div>
                    <h2 style={{ fontSize: '0.98rem', fontWeight: 700, color: '#1E293B', margin: 0 }}>
                      Top Modules by Defects
                    </h2>
                    <p style={{ fontSize: '0.74rem', color: '#64748B', margin: '2px 0 0' }}>
                      Defects grouped by affected module
                    </p>
                  </div>
                  <span style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 600 }}>
                    Share (%)
                  </span>
                </div>

                {(data?.top_modules || []).length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '30px 0', color: '#64748B', fontSize: '0.8rem' }}>
                    No module defect records found.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {(data?.top_modules || []).map((m, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '7px 10px',
                          borderRadius: '6px',
                          background: '#FAF8F5',
                          border: '1px solid #EAE5E0'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '120px' }}>
                          <span
                            style={{
                              fontSize: '0.76rem',
                              fontWeight: 700,
                              color: '#5B4870',
                              background: '#F4F1F8',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              border: '1px solid #E3DCEB'
                            }}
                          >
                            {m.module}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, justifyContent: 'flex-end' }}>
                          <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#1E293B' }}>
                            {m.count}
                          </span>
                          <div style={{ width: '80px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <div style={{ flex: 1, height: '6px', background: '#E2E8F0', borderRadius: '3px', overflow: 'hidden' }}>
                              <div style={{ width: `${m.percentage}%`, height: '100%', background: '#E97862', borderRadius: '3px' }} />
                            </div>
                            <span style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 600, minWidth: '34px', textAlign: 'right' }}>
                              {m.percentage}%
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Card 3: Recent Activity */}
            <div
              style={{
                background: '#FFFFFF',
                borderRadius: '12px',
                border: '1px solid #EAE5E0',
                padding: '18px 20px',
                boxShadow: '0 1px 3px rgba(41, 35, 56, 0.03)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <History size={16} color="#E97862" />
                    <div>
                      <h2 style={{ fontSize: '0.98rem', fontWeight: 700, color: '#1E293B', margin: 0 }}>
                        Recent Activity
                      </h2>
                      <p style={{ fontSize: '0.74rem', color: '#64748B', margin: '2px 0 0' }}>
                        Live audit history from database
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleOpenAllActivity}
                    style={{
                      fontSize: '0.74rem',
                      padding: '4px 10px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      borderRadius: '6px',
                      border: '1px solid #EAE5E0',
                      background: '#FFFFFF',
                      color: '#1E293B',
                      cursor: 'pointer',
                      fontWeight: 600
                    }}
                  >
                    <span>View All</span>
                    <ArrowRight size={12} />
                  </button>
                </div>

                {(!data?.recent_activity || data.recent_activity.length === 0) ? (
                  <div style={{ textAlign: 'center', padding: '30px 0', color: '#64748B', fontSize: '0.8rem' }}>
                    No audit activities recorded.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                    {data.recent_activity.slice(0, 5).map((item) => (
                      <div
                        key={item.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '7px 10px',
                          borderRadius: '6px',
                          background: '#FAF8F5',
                          border: '1px solid #EAE5E0',
                          gap: '10px'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                          <div
                            style={{
                              width: '24px',
                              height: '24px',
                              borderRadius: '6px',
                              background: '#FFFFFF',
                              border: '1px solid #EAE5E0',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0
                            }}
                          >
                            {getActivityIcon(item.action_type)}
                          </div>
                          <div style={{ fontSize: '0.78rem', color: '#393442', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            <span
                              onClick={() => handleOpenIssue(item.issue_id)}
                              style={{
                                fontWeight: 700,
                                color: '#E97862',
                                cursor: 'pointer',
                                marginRight: '5px'
                              }}
                            >
                              {item.issue_id}
                            </span>
                            <span>{item.description}</span>
                          </div>
                        </div>
                        <span style={{ fontSize: '0.72rem', color: '#817B86', fontWeight: 500, flexShrink: 0 }}>
                          {formatDateTime(item.created_at)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ==================================================== */}
          {/* DEVOPS & CONTINUOUS INTEGRATION        */}
          {/* ==================================================== */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '4px' }}>
            {/* GitHub & CI/CD Status Cards (Side by Side) */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
                gap: '16px'
              }}
            >
              {/* Card 1: GitHub Integration Status */}
              <div
                style={{
                  background: '#FFFFFF',
                  borderRadius: '12px',
                  border: '1px solid #EAE5E0',
                  padding: '20px',
                  boxShadow: '0 1px 3px rgba(41, 35, 56, 0.03)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '14px'
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#0F172A', color: '#38BDF8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <GitBranch size={17} />
                      </div>
                      <div>
                        <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 700, color: '#0F172A' }}>
                          GitHub Integration Status
                        </h3>
                        <span style={{ fontSize: '0.74rem', color: '#64748B' }}>
                          Repository: {githubInfo?.repository_name || 'krupabt/BugFlow'}
                        </span>
                      </div>
                    </div>

                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        background: githubInfo?.connected ? '#ECFDF5' : '#FEF3C7',
                        color: githubInfo?.connected ? '#059669' : '#92400E',
                        border: `1px solid ${githubInfo?.connected ? '#A7F3D0' : '#FCD34D'}`,
                        padding: '3px 10px',
                        borderRadius: '9999px',
                        fontSize: '0.75rem',
                        fontWeight: 700
                      }}
                    >
                      <CheckCircle2 size={13} color={githubInfo?.connected ? '#059669' : '#D97706'} />
                      {githubInfo?.connected ? 'Connected' : 'Not Connected'}
                    </span>
                  </div>

                  {/* Commit Information */}
                  <div style={{ background: '#F8FAFC', padding: '12px 14px', borderRadius: '8px', border: '1px solid #E2E8F0', marginTop: '6px' }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: '4px' }}>
                      {githubInfo?.connected ? 'Latest Commit Information' : 'Repository Connection Status'}
                    </div>
                    {githubInfo?.connected ? (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                          <code style={{ background: '#EDE9FE', color: '#6D28D9', padding: '2px 6px', borderRadius: '4px', fontSize: '0.78rem', fontWeight: 700 }}>
                            {githubInfo?.latest_commit?.short_sha || 'main'}
                          </code>
                          <span style={{ fontSize: '0.78rem', color: '#475569' }}>
                            by {githubInfo?.latest_commit?.author_name || githubInfo?.authenticated_user || 'Developer'} on branch <code>{githubInfo?.default_branch || 'main'}</code>
                          </span>
                        </div>
                        <div style={{ fontSize: '0.82rem', color: '#0F172A', fontWeight: 600, lineHeight: 1.4 }}>
                          {githubInfo?.latest_commit?.commit_message || 'Repository synchronized with GitHub'}
                        </div>
                      </>
                    ) : (
                      <div style={{ fontSize: '0.82rem', color: '#475569', lineHeight: 1.4 }}>
                        GitHub token is not configured. Configure GITHUB_TOKEN in backend/.env or click below to connect.
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #F1F5F9', paddingTop: '12px' }}>
                  <span style={{ fontSize: '0.75rem', color: '#64748B' }}>
                    Linked Issues: <strong>{githubInfo?.linked_issues_count || 0}</strong> • Branch: <strong>{githubInfo?.default_branch || 'main'}</strong>
                  </span>
                  <Link
                    to="/github"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      color: '#2563EB',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      textDecoration: 'none'
                    }}
                  >
                    <span>{githubInfo?.connected ? 'View GitHub Activity' : 'Connect GitHub'}</span>
                    <ArrowRight size={13} />
                  </Link>
                </div>
              </div>

              {/* Card 2: CI/CD Pipeline Status */}
              <div
                style={{
                  background: '#FFFFFF',
                  borderRadius: '12px',
                  border: '1px solid #EAE5E0',
                  padding: '20px',
                  boxShadow: '0 1px 3px rgba(41, 35, 56, 0.03)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '14px'
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#EFF6FF', color: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Workflow size={17} />
                      </div>
                      <div>
                        <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 700, color: '#0F172A' }}>
                          CI/CD Pipeline Status
                        </h3>
                        <span style={{ fontSize: '0.74rem', color: '#64748B' }}>
                          Workflow: {cicdInfo?.workflow_name || 'BugFlow CI/CD Pipeline'} ({cicdInfo?.run_id || '#1042'})
                        </span>
                      </div>
                    </div>

                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        background: '#ECFDF5',
                        color: '#059669',
                        border: '1px solid #A7F3D0',
                        padding: '3px 10px',
                        borderRadius: '9999px',
                        fontSize: '0.75rem',
                        fontWeight: 700
                      }}
                    >
                      <CheckCircle2 size={13} color="#059669" />
                      Passing
                    </span>
                  </div>

                  {/* 4 Pipeline Stages Progression Chips */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', margin: '10px 0' }}>
                    {[
                      { name: 'Code Push', pass: true },
                      { name: 'Build & Test', pass: true },
                      { name: 'Tests Passed', pass: true },
                      { name: 'Deployment', pass: true }
                    ].map((stg, i) => (
                      <div
                        key={stg.name}
                        style={{
                          background: '#F0FDF4',
                          border: '1px solid #BBF7D0',
                          borderRadius: '6px',
                          padding: '6px 4px',
                          textAlign: 'center'
                        }}
                      >
                        <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#166534', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {stg.name}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#15803D', fontWeight: 800, marginTop: '2px' }}>
                          ✓ Pass
                        </div>
                      </div>
                    ))}
                  </div>

                  <div style={{ fontSize: '0.78rem', color: '#475569', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span>Execution Duration: <strong>{cicdInfo?.duration_display || '1m 24s'}</strong></span>
                    <span>•</span>
                    <span>Automated Suites: <strong>5/5 Passed</strong></span>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #F1F5F9', paddingTop: '12px' }}>
                  <span style={{ fontSize: '0.75rem', color: '#64748B' }}>
                    Environment: <strong style={{ color: '#059669' }}>Production</strong>
                  </span>
                  <Link
                    to="/cicd"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      color: '#2563EB',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      textDecoration: 'none'
                    }}
                  >
                    <span>Open CI/CD Dashboard</span>
                    <ArrowRight size={13} />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* ==================================================== */}
          {/* ROW 1 – COMPACT HEADER                               */}
          {/* ==================================================== */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          paddingBottom: '14px',
          borderBottom: '1px solid #EAE5E0'
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h1 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#393442', margin: 0, letterSpacing: '-0.02em' }}>
              Welcome back, {user?.name || 'User'}
            </h1>
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                color: '#E97862',
                background: '#FDF2F0',
                border: '1px solid #F8C8BE',
                padding: '2px 8px',
                borderRadius: '6px',
                textTransform: 'uppercase',
                letterSpacing: '0.03em'
              }}
            >
              {displayRole}
            </span>
          </div>
          <p style={{ fontSize: '0.82rem', color: '#817B86', margin: '3px 0 0 0' }}>
            Here's what's happening with your projects today.
          </p>
        </div>

        {/* Right Header: Date, Notification Bell, User Card */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Current Date Badge */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: '#FFFFFF',
              border: '1px solid #EAE5E0',
              padding: '6px 12px',
              borderRadius: '8px',
              fontSize: '0.8rem',
              color: '#393442',
              fontWeight: 600,
              boxShadow: '0 1px 2px rgba(41, 35, 56, 0.02)'
            }}
          >
            <Calendar size={14} color="#E97862" />
            <span>{currentDateDisplay}</span>
          </div>

          {/* Notifications Icon with Badge */}
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setShowNotifications(!showNotifications)}
              style={{
                position: 'relative',
                background: '#FFFFFF',
                border: '1px solid #EAE5E0',
                borderRadius: '8px',
                width: '34px',
                height: '34px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: '#393442',
                boxShadow: '0 1px 2px rgba(41, 35, 56, 0.02)'
              }}
              title="Notifications"
            >
              <Bell size={16} />
              <span
                style={{
                  position: 'absolute',
                  top: '6px',
                  right: '6px',
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: '#E97862'
                }}
              />
            </button>

            {/* Notification Dropdown */}
            {showNotifications && (
              <div
                style={{
                  position: 'absolute',
                  top: '42px',
                  right: 0,
                  width: '260px',
                  background: '#FFFFFF',
                  border: '1px solid #EAE5E0',
                  borderRadius: '10px',
                  boxShadow: '0 10px 24px rgba(41, 35, 56, 0.08)',
                  zIndex: 100,
                  padding: '12px 14px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', borderBottom: '1px solid #EAE5E0', paddingBottom: '6px' }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#393442' }}>Notifications</span>
                  <span style={{ fontSize: '0.72rem', color: '#2B6647', fontWeight: 600 }}>• Live System Active</span>
                </div>
                <div style={{ fontSize: '0.78rem', color: '#817B86', lineHeight: 1.4 }}>
                  <p style={{ margin: '0 0 4px 0' }}>All dashboard statistics are updated in real-time.</p>
                  <p style={{ margin: 0, color: '#393442', fontWeight: 600 }}>Role: {displayRole}</p>
                </div>
              </div>
            )}
          </div>

          {/* User Profile Pill */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: '#FFFFFF',
              border: '1px solid #EAE5E0',
              padding: '4px 12px 4px 6px',
              borderRadius: '999px',
              boxShadow: '0 1px 2px rgba(41, 35, 56, 0.02)'
            }}
          >
            <div
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                background: '#292338',
                color: '#FAF8F5',
                fontWeight: 700,
                fontSize: '0.78rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              {(user?.name || 'U')[0].toUpperCase()}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#393442', lineHeight: 1.2 }}>
                {user?.name || 'User'}
              </span>
              <span style={{ fontSize: '0.68rem', color: '#817B86', fontWeight: 500 }}>
                {displayRole}
              </span>
            </div>
          </div>

          {/* Create Issue Header Button */}
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              loadCreateLookups();
              setCreateModalOpen(true);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.8rem',
              padding: '6px 12px',
              background: '#E97862',
              borderColor: '#E97862',
              borderRadius: '8px'
            }}
          >
            <Plus size={14} />
            <span>Create Issue</span>
          </button>
        </div>
      </div>

      {/* Success Notice Banner */}
      {createSuccessNotice && (
        <div className="toast-notice toast-success" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CheckCircle2 size={16} />
          <span>{createSuccessNotice}</span>
        </div>
      )}

      {/* ==================================================== */}
      {/* ROW 2 – FIVE SUMMARY CARDS IN ONE HORIZONTAL ROW    */}
      {/* ==================================================== */}
      <div
        className="dashboard-summary-grid"
        style={{
          display: 'grid',
          gap: '12px'
        }}
      >
        {summaryCards.map((card, idx) => {
          const IconComp = card.icon;
          return (
            <div
              key={idx}
              style={{
                background: '#FFFFFF',
                borderRadius: '10px',
                border: '1px solid #EAE5E0',
                padding: '12px 14px',
                boxShadow: '0 1px 3px rgba(41, 35, 56, 0.03)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                height: '92px',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              {/* Top Accent Stripe */}
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '3px',
                  background: card.color
                }}
              />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#817B86', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                  {card.title}
                </span>
                <div
                  style={{
                    width: '26px',
                    height: '26px',
                    borderRadius: '6px',
                    background: card.bg,
                    color: card.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: `1px solid ${card.border}`
                  }}
                >
                  <IconComp size={14} />
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                <div
                  style={{
                    fontSize: '1.55rem',
                    fontWeight: 800,
                    color: '#393442',
                    lineHeight: 1,
                    letterSpacing: '-0.02em'
                  }}
                >
                  {card.count}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span
                    style={{
                      width: '5px',
                      height: '5px',
                      borderRadius: '50%',
                      background: card.color
                    }}
                  />
                  <span style={{ fontSize: '0.72rem', color: '#817B86', fontWeight: 500 }}>
                    {card.label}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ==================================================== */}
      {/* ROW 3 – TWO-COLUMN LAYOUT (65% / 35%)                */}
      {/* ==================================================== */}
      <div
        className="dashboard-row-3"
        style={{
          gap: '16px',
          alignItems: 'stretch'
        }}
      >
        {/* -------------------------------------------------- */}
        {/* LEFT SIDE – RECENT ISSUES (approx 65%)             */}
        {/* -------------------------------------------------- */}
        <div
          style={{
            background: '#FFFFFF',
            borderRadius: '12px',
            border: '1px solid #EAE5E0',
            padding: '16px 18px',
            boxShadow: '0 1px 3px rgba(41, 35, 56, 0.03)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}
        >
          {/* Header & Controls Toolbar */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Bug size={17} color="#E97862" />
                <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#393442', margin: 0 }}>
                  Recent Issues
                </h2>
                <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#817B86', background: '#F5F1EC', padding: '1px 6px', borderRadius: '4px' }}>
                  {issuesTotal}
                </span>
              </div>

              {/* Controls Toolbar: Search + Project Filter + Status Filter + Create Issue */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                {/* Search Field */}
                <div style={{ position: 'relative', width: '150px' }}>
                  <Search size={13} color="#817B86" style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="text"
                    placeholder="Search issues..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setIssuesPage(1);
                    }}
                    style={{
                      width: '100%',
                      padding: '5px 8px 5px 26px',
                      fontSize: '0.78rem',
                      borderRadius: '6px',
                      border: '1px solid #EAE5E0',
                      background: '#FAF8F5',
                      outline: 'none',
                      color: '#393442'
                    }}
                  />
                </div>

                {/* Project Filter */}
                <select
                  value={filterProject}
                  onChange={(e) => {
                    const newPid = e.target.value;
                    setFilterProject(newPid);
                    setIssuesPage(1);
                    loadDashboardStats(null, newPid);
                  }}
                  style={{
                    padding: '5px 8px',
                    fontSize: '0.78rem',
                    borderRadius: '6px',
                    border: '1px solid #EAE5E0',
                    background: '#FAF8F5',
                    color: '#393442',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <option value="All">All Projects</option>
                  {scopedProjects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>

                {/* Status Filter */}
                <select
                  value={filterStatus}
                  onChange={(e) => {
                    setFilterStatus(e.target.value);
                    setIssuesPage(1);
                  }}
                  style={{
                    padding: '5px 8px',
                    fontSize: '0.78rem',
                    borderRadius: '6px',
                    border: '1px solid #EAE5E0',
                    background: '#FAF8F5',
                    color: '#393442',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <option value="All">All Statuses</option>
                  <option value="Open">Open</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Testing">Testing</option>
                  <option value="Resolved">Resolved</option>
                  <option value="Closed">Closed</option>
                </select>

                {/* Create Issue Button (Muted Coral #E97862) */}
                <button
                  type="button"
                  onClick={() => {
                    loadCreateLookups();
                    setCreateModalOpen(true);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    background: '#E97862',
                    color: '#FFFFFF',
                    border: 'none',
                    padding: '5px 10px',
                    borderRadius: '6px',
                    fontWeight: 600,
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                    boxShadow: '0 1px 3px rgba(233, 120, 98, 0.3)'
                  }}
                >
                  <Plus size={13} />
                  <span>Create Issue</span>
                </button>
              </div>
            </div>

            {/* Compact Issues Table: Issue ID | Title | Type | Priority | Status | Assignee | Updated Date */}
            <div style={{ overflowX: 'auto', minHeight: '190px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #EAE5E0', background: '#FAF8F5' }}>
                    <th style={{ padding: '7px 8px', fontSize: '0.74rem', fontWeight: 700, color: '#817B86', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Issue ID</th>
                    <th style={{ padding: '7px 8px', fontSize: '0.74rem', fontWeight: 700, color: '#817B86', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Title</th>
                    <th style={{ padding: '7px 8px', fontSize: '0.74rem', fontWeight: 700, color: '#817B86', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Type</th>
                    <th style={{ padding: '7px 8px', fontSize: '0.74rem', fontWeight: 700, color: '#817B86', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Priority</th>
                    <th style={{ padding: '7px 8px', fontSize: '0.74rem', fontWeight: 700, color: '#817B86', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Status</th>
                    <th style={{ padding: '7px 8px', fontSize: '0.74rem', fontWeight: 700, color: '#817B86', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Assignee</th>
                    <th style={{ padding: '7px 8px', fontSize: '0.74rem', fontWeight: 700, color: '#817B86', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {issuesLoading ? (
                    <tr>
                      <td colSpan="7" style={{ textAlign: 'center', padding: '24px 0', color: '#817B86' }}>
                        <div className="spinner" style={{ margin: '0 auto 6px auto', width: '20px', height: '20px' }}></div>
                        <span style={{ fontSize: '0.78rem' }}>Loading issues...</span>
                      </td>
                    </tr>
                  ) : issues.length === 0 ? (
                    <tr>
                      <td colSpan="7" style={{ textAlign: 'center', padding: '28px 0', color: '#817B86', fontSize: '0.82rem' }}>
                        No issues found matching your filters.
                      </td>
                    </tr>
                  ) : (
                    issues.map((issue) => (
                      <tr
                        key={issue.id}
                        onClick={() => handleOpenIssue(issue.id)}
                        style={{
                          borderBottom: '1px solid #F3EFEB',
                          cursor: 'pointer',
                          transition: 'background 0.12s ease'
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#FAF8F5')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                      >
                        <td style={{ padding: '8px', fontWeight: 700, color: '#E97862', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                          {issue.id}
                        </td>
                        <td style={{ padding: '8px', fontWeight: 600, color: '#393442', fontSize: '0.82rem', maxWidth: '210px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {issue.title}
                        </td>
                        <td style={{ padding: '8px', fontSize: '0.74rem', color: '#817B86', whiteSpace: 'nowrap' }}>
                          <span style={{ background: '#F5F1EC', padding: '1px 6px', borderRadius: '4px', fontWeight: 500 }}>
                            {issue.issue_type || 'Bug'}
                          </span>
                        </td>
                        <td style={{ padding: '8px', fontSize: '0.74rem', whiteSpace: 'nowrap' }}>
                          <span className={`badge badge-pri-${(issue.priority_level || issue.priority || 'P2').toLowerCase()}`}>
                            {issue.priority || 'P2'}
                          </span>
                        </td>
                        <td style={{ padding: '8px', fontSize: '0.74rem', whiteSpace: 'nowrap' }}>
                          <span className={`badge badge-${(issue.status || 'open').toLowerCase().replace(' ', '-')}`}>
                            {issue.status}
                          </span>
                        </td>
                        <td style={{ padding: '8px', fontSize: '0.78rem', color: '#393442', whiteSpace: 'nowrap' }}>
                          {issue.assignee_name || 'Unassigned'}
                        </td>
                        <td style={{ padding: '8px', fontSize: '0.74rem', color: '#817B86', whiteSpace: 'nowrap' }}>
                          {formatDateOnly(issue.updated_date || issue.updated_at || issue.created_date)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Table Pagination */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: '10px',
              paddingTop: '8px',
              borderTop: '1px solid #EAE5E0',
              fontSize: '0.76rem',
              color: '#817B86'
            }}
          >
            <span>
              Showing {issues.length > 0 ? (issuesPage - 1) * issuesPerPage + 1 : 0} –{' '}
              {Math.min(issuesPage * issuesPerPage, issuesTotal)} of {issuesTotal}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                type="button"
                onClick={() => setIssuesPage((p) => Math.max(1, p - 1))}
                disabled={issuesPage <= 1}
                style={{
                  background: '#FFFFFF',
                  border: '1px solid #EAE5E0',
                  borderRadius: '5px',
                  padding: '4px 8px',
                  fontSize: '0.74rem',
                  fontWeight: 600,
                  color: issuesPage <= 1 ? '#A8A3AF' : '#393442',
                  cursor: issuesPage <= 1 ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '2px'
                }}
              >
                <ChevronLeft size={13} />
                <span>Prev</span>
              </button>
              <span style={{ fontWeight: 600, color: '#393442', padding: '0 4px' }}>
                {issuesPage} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setIssuesPage((p) => Math.min(totalPages, p + 1))}
                disabled={issuesPage >= totalPages}
                style={{
                  background: '#FFFFFF',
                  border: '1px solid #EAE5E0',
                  borderRadius: '5px',
                  padding: '4px 8px',
                  fontSize: '0.74rem',
                  fontWeight: 600,
                  color: issuesPage >= totalPages ? '#A8A3AF' : '#393442',
                  cursor: issuesPage >= totalPages ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '2px'
                }}
              >
                <span>Next</span>
                <ChevronRight size={13} />
              </button>
            </div>
          </div>
        </div>

        {/* -------------------------------------------------- */}
        {/* RIGHT SIDE – SPRINT OVERVIEW (approx 35%)          */}
        {/* -------------------------------------------------- */}
        <div
          style={{
            background: '#FFFFFF',
            borderRadius: '12px',
            border: '1px solid #EAE5E0',
            padding: '16px 18px',
            boxShadow: '0 1px 3px rgba(41, 35, 56, 0.03)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}
        >
          <div>
            {/* Header: Sprint title + View All button */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Layers size={18} color="#292338" />
                <h2 style={{ fontSize: '1.02rem', fontWeight: 700, color: '#393442', margin: 0 }}>
                  Sprint Overview
                </h2>
              </div>
              <Link
                to="/sprints"
                style={{
                  fontSize: '0.78rem',
                  color: '#E97862',
                  fontWeight: 600,
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px'
                }}
              >
                <span>View All</span>
                <ArrowRight size={13} />
              </Link>
            </div>

            {/* SPRINT OVERVIEW TABLE */}
            {availableSprints.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '36px 12px', color: '#817B86' }}>
                <Layers size={26} style={{ margin: '0 auto 8px auto', opacity: 0.5, color: '#E97862' }} />
                <p style={{ margin: 0, fontSize: '0.84rem', fontWeight: 600 }}>No sprints available</p>
                <span style={{ fontSize: '0.75rem', color: '#A8A3AF' }}>No sprint records found for your current scope.</span>
              </div>
            ) : (
              <div style={{ overflowX: 'auto', border: '1px solid #EAE5E0', borderRadius: '8px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.78rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #EAE5E0', background: '#FAF8F5' }}>
                      <th style={{ padding: '8px 10px', color: '#817B86', fontWeight: 700, fontSize: '0.71rem', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Project</th>
                      <th style={{ padding: '8px 10px', color: '#817B86', fontWeight: 700, fontSize: '0.71rem', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Sprint</th>
                      <th style={{ padding: '8px 10px', color: '#817B86', fontWeight: 700, fontSize: '0.71rem', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Dates</th>
                      <th style={{ padding: '8px 10px', color: '#817B86', fontWeight: 700, fontSize: '0.71rem', textTransform: 'uppercase', letterSpacing: '0.03em', textAlign: 'right' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {availableSprints.slice(0, 5).map((sp) => (
                      <tr
                        key={sp.id}
                        onClick={() => navigate(`/sprints/${sp.id}`)}
                        style={{
                          borderBottom: '1px solid #F5F1EC',
                          cursor: 'pointer',
                          transition: 'background-color 0.12s ease'
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#FAF8F5'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                        title={`Click to open ${sp.name || sp.sprint_name} details (${sp.id})`}
                      >
                        <td style={{ padding: '9px 10px', fontWeight: 600, color: '#393442', whiteSpace: 'nowrap' }}>
                          {sp.project_name}
                        </td>
                        <td style={{ padding: '9px 10px', fontWeight: 700, color: '#E97862', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span>{sp.name || sp.sprint_name}</span>
                            <span style={{ fontSize: '0.66rem', color: '#817B86', fontWeight: 500 }}>({sp.id})</span>
                          </div>
                        </td>
                        <td style={{ padding: '9px 10px', color: '#6A6470', fontSize: '0.74rem', whiteSpace: 'nowrap' }}>
                          {formatSprintDates(sp.start_date, sp.end_date)}
                        </td>
                        <td style={{ padding: '9px 10px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          {getSprintStatusBadge(sp.status)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Footer note & View All link */}
          <div
            style={{
              marginTop: '12px',
              paddingTop: '10px',
              borderTop: '1px solid #F5F1EC',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '0.74rem'
            }}
          >
            <span style={{ color: '#817B86' }}>
              Showing {Math.min(5, availableSprints.length)} of {availableSprints.length} sprints
            </span>
            <Link
              to="/sprints"
              style={{
                color: '#E97862',
                fontWeight: 700,
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px'
              }}
            >
              <span>View All Sprints</span>
              <ArrowRight size={12} />
            </Link>
          </div>
        </div>
      </div>

      {/* ==================================================== */}
      {/* ROW 4 – BOTTOM TWO-COLUMN LAYOUT (50% / 50%)         */}
      {/* ==================================================== */}
      <div
        className="dashboard-row-4"
        style={{
          gap: '16px',
          alignItems: 'stretch'
        }}
      >
        {/* -------------------------------------------------- */}
        {/* LEFT – RECENT ACTIVITY (latest 5 activities)       */}
        {/* -------------------------------------------------- */}
        <div
          style={{
            background: '#FFFFFF',
            borderRadius: '12px',
            border: '1px solid #EAE5E0',
            padding: '16px 18px',
            boxShadow: '0 1px 3px rgba(41, 35, 56, 0.03)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <History size={16} color="#E97862" />
                <h2 style={{ fontSize: '0.98rem', fontWeight: 700, color: '#393442', margin: 0 }}>
                  Recent Activity
                </h2>
              </div>
              <button
                type="button"
                onClick={handleOpenAllActivity}
                style={{
                  fontSize: '0.74rem',
                  padding: '4px 10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  borderRadius: '5px',
                  border: '1px solid #EAE5E0',
                  background: '#FFFFFF',
                  color: '#393442',
                  cursor: 'pointer',
                  fontWeight: 600
                }}
              >
                <span>View All</span>
                <ArrowRight size={11} />
              </button>
            </div>

            {recentActivity.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 12px', color: '#817B86', background: '#FAF8F5', borderRadius: '6px', border: '1px dashed #EAE5E0' }}>
                <Activity size={20} style={{ margin: '0 auto 6px auto', opacity: 0.5 }} />
                <p style={{ margin: 0, fontSize: '0.8rem' }}>No recent audit activity recorded for your scope.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {recentActivity.slice(0, 5).map((item) => (
                  <div
                    key={item.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '7px 10px',
                      borderRadius: '6px',
                      background: '#FAF8F5',
                      border: '1px solid #EAE5E0',
                      gap: '10px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                      <div
                        style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '6px',
                          background: '#FFFFFF',
                          border: '1px solid #EAE5E0',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}
                      >
                        {getActivityIcon(item.action_type)}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: '#393442', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <span
                          onClick={() => handleOpenIssue(item.issue_id)}
                          style={{
                            fontWeight: 700,
                            color: '#E97862',
                            cursor: 'pointer',
                            marginRight: '5px'
                          }}
                        >
                          {item.issue_id}
                        </span>
                        <span>{item.description}</span>
                      </div>
                    </div>
                    <span style={{ fontSize: '0.72rem', color: '#817B86', fontWeight: 500, flexShrink: 0 }}>
                      {formatDateTime(item.created_at)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* -------------------------------------------------- */}
        {/* RIGHT – RECENT COMMENTS AND ATTACHMENTS            */}
        {/* -------------------------------------------------- */}
        <div
          style={{
            background: '#FFFFFF',
            borderRadius: '12px',
            border: '1px solid #EAE5E0',
            padding: '16px 18px',
            boxShadow: '0 1px 3px rgba(41, 35, 56, 0.03)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <MessageSquare size={16} color="#E97862" />
                <h2 style={{ fontSize: '0.98rem', fontWeight: 700, color: '#393442', margin: 0 }}>
                  Recent Comments & Attachments
                </h2>
              </div>
            </div>

            {/* Split layout: Left sub-column Comments, Right sub-column Attachments */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: '10px' }}>
              {/* Comments Sub-column */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#817B86', textTransform: 'uppercase', letterSpacing: '0.03em', borderBottom: '1px solid #EAE5E0', paddingBottom: '3px' }}>
                  Comments ({recentComments.length})
                </span>
                {recentComments.length === 0 ? (
                  <div style={{ padding: '14px 6px', textAlign: 'center', color: '#A8A3AF', fontSize: '0.74rem' }}>
                    No comments recorded yet.
                  </div>
                ) : (
                  recentComments.slice(0, 3).map((c) => (
                    <div
                      key={c.id}
                      style={{
                        padding: '6px 8px',
                        borderRadius: '6px',
                        background: '#FAF8F5',
                        border: '1px solid #EAE5E0',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '3px'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#393442' }}>
                          {c.user_name}
                        </span>
                        <span
                          onClick={() => handleOpenIssue(c.issue_id)}
                          style={{
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            color: '#E97862',
                            cursor: 'pointer'
                          }}
                        >
                          {c.issue_id}
                        </span>
                      </div>
                      <p
                        style={{
                          margin: 0,
                          fontSize: '0.74rem',
                          color: '#393442',
                          lineHeight: 1.3,
                          overflow: 'hidden',
                          display: '-webkit-box',
                          WebkitLineClamp: 1,
                          WebkitBoxOrient: 'vertical'
                        }}
                      >
                        {c.content}
                      </p>
                      <span style={{ fontSize: '0.68rem', color: '#817B86' }}>
                        {formatDateTime(c.created_at)}
                      </span>
                    </div>
                  ))
                )}
              </div>

              {/* Attachments Sub-column */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#817B86', textTransform: 'uppercase', letterSpacing: '0.03em', borderBottom: '1px solid #EAE5E0', paddingBottom: '3px' }}>
                  Attachments ({recentAttachments.length})
                </span>
                {recentAttachments.length === 0 ? (
                  <div style={{ padding: '14px 6px', textAlign: 'center', color: '#A8A3AF', fontSize: '0.74rem' }}>
                    No files attached yet.
                  </div>
                ) : (
                  recentAttachments.slice(0, 3).map((a) => (
                    <div
                      key={a.id}
                      style={{
                        padding: '6px 8px',
                        borderRadius: '6px',
                        background: '#FAF8F5',
                        border: '1px solid #EAE5E0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '6px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                        <div style={{ flexShrink: 0 }}>
                          {getFileIcon(a.filename)}
                        </div>
                        <div style={{ overflow: 'hidden' }}>
                          <div style={{ fontSize: '0.74rem', fontWeight: 600, color: '#393442', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {a.filename}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.68rem', color: '#817B86' }}>
                            <span
                              onClick={() => handleOpenIssue(a.issue_id)}
                              style={{ color: '#E97862', fontWeight: 700, cursor: 'pointer' }}
                            >
                              {a.issue_id}
                            </span>
                            <span>•</span>
                            <span>{formatDateOnly(a.created_at)}</span>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => handleDownloadAttachment(e, a)}
                        style={{
                          background: '#FFFFFF',
                          border: '1px solid #EAE5E0',
                          borderRadius: '4px',
                          padding: '3px 6px',
                          color: '#E97862',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '2px',
                          fontSize: '0.7rem',
                          fontWeight: 600,
                          flexShrink: 0
                        }}
                        title="Download"
                      >
                        <Download size={11} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      </>
      )}

      {/* ==================================================== */}
      {/* VIEW ALL ACTIVITY MODAL                              */}
      {/* ==================================================== */}
      {showAllActivityModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(41, 35, 56, 0.45)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}
          onClick={() => setShowAllActivityModal(false)}
        >
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: '12px',
              border: '1px solid #EAE5E0',
              width: '100%',
              maxWidth: '680px',
              maxHeight: '82vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 40px rgba(41, 35, 56, 0.15)',
              overflow: 'hidden'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid #EAE5E0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: '#FAF8F5'
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#393442' }}>
                  Workspace Activity & Audit Log
                </h3>
                <p style={{ margin: '3px 0 0 0', fontSize: '0.78rem', color: '#817B86' }}>
                  Complete chronological activity for {user?.name} ({displayRole})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAllActivityModal(false)}
                style={{
                  background: '#FFFFFF',
                  border: '1px solid #EAE5E0',
                  borderRadius: '6px',
                  width: '28px',
                  height: '28px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: '#817B86'
                }}
              >
                <X size={15} />
              </button>
            </div>

            {/* Modal Content */}
            <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1 }}>
              {loadingAllActivity ? (
                <div style={{ textAlign: 'center', padding: '30px 0' }}>
                  <div className="spinner" style={{ margin: '0 auto 10px auto' }}></div>
                  <p style={{ color: '#817B86', fontSize: '0.82rem' }}>Fetching full activity log...</p>
                </div>
              ) : allActivityList.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#817B86', padding: '24px 0', fontSize: '0.82rem' }}>
                  No audit history records found for your permitted scope.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {allActivityList.map((item) => (
                    <div
                      key={item.id}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'space-between',
                        padding: '10px 12px',
                        borderRadius: '6px',
                        background: '#FAF8F5',
                        border: '1px solid #EAE5E0',
                        gap: '12px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', flex: 1 }}>
                        <div
                          style={{
                            width: '26px',
                            height: '26px',
                            borderRadius: '6px',
                            background: '#FFFFFF',
                            border: '1px solid #EAE5E0',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                            marginTop: '2px'
                          }}
                        >
                          {getActivityIcon(item.action_type)}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '0.82rem', color: '#393442', lineHeight: 1.4 }}>
                            <span
                              onClick={() => {
                                setShowAllActivityModal(false);
                                handleOpenIssue(item.issue_id);
                              }}
                              style={{
                                fontWeight: 700,
                                color: '#E97862',
                                cursor: 'pointer',
                                marginRight: '5px'
                              }}
                            >
                              {item.issue_id}
                            </span>
                            <span>{item.description}</span>
                          </div>
                          {item.reason && (
                            <div
                              style={{
                                marginTop: '3px',
                                fontSize: '0.74rem',
                                color: '#817B86',
                                background: '#FFFFFF',
                                border: '1px solid #EAE5E0',
                                borderRadius: '4px',
                                padding: '2px 6px',
                                display: 'inline-block'
                              }}
                            >
                              <strong>Note:</strong> {item.reason}
                            </div>
                          )}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <span style={{ fontSize: '0.74rem', color: '#817B86', fontWeight: 500 }}>
                          {formatDateTime(item.created_at)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: '12px 20px',
                borderTop: '1px solid #EAE5E0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: '#FAF8F5'
              }}
            >
              <span style={{ fontSize: '0.74rem', color: '#817B86' }}>
                Showing {allActivityList.length} recorded events
              </span>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowAllActivityModal(false)}
                style={{ fontSize: '0.78rem', padding: '5px 14px', borderRadius: '5px', border: '1px solid #EAE5E0', background: '#FFFFFF', cursor: 'pointer', color: '#393442' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL: CREATE NEW ISSUE                              */}
      {/* ==================================================== */}
      {createModalOpen && (
        <div className="modal-overlay" onClick={() => setCreateModalOpen(false)}>
          <div
            className="modal-content"
            style={{ maxWidth: '680px', width: '92%', maxHeight: '90vh', overflowY: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Bug size={18} color="#E97862" />
                <h2 className="modal-title">Create New Issue</h2>
              </div>
              <button
                type="button"
                className="btn-icon"
                onClick={() => setCreateModalOpen(false)}
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            {createError && (
              <div className="toast-notice toast-error" style={{ margin: '14px 20px 0 20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertCircle size={16} />
                <span>{createError}</span>
              </div>
            )}

            <form onSubmit={handleCreateIssueSubmit}>
              <div className="modal-body" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                
                {/* Project * & Issue Type * */}
                <div className="form-grid-2">
                  <div className="form-group">
                    <label className="form-label">Project *</label>
                    <select
                      className="form-select"
                      required
                      value={createFormData.project_id}
                      onChange={(e) => setCreateFormData({ ...createFormData, project_id: e.target.value })}
                    >
                      <option value="">Select Target Project</option>
                      {modalProjects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.id})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Issue Type *</label>
                    <select
                      className="form-select"
                      required
                      value={createFormData.issue_type}
                      onChange={(e) => setCreateFormData({ ...createFormData, issue_type: e.target.value })}
                    >
                      {ISSUE_TYPES.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Issue Title * */}
                <div className="form-group">
                  <label className="form-label">Issue Title *</label>
                  <input
                    type="text"
                    className="form-input"
                    required
                    placeholder="Concise summary of the bug or task..."
                    value={createFormData.title}
                    onChange={(e) => setCreateFormData({ ...createFormData, title: e.target.value })}
                  />
                </div>

                {/* Description */}
                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea
                    className="form-textarea"
                    rows="3"
                    placeholder="Provide full context, symptoms, and impact..."
                    value={createFormData.description}
                    onChange={(e) => setCreateFormData({ ...createFormData, description: e.target.value })}
                  />
                </div>

                {/* Severity *, Priority *, Assign To */}
                <div className="form-grid-3">
                  <div className="form-group">
                    <label className="form-label">Severity *</label>
                    <select
                      className="form-select"
                      required
                      value={createFormData.severity}
                      onChange={(e) => setCreateFormData({ ...createFormData, severity: e.target.value })}
                    >
                      {SEVERITIES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Priority *</label>
                    <select
                      className="form-select"
                      required
                      value={createFormData.priority}
                      onChange={(e) => setCreateFormData({ ...createFormData, priority: e.target.value })}
                    >
                      {PRIORITIES.map((p) => (
                        <option key={p.value} value={p.value}>{p.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Assign To</label>
                    <select
                      className="form-select"
                      value={createFormData.assigned_to}
                      onChange={(e) => setCreateFormData({ ...createFormData, assigned_to: e.target.value })}
                    >
                      <option value="">Unassigned</option>
                      {modalDevelopers.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name} ({d.role || 'Developer'})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Affected Module * & Environment */}
                <div className="form-grid-2">
                  <div className="form-group">
                    <label className="form-label">Affected Module *</label>
                    <select
                      className="form-select"
                      required
                      value={createFormData.affected_module}
                      onChange={(e) => setCreateFormData({ ...createFormData, affected_module: e.target.value })}
                    >
                      {AFFECTED_MODULES.map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>

                  {createFormData.affected_module === 'Other' ? (
                    <div className="form-group">
                      <label className="form-label">Custom Module Name *</label>
                      <input
                        type="text"
                        className="form-input"
                        required
                        placeholder="Enter custom module name..."
                        value={createFormData.custom_module}
                        onChange={(e) => setCreateFormData({ ...createFormData, custom_module: e.target.value })}
                      />
                    </div>
                  ) : (
                    <div className="form-group">
                      <label className="form-label">Environment</label>
                      <select
                        className="form-select"
                        value={createFormData.environment}
                        onChange={(e) => setCreateFormData({ ...createFormData, environment: e.target.value })}
                      >
                        <option value="Development">Development</option>
                        <option value="QA">QA</option>
                        <option value="Staging">Staging</option>
                        <option value="Production">Production</option>
                      </select>
                    </div>
                  )}
                </div>

                {createFormData.affected_module === 'Other' && (
                  <div className="form-group">
                    <label className="form-label">Environment</label>
                    <select
                      className="form-select"
                      value={createFormData.environment}
                      onChange={(e) => setCreateFormData({ ...createFormData, environment: e.target.value })}
                    >
                      <option value="Development">Development</option>
                      <option value="QA">QA</option>
                      <option value="Staging">Staging</option>
                      <option value="Production">Production</option>
                    </select>
                  </div>
                )}

                {/* Steps to Reproduce */}
                <div className="form-group">
                  <label className="form-label">Steps to Reproduce</label>
                  <textarea
                    className="form-textarea"
                    rows="2"
                    placeholder="1. Open app... 2. Click checkout... 3. Error occurs"
                    value={createFormData.steps_to_reproduce}
                    onChange={(e) => setCreateFormData({ ...createFormData, steps_to_reproduce: e.target.value })}
                  />
                </div>

                {/* Expected Result & Actual Result */}
                <div className="form-grid-2">
                  <div className="form-group">
                    <label className="form-label">Expected Result</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="What should happen..."
                      value={createFormData.expected_result}
                      onChange={(e) => setCreateFormData({ ...createFormData, expected_result: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Actual Result</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="What actually happened..."
                      value={createFormData.actual_result}
                      onChange={(e) => setCreateFormData({ ...createFormData, actual_result: e.target.value })}
                    />
                  </div>
                </div>

              </div>

              {/* Modal Footer: Cancel & Create Issue */}
              <div className="modal-footer" style={{ padding: '12px 20px', borderTop: '1px solid #EAE5E0', display: 'flex', justifyContent: 'flex-end', gap: '10px', background: '#FAF8F5' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setCreateModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={createSubmitting}
                >
                  {createSubmitting ? 'Creating Issue...' : 'Create Issue'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* RIGHT-SIDE SLIDE-OUT ISSUE DETAILS PANEL             */}
      {/* ==================================================== */}
      <IssueDetailPanel
        issueId={panelIssueId}
        isOpen={isPanelOpen}
        onClose={handleClosePanel}
        onIssueUpdated={handleIssueUpdated}
      />
    </div>
  );
}
