# Project Folder Registration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Дати користувачу робочий спосіб додавати Stoneforge-проект із папки з перевіркою `.stoneforge/config.yaml`, зрозумілими помилками та коректною поведінкою локального й production-середовища.

**Architecture:** Основний режим залишається local-first: існуючий Quarry API працює на машині, де фізично доступна папка проекту. Production Pages не отримує доступ до `C:\...` напряму; для нього буде явний режим локального конектора або окремий upload/import-потік, без фальшивої перевірки віддаленим Worker. UI, API і MCP використовують один контракт реєстрації та валідації проекту.

**Tech Stack:** React 19, TypeScript, Vite, TanStack Query, Tailwind CSS, Quarry project routes/registry, локальна файлова система, MCP tools.

**Spec:** Поточний запит користувача та вимога `AGENTS.md` про MCP-інтеграцію нового функціоналу.

## Global Constraints

- Папка є валідним проектом лише якщо містить `.stoneforge/config.yaml`.
- Браузер не передає серверу абсолютний шлях локальної папки через звичайний folder picker.
- Cloudflare Pages/Worker не має доступу до локальної файлової системи користувача.
- Не показувати успішне додавання, якщо API недоступний або повернув HTML/404 замість JSON.
- Зберегти існуючі `GET /api/projects`, `POST /api/projects`, `PATCH /api/projects/active` та `DELETE /api/projects/:id` сумісними.
- Для нового функціоналу додати MCP tool, input/output schema, виконання та тести.
- Не чіпати secrets, auth і віддалене сховище без окремого погодження.

## Review Focus

- Локальний API вимкнений: UI показує інструкцію запустити Quarry server, а не загальну помилку — Task 4.
- Pages/Worker повертає HTML або 404: UI визначає неправильний backend і не реєструє проект — Task 4.
- Вибрана папка не має `.stoneforge/config.yaml`: показати конкретні відсутні елементи та заблокувати submit — Task 3.
- Відмінності Windows/Linux/macOS шляхів і trailing slash: нормалізація не ламає валідний шлях — Task 2.
- MCP викликається з невалідним або недоступним шляхом: structured error містить причину та наступну дію — Task 5.

### Task 1: Зафіксувати режим роботи та API-контракт

**Files:**
- Modify: `docs/PROJECT_CONTEXT.md` або відповідний проектний документ після перевірки наявної документації
- Reference: `packages/ui/src/contexts/ProjectContext.tsx`
- Reference: `packages/ui/src/components/ProjectAddModal.tsx`

**Interfaces:**
- Produces: рішення між local-path mode та folder upload/import mode; єдиний контракт `ProjectRegistrationInput`, `ProjectRegistrationResult`, `ProjectValidationResult`.

- [ ] Описати acceptance criteria для local mode: доступний Quarry API, абсолютний шлях, `.stoneforge/config.yaml`, успішний запис у registry.
- [ ] Описати production behavior: Pages не обіцяє доступ до `C:\...`; показує вимогу local connector або окремо позначений import mode.
- [ ] Зафіксувати формат помилок API: HTTP status, machine-readable code, user-facing message.
- [ ] Погодити один із двох варіантів Browse: native/local connector для передачі шляху або upload/import із копіюванням файлів у кероване сховище.

### Task 2: Уніфікувати серверну валідацію проекту

**Files:**
- Modify: `packages/quarry/src/server/project-routes.ts`
- Modify: `packages/quarry/src/services/project-registry.ts`
- Test: відповідні `*.test.ts` поруч із route/registry

**Interfaces:**
- Consumes: `ProjectRegistrationInput { path: string; name?: string; description?: string; tags?: string[] }`.
- Produces: `ProjectValidationResult { isValid, hasDirectory, hasStoneforge, hasConfig, errors }` і стабільні API errors.

- [ ] Додати/винести server-side validation, яка перевіряє directory, `.stoneforge` і `config.yaml` без довіри до client validation.
- [ ] Нормалізувати Windows та POSIX шлях, відхилити порожній шлях і шлях до файлу.
- [ ] Зберігати проект лише після успішної валідації, без частково створеного registry запису.
- [ ] Додати тести для валідної папки, відсутнього config, неіснуючого шляху, дубліката та malformed JSON.

### Task 3: Зробити UI додавання папки чесним і доступним

**Files:**
- Modify: `packages/ui/src/components/ProjectAddModal.tsx`
- Modify: `packages/ui/src/utils/projectValidation.ts`
- Test: `packages/ui/src/components/ProjectAddModal.a11y.test.tsx`

**Interfaces:**
- Consumes: `ProjectValidationResult` і `onAdd(ProjectRegistrationInput)`.
- Produces: states `idle`, `validating`, `valid`, `invalid`, `submitting`, `error`.

