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
  login: (username, password) =>
    request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  register: (userData) =>
    request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    }),
  getMe: () => request('/auth/me'),

  // Dashboard
  getDashboardStats: (userId) =>
    request(`/dashboard/stats${userId ? `?user_id=${userId}` : ''}`),
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
  updateStatus: (id, status, comment, resolution) =>
    request(`/issues/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, comment, resolution }),
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
  getProjects: () => request('/projects'),
  getProject: (id) => request(`/projects/${id}`),
  createProject: (projectData) =>
    request('/projects', {
      method: 'POST',
      body: JSON.stringify(projectData),
    }),
  assignProjectMember: (projectId, userId) =>
    request(`/projects/${projectId}/members`, {
      method: 'POST',
      body: JSON.stringify({ user_id: userId }),
    }),

  // Resolution Assistant (TF-IDF Similarity)
  getSimilarIssues: (title, description, top_k = 3) =>
    request('/assistant/similar', {
      method: 'POST',
      body: JSON.stringify({ title, description, top_k }),
    }),
};
