/**
 * Демонстрация модуля Task Queue
 * Показывает работу системы управления задачами с автоматическим распределением
 */

const winston = require('winston');
const { createCoordinationSystem } = require('../coordination/src');
const { createTaskSystem } = require('../task-queue/src');

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
 * Симуляция выполнения задачи моделью
 */
async function simulateTaskExecution(task, model, taskQueue) {
  console.log(`  🤖 [${model.id}] Начинаю выполнение задачи "${task.description}"`);

  // Обновляем статус
  taskQueue.updateTaskStatus(task.id, 'in-progress');

  // Имитация работы
  const workTime = Math.floor(Math.random() * 2000) + 500;
  await new Promise(resolve => setTimeout(resolve, workTime));

  // Случайный результат (90% успеха)
  const success = Math.random() > 0.1;

  if (success) {
    taskQueue.updateTaskStatus(task.id, 'completed', {
      result: {
        status: 'success',
        duration: workTime,
        model: model.id
      }
    });
    console.log(`  ✅ [${model.id}] Задача "${task.description}" завершена за ${workTime}ms`);
  } else {
    taskQueue.updateTaskStatus(task.id, 'failed', {
      error: 'Случайная ошибка'
    });
    console.log(`  ❌ [${model.id}] Задача "${task.description}" провалена`);
  }
}

/**
 * Основная демонстрация
 */
async function demo() {
  console.log('\n🚀 Демонстрация Task Queue\n');

  // Создаем систему координации
  const { messageBus, coordinator } = createCoordinationSystem(logger);

  // Создаем систему управления задачами
  const { taskQueue, taskDistributor, Task } = createTaskSystem(coordinator, logger);

  console.log('✅ Системы созданы\n');

  // === Сценарий: Регистрация моделей ===

  console.log('📋 Регистрация AI моделей:\n');

  const models = [
    {
      id: 'gpt-4-turbo',
      capabilities: ['text', 'coding', 'analysis'],
      priority: 10
    },
    {
      id: 'claude-3-opus',
      capabilities: ['text', 'coding', 'creative'],
      priority: 9
    },
    {
      id: 'gpt-3.5-turbo',
      capabilities: ['text', 'simple-coding'],
      priority: 5
    },
    {
      id: 'stable-diffusion',
      capabilities: ['image-generation'],
      priority: 7
    }
  ];

  for (const model of models) {
    messageBus.publish('coordinator:register', model, 'demo');
    console.log(`  ✓ ${model.id} (приоритет ${model.priority})`);
  }

  // Ждем регистрации
  await new Promise(resolve => setTimeout(resolve, 100));

  console.log(`\n✅ Зарегистрировано моделей: ${coordinator.getModels().length}\n`);

  // === Сценарий: Добавление задач с зависимостями ===

  console.log('📝 Создание задач с зависимостями:\n');

  // Задача 1: Анализ требований
  const task1 = taskQueue.add({
    type: 'analysis',
    description: 'Проанализировать требования проекта',
    priority: 8,
    requiredCapabilities: ['text', 'analysis']
  });
  console.log(`  1️⃣  Анализ требований (ID: ${task1.substring(0, 8)}...)`);

  // Задача 2: Написание кода (зависит от задачи 1)
  const task2 = taskQueue.add({
    type: 'coding',
    description: 'Написать основной код на основе анализа',
    priority: 9,
    requiredCapabilities: ['coding'],
    dependencies: [task1]
  });
  console.log(`  2️⃣  Написание кода (зависит от задачи 1)`);

  // Задача 3: Написание тестов (зависит от задачи 2)
  const task3 = taskQueue.add({
    type: 'coding',
    description: 'Написать unit-тесты',
    priority: 7,
    requiredCapabilities: ['coding'],
    dependencies: [task2]
  });
  console.log(`  3️⃣  Написание тестов (зависит от задачи 2)`);

  // Задача 4: Генерация изображения (независимая, высокий приоритет)
  const task4 = taskQueue.add({
    type: 'image-gen',
    description: 'Сгенерировать логотип проекта',
    priority: 10,
    requiredCapabilities: ['image-generation']
  });
  console.log(`  4️⃣  Генерация логотипа (независимая, высокий приоритет)`);

  // Задача 5: Документация (зависит от задач 2 и 3)
  const task5 = taskQueue.add({
    type: 'documentation',
    description: 'Написать документацию',
    priority: 6,
    requiredCapabilities: ['text'],
    dependencies: [task2, task3]
  });
  console.log(`  5️⃣  Документация (зависит от задач 2 и 3)`);

  console.log('\n📊 Статистика очереди:');
  console.log('  ', taskQueue.getStats());

  // === Сценарий: Автоматическое распределение ===

  console.log('\n🔄 Запуск автоматического распределения...\n');

  // Подписываемся на события распределения
  taskDistributor.on('task:assigned', ({ task, model }) => {
    console.log(`📌 Задача "${task.description}" назначена модели ${model.id}`);

    // Симулируем выполнение
    simulateTaskExecution(task, model, taskQueue);
  });

  // Подписываемся на готовность задач
  taskQueue.on('task:ready', ({ task }) => {
    console.log(`🟢 Задача "${task.description}" готова к выполнению`);
  });

  // Запускаем автоматическое распределение
  taskDistributor.startAutoDistribution();

  // Ждем завершения всех задач
  console.log('⏳ Ожидание завершения всех задач...\n');

  // Проверяем каждые 500ms
  let iterations = 0;
  const maxIterations = 60; // Максимум 30 секунд

  while (iterations < maxIterations) {
    await new Promise(resolve => setTimeout(resolve, 500));
    iterations++;

    const stats = taskQueue.getStats();
    const total = stats.total;
    const completed = stats.completed;
    const failed = stats.failed;

    // Все задачи завершены (успешно или нет)
    if (completed + failed === total) {
      break;
    }
  }

  // Останавливаем распределение
  taskDistributor.stopAutoDistribution();

  console.log('\n📊 Финальная статистика:\n');

  const stats = taskQueue.getStats();
  console.log('  Очередь задач:');
  console.log(`    - Всего: ${stats.total}`);
  console.log(`    - Завершено: ${stats.completed}`);
  console.log(`    - Провалено: ${stats.failed}`);
  console.log(`    - В процессе: ${stats.inProgress}`);
  console.log(`    - В ожидании: ${stats.waiting}`);

  console.log('\n  Модели:');
  const modelStats = taskDistributor.getModelStats();
  for (const [modelId, stats] of Object.entries(modelStats)) {
    const successRate = stats.completed > 0
      ? ((stats.completed / (stats.completed + stats.failed)) * 100).toFixed(1)
      : 0;
    console.log(`    - ${modelId}:`);
    console.log(`        Завершено: ${stats.completed}, Провалено: ${stats.failed}`);
    console.log(`        Успешность: ${successRate}%`);
    console.log(`        Среднее время: ${stats.avgDuration.toFixed(0)}ms`);
  }

  console.log('\n  Координатор:');
  console.log('  ', coordinator.getStatus());

  console.log('\n✅ Демонстрация завершена!\n');

  // Очистка
  taskDistributor.destroy();
  taskQueue.destroy();
}

// Запуск
demo().catch(console.error);
