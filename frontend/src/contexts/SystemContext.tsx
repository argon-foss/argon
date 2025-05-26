import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';

interface SystemInfo {
  name: string;
  version: string;
}

interface SystemContextType {
  systemInfo: SystemInfo | null;
  loading: boolean;
  error: string | null;
  updatePanelName: (newName: string) => void;
}

const defaultSystemInfo: SystemInfo = {
  name: 'Argon', // Fallback name
  version: ''
};

const SystemContext = createContext<SystemContextType>({
  systemInfo: defaultSystemInfo,
  loading: true,
  error: null,
  updatePanelName: () => console.warn('updatePanelName function not yet implemented')
});

export const useSystem = () => useContext(SystemContext);

interface SystemProviderProps {
  children: ReactNode;
}

export const SystemProvider: React.FC<SystemProviderProps> = ({ children }) => {
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const fetchedRef = useRef(false);

  const fetchSystemInfo = async () => {
    if (fetchedRef.current) {
      console.log('Already fetched or fetching, skipping...');
      return;
    }
    
    fetchedRef.current = true;
    console.log('Starting fetchSystemInfo, setting loading to true');
    setLoading(true);
    try {
      console.log('Fetching system info from /api/system...');
      const response = await fetch('/api/system');
      
      console.log('Response status:', response.status);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch system info: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Received system data:', data);
      
      setSystemInfo(data);
      setError(null);
      console.log('Successfully set system info, about to set loading to false');
    } catch (err) {
      console.error('Error fetching system info:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      // Set to default system info if fetch fails
      setSystemInfo(defaultSystemInfo);
      console.log('Error occurred, set default info, about to set loading to false');
      fetchedRef.current = false; // Allow retry on error
    } finally {
      console.log('In finally block, setting loading to false');
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSystemInfo();
  }, []);

  const updatePanelName = (newName: string) => {
    setSystemInfo(prevInfo => {
      if (prevInfo) {
        return { ...prevInfo, name: newName };
      }
      return { ...defaultSystemInfo, name: newName }; 
    });
  };

  return (
    <SystemContext.Provider value={{ systemInfo, loading, error, updatePanelName }}>
      {children}
    </SystemContext.Provider>
  );
};