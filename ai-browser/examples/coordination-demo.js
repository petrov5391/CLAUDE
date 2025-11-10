/**
 * Демонстрация модуля координации
 * Показывает взаимодействие двух AI моделей через координацию
 */

const winston = require('winston');
const { createCoordinationSystem } = require('../coordination/src');

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
 * Демонстрация межмодельной коммуникации
 */
async function demo() {
  console.log('\n🚀 Демонстрация модуля координации\n');

  // Создаем систему координации
  const { messageBus, coordinator, sharedState } = createCoordinationSystem(logger);

  console.log('✅ Система координации создана\n');

  // === Сценарий: Две модели работают над общей задачей ===

  // Регистрируем Model 1 (Генератор идей)
  messageBus.publish('coordinator:register', {
    modelId: 'model-ideas',
    capabilities: ['brainstorming', 'creativity'],
    priority: 5
  }, 'model-ideas');

  // Регистрируем Model 2 (Критик)
  messageBus.publish('coordinator:register', {
    modelId: 'model-critic',
    capabilities: ['analysis', 'evaluation'],
    priority: 5
  }, 'model-critic');

  // Ждем регистрации
  await new Promise(resolve => setTimeout(resolve, 100));

  console.log(`📊 Зарегистрировано моделей: ${coordinator.getModels().length}\n`);

  // Model 1 подписывается на запросы идей
  messageBus.subscribe('generate:ideas', (message) => {
    console.log('💡 [Model-Ideas] Генерирую идеи...');

    const ideas = [
      'Добавить темную тему',
      'Интеграция с Telegram',
      'Голосовой ввод'
    ];

    messageBus.respond(message, { ideas }, 'model-ideas');
    console.log(`   Сгенерировано ${ideas.length} идей\n`);
  }, 'model-ideas');

  // Model 2 запрашивает идеи
  console.log('🔍 [Model-Critic] Запрашиваю идеи...');
  const response = await messageBus.request('generate:ideas', {
    count: 3
  }, 'model-critic', 5000);

  console.log('📝 [Model-Critic] Получил идеи, анализирую...\n');

  // Model 2 анализирует и сохраняет в SharedState
  for (const idea of response.ideas) {
    const score = Math.floor(Math.random() * 10) + 1;

    sharedState.push('evaluated-ideas', {
      idea,
      score,
      evaluatedBy: 'model-critic'
    }, 'model-critic');

    console.log(`   ✓ "${idea}" - оценка: ${score}/10`);
  }

  console.log('\n📊 Статистика:\n');
  console.log('   MessageBus:', messageBus.getStats());
  console.log('   Coordinator:', coordinator.getStatus());
  console.log('   SharedState:', sharedState.getStats());

  console.log('\n✅ Демонстрация завершена!\n');
}

// Запуск
demo().catch(console.error);
