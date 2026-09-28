/**
 * ProjectsSection - Settings section for managing projects
 *
 * Displays a list of registered projects with options to add, remove, and switch between them.
 */

import { useState } from 'react';
import { useProject } from '@stoneforge/ui';
import { FolderOpen, Plus, Trash2, Check, RefreshCw, AlertCircle } from 'lucide-react';

export function ProjectsSection(_props: { isMobile: boolean }) {
  const { activeProject, projects, switchProject, registerProject, removeProject, refreshProjects, isLoading, error } = useProject();
  const [isAdding, setIsAdding] = useState(false);
  const [newProjectPath, setNewProjectPath] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [isSwitching, setIsSwitching] = useState(false);

  const handleSwitchProject = async (projectId: string) => {
    try {
      setIsSwitching(true);
      setActionError(null);
      await switchProject(projectId as any);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to switch project');
    } finally {
      setIsSwitching(false);
    }
  };

  const handleAddProject = async () => {
    if (!newProjectPath.trim()) return;
    try {
      setIsSwitching(true);
      setActionError(null);
      await registerProject({ path: newProjectPath.trim() });
      setNewProjectPath('');
      setIsAdding(false);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to add project');
    } finally {
      setIsSwitching(false);
    }
  };

  const handleRemoveProject = async (projectId: string) => {
    if (!confirm('Are you sure you want to remove this project from the registry?')) return;
    try {
      setIsSwitching(true);
      setActionError(null);
      await removeProject(projectId as any);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to remove project');
    } finally {
      setIsSwitching(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-[var(--color-text)]">Projects</h2>
        <p className="text-sm text-[var(--color-text-secondary)] mt-1">
          Manage Stoneforge projects. Switch between projects or add new ones.
        </p>
      </div>

      {/* Error Display */}
      {(error || actionError) && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{actionError || error}</span>
        </div>
      )}

      {/* Add Project Form */}
      {isAdding ? (
        <div className="p-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] space-y-3">
          <label className="block text-sm font-medium text-[var(--color-text)]">
            Project Path
          </label>
          <input
            type="text"
            value={newProjectPath}
            onChange={(e) => setNewProjectPath(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAddProject();
              if (e.key === 'Escape') {
                setIsAdding(false);
                setNewProjectPath('');
              }
            }}
            placeholder="/path/to/stoneforge/project"
            className="w-full px-3 py-2 text-sm rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30"
            autoFocus
          />
          <p className="text-xs text-[var(--color-text-tertiary)]">
            Path must contain a .stoneforge directory with config.yaml
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleAddProject}
              disabled={!newProjectPath.trim() || isSwitching}
              className="px-4 py-2 text-sm font-medium text-white bg-[var(--color-primary)] rounded-md hover:bg-[var(--color-primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add Project
            </button>
            <button
              onClick={() => {
                setIsAdding(false);
                setNewProjectPath('');
                setActionError(null);
              }}
              className="px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] rounded-md"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-[var(--color-primary)] bg-[var(--color-primary-muted)] rounded-md hover:bg-[var(--color-primary-muted)]/80"
        >
          <Plus className="w-4 h-4" />
          Add Project
        </button>
      )}

      {/* Project List */}
      <div className="space-y-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-[var(--color-text-tertiary)]">
            <RefreshCw className="w-5 h-5 animate-spin mr-2" />
            Loading projects...
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-8 text-[var(--color-text-tertiary)]">
            <FolderOpen className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No projects registered</p>
            <p className="text-xs mt-1">Add a project to get started</p>
          </div>
        ) : (
          projects.map((project) => (
            <div
              key={project.id}
              className={`
                flex items-center gap-3 p-3 rounded-lg border transition-colors
                ${project.id === activeProject?.id
                  ? 'border-[var(--color-primary)] bg-[var(--color-primary-muted)]'
                  : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)]'
                }
              `}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-[var(--color-text)] truncate">
                    {project.name}
                  </span>
                  {project.id === activeProject?.id && (
                    <Check className="w-4 h-4 text-[var(--color-primary)] flex-shrink-0" />
                  )}
                </div>
                <div className="text-xs text-[var(--color-text-tertiary)] truncate">
                  {project.path}
                </div>
              </div>
              <div className="flex items-center gap-1">
                {project.id !== activeProject?.id && (
                  <button
                    onClick={() => handleSwitchProject(project.id)}
                    disabled={isSwitching}
                    className="px-3 py-1.5 text-xs font-medium text-[var(--color-primary)] bg-[var(--color-primary-muted)] rounded hover:bg-[var(--color-primary-muted)]/80 disabled:opacity-50"
                  >
                    Switch
                  </button>
                )}
                {projects.length > 1 && (
                  <button
                    onClick={() => handleRemoveProject(project.id)}
                    disabled={isSwitching}
                    className="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-[var(--color-text-tertiary)] hover:text-red-500 disabled:opacity-50"
                    title="Remove project"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Refresh Button */}
      <button
        onClick={refreshProjects}
        disabled={isLoading}
        className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
      >
        <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        Refresh
      </button>
    </div>
  );
}