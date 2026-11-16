import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import {
  CheckSquare,
  Search,
  Filter,
  Plus,
  ArrowRight,
  Layers,
  Bug,
  AlertCircle,
  CheckCircle2,
  User,
  Clock,
  ExternalLink,
  ChevronRight
} from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

export default function Backlog() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const normRole = (user?.role || '').toUpperCase().replace(/ /g, '_');
  const canManageSprint = normRole === 'ADMIN' || normRole === 'PROJECT_MANAGER';

  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(searchParams.get('project_id') || '');
  const [sprints, setSprints] = useState([]);
  const [selectedSprintFilter, setSelectedSprintFilter] = useState('none'); // 'none' (Backlog only) | 'all' | or sprint_id

  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Filters
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState('All');
  const [selectedSeverity, setSelectedSeverity] = useState('All');
  const [selectedPriority, setSelectedPriority] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');

  // Assign to sprint modal / inline state
  const [assigningIssue, setAssigningIssue] = useState(null);
  const [targetSprintId, setTargetSprintId] = useState('');
  const [assignSubmitting, setAssignSubmitting] = useState(false);

  // Load projects & sprints
  useEffect(() => {
    async function loadLookups() {
      try {
        const [projRes, spRes] = await Promise.all([
          api.getProjects({ include_stats: false }),
          api.getSprints()
        ]);
        setProjects(projRes || []);
        setSprints(spRes || []);
        if (projRes && projRes.length > 0 && !selectedProject) {
          setSelectedProject(projRes[0].id);
        }
      } catch (err) {
        console.error('Failed to load projects/sprints:', err);
      }
    }
    loadLookups();
  }, []);

  // Load issues based on filters
  const loadIssues = async () => {
    setLoading(true);
    try {
      const res = await api.getIssues({
        project_id: selectedProject || undefined,
        sprint_id: selectedSprintFilter === 'all' ? undefined : (selectedSprintFilter || 'none'),
        q: search || undefined,
        issue_type: selectedType !== 'All' ? selectedType : undefined,
        severity: selectedSeverity !== 'All' ? selectedSeverity : undefined,
        priority: selectedPriority !== 'All' ? selectedPriority : undefined,
        status: selectedStatus !== 'All' ? selectedStatus : undefined,
        per_page: 100
      });
      setIssues(res.issues || []);
    } catch (err) {
      setError(err.message || 'Failed to load backlog issues');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedProject !== undefined) {
      loadIssues();
    }
  }, [selectedProject, selectedSprintFilter, search, selectedType, selectedSeverity, selectedPriority, selectedStatus]);

  // Handle assigning an issue to a sprint
  const handleAssignToSprint = async (issueId, sprintId) => {
    if (!sprintId) return;
    setAssignSubmitting(true);
    try {
      await api.addIssueToSprint(sprintId, issueId);
      setNotice(`Issue ${issueId} scheduled into sprint!`);
      setTimeout(() => setNotice(''), 3000);
      setAssigningIssue(null);
      setTargetSprintId('');
      loadIssues();
    } catch (err) {
      setError(err.message || 'Failed to assign issue to sprint');
      setTimeout(() => setError(''), 4000);
    } finally {
      setAssignSubmitting(false);
    }
  };

  // Sprints available for selected project
  const projectSprints = sprints.filter(s => !selectedProject || s.project_id === selectedProject);
  const activeOrPlannedSprints = projectSprints.filter(s => s.status === 'ACTIVE' || s.status === 'PLANNED');

  // Backlog metrics
  const totalBacklog = issues.length;
  const highPriorityBacklog = issues.filter(i => (i.priority || '').startsWith('P1') || (i.priority || '').startsWith('P2') || i.severity === 'Critical' || i.severity === 'High').length;
  const unassignedDev = issues.filter(i => !i.assigned_to).length;
  const readyForSprint = issues.filter(i => i.status === 'Open').length;

  return (
    <div className="page-container" style={{ maxWidth: '1440px', margin: '0 auto', padding: '24px 20px' }}>
      
      {/* Page Header */}
      <div className="page-header" style={{ marginBottom: '20px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: '#EFF6FF',
              color: '#2563EB',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <CheckSquare size={18} />
            </div>
            <h1 className="page-title" style={{ fontSize: '1.45rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
              Backlog Management
            </h1>
          </div>
          <p className="page-subtitle" style={{ fontSize: '0.88rem', color: '#64748B', margin: 0 }}>
            Inspect, prioritize and schedule project backlog deliverables into agile sprints.
          </p>
        </div>

        {canManageSprint && projectSprints.length > 0 && (
          <Link to={`/sprints/${projectSprints[0].id}`} className="btn btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <Layers size={15} />
            <span>Open Sprint Board</span>
          </Link>
        )}
      </div>

      {/* Notices */}
      {notice && (
        <div className="toast-notice toast-success" style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CheckCircle2 size={17} />
          <span>{notice}</span>
        </div>
      )}
      {error && (
        <div className="toast-notice toast-error" style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertCircle size={17} />
          <span>{error}</span>
        </div>
      )}

      {/* 4 Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '22px' }}>
        <div className="card" style={{ padding: '16px 20px', background: '#FFFFFF', borderRadius: '10px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
          <span style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Total Backlog Issues
          </span>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0F172A', marginTop: '4px' }}>
            {totalBacklog}
          </div>
        </div>

        <div className="card" style={{ padding: '16px 20px', background: '#FFFFFF', borderRadius: '10px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
          <span style={{ fontSize: '0.74rem', color: '#DC2626', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            High / Urgent Priority
          </span>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#DC2626', marginTop: '4px' }}>
            {highPriorityBacklog}
          </div>
        </div>

        <div className="card" style={{ padding: '16px 20px', background: '#FFFFFF', borderRadius: '10px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
          <span style={{ fontSize: '0.74rem', color: '#D97706', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Unassigned Developer
          </span>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#D97706', marginTop: '4px' }}>
            {unassignedDev}
          </div>
        </div>

        <div className="card" style={{ padding: '16px 20px', background: '#FFFFFF', borderRadius: '10px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
          <span style={{ fontSize: '0.74rem', color: '#2563EB', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Ready for Next Sprint
          </span>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#2563EB', marginTop: '4px' }}>
            {readyForSprint}
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="card" style={{ padding: '18px 22px', background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          
          {/* Project Selector */}
          <div style={{ minWidth: '220px' }}>
            <label style={{ fontSize: '0.74rem', fontWeight: 700, color: '#64748B', display: 'block', marginBottom: '4px' }}>
              Project
            </label>
            <select
              className="form-select"
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
            >
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name} ({p.id})</option>
              ))}
            </select>
          </div>

          {/* Sprint Filter */}
          <div style={{ minWidth: '180px' }}>
            <label style={{ fontSize: '0.74rem', fontWeight: 700, color: '#64748B', display: 'block', marginBottom: '4px' }}>
              Sprint Scope
            </label>
            <select
              className="form-select"
              value={selectedSprintFilter}
              onChange={(e) => setSelectedSprintFilter(e.target.value)}
            >
              <option value="none">Backlog (Unassigned)</option>
              <option value="all">All Project Issues</option>
              {projectSprints.map(s => (
                <option key={s.id} value={s.id}>{s.name} ({s.status})</option>
              ))}
            </select>
          </div>

          {/* Search Field */}
          <div style={{ flex: 1, minWidth: '220px' }}>
            <label style={{ fontSize: '0.74rem', fontWeight: 700, color: '#64748B', display: 'block', marginBottom: '4px' }}>
              Search Deliverables
            </label>
            <div style={{ position: 'relative' }}>
              <Search size={15} style={{ position: 'absolute', left: '10px', top: '11px', color: '#94A3B8' }} />
              <input
                type="text"
                className="form-input"
                style={{ paddingLeft: '32px' }}
                placeholder="Search by ID, title, module..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          {/* Type Filter */}
          <div style={{ minWidth: '140px' }}>
            <label style={{ fontSize: '0.74rem', fontWeight: 700, color: '#64748B', display: 'block', marginBottom: '4px' }}>
              Issue Type
            </label>
            <select
              className="form-select"
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
            >
              <option value="All">All Types</option>
              <option value="Bug">Bug</option>
              <option value="Feature Request">Feature Request</option>
              <option value="Enhancement">Enhancement</option>
              <option value="Technical Debt">Technical Debt</option>
            </select>
          </div>

          {/* Severity Filter */}
          <div style={{ minWidth: '120px' }}>
            <label style={{ fontSize: '0.74rem', fontWeight: 700, color: '#64748B', display: 'block', marginBottom: '4px' }}>
              Severity
            </label>
            <select
              className="form-select"
              value={selectedSeverity}
              onChange={(e) => setSelectedSeverity(e.target.value)}
            >
              <option value="All">All Severities</option>
              <option value="Critical">Critical</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>

          {/* Priority Filter */}
          <div style={{ minWidth: '120px' }}>
            <label style={{ fontSize: '0.74rem', fontWeight: 700, color: '#64748B', display: 'block', marginBottom: '4px' }}>
              Priority
            </label>
            <select
              className="form-select"
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value)}
            >
              <option value="All">All Priorities</option>
              <option value="P1">P1 – Urgent</option>
              <option value="P2">P2 – High</option>
              <option value="P3">P3 – Medium</option>
              <option value="P4">P4 – Low</option>
            </select>
          </div>

        </div>
      </div>

      {/* Backlog Issues Table */}
      <div className="card" style={{ padding: '0', background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', overflow: 'hidden', boxShadow: '0 2px 6px rgba(0,0,0,0.03)' }}>
        {loading ? (
          <div className="loading-container" style={{ padding: '60px 0' }}>
            <div className="spinner"></div>
            <p>Loading project backlog issues...</p>
          </div>
        ) : issues.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748B' }}>
            <CheckCircle2 size={40} style={{ color: '#10B981', marginBottom: '10px' }} />
            <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#1E293B' }}>Backlog is Empty</div>
            <div style={{ fontSize: '0.84rem', color: '#64748B', marginTop: '4px' }}>
              All issues in this view have been assigned or resolved.
            </div>
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Issue ID</th>
                  <th>Title</th>
                  <th>Type</th>
                  <th>Module</th>
                  <th>Severity</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Assignee</th>
                  <th>Sprint</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {issues.map(issue => (
                  <tr key={issue.id}>
                    <td style={{ fontWeight: 700, color: '#2563EB', whiteSpace: 'nowrap' }}>
                      <Link to={`/issues/${issue.id}`} style={{ color: '#2563EB', textDecoration: 'none' }}>
                        {issue.id}
                      </Link>
                    </td>
                    <td style={{ fontWeight: 600, maxWidth: '280px' }}>
                      <Link to={`/issues/${issue.id}`} style={{ color: '#1E293B', textDecoration: 'none' }}>
                        {issue.title}
                      </Link>
                    </td>
                    <td>
                      <span className="badge badge-type" style={{ fontSize: '0.74rem' }}>{issue.issue_type}</span>
                    </td>
                    <td>
                      <span className="badge badge-module" style={{ fontSize: '0.74rem' }}>
                        {issue.affected_module || issue.component || 'Other'}
                      </span>
                    </td>
                    <td>
                      <span className={`badge badge-sev-${(issue.severity || 'Medium').toLowerCase()}`}>
                        {issue.severity}
                      </span>
                    </td>
                    <td>
                      <span className={`badge badge-pri-${(issue.priority_level || issue.priority || 'P2').toLowerCase()}`}>
                        {issue.priority}
                      </span>
                    </td>
                    <td>
                      <span className={`badge badge-${(issue.status || 'open').toLowerCase().replace(' ', '-')}`}>
                        {issue.status}
                      </span>
                    </td>
                    <td>{issue.assignee_name || 'Unassigned'}</td>
                    <td>
                      {issue.sprint_name ? (
                        <span className="badge" style={{ background: '#EFF6FF', color: '#2563EB', fontSize: '0.72rem' }}>
                          {issue.sprint_name}
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.76rem', color: '#94A3B8', fontStyle: 'italic' }}>
                          Backlog
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
                        {canManageSprint && !issue.sprint_id && activeOrPlannedSprints.length > 0 && (
                          <div style={{ display: 'inline-flex', gap: '4px', alignItems: 'center' }}>
                            <select
                              className="form-select"
                              style={{ width: 'auto', padding: '3px 8px', fontSize: '0.75rem', height: '28px' }}
                              defaultValue=""
                              onChange={(e) => {
                                if (e.target.value) {
                                  handleAssignToSprint(issue.id, e.target.value);
                                  e.target.value = "";
                                }
                              }}
                            >
                              <option value="" disabled>+ Add to Sprint</option>
                              {activeOrPlannedSprints.map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                              ))}
                            </select>
                          </div>
                        )}

                        <Link to={`/issues/${issue.id}`} className="btn btn-secondary" style={{ padding: '3px 8px', fontSize: '0.75rem' }}>
                          Details →
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
