import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchAllMessages } from './useAllElements';

describe('fetchAllMessages', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loads messages from the all-elements endpoint', async () => {
    const messages = [{ id: 'message-1', type: 'message' }];
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ data: { message: { items: messages } } }),
    } as Response);

    await expect(fetchAllMessages()).resolves.toEqual(messages);
    expect(fetchMock).toHaveBeenCalledWith('/api/elements/all?includeTaskCounts=true');
  });
});
