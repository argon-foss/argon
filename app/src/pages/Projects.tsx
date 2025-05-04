import React, { useState } from 'react';
import { FolderIcon, PlusIcon, PencilIcon, TrashIcon, AlertTriangleIcon, XIcon, CheckIcon } from 'lucide-react';
import { useProjects } from '../contexts/ProjectContext';
import LoadingSpinner from '../components/LoadingSpinner';

// Reusing the modal and alert components from ProjectSwitcher for consistency
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
  title, 
  children, 
  maxWidth = 'max-w-md' 
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
    <div className="fixed inset-0 bg-gray-100 bg-opacity-50 z-50 flex items-center justify-center p-4 transition-opacity duration-200 ease-in-out animate-fade-in">
      <div 
        ref={modalRef}
        className={`bg-white rounded-lg shadow-xs w-full ${maxWidth} transform transition-all duration-200 ease-in-out animate-scale-in`}
      >
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">{title}</h3>
          <button 
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors duration-150"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>
        <div className="px-6 py-4">
          {children}
        </div>
      </div>
    </div>
  );
};

// Alert component for form errors/warnings
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
  
  // Dialog for creating/editing projects
  interface ProjectDialogProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    initialName: string;
    initialDescription: string;
    onSubmit: (name: string, description: string) => void;
    isSubmitting: boolean;
    error?: string | null;
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
    const [formError, setFormError] = useState<string | null>(error || null);
  
    React.useEffect(() => {
      setName(initialName);
      setDescription(initialDescription);
      setFormError(error ?? null);
    }, [initialName, initialDescription, error, isOpen]);
  
    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      
      if (!name.trim()) {
        setFormError('Project name is required');
        return;
      }
      
      onSubmit(name, description);
    };
  
    return (
      <Modal isOpen={isOpen} onClose={onClose} title={title}>
        {formError && (
          <Alert 
            type="error" 
            message={formError} 
            onDismiss={() => setFormError(null)} 
          />
        )}
        
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Project Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400"
              placeholder="My Project"
              required
              autoFocus
            />
          </div>
          <div className="mb-6">
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Description (optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400"
              placeholder="Brief description of this project"
              rows={3}
            />
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
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="px-4 py-2 text-xs font-medium text-white bg-gray-900 border border-transparent rounded-md hover:bg-gray-800 focus:outline-none transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </Modal>
    );
  };
  
  // Confirmation dialog
  interface ConfirmDialogProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    message: string;
    confirmText: string;
    onConfirm: () => void;
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
        
        // Clear success message after 3 seconds
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
        
        // Clear success message after 3 seconds
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
        
        // Clear success message after 3 seconds
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
  
    const refreshProjects = () => {
      fetchProjects();
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
            <h1 className="text-2xl font-semibold text-gray-800">Projects</h1>
            <div className="flex space-x-3">
              <button
                onClick={refreshProjects}
                className="flex items-center px-4 py-2 text-xs font-medium text-gray-600 border border-gray-200 bg-white rounded-md hover:bg-gray-50 transition-colors duration-150"
              >
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
          
          {/* Form Error (if any) */}
          {formError && (
            <Alert 
              type="error"
              message={formError}
              onDismiss={() => setFormError(null)}
            />
          )}
  
          {/* Projects Grid */}
          {projects.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {projects.map((project) => (
                <div 
                  key={project.id}
                  className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-xs transition-shadow duration-200"
                >
                  <div className="p-5">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center">
                        <div className="h-10 w-10 bg-gray-100 rounded-lg flex items-center justify-center mr-3">
                          <span className="text-lg font-semibold text-gray-800">
                            {project.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">
                            {project.name}
                            {project.isDefault && (
                              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800">
                                Default
                              </span>
                            )}
                          </h3>
                          <p className="text-sm text-gray-500">
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
            <div className="flex flex-col items-center justify-center py-16 bg-white rounded-lg border border-gray-200">
              <div className="w-32 h-32 mb-6">
                <FolderIcon className="w-full h-full text-gray-300" />
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
                className="flex items-center px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-md hover:bg-gray-800 transition-colors duration-150"
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
          message="Are you sure you want to delete this project? All servers will be moved to the Default project."
          confirmText="Delete Project"
          onConfirm={handleDeleteProject}
          isSubmitting={isSubmitting}
        />
      </div>
    );
  };
  
  export default ProjectsPage;