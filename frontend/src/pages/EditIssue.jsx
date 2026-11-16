import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Edit,
  Save,
  CheckCircle2,
  AlertCircle,
  FolderGit2,
  UserCheck,
  ShieldAlert,
  ArrowRightCircle,
  Clock,
  Layers
} from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

const WORKFLOW_STAGES = ["Open", "In Progress", "Testing", "Resolved", "Closed"];
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

export default function EditIssue() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Lookups
  const [projects, setProjects] = useState([]);
  const [developers, setDevelopers] = useState([]);
  const [sprints, setSprints] = useState([]);

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    issue_type: 'Bug',
    severity: 'Medium',
    priority: 'P2',
    affected_module: 'Login',
    custom_module: '',
    project_id: '',
    assigned_to: '',
    status: 'Open',
    component: '',
    environment: 'Development',
    steps_to_reproduce: '',
    expected_result: '',
    actual_result: '',
    sprint_id: '',
    resolution_summary: '',
    root_cause: '',
    comment: ''
  });

  const [initialIssue, setInitialIssue] = useState(null);

  useEffect(() => {
    async function loadIssueAndLookups() {
      setLoading(true);
      setError('');
      try {
        const [issueData, projRes, devRes, sprintRes] = await Promise.all([
          api.getIssue(id),
          api.getProjects({ include_stats: false }),
          api.getUsers({ role: 'DEVELOPER', active: 'true' }),
          api.getSprints()
        ]);

        setInitialIssue(issueData);
        setProjects(projRes || []);
        setDevelopers(devRes || []);
        setSprints(sprintRes || []);

        // Pre-fill form from actual issue record values
        const currentMod = issueData.affected_module || issueData.component || 'Login';
        const isStandardMod = AFFECTED_MODULES.includes(currentMod);
        const mappedPrio = issueData.priority === 'P0' ? 'P1' : (issueData.priority || 'P2');

        setFormData({
          title: issueData.title || '',
          description: issueData.description || '',
          issue_type: issueData.issue_type || 'Bug',
          severity: issueData.severity || 'Medium',
          priority: mappedPrio,
          affected_module: isStandardMod ? currentMod : 'Other',
          custom_module: isStandardMod ? '' : currentMod,
          project_id: issueData.project_id || '',
          assigned_to: issueData.assigned_to || '',
          status: issueData.status || 'Open',
          component: issueData.component || '',
          environment: issueData.environment || 'Development',
          steps_to_reproduce: issueData.steps_to_reproduce || '',
          expected_result: issueData.expected_result || '',
          actual_result: issueData.actual_result || '',
          sprint_id: issueData.sprint_id || '',
          resolution_summary: issueData.resolution_summary || '',
          root_cause: issueData.root_cause || '',
          comment: ''
        });
      } catch (err) {
        console.error('Failed to load issue for editing:', err);
        setError(err.message || 'Failed to load issue data.');
      } finally {
        setLoading(false);
      }
    }
    loadIssueAndLookups();
  }, [id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!formData.title.trim()) {
      setError('Title cannot be empty.');
      return;
    }
    if (!formData.description.trim()) {
      setError('Description cannot be empty.');
      return;
    }
    if (!formData.project_id) {
      setError('Project selection is required.');
      return;
    }

    setSubmitting(true);
    try {
      const moduleToSave = formData.affected_module === 'Other'
        ? (formData.custom_module?.trim() || 'Other')
        : (formData.affected_module || 'Other');
      const payload = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        issue_type: formData.issue_type,
        severity: formData.severity,
        priority: formData.priority,
        affected_module: moduleToSave,
        project_id: formData.project_id,
        assigned_to: formData.assigned_to || null,
        status: formData.status,
        component: formData.component?.trim() || moduleToSave,
        environment: formData.environment || 'Development',
        steps_to_reproduce: formData.steps_to_reproduce.trim() || null,
        expected_result: formData.expected_result.trim() || null,
        actual_result: formData.actual_result.trim() || null,
        sprint_id: formData.sprint_id || null,
        resolution_summary: formData.resolution_summary.trim() || null,
        root_cause: formData.root_cause.trim() || null,
        comment: formData.comment.trim() || null
      };

      const res = await api.updateIssue(id, payload);
      setSuccessMsg(`Issue ${id} updated successfully!`);
      setTimeout(() => {
        navigate(`/issues/${id}`);
      }, 1200);
    } catch (err) {
      setError(err.message || 'Failed to update issue. Please check workflow rules and permissions.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-container" style={{ height: '70vh' }}>
        <div className="spinner"></div>
        <p>Loading issue #{id}...</p>
      </div>
    );
  }

  return (
    <div className="page-container" style={{ maxWidth: '880px', margin: '0 auto', padding: '32px 24px' }}>
      {/* Top Navigation */}
      <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="btn btn-secondary"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}
        >
          <ArrowLeft size={16} />
          <span>Back</span>
        </button>
        <span style={{ fontSize: '0.82rem', color: '#64748B' }}>
          Issue Key: <strong>{id}</strong>
        </span>
      </div>

      {/* Main Card */}
      <div className="card" style={{ padding: '32px', background: '#FFFFFF', borderRadius: '14px', border: '1px solid #EAE5E0', boxShadow: '0 4px 16px rgba(41, 35, 56, 0.04)' }}>
        <div style={{ borderBottom: '1px solid #EAE5E0', paddingBottom: '20px', marginBottom: '28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#FDF2F0', color: '#E97862', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Edit size={20} />
              </div>
              <h1 style={{ fontSize: '1.45rem', fontWeight: 800, color: '#393442', letterSpacing: '-0.02em', margin: 0 }}>
                Edit Issue #{id}
              </h1>
            </div>
            <p style={{ fontSize: '0.88rem', color: '#817B86', margin: 0 }}>
              Update issue fields, assign developers, and manage workflow state transitions.
            </p>
          </div>
          <div>
            <span className={`badge badge-${(formData.status || 'open').toLowerCase().replace(' ', '-')}`} style={{ fontSize: '0.85rem', padding: '6px 14px' }}>
              Status: {formData.status}
            </span>
          </div>
        </div>

        {/* Notices */}
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

        <form onSubmit={handleSubmit}>
          {/* ROW 1: Project & Assigned Developer */}
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
                <option value="">Select Project</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.id})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Assigned Developer</label>
              <select
                className="form-select"
                value={formData.assigned_to}
                onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
              >
                <option value="">Unassigned</option>
                {developers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.id}) – {d.role}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* ROW 2: Title */}
          <div className="form-group">
            <label className="form-label">
              Title <span style={{ color: '#EF4444' }}>*</span>
            </label>
            <input
              type="text"
              className="form-input"
              required
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
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>

          {/* ROW 4: Issue Type, Severity, Priority */}
          <div className="form-grid-3">
            <div className="form-group">
              <label className="form-label">
                Issue Type <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <select
                className="form-select"
                value={formData.issue_type}
                onChange={(e) => setFormData({ ...formData, issue_type: e.target.value })}
              >
                {ISSUE_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">
                Severity <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <select
                className="form-select"
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
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
              >
                {PRIORITIES.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* ROW 5: Status Transition */}
          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label">
                Workflow Status <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <select
                className="form-select"
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              >
                {WORKFLOW_STAGES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <span style={{ fontSize: '0.74rem', color: '#64748B', marginTop: '4px', display: 'block' }}>
                Open → In Progress → Testing → Resolved → Closed
              </span>
            </div>

            <div className="form-group">
              <label className="form-label">Sprint</label>
              <select
                className="form-select"
                value={formData.sprint_id}
                onChange={(e) => setFormData({ ...formData, sprint_id: e.target.value })}
              >
                <option value="">No Sprint Assigned</option>
                {sprints
                  .filter(s => !formData.project_id || s.project_id === formData.project_id)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.id}) – {s.status}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {/* Conditional resolution fields if Resolved/Closed */}
          {(formData.status === 'Resolved' || formData.status === 'Closed') && (
            <div className="form-grid-2" style={{ background: '#F8FAFC', padding: '16px', borderRadius: '10px', border: '1px solid #E2E8F0', marginBottom: '16px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Resolution Summary</label>
                <textarea
                  className="form-textarea"
                  rows="2"
                  placeholder="Summary of fix or patch applied..."
                  value={formData.resolution_summary}
                  onChange={(e) => setFormData({ ...formData, resolution_summary: e.target.value })}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Root Cause</label>
                <textarea
                  className="form-textarea"
                  rows="2"
                  placeholder="Technical root cause identified..."
                  value={formData.root_cause}
                  onChange={(e) => setFormData({ ...formData, root_cause: e.target.value })}
                />
              </div>
            </div>
          )}

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
                Identifies which application module contains the issue
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

          {/* ROW 7: Change / Transition Comment for History */}
          <div className="form-group">
            <label className="form-label">Audit History Note / Reason for Edit</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Assigned to frontend developer, updated priority after triage, etc."
              value={formData.comment}
              onChange={(e) => setFormData({ ...formData, comment: e.target.value })}
            />
            <span style={{ fontSize: '0.74rem', color: '#64748B', marginTop: '4px', display: 'block' }}>
              Recorded in the issue status history table for audit compliance
            </span>
          </div>

          {/* Actions Footer */}
          <div style={{ marginTop: '28px', paddingTop: '20px', borderTop: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={submitting}
              onClick={() => navigate(`/issues/${id}`)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
              style={{ minWidth: '160px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            >
              {submitting ? (
                <>
                  <div className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }}></div>
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save size={16} />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
