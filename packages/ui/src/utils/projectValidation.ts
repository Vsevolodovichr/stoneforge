/**
 * Project Validation Utilities
 *
 * Client-side validation for Stoneforge project paths.
 * Checks directory structure and required files.
 */

export interface ValidationResult {
  isValid: boolean;
  hasDirectory: boolean;
  hasStoneforge: boolean;
  hasConfig: boolean;
  errors: string[];
  warnings: string[];
}

export interface ProjectInfo {
  path: string;
  name: string;
  hasStoneforge: boolean;
  hasConfig: boolean;
  hasDatabase: boolean;
}

const LOCAL_CONNECTOR_ERROR = 'Local connector is unavailable. Start the local Quarry server.';

/**
 * Open the native directory picker provided by the local Quarry connector.
 */
export async function pickProjectDirectory(apiBaseUrl: string = ''): Promise<string | null> {
  const baseUrl = apiBaseUrl.replace(/\/$/, '');
  const response = await fetch(`${baseUrl}/api/projects/pick`, {
    method: 'POST',
    headers: { Accept: 'application/json' },
  });

  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().includes('application/json')) {
    throw new Error(LOCAL_CONNECTOR_ERROR);
  }

  const data = await response.json() as {
    path?: unknown;
    error?: { message?: unknown };
  };
  if (!response.ok) {
    const message = typeof data.error?.message === 'string' ? data.error.message : response.statusText;
    throw new Error(message || LOCAL_CONNECTOR_ERROR);
  }

  return typeof data.path === 'string' && data.path.trim() ? data.path : null;
}

/**
 * Validate a project path
 */
export async function validateProjectPath(path: string): Promise<ValidationResult> {
  if (!path || !path.trim()) {
    return {
      isValid: false,
      hasDirectory: false,
      hasStoneforge: false,
      hasConfig: false,
      errors: ['Шлях обов’язковий'],
      warnings: [],
    };
  }

  try {
    const response = await fetch('/api/projects/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path }),
    });

    if (!response.ok) {
      throw new Error('Не вдалося перевірити шлях');
    }

    return await response.json();
  } catch {
    // Fallback to basic validation if API is not available
    const fallbackResult: ValidationResult = {
      isValid: false,
      hasDirectory: false,
      hasStoneforge: false,
      hasConfig: false,
      errors: ['Не вдалося перевірити шлях. Переконайтеся, що сервер запущено.'],
      warnings: [],
    };
    return fallbackResult;
  }
}

/**
 * Check if a path looks like a Stoneforge project (basic check)
 */
export function isLikelyProject(path: string): boolean {
  if (!path || !path.trim()) return false;
  // Basic check - path should not be empty and should look like a directory
  return path.trim().length > 0;
}

/**
 * Extract project name from path
 */
export function extractProjectName(path: string): string {
  if (!path) return '';
  const parts = path.split(/[/\\]/).filter(Boolean);
  return parts[parts.length - 1] || '';
}

/**
 * Normalize path (remove trailing slashes)
 */
export function normalizePath(path: string): string {
  if (!path) return '';
  return path.replace(/[/\\]+$/, '');
}

/**
 * Check if path is absolute
 */
export function isAbsolutePath(path: string): boolean {
  if (!path) return false;
  return path.startsWith('/') || /^[A-Za-z]:[/\\]/.test(path);
}

/**
 * Format path for display (truncate if too long)
 */
export function formatPathForDisplay(path: string, maxLength: number = 50): string {
  if (!path) return '';
  if (path.length <= maxLength) return path;
  const start = path.slice(0, Math.floor(maxLength / 2) - 1);
  const end = path.slice(-Math.floor(maxLength / 2) + 1);
  return `${start}...${end}`;
}
