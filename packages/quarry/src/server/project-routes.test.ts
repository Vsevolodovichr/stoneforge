import { describe, expect, test } from 'bun:test';
import { Hono } from 'hono';
import { createProjectRoutes } from './project-routes';

describe('project connector routes', () => {
  test('returns the directory selected by the local connector', async () => {
    const app = new Hono();
    app.route('/', createProjectRoutes({
      projectRegistry: {} as never,
      directoryPicker: async () => 'C:\\Projects\\stoneforge-demo',
    }));

    const response = await app.request('/api/projects/pick', { method: 'POST' });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ path: 'C:\\Projects\\stoneforge-demo' });
  });

  test('returns an empty path when the picker is cancelled', async () => {
    const app = new Hono();
    app.route('/', createProjectRoutes({
      projectRegistry: {} as never,
      directoryPicker: async () => null,
    }));

    const response = await app.request('/api/projects/pick', { method: 'POST' });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ path: null });
  });
});
