import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth, getRoleDashboardPath } from './context/AuthContext';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Issues from './pages/Issues';
import IssueDetail from './pages/IssueDetail';
import Projects from './pages/Projects';
import Sprints from './pages/Sprints';
import Reports from './pages/Reports';
import Users from './pages/Users';
import Settings from './pages/Settings';
import Login from './pages/Login';
import Register from './pages/Register';

function RoleRoute({ allowedRoles, children }) {
  const { user } = useAuth();
  const userRole = (user?.role || '').toUpperCase().replace(/ /g, '_');
  
  if (!allowedRoles.includes(userRole)) {
    const fallbackPath = getRoleDashboardPath(userRole);
    return <Navigate to={fallbackPath} replace />;
  }
  return children;
}

function RoleRootRedirect() {
  const { user } = useAuth();
  const target = getRoleDashboardPath(user?.role);
  return <Navigate to={target} replace />;
}

function ProtectedLayout() {
  const { user, token, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-container" style={{ height: '100vh' }}>
        <div className="spinner"></div>
        <p>Loading BugFlow workspace...</p>
      </div>
    );
  }

  if (!token && !user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="app-container">
      <Sidebar />
      <main className="main-content">
        <Routes>
          {/* Role Dashboard Routes */}
          <Route
            path="/admin/dashboard"
            element={
              <RoleRoute allowedRoles={['ADMIN']}>
                <Dashboard />
              </RoleRoute>
            }
          />
          <Route
            path="/manager/dashboard"
            element={
              <RoleRoute allowedRoles={['PROJECT_MANAGER']}>
                <Dashboard />
              </RoleRoute>
            }
          />
          <Route
            path="/developer/dashboard"
            element={
              <RoleRoute allowedRoles={['DEVELOPER']}>
                <Dashboard />
              </RoleRoute>
            }
          />
          <Route
            path="/tester/dashboard"
            element={
              <RoleRoute allowedRoles={['TESTER']}>
                <Dashboard />
              </RoleRoute>
            }
          />

          {/* Root redirect to appropriate role dashboard */}
          <Route path="/" element={<RoleRootRedirect />} />

          {/* Feature Routes */}
          <Route path="/issues" element={<Issues />} />
          <Route path="/issues/:id" element={<IssueDetail />} />
          <Route path="/my-issues" element={<Issues />} />
          <Route path="/reported-issues" element={<Issues />} />
          <Route path="/my-tests" element={<Issues />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/sprints" element={<Sprints />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/users" element={<Users />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/comments" element={<Issues />} />
          <Route path="*" element={<RoleRootRedirect />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/*" element={<ProtectedLayout />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
