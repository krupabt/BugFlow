import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bug,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Flame,
  UserCheck,
  FolderGit2,
  ArrowUpRight,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from 'recharts';
import Header from '../components/Header';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

const STATUS_COLORS = {
  Open: '#3b82f6',
  'In Progress': '#f59e0b',
  Resolved: '#10b981',
  Closed: '#64748b',
};

const SEVERITY_COLORS = {
  Critical: '#ef4444',
  High: '#f97316',
  Medium: '#eab308',
  Low: '#22c55e',
};

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [statsRes, activityRes] = await Promise.all([
        api.getDashboardStats(user?.id),
        api.getRecentActivity(),
      ]);
      setStats(statsRes);
      setActivity(activityRes);
    } catch (err) {
      console.warn('Dashboard fetch error:', err);
      setError('Unable to load live PostgreSQL database metrics. Please verify that the Flask backend and PostgreSQL service are running.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  const totals = stats?.totals || {
    total_issues: 0,
    open_issues: 0,
    in_progress_issues: 0,
    resolved_issues: 0,
    closed_issues: 0,
    critical_issues: 0,
    my_assigned: 0,
    total_projects: 0,
  };

  const statusChartData = stats?.charts?.by_status || [];
  const severityChartData = stats?.charts?.by_severity || [];
  const projectChartData = stats?.charts?.by_project || [];

  return (
    <div>
      <Header title="Engineering Defect Dashboard" />

      <div className="content-body">
        {/* Banner / Welcome */}
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
            <h2 style={{ fontSize: '1.4rem', fontWeight: '700', color: '#0f172a' }}>
              Welcome, {user?.full_name || user?.username || 'Engineer'}
            </h2>
            <p style={{ color: '#64748b', fontSize: '0.9rem', marginTop: '4px' }}>
              Live defect metrics and issue resolution tracking powered by PostgreSQL.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <Link to="/assistant" className="btn btn-secondary">
              <Sparkles size={16} color="#2563eb" />
              <span>Resolution Assistant</span>
            </Link>
            <button className="btn btn-secondary" onClick={loadData} title="Refresh Live Data">
              <RefreshCw size={15} />
            </button>
          </div>
        </div>

        {error && (
          <div className="alert alert-error">
            <AlertTriangle size={18} />
            <div>
              <strong>Database Notice:</strong> {error}
            </div>
          </div>
        )}

        {/* 6 Top Metric Cards */}
        <div className="stat-grid">
          {/* Total Issues */}
          <div className="stat-card">
            <div className="stat-icon-wrapper" style={{ backgroundColor: '#eff6ff', color: '#2563eb' }}>
              <Bug size={24} />
            </div>
            <div>
              <div className="stat-number">{totals.total_issues}</div>
              <div className="stat-label">Total Defects</div>
            </div>
          </div>

          {/* Open Issues */}
          <div className="stat-card">
            <div className="stat-icon-wrapper" style={{ backgroundColor: '#eff6ff', color: '#1d4ed8' }}>
              <AlertTriangle size={24} />
            </div>
            <div>
              <div className="stat-number">{totals.open_issues}</div>
              <div className="stat-label">Open Issues</div>
            </div>
          </div>

          {/* In Progress */}
          <div className="stat-card">
            <div className="stat-icon-wrapper" style={{ backgroundColor: '#fef3c7', color: '#b45309' }}>
              <Clock size={24} />
            </div>
            <div>
              <div className="stat-number">{totals.in_progress_issues}</div>
              <div className="stat-label">In Progress</div>
            </div>
          </div>

          {/* Resolved & Closed */}
          <div className="stat-card">
            <div className="stat-icon-wrapper" style={{ backgroundColor: '#ecfdf5', color: '#047857' }}>
              <CheckCircle2 size={24} />
            </div>
            <div>
              <div className="stat-number">{totals.resolved_issues + totals.closed_issues}</div>
              <div className="stat-label">Resolved / Closed</div>
            </div>
          </div>

          {/* Critical & High */}
          <div className="stat-card">
            <div className="stat-icon-wrapper" style={{ backgroundColor: '#fef2f2', color: '#b91c1c' }}>
              <Flame size={24} />
            </div>
            <div>
              <div className="stat-number">{totals.critical_issues}</div>
              <div className="stat-label">Critical & High Priority</div>
            </div>
          </div>

          {/* My Assigned */}
          <div className="stat-card">
            <div className="stat-icon-wrapper" style={{ backgroundColor: '#f5f3ff', color: '#7c3aed' }}>
              <UserCheck size={24} />
            </div>
            <div>
              <div className="stat-number">{totals.my_assigned}</div>
              <div className="stat-label">Assigned to You</div>
            </div>
          </div>
        </div>

        {/* Charts Grid */}
        <div className="charts-grid">
          {/* Status Breakdown Pie Chart */}
          <div className="chart-card">
            <h3 className="chart-title">Issues by Status</h3>
            <div style={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusChartData}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={4}
                  >
                    {statusChartData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={STATUS_COLORS[entry.name] || '#94a3b8'}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Severity Breakdown Bar Chart */}
          <div className="chart-card">
            <h3 className="chart-title">Issues by Severity</h3>
            <div style={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={severityChartData}>
                  <XAxis dataKey="severity" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {severityChartData.map((entry, index) => (
                      <Cell
                        key={`cell-sev-${index}`}
                        fill={SEVERITY_COLORS[entry.severity] || '#3b82f6'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Recent Activity Table */}
        <div className="card" style={{ marginTop: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: '600' }}>Recent Defect Status Transitions</h3>
            <Link to="/issues" className="btn btn-secondary btn-sm">
              <span>View All Issues</span>
              <ArrowUpRight size={14} />
            </Link>
          </div>

          {activity.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>
              No recent status transitions recorded yet. Create or update an issue to see the audit log.
            </div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Ticket</th>
                    <th>Summary</th>
                    <th>Transition</th>
                    <th>Note / Comment</th>
                    <th>Updated By</th>
                    <th>Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {activity.map((item) => (
                    <tr key={item.id}>
                      <td style={{ fontWeight: '600', color: '#2563eb' }}>
                        <Link to={`/issues/${item.issue_id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                          {item.issue_key}
                        </Link>
                      </td>
                      <td style={{ maxWidth: '280px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.issue_title}
                      </td>
                      <td>
                        <span style={{ fontSize: '0.85rem' }}>
                          <span style={{ color: '#64748b' }}>{item.old_status || 'New'}</span>
                          {' → '}
                          <span style={{ fontWeight: '600', color: '#0f172a' }}>{item.new_status}</span>
                        </span>
                      </td>
                      <td style={{ color: '#64748b', fontSize: '0.84rem' }}>{item.comment || '-'}</td>
                      <td>{item.changed_by}</td>
                      <td style={{ fontSize: '0.8rem', color: '#64748b' }}>
                        {item.created_at ? new Date(item.created_at).toLocaleString() : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
