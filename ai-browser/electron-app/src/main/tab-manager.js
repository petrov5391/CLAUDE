/**
 * Менеджер вкладок браузера
 * Управляет созданием, закрытием и навигацией вкладок
 */

const { BrowserView } = require('electron');
const { v4: uuidv4 } = require('uuid');

class TabManager {
  constructor(logger) {
    this.logger = logger;
    this.tabs = new Map(); // tabId -> { view, metadata }
    this.activeTabId = null;
  }

  /**
   * Создание новой вкладки
   */
  async createTab(options = {}) {
    const tabId = uuidv4();
    const {
      url = 'about:blank',
      modelId = null,
      isolated = true
    } = options;

    try {
      this.logger.info(`Создание вкладки ${tabId}`, { url, modelId, isolated });

      // Создаем BrowserView для вкладки
      const view = new BrowserView({
        webPreferences: {
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: isolated,
          partition: isolated ? `persist:tab-${tabId}` : 'persist:shared'
        }
      });

      // Метаданные вкладки
      const metadata = {
        id: tabId,
        url,
        title: 'Новая вкладка',
        favicon: null,
        modelId,
        isolated,
        createdAt: Date.now(),
        status: 'loading'
      };

      // Сохраняем вкладку
      this.tabs.set(tabId, { view, metadata });

      // Подписываемся на события
      this.setupTabEvents(tabId, view);

      // Загружаем URL если указан
      if (url !== 'about:blank') {
        await view.webContents.loadURL(url);
      }

      this.logger.info(`Вкладка ${tabId} создана успешно`);

      return {
        success: true,
        tabId,
        metadata
      };
    } catch (error) {
      this.logger.error(`Ошибка создания вкладки:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Настройка обработчиков событий для вкладки
   */
  setupTabEvents(tabId, view) {
    const webContents = view.webContents;
    const tab = this.tabs.get(tabId);

    // Изменение заголовка
    webContents.on('page-title-updated', (event, title) => {
      tab.metadata.title = title;
      this.logger.debug(`Вкладка ${tabId}: заголовок изменен на "${title}"`);
    });

    // Завершение загрузки
    webContents.on('did-finish-load', () => {
      tab.metadata.status = 'complete';
      tab.metadata.url = webContents.getURL();
      this.logger.info(`Вкладка ${tabId}: загрузка завершена - ${tab.metadata.url}`);
    });

    // Начало загрузки
    webContents.on('did-start-loading', () => {
      tab.metadata.status = 'loading';
      this.logger.debug(`Вкладка ${tabId}: начало загрузки`);
    });

    // Ошибка загрузки
    webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      tab.metadata.status = 'error';
      this.logger.error(`Вкладка ${tabId}: ошибка загрузки`, { errorCode, errorDescription });
    });

    // Новое окно
    webContents.setWindowOpenHandler(({ url }) => {
      this.logger.info(`Вкладка ${tabId}: запрос открытия нового окна - ${url}`);
      // Открываем в новой вкладке вместо нового окна
      this.createTab({ url });
      return { action: 'deny' };
    });
  }

  /**
   * Закрытие вкладки
   */
  async closeTab(tabId) {
    try {
      const tab = this.tabs.get(tabId);

      if (!tab) {
        this.logger.warn(`Попытка закрыть несуществующую вкладку ${tabId}`);
        return { success: false, error: 'Tab not found' };
      }

      this.logger.info(`Закрытие вкладки ${tabId}`);

      // Уничтожаем view
      tab.view.webContents.destroy();

      // Удаляем из коллекции
      this.tabs.delete(tabId);

      // Если это была активная вкладка, сбрасываем activeTabId
      if (this.activeTabId === tabId) {
        this.activeTabId = null;
      }

      this.logger.info(`Вкладка ${tabId} закрыта успешно`);

      return { success: true };
    } catch (error) {
      this.logger.error(`Ошибка закрытия вкладки ${tabId}:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Навигация вкладки по URL
   */
  async navigateTab(tabId, url) {
    try {
      const tab = this.tabs.get(tabId);

      if (!tab) {
        return { success: false, error: 'Tab not found' };
      }

      this.logger.info(`Навигация вкладки ${tabId} -> ${url}`);

      await tab.view.webContents.loadURL(url);

      return { success: true };
    } catch (error) {
      this.logger.error(`Ошибка навигации вкладки ${tabId}:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Получить все вкладки
   */
  getAllTabs() {
    const tabs = [];

    for (const [tabId, { metadata }] of this.tabs) {
      tabs.push(metadata);
    }

    return tabs;
  }

  /**
   * Получить вкладку по ID
   */
  getTab(tabId) {
    return this.tabs.get(tabId);
  }

  /**
   * Очистка ресурсов
   */
  cleanup() {
    this.logger.info('Очистка TabManager: закрытие всех вкладок');

    for (const [tabId] of this.tabs) {
      this.closeTab(tabId);
    }

    this.tabs.clear();
  }
}

module.exports = { TabManager };
