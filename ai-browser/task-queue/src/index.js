/**
 * Task Queue Module - точка входа
 * Экспортирует все компоненты для управления задачами
 */

const { Task } = require('./task');
const { TaskQueue } = require('./task-queue');
const { TaskDistributor } = require('./task-distributor');

/**
 * Создать полноценную систему управления задачами
 */
function createTaskSystem(coordinator, logger) {
  // Создаем компоненты
  const taskQueue = new TaskQueue(logger);
  const taskDistributor = new TaskDistributor(taskQueue, coordinator, logger);

  logger.info('[TaskSystem] Система управления задачами создана');

  return {
    taskQueue,
    taskDistributor,
    Task
  };
}

module.exports = {
  Task,
  TaskQueue,
  TaskDistributor,
  createTaskSystem
};
