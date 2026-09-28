/**
 * ProjectSelector - Dropdown component for selecting the active project
 *
 * Displays a list of registered projects and allows switching between them.
 * Uses ProjectAddModal for adding new projects.
 */

import { useState, useRef, useEffect } from 'react';
import { useProject } from '../contexts/ProjectContext';
import { FolderOpen, Trash2, RefreshCw, Check, ChevronDown, Plus, AlertCircle } from 'lucide-react';
import { ProjectAddModal } from './ProjectAddModal';

export interface ProjectSelectorProps {
  /** Show "Add Project" button */
  showAddButton?: boolean;
  /** Show "Remove Project" button */
  showRemoveButton?: boolean;
  /** Compact mode (smaller dropdown) */
  compact?: boolean;
  /** Callback when a project is selected */
  onProjectChange?: (projectId: string | null) => void;
}

export function ProjectSelector({
  showAddButton = true,
  showRemoveButton = true,
  compact = false,
  onProjectChange,
}: ProjectSelectorProps) {
  const { activeProject, projects, switchProject, registerProject, removeProject, refreshProjects, isLoading, error } = useProject();
  const [isOpen, setIsOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isSwitching, setIsSwitching] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSwitchProject = async (projectId: string) => {
    try {
      setIsSwitching(true);
      setActionError(null);
      await switchProject(projectId as any);
      setIsOpen(false);
      onProjectChange?.(projectId);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to switch project');
    } finally {
      setIsSwitching(false);
    }
  };

  const handleAddProject = async (project: { path: string; name?: string; description?: string; tags?: string[] }) => {
    setIsSwitching(true);
    setActionError(null);
    try {
      const newProject = await registerProject(project);
      onProjectChange?.(newProject.id);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to add project');
      throw err;
    } finally {
      setIsSwitching(false);
    }
  };

  const handleRemoveProject = async (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to remove this project from the registry?')) return;
    try {
      setIsSwitching(true);
      setActionError(null);
      await removeProject(projectId as any);
      onProjectChange?.(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to remove project');
    } finally {
      setIsSwitching(false);
    }
  };

  const handleRefresh = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setActionError(null);
      await refreshProjects();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to refresh projects');
    }
  };

  const displayName = activeProject?.name || 'Select Project';

  return (
    <>
      <div className="relative" ref={dropdownRef}>
        {/* Trigger Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          disabled={isLoading || isSwitching}
          className={`
            flex items-center gap-2 rounded-md border transition-colors
            ${compact ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm'}
            ${isOpen
              ? 'border-[var(--color-primary)] bg-[var(--color-primary-muted)]'
              : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)]'
            }
            disabled:opacity-50 disabled:cursor-not-allowed
          `}
          data-testid="project-selector-trigger"
        >
          <FolderOpen className={compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
          <span className="max-w-[150px] truncate font-medium">{displayName}</span>
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {/* Dropdown */}
        {isOpen && (
          <div
            className={`
              absolute right-0 top-full z-50 mt-1 rounded-lg border shadow-lg
              bg-[var(--color-bg)] border-[var(--color-border)]
              ${compact ? 'min-w-[200px]' : 'min-w-[280px]'}
            `}
            data-testid="project-selector-dropdown"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[var(--color-border)] px-3 py-2">
              <span className="text-xs font-medium text-[var(--color-text-tertiary)] uppercase tracking-wide">
                Projects
              </span>
              <button
                onClick={handleRefresh}
                className="p-1 rounded hover:bg-[var(--color-surface-hover)] text-[var(--color-text-tertiary)]"
                title="Refresh projects"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Error Display */}
            {(error || actionError) && (
              <div className="flex items-center gap-2 px-3 py-2 text-xs text-red-500 bg-red-50 dark:bg-red-900/20">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{actionError || error}</span>
              </div>
            )}

            {/* Project List */}
            <div className="max-h-[300px] overflow-y-auto py-1">
              {projects.length === 0 ? (
                <div className="px-3 py-4 text-center text-sm text-[var(--color-text-tertiary)]">
                  No projects registered
                </div>
              ) : (
                projects.map((project) => (
                  <div
                    key={project.id}
                    onClick={() => handleSwitchProject(project.id)}
                    className={`
                      flex items-center gap-2 px-3 py-2 cursor-pointer
                      hover:bg-[var(--color-surface-hover)]
                      ${project.id === activeProject?.id ? 'bg-[var(--color-primary-muted)]' : ''}
                    `}
                    data-testid={`project-option-${project.id}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium truncate">{project.name}</span>
                        {project.id === activeProject?.id && (
                          <Check className="w-3.5 h-3.5 text-[var(--color-primary)] flex-shrink-0" />
                        )}
                      </div>
                      <div className="text-xs text-[var(--color-text-tertiary)] truncate">
                        {project.path}
                      </div>
                    </div>
                    {showRemoveButton && projects.length > 1 && (
                      <button
                        onClick={(e) => handleRemoveProject(project.id, e)}
                        className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-[var(--color-text-tertiary)] hover:text-red-500"
                        title="Remove project"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Add Project Button */}
            {showAddButton && (
              <div className="border-t border-[var(--color-border)] px-3 py-2">
                <button
                  onClick={() => {
                    setIsOpen(false);
                    setIsModalOpen(true);
                  }}
                  className="flex items-center gap-2 w-full px-2 py-1.5 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] rounded"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Project</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add Project Modal */}
      <ProjectAddModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onAdd={handleAddProject}
      />
    </>
  );
}