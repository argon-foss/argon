import React, { useState, useRef, useEffect } from 'react';
import { useProjects } from '../contexts/ProjectContext';
import { 
  ChevronDownIcon, 
  PlusIcon, 
  PencilIcon, 
  TrashIcon, 
  CheckIcon, 
  XIcon, 
  AlertTriangleIcon 
} from 'lucide-react';

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
  const modalRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
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
      // Prevent body scrolling when modal is open
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

  useEffect(() => {
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
  type?: 'danger' | 'warning';
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  title,
  message,
  confirmText,
  onConfirm,
  isSubmitting,
  type = 'danger'
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
          className={`px-4 py-2 text-xs font-medium text-white ${
            type === 'danger' 
              ? 'bg-red-600 hover:bg-red-700' 
              : 'bg-yellow-600 hover:bg-yellow-700'
          } border border-transparent rounded-md focus:outline-none transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {isSubmitting ? 'Processing...' : confirmText}
        </button>
      </div>
    </Modal>
  );
};

const ProjectSwitcher: React.FC = () => {
  const { 
    projects, 
    currentProject, 
    switchProject, 
    createProject, 
    updateProject, 
    deleteProject 
  } = useProjects();
  
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
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
  
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current && 
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleCreateProject = async (name: string, description: string) => {
    setFormError(null);
    try {
      setIsSubmitting(true);
      await createProject(name, description);
      setIsCreateDialogOpen(false);
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
    } catch (error) {
      console.error('Failed to delete project:', error);
      // We'll keep the dialog open but show an error
      setFormError(error instanceof Error ? error.message : 'Failed to delete project');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditClick = (e: React.MouseEvent, project: any) => {
    e.stopPropagation();
    setEditingProject({
      id: project.id,
      name: project.name,
      description: project.description || ''
    });
    setFormError(null);
    setIsEditDialogOpen(true);
    setIsDropdownOpen(false);
  };

  const handleDeleteClick = (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation();
    setDeletingProjectId(projectId);
    setFormError(null);
    setIsDeleteDialogOpen(true);
    setIsDropdownOpen(false);
  };

  return (
    <>
      <div className="flex items-center relative">
        <div 
          ref={buttonRef}
          className="flex items-center space-x-2 px-4 hover:bg-gray-100 py-2 rounded-r-xl transition cursor-pointer active:scale-95"
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        >
          <div className="h-8 w-8 bg-indigo-100 rounded-lg flex items-center justify-center">
            <span className="font-semibold text-indigo-800">
              {currentProject?.name?.charAt(0).toUpperCase() || 'P'}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-gray-500 font-semibold">
              {currentProject?.name || 'Select a project'}
            </span>
            <div className="flex items-center">
              <span className="text-xs text-gray-400">
                {currentProject?.serverCount || 0} server{currentProject?.serverCount !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
          <ChevronDownIcon className="h-4 w-4 text-gray-500" />
        </div>

        {/* Dropdown Menu */}
        {isDropdownOpen && (
          <div
            ref={dropdownRef}
            className="absolute left-0 top-full mt-1 w-72 bg-white rounded-md shadow-lg border border-gray-200 z-50 animate-slide-down origin-top"
            style={{ 
              transformOrigin: 'top', 
              animation: 'slideDown 0.2s ease-out forwards'
            }}
          >
            <div className="p-3 border-b border-gray-100">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Your Projects
              </h3>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {projects.map((project) => (
                <div
                  key={project.id}
                  className={`px-4 py-3 flex items-center justify-between hover:bg-gray-50 cursor-pointer ${
                    currentProject?.id === project.id ? 'bg-indigo-50' : ''
                  }`}
                  onClick={() => {
                    switchProject(project.id);
                    setIsDropdownOpen(false);
                  }}
                >
                  <div className="flex items-center space-x-3">
                    <div className="h-8 w-8 bg-indigo-100 rounded-lg flex items-center justify-center">
                      <span className="font-semibold text-indigo-800">
                        {project.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-900">{project.name}</div>
                      <div className="text-xs text-gray-500">
                        {project.serverCount} server{project.serverCount !== 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>
                  {!project.isDefault && (
                    <div className="flex space-x-1">
                      <button
                        onClick={(e) => handleEditClick(e, project)}
                        className="p-1 text-gray-400 hover:text-gray-800 rounded-full hover:bg-gray-100 transition-colors duration-150"
                        title="Edit project"
                      >
                        <PencilIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={(e) => handleDeleteClick(e, project.id)}
                        className="p-1 text-gray-400 hover:text-red-600 rounded-full hover:bg-gray-100 transition-colors duration-150"
                        title="Delete project"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div 
              className="p-3 border-t border-gray-100 flex items-center space-x-2 text-indigo-600 hover:bg-gray-50 cursor-pointer transition-colors duration-150"
              onClick={() => {
                setIsCreateDialogOpen(true);
                setIsDropdownOpen(false);
                setFormError(null);
              }}
            >
              <PlusIcon className="h-4 w-4" />
              <span className="text-sm font-medium">Create new project</span>
            </div>
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
        type="danger"
      />
    </>
  );
};

export default ProjectSwitcher;