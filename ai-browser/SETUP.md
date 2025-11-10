# AI Browser - Руководство по установке и запуску

Полное руководство по установке, настройке и запуску AI Browser на Linux Mint 22.2.

## Содержание

- [Системные требования](#системные-требования)
- [Быстрый старт](#быстрый-старт)
- [Установка зависимостей](#установка-зависимостей)
- [Конфигурация](#конфигурация)
- [Запуск системы](#запуск-системы)
- [Тестирование](#тестирование)
- [Troubleshooting](#troubleshooting)

---

## Системные требования

### Обязательные

- **ОС**: Linux Mint 22.2 (или Ubuntu 22.04+, Debian 12+)
- **Node.js**: >= 18.0 (рекомендуется 20.x или 22.x)
- **npm**: >= 9.0
- **RAM**: >= 4GB (рекомендуется 8GB)
- **Дисковое пространство**: >= 2GB

### Опциональные

- **Redis**: >= 6.0 (для персистентности, кэширования, управления сессиями)
- **Docker**: для простого запуска Redis
- **Graphical Environment**: для запуска Electron UI

---

## Быстрый старт

```bash
# 1. Клонировать репозиторий (если еще не клонирован)
git clone <repository-url>
cd ai-browser

# 2. Запустить launcher - он проверит зависимости и предложит их установить
./launch.sh

# Launcher проведет через все шаги установки и запуска
```

---

## Установка зависимостей

### 1. Установка Node.js (если не установлен)

```bash
# Проверка текущей версии
node --version

# Если версия < 18 или Node.js не установлен:
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# Проверка установки
node --version  # Должно быть >= 18.0
npm --version   # Должно быть >= 9.0
```

### 2. Установка зависимостей всех модулей

```bash
cd ai-browser

# Установка зависимостей для каждого модуля
for dir in electron-app coordination task-queue browser-control tools redis-integration; do
  echo "Installing $dir..."
  (cd $dir && npm install)
done
```

**Или автоматически через скрипт:**

```bash
./scripts/install-all.sh
```

### 3. Установка Playwright browsers (для Browser Control)

```bash
cd browser-control
npx playwright install chromium
```

### 4. Установка Redis (опционально, но рекомендуется)

#### Вариант A: Docker (рекомендуется)

```bash
# Запуск Redis в Docker
docker run -d \
  --name ai-browser-redis \
  -p 6379:6379 \
  redis:7-alpine

# Проверка
redis-cli ping  # Должно вернуть PONG
```

#### Вариант B: Локальная установка

```bash
sudo apt-get update
sudo apt-get install redis-server

# Запуск Redis
sudo systemctl start redis-server
sudo systemctl enable redis-server

# Проверка
redis-cli ping  # Должно вернуть PONG
```

---

## Конфигурация

### 1. API ключи для AI моделей

Для работы с внешними AI API (например, DALL-E для генерации изображений) требуются API ключи.

**Создайте `.env` файл в корне `tools/`:**

```bash
cd tools
nano .env
```

**Содержимое `.env`:**

```bash
# OpenAI API (для DALL-E)
OPENAI_API_KEY=sk-...your-key-here...

# n8n Workflow API (опционально)
N8N_API_URL=http://localhost:5678/api/v1
N8N_API_KEY=your-n8n-api-key

# Stable Diffusion API (опционально)
STABLE_DIFFUSION_API_KEY=your-api-key
```

**Получение API ключей:**

- **OpenAI**: https://platform.openai.com/api-keys
- **Stable Diffusion**: https://stability.ai/
- **n8n**: Локальная установка или https://n8n.io/cloud

### 2. Конфигурация Redis (если требуется нестандартная)

**Создайте `.env` файл в корне `redis-integration/`:**

```bash
cd redis-integration
nano .env
```

**Содержимое `.env`:**

```bash
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=  # Оставьте пустым, если без пароля
REDIS_DB=0
```

### 3. Конфигурация Browser Control

**Файл `browser-control/config/providers.json`:**

Настройте селекторы и параметры для автоматизации web-based AI моделей.

```json
{
  "chatgpt": {
    "url": "https://chat.openai.com",
    "selectors": {
      "input": "textarea[placeholder*='Message']",
      "submit": "button[data-testid='send-button']",
      "message": ".markdown"
    }
  },
  "claude": {
    "url": "https://claude.ai",
    "selectors": {
      "input": "div[contenteditable='true']",
      "submit": "button[aria-label='Send Message']",
      "message": ".font-claude-message"
    }
  }
}
```

---

## Запуск системы

### Через Launcher (рекомендуется)

```bash
cd ai-browser
./launch.sh
```

**Launcher предлагает:**

1. Запустить Electron приложение
2. Запустить тесты всех модулей
3. Запустить интеграционный тест
4. Запустить демо Redis Integration
5. Запустить демо Tools

### Ручной запуск компонентов

#### 1. Запуск Electron приложения

```bash
cd electron-app
npm start
```

**Для headless режима (без графического интерфейса):**

```bash
# Запуск с Xvfb (виртуальный X сервер)
sudo apt-get install xvfb
xvfb-run --auto-servernum npm start
```

#### 2. Запуск в режиме разработки

```bash
cd electron-app
npm start -- --dev
```

---

## Тестирование

### Запуск всех тестов

```bash
# Через launcher
./launch.sh
# Выбрать опцию 2

# Или вручную:
./scripts/run-all-tests.sh
```

### Тесты отдельных модулей

#### Electron App

```bash
cd electron-app
node src/test-modules.js
```

**Результат:** 17/17 тестов должны пройти

#### Coordination Module

```bash
cd coordination
npm test
```

**Результат:** 20/20 тестов должны пройти

#### Task Queue Module

```bash
cd task-queue
npm test
```

**Результат:** 32/32 теста должны пройти

#### Browser Control

```bash
cd browser-control
npm test
```

**Результат:** 13/13 тестов должны пройти

#### Tools Module

```bash
cd tools
npm test
```

**Результат:** 29/29 тестов должны пройти

#### Redis Integration

```bash
cd redis-integration
npm test
```

**Результат:** 5/5 тестов должны пройти (с предупреждением, если Redis не запущен)

### Интеграционные тесты

```bash
cd ai-browser
NODE_PATH=./coordination/node_modules:./task-queue/node_modules:./tools/node_modules:./redis-integration/node_modules \
  node test/integration-test.js
```

**Результат:** 18/18 тестов должны пройти (1 предупреждение о Redis - это нормально)

---

## Примеры использования

### 1. Демо Redis Integration

```bash
# Убедитесь, что Redis запущен
redis-cli ping

# Запуск демо
cd examples
NODE_PATH=../redis-integration/node_modules node redis-demo.js
```

**Демонстрирует:**

- Создание и управление сессиями
- Кэширование ответов AI
- Персистентность задач
- Статистика Redis

### 2. Демо Tools

```bash
cd examples
NODE_PATH=../tools/node_modules node tools-demo.js
```

**Демонстрирует:**

- Генерация изображений (DALL-E - требует API key)
- Генерация документов (PDF, DOCX, Markdown, HTML)
- Создание n8n workflows

### 3. Программное использование

#### Координация моделей

```javascript
const { createCoordinationSystem } = require('./coordination/src');
const logger = require('winston').createLogger({
  level: 'info',
  transports: [new winston.transports.Console()]
});

const { messageBus, coordinator, sharedState } = createCoordinationSystem(logger);

// Регистрация модели
messageBus.publish('coordinator:register', {
  modelId: 'my-model',
  capabilities: ['coding', 'text-generation'],
  priority: 8
}, 'my-app');

// Создание задачи
messageBus.publish('task:create', {
  type: 'coding',
  description: 'Write a function',
  priority: 7,
  requiredCapabilities: ['coding']
}, 'my-app');
```

#### Управление задачами

```javascript
const { createTaskSystem } = require('./task-queue/src');

const { taskQueue, taskDistributor } = createTaskSystem(coordinator, logger);

// Добавление задачи
const taskId = taskQueue.add({
  type: 'coding',
  description: 'Implement feature X',
  priority: 8,
  requiredCapabilities: ['coding'],
  data: { files: ['app.js'], requirements: '...' }
});

// Распределение задачи
const assignment = await taskDistributor.distributeNext();
if (assignment) {
  console.log(`Task ${assignment.task.id} assigned to ${assignment.model.id}`);
}
```

#### Автоматизация браузера

```javascript
const { BrowserController } = require('./browser-control/src');

const browser = new BrowserController(logger, {
  headless: false,
  slowMo: 100
});

await browser.initialize();

// Взаимодействие с ChatGPT
const chatgpt = browser.getProvider('chatgpt');
await chatgpt.navigate();
await chatgpt.login(); // Требуется сохраненная сессия

const response = await chatgpt.sendMessage('Hello, how are you?');
console.log('Response:', response);

await browser.close();
```

#### Генерация документов

```javascript
const { createToolsSystem } = require('./tools/src');

const { documentGenerator } = createToolsSystem(logger);

// Генерация PDF
const pdf = await documentGenerator.generate('# My Report\n\nThis is content.', {
  format: 'pdf',
  filename: 'report.pdf',
  title: 'Project Report',
  author: 'AI Browser'
});

console.log('PDF created:', pdf.filepath);
```

#### Кэширование с Redis

```javascript
const { createRedisSystem } = require('./redis-integration/src');

const { cacheManager, redisManager } = createRedisSystem(logger);
await redisManager.connect();

// Кэширование ответа AI
await cacheManager.set('gpt-4', 'Hello', 'Hi there!', { ttl: 3600 });

// Получение из кэша
const cached = await cacheManager.get('gpt-4', 'Hello');
if (cached) {
  console.log('From cache:', cached.response);
}
```

---

## Troubleshooting

### 1. Electron не запускается: "Failed to launch Electron"

**Проблема:** Отсутствуют системные библиотеки

**Решение:**

```bash
sudo apt-get update
sudo apt-get install -y \
  libgtk-3-0 \
  libnotify4 \
  libnss3 \
  libxss1 \
  libxtst6 \
  xdg-utils \
  libatspi2.0-0 \
  libdrm2 \
  libgbm1 \
  libxshmfence1
```

### 2. Electron не запускается от root

**Проблема:** `Running as root without --no-sandbox is not supported`

**Решение:**

```bash
# Вариант 1: Добавить --no-sandbox в electron-app/main.js
app.commandLine.appendSwitch('no-sandbox');

# Вариант 2: Запуск от обычного пользователя (рекомендуется)
sudo -u username npm start
```

### 3. Redis connection refused

**Проблема:** `Error: connect ECONNREFUSED 127.0.0.1:6379`

**Решение:**

```bash
# Проверьте, запущен ли Redis
redis-cli ping

# Если нет, запустите:
docker run -d -p 6379:6379 redis:7-alpine
# или
sudo systemctl start redis-server
```

### 4. Cannot find module 'winston' в тестах

**Проблема:** Модуль winston не найден при запуске интеграционных тестов

**Решение:**

```bash
# Используйте NODE_PATH
NODE_PATH=./coordination/node_modules:./task-queue/node_modules:./tools/node_modules:./redis-integration/node_modules \
  node test/integration-test.js

# Или используйте launcher
./launch.sh
```

### 5. Playwright browsers не установлены

**Проблема:** `browserType.launch: Executable doesn't exist`

**Решение:**

```bash
cd browser-control
npx playwright install chromium
```

### 6. DALL-E API ошибка: "Invalid API key"

**Проблема:** Отсутствует или неверный API ключ

**Решение:**

```bash
# Создайте .env файл в tools/
cd tools
echo "OPENAI_API_KEY=sk-your-actual-key" > .env

# Проверьте ключ: https://platform.openai.com/api-keys
```

### 7. Permission denied для launch.sh

**Проблема:** `./launch.sh: Permission denied`

**Решение:**

```bash
chmod +x launch.sh
```

### 8. Tests fail: "timeout exceeded"

**Проблема:** Тесты не завершаются из-за таймаута

**Возможные причины:**

- Медленное интернет-соединение (для download тестов)
- Недостаточно ресурсов системы

**Решение:**

```bash
# Увеличьте таймауты в тестовых файлах
# Или запускайте тесты по одному модулю
```

### 9. n8n workflow creation fails

**Проблема:** Не удается создать workflow

**Решение:**

- Проверьте, установлен ли n8n локально: `npx n8n`
- Убедитесь, что API endpoint корректен в `.env`
- Workflow JSON создается локально, даже если n8n не запущен

---

## Архитектура системы

```
ai-browser/
├── electron-app/          # Главное Electron приложение
│   ├── main.js            # Main process
│   ├── renderer.js        # Renderer process
│   └── preload.js         # Preload script для IPC
│
├── coordination/          # Межмодельная координация
│   ├── message-bus.js     # Pub/Sub система
│   ├── coordinator.js     # Распределение задач
│   └── shared-state.js    # Общее состояние
│
├── task-queue/            # Управление задачами
│   ├── task-queue.js      # Очередь с приоритетами
│   └── task-distributor.js # Распределение задач
│
├── browser-control/       # Автоматизация браузера
│   ├── browser-controller.js # Управление Playwright
│   └── providers/         # Провайдеры для ChatGPT, Claude и др.
│
├── tools/                 # Инструменты генерации
│   ├── image-generator.js     # DALL-E, Stable Diffusion
│   ├── document-generator.js  # PDF, DOCX, MD, HTML
│   └── workflow-generator.js  # n8n workflows
│
└── redis-integration/     # Персистентность и кэш
    ├── redis-manager.js   # Управление Redis
    ├── session-store.js   # Хранение сессий
    ├── task-persistence.js # Персистентность задач
    └── cache-manager.js   # Кэширование ответов
```

### Взаимодействие модулей

```
Electron App (UI)
    ↓
Coordination System (MessageBus, Coordinator, SharedState)
    ↓
Task Queue (TaskQueue, TaskDistributor)
    ↓
├── Browser Control (Playwright automation)
├── Tools (Generation: Images, Docs, Workflows)
└── Redis Integration (Persistence, Cache, Sessions)
```

---

## Производительность

### Рекомендуемые настройки

- **Task Queue**: maxQueueSize = 1000
- **Redis Cache**: maxCacheSize = 10000, defaultTTL = 3600s
- **Browser Control**: headless = true для производственного использования
- **Logger**: level = 'info' для production, 'debug' для development

### Мониторинг

```javascript
// Статистика Task Queue
const stats = taskQueue.getStats();
console.log('Tasks:', stats.total, 'Pending:', stats.pending, 'Completed:', stats.completed);

// Статистика Cache
const cacheStats = await cacheManager.getStats();
console.log('Hit Rate:', cacheStats.hitRate, 'Size:', cacheStats.size);

// Статистика Redis
const redisStats = redisManager.getStats();
console.log('Commands:', redisStats.commands, 'Uptime:', redisStats.uptime);
```

---

## Разработка

### Добавление нового провайдера браузера

1. Создайте файл `browser-control/src/providers/your-provider.js`
2. Наследуйтесь от `BaseProvider`
3. Реализуйте методы: `navigate()`, `login()`, `sendMessage()`, `waitForResponse()`
4. Зарегистрируйте в `browser-control/config/providers.json`

### Добавление нового типа документа

1. Откройте `tools/src/document-generator.js`
2. Добавьте метод `generateYourFormat(content, options)`
3. Добавьте обработку в `generate()` switch case

### Добавление нового AI провайдера для изображений

1. Откройте `tools/src/image-generator.js`
2. Добавьте метод `generateWithYourProvider(prompt, options)`
3. Добавьте обработку в `generate()` switch case

---

## Лицензия

MIT

---

## Поддержка

Для вопросов и отчетов об ошибках создайте Issue в репозитории GitHub.

**Версия документа:** 1.0.0
**Дата обновления:** 2025-11-10
