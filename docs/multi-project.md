# Multi-Project Mode

Stoneforge Control Center дозволяє керувати кількома проектами з єдиного інтерфейсу. Замість запуску окремих серверів для кожного проекту, ви можете запустити один сервер і перемикатися між проектами через UI або CLI.

## Швидкий старт

### 1. Реєстрація проектів

```bash
# Зареєструвати проект
sf project add /path/to/project

# Або з ім'ям
sf project add /path/to/project --name "My Project"

# Переглянути список проектів
sf project list
```

### 2. Перемикання між проектами

```bash
# Перемкнутися на інший проект
sf project switch <project-id>

# Переглянути активний проект
sf project current
```

### 3. Запуск сервера

```bash
# Запустить сервер (за замовчуванням порт 3456)
bun run --filter @stoneforge/quarry-server dev

# Або з конфігурацією
bun run --filter @stoneforge/quarry-server dev -- --port 3456 --host 0.0.0.0
```

## Конфігурація

### Налаштування Control Center

```yaml
# .stoneforge/config.yaml
control_center:
  # Порт сервера (за замовчуванням: 3456)
  port: 3456
  
  # Хост (за замовчуванням: localhost)
  # Використовуйте 0.0.0.0 для віддаленого доступу
  host: localhost
  
  # Дозволити віддалений доступ
  remote_access: false
  
  # CORS origins
  cors_origins:
    - http://localhost:5173
    - http://localhost:5174
  
  # Автентифікація
  auth:
    enabled: false
    token: "your-secure-token"
  
  # TLS/SSL
  tls:
    enabled: false
    cert_path: "/path/to/cert.pem"
    key_path: "/path/to/key.pem"
  
  # Rate limiting
  rate_limit:
    enabled: true
    max_requests: 100
    window_ms: 60000
```

### Змінні середовища

```bash
# Порт сервера
export PORT=3456

# Хост
export HOST=0.0.0.0

# Шлях до бази даних
export STONEFORGE_DB_PATH=/path/to/stoneforge.db

# Auth token
export STONEFORGE_AUTH_TOKEN=your-secure-token
```

## Віддалений доступ

### Налаштування сервера

1. **Змініть хост на 0.0.0.0** для прийому з'єднань з будь-якої мережі:

```yaml
control_center:
  host: 0.0.0.0
  remote_access: true
```

2. **Увімкніть автентифікацію** для безпеки:

```yaml
control_center:
  auth:
    enabled: true
    token: "your-secure-token"
```

3. **Налаштуйте CORS** для вашого домену:

```yaml
control_center:
  cors_origins:
    - https://your-domain.com
```

### Використання з токеном

```bash
# Через query parameter
curl "http://your-server:3456/api/projects?token=your-secure-token"

# Через заголовок
curl -H "Authorization: Bearer your-secure-token" http://your-server:3456/api/projects

# Через X-Auth-Token
curl -H "X-Auth-Token: your-secure-token" http://your-server:3456/api/projects
```

### WebSocket з токеном

```javascript
const ws = new WebSocket('ws://your-server:3456/ws?token=your-secure-token');
```

## HTTPS/TLS

### Генерація самопідписаного сертифіката (для розробки)

```bash
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes
```

### Налаштування TLS

```yaml
control_center:
  tls:
    enabled: true
    cert_path: "/path/to/cert.pem"
    key_path: "/path/to/key.pem"
```

### Використання з reverse proxy

Для продакшену рекомендується використовувати reverse proxy (nginx, Caddy):

```nginx
# nginx example
server {
    listen 443 ssl;
    server_name your-domain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:3456;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

## Control Center Web App

Control Center має власний веб-інтерфейс для керування проектами:

```bash
# Запустити Control Center Web
bun run --filter @stoneforge/control-center-web dev
```

Функції:
- Перегляд всіх проектів
- Перемикання між проектами
- Відкриття проекту в Quarry або Smithy
- Статистика по проектах

## CLI команди

### Керування проектами

```bash
# Список проектів
sf project list

