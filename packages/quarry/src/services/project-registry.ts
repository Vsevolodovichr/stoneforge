/**
 * Project Registry Service
 *
 * Manages multiple Stoneforge projects from a central control center.
 * Handles project registration, discovery, persistence, and active project tracking.
 */

import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname, join, isAbsolute } from 'node:path';
import { homedir } from 'node:os';
import {
  ProjectId,
  ProjectConfig,
  ProjectStatus,
  ProjectRegistryFile,
  RegisterProjectInput,
  UpdateProjectInput,
  isProjectConfig,
  validateProjectConfig,
  validateRegisterProjectInput,
  validateProjectId,
  createProjectConfig,
  updateProjectConfig,
  discoverProjects as coreDiscoverProjects,
  isStoneforgeProjectDir,
  generateProjectId,
} from '@stoneforge/core';

// ============================================================================
// Constants
// ============================================================================

const REGISTRY_VERSION = 1;
const CONTROL_CENTER_DIR_NAME = 'control-center';
const PROJECTS_FILE_NAME = 'projects.json';

/**
 * Default control center root directory
 * Uses ~/.stoneforge/control-center or project-relative .stoneforge/control-center
 */
function getDefaultControlCenterRoot(): string {
  // Check for project-local .stoneforge first
  const projectLocal = join(process.cwd(), '.stoneforge', CONTROL_CENTER_DIR_NAME);
  if (existsSync(projectLocal)) {
    return projectLocal;
  }
  // Fall back to global config directory
  return join(homedir(), '.stoneforge', CONTROL_CENTER_DIR_NAME);
}

// ============================================================================
// Project Registry Service
// ============================================================================

export interface ProjectRegistryOptions {
  /** Root directory for the control center (default: auto-detected) */
  controlCenterRoot?: string;
  /** Callback fired when active project changes */
  onActiveProjectChange?: (project: ProjectConfig | undefined) => void;
}

export interface DiscoveredProject {
  path: string;
  name: string;
  databasePath: string;
  configPath: string;
  hasValidConfig: boolean;
  configError?: string;
}

export class ProjectRegistry {
  private controlCenterRoot: string;
  private projectsFile: string;
  private registry: ProjectRegistryFile;
  private initialized = false;
  private onActiveProjectChange?: (project: ProjectConfig | undefined) => void;

