/**
 * Менеджер AI моделей
 * Управляет подключением и взаимодействием с различными AI моделями
 */

const { v4: uuidv4 } = require('uuid');

class AIModelManager {
  constructor(logger) {
    this.logger = logger;
    this.models = new Map(); // modelId -> model config
    this.tabModels = new Map(); // tabId -> modelId
    this.sessions = new Map(); // sessionId -> session data

    // Инициализация доступных моделей
    this.initializeModels();
  }

  /**
   * Инициализация списка доступных моделей
   */
  initializeModels() {
    // OpenAI модели
    this.registerModel({
      id: 'gpt-4-turbo',
      name: 'GPT-4 Turbo',
      provider: 'openai',
      type: 'api',
      capabilities: ['text', 'vision', 'function-calling'],
      endpoint: 'https://api.openai.com/v1/chat/completions',
      requiresAuth: true,
      authType: 'api-key'
    });

    this.registerModel({
      id: 'gpt-3.5-turbo',
      name: 'GPT-3.5 Turbo',
      provider: 'openai',
      type: 'api',
      capabilities: ['text', 'function-calling'],
      endpoint: 'https://api.openai.com/v1/chat/completions',
      requiresAuth: true,
      authType: 'api-key'
    });

    // Anthropic модели
    this.registerModel({
      id: 'claude-3-opus',
      name: 'Claude 3 Opus',
      provider: 'anthropic',
      type: 'api',
      capabilities: ['text', 'vision', 'long-context'],
      endpoint: 'https://api.anthropic.com/v1/messages',
      requiresAuth: true,
      authType: 'api-key'
    });

    this.registerModel({
      id: 'claude-3-sonnet',
      name: 'Claude 3 Sonnet',
      provider: 'anthropic',
      type: 'api',
      capabilities: ['text', 'vision', 'long-context'],
      endpoint: 'https://api.anthropic.com/v1/messages',
      requiresAuth: true,
      authType: 'api-key'
    });

    // Web-based модели (через браузерную автоматизацию)
    this.registerModel({
      id: 'chatgpt-web',
      name: 'ChatGPT (Web)',
      provider: 'openai',
      type: 'web',
      capabilities: ['text', 'vision', 'browsing'],
      url: 'https://chat.openai.com',
      requiresAuth: true,
      authType: 'web-session'
    });

    this.registerModel({
      id: 'claude-web',
      name: 'Claude (Web)',
      provider: 'anthropic',
      type: 'web',
      capabilities: ['text', 'vision', 'artifacts'],
      url: 'https://claude.ai',
      requiresAuth: true,
      authType: 'web-session'
    });

    this.registerModel({
      id: 'deepseek-web',
      name: 'DeepSeek (Web)',
      provider: 'deepseek',
      type: 'web',
      capabilities: ['text', 'coding'],
      url: 'https://chat.deepseek.com',
      requiresAuth: true,
      authType: 'web-session'
    });

    // Локальные модели
    this.registerModel({
      id: 'ollama-local',
      name: 'Ollama (Local)',
      provider: 'ollama',
      type: 'local',
      capabilities: ['text', 'coding'],
      endpoint: 'http://localhost:11434/api/generate',
      requiresAuth: false
    });

    this.logger.info(`Зарегистрировано ${this.models.size} AI моделей`);
  }

  /**
   * Регистрация модели в системе
   */
  registerModel(modelConfig) {
    this.models.set(modelConfig.id, {
      ...modelConfig,
      status: 'available',
      registeredAt: Date.now()
    });

    this.logger.debug(`Модель зарегистрирована: ${modelConfig.name} (${modelConfig.id})`);
  }

  /**
   * Получить список доступных моделей
   */
  async listAvailableModels() {
    const modelsList = [];

    for (const [id, model] of this.models) {
      modelsList.push({
        id: model.id,
        name: model.name,
        provider: model.provider,
        type: model.type,
        capabilities: model.capabilities,
        requiresAuth: model.requiresAuth,
        authType: model.authType,
        status: model.status
      });
    }

    return modelsList;
  }