# Додати проект
sf project add <path> [--name <name>] [--description <desc>] [--tags <tags>]

# Видалити проект
sf project remove <project-id>

# Перемкнутися на проект
sf project switch <project-id>

# Показати активний проект
sf project current

# Оновити проект
sf project update <project-id> [--name <name>] [--description <desc>] [--tags <tags>] [--status <status>]

# Статистика
sf project stats

# Пошук проектів
sf project discover [path] [--depth <n>]

# Автоматична реєстрація
sf project auto-register [path] [--depth <n>]
```

## Міграція з однопроектного режиму

### Для існуючих користувачів

1. **Зареєструйте ваш існуючий проект**:

```bash
cd /path/to/your/project
sf project add . --name "My Existing Project"
```

2. **Запустіть сервер з Control Center**:

```bash
# З будь-якого місця
bun run --filter @stoneforge/quarry-server dev
```

3. **Відкрийте веб-інтерфейс**:

```
http://localhost:5173
```

4. **Перемкніться на ваш проект** через UI або CLI:

```bash
sf project switch <project-id>
```

### Міграція конфігурації

Ваша існуюча конфігурація в `.stoneforge/config.yaml` продовжує працювати. Control Center додасть секцію `control_center` з налаштуваннями за замовчуванням.

## Архітектура

### Сховище проектів

```
.stoneforge/
├── config.yaml          # Конфігурація проекту
├── control-center/
│   └── projects.json    # Реєстр проектів
├── stoneforge.db        # База даних проекту
└── sync/                # Синхронізація
```

### API ендпоінти

| Метод | Шлях | Опис |
|-------|------|------|
| GET | `/api/projects` | Список проектів |
| POST | `/api/projects` | Реєстрація проекту |
| GET | `/api/projects/active` | Активний проект |
| PATCH | `/api/projects/active` | Перемикання проекту |
| GET | `/api/projects/:id` | Отримати проект |
| PATCH | `/api/projects/:id` | Оновити проект |
| DELETE | `/api/projects/:id` | Видалити проект |
| POST | `/api/projects/discover` | Пошук проектів |
| POST | `/api/projects/auto-register` | Автоматична реєстрація |
| GET | `/api/projects/stats` | Статистика |
| GET | `/api/projects/:id/status` | Статус проекту |

## Безпека

### Рекомендації

1. **Завжди вмикайте auth** для віддаленого доступу
2. **Використовуйте HTTPS** в продакшені
3. **Обмежуйте CORS** тільки вашим доменом
4. **Використовуйте rate limiting** для захисту від DDoS
5. **Регулярно оновлюйте токен**

### Приклад безпечної конфігурації

```yaml
control_center:
  host: 0.0.0.0
  remote_access: true
  auth:
    enabled: true
    token: "change-this-to-a-secure-random-token"
  tls:
    enabled: true
    cert_path: "/etc/letsencrypt/live/your-domain.com/fullchain.pem"
    key_path: "/etc/letsencrypt/live/your-domain.com/privkey.pem"
  cors_origins:
    - https://your-domain.com
  rate_limit:
    enabled: true
    max_requests: 100
    window_ms: 60000
```

## Вирішення проблем

### Проект не знаходиться

```bash
# Перевірте чи має проект .stoneforge директорію
ls -la /path/to/project/.stoneforge

# Має містити config.yaml
cat /path/to/project/.stoneforge/config.yaml
```

### Помилка автентифікації

```bash
# Перевірте чи auth увімкнено
sf config show controlCenter.auth.enabled

# Перевірте токен
sf config show controlCenter.auth.token
```

### Проблеми з CORS

```bash
# Додайте ваш домен в CORS
sf config set controlCenter.corsOrigins '["https://your-domain.com"]'
```

## Див. також

- [CLI Reference](../packages/quarry/src/cli/commands/project.ts)
- [Project Registry](../packages/quarry/src/services/project-registry.ts)
- [Auth Middleware](../packages/quarry/src/auth/index.ts)
- [Control Center Web](../apps/control-center-web/)