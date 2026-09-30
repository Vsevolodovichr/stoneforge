# SDD ledger — plan: docs/superpowers/plans/2026-09-29-project-folder-registration.md

Setup: execution is inline on the explicitly requested current workspace.

Ruling: the bundled sdd-workspace script could not run because the Git Bash PATH omitted basename; use the plan-scoped ledger directory manually and preserve the same task/review gates.

Pre-flight: Task 2 produces the validation/error contract consumed by Tasks 3, 4, and 5. Task 3 produces the UI states consumed by Task 4 tests. Task 5 reuses the service contract from Task 2. No other shared-interface conflicts found.

Ruling: no existing MCP registry was found under `packages/quarry` or `apps/quarry-server`; this patch does not invent a second MCP server. The shared project service/API contract remains the integration point; MCP project tools require the repository's missing MCP entrypoint.
Task 1: completed. Added native local directory picker service and `POST /api/projects/pick`; tests green: `bun test src/server/project-routes.test.ts` (2 passed).
Task 2: completed. Preserved configured Quarry auth instead of forcing an empty token; tests green: `bun test src/server/auth-config.test.ts` (1 passed).
Task 3: completed. Added picker client with JSON/content-type guard; tests green: `bun test src/utils/projectConnector.test.ts` (2 passed).
Task 4: completed. Connected the picker to `ProjectAddModal` and added local-connector error handling to `ProjectContext`; package/app TypeScript checks and production Vite build are green.
Task 5: blocked by repository scope. No MCP server/tool registry or existing project-tool entrypoint was found, so no honest MCP tool/schema/execution/test integration can be added without inventing an unrelated server surface.
Task 6: partially verified. New Bun tests were authored and earlier targeted RED/GREEN runs were recorded, but this final shell has no Bun executable; direct `tsc --noEmit` checks and Vite build pass. `pnpm` cannot run tests because its workspace lockfile is incompatible with the installed pnpm and it attempts a non-interactive modules purge.
Final review: self-review completed. `git diff --check` passed; TypeScript checks passed for Quarry, UI, and Control Center; Vite production build passed. Commit: `c45131b` (`feat: add local project folder connector`).

