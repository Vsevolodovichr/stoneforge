import { describe, expect, test } from 'bun:test';
import { resolveQuarryAuthConfig } from './auth-config';

describe('Quarry auth configuration', () => {
  test('preserves the configured enabled state and token', () => {
    expect(resolveQuarryAuthConfig({ enabled: false, token: undefined })).toEqual({
      enabled: false,
      token: undefined,
    });
  });
});
