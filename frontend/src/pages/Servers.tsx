import { Link } from 'react-router-dom';
import { ChevronRightIcon, FolderIcon, XIcon, AlertTriangleIcon, CheckIcon, MoreHorizontalIcon } from 'lucide-react';
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
  id?: string;
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

// Tooltip component
interface TooltipProps {
  children: React.ReactNode;
  content: string;
  position?: 'top' | 'right' | 'bottom' | 'left';
}

const Tooltip: React.FC<TooltipProps> = ({
  children,
  content,
  position = 'right'
}) => {
  const [isVisible, setIsVisible] = useState(false);

  // Updated position classes with higher z-index and adjusted positioning
  const positionClasses = {
    top: "fixed transform -translate-x-1/2 -translate-y-full mt-[-8px]",
    right: "fixed transform translate-x-2 -translate-y-1/2",
    bottom: "fixed transform -translate-x-1/2 translate-y-2",
    left: "fixed transform -translate-x-full -translate-y-1/2 ml-[-8px]"
  };

  const tooltipRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Calculate tooltip position on hover
  useEffect(() => {
    if (isVisible && containerRef.current && tooltipRef.current) {
      const rect = containerRef.current.getBoundingClientRect();

      let top: number;
      let left: number;

      switch (position) {
        case 'top':
          left = rect.left + rect.width / 2;
          top = rect.top;
          break;
        case 'right':
          left = rect.right;
          top = rect.top + rect.height / 2;
          break;
        case 'bottom':
          left = rect.left + rect.width / 2;
          top = rect.bottom;
          break;
        case 'left':
          left = rect.left;
          top = rect.top + rect.height / 2;
          break;
        default:
          left = rect.right;
          top = rect.top + rect.height / 2;
      }

      tooltipRef.current.style.left = `${left}px`;
      tooltipRef.current.style.top = `${top}px`;
    }
  }, [isVisible, position]);

  return (
    <div
      className="relative inline-block"
      ref={containerRef}
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      {isVisible && (
        <div
          ref={tooltipRef}
          className={`${positionClasses[position]} z-[999]`}
        >
          <div className="px-2.5 py-1.5 text-xs font-medium text-gray-700 bg-white rounded-md shadow-md border border-gray-100 whitespace-nowrap">
            {content}
          </div>
        </div>
      )}
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
          className={`p-4 ${textColor} hover:bg-opacity-10 cursor-pointer rounded-full`}
        >
          <XIcon className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

// Dropdown Menu Component
interface DropdownMenuProps {
  children: React.ReactNode;
  isOpen: boolean;
  onClose: () => void;
}

const DropdownMenu: React.FC<DropdownMenuProps> = ({ children, isOpen, onClose }) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && event.target instanceof Node && !menuRef.current.contains(event.target)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={menuRef}
      className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden transform transition-all duration-150 ease-spring origin-top-right z-20 animate-scale-in"
    >
      {children}
    </div>
  );
};

// Menu Item Component 
interface MenuItemProps {
  icon?: React.ElementType;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

const MenuItem: React.FC<MenuItemProps> = ({
  icon: Icon,
  label,
  onClick,
  disabled = false
}) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full text-left px-4 py-2.5 text-sm transition duration-150 text-gray-700 hover:bg-gray-50 active:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
    >
      {Icon && <Icon className="mr-2 h-4 w-4 text-gray-500" />}
      <span>{label}</span>
    </button>
  );
};

// Server Project Picker Component
interface ServerProjectPickerProps {
  server: Server;
  projects: any[];
  onProjectSelect: (projectId: string) => void;
  onBack: () => void;
  currentProjectId: string;
}

