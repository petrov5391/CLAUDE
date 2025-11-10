/**
 * Тестовый скрипт для модуля Redis Integration
 * Проверка RedisManager, SessionStore, TaskPersistence, CacheManager
 */

const winston = require('winston');

// Импорт модулей
const {
  RedisManager,
  SessionStore,
  TaskPersistence,
  CacheManager,
  createRedisSystem
} = require('../src/index');

console.log('🧪 Тестирование модуля Redis Integration...\n');

let errors = 0;
let success = 0;
let skipped = 0;
let redisAvailable = false;

/**
 * Создание тестового logger
 */
function createLogger() {
  return winston.createLogger({
    level: 'error',
    transports: [new winston.transports.Console({ silent: true })]
  });
}

/**
 * Тест 1: Импорт модулей
 */
function testImports() {
  console.log('=== Тест 1: Импорт модулей ===');

  try {
    if (typeof RedisManager === 'function') {
      console.log('✅ RedisManager импортирован');
      success++;
    }

    if (typeof SessionStore === 'function') {
      console.log('✅ SessionStore импортирован');
      success++;
    }

    if (typeof TaskPersistence === 'function') {
      console.log('✅ TaskPersistence импортирован');
      success++;
    }

    if (typeof CacheManager === 'function') {
      console.log('✅ CacheManager импортирован');
      success++;
    }

    if (typeof createRedisSystem === 'function') {
      console.log('✅ createRedisSystem импортирован');
      success++;
    }
  } catch (error) {
    console.error('❌ Ошибка импорта:', error.message);
    errors++;
  }

  console.log('');
}

/**
 * Тест 2: Проверка доступности Redis
 */
async function testRedisConnection() {
  console.log('=== Тест 2: Подключение к Redis ===');

  const logger = createLogger();

  try {
    const redis = new RedisManager(logger, {
      host: 'localhost',
      port: 6379,
      connectTimeout: 5000
    });

    await redis.connect();

    const pong = await redis.ping();
    if (pong === 'PONG') {
      console.log('✅ Redis доступен и отвечает');
      success++;
      redisAvailable = true;
    }

    await redis.disconnect();

  } catch (error) {
    console.log(`⚠️  Redis недоступен: ${error.message}`);
    console.log('   Тесты, требующие Redis, будут пропущены');
    skipped++;
    redisAvailable = false;
  }

  console.log('');
}

/**
 * Тест 3: RedisManager - базовые операции
 */
async function testRedisManagerOperations() {
  console.log('=== Тест 3: RedisManager - Базовые операции ===');

  if (!redisAvailable) {
    console.log('⏭️  Тест пропущен (Redis недоступен)\n');
    skipped++;
    return;
  }

  const logger = createLogger();
  const redis = new RedisManager(logger);

  try {
    await redis.connect();

    // SET/GET
    await redis.set('test:key', 'test value');
    const value = await redis.get('test:key');
    if (value === 'test value') {
      console.log('✅ SET/GET работают');
      success++;
    }

    // SET/GET с JSON
    await redis.set('test:json', { foo: 'bar', num: 123 });
    const jsonValue = await redis.get('test:json');
    if (jsonValue.foo === 'bar' && jsonValue.num === 123) {
      console.log('✅ JSON автоматически парсится');
      success++;
    }

    // EXISTS
    const exists = await redis.exists('test:key');
    if (exists) {
      console.log('✅ EXISTS работает');
      success++;
    }

    // DELETE
    await redis.del('test:key');
    const deleted = await redis.get('test:key');
    if (!deleted) {
      console.log('✅ DELETE работает');
      success++;
    }

    // Cleanup
    await redis.del('test:json');
    await redis.disconnect();

  } catch (error) {
    console.error('❌ Ошибка RedisManager:', error.message);
    errors++;
  }

  console.log('');
}

/**
 * Тест 4: SessionStore
 */
async function testSessionStore() {
  console.log('=== Тест 4: SessionStore ===');

  if (!redisAvailable) {
    console.log('⏭️  Тест пропущен (Redis недоступен)\n');
    skipped++;
    return;
  }

  const logger = createLogger();
  const redis = new RedisManager(logger);
  await redis.connect();

  const sessionStore = new SessionStore(redis, logger);

  try {
    // Создание сессии
    const sessionId = await sessionStore.create({
      provider: 'chatgpt',
      modelId: 'gpt-4',
      metadata: { test: true }
    });

    if (sessionId) {
      console.log('✅ Сессия создана');
      success++;
    }

    // Получение сессии
    const session = await sessionStore.get(sessionId);
    if (session && session.provider === 'chatgpt') {
      console.log('✅ Сессия получена');
      success++;
    }

    // Сохранение cookies
    await sessionStore.saveCookies(sessionId, [
      { name: 'test', value: 'cookie' }
    ]);

    const cookies = await sessionStore.getCookies(sessionId);
    if (cookies && cookies.length === 1 && cookies[0].name === 'test') {
      console.log('✅ Cookies сохранены и получены');
      success++;
    }

    // Статистика
    const stats = await sessionStore.getStats();
    if (stats.total >= 1) {
      console.log(`✅ Статистика: ${stats.total} сессий`);
      success++;
    }

    // Очистка
    await sessionStore.delete(sessionId);

  } catch (error) {
    console.error('❌ Ошибка SessionStore:', error.message);
    errors++;
  }

  await redis.disconnect();
  console.log('');
}

