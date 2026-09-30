import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createWorkspaceFilesRoutes } from './workspace-files.js';

describe('workspace file routes', () => {
  it('uses the active project path instead of the server project root', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'stoneforge-project-'));
    await mkdir(join(projectRoot, 'src'));
    await writeFile(join(projectRoot, 'src', 'main.ts'), 'export {}');

    const app = createWorkspaceFilesRoutes({
      getActiveProject: () => ({ path: projectRoot }),
    } as never);
    const response = await app.request('/api/workspace/tree');
    const data = await response.json() as { root?: string; entries?: Array<{ path: string }> };

    expect(response.status).toBe(200);
    expect(data.root).toBe(projectRoot);
    expect(data.entries?.some((entry) => entry.path === 'src')).toBe(true);

    await rm(projectRoot, { recursive: true, force: true });
  });
});
