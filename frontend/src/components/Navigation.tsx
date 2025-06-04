import { Link, useLocation } from 'react-router-dom';
import { useState, useRef, useEffect, useCallback } from 'react';
import {
  ServerIcon,
  Cog6ToothIcon,
  UserCircleIcon,
  ArrowLeftOnRectangleIcon,
  UsersIcon,
  CubeIcon,
  CommandLineIcon,
  FolderIcon,
  KeyIcon,
  ServerStackIcon,
  ArchiveBoxIcon,
  HomeModernIcon,
  ArrowsPointingOutIcon,
  GlobeAmericasIcon,
  AdjustmentsHorizontalIcon
} from '@heroicons/react/24/outline';
import { useAuth } from '../pages/[auth]/Auth';
//import { useSystem } from '../contexts/SystemContext';
import ProjectSwitcher from '../components/ProjectSwitcher';

// Create a new context to manage sidebar visibility
import { createContext, useContext } from 'react';

interface SidebarContextType {
  sidebarVisible: boolean;
  toggleSidebar: () => void;
}

const SidebarContext = createContext<SidebarContextType>({
  sidebarVisible: true,
  toggleSidebar: () => { }
});

export const useSidebar = () => useContext(SidebarContext);

const SidebarProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [sidebarVisible, setSidebarVisible] = useState(true);

  const toggleSidebar = () => {
    setSidebarVisible(!sidebarVisible);
  };

  return (
    <SidebarContext.Provider value={{ sidebarVisible, toggleSidebar }}>
      {children}
    </SidebarContext.Provider>
  );
};

const UserAvatar: React.FC<{ username: string }> = ({ username }) => {
  const initial = username.charAt(0).toUpperCase();

  return (
    <div className="h-6 w-6 rounded-lg bg-gray-200 flex items-center justify-center">
      <span className="text-xs font-medium text-gray-800">{initial}</span>
    </div>
  );
};

// Tooltip component
const Tooltip: React.FC<{
  children: React.ReactNode;
  content: string;
  position?: 'top' | 'right' | 'bottom' | 'left';
}> = ({ children, content, position = 'right' }) => {
  const [isVisible, setIsVisible] = useState(false);

  const positionClasses = {
    top: "bottom-full left-1/2 transform -translate-x-1/2 -translate-y-2 mb-2",
    right: "left-full top-1/2 transform -translate-y-1/2 translate-x-2 ml-1",
    bottom: "top-full left-1/2 transform -translate-x-1/2 translate-y-2 mt-2",
    left: "right-full top-1/2 transform -translate-y-1/2 -translate-x-2 mr-1"
  };

  return (
    <div className="relative inline-block"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      {isVisible && (
        <div className={`absolute z-50 ${positionClasses[position]}`}>
          <div className="px-2 py-1 text-xs font-medium text-white bg-gray-800 rounded-md shadow-sm whitespace-nowrap opacity-90">
            {content}
          </div>
        </div>
      )}
    </div>
  );
};

