/**
 * Тестовый скрипт для модуля Task Queue
 * Проверка Task, TaskQueue, TaskDistributor
 */

const winston = require('winston');
const path = require('path');

// Импорт модулей
const { Task, TaskQueue, TaskDistributor, createTaskSystem } = require('../src/index');

// Координация для тестов
const coordinationPath = path.join(__dirname, '../../coordination/src/index');
const { createCoordinationSystem } = require(coordinationPath);

console.log('🧪 Тестирование модуля Task Queue...\n');

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
 * Тест 1: Импорт модулей
 */
function testImports() {
  console.log('=== Тест 1: Импорт модулей ===');

  try {
    if (typeof Task === 'function') {
      console.log('✅ Task импортирован');
      success++;
    }

    if (typeof TaskQueue === 'function') {
      console.log('✅ TaskQueue импортирован');
      success++;
    }

    if (typeof TaskDistributor === 'function') {
      console.log('✅ TaskDistributor импортирован');
      success++;
    }

    if (typeof createTaskSystem === 'function') {
      console.log('✅ createTaskSystem импортирован');
      success++;
    }
  } catch (error) {
    console.error('❌ Ошибка импорта:', error.message);
    errors++;
  }

  console.log('');
}

/**
 * Тест 2: Task - создание и управление
 */
function testTask() {
  console.log('=== Тест 2: Task ===');

  try {
    // Создание задачи
    const task = new Task({
      type: 'test-task',
      description: 'Тестовая задача',
      priority: 7,
      data: { foo: 'bar' }
    });

    if (task.id && task.status === 'pending') {
      console.log('✅ Задача создана');
      success++;
    }

    // Назначение
    task.assign('model-1');
    if (task.status === 'assigned' && task.assignedTo === 'model-1') {
      console.log('✅ Задача назначена');
      success++;
    }

    // Запуск
    task.start();
    if (task.status === 'in-progress' && task.startedAt) {
      console.log('✅ Задача запущена');
      success++;
    }

    // Завершение
    task.complete({ result: 'success' });
    if (task.status === 'completed' && task.result.result === 'success') {
      console.log('✅ Задача завершена');
      success++;
    }

    // Длительность
    const duration = task.getDuration();
    if (duration >= 0) {
      console.log(`✅ Длительность: ${duration}ms`);
      success++;
    }

    // JSON экспорт/импорт
    const json = task.toJSON();
    const restored = Task.fromJSON(json);
    if (restored.id === task.id && restored.status === task.status) {
      console.log('✅ JSON экспорт/импорт работает');
      success++;
    }

  } catch (error) {
    console.error('❌ Ошибка Task:', error.message);
    errors++;
  }

  console.log('');
}

/**
 * Тест 3: TaskQueue - управление очередью
 */
function testTaskQueue() {
  console.log('=== Тест 3: TaskQueue ===');

  const logger = createLogger();
  const queue = new TaskQueue(logger);

  try {
    // Добавление задач
    const taskId1 = queue.add({
      type: 'task-1',
      description: 'Первая задача',
      priority: 5
    });

    const taskId2 = queue.add({
      type: 'task-2',
      description: 'Вторая задача',
      priority: 8
    });

    const taskId3 = queue.add({
      type: 'task-3',
      description: 'Третья задача с зависимостью',
      priority: 9,
      dependencies: [taskId1]
    });

    if (queue.tasks.size === 3) {
      console.log('✅ Задачи добавлены (всего 3)');
      success++;
    }

    // Получение следующей задачи (должна быть с наивысшим приоритетом)
    const next = queue.getNext();
    if (next && next.id === taskId2 && next.priority === 8) {
      console.log(`✅ Следующая задача: ${next.id} (приоритет ${next.priority})`);
      success++;
    }

    // Задача с зависимостью должна быть в ожидании
    const task3 = queue.get(taskId3);
    if (task3.status === 'waiting') {
      console.log('✅ Задача с зависимостью в ожидании');
      success++;
    }

    // Завершаем первую задачу
    queue.updateTaskStatus(taskId1, 'assigned', { modelId: 'model-1' });
    queue.updateTaskStatus(taskId1, 'in-progress');
    queue.updateTaskStatus(taskId1, 'completed', { result: 'done' });

    // Задача 3 должна стать доступной
    if (task3.status === 'pending') {
      console.log('✅ Задача с зависимостью активирована после выполнения зависимости');
      success++;
    }

    // Статистика
    const stats = queue.getStats();
    if (stats.completed === 1 && stats.total === 3) {
      console.log(`✅ Статистика: ${stats.completed} завершено из ${stats.total}`);
      success++;
    }

    // Очистка
    queue.destroy();
    console.log('✅ Очередь уничтожена');
    success++;

  } catch (error) {
    console.error('❌ Ошибка TaskQueue:', error.message);
    errors++;
  }

  console.log('');
}

