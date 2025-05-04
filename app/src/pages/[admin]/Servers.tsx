import React, { useState, useEffect } from 'react';
import { ChevronRightIcon, PlusIcon, TrashIcon, PencilIcon, ArrowLeftIcon } from 'lucide-react';
import AdminBar from '../../components/AdminBar';
import LoadingSpinner from '../../components/LoadingSpinner';

interface Node {
  id: string;
  name: string;
  fqdn: string;
  port: number;
  isOnline: boolean;
  lastChecked: Date;
  createdAt: Date;
  updatedAt: Date;
  allocations?: Allocation[];
  region?: Region;
  regionId?: string | null;
}

interface Unit {
  id: string;
  name: string;
  shortName: string;
  description: string;
  dockerImage: string;
  defaultStartupCommand: string;
  configFiles: Record<string, string>;
  environmentVariables: Record<string, string>;
  installScript: string[];
  features: string[];
  meta: {
    version: string;
  };
  startup: {
    command: string;
    parameters: string[];
  };
  recommendedRequirements?: {
    memoryMiB: number;
    diskMiB: number;
    cpuPercent: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

interface User {
  id: string;
  username: string;
  permissions: string[];
}

interface Allocation {
  id: string;
  nodeId: string;
  port: number;
  bindAddress: string;
  alias?: string;
  notes?: string;
  assigned: boolean;
  serverId?: string;
}

interface Server {
  id: string;
  name: string;
  internalId: string;
  nodeId: string;
  unitId: string;
  userId: string;
  allocationId: string;
  memoryMiB: number;
  diskMiB: number;
  cpuPercent: number;
  state: string;
  createdAt: Date;
  updatedAt: Date;
  node?: Node;
  unit?: Unit;
  user?: User;
  status?: any;
}

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

// Update the CreateFormData interface to include regionId
interface CreateFormData {
  name: string;
  nodeId?: string;
  regionId?: string;
  allocationId?: string;
  memoryMiB: number;
  diskMiB: number;
  cpuPercent: number;
  unitId: string;
  userId: string;
  // Docker image selection for v3 units
  dockerImage?: string;
  // Startup command customization
  startupCommand?: string;
}

interface EditFormData {
  name?: string;
  unitId?: string;
  memoryMiB?: number;
  diskMiB?: number;
  cpuPercent?: number;
}

type View = 'list' | 'create' | 'view' | 'edit';

const AdminServersPage = () => {
  // Core state
  const [servers, setServers] = useState<Server[]>([]);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [availableRegions, setAvailableRegions] = useState<Region[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>('list');
  const [selectedServer, setSelectedServer] = useState<Server | null>(null);
  const [selectedUnitDockerImages, setSelectedUnitDockerImages] = useState<Array<{image: string, displayName: string}>>([]);
  const [isUnitV3, setIsUnitV3] = useState(false);

  // Deployment tab state - moved to top level
  const [deploymentTab, setDeploymentTab] = useState<'nodes' | 'regions'>('nodes');
  const [loadingRegions, setLoadingRegions] = useState(false);

  // Form state for creating servers
  const [createFormData, setCreateFormData] = useState<CreateFormData>({
    name: '',
    nodeId: '',
    unitId: '',
    userId: '',
    allocationId: '',
    memoryMiB: 1024,
    diskMiB: 10240,
    cpuPercent: 100
  });
  
  // Form state for editing servers (simplified compared to create form)
  const [editFormData, setEditFormData] = useState<EditFormData>({
    name: '',
    unitId: '',
    memoryMiB: 0,
    diskMiB: 0,
    cpuPercent: 0
  });
  
  const [formError, setFormError] = useState<string | null>(null);
  
  // Search state
  const [userSearch, setUserSearch] = useState('');
  const [unitSearch, setUnitSearch] = useState('');
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [filteredUnits, setFilteredUnits] = useState<Unit[]>([]);
  // Add loading states for edit operation
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (createFormData.unitId) {
      fetchUnitDetails(createFormData.unitId);
    } else {
      setSelectedUnitDockerImages([]);
      setIsUnitV3(false);
    }
  }, [createFormData.unitId]);

  useEffect(() => {
    fetchData();
  }, []);

  // Effect to fetch regions when the create view is shown
  useEffect(() => {
    if (view === 'create') {
      fetchRegions();
    }
  }, [view]);

  useEffect(() => {
    const filtered = users.filter(user => 
      user.username.toLowerCase().includes(userSearch.toLowerCase())
    );
    setFilteredUsers(filtered);
  }, [userSearch, users]);

  useEffect(() => {
    const filtered = units.filter(unit => 
      unit.name.toLowerCase().includes(unitSearch.toLowerCase()) ||
      unit.shortName.toLowerCase().includes(unitSearch.toLowerCase())
    );
    setFilteredUnits(filtered);
  }, [unitSearch, units]);

  // Function to fetch unit details including Docker images
  const fetchUnitDetails = async (unitId: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/units/${unitId}/docker-images`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        
        // Check if this is a v3 unit with multiple Docker images
        if (data.dockerImages && Array.isArray(data.dockerImages) && data.dockerImages.length > 0) {
          setSelectedUnitDockerImages(data.dockerImages);
          setIsUnitV3(true);
          
          // Auto-select the default Docker image
          if (data.defaultDockerImage) {
            updateFormData({ dockerImage: data.defaultDockerImage });
          } else {
            updateFormData({ dockerImage: data.dockerImages[0].image });
          }
        } else {
          // This is a v2 unit with a single Docker image
          const unitData = units.find(u => u.id === unitId);
          if (unitData) {
            setSelectedUnitDockerImages([{ 
              image: unitData.dockerImage, 
              displayName: 'Default Image' 
            }]);
            updateFormData({ dockerImage: unitData.dockerImage });
          } else {
            setSelectedUnitDockerImages([]);
          }
          setIsUnitV3(false);
        }
      } else {
        // Fallback to v2 behavior
        const unitData = units.find(u => u.id === unitId);
        if (unitData) {
          setSelectedUnitDockerImages([{ 
            image: unitData.dockerImage, 
            displayName: 'Default Image' 
          }]);
          updateFormData({ dockerImage: unitData.dockerImage });
        } else {
          setSelectedUnitDockerImages([]);
        }
        setIsUnitV3(false);
      }
    } catch (error) {
      console.error('Failed to fetch unit Docker images:', error);
      setSelectedUnitDockerImages([]);
      setIsUnitV3(false);
    }
  };

  const fetchRegions = async () => {
    setLoadingRegions(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/regions', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch regions');
      }
      
      const data = await response.json();
      setAvailableRegions(data);
    } catch (err) {
      console.error('Failed to fetch regions:', err);
      // Don't show an error, just fall back to node selection
      setDeploymentTab('nodes');
    } finally {
      setLoadingRegions(false);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const headers = { 'Authorization': `Bearer ${token}` };
      
      const [serversRes, nodesRes, unitsRes, usersRes, regionsRes] = await Promise.all([
        fetch('/api/servers?include[node]=true&include[unit]=true&include[user]=true', { headers }),
        fetch('/api/nodes', { headers }),
        fetch('/api/units', { headers }),
        fetch('/api/users', { headers }),
        fetch('/api/regions', { headers })
      ]);
      
      if (!serversRes.ok) throw new Error('Failed to fetch servers');
      if (!nodesRes.ok) throw new Error('Failed to fetch nodes');
      if (!unitsRes.ok) throw new Error('Failed to fetch units');
      if (!usersRes.ok) throw new Error('Failed to fetch users');
      // Don't throw on regions error, as it's optional
      
      const [serversData, nodesData, unitsData, usersData] = await Promise.all([
        serversRes.json(),
        nodesRes.json(),
        unitsRes.json(),
        usersRes.json()
      ]);
      
      // Try to get regions data if available
      let regionsData = [];
      if (regionsRes.ok) {
        regionsData = await regionsRes.json();
        setAvailableRegions(regionsData);
      }
  
      setServers(serversData);
      setNodes(nodesData);
      setUnits(unitsData);
      setUsers(usersData);
      
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    
    try {
      // Extract data from form and determine if we're using region-based or node-based deployment
      const payload = { ...createFormData };
      const isRegionBased = !!payload.regionId;
      
      // If using region-based deployment, we don't need nodeId or allocationId
      if (isRegionBased) {
        delete payload.nodeId;
        delete payload.allocationId;
      }
      
      // If no startup command is provided, remove it from the payload
      if (!payload.startupCommand) {
        delete payload.startupCommand;
      }
      
      const token = localStorage.getItem('token');
      const response = await fetch('/api/servers', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
  
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create server');
      }
  
      await fetchData();
      setView('list');
      // Reset form data including Docker image and startup command
      setCreateFormData({
        name: '',
        nodeId: '',
        unitId: '',
        userId: '',
        allocationId: '',
        memoryMiB: 1024,
        diskMiB: 10240,
        cpuPercent: 100,
        regionId: '',
        dockerImage: '',
        startupCommand: ''
      });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create server');
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedServer) return;
    setFormError(null);
    setUpdating(true);

    try {
      // Create an object with only the changed values
      const changesOnly: EditFormData = {};
      
      if (editFormData.name !== selectedServer.name) {
        changesOnly.name = editFormData.name;
      }
      
      if (editFormData.unitId !== selectedServer.unitId) {
        changesOnly.unitId = editFormData.unitId;
      }
      
      if (editFormData.memoryMiB !== selectedServer.memoryMiB) {
        changesOnly.memoryMiB = editFormData.memoryMiB;
      }
      
      if (editFormData.diskMiB !== selectedServer.diskMiB) {
        changesOnly.diskMiB = editFormData.diskMiB;
      }
      
      if (editFormData.cpuPercent !== selectedServer.cpuPercent) {
        changesOnly.cpuPercent = editFormData.cpuPercent;
      }
      
      // If nothing changed, just go back to view
      if (Object.keys(changesOnly).length === 0) {
        setView('view');
        setUpdating(false);
        return;
      }

      const token = localStorage.getItem('token');
      const response = await fetch(`/api/servers/${selectedServer.id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(changesOnly)
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update server');
      }
      
      // Refresh server list and select the updated server
      await fetchData();
      
      // Find the updated server in the refreshed list
      const refreshedServer = servers.find(s => s.id === selectedServer.id);
      if (refreshedServer) {
        setSelectedServer(refreshedServer);
      }
      
      setView('view');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to update server');
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async (serverId: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/servers/${serverId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete server');
      }

      await fetchData();
      if (selectedServer?.id === serverId) {
        setView('list');
        setSelectedServer(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete server');
    }
  };

  // Helper to update form data for create
  const updateFormData = (updates: Partial<CreateFormData>) => {
    setCreateFormData(prev => ({
      ...prev,
      ...updates
    }));
  };

  const renderCreateForm = () => {
    return (
      <form onSubmit={handleCreate} className="space-y-4 max-w-lg">
        {formError && (
          <div className="bg-red-50 border border-red-100 rounded-md p-3">
            <p className="text-xs text-red-600">{formError}</p>
          </div>
        )}
        
        <div className="space-y-1">
          <label className="block text-xs font-medium text-gray-700">
            Name
          </label>
          <input
            type="text"
            value={createFormData.name}
            onChange={(e) => updateFormData({ name: e.target.value })}
            className="block w-full px-3 py-2 text-xs border border-gray-200 rounded-md focus:outline-none focus:border-gray-400"
            placeholder="my-server"
            required
          />
        </div>
  
        {/* Deployment Method Tabs */}
        <div className="border-b border-gray-200 mb-2">
          <div className="flex">
            <button
              type="button"
              onClick={() => setDeploymentTab('nodes')}
              className={`pb-2 text-xs font-medium relative ${
                deploymentTab === 'nodes'
                  ? 'text-gray-800 border-indigo-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Specific Node
              {deploymentTab === 'nodes' && (
                <div className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-600"></div>
              )}
            </button>
            <button
              type="button"
              onClick={() => setDeploymentTab('regions')}
              className={`pb-2 ml-6 text-xs font-medium relative ${
                deploymentTab === 'regions'
                  ? 'text-gray-800 border-indigo-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Region (Load Balanced)
              {deploymentTab === 'regions' && (
                <div className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-600"></div>
              )}
            </button>
          </div>
        </div>
  
        {deploymentTab === 'nodes' ? (
          // Node selection section
          <>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-gray-700">
                Node
              </label>
              <select
                value={createFormData.nodeId || ''}
                onChange={(e) => updateFormData({ 
                  nodeId: e.target.value,
                  // Clear regionId when selecting a node
                  regionId: '',
                  // Clear allocation when changing node
                  allocationId: ''
                })}
                className="block w-full px-3 py-2 text-xs border border-gray-200 rounded-md focus:outline-none focus:border-gray-400"
                required={deploymentTab === 'nodes'}
              >
                <option value="">Select a node</option>
                {nodes.map(node => (
                  <option 
                    key={node.id} 
                    value={node.id}
                    disabled={!node.isOnline}
                  >
                    {node.name} ({node.fqdn}) {!node.isOnline && '- Offline'}
                  </option>
                ))}
              </select>
            </div>
  
            {createFormData.nodeId && (
              <div className="space-y-1">
                <label className="block text-xs font-medium text-gray-700">
                  Port Allocation
                </label>
                <select
                  value={createFormData.allocationId || ''}
                  onChange={(e) => updateFormData({ allocationId: e.target.value })}
                  className="block w-full px-3 py-2 text-xs border border-gray-200 rounded-md focus:outline-none focus:border-gray-400"
                  required={deploymentTab === 'nodes'}
                >
                  <option value="">Select a port allocation</option>
                  {nodes
                    .find(n => n.id === createFormData.nodeId)
                    ?.allocations
                    ?.filter(a => !a.assigned)
                    .map(allocation => (
                      <option key={allocation.id} value={allocation.id}>
                        {allocation.bindAddress}:{allocation.port}
                        {allocation.alias && ` (${allocation.alias})`}
                      </option>
                    ))
                  }
                </select>
                {nodes.find(n => n.id === createFormData.nodeId)?.allocations?.filter(a => !a.assigned).length === 0 && (
                  <p className="text-xs text-red-500 mt-1">
                    No available allocations on this node. Please select a different node or create allocations.
                  </p>
                )}
              </div>
            )}
          </>
        ) : (
          // Region selection section
          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-700">
              Region
            </label>
            {loadingRegions ? (
              <div className="flex items-center space-x-2 py-2">
                <div className="animate-spin h-4 w-4 border-2 border-gray-500 rounded-full border-t-transparent"></div>
                <span className="text-xs text-gray-500">Loading regions...</span>
              </div>
            ) : (
              <>
                <select
                  value={createFormData.regionId || ''}
                  onChange={(e) => updateFormData({ 
                    regionId: e.target.value,
                    // Clear nodeId and allocationId when selecting a region
                    nodeId: '',
                    allocationId: ''
                  })}
                  className="block w-full px-3 py-2 text-xs border border-gray-200 rounded-md focus:outline-none focus:border-gray-400"
                  required={deploymentTab === 'regions'}
                >
                  <option value="">Select a region</option>
                  {availableRegions.map(region => (
                    <option 
                      key={region.id} 
                      value={region.id}
                      disabled={region.stats?.onlineNodeCount === 0 || region.stats?.atCapacity}
                    >
                      {region.name} 
                      {region.stats?.onlineNodeCount === 0 ? ' (No online nodes)' : ''} 
                      {region.stats?.atCapacity ? ' (At capacity)' : ''}
                    </option>
                  ))}
                </select>
                {availableRegions.length === 0 && (
                  <p className="text-xs text-gray-500 mt-1">
                    No regions configured. Please create a region first or select a specific node.
                  </p>
                )}
                <p className="text-xs text-gray-500 mt-1">
                  Argon will automatically select the best node in this region
                </p>
              </>
            )}
          </div>
        )}
  
        <div className="space-y-1">
          <label className="block text-xs font-medium text-gray-700">
            Unit
          </label>
          <input
            type="text"
            value={unitSearch}
            onChange={(e) => setUnitSearch(e.target.value)}
            className="block w-full px-3 py-2 text-xs border border-gray-200 rounded-md focus:outline-none focus:border-gray-400 mb-2"
            placeholder="Search units..."
          />
          <select
            value={createFormData.unitId}
            onChange={(e) => updateFormData({ 
              unitId: e.target.value,
              // Clear Docker image when changing unit
              dockerImage: '' 
            })}
            className="block w-full px-3 py-2 text-xs border border-gray-200 rounded-md focus:outline-none focus:border-gray-400"
            required
          >
            <option value="">Select a unit</option>
            {filteredUnits.map(unit => (
              <option key={unit.id} value={unit.id}>
                {unit.name} ({unit.shortName}) {unit.meta?.version === 'argon/unit:v3' ? '(v3)' : ''}
              </option>
            ))}
          </select>
        </div>
        
        {/* V3: Docker Image Selection - only show if unit is selected and is v3 */}
        {createFormData.unitId && selectedUnitDockerImages.length > 1 && isUnitV3 && (
          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-700">
              Docker Image
            </label>
            <select
              value={createFormData.dockerImage}
              onChange={(e) => updateFormData({ dockerImage: e.target.value })}
              className="block w-full px-3 py-2 text-xs border border-gray-200 rounded-md focus:outline-none focus:border-gray-400"
              required
            >
              <option value="">Select a Docker image</option>
              {selectedUnitDockerImages.map((img, idx) => (
                <option key={idx} value={img.image}>
                  {img.displayName} ({img.image})
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Select a Docker image for this server. Each image may offer different versions or features.
            </p>
          </div>
        )}
        
        {/* V3: Custom startup command */}
        {createFormData.unitId && isUnitV3 && (
          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-700">
              Startup Command (Optional)
            </label>
            <input
              type="text"
              value={createFormData.startupCommand || ''}
              onChange={(e) => updateFormData({ startupCommand: e.target.value })}
              className="block w-full px-3 py-2 text-xs border border-gray-200 rounded-md focus:outline-none focus:border-gray-400"
              placeholder="Leave blank to use unit default"
            />
            <p className="text-xs text-gray-500 mt-1">
              Customize the startup command or leave blank to use the unit's default.
            </p>
          </div>
        )}
  
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
            value={createFormData.userId}
            onChange={(e) => updateFormData({ userId: e.target.value })}
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
        </div>
  
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-700">
              Memory (MiB)
            </label>
            <input
              type="number"
              value={createFormData.memoryMiB}
              onChange={(e) => updateFormData({ memoryMiB: parseInt(e.target.value) })}
              className="block w-full px-3 py-2 text-xs border border-gray-200 rounded-md focus:outline-none focus:border-gray-400"
              min={128}
              required
            />
          </div>
  
          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-700">
              Disk (MiB)
            </label>
            <input
              type="number"
              value={createFormData.diskMiB}
              onChange={(e) => updateFormData({ diskMiB: parseInt(e.target.value) })}
              className="block w-full px-3 py-2 text-xs border border-gray-200 rounded-md focus:outline-none focus:border-gray-400"
              min={1024}
              required
            />
          </div>
  
          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-700">
              CPU (%)
            </label>
            <input
              type="number"
              value={createFormData.cpuPercent}
              onChange={(e) => updateFormData({ cpuPercent: parseInt(e.target.value) })}
              className="block w-full px-3 py-2 text-xs border border-gray-200 rounded-md focus:outline-none focus:border-gray-400"
              min={25}
              max={400}
              required
            />
          </div>
        </div>
  
        <div className="flex items-center space-x-3">
          <button
            type="submit"
            className="px-3 py-2 text-xs font-medium text-white bg-gray-900 rounded-md hover:bg-gray-800"
            disabled={(deploymentTab === 'nodes' && (!createFormData.nodeId || !createFormData.allocationId)) || 
                    (deploymentTab === 'regions' && !createFormData.regionId)}
          >
            Create Server
          </button>
          <button
            type="button"
            onClick={() => {
              setView('list');
              setSelectedServer(null);
              setCreateFormData({
                name: '',
                nodeId: '',
                unitId: '',
                userId: '',
                allocationId: '',
                memoryMiB: 1024,
                diskMiB: 10240,
                cpuPercent: 100,
                regionId: ''
              });
            }}
            className="px-3 py-2 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </form>
    );
  };

  const renderEditForm = () => {
    if (!selectedServer) return null;
    
    return (
      <form onSubmit={handleEdit} className="space-y-4 max-w-lg">
        {formError && (
          <div className="bg-red-50 border border-red-100 rounded-md p-3">
            <p className="text-xs text-red-600">{formError}</p>
          </div>
        )}
        
        <div className="space-y-1">
          <label className="block text-xs font-medium text-gray-700">
            Name
          </label>
          <input
            type="text"
            value={editFormData.name}
            onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
            className="block w-full px-3 py-2 text-xs border border-gray-200 rounded-md focus:outline-none focus:border-gray-400"
            placeholder="my-server"
            required
          />
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-medium text-gray-700">
            Unit
          </label>
          <input
            type="text"
            value={unitSearch}
            onChange={(e) => setUnitSearch(e.target.value)}
            className="block w-full px-3 py-2 text-xs border border-gray-200 rounded-md focus:outline-none focus:border-gray-400 mb-2"
            placeholder="Search units..."
          />
          <select
            value={editFormData.unitId}
            onChange={(e) => setEditFormData({ ...editFormData, unitId: e.target.value })}
            className="block w-full px-3 py-2 text-xs border border-gray-200 rounded-md focus:outline-none focus:border-gray-400"
            required
          >
            {filteredUnits.map(unit => (
              <option key={unit.id} value={unit.id}>
                {unit.name} ({unit.shortName})
              </option>
            ))}
          </select>
          
          {editFormData.unitId !== selectedServer.unitId && (
            <p className="mt-2 text-yellow-600 text-xs">
              Warning: Changing the unit will reinstall the server with the new image.
              Your server data will be preserved, but the environment will change.
            </p>
          )}
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-700">
              Memory (MiB)
            </label>
            <input
              type="number"
              value={editFormData.memoryMiB}
              onChange={(e) => setEditFormData({ ...editFormData, memoryMiB: parseInt(e.target.value) })}
              className="block w-full px-3 py-2 text-xs border border-gray-200 rounded-md focus:outline-none focus:border-gray-400"
              min={128}
              required
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-700">
              Disk (MiB)
            </label>
            <input
              type="number"
              value={editFormData.diskMiB}
              onChange={(e) => setEditFormData({ ...editFormData, diskMiB: parseInt(e.target.value) })}
              className="block w-full px-3 py-2 text-xs border border-gray-200 rounded-md focus:outline-none focus:border-gray-400"
              min={1024}
              required
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-700">
              CPU (%)
            </label>
            <input
              type="number"
              value={editFormData.cpuPercent}
              onChange={(e) => setEditFormData({ ...editFormData, cpuPercent: parseInt(e.target.value) })}
              className="block w-full px-3 py-2 text-xs border border-gray-200 rounded-md focus:outline-none focus:border-gray-400"
              min={25}
              max={400}
              required
            />
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            type="submit"
            disabled={updating}
            className="px-3 py-2 text-xs font-medium text-white bg-gray-900 rounded-md hover:bg-gray-800 disabled:bg-gray-400"
          >
            {updating ? 'Updating...' : 'Update Server'}
          </button>
          <button
            type="button"
            disabled={updating}
            onClick={() => {
              setView('view');
              setFormError(null);
            }}
            className="px-3 py-2 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-md hover:bg-gray-50 disabled:bg-gray-100"
          >
            Cancel
          </button>
        </div>
        </form>
    );
  };

  const renderServerView = () => {
    if (!selectedServer) return null;

    // Find region information if available
    const region = selectedServer.node?.region;

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => {
                setView('list');
                setSelectedServer(null);
              }}
              className="flex items-center text-gray-600 hover:bg-gray-100 p-2 cursor-pointer rounded-md transition hover:text-gray-900"
            >
              <ArrowLeftIcon className="w-4 h-4" />
            </button>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{selectedServer.name}</h2>
              <p className="text-xs text-gray-500">{selectedServer.internalId}</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => {
                // Initialize the edit form with current server values
                setEditFormData({
                  name: selectedServer.name,
                  unitId: selectedServer.unitId,
                  memoryMiB: selectedServer.memoryMiB,
                  diskMiB: selectedServer.diskMiB,
                  cpuPercent: selectedServer.cpuPercent
                });
                setFormError(null);
                setView('edit');
              }}
              className="flex items-center px-3 py-2 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-md hover:bg-gray-50"
            >
              <PencilIcon className="w-3.5 h-3.5 mr-1.5" />
              Edit
            </button>
            <button
              onClick={() => handleDelete(selectedServer.id)}
              className="flex items-center px-3 py-2 text-xs font-medium text-red-600 bg-white border border-gray-200 rounded-md hover:bg-red-50"
            >
              <TrashIcon className="w-3.5 h-3.5 mr-1.5" />
              Delete
            </button>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-md shadow-xs">
          <div className="px-6 py-4">
            <div className="space-y-4">
              <div>
                <div className="text-xs text-gray-500">Server ID</div>
                <div className="text-sm font-mono mt-1">{selectedServer.id}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Name</div>
                <div className="text-sm mt-1">{selectedServer.name}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Internal ID</div>
                <div className="text-sm mt-1">{selectedServer.internalId}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Current State</div>
                <div className="text-sm mt-1">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    selectedServer.state === 'running' ? 'bg-green-100 text-green-800' : 
                    selectedServer.state === 'updating' ? 'bg-yellow-100 text-yellow-800' :
                    selectedServer.state === 'stopping' ? 'bg-orange-100 text-orange-800' :
                    selectedServer.state === 'starting' ? 'bg-blue-100 text-blue-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {selectedServer.state}
                  </span>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-100">
                <div className="text-xs font-medium text-gray-900 mb-3">Resources</div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <div className="text-xs text-gray-500">Memory</div>
                    <div className="text-sm mt-1">{selectedServer.memoryMiB} MiB</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Disk</div>
                    <div className="text-sm mt-1">{selectedServer.diskMiB} MiB</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">CPU</div>
                    <div className="text-sm mt-1">{selectedServer.cpuPercent}%</div>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-100">
                <div className="text-xs font-medium text-gray-900 mb-3">Relationships</div>
                <div className="space-y-4">
                  <div>
                    <div className="text-xs text-gray-500">Node</div>
                    <div className="text-sm mt-1">
                      {selectedServer.node?.name} ({selectedServer.node?.fqdn})
                    </div>
                  </div>
                  {/* Show region information if available */}
                  {region && (
                    <div>
                      <div className="text-xs text-gray-500">Region</div>
                      <div className="text-sm mt-1">
                        {region.name} ({region.identifier})
                      </div>
                    </div>
                  )}
                  <div>
                    <div className="text-xs text-gray-500">Unit</div>
                    <div className="text-sm mt-1">
                      {selectedServer.unit?.name} ({selectedServer.unit?.shortName})
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">User</div>
                    <div className="text-sm mt-1">
                      {selectedServer.user?.username}
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-100">
                <div className="text-xs text-gray-500">Created At</div>
                <div className="text-sm mt-1">
                  {new Date(selectedServer.createdAt).toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Updated At</div>
                <div className="text-sm mt-1">
                  {new Date(selectedServer.updatedAt).toLocaleString()}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <AdminBar />
        <div className="p-6">
          <div className="text-red-600 text-xs">Error: {error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminBar />
      <div className="p-6">
        <div className="transition-all duration-200 ease-in-out">
          {view === 'list' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-lg font-semibold text-gray-900">Servers</h1>
                  <p className="text-xs text-gray-500 mt-1">
                    Manage all servers running on your nodes.
                  </p>
                </div>
                <button
                  onClick={() => setView('create')}
                  className="flex items-center px-3 py-2 text-xs font-medium text-white bg-gray-900 rounded-md hover:bg-gray-800"
                >
                  <PlusIcon className="w-3.5 h-3.5 mr-1.5" />
                  Create Server
                </button>
              </div>

              <div className="space-y-2">
                {servers.map((server) => (
                  <div
                    key={server.id}
                    className="bg-white border border-gray-200 rounded-md shadow-xs cursor-pointer hover:border-gray-300"
                    onClick={() => {
                      setSelectedServer(server);
                      setView('view');
                    }}
                  >
                    <div className="px-6 h-20 flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="flex-shrink-0">
                          <div 
                            className={`h-2 w-2 rounded-full ${
                              server.state === 'running' ? 'bg-green-400' : 
                              server.state === 'updating' ? 'bg-yellow-400' :
                              server.state === 'starting' ? 'bg-blue-400' :
                              'bg-gray-300'
                            }`}
                          />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {server.name}
                          </div>
                          <div className="text-xs text-gray-500">
                            {server.user?.username} • {server.unit?.shortName}
                            {server.node?.region && ` • ${server.node.region.name}`}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-6">
                        <div className="flex space-x-4">
                          <span className="text-xs text-gray-500">
                            <span className="font-medium text-gray-900">{server.cpuPercent}%</span> CPU
                          </span>
                          <span className="text-xs text-gray-500">
                            <span className="font-medium text-gray-900">{server.memoryMiB} MiB</span> RAM
                          </span>
                          <span className="text-xs text-gray-500">
                            <span className="font-medium text-gray-900">{server.diskMiB} MiB</span> Disk
                          </span>
                        </div>
                        <ChevronRightIcon className="w-4 h-4 text-gray-400" />
                      </div>
                    </div>
                  </div>
                ))}

                {servers.length === 0 && (
                  <div className="text-center py-6 bg-white rounded-md border border-gray-200">
                    <p className="text-xs text-gray-500">No servers found</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {view === 'create' && (
            <div className="space-y-6">
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => {
                    setView('list');
                    setSelectedServer(null);
                  }}
                  className="flex items-center text-gray-600 hover:bg-gray-100 p-2 cursor-pointer rounded-md transition hover:text-gray-900"
                >
                  <ArrowLeftIcon className="w-4 h-4" />
                </button>
                <div>
                  <h1 className="text-lg font-semibold text-gray-900">Create Server</h1>
                </div>
              </div>
              {renderCreateForm()}
            </div>
          )}

          {view === 'edit' && (
            <div className="space-y-6">
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => {
                    setView('view');
                    setFormError(null);
                  }}
                  className="flex items-center text-gray-600 hover:bg-gray-100 p-2 cursor-pointer rounded-md transition hover:text-gray-900"
                >
                  <ArrowLeftIcon className="w-4 h-4" />
                </button>
                <div>
                  <h1 className="text-lg font-semibold text-gray-900">Edit Server: {selectedServer?.name}</h1>
                </div>
              </div>
              {renderEditForm()}
            </div>
          )}
          
          {view === 'view' && renderServerView()}
        </div>
      </div>
    </div>
  );
};

export default AdminServersPage;