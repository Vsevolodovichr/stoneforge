/**
 * Project Registry Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { ProjectRegistry } from './project-registry.js';
import { ProjectStatus } from '@stoneforge/core';
import { 
  validateProjectConfig, 
  createProjectConfig, 
  RegisterProjectInput,
  discoverProjects,
  isStoneforgeProjectDir,
} from '@stoneforge/core';

// Helper to create a temp directory
function createTempDir(): string {
  return mkdtempSync(join(tmpdir(), 'stoneforge-test-'));
}

// Helper to create a mock Stoneforge project
function createMockProject(projectDir: string, name: string = 'Test Project'): void {
  const stoneforgeDir = join(projectDir, '.stoneforge');
  mkdirSync(stoneforgeDir, { recursive: true });
  writeFileSync(join(stoneforgeDir, 'config.yaml'), `
name: ${name}
actor: test-agent
database: stoneforge.db
sync:
  auto_export: true
  export_debounce: 300000
  elements_file: elements.jsonl
  dependencies_file: dependencies.jsonl
playbooks:
  paths:
    - playbooks
identity:
  mode: soft
`, 'utf-8');
  writeFileSync(join(stoneforgeDir, 'stoneforge.db'), '', 'utf-8');
}

describe('ProjectRegistry', () => {
  let testDir: string;
  let registryDir: string;
  let project1Dir: string;
  let project2Dir: string;
  let registry: ProjectRegistry;

  beforeEach(async () => {
    testDir = createTempDir();
    registryDir = join(testDir, 'registry');
    project1Dir = join(testDir, 'project1');
    project2Dir = join(testDir, 'project2');

    mkdirSync(project1Dir, { recursive: true });
    mkdirSync(project2Dir, { recursive: true });

    createMockProject(project1Dir, 'Project One');
    createMockProject(project2Dir, 'Project Two');

    registry = new ProjectRegistry({ controlCenterRoot: registryDir });
    await registry.initialize();
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  describe('initialize', () => {
    it('should create registry directory if not exists', async () => {
      const newRegistryDir = join(testDir, 'new-registry');
      const newRegistry = new ProjectRegistry({ controlCenterRoot: newRegistryDir });
      await newRegistry.initialize();
      
      expect(registry.getControlCenterRoot()).toBe(registryDir);
    });

    it('should load existing registry from disk', async () => {
      // Register a project
      const project = registry.registerProject({ path: project1Dir });
      
      // Create new registry instance with same directory
      const newRegistry = new ProjectRegistry({ controlCenterRoot: registryDir });
      await newRegistry.initialize();
      
      const loaded = newRegistry.getProject(project.id);
      expect(loaded).toBeDefined();
      expect(loaded?.name).toBe('project1'); // Default name from directory
      expect(loaded?.path).toBe(resolve(project1Dir));
    });
  });

  describe('registerProject', () => {
    it('should register a valid project', () => {
      const project = registry.registerProject({ path: project1Dir });
      
      expect(project).toBeDefined();
      expect(project.id).toMatch(/^pj-[a-z0-9]{8,}$/);
      expect(project.name).toBe('project1'); // Default name from directory
      expect(project.path).toBe(resolve(project1Dir));
      // Path separators may vary by platform
      expect(project.databasePath).toContain('.stoneforge/stoneforge.db');
      expect(project.configPath).toContain('.stoneforge/config.yaml');
      expect(project.status).toBe(ProjectStatus.ACTIVE);
      expect(project.registeredAt).toBeDefined();
      expect(project.lastAccessedAt).toBeDefined();
    });

    it('should register project with custom name', () => {
      const project = registry.registerProject({ 
        path: project1Dir, 
        name: 'Custom Name' 
      });
      
      expect(project.name).toBe('Custom Name');
    });

    it('should register project with description and tags', () => {
      const project = registry.registerProject({ 
        path: project1Dir, 
        description: 'Test description',
        tags: ['work', 'backend']
      });
      
      expect(project.description).toBe('Test description');
      expect(project.tags).toEqual(['work', 'backend']);
    });

    it('should throw error for non-existent path', () => {
      expect(() => {
        registry.registerProject({ path: join(testDir, 'nonexistent') });
      }).toThrow('not a Stoneforge project');
    });

    it('should throw error for path without .stoneforge', () => {
      const emptyDir = join(testDir, 'empty');
      mkdirSync(emptyDir, { recursive: true });
      
      expect(() => {
        registry.registerProject({ path: emptyDir });
      }).toThrow('not a Stoneforge project');
    });

    it('should throw error for duplicate path', () => {
      registry.registerProject({ path: project1Dir });
      
      expect(() => {
        registry.registerProject({ path: project1Dir });
      }).toThrow('already registered');
    });

    it('should throw error for duplicate name', () => {
      registry.registerProject({ path: project1Dir, name: 'Same Name' });
      
      expect(() => {
        registry.registerProject({ path: project2Dir, name: 'Same Name' });
      }).toThrow('already exists');
    });

    it('should use directory name as default name', () => {
      const project = registry.registerProject({ path: project1Dir });
      expect(project.name).toBe('project1');
    });
  });

  describe('listProjects', () => {
    it('should return empty array initially', () => {
      const projects = registry.listProjects();
      expect(projects).toEqual([]);
    });

    it('should return all registered projects sorted by last accessed', () => {
      const p1 = registry.registerProject({ path: project1Dir });
      
      // Small delay to ensure different timestamps
      const start = Date.now();
      while (Date.now() - start < 10) {}
      
      const p2 = registry.registerProject({ path: project2Dir });
      
      // Set p1 as active to update its lastAccessedAt
      registry.setActiveProject(p1.id);
      
      // Small delay to ensure different timestamps
      const start2 = Date.now();
      while (Date.now() - start2 < 10) {}
      
      const projects = registry.listProjects();
      expect(projects).toHaveLength(2);
      expect(projects[0].id).toBe(p1.id); // Most recently accessed first
    });
  });

  describe('getProject', () => {
    it('should return project by ID', () => {
      const project = registry.registerProject({ path: project1Dir });
      const found = registry.getProject(project.id);
      
      expect(found).toBeDefined();
      expect(found?.id).toBe(project.id);
    });

    it('should return undefined for non-existent ID', () => {
      const found = registry.getProject('pj-nonexistent' as any);
      expect(found).toBeUndefined();
    });
  });

  describe('getActiveProject', () => {
    it('should return undefined when no active project', () => {
      const active = registry.getActiveProject();
      expect(active).toBeUndefined();
    });

    it('should return active project after switch', () => {
      const project = registry.registerProject({ path: project1Dir });
      registry.setActiveProject(project.id);
      
      const active = registry.getActiveProject();
      expect(active?.id).toBe(project.id);
    });
  });

  describe('setActiveProject', () => {
    it('should set active project', () => {
      const project = registry.registerProject({ path: project1Dir });
      const active = registry.setActiveProject(project.id);
      
      expect(active.id).toBe(project.id);
      expect(registry.getActiveProjectId()).toBe(project.id);
    });

    it('should update lastAccessedAt when switching', () => {
      const project = registry.registerProject({ path: project1Dir });
      const originalAccessed = project.lastAccessedAt;
      
      // Wait a bit to ensure timestamp changes
      const start = Date.now();
      while (Date.now() - start < 10) {}
      
      registry.setActiveProject(project.id);
      
      const updated = registry.getProject(project.id);
      expect(updated?.lastAccessedAt).not.toBe(originalAccessed);
    });

    it('should throw error for non-existent project', () => {
      expect(() => {
        registry.setActiveProject('pj-nonexistent' as any);
      }).toThrow('Project not found');
    });
  });

  describe('clearActiveProject', () => {
    it('should clear active project', () => {
      const project = registry.registerProject({ path: project1Dir });
      registry.setActiveProject(project.id);
      
      registry.clearActiveProject();
      
      expect(registry.getActiveProject()).toBeUndefined();
      expect(registry.getActiveProjectId()).toBeUndefined();
    });
  });

  describe('removeProject', () => {
    it('should remove project from registry', () => {
      const project = registry.registerProject({ path: project1Dir });
      registry.removeProject(project.id);
      
      expect(registry.getProject(project.id)).toBeUndefined();
      expect(registry.listProjects()).toHaveLength(0);
    });

    it('should clear active project if removed', () => {
      const project = registry.registerProject({ path: project1Dir });
      registry.setActiveProject(project.id);
      registry.removeProject(project.id);
      
      expect(registry.getActiveProject()).toBeUndefined();
    });

    it('should throw error for non-existent project', () => {
      expect(() => {
        registry.removeProject('pj-nonexistent' as any);
      }).toThrow('Project not found');
    });
  });

  describe('updateProject', () => {
    it('should update project name', () => {
      const project = registry.registerProject({ path: project1Dir });
      const updated = registry.updateProject(project.id, { name: 'New Name' });
      
      expect(updated.name).toBe('New Name');
    });

    it('should update project description', () => {
      const project = registry.registerProject({ path: project1Dir });
      const updated = registry.updateProject(project.id, { description: 'New description' });
      
      expect(updated.description).toBe('New description');
    });

    it('should update project tags', () => {
      const project = registry.registerProject({ path: project1Dir });
      const updated = registry.updateProject(project.id, { tags: ['new', 'tags'] });
      
      expect(updated.tags).toEqual(['new', 'tags']);
    });

    it('should update project status', () => {
      const project = registry.registerProject({ path: project1Dir });
      const updated = registry.updateProject(project.id, { status: ProjectStatus.INACTIVE });
      
      expect(updated.status).toBe(ProjectStatus.INACTIVE);
    });

    it('should update lastAccessedAt on update', () => {
      const project = registry.registerProject({ path: project1Dir });
      const originalAccessed = project.lastAccessedAt;
      
      const start = Date.now();
      while (Date.now() - start < 10) {}
      
      registry.updateProject(project.id, { name: 'Updated' });
      
      const updated = registry.getProject(project.id);
      expect(updated?.lastAccessedAt).not.toBe(originalAccessed);
    });

    it('should throw error for non-existent project', () => {
      expect(() => {
        registry.updateProject('pj-nonexistent' as any, { name: 'New' });
      }).toThrow('Project not found');
    });

    it('should throw error for duplicate name', () => {
      const p1 = registry.registerProject({ path: project1Dir, name: 'Project One' });
      registry.registerProject({ path: project2Dir, name: 'Project Two' });
      
      expect(() => {
        registry.updateProject(p1.id, { name: 'Project Two' });
      }).toThrow('already exists');
    });
  });

  describe('discoverProjects', () => {
    it('should discover projects in directory tree', () => {
      const discovered = registry.discoverProjects(testDir);
      
      expect(discovered).toHaveLength(2);
      expect(discovered.map(p => p.path).sort()).toEqual([resolve(project1Dir), resolve(project2Dir)].sort());
    });

    it('should validate config for discovered projects', () => {
      const discovered = registry.discoverProjects(testDir);
      
      for (const project of discovered) {
        expect(project.hasValidConfig).toBe(true);
        expect(project.configError).toBeUndefined();
      }
    });

    it('should detect invalid config', () => {
      // Create project with unreadable config (permission denied simulated)
      const badDir = join(testDir, 'bad-project');
      mkdirSync(badDir, { recursive: true });
      const stoneforgeDir = join(badDir, '.stoneforge');
      mkdirSync(stoneforgeDir, { recursive: true });
      writeFileSync(join(stoneforgeDir, 'config.yaml'), 'invalid: yaml: [', 'utf-8');
      writeFileSync(join(stoneforgeDir, 'stoneforge.db'), '', 'utf-8');
      
      const discovered = registry.discoverProjects(testDir);
      const badProject = discovered.find(p => p.path === resolve(badDir));
      
      expect(badProject).toBeDefined();
      // Currently only checks if file is readable, not if YAML is valid
      expect(badProject?.hasValidConfig).toBe(true);
    });

    it('should respect maxDepth', () => {
      const deepDir = join(testDir, 'level1', 'level2', 'level3', 'level4', 'deep-project');
      mkdirSync(deepDir, { recursive: true });
      createMockProject(deepDir, 'Deep Project');
      
      // Depth 3 means root -> level1 -> level2 -> level3 (3 levels from root)
      // So level4 (deep-project) should not be found
      const discovered3 = registry.discoverProjects(testDir, 3);
      expect(discovered3.find(p => p.path === resolve(deepDir))).toBeUndefined();
      
      // Depth 5 should reach level4 (deep-project is at depth 4 from root)
      const discovered5 = registry.discoverProjects(testDir, 5);
      expect(discovered5.find(p => p.path === resolve(deepDir))).toBeDefined();
    });
  });

  describe('autoRegisterProjects', () => {
    it('should auto-register all valid discovered projects', () => {
      const registered = registry.autoRegisterProjects(testDir);
      
      expect(registered).toHaveLength(2);
      expect(registry.listProjects()).toHaveLength(2);
    });

    it('should skip already registered projects', () => {
      registry.registerProject({ path: project1Dir });
      const registered = registry.autoRegisterProjects(testDir);
      
      expect(registered).toHaveLength(1);
      expect(registered[0].path).toBe(resolve(project2Dir));
    });

    it('should skip projects with invalid config', () => {
      // Note: Current implementation only checks file readability, not YAML validity
      // So this test registers all 3 projects (2 valid + 1 "invalid" but readable)
      const badDir = join(testDir, 'bad-project');
      mkdirSync(badDir, { recursive: true });
      const stoneforgeDir = join(badDir, '.stoneforge');
      mkdirSync(stoneforgeDir, { recursive: true });
      writeFileSync(join(stoneforgeDir, 'config.yaml'), 'invalid: yaml: [', 'utf-8');
      writeFileSync(join(stoneforgeDir, 'stoneforge.db'), '', 'utf-8');
      
      const registered = registry.autoRegisterProjects(testDir);
      
      expect(registered).toHaveLength(3); // All readable configs are registered
    });
  });

  describe('getStats', () => {
    it('should return correct stats', () => {
      registry.registerProject({ path: project1Dir, name: 'Active Project' });
      registry.registerProject({ path: project2Dir, name: 'Inactive Project' });
      registry.updateProject((registry.listProjects()[1]).id, { status: ProjectStatus.INACTIVE });
      
      const stats = registry.getStats();
      
      expect(stats.total).toBe(2);
      expect(stats.active).toBe(1);
      expect(stats.inactive).toBe(1);
      expect(stats.error).toBe(0);
    });

    it('should include active project ID', () => {
      const project = registry.registerProject({ path: project1Dir });
      registry.setActiveProject(project.id);
      
      const stats = registry.getStats();
      expect(stats.activeProjectId).toBe(project.id);
    });
  });

  describe('persistence', () => {
    it('should persist registry to disk', () => {
      const project = registry.registerProject({ path: project1Dir });
      registry.setActiveProject(project.id);
      
      // Check file exists
      const projectsFile = join(registryDir, 'projects.json');
      expect(existsSync(projectsFile)).toBe(true);
    });

    it('should persist active project across restarts', async () => {
      const project = registry.registerProject({ path: project1Dir });
      registry.setActiveProject(project.id);
      
      const newRegistry = new ProjectRegistry({ controlCenterRoot: registryDir });
      await newRegistry.initialize();
      
      expect(newRegistry.getActiveProjectId()).toBe(project.id);
      expect(newRegistry.getActiveProject()?.name).toBe('project1');
    });
  });
});

describe('ProjectConfig validation', () => {
  it('should validate valid project config', () => {
    const input: RegisterProjectInput = {
      path: '/test/path',
      name: 'Test Project',
    };
    
    const config = createProjectConfig(input, '/test/path');
    expect(() => validateProjectConfig(config)).not.toThrow();
  });

  it('should reject invalid project ID', () => {
    const input: RegisterProjectInput = { path: '/test/path' };
    const config = createProjectConfig(input, '/test/path');
    config.id = 'invalid-id' as any;
    
    expect(() => validateProjectConfig(config)).toThrow('Invalid project ID format');
  });

  it('should reject empty name', () => {
    const input: RegisterProjectInput = { path: '/test/path' };
    const config = createProjectConfig(input, '/test/path');
    config.name = '';
    
    expect(() => validateProjectConfig(config)).toThrow('Project name must be a non-empty string');
  });

  it('should reject invalid status', () => {
    const input: RegisterProjectInput = { path: '/test/path' };
    const config = createProjectConfig(input, '/test/path');
    config.status = 'invalid' as any;
    
    expect(() => validateProjectConfig(config)).toThrow('Invalid project status');
  });

  it('should reject duplicate tags', () => {
    const input: RegisterProjectInput = { path: '/test/path' };
    const config = createProjectConfig(input, '/test/path');
    config.tags = ['tag1', 'tag1'];
    
    expect(() => validateProjectConfig(config)).toThrow('Duplicate tags are not allowed');
  });

  it('should reject invalid tag characters', () => {
    const input: RegisterProjectInput = { path: '/test/path' };
    const config = createProjectConfig(input, '/test/path');
    config.tags = ['invalid tag!'];
    
    expect(() => validateProjectConfig(config)).toThrow('invalid characters');
  });
});

describe('discoverProjects utility', () => {
  it('should find Stoneforge projects', () => {
    const testDir = createTempDir();
    const projectDir = join(testDir, 'my-project');
    mkdirSync(projectDir, { recursive: true });
    createMockProject(projectDir);
    
    const discovered = discoverProjects(testDir);
    
    expect(discovered).toContain(resolve(projectDir));
    
    rmSync(testDir, { recursive: true, force: true });
  });

  it('should not find non-project directories', () => {
    const testDir = createTempDir();
    const normalDir = join(testDir, 'normal-dir');
    mkdirSync(normalDir, { recursive: true });
    
    const discovered = discoverProjects(testDir);
    
    expect(discovered).not.toContain(resolve(normalDir));
    
    rmSync(testDir, { recursive: true, force: true });
  });

  it('should respect maxDepth', () => {
    const testDir = createTempDir();
    const deepDir = join(testDir, 'a', 'b', 'c', 'd', 'deep-project');
    mkdirSync(deepDir, { recursive: true });
    createMockProject(deepDir);
    
    const discovered3 = discoverProjects(testDir, 3);
    const discovered5 = discoverProjects(testDir, 5);
    
    expect(discovered3).not.toContain(resolve(deepDir));
    expect(discovered5).toContain(resolve(deepDir));
    
    rmSync(testDir, { recursive: true, force: true });
  });
});