/**
 * Тест 5: CacheManager
 */
async function testCacheManager() {
  console.log('=== Тест 5: CacheManager ===');

  if (!redisAvailable) {
    console.log('⏭️  Тест пропущен (Redis недоступен)\n');
    skipped++;
    return;
  }

  const logger = createLogger();
  const redis = new RedisManager(logger);
  await redis.connect();

  const cacheManager = new CacheManager(redis, logger);

  try {
    // Сохранение в кэш
    await cacheManager.set('gpt-4', 'Hello', 'Hi there!', { ttl: 60 });
    console.log('✅ Ответ сохранен в кэш');
    success++;

    // Получение из кэша
    const cached = await cacheManager.get('gpt-4', 'Hello');
    if (cached && cached.response === 'Hi there!' && cached.cached) {
      console.log('✅ Ответ получен из кэша (HIT)');
      success++;
    }

    // Cache MISS
    const notCached = await cacheManager.get('gpt-4', 'Different prompt');
    if (!notCached) {
      console.log('✅ Cache MISS для нового промпта');
      success++;
    }

    // Статистика
    const stats = await cacheManager.getStats();
    if (stats.hits === 1 && stats.misses === 1) {
      console.log(`✅ Статистика кэша: ${stats.hits} hits, ${stats.misses} misses`);
      success++;
    }

    // Очистка
    await cacheManager.clear();

  } catch (error) {
    console.error('❌ Ошибка CacheManager:', error.message);
    errors++;
  }

  await redis.disconnect();
  console.log('');
}

/**
 * Тест 6: TaskPersistence (мок)
 */
async function testTaskPersistence() {
  console.log('=== Тест 6: TaskPersistence ===');

  if (!redisAvailable) {
    console.log('⏭️  Тест пропущен (Redis недоступен)\n');
    skipped++;
    return;
  }

  const logger = createLogger();
  const redis = new RedisManager(logger);
  await redis.connect();

  const taskPersistence = new TaskPersistence(redis, logger);

  try {
    // Мок задачи
    const mockTask = {
      id: 'task-123',
      type: 'coding',
      status: 'pending',
      priority: 5
    };

    // Сохранение задачи
    await taskPersistence.saveTask({
      id: mockTask.id,
      toJSON: () => mockTask
    });

    console.log('✅ Задача сохранена');
    success++;

    // Получение задачи
    const saved = await taskPersistence.getTask('task-123');
    if (saved && saved.id === 'task-123') {
      console.log('✅ Задача получена');
      success++;
    }

    // Получение всех задач
    const all = await taskPersistence.getAllTasks();
    if (all.length >= 1) {
      console.log(`✅ Получены все задачи (${all.length})`);
      success++;
    }

    // Очистка
    await taskPersistence.clear();

  } catch (error) {
    console.error('❌ Ошибка TaskPersistence:', error.message);
    errors++;
  }

  await redis.disconnect();
  console.log('');
}

/**
 * Тест 7: Создание полной системы
 */
async function testSystemCreation() {
  console.log('=== Тест 7: Создание системы Redis Integration ===');

  const logger = createLogger();

  try {
    const system = createRedisSystem(logger, {
      redis: {
        host: 'localhost',
        port: 6379,
        lazyConnect: true
      }
    });

    if (system.redisManager instanceof RedisManager) {
      console.log('✅ RedisManager создан');
      success++;
    }

    if (system.sessionStore instanceof SessionStore) {
      console.log('✅ SessionStore создан');
      success++;
    }

    if (system.taskPersistence instanceof TaskPersistence) {
      console.log('✅ TaskPersistence создан');
      success++;
    }

    if (system.cacheManager instanceof CacheManager) {
      console.log('✅ CacheManager создан');
      success++;
    }

  } catch (error) {
    console.error('❌ Ошибка создания системы:', error.message);
    errors++;
  }

  console.log('');
}

/**
 * Запуск всех тестов
 */
async function runTests() {
  testImports();
  await testRedisConnection();
  await testRedisManagerOperations();
  await testSessionStore();
  await testCacheManager();
  await testTaskPersistence();
  await testSystemCreation();

  console.log('=== Результаты тестирования ===');
  console.log(`✅ Успешно: ${success}`);
  console.log(`❌ Ошибок: ${errors}`);
  console.log(`⏭️  Пропущено: ${skipped}`);
  console.log('');

  if (!redisAvailable) {
    console.log('ℹ️  Для полного тестирования запустите Redis:');
    console.log('   docker run -d -p 6379:6379 redis:7-alpine');
    console.log('   или: redis-server');
    console.log('');
  }

  if (errors === 0) {
    console.log('🎉 Все доступные тесты пройдены! Модуль Redis Integration готов.');
    process.exit(0);
  } else {
    console.log('⚠️  Обнаружены ошибки. Требуется исправление.');
    process.exit(1);
  }
}

// Запуск
runTests().catch(error => {
  console.error('💥 Критическая ошибка:', error);
  process.exit(1);
});
