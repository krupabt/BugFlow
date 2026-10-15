import React, { useState, useEffect } from 'react';
import {
  Users as UsersIcon,
  Plus,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  Search,
  AlertCircle,
  X,
  ShieldAlert
} from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

const ROLES = ["Admin", "Project Manager", "Developer", "Tester"];

export default function Users() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Filters
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalUser, setEditModalUser] = useState(null);

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'Developer',
    password: 'BugFlow@2026'
  });

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await api.getUsers({
        role: roleFilter || undefined,
        search: search || undefined
      });
      setUsers(data);
    } catch (err) {
      setError(err.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, [roleFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadUsers();
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      await api.createUser(formData);
      setNotice(`User ${formData.name} added successfully!`);
      setTimeout(() => setNotice(''), 3000);
      setCreateModalOpen(false);
      setFormData({ name: '', email: '', role: 'Developer', password: 'BugFlow@2026' });
      loadUsers();
    } catch (err) {
      setError(err.message || 'Failed to create user');
    }
  };

  const handleEditUser = async (e) => {
    e.preventDefault();
    if (!editModalUser) return;
    try {
      await api.updateUser(editModalUser.id, editModalUser);
      setNotice(`User ${editModalUser.name} updated successfully!`);
      setTimeout(() => setNotice(''), 3000);
      setEditModalUser(null);
      loadUsers();
    } catch (err) {
      setError(err.message || 'Failed to update user');
    }
  };

  const handleToggleStatus = async (targetUser) => {
    try {
      await api.toggleUserStatus(targetUser.id, !targetUser.active);
      const action = !targetUser.active ? 'activated' : 'deactivated';
      setNotice(`User ${targetUser.name} has been ${action}.`);
      setTimeout(() => setNotice(''), 3000);
      loadUsers();
    } catch (err) {
      setError(err.message || 'Failed to update user status');
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">User Management</h1>
          <p className="page-subtitle">
            Admin console for provisioning, managing roles, and controlling user access
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setCreateModalOpen(true)}>
          <Plus size={16} />
          <span>Add User</span>
        </button>
      </div>

      {notice && (
        <div className="toast-notice toast-success">
          <CheckCircle size={18} />
          <span>{notice}</span>
        </div>
      )}

      {error && (
        <div className="toast-notice toast-error">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Filter Bar */}
      <div className="filter-bar">
        <form onSubmit={handleSearchSubmit} className="search-input-wrapper">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Search by ID, name, or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </form>

        <select
          className="form-select"
          style={{ width: 'auto', minWidth: '160px' }}
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
        >
          <option value="">All Roles</option>
          {ROLES.map(r => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </div>

      {/* Users Table */}
      {loading ? (
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading users from database...</p>
        </div>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>User ID</th>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td style={{ fontWeight: 700, color: '#6754E8' }}>{u.id}</td>
                  <td style={{ fontWeight: 600 }}>{u.name}</td>
                  <td>{u.email}</td>
                  <td>
                    <span className="user-role-badge">{u.role_display || u.role}</span>
                  </td>
                  <td>
                    {u.active ? (
                      <span className="badge badge-resolved">Active</span>
                    ) : (
                      <span className="badge badge-closed">Deactivated</span>
                    )}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '8px' }}>
                      <button
                        className="btn-icon"
                        title="Edit User"
                        onClick={() => setEditModalUser({ ...u })}
                      >
                        <Edit size={15} />
                      </button>
                      <button
                        className="btn-icon"
                        title={u.active ? 'Deactivate User' : 'Activate User'}
                        style={{ color: u.active ? '#F59E0B' : '#16A34A' }}
                        onClick={() => handleToggleStatus(u)}
                      >
                        {u.active ? <XCircle size={15} /> : <CheckCircle size={15} />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create User Modal */}
      {createModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h2 className="modal-title">Add New Team Member</h2>
              <button className="btn-icon" onClick={() => setCreateModalOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateUser}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Full Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    required
                    placeholder="e.g. John Doe"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Email Address *</label>
                  <input
                    type="email"
                    className="form-input"
                    required
                    placeholder="e.g. john.doe@example.org"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Role *</label>
                  <select
                    className="form-select"
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  >
                    {ROLES.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Temporary Password</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setCreateModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editModalUser && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h2 className="modal-title">Edit User {editModalUser.id}</h2>
              <button className="btn-icon" onClick={() => setEditModalUser(null)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleEditUser}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Full Name</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editModalUser.name || ''}
                    onChange={(e) => setEditModalUser({ ...editModalUser, name: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Email Address</label>
                  <input
                    type="email"
                    className="form-input"
                    value={editModalUser.email || ''}
                    onChange={(e) => setEditModalUser({ ...editModalUser, email: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Role</label>
                  <select
                    className="form-select"
                    value={editModalUser.role_display || editModalUser.role || 'Developer'}
                    onChange={(e) => setEditModalUser({ ...editModalUser, role: e.target.value })}
                  >
                    {ROLES.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select
                    className="form-select"
                    value={editModalUser.active ? 'true' : 'false'}
                    onChange={(e) => setEditModalUser({ ...editModalUser, active: e.target.value === 'true' })}
                  >
                    <option value="true">Active</option>
                    <option value="false">Deactivated</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setEditModalUser(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
