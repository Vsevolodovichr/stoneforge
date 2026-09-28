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
      errors: ['Path is required'],
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
      throw new Error('Validation failed');
    }

    return await response.json();
  } catch {
    // Fallback to basic validation if API is not available
    const fallbackResult: ValidationResult = {
      isValid: false,
      hasDirectory: false,
      hasStoneforge: false,
      hasConfig: false,
      errors: ['Unable to validate path. Make sure the server is running.'],
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