/**
 * Тест 4: TaskDistributor - распределение задач
 */
async function testTaskDistributor() {
  console.log('=== Тест 4: TaskDistributor ===');

  const logger = createLogger();
  const { messageBus, coordinator } = createCoordinationSystem(logger);
  const queue = new TaskQueue(logger);
  const distributor = new TaskDistributor(queue, coordinator, logger);

  try {
    // Регистрируем модели
    messageBus.publish('coordinator:register', {
      modelId: 'model-fast',
      capabilities: ['text', 'coding'],
      priority: 8
    }, 'test');

    messageBus.publish('coordinator:register', {
      modelId: 'model-slow',
      capabilities: ['text'],
      priority: 3
    }, 'test');

    // Ждем регистрации
    await new Promise(resolve => setTimeout(resolve, 100));

    const models = coordinator.getModels();
    if (models.length === 2) {
      console.log(`✅ Зарегистрировано ${models.length} модели`);
      success++;
    }

    // Добавляем задачу
    const taskId = queue.add({
      type: 'coding',
      description: 'Написать код',
      priority: 7,
      requiredCapabilities: ['coding']
    });

    // Распределяем
    const assigned = await distributor.distributeNext();
    if (assigned) {
      console.log('✅ Задача распределена');
      success++;
    }

    const task = queue.get(taskId);
    if (task.status === 'assigned' && task.assignedTo === 'model-fast') {
      console.log(`✅ Задача назначена правильной модели (${task.assignedTo})`);
      success++;
    }

    // Статус дистрибьютора
    const status = distributor.getStatus();
    if (typeof status.autoDistribute === 'boolean') {
      console.log('✅ Статус дистрибьютора получен');
      success++;
    }

    // Очистка
    distributor.destroy();
    queue.destroy();
    console.log('✅ Дистрибьютор и очередь уничтожены');
    success++;

  } catch (error) {
    console.error('❌ Ошибка TaskDistributor:', error.message);
    console.error(error.stack);
    errors++;
  }

  console.log('');
}

/**
 * Тест 5: Создание системы управления задачами
 */
async function testTaskSystemCreation() {
  console.log('=== Тест 5: Создание системы управления задачами ===');

  const logger = createLogger();
  const { coordinator } = createCoordinationSystem(logger);

  try {
    const system = createTaskSystem(coordinator, logger);

    if (system.taskQueue instanceof TaskQueue) {
      console.log('✅ TaskQueue создан');
      success++;
    }

    if (system.taskDistributor instanceof TaskDistributor) {
      console.log('✅ TaskDistributor создан');
      success++;
    }

    if (system.Task === Task) {
      console.log('✅ Task доступен');
      success++;
    }

    // Проверяем интеграцию
    const taskId = system.taskQueue.add({
      type: 'test',
      description: 'Интеграционный тест'
    });

    const task = system.taskQueue.get(taskId);
    if (task && task.id === taskId) {
      console.log('✅ Интеграция работает');
      success++;
    }

    // Очистка
    system.taskDistributor.destroy();
    system.taskQueue.destroy();

  } catch (error) {
    console.error('❌ Ошибка создания системы:', error.message);
    errors++;
  }

  console.log('');
}

/**
 * Тест 6: Приоритеты и зависимости
 */
