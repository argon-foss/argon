import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronRightIcon, TrashIcon, PencilIcon, ArrowLeftIcon, PlusIcon, FolderIcon, FileIcon, LinkIcon } from 'lucide-react';
import { z } from 'zod';
import AdminBar from '../../components/AdminBar';
import LoadingSpinner from '../../components/LoadingSpinner';

// Schemas matching backend validation
const cargoPropertiesSchema = z.object({
  hidden: z.boolean().optional(),
  readonly: z.boolean().optional(),
  noDelete: z.boolean().optional(),
  customProperties: z.record(z.any()).optional()
});

const cargoSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1).max(255),
  description: z.string(),
  hash: z.string().optional(),
  size: z.number().optional(),
  mimeType: z.string().optional(),
  type: z.enum(['local', 'remote']),
  remoteUrl: z.string().url().optional(),
  properties: cargoPropertiesSchema.default({}),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional()
});

const cargoContainerSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1).max(255),
  description: z.string(),
  items: z.array(z.object({
    cargoId: z.string(),
    targetPath: z.string().min(1)
  })).default([]),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional()
});

type Cargo = z.infer<typeof cargoSchema>;
type CargoContainer = z.infer<typeof cargoContainerSchema>;
type View =
  | 'cargo-list'
  | 'cargo-create'
  | 'cargo-view'
  | 'cargo-edit'
  | 'container-list'
  | 'container-create'
  | 'container-view'
  | 'container-edit';

