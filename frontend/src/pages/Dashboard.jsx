import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
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
  TrendingUp,
  Shield,
  FileCheck2
} from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [recentActivity, setRecentActivity] = useState([]);
  
  const normRole = (user?.role || '').toUpperCase().replace(/ /g, '_');
  const isAdmin = normRole === 'ADMIN';
  const isPM = normRole === 'PROJECT_MANAGER';
  const isDev = normRole === 'DEVELOPER';
  const isTester = normRole === 'TESTER';
  const displayRole = user?.role_display || (isAdmin ? 'Admin' : isPM ? 'Project Manager' : isDev ? 'Developer' : isTester ? 'Tester' : (user?.role || 'Developer'));

  const loadDashboard = async () => {
    setLoading(true);
    setError('');
    try {
      const stats = await api.getDashboardStats();
      setData(stats);
      const activity = await api.getRecentActivity();
      setRecentActivity(activity);
    } catch (err) {
      setError(err.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, [user?.id, user?.role]);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading real-time {displayRole} dashboard...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="toast-notice toast-error">
        <AlertCircle size={18} />
        <span>{error}</span>
      </div>
    );
  }

  const getCardIcon = (type) => {
    switch (type) {
      case 'users': return <Users size={18} />;
      case 'projects': return <FolderGit2 size={18} />;
      case 'open': return <AlertCircle size={18} />;
      case 'progress': return <Clock size={18} />;
      case 'resolved': return <CheckCircle2 size={18} />;
      case 'closed': return <Shield size={18} />;
      case 'testing': return <FileCheck2 size={18} />;
      default: return <Bug size={18} />;
    }
  };

  return (
    <div>
      {/* Top Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">{displayRole} Dashboard</h1>
          <p className="page-subtitle">
            Welcome back, {user?.name}! Live workspace metrics connected to PostgreSQL.
          </p>
        </div>
        <div className="header-actions">
          {(isAdmin || isPM) && (
            <button className="btn btn-primary" onClick={() => navigate('/issues?action=create')}>
              <Plus size={16} />
              <span>Create Issue</span>
            </button>
          )}
          {isTester && (
            <button className="btn btn-primary" onClick={() => navigate('/issues?action=create')}>
              <Plus size={16} />
              <span>Report Bug</span>
            </button>
          )}
          {isAdmin && (
            <button className="btn btn-secondary" onClick={() => navigate('/users')}>
              <Users size={16} />
              <span>Manage Users</span>
            </button>
          )}
        </div>
      </div>

      {/* 4 Standard Stat Cards */}
      <div className="stat-grid">
        {(data?.cards || []).map((card, idx) => (
          <div className="stat-card" key={idx}>
            <div className="stat-header">
              <span className="stat-title">{card.title}</span>
              <div className={`stat-icon ${card.type}`}>
                {getCardIcon(card.type)}
              </div>
            </div>
            <div className="stat-value">{card.value}</div>
            <div className="stat-trend">
              <TrendingUp size={14} color="#16A34A" />
              <span>{card.trend}</span>
            </div>
          </div>
        ))}
      </div>

      {/* ---------------------------------------------------- */}
      {/* ADMIN DASHBOARD SPECIFIC SECTIONS                   */}
      {/* ---------------------------------------------------- */}
      {isAdmin && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '24px', marginBottom: '24px' }}>
            {/* Status Distribution */}
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h2 style={{ fontSize: '1rem', fontWeight: 700 }}>Issue Status Distribution</h2>
                <Link to="/reports" style={{ fontSize: '0.82rem', color: '#6754E8', fontWeight: 600, textDecoration: 'none' }}>
                  Full Analytics →
                </Link>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {(data?.status_distribution || []).map((s) => {
                  const total = data?.totals?.total_issues || 1;
                  const pct = Math.round((s.count / total) * 100);
                  return (
                    <div key={s.name}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '4px' }}>
                        <span style={{ fontWeight: 600 }}>{s.name}</span>
                        <span style={{ color: '#74748B' }}>{s.count} issues ({pct}%)</span>
                      </div>
                      <div style={{ height: '7px', background: '#F1F3F9', borderRadius: '4px', overflow: 'hidden' }}>
                        <div
                          style={{
                            height: '100%',
                            width: `${pct}%`,
                            background: s.name === 'Resolved' || s.name === 'Closed' ? '#16A34A' : (s.name === 'In Progress' ? '#F59E0B' : '#6754E8'),
                            borderRadius: '4px'
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Recent Users */}
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h2 style={{ fontSize: '1rem', fontWeight: 700 }}>Recent Users</h2>
                <Link to="/users" style={{ fontSize: '0.82rem', color: '#6754E8', fontWeight: 600, textDecoration: 'none' }}>
                  All Users →
                </Link>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {(data?.recent_users || []).map((u) => (
                  <div key={u.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #F1F3F9' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div className="user-avatar" style={{ width: '30px', height: '30px', fontSize: '0.75rem' }}>
                        {u.name[0]}
                      </div>
                      <div>
                        <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>{u.name}</div>
                        <div style={{ fontSize: '0.72rem', color: '#74748B' }}>{u.email}</div>
                      </div>
                    </div>
                    <span className="user-role-badge">{u.role}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Project Overview Table */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 700 }}>Project Overview</h2>
              <Link to="/projects" style={{ fontSize: '0.82rem', color: '#6754E8', fontWeight: 600, textDecoration: 'none' }}>
                View All Projects →
              </Link>
            </div>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Project</th>
                    <th>Issues Count</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.project_issue_counts || []).slice(0, 5).map((p, idx) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: 600 }}>{p.project}</td>
                      <td>{p.count} recorded issues</td>
                      <td><span className="badge badge-resolved">ACTIVE</span></td>
                      <td>
                        <button className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '0.78rem' }} onClick={() => navigate('/projects')}>
                          Manage
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ---------------------------------------------------- */}
      {/* PROJECT MANAGER DASHBOARD SPECIFIC SECTIONS          */}
      {/* ---------------------------------------------------- */}
      {isPM && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px', marginBottom: '24px' }}>
            {/* My Projects */}
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h2 style={{ fontSize: '1rem', fontWeight: 700 }}>My Managed Projects</h2>
                <Link to="/projects" style={{ fontSize: '0.82rem', color: '#6754E8', fontWeight: 600, textDecoration: 'none' }}>
                  View All →
                </Link>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {(data?.my_projects || []).map((p) => (
                  <div key={p.id} style={{ padding: '12px', border: '1px solid #E9E7F0', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{p.name}</span>
                      <span className="badge badge-open">{p.lifecycle_status}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#74748B', marginBottom: '8px' }}>
                      <span>Total: {p.stats?.total_issues || 0} issues</span>
                      <span>Progress: {p.stats?.progress_percentage || 0}%</span>
                    </div>
                    <div style={{ height: '6px', background: '#F1F3F9', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${p.stats?.progress_percentage || 0}%`, background: '#6754E8' }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Sprint Overview */}
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h2 style={{ fontSize: '1rem', fontWeight: 700 }}>Sprint Overview</h2>
                <Link to="/sprints" style={{ fontSize: '0.82rem', color: '#6754E8', fontWeight: 600, textDecoration: 'none' }}>
                  Manage Sprints →
                </Link>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {(data?.sprints_overview || []).map((s) => (
                  <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #F1F3F9' }}>
                    <div>
                      <div style={{ fontSize: '0.84rem', fontWeight: 600 }}>{s.sprint_name}</div>
                      <div style={{ fontSize: '0.72rem', color: '#74748B' }}>{s.start_date} to {s.end_date}</div>
                    </div>
                    <span className={`badge badge-${s.status === 'COMPLETED' ? 'resolved' : (s.status === 'ACTIVE' ? 'progress' : 'open')}`}>
                      {s.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ---------------------------------------------------- */}
      {/* DEVELOPER DASHBOARD SPECIFIC SECTIONS                */}
      {/* ---------------------------------------------------- */}
      {isDev && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 700 }}>Your Assigned Issues</h2>
            <Link to="/issues?assigned_to=my" style={{ fontSize: '0.82rem', color: '#6754E8', fontWeight: 600, textDecoration: 'none' }}>
              View All Assigned Issues →
            </Link>
          </div>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Issue ID</th>
                  <th>Title</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Project</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {(data?.assigned_issues_list || []).length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '32px', color: '#74748B' }}>
                      No active issues currently assigned to you. Check All Issues to pick up work.
                    </td>
                  </tr>
                ) : (
                  (data?.assigned_issues_list || []).map((issue) => (
                    <tr key={issue.id}>
                      <td style={{ fontWeight: 700, color: '#6754E8' }}>{issue.id}</td>
                      <td style={{ fontWeight: 600, maxWidth: '280px' }}>{issue.title}</td>
                      <td>
                        <span className={`badge badge-${issue.priority.toLowerCase()}`}>
                          {issue.priority}
                        </span>
                      </td>
                      <td>
                        <span className={`badge badge-${issue.status.toLowerCase().replace(' ', '-')}`}>
                          {issue.status}
                        </span>
                      </td>
                      <td>{issue.project_name}</td>
                      <td>
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '4px 10px', fontSize: '0.78rem' }}
                          onClick={() => navigate(`/issues/${issue.id}`)}
                        >
                          Details & Update
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* TESTER DASHBOARD SPECIFIC SECTIONS                   */}
      {/* ---------------------------------------------------- */}
      {isTester && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 700 }}>Issues Awaiting Verification / Testing</h2>
            <Link to="/issues?status=Testing" style={{ fontSize: '0.82rem', color: '#6754E8', fontWeight: 600, textDecoration: 'none' }}>
              View All In Testing →
            </Link>
          </div>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Issue ID</th>
                  <th>Title</th>
                  <th>Severity</th>
                  <th>Assigned Dev</th>
                  <th>Project</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {(data?.awaiting_testing_list || []).length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '32px', color: '#74748B' }}>
                      No issues currently in Testing queue.
                    </td>
                  </tr>
                ) : (
                  (data?.awaiting_testing_list || []).map((issue) => (
                    <tr key={issue.id}>
                      <td style={{ fontWeight: 700, color: '#6754E8' }}>{issue.id}</td>
                      <td style={{ fontWeight: 600, maxWidth: '280px' }}>{issue.title}</td>
                      <td>
                        <span className={`badge badge-${issue.severity.toLowerCase()}`}>
                          {issue.severity}
                        </span>
                      </td>
                      <td>{issue.assignee_name}</td>
                      <td>{issue.project_name}</td>
                      <td>
                        <button
                          className="btn btn-primary"
                          style={{ padding: '4px 10px', fontSize: '0.78rem' }}
                          onClick={() => navigate(`/issues/${issue.id}`)}
                        >
                          Verify Fix
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent Activity Timeline (Common to all roles) */}
      <div className="card" style={{ marginTop: '24px' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '16px' }}>Recent Audit History & Activity</h2>
        {recentActivity.length === 0 ? (
          <p style={{ color: '#74748B', fontSize: '0.84rem' }}>No recent status transitions recorded.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {recentActivity.slice(0, 6).map((item) => (
              <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #F1F3F9', fontSize: '0.84rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Activity size={16} color="#6754E8" />
                  <span>
                    <strong>{item.changed_by}</strong> updated <strong>{item.issue_id}</strong>: {item.old_status || 'New'} → <strong>{item.new_status}</strong>
                    {item.comment && <span style={{ color: '#74748B' }}> ({item.comment})</span>}
                  </span>
                </div>
                <span style={{ fontSize: '0.75rem', color: '#74748B' }}>
                  {item.created_at ? new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recently'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
