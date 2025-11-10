/**
 * CacheManager - кэширование ответов AI моделей
 * Управление кэшем с TTL и очисткой
 */

const crypto = require('crypto');

class CacheManager {
  constructor(redisManager, logger, options = {}) {
    this.redis = redisManager;
    this.logger = logger;

    // Настройки
    this.defaultTTL = options.defaultTTL || 3600; // 1 час
    this.keyPrefix = 'cache:';
    this.enableCompression = options.enableCompression !== false;
    this.maxCacheSize = options.maxCacheSize || 10000; // Максимум записей

    // Статистика
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0
    };
  }

  /**
   * Генерация ключа кэша из промпта
   */
  generateKey(model, prompt, options = {}) {
    const data = JSON.stringify({
      model,
      prompt,
      temperature: options.temperature,
      maxTokens: options.maxTokens
    });

    const hash = crypto.createHash('sha256').update(data).digest('hex');
    return `${this.keyPrefix}${model}:${hash}`;
  }

  /**
   * Получить из кэша
   */
  async get(model, prompt, options = {}) {
    const key = this.generateKey(model, prompt, options);

    const cached = await this.redis.get(key);

    if (cached) {
      this.stats.hits++;
      this.logger.debug(`[CacheManager] Кэш ПОПАДАНИЕ: ${key.substring(0, 50)}...`);

      return {
        ...cached,
        cached: true,
        cachedAt: cached.timestamp
      };
    }

    this.stats.misses++;
    this.logger.debug(`[CacheManager] Кэш ПРОМАХ: ${key.substring(0, 50)}...`);

    return null;
  }

  /**
   * Сохранить в кэш
   */
  async set(model, prompt, response, options = {}) {
    const key = this.generateKey(model, prompt, options);
    const ttl = options.ttl || this.defaultTTL;

    const cacheEntry = {
      model,
      prompt,
      response,
      timestamp: Date.now(),
      options: {
        temperature: options.temperature,
        maxTokens: options.maxTokens
      }
    };

    // Проверяем размер кэша
    await this.checkCacheSize();

    await this.redis.set(key, cacheEntry, ttl);

    this.stats.sets++;
    this.logger.debug(`[CacheManager] Ответ закэширован для ${model} (TTL: ${ttl}с)`);

    return true;
  }

  /**
   * Удалить из кэша
   */
  async delete(model, prompt, options = {}) {
    const key = this.generateKey(model, prompt, options);
    const result = await this.redis.del(key);

    if (result) {
      this.stats.deletes++;
      this.logger.debug(`[CacheManager] Запись кэша удалена: ${key}`);
    }

    return result > 0;
  }

  /**
   * Проверить наличие в кэше
   */
  async has(model, prompt, options = {}) {
    const key = this.generateKey(model, prompt, options);
    return await this.redis.exists(key);
  }

  /**
   * Получить все ключи кэша
   */
  async getAllKeys() {
    const pattern = `${this.keyPrefix}*`;
    return await this.redis.keys(pattern);
  }

  /**
   * Получить размер кэша
   */
  async getCacheSize() {
    const keys = await this.getAllKeys();
    return keys.length;
  }

  /**
   * Проверить и очистить кэш при превышении размера
   */
  async checkCacheSize() {
    const size = await this.getCacheSize();

    if (size >= this.maxCacheSize) {
      this.logger.warn(`[CacheManager] Достигнут лимит размера кэша (${size}/${this.maxCacheSize})`);

      // Удаляем 10% старейших записей
      const toRemove = Math.floor(this.maxCacheSize * 0.1);
      await this.evictOldest(toRemove);
    }
  }

  /**
   * Удалить N старейших записей
   */
  async evictOldest(count) {
    // Получаем все ключи
    const keys = await this.getAllKeys();

    if (keys.length === 0) {
      return 0;
    }

    // Получаем TTL для каждого ключа
    const keysWithTTL = [];
    for (const key of keys) {
      const fullKey = key.startsWith(this.redis.config.keyPrefix)
        ? key
        : this.redis.config.keyPrefix + key;

      const ttl = await this.redis.ttl(fullKey);
      keysWithTTL.push({ key: fullKey, ttl });
    }

    // Сортируем по TTL (меньше TTL = старее)
    keysWithTTL.sort((a, b) => a.ttl - b.ttl);

    // Удаляем count старейших
    let removed = 0;
    for (let i = 0; i < Math.min(count, keysWithTTL.length); i++) {
      await this.redis.del(keysWithTTL[i].key);
      removed++;
    }

    this.logger.info(`[CacheManager] Удалено ${removed} старейших записей кэша`);

    return removed;
  }

  /**
   * Очистить весь кэш
   */
  async clear() {
    const keys = await this.getAllKeys();

    for (const key of keys) {
      const fullKey = key.startsWith(this.redis.config.keyPrefix)
        ? key
        : this.redis.config.keyPrefix + key;

      await this.redis.del(fullKey);
    }

    this.logger.info(`[CacheManager] Кэш очищен (${keys.length} записей)`);

    return keys.length;
  }

  /**
   * Очистить кэш для конкретной модели
   */
  async clearModel(model) {
    const pattern = `${this.keyPrefix}${model}:*`;
    const keys = await this.redis.keys(pattern);

    for (const key of keys) {
      const fullKey = key.startsWith(this.redis.config.keyPrefix)
        ? key
        : this.redis.config.keyPrefix + key;

      await this.redis.del(fullKey);
    }

    this.logger.info(`[CacheManager] Очищен кэш для модели: ${model} (${keys.length} записей)`);

    return keys.length;
  }

  /**
   * Получить статистику кэша
   */
  async getStats() {
    const size = await this.getCacheSize();
    const hitRate = this.stats.hits + this.stats.misses > 0
      ? (this.stats.hits / (this.stats.hits + this.stats.misses) * 100).toFixed(2) + '%'
      : '0%';

    return {
      ...this.stats,
      size,
      hitRate,
      maxSize: this.maxCacheSize,
      utilizationRate: ((size / this.maxCacheSize) * 100).toFixed(2) + '%'
    };
  }

  /**
   * Получить статистику по моделям
   */
  async getModelStats() {
    const keys = await this.getAllKeys();
    const stats = {};

    for (const key of keys) {
      // Извлекаем имя модели из ключа
      const parts = key.replace(this.keyPrefix, '').split(':');
      const model = parts[0];

      if (!stats[model]) {
        stats[model] = 0;
      }
      stats[model]++;
    }

    return stats;
  }

  /**
   * Прогрев кэша
   */
  async warmup(queries) {
    let warmed = 0;

    for (const query of queries) {
      const { model, prompt, response, options } = query;

      await this.set(model, prompt, response, options);
      warmed++;
    }

    this.logger.info(`[CacheManager] Кэш прогрет ${warmed} записями`);

    return warmed;
  }

  /**
   * Сброс статистики
   */
  resetStats() {
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0
    };

    this.logger.info('[CacheManager] Статистика сброшена');
  }
}

module.exports = { CacheManager };
