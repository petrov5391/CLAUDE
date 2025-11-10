/**
 * Пример интеграции Browser Control с AI Browser
 * Демонстрирует работу с web-based моделями через Electron приложение
 */

const winston = require('winston');
const path = require('path');

// Импортируем модули
const { BrowserController } = require('../browser-control/src/index');

/**
 * Создание logger
 */
function createLogger() {
  return winston.createLogger({
    level: 'info',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.printf(({ timestamp, level, message }) => {
        return `${timestamp} [${level.toUpperCase()}] ${message}`;
      })
    ),
    transports: [
      new winston.transports.Console({
        format: winston.format.colorize({ all: true })
      })
    ]
  });
}

/**
 * Пример 1: Базовое использование Browser Control
 */
async function example1_basic() {
  console.log('\n=== Пример 1: Базовое использование ===\n');

  const logger = createLogger();
  const controller = new BrowserController(logger, {
    headless: false,  // Показываем браузер для демонстрации
    slowMo: 50        // Замедляем для наглядности
  });

  try {
    // Инициализация
    await controller.initialize();
    console.log('✓ Browser Controller инициализирован');

    // Создаем сессию для ChatGPT
    const { sessionId, session } = await controller.createSession('chatgpt');
    console.log(`✓ Сессия создана: ${sessionId}`);

    // Ждем ручной авторизации (если требуется)
    console.log('⚠️  Если требуется авторизация - выполните ее в открывшемся браузере');
    console.log('   Ожидание 30 секунд...');
    await new Promise(resolve => setTimeout(resolve, 30000));

    // Проверяем авторизацию
    const isAuth = await session.providerInstance.checkAuthentication();
    console.log(`Авторизация: ${isAuth ? '✓ Да' : '✗ Нет'}`);

    if (isAuth) {
      // Отправляем тестовый промпт
      console.log('\nОтправка промпта: "Напиши Hello World на Python"');
      const response = await session.sendPrompt('Напиши Hello World на Python');

      console.log('\n--- Ответ от ChatGPT ---');
      console.log(response.response);
      console.log('--- Конец ответа ---\n');
    }

    // Закрываем сессию
    await controller.closeSession(sessionId);
    console.log('✓ Сессия закрыта');

  } catch (error) {
    console.error('❌ Ошибка:', error);
  } finally {
    await controller.cleanup();
    console.log('✓ Browser Controller очищен');
  }
}

/**
 * Пример 2: Множественные модели одновременно
 */
async function example2_multiple() {
  console.log('\n=== Пример 2: Работа с несколькими моделями ===\n');

  const logger = createLogger();
  const controller = new BrowserController(logger, { headless: true });

  try {
    await controller.initialize();

    // Создаем сессии для разных моделей
    const chatgpt = await controller.createSession('chatgpt');
    const claude = await controller.createSession('claude');
    const deepseek = await controller.createSession('deepseek');

    console.log(`✓ Создано ${controller.sessions.size} сессий`);

    // Получаем статистику
    const stats = controller.getStats();
    console.log('Статистика:', JSON.stringify(stats, null, 2));

    // Закрываем все сессии
    await controller.cleanup();

  } catch (error) {
    console.error('❌ Ошибка:', error);
  }
}

/**
 * Пример 3: Сохранение и восстановление сессии
 */
async function example3_persistence() {
  console.log('\n=== Пример 3: Сохранение сессии ===\n');

  const logger = createLogger();

  // Создаем контроллер с persistent context
  const controller = new BrowserController(logger, {
    headless: false,
    userDataDir: path.join(__dirname, '../browser-control/user-data/chatgpt')
  });

  try {
    await controller.initialize();

    const { sessionId, session } = await controller.createSession('chatgpt');

    console.log('✓ Сессия создана с persistent context');
    console.log('   Авторизация будет сохранена между запусками');

    // Ждем авторизации
    await new Promise(resolve => setTimeout(resolve, 30000));

    // Сохраняем cookies
    const cookies = await session.getCookies();
    console.log(`✓ Получено ${cookies.length} cookies`);

    // Сохраняем состояние
    const statePath = path.join(__dirname, '../browser-control/sessions/chatgpt-state.json');
    await session.saveState(statePath);
    console.log(`✓ Состояние сохранено: ${statePath}`);

    await controller.cleanup();

  } catch (error) {
    console.error('❌ Ошибка:', error);
  }
}

/**
 * Пример 4: Интеграция с AI Model Manager
 */
async function example4_integration() {
  console.log('\n=== Пример 4: Интеграция с AI Model Manager ===\n');

  // Этот пример показывает как Browser Control работает с Electron
  console.log('Демонстрация интеграции:');
  console.log('');
  console.log('1. AI Model Manager создает Browser Controller при инициализации');
  console.log('2. При привязке web-based модели к вкладке создается браузерная сессия');
  console.log('3. Промпты отправляются через sendWebPrompt() -> Browser Control -> Provider');
  console.log('4. Ответы возвращаются обратно в Electron приложение');
  console.log('');
  console.log('Код интеграции находится в:');
  console.log('  - electron-app/src/main/ai-model-manager.js (initBrowserController, sendWebPrompt)');
  console.log('  - browser-control/src/browser-controller.js (основной контроллер)');
  console.log('  - browser-control/src/providers/*.js (провайдеры для каждого сервиса)');
}

/**
 * Главная функция
 */
async function main() {
  const args = process.argv.slice(2);
  const exampleNum = args[0] || '4';

  console.log('🚀 Browser Control Integration Examples');
  console.log('========================================');

  switch (exampleNum) {
    case '1':
      await example1_basic();
      break;
    case '2':
      await example2_multiple();
      break;
    case '3':
      await example3_persistence();
      break;
    case '4':
      await example4_integration();
      break;
    default:
      console.log('\nДоступные примеры:');
      console.log('  node browser-control-integration.js 1  - Базовое использование');
      console.log('  node browser-control-integration.js 2  - Множественные модели');
      console.log('  node browser-control-integration.js 3  - Сохранение сессии');
      console.log('  node browser-control-integration.js 4  - Интеграция с Electron (описание)');
      console.log('');
      console.log('По умолчанию запускается пример 4 (описание интеграции)');
      await example4_integration();
  }

  console.log('\n✓ Готово!');
  process.exit(0);
}

// Запуск с обработкой ошибок
main().catch(error => {
  console.error('\n💥 Критическая ошибка:', error);
  process.exit(1);
});
