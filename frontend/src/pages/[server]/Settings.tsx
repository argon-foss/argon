import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ChevronRight, AlertCircle, Save,
  RefreshCw, Check, X
} from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';

interface Node {
  id: string;
  name: string;
  fqdn: string;
  port: number;
  isOnline: boolean;
}

interface DockerImage {
  image: string;
  displayName: string;
}

interface ServerDetails {
  id: string;
  internalId: string;
  name: string;
  memoryMiB: number;
  diskMiB: number;
  cpuPercent: number;
  state: string;
  dockerImage?: string;
  startupCommand?: string;
  node: Node;
}

interface ServerConfiguration {
  name: string;
  dockerImage: {
    current: string;
    available: DockerImage[] | string;
    canChange: boolean;
  };
  startupCommand: {
    current: string;
    default: string;
    canEdit: boolean;
  };
  memoryMiB: number;
  cpuPercent: number;
  state: string;
}

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error';
}

// Toast component
const Toast: React.FC<{ toast: Toast; onDismiss: (id: string) => void }> = ({ toast, onDismiss }) => (
  <div
    className={`fixed bottom-4 right-4 px-4 py-3 rounded-lg shadow-lg flex items-center space-x-2 z-50
      ${toast.type === 'success' ? 'bg-gray-900 text-white' : 'bg-red-500 text-white'}`}
  >
    {toast.type === 'success' ? (
      <Check className="w-4 h-4" />
    ) : (
      <AlertCircle className="w-4 h-4" />
    )}
    <span className="text-sm font-medium">{toast.message}</span>
    <button
      onClick={() => onDismiss(toast.id)}
      className="ml-2 text-white/80 hover:text-white"
    >
      <X className="w-4 h-4" />
    </button>
  </div>
);

