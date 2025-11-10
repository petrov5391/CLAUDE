# AI Browser

**AI-управляемый браузер на базе Chromium для автоматизации задач**

Современный браузер с интегрированными AI-агентами, способными выполнять сложные задачи через web-интерфейсы и API.

## 🎯 Основные возможности

### ✅ Реализовано (v0.1.0)

- **🪟 Многовкладочный браузер** на базе Electron + Chromium
- **🧠 Поддержка множества AI моделей**:
  - API: OpenAI (GPT-4, GPT-3.5), Anthropic (Claude 3), Google (Gemini)
  - Web: ChatGPT, Claude, DeepSeek через браузерную автоматизацию
  - Local: Ollama для локальных моделей
- **📊 Dashboard с мониторингом**:
  - Статистика активных вкладок и моделей
  - Журнал событий в реальном времени
  - Список доступных AI моделей
- **🔐 Изоляция вкладок**: каждая вкладка работает в отдельном контексте
- **📝 Система логирования**: Winston logger с ротацией логов
- **⚙️ Менеджер вкладок**: создание, закрытие, навигация
- **🤖 Менеджер AI моделей**: привязка моделей к вкладкам

### ✅ Browser Control Module (v0.2.0)

- **🎭 Playwright интеграция** - полная автоматизация web-интерфейсов
- **🤖 Провайдеры**:
  - ChatGPT (chat.openai.com) - отправка промптов, получение ответов
  - Claude (claude.ai) - работа через web-интерфейс
  - DeepSeek (chat.deepseek.com) - автоматизация coding задач
- **Возможности**:
  - Создание браузерных сессий
  - Управление cookies и авторизацией
  - Сохранение/восстановление состояния
  - Множественные сессии одновременно
  - Headless и GUI режимы

### 🚧 В разработке

- **💬 Межмодельная коммуникация** через message bus
- **🔄 Очередь задач** с приоритизацией
- **🎨 Генерация изображений** (DALL-E, Midjourney, Stable Diffusion)
- **📄 Генерация документов** (PDF, DOCX, PPTX)
- **🔗 n8n workflow генератор**
- **📡 Redis интеграция** для управления сессиями

## 🏗️ Архитектура

```
ai-browser/
├── electron-app/          # Основное Electron приложение
│   ├── src/
│   │   ├── main/         # Главный процесс (Node.js)
│   │   │   ├── index.js          # Точка входа
│   │   │   ├── logging.js        # Система логирования
│   │   │   ├── tab-manager.js    # Управление вкладками
│   │   │   └── ai-model-manager.js # Управление AI моделями
│   │   ├── preload/      # Preload скрипты (безопасный API)
│   │   │   └── index.js
│   │   └── renderer/     # Renderer процесс (UI)
│   │       └── app.js
│   ├── public/           # Статические файлы
│   │   └── index.html    # Dashboard
│   └── package.json
├── browser-control/      # ✅ Playwright автоматизация
│   ├── src/
│   │   ├── browser-controller.js  # Главный контроллер
│   │   ├── browser-session.js     # Управление сессиями
│   │   └── providers/             # Провайдеры для web-моделей
│   │       ├── chatgpt-provider.js
│   │       ├── claude-provider.js
│   │       └── deepseek-provider.js
│   └── package.json
├── examples/             # Примеры использования
│   └── browser-control-integration.js
├── backend-api/          # Backend координации (TODO)
├── n8n-workflows/        # Готовые workflow (TODO)
└── logs/                 # Логи приложения
```

## 🚀 Быстрый старт

### Требования

- **Node.js** >= 18.0.0
- **npm** >= 9.0.0
- **Linux Mint 22.2** (или другая Linux дистрибуция)
- **Git**

### Установка

1. **Клонируйте репозиторий** (или используйте существующую директорию):

```bash
cd /home/user/CLAUDE/ai-browser/electron-app
```

2. **Установите зависимости**:

```bash
npm install
```

3. **Запустите в режиме разработки**:

```bash
npm run dev
```

4. **Соберите для продакшена**:

```bash
npm run build
```

## 📖 Использование

### Создание новой вкладки

```javascript
// Через API в renderer процессе
const result = await window.electronAPI.tabs.create({
  url: 'https://example.com',
  modelId: 'gpt-4-turbo',  // Опционально
  isolated: true            // Изоляция контекста
});
```

### Привязка AI модели к вкладке