// File size formatter
const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(2)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(2)} MB`;
  const gb = mb / 1024;
  return `${gb.toFixed(2)} GB`;
};

// Properties Form Component
const PropertiesForm: React.FC<{
  properties: Cargo['properties'],
  onChange: (properties: Cargo['properties']) => void
}> = ({ properties, onChange }) => {
  const [customKey, setCustomKey] = useState('');
  const [customValue, setCustomValue] = useState('');

  const handleAddCustomProperty = () => {
    if (!customKey.trim()) return;

    onChange({
      ...properties,
      customProperties: {
        ...(properties.customProperties || {}),
        [customKey]: customValue
      }
    });

    setCustomKey('');
    setCustomValue('');
  };

  const handleRemoveCustomProperty = (key: string) => {
    if (!properties.customProperties) return;

    const newCustomProperties = { ...properties.customProperties };
    delete newCustomProperties[key];

    onChange({
      ...properties,
      customProperties: Object.keys(newCustomProperties).length > 0
        ? newCustomProperties
        : undefined
    });
  };

  return (
    <div className="space-y-4">
      <div className="text-xs font-medium text-gray-700">Properties</div>

      <div className="space-y-2">
        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={properties.hidden || false}
            onChange={(e) => onChange({ ...properties, hidden: e.target.checked })}
            className="rounded border-gray-200 text-gray-900 focus:ring-gray-500"
          />
          <span className="text-xs">Hidden (not visible to users)</span>
        </label>

        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={properties.readonly || false}
            onChange={(e) => onChange({ ...properties, readonly: e.target.checked })}
            className="rounded border-gray-200 text-gray-900 focus:ring-gray-500"
          />
          <span className="text-xs">Read-only (users cannot modify)</span>
        </label>

        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={properties.noDelete || false}
            onChange={(e) => onChange({ ...properties, noDelete: e.target.checked })}
            className="rounded border-gray-200 text-gray-900 focus:ring-gray-500"
          />
          <span className="text-xs">No Delete (users cannot delete)</span>
        </label>
      </div>

      <div className="pt-2">
        <div className="text-xs font-medium text-gray-700 mb-2">Custom Properties</div>

        <div className="space-y-2">
          {properties.customProperties && Object.entries(properties.customProperties).map(([key, value]) => (
            <div key={key} className="flex items-center space-x-2">
              <div className="flex-1 text-xs border border-gray-200 rounded-md p-2">
                <span className="font-medium">{key}:</span> {JSON.stringify(value)}
              </div>
              <button
                type="button"
                onClick={() => handleRemoveCustomProperty(key)}
                className="text-gray-400 hover:text-red-500"
              >
                <TrashIcon className="w-4 h-4" />
              </button>
            </div>
          ))}

          <div className="flex items-center space-x-2">
            <input
              type="text"
              value={customKey}
              onChange={(e) => setCustomKey(e.target.value)}
              className="flex-1 px-3 py-2 text-xs border border-gray-200 rounded-md"
              placeholder="Property name"
            />
            <input
              type="text"
              value={customValue}
              onChange={(e) => setCustomValue(e.target.value)}
              className="flex-1 px-3 py-2 text-xs border border-gray-200 rounded-md"
              placeholder="Property value"
            />
            <button
              type="button"
              onClick={handleAddCustomProperty}
              className="px-2 py-1 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-md hover:bg-gray-50"
            >
              Add
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Container Items Form Component
const ContainerItemsForm: React.FC<{
  items: CargoContainer['items'],
  onChange: (items: CargoContainer['items']) => void
}> = ({ items, onChange }) => {
  const [allCargo, setAllCargo] = useState<Cargo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSelector, setShowSelector] = useState(false);
  const [selectedCargoId, setSelectedCargoId] = useState<string>('');
  const [targetPath, setTargetPath] = useState<string>('');

  useEffect(() => {
    if (showSelector) {
      fetchAllCargo();
    }
  }, [showSelector]);

  const fetchAllCargo = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/cargo', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Failed to fetch cargo');

      const data = await response.json();
      setAllCargo(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = () => {
    if (!selectedCargoId || !targetPath.trim()) return;

    onChange([...items, { cargoId: selectedCargoId, targetPath }]);

    setSelectedCargoId('');
    setTargetPath('');
    setShowSelector(false);
  };

  const handleRemoveItem = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  // Filter out already added cargo
  const availableCargo = allCargo.filter(
    cargo => !items.some(item => item.cargoId === cargo.id)
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium text-gray-700">Container Items</div>
        <button
          type="button"
          onClick={() => setShowSelector(!showSelector)}
          className="px-3 py-2 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-md hover:bg-gray-50 flex items-center"
        >
          <PlusIcon className="w-3.5 h-3.5 mr-1.5" />
          Add Item
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-100 rounded-md p-3">
          <p className="text-xs text-red-600">{error}</p>
        </div>
      )}

      {/* Cargo Selector */}
      {showSelector && (
        <div className="border border-gray-200 rounded-md p-3 space-y-3">
          <h4 className="text-xs font-medium mb-2">Add cargo to container</h4>

          <div className="space-y-2">
            <div className="text-xs text-gray-500">Select Cargo</div>
            {loading ? (
              <div className="text-center py-2">
                <span className="text-xs text-gray-500">Loading...</span>
              </div>
            ) : (
              <select
                value={selectedCargoId}
                onChange={(e) => setSelectedCargoId(e.target.value)}
                className="block w-full px-3 py-2 text-xs border border-gray-200 rounded-md focus:outline-none focus:border-gray-400"
              >
                <option value="">-- Select cargo --</option>
                {availableCargo.map(cargo => (
                  <option key={cargo.id} value={cargo.id}>
                    {cargo.name} ({cargo.type === 'local' ? 'Local File' : 'Remote URL'})
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="space-y-2">
            <div className="text-xs text-gray-500">Target Path</div>
            <input
              type="text"
              value={targetPath}
              onChange={(e) => setTargetPath(e.target.value)}
              className="block w-full px-3 py-2 text-xs border border-gray-200 rounded-md focus:outline-none focus:border-gray-400"
              placeholder="/path/to/file"
            />
          </div>

          <div className="flex justify-end space-x-2">
            <button
              type="button"
              onClick={() => setShowSelector(false)}
              className="px-3 py-2 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAddItem}
              disabled={!selectedCargoId || !targetPath}
              className="px-3 py-2 text-xs font-medium text-white bg-gray-900 rounded-md hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add Item
            </button>
          </div>
        </div>
      )}

      {/* Container Items List */}
      <div>
        {items.length > 0 ? (
          <div className="space-y-2">
            {items.map((item, index) => {
              const cargoItem = allCargo.find(c => c.id === item.cargoId) || { name: 'Loading...', type: 'local' };

              return (
                <div
                  key={index}
                  className="flex justify-between items-center border border-gray-200 rounded-md p-3"
                >
                  <div className="flex items-start space-x-3">
                    <div className="pt-1">
                      {cargoItem.type === 'local' ? (
                        <FileIcon className="w-4 h-4 text-gray-400" />
                      ) : (
                        <LinkIcon className="w-4 h-4 text-gray-400" />
                      )}
                    </div>
                    <div>
                      <div className="text-sm font-medium">{cargoItem.name}</div>
                      <div className="text-xs font-mono mt-1">→ {item.targetPath}</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveItem(index)}
                    className="text-gray-400 hover:text-red-500"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-4 border border-gray-200 border-dashed rounded-md">
            <p className="text-xs text-gray-500">No items in this container</p>
          </div>
        )}
      </div>
    </div>
  );
};

const AdminCargoPage: React.FC = () => {
  const [cargoItems, setCargoItems] = useState<Cargo[]>([]);
  const [containers, setContainers] = useState<CargoContainer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>('cargo-list');
  const [selectedCargo, setSelectedCargo] = useState<Cargo | null>(null);
  const [selectedContainer, setSelectedContainer] = useState<CargoContainer | null>(null);

  // Form data states
  const [cargoFormData, setCargoFormData] = useState<Omit<Cargo, 'id' | 'createdAt' | 'updatedAt'>>({
    name: '',
    description: '',
    type: 'local',
    properties: {},
    hash: '',
    size: 0,
    mimeType: ''
  });

  const [containerFormData, setContainerFormData] = useState<Omit<CargoContainer, 'id' | 'createdAt' | 'updatedAt'>>({
    name: '',
    description: '',
    items: []
  });

  const [fileUpload, setFileUpload] = useState<File | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // State for tab indicator animation
  const [indicatorStyle, setIndicatorStyle] = useState({
    width: 0,
    height: 0,
    top: 0,
    left: 0,
    opacity: 0,
  });

  // Refs for tab buttons
  const tabRefsMap = useRef<Record<string, HTMLButtonElement | null>>({});
  const tabsContainerRef = useRef<HTMLDivElement>(null);

  // Set ref for tab button
  const setTabRef = useCallback((id: string, element: HTMLButtonElement | null) => {
    tabRefsMap.current[id] = element;
  }, []);

  // Update indicator position when view changes
  useEffect(() => {
    const updateIndicator = () => {
      const activeView = view.startsWith('cargo-') ? 'cargo' : 'container';
      const tabElement = tabRefsMap.current[activeView];
      if (!tabElement || !tabsContainerRef.current) return;

      const rect = tabElement.getBoundingClientRect();
      const containerRect = tabsContainerRef.current.getBoundingClientRect();

      const offsetLeft = rect.left - containerRect.left;

      setIndicatorStyle({
        width: rect.width,
        height: rect.height,
        top: 3.5,
        left: offsetLeft,
        opacity: 1,
      });
    };

    const animationFrame = requestAnimationFrame(updateIndicator);
    return () => cancelAnimationFrame(animationFrame);
  }, [view]);

  // Initialize the indicator position after component mounts
  useEffect(() => {
    const timer = setTimeout(() => {
      const activeView = view.startsWith('cargo-') ? 'cargo' : 'container';
      const tabElement = tabRefsMap.current[activeView];
      if (!tabElement || !tabsContainerRef.current) return;

      const rect = tabElement.getBoundingClientRect();
      const containerRect = tabsContainerRef.current.getBoundingClientRect();

      const offsetLeft = rect.left - containerRect.left;

      setIndicatorStyle({
        width: rect.width,
        height: rect.height,
        top: 3.5,
        left: offsetLeft,
        opacity: 1,
      });
    }, 50);

    return () => clearTimeout(timer);
  }, []);

  // TabButton component with ref handling
  const TabButton = useCallback(({
    id,
    isActive,
    onClick,
    children
  }: {
    id: string;
    isActive: boolean;
    onClick: () => void;
    children: React.ReactNode;
  }) => {
    const buttonRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
      if (buttonRef.current) {
        setTabRef(id, buttonRef.current);
      }

      return () => {
        setTabRef(id, null);
      };
    }, [id]);

    return (
      <button
        ref={buttonRef}
        onClick={onClick}
        className={`tab-button relative z-5 cursor-pointer px-3 py-1 text-sm font-medium rounded-md transition-all duration-200 outline-none focus:outline-none focus:ring-0 ${isActive
          ? 'text-gray-800 border-none'
          : 'text-gray-500 border-none hover:text-gray-700 hover:bg-gray-50'
          }`}
      >
        {children}
      </button>
    );
  }, [setTabRef]);

  // Initial data fetch
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchCargo(),
        fetchContainers()
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const fetchCargo = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/cargo', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Failed to fetch cargo');

      const data = await response.json();
      setCargoItems(data);
      return data;
    } catch (err) {
      console.error('Failed to fetch cargo:', err);
      setCargoItems([]);
      throw err;
    }
  };

  const fetchContainers = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/cargo/container', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        if (response.status === 404) {
          // If we get a 404, it might be that there are no containers yet
          setContainers([]);
          return [];
        }
        throw new Error('Failed to fetch containers');
      }

      const data = await response.json();
      setContainers(data);
      return data;
    } catch (err) {
      console.error('Failed to fetch containers:', err);
      setContainers([]);
      throw err;
    }
  };

  // Cargo CRUD operations
  const handleCreateLocalCargo = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    try {
      if (!fileUpload) {
        throw new Error('Please select a file to upload');
      }

      setIsUploading(true);

      const formData = new FormData();
      formData.append('file', fileUpload);
      formData.append('data', JSON.stringify({
        name: cargoFormData.name,
        description: cargoFormData.description,
        properties: cargoFormData.properties
      }));

      const token = localStorage.getItem('token');
      const response = await fetch('/api/cargo/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create cargo');
      }

      await fetchCargo();
      setView('cargo-list');
      resetCargoForm();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create cargo');
    } finally {
      setIsUploading(false);
    }
  };

  const handleCreateRemoteCargo = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    try {
      if (!cargoFormData.remoteUrl) {
        throw new Error('Remote URL is required');
      }

      const token = localStorage.getItem('token');
      const response = await fetch('/api/cargo/remote', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: cargoFormData.name,
          description: cargoFormData.description,
          remoteUrl: cargoFormData.remoteUrl,
          properties: cargoFormData.properties
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create remote cargo');
      }

      await fetchCargo();
      setView('cargo-list');
      resetCargoForm();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create remote cargo');
    }
  };

  const handleUpdateCargo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCargo) return;
    setFormError(null);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/cargo/${selectedCargo.id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: cargoFormData.name,
          description: cargoFormData.description,
          properties: cargoFormData.properties
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update cargo');
      }

      await fetchCargo();
      setView('cargo-view');
      // Update the selected cargo with new values
      setSelectedCargo({
        ...selectedCargo,
        name: cargoFormData.name,
        description: cargoFormData.description,
        properties: cargoFormData.properties
      });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to update cargo');
    }
  };

  const handleDeleteCargo = async (cargoId: string) => {
    try {
      // Check if cargo is used in any containers
      const usedInContainers = containers.filter(container =>
        container.items.some(item => item.cargoId === cargoId)
      );

      if (usedInContainers.length > 0) {
        const containerNames = usedInContainers.map(c => c.name).join(', ');
        throw new Error(`Cargo is used in containers: ${containerNames}`);
      }

      const token = localStorage.getItem('token');
      const response = await fetch(`/api/cargo/${cargoId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete cargo');
      }

      await fetchCargo();
      if (selectedCargo?.id === cargoId) {
        setView('cargo-list');
        setSelectedCargo(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete cargo');
    }
  };

  // Container CRUD operations
  const handleCreateContainer = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/cargo/container', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(containerFormData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create container');
      }

      await fetchContainers();
      setView('container-list');
      resetContainerForm();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create container');
    }
  };

  const handleUpdateContainer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedContainer) return;
    setFormError(null);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/cargo/container/${selectedContainer.id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(containerFormData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update container');
      }

      await fetchContainers();
      setView('container-view');
      // Update the selected container with new values
      setSelectedContainer({
        ...selectedContainer,
        name: containerFormData.name,
        description: containerFormData.description,
        items: containerFormData.items
      });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to update container');
    }
  };

  const handleDeleteContainer = async (containerId: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/cargo/container/${containerId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete container');
      }

      await fetchContainers();
      if (selectedContainer?.id === containerId) {
        setView('container-list');
        setSelectedContainer(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete container');
    }
  };

  // Form reset functions
  const resetCargoForm = () => {
    setCargoFormData({
      name: '',
      description: '',
      type: 'local',
      properties: {},
      hash: '',
      size: 0,
      mimeType: ''
    });
    setFileUpload(null);
    setSelectedCargo(null);
  };

  const resetContainerForm = () => {
    setContainerFormData({
      name: '',
      description: '',
      items: []
    });
    setSelectedContainer(null);
  };

  // Render functions for cargo
  const renderCargoForm = (type: 'create' | 'edit') => (
    <form
      onSubmit={
        type === 'create'
          ? (cargoFormData.type === 'local' ? handleCreateLocalCargo : handleCreateRemoteCargo)
          : handleUpdateCargo
      }
      className="space-y-4 max-w-lg"
    >
      {formError && (
        <div className="bg-red-50 border border-red-100 rounded-md p-3">
          <p className="text-xs text-red-600">{formError}</p>
        </div>
      )}

      {/* Basic Cargo Information */}
      <div className="space-y-1">
        <label className="block text-xs font-medium text-gray-700">Name</label>
        <input
          type="text"
          value={cargoFormData.name}
          onChange={(e) => setCargoFormData({ ...cargoFormData, name: e.target.value })}
          className="block w-full px-3 py-2 text-xs border border-gray-200 rounded-md focus:outline-none focus:border-gray-400"
          placeholder="My Cargo Item"
          required
        />
      </div>

      <div className="space-y-1">
        <label className="block text-xs font-medium text-gray-700">Description</label>
        <textarea
          value={cargoFormData.description}
          onChange={(e) => setCargoFormData({ ...cargoFormData, description: e.target.value })}
          className="block w-full px-3 py-2 text-xs border border-gray-200 rounded-md focus:outline-none focus:border-gray-400"
          placeholder="Description of this cargo item..."
          rows={3}
          required
        />
      </div>

      {/* Cargo Type and Upload/URL */}
      {type === 'create' && (
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-700">Cargo Type</label>
            <div className="flex space-x-4">
              <label className="flex items-center space-x-2">
                <input
                  type="radio"
                  checked={cargoFormData.type === 'local'}
                  onChange={() => setCargoFormData({ ...cargoFormData, type: 'local', remoteUrl: undefined })}
                  name="cargoType"
                />
                <span className="text-xs">Local File</span>
              </label>
              <label className="flex items-center space-x-2">
                <input
                  type="radio"
                  checked={cargoFormData.type === 'remote'}
                  onChange={() => setCargoFormData({ ...cargoFormData, type: 'remote' })}
                  name="cargoType"
                />
                <span className="text-xs">Remote URL</span>
              </label>
            </div>
          </div>

          {cargoFormData.type === 'local' ? (
            <div className="space-y-1">
              <label className="block text-xs font-medium text-gray-700">Upload File</label>
              <input
                type="file"
                onChange={(e) => setFileUpload(e.target.files ? e.target.files[0] : null)}
                className="block w-full px-3 py-2 text-xs border border-gray-200 rounded-md"
                required
              />
              {fileUpload && (
                <div className="text-xs text-gray-500 mt-1">
                  Selected: {fileUpload.name} ({formatFileSize(fileUpload.size)})
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-1">
              <label className="block text-xs font-medium text-gray-700">Remote URL</label>
              <input
                type="url"
                value={cargoFormData.remoteUrl || ''}
                onChange={(e) => setCargoFormData({ ...cargoFormData, remoteUrl: e.target.value })}
                className="block w-full px-3 py-2 text-xs border border-gray-200 rounded-md"
                placeholder="https://example.com/file.zip"
                required={cargoFormData.type === 'remote'}
              />
            </div>
          )}
        </div>
      )}

      {/* Properties */}
      <PropertiesForm
        properties={cargoFormData.properties}
        onChange={(properties) => setCargoFormData({ ...cargoFormData, properties })}
      />

      {/* Action Buttons */}
      <div className="flex items-center space-x-3">
        <button
          type="submit"
          disabled={isUploading}
          className="px-3 py-2 text-xs font-medium text-white bg-gray-900 rounded-md hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isUploading ? 'Uploading...' : (type === 'create' ? 'Create Cargo' : 'Update Cargo')}
        </button>
        <button
          type="button"
          onClick={() => {
            setView(type === 'edit' ? 'cargo-view' : 'cargo-list');
            resetCargoForm();
          }}
          className="px-3 py-2 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-md hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );

  const renderCargoDetails = () => {
    if (!selectedCargo) return null;

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => {
                setView('cargo-list');
                setSelectedCargo(null);
                resetCargoForm();
              }
              }
              className="flex items-center text-gray-600 hover:bg-gray-100 p-2 cursor-pointer rounded-md transition hover:text-gray-900"
            >
              <ArrowLeftIcon className="w-4 h-4" />
            </button>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{selectedCargo.name}</h2>
              <p className="text-xs text-gray-500">
                {selectedCargo.type === 'local' ? 'Local File' : 'Remote URL'}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => {
                setCargoFormData({
                  name: selectedCargo.name,
                  description: selectedCargo.description,
                  type: selectedCargo.type,
                  remoteUrl: selectedCargo.remoteUrl,
                  properties: selectedCargo.properties,
                  hash: selectedCargo.hash,
                  size: selectedCargo.size,
                  mimeType: selectedCargo.mimeType
                });
                setView('cargo-edit');
              }}
              className="flex items-center px-3 py-2 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-md hover:bg-gray-50"
            >
              <PencilIcon className="w-3.5 h-3.5 mr-1.5" />
              Edit
            </button>
            <button
              onClick={() => handleDeleteCargo(selectedCargo.id!)}
              className="flex items-center px-3 py-2 text-xs font-medium text-red-600 bg-white border border-gray-200 rounded-md hover:bg-red-50"
            >
              <TrashIcon className="w-3.5 h-3.5 mr-1.5" />
              Delete
            </button>
            {selectedCargo.type === 'local' && (
              <a
                href={`/api/cargo/${selectedCargo.id}/download`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-2 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-md hover:bg-gray-50"
              >
                Download
              </a>
            )}
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-md shadow-xs p-6 space-y-4">
          <div>
            <div className="text-xs text-gray-500">Description</div>
            <div className="text-sm mt-1">{selectedCargo.description}</div>
          </div>

          <div className="pt-4 border-t border-gray-100">
            <div className="text-xs font-medium text-gray-900 mb-3">Cargo Details</div>
            <div className="space-y-2">
              {selectedCargo.type === 'remote' ? (
                <div>
                  <div className="text-xs text-gray-500">Remote URL</div>
                  <div className="text-sm font-mono mt-1 break-all">
                    <a
                      href={selectedCargo.remoteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      {selectedCargo.remoteUrl}
                    </a>
                  </div>
                </div>
              ) : (
                <>
                  <div>
                    <div className="text-xs text-gray-500">File Type</div>
                    <div className="text-sm mt-1">{selectedCargo.mimeType}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Size</div>
                    <div className="text-sm mt-1">{formatFileSize(selectedCargo.size || 0)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Hash</div>
                    <div className="text-sm font-mono mt-1 text-xs break-all">{selectedCargo.hash}</div>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-gray-100">
            <div className="text-xs font-medium text-gray-900 mb-3">Properties</div>
            <div className="space-y-2">
              <div className="flex space-x-4">
                <div className="text-xs">
                  <span className="font-medium">Hidden:</span> {selectedCargo.properties?.hidden ? 'Yes' : 'No'}
                </div>
                <div className="text-xs">
                  <span className="font-medium">Read-only:</span> {selectedCargo.properties?.readonly ? 'Yes' : 'No'}
                </div>
                <div className="text-xs">
                  <span className="font-medium">No Delete:</span> {selectedCargo.properties?.noDelete ? 'Yes' : 'No'}
                </div>
              </div>

              {selectedCargo.properties?.customProperties &&
                Object.keys(selectedCargo.properties.customProperties).length > 0 && (
                  <div>
                    <div className="text-xs text-gray-500 mt-2">Custom Properties</div>
                    <div className="space-y-1 mt-1">
                      {Object.entries(selectedCargo.properties.customProperties).map(([key, value]) => (
                        <div key={key} className="text-xs">
                          <span className="font-medium">{key}:</span> {JSON.stringify(value)}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
            </div>
          </div>

          {/* Usage Information */}
          <div className="pt-4 border-t border-gray-100">
            <div className="text-xs font-medium text-gray-900 mb-3">Used In Containers</div>
            <div>
              {containers.filter(container =>
                container.items.some(item => item.cargoId === selectedCargo.id)
              ).length > 0 ? (
                <div className="space-y-2">
                  {containers.filter(container =>
                    container.items.some(item => item.cargoId === selectedCargo.id)
                  ).map(container => (
                    <div
                      key={container.id}
                      className="flex justify-between items-center border border-gray-100 rounded p-2 hover:bg-gray-50 cursor-pointer"
                      onClick={() => {
                        setSelectedContainer(container);
                        setView('container-view');
                      }}
                    >
                      <div className="flex items-center space-x-2">
                        <FolderIcon className="w-4 h-4 text-gray-400" />
                        <div>
                          <div className="text-sm font-medium">{container.name}</div>
                          <div className="text-xs text-gray-500">
                            {container.items.find(item => item.cargoId === selectedCargo.id)?.targetPath}
                          </div>
                        </div>
                      </div>
                      <ChevronRightIcon className="w-4 h-4 text-gray-400" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-gray-500">Not used in any containers</div>
              )}
            </div>
          </div>

          {selectedCargo.createdAt && selectedCargo.updatedAt && (
            <div className="pt-4 border-t border-gray-100 grid grid-cols-2">
              <div>
                <div className="text-xs text-gray-500">Created At</div>
                <div className="text-sm mt-1">
                  {new Date(selectedCargo.createdAt).toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Updated At</div>
                <div className="text-sm mt-1">
                  {new Date(selectedCargo.updatedAt).toLocaleString()}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Render functions for containers
  const renderContainerForm = (type: 'create' | 'edit') => (
    <form onSubmit={type === 'create' ? handleCreateContainer : handleUpdateContainer} className="space-y-4 max-w-lg">
      {formError && (
        <div className="bg-red-50 border border-red-100 rounded-md p-3">
          <p className="text-xs text-red-600">{formError}</p>
        </div>
      )}

      {/* Basic Container Information */}
      <div className="space-y-1">
        <label className="block text-xs font-medium text-gray-700">Name</label>
        <input
          type="text"
          value={containerFormData.name}
          onChange={(e) => setContainerFormData({ ...containerFormData, name: e.target.value })}
          className="block w-full px-3 py-2 text-xs border border-gray-200 rounded-md"
          placeholder="My Container"
          required
        />
      </div>

      <div className="space-y-1">
        <label className="block text-xs font-medium text-gray-700">Description</label>
        <textarea
          value={containerFormData.description}
          onChange={(e) => setContainerFormData({ ...containerFormData, description: e.target.value })}
          className="block w-full px-3 py-2 text-xs border border-gray-200 rounded-md"
          placeholder="Description of this container..."
          rows={3}
          required
        />
      </div>

      {/* Container Items */}
      <ContainerItemsForm
        items={containerFormData.items}
        onChange={(items) => setContainerFormData({ ...containerFormData, items })}
      />

      {/* Action Buttons */}
      <div className="flex items-center space-x-3">
        <button
          type="submit"
          className="px-3 py-2 text-xs font-medium text-white bg-gray-900 rounded-md hover:bg-gray-800"
        >
          {type === 'create' ? 'Create Container' : 'Update Container'}
        </button>
        <button
          type="button"
          onClick={() => {
            setView(type === 'edit' ? 'container-view' : 'container-list');
            resetContainerForm();
          }}
          className="px-3 py-2 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-md hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );

  const renderContainerDetails = () => {
    if (!selectedContainer) return null;

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => {
                setView('container-list');
                setSelectedContainer(null);
              }}
              className="flex items-center text-gray-600 hover:bg-gray-100 p-2 cursor-pointer rounded-md transition hover:text-gray-900"
            >
              <ArrowLeftIcon className="w-4 h-4" />
            </button>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{selectedContainer.name}</h2>
              <p className="text-xs text-gray-500">
                {selectedContainer.items.length} item{selectedContainer.items.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => {
                setContainerFormData({
                  name: selectedContainer.name,
                  description: selectedContainer.description,
                  items: selectedContainer.items
                });
                setView('container-edit');
              }}
              className="flex items-center px-3 py-2 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-md hover:bg-gray-50"
            >
              <PencilIcon className="w-3.5 h-3.5 mr-1.5" />
              Edit
            </button>
            <button
              onClick={() => handleDeleteContainer(selectedContainer.id!)}
              className="flex items-center px-3 py-2 text-xs font-medium text-red-600 bg-white border border-gray-200 rounded-md hover:bg-red-50"
            >
              <TrashIcon className="w-3.5 h-3.5 mr-1.5" />
              Delete
            </button>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-md shadow-xs p-6 space-y-4">
          <div>
            <div className="text-xs text-gray-500">Description</div>
            <div className="text-sm mt-1">{selectedContainer.description}</div>
          </div>

          <div className="pt-4 border-t border-gray-100">
            <div className="text-xs font-medium text-gray-900 mb-3">Container Items</div>
            {selectedContainer.items.length > 0 ? (
              <div className="space-y-3">
                {selectedContainer.items.map((item, index) => {
                  const cargoItem = cargoItems.find(c => c.id === item.cargoId);

                  return (
                    <div
                      key={index}
                      className="border border-gray-100 rounded p-3 hover:bg-gray-50 cursor-pointer"
                      onClick={() => {
                        if (cargoItem) {
                          setSelectedCargo(cargoItem);
                          setView('cargo-view');
                        }
                      }}
                    >
                      <div className="flex items-start space-x-3">
                        <div className="pt-1">
                          {cargoItem?.type === 'local' ? (
                            <FileIcon className="w-4 h-4 text-gray-400" />
                          ) : (
                            <LinkIcon className="w-4 h-4 text-gray-400" />
                          )}
                        </div>
                        <div>
                          <div className="text-sm font-medium">{cargoItem?.name || 'Unknown Cargo'}</div>
                          <div className="text-xs font-mono mt-1">→ {item.targetPath}</div>
                          {cargoItem && (
                            <div className="text-xs text-gray-500 mt-1">
                              {cargoItem.type === 'local'
                                ? `${formatFileSize(cargoItem.size || 0)} • ${cargoItem.mimeType}`
                                : 'Remote URL'}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-xs text-gray-500">No items in this container</div>
            )}
          </div>

          {selectedContainer.createdAt && selectedContainer.updatedAt && (
            <div className="pt-4 border-t border-gray-100 grid grid-cols-2">
              <div>
                <div className="text-xs text-gray-500">Created At</div>
                <div className="text-sm mt-1">
                  {new Date(selectedContainer.createdAt).toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Updated At</div>
                <div className="text-sm mt-1">
                  {new Date(selectedContainer.updatedAt).toLocaleString()}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Main render
  if (loading) return <LoadingSpinner />;

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminBar />
      <div className="p-6">
        {/* Page Title and Create Button */}
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-900">
            {view.includes('cargo') ? 'Cargo Management' : 'Container Management'}
          </h1>
          <div className="flex items-center space-x-3">
            {view.includes('cargo') ? (
              <button
                onClick={() => {
                  resetCargoForm();
                  setView('cargo-create');
                }}
                className="px-3 py-2 text-xs font-medium text-white bg-gray-900 rounded-md hover:bg-gray-800"
              >
                Create Cargo
              </button>
            ) : (
              <button
                onClick={() => {
                  resetContainerForm();
                  setView('container-create');
                }}
                className="px-3 py-2 text-xs font-medium text-white bg-gray-900 rounded-md hover:bg-gray-800"
              >
                Create Container
              </button>
            )}
          </div>
        </div>

        {/* Navigation tabs with smooth animation */}
        <div className="mb-6">
          <div
            ref={tabsContainerRef}
            className="inline-flex p-1 space-x-1 bg-gray-100 rounded-lg relative"
          >
            {/* Animated indicator */}
            <div
              className="absolute transform transition-all duration-200 ease-spring bg-white rounded-md shadow-xs border border-gray-200/50 z-0"
              style={{
                width: `${indicatorStyle.width}px`,
                height: `${indicatorStyle.height}px`,
                top: `${indicatorStyle.top}px`,
                left: `${indicatorStyle.left}px`,
                opacity: indicatorStyle.opacity,
                transitionDelay: '30ms',
              }}
            />

            {/* Tab buttons */}
            <TabButton
              id="cargo"
              isActive={view.startsWith('cargo-')}
              onClick={() => {
                setView('cargo-list');
                setSelectedCargo(null);
                setSelectedContainer(null);
              }}
            >
              All cargo <span className='text-gray-500 ml-0.5'>{cargoItems.length}</span>
            </TabButton>

            <TabButton
              id="container"
              isActive={view.startsWith('container-')}
              onClick={() => {
                setView('container-list');
                setSelectedCargo(null);
                setSelectedContainer(null);
              }}
            >
              Containers <span className='text-gray-500 ml-0.5'>{containers.length}</span>
            </TabButton>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-100 rounded-md p-4 mb-6">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Cargo Views */}
        {view === 'cargo-list' && (
          <div className="space-y-6">
            <div className="space-y-2">
              {cargoItems.length > 0 ? (
                cargoItems.map((cargo) => (
                  <div
                    key={cargo.id}
                    className="bg-white border border-gray-200 rounded-md shadow-xs cursor-pointer hover:border-gray-300"
                    onClick={() => {
                      setSelectedCargo(cargo);
                      setView('cargo-view');
                    }}
                  >
                    <div className="px-6 h-20 flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        {cargo.type === 'local' ? (
                          <FileIcon className="w-5 h-5 text-gray-400" />
                        ) : (
                          <LinkIcon className="w-5 h-5 text-gray-400" />
                        )}
                        <div className="flex-1">
                          <div className="text-sm font-medium text-gray-900">{cargo.name}</div>
                          <div className="text-xs text-gray-500 mt-1">
                            {cargo.type === 'local'
                              ? `${formatFileSize(cargo.size || 0)} • ${cargo.mimeType}`
                              : cargo.remoteUrl}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center">
                        <ChevronRightIcon className="w-4 h-4 text-gray-400" />
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 bg-white rounded-md border border-gray-200">
                  <div className="flex flex-col items-center justify-center">
                    <FileIcon className="w-6 h-6 text-gray-400 mb-2" />
                    <p className="text-sm text-gray-500">No cargo items found</p>
                    <button
                      onClick={() => {
                        resetCargoForm();
                        setView('cargo-create');
                      }}
                      className="mt-2 px-3 py-1 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-md hover:bg-gray-50"
                    >
                      Create Cargo
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {view === 'cargo-create' && renderCargoForm('create')}
        {view === 'cargo-edit' && renderCargoForm('edit')}
        {view === 'cargo-view' && renderCargoDetails()}

        {/* Container Views */}
        {view === 'container-list' && (
          <div className="space-y-6">
            <div className="space-y-2">
              {containers.length > 0 ? (
                containers.map((container) => (
                  <div
                    key={container.id}
                    className="bg-white border border-gray-200 rounded-md shadow-xs cursor-pointer hover:border-gray-300"
                    onClick={() => {
                      setSelectedContainer(container);
                      setView('container-view');
                    }}
                  >
                    <div className="px-6 h-20 flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <FolderIcon className="w-5 h-5 text-gray-400" />
                        <div className="flex-1">
                          <div className="text-sm font-medium text-gray-900">{container.name}</div>
                          <div className="text-xs text-gray-500 mt-1">
                            {container.items.length} item{container.items.length !== 1 ? 's' : ''}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center">
                        <ChevronRightIcon className="w-4 h-4 text-gray-400" />
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 bg-white rounded-md border border-gray-200">
                  <div className="flex flex-col items-center justify-center">
                    <FolderIcon className="w-6 h-6 text-gray-400 mb-2" />
                    <p className="text-sm text-gray-500">No containers found</p>
                    <button
                      onClick={() => {
                        resetContainerForm();
                        setView('container-create');
                      }}
                      className="mt-2 px-3 py-1 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-md hover:bg-gray-50"
                    >
                      Create Container
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {view === 'container-create' && renderContainerForm('create')}
        {view === 'container-edit' && renderContainerForm('edit')}
        {view === 'container-view' && renderContainerDetails()}
      </div>
    </div>
  );
};

export default AdminCargoPage;
