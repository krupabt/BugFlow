import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import {
  Layers,
  Plus,
  Calendar,
  FolderGit2,
  Bug,
  CheckCircle2,
  Clock,
  AlertCircle,
  X,
  ExternalLink,
  ChevronRight
} from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

export default function Sprints() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const normRole = (user?.role || '').toUpperCase().replace(/ /g, '_');
  const canManageSprint = normRole === 'ADMIN' || normRole === 'PROJECT_MANAGER';

  const [sprints, setSprints] = useState([]);
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(searchParams.get('project_id') || '');
  const [viewMode, setViewMode] = useState('cards'); // 'cards' | 'table'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Create sprint modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    project_id: '',
    name: '',
    goal: '',
    start_date: '',
    end_date: ''
  });
  const [creating, setCreating] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [spRes, projRes] = await Promise.all([
        api.getSprints({ project_id: selectedProject || undefined }),
        api.getProjects({ include_stats: false })
      ]);
      setSprints(spRes);
      setProjects(projRes);
    } catch (err) {
      setError(err.message || 'Failed to load sprints');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedProject]);

  const handleCreateSprint = async (e) => {
    e.preventDefault();
    if (formData.start_date && formData.end_date && formData.end_date < formData.start_date) {
      setError('End date cannot be earlier than start date.');
      return;
    }
    setCreating(true);
    try {
      await api.createSprint(formData);
      setNotice('Sprint created successfully!');
      setTimeout(() => setNotice(''), 3000);
      setCreateModalOpen(false);
      setFormData({
        project_id: projects[0]?.id || '',
        name: '',
        goal: '',
        start_date: '',
        end_date: ''
      });
      loadData();
    } catch (err) {
      setError(err.message || 'Failed to create sprint');
    } finally {
      setCreating(false);
    }
  };

  const handleStatusChange = async (sprintId, newStatus) => {
    try {
      await api.updateSprintStatus(sprintId, newStatus);
      setNotice(`Sprint status changed to ${newStatus}`);
      setTimeout(() => setNotice(''), 3000);
      loadData();
    } catch (err) {
      setError(err.message || 'Failed to update sprint status');
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Sprint Management</h1>
          <p className="page-subtitle">
            Track agile sprints, timeline commitments, sprint boards, and associated backlog deliverables
          </p>
        </div>
        {canManageSprint && (
          <button className="btn btn-primary" onClick={() => setCreateModalOpen(true)}>
            <Plus size={16} />
            <span>Create Sprint</span>
          </button>
        )}
      </div>

      {notice && (
        <div className="toast-notice toast-success">
          <CheckCircle2 size={18} />
          <span>{notice}</span>
        </div>
      )}

      {error && (
        <div className="toast-notice toast-error">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Filter Bar & View Toggle */}
      <div className="filter-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#24243B' }}>
            Filter by Project:
          </label>
          <select
            className="form-select"
            style={{ width: 'auto', minWidth: '220px' }}
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
          >
            <option value="">{normRole === 'ADMIN' ? 'All Projects (48 Sprints)' : 'All My Projects'}</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name} ({p.id})</option>
            ))}
          </select>
          {selectedProject && (
            <button
              className="btn btn-secondary"
              style={{ padding: '6px 12px', fontSize: '0.8rem' }}
              onClick={() => setSelectedProject('')}
            >
              Show All
            </button>
          )}
        </div>

        {/* View Mode Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#F1F5F9', padding: '3px', borderRadius: '7px' }}>
          <button
            type="button"
            onClick={() => setViewMode('cards')}
            style={{
              border: 'none',
              background: viewMode === 'cards' ? '#FFFFFF' : 'transparent',
              color: viewMode === 'cards' ? '#2563EB' : '#64748B',
              fontWeight: 700,
              fontSize: '0.78rem',
              padding: '5px 12px',
              borderRadius: '5px',
              cursor: 'pointer',
              boxShadow: viewMode === 'cards' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none'
            }}
          >
            Sprint Cards
          </button>
          <button
            type="button"
            onClick={() => setViewMode('table')}
            style={{
              border: 'none',
              background: viewMode === 'table' ? '#FFFFFF' : 'transparent',
              color: viewMode === 'table' ? '#2563EB' : '#64748B',
              fontWeight: 700,
              fontSize: '0.78rem',
              padding: '5px 12px',
              borderRadius: '5px',
              cursor: 'pointer',
              boxShadow: viewMode === 'table' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none'
            }}
          >
            Table View
          </button>
        </div>
      </div>

      {/* Sprints Content */}
      {loading ? (
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading sprints from database...</p>
        </div>
      ) : sprints.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px 16px', color: '#817B86', background: '#FFFFFF' }}>
          <Layers size={36} style={{ color: '#2563EB', marginBottom: '8px', opacity: 0.8 }} />
          <div style={{ fontWeight: 600, fontSize: '0.95rem', color: '#393442' }}>No sprints found</div>
          <div style={{ fontSize: '0.82rem', marginTop: '4px' }}>
            {selectedProject
              ? 'There are no sprints recorded for the selected project.'
              : 'No accessible sprints available.'}
          </div>
        </div>
      ) : viewMode === 'cards' ? (
        /* CARDS VIEW – Compact, individual sprint cards */
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '16px',
            marginTop: '16px'
          }}
        >
          {sprints.map((s) => (
            <div
              key={s.id}
              onClick={() => navigate(`/sprints/${s.id}`)}
              style={{
                background: '#FFFFFF',
                borderRadius: '10px',
                border: '1px solid #E2E8F0',
                padding: '16px 18px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                cursor: 'pointer',
                transition: 'transform 0.12s ease, box-shadow 0.12s ease, border-color 0.12s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.06)';
                e.currentTarget.style.borderColor = '#93C5FD';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'none';
                e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.03)';
                e.currentTarget.style.borderColor = '#E2E8F0';
              }}
            >
              <div>
                {/* Header: Project name, Sprint name, Status */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <div>
                    <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#E97862', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                      {s.project_name || s.project_id}
                    </span>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0F172A', margin: '2px 0 0 0' }}>
                      {s.sprint_name || s.name}
                    </h3>
                  </div>
                  <span
                    className={`badge badge-${s.status === 'COMPLETED' ? 'resolved' : (s.status === 'ACTIVE' ? 'progress' : 'open')}`}
                    style={{ fontSize: '0.72rem', padding: '2px 8px' }}
                  >
                    ● {s.status}
                  </span>
                </div>

                {/* Dates */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: '#64748B', marginBottom: '12px' }}>
                  <Calendar size={13} color="#2563EB" />
                  <span>
                    {s.start_date || '—'} – {s.end_date || '—'}
                  </span>
                  <span style={{ color: '#94A3B8' }}>({s.duration_label || '14 days'})</span>
                </div>

                {/* Mini Stats: Total, Completed, Progress */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', textAlign: 'center', marginBottom: '12px' }}>
                  <div style={{ background: '#F8FAFC', padding: '6px 4px', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
                    <div style={{ fontSize: '0.96rem', fontWeight: 800, color: '#0F172A' }}>{s.total_issues ?? s.issue_count ?? 0}</div>
                    <div style={{ fontSize: '0.66rem', color: '#64748B' }}>Total</div>
                  </div>
                  <div style={{ background: '#F0FDF4', padding: '6px 4px', borderRadius: '6px', border: '1px solid #BBF7D0' }}>
                    <div style={{ fontSize: '0.96rem', fontWeight: 800, color: '#15803D' }}>{s.completed_issues ?? 0}</div>
                    <div style={{ fontSize: '0.66rem', color: '#166534' }}>Done</div>
                  </div>
                  <div style={{ background: '#EFF6FF', padding: '6px 4px', borderRadius: '6px', border: '1px solid #BFDBFE' }}>
                    <div style={{ fontSize: '0.96rem', fontWeight: 800, color: '#2563EB' }}>
                      {Math.max(0, (s.total_issues ?? s.issue_count ?? 0) - (s.completed_issues ?? 0))}
                    </div>
                    <div style={{ fontSize: '0.66rem', color: '#1D4ED8' }}>Remain</div>
                  </div>
                </div>

                {/* Progress bar */}
                <div style={{ marginBottom: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#64748B', fontWeight: 600, marginBottom: '4px' }}>
                    <span>Completion</span>
                    <span style={{ color: '#15803D', fontWeight: 800 }}>{s.progress || 0}%</span>
                  </div>
                  <div style={{ width: '100%', height: '6px', background: '#E2E8F0', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ width: `${s.progress || 0}%`, height: '100%', background: '#10B981', borderRadius: '3px' }} />
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #F1F5F9', paddingTop: '10px' }}>
                <span style={{ fontSize: '0.74rem', color: '#94A3B8', fontWeight: 600 }}>{s.id}</span>
                <span
                  style={{
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    color: '#2563EB',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <span>Open Sprint Board</span>
                  <ChevronRight size={14} />
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* TABLE VIEW */
        <div className="table-container" style={{ marginTop: '16px' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Sprint ID</th>
                <th>Sprint Name</th>
                <th>Project</th>
                <th>Start Date</th>
                <th>End Date</th>
                <th>Duration</th>
                <th>Sprint Status</th>
                <th>Total Issues</th>
                <th>Completed Issues</th>
                <th>Progress</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sprints.map((s) => (
                <tr key={s.id}>
                  <td style={{ fontWeight: 700, color: '#E97862' }}>{s.id}</td>
                  <td style={{ fontWeight: 700 }}>
                    <Link to={`/sprints/${s.id}`} style={{ color: '#292338', textDecoration: 'none' }}>
                      {s.sprint_name || s.name}
                    </Link>
                  </td>
                  <td>{s.project_name || s.project_id}</td>
                  <td>{s.start_date || '—'}</td>
                  <td>{s.end_date || '—'}</td>
                  <td>{s.duration_label || '—'}</td>
                  <td>
                    <span className={`badge badge-${s.status === 'COMPLETED' ? 'resolved' : (s.status === 'ACTIVE' ? 'progress' : 'open')}`}>
                      {s.status}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontWeight: 600 }}>{s.total_issues ?? s.issue_count ?? 0}</span>
                  </td>
                  <td>
                    <span style={{ fontWeight: 600, color: '#15803D' }}>{s.completed_issues ?? 0}</span>
                  </td>
                  <td style={{ minWidth: '120px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ flex: 1, height: '6px', background: '#F5F1EC', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${s.progress || 0}%`, background: '#10B981' }} />
                      </div>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#817B86' }}>{s.progress || 0}%</span>
                    </div>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '4px 10px', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                        onClick={() => navigate(`/sprints/${s.id}`)}
                      >
                        <span>Board</span> <ChevronRight size={13} />
                      </button>
                      {canManageSprint && (
                        <select
                          className="form-select"
                          style={{ width: 'auto', padding: '4px 8px', fontSize: '0.75rem' }}
                          value={s.status}
                          onChange={(e) => handleStatusChange(s.id, e.target.value)}
                        >
                          <option value="PLANNED">PLANNED</option>
                          <option value="ACTIVE">ACTIVE</option>
                          <option value="COMPLETED">COMPLETED</option>
                        </select>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Sprint Modal */}
      {createModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h2 className="modal-title">Create New Sprint</h2>
              <button className="btn-icon" onClick={() => setCreateModalOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateSprint}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Project *</label>
                  <select
                    className="form-select"
                    required
                    value={formData.project_id}
                    onChange={(e) => setFormData({ ...formData, project_id: e.target.value })}
                  >
                    <option value="">Select Target Project</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.id})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Sprint Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    required
                    placeholder="e.g. Sprint 14 - Checkout Optimization"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Goal / Objectives</label>
                  <textarea
                    className="form-textarea"
                    rows="2"
                    placeholder="Brief description of deliverables and goal..."
                    value={formData.goal}
                    onChange={(e) => setFormData({ ...formData, goal: e.target.value })}
                  />
                </div>

                <div className="form-grid-2">
                  <div className="form-group">
                    <label className="form-label">Start Date *</label>
                    <input
                      type="date"
                      className="form-input"
                      required
                      value={formData.start_date}
                      onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">End Date *</label>
                    <input
                      type="date"
                      className="form-input"
                      required
                      value={formData.end_date}
                      onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setCreateModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={creating}>
                  {creating ? 'Creating...' : 'Create Sprint'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
