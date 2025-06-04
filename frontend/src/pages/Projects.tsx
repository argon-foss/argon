import React, { useState } from 'react';
import { FolderIcon, PlusIcon, PencilIcon, TrashIcon, AlertTriangleIcon, XIcon, CheckIcon, RefreshCwIcon } from 'lucide-react';
import { useProjects } from '../contexts/ProjectContext';
import LoadingSpinner from '../components/LoadingSpinner';

// Modal component with consistent styling
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: string;
}

const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  children,
  maxWidth = 'w-[400px]'
}) => {
  const modalRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'auto';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-900/50 flex items-center justify-center z-50">
      <div
        ref={modalRef}
        className={`bg-white rounded-xl shadow-xl ${maxWidth} transform transition-all duration-100`}
      >
        {children}
      </div>
    </div>
  );
};

// Alert component with consistent styling
interface AlertProps {
  type: 'error' | 'success' | 'warning';
  message: string;
  onDismiss?: () => void;
}

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
        <p className={`text-xs ${textColor}`}>{message}</p>
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

// Project Dialog component with consistent styling
interface ProjectDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  initialName: string;
  initialDescription: string;
  onSubmit: (name: string, description: string) => Promise<void>;
  isSubmitting: boolean;
  error: string | null;
}

const ProjectDialog: React.FC<ProjectDialogProps> = ({
  isOpen,
  onClose,
  title,
  initialName,
  initialDescription,
  onSubmit,
  isSubmitting,
  error
}) => {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);

  React.useEffect(() => {
    setName(initialName);
    setDescription(initialDescription);
  }, [initialName, initialDescription]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(name, description);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">{title}</h3>
        {error && (
          <Alert
            type="error"
            message={error}
          />
        )}
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                Project Name
              </label>
              <input
                type="text"
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-200 placeholder:text-gray-500"
                placeholder="Enter project name"
                required
                autoFocus
              />
            </div>
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                Description (Optional)
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-200 placeholder:text-gray-500"
                placeholder="Enter project description"
                rows={3}
              />
            </div>
          </div>
          <div className="flex justify-end space-x-2 mt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors duration-100"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-md hover:bg-gray-800 transition-colors duration-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
};

// Confirm Dialog component with consistent styling
interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  confirmText: string;
  onConfirm: () => Promise<void>;
  isSubmitting: boolean;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  title,
  message,
  confirmText,
  onConfirm,
  isSubmitting
}) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="mb-6">
        <p className="text-sm text-gray-600">{message}</p>
      </div>
      <div className="flex justify-end space-x-3">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-md hover:bg-gray-50 transition-colors duration-150"
          disabled={isSubmitting}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={isSubmitting}
          className="px-4 py-2 text-xs font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 focus:outline-none transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Deleting...' : confirmText}
        </button>
      </div>
    </Modal>
  );
};

