import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  FolderGit2,
  Bug,
  BarChart3,
  Settings,
  Layers,
  CheckSquare,
  MessageSquare,
  LogOut
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const role = user?.role || 'Developer';

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <aside className="sidebar">
      {/* Brand Header */}
      <div className="sidebar-brand">
        <div className="brand-icon">
          <Bug size={22} />
        </div>
        <div>
          <div className="brand-title">BugFlow</div>
          <div className="brand-tagline">Issue & Bug Tracker</div>
        </div>
      </div>

      {/* Role-Specific Navigation */}
      <nav className="sidebar-nav">
        {/* Common to all */}
        <NavLink
          to="/"
          className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
          end
        >
          <LayoutDashboard size={18} />
          <span>Dashboard</span>
        </NavLink>

        {/* ADMIN NAV */}
        {role === 'Admin' && (
          <>
            <NavLink
              to="/users"
              className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
            >
              <Users size={18} />
              <span>Users</span>
            </NavLink>
            <NavLink
              to="/projects"
              className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
            >
              <FolderGit2 size={18} />
              <span>Projects</span>
            </NavLink>
            <NavLink
              to="/issues"
              className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
            >
              <Bug size={18} />
              <span>Issues</span>
            </NavLink>
            <NavLink
              to="/reports"
              className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
            >
              <BarChart3 size={18} />
              <span>Reports</span>
            </NavLink>
            <NavLink
              to="/settings"
              className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
            >
              <Settings size={18} />
              <span>Settings</span>
            </NavLink>
          </>
        )}

        {/* PROJECT MANAGER NAV */}
        {role === 'Project Manager' && (
          <>
            <NavLink
              to="/projects"
              className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
            >
              <FolderGit2 size={18} />
              <span>My Projects</span>
            </NavLink>
            <NavLink
              to="/issues"
              className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
            >
              <Bug size={18} />
              <span>Issues</span>
            </NavLink>
            <NavLink
              to="/sprints"
              className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
            >
              <Layers size={18} />
              <span>Sprints</span>
            </NavLink>
            <NavLink
              to="/reports"
              className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
            >
              <BarChart3 size={18} />
              <span>Reports</span>
            </NavLink>
          </>
        )}

        {/* DEVELOPER NAV */}
        {role === 'Developer' && (
          <>
            <NavLink
              to="/my-issues"
              className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
            >
              <Bug size={18} />
              <span>My Issues</span>
            </NavLink>
            <NavLink
              to="/projects"
              className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
            >
              <FolderGit2 size={18} />
              <span>Projects</span>
            </NavLink>
            <NavLink
              to="/issues"
              className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
            >
              <CheckSquare size={18} />
              <span>All Issues</span>
            </NavLink>
            <NavLink
              to="/comments"
              className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
            >
              <MessageSquare size={18} />
              <span>Comments</span>
            </NavLink>
          </>
        )}

        {/* TESTER NAV */}
        {role === 'Tester' && (
          <>
            <NavLink
              to="/reported-issues"
              className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
            >
              <Bug size={18} />
              <span>Reported Issues</span>
            </NavLink>
            <NavLink
              to="/my-tests"
              className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
            >
              <CheckSquare size={18} />
              <span>My Tests</span>
            </NavLink>
            <NavLink
              to="/issues"
              className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
            >
              <FolderGit2 size={18} />
              <span>All Issues</span>
            </NavLink>
            <NavLink
              to="/reports"
              className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
            >
              <BarChart3 size={18} />
              <span>Reports</span>
            </NavLink>
          </>
        )}
      </nav>

      {/* Footer Profile & Logout */}
      <div className="sidebar-footer">
        <div className="user-profile">
          <div className="user-info">
            <div className="user-avatar">
              {(user?.name || user?.username || 'U')[0].toUpperCase()}
            </div>
            <div style={{ minWidth: 0 }}>
              <div className="user-name" title={user?.name}>{user?.name || 'User'}</div>
              <span className="user-role-badge">{role}</span>
            </div>
          </div>
          <button className="btn-icon" onClick={handleLogout} title="Logout">
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
}