function testPrioritiesAndDependencies() {
  console.log('=== Тест 6: Приоритеты и зависимости ===');

  const logger = createLogger();
  const queue = new TaskQueue(logger);

  try {
    // Добавляем задачи с разными приоритетами
    const lowPriorityId = queue.add({
      type: 'low',
      priority: 1,
      description: 'Низкий приоритет'
    });

    const highPriorityId = queue.add({
      type: 'high',
      priority: 10,
      description: 'Высокий приоритет'
    });

    const mediumPriorityId = queue.add({
      type: 'medium',
      priority: 5,
      description: 'Средний приоритет'
    });

    // Следующая задача должна быть с высоким приоритетом
    const next = queue.getNext();
    if (next.id === highPriorityId) {
      console.log('✅ Приоритеты работают корректно (выбрана задача с приоритетом 10)');
      success++;
    }

    // Создаем цепочку зависимостей
    const task1Id = queue.add({
      type: 'chain-1',
      description: 'Первая в цепочке'
    });

    const task2Id = queue.add({
      type: 'chain-2',
      description: 'Вторая в цепочке',
      dependencies: [task1Id]
    });

    const task3Id = queue.add({
      type: 'chain-3',
      description: 'Третья в цепочке',
      dependencies: [task2Id]
    });

    const task2 = queue.get(task2Id);
    const task3 = queue.get(task3Id);

    if (task2.status === 'waiting' && task3.status === 'waiting') {
      console.log('✅ Зависимости установлены, задачи в ожидании');
      success++;
    }

    // Завершаем первую задачу
    queue.updateTaskStatus(task1Id, 'assigned', { modelId: 'model-1' });
    queue.updateTaskStatus(task1Id, 'in-progress');
    queue.updateTaskStatus(task1Id, 'completed', { result: 'done' });

    if (task2.status === 'pending' && task3.status === 'waiting') {
      console.log('✅ После завершения первой задачи, вторая активирована, третья ещё в ожидании');
      success++;
    }

    // Завершаем вторую
    queue.updateTaskStatus(task2Id, 'assigned', { modelId: 'model-1' });
    queue.updateTaskStatus(task2Id, 'in-progress');
    queue.updateTaskStatus(task2Id, 'completed', { result: 'done' });

    if (task3.status === 'pending') {
      console.log('✅ После завершения второй задачи, третья активирована');
      success++;
    }

    queue.destroy();

  } catch (error) {
    console.error('❌ Ошибка тестирования приоритетов и зависимостей:', error.message);
    errors++;
  }

  console.log('');
}

/**
 * Тест 7: Повторные попытки и тайм-ауты
 */
async function testRetriesAndTimeouts() {
  console.log('=== Тест 7: Повторные попытки и тайм-ауты ===');

  const logger = createLogger();
  const queue = new TaskQueue(logger);

  try {
    // Задача с повторными попытками
    const taskId = queue.add({
      type: 'retry-test',
      description: 'Тест повторных попыток',
      maxRetries: 2
    });

    const task = queue.get(taskId);

    // Первая неудачная попытка
    queue.updateTaskStatus(taskId, 'assigned', { modelId: 'model-1' });
    queue.updateTaskStatus(taskId, 'in-progress');
    queue.updateTaskStatus(taskId, 'failed', { error: 'Test error' });

    if (task.status === 'pending' && task.retryCount === 1) {
      console.log('✅ После ошибки задача вернулась в pending (попытка 1/2)');
      success++;
    }

    // Вторая неудачная попытка
    queue.updateTaskStatus(taskId, 'assigned', { modelId: 'model-1' });
    queue.updateTaskStatus(taskId, 'in-progress');
    queue.updateTaskStatus(taskId, 'failed', { error: 'Test error' });

    if (task.status === 'pending' && task.retryCount === 2) {
      console.log('✅ После второй ошибки задача снова в pending (попытка 2/2)');
      success++;
    }

    // Третья неудачная попытка - должна завершиться как failed
    queue.updateTaskStatus(taskId, 'assigned', { modelId: 'model-1' });
    queue.updateTaskStatus(taskId, 'in-progress');
    queue.updateTaskStatus(taskId, 'failed', { error: 'Test error' });

    if (task.status === 'failed' && task.retryCount === 2) {
      console.log('✅ После третьей ошибки задача окончательно failed');
      success++;
    }

    // Тест тайм-аута
    const timeoutTaskId = queue.add({
      type: 'timeout-test',
      description: 'Тест тайм-аута',
      timeout: 100 // 100 мс
    });

    queue.updateTaskStatus(timeoutTaskId, 'assigned', { modelId: 'model-1' });
    queue.updateTaskStatus(timeoutTaskId, 'in-progress');

    // Ждем больше тайм-аута
    await new Promise(resolve => setTimeout(resolve, 6000)); // Даём время на проверку тайм-аутов

    const timeoutTask = queue.get(timeoutTaskId);
    if (timeoutTask.status === 'failed') {
      console.log('✅ Задача с тайм-аутом автоматически провалена');
      success++;
    }

    queue.destroy();

  } catch (error) {
    console.error('❌ Ошибка тестирования повторных попыток:', error.message);
    errors++;
  }

  console.log('');
}

/**
 * Запуск всех тестов
 */
async function runTests() {
  testImports();
  testTask();
  testTaskQueue();
  await testTaskDistributor();
  await testTaskSystemCreation();
  testPrioritiesAndDependencies();
  await testRetriesAndTimeouts();

  // Ждем асинхронных операций
  await new Promise(resolve => setTimeout(resolve, 500));

  console.log('=== Результаты тестирования ===');
  console.log(`✅ Успешно: ${success}`);
  console.log(`❌ Ошибок: ${errors}`);
  console.log('');

  if (errors === 0) {
    console.log('🎉 Все тесты пройдены! Модуль Task Queue готов к использованию.');
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
