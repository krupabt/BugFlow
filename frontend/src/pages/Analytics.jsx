import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  FolderGit2,
  Layers,
  Calendar,
  Filter,
  RefreshCw,
  ArrowRight,
  ShieldAlert,
  Sliders,
  PieChart as PieIcon,
  Activity
} from 'lucide-react';
import { api } from '../api';

export default function Analytics() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Filters state
  const [selectedProject, setSelectedProject] = useState(searchParams.get('project_id') || 'All');
  const [selectedComponent, setSelectedComponent] = useState(searchParams.get('component') || 'All');
  const [dateRange, setDateRange] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Data state
  const [analyticsData, setAnalyticsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  // Fetch detailed analytics from PostgreSQL via Flask API
  const fetchAnalytics = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');

    try {
      const params = {};
      if (selectedProject && selectedProject !== 'All') params.project_id = selectedProject;
      if (selectedComponent && selectedComponent !== 'All') params.component = selectedComponent;
      if (dateRange && dateRange !== 'all') params.date_range = dateRange;
      if (dateRange === 'custom') {
        if (startDate) params.start_date = startDate;
        if (endDate) params.end_date = endDate;
      }

      const res = await api.getDetailedAnalytics(params);
      if (res && res.data) {
        setAnalyticsData(res.data);
      } else {
        throw new Error('No analytics data received');
      }
    } catch (err) {
      console.error('Failed to load detailed analytics:', err);
      setError(err.message || 'Error fetching analytics from database');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [selectedProject, selectedComponent, dateRange, startDate, endDate]);

  const summary = analyticsData?.summary || {};
  const statusDist = analyticsData?.issues_by_status || [];
  const topProjects = analyticsData?.top_5_projects_by_resolution_time || [];
  const projComp = analyticsData?.issues_by_project_and_component || [];
  const ageDist = analyticsData?.age_distribution || [];
  const projectsList = analyticsData?.projects_list || [];
  const componentsList = analyticsData?.components_list || [];

  return (
    <div style={{ maxWidth: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* ==================================================== */}
      {/* 1. TOP HEADER & FILTERS BAR                          */}
      {/* ==================================================== */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '14px',
          paddingBottom: '16px',
          borderBottom: '1px solid #EAE5E0'
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h1 style={{ fontSize: '1.45rem', fontWeight: 800, color: '#1E293B', margin: 0, letterSpacing: '-0.02em' }}>
              Project Analytics
            </h1>
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                color: '#7C3AED',
                background: '#F3E8FF',
                border: '1px solid #DDD6FE',
                padding: '2px 8px',
                borderRadius: '6px',
                textTransform: 'uppercase',
                letterSpacing: '0.03em'
              }}
            >
              Intelligence
            </span>
          </div>
          <p style={{ fontSize: '0.84rem', color: '#64748B', margin: '3px 0 0 0', fontWeight: 500 }}>
            Deep-dive issue distribution, resolution velocity, and component benchmarks
          </p>
        </div>

        {/* Filters Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Project Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <FolderGit2 size={15} color="#64748B" />
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              style={{
                padding: '6px 12px',
                fontSize: '0.82rem',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                background: '#FFFFFF',
                color: '#1E293B',
                fontWeight: 600,
                outline: 'none',
                cursor: 'pointer',
                boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
              }}
            >
              <option value="All">All Projects</option>
              {projectsList.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Component Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Sliders size={15} color="#64748B" />
            <select
              value={selectedComponent}
              onChange={(e) => setSelectedComponent(e.target.value)}
              style={{
                padding: '6px 12px',
                fontSize: '0.82rem',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                background: '#FFFFFF',
                color: '#1E293B',
                fontWeight: 600,
                outline: 'none',
                cursor: 'pointer',
                boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                maxWidth: '180px'
              }}
            >
              <option value="All">All Components</option>
              {componentsList.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Date Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Calendar size={15} color="#64748B" />
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              style={{
                padding: '6px 12px',
                fontSize: '0.82rem',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                background: '#FFFFFF',
                color: '#1E293B',
                fontWeight: 600,
                outline: 'none',
                cursor: 'pointer',
                boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
              }}
            >
              <option value="all">All Time</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="90d">Last 90 Days</option>
              <option value="this_year">This Year</option>
              <option value="custom">Custom Date Range</option>
            </select>
          </div>

          {/* Custom Date Pickers */}
          {dateRange === 'custom' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#FFFFFF', padding: '4px 8px', borderRadius: '8px', border: '1px solid #CBD5E1' }}>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={{ fontSize: '0.78rem', border: 'none', outline: 'none', color: '#1E293B' }}
              />
              <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={{ fontSize: '0.78rem', border: 'none', outline: 'none', color: '#1E293B' }}
              />
            </div>
          )}

          {/* Refresh Button */}
          <button
            type="button"
            onClick={() => fetchAnalytics(true)}
            disabled={refreshing || loading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              background: '#FFFFFF',
              border: '1px solid #CBD5E1',
              borderRadius: '8px',
              color: '#334155',
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
            }}
            title="Refresh Analytics"
          >
            <RefreshCw size={14} className={refreshing ? 'spinner' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="toast-notice toast-error" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="loading-container" style={{ padding: '80px 0' }}>
          <div className="spinner"></div>
          <p>Calculating detailed analytics and project benchmarks...</p>
        </div>
      ) : (
        <>
          {/* ==================================================== */}
          {/* 2. RESOLVED & UNRESOLVED STATISTICS SUMMARY CARDS    */}
          {/* ==================================================== */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '16px'
            }}
          >
            {/* Card 1: Resolved Issues */}
            <div
              style={{
                background: '#FFFFFF',
                borderRadius: '12px',
                border: '1px solid #EAE5E0',
                padding: '16px 18px',
                boxShadow: '0 1px 3px rgba(41, 35, 56, 0.03)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: '#16A34A' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                  Resolved Issues
                </span>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#DCFCE7', color: '#16A34A', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #BBF7D0' }}>
                  <CheckCircle2 size={16} />
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', margin: '4px 0 6px 0' }}>
                <span style={{ fontSize: '1.85rem', fontWeight: 800, color: '#1E293B', lineHeight: 1 }}>
                  {summary.resolved_count ?? 0}
                </span>
                <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#16A34A' }}>
                  ({summary.resolved_percentage ?? 0}%)
                </span>
              </div>
              <div style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 500 }}>
                Verified resolved & closed defects
              </div>
            </div>

            {/* Card 2: Unresolved Issues */}
            <div
              style={{
                background: '#FFFFFF',
                borderRadius: '12px',
                border: '1px solid #EAE5E0',
                padding: '16px 18px',
                boxShadow: '0 1px 3px rgba(41, 35, 56, 0.03)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: '#E97862' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                  Unresolved Issues
                </span>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#FDF2F0', color: '#E97862', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #F8C8BE' }}>
                  <AlertCircle size={16} />
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', margin: '4px 0 6px 0' }}>
                <span style={{ fontSize: '1.85rem', fontWeight: 800, color: '#1E293B', lineHeight: 1 }}>
                  {summary.unresolved_count ?? 0}
                </span>
                <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#E97862' }}>
                  ({summary.unresolved_percentage ?? 0}%)
                </span>
              </div>
              <div style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 500 }}>
                {summary.open_count ?? 0} Open • {summary.in_progress_count ?? 0} Progress • {summary.testing_count ?? 0} Testing
              </div>
            </div>

            {/* Card 3: Average Issue Age */}
            <div
              style={{
                background: '#FFFFFF',
                borderRadius: '12px',
                border: '1px solid #EAE5E0',
                padding: '16px 18px',
                boxShadow: '0 1px 3px rgba(41, 35, 56, 0.03)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: '#2563EB' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                  Average Issue Age
                </span>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#EFF6FF', color: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #BFDBFE' }}>
                  <Clock size={16} />
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', margin: '4px 0 6px 0' }}>
                <span style={{ fontSize: '1.85rem', fontWeight: 800, color: '#1E293B', lineHeight: 1 }}>
                  {summary.average_issue_age_days ?? 0}
                </span>
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#64748B' }}>
                  Days
                </span>
              </div>
              <div style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 500 }}>
                Active backlog lifespan from creation
              </div>
            </div>

            {/* Card 4: Average Resolution Time */}
            <div
              style={{
                background: '#FFFFFF',
                borderRadius: '12px',
                border: '1px solid #EAE5E0',
                padding: '16px 18px',
                boxShadow: '0 1px 3px rgba(41, 35, 56, 0.03)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: '#7C3AED' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                  Avg Resolution Time
                </span>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#F3E8FF', color: '#7C3AED', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #DDD6FE' }}>
                  <TrendingUp size={16} />
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', margin: '4px 0 6px 0' }}>
                <span style={{ fontSize: '1.85rem', fontWeight: 800, color: '#1E293B', lineHeight: 1 }}>
                  {summary.average_resolution_time_hours ?? 0}
                </span>
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#64748B' }}>
                  Hours ({summary.average_resolution_time_days ?? 0}d)
                </span>
              </div>
              <div style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 500 }}>
                Historical closure duration
              </div>
            </div>
          </div>

          {/* ==================================================== */}
          {/* 3. MIDDLE SECTION: ISSUES BY STATUS & TOP 5 PROJECTS */}
          {/* ==================================================== */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
              gap: '16px',
              alignItems: 'stretch'
            }}
          >
            {/* Left Card: Issues by Status */}
            <div
              style={{
                background: '#FFFFFF',
                borderRadius: '12px',
                border: '1px solid #EAE5E0',
                padding: '20px',
                boxShadow: '0 1px 3px rgba(41, 35, 56, 0.03)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <div>
                    <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#1E293B', margin: 0 }}>
                      Issues by Status
                    </h2>
                    <p style={{ fontSize: '0.76rem', color: '#64748B', margin: '2px 0 0' }}>
                      Lifecycle stage distribution & percentage shares
                    </p>
                  </div>
                  <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#2563EB', background: '#EFF6FF', padding: '2px 8px', borderRadius: '6px', border: '1px solid #BFDBFE' }}>
                    Total: {summary.total_issues ?? 0}
                  </span>
                </div>

                <div style={{ height: '220px', width: '100%', position: 'relative' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statusDist}
                        cx="50%"
                        cy="50%"
                        innerRadius={62}
                        outerRadius={92}
                        paddingAngle={3}
                        dataKey="count"
                        nameKey="status"
                      >
                        {statusDist.map((entry, index) => (
                          <Cell key={`status-slice-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(val, name, item) => [`${val} issues (${item.payload.percentage}%)`, name]}
                        contentStyle={{ backgroundColor: '#FFFFFF', borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '0.82rem' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>

                  {/* Centered Total */}
                  <div
                    style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      textAlign: 'center',
                      pointerEvents: 'none'
                    }}
                  >
                    <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#1E293B', lineHeight: 1 }}>
                      {summary.total_issues ?? 0}
                    </div>
                    <div style={{ fontSize: '0.66rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase', marginTop: '3px' }}>
                      Total Issues
                    </div>
                  </div>
                </div>
              </div>

              {/* Status Breakdown Legend & Percentages */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))', gap: '8px', marginTop: '12px', paddingTop: '10px', borderTop: '1px solid #F1F5F9' }}>
                {statusDist.map((item) => (
                  <div key={item.status} style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: item.color }} />
                      <span style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 600 }}>{item.status}</span>
                    </div>
                    <div style={{ fontSize: '0.86rem', fontWeight: 800, color: '#1E293B', marginLeft: '13px' }}>
                      {item.count} <span style={{ fontSize: '0.7rem', color: '#94A3B8', fontWeight: 500 }}>({item.percentage}%)</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Card: Top 5 Projects by Resolution Time */}
            <div
              style={{
                background: '#FFFFFF',
                borderRadius: '12px',
                border: '1px solid #EAE5E0',
                padding: '20px',
                boxShadow: '0 1px 3px rgba(41, 35, 56, 0.03)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <div>
                    <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#1E293B', margin: 0 }}>
                      Top 5 Projects by Resolution Time
                    </h2>
                    <p style={{ fontSize: '0.76rem', color: '#64748B', margin: '2px 0 0' }}>
                      Fastest defect turnaround velocity (hours to closure)
                    </p>
                  </div>
                  <span style={{ fontSize: '0.74rem', color: '#16A34A', fontWeight: 600 }}>
                    Fastest First
                  </span>
                </div>

                <div style={{ height: '220px', width: '100%' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={topProjects}
                      layout="vertical"
                      margin={{ top: 5, right: 30, left: 45, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F1F5F9" />
                      <XAxis type="number" tick={{ fill: '#64748B', fontSize: 11 }} unit="h" />
                      <YAxis
                        type="category"
                        dataKey="project_name"
                        tick={{ fill: '#1E293B', fontSize: 11, fontWeight: 600 }}
                        width={90}
                      />
                      <Tooltip
                        formatter={(val, name, item) => [`${val} hrs (${item.payload.avg_days} days) • ${item.payload.resolved_count} resolved`, 'Resolution Time']}
                        contentStyle={{ backgroundColor: '#FFFFFF', borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '0.82rem' }}
                      />
                      <Bar
                        dataKey="avg_hours"
                        fill="#7C3AED"
                        radius={[0, 4, 4, 0]}
                        label={{ position: 'right', fill: '#64748B', fontSize: 10, fontWeight: 700, formatter: (val) => `${val}h` }}
                      >
                        {topProjects.map((entry, index) => (
                          <Cell
                            key={`top-proj-${index}`}
                            fill={index === 0 ? '#16A34A' : index === 1 ? '#2563EB' : index === 2 ? '#7C3AED' : index === 3 ? '#EA580C' : '#64748B'}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Ranking Footer */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', paddingTop: '10px', borderTop: '1px solid #F1F5F9', fontSize: '0.74rem' }}>
                <span style={{ color: '#64748B' }}>
                  Computed across {topProjects.reduce((sum, p) => sum + p.resolved_count, 0)} resolved defects
                </span>
                <span style={{ color: '#2563EB', fontWeight: 600 }}>
                  Ranked by SLA duration
                </span>
              </div>
            </div>
          </div>

          {/* ==================================================== */}
          {/* 4. BOTTOM SECTION: ISSUES BY PROJECT & COMPONENT     */}
          {/* ==================================================== */}
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: '12px',
              border: '1px solid #EAE5E0',
              padding: '20px',
              boxShadow: '0 1px 3px rgba(41, 35, 56, 0.03)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div>
                <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#1E293B', margin: 0 }}>
                  Issues by Project and Component
                </h2>
                <p style={{ fontSize: '0.76rem', color: '#64748B', margin: '2px 0 0' }}>
                  Component-level defect concentration across software repositories
                </p>
              </div>
              <span style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 600 }}>
                Top Active Modules
              </span>
            </div>

            {projComp.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px 0', color: '#64748B', fontSize: '0.82rem' }}>
                No project and component issues match your filters.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #E2E8F0', background: '#F8FAFC' }}>
                      <th style={{ padding: '8px 12px', color: '#64748B', fontWeight: 700, fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Project</th>
                      <th style={{ padding: '8px 12px', color: '#64748B', fontWeight: 700, fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Component / Module</th>
                      <th style={{ padding: '8px 12px', color: '#64748B', fontWeight: 700, fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Defect Count</th>
                      <th style={{ padding: '8px 12px', color: '#64748B', fontWeight: 700, fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Share (%)</th>
                      <th style={{ padding: '8px 12px', color: '#64748B', fontWeight: 700, fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.03em', textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projComp.map((row, idx) => (
                      <tr
                        key={idx}
                        style={{
                          borderBottom: '1px solid #F1F5F9',
                          transition: 'background 0.12s ease'
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#FAF8F5')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                      >
                        <td style={{ padding: '10px 12px', fontWeight: 600, color: '#1E293B' }}>
                          {row.project}
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <span
                            style={{
                              fontSize: '0.76rem',
                              fontWeight: 700,
                              color: '#5B4870',
                              background: '#F4F1F8',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              border: '1px solid #E3DCEB'
                            }}
                          >
                            {row.component}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px', fontWeight: 800, color: '#1E293B' }}>
                          {row.count}
                        </td>
                        <td style={{ padding: '10px 12px', width: '220px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ flex: 1, height: '6px', background: '#E2E8F0', borderRadius: '3px', overflow: 'hidden' }}>
                              <div style={{ width: `${Math.min(100, row.percentage * 2.5)}%`, height: '100%', background: '#E97862', borderRadius: '3px' }} />
                            </div>
                            <span style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 600, minWidth: '38px', textAlign: 'right' }}>
                              {row.percentage}%
                            </span>
                          </div>
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                          <button
                            type="button"
                            onClick={() => navigate(`/issues?search=${encodeURIComponent(row.component)}`)}
                            style={{
                              background: '#FFFFFF',
                              border: '1px solid #CBD5E1',
                              borderRadius: '6px',
                              padding: '4px 10px',
                              fontSize: '0.74rem',
                              fontWeight: 600,
                              color: '#2563EB',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <span>View Issues</span>
                            <ArrowRight size={11} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
