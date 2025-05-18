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
}

const defaultSystemInfo: SystemInfo = {
  name: 'Argon', // Fallback name
  api: '',
  'powered-by': ''
};

const SystemContext = createContext<SystemContextType>({
  systemInfo: defaultSystemInfo,
  loading: true,
  error: null
});

export const useSystem = () => useContext(SystemContext);

interface SystemProviderProps {
  children: ReactNode;
}

export const SystemProvider: React.FC<SystemProviderProps> = ({ children }) => {
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(defaultSystemInfo);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSystemInfo = async () => {
      try {
        const response = await fetch('/api/system');
        
        if (!response.ok) {
          throw new Error(`Failed to fetch system info: ${response.status}`);
        }
        
        const data = await response.json();
        setSystemInfo(data);
      } catch (err) {
        console.error('Error fetching system info:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchSystemInfo();
  }, []);

  return (
    <SystemContext.Provider value={{ systemInfo, loading, error }}>
      {children}
    </SystemContext.Provider>
  );
};