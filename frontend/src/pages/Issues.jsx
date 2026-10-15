import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Bug,
  Search,
  Filter,
  Plus,
  ArrowUpDown,
  ExternalLink,
  AlertCircle,
  X,
  CheckCircle,
} from 'lucide-react';
import Header from '../components/Header';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

export default function Issues() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [issues, setIssues] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [severityFilter, setSeverityFilter] = useState('All');
  const [projectFilter, setProjectFilter] = useState('');

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // New Issue Modal
  const [showModal, setShowModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newProjectId, setNewProjectId] = useState('');
  const [newSeverity, setNewSeverity] = useState('Medium');
  const [newPriority, setNewPriority] = useState('Medium');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  // Check if URL has ?create=true
  useEffect(() => {
    if (searchParams.get('create') === 'true') {
      setShowModal(true);
    }
  }, [searchParams]);

  // Load Projects for dropdowns
  useEffect(() => {
    async function loadProjects() {
      try {
        const res = await api.getProjects();
        setProjects(res);
        if (res.length > 0 && !newProjectId) {
          setNewProjectId(res[0].id);
        }
      } catch (err) {
        console.warn('Projects loading error:', err);
      }
    }
    loadProjects();
  }, []);

  // Load Issues
  const loadIssues = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.getIssues({
        q: searchQuery,
        status: statusFilter,
        severity: severityFilter,
        project_id: projectFilter,
        page,
        per_page: 15,
      });
      setIssues(res.issues || []);
      setTotalPages(res.pages || 1);
      setTotalCount(res.total || 0);
    } catch (err) {
      console.warn('Issues load error:', err);
      setError('Could not load issues from PostgreSQL. Please verify the backend database connection.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadIssues();
  }, [page, statusFilter, severityFilter, projectFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    loadIssues();
  };

  const handleCreateIssue = async (e) => {
    e.preventDefault();
    setCreateError('');
    if (!newProjectId) {
      setCreateError('Please create or select a project first.');
      return;
    }
    setCreating(true);
    try {
      await api.createIssue({
        title: newTitle,
        description: newDescription,
        project_id: parseInt(newProjectId),
        severity: newSeverity,
        priority: newPriority,
        assignee_id: user?.id,
      });
      setShowModal(false);
      setNewTitle('');
      setNewDescription('');
      setPage(1);
      loadIssues();
    } catch (err) {
      setCreateError(err.message || 'Failed to create issue.');
    } finally {
      setCreating(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Open':
        return <span className="badge badge-open">Open</span>;
      case 'In Progress':
        return <span className="badge badge-inprogress">In Progress</span>;
      case 'Resolved':
        return <span className="badge badge-resolved">Resolved</span>;
      case 'Closed':
        return <span className="badge badge-closed">Closed</span>;
      default:
        return <span className="badge badge-closed">{status}</span>;
    }
  };

  const getSeverityBadge = (sev) => {
    switch (sev) {
      case 'Critical':
        return <span className="badge badge-critical">Critical</span>;
      case 'High':
        return <span className="badge badge-high">High</span>;
      case 'Medium':
        return <span className="badge badge-medium">Medium</span>;
      case 'Low':
        return <span className="badge badge-low">Low</span>;
      default:
        return <span className="badge">{sev}</span>;
    }
  };

  return (
    <div>
      <Header title="Defect Tracking & Issues" onNewIssue={() => setShowModal(true)} />

      <div className="content-body">
        {/* Search & Filter Bar */}
        <div className="card" style={{ marginBottom: '24px', padding: '16px' }}>
          <form
            onSubmit={handleSearchSubmit}
            style={{
              display: 'flex',
              gap: '12px',
              flexWrap: 'wrap',
              alignItems: 'center',
            }}
          >
            {/* Search Input */}
            <div style={{ flex: '1 1 280px', position: 'relative' }}>
              <input
                type="text"
                className="form-input"
                placeholder="Search defects by key, summary, or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ paddingLeft: '36px' }}
              />
              <Search
                size={16}
                color="#94a3b8"
                style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
              />
            </div>

            {/* Status Filter */}
            <select
              className="form-select"
              style={{ width: 'auto', minWidth: '130px' }}
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="All">All Statuses</option>
              <option value="Open">Open</option>
              <option value="In Progress">In Progress</option>
              <option value="Resolved">Resolved</option>
              <option value="Closed">Closed</option>
            </select>

            {/* Severity Filter */}
            <select
              className="form-select"
              style={{ width: 'auto', minWidth: '130px' }}
              value={severityFilter}
              onChange={(e) => {
                setSeverityFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="All">All Severities</option>
              <option value="Critical">Critical</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>

            {/* Project Filter */}
            <select
              className="form-select"
              style={{ width: 'auto', minWidth: '140px' }}
              value={projectFilter}
              onChange={(e) => {
                setProjectFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All Projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.key})
                </option>
              ))}
            </select>

            <button type="submit" className="btn btn-secondary">
              <Filter size={15} />
              <span>Apply</span>
            </button>
          </form>
        </div>

        {error && (
          <div className="alert alert-error">
            <AlertCircle size={18} />
            <div>{error}</div>
          </div>
        )}

        {/* Issue Table */}
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: '120px' }}>Key</th>
                <th>Summary</th>
                <th style={{ width: '130px' }}>Project</th>
                <th style={{ width: '110px' }}>Severity</th>
                <th style={{ width: '120px' }}>Status</th>
                <th style={{ width: '150px' }}>Assignee</th>
                <th style={{ width: '120px' }}>Date</th>
                <th style={{ width: '60px' }}></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                    Loading issues from PostgreSQL database...
                  </td>
                </tr>
              ) : issues.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '50px', color: '#64748b' }}>
                    <Bug size={32} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
                    <p style={{ fontWeight: '600' }}>No defects found</p>
                    <p style={{ fontSize: '0.85rem', marginTop: '4px' }}>
                      Try adjusting your search criteria or report a new defect issue.
                    </p>
                  </td>
                </tr>
              ) : (
                issues.map((item) => (
                  <tr key={item.id}>
                    <td style={{ fontWeight: '600', color: '#2563eb' }}>
                      <Link to={`/issues/${item.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                        {item.issue_key}
                      </Link>
                    </td>
                    <td>
                      <Link
                        to={`/issues/${item.id}`}
                        style={{
                          textDecoration: 'none',
                          color: '#0f172a',
                          fontWeight: '500',
                          display: 'block',
                          maxWidth: '450px',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {item.title}
                      </Link>
                      {item.is_historical && (
                        <span className="badge badge-historical" style={{ marginTop: '3px' }}>
                          Historical Dataset
                        </span>
                      )}
                    </td>
                    <td>
                      <span style={{ fontSize: '0.85rem', color: '#475569', fontWeight: '500' }}>
                        {item.project_name || item.project_key || 'System'}
                      </span>
                    </td>
                    <td>{getSeverityBadge(item.severity)}</td>
                    <td>{getStatusBadge(item.status)}</td>
                    <td style={{ fontSize: '0.85rem' }}>{item.assignee_name || 'Unassigned'}</td>
                    <td style={{ fontSize: '0.8rem', color: '#64748b' }}>
                      {item.created_at ? new Date(item.created_at).toLocaleDateString() : '-'}
                    </td>
                    <td>
                      <Link to={`/issues/${item.id}`} className="btn-icon" title="View Issue Details">
                        <ExternalLink size={15} />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: '20px',
            fontSize: '0.85rem',
            color: '#64748b',
          }}
        >
          <div>
            Showing {issues.length} of {totalCount} defect issues
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className="btn btn-secondary btn-sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(p - 1, 1))}
            >
              Previous
            </button>
            <span style={{ padding: '4px 10px', alignSelf: 'center' }}>
              Page {page} of {totalPages || 1}
            </span>
            <button
              className="btn btn-secondary btn-sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </div>

        {/* Modal: Create Issue */}
        {showModal && (
          <div className="modal-overlay" onClick={() => setShowModal(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3 className="modal-title">Report New Defect</h3>
                <button className="btn-icon" onClick={() => setShowModal(false)}>
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleCreateIssue}>
                <div className="modal-body">
                  {createError && (
                    <div className="alert alert-error">
                      <AlertCircle size={16} />
                      <span>{createError}</span>
                    </div>
                  )}

                  <div className="form-group">
                    <label className="form-label">Associated Project</label>
                    <select
                      className="form-select"
                      value={newProjectId}
                      onChange={(e) => setNewProjectId(e.target.value)}
                      required
                    >
                      {projects.length === 0 ? (
                        <option value="">No projects found. Please create a project first.</option>
                      ) : (
                        projects.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.key})
                          </option>
                        ))
                      )}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Issue Title / Summary</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Null pointer exception during batch message flush"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      required
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                    <div className="form-group">
                      <label className="form-label">Severity</label>
                      <select
                        className="form-select"
                        value={newSeverity}
                        onChange={(e) => setNewSeverity(e.target.value)}
                      >
                        <option value="Critical">Critical</option>
                        <option value="High">High</option>
                        <option value="Medium">Medium</option>
                        <option value="Low">Low</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Priority</label>
                      <select
                        className="form-select"
                        value={newPriority}
                        onChange={(e) => setNewPriority(e.target.value)}
                      >
                        <option value="Blocker">Blocker</option>
                        <option value="Critical">Critical</option>
                        <option value="Major">Major</option>
                        <option value="Minor">Minor</option>
                        <option value="Trivial">Trivial</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Detailed Description & Error Reproduction</label>
                    <textarea
                      className="form-textarea"
                      placeholder="Provide full details, stack traces, logs, or steps to reproduce the issue..."
                      value={newDescription}
                      onChange={(e) => setNewDescription(e.target.value)}
                      rows={4}
                    />
                  </div>
                </div>

                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowModal(false)}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={creating}>
                    {creating ? 'Submitting...' : 'Submit Defect Report'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
