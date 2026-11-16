import React from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  FolderGit2,
  Bug,
  Layers,
  CheckSquare,
  BarChart3,
  Users,
  Settings,
  LogOut,
  GitBranch,
  Workflow
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const pathname = location.pathname;

  const isDashboardActive = pathname === '/' || pathname.includes('/dashboard');
  const isProjectsActive = pathname.startsWith('/projects');
  const isIssuesActive = pathname.startsWith('/issues') || pathname.startsWith('/my-issues') || pathname.startsWith('/reported-issues');
  const isSprintsActive = pathname.startsWith('/sprints');
  const isBacklogActive = pathname.startsWith('/backlog');
  const isAnalyticsActive = pathname.startsWith('/analytics') || pathname.startsWith('/reports');
  const isGithubActive = pathname.startsWith('/github');
  const isCicdActive = pathname.startsWith('/cicd');
  const isTeamActive = pathname.startsWith('/team') || pathname.startsWith('/users');
  const isSettingsActive = pathname.startsWith('/settings');

  // Menu items (GitHub & CI/CD)
  const navItems = [
    { name: 'Dashboard', path: '/admin/dashboard', icon: LayoutDashboard, active: isDashboardActive },
    { name: 'Projects', path: '/projects', icon: FolderGit2, active: isProjectsActive },
    { name: 'Issues', path: '/issues', icon: Bug, active: isIssuesActive },
    { name: 'Sprints', path: '/sprints', icon: Layers, active: isSprintsActive },
    { name: 'Backlog', path: '/backlog', icon: CheckSquare, active: isBacklogActive },
    { name: 'Analytics', path: '/analytics', icon: BarChart3, active: isAnalyticsActive },
    { name: 'GitHub', path: '/github', icon: GitBranch, active: isGithubActive },
    { name: 'CI/CD', path: '/cicd', icon: Workflow, active: isCicdActive },
    { name: 'Team', path: '/team', icon: Users, active: isTeamActive },
    { name: 'Settings', path: '/settings', icon: Settings, active: isSettingsActive }
  ];

  return (
    <aside className="sidebar">
      {/* Brand Header */}
      <div className="sidebar-brand">
        <div className="brand-icon">
          <Bug size={22} color="#FFFFFF" />
        </div>
        <div>
          <div className="brand-title">BugFlow</div>
          <div className="brand-tagline">Issue & Bug Tracker</div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        {navItems.map((item) => {
          const IconComp = item.icon;
          return (
            <NavLink
              key={item.name}
              to={item.path}
              className={() => (item.active ? 'nav-link active' : 'nav-link')}
            >
              <IconComp size={18} />
              <span>{item.name}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Footer User Profile & Logout */}
      <div className="sidebar-footer">
        <div className="user-profile">
          <div className="user-info">
            <div className="user-avatar">
              K
            </div>
            <div className="user-meta">
              <div className="user-name">Krupa</div>
              <span className="user-role-badge">Admin</span>
            </div>
          </div>
          <button
            type="button"
            className="sidebar-logout-btn"
            onClick={handleLogout}
            title="Logout"
          >
            <LogOut size={17} />
          </button>
        </div>
      </div>
    </aside>
  );
}