// Toggle Button Component
const SidebarToggle: React.FC = () => {
  const { sidebarVisible, toggleSidebar } = useSidebar();

  return (
    <Tooltip content={sidebarVisible ? "Hide sidebar" : "Show sidebar"}>
      <button
        onClick={toggleSidebar}
        className="p-2 rounded-lg hover:border-transparent hover:bg-gray-200/50 active:scale-95 transition-all duration-200 ease-in-out"
        aria-label={sidebarVisible ? "Hide sidebar" : "Show sidebar"}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"
          className="text-gray-400 transition-transform duration-300 ease-in-out"
          style={{ transform: sidebarVisible ? 'rotate(0deg)' : 'rotate(180deg)' }}
        >
          <path fillRule="evenodd" clipRule="evenodd" d="M8.85719 3H15.1428C16.2266 2.99999 17.1007 2.99998 17.8086 3.05782C18.5375 3.11737 19.1777 3.24318 19.77 3.54497C20.7108 4.02433 21.4757 4.78924 21.955 5.73005C22.2568 6.32234 22.3826 6.96253 22.4422 7.69138C22.5 8.39925 22.5 9.27339 22.5 10.3572V13.6428C22.5 14.7266 22.5 15.6008 22.4422 16.3086C22.3826 17.0375 22.2568 17.6777 21.955 18.27C21.4757 19.2108 20.7108 19.9757 19.77 20.455C19.1777 20.7568 18.5375 20.8826 17.8086 20.9422C17.1008 21 16.2266 21 15.1428 21H8.85717C7.77339 21 6.89925 21 6.19138 20.9422C5.46253 20.8826 4.82234 20.7568 4.23005 20.455C3.28924 19.9757 2.52433 19.2108 2.04497 18.27C1.74318 17.6777 1.61737 17.0375 1.55782 16.3086C1.49998 15.6007 1.49999 14.7266 1.5 13.6428V10.3572C1.49999 9.27341 1.49998 8.39926 1.55782 7.69138C1.61737 6.96253 1.74318 6.32234 2.04497 5.73005C2.52433 4.78924 3.28924 4.02433 4.23005 3.54497C4.82234 3.24318 5.46253 3.11737 6.19138 3.05782C6.89926 2.99998 7.77341 2.99999 8.85719 3ZM6.35424 5.05118C5.74907 5.10062 5.40138 5.19279 5.13803 5.32698C4.57354 5.6146 4.1146 6.07354 3.82698 6.63803C3.69279 6.90138 3.60062 7.24907 3.55118 7.85424C3.50078 8.47108 3.5 9.26339 3.5 10.4V13.6C3.5 14.7366 3.50078 15.5289 3.55118 16.1458C3.60062 16.7509 3.69279 17.0986 3.82698 17.362C4.1146 17.9265 4.57354 18.3854 5.13803 18.673C5.40138 18.8072 5.74907 18.8994 6.35424 18.9488C6.97108 18.9992 7.76339 19 8.9 19H9.5V5H8.9C7.76339 5 6.97108 5.00078 6.35424 5.05118ZM11.5 5V19H15.1C16.2366 19 17.0289 18.9992 17.6458 18.9488C18.2509 18.8994 18.5986 18.8072 18.862 18.673C19.4265 18.3854 19.8854 17.9265 20.173 17.362C20.3072 17.0986 20.3994 16.7509 20.4488 16.1458C20.4992 15.5289 20.5 14.7366 20.5 13.6V10.4C20.5 9.26339 20.4992 8.47108 20.4488 7.85424C20.3994 7.24907 20.3072 6.90138 20.173 6.63803C19.8854 6.07354 19.4265 5.6146 18.862 5.32698C18.5986 5.19279 18.2509 5.10062 17.6458 5.05118C17.0289 5.00078 16.2366 5 15.1 5H11.5ZM5 8.5C5 7.94772 5.44772 7.5 6 7.5H7C7.55229 7.5 8 7.94772 8 8.5C8 9.05229 7.55229 9.5 7 9.5H6C5.44772 9.5 5 9.05229 5 8.5ZM5 12C5 11.4477 5.44772 11 6 11H7C7.55229 11 8 11.4477 8 12C8 12.5523 7.55229 13 7 13H6C5.44772 13 5 12.5523 5 12Z" fill="currentColor"></path>
        </svg>
      </button>
    </Tooltip>
  );
};

