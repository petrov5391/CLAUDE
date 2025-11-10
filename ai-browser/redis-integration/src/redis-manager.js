/**
 * RedisManager - управление подключением к Redis
 * Централизованное управление Redis соединением с переподключением
 */

const EventEmitter = require('eventemitter3');

class RedisManager extends EventEmitter {
  constructor(logger, options = {}) {
    super();
    this.logger = logger;

    // Конфигурация
    this.config = {
      host: options.host || process.env.REDIS_HOST || 'localhost',
      port: options.port || parseInt(process.env.REDIS_PORT) || 6379,
      password: options.password || process.env.REDIS_PASSWORD,
      db: options.db !== undefined ? options.db : 0,
      keyPrefix: options.keyPrefix || 'ai-browser:',
      retryStrategy: options.retryStrategy || this.defaultRetryStrategy.bind(this),
      enableOfflineQueue: options.enableOfflineQueue !== false,
      maxRetriesPerRequest: options.maxRetriesPerRequest || 3,
      connectTimeout: options.connectTimeout || 10000,
      lazyConnect: options.lazyConnect || false
    };

    // Redis client (будет инициализирован при подключении)
    this.client = null;
    this.subscriber = null; // Для pub/sub
    this.isConnected = false;
    this.isConnecting = false;

    // Статистика
    this.stats = {
      commands: 0,
      errors: 0,
      reconnects: 0,
      uptime: 0,
      startTime: null
    };

    // Не подключаемся сразу, если lazyConnect
    if (!this.config.lazyConnect) {
      this.connect();
    }
  }