```javascript
await window.electronAPI.ai.assignModel(
  tabId,
  'claude-3-opus',
  {
    authData: { /* ... */ },
    temperature: 0.7
  }
);
```

### Отправка промпта модели

```javascript
const response = await window.electronAPI.ai.sendPrompt(
  tabId,
  'Напиши код для парсинга HTML',
  { context: { /* ... */ } }
);
```

## 🔧 Конфигурация

### Переменные окружения

```bash
# Режим разработки
NODE_ENV=development

# Уровень логирования (debug, info, warn, error)
LOG_LEVEL=info
```

### API ключи

API ключи хранятся в зашифрованном виде в `electron-store`. Настройка через UI (будет реализовано в следующей версии).

## 📊 Мониторинг

### Логи

Логи сохраняются в:
- `logs/ai-browser.log` - основной лог
- `logs/ai-browser-error.log` - только ошибки

Просмотр в реальном времени:

```bash
tail -f logs/ai-browser.log
```

### Dashboard

Dashboard доступен на домашней странице браузера:
- **Статистика**: количество вкладок, моделей, задач
- **Журнал событий**: последние 20 записей
- **Список моделей**: доступные AI модели

## 🧪 Разработка

### Структура кода

- **Main процесс** (`src/main/`): управление окнами, IPC, системные операции
- **Preload** (`src/preload/`): безопасный мост между main и renderer
- **Renderer** (`src/renderer/`): UI логика и взаимодействие с пользователем

### IPC Communication

Связь между процессами через `ipcMain` / `ipcRenderer`:

```javascript
// Main процесс
ipcMain.handle('tab:create', async (event, options) => {
  return await tabManager.createTab(options);
});

// Renderer процесс (через preload)
await window.electronAPI.tabs.create(options);
```

### Добавление новой модели

Редактируйте `src/main/ai-model-manager.js`:

```javascript
this.registerModel({
  id: 'my-model',
  name: 'My Custom Model',
  provider: 'custom',
  type: 'api',
  capabilities: ['text'],
  endpoint: 'https://api.example.com/v1/chat',
  requiresAuth: true,
  authType: 'api-key'
});
```

## 🛠️ Troubleshooting

### Приложение не запускается

1. Проверьте версию Node.js: `node --version` (должна быть >= 18)
2. Удалите `node_modules` и переустановите: `rm -rf node_modules && npm install`
3. Проверьте логи в `logs/ai-browser.log`

### Ошибки с Electron

```bash
# Пересоберите нативные модули
npm run rebuild
```

### Проблемы с логами

Убедитесь, что директория `logs/` существует и доступна для записи:

```bash
mkdir -p logs
chmod 755 logs
```

## 🌐 Browser Control - Работа с web-based моделями

### Быстрый старт

```bash
# Установка зависимостей
cd browser-control
npm install

# Установка Playwright браузеров
npx playwright install chromium

# Запуск примеров
cd ../examples
node browser-control-integration.js 4
```

### Использование

```javascript
const { BrowserController } = require('./browser-control/src');
const winston = require('winston');

const logger = winston.createLogger({ /* ... */ });
const controller = new BrowserController(logger, { headless: false });

// Инициализация
await controller.initialize();

// Создание сессии для ChatGPT
const { sessionId, session } = await controller.createSession('chatgpt');

// Отправка промпта
const response = await session.sendPrompt('Напиши Hello World на Python');
console.log(response.response);

// Очистка
await controller.cleanup();
```

### Интеграция с Electron

Browser Control автоматически интегрируется с AI Model Manager:

1. При привязке web-based модели к вкладке создается браузерная сессия
2. Промпты отправляются через `sendWebPrompt()` → Browser Control → Provider
3. Ответы возвращаются обратно в Electron приложение

Подробная документация: `browser-control/README.md`

## 📝 TODO

- [x] Интеграция Playwright для web-based моделей ✅
- [x] Провайдеры для ChatGPT, Claude, DeepSeek ✅
- [ ] Система межмодельной коммуникации
- [ ] Очередь задач с приоритизацией
- [ ] UI для настроек и управления API ключами
- [ ] Генератор изображений
- [ ] Генератор документов
- [ ] n8n workflow интеграция
- [ ] Redis для управления сессиями
- [ ] Тесты (Jest + Playwright)

## 📄 Лицензия

MIT License

## 👥 Команда

Разработано для автоматизации работы с AI моделями и веб-сервисами.

---

**Версия**: 0.1.0
**Дата**: 2025-11-10
**Статус**: В активной разработке
