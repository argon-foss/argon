import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface SystemInfo {
  name: string;
  api: string;
  'powered-by': string;
}

interface SystemContextType {
  systemInfo: SystemInfo | null;
  loading: boolean;
  error: string | null;
  updatePanelName: (newName: string) => void; // Added function to update panel name
}

const defaultSystemInfo: SystemInfo = {
  name: 'Argon', // Fallback name
  api: '',
  'powered-by': ''
};

const SystemContext = createContext<SystemContextType>({
  systemInfo: defaultSystemInfo,
  loading: true,
  error: null,
  updatePanelName: () => console.warn('updatePanelName function not yet implemented') // Default empty implementation
});

export const useSystem = () => useContext(SystemContext);

interface SystemProviderProps {
  children: ReactNode;
}

export const SystemProvider: React.FC<SystemProviderProps> = ({ children }) => {
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(defaultSystemInfo);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSystemInfo = async () => { // Extracted to a function
    setLoading(true);
    try {
      const response = await fetch('/api/system');
        
        if (!response.ok) {
          throw new Error(`Failed to fetch system info: ${response.status}`);
        }
        
        const data = await response.json();
        setSystemInfo(data);
        setError(null); // Clear previous errors on success
      } catch (err) {
        console.error('Error fetching system info:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        // Keep stale data if fetch fails, or set to default/null
      } finally {
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
      // If prevInfo is null, we might want to initialize it or handle this case differently
      // For now, let's assume prevInfo is unlikely to be null after initial load.
      // Or, fetchSystemInfo() could be called again here to ensure full consistency.
      return { ...defaultSystemInfo, name: newName }; 
    });
  };

  return (
    <SystemContext.Provider value={{ systemInfo, loading, error, updatePanelName }}>
      {children}
    </SystemContext.Provider>
  );
};