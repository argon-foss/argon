import { useEffect, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';

export const usePageTitle = () => {
  const location = useLocation();
  const params = useParams();
  const [systemName, setSystemName] = useState('Argon'); // Default fallback
  
  useEffect(() => {
    // Fetch system info directly
    const fetchSystemName = async () => {
      try {
        const response = await fetch('/api/system');
        if (response.ok) {
          const data = await response.json();
          if (data.name) {
            setSystemName(data.name);
          }
        }
      } catch (error) {
        console.error('Failed to fetch system info for title:', error);
        // Keep default "Argon" name if fetch fails
      }
    };

    fetchSystemName();
  }, []); // Only fetch once when hook initializes

  useEffect(() => {
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
  }, [location, params, systemName]); // Update title when route or systemName changes
};