/**
 * Browser Session - управление одной браузерной сессией
 * Инкапсулирует работу с одной страницей/вкладкой через Playwright
 */

class BrowserSession {
  constructor(sessionId, context, provider, logger, options = {}) {
    this.sessionId = sessionId;
    this.context = context;
    this.provider = provider;
    this.logger = logger;
    this.options = options;

    this.page = null;
    this.status = 'initializing';
    this.createdAt = Date.now();
    this.providerInstance = null;
  }

  /**
   * Инициализация сессии
   */
  async initialize() {
    try {
      this.logger.info(`[${this.sessionId}] Инициализация сессии для ${this.provider}`);

      // Создаем новую страницу
      this.page = this.context._type === 'BrowserContext'
        ? await this.context.newPage()
        : await this.context.pages()[0] || await this.context.newPage();

      // Настраиваем обработчики событий
      this.setupEventHandlers();

      // Загружаем провайдер
      await this.loadProvider();

      this.status = 'ready';
      this.logger.info(`[${this.sessionId}] ✓ Сессия инициализирована`);
    } catch (error) {
      this.status = 'error';
      this.logger.error(`[${this.sessionId}] Ошибка инициализации:`, error);
      throw error;
    }
  }

  /**
   * Загрузка провайдера для конкретного сервиса
   */
  async loadProvider() {
    try {
      const providerMap = {
        'chatgpt': './providers/chatgpt-provider',
        'claude': './providers/claude-provider',
        'deepseek': './providers/deepseek-provider'
      };

      const providerPath = providerMap[this.provider.toLowerCase()];

      if (!providerPath) {
        throw new Error(`Неизвестный провайдер: ${this.provider}`);
      }

      const ProviderClass = require(providerPath);
      this.providerInstance = new ProviderClass.default || new ProviderClass[Object.keys(ProviderClass)[0]](
        this.page,
        this.logger,
        this.options
      );

      await this.providerInstance.initialize();

      this.logger.info(`[${this.sessionId}] ✓ Провайдер ${this.provider} загружен`);
    } catch (error) {
      this.logger.error(`[${this.sessionId}] Ошибка загрузки провайдера:`, error);
      throw error;
    }
  }

  /**
   * Настройка обработчиков событий страницы
   */
  setupEventHandlers() {
    // Логирование консоли
    this.page.on('console', msg => {
      const type = msg.type();
      if (type === 'error' || type === 'warning') {
        this.logger.debug(`[${this.sessionId}] [Console ${type}] ${msg.text()}`);
      }
    });

    // Ошибки страницы
    this.page.on('pageerror', error => {
      this.logger.error(`[${this.sessionId}] [Page Error]`, error);
    });

    // Запросы (для отладки)
    this.page.on('request', request => {
      const url = request.url();
      if (url.includes('/api/') || url.includes('/v1/')) {
        this.logger.debug(`[${this.sessionId}] [Request] ${request.method()} ${url}`);
      }
    });

    // Ответы
    this.page.on('response', response => {
      const url = response.url();
      const status = response.status();
      if ((url.includes('/api/') || url.includes('/v1/')) && status >= 400) {
        this.logger.warn(`[${this.sessionId}] [Response Error] ${status} ${url}`);
      }
    });
  }

  /**
   * Отправить промпт через провайдер
   */
  async sendPrompt(prompt, options = {}) {
    if (!this.providerInstance) {
      throw new Error('Провайдер не инициализирован');
    }

    try {
      this.logger.info(`[${this.sessionId}] Отправка промпта через ${this.provider}`);
      this.status = 'processing';

      const response = await this.providerInstance.sendPrompt(prompt, options);

      this.status = 'ready';
      this.logger.info(`[${this.sessionId}] ✓ Получен ответ от ${this.provider}`);

      return response;
    } catch (error) {
      this.status = 'error';
      this.logger.error(`[${this.sessionId}] Ошибка отправки промпта:`, error);
      throw error;
    }
  }

  /**
   * Навигация по URL
   */
  async navigate(url, options = {}) {
    try {
      this.logger.info(`[${this.sessionId}] Навигация -> ${url}`);
      await this.page.goto(url, {
        waitUntil: options.waitUntil || 'networkidle',
        timeout: options.timeout || 30000
      });
      this.logger.info(`[${this.sessionId}] ✓ Навигация завершена`);
    } catch (error) {
      this.logger.error(`[${this.sessionId}] Ошибка навигации:`, error);
      throw error;
    }
  }

  /**
   * Выполнить JavaScript на странице
   */
  async evaluate(script) {
    try {
      return await this.page.evaluate(script);
    } catch (error) {
      this.logger.error(`[${this.sessionId}] Ошибка выполнения скрипта:`, error);
      throw error;
    }
  }

  /**
   * Сделать скриншот
   */
  async screenshot(options = {}) {
    try {
      return await this.page.screenshot({
        type: options.type || 'png',
        fullPage: options.fullPage || false,
        path: options.path
      });
    } catch (error) {
      this.logger.error(`[${this.sessionId}] Ошибка создания скриншота:`, error);
      throw error;
    }
  }

  /**
   * Получить cookies
   */
  async getCookies() {
    try {
      return await this.context.cookies();
    } catch (error) {
      this.logger.error(`[${this.sessionId}] Ошибка получения cookies:`, error);
      throw error;
    }
  }

  /**
   * Установить cookies
   */
  async setCookies(cookies) {
    try {
      await this.context.addCookies(cookies);
      this.logger.info(`[${this.sessionId}] ✓ Cookies установлены (${cookies.length} шт.)`);
    } catch (error) {
      this.logger.error(`[${this.sessionId}] Ошибка установки cookies:`, error);
      throw error;
    }
  }

  /**
   * Сохранить состояние сессии (cookies, storage)
   */
  async saveState(path) {
    try {
      await this.context.storageState({ path });
      this.logger.info(`[${this.sessionId}] ✓ Состояние сессии сохранено: ${path}`);
    } catch (error) {
      this.logger.error(`[${this.sessionId}] Ошибка сохранения состояния:`, error);
      throw error;
    }
  }

  /**
   * Загрузить состояние сессии
   */
  async loadState(path) {
    try {
      // Для загрузки состояния нужно создать новый контекст
      this.logger.info(`[${this.sessionId}] Загрузка состояния из ${path}`);
      // TODO: Реализовать загрузку через пересоздание контекста
    } catch (error) {
      this.logger.error(`[${this.sessionId}] Ошибка загрузки состояния:`, error);
      throw error;
    }
  }

  /**
   * Получить информацию о сессии
   */
  getInfo() {
    return {
      sessionId: this.sessionId,
      provider: this.provider,
      status: this.status,
      createdAt: this.createdAt,
      url: this.page ? this.page.url() : null,
      title: this.page ? this.page.title() : null
    };
  }

  /**
   * Закрыть сессию
   */
  async close() {
    try {
      this.logger.info(`[${this.sessionId}] Закрытие сессии`);

      if (this.page) {
        await this.page.close();
      }

      if (this.context && this.context._type === 'BrowserContext') {
        await this.context.close();
      }

      this.status = 'closed';
      this.logger.info(`[${this.sessionId}] ✓ Сессия закрыта`);
    } catch (error) {
      this.logger.error(`[${this.sessionId}] Ошибка закрытия:`, error);
      throw error;
    }
  }
}

module.exports = { BrowserSession };
