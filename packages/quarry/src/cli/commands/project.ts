/**
 * project command - Manage Stoneforge projects in the control center
 *
 * Subcommands:
 * - list: List all registered projects
 * - add: Register a new project
 * - remove: Remove a project from registry
 * - switch: Set active project
 * - current: Show active project
 * - discover: Discover projects in a directory
 * - auto-register: Auto-register all discovered projects
 */

import { resolve } from 'node:path';
import type { Command, CommandResult, GlobalOptions } from '../types.js';
import { success, failure, ExitCode } from '../types.js';
import { ProjectRegistry } from '../../services/project-registry.js';
import { ProjectStatus, asProjectId } from '@stoneforge/core';

// ============================================================================
// Helpers
// ============================================================================

function getRegistry(): ProjectRegistry {
  return new ProjectRegistry();
}

async function initRegistry(registry: ProjectRegistry): Promise<void> {
  await registry.initialize();
}

function formatProjectTable(projects: ReturnType<ProjectRegistry['listProjects']>, activeId?: string): string {
  if (projects.length === 0) {
    return 'No projects registered. Use "sf project add <path>" to register a project.';
  }

  // Table header
  const lines: string[] = [
    'ID                  NAME                    PATH                           STATUS    LAST ACCESSED',
    '────────────────────────────────────────────────────────────────────────────────────────────────',
  ];

  for (const project of projects) {
    const isActive = project.id === activeId ? '*' : ' ';
    const status = project.status.toUpperCase().padEnd(7);
    const name = project.name.padEnd(22);
    const path = project.path.length > 30
      ? '…' + project.path.slice(-29)
      : project.path.padEnd(30);
    const lastAccessed = new Date(project.lastAccessedAt).toLocaleString();

    lines.push(`${isActive}${project.id.padEnd(18)} ${name} ${path} ${status} ${lastAccessed}`);
  }

  lines.push('');
  lines.push('* = active project');
  return lines.join('\n');
}

function formatDiscoveredProjects(projects: ReturnType<ProjectRegistry['discoverProjects']>): string {
  if (projects.length === 0) {
    return 'No Stoneforge projects discovered.';
  }

  const lines: string[] = [
    'NAME                    PATH                           CONFIG VALID',
    '────────────────────────────────────────────────────────────────────',
  ];

  for (const project of projects) {
    const name = project.name.padEnd(22);
    const path = project.path.length > 30
      ? '…' + project.path.slice(-29)
      : project.path.padEnd(30);
    const configValid = project.hasValidConfig ? '✓' : '✗';

    lines.push(`${name} ${path} ${configValid}`);
    if (!project.hasValidConfig && project.configError) {
      lines.push(`  Error: ${project.configError}`);
    }
  }

  return lines.join('\n');
}

// ============================================================================
// Project List
// ============================================================================

