# Redis Integration Module

Интеграция с Redis для AI Browser: управление сессиями, персистентность задач и кэширование AI ответов.

## Возможности

- 🔐 **SessionStore** - хранение browser sessions с cookies и настройками
- 💾 **TaskPersistence** - персистентность TaskQueue в Redis
- 🗄️ **CacheManager** - кэширование ответов AI моделей
- ⚡ **RedisManager** - централизованное управление подключением

## Установка

```bash
cd redis-integration
npm install
```

## Требования

- **Redis** >= 6.0
- **Node.js** >= 18.0

### Запуск Redis

```bash
# Docker
docker run -d -p 6379:6379 redis:7-alpine

# Или локально
redis-server
```

## Быстрый старт

```javascript
const winston = require('winston');
const { createRedisSystem } = require('./src');

const logger = winston.createLogger({
  level: 'info',
  transports: [new winston.transports.Console()]
});

// Создать всю систему
const { redisManager, sessionStore, taskPersistence, cacheManager } = createRedisSystem(logger, {
  redis: {
    host: 'localhost',
    port: 6379
  }
});

// Подключиться
await redisManager.connect();
```

## RedisManager

Базовый класс для работы с Redis.

### Создание

```javascript
const { RedisManager } = require('./src');

const redis = new RedisManager(logger, {
  host: 'localhost',
  port: 6379,
  password: 'secret',  // Опционально
  db: 0,
  keyPrefix: 'ai-browser:',
  connectTimeout: 10000
});

await redis.connect();
```

### Методы

#### Базовые операции

```javascript
// SET/GET
await redis.set('key', 'value', ttl); // ttl в секундах (опционально)
const value = await redis.get('key'); // Авто-парсинг JSON

// SET/GET с объектами
await redis.set('user', { name: 'John', age: 30 });
const user = await redis.get('user'); // { name: 'John', age: 30 }

// DELETE
await redis.del('key');

// EXISTS
const exists = await redis.exists('key'); // true/false

// EXPIRE
await redis.expire('key', 3600); // 1 час

// TTL
const ttl = await redis.ttl('key'); // Секунды до истечения

// KEYS
const keys = await redis.keys('user:*');
```

#### Hash операции

```javascript
// HSET/HGET
await redis.hset('user:123', 'name', 'John');
const name = await redis.hget('user:123', 'name');

// HGETALL
await redis.hset('user:123', 'age', 30);
const user = await redis.hgetall('user:123'); // { name: 'John', age: '30' }

// HDEL
await redis.hdel('user:123', 'name', 'age');
```

#### List операции

```javascript
// LPUSH/RPUSH
await redis.lpush('queue', { task: 'task1' }); // В начало
await redis.rpush('queue', { task: 'task2' }); // В конец

// LPOP/RPOP
const first = await redis.lpop('queue');
const last = await redis.rpop('queue');

// LRANGE
const items = await redis.lrange('queue', 0, -1); // Все элементы

// LLEN
const length = await redis.llen('queue');
```

#### Pub/Sub

```javascript
// PUBLISH
await redis.publish('channel', { event: 'user.login' });

// SUBSCRIBE
await redis.subscribe('channel', (message) => {
  console.log('Получено:', message);
});

// UNSUBSCRIBE
await redis.unsubscribe('channel');
```

#### Utility

```javascript
// PING
const pong = await redis.ping(); // 'PONG'

// INFO
const info = await redis.info('memory');

// FLUSHDB (осторожно!)
await redis.flushdb();

// Статистика
const stats = redis.getStats();
// {
//   commands: 150,
//   errors: 0,
//   reconnects: 0,
//   uptime: 120000,
//   isConnected: true,
//   config: { host: 'localhost', port: 6379, ... }
// }
```

### События

```javascript
redis.on('connect', () => console.log('Подключено'));
redis.on('ready', () => console.log('Готово'));
redis.on('error', (error) => console.error('Ошибка:', error));
redis.on('reconnecting', () => console.log('Переподключение...'));
redis.on('end', () => console.log('Отключено'));
```

## SessionStore

Хранение браузерных сессий.

### Использование

```javascript
const { SessionStore } = require('./src');

const sessionStore = new SessionStore(redisManager, logger);

// Создать сессию
const sessionId = await sessionStore.create({
  provider: 'chatgpt',
  modelId: 'gpt-4',
  cookies: [{ name: 'token', value: '...' }],
  metadata: { userAgent: '...' }
});

// Получить сессию
const session = await sessionStore.get(sessionId);

// Обновить сессию
await sessionStore.update(sessionId, {
  metadata: { lastUsed: Date.now() }
});

// Удалить сессию
await sessionStore.delete(sessionId);
```

