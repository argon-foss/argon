import React, { useState, useEffect, useCallback } from 'react';
import {  
  PlusIcon, 
  TrashIcon, 
  PencilIcon, 
  ArrowLeftIcon, 
  CopyIcon, 
  CheckIcon, 
  ChevronDownIcon, 
  RefreshCwIcon, 
  KeyIcon,
  AlertTriangleIcon,
  ClockIcon
} from 'lucide-react';
import AdminBar from '../../components/AdminBar';
import LoadingSpinner from '../../components/LoadingSpinner';

interface APIKey {
  id: string;
  name: string;
  userId: string;
  keyPreview: string;
  keyFull?: string;
  permissions: string[];
  createdAt: Date;
  updatedAt: Date;
  lastUsed: Date | null;
  expiresAt: Date | null;
}

interface User {
  id: string;
  username: string;
  permissions: string[];
}

interface AlertProps {
  type: 'error' | 'success' | 'warning';
  message: string;
  onDismiss?: () => void;
}

interface FormData {
  name: string;
  permissions: string[];
  userId?: string;
  expiresAt?: string | null;
}

type View = 'list' | 'create' | 'view' | 'edit';

// Time options for API key expiration
const timeOptions = [
  { value: "", label: "No expiration" },
  { value: "1d", label: "1 day" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
  { value: "180d", label: "180 days" },
  { value: "365d", label: "1 year" },
  { value: "custom", label: "Custom date" }
];

// Permission options
const permissionOptions = [
  { value: "admin", label: "Admin", description: "Full access to all resources" },
  { value: "user", label: "User", description: "Limited access to resources" }
];

// Alert component for displaying error/success messages
const Alert: React.FC<AlertProps> = ({ type, message, onDismiss }) => {
  const bgColor = type === 'error' ? 'bg-red-50' : type === 'success' ? 'bg-green-50' : 'bg-yellow-50';
  const textColor = type === 'error' ? 'text-red-600' : type === 'success' ? 'text-green-600' : 'text-yellow-600';
  const borderColor = type === 'error' ? 'border-red-100' : type === 'success' ? 'border-green-100' : 'border-yellow-100';
  
  return (
    <div className={`${bgColor} border ${borderColor} rounded-md flex items-start justify-between`}>
      <div className="flex items-start p-2">
        {type === 'error' || type === 'warning' ? (
          <AlertTriangleIcon className={`w-3 h-3 ${textColor} mr-2 mt-0.5`} />
        ) : null}
        <p className={`text-xs ${textColor}`}>{message}</p>
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className={`ml-2 mr-2 p-1 ${textColor} hover:bg-opacity-10 cursor-pointer rounded-full`}
        >
          ×
        </button>
      )}
    </div>
  );
};

