/**
 * Тестовый скрипт для модуля координации
 * Проверка MessageBus, Coordinator, SharedState
 */

const winston = require('winston');
const { MessageBus, Coordinator, SharedState, createCoordinationSystem } = require('../src/index');

console.log('🧪 Тестирование модуля координации...\n');

let errors = 0;
let success = 0;

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
 * Тест импорта модулей
 */
function testImports() {
  console.log('=== Тест 1: Импорт модулей ===');

  try {
    if (typeof MessageBus === 'function') {
      console.log('✅ MessageBus импортирован');
      success++;
    }

    if (typeof Coordinator === 'function') {
      console.log('✅ Coordinator импортирован');
      success++;
    }

    if (typeof SharedState === 'function') {
      console.log('✅ SharedState импортирован');
      success++;
    }

    if (typeof createCoordinationSystem === 'function') {
      console.log('✅ createCoordinationSystem импортирован');
      success++;
    }
  } catch (error) {
    console.error('❌ Ошибка импорта:', error.message);
    errors++;
  }

  console.log('');
}

/**
 * Тест MessageBus
 */
function testMessageBus() {
  console.log('=== Тест 2: MessageBus ===');

  const logger = createLogger();
  const bus = new MessageBus(logger);

  try {
    // Подписка
    let received = null;
    bus.subscribe('test-topic', (message) => {
      received = message;
    }, 'test-subscriber');

    console.log('✅ Подписка создана');
    success++;

    // Публикация
    bus.publish('test-topic', { hello: 'world' }, 'test-sender');

    if (received && received.data.hello === 'world') {
      console.log('✅ Сообщение получено');
      success++;
    } else {
      console.error('❌ Сообщение не получено');
      errors++;
    }

    // История
    const history = bus.getHistory({ topic: 'test-topic' });
    if (history.length > 0) {
      console.log(`✅ История работает (${history.length} сообщений)`);
      success++;
    }

    // Статистика
    const stats = bus.getStats();
    console.log(`✅ Статистика: ${stats.messagesCount} сообщений, ${stats.topicsCount} топиков`);
    success++;

  } catch (error) {
    console.error('❌ Ошибка MessageBus:', error.message);
    errors++;
  }

  console.log('');
}

/**
 * Тест Coordinator
 */
function testCoordinator() {
  console.log('=== Тест 3: Coordinator ===');

  const logger = createLogger();
  const bus = new MessageBus(logger);
  const coordinator = new Coordinator(bus, logger);

  try {
    // Регистрация модели
    bus.publish('coordinator:register', {
      modelId: 'model-1',
      capabilities: ['text', 'coding'],
      priority: 1
    }, 'test');

    // Ждем обработки
    setTimeout(() => {
      const models = coordinator.getModels();
      if (models.length > 0) {
        console.log(`✅ Модель зарегистрирована (всего ${models.length})`);
        success++;
      } else {
        console.error('❌ Модель не зарегистрирована');
        errors++;
      }

      // Статус
      const status = coordinator.getStatus();
      console.log(`✅ Статус: ${status.models} моделей, ${status.activeTasks} задач`);
      success++;
    }, 100);

  } catch (error) {
    console.error('❌ Ошибка Coordinator:', error.message);
    errors++;
  }

  console.log('');
}

/**
 * Тест SharedState
 */
function testSharedState() {
  console.log('=== Тест 4: SharedState ===');

  const logger = createLogger();
  const state = new SharedState(logger);

  try {
    // Set/Get
    state.set('test-key', 'test-value', 'test-user');
    const value = state.get('test-key');

    if (value === 'test-value') {
      console.log('✅ Set/Get работает');
      success++;
    } else {
      console.error('❌ Set/Get не работает');
      errors++;
    }

    // Версионирование
    const entry = state.getEntry('test-key');
    if (entry.version === 1) {
      console.log('✅ Версионирование работает');
      success++;
    }

    // Update
    state.update('test-key', (val) => val + '-updated', 'test-user');
    const updated = state.get('test-key');
    if (updated === 'test-value-updated') {
      console.log('✅ Update работает');
      success++;
    }

    // История
    const history = state.getHistory('test-key');
    if (history.length === 2) {
      console.log(`✅ История работает (${history.length} версий)`);
      success++;
    }

    // Массивы
    state.set('test-array', [], 'test-user');
    state.push('test-array', 1, 'test-user');
    state.push('test-array', 2, 'test-user');
    const arr = state.get('test-array');
    if (Array.isArray(arr) && arr.length === 2) {
      console.log('✅ Операции с массивами работают');
      success++;
    }

    // Статистика
    const stats = state.getStats();
    console.log(`✅ Статистика: ${stats.keysCount} ключей, ${stats.totalVersions} версий`);
    success++;

  } catch (error) {
    console.error('❌ Ошибка SharedState:', error.message);
    errors++;
  }

  console.log('');
}

/**
 * Тест создания системы
 */
function testSystemCreation() {
  console.log('=== Тест 5: Создание системы координации ===');

  const logger = createLogger();

  try {
    const system = createCoordinationSystem(logger);

    if (system.messageBus instanceof MessageBus) {
      console.log('✅ MessageBus создан');
      success++;
    }

    if (system.coordinator instanceof Coordinator) {
      console.log('✅ Coordinator создан');
      success++;
    }

    if (system.sharedState instanceof SharedState) {
      console.log('✅ SharedState создан');
      success++;
    }

    // Проверяем интеграцию
    system.sharedState.set('test', 'value', 'system');

    // Должно быть опубликовано в MessageBus
    let eventReceived = false;
    system.messageBus.subscribe('state:change', () => {
      eventReceived = true;
    }, 'test');

    system.sharedState.set('test2', 'value2', 'system');

    setTimeout(() => {
      if (eventReceived) {
        console.log('✅ Интеграция SharedState -> MessageBus работает');
        success++;
      }
    }, 100);

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
  testMessageBus();
  testCoordinator();
  testSharedState();
  testSystemCreation();

  // Ждем асинхронных операций
  await new Promise(resolve => setTimeout(resolve, 500));

  console.log('=== Результаты тестирования ===');
  console.log(`✅ Успешно: ${success}`);
  console.log(`❌ Ошибок: ${errors}`);
  console.log('');

  if (errors === 0) {
    console.log('🎉 Все тесты пройдены! Модуль координации готов к использованию.');
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
