import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, mock, test } from 'bun:test';

mock.module('@stoneforge/ui', () => ({
  ProjectAddModal: () => null,
  useProject: () => ({
    activeProject: null,
    error: null,
    isLoading: false,
    projects: [],
    refreshProjects: async () => {},
    registerProject: async () => ({}),
    removeProject: async () => {},
    switchProject: async () => {},
  }),
}));

mock.module('@tanstack/react-query', () => ({
  useQuery: () => ({ data: {} }),
}));

const { DashboardPage } = await import('../src/routes/dashboard');

describe('Dashboard project creation', () => {
  test('exposes an add-project action in the dashboard header', () => {
    const markup = renderToStaticMarkup(createElement(DashboardPage));

    expect(markup).toContain('aria-label="Add project"');
  });
});
