const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

async function request(endpoint, options = {}) {
  const token = localStorage.getItem('bugflow_token');
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const headers = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const url = `${BASE_URL}${endpoint}`;
  try {
    const res = await fetch(url, { ...options, headers });
    
    // Check if response is a blob/file download
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/octet-stream') || options.responseType === 'blob') {
      if (!res.ok) {
        throw new Error(`File download failed (${res.status})`);
      }
      return await res.blob();
    }

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
  logout: () =>
    request('/auth/logout', {
      method: 'POST',
    }),

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
  getDashboardStats: (params = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') query.append(k, v);
    });
    const qs = query.toString();
    return request(`/dashboard/stats${qs ? `?${qs}` : ''}`);
  },
  getRecentActivity: (params = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') query.append(k, v);
    });
    const qs = query.toString();
    return request(`/dashboard/recent-activity${qs ? `?${qs}` : ''}`);
  },
  getDashboardRecentComments: (params = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') query.append(k, v);
    });
    const qs = query.toString();
    return request(`/dashboard/recent-comments${qs ? `?${qs}` : ''}`);
  },
  getDashboardRecentAttachments: (params = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') query.append(k, v);
    });
    const qs = query.toString();
    return request(`/dashboard/recent-attachments${qs ? `?${qs}` : ''}`);
  },

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
  deleteIssue: (id) =>
    request(`/issues/${id}`, {
      method: 'DELETE',
    }),

  // Comments (Collaboration)
  getComments: (issueId) => request(`/issues/${issueId}/comments`),
  addComment: (issueId, content) =>
    request(`/issues/${issueId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    }),
  updateComment: (issueId, commentId, content) =>
    request(`/issues/${issueId}/comments/${commentId}`, {
      method: 'PUT',
      body: JSON.stringify({ content }),
    }),
  deleteComment: (issueId, commentId) =>
    request(`/issues/${issueId}/comments/${commentId}`, {
      method: 'DELETE',
    }),

  // Attachments (Collaboration)
  getAttachments: (issueId) => request(`/issues/${issueId}/attachments`),
  uploadAttachment: (issueId, file) => {
    const formData = new FormData();
    formData.append('file', file);
    return request(`/issues/${issueId}/attachments`, {
      method: 'POST',
      body: formData,
    });
  },
  deleteAttachment: (issueId, attachmentId) =>
    request(`/issues/${issueId}/attachments/${attachmentId}`, {
      method: 'DELETE',
    }),
  downloadAttachment: async (issueId, attachmentId, filename) => {
    const blob = await request(`/issues/${issueId}/attachments/${attachmentId}/download`, {
      responseType: 'blob'
    });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || `attachment-${attachmentId}`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },

  // Issue Activity History & Related Issues
  getIssueActivity: (issueId) => request(`/issues/${issueId}/activity`),
  getRelatedIssues: (issueId) => request(`/issues/${issueId}/related`),

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
  getProjectIssues: (projectId, params = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') query.append(k, v);
    });
    return request(`/projects/${projectId}/issues?${query.toString()}`);
  },

  // Sprints & Backlog Management
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
  updateSprint: (id, sprintData) =>
    request(`/sprints/${id}`, {
      method: 'PUT',
      body: JSON.stringify(sprintData),
    }),
  deleteSprint: (id) =>
    request(`/sprints/${id}`, {
      method: 'DELETE',
    }),
  getSprintBacklog: (sprintId, params = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') query.append(k, v);
    });
    return request(`/sprints/${sprintId}/backlog?${query.toString()}`);
  },
  addIssueToSprint: (sprintId, issueId) =>
    request(`/sprints/${sprintId}/issues`, {
      method: 'POST',
      body: JSON.stringify({ issue_id: issueId }),
    }),
  removeIssueFromSprint: (sprintId, issueId) =>
    request(`/sprints/${sprintId}/issues/${issueId}`, {
      method: 'DELETE',
    }),
  updateSprintIssueStatus: (sprintId, issueId, status) =>
    request(`/sprints/${sprintId}/issues/${issueId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  // Reports & Analytics
  getReports: (projectId = null) => {
    const query = projectId && projectId !== 'All' ? `?project_id=${projectId}` : '';
    return request(`/reports${query}`);
  },
  getProjectAnalytics: (projectId, params = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') query.append(k, v);
    });
    const qs = query.toString();
    return request(`/analytics/projects/${projectId}${qs ? `?${qs}` : ''}`);
  },
  getOverviewAnalytics: (params = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') query.append(k, v);
    });
    const qs = query.toString();
    return request(`/analytics/projects${qs ? `?${qs}` : ''}`);
  },
  getDetailedAnalytics: (params = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') query.append(k, v);
    });
    const qs = query.toString();
    return request(`/analytics/detailed${qs ? `?${qs}` : ''}`);
  },

  // Resolution Assistant
  getSimilarIssues: (title, description, top_k = 3) =>
    request('/assistant/similar', {
      method: 'POST',
      body: JSON.stringify({ title, description, top_k }),
    }),

  // GitHub Integration (Milestone 3)
  getGithubStatus: () => request('/github/status'),
  connectGithub: (data) =>
    request('/github/connect', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  disconnectGithub: () =>
    request('/github/disconnect', {
      method: 'POST',
    }),
  getGithubCommits: (params = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') query.append(k, v);
    });
    const qs = query.toString();
    return request(`/github/commits${qs ? `?${qs}` : ''}`);
  },
  getIssueGithubActivity: (issueId) => request(`/github/issues/${issueId}/activity`),
  getCommitDetails: (commitId) => request(`/github/commits/${commitId}`),
  linkCommitToIssue: (issueId, commitSha) =>
    request(`/github/issues/${issueId}/link`, {
      method: 'POST',
      body: JSON.stringify({ commit_sha: commitSha }),
    }),
  unlinkCommitFromIssue: (issueId, commitSha) =>
    request(`/github/issues/${issueId}/unlink/${commitSha}`, {
      method: 'DELETE',
    }),

  // CI/CD Integration (Milestone 3)
  getCicdStatus: () => request('/cicd/status'),
  getCicdWorkflows: () => request('/cicd/workflows'),
  getCicdRuns: (params = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') query.append(k, v);
    });
    const qs = query.toString();
    return request(`/cicd/runs${qs ? `?${qs}` : ''}`);
  },
  getCicdRun: (identifier) => request(`/cicd/runs/${identifier}`),
  getCicdLatest: () => request('/cicd/latest'),
  runAutomatedTests: () =>
    request('/cicd/run-tests', {
      method: 'POST',
    }),
  getTestResults: () => request('/cicd/test-results'),
  getCicdMetrics: () => request('/cicd/metrics'),
};