async function projectListHandler(
  _args: string[],
  _options: GlobalOptions
): Promise<CommandResult> {
  try {
    const registry = getRegistry();
    await initRegistry(registry);
    const projects = registry.listProjects();
    const stats = registry.getStats();
    const activeId = registry.getActiveProjectId();

    const output = formatProjectTable(projects, activeId);

    return success(
      { projects, stats },
      output
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return failure(`Failed to list projects: ${message}`, ExitCode.GENERAL_ERROR);
  }
}

// ============================================================================
// Project Add
// ============================================================================

async function projectAddHandler(
  args: string[],
  options: GlobalOptions
): Promise<CommandResult> {
  if (args.length < 1) {
    return failure('Usage: sf project add <path> [--name <name>] [--description <desc>] [--tags <tags>]', ExitCode.INVALID_ARGUMENTS);
  }

  const path = args[0];
  const name = options.name as string | undefined;
  const description = options.description as string | undefined;
  const tagsStr = options.tags as string | undefined;

  try {
    const registry = getRegistry();
    await initRegistry(registry);

    const resolvedPath = resolve(path);

    const tags = tagsStr ? tagsStr.split(',').map(t => t.trim()).filter(Boolean) : undefined;

    const project = registry.registerProject({
      path: resolvedPath,
      name,
      description,
      tags,
    });

    return success(
      { project },
      `Registered project "${project.name}" (${project.id})\nPath: ${project.path}`
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return failure(`Failed to add project: ${message}`, ExitCode.GENERAL_ERROR);
  }
}

// ============================================================================
// Project Remove
// ============================================================================

async function projectRemoveHandler(
  args: string[],
  _options: GlobalOptions
): Promise<CommandResult> {
  if (args.length < 1) {
    return failure('Usage: sf project remove <id>', ExitCode.INVALID_ARGUMENTS);
  }

  const id = asProjectId(args[0]);

  try {
    const registry = getRegistry();
    await initRegistry(registry);

    const project = registry.getProject(id);
    if (!project) {
      return failure(`Project not found: ${id}`, ExitCode.NOT_FOUND);
    }

    const name = project.name;
    registry.removeProject(id);

    return success(
      { id },
      `Removed project "${name}" (${id})`
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return failure(`Failed to remove project: ${message}`, ExitCode.GENERAL_ERROR);
  }
}

// ============================================================================
// Project Switch
// ============================================================================

async function projectSwitchHandler(
  args: string[],
  _options: GlobalOptions
): Promise<CommandResult> {
  if (args.length < 1) {
    return failure('Usage: sf project switch <id>', ExitCode.INVALID_ARGUMENTS);
  }

  const id = asProjectId(args[0]);

  try {
    const registry = getRegistry();
    await initRegistry(registry);

    const project = registry.setActiveProject(id);

    return success(
      { project },
      `Switched to project "${project.name}" (${project.id})\nPath: ${project.path}`
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return failure(`Failed to switch project: ${message}`, ExitCode.GENERAL_ERROR);
  }
}

// ============================================================================
// Project Current
// ============================================================================

async function projectCurrentHandler(
  _args: string[],
  _options: GlobalOptions
): Promise<CommandResult> {
  try {
    const registry = getRegistry();
    await initRegistry(registry);

    const project = registry.getActiveProject();

    if (!project) {
      return success(
        { active: false },
        'No active project. Use "sf project switch <id>" to set one.'
      );
    }

    return success(
      { project, active: true },
      `Active project: ${project.name} (${project.id})\nPath: ${project.path}\nStatus: ${project.status}\nLast accessed: ${new Date(project.lastAccessedAt).toLocaleString()}`
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return failure(`Failed to get current project: ${message}`, ExitCode.GENERAL_ERROR);
  }
}

// ============================================================================
// Project Discover
// ============================================================================

async function projectDiscoverHandler(
  args: string[],
  options: GlobalOptions
): Promise<CommandResult> {
  const rootPath = args[0] ? resolve(args[0]) : process.cwd();
  const maxDepth = options.depth ? parseInt(options.depth as string, 10) : 3;

  try {
    const registry = getRegistry();
    await initRegistry(registry);

    const projects = registry.discoverProjects(rootPath, maxDepth);

    return success(
      { projects, rootPath, maxDepth },
      `Discovered ${projects.length} project(s) in ${rootPath} (max depth: ${maxDepth}):\n\n${formatDiscoveredProjects(projects)}`
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return failure(`Failed to discover projects: ${message}`, ExitCode.GENERAL_ERROR);
  }
}

// ============================================================================
// Project Auto-Register
// ============================================================================

async function projectAutoRegisterHandler(
  args: string[],
  options: GlobalOptions
): Promise<CommandResult> {
  const rootPath = args[0] ? resolve(args[0]) : process.cwd();
  const maxDepth = options.depth ? parseInt(options.depth as string, 10) : 3;

  try {
    const registry = getRegistry();
    await initRegistry(registry);

    const registered = registry.autoRegisterProjects(rootPath, maxDepth);

    if (registered.length === 0) {
      return success(
        { registered: [], count: 0 },
        'No new projects to register (already registered or invalid config)'
      );
    }

    const lines = ['Auto-registered projects:', ''];
    for (const project of registered) {
      lines.push(`  ${project.name} (${project.id})`);
      lines.push(`    Path: ${project.path}`);
    }

    return success(
      { registered, count: registered.length },
      lines.join('\n')
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return failure(`Failed to auto-register projects: ${message}`, ExitCode.GENERAL_ERROR);
  }
}

// ============================================================================
// Project Update
// ============================================================================

async function projectUpdateHandler(
  args: string[],
  options: GlobalOptions
): Promise<CommandResult> {
  if (args.length < 1) {
    return failure('Usage: sf project update <id> [--name <name>] [--description <desc>] [--tags <tags>] [--status <status>]', ExitCode.INVALID_ARGUMENTS);
  }

  const id = asProjectId(args[0]);
  const name = options.name as string | undefined;
  const description = options.description as string | undefined;
  const tagsStr = options.tags as string | undefined;
  const status = options.status as ProjectStatus | undefined;

  try {
    const registry = getRegistry();
    await initRegistry(registry);

    const tags = tagsStr ? tagsStr.split(',').map(t => t.trim()).filter(Boolean) : undefined;

    const project = registry.updateProject(id, { name, description, tags, status });

    return success(
      { project },
      `Updated project "${project.name}" (${project.id})`
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return failure(`Failed to update project: ${message}`, ExitCode.GENERAL_ERROR);
  }
}

// ============================================================================
// Project Stats
// ============================================================================

async function projectStatsHandler(
  _args: string[],
  _options: GlobalOptions
): Promise<CommandResult> {
  try {
    const registry = getRegistry();
    await initRegistry(registry);

    const stats = registry.getStats();

    return success(
      { stats },
      `Project Statistics:
  Total:     ${stats.total}
  Active:    ${stats.active}
  Inactive:  ${stats.inactive}
  Error:     ${stats.error}
  Active ID: ${stats.activeProjectId ?? 'none'}`
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return failure(`Failed to get project stats: ${message}`, ExitCode.GENERAL_ERROR);
  }
}

// ============================================================================
// Command Definition
// ============================================================================

export const projectCommand: Command = {
  name: 'project',
  description: 'Manage Stoneforge projects in the control center',
  usage: 'sf project <subcommand> [args]',
  help: `Manage Stoneforge projects from a central control center.

The control center allows you to register multiple Stoneforge projects
and switch between them without changing directories.

Projects are stored in ~/.stoneforge/control-center/projects.json
or .stoneforge/control-center/projects.json (project-local).

Examples:
  sf project add ./my-project                 Register a project
  sf project list                             List all projects
  sf project switch pj-abc12345               Switch active project
  sf project current                          Show active project
  sf project discover ~/code                  Discover projects in directory
  sf project auto-register ~/code             Auto-register all discovered projects`,
  handler: projectListHandler,
  subcommands: {
    list: {
      name: 'list',
      description: 'List all registered projects',
      usage: 'sf project list',
      help: `List all registered projects with their status and last accessed time.

The active project is marked with an asterisk (*).

Examples:
  sf project list          List all projects
  sf project list --json   Output as JSON`,
      handler: projectListHandler,
    },
    add: {
      name: 'add',
      description: 'Register a new project',
      usage: 'sf project add <path> [--name <name>] [--description <desc>] [--tags <tags>]',
      help: `Register a Stoneforge project in the control center.

The path must contain a .stoneforge directory with config.yaml and stoneforge.db.

Options:
  --name          Custom project name (default: directory name)
  --description   Project description
  --tags          Comma-separated tags

Examples:
  sf project add ./my-project
  sf project add ./my-project --name "My Project"
  sf project add ./my-project --tags "work,backend"
  sf project add ~/projects/foo --name "Foo" --description "Main backend"`,
      handler: projectAddHandler,
      options: [
        { name: 'name', description: 'Custom project name', hasValue: true },
        { name: 'description', description: 'Project description', hasValue: true },
        { name: 'tags', description: 'Comma-separated tags', hasValue: true },
      ],
    },
    remove: {
      name: 'remove',
      description: 'Remove a project from registry',
      usage: 'sf project remove <id>',
      help: `Remove a project from the control center registry.

This does NOT delete the project files, only removes it from the registry.

Examples:
  sf project remove pj-abc12345`,
      handler: projectRemoveHandler,
    },
    switch: {
      name: 'switch',
      description: 'Set active project',
      usage: 'sf project switch <id>',
      help: `Set the active project for the control center.

The active project is used by default for web UI and API operations.

Examples:
  sf project switch pj-abc12345`,
      handler: projectSwitchHandler,
    },
    current: {
      name: 'current',
      description: 'Show active project',
      usage: 'sf project current',
      help: `Display the currently active project.

Examples:
  sf project current`,
      handler: projectCurrentHandler,
    },
    discover: {
      name: 'discover',
      description: 'Discover Stoneforge projects in a directory',
      usage: 'sf project discover [path] [--depth <n>]',
      help: `Scan a directory tree for Stoneforge projects (directories with .stoneforge).

Options:
  --depth  Maximum directory depth to scan (default: 3)

Examples:
  sf project discover ~/code
  sf project discover . --depth 5`,
      handler: projectDiscoverHandler,
      options: [
        { name: 'depth', description: 'Maximum directory depth to scan', hasValue: true },
      ],
    },
    'auto-register': {
      name: 'auto-register',
      description: 'Auto-register all discovered projects',
      usage: 'sf project auto-register [path] [--depth <n>]',
      help: `Automatically register all valid Stoneforge projects found in a directory.

Only projects with valid config.yaml are registered. Already-registered projects are skipped.

Options:
  --depth  Maximum directory depth to scan (default: 3)

Examples:
  sf project auto-register ~/code
  sf project auto-register . --depth 5`,
      handler: projectAutoRegisterHandler,
      options: [
        { name: 'depth', description: 'Maximum directory depth to scan', hasValue: true },
      ],
    },
    update: {
      name: 'update',
      description: 'Update project metadata',
      usage: 'sf project update <id> [--name <name>] [--description <desc>] [--tags <tags>] [--status <status>]',
      help: `Update a project's metadata.

Options:
  --name          New project name
  --description   New description
  --tags          Comma-separated tags (replaces existing)
  --status        Project status: active, inactive, error

Examples:
  sf project update pj-abc12345 --name "New Name"
  sf project update pj-abc12345 --status inactive
  sf project update pj-abc12345 --tags "work,frontend"`,
      handler: projectUpdateHandler,
      options: [
        { name: 'name', description: 'New project name', hasValue: true },
        { name: 'description', description: 'New description', hasValue: true },
        { name: 'tags', description: 'Comma-separated tags', hasValue: true },
        { name: 'status', description: 'Project status (active, inactive, error)', hasValue: true },
      ],
    },
    stats: {
      name: 'stats',
      description: 'Show project statistics',
      usage: 'sf project stats',
      help: `Display statistics about registered projects.`,
      handler: projectStatsHandler,
    },
  },
};