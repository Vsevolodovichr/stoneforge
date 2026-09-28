const jsonHeaders = {
  'content-type': 'application/json; charset=utf-8',
  'x-content-type-options': 'nosniff',
};

function json(body: unknown, status = 200, request: Request) {
  const headers = new Headers(jsonHeaders);
  headers.set('access-control-allow-origin', '*');
  headers.set('access-control-allow-methods', 'GET, OPTIONS');
  headers.set('access-control-allow-headers', 'Content-Type');
  headers.set('access-control-max-age', '86400');

  return new Response(JSON.stringify(body), { status, headers });
}

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return json(null, 204, request);
    }

    if (request.method !== 'GET') {
      return json({ error: { code: 'METHOD_NOT_ALLOWED', message: 'Only GET is supported' } }, 405, request);
    }

    const { pathname } = new URL(request.url);

    if (pathname === '/' || pathname === '/api/health') {
      return json({
        status: 'ok',
        service: 'stoneforge-control-center-worker',
        timestamp: new Date().toISOString(),
      }, 200, request);
    }

    return json({ error: { code: 'NOT_FOUND', message: 'Route not found' } }, 404, request);
  },
};
