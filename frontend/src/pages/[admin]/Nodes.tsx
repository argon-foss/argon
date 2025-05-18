import React, { useState, useEffect, useCallback } from 'react';
import { ChevronRightIcon, PlusIcon, ServerIcon, TrashIcon, PencilIcon, ArrowLeftIcon, CopyIcon, CheckIcon, ChevronLeftIcon, ChevronDownIcon, AlertTriangleIcon } from 'lucide-react';

interface SystemState {
  version: string;
  kernel: string;
  osVersion: string;
  hostname: string;
  cpuCores: number;
  memoryTotal: number;
  containers: {
    total: number;
    running: number;
    stopped: number;
  };
}

interface Node {
  id: string;
  name: string;
  fqdn: string;
  port: number;
  isOnline: boolean;
  lastChecked: Date;
  createdAt: Date;
  updatedAt: Date;
  systemState?: SystemState;
  connectionKey?: string;
  allocations?: Allocation[];
  resources?: {
    memoryAllocated: number;
    diskAllocated: number;
    cpuAllocated: number;
  };
}

interface Server {
  id: string;
  name: string;
  internalId: string;
  state: string;
  cpuPercent: number;
  memoryMiB: number;
  diskMiB?: number;
  userId: string;
  status: {
    state: string;
  };
  node: Node;
}

