const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:5000/api';

async function request(endpoint, options = {}) {
  const token = localStorage.getItem('bugflow_token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const url = `${BASE_URL}${endpoint}`;
  try {
    const res = await fetch(url, { ...options, headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const errorMsg = data.error || data.message || `Request failed (${res.status})`;
      throw new Error(errorMsg);
    }
    return data;
  } catch (err) {
    console.error(`API Error on ${endpoint}:`, err);
    throw err;
  }
}

export const api = {
  // Health
  checkHealth: () => request('/health'),

  // Auth
  login: (email, password) =>
    request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  register: (userData) =>
    request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    }),
  getMe: () => request('/auth/me'),

  // Users Management (Admin)
  getUsers: (params = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') query.append(k, v);
    });
    return request(`/users?${query.toString()}`);
  },
  getUser: (id) => request(`/users/${id}`),
  createUser: (userData) =>
    request('/users', {
      method: 'POST',
      body: JSON.stringify(userData),
    }),
  updateUser: (id, userData) =>
    request(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(userData),
    }),
  toggleUserStatus: (id, active) =>
    request(`/users/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ active }),
    }),
  deleteUser: (id) =>
    request(`/users/${id}`, {
      method: 'DELETE',
    }),

  // Dashboard
  getDashboardStats: (role, userId) => {
    const query = new URLSearchParams();
    if (role) query.append('role', role);
    if (userId) query.append('user_id', userId);
    return request(`/dashboard/stats?${query.toString()}`);
  },
  getRecentActivity: () => request('/dashboard/recent-activity'),

  // Issues
  getIssues: (params = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        query.append(k, v);
      }
    });
    return request(`/issues?${query.toString()}`);
  },
  getIssue: (id) => request(`/issues/${id}`),
  createIssue: (issueData) =>
    request('/issues', {
      method: 'POST',
      body: JSON.stringify(issueData),
    }),
  updateIssue: (id, issueData) =>
    request(`/issues/${id}`, {
      method: 'PUT',
      body: JSON.stringify(issueData),
    }),
  assignIssue: (id, assigned_to) =>
    request(`/issues/${id}/assign`, {
      method: 'PATCH',
      body: JSON.stringify({ assigned_to }),
    }),
  updateStatus: (id, status, comment, resolution_summary, root_cause) =>
    request(`/issues/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, comment, resolution_summary, root_cause }),
    }),
  addComment: (id, content) =>
    request(`/issues/${id}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    }),
  deleteIssue: (id) =>
    request(`/issues/${id}`, {
      method: 'DELETE',
    }),

  // Projects
  getProjects: (params = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') query.append(k, v);
    });
    return request(`/projects?${query.toString()}`);
  },
  getProject: (id) => request(`/projects/${id}`),
  createProject: (projectData) =>
    request('/projects', {
      method: 'POST',
      body: JSON.stringify(projectData),
    }),
  updateProject: (id, projectData) =>
    request(`/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(projectData),
    }),
  assignProjectMember: (projectId, userId) =>
    request(`/projects/${projectId}/members`, {
      method: 'POST',
      body: JSON.stringify({ user_id: userId }),
    }),

  // Sprints
  getSprints: (params = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') query.append(k, v);
    });
    return request(`/sprints?${query.toString()}`);
  },
  getSprint: (id) => request(`/sprints/${id}`),
  createSprint: (sprintData) =>
    request('/sprints', {
      method: 'POST',
      body: JSON.stringify(sprintData),
    }),
  updateSprintStatus: (id, status) =>
    request(`/sprints/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  // Reports
  getReports: (projectId = null) => {
    const query = projectId && projectId !== 'All' ? `?project_id=${projectId}` : '';
    return request(`/reports${query}`);
  },
};