const ServerSettingsPage: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const token = localStorage.getItem('token');

  // State
  const [server, setServer] = useState<ServerDetails | null>(null);
  const [config, setConfig] = useState<ServerConfiguration | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<{ [key: string]: boolean }>({});
  const [error, setError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    dockerImage: '',
    startupCommand: ''
  });

  // Toast management
  const showToast = (message: string, type: Toast['type'] = 'success') => {
    const id = Math.random().toString(36);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  const dismissToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // Fetch server details
  const fetchServer = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/servers/${id}?include[node]=true`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Failed to fetch server details');
      const data = await response.json();
      setServer(data);
    } catch (err) {
      setError('Failed to fetch server details');
      showToast('Failed to fetch server details', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Fetch server configuration
  const fetchConfiguration = async () => {
    try {
      const response = await fetch(`/api/servers/${id}/configuration`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Failed to fetch server configuration');
      const data = await response.json();

      // Parse available images if it's a string
      if (typeof data.dockerImage.available === 'string') {
        try {
          data.dockerImage.available = JSON.parse(data.dockerImage.available);
        } catch (parseError) {
          console.error('Failed to parse available Docker images:', parseError);
          data.dockerImage.available = [];
        }
      }

      setConfig(data);

      // Initialize form data
      setFormData({
        name: data.name,
        dockerImage: data.dockerImage.current,
        startupCommand: data.startupCommand.current
      });
    } catch (err) {
      showToast('Failed to fetch server configuration', 'error');
    }
  };

  // Update server name
  const updateServerName = async () => {
    if (!formData.name.trim()) {
      showToast('Server name cannot be empty', 'error');
      return;
    }

    try {
      setSaving(prev => ({ ...prev, name: true }));
      const response = await fetch(`/api/servers/${id}/name`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ name: formData.name })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update server name');
      }

      const result = await response.json();
      showToast('Server name updated successfully');

      // Update local state
      setServer(prev => prev ? { ...prev, name: result.name } : null);
      setConfig(prev => prev ? { ...prev, name: result.name } : null);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update server name', 'error');
    } finally {
      setSaving(prev => ({ ...prev, name: false }));
    }
  };

  // Update Docker image
  const updateDockerImage = async () => {
    try {
      setSaving(prev => ({ ...prev, dockerImage: true }));
      const response = await fetch(`/api/servers/${id}/docker-image`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ dockerImage: formData.dockerImage })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update Docker image');
      }

      const result = await response.json();
      showToast('Docker image updated successfully');

      // Update local state
      setConfig(prev => prev ? {
        ...prev,
        dockerImage: { ...prev.dockerImage, current: result.dockerImage }
      } : null);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update Docker image', 'error');
    } finally {
      setSaving(prev => ({ ...prev, dockerImage: false }));
    }
  };

  // Update startup command
  const updateStartupCommand = async () => {
    if (!formData.startupCommand.trim()) {
      showToast('Startup command cannot be empty', 'error');
      return;
    }

    try {
      setSaving(prev => ({ ...prev, startupCommand: true }));
      const response = await fetch(`/api/servers/${id}/startup-command`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ startupCommand: formData.startupCommand })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update startup command');
      }

      const result = await response.json();
      showToast('Startup command updated successfully');

      // Update local state
      setConfig(prev => prev ? {
        ...prev,
        startupCommand: { ...prev.startupCommand, current: result.startupCommand }
      } : null);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update startup command', 'error');
    } finally {
      setSaving(prev => ({ ...prev, startupCommand: false }));
    }
  };

  // Reset form field to current value
  const resetField = (field: keyof typeof formData) => {
    if (!config) return;

    switch (field) {
      case 'name':
        setFormData(prev => ({ ...prev, name: config.name }));
        break;
      case 'dockerImage':
        setFormData(prev => ({ ...prev, dockerImage: config.dockerImage.current }));
        break;
      case 'startupCommand':
        setFormData(prev => ({ ...prev, startupCommand: config.startupCommand.current }));
        break;
    }
  };

  // Check if field has changes
  const hasChanges = (field: keyof typeof formData) => {
    if (!config) return false;

    switch (field) {
      case 'name':
        return formData.name !== config.name;
      case 'dockerImage':
        return formData.dockerImage !== config.dockerImage.current;
      case 'startupCommand':
        return formData.startupCommand !== config.startupCommand.current;
      default:
        return false;
    }
  };

  useEffect(() => {
    fetchServer();
  }, [id]);

  useEffect(() => {
    if (server) {
      fetchConfiguration();
    }
  }, [server]);

  if (loading) return <LoadingSpinner />;

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-lg font-medium text-gray-900 mb-2">Error</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => navigate('/servers')}
            className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-md hover:bg-gray-800"
          >
            Back to Servers
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-8 py-8 bg-gray-50">
      {/* Toast Messages */}
      {toasts.map(toast => (
        <Toast key={toast.id} toast={toast} onDismiss={dismissToast} />
      ))}

      <div className="mx-auto space-y-6">
        {/* Header Section */}
        <div className="space-y-3">
          {/* Breadcrumb */}
          <div className="flex items-center text-sm text-gray-600">
            <button
              onClick={() => navigate('/servers')}
              className="hover:text-gray-900 transition-colors duration-100"
            >
              Servers
            </button>
            <ChevronRight className="w-4 h-4 mx-1" />
            <button
              onClick={() => navigate(`/servers/${id}`)}
              className="hover:text-gray-900 transition-colors duration-100"
            >
              {server?.name}
            </button>
            <ChevronRight className="w-4 h-4 mx-1" />
            <span className="text-gray-900 font-medium">Settings</span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div>
                <h1 className="text-2xl font-semibold text-gray-900">Settings</h1>
              </div>
            </div>
          </div>
        </div>

        {/* Settings Cards */}
        <div className="space-y-6">
          {/* Server Name */}
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div>
                  <h3 className="text-lg font-medium text-gray-900">Server Name</h3>
                  <p className="text-sm text-gray-500">Change the display name of your server</p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Server Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm 
                           focus:outline-none focus:ring-2 focus:ring-gray-200"
                  placeholder="Enter server name"
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="text-xs text-gray-500">
                  Changes will be reflected across the panel
                </div>
                <div className="flex items-center space-x-2">
                  {hasChanges('name') && (
                    <button
                      onClick={() => resetField('name')}
                      className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900"
                    >
                      Reset
                    </button>
                  )}
                  <button
                    onClick={updateServerName}
                    disabled={saving.name || !hasChanges('name')}
                    className="px-4 py-1.5 text-xs font-medium text-white bg-gray-900 rounded-md 
                             hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed
                             flex items-center space-x-1"
                  >
                    {saving.name ? (
                      <>
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-3 h-3" />
                        <span>Save</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Docker Image */}
          {config?.dockerImage.canChange && (
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">Docker Image</h3>
                    <p className="text-sm text-gray-500">Select the Docker image for your server</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Available Images
                  </label>
                  <select
                    value={formData.dockerImage}
                    onChange={(e) => setFormData(prev => ({ ...prev, dockerImage: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm 
                             focus:outline-none focus:ring-2 focus:ring-gray-200"
                  >
                    {Array.isArray(config.dockerImage.available) && config.dockerImage.available.map((img) => (
                      <option key={img.image} value={img.image}>
                        {img.displayName || img.image}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center justify-between">
                  <div className="text-xs text-gray-500">
                    Server will be restarted to apply changes
                  </div>
                  <div className="flex items-center space-x-2">
                    {hasChanges('dockerImage') && (
                      <button
                        onClick={() => resetField('dockerImage')}
                        className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900"
                      >
                        Reset
                      </button>
                    )}
                    <button
                      onClick={updateDockerImage}
                      disabled={saving.dockerImage || !hasChanges('dockerImage')}
                      className="px-4 py-1.5 text-xs font-medium text-white bg-gray-900 rounded-md 
                               hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed
                               flex items-center space-x-1"
                    >
                      {saving.dockerImage ? (
                        <>
                          <RefreshCw className="w-3 h-3 animate-spin" />
                          <span>Updating...</span>
                        </>
                      ) : (
                        <>
                          <Save className="w-3 h-3" />
                          <span>Update</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Startup Command */}
          {config?.startupCommand.canEdit && (
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">Startup Command</h3>
                    <p className="text-sm text-gray-500">Customize the command used to start your server</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Command
                  </label>
                  <textarea
                    value={formData.startupCommand}
                    onChange={(e) => setFormData(prev => ({ ...prev, startupCommand: e.target.value }))}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm font-mono
                             focus:outline-none focus:ring-2 focus:ring-gray-200"
                    placeholder="Enter startup command"
                  />
                  {config.startupCommand.default && (
                    <p className="text-xs text-gray-500 mt-1">
                      Default: <code className="bg-gray-100 px-1 rounded">{config.startupCommand.default}</code>
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <div className="text-xs text-gray-500">
                    Server will be restarted to apply changes
                  </div>
                  <div className="flex items-center space-x-2">
                    {hasChanges('startupCommand') && (
                      <button
                        onClick={() => resetField('startupCommand')}
                        className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900"
                      >
                        Reset
                      </button>
                    )}
                    <button
                      onClick={updateStartupCommand}
                      disabled={saving.startupCommand || !hasChanges('startupCommand')}
                      className="px-4 py-1.5 text-xs font-medium text-white bg-gray-900 rounded-md 
                               hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed
                               flex items-center space-x-1"
                    >
                      {saving.startupCommand ? (
                        <>
                          <RefreshCw className="w-3 h-3 animate-spin" />
                          <span>Updating...</span>
                        </>
                      ) : (
                        <>
                          <Save className="w-3 h-3" />
                          <span>Update</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ServerSettingsPage;