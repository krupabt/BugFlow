import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Layers,
  Plus,
  Calendar,
  FolderGit2,
  Bug,
  CheckCircle2,
  Clock,
  AlertCircle,
  X
} from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

export default function Sprints() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [sprints, setSprints] = useState([]);
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(searchParams.get('project_id') || '');
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
            Track agile sprints, timeline commitments, and associated backlog deliverables
          </p>
        </div>
        {(user?.role === 'Admin' || user?.role === 'Project Manager') && (
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

      {/* Filter Bar */}
      <div className="filter-bar">
        <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#24243B' }}>
          Filter by Project:
        </label>
        <select
          className="form-select"
          style={{ width: 'auto', minWidth: '220px' }}
          value={selectedProject}
          onChange={(e) => setSelectedProject(e.target.value)}
        >
          <option value="">All Projects (48 Sprints)</option>
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

      {/* Sprints Table */}
      {loading ? (
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading sprints from database...</p>
        </div>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Sprint ID</th>
                <th>Sprint Name</th>
                <th>Project</th>
                <th>Start Date</th>
                <th>End Date</th>
                <th>Status</th>
                <th>Issues</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sprints.map((s) => (
                <tr key={s.id}>
                  <td style={{ fontWeight: 700, color: '#6754E8' }}>{s.id}</td>
                  <td style={{ fontWeight: 600 }}>{s.sprint_name}</td>
                  <td>{s.project_name || s.project_id}</td>
                  <td>{s.start_date || '—'}</td>
                  <td>{s.end_date || '—'}</td>
                  <td>
                    <span className={`badge badge-${s.status === 'COMPLETED' ? 'resolved' : (s.status === 'ACTIVE' ? 'progress' : 'open')}`}>
                      {s.status}
                    </span>
                  </td>
                  <td>
                    <button
                      style={{
                        background: '#F0EDFE',
                        color: '#6754E8',
                        border: 'none',
                        padding: '4px 10px',
                        borderRadius: '4px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        fontSize: '0.78rem'
                      }}
                      onClick={() => navigate(`/issues?sprint_id=${s.id}`)}
                    >
                      {s.issue_count} Issues →
                    </button>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {(user?.role === 'Admin' || user?.role === 'Project Manager') && (
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
                    <option value="">Select Project</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.id})</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Sprint Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    required
                    placeholder="e.g. Sprint 7"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div className="form-grid-2">
                  <div className="form-group">
                    <label className="form-label">Start Date</label>
                    <input
                      type="date"
                      className="form-input"
                      value={formData.start_date}
                      onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">End Date</label>
                    <input
                      type="date"
                      className="form-input"
                      value={formData.end_date}
                      onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Sprint Goal</label>
                  <textarea
                    className="form-textarea"
                    rows="2"
                    placeholder="Key deliverable or objective..."
                    value={formData.goal}
                    onChange={(e) => setFormData({ ...formData, goal: e.target.value })}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setCreateModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Sprint
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
