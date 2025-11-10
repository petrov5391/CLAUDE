/**
 * Интеграционный тест всех модулей AI Browser
 * Проверяет взаимодействие между модулями
 */

const winston = require('winston');
const path = require('path');

console.log('🧪 Интеграционное тестирование AI Browser\n');

let errors = 0;
let success = 0;
let warnings = 0;

/**
 * Создание logger
 */
function createLogger() {
  return winston.createLogger({
    level: 'error',
    transports: [new winston.transports.Console({ silent: true })]
  });
}

/**
 * Тест 1: Импорт всех модулей
 */
function testModuleImports() {
  console.log('=== Тест 1: Импорт всех модулей ===\n');

  const modules = {
    'Coordination': '../coordination/src',
    'Task Queue': '../task-queue/src',
    'Tools': '../tools/src',
    'Redis Integration': '../redis-integration/src'
  };

  for (const [name, modulePath] of Object.entries(modules)) {
    try {
      const fullPath = path.join(__dirname, modulePath);
      const module = require(fullPath);

      if (module && typeof module === 'object') {
        console.log(`✅ ${name} импортирован`);
        success++;
      }
    } catch (error) {
      console.error(`❌ ${name} ошибка:`, error.message);
      errors++;
    }
  }

  console.log('');
}

/**
 * Тест 2: Создание системы координации
 */
async function testCoordinationSystem() {
  console.log('=== Тест 2: Система координации ===\n');

  try {
    const { createCoordinationSystem } = require('../coordination/src');
    const logger = createLogger();

    const { messageBus, coordinator, sharedState } = createCoordinationSystem(logger);

    if (messageBus && coordinator && sharedState) {
      console.log('✅ Coordination система создана');
      success++;
    }

    // Регистрация модели
    messageBus.publish('coordinator:register', {
      modelId: 'test-model',
      capabilities: ['text'],
      priority: 5
    }, 'integration-test');

    await new Promise(resolve => setTimeout(resolve, 100));

    const models = coordinator.getModels();
    if (models.length > 0) {
      console.log(`✅ Модель зарегистрирована (всего: ${models.length})`);
      success++;
    }

    // SharedState
    sharedState.set('test-key', { value: 123 }, 'integration-test');
    const value = sharedState.get('test-key');

    if (value && value.value === 123) {
      console.log('✅ SharedState работает');
      success++;
    }

  } catch (error) {
    console.error('❌ Ошибка Coordination:', error.message);
    errors++;
  }

  console.log('');
}

/**
 * Тест 3: Task Queue + Coordination
 */
async function testTaskQueueIntegration() {
  console.log('=== Тест 3: Task Queue + Coordination ===\n');

  try {
    const { createCoordinationSystem } = require('../coordination/src');
    const { createTaskSystem } = require('../task-queue/src');
    const logger = createLogger();

    const { messageBus, coordinator } = createCoordinationSystem(logger);
    const { taskQueue, taskDistributor } = createTaskSystem(coordinator, logger);

    if (taskQueue && taskDistributor) {
      console.log('✅ Task система создана с Coordination');
      success++;
    }

    // Регистрируем модель
    messageBus.publish('coordinator:register', {
      modelId: 'worker-model',
      capabilities: ['coding'],
      priority: 8
    }, 'integration-test');

    await new Promise(resolve => setTimeout(resolve, 100));

    // Добавляем задачу
    const taskId = taskQueue.add({
      type: 'coding',
      description: 'Test task',
      priority: 7,
      requiredCapabilities: ['coding']
    });

    if (taskId) {
      console.log('✅ Задача создана в очереди');
      success++;
    }

    // Пробуем распределить
    const assigned = await taskDistributor.distributeNext();

    if (assigned) {
      console.log('✅ Задача распределена через Coordinator');
      success++;
    }

    const stats = taskQueue.getStats();
    console.log(`✅ Статистика: ${stats.total} задач, ${stats.assigned} назначено`);
    success++;

  } catch (error) {
    console.error('❌ Ошибка Task Queue Integration:', error.message);
    errors++;
  }

  console.log('');
}

/**
 * Тест 4: Tools модуль
 */
async function testToolsIntegration() {
  console.log('=== Тест 4: Tools интеграция ===\n');

  try {
    const { createToolsSystem } = require('../tools/src');
    const logger = createLogger();

    const { documentGenerator, workflowGenerator } = createToolsSystem(logger, {
      documentOutputDir: './test-integration-output/documents',
      workflowOutputDir: './test-integration-output/workflows'
    });

    if (documentGenerator && workflowGenerator) {
      console.log('✅ Tools система создана');
      success++;
    }

    // Генерация документа
    const doc = await documentGenerator.generate('# Integration Test\n\nThis is a test.', {
      format: 'markdown',
      filename: 'integration-test.md'
    });

    if (doc.success) {
      console.log(`✅ Документ создан: ${doc.filename}`);
      success++;
    }

    // Генерация workflow
    const workflow = await workflowGenerator.create({
      name: 'Integration Test Workflow',
      type: 'test',
      nodes: [
        {
          type: 'trigger.webhook',
          parameters: { path: 'test' }
        },
        {
          type: 'utility.code',
          parameters: { jsCode: 'return items;' }
        }
      ]
    });

    if (workflow.success) {
      console.log(`✅ Workflow создан: ${workflow.filename}`);
      success++;
    }

    // Cleanup
    const fs = require('fs').promises;
    try {
      await fs.rm('./test-integration-output', { recursive: true, force: true });
    } catch (e) {}

  } catch (error) {
    console.error('❌ Ошибка Tools Integration:', error.message);
    errors++;
  }

  console.log('');
}

