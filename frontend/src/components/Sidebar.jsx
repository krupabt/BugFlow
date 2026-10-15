import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Bug, FolderGit2, Sparkles, LogOut, ShieldAlert } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Sidebar() {
  const { user, logout } = useAuth();

  return (
    <aside className="sidebar">
      {/* Brand Header */}
      <div className="sidebar-brand">
        <div className="brand-icon">
          <Bug size={22} />
        </div>
        <div>
          <div className="brand-title">BugFlow</div>
          <div className="brand-tagline">Better tracking. Faster resolution.</div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        <NavLink
          to="/"
          className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
          end
        >
          <LayoutDashboard size={18} />
          <span>Dashboard</span>
        </NavLink>

        <NavLink
          to="/issues"
          className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
        >
          <Bug size={18} />
          <span>Issues</span>
        </NavLink>

        <NavLink
          to="/projects"
          className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
        >
          <FolderGit2 size={18} />
          <span>Projects</span>
        </NavLink>

        <NavLink
          to="/assistant"
          className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
        >
          <Sparkles size={18} />
          <span>Resolution Assistant</span>
        </NavLink>
      </nav>

      {/* Footer Profile & Logout */}
      <div className="sidebar-footer">
        <div className="user-profile">
          <div className="user-info">
            <div className="user-avatar">
              {(user?.full_name || user?.username || 'U')[0].toUpperCase()}
            </div>
            <div style={{ minWidth: 0 }}>
              <div className="user-name">{user?.full_name || user?.username || 'Guest'}</div>
              <span className="user-role-badge">{user?.role || 'Developer'}</span>
            </div>
          </div>
          <button className="btn-icon" onClick={logout} title="Sign Out">
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
}
