# Browser Control Module

**Модуль автоматизации браузера для AI Browser**

Обеспечивает управление веб-браузером через Playwright для работы с web-based AI моделями без использования API ключей.

## 🎯 Возможности

### ✅ Реализовано (v0.1.0)

- **BrowserController**: Главный контроллер для управления браузерными сессиями
- **BrowserSession**: Управление отдельными сессиями браузера
- **Провайдеры для web-based моделей**:
  - ✅ ChatGPT (chat.openai.com)
  - ✅ Claude (claude.ai)
  - ✅ DeepSeek (chat.deepseek.com)

### 🔧 Функции

- Автоматическая навигация по веб-интерфейсам
- Отправка промптов через UI
- Получение ответов от моделей
- Управление сессиями и cookies
- Сохранение/загрузка состояния
- Поддержка headless и GUI режимов
- Логирование всех операций

## 📦 Установка

```bash
cd browser-control
npm install

# Установка браузеров Playwright
npx playwright install chromium
```

## 🚀 Использование

### Базовый пример

```javascript
const { BrowserController } = require('./src');
const winston = require('winston');

// Создаем logger
const logger = winston.createLogger({
  level: 'info',
  transports: [new winston.transports.Console()]
});

// Создаем контроллер
const controller = new BrowserController(logger, {
  headless: false,  // false = показывать браузер
  slowMo: 100       // замедление для наблюдения
});

async function main() {
  // Инициализация
  await controller.initialize();

  // Создаем сессию для ChatGPT
  const { sessionId, session } = await controller.createSession('chatgpt');

  // Отправляем промпт
  const response = await session.sendPrompt('Напиши Hello World на Python');

  console.log('Ответ:', response.response);

  // Закрываем сессию
  await controller.closeSession(sessionId);

  // Очистка
  await controller.cleanup();
}

main().catch(console.error);
```

### Работа с ChatGPT

```javascript
const { sessionId, session } = await controller.createSession('chatgpt');

// Проверка авторизации
const isAuth = await session.providerInstance.checkAuthentication();

if (!isAuth) {
  console.log('Требуется авторизация. Авторизуйтесь вручную в браузере...');
  // Ждем ручной авторизации
  await new Promise(resolve => setTimeout(resolve, 30000));
}

// Отправка промпта
const result = await session.sendPrompt('Объясни квантовые вычисления');
console.log(result.response);

// Новый чат
await session.providerInstance.newChat();

// История чата
const history = await session.providerInstance.getChatHistory();
console.log('История:', history);
```

### Работа с Claude

```javascript
const { sessionId, session } = await controller.createSession('claude');

// Отправка промпта с timeout
const result = await session.sendPrompt(
  'Напиши код для API сервера на Node.js',
  { timeout: 120000 } // 2 минуты
);

console.log(result.response);
```

### Работа с DeepSeek

```javascript
const { sessionId, session } = await controller.createSession('deepseek');

// DeepSeek хорош для coding задач
const result = await session.sendPrompt(
  'Оптимизируй этот код: function sum(a,b) { return a + b; }'
);

console.log(result.response);
```

### Управление сессиями и cookies

```javascript
// Сохранение состояния сессии (cookies, localStorage)
await session.saveState('./sessions/chatgpt-session.json');

// Получение cookies
const cookies = await session.getCookies();
console.log('Cookies:', cookies);

// Установка cookies (для повторного использования)
await session.setCookies(cookies);

// Скриншот
const screenshot = await session.screenshot({
  path: './screenshots/chatgpt.png',
  fullPage: true
});
```

### Множественные сессии

```javascript
// Создаем несколько сессий одновременно
const gpt = await controller.createSession('chatgpt');
const claude = await controller.createSession('claude');
const deepseek = await controller.createSession('deepseek');

// Отправляем один и тот же вопрос всем
const question = 'Что такое machine learning?';

const [gptResp, claudeResp, deepseekResp] = await Promise.all([
  gpt.session.sendPrompt(question),
  claude.session.sendPrompt(question),
  deepseek.session.sendPrompt(question)
]);

console.log('GPT:', gptResp.response);
console.log('Claude:', claudeResp.response);
console.log('DeepSeek:', deepseekResp.response);

// Закрываем все сессии
await controller.cleanup();
```

