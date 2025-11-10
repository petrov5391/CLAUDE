/**
 * Главный процесс Electron - AI Browser
 * Управляет окнами, вкладками и взаимодействием с системой
 */

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { setupLogging } = require('./logging');
const { TabManager } = require('./tab-manager');
const { AIModelManager } = require('./ai-model-manager');

// Глобальные переменные
let mainWindow = null;
let logger = null;
let tabManager = null;
let aiModelManager = null;

/**
 * Создание главного окна браузера
 */
function createMainWindow() {
  logger.info('Создание главного окна браузера');

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    title: 'AI Browser',
    icon: path.join(__dirname, '../../public/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      enableRemoteModule: false,
      sandbox: true
    },
    frame: true,
    backgroundColor: '#1a1a1a',
    show: false
  });

  // Загрузка стартовой страницы (Dashboard)
  const isDev = process.env.NODE_ENV === 'development';

  if (isDev) {
    mainWindow.loadFile(path.join(__dirname, '../../public/index.html'));
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../public/index.html'));
  }

  // Показываем окно после загрузки
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    logger.info('Главное окно готово и отображено');
  });

  // Обработка закрытия окна
  mainWindow.on('closed', () => {
    logger.info('Главное окно закрыто');
    mainWindow = null;
  });

  return mainWindow;
}

/**
 * Инициализация приложения
 */
async function initialize() {
  try {
    // Настройка логирования
    logger = setupLogging();
    logger.info('=== AI Browser запускается ===');

    // Инициализация менеджеров
    tabManager = new TabManager(logger);
    aiModelManager = new AIModelManager(logger);

    logger.info('Менеджеры инициализированы');

    // Создание главного окна
    createMainWindow();

    // Регистрация IPC обработчиков
    setupIPCHandlers();

    logger.info('Приложение успешно инициализировано');
  } catch (error) {
    console.error('Ошибка инициализации:', error);
    if (logger) {
      logger.error('Критическая ошибка инициализации:', error);
    }
    app.quit();
  }
}

/**
 * Настройка обработчиков IPC для коммуникации с renderer процессом
 */
function setupIPCHandlers() {
  // === Управление вкладками ===

  ipcMain.handle('tab:create', async (event, options) => {
    logger.info('IPC: Создание новой вкладки', options);
    return await tabManager.createTab(options);
  });

  ipcMain.handle('tab:close', async (event, tabId) => {
    logger.info(`IPC: Закрытие вкладки ${tabId}`);
    return await tabManager.closeTab(tabId);
  });

  ipcMain.handle('tab:navigate', async (event, { tabId, url }) => {
    logger.info(`IPC: Навигация вкладки ${tabId} -> ${url}`);
    return await tabManager.navigateTab(tabId, url);
  });

  ipcMain.handle('tab:getAll', async () => {
    return await tabManager.getAllTabs();
  });

  // === Управление AI моделями ===

  ipcMain.handle('ai:listModels', async () => {
    logger.info('IPC: Запрос списка AI моделей');
    return await aiModelManager.listAvailableModels();
  });

  ipcMain.handle('ai:assignModel', async (event, { tabId, modelId, config }) => {
    logger.info(`IPC: Привязка модели ${modelId} к вкладке ${tabId}`);
    return await aiModelManager.assignModelToTab(tabId, modelId, config);
  });

  ipcMain.handle('ai:sendPrompt', async (event, { tabId, prompt, context }) => {
    logger.info(`IPC: Отправка промпта для вкладки ${tabId}`);
    return await aiModelManager.sendPrompt(tabId, prompt, context);
  });

  // === Системная информация ===

  ipcMain.handle('system:getInfo', async () => {
    return {
      version: app.getVersion(),
      platform: process.platform,
      arch: process.arch,
      electronVersion: process.versions.electron,
      chromeVersion: process.versions.chrome,
      nodeVersion: process.versions.node
    };
  });

  ipcMain.handle('system:getLogs', async (event, { limit = 100 }) => {
    // Возвращаем последние логи
    const logPath = path.join(__dirname, '../../../logs/ai-browser.log');
    try {
      const logs = fs.readFileSync(logPath, 'utf-8')
        .split('\n')
        .filter(line => line.trim())
        .slice(-limit);
      return logs;
    } catch (error) {
      logger.error('Ошибка чтения логов:', error);
      return [];
    }
  });

  logger.info('IPC обработчики зарегистрированы');
}

// === Жизненный цикл приложения ===

// Приложение готово
app.whenReady().then(initialize);

// Все окна закрыты
app.on('window-all-closed', () => {
  logger.info('Все окна закрыты');
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Активация приложения (macOS)
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow();
  }
});

// Завершение работы
app.on('before-quit', () => {
  logger.info('=== AI Browser завершает работу ===');

  // Очистка ресурсов
  if (tabManager) {
    tabManager.cleanup();
  }
  if (aiModelManager) {
    aiModelManager.cleanup();
  }
});

// Обработка необработанных ошибок
process.on('uncaughtException', (error) => {
  console.error('Необработанное исключение:', error);
  if (logger) {
    logger.error('Необработанное исключение:', error);
  }
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Необработанный отказ промиса:', reason);
  if (logger) {
    logger.error('Необработанный отказ промиса:', { reason, promise });
  }
});
