import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import axios from 'axios';

interface Project {
  id: string;
  name: string;
  description: string | null;
  userId: string;
  serverCount: number;
  createdAt: string;
  updatedAt: string;
  isDefault?: boolean;
}

interface ProjectContextType {
  projects: Project[];
  currentProject: Project | null;
  loading: boolean;
  error: string | null;
  fetchProjects: () => Promise<void>;
  createProject: (name: string, description?: string) => Promise<Project>;
  updateProject: (id: string, name: string, description?: string) => Promise<Project>;
  deleteProject: (id: string) => Promise<void>;
  switchProject: (projectId: string) => void;
  moveServerToProject: (serverId: string, projectId: string) => Promise<void>;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export const ProjectProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/projects', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      // Identify default project and add isDefault flag
      const projectsWithDefault = response.data.map((project: Project) => ({
        ...project,
        isDefault: project.name === 'Default'
      }));
      
      setProjects(projectsWithDefault);
      
      // Set current project from localStorage or use the default project
      const savedProjectId = localStorage.getItem('currentProjectId');
      if (savedProjectId) {
        const found = projectsWithDefault.find((p: Project) => p.id === savedProjectId);
        if (found) {
          setCurrentProject(found);
        } else {
          // If saved project not found, find and use the default project
          const defaultProject = projectsWithDefault.find((p: Project) => p.isDefault);
          if (defaultProject) {
            setCurrentProject(defaultProject);
            localStorage.setItem('currentProjectId', defaultProject.id);
          } else if (projectsWithDefault.length > 0) {
            setCurrentProject(projectsWithDefault[0]);
            localStorage.setItem('currentProjectId', projectsWithDefault[0].id);
          }
        }
      } else {
        // No saved project, use default project
        const defaultProject = projectsWithDefault.find((p: Project) => p.isDefault);
        if (defaultProject) {
          setCurrentProject(defaultProject);
          localStorage.setItem('currentProjectId', defaultProject.id);
        } else if (projectsWithDefault.length > 0) {
          setCurrentProject(projectsWithDefault[0]);
          localStorage.setItem('currentProjectId', projectsWithDefault[0].id);
        }
      }
      
      setError(null);
    } catch (err) {
      console.error('Failed to fetch projects:', err);
      setError('Failed to fetch projects');
    } finally {
      setLoading(false);
    }
  };

  const createProject = async (name: string, description?: string): Promise<Project> => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post('/api/projects', 
        { name, description }, 
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      await fetchProjects();
      return response.data;
    } catch (err) {
      console.error('Failed to create project:', err);
      throw new Error(axios.isAxiosError(err) && err.response?.data?.error 
        ? err.response.data.error 
        : 'Failed to create project');
    }
  };

  const updateProject = async (id: string, name: string, description?: string): Promise<Project> => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.patch(`/api/projects/${id}`, 
        { name, description }, 
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      await fetchProjects();
      
      // Update current project if it was the one that was updated
      if (currentProject?.id === id) {
        setCurrentProject({...response.data, isDefault: name === 'Default'});
      }
      
      return response.data;
    } catch (err) {
      console.error('Failed to update project:', err);
      throw new Error(axios.isAxiosError(err) && err.response?.data?.error 
        ? err.response.data.error 
        : 'Failed to update project');
    }
  };

  const deleteProject = async (id: string): Promise<void> => {
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`/api/projects/${id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      // If deleted project was current, switch to the default project
      if (currentProject?.id === id) {
        const remainingProjects = projects.filter(p => p.id !== id);
        const defaultProject = remainingProjects.find(p => p.isDefault);
        
        if (defaultProject) {
          switchProject(defaultProject.id);
        } else if (remainingProjects.length > 0) {
          switchProject(remainingProjects[0].id);
        } else {
          setCurrentProject(null);
          localStorage.removeItem('currentProjectId');
        }
      }
      
      await fetchProjects();
    } catch (err) {
      console.error('Failed to delete project:', err);
      throw new Error(axios.isAxiosError(err) && err.response?.data?.error 
        ? err.response.data.error 
        : 'Failed to delete project');
    }
  };

  const switchProject = (projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    if (project) {
      setCurrentProject(project);
      localStorage.setItem('currentProjectId', projectId);
    }
  };

  const moveServerToProject = async (serverId: string, projectId: string): Promise<void> => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(`/api/projects/${projectId}/servers/${serverId}`, {}, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      // Refresh projects to update server counts
      await fetchProjects();
    } catch (err) {
      console.error('Failed to move server to project:', err);
      throw new Error(axios.isAxiosError(err) && err.response?.data?.error 
        ? err.response.data.error 
        : 'Failed to move server to project');
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const value = {
    projects,
    currentProject,
    loading,
    error,
    fetchProjects,
    createProject,
    updateProject,
    deleteProject,
    switchProject,
    moveServerToProject
  };

  return (
    <ProjectContext.Provider value={value}>
      {children}
    </ProjectContext.Provider>
  );
};

export const useProjects = (): ProjectContextType => {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error('useProjects must be used within a ProjectProvider');
  }
  return context;
};