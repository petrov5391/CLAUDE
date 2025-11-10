/**
 * SessionStore - хранение сессий браузера в Redis
 * Управление cookies, состояниями и настройками сессий
 */

const { v4: uuidv4 } = require('uuid');

class SessionStore {
  constructor(redisManager, logger) {
    this.redis = redisManager;
    this.logger = logger;
    this.keyPrefix = 'session:';
    this.defaultTTL = 7 * 24 * 60 * 60; // 7 дней в секундах
  }

  /**
   * Создать новую сессию
   */
  async create(sessionData = {}) {
    const sessionId = sessionData.id || uuidv4();

    const session = {
      id: sessionId,
      provider: sessionData.provider || 'unknown',
      modelId: sessionData.modelId || null,
      createdAt: Date.now(),
      lastAccessedAt: Date.now(),
      cookies: sessionData.cookies || [],
      localStorage: sessionData.localStorage || {},
      sessionStorage: sessionData.sessionStorage || {},
      metadata: sessionData.metadata || {},
      active: true
    };

    const key = `${this.keyPrefix}${sessionId}`;
    await this.redis.set(key, session, this.defaultTTL);

    this.logger.info(`[SessionStore] Сессия создана: ${sessionId} (${session.provider})`);

    return sessionId;
  }

  /**
   * Получить сессию
   */
  async get(sessionId) {
    const key = `${this.keyPrefix}${sessionId}`;
    const session = await this.redis.get(key);

    if (session) {
      // Обновляем время последнего доступа
      session.lastAccessedAt = Date.now();
      await this.redis.set(key, session, this.defaultTTL);
    }

    return session;
  }

  /**
   * Обновить сессию
   */
  async update(sessionId, updates) {
    const session = await this.get(sessionId);

    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const updated = {
      ...session,
      ...updates,
      id: sessionId, // Не позволяем менять ID
      updatedAt: Date.now(),
      lastAccessedAt: Date.now()
    };

    const key = `${this.keyPrefix}${sessionId}`;
    await this.redis.set(key, updated, this.defaultTTL);

    this.logger.info(`[SessionStore] Сессия обновлена: ${sessionId}`);

    return updated;
  }

  /**
   * Удалить сессию
   */
  async delete(sessionId) {
    const key = `${this.keyPrefix}${sessionId}`;
    const result = await this.redis.del(key);

    this.logger.info(`[SessionStore] Сессия удалена: ${sessionId}`);

    return result > 0;
  }

  /**
   * Сохранить cookies
   */
  async saveCookies(sessionId, cookies) {
    return await this.update(sessionId, { cookies });
  }

  /**
   * Получить cookies
   */
  async getCookies(sessionId) {
    const session = await this.get(sessionId);
    return session ? session.cookies : null;
  }

  /**
   * Сохранить localStorage
   */
  async saveLocalStorage(sessionId, localStorage) {
    return await this.update(sessionId, { localStorage });
  }

  /**
   * Получить localStorage
   */
  async getLocalStorage(sessionId) {
    const session = await this.get(sessionId);
    return session ? session.localStorage : null;
  }

  /**
   * Сохранить sessionStorage
   */
  async saveSessionStorage(sessionId, sessionStorage) {
    return await this.update(sessionId, { sessionStorage });
  }

  /**
   * Получить sessionStorage
   */
  async getSessionStorage(sessionId) {
    const session = await this.get(sessionId);
    return session ? session.sessionStorage : null;
  }

  /**
   * Обновить метаданные
   */
  async updateMetadata(sessionId, metadata) {
    const session = await this.get(sessionId);

    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const updatedMetadata = {
      ...session.metadata,
      ...metadata
    };

    return await this.update(sessionId, { metadata: updatedMetadata });
  }

  /**
   * Пометить сессию как активную/неактивную
   */
  async setActive(sessionId, active) {
    return await this.update(sessionId, { active });
  }

  /**
   * Получить все сессии
   */
  async getAll() {
    const pattern = `${this.keyPrefix}*`;
    const keys = await this.redis.keys(pattern);

    const sessions = [];
    for (const key of keys) {
      // Убираем prefix
      const fullKey = key.startsWith(this.redis.config.keyPrefix)
        ? key.substring(this.redis.config.keyPrefix.length)
        : key;

      const session = await this.redis.get(fullKey);
      if (session) {
        sessions.push(session);
      }
    }

    return sessions;
  }

  /**
   * Получить сессии по провайдеру
   */
  async getByProvider(provider) {
    const all = await this.getAll();
    return all.filter(s => s.provider === provider);
  }

  /**
   * Получить активные сессии
   */
  async getActive() {
    const all = await this.getAll();
    return all.filter(s => s.active);
  }

  /**
   * Очистить неактивные сессии
   */
  async clearInactive() {
    const all = await this.getAll();
    const inactive = all.filter(s => !s.active);

    let cleared = 0;
    for (const session of inactive) {
      await this.delete(session.id);
      cleared++;
    }

    this.logger.info(`[SessionStore] Очищено ${cleared} неактивных сессий`);

    return cleared;
  }

  /**
   * Очистить старые сессии
   */
  async clearOld(maxAge = 30 * 24 * 60 * 60 * 1000) {
    const all = await this.getAll();
    const now = Date.now();
    const old = all.filter(s => (now - s.lastAccessedAt) > maxAge);

    let cleared = 0;
    for (const session of old) {
      await this.delete(session.id);
      cleared++;
    }

    this.logger.info(`[SessionStore] Очищено ${cleared} старых сессий (>${maxAge}мс)`);

    return cleared;
  }

  /**
   * Получить статистику
   */
  async getStats() {
    const all = await this.getAll();

    const stats = {
      total: all.length,
      active: all.filter(s => s.active).length,
      inactive: all.filter(s => !s.active).length,
      byProvider: {}
    };

    for (const session of all) {
      if (!stats.byProvider[session.provider]) {
        stats.byProvider[session.provider] = 0;
      }
      stats.byProvider[session.provider]++;
    }

    return stats;
  }

  /**
   * Очистить все сессии
   */
  async clearAll() {
    const all = await this.getAll();

    for (const session of all) {
      await this.delete(session.id);
    }

    this.logger.info(`[SessionStore] Очищены все сессии (${all.length})`);

    return all.length;
  }
}

module.exports = { SessionStore };
