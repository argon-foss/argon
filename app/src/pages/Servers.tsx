import { Link } from 'react-router-dom';
import { ChevronRightIcon, FolderIcon, XIcon, AlertTriangleIcon, CheckIcon } from 'lucide-react';
import { CubeTransparentIcon } from '@heroicons/react/24/solid';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import { useState, useEffect, useRef, useCallback } from 'react';
import LoadingSpinner from '../components/LoadingSpinner';
import { useProjects } from '../contexts/ProjectContext';

interface Node {
  id: string;
  fqdn: string;
  port: number;
  isOnline: boolean;
}

interface ServerStatus {
  state: string;
  status: any;
}

interface Server {
  id: string;
  name: string;
  internalId: string;
  state: string;
  cpuPercent: number;
  memoryMiB: number;
  projectId: string;
  node: Node;
  status: ServerStatus;
  userId: string;
}

// Modal component 
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: string;
}

const Modal: React.FC<ModalProps> = ({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  maxWidth = 'max-w-md' 
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && event.target instanceof Node && !modalRef.current.contains(event.target)) {
        onClose();
      }
    };
    
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'auto';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-100 bg-opacity-50 z-50 flex items-center justify-center p-4 transition-opacity duration-200 ease-in-out animate-fade-in">
      <div 
        ref={modalRef}
        className={`bg-white rounded-lg shadow-xs w-full ${maxWidth} transform transition-all duration-200 ease-in-out animate-scale-in`}
      >
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">{title}</h3>
          <button 
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors duration-150"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>
        <div className="px-6 py-4">
          {children}
        </div>
      </div>
    </div>
  );
};

// Alert component for form errors/warnings
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
    <div className={`${bgColor} border ${borderColor} rounded-md flex items-start justify-between mb-4`}>
      <div className="flex items-start p-3">
        {type === 'error' || type === 'warning' ? (
          <AlertTriangleIcon className={`w-4 h-4 ${textColor} mr-2 mt-0.5`} />
        ) : (
          <CheckIcon className={`w-4 h-4 ${textColor} mr-2 mt-0.5`} />
        )}
        <p className={`text-xs ${textColor}`}>{message}</p>
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className={`p-2 ${textColor} hover:bg-opacity-10 cursor-pointer rounded-full`}
        >
          <XIcon className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

// Server Move Project Dialog
interface ServerMoveDialogProps {
  isOpen: boolean;
  onClose: () => void;
  server: Server | null;
  onMove: (projectId: string) => Promise<void>;
  projects: any[];
  currentProjectId: string | null;
  isSubmitting: boolean;
  error: string | null;
}

const ServerMoveDialog: React.FC<ServerMoveDialogProps> = ({
  isOpen,
  onClose,
  server,
  onMove,
  projects,
  currentProjectId,
  isSubmitting,
  error
}) => {
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");

  useEffect(() => {
    if (isOpen && projects.length > 0) {
      // Default to the first project that's not the current one
      const otherProject = projects.find(p => p.id !== currentProjectId);
      if (otherProject) {
        setSelectedProjectId(otherProject.id);
      } else if (projects.length > 0) {
        setSelectedProjectId(projects[0].id);
      }
    }
  }, [isOpen, projects, currentProjectId]);

  if (!isOpen || !server) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Move Server to Project">
      {error && (
        <Alert
          type="error"
          message={error}
        />
      )}
      
      <div className="mb-6">
        <p className="text-sm text-gray-600 mb-4">
          Move <span className="font-medium">{server.name}</span> to another project
        </p>
        
        <div className="mb-6">
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Select Project
          </label>
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400"
          >
            {projects.map(project => (
              <option 
                key={project.id} 
                value={project.id}
                disabled={project.id === server.projectId}
              >
                {project.name} {project.id === server.projectId ? '(Current)' : ''}
              </option>
            ))}
          </select>
        </div>
      </div>
      
      <div className="flex justify-end space-x-3">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-md hover:bg-gray-50 transition-colors duration-150"
          disabled={isSubmitting}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => onMove(selectedProjectId)}
          disabled={isSubmitting || selectedProjectId === server.projectId}
          className="px-4 py-2 text-xs font-medium text-white bg-gray-900 border border-transparent rounded-md hover:bg-gray-800 focus:outline-none transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Moving...' : 'Move Server'}
        </button>
      </div>
    </Modal>
  );
};