interface Allocation {
  id: string;
  nodeId: string;
  port: number;
  bindAddress: string;
  alias?: string;
  notes?: string;
  assigned: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface AllocationFormData {
  bindAddress: string;
  port?: number;
  portRange?: {
    start: number;
    end: number;
  };
  alias?: string;
  notes?: string;
}

interface PaginationState {
  page: number;
  limit: number;
  total: number;
}

type View = 'list' | 'create' | 'view' | 'edit';

interface FormData {
  name: string;
  fqdn: string;
  port: number;
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

const AdminNodesPage = () => {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>('list');
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [isCreatingAllocation, setIsCreatingAllocation] = useState(false);
  const [selectedAllocations, setSelectedAllocations] = useState<string[]>([]);
  const [formData, setFormData] = useState<FormData>({
    name: '',
    fqdn: '',
    port: 8080
  });
  const [activeTab, setActiveTab] = useState<'overview' | 'servers' | 'configure' | 'allocations'>('overview');
  const [allocationFormData, setAllocationFormData] = useState<AllocationFormData>({
    bindAddress: '0.0.0.0',
  });
  const [allocationFormMode, setAllocationFormMode] = useState<'single' | 'range'>('single');
  const [allocationFormError, setAllocationFormError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [connectionKey, setConnectionKey] = useState<string>('');
  const [alerts, setAlerts] = useState<{ id: string; type: 'error' | 'success' | 'warning'; message: string }[]>([]);
  const [allocationPagination, setAllocationPagination] = useState<PaginationState>({
    page: 1,
    limit: 10,
    total: 0
  });
  const [tableSortField, setTableSortField] = useState<string>('name');
  const [tableSortDirection, setTableSortDirection] = useState<'asc' | 'desc'>('asc');
  console.log(error)
  useEffect(() => {
    if (selectedNode && selectedNode.allocations && activeTab === 'allocations') {
      setAllocationPagination(prev => ({
        ...prev,
        total: selectedNode.allocations ? selectedNode.allocations.length : 0
      }));
    }
  }, [selectedNode, activeTab]);
  
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

  const fetchNodeState = async (node: Node) => {
    try {
      const response = await fetch(`http://${node.fqdn}:${node.port}/api/v1/state`);
      if (!response.ok) throw new Error('Failed to fetch node state');
      return await response.json();
    } catch (err) {
      console.error(`Failed to fetch state for node ${node.fqdn}:`, err);
      return null;
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const headers = { 'Authorization': `Bearer ${token}` };
      
      const [nodesRes, serversRes] = await Promise.all([
        fetch('/api/nodes', { headers }),
        fetch('/api/servers', { headers })
      ]);
      
      if (!nodesRes.ok) {
        const errorData = await nodesRes.json();
        throw new Error(errorData.error || 'Failed to fetch nodes');
      }
      
      if (!serversRes.ok) {
        const errorData = await serversRes.json();
        throw new Error(errorData.error || 'Failed to fetch servers');
      }
      
      const [nodesData, serversData] = await Promise.all([
        nodesRes.json(),
        serversRes.json()
      ]);

      // Calculate resources allocated to each node
      const nodesWithResources = nodesData.map((node: Node) => {
        const nodeServers = serversData.filter((s: Server) => s.node.id === node.id);
        return {
          ...node,
          resources: {
            memoryAllocated: nodeServers.reduce((sum: number, s: Server) => sum + s.memoryMiB * 1024 * 1024, 0),
            diskAllocated: nodeServers.reduce((sum: number, s: Server) => sum + (s.diskMiB || 0) * 1024 * 1024, 0),
            cpuAllocated: nodeServers.reduce((sum: number, s: Server) => sum + s.cpuPercent, 0),
          }
        };
      });

      // Fetch system state for each online node
      const nodesWithState = await Promise.all(
        nodesWithResources.map(async (node: Node) => {
          if (node.isOnline) {
            const systemState = await fetchNodeState(node);
            return { ...node, systemState };
          }
          return node;
        })
      );
      
      setNodes(nodesWithState);
      setServers(serversData);

      // Refresh selected node data if we're in view mode
      if (selectedNode && view === 'view') {
        const updatedNode = nodesWithState.find(n => n.id === selectedNode.id);
        if (updatedNode) {
          setSelectedNode(updatedNode);
          
          // Update allocation pagination total if we're on the allocation tab
          if (activeTab === 'allocations' && updatedNode.allocations) {
            setAllocationPagination(prev => ({
              ...prev, 
              total: updatedNode.allocations ? updatedNode.allocations.length : 0
            }));
          }
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

  const fetchSingleNode = async (nodeId: string) => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/nodes/${nodeId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch node');
      }
      
      const nodeData = await response.json();
      
      // Update the node in the nodes list
      setNodes(prevNodes => 
        prevNodes.map(node => node.id === nodeId ? nodeData : node)
      );
      
      // Update selected node if this is the one we're viewing
      if (selectedNode && selectedNode.id === nodeId) {
        setSelectedNode(nodeData);
        
        // Update allocation pagination total if we're on the allocation tab
        if (activeTab === 'allocations' && nodeData.allocations) {
          setAllocationPagination(prev => ({
            ...prev, 
            total: nodeData.allocations ? nodeData.allocations.length : 0
          }));
        }
      }
      
      setError(null);
      return nodeData;
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
      const response = await fetch('/api/nodes', {
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
          : data.error || 'Failed to create node';
        
        throw new Error(errorMessage);
      }

      await fetchData();
      setView('list');
      setFormData({ name: '', fqdn: '', port: 8080 });
      showAlert('success', `Node "${formData.name}" created successfully`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create node';
      setFormError(errorMessage);
      showAlert('error', errorMessage);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedNode) return;
    setFormError(null);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/nodes/${selectedNode.id}`, {
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
          : data.error || 'Failed to update node';
        
        throw new Error(errorMessage);
      }

      await fetchData();
      showAlert('success', `Node "${formData.name}" updated successfully`);
      
      // Fetch the updated node and update selected node
      const updatedNode = await fetchSingleNode(selectedNode.id);
      if (updatedNode) {
        setSelectedNode(updatedNode);
      }
      
      setView('view');
      setFormData({ name: '', fqdn: '', port: 8080 });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update node';
      setFormError(errorMessage);
      showAlert('error', errorMessage);
    }
  };

  const handleDelete = async (nodeId: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/nodes/${nodeId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const data = await response.json();
        
        if (data.count && data.count > 0) {
          showAlert('warning', `Cannot delete node with ${data.count} active servers`);
          return;
        }
        
        throw new Error(data.error || 'Failed to delete node');
      }

      await fetchData();
      if (selectedNode?.id === nodeId) {
        setView('list');
        setSelectedNode(null);
      }
      
      showAlert('success', 'Node deleted successfully');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete node';
      showAlert('error', errorMessage);
    }
  };

  const handleCopyKey = async () => {
    try {
      await navigator.clipboard.writeText(connectionKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy connection key:', err);
      showAlert('error', 'Failed to copy connection key');
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const handleTableSort = (field: string) => {
    if (tableSortField === field) {
      setTableSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setTableSortField(field);
      setTableSortDirection('asc');
    }
  };

  const getSortedNodes = () => {
    return [...nodes].sort((a, b) => {
      let comparison = 0;
      
      switch (tableSortField) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'fqdn':
          comparison = a.fqdn.localeCompare(b.fqdn);
          break;
        case 'port':
          comparison = a.port - b.port;
          break;
        case 'status':
          comparison = Number(b.isOnline) - Number(a.isOnline);
          break;
        case 'servers':
          const aCount = servers.filter(s => s.node.id === a.id).length;
          const bCount = servers.filter(s => s.node.id === b.id).length;
          comparison = aCount - bCount;
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
          placeholder="node-1"
          required
          maxLength={100}
        />
        <p className="text-xs text-gray-500 mt-1">
          A unique identifier for this node
        </p>
      </div>

      <div className="space-y-1">
        <label className="block text-xs font-medium text-gray-700">
          Hostname (FQDN)
        </label>
        <input
          type="text"
          value={formData.fqdn}
          onChange={(e) => setFormData({ ...formData, fqdn: e.target.value })}
          className="block w-full px-3 py-2 text-xs border border-gray-200 rounded-md focus:outline-none focus:border-gray-400"
          placeholder="node1.example.com"
          required
          pattern="^(localhost|[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}|(\d{1,3}\.){3}\d{1,3})$"
        />
        <p className="text-xs text-gray-500 mt-1">
          Must be a valid fully qualified domain name or an IP address
        </p>
      </div>

      <div className="space-y-1">
        <label className="block text-xs font-medium text-gray-700">
          Port
        </label>
        <input
          type="number"
          value={formData.port}
          onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) })}
          className="block w-full px-3 py-2 text-xs border border-gray-200 rounded-md focus:outline-none focus:border-gray-400"
          required
          min={1}
          max={65535}
        />
        <p className="text-xs text-gray-500 mt-1">
          Must be between 1 and 65535
        </p>
      </div>

      <div className="flex items-center space-x-3">
        <button
          type="submit"
          className="px-3 py-2 text-xs font-medium text-white bg-gray-900 rounded-md hover:bg-gray-800"
        >
          {type === 'create' ? 'Create Node' : 'Update Node'}
        </button>
        <button
          type="button"
          onClick={() => {
            setView(type === 'edit' ? 'view' : 'list');
            if (type === 'create') setSelectedNode(null);
            setFormData({ name: '', fqdn: '', port: 8080 });
          }}
          className="px-3 py-2 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-md hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );

  const handleDeleteAllocation = async (allocationId: string) => {
    if (!selectedNode) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/nodes/${selectedNode.id}/allocations/${allocationId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete allocation');
      }

      // Fetch the updated node data directly
      const updatedNode = await fetchSingleNode(selectedNode.id);
      if (updatedNode) {
        setSelectedNode(updatedNode);
        
        // Update pagination if necessary
        if (updatedNode.allocations) {
          const totalPages = Math.ceil(updatedNode.allocations.length / allocationPagination.limit);
          if (allocationPagination.page > totalPages && totalPages > 0) {
            setAllocationPagination(prev => ({
              ...prev,
              page: totalPages,
              total: updatedNode.allocations ? updatedNode.allocations.length : 0
            }));
          } else {
            setAllocationPagination(prev => ({
              ...prev,
              total: updatedNode.allocations ? updatedNode.allocations.length : 0
            }));
          }
        }
      }
      
      showAlert('success', 'Allocation deleted successfully');
      
      // Clear selected allocations
      setSelectedAllocations([]);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete allocation';
      showAlert('error', errorMessage);
    }
  };

  const renderPagination = (pagination: PaginationState, onPageChange: (page: number) => void) => {
    const totalPages = Math.max(1, Math.ceil(pagination.total / pagination.limit));
    const currentPage = pagination.page;
    
    return (
      <div className="flex items-center justify-between mt-4 text-xs">
        <div className="text-gray-500">
          Showing {Math.min((currentPage - 1) * pagination.limit + 1, pagination.total)} to {Math.min(currentPage * pagination.limit, pagination.total)} of {pagination.total} entries
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="p-1 rounded border border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeftIcon className="w-4 h-4" />
          </button>
          
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            // Calculate page numbers to show (current +/- 2)
            let pageNum;
            if (totalPages <= 5) {
              pageNum = i + 1;
            } else if (currentPage <= 3) {
              pageNum = i + 1;
            } else if (currentPage >= totalPages - 2) {
              pageNum = totalPages - 4 + i;
            } else {
              pageNum = currentPage - 2 + i;
            }
            
            return (
              <button
                key={pageNum}
                onClick={() => onPageChange(pageNum)}
                className={`px-2 py-1 rounded ${
                  currentPage === pageNum
                    ? 'bg-gray-900 text-white'
                    : 'border border-gray-200 hover:bg-gray-50'
                }`}
              >
                {pageNum}
              </button>
            );
          })}
          
          <button
            onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            className="p-1 rounded border border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronRightIcon className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  };

  const renderAllocationTab = () => {
    if (!selectedNode) return null;
  
    const allocations = selectedNode.allocations || [];
    const assignedAllocations = allocations.filter(a => a.assigned);
    const unassignedAllocations = allocations.filter(a => !a.assigned);
    
    // Calculate paginated allocations
    const paginatedAssigned = assignedAllocations.slice(
      (allocationPagination.page - 1) * allocationPagination.limit,
      allocationPagination.page * allocationPagination.limit
    );
    
    const paginatedUnassigned = unassignedAllocations.slice(
      Math.max(0, (allocationPagination.page - 1) * allocationPagination.limit - assignedAllocations.length),
      Math.max(0, allocationPagination.page * allocationPagination.limit - assignedAllocations.length)
    );
    
    // Determine if we show assigned, unassigned, or both in the current page
    const startIdx = (allocationPagination.page - 1) * allocationPagination.limit;
    const endIdx = allocationPagination.page * allocationPagination.limit;
    
    const showAssigned = startIdx < assignedAllocations.length;
    const showUnassigned = endIdx > assignedAllocations.length;
    
    const handlePageChange = (page: number) => {
      setAllocationPagination(prev => ({ ...prev, page }));
    };
  
    const handleCreateAllocation = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsCreatingAllocation(true);
      setAllocationFormError(null);
  
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/nodes/${selectedNode.id}/allocations`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(allocationFormData)
        });
  
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to create allocation');
        }
        
        // Fetch the updated node data directly
        const updatedNode = await fetchSingleNode(selectedNode.id);
        if (updatedNode) {
          setSelectedNode(updatedNode);
          
          // Update pagination if necessary
          if (updatedNode.allocations) {
            setAllocationPagination(prev => ({
              ...prev,
              total: updatedNode.allocations ? updatedNode.allocations.length : 0
            }));
          }
        }
  
        setAllocationFormData({ bindAddress: '0.0.0.0' });
        setAllocationFormMode('single');
        showAlert('success', 'Allocation created successfully');
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to create allocation';
        setAllocationFormError(errorMessage);
        showAlert('error', errorMessage);
      } finally {
        setIsCreatingAllocation(false);
      }
    };
  
    const handleDeleteSelected = async () => {
      for (const id of selectedAllocations) {
        try {
          await handleDeleteAllocation(id);
        } catch (error) {
          console.error(`Failed to delete allocation ${id}:`, error);
        }
      }
      setSelectedAllocations([]);
    };
  
    const toggleAllocation = (id: string) => {
      setSelectedAllocations(prev => 
        prev.includes(id) 
          ? prev.filter(allocId => allocId !== id)
          : [...prev, id]
      );
    };
  
    return (
      <div className="grid grid-cols-3 gap-6">
        {/* Allocations List - Left Side */}
        <div className="col-span-2">
          <div className="bg-white border border-gray-200 rounded-md shadow-xs">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-900">Port Allocations</h3>
                  <p className="text-xs text-gray-500 mt-1">
                    {allocations.length} total • {assignedAllocations.length} in use
                  </p>
                </div>
                {selectedAllocations.length > 0 && (
                  <button
                    onClick={handleDeleteSelected}
                    className="flex items-center px-3 py-2 text-xs font-medium text-red-600 bg-white border border-gray-200 rounded-md hover:bg-red-50"
                  >
                    <TrashIcon className="w-3.5 h-3.5 mr-1.5" />
                    Delete Selected ({selectedAllocations.length})
                  </button>
                )}
              </div>
  
              <div className="space-y-4">
                {showAssigned && assignedAllocations.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-gray-500 mb-2">In Use</h4>
                    <div className="space-y-2">
                      {paginatedAssigned.map((allocation) => (
                        <div
                          key={allocation.id}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-md border border-gray-200"
                        >
                          <div className="flex items-center space-x-3">
                            <ServerIcon className="w-4 h-4 text-gray-400" />
                            <div>
                              <div className="text-sm text-gray-900">
                                {allocation.bindAddress}:{allocation.port}
                              </div>
                              {(allocation.alias || allocation.notes) && (
                                <div className="text-xs text-gray-500 mt-1">
                                  {allocation.alias && <span className="font-medium">{allocation.alias}</span>}
                                  {allocation.alias && allocation.notes && ' • '}
                                  {allocation.notes}
                                </div>
                              )}
                            </div>
                          </div>
                          <span className="text-xs text-gray-500">In use</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
  
                {showUnassigned && unassignedAllocations.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-gray-500 mb-2">Available</h4>
                    <div className="space-y-2">
                      {paginatedUnassigned.map((allocation) => (
                        <div
                          key={allocation.id}
                          className="flex items-center justify-between p-3 bg-white rounded-md border border-gray-200 hover:border-gray-300"
                        >
                          <div className="flex items-center space-x-3">
                            <input
                              type="checkbox"
                              checked={selectedAllocations.includes(allocation.id)}
                              onChange={() => toggleAllocation(allocation.id)}
                              className="rounded border-gray-300"
                            />
                            <div>
                              <div className="text-sm text-gray-900">
                                {allocation.bindAddress}:{allocation.port}
                              </div>
                              {(allocation.alias || allocation.notes) && (
                                <div className="text-xs text-gray-500 mt-1">
                                  {allocation.alias && <span className="font-medium">{allocation.alias}</span>}
                                  {allocation.alias && allocation.notes && ' • '}
                                  {allocation.notes}
                                </div>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => handleDeleteAllocation(allocation.id)}
                            className="p-1.5 text-gray-400 hover:text-red-600"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
  
                {allocations.length === 0 && (
                  <div className="py-6 text-center">
                    <p className="text-sm text-gray-500">No allocations found</p>
                  </div>
                )}
              </div>
              
              {allocations.length > 0 && renderPagination(allocationPagination, handlePageChange)}
            </div>
          </div>
        </div>
  
        {/* Create Allocation Form - Right Side */}
        <div>
          <div className="bg-white border border-gray-200 rounded-md shadow-xs">
            <div className="p-6">
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-medium text-gray-900">Create Allocation</h3>
                  <p className="text-xs text-gray-500 mt-1">
                    Allocate ports for your servers to use on this node.
                  </p>
                </div>
  
                {allocationFormError && (
                  <Alert 
                    type="error"
                    message={allocationFormError}
                    onDismiss={() => setAllocationFormError(null)}
                  />
                )}
  
                <form onSubmit={handleCreateAllocation} className="space-y-4">
                  <div className="flex space-x-4">
                    <button
                      type="button"
                      onClick={() => setAllocationFormMode('single')}
                      className={`px-3 py-2 text-xs font-medium rounded-md ${
                        allocationFormMode === 'single'
                          ? 'bg-gray-900 text-white'
                          : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      Single Port
                    </button>
                    <button
                      type="button"
                      onClick={() => setAllocationFormMode('range')}
                      className={`px-3 py-2 text-xs font-medium rounded-md ${
                        allocationFormMode === 'range'
                          ? 'bg-gray-900 text-white'
                          : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      Port Range
                    </button>
                  </div>
  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-700">
                        Bind Address
                      </label>
                      <input
                        type="text"
                        value={allocationFormData.bindAddress}
                        onChange={(e) => setAllocationFormData({ ...allocationFormData, bindAddress: e.target.value })}
                        className="mt-1 block w-full px-3 py-2 text-xs border border-gray-200 rounded-md focus:outline-none focus:border-gray-400"
                        placeholder="0.0.0.0"
                        required
                      />
                    </div>
  
                    {allocationFormMode === 'single' ? (
                      <div>
                        <label className="block text-xs font-medium text-gray-700">
                          Port
                        </label>
                        <input
                          type="number"
                          value={allocationFormData.port || ''}
                          onChange={(e) => setAllocationFormData({ 
                            ...allocationFormData, 
                            port: parseInt(e.target.value),
                            portRange: undefined
                          })}
                          className="mt-1 block w-full px-3 py-2 text-xs border border-gray-200 rounded-md focus:outline-none focus:border-gray-400"
                          min={1}
                          max={65535}
                          required
                        />
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-gray-700">
                            Start Port
                          </label>
                          <input
                            type="number"
                            value={allocationFormData.portRange?.start || ''}
                            onChange={(e) => setAllocationFormData({
                              ...allocationFormData,
                              port: undefined,
                              portRange: {
                                start: parseInt(e.target.value),
                                end: allocationFormData.portRange?.end || parseInt(e.target.value)
                              }
                            })}
                            className="mt-1 block w-full px-3 py-2 text-xs border border-gray-200 rounded-md focus:outline-none focus:border-gray-400"
                            min={1}
                            max={65535}
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700">
                            End Port
                          </label>
                          <input
                            type="number"
                            value={allocationFormData.portRange?.end || ''}
                            onChange={(e) => setAllocationFormData({
                              ...allocationFormData,
                              port: undefined,
                              portRange: {
                                start: allocationFormData.portRange?.start || parseInt(e.target.value),
                                end: parseInt(e.target.value)
                              }
                            })}
                            className="mt-1 block w-full px-3 py-2 text-xs border border-gray-200 rounded-md focus:outline-none focus:border-gray-400"
                            min={1}
                            max={65535}
                            required
                          />
                        </div>
                      </div>
                    )}
  
                    <div>
                      <label className="block text-xs font-medium text-gray-700">
                        Alias (Optional)
                      </label>
                      <input
                        type="text"
                        value={allocationFormData.alias || ''}
                        onChange={(e) => setAllocationFormData({ ...allocationFormData, alias: e.target.value })}
                        className="mt-1 block w-full px-3 py-2 text-xs border border-gray-200 rounded-md focus:outline-none focus:border-gray-400"
                        placeholder="node.example.com"
                      />
                    </div>
  
                    <div>
                      <label className="block text-xs font-medium text-gray-700">
                        Notes (Optional)
                      </label>
                      <input
                        type="text"
                        value={allocationFormData.notes || ''}
                        onChange={(e) => setAllocationFormData({ ...allocationFormData, notes: e.target.value })}
                        className="mt-1 block w-full px-3 py-2 text-xs border border-gray-200 rounded-md focus:outline-none focus:border-gray-400"
                        placeholder="Additional information"
                      />
                    </div>
                  </div>
  
                  <button
                    type="submit"
                    disabled={isCreatingAllocation}
                    className="w-full px-3 py-2 text-xs font-medium text-white bg-gray-900 rounded-md hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isCreatingAllocation ? 'Creating...' : 'Create Allocation'}
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderNodeView = () => {
    if (!selectedNode) return null;

    if (!selectedNode.connectionKey) {
      setConnectionKey(selectedNode.connectionKey || '');
    }

    const nodeServers = servers.filter(server => server.node.id === selectedNode.id);

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => {
                setView('list');
                setSelectedNode(null);
              }}
              className="flex items-center text-gray-600 hover:bg-gray-100 p-2 cursor-pointer rounded-md transition hover:text-gray-900"
            >
              <ArrowLeftIcon className="w-4 h-4" />
            </button>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{selectedNode.name}</h2>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => {
                setFormData({
                  name: selectedNode.name,
                  fqdn: selectedNode.fqdn,
                  port: selectedNode.port
                });
                setView('edit');
              }}
              className="flex items-center px-3 py-2 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-md hover:bg-gray-50"
            >
              <PencilIcon className="w-3.5 h-3.5 mr-1.5" />
              Edit
            </button>
            <button
              onClick={() => handleDelete(selectedNode.id)}
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
            className={`py-2 px-1 text-xs font-medium border-b-2 ${
              activeTab === 'overview'
                ? 'border-gray-900 text-gray-900'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('servers')}
            className={`py-2 px-1 text-xs font-medium border-b-2 ${
              activeTab === 'servers'
                ? 'border-gray-900 text-gray-900'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Servers ({nodeServers.length})
          </button>
          <button
            onClick={() => setActiveTab('allocations')} 
            className={`py-2 px-1 text-xs font-medium border-b-2 ${
              activeTab === 'allocations'
                ? 'border-gray-900 text-gray-900'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Allocations
          </button>
          <button
            onClick={() => setActiveTab('configure')}
            className={`py-2 px-1 text-xs font-medium border-b-2 ${
              activeTab === 'configure'
                ? 'border-gray-900 text-gray-900'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Configure
          </button>
        </div>

        {activeTab === 'overview' ? (
          <div className="bg-white border border-gray-200 rounded-md shadow-xs">
            <div className="px-6 py-4">
              <div className="space-y-4">
                <div>
                  <div className="text-xs text-gray-500">Node ID</div>
                  <div className="text-sm font-mono mt-1">{selectedNode.id}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Name</div>
                  <div className="text-sm mt-1">{selectedNode.name}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">FQDN</div>
                  <div className="text-sm mt-1">{selectedNode.fqdn}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Port</div>
                  <div className="text-sm mt-1">{selectedNode.port}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Status</div>
                  <div className="flex items-center space-x-2 mt-1">
                    <div 
                      className={`h-2 w-2 rounded-full ${
                        selectedNode.isOnline ? 'bg-green-400' : 'bg-gray-300'
                      }`}
                    />
                    <span className="text-sm">
                      {selectedNode.isOnline ? 'Online' : 'Offline'}
                    </span>
                  </div>
                </div>

                {selectedNode.systemState && (
                  <>
                    <div className="pt-4 border-t border-gray-100">
                      <div className="text-xs font-medium text-gray-900 mb-3">System Information</div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="text-xs text-gray-500">Krypton Version</div>
                          <div className="text-sm mt-1">{selectedNode.systemState.version}</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500">OS</div>
                          <div className="text-sm mt-1">{selectedNode.systemState.osVersion}</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500">Kernel</div>
                          <div className="text-sm mt-1">{selectedNode.systemState.kernel}</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500">CPU Cores</div>
                          <div className="text-sm mt-1">{selectedNode.systemState.cpuCores}</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500">System Memory</div>
                          <div className="text-sm mt-1">{formatBytes(selectedNode.systemState.memoryTotal)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500">Docker Containers</div>
                          <div className="text-sm mt-1">
                            {selectedNode.systemState.containers.running} running, {selectedNode.systemState.containers.stopped} stopped
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-gray-100">
                      <div className="text-xs font-medium text-gray-900 mb-3">Resource Allocation</div>
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <div className="text-xs text-gray-500">CPU Allocated</div>
                          <div className="text-sm mt-1">{selectedNode.resources?.cpuAllocated}%</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500">Memory Allocated</div>
                          <div className="text-sm mt-1">{formatBytes(selectedNode.resources?.memoryAllocated || 0)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500">Disk Allocated</div>
                          <div className="text-sm mt-1">{formatBytes(selectedNode.resources?.diskAllocated || 0)}</div>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                <div className="pt-4 border-t border-gray-100">
                  <div className="text-xs text-gray-500">Last Checked</div>
                  <div className="text-sm mt-1">
                    {new Date(selectedNode.lastChecked).toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Created At</div>
                  <div className="text-sm mt-1">
                    {new Date(selectedNode.createdAt).toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Updated At</div>
                  <div className="text-sm mt-1">
                    {new Date(selectedNode.updatedAt).toLocaleString()}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : activeTab === 'servers' ? (
          <div className="space-y-2">
            {nodeServers.map((server) => (
              <div
                key={server.id}
                className="bg-white border border-gray-200 rounded-md shadow-xs"
              >
                <div className="px-6 h-16 flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="flex-shrink-0">
                      <div 
                        className={`h-2 w-2 rounded-full ${
                          server.status.state === 'running' ? 'bg-green-400' : 'bg-gray-300'
                        }`}
                      />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {server.name}
                      </div>
                      <div className="text-xs text-gray-500">
                        {server.internalId}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-6">
                    <div className="flex space-x-4">
                      <span className="text-xs text-gray-500">
                        <span className="font-medium text-gray-900">{server.cpuPercent}%</span> CPU
                      </span>
                      <span className="text-xs text-gray-500">
                        <span className="font-medium text-gray-900">
                          {(server.memoryMiB / 1024).toFixed(1)} GB
                        </span> RAM
                      </span>
                    </div>
                    <ChevronRightIcon className="w-4 h-4 text-gray-400" />
                  </div>
                </div>
              </div>
            ))}

            {nodeServers.length === 0 && (
              <div className="text-center py-6 bg-white rounded-md border border-gray-200">
                <p className="text-xs text-gray-500">No servers found</p>
              </div>
            )}
          </div>
        ) : activeTab === 'allocations' ? (
          renderAllocationTab()
        ) : (
          <div className="bg-white border border-gray-200 rounded-md shadow-xs">
            <div className="px-6 py-4">
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-medium text-gray-900">Configure Krypton</h3>
                  <p className="text-xs text-gray-500 mt-1">
                    Follow these steps to configure Krypton on your node.
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <div className="text-xs font-medium text-gray-900">1. Navigate to Krypton Directory</div>
                    <p className="text-xs text-gray-500 mt-1">
                      Open a terminal and navigate to your Krypton installation directory.
                    </p>
                  </div>

                  <div>
                    <div className="text-xs font-medium text-gray-900">2. Run Configuration Script</div>
                    <div className="mt-1 relative">
                      <div className="bg-gray-50 rounded-md p-3 font-mono text-xs">
                        bun run configure
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      This will start the interactive configuration process.
                    </p>
                  </div>

                  <div>
                    <div className="text-xs font-medium text-gray-900">3. Connection Key</div>
                    <p className="text-xs text-gray-500 mt-1">
                      When prompted for the connection key, use the following:
                    </p>
                    <div className="mt-2 relative">
                      <div className="bg-gray-50 rounded-md p-3 pr-12 font-mono text-xs overflow-x-auto">
                        {selectedNode.connectionKey || 'Loading...'}
                      </div>
                      <button
                        onClick={handleCopyKey}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-500 hover:text-gray-700"
                      >
                        {copied ? (
                          <CheckIcon className="w-4 h-4 text-green-500" />
                        ) : (
                          <CopyIcon className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div>
                    <div className="text-xs font-medium text-gray-900">4. Complete Configuration</div>
                    <p className="text-xs text-gray-500 mt-1">
                      Answer any additional configuration questions. Once complete, Krypton will restart automatically with the new configuration.
                    </p>
                  </div>

                  <div className="pt-2">
                    <p className="text-xs text-gray-500">
                      Need help? Check out our{" "}
                      <a
                        href="https://docs.argon.io/krypton/configuration"
                        target="_blank"
                        rel="noreferrer"
                        className="text-indigo-500 hover:underline"
                      >
                        configuration documentation
                      </a>{" "}
                      for detailed instructions.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderNodeTable = () => {
    const sortedNodes = getSortedNodes();
    
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
              <th className="p-3 text-left text-xs font-medium text-gray-600 tracking-wider cursor-pointer" onClick={() => handleTableSort('fqdn')}>
                <div className="flex items-center">
                  FQDN
                  {tableSortField === 'fqdn' && (
                    <ChevronDownIcon className={`w-4 h-4 ml-1 ${tableSortDirection === 'desc' ? 'transform rotate-180' : ''}`} />
                  )}
                </div>
              </th>
              <th className="p-3 text-left text-xs font-medium text-gray-600 tracking-wider cursor-pointer" onClick={() => handleTableSort('port')}>
                <div className="flex items-center">
                  Port
                  {tableSortField === 'port' && (
                    <ChevronDownIcon className={`w-4 h-4 ml-1 ${tableSortDirection === 'desc' ? 'transform rotate-180' : ''}`} />
                  )}
                </div>
              </th>
              <th className="p-3 text-left text-xs font-medium text-gray-600 tracking-wider cursor-pointer" onClick={() => handleTableSort('status')}>
                <div className="flex items-center">
                  Status
                  {tableSortField === 'status' && (
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
            {sortedNodes.map((node) => {
              const nodeServers = servers.filter(server => server.node.id === node.id);
              return (
                <tr 
                  key={node.id} 
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => {
                    setSelectedNode(node);
                    setView('view');
                  }}
                >
                  <td className="p-3 text-xs text-gray-900">
                    <div className="flex items-center">
                      <div className={`h-2 w-2 rounded-full ${node.isOnline ? 'bg-green-400' : 'bg-gray-300'} mr-2`} />
                      <span className="font-medium">{node.name}</span>
                    </div>
                  </td>
                  <td className="p-3 text-xs text-gray-500">{node.fqdn}</td>
                  <td className="p-3 text-xs text-gray-500">{node.port}</td>
                  <td className="p-3 text-xs">
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      node.isOnline 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {node.isOnline ? 'Online' : 'Offline'}
                    </span>
                  </td>
                  <td className="p-3 text-xs text-gray-500">
                    {nodeServers.length} {nodeServers.length === 1 ? 'server' : 'servers'}
                    {node.systemState && (
                      <span className="text-gray-400 ml-1">
                        ({node.systemState.containers.running} running)
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end space-x-2" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setFormData({
                            name: node.name,
                            fqdn: node.fqdn,
                            port: node.port
                          });
                          setSelectedNode(node);
                          setView('edit');
                        }}
                        className="p-1 text-gray-400 hover:text-gray-600"
                      >
                        <PencilIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(node.id);
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
            {nodes.length === 0 && (
              <tr>
                <td colSpan={6} className="p-4 text-center text-gray-500 text-xs">
                  No nodes found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  };

  if (loading && nodes.length === 0) {
    return (
      // centered layout
      <div className="min-h-screen">
        <div className="p-6 flex items-center justify-center h-64">
          <div className="relative">
          <h2 className="text-gray-800 font-medium text-lg mb-1">Fetching Docker information for one or more nodes...</h2>
          <p className="text-gray-500 text-xs">Unfortunately, this is quite a slow process. Give us a moment.</p>
          </div>
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
                  <h1 className="text-lg font-semibold text-gray-900">Nodes</h1>
                  <p className="text-xs text-gray-500 mt-1">
                    Nodes are where your servers run and live. Learn how to set up Argon's Krypton daemon via the <a href="https://docs.argon.io" target="_blank" rel="noreferrer" className="text-indigo-500 hover:underline">documentation</a>.
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
                    Create Node
                  </button>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-md shadow-xs">
                {renderNodeTable()}
              </div>
            </div>
          )}

          {view === 'create' && (
            <div className="space-y-6">
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => {
                    setView('list');
                    setSelectedNode(null);
                  }}
                  className="flex items-center text-gray-600 hover:bg-gray-100 p-2 cursor-pointer rounded-md transition hover:text-gray-900"
                >
                  <ArrowLeftIcon className="w-4 h-4" />
                </button>
                <div>
                  <h1 className="text-lg font-semibold text-gray-900">Create Node</h1>
                </div>
              </div>
              {renderForm('create')}
            </div>
          )}

          {view === 'edit' && renderForm('edit')}

          {view === 'view' && renderNodeView()}
        </div>
      </div>
    </div>
  );
};

export default AdminNodesPage;