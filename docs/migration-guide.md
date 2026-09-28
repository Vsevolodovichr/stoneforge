# Migration Guide: Single-Project to Multi-Project Mode

Цей гайд допоможе перейти з однопроектного режиму на multi-project Control Center.

## Що змінилось?

### Раніше (однопроектний режим)
```bash
# Кожен проект запускався окремо
cd /path/to/project1
bun run --filter @stoneforge/quarry-server dev

cd /path/to/project2
bun run --filter @stoneforge/quarry-server dev
```

### Тепер (multi-project режим)
```bash
# Один сервер для всіх проектів
bun run --filter @stoneforge/quarry-server dev

# Перемикання між проектами через UI або CLI
sf project switch <project-id>
```

## Кроки міграції

### Крок 1: Оновлення конфігурації

1. **Відкрийте конфігурацію**:

```bash
sf config edit
```

2. **Додайте секцію control_center** (якщо її немає):

```yaml
control_center:
  port: 3456
  host: localhost
  remote_access: false
  auth:
    enabled: false
    token: null
  tls:
    enabled: false
    cert_path: null
    key_path: null
  rate_limit:
    enabled: true
    max_requests: 100
    window_ms: 60000
```

### Крок 2: Реєстрація існуючих проектів

1. **Зареєструйте ваш поточний проект**:

```bash
cd /path/to/your/project
sf project add . --name "My Project"
```

2. **Або автоматично знайдіть всі проекти**:

```bash
# Знайти всі проекти в директорії
sf project discover ~/projects

# Автоматично зареєструвати всі знайдені
sf project auto-register ~/projects
```

3. **Перевірте список проектів**:

```bash
sf project list
```

### Крок 3: Запуск сервера

1. **Запустіть сервер з Control Center**:

```bash
# З будь-якого місця
bun run --filter @stoneforge/quarry-server dev
```

2. **Відкрийте веб-інтерфейс**:

```
http://localhost:5173
```

3. **Перемкніться на ваш проект** через UI або CLI:

```bash
sf project switch <project-id>
```

### Крок 4: Налаштування віддаленого доступу (опціонально)

1. **Увімкніть віддалений доступ**:

```bash
sf config set controlCenter.host 0.0.0.0
sf config set controlCenter.remoteAccess true
```

2. **Увімкніть автентифікацію**:

```bash
sf config set controlCenter.auth.enabled true
sf config set controlCenter.auth.token "your-secure-token"
```

3. **Налаштуйте CORS**:

```bash
sf config set controlCenter.corsOrigins '["https://your-domain.com"]'
```

4. **Перезапустіть сервер**:

```bash
bun run --filter @stoneforge/quarry-server dev
```

## Міграція конфігурації проекту

Ваша існуюча конфігурація в `.stoneforge/config.yaml` продовжує працювати без змін. Control Center додасть секцію `control_center` з налаштуваннями за замовчуванням.

### Приклад міграції

**До:**
```yaml
# .stoneforge/config.yaml
actor: my-agent
database: stoneforge.db
sync:
  auto_export: true
```

**Після:**
```yaml
# .stoneforge/config.yaml
actor: my-agent
database: stoneforge.db
sync:
  auto_export: true

# Додається автоматично
control_center:
  port: 3456
  host: localhost
  remote_access: false
  auth:
    enabled: false
    token: null
  tls:
    enabled: false
    cert_path: null
    key_path: null
  rate_limit:
    enabled: true
    max_requests: 100
    window_ms: 60000
```

## Мігація скриптів запуску

### Якщо ви використовуєте package.json scripts

**До:**
```json
{
  "scripts": {
    "dev": "bun run --filter @stoneforge/quarry-server dev",
    "dev:project1": "cd ../project1 && bun run dev",
    "dev:project2": "cd ../project2 && bun run dev"
  }
}
```

**Після:**
```json
{
  "scripts": {
    "dev": "bun run --filter @stoneforge/quarry-server dev",
    "dev:control-center": "bun run --filter @stoneforge/control-center-web dev"
  }
}
```

### Якщо ви використовуєте Docker

**До:**
```yaml
# docker-compose.yml
services:
  project1:
    build: ./project1
    ports:
      - "3456:3456"
  project2:
    build: ./project2
    ports:
      - "3457:3456"
```

**Після:**
```yaml
# docker-compose.yml
services:
  control-center:
    build: .
    ports:
      - "3456:3456"
      - "5173:5173"
    volumes:
      - ./projects:/projects
```

## Мігація CI/CD

### GitHub Actions

**До:**
```yaml
- name: Start Project 1
  run: |
    cd project1
    bun run dev &

- name: Start Project 2
  run: |
    cd project2
    bun run dev &
```

**Після:**
```yaml
- name: Start Control Center
  run: bun run --filter @stoneforge/quarry-server dev &

- name: Register Projects
  run: |
    sf project add ./project1 --name "Project 1"
    sf project add ./project2 --name "Project 2"
```

## Перевірка міграції

### Чеклист

- [ ] Конфігурація control_center додана
- [ ] Проєкти зареєстровані (`sf project list`)
- [ ] Сервер запускається без помилок
- [ ] Веб-інтерфейс доступний
- [ ] Перемикання між проектами працює
- [ ] Дані проектів збережені

### Тести

```bash
# Перевірка статусу сервера
curl http://localhost:3456/api/health

# Перевірка списку проектів
sf project list

# Перевірка активного проекту
sf project current
```

## Відкат змін

Якщо потрібно повернутися до однопроектного режиму:

1. **Видаліть проекти з реєстру**:

```bash
sf project remove <project-id>
```

2. **Видаліть секцію control_center** з конфігурації:

```bash
sf config unset controlCenter
```

3. **Запустіть сервер як раніше**:

```bash
cd /path/to/project
bun run --filter @stoneforge/quarry-server dev
```

## Допомога

Якщо виникли проблеми:

1. **Перевірте логи сервера**
2. **Перевірте конфігурацію**: `sf config show`
3. **Перевірте реєстр проектів**: `sf project list`
4. **Запустіть діагностику**: `sf doctor`