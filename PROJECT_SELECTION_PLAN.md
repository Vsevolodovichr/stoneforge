# Stoneforge Multi-Project Web App Plan

## Goal
Enable running a single instance of the Stoneforge web app (quarry-web + smithy-web) that can be accessed remotely and allows selecting/switching between multiple projects from within the UI, instead of running separate servers per project.

## Current Architecture
- Each project has its own `.stoneforge/` directory with `config.yaml` and `stoneforge.db`
- Servers use `process.cwd()` to locate project root and database
- Users must `cd` into each project and run servers separately
- Port 3456 (quarry-server), 5173 (quarry-web), 3457 (smithy-server), 5174 (smithy-web)

---

## Phase 1: Project Registry & Configuration

### Objective
Create a central project registry that manages multiple Stoneforge projects from a single control center.

### Tasks
1. **Create Project Registry Type** (`packages/core/src/types/project.ts`)
   - Define `ProjectConfig` interface: id, name, path, database path, config path, status, lastAccessed
   - Add branded type `ProjectId`
   - Add type guards `isProjectConfig()`

2. **Create Project Registry Service** (`packages/quarry/src/services/project-registry.ts`)
   - `ProjectRegistry` class with methods:
     - `discoverProjects(rootPath: string): ProjectConfig[]` - Scan for `.stoneforge` directories
     - `registerProject(config: ProjectConfig): ProjectId`
     - `getProject(id: ProjectId): ProjectConfig | undefined`
     - `listProjects(): ProjectConfig[]`
     - `setActiveProject(id: ProjectId): void`
     - `getActiveProject(): ProjectConfig | undefined`
     - `removeProject(id: ProjectId): void`
   - Persist registry to `.stoneforge/control-center/projects.json`

3. **Add CLI Commands** (`packages/quarry/src/cli/commands/project.ts`)
   - `sf project list` - List registered projects
   - `sf project add <path> [--name]` - Register a project
   - `sf project remove <id>` - Remove project from registry
   - `sf project switch <id>` - Set active project
   - `sf project current` - Show active project

4. **Update Config System** (`packages/quarry/src/config/`)
   - Add `controlCenter` section to `Configuration` type
   - Support `projectsRoot` (default: `~/.stoneforge/projects` or configurable)

### Acceptance Criteria
- [ ] Can register multiple projects via CLI
- [ ] Projects persist across restarts
- [ ] Active project is remembered
- [ ] Unit tests for registry service

### Agent Review Loop (Post-Phase 1)
**Independent Agent Review:**
- Verify type safety and branded types usage
- Check config merging precedence (file > env > CLI > defaults)
- Validate project discovery handles edge cases (nested .stoneforge, symlinks, permissions)
- Confirm CLI follows existing command patterns
- Run `bun test packages/quarry/src/services/project-registry.test.ts`

---

## Phase 2: Multi-Project API Endpoints

### Objective
Add REST API endpoints to the quarry-server and smithy-server for project management and context switching.

### Tasks
1. **Quarry Server Project Routes** (`packages/quarry/src/server/project-routes.ts`)
   - `GET /api/projects` - List all registered projects
   - `POST /api/projects` - Register new project
   - `GET /api/projects/active` - Get active project
   - `PATCH /api/projects/active` - Switch active project (body: `{ projectId }`)
   - `DELETE /api/projects/:id` - Remove project
   - `POST /api/projects/discover` - Auto-discover projects from a root path

2. **Smithy Server Project Routes** (`apps/smithy-server/src/routes/projects.ts`)
   - Mirror quarry-server project endpoints
   - Add `GET /api/projects/:id/status` - Get orchestrator status for project (agents, sessions, queue)

3. **Update Server Initialization** (`packages/quarry/src/server/index.ts`, `apps/smithy-server/src/index.ts`)
   - Accept optional `projectId` in `QuarryServerOptions`/`ServicesOptions`
   - Initialize services for active project on startup
   - Support hot-switching projects without restart (reinitialize services)

