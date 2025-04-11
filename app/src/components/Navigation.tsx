import { Link, useLocation } from 'react-router-dom';
import { useState, useRef, useEffect } from 'react';
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
  GlobeAmericasIcon
} from '@heroicons/react/24/outline';
import { useAuth } from '../pages/[auth]/Auth';
import { useSystem } from '../contexts/SystemContext';
import ProjectSwitcher from '../components/ProjectSwitcher';

const UserAvatar: React.FC<{ username: string }> = ({ username }) => {
  const initial = username.charAt(0).toUpperCase();
  
  return (
    <div className="h-7 w-7 rounded-full bg-gray-50 flex items-center justify-center">
      <span className="text-xs font-medium text-gray-800">{initial}</span>
    </div>
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
  
  return (
    <header className="fixed top-0 left-56 right-0 h-14 bg-white border-b border-gray-200 flex items-center z-50 justify-between">
      <ProjectSwitcher />
      
      <div className="flex items-center space-x-4">
        {user && (
          <div className="relative">
            <div 
              ref={buttonRef}
              className="flex items-center cursor-pointer mr-4 p-2 rounded-lg hover:bg-gray-100 active:scale-95 transition duration-200 ease-in-out"
              onClick={toggleDropdown}
            >
              <UserAvatar username={user.username || 'User'} />
              <span className="ml-2 text-sm font-medium text-gray-800">{user.username}</span>
            </div>
            
            <div 
              ref={dropdownRef}
              className={`absolute right-0 top-full mt-1 w-48 bg-white rounded-md shadow-lg border border-gray-200 
                       overflow-hidden transform transition-all duration-200 ease-in-out origin-top-right z-50 ${
                isDropdownOpen 
                  ? 'opacity-100 scale-y-100 translate-y-0' 
                  : 'opacity-0 scale-y-95 translate-y-1 pointer-events-none'
              }`}
            >
              <div className="py-1">
                <button 
                  className="w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                >
                  <UserCircleIcon className="mr-2 h-4 w-4" />
                  Profile
                </button>
                <button 
                  onClick={handleLogout}
                  className="w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                >
                  <ArrowLeftOnRectangleIcon className="mr-2 h-4 w-4" />
                  Sign out
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}

// Navigation Item component for consistent styling
const NavItem = ({ 
  to, 
  icon: Icon, 
  label, 
  isActive 
}: { 
  to: string; 
  icon: React.ElementType; 
  label: string; 
  isActive: boolean;
}) => {
  return (
    <Link
      to={to}
      className={`flex items-center h-8 ml-2 text-sm rounded-lg font-medium transition active:scale-95 duration-200 ${
        isActive
          ? 'shadow-sm px-2 bg-[#171924] border border-white/5 text-indigo-100'
          : 'border border-transparent shadow-transparent px-2 hover:text-white text-white/50'
      }`}
    >
      <Icon strokeWidth="2" className={`mr-2 h-4 w-4 ${isActive ? 'text-indigo-100' : 'text-white/30'}`} />
      {label}
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

function Sidebar() {
  const location = useLocation();
  const { systemInfo } = useSystem();
  const { user } = useAuth();
  
  // Get the system name from the API response or fallback to "Argon"
  const systemName = systemInfo?.name || 'Argon';
  
  // Check if we're on a server-specific page
  const isServerPage = location.pathname.startsWith('/servers/') && location.pathname.split('/').length > 3;
  
  // Get server ID from path if on a server page
  const serverId = isServerPage ? location.pathname.split('/')[2] : null;

  // Check if user has admin permissions
  // @ts-ignore
  const hasAdminPermission = user?.permissions?.includes('admin') || false;

  return (
    <div 
      className="fixed inset-y-0 left-0 w-56 bg-gradient-to-b from-[#1d202b] to-[#161921] z-10 flex flex-col"
    >
      {/* System Name */}
      <div className="h-14 flex items-center p-1 border-b border-white/5">
        <Link to="/servers" className="h-12 flex items-center w-full px-4 hover:bg-white/5 rounded-lg active:scale-95 transition">
          <span className="text-base font-semibold text-white">{systemName}</span>
        </Link>
      </div>
      
      {/* Main Navigation */}
      <div className="flex-1 overflow-y-auto">
        <nav className="p-1 mt-2 pr-3 space-y-0.5">
          <NavItem 
            to="/servers" 
            icon={ServerStackIcon} 
            label="Servers" 
            isActive={location.pathname === '/servers'} 
          />
          
          <NavItem 
            to="/projects" 
            icon={FolderIcon} 
            label="Projects" 
            isActive={location.pathname === '/projects'} 
          />
          
          {/* Admin Section - Only show if user has admin permissions */}
          {hasAdminPermission && (
            <>
              <SectionHeader label="Admin" />
              
              <NavItem 
                to="/admin" 
                icon={HomeModernIcon} 
                label="Overview" 
                isActive={location.pathname === '/admin'} 
              />

              <NavItem 
                to="/admin/settings" 
                icon={Cog6ToothIcon} 
                label="Settings" 
                isActive={location.pathname === '/admin/settings'} 
              />

              <NavItem 
                to="/admin/api-keys" 
                icon={KeyIcon} 
                label="API Keys" 
                isActive={location.pathname === '/admin/api-keys'} 
              />
              
              <NavItem 
                to="/admin/servers" 
                icon={ServerIcon} 
                label="Servers" 
                isActive={location.pathname === '/admin/servers'} 
              />

              <NavItem 
                to="/admin/regions" 
                icon={GlobeAmericasIcon} 
                label="Regions" 
                isActive={location.pathname === '/admin/regions'} 
              />
              
              <NavItem 
                to="/admin/nodes" 
                icon={CubeIcon} 
                label="Nodes" 
                isActive={location.pathname === '/admin/nodes'} 
              />
              
              <NavItem 
                to="/admin/users" 
                icon={UsersIcon} 
                label="Users" 
                isActive={location.pathname === '/admin/users'} 
              />

              <NavItem 
                to="/admin/units" 
                icon={ArchiveBoxIcon} 
                label="Units" 
                isActive={location.pathname === '/admin/units'} 
              />

              <NavItem 
                to="/admin/cargo" 
                icon={ArrowsPointingOutIcon} 
                label="Cargo" 
                isActive={location.pathname === '/admin/cargo'} 
              />
            </>
          )}
          
          {/* Server Section - Only show when on a server page */}
          {isServerPage && (
            <>
              <SectionHeader label="Server" />
              
              <NavItem 
                to={`/servers/${serverId}/console`} 
                icon={CommandLineIcon} 
                label="Console" 
                isActive={location.pathname.endsWith('/console')} 
              />
              
              <NavItem 
                to={`/servers/${serverId}/files`} 
                icon={FolderIcon} 
                label="Files" 
                isActive={location.pathname.endsWith('/files')} 
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

// Re-export both components for convenience
export { Navbar, Sidebar };