const ServerProjectPicker: React.FC<ServerProjectPickerProps> = ({
  server,
  projects,
  onProjectSelect,
  onBack
}) => {
  return (
    <div className="animate-slide-in">
      <div className="flex items-center px-3 py-2 border-b border-gray-100">
        <button
          onClick={onBack}
          className="p-1.5 rounded-md hover:bg-gray-100 active:bg-gray-200 transition-colors mr-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-600">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="text-sm font-medium text-gray-700">Move to project</span>
      </div>
      <div className="max-h-48 overflow-y-auto py-1">
        {projects.map(project => (
          <button
            key={project.id}
            onClick={() => onProjectSelect(project.id)}
            disabled={project.id === server.projectId}
            className={`w-full text-left px-4 py-2.5 text-sm transition-colors duration-150 flex items-center
              ${project.id === server.projectId
                ? 'text-gray-400 cursor-not-allowed bg-gray-50'
                : 'text-gray-700 hover:bg-gray-50 active:bg-gray-100'}`}
          >
            <span>{project.name}</span>
            {project.id === server.projectId && (
              <span className="ml-auto text-xs text-gray-400">(Current)</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};

export default function Home() {
  const { currentProject, projects, moveServerToProject } = useProjects();
  const [servers, setServers] = useState<Server[]>([]);
  const [filteredServers, setFilteredServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('servers');
  const [menuState, setMenuState] = useState<{
    open: boolean;
    serverId: string | null;
    mode: 'main' | 'project-picker';
  }>({
    open: false,
    serverId: null,
    mode: 'main'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [nodeWarnings, setNodeWarnings] = useState<boolean>(false);

  console.log(isSubmitting);

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
        className={`tab-button relative z-5 cursor-pointer px-3 py-1 text-sm font-medium rounded-md transition-all duration-200 outline-none focus:outline-none focus:ring-0 ${isActive
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

  // Check for any node connection issues
  useEffect(() => {
    if (filteredServers.length > 0) {
      const hasNodeWarnings = filteredServers.some(server => !server.status?.id);
      setNodeWarnings(hasNodeWarnings);
    }
  }, [filteredServers]);

  const stats = {
    total: filteredServers.length,
    online: filteredServers.filter(s => s.status?.status?.state === 'running').length,
    offline: filteredServers.filter(s => s.status?.status?.state !== 'running').length
  };

  const handleOpenMenu = (serverId: string) => {
    setMenuState({
      open: true,
      serverId,
      mode: 'main'
    });
  };

  const handleCloseMenu = () => {
    setMenuState({
      open: false,
      serverId: null,
      mode: 'main'
    });
  };

  const handleMoveToProjectClick = () => {
    setMenuState(prev => ({
      ...prev,
      mode: 'project-picker'
    }));
  };

  const handleBackFromProjectPicker = () => {
    setMenuState(prev => ({
      ...prev,
      mode: 'main'
    }));
  };

  const handleProjectSelect = async (projectId: string) => {
    if (!menuState.serverId) return;

    try {
      setIsSubmitting(true);
      await moveServerToProject(menuState.serverId, projectId);

      // Update the local server list
      setServers(prevServers =>
        prevServers.map(server =>
          server.id === menuState.serverId
            ? { ...server, projectId }
            : server
        )
      );

      setMenuState({
        open: false,
        serverId: null,
        mode: 'main'
      });

      setSuccessMessage(`Server moved to project successfully`);

      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccessMessage(null);
      }, 3000);
    } catch (err) {
      console.error("Failed to move server:", err);
      setSuccessMessage(null);
      setError(err instanceof Error ? err.message : 'Failed to move server');

      // Clear error after 3 seconds
      setTimeout(() => {
        setError(null);
      }, 3000);
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

  const getSelectedServer = () => {
    if (!menuState.serverId) return null;
    return servers.find(server => server.id === menuState.serverId) || null;
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (error && !successMessage) {
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

        {/* Node Warnings Alert */}
        {nodeWarnings && (
          <Alert
            type="warning"
            message="One or more servers' nodes couldn't be reached. They may be inaccessible as a result. If so, you should probably contact an administrator. This is unlikely to be a problem with your network in this scenario."
            onDismiss={() => setNodeWarnings(false)}
          />
        )}

        {/* Error Message */}
        {error && (
          <Alert
            type="error"
            message={error}
            onDismiss={() => setError(null)}
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
                    id={`server-${server.id}`}
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
                            <div className={`h-1.5 w-1.5 rounded-full ${server.status?.status?.state === 'running'
                              ? 'bg-green-400'
                              : 'bg-gray-300'
                              }`}></div>
                          </div>
                          <div className="min-w-0 flex items-center">
                            <div className="text-xs font-medium text-gray-900 truncate">
                              {server.name}
                            </div>
                            {/* Warning icon for node connection issue */}
                            {!server.status?.id && (
                              <Tooltip
                                content="Node connection issue. Server may be inaccessible."
                                position="top"
                              >
                                <AlertTriangleIcon className="ml-2 h-3.5 w-3.5 text-amber-500" />
                              </Tooltip>
                            )}
                            <div className="text-[11px] text-gray-500 ml-1">
                              {server.status?.id || 'Connection error'}
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

                      {/* Three dots menu button */}
                      {(projects.length > 1) && (
                        <div className="relative h-full">
                          <button
                            onClick={(e) => {
                              e.stopPropagation(); // Prevent link click
                              handleOpenMenu(server.id);
                            }}
                            className="h-full px-3 border-l border-gray-200 text-gray-400 cursor-pointer hover:text-gray-600 hover:bg-gray-50 transition-colors duration-150 flex items-center"
                            aria-label="Server options"
                          >
                            <MoreHorizontalIcon className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-24 bg-white rounded-lg border border-gray-200">
                <div className="w-16 h-16 bg-gray-100 rounded-xl mb-6 flex items-center justify-center">
                  <CubeTransparentIcon className="w-8 h-8 text-gray-400" />
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

        {/* Dropdown menu portal */}
        {menuState.open && menuState.serverId && (
          <div className="fixed inset-0 z-50 pointer-events-none">
            <div
              className="absolute right-0 top-0 mt-1 pointer-events-auto"
              style={{
                position: 'fixed',
                // Position the menu relative to the button that opened it
                top: (() => {
                  const serverElement = document.getElementById(`server-${menuState.serverId}`);
                  if (serverElement) {
                    const rect = serverElement.getBoundingClientRect();
                    return `${rect.bottom}px`;
                  }
                  return '0px';
                })(),
                right: (() => {
                  const serverElement = document.getElementById(`server-${menuState.serverId}`);
                  if (serverElement) {
                    const rect = serverElement.getBoundingClientRect();
                    return `${window.innerWidth - rect.right}px`;
                  }
                  return '0px';
                })()
              }}
            >
              <DropdownMenu
                isOpen={menuState.open}
                onClose={handleCloseMenu}
              >
                {menuState.mode === 'main' ? (
                  <div className="py-1 animate-fade-in">
                    <MenuItem
                      icon={FolderIcon}
                      label="Move to project"
                      onClick={handleMoveToProjectClick}
                    />
                  </div>
                ) : (
                  <ServerProjectPicker
                    server={getSelectedServer()!}
                    projects={projects}
                    onProjectSelect={handleProjectSelect}
                    onBack={handleBackFromProjectPicker}
                    currentProjectId={currentProject?.id || ''}
                  />
                )}
              </DropdownMenu>
            </div>
          </div>
        )}

        {activeTab === 'overview' && (
          <div className="">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="border border-gray-200 bg-[#FFFFFF] rounded-md p-4">
                <div className="text-gray-500 text-sm mb-1">Total servers in Project</div>
                <div className="text-2xl font-medium">{stats.total}</div>
              </div>
              <div className="border border-gray-200 bg-white rounded-md p-4">
                <div className="text-gray-500 text-sm mb-1">Online</div>
                <div className="flex items-center">
                  <div className="h-2 w-2 rounded-full bg-green-400 mr-2"></div>
                  <div className="text-2xl font-medium">{stats.online}</div>
                </div>
              </div>
              <div className="border border-gray-200 bg-white rounded-md p-4">
                <div className="text-gray-500 text-sm mb-1">Offline</div>
                <div className="flex items-center">
                  <div className="h-2 w-2 rounded-full bg-gray-300 mr-2"></div>
                  <div className="text-2xl font-medium">{stats.offline}</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