4. **WebSocket Project Context**
   - Include `projectId` in WebSocket connection data
   - Broadcast project switch events to connected clients

### Acceptance Criteria
- [ ] Can list/register/switch projects via API
- [ ] Switching projects reinitializes database connections
- [ ] WebSocket clients receive project switch notifications
- [ ] Integration tests for project switching

### Agent Review Loop (Post-Phase 2)
**Independent Agent Review:**
- Verify API follows existing route patterns (error handling, validation, response format)
- Check database connection cleanup on project switch (no leaks)
- Validate WebSocket project context propagation
- Test concurrent project access scenarios
- Run `bun test packages/quarry/src/server/project-routes.test.ts`

---

## Phase 3: Frontend Project Selector

### Objective
Add project selection UI to both quarry-web and smithy-web applications.

### Tasks
1. **Shared Project Context** (`packages/ui/src/contexts/ProjectContext.tsx`)
   - `ProjectProvider` - React context for current project
   - `useProject()` hook - Access active project, list, switch
   - `useProjects()` hook - List all projects with status
   - Sync with server via API + WebSocket

2. **Project Selector Component** (`packages/ui/src/components/ProjectSelector.tsx`)
   - Dropdown/menu with project list
   - Show project name, path, status (active/inactive), last accessed
   - "Add Project" action (modal with path input + discover button)
   - "Remove Project" action (with confirmation)
   - Keyboard shortcuts (e.g., `Cmd/Ctrl + P`)

3. **Quarry-web Integration** (`apps/quarry-web/src/`)
   - Wrap app with `ProjectProvider` in `main.tsx`
   - Add ProjectSelector to AppShell header (top-right)
   - Update all API hooks to include project context
   - Persist selected project in localStorage

