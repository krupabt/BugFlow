import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FolderGit2,
  Plus,
  Edit,
  Users,
  Layers,
  Bug,
  Calendar,
  X,
  CheckCircle,
  AlertTriangle,
  ArrowRight
} from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

export default function Projects() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Selected project for drawer/details
  const [selectedProject, setSelectedProject] = useState(null);
  const [projectDetails, setProjectDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalProject, setEditModalProject] = useState(null);
  const [pmList, setPmList] = useState([]);

  // Form states
  const [projectName, setProjectName] = useState('');
  const [projectDesc, setProjectDesc] = useState('');
  const [selectedPm, setSelectedPm] = useState('');

  const loadProjects = async () => {
    setLoading(true);
    try {
      const data = await api.getProjects({ include_stats: true });
      setProjects(data);
    } catch (err) {
      setError(err.message || 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
    async function fetchPMs() {
      try {
        const users = await api.getUsers();
        setPmList(users.filter(u => u.role === 'Project Manager' || u.role === 'Admin'));
      } catch (err) {
        console.error('Failed to load PMs:', err);
      }
    }
    fetchPMs();
  }, []);

  const handleSelectProject = async (proj) => {
    setSelectedProject(proj);
    setLoadingDetails(true);
    try {
      const details = await api.getProject(proj.id);
      setProjectDetails(details);
    } catch (err) {
      console.error('Failed to load project details:', err);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleCreateProject = async (e) => {
    e.preventDefault();
    try {
      await api.createProject({
        name: projectName,
        description: projectDesc,
        project_manager_id: selectedPm || undefined
      });
      setNotice('Project created successfully!');
      setTimeout(() => setNotice(''), 3000);
      setCreateModalOpen(false);
      setProjectName('');
      setProjectDesc('');
      setSelectedPm('');
      loadProjects();
    } catch (err) {
      setError(err.message || 'Failed to create project');
    }
  };

  const handleEditProject = async (e) => {
    e.preventDefault();
    if (!editModalProject) return;
    try {
      await api.updateProject(editModalProject.id, editModalProject);
      setNotice('Project updated successfully!');
      setTimeout(() => setNotice(''), 3000);
      setEditModalProject(null);
      loadProjects();
      if (selectedProject?.id === editModalProject.id) {
        handleSelectProject(editModalProject);
      }
    } catch (err) {
      setError(err.message || 'Failed to update project');
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Projects</h1>
          <p className="page-subtitle">
            Manage projects, monitor sprint deliverables and issue resolution progress
          </p>
        </div>
        {(user?.role === 'Admin' || user?.role === 'Project Manager') && (
          <button className="btn btn-primary" onClick={() => setCreateModalOpen(true)}>
            <Plus size={16} />
            <span>New Project</span>
          </button>
        )}
      </div>

      {notice && (
        <div className="toast-notice toast-success">
          <CheckCircle size={18} />
          <span>{notice}</span>
        </div>
      )}

      {error && (
        <div className="toast-notice toast-error">
          <AlertTriangle size={18} />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading projects from database...</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: selectedProject ? '1.4fr 1fr' : '1fr', gap: '24px' }}>
          
          {/* Projects Table */}
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Project ID</th>
                  <th>Project Name</th>
                  <th>Project Manager</th>
                  <th>Status</th>
                  <th>Total Issues</th>
                  <th>Open</th>
                  <th>Progress</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((p) => {
                  const isSelected = selectedProject?.id === p.id;
                  return (
                    <tr
                      key={p.id}
                      style={{
                        backgroundColor: isSelected ? '#F0EDFE' : undefined,
                        cursor: 'pointer'
                      }}
                      onClick={() => handleSelectProject(p)}
                    >
                      <td style={{ fontWeight: 700, color: '#6754E8' }}>{p.id}</td>
                      <td style={{ fontWeight: 600 }}>{p.name}</td>
                      <td>{p.project_manager_name || 'Unassigned'}</td>
                      <td>
                        <span className={`badge badge-${p.lifecycle_status === 'ACTIVE' ? 'resolved' : 'closed'}`}>
                          {p.lifecycle_status}
                        </span>
                      </td>
                      <td>{p.total_issues || 0}</td>
                      <td style={{ color: '#EF4444', fontWeight: 600 }}>{p.open_issues || 0}</td>
                      <td style={{ minWidth: '120px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ flex: 1, height: '6px', background: '#F1F3F9', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${p.progress || 0}%`, background: '#6754E8' }} />
                          </div>
                          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#74748B' }}>{p.progress || 0}%</span>
                        </div>
                      </td>
                      <td style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <button
                            className="btn btn-secondary"
                            style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                            onClick={() => handleSelectProject(p)}
                          >
                            Details
                          </button>
                          {(user?.role === 'Admin' || user?.role === 'Project Manager') && (
                            <button
                              className="btn-icon"
                              title="Edit Project"
                              onClick={() => setEditModalProject({ ...p })}
                            >
                              <Edit size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Project Details Panel */}
          {selectedProject && (
            <div className="card" style={{ position: 'sticky', top: '24px', height: 'fit-content' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#6754E8' }}>{selectedProject.id}</span>
                  <h2 style={{ fontSize: '1.15rem', fontWeight: 700 }}>{selectedProject.name}</h2>
                </div>
                <button className="btn-icon" onClick={() => setSelectedProject(null)}>
                  <X size={18} />
                </button>
              </div>

              <p style={{ fontSize: '0.875rem', color: '#74748B', marginBottom: '16px' }}>
                {selectedProject.description || 'No description provided.'}
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', padding: '12px', background: '#F8F9FD', borderRadius: '8px', marginBottom: '16px', fontSize: '0.82rem' }}>
                <div>
                  <span style={{ color: '#74748B', display: 'block' }}>Project Manager:</span>
                  <strong>{selectedProject.project_manager_name || 'Unassigned'}</strong>
                </div>
                <div>
                  <span style={{ color: '#74748B', display: 'block' }}>Status:</span>
                  <strong>{selectedProject.lifecycle_status}</strong>
                </div>
              </div>

              {/* Associated Sprints */}
              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <h3 style={{ fontSize: '0.88rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Layers size={15} /> Associated Sprints
                  </h3>
                  <button
                    style={{ fontSize: '0.75rem', color: '#6754E8', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                    onClick={() => navigate(`/sprints?project_id=${selectedProject.id}`)}
                  >
                    View in Sprints →
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '140px', overflowY: 'auto' }}>
                  {(projectDetails?.sprints || []).length === 0 ? (
                    <span style={{ fontSize: '0.8rem', color: '#74748B' }}>No sprints recorded.</span>
                  ) : (
                    projectDetails.sprints.slice(0, 5).map(s => (
                      <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 8px', background: '#F1F3F9', borderRadius: '4px', fontSize: '0.78rem' }}>
                        <span>{s.sprint_name}</span>
                        <span className={`badge badge-${s.status === 'COMPLETED' ? 'resolved' : 'open'}`}>{s.status}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Associated Issues shortcut */}
              <button
                className="btn btn-primary"
                style={{ width: '100%', fontSize: '0.85rem' }}
                onClick={() => navigate(`/issues?project_id=${selectedProject.id}`)}
              >
                <Bug size={16} />
                <span>View All {selectedProject.total_issues || 0} Issues for {selectedProject.id}</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Create Project Modal */}
      {createModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h2 className="modal-title">Create New Project</h2>
              <button className="btn-icon" onClick={() => setCreateModalOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateProject}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Project Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    required
                    placeholder="e.g. Mobile Banking Application"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea
                    className="form-textarea"
                    rows="3"
                    placeholder="Project scope and goals..."
                    value={projectDesc}
                    onChange={(e) => setProjectDesc(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Project Manager</label>
                  <select
                    className="form-select"
                    value={selectedPm}
                    onChange={(e) => setSelectedPm(e.target.value)}
                  >
                    <option value="">Select Project Manager</option>
                    {pmList.map(pm => (
                      <option key={pm.id} value={pm.id}>{pm.name} ({pm.role})</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setCreateModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Create Project in Database
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Project Modal */}
      {editModalProject && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h2 className="modal-title">Edit Project #{editModalProject.id}</h2>
              <button className="btn-icon" onClick={() => setEditModalProject(null)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleEditProject}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Project Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    required
                    value={editModalProject.name || ''}
                    onChange={(e) => setEditModalProject({ ...editModalProject, name: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea
                    className="form-textarea"
                    rows="3"
                    value={editModalProject.description || ''}
                    onChange={(e) => setEditModalProject({ ...editModalProject, description: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Project Manager</label>
                  <select
                    className="form-select"
                    value={editModalProject.project_manager_id || ''}
                    onChange={(e) => setEditModalProject({ ...editModalProject, project_manager_id: e.target.value })}
                  >
                    <option value="">Unassigned</option>
                    {pmList.map(pm => (
                      <option key={pm.id} value={pm.id}>{pm.name} ({pm.role})</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Lifecycle Status</label>
                  <select
                    className="form-select"
                    value={editModalProject.lifecycle_status || 'ACTIVE'}
                    onChange={(e) => setEditModalProject({ ...editModalProject, lifecycle_status: e.target.value })}
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="COMPLETED">COMPLETED</option>
                    <option value="ARCHIVED">ARCHIVED</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setEditModalProject(null)}>
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
    </div>
  );
}