### Cookies

```javascript
// Сохранить cookies
await sessionStore.saveCookies(sessionId, [
  { name: 'session-token', value: 'abc123', domain: '.example.com' }
]);

// Получить cookies
const cookies = await sessionStore.getCookies(sessionId);
```

### LocalStorage/SessionStorage

```javascript
// LocalStorage
await sessionStore.saveLocalStorage(sessionId, {
  theme: 'dark',
  language: 'en'
});
const localStorage = await sessionStore.getLocalStorage(sessionId);

// SessionStorage
await sessionStore.saveSessionStorage(sessionId, {
  tempData: 'value'
});
const sessionStorage = await sessionStore.getSessionStorage(sessionId);
```

### Управление

```javascript
// Получить все сессии
const all = await sessionStore.getAll();

// По провайдеру
const chatgptSessions = await sessionStore.getByProvider('chatgpt');

// Активные сессии
const active = await sessionStore.getActive();

// Пометить как активную/неактивную
await sessionStore.setActive(sessionId, false);

// Очистить неактивные
const cleared = await sessionStore.clearInactive();

// Очистить старые (> 30 дней)
const old = await sessionStore.clearOld(30 * 24 * 60 * 60 * 1000);

// Статистика
const stats = await sessionStore.getStats();
// {
//   total: 10,
//   active: 8,
//   inactive: 2,
//   byProvider: { chatgpt: 5, claude: 3, deepseek: 2 }
// }
```

## TaskPersistence

Персистентность очереди задач.

### Использование

```javascript
const { TaskPersistence } = require('./src');

const taskPersistence = new TaskPersistence(redisManager, logger);

// Сохранить очередь
await taskPersistence.saveQueue(taskQueue);

// Загрузить очередь
const count = await taskPersistence.loadQueue(taskQueue);
```

### Управление задачами

```javascript
// Сохранить задачу
await taskPersistence.saveTask(task);

// Обновить задачу
await taskPersistence.updateTask(taskId, taskData);

// Удалить задачу
await taskPersistence.deleteTask(taskId);

// Получить задачу
const task = await taskPersistence.getTask(taskId);

// Все задачи
const all = await taskPersistence.getAllTasks();

// По статусу
const pending = await taskPersistence.getTasksByStatus('pending');
const inProgress = await taskPersistence.getTasksByStatus('in-progress');
const completed = await taskPersistence.getTasksByStatus('completed');
```

### Очистка

```javascript
// Очистить завершенные
const cleared = await taskPersistence.clearCompleted();

// Очистить проваленные/отмененные
const failed = await taskPersistence.clearFailed();

// Очистить все
await taskPersistence.clear();
```

### Автосохранение

```javascript
// Запустить автосохранение (каждые 60 секунд)
taskPersistence.startAutoSave(taskQueue, 60000);

// Остановить
taskPersistence.stopAutoSave();
```

### Статистика

```javascript
const stats = await taskPersistence.getStats();
// {
//   total: 50,
//   pending: 10,
//   waiting: 5,
//   assigned: 3,
//   inProgress: 2,
//   completed: 25,
//   failed: 3,
//   cancelled: 2,
//   lastSaved: 1699876543210
// }
```

## CacheManager

Кэширование ответов AI моделей.

### Использование

```javascript
const { CacheManager } = require('./src');

const cacheManager = new CacheManager(redisManager, logger, {
  defaultTTL: 3600,      // 1 час
  maxCacheSize: 10000    // Максимум записей
});
```

### Кэширование

```javascript
// Сохранить ответ
await cacheManager.set('gpt-4', 'Hello', 'Hi there!', {
  temperature: 0.7,
  ttl: 600  // 10 минут
});

// Получить из кэша
const cached = await cacheManager.get('gpt-4', 'Hello', {
  temperature: 0.7
});

if (cached) {
  console.log('Из кэша:', cached.response);
  console.log('Кэширован:', new Date(cached.cachedAt));
} else {
  console.log('Cache miss - запрос к API');
}
```

### Управление

```javascript
// Проверить наличие
const has = await cacheManager.has('gpt-4', 'Hello');

// Удалить
await cacheManager.delete('gpt-4', 'Hello');

// Очистить весь кэш
await cacheManager.clear();

// Очистить кэш модели
await cacheManager.clearModel('gpt-4');

// Размер кэша
const size = await cacheManager.getCacheSize();
```

### Статистика

