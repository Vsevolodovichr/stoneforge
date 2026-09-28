/**
 * Project Management Routes for Smithy Server
 *
 * REST API endpoints for managing Stoneforge projects in the control center.
 * Mirrors the quarry server project routes but adds orchestrator-specific status.
 */

import { Hono } from 'hono';
import type { Services } from '../services.js';
import type { ProjectId, RegisterProjectInput, UpdateProjectInput } from '@stoneforge/core';
import { ProjectRegistry } from '@stoneforge/quarry/services/project-registry.js';
import { asProjectId } from '@stoneforge/core';

export function createProjectRoutes(services: Services) {
  const projectRegistry = new ProjectRegistry();
  const app = new Hono();

  // Initialize the project registry
  const initRegistry = async () => {
    await projectRegistry.initialize();
  };

  // Ensure registry is initialized before each request
  app.use('/api/projects*', async (c, next) => {
    // Check if initialized by trying to list projects
    try {
      projectRegistry.listProjects();
    } catch {
      await initRegistry();
    }
    await next();
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
      console.error('[smithy] Failed to list projects:', error);
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
      console.error('[smithy] Failed to register project:', error);
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
      console.error('[smithy] Failed to get active project:', error);
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
      console.error('[smithy] Failed to switch project:', error);
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
      console.error('[smithy] Failed to get project:', error);
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
      console.error('[smithy] Failed to update project:', error);
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
      console.error('[smithy] Failed to remove project:', error);
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
      console.error('[smithy] Failed to discover projects:', error);
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
      console.error('[smithy] Failed to auto-register projects:', error);
      return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to auto-register projects' } }, 500);
    }
  });

  // GET /api/projects/stats - Get project statistics
  app.get('/api/projects/stats', async (c) => {
    try {
      const stats = projectRegistry.getStats();
      return c.json(stats);
    } catch (error) {
      console.error('[smithy] Failed to get project stats:', error);
      return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to get project stats' } }, 500);
    }
  });

  // GET /api/projects/:id/status - Get orchestrator status for a project
  app.get('/api/projects/:id/status', async (c) => {
    try {
      const id = asProjectId(c.req.param('id'));
      const project = projectRegistry.getProject(id);

      if (!project) {
        return c.json({ error: { code: 'NOT_FOUND', message: 'Project not found' } }, 404);
      }

      // Get orchestrator status for this project
      // This would require initializing services for the project
      // For now, return basic project info
      const agents = await services.agentRegistry.listAgents();
      const sessions = services.sessionManager.listSessions({});

      const status = {
        projectId: id,
        projectName: project.name,
        agentCount: agents.length,
        activeSessions: sessions.filter(s => s.status === 'running').length,
        totalSessions: sessions.length,
        dispatchDaemonRunning: services.dispatchDaemon !== undefined,
      };

      return c.json(status);
    } catch (error) {
      console.error('[smithy] Failed to get project status:', error);
      return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to get project status' } }, 500);
    }
  });

  return app;
}