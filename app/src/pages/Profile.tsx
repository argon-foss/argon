import React, { useState } from 'react';
import { Eye, EyeOff, AlertTriangleIcon, CheckIcon, XIcon } from 'lucide-react';
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
          <AlertTriangleIcon className={`w-4 h-4 ${textColor} mr-2 mt-0.5`} />
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
          <XIcon className="w-4 h-4" />
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
      <div className="">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-800">Account Settings</h1>
          <p className="text-sm text-gray-500">
            Manage your account information and security settings
          </p>
        </div>
        
        {/* Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <div className="flex">
            <button
              onClick={() => setActiveTab('profile')}
              className={`pb-3 text-sm font-medium relative ${
                activeTab === 'profile'
                  ? 'text-gray-800 border-indigo-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Profile
              {activeTab === 'profile' && (
                <div className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-600"></div>
              )}
            </button>
            <button
              onClick={() => setActiveTab('security')}
              className={`pb-3 ml-6 text-sm font-medium relative ${
                activeTab === 'security'
                  ? 'text-gray-800 border-indigo-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Security
              {activeTab === 'security' && (
                <div className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-600"></div>
              )}
            </button>
          </div>
        </div>
        
        {/* Content based on active tab */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-xs">
          <div className="p-6">
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
            
            {activeTab === 'profile' && (
              <div>
                <h2 className="text-lg font-medium text-gray-900 mb-1">Profile Information</h2>
                <div className="text-gray-400 text-xs font-normal uppercase tracking-widest mb-4 mt-2">Current Username: {user?.username}</div>
                <div className="mb-6">
                  <form onSubmit={handleSubmit}>
                    <div className="mb-4">
                      <label htmlFor="newUsername" className="block text-sm font-medium text-gray-700 mb-1">
                        New Username
                      </label>
                      <input
                        id="newUsername"
                        type="text"
                        name="newUsername"
                        value={formData.newUsername}
                        onChange={handleChange}
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        placeholder="Enter new username"
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        Leave blank if you don't want to change your username
                      </p>
                    </div>
                    
                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={isSubmitting || (!formData.newUsername && !formData.currentPassword)}
                        className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
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
                      <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700 mb-1">
                        Current Password
                      </label>
                      <div className="relative">
                        <input
                          id="currentPassword"
                          type={showCurrentPassword ? "text" : "password"}
                          name="currentPassword"
                          value={formData.currentPassword}
                          onChange={handleChange}
                          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          placeholder="Enter current password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          {showCurrentPassword ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                    
                    <div>
                      <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-1">
                        New Password
                      </label>
                      <div className="relative">
                        <input
                          id="newPassword"
                          type={showNewPassword ? "text" : "password"}
                          name="newPassword"
                          value={formData.newPassword}
                          onChange={handleChange}
                          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          placeholder="Enter new password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          {showNewPassword ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                      <p className="mt-1 text-xs text-gray-500">
                        Minimum 8 characters
                      </p>
                    </div>
                    
                    <div>
                      <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                        Confirm New Password
                      </label>
                      <div className="relative">
                        <input
                          id="confirmPassword"
                          type={showConfirmPassword ? "text" : "password"}
                          name="confirmPassword"
                          onChange={handleChange}
                          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          placeholder="Confirm new password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          {showConfirmPassword ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={isSubmitting || !formData.currentPassword || !formData.newPassword || !formData.confirmPassword}
                      className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSubmitting ? 'Updating...' : 'Update Password'}
                    </button>
                  </div>
                </form>
                
                <div className="mt-8 pt-6 border-t border-gray-100">
                  <h2 className="text-lg font-medium text-gray-900 mb-4">Danger Zone</h2>
                  <div className="bg-red-50 border border-red-100 rounded-md p-4">
                    <h3 className="text-sm font-medium text-red-800 mb-2">Log Out of All Sessions</h3>
                    <p className="text-sm text-red-600 mb-4">
                      This will log you out from all devices where you're currently logged in.
                    </p>
                    <button
                      onClick={logout}
                      className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                    >
                      Log Out Everywhere
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