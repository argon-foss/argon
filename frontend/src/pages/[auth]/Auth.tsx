import React, { createContext, useContext, useState, useEffect } from 'react';
import { Navigate, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  EyeIcon,
  EyeSlashIcon
} from '@heroicons/react/24/outline';

interface User {
  username: string;
  permissions: Array<string>;
}

interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    checkAuthState();
  }, []);

  const checkAuthState = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setLoading(false);
        return;
      }

      const response = await fetch('/api/auth/state', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setUser({ username: data.username, permissions: data.permissions });
      } else {
        localStorage.removeItem('token');
      }
    } catch (error) {
      console.error('Auth state check failed:', error);
      localStorage.removeItem('token');
    }
    setLoading(false);
  };

  const login = async (username: string, password: string) => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.error);

      localStorage.setItem('token', data.token);

      // Call /api/state
      const stateResponse = await fetch('/api/auth/state', {
        headers: {
          'Authorization': `Bearer ${data.token}`
        }
      });
      if (!stateResponse.ok) throw new Error('Failed to fetch user state');

      const stateData = await stateResponse.json();
      setUser({ username, permissions: stateData.permissions });
      window.location.href = '/servers';
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'An error occurred' };
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
    navigate('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" />;
  return <>{children}</>;
};

export const AuthPage: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [systemName, setSystemName] = useState('Argon'); // Default fallback
  const { login } = useAuth();

  useEffect(() => {
    // Fetch system information on component mount
    const fetchSystemInfo = async () => {
      try {
        const response = await fetch('/api/system');
        if (response.ok) {
          const data = await response.json();
          if (data.name) {
            setSystemName(data.name);
          }
        }
      } catch (error) {
        console.error('Failed to fetch system info:', error);
        // Keep default "Argon" name if fetch fails
      }
    };

    fetchSystemInfo();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    const result = await login(username, password);
    if (!result.success && result.error) {
      setError(result.error);
    }
    setIsLoading(false);
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-screen flex items-center justify-center bg-[#f9fafb] p-6"
    >
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.3 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-gray-800">{systemName}</h1>
        </div>

        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.3 }}
          className="bg-white rounded-lg shadow-xs p-8 border border-gray-200/50"
        >
          <h2 className="text-2xl font-semibold text-gray-800 mb-1">
            Sign in
          </h2>
          <p className="text-gray-600 text-sm mb-6">
            Enter your credentials to access your account.
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="px-3 py-2 rounded-md bg-red-50 border border-red-100"
              >
                <p className="text-sm text-red-600">{error}</p>
              </motion.div>
            )}

            <div>
              <label htmlFor="username" className="block text-xs font-medium text-gray-700 mb-1.5">
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="block w-full px-3 py-2 text-xs border border-gray-200 rounded-md focus:outline-none focus:border-gray-400"
                placeholder="username@example.com"
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-medium text-gray-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full px-3 py-2 text-xs border border-gray-200 rounded-md focus:outline-none focus:border-gray-400"
                  placeholder="*********"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors duration-200"
                >
                  {showPassword ? (
                    <EyeSlashIcon className="h-4 w-4" />
                  ) : (
                    <EyeIcon className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <motion.button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center border border-gray-300/50 rounded-lg px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 transition duration-150"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-gray-300
                             border-t-gray-800 rounded-full animate-spin" />
              ) : (
                'Continue'
              )}
            </motion.button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-xs text-gray-500 hover:text-gray-700 transition-colors duration-200 cursor-pointer">
              Forgot password
            </p>
          </div>
        </motion.div>

        <div className="mt-6 text-center">
          <Link
            to="https://github.com/argon-foss"
            className="inline-flex items-center text-gray-500 hover:text-gray-700 border-b border-gray-200 hover:border-gray-400 pb-1 transition-colors duration-200"
          >
            Powered by {systemName}
            <svg className="ml-1 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </Link>
        </div>
      </motion.div>
    </motion.div>
  );
};