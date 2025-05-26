import React, { useState, useEffect } from 'react';
import { useSystem } from '../../contexts/SystemContext'; // Adjust path as necessary
import { ArrowLeftIcon } from 'lucide-react'; // Or any other icon library you're using

const AdminSettingsPage: React.FC = () => {
  const { systemInfo, loading: systemLoading, error: systemError, updatePanelName } = useSystem(); // Added updatePanelName
  const [panelName, setPanelName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (systemInfo && systemInfo.name) {
      setPanelName(systemInfo.name);
    }
  }, [systemInfo]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setFormError(null);
    setSuccessMessage(null);

    const token = localStorage.getItem('token');
    if (!token) {
      setFormError('Authentication token not found. Please log in again.');
      setIsLoading(false);
      return;
    }

    if (!panelName.trim()) {
      setFormError('Panel name cannot be empty.');
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/system/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ panel_name: panelName }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Error: ${response.status}`);
      }

      // Success
      updatePanelName(panelName); // Update context
      setSuccessMessage('Panel name updated successfully!');
      // Optionally, refetch systemInfo from context if it was more complex
      // Or if the backend returns the full updated object, use that.
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
      setFormError(`Failed to update panel name: ${errorMessage}`);
      // Restore original name on error if desired, or let user correct
      // if (systemInfo && systemInfo.name) {
      //   setPanelName(systemInfo.name);
      // }
    } finally {
      setIsLoading(false);
    }
  };

  if (systemLoading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <p className="text-gray-500 text-sm">Loading settings...</p>
      </div>
    );
  }

  if (systemError) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
          Error loading system information: {systemError}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-6">
        <div className="space-y-6">
          <div className="flex items-center space-x-3">
            {/* Optional: Back button if this page is part of a nested admin structure */}
            {/* <button
              onClick={() => window.history.back()}
              className="p-2 rounded-md hover:bg-gray-100"
            >
              <ArrowLeftIcon className="w-5 h-5 text-gray-600" />
            </button> */}
            <div>
              <h1 className="text-lg font-semibold text-gray-900">System Settings</h1>
              <p className="text-xs text-gray-500 mt-1">
                Manage system-wide settings for your panel.
              </p>
            </div>
          </div>

          {formError && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-xs">
              {formError}
            </div>
          )}
          {successMessage && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md text-xs">
              {successMessage}
            </div>
          )}

          <div className="bg-white border border-gray-200 rounded-md shadow-xs">
            <form onSubmit={handleSave}>
              <div className="p-6 space-y-4">
                <div className="space-y-1">
                  <label htmlFor="panelName" className="block text-xs font-medium text-gray-700">
                    Panel Name
                  </label>
                  <input
                    type="text"
                    id="panelName"
                    value={panelName}
                    onChange={(e) => setPanelName(e.target.value)}
                    className="block w-full max-w-md px-3 py-2 text-xs border border-gray-200 rounded-md focus:outline-none focus:border-gray-400"
                    placeholder="Your Panel Name"
                    disabled={isLoading}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    This name will be displayed throughout the panel.
                  </p>
                </div>
              </div>
              <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 flex justify-end">
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-medium text-white bg-gray-900 rounded-md hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900 disabled:opacity-50"
                  disabled={isLoading || !panelName.trim() || (systemInfo && panelName === systemInfo.name)}
                >
                  {isLoading ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminSettingsPage;
