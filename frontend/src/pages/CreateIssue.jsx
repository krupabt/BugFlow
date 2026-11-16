import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Bug,
  Save,
  CheckCircle2,
  AlertCircle,
  FolderGit2,
  UserCheck,
  ShieldAlert,
  Layers,
  Paperclip,
  Upload,
  FileText,
  FileCode,
  Image as ImageIcon,
  File,
  X,
  Trash2
} from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

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
  "Other"
];

const ALLOWED_EXTENSIONS = ['png', 'jpg', 'jpeg', 'pdf', 'txt', 'log', 'doc', 'docx', 'csv'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function getFileIcon(filename) {
  const ext = (filename || '').split('.').pop().toLowerCase();
  if (['png', 'jpg', 'jpeg'].includes(ext)) {
    return <ImageIcon size={18} color="#2563EB" />;
  }
  if (['log', 'txt'].includes(ext)) {
    return <FileCode size={18} color="#D97706" />;
  }
  if (['doc', 'docx', 'pdf', 'csv'].includes(ext)) {
    return <FileText size={18} color="#059669" />;
  }
  return <File size={18} color="#6B7280" />;
}

export default function CreateIssue() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const fileInputRef = useRef(null);

  const [projects, setProjects] = useState([]);
  const [developers, setDevelopers] = useState([]);
  const [sprints, setSprints] = useState([]);
  const [loadingLookups, setLoadingLookups] = useState(true);

  // Attachments State
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    project_id: '',
    title: '',
    description: '',
    issue_type: 'Bug',
    severity: 'Medium',
    priority: 'P2',
    affected_module: 'Login',
    custom_module: '',
    assigned_to: '',
    status: 'Open',
    component: '',
    environment: 'Development',
    steps_to_reproduce: '',
    expected_result: '',
    actual_result: '',
    sprint_id: ''
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    async function loadFormLookups() {
      setLoadingLookups(true);
      try {
        const [projRes, devRes, sprintRes] = await Promise.all([
          api.getProjects({ include_stats: false }),
          api.getUsers({ role: 'DEVELOPER', active: 'true' }),
          api.getSprints()
        ]);
        setProjects(projRes || []);
        setDevelopers(devRes || []);
        setSprints(sprintRes || []);
        if (projRes && projRes.length > 0) {
          setFormData(prev => ({ ...prev, project_id: projRes[0].id }));
        }
      } catch (err) {
        console.error('Failed to load project/developer lookups:', err);
        setError('Could not load projects and developers. Please ensure the service is running.');
      } finally {
        setLoadingLookups(false);
      }
    }
    loadFormLookups();
  }, []);

  const handleFilesAdded = (fileList) => {
    setError('');
    const incoming = Array.from(fileList);
    const validated = [];

    for (const f of incoming) {
      const ext = f.name.split('.').pop()?.toLowerCase() || '';
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        setError(`Invalid file type for "${f.name}". Supported formats: ${ALLOWED_EXTENSIONS.map(s => s.toUpperCase()).join(', ')}.`);
        return;
      }
      if (f.size > MAX_FILE_SIZE) {
        setError(`File size exceeds 10 MB limit for "${f.name}" (${formatFileSize(f.size)}).`);
        return;
      }
      if (!selectedFiles.some(existing => existing.name === f.name && existing.size === f.size)) {
        validated.push(f);
      }
    }

    if (validated.length > 0) {
      setSelectedFiles(prev => [...prev, ...validated]);
    }
  };

  const handleRemoveFile = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesAdded(e.dataTransfer.files);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setUploadProgress('');

    // Validations
    if (!formData.project_id) {
      setError('Project selection is required. Please select a valid project.');
      return;
    }
    if (!formData.title.trim()) {
      setError('Issue Title is required.');
      return;
    }
    if (!formData.description.trim()) {
      setError('Description is required. Provide details about the issue.');
      return;
    }
    if (!formData.issue_type) {
      setError('Issue Type is required.');
      return;
    }
    if (!formData.severity) {
      setError('Severity is required.');
      return;
    }
    if (!formData.priority) {
      setError('Priority is required.');
      return;
    }

    setSubmitting(true);
    try {
      const moduleToSave = formData.affected_module === 'Other'
        ? (formData.custom_module?.trim() || 'Other')
        : (formData.affected_module || 'Other');
      const payload = {
        project_id: formData.project_id,
        title: formData.title.trim(),
        description: formData.description.trim(),
        issue_type: formData.issue_type,
        severity: formData.severity,
        priority: formData.priority,
        affected_module: moduleToSave,
        assigned_to: formData.assigned_to || null,
        status: 'Open', // Initial status is always Open for newly reported issues
        component: formData.component?.trim() || moduleToSave,
        environment: formData.environment || 'Development',
        steps_to_reproduce: formData.steps_to_reproduce.trim() || null,
        expected_result: formData.expected_result.trim() || null,
        actual_result: formData.actual_result.trim() || null,
        sprint_id: formData.sprint_id || null
      };

      const res = await api.createIssue(payload);
      const newIssueId = res.issue.id;

      // Upload any selected attachments
      if (selectedFiles.length > 0) {
        for (let i = 0; i < selectedFiles.length; i++) {
          const file = selectedFiles[i];
          setUploadProgress(`Uploading attachment ${i + 1} of ${selectedFiles.length}: ${file.name}...`);
          try {
            await api.uploadAttachment(newIssueId, file);
          } catch (uploadErr) {
            console.error(`Failed to upload ${file.name}:`, uploadErr);
          }
        }
      }

      setSuccessMsg(`Issue ${newIssueId} created successfully${selectedFiles.length > 0 ? ` with ${selectedFiles.length} attachment(s)` : ''}!`);
      setTimeout(() => {
        navigate(`/issues/${newIssueId}`);
      }, 1200);
    } catch (err) {
      setError(err.message || 'Failed to create issue. Please check fields and try again.');
    } finally {
      setSubmitting(false);
      setUploadProgress('');
    }
  };

  return (
    <div className="page-container" style={{ maxWidth: '880px', margin: '0 auto', padding: '32px 24px' }}>
      {/* Top Breadcrumb & Navigation */}
      <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link to="/issues" className="btn btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
          <ArrowLeft size={16} />
          <span>Back to All Issues</span>
        </Link>
        <span style={{ fontSize: '0.82rem', color: '#817B86' }}>
          Active System
        </span>
      </div>

      {/* Main Form Card */}
      <div className="card" style={{ padding: '32px', background: '#FFFFFF', borderRadius: '14px', border: '1px solid #EAE5E0', boxShadow: '0 4px 16px rgba(41, 35, 56, 0.04)' }}>
        <div style={{ borderBottom: '1px solid #EAE5E0', paddingBottom: '20px', marginBottom: '28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#FDF2F0', color: '#E97862', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Bug size={20} />
            </div>
            <h1 style={{ fontSize: '1.45rem', fontWeight: 800, color: '#393442', letterSpacing: '-0.02em', margin: 0 }}>
              Create New Issue
            </h1>
          </div>
          <p style={{ fontSize: '0.88rem', color: '#817B86', margin: 0 }}>
            Report a software defect, feature request, enhancement, or support ticket.
          </p>
        </div>

        {/* Notice Banners */}
        {error && (
          <div className="toast-notice toast-error" style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}
        {successMsg && (
          <div className="toast-notice toast-success" style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <CheckCircle2 size={18} />
            <span>{successMsg}</span>
          </div>
        )}

        {loadingLookups ? (
          <div className="loading-container" style={{ padding: '60px 0' }}>
            <div className="spinner"></div>
            <p>Loading projects and developers...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {/* ROW 1: Project & Issue Type */}
            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">
                  Project <span style={{ color: '#EF4444' }}>*</span>
                </label>
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
                <span style={{ fontSize: '0.74rem', color: '#64748B', marginTop: '4px', display: 'block' }}>
                  Loaded dynamically from projects catalog
                </span>
              </div>

              <div className="form-group">
                <label className="form-label">
                  Issue Type <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <select
                  className="form-select"
                  required
                  value={formData.issue_type}
                  onChange={(e) => setFormData({ ...formData, issue_type: e.target.value })}
                >
                  {ISSUE_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                <span style={{ fontSize: '0.74rem', color: '#64748B', marginTop: '4px', display: 'block' }}>
                  Bug, Feature Request, Enhancement, or Support Ticket
                </span>
              </div>
            </div>

            {/* ROW 2: Title */}
            <div className="form-group">
              <label className="form-label">
                Issue Title <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <input
                type="text"
                className="form-input"
                required
                placeholder="Concise, descriptive summary of the problem or request..."
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />
            </div>

            {/* ROW 3: Description */}
            <div className="form-group">
              <label className="form-label">
                Description <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <textarea
                className="form-textarea"
                rows="4"
                required
                placeholder="Detailed explanation of the issue, observed behavior, and impact..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            {/* ROW 4: Severity, Priority, Status */}
            <div className="form-grid-3">
              <div className="form-group">
                <label className="form-label">
                  Severity <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <select
                  className="form-select"
                  required
                  value={formData.severity}
                  onChange={(e) => setFormData({ ...formData, severity: e.target.value })}
                >
                  {SEVERITIES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">
                  Priority <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <select
                  className="form-select"
                  required
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                >
                  {PRIORITIES.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">
                  Status <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <div style={{ display: 'flex', alignItems: 'center', height: '42px', padding: '0 12px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px' }}>
                  <span className="badge badge-open" style={{ fontSize: '0.82rem' }}>
                    ● Open (Initial)
                  </span>
                </div>
                <span style={{ fontSize: '0.74rem', color: '#64748B', marginTop: '4px', display: 'block' }}>
                  New issues strictly begin in Open status
                </span>
              </div>
            </div>

            {/* ROW 5: Assign To & Sprint */}
            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">Assign To</label>
                <select
                  className="form-select"
                  value={formData.assigned_to}
                  onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
                >
                  <option value="">Unassigned (Assign later)</option>
                  {developers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.id}) – {d.role}
                    </option>
                  ))}
                </select>
                <span style={{ fontSize: '0.74rem', color: '#64748B', marginTop: '4px', display: 'block' }}>
                  Only active team members are listed
                </span>
              </div>

              <div className="form-group">
                <label className="form-label">Sprint (Optional)</label>
                <select
                  className="form-select"
                  value={formData.sprint_id}
                  onChange={(e) => setFormData({ ...formData, sprint_id: e.target.value })}
                >
                  <option value="">No Sprint Assigned</option>
                  {sprints
                    .filter(s => !formData.project_id || s.project_id === formData.project_id)
                    .map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.id}) – {s.status}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            {/* ROW 6: Affected Module & Environment */}
            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">
                  Affected Module <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <select
                  className="form-select"
                  required
                  value={formData.affected_module}
                  onChange={(e) => setFormData({ ...formData, affected_module: e.target.value })}
                >
                  {AFFECTED_MODULES.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
                <span style={{ fontSize: '0.74rem', color: '#64748B', marginTop: '4px', display: 'block' }}>
                  Identifies which application module contains the problem
                </span>
              </div>

              {formData.affected_module === 'Other' ? (
                <div className="form-group">
                  <label className="form-label">
                    Custom Module Name <span style={{ color: '#EF4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    required
                    placeholder="Enter custom module name..."
                    value={formData.custom_module}
                    onChange={(e) => setFormData({ ...formData, custom_module: e.target.value })}
                  />
                  <span style={{ fontSize: '0.74rem', color: '#64748B', marginTop: '4px', display: 'block' }}>
                    Enter specific custom module name
                  </span>
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

            {/* ROW 7: Reproduction & Results */}
            <div className="form-group">
              <label className="form-label">Steps to Reproduce</label>
              <textarea
                className="form-textarea"
                rows="3"
                placeholder="1. Navigate to /checkout&#10;2. Click place order with empty cart&#10;3. Observe HTTP 500 unhandled exception"
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
                  placeholder="Validation message displayed without crashing"
                  value={formData.expected_result}
                  onChange={(e) => setFormData({ ...formData, expected_result: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Actual Result</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Application throws crash and shows white screen"
                  value={formData.actual_result}
                  onChange={(e) => setFormData({ ...formData, actual_result: e.target.value })}
                />
              </div>
            </div>

            {/* ATTACHMENTS SECTION */}
            <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid #F1ECE6' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0, fontSize: '0.95rem' }}>
                  <Paperclip size={18} color="#2563EB" />
                  <span>Attachments</span>
                  <span style={{ fontSize: '0.78rem', color: '#64748B', fontWeight: 500 }}>(Optional)</span>
                </label>

                {selectedFiles.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedFiles([])}
                    style={{ background: 'none', border: 'none', color: '#EF4444', fontSize: '0.78rem', cursor: 'pointer', fontWeight: 600 }}
                  >
                    Clear All ({selectedFiles.length})
                  </button>
                )}
              </div>

              <p style={{ fontSize: '0.82rem', color: '#64748B', margin: '0 0 12px 0' }}>
                Attach screenshots, crash logs, or specifications. Supported: PNG, JPG, JPEG, PDF, TXT, LOG, DOC, DOCX, CSV (max 10 MB per file).
              </p>

              {/* Drag and Drop Zone */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                style={{
                  border: dragOver ? '2px dashed #2563EB' : '2px dashed #CBD5E1',
                  background: dragOver ? '#EFF6FF' : '#F8FAFC',
                  borderRadius: '10px',
                  padding: '24px 16px',
                  textAlign: 'center',
                  transition: 'all 0.2s ease',
                  cursor: 'pointer'
                }}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  multiple
                  accept=".png,.jpg,.jpeg,.pdf,.txt,.log,.doc,.docx,.csv"
                  onChange={(e) => {
                    if (e.target.files) {
                      handleFilesAdded(e.target.files);
                    }
                    e.target.value = '';
                  }}
                  style={{ display: 'none' }}
                />

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                  <div style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '50%',
                    background: dragOver ? '#DBEAFE' : '#E2E8F0',
                    color: '#2563EB',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <Upload size={20} />
                  </div>

                  <div>
                    <span style={{ fontWeight: 600, color: '#1E293B', fontSize: '0.9rem' }}>
                      Drag and drop files here, or{' '}
                    </span>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={(e) => {
                        e.stopPropagation();
                        fileInputRef.current?.click();
                      }}
                      style={{ padding: '3px 10px', fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: '4px', marginLeft: '4px' }}
                    >
                      <Upload size={13} />
                      <span>Browse Files</span>
                    </button>
                  </div>

                  <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>
                    Select single or multiple files to attach to this issue
                  </span>
                </div>
              </div>

              {/* Selected Files List */}
              {selectedFiles.length > 0 && (
                <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>
                    Files ready for upload ({selectedFiles.length}):
                  </div>
                  {selectedFiles.map((f, idx) => (
                    <div
                      key={`${f.name}-${idx}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        background: '#FFFFFF',
                        border: '1px solid #E2E8F0',
                        borderRadius: '8px',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                        <div style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '6px',
                          background: '#F1F5F9',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}>
                          {getFileIcon(f.name)}
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{
                            fontWeight: 600,
                            fontSize: '0.86rem',
                            color: '#1E293B',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}>
                            {f.name}
                          </div>
                          <div style={{ fontSize: '0.74rem', color: '#64748B' }}>
                            {formatFileSize(f.size)}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveFile(idx);
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#94A3B8',
                          cursor: 'pointer',
                          padding: '6px',
                          borderRadius: '6px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'color 0.15s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.color = '#EF4444'}
                        onMouseLeave={(e) => e.currentTarget.style.color = '#94A3B8'}
                        title="Remove file"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Upload Progress Indicator during Submit */}
              {uploadProgress && (
                <div style={{
                  marginTop: '12px',
                  padding: '10px 14px',
                  background: '#EFF6FF',
                  borderRadius: '8px',
                  border: '1px solid #BFDBFE',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  fontSize: '0.84rem',
                  color: '#1D4ED8'
                }}>
                  <div className="spinner" style={{ width: '14px', height: '14px', borderWidth: '2px', borderColor: '#2563EB', borderRightColor: 'transparent' }}></div>
                  <span>{uploadProgress}</span>
                </div>
              )}
            </div>

            {/* Actions Footer */}
            <div style={{ marginTop: '28px', paddingTop: '20px', borderTop: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={submitting}
                onClick={() => navigate('/issues')}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={submitting}
                style={{ minWidth: '170px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                {submitting ? (
                  <>
                    <div className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }}></div>
                    <span>{uploadProgress ? 'Uploading...' : 'Creating Issue...'}</span>
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    <span>Create Issue</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