### Persistent Context (сохранение авторизации)

```javascript
// Создаем контроллер с persistent context
const controller = new BrowserController(logger, {
  headless: false,
  userDataDir: './user-data/chatgpt'  // Здесь будут храниться cookies
});

await controller.initialize();

// Теперь авторизация сохранится между запусками
const { session } = await controller.createSession('chatgpt');
```

## 📖 API Reference

### BrowserController

**Методы:**
- `initialize()` - Инициализация браузера
- `createSession(provider, options)` - Создать сессию
- `getSession(sessionId)` - Получить сессию по ID
- `closeSession(sessionId)` - Закрыть сессию
- `getSessions()` - Получить список всех сессий
- `cleanup()` - Закрыть все сессии и браузер
- `getStats()` - Статистика

### BrowserSession

**Методы:**
- `initialize()` - Инициализация сессии
- `sendPrompt(prompt, options)` - Отправить промпт
- `navigate(url, options)` - Навигация
- `evaluate(script)` - Выполнить JS на странице
- `screenshot(options)` - Сделать скриншот
- `getCookies()` - Получить cookies
- `setCookies(cookies)` - Установить cookies
- `saveState(path)` - Сохранить состояние
- `getInfo()` - Информация о сессии
- `close()` - Закрыть сессию

### Провайдеры (ChatGPT, Claude, DeepSeek)

**Методы:**
- `initialize()` - Инициализация провайдера
- `checkAuthentication()` - Проверка авторизации
- `authenticate(credentials)` - Авторизация
- `sendPrompt(prompt, options)` - Отправить промпт
- `waitForResponse(timeout)` - Ожидание ответа
- `newChat()` - Создать новый чат
- `getChatHistory()` - Получить историю

## 🧪 Тестирование

```bash
# Запуск тестов (без реального браузера)
npm test

# Или напрямую
node test/test-browser-control.js
```

## ⚙️ Конфигурация

### Опции BrowserController

```javascript
{
  headless: true,           // Headless режим
  slowMo: 0,               // Замедление действий (мс)
  devtools: false,         // Открыть DevTools
  userDataDir: null,       // Директория для persistent context
  timeout: 30000          // Timeout по умолчанию
}
```

### Опции сессии

```javascript
{
  timeout: 60000,          // Timeout для операций
  waitUntil: 'networkidle', // Условие завершения навигации
  contextOptions: {        // Опции Playwright context
    viewport: { width: 1920, height: 1080 },
    userAgent: '...'
  }
}
```

## 🔒 Безопасность

- Все сессии изолированы друг от друга
- Cookies хранятся отдельно для каждой сессии
- Поддержка persistent context для безопасного хранения авторизации
- Автоматическая очистка при завершении

## 📝 Логирование

Модуль использует Winston для логирования:

```
[SessionID] [Событие] Сообщение
```

Уровни логирования:
- `info`: Основные операции
- `debug`: Детальная информация
- `warn`: Предупреждения
- `error`: Ошибки

## 🚧 Ограничения

1. **Требуется авторизация**: Для работы с web-интерфейсами нужно авторизоваться вручную или использовать сохраненные cookies
2. **Изменения UI**: При обновлении интерфейсов селекторы могут устареть
3. **Rate limits**: Web-интерфейсы могут иметь ограничения на количество запросов
4. **Headless detection**: Некоторые сайты могут детектировать headless браузеры

## 🔄 Roadmap

- [ ] Автоматическая авторизация через email/password
- [ ] Обработка CAPTCHA
- [ ] Поддержка прокси
- [ ] Ротация user agents
- [ ] Обработка rate limits
- [ ] Дополнительные провайдеры (Gemini, Perplexity)
- [ ] Streaming ответов
- [ ] Поддержка файлов и изображений

## 📄 Лицензия

MIT

---

**Версия**: 0.1.0
**Дата**: 2025-11-10