export default function Home() {
  const { currentProject, projects, moveServerToProject } = useProjects();
  const [servers, setServers] = useState<Server[]>([]);
  const [filteredServers, setFilteredServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('servers');
  const [isMovingServer, setIsMovingServer] = useState(false);
  const [selectedServer, setSelectedServer] = useState<Server | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
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
  
  // Update indicator position when active tab changes
  useEffect(() => {
    const updateIndicator = () => {
      const tabElement = tabRefsMap.current[activeTab];
      if (!tabElement || !tabsContainerRef.current) return;
      
      const rect = tabElement.getBoundingClientRect();
      const containerRect = tabsContainerRef.current.getBoundingClientRect();
      
      const offsetLeft = rect.left - containerRect.left;
      
      setIndicatorStyle({
        width: rect.width,
        height: rect.height,
        top: 3.5, // Further adjusted for perfect alignment
        left: offsetLeft,
        opacity: 1,
      });
    };
    
    // Use requestAnimationFrame for smooth animation
    const animationFrame = requestAnimationFrame(updateIndicator);
    return () => cancelAnimationFrame(animationFrame);
  }, [activeTab]);
  
  // Initialize the indicator position after component mounts
  useEffect(() => {
    // Set a small delay to ensure DOM is fully rendered
    const timer = setTimeout(() => {
      const tabElement = tabRefsMap.current[activeTab];
      if (!tabElement || !tabsContainerRef.current) return;
      
      const rect = tabElement.getBoundingClientRect();
      const containerRect = tabsContainerRef.current.getBoundingClientRect();
      
      const offsetLeft = rect.left - containerRect.left;
      
      setIndicatorStyle({
        width: rect.width,
        height: rect.height,
        top: 3.5, // Further adjusted for perfect alignment
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
        className={`tab-button relative z-10 px-3 py-1 text-sm font-medium rounded-md transition-all duration-200 outline-none focus:outline-none focus:ring-0 ${
          isActive
            ? 'text-gray-800 border-none'
            : 'text-gray-500 border-none hover:text-gray-700 hover:bg-gray-50'
        }`}
      >
        {children}
      </button>
    );
  }, [setTabRef]);
  
  useEffect(() => {
    fetchServers();
  }, []);

  // Filter servers by current project
  useEffect(() => {
    if (currentProject && servers.length > 0) {
      const filtered = servers.filter(server => server.projectId === currentProject.id);
      setFilteredServers(filtered);
    } else {
      setFilteredServers(servers);
    }
  }, [currentProject, servers]);

  const stats = {
    total: filteredServers.length,
    online: filteredServers.filter(s => s.status?.status?.state === 'running').length,
    offline: filteredServers.filter(s => s.status?.status?.state !== 'running').length
  };

  const handleMoveServer = async (projectId: string) => {
    if (!selectedServer) return;
    
    try {
      setMoveError(null);
      setIsSubmitting(true);
      await moveServerToProject(selectedServer.id, projectId);
      
      // Update the local server list
      setServers(prevServers => 
        prevServers.map(server => 
          server.id === selectedServer.id 
            ? { ...server, projectId } 
            : server
        )
      );
      
      setIsMovingServer(false);
      setSelectedServer(null);
      setSuccessMessage(`Server moved to project successfully`);
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccessMessage(null);
      }, 3000);
    } catch (error) {
      console.error("Failed to move server:", error);
      setMoveError(error instanceof Error ? error.message : 'Failed to move server');
    } finally {
      setIsSubmitting(false);
    }
  };

  const fetchServers = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch('/api/servers', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch servers');
      }
      
      const data = await response.json();
      setServers(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-red-600 text-sm">Failed to load servers: {error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="w-full mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-800">Servers</h1>
            {currentProject && (
              <p className="text-sm text-gray-500">
                {currentProject.isDefault ? 
                  `Showing all servers in the Default project` : 
                  `Showing servers in ${currentProject.name} project`}
              </p>
            )}
          </div>
          <button
            onClick={fetchServers}
            className="flex items-center px-4 py-2 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-md hover:bg-gray-50 transition-colors duration-150"
          >
            <ArrowPathIcon className="h-4 w-4 mr-2" />
            Refresh
          </button>
        </div>

        {/* Success Message */}
        {successMessage && (
          <Alert 
            type="success"
            message={successMessage}
            onDismiss={() => setSuccessMessage(null)}
          />
        )}

        {/* Tabs with smooth animation */}
        <div className="mb-4">
          <div 
            ref={tabsContainerRef} 
            className="inline-flex p-1 space-x-1 bg-gray-100 rounded-lg relative"
          >
            {/* Animated indicator */}
            <div 
              className="absolute transform transition-all duration-200 ease-spring bg-white rounded-md shadow-xs border border-gray-200/50 z-0"
              style={{
                width: `${indicatorStyle.width}px`,
                height: `${indicatorStyle.height}px`, // Further reduced height for perfect vertical centering
                top: `${indicatorStyle.top}px`,
                left: `${indicatorStyle.left}px`,
                opacity: indicatorStyle.opacity,
                transitionDelay: '30ms',
              }}
            />
            
            {/* Tab buttons */}
            <TabButton
              id="servers"
              isActive={activeTab === 'servers'}
              onClick={() => setActiveTab('servers')}
            >
              All servers <span className='text-gray-500 ml-0.5'>{stats.total}</span>
            </TabButton>
            
            <TabButton
              id="overview"
              isActive={activeTab === 'overview'}
              onClick={() => setActiveTab('overview')}
            >
              Overview
            </TabButton>
          </div>
        </div>

        {/* Content based on active tab */}
        {activeTab === 'servers' && (
          <div>
            {filteredServers.length > 0 ? (
              <div className="space-y-1.5">
                {filteredServers.map((server) => (
                  <div
                    key={server.id}
                    className="block bg-white rounded-md border border-gray-200 shadow-xs overflow-hidden"
                  >
                    <div className="flex items-center justify-between">
                      <Link
                        to={`/servers/${server.id}/console`}
                        className="px-3 py-3 flex-grow flex items-center justify-between hover:bg-gray-50 transition-colors duration-150"
                      >
                        <div className="flex items-center space-x-3">
                          <div className="flex-shrink-0">
                            <div className={`h-1.5 w-1.5 rounded-full ${
                              server.status?.status?.state === 'running' 
                                ? 'bg-green-400' 
                                : 'bg-gray-300'
                            }`}></div>
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-medium text-gray-900 truncate">
                              {server.name}
                            </div>
                            <div className="text-[11px] text-gray-500">
                              {/* @ts-ignore */}
                              {server.status?.id}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center space-x-6">
                          <div className="flex space-x-3">
                            <div className="text-[11px] text-gray-500">
                              <span className="font-medium text-gray-900">{server.cpuPercent}%</span> CPU limit
                            </div>
                            <div className="text-[11px] text-gray-500">
                              <span className="font-medium text-gray-900">{(server.memoryMiB / 1024).toFixed(2)} GiB</span> Memory limit
                            </div>
                          </div>
                          <ChevronRightIcon className="h-3.5 w-3.5 text-gray-400" />
                        </div>
                      </Link>
                      
                      {/* Project menu button - only show if not in default project or if there are multiple projects */}
                      {(projects.length > 1) && (
                        <button
                          onClick={() => {
                            setSelectedServer(server);
                            setMoveError(null);
                            setIsMovingServer(true);
                          }}
                          className="h-full px-3 border-l border-gray-200 text-gray-400 cursor-pointer hover:text-gray-600 transition-colors duration-150"
                          title="Move to different project"
                        >
                          <FolderIcon className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-24 bg-white rounded-lg border border-gray-200">
                <div className="w-16 h-16 bg-gray-100 rounded-xl mb-6">
                  <CubeTransparentIcon className="w-8 h-8 text-gray-400 mx-auto mt-4.25" />
                </div>
                <h2 className="text-xl font-semibold text-gray-800 mb-2">
                  {currentProject?.isDefault
                    ? "No servers found" 
                    : `No servers in ${currentProject?.name}`}
                </h2>
                <p className="text-gray-500 text-center max-w-md mb-6">
                  {currentProject?.isDefault
                    ? "You don't have any active servers yet. To create a new server, please contact your administrator."
                    : "There are no servers in this project yet. You can move servers here from other projects."}
                </p>
                <button 
                  onClick={fetchServers}
                  className="flex items-center justify-center border border-gray-300/50 rounded-lg px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 transition duration-150"
                >
                  <ArrowPathIcon className="h-4 w-4 mr-2" />
                  Refresh server list
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'overview' && (
          <div className="bg-white rounded-md border border-gray-200 p-6">
            <h2 className="text-lg font-medium text-gray-800 mb-4">
              {currentProject ? `${currentProject.name} Project Overview` : "Server Overview"}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="border border-gray-200 rounded-md p-4">
                <div className="text-gray-500 text-sm mb-1">Total Servers</div>
                <div className="text-2xl font-medium">{stats.total}</div>
              </div>
              <div className="border border-gray-200 rounded-md p-4">
                <div className="text-gray-500 text-sm mb-1">Online</div>
                <div className="flex items-center">
                  <div className="h-2 w-2 rounded-full bg-green-400 mr-2"></div>
                  <div className="text-2xl font-medium">{stats.online}</div>
                </div>
              </div>
              <div className="border border-gray-200 rounded-md p-4">
                <div className="text-gray-500 text-sm mb-1">Offline</div>
                <div className="flex items-center">
                  <div className="h-2 w-2 rounded-full bg-gray-300 mr-2"></div>
                  <div className="text-2xl font-medium">{stats.offline}</div>
                </div>
              </div>
            </div>
            
            {currentProject && currentProject.description && (
              <div className="mt-6 p-4 bg-gray-50 rounded-md border border-gray-200">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Project Description</h3>
                <p className="text-sm text-gray-600">{currentProject.description}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Move Server Dialog */}
      <ServerMoveDialog
        isOpen={isMovingServer}
        onClose={() => {
          setIsMovingServer(false);
          setSelectedServer(null);
          setMoveError(null);
        }}
        server={selectedServer}
        onMove={handleMoveServer}
        projects={projects}
        currentProjectId={currentProject?.id || null}
        isSubmitting={isSubmitting}
        error={moveError}
      />
      
      {/* CSS for animations - add to your global CSS or style component */}
      <style>{`
        /* Custom optimized spring easing function - faster with subtle bounce */
        .ease-spring { 
          transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1.2); 
        }
        
        /* Remove white flash on active/focus for tab buttons */
        .tab-button:focus-visible {
          outline: none;
          border-color: transparent;
        }
        
        .tab-button {
          -webkit-tap-highlight-color: transparent;
        }
      `}</style>
    </div>
  );
}