- [ ] Прибрати alert-заглушку `Browse...`.
- [ ] Реалізувати погоджений picker/import flow; не надсилати до API вигаданий або неповний абсолютний шлях.
- [ ] Показувати, що саме не знайдено: папка, `.stoneforge` або `config.yaml`.
- [ ] Заблокувати кнопку Add до завершення валідації та запобігти подвійному submit.
- [ ] Додати keyboard/focus behavior, `aria-live` для validation/error і коректний reset після cancel/success.
- [ ] Додати тести на valid/invalid path, API failure, loading state та keyboard close.

### Task 4: Підключити local backend і production guard

**Files:**
- Modify: `packages/ui/src/contexts/ProjectContext.tsx`
- Modify: `apps/control-center-web/vite.config.ts` або runtime API configuration
- Modify: `apps/control-center-web/src/routes/dashboard/index.tsx`
- Test: `apps/control-center-web/tests/project-add.test.tsx`

**Interfaces:**
- Consumes: API error contract from Task 2.
- Produces: clear distinction between local API unavailable, unsupported production local-folder flow, and validation failure.

- [ ] Для local dev залишити proxy `/api` на Quarry server `localhost:3456`.
- [ ] Перевіряти `Content-Type`/JSON перед parsing, щоб Pages SPA fallback не маскував API failure.
- [ ] Показувати користувачу actionable message, якщо `localhost:3456` не запущений.
- [ ] Не направляти `/api/projects` на поточний health-only Worker як на повний backend.
- [ ] Покрити тестами success, connection refused, HTML fallback, 404 і malformed response.

### Task 5: Додати MCP-інтеграцію реєстрації проектів

**Files:**
- Modify: фактичний MCP server/tool registry після пошуку поточної точки входу в `packages/` та `apps/`
- Modify: `packages/quarry/src/server/project-routes.ts` або спільний service layer для повторного використання логіки
- Test: colocated MCP tool tests

**Interfaces:**
- Produces: `project_validate_path` (read-only) і `project_register` (mutation) з typed input/output schemas.

- [ ] Зареєструвати tools з описовими назвами, параметрами `path`, `name`, `description`, `tags` та структурованою відповіддю.
- [ ] Повторно використати server service, а не дублювати filesystem validation у MCP.
- [ ] Додати annotations: validation read-only, register non-read-only/idempotent behavior визначити явно.
- [ ] Повертати actionable errors для unavailable path, missing config, duplicate project та permission denied.
- [ ] Додати unit/integration tests для schema validation, success і кожної помилки з Review Focus.

### Task 6: Перевірити локальний end-to-end сценарій

**Files:**
- Test: `apps/control-center-web/tests/project-add.test.tsx`
- Test: backend route/registry tests
- Optional modify: documentation/run command near existing development docs

- [ ] Створити тимчасову тестову папку з `.stoneforge/config.yaml`.
- [ ] Запустити Quarry server на `3456` і control-center dev server.
- [ ] Додати проект через UI, перевірити запис у списку та повторний refresh.
- [ ] Перевірити invalid folder, duplicate, server stopped і delete/refresh regression.
- [ ] Запустити targeted tests, TypeScript check і production build.

### Task 7: Задеплоїти тільки підтверджений сценарій

**Files:**
- Modify: `cloudflare/stoneforge-control-center-worker/src/index.ts` лише якщо буде окремо погоджено remote import/backend
- Modify: deployment documentation only if behavior changes

- [ ] Для local-path mode задеплоїти UI з явним повідомленням про local connector і не видавати health-only Worker за project API.
- [ ] Якщо обрано remote import, окремо спроєктувати R2/D1/storage limits, auth, quotas і lifecycle до кодування.
- [ ] Перевірити production endpoints, CSS/JS assets, API error behavior і ручний happy path.
- [ ] Запустити reviewer loop; вважати задачу готовою лише після `PASS`.
- [ ] Створити conventional commit тільки для змінених файлів і push у `main` після підтвердження.

## Open Questions

- Основний сценарій: додавати існуючий шлях через локальний Quarry server/connector чи завантажувати копію папки у кероване сховище?
- Чи потрібне додавання саме з production Pages, чи достатньо локального control-center для роботи з локальними папками?

## Self-review

- Покрито UI, local API, production guard, filesystem validation, MCP, tests і deployment boundary.
- Абсолютний локальний шлях не маскується browser-only picker як підтримуваний production capability.
- MCP requirement винесено в окрему тестовану задачу й прив'язано до спільного service layer.
- План не змінює код і не обіцяє remote filesystem capability, якої поточний Worker не має.