  /**
   * Привязать модель к вкладке
   */
  async assignModelToTab(tabId, modelId, config = {}) {
    try {
      const model = this.models.get(modelId);

      if (!model) {
        throw new Error(`Модель ${modelId} не найдена`);
      }

      this.logger.info(`Привязка модели ${modelId} к вкладке ${tabId}`);

      // Проверяем требования авторизации
      if (model.requiresAuth && !config.authData) {
        this.logger.warn(`Модель ${modelId} требует авторизацию, но данные не предоставлены`);
      }

      // Сохраняем привязку
      this.tabModels.set(tabId, {
        modelId,
        config,
        assignedAt: Date.now()
      });

      // Для web-based моделей может потребоваться инициализация сессии
      if (model.type === 'web') {
        await this.initializeWebSession(tabId, model, config);
      }

      return {
        success: true,
        model: {
          id: model.id,
          name: model.name,
          type: model.type
        }
      };
    } catch (error) {
      this.logger.error(`Ошибка привязки модели к вкладке:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Инициализация web-сессии для браузерных моделей
   */
  async initializeWebSession(tabId, model, config) {
    this.logger.info(`Инициализация web-сессии для ${model.name} в вкладке ${tabId}`);

    const sessionId = uuidv4();

    this.sessions.set(sessionId, {
      id: sessionId,
      tabId,
      modelId: model.id,
      url: model.url,
      status: 'initializing',
      createdAt: Date.now()
    });

    // TODO: Здесь будет логика авторизации через Playwright
    // Пока просто помечаем сессию как готовую
    const session = this.sessions.get(sessionId);
    session.status = 'ready';

    return sessionId;
  }

  /**
   * Отправить промпт модели
   */
  async sendPrompt(tabId, prompt, context = {}) {
    try {
      const assignment = this.tabModels.get(tabId);

      if (!assignment) {
        throw new Error(`Для вкладки ${tabId} не назначена модель`);
      }

      const model = this.models.get(assignment.modelId);

      this.logger.info(`Отправка промпта модели ${model.name} для вкладки ${tabId}`);
      this.logger.debug('Промпт:', prompt);

      // В зависимости от типа модели используем разные методы
      let response;

      if (model.type === 'api') {
        response = await this.sendAPIPrompt(model, prompt, assignment.config, context);
      } else if (model.type === 'web') {
        response = await this.sendWebPrompt(tabId, model, prompt, context);
      } else if (model.type === 'local') {
        response = await this.sendLocalPrompt(model, prompt, context);
      }

      return {
        success: true,
        response,
        modelId: model.id
      };
    } catch (error) {
      this.logger.error(`Ошибка отправки промпта:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Отправка промпта через API
   */
  async sendAPIPrompt(model, prompt, config, context) {
    this.logger.info(`Отправка API запроса к ${model.name}`);

    // TODO: Реализовать реальные API вызовы
    // Пока возвращаем заглушку
    return {
      type: 'api',
      content: `[API Response from ${model.name}]`,
      metadata: {
        model: model.id,
        timestamp: Date.now()
      }
    };
  }

  /**
   * Отправка промпта через web-интерфейс
   */
  async sendWebPrompt(tabId, model, prompt, context) {
    this.logger.info(`Отправка web-промпта к ${model.name}`);

    // TODO: Реализовать управление через Playwright
    // Пока возвращаем заглушку
    return {
      type: 'web',
      content: `[Web Response from ${model.name}]`,
      metadata: {
        model: model.id,
        tabId,
        timestamp: Date.now()
      }
    };
  }

  /**
   * Отправка промпта локальной модели
   */
  async sendLocalPrompt(model, prompt, context) {
    this.logger.info(`Отправка запроса к локальной модели ${model.name}`);

    // TODO: Реализовать интеграцию с Ollama/LM Studio
    // Пока возвращаем заглушку
    return {
      type: 'local',
      content: `[Local Response from ${model.name}]`,
      metadata: {
        model: model.id,
        timestamp: Date.now()
      }
    };
  }

  /**
   * Очистка ресурсов
   */
  cleanup() {
    this.logger.info('Очистка AIModelManager: закрытие всех сессий');

    this.sessions.clear();
    this.tabModels.clear();
  }
}

module.exports = { AIModelManager };
