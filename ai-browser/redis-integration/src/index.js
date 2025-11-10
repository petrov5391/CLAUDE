/**
 * Redis Integration Module - точка входа
 * Экспортирует все компоненты для работы с Redis
 */

const { RedisManager } = require('./redis-manager');
const { SessionStore } = require('./session-store');
const { TaskPersistence } = require('./task-persistence');
const { CacheManager } = require('./cache-manager');

/**
 * Создать полную систему Redis интеграции
 */
function createRedisSystem(logger, options = {}) {
  // Создаем Redis Manager
  const redisManager = new RedisManager(logger, options.redis || {});

  // Создаем компоненты
  const sessionStore = new SessionStore(redisManager, logger);
  const taskPersistence = new TaskPersistence(redisManager, logger);
  const cacheManager = new CacheManager(redisManager, logger, options.cache || {});

  logger.info('[RedisSystem] Redis integration system created');

  return {
    redisManager,
    sessionStore,
    taskPersistence,
    cacheManager
  };
}

module.exports = {
  RedisManager,
  SessionStore,
  TaskPersistence,
  CacheManager,
  createRedisSystem
};
