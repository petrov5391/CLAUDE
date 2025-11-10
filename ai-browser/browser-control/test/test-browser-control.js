/**
 * Тестовый скрипт для Browser Control модуля
 * Проверка работоспособности без запуска реального браузера
 */

const winston = require('winston');

console.log('🧪 Тестирование Browser Control модуля...\n');

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
 * Тестирование модуля
 */
function testModule(name, modulePath) {
  try {
    const module = require(modulePath);
    console.log(`✅ ${name}: OK`);
    success++;
    return module;
  } catch (error) {
    console.error(`❌ ${name}: FAILED`);
    console.error(`   Ошибка: ${error.message}`);
    errors++;
    return null;
  }
}

/**
 * Запуск тестов
 */
async function runTests() {
  try {
    console.log('=== Проверка зависимостей ===');
    testModule('Playwright', 'playwright');
    testModule('Winston', 'winston');
    testModule('UUID', 'uuid');
    console.log('');

    console.log('=== Проверка модулей Browser Control ===');

    const indexModule = testModule('Index (entry point)', '../src/index');
    const controllerModule = testModule('BrowserController', '../src/browser-controller');
    const sessionModule = testModule('BrowserSession', '../src/browser-session');

    console.log('');

    console.log('=== Проверка провайдеров ===');
    const chatgptProvider = testModule('ChatGPT Provider', '../src/providers/chatgpt-provider');
    const claudeProvider = testModule('Claude Provider', '../src/providers/claude-provider');
    const deepseekProvider = testModule('DeepSeek Provider', '../src/providers/deepseek-provider');
    console.log('');

    // Проверка структуры экспортов
    console.log('=== Проверка экспортов ===');

    if (indexModule) {
      const hasController = !!indexModule.BrowserController;
      const hasSession = !!indexModule.BrowserSession;
      const hasProviders = !!indexModule.providers;

      if (hasController) {
        console.log('✅ BrowserController экспортирован');
        success++;
      } else {
        console.error('❌ BrowserController не найден в экспортах');
        errors++;
      }

      if (hasSession) {
        console.log('✅ BrowserSession экспортирован');
        success++;
      } else {
        console.error('❌ BrowserSession не найден в экспортах');
        errors++;
      }

      if (hasProviders) {
        console.log('✅ Providers экспортированы');
        const providerCount = Object.keys(indexModule.providers).length;
        console.log(`   Доступно провайдеров: ${providerCount}`);
        success++;
      } else {
        console.error('❌ Providers не найдены в экспортах');
        errors++;
      }
    }

    console.log('');

    // Тестирование инстанцирования классов
    console.log('=== Проверка создания объектов ===');

    try {
      const logger = createLogger();
      const { BrowserController } = require('../src/browser-controller');
      const controller = new BrowserController(logger, { headless: true });

      console.log('✅ BrowserController успешно создан');
      console.log(`   Options: headless=${controller.options.headless}`);
      console.log(`   Initialized: ${controller.isInitialized}`);
      console.log(`   Sessions: ${controller.sessions.size}`);
      success++;
    } catch (error) {
      console.error('❌ Ошибка создания BrowserController:', error.message);
      errors++;
    }

    console.log('');

    console.log('=== Результаты тестирования ===');
    console.log(`✅ Успешно: ${success}`);
    console.log(`❌ Ошибок: ${errors}`);
    console.log('');

    if (errors === 0) {
      console.log('🎉 Все тесты пройдены! Browser Control модуль готов к использованию.');
      console.log('');
      console.log('⚠️  Примечание: Для реальной работы с браузером требуется:');
      console.log('  1. Установленный Playwright: npm install playwright');
      console.log('  2. Загруженные браузеры: npx playwright install chromium');
      console.log('  3. Графическое окружение для non-headless режима');
      process.exit(0);
    } else {
      console.log('⚠️  Обнаружены ошибки. Требуется исправление.');
      process.exit(1);
    }
  } catch (error) {
    console.error('💥 Критическая ошибка при тестировании:', error);
    process.exit(1);
  }
}

// Запуск
runTests();
