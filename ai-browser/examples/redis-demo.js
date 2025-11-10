/**
 * Демонстрация модуля Redis Integration
 * Показывает работу SessionStore, TaskPersistence, CacheManager
 */

const winston = require('winston');
const { createRedisSystem } = require('../redis-integration/src');

// Создаем logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.colorize(),
    winston.format.simple()
  ),
  transports: [new winston.transports.Console()]
});

/**
 * Проверка доступности Redis
 */
async function checkRedis(redisManager) {
  try {
    await redisManager.connect();
    const pong = await redisManager.ping();

    if (pong === 'PONG') {
      console.log('✅ Redis подключен и доступен\n');
      return true;
    }
  } catch (error) {
    console.log('❌ Redis недоступен:', error.message);
    console.log('\nДля запуска демо необходим Redis:');
    console.log('  docker run -d -p 6379:6379 redis:7-alpine');
    console.log('  или: redis-server\n');
    return false;
  }
}

/**
 * Демонстрация
 */
async function demo() {
  console.log('\n💾 Демонстрация Redis Integration\n');

  // Создаем систему Redis интеграции
  const { redisManager, sessionStore, taskPersistence, cacheManager } = createRedisSystem(logger, {
    redis: {
      host: 'localhost',
      port: 6379
    },
    cache: {
      defaultTTL: 300, // 5 минут
      maxCacheSize: 1000
    }
  });

  // Проверяем доступность
  const available = await checkRedis(redisManager);
  if (!available) {
    process.exit(1);
  }

  // === 1. SessionStore ===

  console.log('🔐 === SessionStore - Управление сессиями ===\n');

  // Создание сессий
  console.log('  📝 Создание сессий для разных провайдеров...\n');

  const chatgptSession = await sessionStore.create({
    provider: 'chatgpt',
    modelId: 'gpt-4',
    metadata: {
      userAgent: 'Mozilla/5.0...',
      url: 'https://chat.openai.com'
    }
  });
  console.log(`    ✓ ChatGPT сессия: ${chatgptSession.substring(0, 8)}...`);

  const claudeSession = await sessionStore.create({
    provider: 'claude',
    modelId: 'claude-3-opus',
    metadata: {
      url: 'https://claude.ai'
    }
  });
  console.log(`    ✓ Claude сессия: ${claudeSession.substring(0, 8)}...`);

  // Сохранение cookies
  console.log('\n  🍪 Сохранение cookies...\n');

  await sessionStore.saveCookies(chatgptSession, [
    { name: '__Secure-next-auth.session-token', value: 'eyJhbGci...', domain: '.openai.com' },
    { name: '__Secure-next-auth.callback-url', value: 'https://chat.openai.com', domain: '.openai.com' }
  ]);
  console.log('    ✓ Cookies сохранены для ChatGPT');

  await sessionStore.saveCookies(claudeSession, [
    { name: 'sessionKey', value: 'sk-ant-...', domain: '.claude.ai' }
  ]);
  console.log('    ✓ Cookies сохранены для Claude');

  // Статистика сессий
  console.log('\n  📊 Статистика сессий:\n');
  const sessionStats = await sessionStore.getStats();
  console.log(`    Всего: ${sessionStats.total}`);
  console.log(`    Активных: ${sessionStats.active}`);
  console.log(`    По провайдерам:`);
  for (const [provider, count] of Object.entries(sessionStats.byProvider)) {
    console.log(`      - ${provider}: ${count}`);
  }

  // === 2. CacheManager ===

  console.log('\n\n🗄️  === CacheManager - Кэширование ответов AI ===\n');

  // Сохранение в кэш
  console.log('  💾 Сохранение ответов в кэш...\n');

  await cacheManager.set('gpt-4', 'Напиши Hello World на Python', 'print("Hello World")', {
    temperature: 0.7,
    ttl: 600
  });
  console.log('    ✓ Ответ GPT-4 сохранен (TTL: 600s)');

  await cacheManager.set('claude-3-opus', 'Объясни, что такое Redis',
    'Redis - это in-memory база данных типа key-value...', {
    temperature: 0.5,
    ttl: 600
  });
  console.log('    ✓ Ответ Claude сохранен (TTL: 600s)');

  // Получение из кэша
  console.log('\n  📤 Получение из кэша...\n');

  const cachedGPT = await cacheManager.get('gpt-4', 'Напиши Hello World на Python', {
    temperature: 0.7
  });
  if (cachedGPT) {
    console.log('    ✓ Cache HIT для GPT-4');
    console.log(`      Ответ: ${cachedGPT.response}`);
  }

  const cachedClaude = await cacheManager.get('claude-3-opus', 'Объясни, что такое Redis', {
    temperature: 0.5
  });
  if (cachedClaude) {
    console.log('    ✓ Cache HIT для Claude');
    console.log(`      Ответ: ${cachedClaude.response.substring(0, 50)}...`);
  }

  // Cache MISS
  const notCached = await cacheManager.get('gpt-4', 'Другой промпт');
  if (!notCached) {
    console.log('    ✓ Cache MISS для нового промпта');
  }

  // Статистика кэша
  console.log('\n  📊 Статистика кэша:\n');
  const cacheStats = await cacheManager.getStats();
  console.log(`    Размер: ${cacheStats.size} / ${cacheStats.maxSize}`);
  console.log(`    Hit Rate: ${cacheStats.hitRate}`);
  console.log(`    Hits: ${cacheStats.hits}, Misses: ${cacheStats.misses}`);

  const modelStats = await cacheManager.getModelStats();
  console.log('    По моделям:');
  for (const [model, count] of Object.entries(modelStats)) {
    console.log(`      - ${model}: ${count}`);
  }

  // === 3. TaskPersistence ===

  console.log('\n\n📋 === TaskPersistence - Персистентность задач ===\n');

  // Мок задач
  console.log('  💾 Сохранение задач...\n');

  const tasks = [
    {
      id: 'task-1',
      type: 'coding',
      description: 'Написать функцию',
      status: 'pending',
      priority: 8,
      toJSON: function() { return { id: this.id, type: this.type, description: this.description, status: this.status, priority: this.priority }; }
    },
    {
      id: 'task-2',
      type: 'analysis',
      description: 'Проанализировать код',
      status: 'in-progress',
      priority: 7,
      toJSON: function() { return { id: this.id, type: this.type, description: this.description, status: this.status, priority: this.priority }; }
    },
    {
      id: 'task-3',
      type: 'documentation',
      description: 'Написать README',
      status: 'completed',
      priority: 5,
      toJSON: function() { return { id: this.id, type: this.type, description: this.description, status: this.status, priority: this.priority }; }
    }
  ];

  for (const task of tasks) {
    await taskPersistence.saveTask(task);
    console.log(`    ✓ Задача сохранена: ${task.id} (${task.status})`);
  }

  // Получение задач
  console.log('\n  📤 Получение задач...\n');

  const allTasks = await taskPersistence.getAllTasks();
  console.log(`    Всего задач: ${allTasks.length}`);

  const pendingTasks = await taskPersistence.getTasksByStatus('pending');
  console.log(`    Pending: ${pendingTasks.length}`);

  const inProgressTasks = await taskPersistence.getTasksByStatus('in-progress');
  console.log(`    In Progress: ${inProgressTasks.length}`);

  const completedTasks = await taskPersistence.getTasksByStatus('completed');
  console.log(`    Completed: ${completedTasks.length}`);

  // Статистика задач
  console.log('\n  📊 Статистика задач:\n');
  const taskStats = await taskPersistence.getStats();
  console.log(`    Всего: ${taskStats.total}`);
  console.log(`    Pending: ${taskStats.pending}`);
  console.log(`    In Progress: ${taskStats.inProgress}`);
  console.log(`    Completed: ${taskStats.completed}`);

  // === 4. RedisManager ===

  console.log('\n\n⚙️  === RedisManager - Статистика ===\n');

  const redisStats = redisManager.getStats();
  console.log(`  Команд выполнено: ${redisStats.commands}`);
  console.log(`  Ошибок: ${redisStats.errors}`);
  console.log(`  Uptime: ${(redisStats.uptime / 1000).toFixed(2)}s`);
  console.log(`  Подключен к: ${redisStats.config.host}:${redisStats.config.port}`);
  console.log(`  БД: ${redisStats.config.db}`);
  console.log(`  Key Prefix: ${redisStats.config.keyPrefix}`);

  // === Очистка ===

  console.log('\n\n🧹 === Очистка ===\n');

  console.log('  Хотите очистить тестовые данные? (Нажмите Ctrl+C для отмены)');

  // Даём 3 секунды
  await new Promise(resolve => setTimeout(resolve, 3000));

  await cacheManager.clear();
  console.log('  ✓ Кэш очищен');

  await sessionStore.clearAll();
  console.log('  ✓ Сессии очищены');

  await taskPersistence.clear();
  console.log('  ✓ Задачи очищены');

  // Отключение
  await redisManager.disconnect();
  console.log('  ✓ Redis отключен');

  console.log('\n✅ Демонстрация завершена!\n');
}

// Запуск
demo().catch(error => {
  console.error('\n💥 Ошибка:', error);
  process.exit(1);
});
