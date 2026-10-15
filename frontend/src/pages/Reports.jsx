import React, { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import {
  BarChart3,
  PieChart as PieIcon,
  TrendingUp,
  Clock,
  ShieldCheck,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import { api } from '../api';

const STATUS_COLORS = {
  Open: '#6754E8',
  'In Progress': '#F59E0B',
  Testing: '#8B5CF6',
  Resolved: '#16A34A',
  Closed: '#64748B'
};

const PRIORITY_COLORS = {
  P0: '#EF4444',
  P1: '#F97316',
  P2: '#FBBF24',
  P3: '#10B981'
};

const SEVERITY_COLORS = {
  Critical: '#DC2626',
  High: '#EA580C',
  Medium: '#D97706',
  Low: '#16A34A'
};

const TYPE_COLORS = ['#6754E8', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6'];

export default function Reports() {
  const [data, setData] = useState(null);
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadReports = async () => {
    setLoading(true);
    try {
      const [repData, projData] = await Promise.all([
        api.getReports(selectedProject || undefined),
        api.getProjects({ include_stats: false })
      ]);
      setData(repData);
      setProjects(projData);
    } catch (err) {
      setError(err.message || 'Failed to load report analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, [selectedProject]);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Generating reports from PostgreSQL database...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="toast-notice toast-error">
        <AlertCircle size={18} />
        <span>{error || 'Error loading report metrics.'}</span>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Reports & Analytics</h1>
          <p className="page-subtitle">
            Live database aggregations for issue resolution, severity, velocity, and backlog distribution
          </p>
        </div>
        <div className="header-actions">
          <select
            className="form-select"
            style={{ width: 'auto', minWidth: '220px' }}
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
          >
            <option value="">All Projects ({data.total_issues} Total Issues)</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name} ({p.id})</option>
            ))}
          </select>
          <button className="btn btn-secondary" onClick={loadReports} title="Refresh Data">
            <RefreshCw size={15} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Top 4 Metric Cards */}
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-title">Total Issues</span>
            <div className="stat-icon primary"><BarChart3 size={18} /></div>
          </div>
          <div className="stat-value">{data.total_issues}</div>
          <div className="stat-trend"><span>Database Issue Records</span></div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-title">Resolution Rate</span>
            <div className="stat-icon resolved"><ShieldCheck size={18} /></div>
          </div>
          <div className="stat-value">{data.resolution_rate}%</div>
          <div className="stat-trend"><span>{data.resolved_issues} Resolved or Closed</span></div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-title">Avg Resolution Time</span>
            <div className="stat-icon progress"><Clock size={18} /></div>
          </div>
          <div className="stat-value">{data.avg_resolution_hours} <span style={{ fontSize: '1rem' }}>hrs</span></div>
          <div className="stat-trend"><span>Per Completed Issue</span></div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-title">Reopened Issues</span>
            <div className="stat-icon open"><AlertCircle size={18} /></div>
          </div>
          <div className="stat-value">{data.reopened_issues}</div>
          <div className="stat-trend"><span>Issues with Reopen Count &gt; 0</span></div>
        </div>
      </div>

      {/* Row 1: Issues by Status & Resolved vs Unresolved */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px', marginBottom: '24px' }}>
        
        {/* Status Distribution Bar Chart */}
        <div className="card">
          <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '16px' }}>Issues by Workflow Status</h2>
          <div style={{ height: '280px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.by_status} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E9E7F0" />
                <XAxis dataKey="status" tick={{ fill: '#74748B', fontSize: 12 }} />
                <YAxis tick={{ fill: '#74748B', fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#FFFFFF', borderRadius: '8px', border: '1px solid #E9E7F0', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {(data.by_status || []).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.status] || '#6754E8'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Resolved vs Unresolved Pie Chart */}
        <div className="card">
          <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '16px' }}>Resolved vs Unresolved</h2>
          <div style={{ height: '280px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.resolved_vs_unresolved}
                  cx="50%"
                  cy="50%"
                  innerRadius={65}
                  outerRadius={95}
                  paddingAngle={4}
                  dataKey="count"
                >
                  {(data.resolved_vs_unresolved || []).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#FFFFFF', borderRadius: '8px', border: '1px solid #E9E7F0' }}
                />
                <Legend verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Row 2: Issues by Priority & Issues by Severity */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
        
        {/* Issues by Priority */}
        <div className="card">
          <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '16px' }}>Issues by Priority (Urgency)</h2>
          <div style={{ height: '260px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.by_priority} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E9E7F0" />
                <XAxis dataKey="priority" tick={{ fill: '#74748B', fontSize: 12 }} />
                <YAxis tick={{ fill: '#74748B', fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#FFFFFF', borderRadius: '8px', border: '1px solid #E9E7F0' }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {(data.by_priority || []).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={PRIORITY_COLORS[entry.priority] || '#6754E8'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Issues by Severity */}
        <div className="card">
          <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '16px' }}>Issues by Severity (Impact)</h2>
          <div style={{ height: '260px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.by_severity} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E9E7F0" />
                <XAxis dataKey="severity" tick={{ fill: '#74748B', fontSize: 12 }} />
                <YAxis tick={{ fill: '#74748B', fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#FFFFFF', borderRadius: '8px', border: '1px solid #E9E7F0' }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {(data.by_severity || []).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={SEVERITY_COLORS[entry.severity] || '#6754E8'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Row 3: Project-wise Issues & Issue Type Distribution */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '24px' }}>
        
        {/* Project-wise Issue Count */}
        <div className="card">
          <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '16px' }}>Project-wise Issue Volume</h2>
          <div style={{ height: '280px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data.project_wise}
                layout="vertical"
                margin={{ top: 10, right: 20, left: 40, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E9E7F0" />
                <XAxis type="number" tick={{ fill: '#74748B', fontSize: 12 }} />
                <YAxis dataKey="project" type="category" width={110} tick={{ fill: '#74748B', fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#FFFFFF', borderRadius: '8px', border: '1px solid #E9E7F0' }}
                />
                <Bar dataKey="count" fill="#6754E8" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Issue Type Distribution */}
        <div className="card">
          <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '16px' }}>Issue Type Breakdown</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {(data.by_type || []).map((t, idx) => {
              const pct = Math.round((t.count / data.total_issues) * 100);
              const color = TYPE_COLORS[idx % TYPE_COLORS.length];
              return (
                <div key={t.type}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 600 }}>{t.type}</span>
                    <span style={{ color: '#74748B' }}>{t.count} ({pct}%)</span>
                  </div>
                  <div style={{ height: '6px', background: '#F1F3F9', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
