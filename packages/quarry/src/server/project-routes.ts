/**
 * Project Management Routes
 *
 * REST API endpoints for managing Stoneforge projects in the control center.
 */

import { Hono } from 'hono';
import type { ProjectId, ProjectConfig, ProjectStatus, RegisterProjectInput, UpdateProjectInput } from '@stoneforge/core';
import { ProjectRegistry } from '../services/project-registry.js';
import { pickProjectDirectory } from './local-directory-picker.js';
import { asProjectId, isStoneforgeProjectDir } from '@stoneforge/core';
import { existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';

export interface ProjectRoutesServices {
  projectRegistry: ProjectRegistry;
  directoryPicker?: () => Promise<string | null>;
}

export function createProjectRoutes(services: ProjectRoutesServices) {
  const { projectRegistry } = services;
  const app = new Hono();

  // POST /api/projects/pick - Open a native directory picker on the local connector
  app.post('/api/projects/pick', async (c) => {
    try {
      const path = await (services.directoryPicker ?? pickProjectDirectory)();
      return c.json({ path });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[stoneforge] Failed to open project directory picker:', error);
      return c.json({
        error: {
          code: 'PICKER_UNAVAILABLE',
          message: `Directory picker is unavailable: ${message}`,
        },
      }, 500);
    }
  });

  // POST /api/projects/validate - Validate a project path
  app.post('/api/projects/validate', async (c) => {
    try {
      const body = await c.req.json() as { path?: string };
      const path = body.path;

      if (!path || typeof path !== 'string') {
        return c.json(
          {
            isValid: false,
            hasDirectory: false,
            hasStoneforge: false,
            hasConfig: false,
            errors: ['Path is required'],
            warnings: [],
          },
          400
        );
      }

      const resolvedPath = resolve(path);
      const hasDirectory = existsSync(resolvedPath);
      const hasStoneforge = hasDirectory && existsSync(join(resolvedPath, '.stoneforge'));
      const hasConfig = hasStoneforge && existsSync(join(resolvedPath, '.stoneforge', 'config.yaml'));

      const errors: string[] = [];
      const warnings: string[] = [];

      if (!hasDirectory) {
        errors.push('Directory does not exist');
      } else if (!hasStoneforge) {
        errors.push('.stoneforge directory not found');
      } else if (!hasConfig) {
        errors.push('config.yaml not found in .stoneforge');
      }

      return c.json({
        isValid: hasDirectory && hasStoneforge && hasConfig,
        hasDirectory,
        hasStoneforge,
        hasConfig,
        errors,
        warnings,
      });
    } catch (error) {
      console.error('[stoneforge] Failed to validate project path:', error);
      return c.json(
        {
          isValid: false,
          hasDirectory: false,
          hasStoneforge: false,
          hasConfig: false,
          errors: ['Validation failed'],
          warnings: [],
        },
        500
      );
    }
  });

  // GET /api/projects - List all registered projects
  app.get('/api/projects', async (c) => {
    try {
      const projects = projectRegistry.listProjects();
      const stats = projectRegistry.getStats();
      const activeProjectId = projectRegistry.getActiveProjectId();

      return c.json({
        projects,
        stats,
        activeProjectId,
      });
    } catch (error) {
      console.error('[stoneforge] Failed to list projects:', error);
      return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to list projects' } }, 500);
    }
  });

  // POST /api/projects - Register a new project
  app.post('/api/projects', async (c) => {
    try {
      const body = await c.req.json() as RegisterProjectInput;

      // Validate required fields
      if (!body.path || typeof body.path !== 'string') {
        return c.json({ error: { code: 'VALIDATION_ERROR', message: 'path is required' } }, 400);
      }

      const project = projectRegistry.registerProject({
        path: body.path,
        name: body.name,
        description: body.description,
        tags: body.tags,
      });

      return c.json(project, 201);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('already registered') || message.includes('already exists')) {
        return c.json({ error: { code: 'CONFLICT', message } }, 409);
      }
      if (message.includes('not a Stoneforge project')) {
        return c.json({ error: { code: 'VALIDATION_ERROR', message } }, 400);
      }
      console.error('[stoneforge] Failed to register project:', error);
      return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to register project' } }, 500);
    }
  });

  // GET /api/projects/active - Get active project
  app.get('/api/projects/active', async (c) => {
    try {
      const project = projectRegistry.getActiveProject();

      if (!project) {
        return c.json({ error: { code: 'NOT_FOUND', message: 'No active project' } }, 404);
      }

      return c.json(project);
    } catch (error) {
      console.error('[stoneforge] Failed to get active project:', error);
      return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to get active project' } }, 500);
    }
  });

  // PATCH /api/projects/active - Switch active project
  app.patch('/api/projects/active', async (c) => {
    try {
      const body = await c.req.json() as { projectId: string };

      if (!body.projectId || typeof body.projectId !== 'string') {
        return c.json({ error: { code: 'VALIDATION_ERROR', message: 'projectId is required' } }, 400);
      }

      const projectId = asProjectId(body.projectId);
      const project = projectRegistry.setActiveProject(projectId);

      return c.json(project);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('Project not found')) {
        return c.json({ error: { code: 'NOT_FOUND', message } }, 404);
      }
      console.error('[stoneforge] Failed to switch project:', error);
      return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to switch project' } }, 500);
    }
  });

  // GET /api/projects/:id - Get project by ID
  app.get('/api/projects/:id', async (c) => {
    try {
      const id = asProjectId(c.req.param('id'));
      const project = projectRegistry.getProject(id);

      if (!project) {
        return c.json({ error: { code: 'NOT_FOUND', message: 'Project not found' } }, 404);
      }

      return c.json(project);
    } catch (error) {
      console.error('[stoneforge] Failed to get project:', error);
      return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to get project' } }, 500);
    }
  });

  // PATCH /api/projects/:id - Update project
  app.patch('/api/projects/:id', async (c) => {
    try {
      const id = asProjectId(c.req.param('id'));
      const body = await c.req.json() as UpdateProjectInput;

      const project = projectRegistry.updateProject(id, {
        name: body.name,
        description: body.description,
        tags: body.tags,
        status: body.status,
        metadata: body.metadata,
      });

      return c.json(project);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('Project not found')) {
        return c.json({ error: { code: 'NOT_FOUND', message } }, 404);
      }
      if (message.includes('already exists')) {
        return c.json({ error: { code: 'CONFLICT', message } }, 409);
      }
      console.error('[stoneforge] Failed to update project:', error);
      return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to update project' } }, 500);
    }
  });

  // DELETE /api/projects/:id - Remove project
  app.delete('/api/projects/:id', async (c) => {
    try {
      const id = asProjectId(c.req.param('id'));
      const project = projectRegistry.getProject(id);

      if (!project) {
        return c.json({ error: { code: 'NOT_FOUND', message: 'Project not found' } }, 404);
      }

      const name = project.name;
      projectRegistry.removeProject(id);

      return c.json({ success: true, id, name });
    } catch (error) {
      console.error('[stoneforge] Failed to remove project:', error);
      return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to remove project' } }, 500);
    }
  });

  // POST /api/projects/discover - Discover projects in a directory
  app.post('/api/projects/discover', async (c) => {
    try {
      const body = await c.req.json() as { rootPath?: string; maxDepth?: number };
      const rootPath = body.rootPath ?? process.cwd();
      const maxDepth = body.maxDepth ?? 3;

      const discovered = projectRegistry.discoverProjects(rootPath, maxDepth);

      return c.json({ projects: discovered, rootPath, maxDepth });
    } catch (error) {
      console.error('[stoneforge] Failed to discover projects:', error);
      return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to discover projects' } }, 500);
    }
  });

  // POST /api/projects/auto-register - Auto-register discovered projects
  app.post('/api/projects/auto-register', async (c) => {
    try {
      const body = await c.req.json() as { rootPath?: string; maxDepth?: number };
      const rootPath = body.rootPath ?? process.cwd();
      const maxDepth = body.maxDepth ?? 3;

      const registered = projectRegistry.autoRegisterProjects(rootPath, maxDepth);

      return c.json({ registered, count: registered.length });
    } catch (error) {
      console.error('[stoneforge] Failed to auto-register projects:', error);
      return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to auto-register projects' } }, 500);
    }
  });

  // GET /api/projects/stats - Get project statistics
  app.get('/api/projects/stats', async (c) => {
    try {
      const stats = projectRegistry.getStats();
      return c.json(stats);
    } catch (error) {
      console.error('[stoneforge] Failed to get project stats:', error);
      return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to get project stats' } }, 500);
    }
  });

  return app;
}
