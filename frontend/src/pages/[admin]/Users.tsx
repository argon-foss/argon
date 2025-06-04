// @ts-nocheck
import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  PlusIcon,
  UserIcon,
  TrashIcon,
  PencilSquareIcon,
  ArrowLeftIcon,
  ChevronDownIcon,
  ExclamationTriangleIcon,
  CheckIcon,
  XMarkIcon,
  ShieldCheckIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";
import LoadingSpinner from "../../components/LoadingSpinner";

interface User {
  id: string;
  username: string;
  permissions: string[];
  createdAt: Date;
  updatedAt: Date;
}

type View = "list" | "create" | "view" | "edit";

interface FormData {
  username: string;
  password: string;
  permissions: string[];
}

// Alert component for displaying error/success messages
interface AlertProps {
  type: "error" | "success" | "warning";
  message: string;
  onDismiss?: () => void;
}

const Alert: React.FC<AlertProps> = ({ type, message, onDismiss }) => {
  const bgColor =
    type === "error"
      ? "bg-red-50"
      : type === "success"
      ? "bg-green-50"
      : "bg-yellow-50";
  const textColor =
    type === "error"
      ? "text-red-600"
      : type === "success"
      ? "text-green-600"
      : "text-yellow-600";
  const borderColor =
    type === "error"
      ? "border-red-100"
      : type === "success"
      ? "border-green-100"
      : "border-yellow-100";

  return (
    <div
      className={`${bgColor} border ${borderColor} rounded-md flex items-start justify-between`}
    >
      <div className="flex items-start p-2">
        {type === "error" || type === "warning" ? (
          <ExclamationTriangleIcon
            className={`w-4 h-4 ${textColor} mr-2 mt-0.5`}
          />
        ) : (
          <CheckIcon className={`w-4 h-4 ${textColor} mr-2 mt-0.5`} />
        )}
        <p className={`text-xs ${textColor}`}>{message}</p>
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className={`ml-2 mr-2 p-1 ${textColor} hover:bg-opacity-10 cursor-pointer rounded-full`}
        >
          <XMarkIcon className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

const AdminUsersPage = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>("list");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [formData, setFormData] = useState<FormData>({
    username: "",
    password: "",
    permissions: ["USER"],
  });
  const [activeTab, setActiveTab] = useState<"users" | "overview">("users");
  const [formError, setFormError] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<
    { id: string; type: "error" | "success" | "warning"; message: string }[]
  >([]);
  const [tableSortField, setTableSortField] = useState<string>("username");
  const [tableSortDirection, setTableSortDirection] = useState<"asc" | "desc">(
    "asc"
  );

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

  console.log(error);

  // Available permissions
  const availablePermissions = [
    {
      id: "ADMIN",
      label: "Administrator",
      description: "Full access to all of Argon & the admin panel",
    },
    { id: "USER", label: "User", description: "Standard user permissions" },
  ];

  useEffect(() => {
    fetchData();
  }, []);

  // Set ref for tab button
  const setTabRef = useCallback(
    (id: string, element: HTMLButtonElement | null) => {
      tabRefsMap.current[id] = element;
    },
    []
  );

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

    // Use requestAnimationFrame for smooth animation
    const animationFrame = requestAnimationFrame(updateIndicator);
    return () => cancelAnimationFrame(animationFrame);
  }, [activeTab]);

  // Initialize the indicator position after component mounts
  useEffect(() => {
    // Set a small delay to ensure DOM is fully rendered
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
  const TabButton = useCallback(
    ({
      id,
      isActive,
      onClick,
      children,
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
          className={`tab-button relative z-5 cursor-pointer px-3 py-1 text-sm font-medium rounded-md transition-all duration-200 outline-none focus:outline-none focus:ring-0 ${
            isActive
              ? "text-gray-800 border-none"
              : "text-gray-500 border-none hover:text-gray-700 hover:bg-gray-50"
          }`}
        >
          {children}
        </button>
      );
    },
    [setTabRef]
  );

  // Helper function to normalize permissions data
  const normalizePermissions = (permissions: any): string[] => {
    if (Array.isArray(permissions)) {
      return permissions;
    }
    if (typeof permissions === "string") {
      try {
        const parsed = JSON.parse(permissions);
        return Array.isArray(parsed) ? parsed : [permissions];
      } catch {
        return [permissions];
      }
    }
    if (permissions && typeof permissions === "object") {
      // Handle case where permissions might be an object with array values
      if (permissions.permissions && Array.isArray(permissions.permissions)) {
        return permissions.permissions;
      }
      // Convert object keys to array
      return Object.keys(permissions);
    }
    return [];
  };

  // Helper function to normalize user data
  const normalizeUser = (userData: any): User => {
    return {
      ...userData,
      permissions: normalizePermissions(userData.permissions),
      createdAt: new Date(userData.createdAt),
      updatedAt: new Date(userData.updatedAt),
    };
  };

  // Show alert message
  const showAlert = useCallback(
    (type: "error" | "success" | "warning", message: string) => {
      const id = Date.now().toString();
      setAlerts((prev) => [...prev, { id, type, message }]);

      // Auto-dismiss after 5 seconds
      setTimeout(() => {
        setAlerts((prev) => prev.filter((alert) => alert.id !== id));
      }, 5000);

      return id;
    },
    []
  );

  // Dismiss specific alert
  const dismissAlert = useCallback((id: string) => {
    setAlerts((prev) => prev.filter((alert) => alert.id !== id));
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };

      const response = await fetch("/api/users", { headers });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch users");
      }

      const usersData = await response.json();

      // Normalize and format users data
      const formattedUsers = usersData.map((user: any) => normalizeUser(user));

      setUsers(formattedUsers);
      setError(null);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "An error occurred";
      setError(errorMessage);
      showAlert("error", errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const fetchSingleUser = async (userId: string) => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const response = await fetch(`/api/users/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch user");
      }

      const userData = await response.json();

      // Normalize user data
      const formattedUser = normalizeUser(userData);

      // Update the user in the users list
      setUsers((prevUsers) =>
        prevUsers.map((user) => (user.id === userId ? formattedUser : user))
      );

      // Update selected user if this is the one we're viewing
      if (selectedUser && selectedUser.id === userId) {
        setSelectedUser(formattedUser);
      }

      setError(null);
      return formattedUser;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "An error occurred";
      showAlert("error", errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    try {
      const token = localStorage.getItem("token");
      const response = await fetch("/api/users", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMessage = Array.isArray(data.error)
          ? data.error.map((e: any) => e.message).join(", ")
          : data.error || "Failed to create user";

        throw new Error(errorMessage);
      }

      await fetchData();
      setView("list");
      setFormData({ username: "", password: "", permissions: ["USER"] });
      showAlert("success", `User "${formData.username}" created successfully`);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to create user";
      setFormError(errorMessage);
      showAlert("error", errorMessage);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setFormError(null);

    try {
      const token = localStorage.getItem("token");
      const payload = { ...formData };

      // If password is empty, remove it from the payload
      if (!payload.password) {
        delete (payload as any).password;
      }

      const response = await fetch(`/api/users/${selectedUser.id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMessage = Array.isArray(data.error)
          ? data.error.map((e: any) => e.message).join(", ")
          : data.error || "Failed to update user";

        throw new Error(errorMessage);
      }

      await fetchData();
      showAlert("success", `User "${formData.username}" updated successfully`);

      // Fetch the updated user and update selected user
      const updatedUser = await fetchSingleUser(selectedUser.id);
      if (updatedUser) {
        setSelectedUser(updatedUser);
      }

      setView("view");
      setFormData({ username: "", password: "", permissions: ["USER"] });
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to update user";
      setFormError(errorMessage);
      showAlert("error", errorMessage);
    }
  };

  const handleDelete = async (userId: string) => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`/api/users/${userId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete user");
      }

      await fetchData();
      if (selectedUser?.id === userId) {
        setView("list");
        setSelectedUser(null);
      }

      showAlert("success", "User deleted successfully");
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to delete user";
      showAlert("error", errorMessage);
    }
  };

  const handleTableSort = (field: string) => {
    if (tableSortField === field) {
      setTableSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setTableSortField(field);
      setTableSortDirection("asc");
    }
  };

  const getSortedUsers = () => {
    return [...users].sort((a, b) => {
      let comparison = 0;

      switch (tableSortField) {
        case "username":
          comparison = a.username.localeCompare(b.username);
          break;
        case "permissions":
          comparison =
            (a.permissions?.length || 0) - (b.permissions?.length || 0);
          break;
        case "createdAt":
          comparison = a.createdAt.getTime() - b.createdAt.getTime();
          break;
        default:
          comparison = 0;
      }

      return tableSortDirection === "asc" ? comparison : -comparison;
    });
  };

  const togglePermission = (permission: string) => {
    setFormData((prevData) => {
      if (prevData.permissions.includes(permission)) {
        return {
          ...prevData,
          permissions: prevData.permissions.filter((p) => p !== permission),
        };
      } else {
        return {
          ...prevData,
          permissions: [...prevData.permissions, permission],
        };
      }
    });
  };

  const renderForm = (type: "create" | "edit") => (
    <form
      onSubmit={type === "create" ? handleCreate : handleEdit}
      className="space-y-4 max-w-lg"
    >
      {formError && (
        <Alert
          type="error"
          message={formError}
          onDismiss={() => setFormError(null)}
        />
      )}

      <div className="space-y-1">
        <label className="block text-xs font-medium text-gray-700">
          Username
        </label>
        <input
          type="text"
          value={formData.username}
          onChange={(e) =>
            setFormData({ ...formData, username: e.target.value })
          }
          className="block w-full px-3 py-2 text-xs border border-gray-200 rounded-md focus:outline-none focus:border-gray-400"
          placeholder="john.doe"
          required
          maxLength={100}
        />
        <p className="text-xs text-gray-500 mt-1">
          A unique username for this user
        </p>
      </div>

      <div className="space-y-1">
        <label className="block text-xs font-medium text-gray-700">
          Password{" "}
          {type === "edit" && (
            <span className="text-gray-500">(leave blank to keep current)</span>
          )}
        </label>
        <input
          type="password"
          value={formData.password}
          onChange={(e) =>
            setFormData({ ...formData, password: e.target.value })
          }
          className="block w-full px-3 py-2 text-xs border border-gray-200 rounded-md focus:outline-none focus:border-gray-400"
          placeholder="••••••••"
          required={type === "create"}
        />
        <p className="text-xs text-gray-500 mt-1">
          {type === "create"
            ? "Must be at least 8 characters long"
            : "Enter a new password or leave blank to keep the current one"}
        </p>
      </div>

      <div className="space-y-1">
        <label className="block text-xs font-medium text-gray-700">
          Permissions
        </label>
        <div className="mt-2 space-y-2 border border-gray-200 rounded-md p-3">
          {availablePermissions.map((permission) => (
            <div key={permission.id} className="flex items-start space-x-2">
              <input
                type="checkbox"
                id={`permission-${permission.id}`}
                checked={formData.permissions.includes(permission.id)}
                onChange={() => togglePermission(permission.id)}
                className="mt-0.5"
              />
              <div className="flex-1">
                <label
                  htmlFor={`permission-${permission.id}`}
                  className="text-xs font-medium text-gray-700 cursor-pointer"
                >
                  {permission.label}
                </label>
                <p className="text-xs text-gray-500">
                  {permission.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center space-x-3">
        <button
          type="submit"
          className="px-3 py-2 text-xs font-medium text-white bg-gray-900 rounded-md hover:bg-gray-800"
        >
          {type === "create" ? "Create User" : "Update User"}
        </button>
        <button
          type="button"
          onClick={() => {
            setView(type === "edit" ? "view" : "list");
            if (type === "create") setSelectedUser(null);
            setFormData({ username: "", password: "", permissions: ["USER"] });
          }}
          className="px-3 py-2 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-md hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );

  const renderPermissionBadges = (permissions: string[] | any) => {
    // Normalize permissions to ensure it's always an array
    const normalizedPermissions = normalizePermissions(permissions);

    if (!normalizedPermissions || normalizedPermissions.length === 0) {
      return (
        <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-500">
          No permissions
        </span>
      );
    }

    return (
      <div className="flex flex-wrap gap-1">
        {normalizedPermissions.map((permission, index) => {
          const permInfo = availablePermissions.find(
            (p) => p.id === permission
          );
          return (
            <span
              key={`${permission}-${index}`}
              className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-700"
              title={permInfo?.description}
            >
              {permInfo?.label || permission}
            </span>
          );
        })}
      </div>
    );
  };

  const renderUserView = () => {
    if (!selectedUser) return null;

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => {
                setView("list");
                setSelectedUser(null);
              }}
              className="flex items-center text-gray-600 hover:bg-gray-100 p-2 cursor-pointer rounded-md transition hover:text-gray-900"
            >
              <ArrowLeftIcon className="w-4 h-4" />
            </button>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {selectedUser.username}
              </h2>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => {
                setFormData({
                  username: selectedUser.username,
                  password: "",
                  permissions: selectedUser.permissions || [],
                });
                setView("edit");
              }}
              className="flex items-center px-3 py-2 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-md hover:bg-gray-50"
            >
              <PencilSquareIcon className="w-4 h-4" />
              Edit
            </button>
            <button
              onClick={() => handleDelete(selectedUser.id)}
              className="flex items-center px-3 py-2 text-xs font-medium text-red-600 bg-white border border-gray-200 rounded-md hover:bg-red-50"
            >
              <TrashIcon className="w-4 h-4" />
              Delete
            </button>
          </div>
        </div>

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
                transitionDelay: "30ms",
              }}
            />

            {/* Tab buttons */}
            <TabButton
              id="overview"
              isActive={activeTab === "overview"}
              onClick={() => setActiveTab("overview")}
            >
              Overview
            </TabButton>

            <TabButton
              id="permissions"
              isActive={activeTab === "permissions"}
              onClick={() => setActiveTab("permissions")}
            >
              Permissions
            </TabButton>
          </div>
        </div>

        {activeTab === "overview" ? (
          <div className="bg-white border border-gray-200 rounded-md shadow-xs">
            <div className="px-6 py-4">
              <div className="space-y-4">
                <div>
                  <div className="text-xs text-gray-500">User ID</div>
                  <div className="text-sm font-mono mt-1">
                    {selectedUser.id}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Username</div>
                  <div className="text-sm mt-1">{selectedUser.username}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Permissions</div>
                  <div className="mt-1">
                    {renderPermissionBadges(selectedUser.permissions)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Created At</div>
                  <div className="text-sm mt-1">
                    {selectedUser.createdAt.toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Updated At</div>
                  <div className="text-sm mt-1">
                    {selectedUser.updatedAt.toLocaleString()}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-md shadow-xs">
            <div className="px-6 py-4">
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-900">
                    User Permissions
                  </h3>
                  <p className="text-xs text-gray-500 mt-1">
                    Permissions determine what actions the user can perform in
                    the system.
                  </p>
                </div>

                <div className="space-y-3">
                  {availablePermissions.map((permission) => {
                    const userPermissions = normalizePermissions(
                      selectedUser.permissions
                    );
                    const hasPermission = userPermissions.includes(
                      permission.id
                    );

                    return (
                      <div
                        key={permission.id}
                        className={`p-3 rounded-md border ${
                          hasPermission
                            ? "bg-gray-50 border-gray-200"
                            : "bg-white border-gray-100"
                        }`}
                      >
                        <div className="flex items-start">
                          <div
                            className={`mt-0.5 mr-3 ${
                              hasPermission ? "text-gray-700" : "text-gray-300"
                            }`}
                          >
                            <ShieldCheckIcon className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {permission.label}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              {permission.description}
                            </div>
                            <div className="text-xs mt-1">
                              {hasPermission ? (
                                <span className="text-green-600">Granted</span>
                              ) : (
                                <span className="text-gray-400">
                                  Not granted
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderUserTable = () => {
    const sortedUsers = getSortedUsers();

    return (
      <div className="overflow-x-auto rounded-lg">
        <table className="min-w-full border-collapse">
          <thead>
            <tr className="bg-transparent">
              <th
                className="p-3 text-left text-xs font-medium text-gray-600 tracking-wider cursor-pointer"
                onClick={() => handleTableSort("username")}
              >
                <div className="flex items-center">
                  Username
                  {tableSortField === "username" && (
                    <ChevronDownIcon
                      className={`w-4 h-4 ml-1 ${
                        tableSortDirection === "desc"
                          ? "transform rotate-180"
                          : ""
                      }`}
                    />
                  )}
                </div>
              </th>
              <th
                className="p-3 text-left text-xs font-medium text-gray-600 tracking-wider cursor-pointer"
                onClick={() => handleTableSort("permissions")}
              >
                <div className="flex items-center">
                  Permissions
                  {tableSortField === "permissions" && (
                    <ChevronDownIcon
                      className={`w-4 h-4 ml-1 ${
                        tableSortDirection === "desc"
                          ? "transform rotate-180"
                          : ""
                      }`}
                    />
                  )}
                </div>
              </th>
              <th
                className="p-3 text-left text-xs font-medium text-gray-600 tracking-wider cursor-pointer"
                onClick={() => handleTableSort("createdAt")}
              >
                <div className="flex items-center">
                  Created
                  {tableSortField === "createdAt" && (
                    <ChevronDownIcon
                      className={`w-4 h-4 ml-1 ${
                        tableSortDirection === "desc"
                          ? "transform rotate-180"
                          : ""
                      }`}
                    />
                  )}
                </div>
              </th>
              <th className="p-3 text-right text-xs font-medium text-gray-600 tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {sortedUsers.map((user) => (
              <tr
                key={user.id}
                className="hover:bg-gray-50 cursor-pointer"
                onClick={() => {
                  setSelectedUser(user);
                  setView("view");
                }}
              >
                <td className="p-3 text-xs text-gray-900">
                  <div className="flex items-center">
                    <UserIcon className="h-4 w-4 text-gray-400 mr-2" />
                    <span className="font-medium">{user.username}</span>
                  </div>
                </td>
                <td className="p-3 text-xs">
                  {renderPermissionBadges(user.permissions)}
                </td>
                <td className="p-3 text-xs text-gray-500">
                  {user.createdAt.toLocaleDateString()}
                </td>
                <td className="p-3 text-right whitespace-nowrap">
                  <div
                    className="flex items-center justify-end space-x-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setFormData({
                          username: user.username,
                          password: "",
                          permissions: user.permissions || [],
                        });
                        setSelectedUser(user);
                        setView("edit");
                      }}
                      className="p-1 text-gray-400 hover:text-gray-600"
                    >
                      <PencilSquareIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(user.id);
                      }}
                      className="p-1 text-gray-400 hover:text-red-600"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="p-4 text-center text-gray-500 text-xs"
                >
                  No users found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  };

  const stats = {
    total: users.length,
    admins: users.filter((u) => u.permissions.includes("ADMIN")).length,
    regularUsers: users.filter((u) => !u.permissions.includes("ADMIN")).length,
  };

  if (loading && users.length === 0) {
    return <LoadingSpinner />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-6">
        {/* Global Alerts */}
        {alerts.length > 0 && (
          <div className="mb-4 space-y-2">
            {alerts.map((alert) => (
              <Alert
                key={alert.id}
                type={alert.type}
                message={alert.message}
                onDismiss={() => dismissAlert(alert.id)}
              />
            ))}
          </div>
        )}

        <div className="transition-all duration-200 ease-in-out">
          {view === "list" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-lg font-semibold text-gray-900">Users</h1>
                  <p className="text-xs text-gray-500 mt-1">
                    Manage users and their permissions for accessing the panel.
                  </p>
                </div>
                <div className="flex space-x-3">
                  <button
                    onClick={fetchData}
                    className="flex items-center px-3 py-2 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-md hover:bg-gray-50"
                  >
                    <ArrowPathIcon className="h-4 w-4 mr-2" />
                    Refresh
                  </button>
                  <button
                    onClick={() => setView("create")}
                    className="flex items-center px-3 py-2 text-xs font-medium text-white bg-gray-900 rounded-md hover:bg-gray-800"
                  >
                    <PlusIcon className="w-4 h-4" />
                    Create User
                  </button>
                </div>
              </div>

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
                      transitionDelay: "30ms",
                    }}
                  />

                  {/* Tab buttons */}
                  <TabButton
                    id="users"
                    isActive={activeTab === "users"}
                    onClick={() => setActiveTab("users")}
                  >
                    All users{" "}
                    <span className="text-gray-500 ml-0.5">{stats.total}</span>
                  </TabButton>

                  <TabButton
                    id="overview"
                    isActive={activeTab === "overview"}
                    onClick={() => setActiveTab("overview")}
                  >
                    Overview
                  </TabButton>
                </div>
              </div>

              {/* Content based on active tab */}
              {activeTab === "users" && (
                <div className="bg-white border border-gray-200 rounded-md shadow-xs">
                  {renderUserTable()}
                </div>
              )}

              {activeTab === "overview" && (
                <div className="">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="border border-gray-200 bg-[#FFFFFF] rounded-md p-4">
                      <div className="text-gray-500 text-sm mb-1">
                        Total Users
                      </div>
                      <div className="text-2xl font-medium">{stats.total}</div>
                    </div>
                    <div className="border border-gray-200 bg-white rounded-md p-4">
                      <div className="text-gray-500 text-sm mb-1">
                        Administrators
                      </div>
                      <div className="flex items-center">
                        <div className="h-2 w-2 rounded-full bg-blue-400 mr-2"></div>
                        <div className="text-2xl font-medium">
                          {stats.admins}
                        </div>
                      </div>
                    </div>
                    <div className="border border-gray-200 bg-white rounded-md p-4">
                      <div className="text-gray-500 text-sm mb-1">
                        Regular Users
                      </div>
                      <div className="flex items-center">
                        <div className="h-2 w-2 rounded-full bg-gray-400 mr-2"></div>
                        <div className="text-2xl font-medium">
                          {stats.regularUsers}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {view === "create" && (
            <div className="space-y-6">
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => {
                    setView("list");
                    setSelectedUser(null);
                  }}
                  className="flex items-center text-gray-600 hover:bg-gray-100 p-2 cursor-pointer rounded-md transition hover:text-gray-900"
                >
                  <ArrowLeftIcon className="w-4 h-4" />
                </button>
                <div>
                  <h1 className="text-lg font-semibold text-gray-900">
                    Create User
                  </h1>
                </div>
              </div>
              {renderForm("create")}
            </div>
          )}

          {view === "edit" && (
            <div className="space-y-6">
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => {
                    setView("view");
                    setFormData({
                      username: "",
                      password: "",
                      permissions: ["USER"],
                    });
                  }}
                  className="flex items-center text-gray-600 hover:bg-gray-100 p-2 cursor-pointer rounded-md transition hover:text-gray-900"
                >
                  <ArrowLeftIcon className="w-4 h-4" />
                </button>
                <div>
                  <h1 className="text-lg font-semibold text-gray-900">
                    Edit User
                  </h1>
                </div>
              </div>
              {renderForm("edit")}
            </div>
          )}

          {view === "view" && renderUserView()}
        </div>
      </div>
    </div>
  );
};

export default AdminUsersPage;
