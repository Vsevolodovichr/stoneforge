/**
 * ProjectContext - Global context for the currently selected project
 *
 * Stores which Stoneforge project is currently active in the control center.
 * This affects which project's data is displayed across the platform.
 *
 * Usage:
 * - Wrap your app with ProjectProvider
 * - Use useProject() hook to access the active project and switch projects
 * - The active project ID is persisted in localStorage
 */

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import type { ProjectConfig, ProjectId, RegisterProjectInput } from '@stoneforge/core';

// Types
export interface ProjectContextValue {
  /** The currently active project */
  activeProject: ProjectConfig | null;
  /** All registered projects */
  projects: ProjectConfig[];
  /** Switch to a different project by ID */
  switchProject: (projectId: ProjectId) => Promise<void>;
  /** Register a new project */
  registerProject: (input: RegisterProjectInput) => Promise<ProjectConfig>;
  /** Remove a project from the registry */
  removeProject: (projectId: ProjectId) => Promise<void>;
  /** Refresh the project list */
  refreshProjects: () => Promise<void>;
  /** Loading state */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;
}

const LOCAL_STORAGE_KEY = 'stoneforge-active-project-id';

const ProjectContext = createContext<ProjectContextValue | undefined>(undefined);

export interface ProjectProviderProps {
  children: ReactNode;
  /** API base URL (default: same origin) */
  apiBaseUrl?: string;
}

export function ProjectProvider({ children, apiBaseUrl = '' }: ProjectProviderProps) {
  const [projects, setProjects] = useState<ProjectConfig[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(LOCAL_STORAGE_KEY);
    }
    return null;
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProjects = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch(`${apiBaseUrl}/api/projects`);
      if (!response.ok) {
        throw new Error(`Failed to fetch projects: ${response.statusText}`);
      }
      const data = await response.json();
      setProjects(data.projects || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch projects');
    } finally {
      setIsLoading(false);
    }
  }, [apiBaseUrl]);

  // Fetch projects on mount
  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // Persist active project ID to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (activeProjectId) {
        localStorage.setItem(LOCAL_STORAGE_KEY, activeProjectId);
      } else {
        localStorage.removeItem(LOCAL_STORAGE_KEY);
      }
    }
  }, [activeProjectId]);

  const activeProject = projects.find(p => p.id === activeProjectId) ?? null;

  const switchProject = useCallback(async (projectId: ProjectId) => {
    try {
      setError(null);
      const response = await fetch(`${apiBaseUrl}/api/projects/active`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      });
      if (!response.ok) {
        throw new Error(`Failed to switch project: ${response.statusText}`);
      }
      setActiveProjectId(projectId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to switch project');
      throw err;
    }
  }, [apiBaseUrl]);

  const registerProject = useCallback(async (input: RegisterProjectInput) => {
    try {
      setError(null);
      const response = await fetch(`${apiBaseUrl}/api/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error?.message || `Failed to register project: ${response.statusText}`);
      }
      const project = await response.json();
      await fetchProjects();
      return project as ProjectConfig;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to register project');
      throw err;
    }
  }, [apiBaseUrl, fetchProjects]);

  const removeProject = useCallback(async (projectId: ProjectId) => {
    try {
      setError(null);
      const response = await fetch(`${apiBaseUrl}/api/projects/${projectId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error(`Failed to remove project: ${response.statusText}`);
      }
      if (activeProjectId === projectId) {
        setActiveProjectId(null);
      }
      await fetchProjects();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove project');
      throw err;
    }
  }, [apiBaseUrl, fetchProjects, activeProjectId]);

  const refreshProjects = useCallback(async () => {
    await fetchProjects();
  }, [fetchProjects]);

  return (
    <ProjectContext.Provider
      value={{
        activeProject,
        projects,
        switchProject,
        registerProject,
        removeProject,
        refreshProjects,
        isLoading,
        error,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return context;
}