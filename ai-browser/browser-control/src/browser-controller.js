/**
 * Browser Controller - главный контроллер для управления браузерными сессиями
 * Использует Playwright для автоматизации
 */

const { chromium } = require('playwright');
const { v4: uuidv4 } = require('uuid');
const { BrowserSession } = require('./browser-session');

class BrowserController {
  constructor(logger, options = {}) {
    this.logger = logger;
    this.options = {
      headless: options.headless !== undefined ? options.headless : true,
      slowMo: options.slowMo || 0,
      devtools: options.devtools || false,
      userDataDir: options.userDataDir || null,
      ...options
    };

    this.browser = null;
    this.sessions = new Map(); // sessionId -> BrowserSession
    this.isInitialized = false;
  }

  /**
   * Инициализация браузера
   */
  async initialize() {
    if (this.isInitialized) {
      this.logger.warn('Browser Controller уже инициализирован');
      return;
    }

    try {
      this.logger.info('Инициализация Browser Controller...');

      const launchOptions = {
        headless: this.options.headless,
        slowMo: this.options.slowMo,
        devtools: this.options.devtools,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-blink-features=AutomationControlled',
          '--disable-features=IsolateOrigins,site-per-process'
        ]
      };

      // Если указана директория для user data
      if (this.options.userDataDir) {
        this.browser = await chromium.launchPersistentContext(
          this.options.userDataDir,
          launchOptions
        );
        this.logger.info(`Браузер запущен с persistent context: ${this.options.userDataDir}`);
      } else {
        this.browser = await chromium.launch(launchOptions);
        this.logger.info('Браузер запущен');
      }

      this.isInitialized = true;
      this.logger.info('✓ Browser Controller инициализирован успешно');
    } catch (error) {
      this.logger.error('Ошибка инициализации Browser Controller:', error);
      throw error;
    }
  }

  /**
   * Создать новую браузерную сессию
   */
  async createSession(provider, options = {}) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const sessionId = uuidv4();
      this.logger.info(`Создание новой сессии ${sessionId} для провайдера ${provider}`);

      // Создаем новый контекст браузера
      const context = this.browser._type === 'Browser'
        ? await this.browser.newContext({
            viewport: { width: 1920, height: 1080 },
            userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            ...options.contextOptions
          })
        : this.browser; // Для persistent context используем сам browser

      // Создаем сессию
      const session = new BrowserSession(sessionId, context, provider, this.logger, options);
      await session.initialize();

      this.sessions.set(sessionId, session);

      this.logger.info(`✓ Сессия ${sessionId} создана успешно`);

      return {
        sessionId,
        session
      };
    } catch (error) {
      this.logger.error('Ошибка создания сессии:', error);
      throw error;
    }
  }

  /**
   * Получить сессию по ID
   */
  getSession(sessionId) {
    return this.sessions.get(sessionId);
  }

  /**
   * Закрыть сессию
   */
  async closeSession(sessionId) {
    const session = this.sessions.get(sessionId);

    if (!session) {
      this.logger.warn(`Сессия ${sessionId} не найдена`);
      return false;
    }

    try {
      this.logger.info(`Закрытие сессии ${sessionId}`);
      await session.close();
      this.sessions.delete(sessionId);
      this.logger.info(`✓ Сессия ${sessionId} закрыта`);
      return true;
    } catch (error) {
      this.logger.error(`Ошибка закрытия сессии ${sessionId}:`, error);
      return false;
    }
  }

  /**
   * Получить все активные сессии
   */
  getSessions() {
    return Array.from(this.sessions.entries()).map(([sessionId, session]) => ({
      sessionId,
      provider: session.provider,
      status: session.status,
      createdAt: session.createdAt,
      url: session.page ? session.page.url() : null
    }));
  }

  /**
   * Закрыть все сессии и браузер
   */
  async cleanup() {
    this.logger.info('Очистка Browser Controller...');

    // Закрываем все сессии
    const sessionIds = Array.from(this.sessions.keys());
    for (const sessionId of sessionIds) {
      await this.closeSession(sessionId);
    }

    // Закрываем браузер
    if (this.browser) {
      try {
        await this.browser.close();
        this.logger.info('✓ Браузер закрыт');
      } catch (error) {
        this.logger.error('Ошибка закрытия браузера:', error);
      }
    }

    this.isInitialized = false;
    this.browser = null;
    this.sessions.clear();

    this.logger.info('✓ Browser Controller очищен');
  }

  /**
   * Статистика
   */
  getStats() {
    return {
      initialized: this.isInitialized,
      activeSessions: this.sessions.size,
      sessions: this.getSessions()
    };
  }
}

module.exports = { BrowserController };
