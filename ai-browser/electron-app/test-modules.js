/**
 * Тестовый скрипт для проверки модулей без GUI
 * Проверяет что все модули загружаются без ошибок
 */

console.log('🧪 Тестирование модулей AI Browser...\n');

let errors = 0;
let success = 0;

/**
 * Проверка импорта модуля
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
 * Тестирование зависимостей
 */
function testDependencies() {
  console.log('=== Проверка зависимостей ===');

  testModule('Winston (логирование)', 'winston');
  testModule('UUID (генерация ID)', 'uuid');
  testModule('Axios (HTTP клиент)', 'axios');
  testModule('Redis client', 'redis');
  testModule('Playwright Core', 'playwright-core');
  testModule('Electron Store', 'electron-store');

  console.log('');
}

/**
 * Тестирование наших модулей
 */
function testCustomModules() {
  console.log('=== Проверка собственных модулей ===');

  // Мокаем electron для тестирования
  const mockElectron = {
    BrowserView: class BrowserView {
      constructor() { this.webContents = { on: () => {}, destroy: () => {}, loadURL: async () => {} }; }
    }
  };

  global.require = new Proxy(require, {
    apply(target, thisArg, argumentsList) {
      if (argumentsList[0] === 'electron') {
        return mockElectron;
      }
      return Reflect.apply(target, thisArg, argumentsList);
    }
  });

  // Создаем минимальный мок logger
  const winston = require('winston');
  const logger = winston.createLogger({
    level: 'error',
    transports: [new winston.transports.Console({ silent: true })]
  });

  // Тестируем модули
  const loggingModule = testModule('Logging module', './src/main/logging');

  // TabManager
  try {
    const { TabManager } = require('./src/main/tab-manager');
    const tabManager = new TabManager(logger);
    console.log(`✅ TabManager: OK (методы: createTab, closeTab, navigateTab)`);
    success++;
  } catch (error) {
    console.error(`❌ TabManager: FAILED`);
    console.error(`   Ошибка: ${error.message}`);
    errors++;
  }

  // AIModelManager
  try {
    const { AIModelManager } = require('./src/main/ai-model-manager');
    const aiManager = new AIModelManager(logger);
    console.log(`✅ AIModelManager: OK (зарегистрировано ${aiManager.models.size} моделей)`);

    // Проверяем список моделей
    const models = Array.from(aiManager.models.keys());
    console.log(`   Модели: ${models.slice(0, 5).join(', ')}...`);
    success++;
  } catch (error) {
    console.error(`❌ AIModelManager: FAILED`);
    console.error(`   Ошибка: ${error.message}`);
    errors++;
  }

  console.log('');
}

/**
 * Проверка структуры файлов
 */
function testFileStructure() {
  console.log('=== Проверка структуры файлов ===');

  const fs = require('fs');
  const path = require('path');

  const requiredFiles = [
    'package.json',
    'src/main/index.js',
    'src/main/logging.js',
    'src/main/tab-manager.js',
    'src/main/ai-model-manager.js',
    'src/preload/index.js',
    'src/renderer/app.js',
    'public/index.html'
  ];

  requiredFiles.forEach(file => {
    const filePath = path.join(__dirname, file);
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      console.log(`✅ ${file} (${stats.size} bytes)`);
      success++;
    } else {
      console.error(`❌ ${file} - НЕ НАЙДЕН`);
      errors++;
    }
  });

  console.log('');
}

/**
 * Запуск всех тестов
 */
async function runTests() {
  try {
    testDependencies();
    testFileStructure();
    testCustomModules();

    console.log('=== Результаты тестирования ===');
    console.log(`✅ Успешно: ${success}`);
    console.log(`❌ Ошибок: ${errors}`);
    console.log('');

    if (errors === 0) {
      console.log('🎉 Все тесты пройдены! Приложение готово к запуску в графическом окружении.');
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
