import React, { useState, useRef, useEffect } from 'react';
import { useProjects } from '../contexts/ProjectContext';
import { Link } from 'react-router-dom';
import { CheckIcon, PlusIcon, Cog6ToothIcon } from '@heroicons/react/24/outline';

interface ProjectSwitcherProps {
  showOrganization?: boolean;
}

const ProjectSwitcher: React.FC<ProjectSwitcherProps> = ({ showOrganization = true }) => {
  const { 
    projects, 
    currentProject, 
    switchProject,
    createProject
  } = useProjects();
  
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isOrgDropdownOpen, setIsOrgDropdownOpen] = useState(false);
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLDivElement>(null);
  const orgDropdownRef = useRef<HTMLDivElement>(null);
  const orgButtonRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when creating new project
  useEffect(() => {
    if (isCreatingProject && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isCreatingProject]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Project dropdown
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current && 
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
        setIsCreatingProject(false);
        setNewProjectName('');
      }
      
      // Organization dropdown
      if (
        orgDropdownRef.current && 
        !orgDropdownRef.current.contains(event.target as Node) &&
        orgButtonRef.current && 
        !orgButtonRef.current.contains(event.target as Node)
      ) {
        setIsOrgDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleCreateProject = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newProjectName.trim() || isSubmitting) return;
    
    try {
      setIsSubmitting(true);
      await createProject(newProjectName, '');
      setNewProjectName('');
      setIsCreatingProject(false);
    } catch (error) {
      console.error('Failed to create project:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex items-center space-x-1">
      {/* Organization Switcher */}
      {showOrganization && (
        <>
          <div className="relative">
            <div 
              ref={orgButtonRef}
              className="flex items-center space-x-1 px-1 py-1 hover:bg-[#383c47] rounded-md transition cursor-pointer"
              onClick={() => setIsOrgDropdownOpen(!isOrgDropdownOpen)}
            >
              <div className="h-5 w-5 bg-gray-100 rounded-md flex items-center justify-center">
                <span className="font-semibold text-xs text-gray-800">P</span>
              </div>
              <span className="text-xs ml-1 text-gray-300 font-medium">Personal</span>
              <svg width="7" height="10" viewBox="0 0 10 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg" className="text-gray-400 mb-0.5">
                <path fillRule="evenodd" clipRule="evenodd" d="M4.34151 0.747423C4.71854 0.417526 5.28149 0.417526 5.65852 0.747423L9.65852 4.24742C10.0742 4.61111 10.1163 5.24287 9.75259 5.6585C9.38891 6.07414 8.75715 6.11626 8.34151 5.75258L5.00001 2.82877L1.65852 5.75258C1.24288 6.11626 0.61112 6.07414 0.247438 5.6585C-0.116244 5.24287 -0.0741267 4.61111 0.34151 4.24742L4.34151 0.747423ZM0.246065 10.3578C0.608879 9.94139 1.24055 9.89795 1.65695 10.2608L5.00001 13.1737L8.34308 10.2608C8.75948 9.89795 9.39115 9.94139 9.75396 10.3578C10.1168 10.7742 10.0733 11.4058 9.65695 11.7687L5.65695 15.2539C5.28043 15.582 4.7196 15.582 4.34308 15.2539L0.343082 11.7687C-0.0733128 11.4058 -0.116749 10.7742 0.246065 10.3578Z"></path>
              </svg>
            </div>

            {/* Organization Dropdown */}
            {isOrgDropdownOpen && (
              <div
                ref={orgDropdownRef}
                className="absolute left-0 top-full mt-1 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-50 py-1 animate-fade-in"
              >
                <div 
                  className="px-2 py-1.5 hover:bg-gray-50 cursor-pointer flex items-center"
                  onClick={() => setIsOrgDropdownOpen(false)}
                >
                  <div className="h-5 w-5 bg-gray-800 rounded-md flex items-center justify-center mr-2">
                    <span className="font-medium text-xs text-white">P</span>
                  </div>
                  <span className="text-sm text-gray-700">Personal</span>
                </div>
              </div>
            )}
          </div>

          <span className="text-gray-500">/</span>
        </>
      )}

      {/* Project Switcher */}
      <div className="relative">
        <div 
          ref={buttonRef}
          className="flex items-center space-x-1 px-1 py-1 hover:bg-[#383c47] rounded-md transition cursor-pointer active:scale-95"
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        >
          <span className="text-xs text-gray-300 font-medium">{currentProject?.name || 'Default project'}</span>
          <svg width="7" height="10" viewBox="0 0 10 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg" className="text-gray-400 mb-0.5">
            <path fillRule="evenodd" clipRule="evenodd" d="M4.34151 0.747423C4.71854 0.417526 5.28149 0.417526 5.65852 0.747423L9.65852 4.24742C10.0742 4.61111 10.1163 5.24287 9.75259 5.6585C9.38891 6.07414 8.75715 6.11626 8.34151 5.75258L5.00001 2.82877L1.65852 5.75258C1.24288 6.11626 0.61112 6.07414 0.247438 5.6585C-0.116244 5.24287 -0.0741267 4.61111 0.34151 4.24742L4.34151 0.747423ZM0.246065 10.3578C0.608879 9.94139 1.24055 9.89795 1.65695 10.2608L5.00001 13.1737L8.34308 10.2608C8.75948 9.89795 9.39115 9.94139 9.75396 10.3578C10.1168 10.7742 10.0733 11.4058 9.65695 11.7687L5.65695 15.2539C5.28043 15.582 4.7196 15.582 4.34308 15.2539L0.343082 11.7687C-0.0733128 11.4058 -0.116749 10.7742 0.246065 10.3578Z"></path>
          </svg>
        </div>

        {/* Project Dropdown */}
        {isDropdownOpen && (
          <div
            ref={dropdownRef}
            className="absolute left-0 top-full mt-4 w-64 bg-white rounded-md shadow-lg border border-gray-200 z-50 overflow-hidden animate-fade-in"
          >
            <div className="px-4 py-2 border-b border-gray-100">
              <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                PROJECTS
              </h3>
            </div>
            
            <div className="max-h-64 overflow-y-auto">
              {projects.map((project) => (
                <div
                  key={project.id}
                  className={`px-4 py-2 hover:bg-gray-50 cursor-pointer flex items-center justify-between ${
                    currentProject?.id === project.id ? 'bg-gray-50' : ''
                  }`}
                  onClick={() => {
                    switchProject(project.id);
                    setIsDropdownOpen(false);
                  }}
                >
                  <div className="flex items-center">
                    <span className="text-sm text-gray-700">
                      {project.name}
                    </span>
                  </div>
                  {currentProject?.id === project.id && (
                    <CheckIcon className="h-4 w-4 text-gray-600" />
                  )}
                </div>
              ))}
            </div>
            
            <div className="border-t border-gray-100">
              {isCreatingProject ? (
                <form 
                  className="px-4 py-2 flex items-center"
                  onSubmit={handleCreateProject}
                >
                  <input
                    ref={inputRef}
                    type="text"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    placeholder="Project name..."
                    className="w-full text-sm border-b border-gray-200 focus:border-gray-500 px-0 py-1 focus:outline-none"
                    disabled={isSubmitting}
                  />
                </form>
              ) : (
                <div 
                  className="px-4 py-2 hover:bg-gray-50 cursor-pointer flex items-center text-gray-700"
                  onClick={() => setIsCreatingProject(true)}
                >
                  <PlusIcon className="h-4 w-4 mr-2" />
                  <span className="text-sm">Create project</span>
                </div>
              )}
              
              <Link 
                to="/projects"
                className="px-4 py-2 hover:bg-gray-50 cursor-pointer flex items-center text-gray-700"
                onClick={() => setIsDropdownOpen(false)}
              >
                <Cog6ToothIcon className="h-4 w-4 mr-2" />
                <span className="text-sm">Manage projects</span>
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Add global CSS animations */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-5px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        .animate-fade-in {
          animation: fadeIn 0.12s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>
    </div>
  );
};

export default ProjectSwitcher;