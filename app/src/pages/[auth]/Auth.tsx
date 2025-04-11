import React, { createContext, useContext, useState, useEffect } from 'react';
import { Navigate, useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';

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
        navigate('/servers');
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
  const { login } = useAuth();

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
    <div className="min-h-screen flex bg-gradient-to-r from-teal-100 to-indigo-200">
      {/* Left panel */}
      <div className="w-2/5 bg-[#181b24] p-10 flex flex-col justify-center">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-white">Argon</h1>
        </div>
        
        <div className="my-6">
          <h2 className="text-2xl font-semibold text-white">
            Welcome back!
          </h2>
          <p className="text-lg text-gray-500 mt-2">
            We are glad to see you again.
          </p>
        </div>
        
        <div className="mt-8">
          <Link 
            to="https://github.com/argon-foss" 
            className="inline-flex items-center text-gray-500 hover:text-gray-300 border-b border-gray-500 pb-1"
          >
            Powered by Argon
            <svg className="ml-1 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </Link>
        </div>
      </div>
      
      {/* Right panel */}
      <div className="w-3/5 flex items-center justify-center">
        <div className="bg-gradient-to-b from-white/80 to-white rounded-xl shadow-sm p-8 w-full max-w-md border border-gray-200">
          <h2 className="text-2xl font-semibold text-gray-800 mb-1">
            Sign in
          </h2>
          <p className="text-gray-600 text-sm mb-6">
            Enter your credentials to access your account.
          </p>
          
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="px-3 py-2 rounded-md bg-red-50 border border-red-100">
                <p className="text-sm text-red-600">{error}</p>
              </div>
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
                className="block w-full px-3 py-2 rounded-md bg-white border border-gray-200 
                         text-sm text-gray-700
                         focus:outline-none focus:ring-1 focus:ring-gray-200 focus:border-gray-300 
                         transition-colors duration-200"
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
                  className="block w-full px-3 py-2 rounded-md bg-white border border-gray-200 
                           text-sm text-gray-700
                           focus:outline-none focus:ring-1 focus:ring-gray-200 focus:border-gray-300
                           transition-colors duration-200"
                  placeholder="*********"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
            
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-b from-white to-gray-100 shadow-xs border border-gray-200 text-sm font-medium text-gray-800
                       py-2 px-3 rounded-lg
                       hover:bg-indigo-200 
                       focus:outline-none focus:ring-1 focus:ring-indigo-600 focus:border-indigo-600
                       transition active:scale-95 duration-200 flex items-center justify-center"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-gray-300
                             border-t-gray-800 rounded-full animate-spin" />
              ) : (
                'Continue'
              )}
            </button>
          </form>
          
          <div className="mt-6 text-center">
            <p className="text-xs text-gray-500">
              Forgot password
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};