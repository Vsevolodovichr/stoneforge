import { describe, expect, test } from 'bun:test';
import { getProjectIdFromSearch } from './ProjectContext';

describe('project context URL handoff', () => {
  test('prefers the project ID from the URL over local storage', () => {
    expect(getProjectIdFromSearch('?project=from-url', 'from-storage')).toBe('from-url');
  });

  test('falls back to the stored project when the URL has no project', () => {
    expect(getProjectIdFromSearch('?tab=settings', 'from-storage')).toBe('from-storage');
  });
});
