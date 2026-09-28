/**
 * Project Configuration Types
 *
 * Defines the Project configuration for the Stoneforge Control Center.
 * A Project represents a Stoneforge workspace with its own database and config.
 */

import { ValidationError } from '../errors/error.js';
import { ErrorCode } from '../errors/codes.js';

// ============================================================================
// Branded Types
// ============================================================================

/**
 * Branded type for Project IDs
 * Format: pj-{hash}
 */
export type ProjectId = string & { readonly __projectIdBrand: 'ProjectId' };

/**
 * Cast a string to ProjectId (use at trust boundaries only)
 */
export function asProjectId(id: string): ProjectId {
  return id as unknown as ProjectId;
}

// ============================================================================
// Project Types
// ============================================================================

/**
 * Project status
 */
export const ProjectStatus = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  ERROR: 'error',
} as const;

export type ProjectStatus = (typeof ProjectStatus)[keyof typeof ProjectStatus];

/**
 * Project configuration
 */
export interface ProjectConfig {
  /** Unique project identifier */
  readonly id: ProjectId;
  /** Human-readable project name */
  name: string;
  /** Absolute path to the project root directory */
  path: string;
  /** Absolute path to the SQLite database file */
  databasePath: string;
  /** Absolute path to the project config.yaml file */
  configPath: string;
  /** Current project status */
  status: ProjectStatus;
  /** ISO 8601 timestamp when project was registered */
  readonly registeredAt: string;
  /** ISO 8601 timestamp of last access */
  lastAccessedAt: string;
  /** Optional description */
  description?: string;
  /** Optional tags for categorization */
  tags?: string[];
  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Input for registering a new project
 */
export interface RegisterProjectInput {
  /** Project root directory path (will be resolved to absolute) */
  path: string;
  /** Optional custom name (defaults to directory name) */
  name?: string;
  /** Optional description */
  description?: string;
  /** Optional tags */
  tags?: string[];
}

/**
 * Input for updating a project
 */
export interface UpdateProjectInput {
  name?: string;
  description?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
  status?: ProjectStatus;
}

// ============================================================================
// Project Registry File Format
// ============================================================================

/**
 * Project registry stored in .stoneforge/control-center/projects.json
 */
export interface ProjectRegistryFile {
  version: number;
  projects: ProjectConfig[];
  activeProjectId?: ProjectId;
  updatedAt: string;
}

// ============================================================================
// Validation Constants
// ============================================================================

const PROJECT_ID_PREFIX = 'pj-';
const PROJECT_ID_PATTERN = /^pj-[a-z0-9]{8,}$/;
const MAX_PROJECT_NAME_LENGTH = 100;
const MAX_PROJECT_DESCRIPTION_LENGTH = 500;
const MAX_PROJECT_TAGS = 20;
const MAX_PROJECT_TAG_LENGTH = 50;
const TAG_PATTERN = /^[a-zA-Z0-9_:-]+$/;

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validates a project ID
 */
export function isValidProjectId(value: unknown): value is ProjectId {
  return typeof value === 'string' && PROJECT_ID_PATTERN.test(value);
}

/**
 * Validates a project ID and throws if invalid
 */
export function validateProjectId(value: unknown): ProjectId {
  if (!isValidProjectId(value)) {
    throw new ValidationError(
      `Invalid project ID format. Expected format: ${PROJECT_ID_PREFIX}{hash}`,
      ErrorCode.INVALID_INPUT,
      { field: 'id', value, expected: PROJECT_ID_PATTERN.toString() }
    );
  }
  return value;
}

/**
 * Generates a new project ID
 */
export function generateProjectId(): ProjectId {
  const hash = Math.random().toString(36).substring(2, 10);
  return asProjectId(`${PROJECT_ID_PREFIX}${hash}`);
}

/**
 * Validates a project name
 */
export function isValidProjectName(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= MAX_PROJECT_NAME_LENGTH;
}

/**
 * Validates a project name and throws if invalid
 */
export function validateProjectName(value: unknown): string {
  if (!isValidProjectName(value)) {
    throw new ValidationError(
      `Project name must be a non-empty string with max ${MAX_PROJECT_NAME_LENGTH} characters`,
      ErrorCode.INVALID_INPUT,
      { field: 'name', value, expected: `<= ${MAX_PROJECT_NAME_LENGTH} characters` }
    );
  }
  return value;
}

/**
 * Validates project tags
 */
export function isValidProjectTags(value: unknown): value is string[] {
  if (!Array.isArray(value)) return false;
  if (value.length > MAX_PROJECT_TAGS) return false;
  const uniqueTags = new Set(value);
  if (uniqueTags.size !== value.length) return false;
  return value.every(tag => typeof tag === 'string' && tag.length > 0 && tag.length <= MAX_PROJECT_TAG_LENGTH && TAG_PATTERN.test(tag));
}

/**
 * Validates project tags and throws if invalid
 */
export function validateProjectTags(value: unknown): string[] {
  if (!Array.isArray(value)) {
    throw new ValidationError(
      'Tags must be an array',
      ErrorCode.INVALID_INPUT,
      { field: 'tags', value, expected: 'string[]' }
    );
  }
  if (value.length > MAX_PROJECT_TAGS) {
    throw new ValidationError(
      `Too many tags. Maximum is ${MAX_PROJECT_TAGS}`,
      ErrorCode.INVALID_INPUT,
      { field: 'tags', expected: `<= ${MAX_PROJECT_TAGS}`, actual: value.length }
    );
  }

  const validatedTags = value.map((tag, index) => {
    if (typeof tag !== 'string') {
      throw new ValidationError(
        `Tag at index ${index} must be a string`,
        ErrorCode.INVALID_INPUT,
        { field: 'tags', index, value: tag }
      );
    }
    if (tag.length === 0) {
      throw new ValidationError(
        `Tag at index ${index} cannot be empty`,
        ErrorCode.INVALID_INPUT,
        { field: 'tags', index }
      );
    }
    if (tag.length > MAX_PROJECT_TAG_LENGTH) {
      throw new ValidationError(
        `Tag at index ${index} exceeds maximum length of ${MAX_PROJECT_TAG_LENGTH} characters`,
        ErrorCode.INVALID_INPUT,
        { field: 'tags', index, expected: `<= ${MAX_PROJECT_TAG_LENGTH} characters`, actual: tag.length }
      );
    }
    if (!TAG_PATTERN.test(tag)) {
      throw new ValidationError(
        `Tag at index ${index} contains invalid characters. Only alphanumeric, hyphen, underscore, and colon allowed`,
        ErrorCode.INVALID_INPUT,
        { field: 'tags', index, value: tag }
      );
    }
    return tag;
  });

  // Check for duplicates
  const uniqueTags = new Set(validatedTags);
  if (uniqueTags.size !== validatedTags.length) {
    const duplicates = validatedTags.filter((tag, index) => validatedTags.indexOf(tag) !== index);
    throw new ValidationError(
      'Duplicate tags are not allowed',
      ErrorCode.INVALID_INPUT,
      { field: 'tags', value: duplicates }
    );
  }

  return validatedTags;
}

/**
 * Validates project status
 */
export function isValidProjectStatus(value: unknown): value is ProjectStatus {
  return typeof value === 'string' && Object.values(ProjectStatus).includes(value as ProjectStatus);
}

/**
 * Validates project status and throws if invalid
 */
export function validateProjectStatus(value: unknown): ProjectStatus {
  if (!isValidProjectStatus(value)) {
    throw new ValidationError(
      `Invalid project status: ${value}`,
      ErrorCode.INVALID_INPUT,
      { field: 'status', value, expected: Object.values(ProjectStatus) }
    );
  }
  return value;
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard to check if a value is a valid ProjectConfig
 */
export function isProjectConfig(value: unknown): value is ProjectConfig {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  // Check required fields
  if (!isValidProjectId(obj.id)) return false;
  if (!isValidProjectName(obj.name)) return false;
  if (typeof obj.path !== 'string' || obj.path.length === 0) return false;
  if (typeof obj.databasePath !== 'string' || obj.databasePath.length === 0) return false;
  if (typeof obj.configPath !== 'string' || obj.configPath.length === 0) return false;
  if (!isValidProjectStatus(obj.status)) return false;
  if (!isValidTimestamp(obj.registeredAt)) return false;
  if (!isValidTimestamp(obj.lastAccessedAt)) return false;

  // Optional fields
  if (obj.description !== undefined && (typeof obj.description !== 'string' || obj.description.length > MAX_PROJECT_DESCRIPTION_LENGTH)) {
    return false;
  }
  if (obj.tags !== undefined && !isValidProjectTags(obj.tags)) return false;
  if (obj.metadata !== undefined && (typeof obj.metadata !== 'object' || obj.metadata === null || Array.isArray(obj.metadata))) {
    return false;
  }

  return true;
}

/**
 * Comprehensive validation of a ProjectConfig with detailed errors
 */
export function validateProjectConfig(value: unknown): ProjectConfig {
  if (typeof value !== 'object' || value === null) {
    throw new ValidationError(
      'Project config must be an object',
      ErrorCode.INVALID_INPUT,
      { value }
    );
  }

  const obj = value as Record<string, unknown>;

  // Validate id
  validateProjectId(obj.id);

  // Validate name
  validateProjectName(obj.name);

  // Validate path
  if (typeof obj.path !== 'string' || obj.path.length === 0) {
    throw new ValidationError(
      'Project path is required and must be a non-empty string',
      ErrorCode.MISSING_REQUIRED_FIELD,
      { field: 'path', value: obj.path }
    );
  }

  // Validate databasePath
  if (typeof obj.databasePath !== 'string' || obj.databasePath.length === 0) {
    throw new ValidationError(
      'Project databasePath is required and must be a non-empty string',
      ErrorCode.MISSING_REQUIRED_FIELD,
      { field: 'databasePath', value: obj.databasePath }
    );
  }

  // Validate configPath
  if (typeof obj.configPath !== 'string' || obj.configPath.length === 0) {
    throw new ValidationError(
      'Project configPath is required and must be a non-empty string',
      ErrorCode.MISSING_REQUIRED_FIELD,
      { field: 'configPath', value: obj.configPath }
    );
  }

  // Validate status
  validateProjectStatus(obj.status);

  // Validate timestamps
  if (!isValidTimestamp(obj.registeredAt)) {
    throw new ValidationError(
      'Invalid registeredAt timestamp format. Expected ISO 8601',
      ErrorCode.INVALID_TIMESTAMP,
      { field: 'registeredAt', value: obj.registeredAt }
    );
  }
  if (!isValidTimestamp(obj.lastAccessedAt)) {
    throw new ValidationError(
      'Invalid lastAccessedAt timestamp format. Expected ISO 8601',
      ErrorCode.INVALID_TIMESTAMP,
      { field: 'lastAccessedAt', value: obj.lastAccessedAt }
    );
  }

  // Validate optional description
  if (obj.description !== undefined) {
    if (typeof obj.description !== 'string') {
      throw new ValidationError(
        'Description must be a string',
        ErrorCode.INVALID_INPUT,
        { field: 'description', value: obj.description }
      );
    }
    if (obj.description.length > MAX_PROJECT_DESCRIPTION_LENGTH) {
      throw new ValidationError(
        `Description exceeds maximum length of ${MAX_PROJECT_DESCRIPTION_LENGTH} characters`,
        ErrorCode.INVALID_INPUT,
        { field: 'description', expected: `<= ${MAX_PROJECT_DESCRIPTION_LENGTH} characters`, actual: obj.description.length }
      );
    }
  }

  // Validate optional tags
  if (obj.tags !== undefined) {
    validateProjectTags(obj.tags);
  }

  // Validate optional metadata
  if (obj.metadata !== undefined) {
    if (typeof obj.metadata !== 'object' || obj.metadata === null || Array.isArray(obj.metadata)) {
      throw new ValidationError(
        'Metadata must be a plain object',
        ErrorCode.INVALID_INPUT,
        { field: 'metadata', value: obj.metadata }
      );
    }
  }

  return value as ProjectConfig;
}

/**
 * Validates a RegisterProjectInput
 */
export function validateRegisterProjectInput(value: unknown): RegisterProjectInput {
  if (typeof value !== 'object' || value === null) {
    throw new ValidationError(
      'Register project input must be an object',
      ErrorCode.INVALID_INPUT,
      { value }
    );
  }

  const obj = value as Record<string, unknown>;

  // Validate path
  if (typeof obj.path !== 'string' || obj.path.length === 0) {
    throw new ValidationError(
      'Project path is required and must be a non-empty string',
      ErrorCode.MISSING_REQUIRED_FIELD,
      { field: 'path', value: obj.path }
    );
  }

  // Validate optional name
  if (obj.name !== undefined) {
    validateProjectName(obj.name);
  }

  // Validate optional description
  if (obj.description !== undefined) {
    if (typeof obj.description !== 'string') {
      throw new ValidationError(
        'Description must be a string',
        ErrorCode.INVALID_INPUT,
        { field: 'description', value: obj.description }
      );
    }
    if (obj.description.length > MAX_PROJECT_DESCRIPTION_LENGTH) {
      throw new ValidationError(
        `Description exceeds maximum length of ${MAX_PROJECT_DESCRIPTION_LENGTH} characters`,
        ErrorCode.INVALID_INPUT,
        { field: 'description', expected: `<= ${MAX_PROJECT_DESCRIPTION_LENGTH} characters`, actual: obj.description.length }
      );
    }
  }

  // Validate optional tags
  if (obj.tags !== undefined) {
    validateProjectTags(obj.tags);
  }

  return value as RegisterProjectInput;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Creates a new timestamp in ISO 8601 format (UTC)
 */
function createTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Creates a ProjectConfig from RegisterProjectInput
 */
export function createProjectConfig(input: RegisterProjectInput, resolvedPath: string): ProjectConfig {
  const now = createTimestamp();
  const name = input.name || resolvedPath.split('/').pop()?.split('\\').pop() || 'Unnamed Project';

  return {
    id: generateProjectId(),
    name,
    path: resolvedPath,
    databasePath: `${resolvedPath}/.stoneforge/stoneforge.db`,
    configPath: `${resolvedPath}/.stoneforge/config.yaml`,
    status: ProjectStatus.ACTIVE,
    registeredAt: now,
    lastAccessedAt: now,
    description: input.description,
    tags: input.tags || [],
    metadata: {},
  };
}

/**
 * Updates a ProjectConfig with new values
 */
export function updateProjectConfig(config: ProjectConfig, updates: UpdateProjectInput): ProjectConfig {
  const updated: ProjectConfig = { ...config };

  if (updates.name !== undefined) {
    updated.name = validateProjectName(updates.name);
  }
  if (updates.description !== undefined) {
    updated.description = updates.description;
  }
  if (updates.tags !== undefined) {
    updated.tags = validateProjectTags(updates.tags);
  }
  if (updates.metadata !== undefined) {
    updated.metadata = updates.metadata;
  }
  if (updates.status !== undefined) {
    updated.status = validateProjectStatus(updates.status);
  }

  updated.lastAccessedAt = createTimestamp();
  return updated;
}

/**
 * Checks if a directory looks like a Stoneforge project (has .stoneforge directory)
 */
export function isStoneforgeProjectDir(dirPath: string): boolean {
  try {
    const fs = require('node:fs');
    const path = require('node:path');
    const stoneforgeDir = path.join(dirPath, '.stoneforge');
    return fs.existsSync(stoneforgeDir) && fs.statSync(stoneforgeDir).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Discovers Stoneforge projects in a directory tree
 */
export function discoverProjects(rootPath: string, maxDepth: number = 3): string[] {
  const fs = require('node:fs');
  const path = require('node:path');
  const projects: string[] = [];

  // Check if root path itself is a project
  if (isStoneforgeProjectDir(rootPath)) {
    projects.push(rootPath);
    // Don't recurse into project directories
    return projects;
  }

  function scanDir(currentPath: string, depth: number) {
    if (depth > maxDepth) return;

    try {
      const entries = fs.readdirSync(currentPath, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (entry.name.startsWith('.')) continue; // Skip hidden directories
        if (entry.name === 'node_modules') continue;
        if (entry.name === '.git') continue;

        const fullPath = path.join(currentPath, entry.name);

        if (isStoneforgeProjectDir(fullPath)) {
          projects.push(fullPath);
          // Don't recurse into project directories
          continue;
        }

        // Recurse
        scanDir(fullPath, depth + 1);
      }
    } catch {
      // Ignore permission errors, etc.
    }
  }

  scanDir(rootPath, 0);
  return projects;
}

// Re-export timestamp validation from element.ts
import { isValidTimestamp } from './element.js';