const AdminAPIKeysPage = () => {
  const [apiKeys, setApiKeys] = useState<APIKey[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>('list');
  const [selectedApiKey, setSelectedApiKey] = useState<APIKey | null>(null);
  const [formData, setFormData] = useState<FormData>({
    name: '',
    permissions: ['user']
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<{ id: string; type: 'error' | 'success' | 'warning'; message: string }[]>([]);
  const [copied, setCopied] = useState(false);
  const [tableSortField, setTableSortField] = useState<string>('name');
  const [tableSortDirection, setTableSortDirection] = useState<'asc' | 'desc'>('asc');
  const [expirationOption, setExpirationOption] = useState('');
  const [userFilter, setUserFilter] = useState<string>('');
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [userSearch, setUserSearch] = useState('');

  console.log(error)
  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const filtered = users.filter(user => 
      user.username.toLowerCase().includes(userSearch.toLowerCase())
    );
    setFilteredUsers(filtered);
  }, [userSearch, users]);

  // Show alert message
  const showAlert = useCallback((type: 'error' | 'success' | 'warning', message: string) => {
    const id = Date.now().toString();
    setAlerts(prev => [...prev, { id, type, message }]);
    
    // Auto-dismiss after 5 seconds
    setTimeout(() => {
      setAlerts(prev => prev.filter(alert => alert.id !== id));
    }, 5000);
    
    return id;
  }, []);

  // Dismiss specific alert
  const dismissAlert = useCallback((id: string) => {
    setAlerts(prev => prev.filter(alert => alert.id !== id));
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const headers = { 'Authorization': `Bearer ${token}` };
      
      const [apiKeysRes, usersRes] = await Promise.all([
        fetch('/api/api-keys', { headers }),
        fetch('/api/users', { headers })
      ]);
      
      if (!apiKeysRes.ok) {
        const errorData = await apiKeysRes.json();
        throw new Error(errorData.error || 'Failed to fetch API keys');
      }
      
      if (!usersRes.ok) {
        const errorData = await usersRes.json();
        throw new Error(errorData.error || 'Failed to fetch users');
      }
      
      const [apiKeysData, usersData] = await Promise.all([
        apiKeysRes.json(),
        usersRes.json()
      ]);

      setApiKeys(apiKeysData);
      setUsers(usersData);
      
      // Update filtered users
      setFilteredUsers(usersData);

      setError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      showAlert('error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    
    try {
      // Calculate expiration date if set
      let expiresAt = undefined;
      
      if (expirationOption) {
        if (expirationOption === 'custom' && formData.expiresAt) {
          expiresAt = formData.expiresAt;
        } else if (expirationOption !== 'custom') {
          const days = parseInt(expirationOption.replace('d', ''));
          const date = new Date();
          date.setDate(date.getDate() + days);
          expiresAt = date.toISOString();
        }
      }
      
      const token = localStorage.getItem('token');
      const response = await fetch('/api/api-keys', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...formData,
          expiresAt
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        const errorMessage = Array.isArray(data.error) 
          ? data.error.map((e: any) => e.message).join(', ')
          : data.error || 'Failed to create API key';
        
        throw new Error(errorMessage);
      }

      // Add the new key to the list and select it for view
      setApiKeys(prev => [...prev, data]);
      setSelectedApiKey(data);
      setView('view');
      
      // Reset form
      setFormData({ name: '', permissions: ['user'] });
      setExpirationOption('');
      
      showAlert('success', `API key "${data.name}" created successfully`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create API key';
      setFormError(errorMessage);
      showAlert('error', errorMessage);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedApiKey) return;
    setFormError(null);

    try {
      // Calculate expiration date if set
      let expiresAt = undefined;
      
      if (expirationOption === '') {
        expiresAt = null; // Explicitly set to null to remove expiration
      } else if (expirationOption === 'custom' && formData.expiresAt) {
        expiresAt = formData.expiresAt;
      } else if (expirationOption !== 'custom') {
        const days = parseInt(expirationOption.replace('d', ''));
        const date = new Date();
        date.setDate(date.getDate() + days);
        expiresAt = date.toISOString();
      }

      const token = localStorage.getItem('token');
      const response = await fetch(`/api/api-keys/${selectedApiKey.id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...formData,
          expiresAt
        })
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMessage = Array.isArray(data.error) 
          ? data.error.map((e: any) => e.message).join(', ')
          : data.error || 'Failed to update API key';
        
        throw new Error(errorMessage);
      }

      // Update the key in the list
      setApiKeys(prev => prev.map(key => key.id === data.id ? data : key));
      setSelectedApiKey(data);
      setView('view');
      
      // Reset form
      setFormData({ name: '', permissions: ['user'] });
      setExpirationOption('');
      
      showAlert('success', `API key "${data.name}" updated successfully`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update API key';
      setFormError(errorMessage);
      showAlert('error', errorMessage);
    }
  };

  const handleDelete = async (apiKeyId: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/api-keys/${apiKeyId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete API key');
      }

      // Remove the key from the list
      setApiKeys(prev => prev.filter(key => key.id !== apiKeyId));
      
      if (selectedApiKey?.id === apiKeyId) {
        setView('list');
        setSelectedApiKey(null);
      }
      
      showAlert('success', 'API key deleted successfully');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete API key';
      showAlert('error', errorMessage);
    }
  };

  const handleRegenerateKey = async (apiKeyId: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/api-keys/${apiKeyId}/regenerate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to regenerate API key');
      }

      const data = await response.json();
      
      // Update the key in the list
      setApiKeys(prev => prev.map(key => key.id === data.id ? data : key));
      setSelectedApiKey(data);
      
      showAlert('success', 'API key regenerated successfully');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to regenerate API key';
      showAlert('error', errorMessage);
    }
  };

  const handleCopyKey = async (key: string) => {
    try {
      await navigator.clipboard.writeText(key);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      showAlert('success', 'API key copied to clipboard');
    } catch (err) {
      showAlert('error', 'Failed to copy API key');
    }
  };

  const handleTableSort = (field: string) => {
    if (tableSortField === field) {
      setTableSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setTableSortField(field);
      setTableSortDirection('asc');
    }
  };

  const getSortedAPIKeys = () => {
    // Filter by user if a filter is set
    let filtered = [...apiKeys];
    if (userFilter) {
      filtered = filtered.filter(key => key.userId === userFilter);
    }
    
    // Then sort
    return filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (tableSortField) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'user':
          const aUser = users.find(u => u.id === a.userId)?.username || '';
          const bUser = users.find(u => u.id === b.userId)?.username || '';
          comparison = aUser.localeCompare(bUser);
          break;
        case 'created':
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case 'expires':
          // Handle null expiration dates (never expires)
          if (!a.expiresAt && !b.expiresAt) comparison = 0;
          else if (!a.expiresAt) comparison = 1;
          else if (!b.expiresAt) comparison = -1;
          else comparison = new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime();
          break;
        case 'lastUsed':
          // Handle null last used dates (never used)
          if (!a.lastUsed && !b.lastUsed) comparison = 0;
          else if (!a.lastUsed) comparison = 1;
          else if (!b.lastUsed) comparison = -1;
          else comparison = new Date(a.lastUsed).getTime() - new Date(b.lastUsed).getTime();
          break;
        default:
          comparison = 0;
      }
      
      return tableSortDirection === 'asc' ? comparison : -comparison;
    });
  };

  const renderForm = (type: 'create' | 'edit') => (
    <form onSubmit={type === 'create' ? handleCreate : handleEdit} className="space-y-4 max-w-lg">
      {formError && (
        <Alert
          type="error"
          message={formError}
          onDismiss={() => setFormError(null)}
        />
      )}
      
      <div className="space-y-1">
        <label className="block text-xs font-medium text-gray-700">
          Name
        </label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="block w-full px-3 py-2 text-xs border border-gray-200 rounded-md focus:outline-none focus:border-gray-400"
          placeholder="My API Key"
          required
          maxLength={100}
        />
        <p className="text-xs text-gray-500 mt-1">
          A descriptive name to help you identify this API key
        </p>
      </div>

      {type === 'create' && (
        <div className="space-y-1">
          <label className="block text-xs font-medium text-gray-700">
            User
          </label>
          <input
            type="text"
            value={userSearch}
            onChange={(e) => setUserSearch(e.target.value)}
            className="block w-full px-3 py-2 text-xs border border-gray-200 rounded-md focus:outline-none focus:border-gray-400 mb-2"
            placeholder="Search users..."
          />
          <select
            value={formData.userId || ''}
            onChange={(e) => setFormData({ ...formData, userId: e.target.value })}
            className="block w-full px-3 py-2 text-xs border border-gray-200 rounded-md focus:outline-none focus:border-gray-400"
            required
          >
            <option value="">Select a user</option>
            {filteredUsers.map(user => (
              <option key={user.id} value={user.id}>
                {user.username}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-1">
            The user that this API key will belong to
          </p>
        </div>
      )}

      <div className="space-y-1">
        <label className="block text-xs font-medium text-gray-700">
          Permissions
        </label>
        <div className="space-y-2 mt-2">
          {permissionOptions.map(permission => (
            <div key={permission.value} className="flex items-start space-x-2">
              <input
                type="checkbox"
                id={`permission-${permission.value}`}
                checked={formData.permissions.includes(permission.value)}
                onChange={(e) => {
                  if (e.target.checked) {
                    setFormData({
                      ...formData,
                      permissions: [...formData.permissions, permission.value]
                    });
                  } else {
                    setFormData({
                      ...formData,
                      permissions: formData.permissions.filter(p => p !== permission.value)
                    });
                  }
                }}
                className="mt-0.5"
              />
              <div>
                <label
                  htmlFor={`permission-${permission.value}`}
                  className="text-xs font-medium text-gray-900 cursor-pointer"
                >
                  {permission.label}
                </label>
                <p className="text-xs text-gray-500">{permission.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-1">
        <label className="block text-xs font-medium text-gray-700">
          Expiration
        </label>
        <select
          value={expirationOption}
          onChange={(e) => {
            setExpirationOption(e.target.value);
            
            // Clear custom date when not using custom
            if (e.target.value !== 'custom') {
              setFormData({ ...formData, expiresAt: undefined });
            }
          }}
          className="block w-full px-3 py-2 text-xs border border-gray-200 rounded-md focus:outline-none focus:border-gray-400"
        >
          {timeOptions.map(option => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        
        {expirationOption === 'custom' && (
          <div className="mt-2">
            <input
              type="datetime-local"
              value={formData.expiresAt || ''}
              onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
              className="block w-full px-3 py-2 text-xs border border-gray-200 rounded-md focus:outline-none focus:border-gray-400"
              required
            />
          </div>
        )}
        
        <p className="text-xs text-gray-500 mt-1">
          After this time, the API key will no longer be valid
        </p>
      </div>

      <div className="flex items-center space-x-3">
        <button
          type="submit"
          className="px-3 py-2 text-xs font-medium text-white bg-gray-900 rounded-md hover:bg-gray-800"
        >
          {type === 'create' ? 'Create API Key' : 'Update API Key'}
        </button>
        <button
          type="button"
          onClick={() => {
            setView(type === 'edit' ? 'view' : 'list');
            if (type === 'create') setSelectedApiKey(null);
            setFormData({ name: '', permissions: ['user'] });
          }}
          className="px-3 py-2 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-md hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );

  const renderAPIKeyView = () => {
    if (!selectedApiKey) return null;

    const owner = users.find(user => user.id === selectedApiKey.userId);
    const isExpired = selectedApiKey.expiresAt && new Date(selectedApiKey.expiresAt) < new Date();

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => {
                setView('list');
                setSelectedApiKey(null);
              }}
              className="flex items-center text-gray-600 hover:bg-gray-100 p-2 cursor-pointer rounded-md transition hover:text-gray-900"
            >
              <ArrowLeftIcon className="w-4 h-4" />
            </button>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{selectedApiKey.name}</h2>
              {isExpired && (
                <div className="text-xs text-red-600 mt-1 flex items-center">
                  <AlertTriangleIcon className="w-3 h-3 mr-1" />
                  This API key has expired
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => {
                // Initialize form with current values
                setFormData({
                  name: selectedApiKey.name,
                  permissions: selectedApiKey.permissions,
                  expiresAt: selectedApiKey.expiresAt ? new Date(selectedApiKey.expiresAt).toISOString().substring(0, 16) : undefined
                });
                
                // Set expiration option
                if (!selectedApiKey.expiresAt) {
                  setExpirationOption('');
                } else {
                  setExpirationOption('custom');
                }
                
                setView('edit');
              }}
              className="flex items-center px-3 py-2 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-md hover:bg-gray-50"
            >
              <PencilIcon className="w-3.5 h-3.5 mr-1.5" />
              Edit
            </button>
            <button
              onClick={() => handleRegenerateKey(selectedApiKey.id)}
              className="flex items-center px-3 py-2 text-xs font-medium text-orange-600 bg-white border border-gray-200 rounded-md hover:bg-orange-50"
            >
              <RefreshCwIcon className="w-3.5 h-3.5 mr-1.5" />
              Regenerate
            </button>
            <button
              onClick={() => handleDelete(selectedApiKey.id)}
              className="flex items-center px-3 py-2 text-xs font-medium text-red-600 bg-white border border-gray-200 rounded-md hover:bg-red-50"
            >
              <TrashIcon className="w-3.5 h-3.5 mr-1.5" />
              Delete
            </button>
          </div>
        </div>

        {/* Show the full API key if it was just created or regenerated */}
        {selectedApiKey.keyFull && (
          <div className="bg-indigo-50 border border-indigo-100 rounded-md p-4 mb-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-medium text-indigo-700">
                Your API Key (only shown once)
              </div>
              <button
                onClick={() => handleCopyKey(selectedApiKey.keyFull || '')}
                className="flex items-center text-indigo-600 text-xs"
              >
                {copied ? (
                  <>
                    <CheckIcon className="w-3.5 h-3.5 mr-1" />
                    Copied
                  </>
                ) : (
                  <>
                    <CopyIcon className="w-3.5 h-3.5 mr-1" />
                    Copy
                  </>
                )}
              </button>
            </div>
            <div className="bg-white border border-indigo-100 rounded p-2 font-mono text-xs break-all">
              {selectedApiKey.keyFull}
            </div>
            <p className="text-xs text-indigo-600 mt-2">
              Make sure to copy this key now. You won't be able to see it again!
            </p>
          </div>
        )}

        <div className="bg-white border border-gray-200 rounded-md shadow-xs">
          <div className="px-6 py-4">
            <div className="space-y-4">
              <div>
                <div className="text-xs text-gray-500">API Key ID</div>
                <div className="text-sm font-mono mt-1">{selectedApiKey.id}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Key Preview</div>
                <div className="text-sm font-mono mt-1">{selectedApiKey.keyPreview}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Owner</div>
                <div className="text-sm mt-1">{owner?.username || 'Unknown user'}</div>
              </div>
              
              <div>
                <div className="text-xs text-gray-500">Permissions</div>
                <div className="text-sm mt-1">
                  {selectedApiKey.permissions.map(permission => {
                    const permInfo = permissionOptions.find(p => p.value === permission);
                    return (
                      <span 
                        key={permission}
                        className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 mr-2 mb-1"
                      >
                        {permInfo?.label || permission}
                      </span>
                    );
                  })}
                </div>
              </div>
              
              <div className="pt-4 border-t border-gray-100">
                <div className="text-xs text-gray-500">Created At</div>
                <div className="text-sm mt-1">
                  {new Date(selectedApiKey.createdAt).toLocaleString()}
                </div>
              </div>
              
              {selectedApiKey.lastUsed && (
                <div>
                  <div className="text-xs text-gray-500">Last Used</div>
                  <div className="text-sm mt-1">
                    {new Date(selectedApiKey.lastUsed).toLocaleString()}
                  </div>
                </div>
              )}
              
              <div>
                <div className="text-xs text-gray-500">Expires</div>
                <div className="text-sm mt-1">
                  {selectedApiKey.expiresAt 
                    ? new Date(selectedApiKey.expiresAt).toLocaleString() 
                    : 'Never'}
                </div>
              </div>
            <div>
                <div className="text-xs text-gray-500">Updated At</div>
                <div className="text-sm mt-1">
                  {new Date(selectedApiKey.updatedAt).toLocaleString()}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderAPIKeyTable = () => {
    const sortedAPIKeys = getSortedAPIKeys();
    
    return (
      <div className="overflow-x-auto rounded-lg">
        <table className="min-w-full border-collapse">
          <thead>
            <tr className="bg-transparent">
              <th className="p-3 text-left text-xs font-medium text-gray-600 tracking-wider cursor-pointer" onClick={() => handleTableSort('name')}>
                <div className="flex items-center">
                  Name
                  {tableSortField === 'name' && (
                    <ChevronDownIcon className={`w-4 h-4 ml-1 ${tableSortDirection === 'desc' ? 'transform rotate-180' : ''}`} />
                  )}
                </div>
              </th>
              <th className="p-3 text-left text-xs font-medium text-gray-600 tracking-wider cursor-pointer" onClick={() => handleTableSort('user')}>
                <div className="flex items-center">
                  User
                  {tableSortField === 'user' && (
                    <ChevronDownIcon className={`w-4 h-4 ml-1 ${tableSortDirection === 'desc' ? 'transform rotate-180' : ''}`} />
                  )}
                </div>
              </th>
              <th className="p-3 text-left text-xs font-medium text-gray-600 tracking-wider">
                Permissions
              </th>
              <th className="p-3 text-left text-xs font-medium text-gray-600 tracking-wider cursor-pointer" onClick={() => handleTableSort('created')}>
                <div className="flex items-center">
                  Created
                  {tableSortField === 'created' && (
                    <ChevronDownIcon className={`w-4 h-4 ml-1 ${tableSortDirection === 'desc' ? 'transform rotate-180' : ''}`} />
                  )}
                </div>
              </th>
              <th className="p-3 text-left text-xs font-medium text-gray-600 tracking-wider cursor-pointer" onClick={() => handleTableSort('expires')}>
                <div className="flex items-center">
                  Expires
                  {tableSortField === 'expires' && (
                    <ChevronDownIcon className={`w-4 h-4 ml-1 ${tableSortDirection === 'desc' ? 'transform rotate-180' : ''}`} />
                  )}
                </div>
              </th>
              <th className="p-3 text-left text-xs font-medium text-gray-600 tracking-wider cursor-pointer" onClick={() => handleTableSort('lastUsed')}>
                <div className="flex items-center">
                  Last Used
                  {tableSortField === 'lastUsed' && (
                    <ChevronDownIcon className={`w-4 h-4 ml-1 ${tableSortDirection === 'desc' ? 'transform rotate-180' : ''}`} />
                  )}
                </div>
              </th>
              <th className="p-3 text-right text-xs font-medium text-gray-600 tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {sortedAPIKeys.map((apiKey) => {
              const owner = users.find(user => user.id === apiKey.userId);
              const isExpired = apiKey.expiresAt && new Date(apiKey.expiresAt) < new Date();
              
              return (
                <tr 
                  key={apiKey.id} 
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => {
                    setSelectedApiKey(apiKey);
                    setView('view');
                  }}
                >
                  <td className="p-3 text-xs text-gray-900">
                    <div className="flex items-center">
                      <KeyIcon className="w-4 h-4 text-gray-400 mr-2" />
                      <span className="font-medium">{apiKey.name}</span>
                    </div>
                  </td>
                  <td className="p-3 text-xs text-gray-500">{owner?.username || 'Unknown'}</td>
                  <td className="p-3 text-xs text-gray-500">
                    {apiKey.permissions.map(permission => {
                      const permInfo = permissionOptions.find(p => p.value === permission);
                      return (
                        <span 
                          key={permission}
                          className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 mr-1"
                        >
                          {permInfo?.label || permission}
                        </span>
                      );
                    })}
                  </td>
                  <td className="p-3 text-xs text-gray-500">
                    {new Date(apiKey.createdAt).toLocaleDateString()}
                  </td>
                  <td className="p-3 text-xs">
                    {apiKey.expiresAt ? (
                      <span className={`flex items-center ${isExpired ? 'text-red-600' : 'text-gray-500'}`}>
                        {isExpired ? (
                          <AlertTriangleIcon className="w-3 h-3 mr-1" />
                        ) : (
                          <ClockIcon className="w-3 h-3 mr-1" />
                        )}
                        {isExpired ? 'Expired' : new Date(apiKey.expiresAt).toLocaleDateString()}
                      </span>
                    ) : (
                      <span className="text-gray-500">Never</span>
                    )}
                  </td>
                  <td className="p-3 text-xs text-gray-500">
                    {apiKey.lastUsed ? new Date(apiKey.lastUsed).toLocaleDateString() : 'Never used'}
                  </td>
                  <td className="p-3 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end space-x-2" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRegenerateKey(apiKey.id);
                        }}
                        className="p-1 text-gray-400 hover:text-orange-600"
                        title="Regenerate Key"
                      >
                        <RefreshCwIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          // Initialize form with current values
                          setFormData({
                            name: apiKey.name,
                            permissions: apiKey.permissions,
                            expiresAt: apiKey.expiresAt ? new Date(apiKey.expiresAt).toISOString().substring(0, 16) : undefined
                          });
                          
                          // Set expiration option
                          if (!apiKey.expiresAt) {
                            setExpirationOption('');
                          } else {
                            setExpirationOption('custom');
                          }
                          
                          setSelectedApiKey(apiKey);
                          setView('edit');
                        }}
                        className="p-1 text-gray-400 hover:text-gray-600"
                        title="Edit Key"
                      >
                        <PencilIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(apiKey.id);
                        }}
                        className="p-1 text-gray-400 hover:text-red-600"
                        title="Delete Key"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {sortedAPIKeys.length === 0 && (
              <tr>
                <td colSpan={7} className="p-4 text-center text-gray-500 text-xs">
                  No API keys found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  };

  if (loading && apiKeys.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <AdminBar />
        <div className="p-6 flex items-center justify-center h-64">
          <LoadingSpinner />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminBar />
      <div className="p-6">
        {/* Global Alerts */}
        {alerts.length > 0 && (
          <div className="mb-4 space-y-2">
            {alerts.map(alert => (
              <Alert
                key={alert.id}
                type={alert.type}
                message={alert.message}
                onDismiss={() => dismissAlert(alert.id)}
              />
            ))}
          </div>
        )}

        <div className="transition-all duration-200 ease-in-out">
          {view === 'list' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-lg font-semibold text-gray-900">API Keys</h1>
                  <p className="text-xs text-gray-500 mt-1">
                    Create and manage API keys for programmatic access to the Argon API.
                  </p>
                </div>
                <div className="flex space-x-3">
                  <select
                    value={userFilter}
                    onChange={(e) => setUserFilter(e.target.value)}
                    className="px-3 py-2 text-xs border border-gray-200 rounded-md focus:outline-none focus:border-gray-400"
                  >
                    <option value="">All Users</option>
                    {users.map(user => (
                      <option key={user.id} value={user.id}>{user.username}</option>
                    ))}
                  </select>
                  <button
                    onClick={fetchData}
                    className="flex items-center px-3 py-2 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-md hover:bg-gray-50"
                  >
                    Refresh
                  </button>
                  <button
                    onClick={() => setView('create')}
                    className="flex items-center px-3 py-2 text-xs font-medium text-white bg-gray-900 rounded-md hover:bg-gray-800"
                  >
                    <PlusIcon className="w-3.5 h-3.5 mr-1.5" />
                    Create API Key
                  </button>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-md shadow-xs">
                {renderAPIKeyTable()}
              </div>
            </div>
          )}

          {view === 'create' && (
            <div className="space-y-6">
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => {
                    setView('list');
                    setSelectedApiKey(null);
                  }}
                  className="flex items-center text-gray-600 hover:bg-gray-100 p-2 cursor-pointer rounded-md transition hover:text-gray-900"
                >
                  <ArrowLeftIcon className="w-4 h-4" />
                </button>
                <div>
                  <h1 className="text-lg font-semibold text-gray-900">Create API Key</h1>
                </div>
              </div>
              {renderForm('create')}
            </div>
          )}

          {view === 'edit' && (
            <div className="space-y-6">
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => {
                    setView('view');
                    setFormData({ name: '', permissions: ['user'] });
                  }}
                  className="flex items-center text-gray-600 hover:bg-gray-100 p-2 cursor-pointer rounded-md transition hover:text-gray-900"
                >
                  <ArrowLeftIcon className="w-4 h-4" />
                </button>
                <div>
                  <h1 className="text-lg font-semibold text-gray-900">Edit API Key</h1>
                </div>
              </div>
              {renderForm('edit')}
            </div>
          )}

          {view === 'view' && renderAPIKeyView()}
        </div>
      </div>
    </div>
  );
};

export default AdminAPIKeysPage;