  /**
   * Стратегия переподключения по умолчанию
   */
  defaultRetryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    this.logger.warn(`[RedisManager] Переподключение... попытка ${times}, задержка: ${delay}ms`);
    return delay;
  }

  /**
   * Подключиться к Redis
   */
  async connect() {
    if (this.isConnected || this.isConnecting) {
      return;
    }

    this.isConnecting = true;
    this.logger.info(`[RedisManager] Подключение к Redis на ${this.config.host}:${this.config.port}`);

    try {
      // Динамический импорт ioredis
      let Redis;
      try {
        Redis = require('ioredis');
      } catch (error) {
        throw new Error('ioredis is not installed. Run: npm install ioredis');
      }

      // Создаем клиент
      this.client = new Redis({
        host: this.config.host,
        port: this.config.port,
        password: this.config.password,
        db: this.config.db,
        keyPrefix: this.config.keyPrefix,
        retryStrategy: this.config.retryStrategy,
        enableOfflineQueue: this.config.enableOfflineQueue,
        maxRetriesPerRequest: this.config.maxRetriesPerRequest,
        connectTimeout: this.config.connectTimeout,
        lazyConnect: true
      });

      // Подключаемся
      await this.client.connect();

      // События
      this.client.on('error', (error) => {
        this.stats.errors++;
        this.logger.error('[RedisManager] Ошибка Redis:', error);
        this.emit('error', error);
      });

      this.client.on('connect', () => {
        this.isConnected = true;
        this.isConnecting = false;
        this.stats.startTime = Date.now();
        this.logger.info('[RedisManager] Подключено к Redis');
        this.emit('connect');
      });

      this.client.on('ready', () => {
        this.logger.info('[RedisManager] Redis готов');
        this.emit('ready');
      });

      this.client.on('reconnecting', () => {
        this.stats.reconnects++;
        this.logger.warn('[RedisManager] Переподключение к Redis');
        this.emit('reconnecting');
      });

      this.client.on('end', () => {
        this.isConnected = false;
        this.logger.info('[RedisManager] Соединение с Redis закрыто');
        this.emit('end');
      });

      this.isConnected = true;
      this.isConnecting = false;
      this.stats.startTime = Date.now();

      this.logger.info('[RedisManager] Redis успешно подключен');

    } catch (error) {
      this.isConnecting = false;
      this.logger.error('[RedisManager] Ошибка подключения к Redis:', error);
      throw error;
    }
  }

  /**
   * Создать subscriber для pub/sub
   */
  async createSubscriber() {
    if (this.subscriber) {
      return this.subscriber;
    }

    const Redis = require('ioredis');

    this.subscriber = new Redis({
      host: this.config.host,
      port: this.config.port,
      password: this.config.password,
      db: this.config.db,
      retryStrategy: this.config.retryStrategy
    });

    this.logger.info('[RedisManager] Подписчик создан');

    return this.subscriber;
  }

  /**
   * Получить клиент Redis
   */
  getClient() {
    if (!this.client) {
      throw new Error('Redis client is not initialized. Call connect() first.');
    }
    return this.client;
  }

  /**
   * Выполнить команду с отслеживанием статистики
   */
  async execute(command, ...args) {
    const client = this.getClient();
    this.stats.commands++;

    try {
      const result = await client[command](...args);
      return result;
    } catch (error) {
      this.stats.errors++;
      this.logger.error(`[RedisManager] Команда ${command} не выполнена:`, error);
      throw error;
    }
  }

  /**
   * SET с TTL
   */
  async set(key, value, ttl = null) {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);

    if (ttl) {
      return await this.execute('setex', key, ttl, serialized);
    } else {
      return await this.execute('set', key, serialized);
    }
  }

  /**
   * GET с автоматическим парсингом JSON
   */
  async get(key) {
    const value = await this.execute('get', key);

    if (!value) {
      return null;
    }

    try {
      return JSON.parse(value);
    } catch (error) {
      return value; // Возвращаем как есть, если не JSON
    }
  }

  /**
   * DELETE
   */
  async del(key) {
    return await this.execute('del', key);
  }

  /**
   * EXISTS
   */
  async exists(key) {
    return await this.execute('exists', key);
  }

  /**
   * EXPIRE
   */
  async expire(key, seconds) {
    return await this.execute('expire', key, seconds);
  }

  /**
   * TTL
   */
  async ttl(key) {
    return await this.execute('ttl', key);
  }

  /**
   * KEYS (паттерн)
   */
  async keys(pattern = '*') {
    const fullPattern = pattern.startsWith(this.config.keyPrefix)
      ? pattern
      : pattern;

    const keys = await this.execute('keys', fullPattern);

    // Убираем prefix из результатов
    return keys.map(key => key.replace(this.config.keyPrefix, ''));
  }

  /**
   * HSET
   */
  async hset(key, field, value) {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    return await this.execute('hset', key, field, serialized);
  }

  /**
   * HGET
   */
  async hget(key, field) {
    const value = await this.execute('hget', key, field);

    if (!value) {
      return null;
    }

    try {
      return JSON.parse(value);
    } catch (error) {
      return value;
    }
  }

  /**
   * HGETALL
   */
  async hgetall(key) {
    const values = await this.execute('hgetall', key);

    if (!values) {
      return null;
    }

    // Парсим JSON значения
    const parsed = {};
    for (const [field, value] of Object.entries(values)) {
      try {
        parsed[field] = JSON.parse(value);
      } catch (error) {
        parsed[field] = value;
      }
    }

    return parsed;
  }

  /**
   * HDEL
   */
  async hdel(key, ...fields) {
    return await this.execute('hdel', key, ...fields);
  }

  /**
   * LPUSH
   */
  async lpush(key, ...values) {
    const serialized = values.map(v =>
      typeof v === 'string' ? v : JSON.stringify(v)
    );
    return await this.execute('lpush', key, ...serialized);
  }

  /**
   * RPUSH
   */
  async rpush(key, ...values) {
    const serialized = values.map(v =>
      typeof v === 'string' ? v : JSON.stringify(v)
    );
    return await this.execute('rpush', key, ...serialized);
  }

  /**
   * LPOP
   */
  async lpop(key) {
    const value = await this.execute('lpop', key);

    if (!value) {
      return null;
    }

    try {
      return JSON.parse(value);
    } catch (error) {
      return value;
    }
  }

  /**
   * RPOP
   */
  async rpop(key) {
    const value = await this.execute('rpop', key);

    if (!value) {
      return null;
    }

    try {
      return JSON.parse(value);
    } catch (error) {
      return value;
    }
  }

  /**
   * LRANGE
   */
  async lrange(key, start, stop) {
    const values = await this.execute('lrange', key, start, stop);

    return values.map(v => {
      try {
        return JSON.parse(v);
      } catch (error) {
        return v;
      }
    });
  }

  /**
   * LLEN
   */
  async llen(key) {
    return await this.execute('llen', key);
  }

  /**
   * PUBLISH
   */
  async publish(channel, message) {
    const serialized = typeof message === 'string' ? message : JSON.stringify(message);
    return await this.execute('publish', channel, serialized);
  }

  /**
   * SUBSCRIBE
   */
  async subscribe(channel, callback) {
    if (!this.subscriber) {
      await this.createSubscriber();
    }

    await this.subscriber.subscribe(channel);

    this.subscriber.on('message', (ch, message) => {
      if (ch === channel) {
        try {
          const parsed = JSON.parse(message);
          callback(parsed);
        } catch (error) {
          callback(message);
        }
      }
    });

    this.logger.info(`[RedisManager] Подписка на канал: ${channel}`);
  }

  /**
   * UNSUBSCRIBE
   */
  async unsubscribe(channel) {
    if (this.subscriber) {
      await this.subscriber.unsubscribe(channel);
      this.logger.info(`[RedisManager] Отписка от канала: ${channel}`);
    }
  }

  /**
   * FLUSHDB (очистить текущую БД)
   */
  async flushdb() {
    this.logger.warn('[RedisManager] Очистка базы данных');
    return await this.execute('flushdb');
  }

  /**
   * INFO
   */
  async info(section = null) {
    if (section) {
      return await this.execute('info', section);
    }
    return await this.execute('info');
  }

  /**
   * PING
   */
  async ping() {
    return await this.execute('ping');
  }

  /**
   * Получить статистику
   */
  getStats() {
    const uptime = this.stats.startTime
      ? Date.now() - this.stats.startTime
      : 0;

    return {
      ...this.stats,
      uptime,
      isConnected: this.isConnected,
      config: {
        host: this.config.host,
        port: this.config.port,
        db: this.config.db,
        keyPrefix: this.config.keyPrefix
      }
    };
  }

  /**
   * Закрыть соединение
   */
  async disconnect() {
    if (this.client) {
      await this.client.quit();
      this.logger.info('[RedisManager] Отключено от Redis');
    }

    if (this.subscriber) {
      await this.subscriber.quit();
      this.logger.info('[RedisManager] Подписчик отключен');
    }

    this.isConnected = false;
    this.client = null;
    this.subscriber = null;
  }

  /**
   * Уничтожить менеджер
   */
  async destroy() {
    await this.disconnect();
    this.removeAllListeners();
  }
}

module.exports = { RedisManager };
