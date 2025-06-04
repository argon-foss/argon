import React, { useState, useEffect, useCallback } from 'react';
import {
  PlusIcon,
  TrashIcon,
  PencilIcon,
  ArrowLeftIcon,
  ChevronDownIcon,
  ExclamationTriangleIcon,
  GlobeAltIcon as GlobeIcon
} from '@heroicons/react/24/outline';
import LoadingSpinner from '../../components/LoadingSpinner';

interface Region {
  id: string;
  name: string;
  identifier: string;
  countryId?: string | null;
  fallbackRegionId?: string | null;
  fallbackRegion?: Region | null;
  serverLimit?: number | null;
  nodes: Node[];
  stats?: {
    serverCount: number;
    nodeCount: number;
    onlineNodeCount: number;
    atCapacity: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

interface Node {
  id: string;
  name: string;
  fqdn: string;
  port: number;
  isOnline: boolean;
  lastChecked: Date;
  regionId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

type View = 'list' | 'create' | 'view' | 'edit';

interface FormData {
  name: string;
  identifier: string;
  countryId?: string;
  fallbackRegionId?: string;
  serverLimit?: number;
}

interface SelectOption {
  value: string;
  label: string;
}

// Alert component for displaying error/success messages
interface AlertProps {
  type: 'error' | 'success' | 'warning';
  message: string;
  onDismiss?: () => void;
}

const Alert: React.FC<AlertProps> = ({ type, message, onDismiss }) => {
  const bgColor = type === 'error' ? 'bg-red-50' : type === 'success' ? 'bg-green-50' : 'bg-yellow-50';
  const textColor = type === 'error' ? 'text-red-600' : type === 'success' ? 'text-green-600' : 'text-yellow-600';
  const borderColor = type === 'error' ? 'border-red-100' : type === 'success' ? 'border-green-100' : 'border-yellow-100';

  return (
    <div className={`${bgColor} border ${borderColor} rounded-md flex items-start justify-between`}>
      <div className="flex items-start p-2">
        {type === 'error' || type === 'warning' ? (
          <ExclamationTriangleIcon className={`w-3 h-3 ${textColor} mr-2 mt-0.5`} />
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

// Country selection options
const countryOptions: SelectOption[] = [
  { value: "", label: "None" },
  { value: "AF", label: "Afghanistan" },
  { value: "AU", label: "Australia" },
  { value: "BR", label: "Brazil" },
  { value: "CA", label: "Canada" },
  { value: "CN", label: "China" },
  { value: "DE", label: "Germany" },
  { value: "FR", label: "France" },
  { value: "GB", label: "United Kingdom" },
  { value: "IN", label: "India" },
  { value: "JP", label: "Japan" },
  { value: "NL", label: "Netherlands" },
  { value: "NO", label: "Norway" },
  { value: "RU", label: "Russia" },
  { value: "SE", label: "Sweden" },
  { value: "SG", label: "Singapore" },
  { value: "US", label: "United States" },
  // Add more countries as needed
];

const AdminRegionsPage = () => {
  const [regions, setRegions] = useState<Region[]>([]);
  const [unassignedNodes, setUnassignedNodes] = useState<Node[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>('list');
  const [selectedRegion, setSelectedRegion] = useState<Region | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'nodes' | 'servers'>('overview');
  const [formData, setFormData] = useState<FormData>({
    name: '',
    identifier: '',
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<{ id: string; type: 'error' | 'success' | 'warning'; message: string }[]>([]);
  const [tableSortField, setTableSortField] = useState<string>('name');
  const [tableSortDirection, setTableSortDirection] = useState<'asc' | 'desc'>('asc');
  const [assigning, setAssigning] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string>('');

  console.log(error)
  useEffect(() => {
    fetchData();
  }, []);

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

      const [regionsRes, nodesRes] = await Promise.all([
        fetch('/api/regions', { headers }),
        fetch('/api/nodes', { headers })
      ]);

      if (!regionsRes.ok) {
        const errorData = await regionsRes.json();
        throw new Error(errorData.error || 'Failed to fetch regions');
      }

      if (!nodesRes.ok) {
        const errorData = await nodesRes.json();
        throw new Error(errorData.error || 'Failed to fetch nodes');
      }

      const [regionsData, nodesData] = await Promise.all([
        regionsRes.json(),
        nodesRes.json()
      ]);

      // Get unassigned nodes
      const unassigned = nodesData.filter((node: Node) => !node.regionId);
      setUnassignedNodes(unassigned);

      setRegions(regionsData);

      // Refresh selected region data if we're in view mode
      if (selectedRegion && view === 'view') {
        const updatedRegion = regionsData.find((r: { id: string; }) => r.id === selectedRegion.id);
        if (updatedRegion) {
          setSelectedRegion(updatedRegion);
        }
      }

      setError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      showAlert('error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const fetchSingleRegion = async (regionId: string) => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/regions/${regionId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch region');
      }

      const regionData = await response.json();

      // Update the region in the regions list
      setRegions(prevRegions =>
        prevRegions.map(region => region.id === regionId ? regionData : region)
      );

      // Update selected region if this is the one we're viewing
      if (selectedRegion && selectedRegion.id === regionId) {
        setSelectedRegion(regionData);
      }

      setError(null);
      return regionData;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      showAlert('error', errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/regions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMessage = Array.isArray(data.error)
          ? data.error.map((e: any) => e.message).join(', ')
          : data.error || 'Failed to create region';

        throw new Error(errorMessage);
      }

      await fetchData();
      setView('list');
      setFormData({ name: '', identifier: '' });
      showAlert('success', `Region "${formData.name}" created successfully`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create region';
      setFormError(errorMessage);
      showAlert('error', errorMessage);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRegion) return;
    setFormError(null);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/regions/${selectedRegion.id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMessage = Array.isArray(data.error)
          ? data.error.map((e: any) => e.message).join(', ')
          : data.error || 'Failed to update region';

        throw new Error(errorMessage);
      }

      await fetchData();
      showAlert('success', `Region "${formData.name}" updated successfully`);

      // Fetch the updated region and update selected region
      const updatedRegion = await fetchSingleRegion(selectedRegion.id);
      if (updatedRegion) {
        setSelectedRegion(updatedRegion);
      }

      setView('view');
      setFormData({ name: '', identifier: '' });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update region';
      setFormError(errorMessage);
      showAlert('error', errorMessage);
    }
  };

  const handleDelete = async (regionId: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/regions/${regionId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete region');
      }

      await fetchData();
      if (selectedRegion?.id === regionId) {
        setView('list');
        setSelectedRegion(null);
      }

      showAlert('success', 'Region deleted successfully');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete region';
      showAlert('error', errorMessage);
    }
  };

  const handleAssignNode = async () => {
    if (!selectedRegion || !selectedNodeId) return;

    try {
      setAssigning(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/nodes/${selectedNodeId}/region`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ regionId: selectedRegion.id })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to assign node to region');
      }

      // Refresh data
      await fetchData();

      // Refresh region data
      const updatedRegion = await fetchSingleRegion(selectedRegion.id);
      if (updatedRegion) {
        setSelectedRegion(updatedRegion);
      }

      setSelectedNodeId('');
      showAlert('success', 'Node assigned to region successfully');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to assign node';
      showAlert('error', errorMessage);
    } finally {
      setAssigning(false);
    }
  };

  const handleUnassignNode = async (nodeId: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/nodes/${nodeId}/region`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ regionId: null })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to unassign node from region');
      }

      // Refresh data
      await fetchData();

      // Refresh region data if we're viewing a region
      if (selectedRegion) {
        const updatedRegion = await fetchSingleRegion(selectedRegion.id);
        if (updatedRegion) {
          setSelectedRegion(updatedRegion);
        }
      }

      showAlert('success', 'Node unassigned from region successfully');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to unassign node';
      showAlert('error', errorMessage);
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

  const getSortedRegions = () => {
    return [...regions].sort((a, b) => {
      let comparison = 0;

      switch (tableSortField) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'identifier':
          comparison = a.identifier.localeCompare(b.identifier);
          break;
        case 'country':
          const aCountry = a.countryId || '';
          const bCountry = b.countryId || '';
          comparison = aCountry.localeCompare(bCountry);
          break;
        case 'nodes':
          comparison = a.nodes.length - b.nodes.length;
          break;
        case 'servers':
          const aServers = a.stats?.serverCount || 0;
          const bServers = b.stats?.serverCount || 0;
          comparison = aServers - bServers;
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
          placeholder="Europe North"
          required
          maxLength={100}
        />
        <p className="text-xs text-gray-500 mt-1">
          A descriptive name for this region
        </p>
      </div>

      <div className="space-y-1">
        <label className="block text-xs font-medium text-gray-700">
          Identifier
        </label>
        <input
          type="text"
          value={formData.identifier}
          onChange={(e) => setFormData({ ...formData, identifier: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
          className="block w-full px-3 py-2 text-xs border border-gray-200 rounded-md focus:outline-none focus:border-gray-400"
          placeholder="eu-north"
          required
          pattern="^[a-z0-9-]+$"
          maxLength={20}
        />
        <p className="text-xs text-gray-500 mt-1">
          A unique lowercase identifier (a-z, 0-9, hyphens only)
        </p>
      </div>

      <div className="space-y-1">
        <label className="block text-xs font-medium text-gray-700">
          Country (Optional)
        </label>
        <select
          value={formData.countryId || ""}
          onChange={(e) => setFormData({ ...formData, countryId: e.target.value || undefined })}
          className="block w-full px-3 py-2 text-xs border border-gray-200 rounded-md focus:outline-none focus:border-gray-400"
        >
          {countryOptions.map(option => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        <p className="text-xs text-gray-500 mt-1">
          The country where this region is located
        </p>
      </div>

      <div className="space-y-1">
        <label className="block text-xs font-medium text-gray-700">
          Fallback Region (Optional)
        </label>
        <select
          value={formData.fallbackRegionId || ""}
          onChange={(e) => setFormData({ ...formData, fallbackRegionId: e.target.value || undefined })}
          className="block w-full px-3 py-2 text-xs border border-gray-200 rounded-md focus:outline-none focus:border-gray-400"
        >
          <option value="">None</option>
          {regions
            .filter(r => type === 'create' || r.id !== selectedRegion?.id) // Don't include self in edit mode
            .map(region => (
              <option key={region.id} value={region.id}>{region.name}</option>
            ))
          }
        </select>
        <p className="text-xs text-gray-500 mt-1">
          Region to use if no nodes are available in this region
        </p>
      </div>

      <div className="space-y-1">
        <label className="block text-xs font-medium text-gray-700">
          Server Limit (Optional)
        </label>
        <input
          type="number"
          value={formData.serverLimit || ''}
          onChange={(e) => setFormData({
            ...formData,
            serverLimit: e.target.value ? parseInt(e.target.value) : undefined
          })}
          className="block w-full px-3 py-2 text-xs border border-gray-200 rounded-md focus:outline-none focus:border-gray-400"
          min={0}
          placeholder="No limit"
        />
        <p className="text-xs text-gray-500 mt-1">
          Maximum number of servers allowed in this region
        </p>
      </div>

      <div className="flex items-center space-x-3">
        <button
          type="submit"
          className="px-3 py-2 text-xs font-medium text-white bg-gray-900 rounded-md hover:bg-gray-800"
        >
          {type === 'create' ? 'Create Region' : 'Update Region'}
        </button>
        <button
          type="button"
          onClick={() => {
            setView(type === 'edit' ? 'view' : 'list');
            if (type === 'create') setSelectedRegion(null);
            setFormData({ name: '', identifier: '' });
          }}
          className="px-3 py-2 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-md hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );

  const renderRegionView = () => {
    if (!selectedRegion) return null;

    // Count servers in region's nodes
    const serverCount = selectedRegion.stats?.serverCount || 0;

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => {
                setView('list');
                setSelectedRegion(null);
              }}
              className="flex items-center text-gray-600 hover:bg-gray-100 p-2 cursor-pointer rounded-md transition hover:text-gray-900"
            >
              <ArrowLeftIcon className="w-4 h-4" />
            </button>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{selectedRegion.name}</h2>
              <p className="text-xs text-gray-500">{selectedRegion.identifier}</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => {
                setFormData({
                  name: selectedRegion.name,
                  identifier: selectedRegion.identifier,
                  countryId: selectedRegion.countryId || undefined,
                  fallbackRegionId: selectedRegion.fallbackRegionId || undefined,
                  serverLimit: selectedRegion.serverLimit || undefined
                });
                setView('edit');
              }}
              className="flex items-center px-3 py-2 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-md hover:bg-gray-50"
            >
              <PencilIcon className="w-3.5 h-3.5 mr-1.5" />
              Edit
            </button>
            <button
              onClick={() => handleDelete(selectedRegion.id)}
              className="flex items-center px-3 py-2 text-xs font-medium text-red-600 bg-white border border-gray-200 rounded-md hover:bg-red-50"
            >
              <TrashIcon className="w-3.5 h-3.5 mr-1.5" />
              Delete
            </button>
          </div>
        </div>

        <div className="flex space-x-4 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-2 px-1 text-xs font-medium border-b-2 ${activeTab === 'overview'
                ? 'border-gray-900 text-gray-900'
                : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('nodes')}
            className={`py-2 px-1 text-xs font-medium border-b-2 ${activeTab === 'nodes'
                ? 'border-gray-900 text-gray-900'
                : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
          >
            Nodes ({selectedRegion.nodes.length})
          </button>
          <button
            onClick={() => setActiveTab('servers')}
            className={`py-2 px-1 text-xs font-medium border-b-2 ${activeTab === 'servers'
                ? 'border-gray-900 text-gray-900'
                : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
          >
            Servers ({serverCount})
          </button>
        </div>

        {activeTab === 'overview' ? (
          <div className="bg-white border border-gray-200 rounded-md shadow-xs">
            <div className="px-6 py-4">
              <div className="space-y-4">
                <div>
                  <div className="text-xs text-gray-500">Region ID</div>
                  <div className="text-sm font-mono mt-1">{selectedRegion.id}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Name</div>
                  <div className="text-sm mt-1">{selectedRegion.name}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Identifier</div>
                  <div className="text-sm mt-1">{selectedRegion.identifier}</div>
                </div>
                {selectedRegion.countryId && (
                  <div>
                    <div className="text-xs text-gray-500">Country</div>
                    <div className="text-sm mt-1">
                      {countryOptions.find(option => option.value === selectedRegion.countryId)?.label || selectedRegion.countryId}
                    </div>
                  </div>
                )}
                {selectedRegion.fallbackRegionId && (
                  <div>
                    <div className="text-xs text-gray-500">Fallback Region</div>
                    <div className="text-sm mt-1">
                      {selectedRegion.fallbackRegion?.name || 'Loading...'}
                    </div>
                  </div>
                )}
                <div>
                  <div className="text-xs text-gray-500">Server Limit</div>
                  <div className="text-sm mt-1">
                    {selectedRegion.serverLimit ? selectedRegion.serverLimit : 'No limit'}
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-100">
                  <div className="text-xs font-medium text-gray-900 mb-3">Statistics</div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <div className="text-xs text-gray-500">Nodes</div>
                      <div className="text-sm mt-1">{selectedRegion.nodes.length}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Online Nodes</div>
                      <div className="text-sm mt-1">{selectedRegion.stats?.onlineNodeCount || 0}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Servers</div>
                      <div className="text-sm mt-1">{serverCount}</div>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-100">
                  <div className="text-xs text-gray-500">Created At</div>
                  <div className="text-sm mt-1">
                    {new Date(selectedRegion.createdAt).toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Updated At</div>
                  <div className="text-sm mt-1">
                    {new Date(selectedRegion.updatedAt).toLocaleString()}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : activeTab === 'nodes' ? (
          <div className="grid grid-cols-3 gap-6">
            {/* Nodes List - Left Side */}
            <div className="col-span-2">
              <div className="bg-white border border-gray-200 rounded-md shadow-xs">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-medium text-gray-900">Nodes in Region</h3>
                  </div>

                  <div className="space-y-2">
                    {selectedRegion.nodes.length > 0 ? (
                      selectedRegion.nodes.map((node) => (
                        <div
                          key={node.id}
                          className="flex items-center justify-between p-3 bg-white rounded-md border border-gray-200 hover:border-gray-300"
                        >
                          <div className="flex items-center space-x-3">
                            <div className={`h-2 w-2 rounded-full ${node.isOnline ? 'bg-green-400' : 'bg-gray-300'}`} />
                            <div>
                              <div className="text-sm text-gray-900">{node.name}</div>
                              <div className="text-xs text-gray-500">{node.fqdn}:{node.port}</div>
                            </div>
                          </div>
                          <button
                            onClick={() => handleUnassignNode(node.id)}
                            className="px-2 py-1 text-xs font-medium text-red-600 bg-white border border-gray-200 rounded-md hover:bg-red-50"
                          >
                            Unassign
                          </button>
                        </div>
                      ))
                    ) : (
                      <div className="py-6 text-center">
                        <p className="text-sm text-gray-500">No nodes in this region</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Assign Node Form - Right Side */}
            <div>
              <div className="bg-white border border-gray-200 rounded-md shadow-xs">
                <div className="p-6">
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-sm font-medium text-gray-900">Assign Node to Region</h3>
                      <p className="text-xs text-gray-500 mt-1">
                        Add an existing node to this region.
                      </p>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-700">
                          Node
                        </label>
                        <select
                          value={selectedNodeId}
                          onChange={(e) => setSelectedNodeId(e.target.value)}
                          className="mt-1 block w-full px-3 py-2 text-xs border border-gray-200 rounded-md focus:outline-none focus:border-gray-400"
                          disabled={unassignedNodes.length === 0}
                        >
                          <option value="">Select a node</option>
                          {unassignedNodes.map(node => (
                            <option key={node.id} value={node.id}>{node.name} ({node.fqdn})</option>
                          ))}
                        </select>
                        {unassignedNodes.length === 0 && (
                          <p className="text-xs text-gray-500 mt-1">
                            No unassigned nodes available
                          </p>
                        )}
                      </div>

                      <button
                        onClick={handleAssignNode}
                        disabled={!selectedNodeId || assigning || unassignedNodes.length === 0}
                        className="w-full px-3 py-2 text-xs font-medium text-white bg-gray-900 rounded-md hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {assigning ? 'Assigning...' : 'Assign Node'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-md shadow-xs">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-gray-900">Servers in Region</h3>
              </div>

              {serverCount > 0 ? (
                <div className="space-y-2">
                  {/* We would need to fetch actual servers in this region */}
                  <p className="text-xs text-gray-500">
                    There are {serverCount} servers running across {selectedRegion.nodes.length} nodes in this region.
                  </p>

                  {/* This would be a table or list of servers if we had the data */}
                  <div className="py-4 text-center">
                    <p className="text-sm text-gray-500">
                      Visit the Servers page to see more details about individual servers.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="py-6 text-center">
                  <p className="text-sm text-gray-500">No servers in this region</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderRegionTable = () => {
    const sortedRegions = getSortedRegions();

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
              <th className="p-3 text-left text-xs font-medium text-gray-600 tracking-wider cursor-pointer" onClick={() => handleTableSort('identifier')}>
                <div className="flex items-center">
                  Identifier
                  {tableSortField === 'identifier' && (
                    <ChevronDownIcon className={`w-4 h-4 ml-1 ${tableSortDirection === 'desc' ? 'transform rotate-180' : ''}`} />
                  )}
                </div>
              </th>
              <th className="p-3 text-left text-xs font-medium text-gray-600 tracking-wider cursor-pointer" onClick={() => handleTableSort('country')}>
                <div className="flex items-center">
                  Country
                  {tableSortField === 'country' && (
                    <ChevronDownIcon className={`w-4 h-4 ml-1 ${tableSortDirection === 'desc' ? 'transform rotate-180' : ''}`} />
                  )}
                </div>
              </th>
              <th className="p-3 text-left text-xs font-medium text-gray-600 tracking-wider cursor-pointer" onClick={() => handleTableSort('nodes')}>
                <div className="flex items-center">
                  Nodes
                  {tableSortField === 'nodes' && (
                    <ChevronDownIcon className={`w-4 h-4 ml-1 ${tableSortDirection === 'desc' ? 'transform rotate-180' : ''}`} />
                  )}
                </div>
              </th>
              <th className="p-3 text-left text-xs font-medium text-gray-600 tracking-wider cursor-pointer" onClick={() => handleTableSort('servers')}>
                <div className="flex items-center">
                  Servers
                  {tableSortField === 'servers' && (
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
            {sortedRegions.map((region) => {
              const countryName = countryOptions.find(option => option.value === region.countryId)?.label || region.countryId || '-';
              return (
                <tr
                  key={region.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => {
                    setSelectedRegion(region);
                    setView('view');
                  }}
                >
                  <td className="p-3 text-xs text-gray-900">
                    <div className="flex items-center">
                      <GlobeIcon className="w-4 h-4 text-gray-400 mr-2" />
                      <span className="font-medium">{region.name}</span>
                    </div>
                  </td>
                  <td className="p-3 text-xs text-gray-500">{region.identifier}</td>
                  <td className="p-3 text-xs text-gray-500">{countryName}</td>
                  <td className="p-3 text-xs text-gray-500">
                    {region.nodes.length} {region.nodes.length === 1 ? 'node' : 'nodes'}
                    <span className="text-gray-400 ml-1">
                      ({region.stats?.onlineNodeCount || 0} online)
                    </span>
                  </td>
                  <td className="p-3 text-xs text-gray-500">
                    {region.stats?.serverCount || 0} {(region.stats?.serverCount || 0) === 1 ? 'server' : 'servers'}
                    {region.serverLimit && (
                      <span className="text-gray-400 ml-1">
                        / {region.serverLimit}
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end space-x-2" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setFormData({
                            name: region.name,
                            identifier: region.identifier,
                            countryId: region.countryId || undefined,
                            fallbackRegionId: region.fallbackRegionId || undefined,
                            serverLimit: region.serverLimit || undefined
                          });
                          setSelectedRegion(region);
                          setView('edit');
                        }}
                        className="p-1 text-gray-400 hover:text-gray-600"
                      >
                        <PencilIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(region.id);
                        }}
                        className="p-1 text-gray-400 hover:text-red-600"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {regions.length === 0 && (
              <tr>
                <td colSpan={6} className="p-4 text-center text-gray-500 text-xs">
                  No regions found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  };

  if (loading && regions.length === 0) {
    return (
      <div className="min-h-screen">
        <div className="p-6 flex items-center justify-center h-64">
          <LoadingSpinner />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
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
                  <h1 className="text-lg font-semibold text-gray-900">Regions</h1>
                  <p className="text-xs text-gray-500 mt-1">
                    Group your nodes into regions for better organization and load balancing.
                  </p>
                </div>
                <div className="flex space-x-3">
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
                    Create Region
                  </button>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-md shadow-xs">
                {renderRegionTable()}
              </div>
            </div>
          )}

          {view === 'create' && (
            <div className="space-y-6">
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => {
                    setView('list');
                    setSelectedRegion(null);
                  }}
                  className="flex items-center text-gray-600 hover:bg-gray-100 p-2 cursor-pointer rounded-md transition hover:text-gray-900"
                >
                  <ArrowLeftIcon className="w-4 h-4" />
                </button>
                <div>
                  <h1 className="text-lg font-semibold text-gray-900">Create Region</h1>
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
                    setFormData({ name: '', identifier: '' });
                  }}
                  className="flex items-center text-gray-600 hover:bg-gray-100 p-2 cursor-pointer rounded-md transition hover:text-gray-900"
                >
                  <ArrowLeftIcon className="w-4 h-4" />
                </button>
                <div>
                  <h1 className="text-lg font-semibold text-gray-900">Edit Region</h1>
                </div>
              </div>
              {renderForm('edit')}
            </div>
          )}

          {view === 'view' && renderRegionView()}
        </div>
      </div>
    </div>
  );
};

export default AdminRegionsPage;