4. **Smithy-web Integration** (`apps/smithy-web/src/`)
   - Same as quarry-web
   - Add project indicator to Workspaces page (show which project's agents/sessions)
   - Handle project switch during active sessions (warn user)

5. **Settings Page Updates** (`apps/*/src/routes/settings/`)
   - Add "Projects" tab
   - List registered projects with actions
   - Configure default project
   - Configure projects root directory

### Acceptance Criteria
- [ ] Project selector visible in both web apps
- [ ] Switching projects updates all views immediately
- [ ] Can add/remove projects from UI
- [ ] Selected project persists across browser sessions
- [ ] Keyboard shortcut works
- [ ] Visual indication of active project

### Agent Review Loop (Post-Phase 3)
**Independent Agent Review:**
- Verify React context doesn't cause unnecessary re-renders
- Check API hook integration (request cancellation on project switch)
- Validate accessibility (ARIA labels, keyboard nav)
- Test project switch during long-running operations
- Confirm design system consistency (use existing UI components)

---

## Phase 4: Remote Access & Security

### Objective
Configure servers for secure remote access with authentication and proper CORS.

### Tasks
1. **Authentication System** (`packages/quarry/src/auth/`)
   - Simple token-based auth (configurable via `STONEFORGE_AUTH_TOKEN`)
   - Optional: OAuth2/OIDC integration (future)
   - Middleware for protecting API routes

2. **CORS Configuration** (`packages/quarry/src/server/index.ts`)
   - Allow configurable origins via env `STONEFORGE_CORS_ORIGINS`
   - Support wildcard for development
   - Credentials support for cookies/auth

3. **HTTPS/TLS Support** (`packages/quarry/src/server/index.ts`)
   - Accept `certPath` and `keyPath` options
   - Auto-generate self-signed certs for localhost (dev)
   - Document reverse proxy setup (nginx, Caddy)

4. **Rate Limiting** (`packages/quarry/src/server/rate-limit.ts`)
   - Per-IP rate limiting for API endpoints
   - Stricter limits for auth endpoints
   - Configurable via config file

5. **WebSocket Security**
   - Auth token in WebSocket handshake (query param or header)
   - Origin validation
   - Connection limits per project

6. **Environment Configuration** (`.stoneforge/control-center/config.yaml`)
   ```yaml
   controlCenter:
     port: 3456
     host: 0.0.0.0
     corsOrigins:
       - "https://your-domain.com"
     auth:
       enabled: true
       token: "secure-random-token"
     tls:
       enabled: false
       certPath: ""
       keyPath: ""
   ```

### Acceptance Criteria
- [ ] Server accessible from remote machines
- [ ] Auth token required for API access
- [ ] CORS properly configured
- [ ] HTTPS works with custom certs
- [ ] Rate limiting prevents abuse
- [ ] WebSocket connections authenticated

### Agent Review Loop (Post-Phase 4)
**Independent Agent Review:**
- Security audit of auth implementation
- Verify no sensitive data in logs
- Test CORS with various origins
- Validate rate limiting effectiveness
- Check WebSocket auth bypass attempts
- Document secure deployment checklist

---

## Phase 5: Unified Control Center App (Optional Enhancement)

### Objective
Create a dedicated "Control Center" web app for managing multiple projects, separate from the per-project quarry-web/smithy-web.

### Tasks
1. **New App: control-center-web** (`apps/control-center-web/`)
   - Dashboard showing all projects status
   - Project cards with: name, path, last activity, agent count, task stats
   - Quick actions: Open in quarry-web, Open in smithy-web, Start/Stop servers
   - Global search across projects

2. **Server Management API**
   - `POST /api/servers/start` - Start quarry/smithy servers for project
   - `POST /api/servers/stop` - Stop servers
   - `GET /api/servers/status` - Check if servers running

3. **Process Manager Integration**
   - Use PM2 or custom process manager
   - Track PIDs per project
   - Auto-restart on failure

### Acceptance Criteria
- [ ] Control center lists all projects with live status
- [ ] Can launch per-project web apps from control center
- [ ] Server management works reliably

### Agent Review Loop (Post-Phase 5)
**Independent Agent Review:**
- Verify process management reliability
- Check resource usage (multiple servers)
- Validate UX for multi-project workflow

---

## Phase 6: Documentation & Migration Guide

### Objective
Document the new multi-project workflow and provide migration guide.

### Tasks
1. **Update AGENTS.md** - Add project management references
2. **Create User Guide** - `docs/multi-project.md`
   - Quick start: `sf project add ./my-project`
   - Remote access setup
   - Project switching in UI
3. **CLI Help Updates** - `sf project --help`
4. **Migration Guide** - For existing single-project users

---

## Technical Considerations

### Database Per Project
Each project maintains its own SQLite database and JSONL files. The registry only tracks metadata.

### Service Reinitialization
Switching projects requires:
1. Close current storage backend
2. Create new storage backend for target project
3. Reinitialize all services (API, sync, inbox, etc.)
4. Broadcast change to WebSocket clients

### State Management
- In-memory state (active sessions, agent registry) is per-project
- Project switch = full service reinitialization
- Consider: Keep services warm for recently used projects (LRU cache)

### WebSocket Connections
- Clients must reconnect or handle project switch event
- Send `project_switched` event with new project config
- UI should gracefully handle transition

---

## Implementation Priority

| Phase | Priority | Effort | Dependencies |
|-------|----------|--------|--------------|
| 1 | High | Medium | None |
| 2 | High | Medium | Phase 1 |
| 3 | High | Medium | Phase 2 |
| 4 | Medium | Medium | Phase 2 |
| 5 | Low | High | Phase 3 |
| 6 | Medium | Low | All |

---

## Risk Mitigation

1. **Data Loss on Switch** - Ensure all pending writes flushed before switch
2. **Connection Leaks** - Implement proper cleanup in service teardown
3. **Race Conditions** - Use mutex for project switch operation
4. **Backward Compatibility** - Single-project mode still works without registry
5. **Performance** - Lazy-load project data; cache discovered projects

---

## Next Steps

1. **Confirm plan** with user
2. **Start Phase 1** - Create project registry types and service
3. **Run agent review** after each phase completion
4. **Iterate** based on review feedback

---

*Plan created: 2026-09-27*
*Status: Awaiting user confirmation*