function Navbar() {
  const { user, logout } = useAuth();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };

  const handleLogout = () => {
    logout();
    setIsDropdownOpen(false);
  };

  const { sidebarVisible } = useSidebar();

  return (
    <header className={`fixed top-0 ${sidebarVisible ? 'left-56' : 'left-0'} right-0 h-12 mt-1.5 ml-1 mr-2 rounded-lg bg-white/80 border border-gray-100 backdrop-blur flex items-center z-50 justify-between transition-all duration-300 ease-in-out`}>
      <div className="flex items-center ml-1.5">
        <SidebarToggle />
      </div>

      <div className="ml-auto">
        {user && (
          <div className="relative">
            <div
              ref={buttonRef}
              className="flex items-center cursor-pointer mr-2 p-2 rounded-lg hover:bg-gray-200/50 py-1.5 active:scale-95 transition duration-200 ease-in-out"
              onClick={toggleDropdown}
            >
              <UserAvatar username={user.username || 'User'} />
              <span className="ml-2 text-sm font-medium text-gray-800">{user.username}</span>
            </div>

            <div
              ref={dropdownRef}
              className={`absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 
                       overflow-hidden transform transition-all duration-200 ease-in-out origin-top-right z-50 ${isDropdownOpen
                  ? 'opacity-100 scale-y-100 translate-y-0'
                  : 'opacity-0 scale-y-95 translate-y-1 pointer-events-none'
                }`}
            >
              <div className="p-0.5">
                <button
                  className="w-full px-4 py-2 text-sm transition active:scale-95 rounded-lg text-gray-700 hover:bg-gray-100 flex items-center"
                >
                  <Link
                    to="/profile"
                    className="flex items-center"
                  >
                    <UserCircleIcon className="mr-2 h-4 w-4" />
                    Profile
                  </Link>
                </button>
                <a
                  onClick={handleLogout}
                  className="w-full px-4 py-2 text-sm cursor-pointer active:scale-95 transition rounded-lg text-gray-700 hover:bg-gray-100 flex items-center"
                >
                  <ArrowLeftOnRectangleIcon className="mr-2 h-4 w-4" />
                  Sign out
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}

function Sidebar() {
  const location = useLocation();
  //const { systemInfo } = useSystem();
  const { user } = useAuth();
  const { sidebarVisible } = useSidebar();

  // Get the system name from the API response or fallback to "Argon"
  //const systemName = systemInfo?.name || 'Argon';

  // Check if we're on a server-specific page
  const isServerPage = location.pathname.startsWith('/servers/') && location.pathname.split('/').length > 3;

  // Get server ID from path if on a server page
  const serverId = isServerPage ? location.pathname.split('/')[2] : null;

  // Check if user has admin permissions
  // @ts-ignore
  const hasAdminPermission = user?.permissions?.includes('admin') || false;

  // Used for the navigation animation logic
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [previousTabId, setPreviousTabId] = useState<string | null>(null);
  const [indicatorStyle, setIndicatorStyle] = useState({
    width: 0,
    height: 0,
    top: 0,
    left: 0,
    opacity: 0,
  });
  console.log(previousTabId)
  // Use useRef instead of useState to avoid re-renders causing infinite loops
  const tabRefsMap = useRef<Record<string, HTMLAnchorElement | null>>({});

  // Effect to track active tab changes
  useEffect(() => {
    // Generate ID from pathname
    const generateTabId = (path: string) => {
      return path.replace(/\//g, '-').slice(1);
    };

    const newTabId = generateTabId(location.pathname);

    if (activeTabId !== newTabId) {
      setPreviousTabId(activeTabId);
      setActiveTabId(newTabId);
    }
  }, [location.pathname, activeTabId]);

  // Effect to update the indicator position whenever activeTabId changes
  useEffect(() => {
    // Using requestAnimationFrame for smoother animation
    const animationFrame = requestAnimationFrame(() => {
      if (activeTabId && tabRefsMap.current[activeTabId]) {
        const tabElement = tabRefsMap.current[activeTabId];
        if (!tabElement) return;

        // Get the tab's position and dimensions
        const rect = tabElement.getBoundingClientRect();
        const navElement = tabElement.closest('nav');
        const navRect = navElement?.getBoundingClientRect();

        if (navRect) {
          // Calculate position relative to the nav container
          const offsetTop = rect.top - navRect.top;
          const offsetLeft = rect.left - navRect.left;

          setIndicatorStyle({
            width: rect.width,
            height: rect.height,
            top: offsetTop,
            left: offsetLeft,
            opacity: 1,
          });
        }
      }
    });

    return () => cancelAnimationFrame(animationFrame);
  }, [activeTabId]);

  // Create a ref callback function for each NavItem
  const setTabRef = useCallback((id: string, element: HTMLAnchorElement | null) => {
    tabRefsMap.current[id] = element;
  }, []);

  return (
    <div
      className={`sidebar-container fixed inset-y-0 left-0 w-56 bg-[#101219] p-1 z-10 flex flex-col transform transition-transform duration-300 ease-in-out ${sidebarVisible ? 'translate-x-0' : '-translate-x-full'
        }`}
    >
      {/* System Name */}
      <div className="pt-3 flex items-center ml-2.5">
        <ProjectSwitcher />
      </div>

      {/* Main Navigation */}
      <div className="flex-1 p-0.5 overflow-y-auto">
        <nav className="p-1 mt-2 pr-3 space-y-0.5 relative">
          {/* Animated background indicator */}
          <div
            className="absolute transform transition-all duration-200 ease-spring bg-[#383c47] rounded-md z-0"
            style={{
              width: `${indicatorStyle.width}px`,
              height: `${indicatorStyle.height}px`,
              top: `${indicatorStyle.top}px`,
              left: `${indicatorStyle.left}px`,
              opacity: indicatorStyle.opacity,
              // Add a small delay to the background indicator to avoid flash
              transitionDelay: '30ms',
            }}
          />

          <NavItem
            to="/servers"
            icon={ServerStackIcon}
            label="Servers"
            isActive={location.pathname === '/servers'}
            setRef={setTabRef}
          />

          <NavItem
            to="/projects"
            icon={FolderIcon}
            label="Projects"
            isActive={location.pathname === '/projects'}
            setRef={setTabRef}
          />

          {/* Server Section - Only show when on a server page */}
          {isServerPage && (
            <>
              <SectionHeader label="Server" />

              <NavItem
                to={`/servers/${serverId}/console`}
                icon={CommandLineIcon}
                label="Console"
                isActive={location.pathname.endsWith('/console')}
                setRef={setTabRef}
              />

              <NavItem
                to={`/servers/${serverId}/files`}
                icon={FolderIcon}
                label="Files"
                isActive={location.pathname.endsWith('/files')}
                setRef={setTabRef}
              />

              <NavItem
                to={`/servers/${serverId}/startup`}
                icon={AdjustmentsHorizontalIcon}
                label="Startup"
                isActive={location.pathname.endsWith('/startup')}
                setRef={setTabRef}
              />

              <NavItem
                to={`/servers/${serverId}/settings`}
                icon={Cog6ToothIcon}
                label="Settings"
                isActive={location.pathname.endsWith('/settings')}
                setRef={setTabRef}
              />
            </>
          )}

          {/* Admin Section - Only show if user has admin permissions */}
          {hasAdminPermission && (
            <>
              <SectionHeader label="Admin" />

              <NavItem
                to="/admin"
                icon={HomeModernIcon}
                label="Overview"
                isActive={location.pathname === '/admin'}
                setRef={setTabRef}
              />

              <NavItem
                to="/admin/settings"
                icon={Cog6ToothIcon}
                label="Settings"
                isActive={location.pathname === '/admin/settings'}
                setRef={setTabRef}
              />

              <NavItem
                to="/admin/api-keys"
                icon={KeyIcon}
                label="API Keys"
                isActive={location.pathname === '/admin/api-keys'}
                setRef={setTabRef}
              />

              <NavItem
                to="/admin/servers"
                icon={ServerIcon}
                label="Servers"
                isActive={location.pathname === '/admin/servers'}
                setRef={setTabRef}
              />

              <NavItem
                to="/admin/regions"
                icon={GlobeAmericasIcon}
                label="Regions"
                isActive={location.pathname === '/admin/regions'}
                setRef={setTabRef}
              />

              <NavItem
                to="/admin/nodes"
                icon={CubeIcon}
                label="Nodes"
                isActive={location.pathname === '/admin/nodes'}
                setRef={setTabRef}
              />

              <NavItem
                to="/admin/users"
                icon={UsersIcon}
                label="Users"
                isActive={location.pathname === '/admin/users'}
                setRef={setTabRef}
              />

              <NavItem
                to="/admin/units"
                icon={ArchiveBoxIcon}
                label="Units"
                isActive={location.pathname === '/admin/units'}
                setRef={setTabRef}
              />

              <NavItem
                to="/admin/cargo"
                icon={ArrowsPointingOutIcon}
                label="Cargo"
                isActive={location.pathname === '/admin/cargo'}
                setRef={setTabRef}
              />
            </>
          )}
        </nav>
      </div>

      {/* Logout at bottom */}
      <div className="p-6">
        <Link
          to="https://github.com/argon-foss"
          className="inline-flex text-xs items-center text-gray-500 transition hover:text-gray-300 border-b border-gray-800 pb-1"
        >
          Powered by Argon
          <svg className="ml-1 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </Link>
      </div>
    </div>
  );
}

// Custom spring easing function for index.css
// Add this to your global CSS:
// .ease-spring { transition-timing-function: cubic-bezier(0.5, 0, 0.2, 1.4); }

// Enhanced Navigation Item component with ref forwarding
const NavItem = ({
  to,
  icon: Icon,
  label,
  isActive,
  setRef
}: {
  to: string;
  icon: React.ElementType;
  label: string;
  isActive: boolean;
  setRef: (id: string, element: HTMLAnchorElement | null) => void;
}) => {
  // Generate a consistent ID from the path
  const id = to.replace(/\//g, '-').slice(1);

  // Use useRef to maintain stability
  const linkRef = useRef<HTMLAnchorElement>(null);

  // Register the ref on mount only
  useEffect(() => {
    if (linkRef.current) {
      setRef(id, linkRef.current);
    }

    return () => {
      setRef(id, null);
    };
  }, [id, setRef]);

  return (
    <Link
      to={to}
      ref={linkRef}
      className={`nav-link flex items-center h-8 ml-2 text-xs rounded-md font-light transition duration-300 relative z-10 outline-none focus:outline-none focus:ring-0 ${isActive
        ? 'px-2 font-semibold text-white'
        : 'border-none px-2 hover:text-white text-white/50'
        }`}
    >
      <Icon strokeWidth="2" className={`mr-2 h-4 w-4 ${isActive ? 'text-white/60' : 'text-white/30'}`} />
      <span className={`${['nodes', 'servers', 'projects', 'api keys'].includes(label.toLowerCase()) ? 'mt-[1.75px]' : ''}`}>{label}</span>
    </Link>
  );
};

// Section Header component
const SectionHeader = ({ label }: { label: string }) => {
  return (
    <div className="px-4 pt-5 pb-1">
      <h3 className="text-[0.6rem] font-semibold uppercase tracking-wider text-white/40">{label}</h3>
    </div>
  );
};

// Re-export both components for convenience
export { Navbar, Sidebar, SidebarProvider };