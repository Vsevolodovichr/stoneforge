/**
 * Dashboard Page - Main control center dashboard
 *
 * Displays all registered projects with their status, agent count, and quick actions.
 */

import { useQuery } from '@tanstack/react-query';
import { ProjectAddModal } from '@stoneforge/ui/components/ProjectAddModal';
import { useProject } from '@stoneforge/ui/contexts/ProjectContext';
import {
  FolderOpen,
  Plus,
  ExternalLink,
  RefreshCw,
  Server,
  ServerOff,
  Search,
  Settings,
  Activity,
  CheckCircle,
  Clock,
} from 'lucide-react';
import { useState } from 'react';

interface ProjectStatus {
  projectId: string;
  projectName: string;
  agentCount: number;
  activeSessions: number;
  totalSessions: number;
  dispatchDaemonRunning: boolean;
}

async function fetchProjectStatus(projectId: string): Promise<ProjectStatus> {
  const response = await fetch(`/api/projects/${projectId}/status`);
  if (!response.ok) throw new Error('Не вдалося отримати стан проєкту');
  return response.json();
}

export function DashboardPage() {
  const { projects, activeProject, registerProject, switchProject, refreshProjects, isLoading } = useProject();
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddProjectOpen, setIsAddProjectOpen] = useState(false);

  const { data: projectStatuses = {} } = useQuery({
    queryKey: ['projectStatuses', projects.map(p => p.id)],
    queryFn: async () => {
      const statuses: Record<string, ProjectStatus> = {};
      await Promise.all(
        projects.map(async (project) => {
          try {
            statuses[project.id] = await fetchProjectStatus(project.id);
          } catch {
            statuses[project.id] = {
              projectId: project.id,
              projectName: project.name,
              agentCount: 0,
              activeSessions: 0,
              totalSessions: 0,
              dispatchDaemonRunning: false,
            };
          }
        })
      );
      return statuses;
    },
    enabled: projects.length > 0,
  });

  const filteredProjects = projects.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.path.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleOpenInQuarry = (projectId: string) => {
    window.open(`http://localhost:5173/dashboard/overview?project=${encodeURIComponent(projectId)}`, '_blank');
  };

  const handleOpenInSmithy = (projectId: string) => {
    window.open(`http://localhost:5174/settings?project=${encodeURIComponent(projectId)}`, '_blank');
  };

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      {/* Header */}
      <header className="border-b border-[var(--color-border)] bg-[var(--color-header-bg)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-[var(--color-primary-muted)]">
                <Server className="w-6 h-6 text-[var(--color-primary)]" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-[var(--color-text)]">Центр керування</h1>
                <p className="text-sm text-[var(--color-text-secondary)]">Керуйте проєктами Stoneforge</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsAddProjectOpen(true)}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)]"
                aria-label="Додати проєкт"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Додати проєкт</span>
              </button>
              <button
                onClick={refreshProjects}
                disabled={isLoading}
                className="p-2 rounded-lg hover:bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)]"
                title="Оновити проєкти"
              >
                <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search and Stats */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-tertiary)]" />
              <input
                type="text"
                placeholder="Пошук проєктів..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30"
              />
            </div>
            <div className="flex items-center gap-4 text-sm text-[var(--color-text-secondary)]">
              <span className="flex items-center gap-1.5">
                <FolderOpen className="w-4 h-4" />
                Проєктів: {projects.length}
              </span>
              {activeProject && (
                <span className="flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  Активний: {activeProject.name}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Project Cards */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-8 h-8 animate-spin text-[var(--color-text-tertiary)]" />
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="text-center py-12">
            <FolderOpen className="w-16 h-16 mx-auto mb-4 text-[var(--color-text-tertiary)] opacity-50" />
            <h3 className="text-lg font-medium text-[var(--color-text)] mb-2">Проєкти не знайдено</h3>
            <p className="text-[var(--color-text-secondary)] mb-4">
              {searchQuery ? 'Спробуйте змінити запит' : 'Додайте перший проєкт, щоб почати'}
            </p>
            {!searchQuery && (
              <button
                type="button"
                onClick={() => setIsAddProjectOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)]"
              >
                <Plus className="w-4 h-4" />
                Додати проєкт
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProjects.map((project) => {
              const status = projectStatuses[project.id];
              const isActive = activeProject?.id === project.id;

              return (
                <div
                  key={project.id}
                  className={`
                    rounded-xl border p-6 transition-all
                    ${isActive
                      ? 'border-[var(--color-primary)] bg-[var(--color-primary-muted)]'
                      : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-primary)]/50'
                    }
                  `}
                >
                  {/* Project Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${isActive ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-surface-hover)]'}`}>
                        <FolderOpen className={`w-5 h-5 ${isActive ? 'text-white' : 'text-[var(--color-text-secondary)]'}`} />
                      </div>
                      <div>
                        <h3 className="font-semibold text-[var(--color-text)]">{project.name}</h3>
                        <p className="text-xs text-[var(--color-text-tertiary)] truncate max-w-[200px]">{project.path}</p>
                      </div>
                    </div>
                    {isActive && (
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-[var(--color-primary)] text-white">
                        Активний
                      </span>
                    )}
                  </div>

                  {/* Status */}
                  {status && (
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div className="flex items-center gap-2 text-sm">
                        <Activity className="w-4 h-4 text-[var(--color-text-tertiary)]" />
                        <span className="text-[var(--color-text-secondary)]">Агентів: {status.agentCount}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        {status.dispatchDaemonRunning ? (
                          <Server className="w-4 h-4 text-green-500" />
                        ) : (
                          <ServerOff className="w-4 h-4 text-[var(--color-text-tertiary)]" />
                        )}
                        <span className="text-[var(--color-text-secondary)]">
                          Активних сесій: {status.activeSessions}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Last Accessed */}
                  <div className="flex items-center gap-2 text-xs text-[var(--color-text-tertiary)] mb-4">
                    <Clock className="w-3 h-3" />
                    Останній доступ: {new Date(project.lastAccessedAt).toLocaleString('uk-UA')}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    {!isActive && (
                      <button
                        onClick={() => switchProject(project.id)}
                        className="flex-1 px-3 py-2 text-sm font-medium rounded-lg bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)]"
                      >
                        Перемкнутися
                      </button>
                    )}
                    <button
                      onClick={() => handleOpenInQuarry(project.id)}
                      className="p-2 rounded-lg hover:bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)]"
                      title="Відкрити в Quarry"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleOpenInSmithy(project.id)}
                      className="p-2 rounded-lg hover:bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)]"
                      title="Відкрити в Smithy"
                    >
                      <Settings className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
      <ProjectAddModal
        isOpen={isAddProjectOpen}
        onClose={() => setIsAddProjectOpen(false)}
        onAdd={async (project) => {
          await registerProject(project);
        }}
      />
    </div>
  );
}
