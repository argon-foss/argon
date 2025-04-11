import { useEffect } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { useSystem } from '../contexts/SystemContext';

export const usePageTitle = () => {
  const location = useLocation();
  const params = useParams();
  const { systemInfo } = useSystem();
  
  useEffect(() => {
    // Use the fetched system name or fall back to "Argon" if not available
    const systemName = systemInfo?.name || 'Argon';
    let title = systemName;
    const path = location.pathname;
    
    // Root paths
    if (path === "/servers") {
      title = `${systemName} | Servers`;
    } else if (path === "/login") {
      title = `${systemName} | Login`;
    } else if (path === "/register") {
      title = `${systemName} | Register`;
    } else if (path === "/admin") {
      title = `${systemName} | Admin`;
    } else if (path.startsWith("/admin/")) {
      // Admin subpages
      const section = path.split("/admin/")[1];
      title = `${systemName} | Admin → ${section.charAt(0).toUpperCase() + section.slice(1)}`;
    } else if (path.startsWith("/servers/") && params.id) {
      // Server subpages
      const lastSegment = path.split("/").pop();
      if (lastSegment) {
        title = `${systemName} | Server → ${lastSegment.charAt(0).toUpperCase() + lastSegment.slice(1)}`;
      }
    } else if (path === "/404" || path.includes("*")) {
      title = `${systemName} | Not Found`;
    }
    
    document.title = title;
  }, [location, params, systemInfo]);
};