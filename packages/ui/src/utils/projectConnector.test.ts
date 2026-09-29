import { describe, expect, mock, test } from 'bun:test';
import { pickProjectDirectory } from './projectValidation';

describe('project connector client', () => {
  test('returns the selected directory from the local connector', async () => {
    const fetchMock = mock(async () => new Response(
      JSON.stringify({ path: 'C:\\Projects\\stoneforge-demo' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ));
    const previousFetch = globalThis.fetch;
    globalThis.fetch = fetchMock as typeof fetch;

    try {
      await expect(pickProjectDirectory('http://localhost:3456')).resolves.toBe('C:\\Projects\\stoneforge-demo');
      expect(fetchMock).toHaveBeenCalledWith('http://localhost:3456/api/projects/pick', {
        method: 'POST',
        headers: { Accept: 'application/json' },
      });
    } finally {
      globalThis.fetch = previousFetch;
    }
  });

  test('rejects an HTML SPA fallback as an unavailable connector', async () => {
    const previousFetch = globalThis.fetch;
    globalThis.fetch = mock(async () => new Response('<!doctype html>', {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })) as typeof fetch;

    try {
      await expect(pickProjectDirectory()).rejects.toThrow('Local connector is unavailable');
    } finally {
      globalThis.fetch = previousFetch;
    }
  });
});
