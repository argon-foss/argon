import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  EyeIcon,
  EyeSlashIcon,
  ExclamationTriangleIcon,
  CheckIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { useAuth } from './[auth]/Auth';

// Alert component types
interface AlertProps {
  type: 'error' | 'success' | 'warning';
  message: string;
  onDismiss?: () => void;
}

// Alert component for form errors/warnings
const Alert: React.FC<AlertProps> = ({ type, message, onDismiss }) => {
  const bgColor = type === 'error' ? 'bg-red-50' : type === 'success' ? 'bg-green-50' : 'bg-yellow-50';
  const textColor = type === 'error' ? 'text-red-600' : type === 'success' ? 'text-green-600' : 'text-yellow-600';
  const borderColor = type === 'error' ? 'border-red-100' : type === 'success' ? 'border-green-100' : 'border-yellow-100';

  return (
    <div className={`${bgColor} border ${borderColor} rounded-md flex items-start justify-between mb-4`}>
      <div className="flex items-start p-3">
        {type === 'error' || type === 'warning' ? (
          <ExclamationTriangleIcon className={`w-4 h-4 ${textColor} mr-2 mt-0.5`} />
        ) : (
          <CheckIcon className={`w-4 h-4 ${textColor} mr-2 mt-0.5`} />
        )}
        <p className={`text-sm ${textColor}`}>{message}</p>
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className={`p-2 ${textColor} hover:bg-opacity-10 cursor-pointer rounded-full`}
        >
          <XMarkIcon className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

// Form data interface
interface FormData {
  newUsername: string;
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

// Response data interface
interface ProfileResponse {
  message?: string;
  token?: string;
  error?: string;
}

const ProfilePage: React.FC = () => {
  const { user, logout } = useAuth();

  const [formData, setFormData] = useState<FormData>({
    newUsername: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const [showCurrentPassword, setShowCurrentPassword] = useState<boolean>(false);
  const [showNewPassword, setShowNewPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'profile' | 'security'>('profile');

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
        top: 3.5,
        left: offsetLeft,
        opacity: 1,
      });
    };

    const animationFrame = requestAnimationFrame(updateIndicator);
    return () => cancelAnimationFrame(animationFrame);
  }, [activeTab]);

  // Initialize the indicator position after component mounts
  useEffect(() => {
    const timer = setTimeout(() => {
      const tabElement = tabRefsMap.current[activeTab];
      if (!tabElement || !tabsContainerRef.current) return;

      const rect = tabElement.getBoundingClientRect();
      const containerRect = tabsContainerRef.current.getBoundingClientRect();

      const offsetLeft = rect.left - containerRect.left;

      setIndicatorStyle({
        width: rect.width,
        height: rect.height,
        top: 3.5,
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const validateForm = (): boolean => {
    // Check if any field is being updated
    const isUpdatingUsername = !!formData.newUsername;
    const isUpdatingPassword = !!(formData.currentPassword && formData.newPassword);

    if (!isUpdatingUsername && !isUpdatingPassword) {
      setError('Please fill in at least one field to update your profile');
      return false;
    }

    // If updating username, make sure it's different
    if (isUpdatingUsername && user && formData.newUsername === user.username) {
      setError('New username must be different from current username');
      return false;
    }

    // If updating password, validate requirements
    if (isUpdatingPassword) {
      if (!formData.currentPassword) {
        setError('Current password is required to update password');
        return false;
      }

      if (formData.newPassword.length < 8) {
        setError('New password must be at least 8 characters');
        return false;
      }

      if (formData.newPassword !== formData.confirmPassword) {
        setError('New password and confirmation do not match');
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!validateForm()) return;

    setIsSubmitting(true);

    try {
      const token = localStorage.getItem('token');
      const payload: {
        newUsername?: string;
        currentPassword?: string;
        newPassword?: string;
      } = {};

      if (formData.newUsername) {
        payload.newUsername = formData.newUsername;
      }

      if (formData.currentPassword && formData.newPassword) {
        payload.currentPassword = formData.currentPassword;
        payload.newPassword = formData.newPassword;
      }

      const response = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const data: ProfileResponse = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update profile');
      }

      // If a new token was returned (username was changed), save it
      if (data.token) {
        localStorage.setItem('token', data.token);
        // Reload the page to update the user context with new username
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      }

      // Clear form data
      setFormData({
        newUsername: '',
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });

      setSuccess(data.message || 'Profile updated successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while updating your profile');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="w-full mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-800">Account Settings</h1>
            <p className="text-sm text-gray-500">
              Manage your account information and security settings
            </p>
          </div>
        </div>

        {/* Alerts */}
        {error && (
          <Alert
            type="error"
            message={error}
            onDismiss={() => setError(null)}
          />
        )}

        {success && (
          <Alert
            type="success"
            message={success}
            onDismiss={() => setSuccess(null)}
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
                height: `${indicatorStyle.height}px`,
                top: `${indicatorStyle.top}px`,
                left: `${indicatorStyle.left}px`,
                opacity: indicatorStyle.opacity,
                transitionDelay: '30ms',
              }}
            />

            {/* Tab buttons */}
            <TabButton
              id="profile"
              isActive={activeTab === 'profile'}
              onClick={() => setActiveTab('profile')}
            >
              Profile
            </TabButton>

            <TabButton
              id="security"
              isActive={activeTab === 'security'}
              onClick={() => setActiveTab('security')}
            >
              Security
            </TabButton>
          </div>
        </div>

        {/* Content based on active tab */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-xs">
          <div className="p-6">
            {activeTab === 'profile' && (
              <div>
                <h2 className="text-lg font-medium text-gray-900 mb-1">Profile Information</h2>
                <div className="mb-6">
                  <form onSubmit={handleSubmit}>
                    <div className="mb-4">
                      <label htmlFor="newUsername" className="block text-xs font-medium text-gray-700 mb-1">
                        New Username
                      </label>
                      <input
                        id="newUsername"
                        type="text"
                        name="newUsername"
                        value={formData.newUsername}
                        onChange={handleChange}
                        className="block w-full px-3 py-2 text-xs border border-gray-200 rounded-md focus:outline-none focus:border-gray-400"
                        placeholder={user?.username}
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        Leave blank if you don't want to change your username
                      </p>
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={isSubmitting || (!formData.newUsername && !formData.currentPassword)}
                        className="px-4 py-2 text-xs font-medium text-white bg-gray-900 rounded-md hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isSubmitting ? 'Updating...' : 'Update Profile'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {activeTab === 'security' && (
              <div>
                <h2 className="text-lg font-medium text-gray-900 mb-4">Password</h2>
                <form onSubmit={handleSubmit}>
                  <div className="space-y-4 mb-6">
                    <div>
                      <label htmlFor="currentPassword" className="block text-xs font-medium text-gray-700 mb-1">
                        Current Password
                      </label>
                      <div className="relative">
                        <input
                          id="currentPassword"
                          type={showCurrentPassword ? "text" : "password"}
                          name="currentPassword"
                          value={formData.currentPassword}
                          onChange={handleChange}
                          className="block w-full px-3 py-2 text-xs border border-gray-200 rounded-md focus:outline-none focus:border-gray-400"
                          placeholder="Enter current password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center"
                        >
                          {showCurrentPassword ? (
                            <EyeSlashIcon className="h-4 w-4 text-gray-400" />
                          ) : (
                            <EyeIcon className="h-4 w-4 text-gray-400" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label htmlFor="newPassword" className="block text-xs font-medium text-gray-700 mb-1">
                        New Password
                      </label>
                      <div className="relative">
                        <input
                          id="newPassword"
                          type={showNewPassword ? "text" : "password"}
                          name="newPassword"
                          value={formData.newPassword}
                          onChange={handleChange}
                          className="block w-full px-3 py-2 text-xs border border-gray-200 rounded-md focus:outline-none focus:border-gray-400"
                          placeholder="Enter new password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center"
                        >
                          {showNewPassword ? (
                            <EyeSlashIcon className="h-4 w-4 text-gray-400" />
                          ) : (
                            <EyeIcon className="h-4 w-4 text-gray-400" />
                          )}
                        </button>
                      </div>
                      <p className="mt-1 text-xs text-gray-500">
                        Minimum 8 characters
                      </p>
                    </div>

                    <div>
                      <label htmlFor="confirmPassword" className="block text-xs font-medium text-gray-700 mb-1">
                        Confirm New Password
                      </label>
                      <div className="relative">
                        <input
                          id="confirmPassword"
                          type={showConfirmPassword ? "text" : "password"}
                          name="confirmPassword"
                          value={formData.confirmPassword}
                          onChange={handleChange}
                          className="block w-full px-3 py-2 text-xs border border-gray-200 rounded-md focus:outline-none focus:border-gray-400"
                          placeholder="Confirm new password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center"
                        >
                          {showConfirmPassword ? (
                            <EyeSlashIcon className="h-4 w-4 text-gray-400" />
                          ) : (
                            <EyeIcon className="h-4 w-4 text-gray-400" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={isSubmitting || !formData.currentPassword || !formData.newPassword || !formData.confirmPassword}
                      className="px-4 py-2 text-xs font-medium text-white bg-gray-900 rounded-md hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSubmitting ? 'Updating...' : 'Update Password'}
                    </button>
                  </div>
                </form>

                <div className="mt-8 pt-6 border-t border-gray-100">
                  <h2 className="text-lg font-medium text-gray-900 mb-4">Danger Zone</h2>
                  <div className="mt-2">
                    <button
                      onClick={logout}
                      className="px-4 py-2 text-xs font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                    >
                      Log out all sessions
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
