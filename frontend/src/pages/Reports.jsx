import React, { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
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
  ShieldCheck,
  AlertCircle,
  RefreshCw,
  Download,
  Calendar,
  Layers,
  FolderGit2,
  CheckCircle2,
  AlertTriangle,
  Info
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import { api } from '../api';

const STATUS_COLORS = {
  Open: '#E97862',
  'In Progress': '#D97706',
  Testing: '#5B4870',
  Resolved: '#2B6647',
  Closed: '#817B86'
};

const SEVERITY_COLORS = {
  Critical: '#B91C1C',
  High: '#C2410C',
  Medium: '#D97706',
  Low: '#2B6647'
};

export default function Reports() {
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);

  // Load project list first
  useEffect(() => {
    async function loadProjects() {
      try {
        const projList = await api.getProjects({ include_stats: false });
        setProjects(projList || []);
        if (projList && projList.length > 0) {
          setSelectedProjectId(projList[0].id);
        }
      } catch (err) {
        console.error('Failed to load projects list:', err);
        setError('Failed to load projects list.');
      }
    }
    loadProjects();
  }, []);

  // Fetch project analytics
  const fetchAnalytics = async () => {
    if (!selectedProjectId) return;
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;

      const res = await api.getProjectAnalytics(selectedProjectId, params);
      setAnalytics(res.data);
    } catch (err) {
      console.error('Error fetching project analytics:', err);
      setError(err.message || 'Error loading project analytics from database.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (selectedProjectId) {
      fetchAnalytics();
    }
  }, [selectedProjectId, startDate, endDate]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchAnalytics();
  };

  const handleQuickDateFilter = (days) => {
    if (days === 0) {
      setStartDate('');
      setEndDate('');
      return;
    }
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - days);
    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
  };

  // Export PDF Report using jsPDF
  const handleExportPDF = () => {
    if (!analytics || !analytics.project) return;
    setExporting(true);

    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const primaryColor = [37, 99, 235]; // #2563EB
      const darkColor = [30, 41, 59]; // #1E293B
      const grayColor = [100, 116, 139]; // #64748B
      const successColor = [22, 163, 74]; // #16A34A

      let y = 18;

      // Header Banner
      doc.setFillColor(37, 99, 235);
      doc.rect(14, y - 4, 182, 24, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.setTextColor(255, 255, 255);
      doc.text('BugFlow – Project Analytics & Quality Report', 20, y + 6);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(224, 231, 255);
      doc.text(`Generated: ${new Date().toLocaleString()} | Source: System Database`, 20, y + 14);

      y += 28;

      // Project Meta Information Card
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(14, y, 182, 24, 2, 2, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(...darkColor);
      doc.text(`Project: ${analytics.project.name} (${analytics.project.id})`, 20, y + 8);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...grayColor);
      doc.text(`Project Manager: ${analytics.project.manager_name}   |   Status: ${analytics.project.lifecycle_status}   |   Date Filter: ${startDate && endDate ? `${startDate} to ${endDate}` : 'All Time History'}`, 20, y + 16);

      y += 32;

      // Summary Cards Section
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(...darkColor);
      doc.text('1. EXECUTIVE SUMMARY METRICS', 14, y);
      y += 6;

      const summary = analytics.summary || {};
      const cardWidth = 43;
      const cardHeight = 22;
      const cardsData = [
        { label: 'Total Issues', value: String(summary.total_issues || 0), sub: 'Tracked Defects', color: [37, 99, 235] },
        { label: 'Open Issues', value: String(summary.open_issues || 0), sub: 'Awaiting Action', color: [233, 120, 98] },
        { label: 'In Progress', value: String(summary.in_progress_issues || 0), sub: 'Active Dev', color: [217, 119, 6] },
        { label: 'Resolved', value: String(summary.resolved_issues || 0), sub: `${analytics.quality_metrics?.resolution_rate?.display || '0%'} Resolved`, color: [22, 163, 74] }
      ];

      cardsData.forEach((c, idx) => {
        const cx = 14 + idx * 46;
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(cx, y, cardWidth, cardHeight, 1.5, 1.5, 'FD');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(...grayColor);
        doc.text(c.label.toUpperCase(), cx + 4, y + 6);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.setTextColor(...c.color);
        doc.text(c.value, cx + 4, y + 14);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(...grayColor);
        doc.text(c.sub, cx + 4, y + 19);
      });

      y += cardHeight + 10;

      // Software Quality Metrics & Defect Density
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(...darkColor);
      doc.text('2. SOFTWARE QUALITY & RESOLUTION BENCHMARKS', 14, y);
      y += 6;

      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(14, y, 182, 34, 2, 2, 'FD');

      const qm = analytics.quality_metrics || {};
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...darkColor);
      doc.text('Average Resolution Time:', 20, y + 8);
      doc.setFont('helvetica', 'normal');
      doc.text(`${qm.average_resolution_time?.display || '0.0 hrs'} (based on historical issue creation to resolved timestamps)`, 75, y + 8);

      doc.setFont('helvetica', 'bold');
      doc.text('Resolution Rate:', 20, y + 16);
      doc.setFont('helvetica', 'normal');
      doc.text(`${qm.resolution_rate?.display || '0%'} of all logged defects resolved or closed`, 75, y + 16);

      doc.setFont('helvetica', 'bold');
      doc.text('Defect Density:', 20, y + 24);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(185, 28, 28);
      doc.text(qm.defect_density?.message || 'Data unavailable. Project size (KLOC) metric is required.', 75, y + 24);

      y += 42;

      // Status Distribution Table
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(...darkColor);
      doc.text('3. ISSUE STATUS DISTRIBUTION', 14, y);
      y += 6;

      doc.setFillColor(241, 245, 249);
      doc.rect(14, y, 182, 6, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(...darkColor);
      doc.text('Status Stage', 20, y + 4.5);
      doc.text('Defect Count', 90, y + 4.5);
      doc.text('Share (%)', 150, y + 4.5);
      y += 6;

      (analytics.status_distribution || []).forEach((st, i) => {
        doc.setFillColor(i % 2 === 0 ? 255 : 250, 250, 252);
        doc.rect(14, y, 182, 6, 'F');
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(...darkColor);
        doc.text(st.status, 20, y + 4.5);
        doc.text(String(st.count), 90, y + 4.5);
        doc.text(`${st.percentage}%`, 150, y + 4.5);
        y += 6;
      });

      y += 8;

      // Severity Distribution Table
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(...darkColor);
      doc.text('4. SEVERITY-WISE DEFECTS', 14, y);
      y += 6;

      doc.setFillColor(241, 245, 249);
      doc.rect(14, y, 182, 6, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(...darkColor);
      doc.text('Severity Level', 20, y + 4.5);
      doc.text('Issue Count', 90, y + 4.5);
      doc.text('Proportion (%)', 150, y + 4.5);
      y += 6;

      (analytics.severity_distribution || []).forEach((sev, i) => {
        doc.setFillColor(i % 2 === 0 ? 255 : 250, 250, 252);
        doc.rect(14, y, 182, 6, 'F');
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(...darkColor);
        doc.text(sev.severity, 20, y + 4.5);
        doc.text(String(sev.count), 90, y + 4.5);
        doc.text(`${sev.percentage}%`, 150, y + 4.5);
        y += 6;
      });

      y += 8;

      // Project Quality Insights
      const insight = analytics.quality_insights || {};
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(...darkColor);
      doc.text('5. PROJECT QUALITY INSIGHTS & HEALTH RATING', 14, y);
      y += 6;

      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(14, y, 182, 28, 2, 2, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(37, 99, 235);
      doc.text(`Rating: ${insight.health || 'Optimal'} (Score: ${insight.score || 0}/100) – ${insight.risk_level || 'Low Risk'}`, 20, y + 7);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(...darkColor);
      const splitSummary = doc.splitTextToSize(insight.summary || '', 170);
      doc.text(splitSummary, 20, y + 14);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(...grayColor);
      doc.text(`Recommendation: ${insight.recommendation || ''}`, 20, y + 23);

      // Save PDF
      const sanitizedProject = analytics.project.name.replace(/[^a-zA-Z0-9_-]/g, '_');
      doc.save(`BugFlow_${sanitizedProject}_Analytics_Report_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (exportErr) {
      console.error('PDF export error:', exportErr);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const selectedProjectObj = projects.find(p => p.id === selectedProjectId);

  return (
    <div>
      {/* Header & Controls Bar */}
      <div className="page-header" style={{ marginBottom: '20px' }}>
        <div>
          <h1 className="page-title">Project Quality Analytics</h1>
          <p className="page-subtitle">
            Software quality benchmarks, status distribution, monthly defect trends, and automated audit reports
          </p>
        </div>

        <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Project Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <FolderGit2 size={16} style={{ color: '#2563EB' }} />
            <select
              className="form-select"
              style={{ width: 'auto', minWidth: '220px', fontWeight: 600 }}
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.id})
                </option>
              ))}
            </select>
          </div>

          {/* Refresh Button */}
          <button
            className="btn btn-secondary"
            onClick={handleRefresh}
            disabled={loading || refreshing}
            title="Refresh analytics data"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 12px' }}
          >
            <RefreshCw size={15} className={refreshing ? 'spin-animation' : ''} />
            <span>Refresh</span>
          </button>

          {/* Export Report PDF Button */}
          <button
            className="btn btn-primary"
            onClick={handleExportPDF}
            disabled={loading || exporting || !analytics}
            title="Export full analytics report as PDF"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px' }}
          >
            <Download size={15} />
            <span>{exporting ? 'Generating PDF...' : 'Export Report'}</span>
          </button>
        </div>
      </div>

      {/* Date Range Filter Bar */}
      <div
        className="card"
        style={{
          padding: '12px 18px',
          marginBottom: '20px',
          background: '#FFFFFF',
          borderRadius: '10px',
          border: '1px solid #EAE5E0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.84rem', color: '#64748B', fontWeight: 600 }}>
            <Calendar size={15} style={{ color: '#2563EB' }} />
            <span>Date Range:</span>
          </div>

          <input
            type="date"
            className="form-input"
            style={{ width: 'auto', padding: '6px 10px', fontSize: '0.82rem' }}
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            placeholder="Start Date"
          />
          <span style={{ color: '#94A3B8', fontSize: '0.82rem' }}>to</span>
          <input
            type="date"
            className="form-input"
            style={{ width: 'auto', padding: '6px 10px', fontSize: '0.82rem' }}
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            placeholder="End Date"
          />

          {(startDate || endDate) && (
            <button
              className="btn btn-secondary"
              style={{ padding: '5px 10px', fontSize: '0.78rem' }}
              onClick={() => { setStartDate(''); setEndDate(''); }}
            >
              Reset Date Filter
            </button>
          )}
        </div>

        {/* Quick Date Presets */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '0.78rem', color: '#94A3B8', marginRight: '4px' }}>Quick:</span>
          {[
            { label: 'All Time', days: 0 },
            { label: 'Last 30 Days', days: 30 },
            { label: 'Last 90 Days', days: 90 },
            { label: 'Last 180 Days', days: 180 }
          ].map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => handleQuickDateFilter(preset.days)}
              style={{
                background: '#F8FAFC',
                border: '1px solid #E2E8F0',
                borderRadius: '6px',
                padding: '4px 10px',
                fontSize: '0.78rem',
                color: '#475569',
                cursor: 'pointer',
                fontWeight: 500
              }}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Error Notice */}
      {error && (
        <div className="toast-notice toast-error" style={{ marginBottom: '20px' }}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="loading-container" style={{ padding: '100px 0' }}>
          <div className="spinner"></div>
          <p>Calculating project analytics and defect metrics...</p>
        </div>
      ) : !analytics ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748B' }}>
          <AlertTriangle size={40} style={{ color: '#D97706', marginBottom: '10px' }} />
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1E293B' }}>No Analytics Data Found</div>
          <div style={{ fontSize: '0.85rem', color: '#64748B', marginTop: '6px' }}>
            Please select another project from the dropdown.
          </div>
        </div>
      ) : (
        <>
          {/* PART 4.B: Four Real Database Summary Cards */}
          <div className="stat-grid" style={{ marginBottom: '24px' }}>
            {/* Total Issues */}
            <div className="stat-card">
              <div className="stat-header">
                <span className="stat-title">Total Issues</span>
                <div className="stat-icon primary"><BarChart3 size={18} /></div>
              </div>
              <div className="stat-value">{analytics.summary.total_issues}</div>
              <div className="stat-trend">
                <span>{selectedProjectObj?.name || 'Project'} Tracked Defects</span>
              </div>
            </div>

            {/* Open Issues */}
            <div className="stat-card">
              <div className="stat-header">
                <span className="stat-title">Open Issues</span>
                <div className="stat-icon" style={{ background: '#FDF2F0', color: '#E97862' }}>
                  <AlertCircle size={18} />
                </div>
              </div>
              <div className="stat-value">{analytics.summary.open_issues}</div>
              <div className="stat-trend">
                <span style={{ color: '#E97862' }}>Awaiting Triage & Work</span>
              </div>
            </div>

            {/* In Progress Issues */}
            <div className="stat-card">
              <div className="stat-header">
                <span className="stat-title">In Progress Issues</span>
                <div className="stat-icon" style={{ background: '#FEF3C7', color: '#D97706' }}>
                  <Clock size={18} />
                </div>
              </div>
              <div className="stat-value">{analytics.summary.in_progress_issues}</div>
              <div className="stat-trend">
                <span style={{ color: '#D97706' }}>Active Development</span>
              </div>
            </div>

            {/* Resolved Issues */}
            <div className="stat-card">
              <div className="stat-header">
                <span className="stat-title">Resolved Issues</span>
                <div className="stat-icon" style={{ background: '#DCFCE7', color: '#16A34A' }}>
                  <ShieldCheck size={18} />
                </div>
              </div>
              <div className="stat-value">{analytics.summary.resolved_issues}</div>
              <div className="stat-trend">
                <span style={{ color: '#16A34A' }}>
                  {analytics.summary.resolved_only} Resolved • {analytics.summary.closed_only} Closed
                </span>
              </div>
            </div>
          </div>

          {/* Row 1: Charts (Donut Status Distribution & Monthly Defect Trend) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.35fr', gap: '24px', marginBottom: '24px' }}>
            
            {/* PART 4.C: Issue Status Distribution (Donut Chart) */}
            <div className="card" style={{ padding: '24px', background: '#FFFFFF', borderRadius: '12px', border: '1px solid #EAE5E0' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: '#1E293B' }}>
                  Issue Status Distribution
                </h2>
                <span style={{ fontSize: '0.78rem', color: '#64748B' }}>
                  Total: {analytics.summary.total_issues}
                </span>
              </div>

              <div style={{ height: '240px', width: '100%', position: 'relative' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={analytics.status_distribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={65}
                      outerRadius={95}
                      paddingAngle={3}
                      dataKey="count"
                      nameKey="status"
                    >
                      {analytics.status_distribution.map((entry, index) => (
                        <Cell key={`status-cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val, name, item) => [`${val} issues (${item.payload.percentage}%)`, name]}
                      contentStyle={{ backgroundColor: '#FFFFFF', borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '0.82rem' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Status Breakdown Legend & Percentages */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '8px', marginTop: '14px', paddingTop: '12px', borderTop: '1px solid #F1F5F9' }}>
                {analytics.status_distribution.map((item) => (
                  <div key={item.status} style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: item.color }} />
                      <span style={{ fontSize: '0.76rem', color: '#64748B', fontWeight: 500 }}>{item.status}</span>
                    </div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1E293B', marginLeft: '13px' }}>
                      {item.count} <span style={{ fontSize: '0.72rem', color: '#94A3B8', fontWeight: 400 }}>({item.percentage}%)</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* PART 4.D: Defect Trend Analysis (Monthly Line Chart: Created vs Resolved) */}
            <div className="card" style={{ padding: '24px', background: '#FFFFFF', borderRadius: '12px', border: '1px solid #EAE5E0' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div>
                  <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: '#1E293B' }}>
                    Defect Trend Analysis
                  </h2>
                  <p style={{ fontSize: '0.78rem', color: '#64748B', margin: '2px 0 0' }}>
                    Monthly defect creation versus resolution trajectory
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.78rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ width: '10px', height: '3px', background: '#2563EB' }} />
                    <span style={{ color: '#475569', fontWeight: 600 }}>Created</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ width: '10px', height: '3px', background: '#16A34A' }} />
                    <span style={{ color: '#475569', fontWeight: 600 }}>Resolved</span>
                  </div>
                </div>
              </div>

              <div style={{ height: '280px', width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={analytics.defect_trend} margin={{ top: 10, right: 15, left: -20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="label" tick={{ fill: '#64748B', fontSize: 11 }} />
                    <YAxis tick={{ fill: '#64748B', fontSize: 11 }} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#FFFFFF', borderRadius: '8px', border: '1px solid #E2E8F0', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', fontSize: '0.82rem' }}
                    />
                    <Line
                      type="monotone"
                      dataKey="created"
                      name="Issues Created"
                      stroke="#2563EB"
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: '#2563EB' }}
                      activeDot={{ r: 6 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="resolved"
                      name="Issues Resolved"
                      stroke="#16A34A"
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: '#16A34A' }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Row 2: Severity-wise Issues & Software Quality Metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.4fr', gap: '24px', marginBottom: '24px' }}>
            
            {/* PART 4.E: Severity-wise Issues (Bar Chart) */}
            <div className="card" style={{ padding: '24px', background: '#FFFFFF', borderRadius: '12px', border: '1px solid #EAE5E0' }}>
              <div style={{ marginBottom: '16px' }}>
                <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: '#1E293B' }}>
                  Severity-wise Issues
                </h2>
                <p style={{ fontSize: '0.78rem', color: '#64748B', margin: '2px 0 0' }}>
                  Issue volume grouped by operational impact severity
                </p>
              </div>

              <div style={{ height: '240px', width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analytics.severity_distribution} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="severity" tick={{ fill: '#64748B', fontSize: 12 }} />
                    <YAxis tick={{ fill: '#64748B', fontSize: 12 }} allowDecimals={false} />
                    <Tooltip
                      formatter={(val, name, item) => [`${val} issues (${item.payload.percentage}%)`, 'Count']}
                      contentStyle={{ backgroundColor: '#FFFFFF', borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '0.82rem' }}
                    />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {analytics.severity_distribution.map((entry, index) => (
                        <Cell key={`sev-cell-${index}`} fill={SEVERITY_COLORS[entry.severity] || '#2563EB'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* PART 4.F: Key Software Quality Metrics */}
            <div className="card" style={{ padding: '24px', background: '#FFFFFF', borderRadius: '12px', border: '1px solid #EAE5E0', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: '#1E293B' }}>
                  Key Software Quality Metrics
                </h2>
                <p style={{ fontSize: '0.78rem', color: '#64748B', margin: '2px 0 16px' }}>
                  Core engineering benchmarks derived from issue timestamps and outcomes
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {/* Metric 1: Average Resolution Time */}
                <div style={{ padding: '14px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '38px', height: '38px', borderRadius: '8px', background: '#EFF6FF', color: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Clock size={20} />
                    </div>
                    <div>
                      <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#1E293B' }}>
                        Average Resolution Time
                      </div>
                      <div style={{ fontSize: '0.76rem', color: '#64748B', marginTop: '2px' }}>
                        Mean duration from creation to resolution completion
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#2563EB' }}>
                      {analytics.quality_metrics.average_resolution_time.display}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#94A3B8' }}>
                      {analytics.quality_metrics.average_resolution_time.days} Days Equiv.
                    </div>
                  </div>
                </div>

                {/* Metric 2: Resolution Rate */}
                <div style={{ padding: '14px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '38px', height: '38px', borderRadius: '8px', background: '#DCFCE7', color: '#16A34A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <ShieldCheck size={20} />
                    </div>
                    <div>
                      <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#1E293B' }}>
                        Resolution Rate
                      </div>
                      <div style={{ fontSize: '0.76rem', color: '#64748B', marginTop: '2px' }}>
                        Ratio of closed/resolved defects over total logged issues
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#16A34A' }}>
                      {analytics.quality_metrics.resolution_rate.display}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#94A3B8' }}>
                      {analytics.summary.resolved_issues} / {analytics.summary.total_issues} Issues
                    </div>
                  </div>
                </div>

                {/* Metric 3: Defect Density (Explicitly showing data unavailable if KLOC not provided) */}
                <div style={{ padding: '14px', background: '#FFFBEB', borderRadius: '8px', border: '1px solid #FDE68A', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '38px', height: '38px', borderRadius: '8px', background: '#FEF3C7', color: '#D97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Info size={20} />
                    </div>
                    <div>
                      <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#92400E' }}>
                        Defect Density (per KLOC)
                      </div>
                      <div style={{ fontSize: '0.74rem', color: '#B45309', marginTop: '2px', maxWidth: '320px' }}>
                        {analytics.quality_metrics.defect_density.message}
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#D97706' }}>
                      Data unavailable
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#B45309' }}>
                      Project KLOC required
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* PART 4.G: Dynamic Project Quality Insights Card */}
          <div
            className="card"
            style={{
              padding: '24px',
              background: '#FFFFFF',
              borderRadius: '12px',
              border: `1px solid ${analytics.quality_insights.health_color}40`,
              boxShadow: '0 4px 12px rgba(0,0,0,0.03)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    background: `${analytics.quality_insights.health_color}15`,
                    color: analytics.quality_insights.health_color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <TrendingUp size={20} />
                </div>
                <div>
                  <h2 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, color: '#1E293B' }}>
                    Project Quality Insight: {analytics.quality_insights.headline}
                  </h2>
                  <div style={{ fontSize: '0.78rem', color: '#64748B', marginTop: '2px' }}>
                    Based on actual defect turnaround timestamps and issue resolution velocity
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    padding: '4px 12px',
                    borderRadius: '20px',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    background: `${analytics.quality_insights.health_color}15`,
                    color: analytics.quality_insights.health_color,
                    border: `1px solid ${analytics.quality_insights.health_color}40`
                  }}
                >
                  {analytics.quality_insights.health} • {analytics.quality_insights.risk_level}
                </span>
                <span style={{ fontSize: '0.84rem', fontWeight: 700, color: '#1E293B' }}>
                  Score: {analytics.quality_insights.score}/100
                </span>
              </div>
            </div>

            <div style={{ fontSize: '0.88rem', color: '#334155', lineHeight: 1.6, marginBottom: '12px' }}>
              {analytics.quality_insights.summary}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '0.82rem', color: '#475569' }}>
              <strong style={{ color: '#1E293B' }}>Actionable Guidance:</strong>
              <span>{analytics.quality_insights.recommendation}</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