  constructor(options: ProjectRegistryOptions = {}) {
    this.controlCenterRoot = options.controlCenterRoot ?? getDefaultControlCenterRoot();
    this.projectsFile = join(this.controlCenterRoot, PROJECTS_FILE_NAME);
    this.onActiveProjectChange = options.onActiveProjectChange;
    this.registry = {
      version: REGISTRY_VERSION,
      projects: [],
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Initialize the registry (load from disk)
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Ensure control center directory exists
    if (!existsSync(this.controlCenterRoot)) {
      mkdirSync(this.controlCenterRoot, { recursive: true });
    }

    // Load existing registry if present
    if (existsSync(this.projectsFile)) {
      try {
        const content = readFileSync(this.projectsFile, 'utf-8');
        const loaded = JSON.parse(content) as ProjectRegistryFile;

        // Validate loaded data
        if (loaded.version === REGISTRY_VERSION && Array.isArray(loaded.projects)) {
          // Filter and validate projects
          const validProjects = loaded.projects.filter(isProjectConfig);
          this.registry.projects = validProjects;
          this.registry.activeProjectId = loaded.activeProjectId;
          this.registry.updatedAt = loaded.updatedAt || new Date().toISOString();
        }
      } catch (error) {
        console.warn('[ProjectRegistry] Failed to load registry, starting fresh:', error);
      }
    }

    this.initialized = true;
  }

  /**
   * Persist registry to disk
   */
  private save(): void {
    this.registry.updatedAt = new Date().toISOString();
    writeFileSync(this.projectsFile, JSON.stringify(this.registry, null, 2), 'utf-8');
  }

  /**
   * Get all registered projects
   */
  listProjects(): ProjectConfig[] {
    this.ensureInitialized();
    return [...this.registry.projects].sort((a, b) =>
      a.lastAccessedAt > b.lastAccessedAt ? -1 : 1
    );
  }

  /**
   * Get a project by ID
   */
  getProject(id: ProjectId): ProjectConfig | undefined {
    this.ensureInitialized();
    validateProjectId(id);
    return this.registry.projects.find(p => p.id === id);
  }

  /**
   * Get the active project
   */
  getActiveProject(): ProjectConfig | undefined {
    this.ensureInitialized();
    if (!this.registry.activeProjectId) return undefined;
    return this.getProject(this.registry.activeProjectId);
  }

  /**
   * Get the active project ID
   */
  getActiveProjectId(): ProjectId | undefined {
    this.ensureInitialized();
    return this.registry.activeProjectId;
  }

  /**
   * Register a new project
   */
  registerProject(input: RegisterProjectInput): ProjectConfig {
    this.ensureInitialized();

    const validated = validateRegisterProjectInput(input);

    // Resolve path to absolute
    const resolvedPath = isAbsolute(validated.path)
      ? validated.path
      : resolve(process.cwd(), validated.path);

    // Verify it's a valid Stoneforge project
    if (!isStoneforgeProjectDir(resolvedPath)) {
      throw new Error(`Directory is not a Stoneforge project (missing .stoneforge): ${resolvedPath}`);
    }

    // Check for duplicate path
    const existingByPath = this.registry.projects.find(p => p.path === resolvedPath);
    if (existingByPath) {
      throw new Error(`Project already registered at path: ${resolvedPath}`);
    }

    // Check for duplicate name
    if (validated.name) {
      const existingByName = this.registry.projects.find(
        p => p.name.toLowerCase() === validated.name!.toLowerCase()
      );
      if (existingByName) {
        throw new Error(`Project with name "${validated.name}" already exists`);
      }
    }

    const project = createProjectConfig(validated, resolvedPath);
    this.registry.projects.push(project);
    this.save();

    return project;
  }

  /**
   * Update a project
   */
  updateProject(id: ProjectId, updates: UpdateProjectInput): ProjectConfig {
    this.ensureInitialized();
    validateProjectId(id);

    const index = this.registry.projects.findIndex(p => p.id === id);
    if (index === -1) {
      throw new Error(`Project not found: ${id}`);
    }

    // Check for name conflict
    if (updates.name) {
      const existingByName = this.registry.projects.find(
        (p, i) => i !== index && p.name.toLowerCase() === updates.name!.toLowerCase()
      );
      if (existingByName) {
        throw new Error(`Project with name "${updates.name}" already exists`);
      }
    }

    const updated = updateProjectConfig(this.registry.projects[index], updates);
    validateProjectConfig(updated);
    this.registry.projects[index] = updated;
    this.save();

    return updated;
  }

  /**
   * Remove a project from registry (does not delete project files)
   */
  removeProject(id: ProjectId): void {
    this.ensureInitialized();
    validateProjectId(id);

    const index = this.registry.projects.findIndex(p => p.id === id);
    if (index === -1) {
      throw new Error(`Project not found: ${id}`);
    }

    this.registry.projects.splice(index, 1);

    // Clear active project if it was removed
    if (this.registry.activeProjectId === id) {
      this.registry.activeProjectId = undefined;
    }

    this.save();
  }

  /**
   * Set the active project
   */
  setActiveProject(id: ProjectId): ProjectConfig {
    this.ensureInitialized();
    validateProjectId(id);

    const project = this.getProject(id);
    if (!project) {
      throw new Error(`Project not found: ${id}`);
    }

    this.registry.activeProjectId = id;
    // Update last accessed time
    project.lastAccessedAt = new Date().toISOString();
    this.save();

    // Notify callback
    if (this.onActiveProjectChange) {
      this.onActiveProjectChange(project);
    }

    return project;
  }

  /**
   * Clear the active project
   */
  clearActiveProject(): void {
    this.ensureInitialized();
    this.registry.activeProjectId = undefined;
    this.save();
  }

  /**
   * Discover Stoneforge projects in a directory tree
   */
  discoverProjects(rootPath: string, maxDepth: number = 3): DiscoveredProject[] {
    const paths = coreDiscoverProjects(rootPath, maxDepth);
    const results: DiscoveredProject[] = [];

    for (const projectPath of paths) {
      const name = projectPath.split('/').pop()?.split('\\').pop() || 'Unnamed Project';
      const databasePath = join(projectPath, '.stoneforge', 'stoneforge.db');
      const configPath = join(projectPath, '.stoneforge', 'config.yaml');

      let hasValidConfig = true;
      let configError: string | undefined;

      // Try to read config to verify it's valid
      try {
        if (!existsSync(configPath)) {
          hasValidConfig = false;
          configError = 'config.yaml not found';
        } else {
          readFileSync(configPath, 'utf-8'); // Just verify readable
        }
      } catch (error) {
        hasValidConfig = false;
        configError = error instanceof Error ? error.message : String(error);
      }

      results.push({
        path: projectPath,
        name,
        databasePath,
        configPath,
        hasValidConfig,
        configError,
      });
    }

    return results;
  }

  /**
   * Auto-register all discovered projects from a root path
   */
  autoRegisterProjects(rootPath: string, maxDepth: number = 3): ProjectConfig[] {
    const discovered = this.discoverProjects(rootPath, maxDepth);
    const registered: ProjectConfig[] = [];

    for (const project of discovered) {
      if (!project.hasValidConfig) continue;

      // Skip if already registered
      if (this.registry.projects.some(p => p.path === project.path)) continue;

      try {
        const registeredProject = this.registerProject({
          path: project.path,
          name: project.name,
        });
        registered.push(registeredProject);
      } catch (error) {
        console.warn(`[ProjectRegistry] Failed to auto-register ${project.path}:`, error);
      }
    }

    return registered;
  }

  /**
   * Get project statistics
   */
  getStats(): {
    total: number;
    active: number;
    inactive: number;
    error: number;
    activeProjectId?: ProjectId;
  } {
    this.ensureInitialized();
    const projects = this.registry.projects;
    return {
      total: projects.length,
      active: projects.filter(p => p.status === ProjectStatus.ACTIVE).length,
      inactive: projects.filter(p => p.status === ProjectStatus.INACTIVE).length,
      error: projects.filter(p => p.status === ProjectStatus.ERROR).length,
      activeProjectId: this.registry.activeProjectId,
    };
  }

  /**
   * Get the control center root directory
   */
  getControlCenterRoot(): string {
    return this.controlCenterRoot;
  }

  /**
   * Get the projects file path
   */
  getProjectsFilePath(): string {
    return this.projectsFile;
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('ProjectRegistry not initialized. Call initialize() first.');
    }
  }
}

/**
 * Factory function to create and initialize a ProjectRegistry
 */
export async function createProjectRegistry(options?: ProjectRegistryOptions): Promise<ProjectRegistry> {
  const registry = new ProjectRegistry(options);
  await registry.initialize();
  return registry;
}