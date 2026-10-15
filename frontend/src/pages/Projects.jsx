import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FolderGit2, Plus, Users, Bug, AlertCircle, X, CheckCircle2 } from 'lucide-react';
import Header from '../components/Header';
import { api } from '../api';

export default function Projects() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Create Project Modal
  const [showModal, setShowModal] = useState(false);
  const [key, setKey] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const loadProjects = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getProjects();
      setProjects(data);
    } catch (err) {
      console.warn('Projects load error:', err);
      setError('Could not load projects from database. Please verify backend connectivity.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

  const handleCreateProject = async (e) => {
    e.preventDefault();
    setCreateError('');
    setCreating(true);
    try {
      await api.createProject({ key, name, description });
      setShowModal(false);
      setKey('');
      setName('');
      setDescription('');
      loadProjects();
    } catch (err) {
      setCreateError(err.message || 'Failed to create project.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div>
      <Header title="Projects Management" />

      <div className="content-body">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '24px',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div>
            <h2 style={{ fontSize: '1.3rem', fontWeight: '700' }}>Software Projects</h2>
            <p style={{ color: '#64748b', fontSize: '0.88rem', marginTop: '4px' }}>
              Manage defect tracking across software modules and repositories.
            </p>
          </div>

          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={16} />
            <span>Create Project</span>
          </button>
        </div>

        {error && (
          <div className="alert alert-error">
            <AlertCircle size={18} />
            <div>{error}</div>
          </div>
        )}

        {/* Project Cards Grid */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '50px', color: '#64748b' }}>
            Loading software projects...
          </div>
        ) : projects.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '50px', color: '#64748b' }}>
            <FolderGit2 size={36} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
            <p style={{ fontWeight: '600' }}>No projects registered yet</p>
            <p style={{ fontSize: '0.85rem', marginTop: '4px' }}>
              Create your first project to start organizing defects and assigning developers.
            </p>
            <button
              className="btn btn-primary"
              style={{ marginTop: '16px' }}
              onClick={() => setShowModal(true)}
            >
              <Plus size={16} />
              <span>Create First Project</span>
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
            {projects.map((p) => {
              const stats = p.stats || { total_issues: 0, open_issues: 0, in_progress_issues: 0, resolved_issues: 0 };
              return (
                <div key={p.id} className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <span className="badge" style={{ backgroundColor: '#eff6ff', color: '#1d4ed8', fontWeight: '700', fontSize: '0.85rem' }}>
                        {p.key}
                      </span>
                      <span style={{ fontSize: '0.8rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Users size={14} />
                        {p.member_count} Developers
                      </span>
                    </div>

                    <h3 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '8px', color: '#0f172a' }}>
                      {p.name}
                    </h3>

                    <p style={{ fontSize: '0.85rem', color: '#64748b', lineHeight: '1.5', minHeight: '40px' }}>
                      {p.description || 'No description provided.'}
                    </p>
                  </div>

                  <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.82rem', marginBottom: '14px' }}>
                      <div style={{ backgroundColor: '#f8fafc', padding: '8px 10px', borderRadius: '4px' }}>
                        <span style={{ color: '#64748b' }}>Total Issues:</span>{' '}
                        <strong style={{ color: '#0f172a' }}>{stats.total_issues}</strong>
                      </div>
                      <div style={{ backgroundColor: '#eff6ff', padding: '8px 10px', borderRadius: '4px' }}>
                        <span style={{ color: '#1d4ed8' }}>Open:</span>{' '}
                        <strong style={{ color: '#1e40af' }}>{stats.open_issues}</strong>
                      </div>
                    </div>

                    <Link
                      to={`/issues?project_id=${p.id}`}
                      className="btn btn-secondary btn-sm"
                      style={{ width: '100%' }}
                    >
                      <Bug size={14} />
                      <span>View Project Issues</span>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Modal: Create Project */}
        {showModal && (
          <div className="modal-overlay" onClick={() => setShowModal(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3 className="modal-title">Create Software Project</h3>
                <button className="btn-icon" onClick={() => setShowModal(false)}>
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleCreateProject}>
                <div className="modal-body">
                  {createError && (
                    <div className="alert alert-error">
                      <AlertCircle size={16} />
                      <span>{createError}</span>
                    </div>
                  )}

                  <div className="form-group">
                    <label className="form-label">Project Key (Short Identifier)</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. KAFKA, SPARK, CORE"
                      value={key}
                      onChange={(e) => setKey(e.target.value.toUpperCase())}
                      maxLength={10}
                      required
                    />
                    <small style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '2px', display: 'block' }}>
                      Used as prefix for defect tickets (e.g. KAFKA-0001).
                    </small>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Project Name</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Apache Kafka Streaming Platform"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Description</label>
                    <textarea
                      className="form-textarea"
                      placeholder="Brief overview of this project, architecture, or scope..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={3}
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
                    {creating ? 'Creating...' : 'Create Project'}
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