const ProjectsPage: React.FC = () => {
  const {
    projects,
    loading,
    error,
    createProject,
    updateProject,
    deleteProject,
    fetchProjects
  } = useProjects();

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<{ id: string; name: string; description: string }>({
    id: '',
    name: '',
    description: ''
  });
  const [deletingProjectId, setDeletingProjectId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleCreateProject = async (name: string, description: string) => {
    setFormError(null);
    try {
      setIsSubmitting(true);
      await createProject(name, description);
      setIsCreateDialogOpen(false);
      setSuccessMessage('Project created successfully');

      setTimeout(() => {
        setSuccessMessage(null);
      }, 3000);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Failed to create project');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateProject = async (name: string, description: string) => {
    setFormError(null);
    try {
      setIsSubmitting(true);
      await updateProject(editingProject.id, name, description);
      setIsEditDialogOpen(false);
      setSuccessMessage('Project updated successfully');

      setTimeout(() => {
        setSuccessMessage(null);
      }, 3000);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Failed to update project');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteProject = async () => {
    try {
      setIsSubmitting(true);
      await deleteProject(deletingProjectId);
      setIsDeleteDialogOpen(false);
      setSuccessMessage('Project deleted successfully');

      setTimeout(() => {
        setSuccessMessage(null);
      }, 3000);
    } catch (error) {
      console.error('Failed to delete project:', error);
      setFormError(error instanceof Error ? error.message : 'Failed to delete project');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-red-600 text-sm">Failed to load projects: {error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="w-full mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-800">Projects</h1>
            <p className="text-sm text-gray-500">
              Manage your projects and organize your servers
            </p>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={fetchProjects}
              className="flex items-center px-4 py-2 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-md hover:bg-gray-50 transition-colors duration-150"
            >
              <RefreshCwIcon className="h-4 w-4 mr-2" />
              Refresh
            </button>
            <button
              onClick={() => {
                setFormError(null);
                setIsCreateDialogOpen(true);
              }}
              className="flex items-center px-4 py-2 text-xs font-medium text-white bg-gray-900 rounded-md hover:bg-gray-800 transition-colors duration-150"
            >
              <PlusIcon className="h-4 w-4 mr-2" />
              New Project
            </button>
          </div>
        </div>

        {/* Success Message */}
        {successMessage && (
          <Alert
            type="success"
            message={successMessage}
            onDismiss={() => setSuccessMessage(null)}
          />
        )}

        {/* Form Error */}
        {formError && (
          <Alert
            type="error"
            message={formError}
            onDismiss={() => setFormError(null)}
          />
        )}

        {/* Projects Grid */}
        {projects.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project) => (
              <div
                key={project.id}
                className="bg-white rounded-md border border-gray-200 shadow-xs overflow-hidden transition-shadow duration-200 hover:shadow-sm"
              >
                <div className="p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center">
                      <div className="h-8 w-8 bg-gray-100 rounded-lg flex items-center justify-center mr-3">
                        <span className="text-sm font-semibold text-gray-800">
                          {project.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <h3 className="text-sm font-medium text-gray-900">
                          {project.name}
                          {project.isDefault && (
                            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800">
                              Default
                            </span>
                          )}
                        </h3>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {project.serverCount} server{project.serverCount !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                    {!project.isDefault && (
                      <div className="flex space-x-1">
                        <button
                          onClick={() => {
                            setEditingProject({
                              id: project.id,
                              name: project.name,
                              description: project.description || ''
                            });
                            setFormError(null);
                            setIsEditDialogOpen(true);
                          }}
                          className="p-1.5 text-gray-400 hover:text-gray-800 rounded-full hover:bg-gray-100 transition-colors duration-150"
                          title="Edit project"
                        >
                          <PencilIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => {
                            setDeletingProjectId(project.id);
                            setFormError(null);
                            setIsDeleteDialogOpen(true);
                          }}
                          className="p-1.5 text-gray-400 hover:text-red-600 rounded-full hover:bg-gray-100 transition-colors duration-150"
                          title="Delete project"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-24 bg-white rounded-lg border border-gray-200">
            <div className="w-16 h-16 bg-gray-100 rounded-xl mb-6 flex items-center justify-center">
              <FolderIcon className="w-8 h-8 text-gray-400" />
            </div>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">
              No projects yet
            </h2>
            <p className="text-gray-500 text-center max-w-md mb-6">
              Create your first project to organize your servers better
            </p>
            <button
              onClick={() => {
                setFormError(null);
                setIsCreateDialogOpen(true);
              }}
              className="flex items-center px-4 py-2 text-xs font-medium text-white bg-gray-900 rounded-md hover:bg-gray-800 transition-colors duration-150"
            >
              <PlusIcon className="h-4 w-4 mr-2" />
              Create First Project
            </button>
          </div>
        )}
      </div>

      {/* Create Project Dialog */}
      <ProjectDialog
        isOpen={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
        title="Create New Project"
        initialName=""
        initialDescription=""
        onSubmit={handleCreateProject}
        isSubmitting={isSubmitting}
        error={formError}
      />

      {/* Edit Project Dialog */}
      <ProjectDialog
        isOpen={isEditDialogOpen}
        onClose={() => setIsEditDialogOpen(false)}
        title="Edit Project"
        initialName={editingProject.name}
        initialDescription={editingProject.description}
        onSubmit={handleUpdateProject}
        isSubmitting={isSubmitting}
        error={formError}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        title="Delete Project"
        message="Are you sure you want to delete this project? This action cannot be undone."
        confirmText="Delete Project"
        onConfirm={handleDeleteProject}
        isSubmitting={isSubmitting}
      />
    </div>
  );
};

export default ProjectsPage;