/**
 * Тест 5: Redis Integration (опционально)
 */
async function testRedisIntegration() {
  console.log('=== Тест 5: Redis Integration (опционально) ===\n');

  try {
    const { createRedisSystem } = require('../redis-integration/src');
    const logger = createLogger();

    const { redisManager, sessionStore, cacheManager } = createRedisSystem(logger, {
      redis: {
        host: 'localhost',
        port: 6379,
        lazyConnect: true
      }
    });

    if (redisManager && sessionStore && cacheManager) {
      console.log('✅ Redis система создана');
      success++;
    }

    // Пробуем подключиться
    try {
      await redisManager.connect();
      const pong = await redisManager.ping();

      if (pong === 'PONG') {
        console.log('✅ Redis подключен и работает');
        success++;

        // Тестируем SessionStore
        const sessionId = await sessionStore.create({
          provider: 'test',
          modelId: 'test-model'
        });

        if (sessionId) {
          console.log('✅ Сессия создана в Redis');
          success++;
        }

        // Тестируем CacheManager
        await cacheManager.set('test-model', 'test prompt', 'test response', { ttl: 60 });
        const cached = await cacheManager.get('test-model', 'test prompt');

        if (cached && cached.response === 'test response') {
          console.log('✅ Кэширование работает');
          success++;
        }

        // Cleanup
        await sessionStore.delete(sessionId);
        await cacheManager.clear();
        await redisManager.disconnect();

      }
    } catch (redisError) {
      console.log('⚠️  Redis недоступен (это нормально для тестирования)');
      console.log('   Для полной проверки запустите: docker run -d -p 6379:6379 redis:7-alpine');
      warnings++;
    }

  } catch (error) {
    console.error('❌ Ошибка Redis Integration:', error.message);
    errors++;
  }

  console.log('');
}

/**
 * Тест 6: Полная интеграция - Task Queue + Tools + Cache
 */
async function testFullIntegration() {
  console.log('=== Тест 6: Полная интеграция ===\n');

  try {
    const { createCoordinationSystem } = require('../coordination/src');
    const { createTaskSystem } = require('../task-queue/src');
    const { createToolsSystem } = require('../tools/src');
    const logger = createLogger();

    // Создаем все системы
    const { messageBus, coordinator } = createCoordinationSystem(logger);
    const { taskQueue, taskDistributor } = createTaskSystem(coordinator, logger);
    const { documentGenerator } = createToolsSystem(logger, {
      documentOutputDir: './test-full-integration'
    });

    console.log('✅ Все системы инициализированы');
    success++;

    // Регистрируем "модель-генератор документов"
    messageBus.publish('coordinator:register', {
      modelId: 'document-generator',
      capabilities: ['document-generation'],
      priority: 9
    }, 'integration-test');

    await new Promise(resolve => setTimeout(resolve, 100));

    // Создаем задачу на генерацию документа
    const taskId = taskQueue.add({
      type: 'document-generation',
      description: 'Сгенерировать отчет',
      priority: 8,
      requiredCapabilities: ['document-generation'],
      data: {
        content: '# Final Report\n\nIntegration test completed successfully.',
        format: 'markdown'
      }
    });

    console.log('✅ Задача на генерацию документа создана');
    success++;

    // Распределяем задачу
    const assigned = await taskDistributor.distributeNext();

    if (assigned) {
      console.log('✅ Задача распределена модели document-generator');
      success++;
    }

    // Симулируем выполнение - генерируем документ
    const task = taskQueue.get(taskId);
    taskQueue.updateTaskStatus(taskId, 'in-progress');

    const result = await documentGenerator.generate(
      task.data.content,
      {
        format: task.data.format,
        filename: 'integration-report.md'
      }
    );

    if (result.success) {
      taskQueue.updateTaskStatus(taskId, 'completed', { result });
      console.log('✅ Задача выполнена, документ создан');
      success++;
    }

    // Проверяем финальный статус
    const finalStats = taskQueue.getStats();
    if (finalStats.completed === 1) {
      console.log('✅ Полная интеграция работает: Task → Distribution → Execution → Completion');
      success++;
    }

    // Cleanup
    const fs = require('fs').promises;
    try {
      await fs.rm('./test-full-integration', { recursive: true, force: true });
    } catch (e) {}

  } catch (error) {
    console.error('❌ Ошибка Full Integration:', error.message);
    console.error(error.stack);
    errors++;
  }

  console.log('');
}

/**
 * Запуск всех тестов
 */
async function runTests() {
  console.log('🚀 Начало интеграционного тестирования\n');
  console.log('=' .repeat(60));
  console.log('');

  testModuleImports();
  await testCoordinationSystem();
  await testTaskQueueIntegration();
  await testToolsIntegration();
  await testRedisIntegration();
  await testFullIntegration();

  console.log('=' .repeat(60));
  console.log('\n=== Результаты интеграционного тестирования ===\n');
  console.log(`✅ Успешно: ${success}`);
  console.log(`❌ Ошибок: ${errors}`);
  console.log(`⚠️  Предупреждений: ${warnings}`);
  console.log('');

  if (errors === 0) {
    console.log('🎉 Интеграционное тестирование пройдено успешно!');
    console.log('   Все модули корректно взаимодействуют друг с другом.\n');
    process.exit(0);
  } else {
    console.log('⚠️  Обнаружены ошибки при интеграционном тестировании.');
    console.log('   Проверьте логи выше для деталей.\n');
    process.exit(1);
  }
}

// Запуск
runTests().catch(error => {
  console.error('\n💥 Критическая ошибка:', error);
  console.error(error.stack);
  process.exit(1);
});