```javascript
const stats = await cacheManager.getStats();
// {
//   hits: 150,
//   misses: 50,
//   sets: 45,
//   deletes: 5,
//   size: 40,
//   hitRate: '75.00%',
//   maxSize: 10000,
//   utilizationRate: '0.40%'
// }

// Статистика по моделям
const modelStats = await cacheManager.getModelStats();
// {
//   'gpt-4': 25,
//   'claude-3-opus': 15
// }
```

### Прогрев кэша

```javascript
await cacheManager.warmup([
  {
    model: 'gpt-4',
    prompt: 'Hello',
    response: 'Hi there!',
    options: { temperature: 0.7 }
  },
  // ...
]);
```

## createRedisSystem

Создание полной системы.

```javascript
const { createRedisSystem } = require('./src');

const system = createRedisSystem(logger, {
  redis: {
    host: 'localhost',
    port: 6379,
    password: 'secret',
    db: 0,
    keyPrefix: 'ai-browser:'
  },
  cache: {
    defaultTTL: 3600,
    maxCacheSize: 10000
  }
});

const { redisManager, sessionStore, taskPersistence, cacheManager } = system;

await redisManager.connect();
```

## Интеграция с AI Browser

### Task Queue

```javascript
const { createTaskSystem } = require('../task-queue/src');
const { createRedisSystem } = require('../redis-integration/src');

// Создать системы
const { coordinator } = createCoordinationSystem(logger);
const { taskQueue } = createTaskSystem(coordinator, logger);
const { taskPersistence } = createRedisSystem(logger);

await redisManager.connect();

// Загрузить сохраненные задачи
await taskPersistence.loadQueue(taskQueue);

// Автосохранение каждую минуту
taskPersistence.startAutoSave(taskQueue, 60000);
```

### Browser Control

```javascript
const { BrowserController } = require('../browser-control/src');
const { SessionStore } = require('../redis-integration/src');

// Создать сессию
const sessionId = await sessionStore.create({
  provider: 'chatgpt',
  modelId: 'gpt-4'
});

// После авторизации сохранить cookies
const cookies = await page.context().cookies();
await sessionStore.saveCookies(sessionId, cookies);

// При следующем запуске восстановить
const saved = await sessionStore.getCookies(sessionId);
await page.context().addCookies(saved);
```

### AI Models Caching

```javascript
const { CacheManager } = require('../redis-integration/src');

// При запросе к AI
async function askAI(model, prompt, options) {
  // Проверяем кэш
  const cached = await cacheManager.get(model, prompt, options);
  if (cached) {
    return cached.response;
  }

  // Запрос к API
  const response = await callAPI(model, prompt, options);

  // Сохраняем в кэш
  await cacheManager.set(model, prompt, response, { ...options, ttl: 3600 });

  return response;
}
```

## Тестирование

```bash
# Запустите Redis
docker run -d -p 6379:6379 redis:7-alpine

# Запустите тесты
npm test
```

## Примеры

См. `examples/redis-demo.js` для полной демонстрации.

```bash
# Запустите Redis
docker run -d -p 6379:6379 redis:7-alpine

# Запустите демо
cd ../examples
NODE_PATH=../redis-integration/node_modules node redis-demo.js
```

## Переменные окружения

```bash
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=secret
```

## Производительность

- **Операции SET/GET**: ~1-2ms
- **Hash операции**: ~1-3ms
- **List операции**: ~2-5ms
- **Pub/Sub**: ~1-2ms для publish
- **Кэш проверка**: ~1ms (HIT), ~2ms (MISS + SET)

## Лучшие практики

1. **Используйте TTL** для всех временных данных
2. **Очищайте старые данные** регулярно
3. **Мониторьте размер кэша** - используйте maxCacheSize
4. **Используйте автосохранение** для критичных данных
5. **Graceful shutdown** - всегда вызывайте disconnect()

## Troubleshooting

### Redis не подключается

```bash
# Проверьте, запущен ли Redis
redis-cli ping

# Проверьте порт
netstat -an | grep 6379

# Логи Redis
docker logs <container-id>
```

### Большой размер кэша

```javascript
// Очистите старые записи
await cacheManager.evictOldest(1000);

// Или весь кэш
await cacheManager.clear();
```

### Потеря данных при перезапуске

```javascript
// Используйте автосохранение
taskPersistence.startAutoSave(taskQueue, 30000); // Каждые 30 сек
```

## Roadmap

- [ ] Redis Cluster поддержка
- [ ] Sentinel для HA
- [ ] Compression для больших объектов
- [ ] Batch операции
- [ ] Monitoring & Metrics (Prometheus)

## Лицензия

MIT
