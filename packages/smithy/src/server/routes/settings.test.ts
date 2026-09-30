import { describe, expect, it, vi } from 'vitest';
import type { Services } from '../services.js';
import { createSettingsRoutes } from './settings.js';

describe('settings routes', () => {
  it('returns agent executable defaults without an internal server error', async () => {
    const settingsService = {
      getAgentDefaults: vi.fn().mockReturnValue({ defaultExecutablePaths: {} }),
    };
    const app = createSettingsRoutes({ settingsService } as unknown as Services);

    const response = await app.request('/api/settings/agent-defaults');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ defaultExecutablePaths: {} });
    expect(settingsService.getAgentDefaults).toHaveBeenCalledOnce();
  });
});
