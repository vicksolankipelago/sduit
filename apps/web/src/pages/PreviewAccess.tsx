import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import './PreviewAccess.css';

interface PreviewCredential {
  id: string;
  username: string;
  label: string | null;
  status: 'active' | 'expired' | 'revoked';
  createdAt: string;
  expiresAt: string | null;
  lastUsedAt: string | null;
}

interface CreateCredentialResponse {
  id: string;
  username: string;
  password: string;
  label: string | null;
  expiresAt: string | null;
}

interface BulkCredential {
  username: string;
  password: string;
  label: string | null;
}

interface BulkCreateResponse {
  count: number;
  credentials: BulkCredential[];
}

async function fetchCredentials(): Promise<PreviewCredential[]> {
  const response = await fetch('/api/admin/preview-credentials', {
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error('Failed to fetch credentials');
  }
  return response.json();
}

async function createCredential(data: { label?: string; expiresAt?: string }): Promise<CreateCredentialResponse> {
  const response = await fetch('/api/admin/preview-credentials', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error('Failed to create credential');
  }
  return response.json();
}

async function bulkCreateCredentials(data: { count: number; labelPrefix?: string; expiresAt?: string }): Promise<BulkCreateResponse> {
  const response = await fetch('/api/admin/preview-credentials/bulk', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error('Failed to create credentials');
  }
  return response.json();
}

async function revokeCredential(id: string): Promise<void> {
  const response = await fetch(`/api/admin/preview-credentials/${id}/revoke`, {
    method: 'PATCH',
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error('Failed to revoke credential');
  }
}

async function deleteCredential(id: string): Promise<void> {
  const response = await fetch(`/api/admin/preview-credentials/${id}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error('Failed to delete credential');
  }
}

function formatDate(dateString: string | null): string {
  if (!dateString) return '—';
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getStatusClass(status: string): string {
  switch (status) {
    case 'active':
      return 'status-active';
    case 'expired':
      return 'status-expired';
    case 'revoked':
      return 'status-revoked';
    default:
      return '';
  }
}

export const PreviewAccessPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showCredentialModal, setShowCredentialModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [newCredential, setNewCredential] = useState<CreateCredentialResponse | null>(null);
  const [bulkCredentials, setBulkCredentials] = useState<BulkCredential[]>([]);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [formLabel, setFormLabel] = useState('');
  const [formExpiresAt, setFormExpiresAt] = useState('');
  const [bulkCount, setBulkCount] = useState('10');
  const [bulkLabelPrefix, setBulkLabelPrefix] = useState('');
  const [isBulkMode, setIsBulkMode] = useState(false);

  const { data: credentials = [], isLoading, error } = useQuery({
    queryKey: ['preview-credentials'],
    queryFn: fetchCredentials,
  });

  const createMutation = useMutation({
    mutationFn: createCredential,
    onSuccess: (data) => {
      setNewCredential(data);
      setShowCredentialModal(true);
      setShowCreateForm(false);
      setFormLabel('');
      setFormExpiresAt('');
      queryClient.invalidateQueries({ queryKey: ['preview-credentials'] });
    },
  });

  const bulkCreateMutation = useMutation({
    mutationFn: bulkCreateCredentials,
    onSuccess: (data) => {
      setBulkCredentials(data.credentials);
      setShowBulkModal(true);
      setShowCreateForm(false);
      setBulkCount('10');
      setBulkLabelPrefix('');
      setFormExpiresAt('');
      queryClient.invalidateQueries({ queryKey: ['preview-credentials'] });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: revokeCredential,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['preview-credentials'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCredential,
    onSuccess: () => {
      setDeleteConfirmId(null);
      queryClient.invalidateQueries({ queryKey: ['preview-credentials'] });
    },
  });

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isBulkMode) {
      bulkCreateMutation.mutate({
        count: parseInt(bulkCount) || 10,
        labelPrefix: bulkLabelPrefix || undefined,
        expiresAt: formExpiresAt || undefined,
      });
    } else {
      createMutation.mutate({
        label: formLabel || undefined,
        expiresAt: formExpiresAt || undefined,
      });
    }
  };

  const downloadCSV = (creds: BulkCredential[]) => {
    const csvContent = creds.map(c => `${c.username},${c.password}`).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `preview-credentials-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const copyAllAsCSV = (creds: BulkCredential[]) => {
    const csvContent = creds.map(c => `${c.username},${c.password}`).join('\n');
    navigator.clipboard.writeText(csvContent);
  };

  const handleRevoke = (id: string) => {
    revokeMutation.mutate(id);
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="preview-access-page">
      <div className="preview-access-container">
        <div className="preview-access-header">
          <div>
            <h1>Preview Access</h1>
            <p className="preview-access-subtitle">Manage preview credentials for external users</p>
          </div>
          <button
            className="create-btn"
            onClick={() => setShowCreateForm(!showCreateForm)}
          >
            {showCreateForm ? 'Cancel' : '+ Create New Access'}
          </button>
        </div>

        {showCreateForm && (
          <div className="preview-access-section">
            <h2>Create New Access</h2>
            <div className="mode-toggle">
              <button
                type="button"
                className={`mode-btn ${!isBulkMode ? 'active' : ''}`}
                onClick={() => setIsBulkMode(false)}
              >
                Single
              </button>
              <button
                type="button"
                className={`mode-btn ${isBulkMode ? 'active' : ''}`}
                onClick={() => setIsBulkMode(true)}
              >
                Bulk Create
              </button>
            </div>
            <form onSubmit={handleCreateSubmit} className="create-form">
              {isBulkMode ? (
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="bulkCount">Number of Credentials</label>
                    <input
                      type="number"
                      id="bulkCount"
                      min="1"
                      max="500"
                      value={bulkCount}
                      onChange={(e) => setBulkCount(e.target.value)}
                      placeholder="10"
                    />
                    <span className="form-hint">Max 500 at a time</span>
                  </div>
                  <div className="form-group">
                    <label htmlFor="labelPrefix">Label Prefix (optional)</label>
                    <input
                      type="text"
                      id="labelPrefix"
                      value={bulkLabelPrefix}
                      onChange={(e) => setBulkLabelPrefix(e.target.value)}
                      placeholder="e.g., Participant"
                    />
                    <span className="form-hint">Creates: Participant 1, Participant 2...</span>
                  </div>
                  <div className="form-group">
                    <label htmlFor="expiresAt">Expiry Date (optional)</label>
                    <input
                      type="datetime-local"
                      id="expiresAt"
                      value={formExpiresAt}
                      onChange={(e) => setFormExpiresAt(e.target.value)}
                    />
                  </div>
                </div>
              ) : (
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="label">Label (optional)</label>
                    <input
                      type="text"
                      id="label"
                      value={formLabel}
                      onChange={(e) => setFormLabel(e.target.value)}
                      placeholder="e.g., Client Demo, Partner Preview"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="expiresAt">Expiry Date (optional)</label>
                    <input
                      type="datetime-local"
                      id="expiresAt"
                      value={formExpiresAt}
                      onChange={(e) => setFormExpiresAt(e.target.value)}
                    />
                  </div>
                </div>
              )}
              <button
                type="submit"
                className="submit-btn"
                disabled={createMutation.isPending || bulkCreateMutation.isPending}
              >
                {(createMutation.isPending || bulkCreateMutation.isPending) 
                  ? 'Creating...' 
                  : isBulkMode 
                    ? `Create ${bulkCount} Credentials` 
                    : 'Create Credential'}
              </button>
              {(createMutation.isError || bulkCreateMutation.isError) && (
                <p className="error-message">Failed to create credential(s). Please try again.</p>
              )}
            </form>
          </div>
        )}

        <div className="preview-access-section">
          <h2>Credentials</h2>
          {isLoading ? (
            <div className="loading-state">Loading credentials...</div>
          ) : error ? (
            <div className="error-state">Failed to load credentials</div>
          ) : credentials.length === 0 ? (
            <div className="empty-state">
              <p>No preview credentials created yet.</p>
              <p>Click "Create New Access" to generate credentials for external users.</p>
            </div>
          ) : (
            <div className="credentials-table-wrapper">
              <table className="credentials-table">
                <thead>
                  <tr>
                    <th>Username</th>
                    <th>Label</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th>Expires</th>
                    <th>Last Used</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {credentials.map((cred) => (
                    <tr key={cred.id}>
                      <td className="username-cell">
                        <code>{cred.username}</code>
                      </td>
                      <td>{cred.label || '—'}</td>
                      <td>
                        <span className={`status-badge ${getStatusClass(cred.status)}`}>
                          {cred.status}
                        </span>
                      </td>
                      <td>{formatDate(cred.createdAt)}</td>
                      <td>{formatDate(cred.expiresAt)}</td>
                      <td>{formatDate(cred.lastUsedAt)}</td>
                      <td className="actions-cell">
                        {cred.status === 'active' && (
                          <button
                            className="action-btn revoke-btn"
                            onClick={() => handleRevoke(cred.id)}
                            disabled={revokeMutation.isPending}
                          >
                            Revoke
                          </button>
                        )}
                        {deleteConfirmId === cred.id ? (
                          <div className="delete-confirm">
                            <span>Delete?</span>
                            <button
                              className="action-btn confirm-btn"
                              onClick={() => handleDelete(cred.id)}
                              disabled={deleteMutation.isPending}
                            >
                              Yes
                            </button>
                            <button
                              className="action-btn cancel-btn"
                              onClick={() => setDeleteConfirmId(null)}
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <button
                            className="action-btn delete-btn"
                            onClick={() => setDeleteConfirmId(cred.id)}
                          >
                            Delete
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showCredentialModal && newCredential && (
        <div className="modal-overlay" onClick={() => setShowCredentialModal(false)}>
          <div className="credential-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Credential Created</h2>
            <p className="modal-warning">
              ⚠️ Save these credentials now! The password will not be shown again.
            </p>
            <div className="credential-field">
              <label>Username</label>
              <div className="credential-value">
                <code>{newCredential.username}</code>
                <button
                  className="copy-btn"
                  onClick={() => copyToClipboard(newCredential.username)}
                >
                  Copy
                </button>
              </div>
            </div>
            <div className="credential-field">
              <label>Password</label>
              <div className="credential-value">
                <code>{newCredential.password}</code>
                <button
                  className="copy-btn"
                  onClick={() => copyToClipboard(newCredential.password)}
                >
                  Copy
                </button>
              </div>
            </div>
            {newCredential.label && (
              <div className="credential-field">
                <label>Label</label>
                <div className="credential-value">
                  <span>{newCredential.label}</span>
                </div>
              </div>
            )}
            {newCredential.expiresAt && (
              <div className="credential-field">
                <label>Expires</label>
                <div className="credential-value">
                  <span>{formatDate(newCredential.expiresAt)}</span>
                </div>
              </div>
            )}
            <button
              className="close-modal-btn"
              onClick={() => setShowCredentialModal(false)}
            >
              I've saved these credentials
            </button>
          </div>
        </div>
      )}

      {showBulkModal && bulkCredentials.length > 0 && (
        <div className="modal-overlay" onClick={() => setShowBulkModal(false)}>
          <div className="credential-modal bulk-modal" onClick={(e) => e.stopPropagation()}>
            <h2>{bulkCredentials.length} Credentials Created</h2>
            <p className="modal-warning">
              Save these credentials now! The passwords will not be shown again.
            </p>
            <div className="bulk-actions">
              <button
                className="bulk-action-btn"
                onClick={() => downloadCSV(bulkCredentials)}
              >
                Download CSV
              </button>
              <button
                className="bulk-action-btn"
                onClick={() => copyAllAsCSV(bulkCredentials)}
              >
                Copy All as CSV
              </button>
            </div>
            <div className="bulk-preview">
              <p className="bulk-preview-label">Preview (username,password format):</p>
              <pre className="bulk-preview-content">
                {bulkCredentials.slice(0, 5).map(c => `${c.username},${c.password}`).join('\n')}
                {bulkCredentials.length > 5 && `\n... and ${bulkCredentials.length - 5} more`}
              </pre>
            </div>
            <button
              className="close-modal-btn"
              onClick={() => setShowBulkModal(false)}
            >
              I've saved these credentials
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
