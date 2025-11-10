/**
 * TaskPersistence - персистентность TaskQueue в Redis
 * Сохранение и восстановление состояния очереди задач
 */

class TaskPersistence {
  constructor(redisManager, logger) {
    this.redis = redisManager;
    this.logger = logger;
    this.queueKey = 'taskqueue:state';
    this.tasksKey = 'taskqueue:tasks';
    this.autoSaveInterval = null;
  }

  /**
   * Сохранить состояние очереди
   */
  async saveQueue(taskQueue) {
    const state = taskQueue.export();

    // Сохраняем общее состояние
    await this.redis.set(this.queueKey, {
      maxQueueSize: state.maxQueueSize,
      savedAt: Date.now()
    });

    // Сохраняем задачи в hash
    await this.redis.execute('del', this.tasksKey);

    for (const task of state.tasks) {
      await this.redis.hset(this.tasksKey, task.id, task);
    }

    this.logger.info(`[TaskPersistence] Queue saved: ${state.tasks.length} tasks`);

    return state.tasks.length;
  }

  /**
   * Восстановить состояние очереди
   */
  async loadQueue(taskQueue) {
    // Загружаем общее состояние
    const state = await this.redis.get(this.queueKey);

    if (!state) {
      this.logger.info('[TaskPersistence] No saved queue state found');
      return 0;
    }

    // Загружаем задачи
    const tasksData = await this.redis.hgetall(this.tasksKey);

    if (!tasksData) {
      this.logger.info('[TaskPersistence] No saved tasks found');
      return 0;
    }

    const tasks = Object.values(tasksData);

    // Импортируем в очередь
    taskQueue.import({
      tasks,
      maxQueueSize: state.maxQueueSize
    });

    this.logger.info(`[TaskPersistence] Queue loaded: ${tasks.length} tasks`);

    return tasks.length;
  }

  /**
   * Сохранить одну задачу
   */
  async saveTask(task) {
    await this.redis.hset(this.tasksKey, task.id, task.toJSON());
    this.logger.debug(`[TaskPersistence] Task saved: ${task.id}`);
  }

  /**
   * Обновить задачу
   */
  async updateTask(taskId, taskData) {
    await this.redis.hset(this.tasksKey, taskId, taskData);
    this.logger.debug(`[TaskPersistence] Task updated: ${taskId}`);
  }

  /**
   * Удалить задачу
   */
  async deleteTask(taskId) {
    await this.redis.hdel(this.tasksKey, taskId);
    this.logger.debug(`[TaskPersistence] Task deleted: ${taskId}`);
  }

  /**
   * Получить задачу
   */
  async getTask(taskId) {
    return await this.redis.hget(this.tasksKey, taskId);
  }

  /**
   * Получить все задачи
   */
  async getAllTasks() {
    const tasksData = await this.redis.hgetall(this.tasksKey);

    if (!tasksData) {
      return [];
    }

    return Object.values(tasksData);
  }

  /**
   * Получить задачи по статусу
   */
  async getTasksByStatus(status) {
    const all = await this.getAllTasks();
    return all.filter(task => task.status === status);
  }

  /**
   * Очистить завершенные задачи
   */
  async clearCompleted() {
    const completed = await this.getTasksByStatus('completed');

    for (const task of completed) {
      await this.deleteTask(task.id);
    }

    this.logger.info(`[TaskPersistence] Cleared ${completed.length} completed tasks`);

    return completed.length;
  }

  /**
   * Очистить проваленные задачи
   */
  async clearFailed() {
    const failed = await this.getTasksByStatus('failed');
    const cancelled = await this.getTasksByStatus('cancelled');
    const toRemove = [...failed, ...cancelled];

    for (const task of toRemove) {
      await this.deleteTask(task.id);
    }

    this.logger.info(`[TaskPersistence] Cleared ${toRemove.length} failed/cancelled tasks`);

    return toRemove.length;
  }

  /**
   * Автоматическое сохранение
   */
  startAutoSave(taskQueue, interval = 60000) {
    if (this.autoSaveInterval) {
      this.stopAutoSave();
    }

    this.autoSaveInterval = setInterval(async () => {
      try {
        await this.saveQueue(taskQueue);
        this.logger.debug('[TaskPersistence] Auto-save completed');
      } catch (error) {
        this.logger.error('[TaskPersistence] Auto-save failed:', error);
      }
    }, interval);

    this.logger.info(`[TaskPersistence] Auto-save started (interval: ${interval}ms)`);
  }

  /**
   * Остановить автоматическое сохранение
   */
  stopAutoSave() {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
      this.autoSaveInterval = null;
      this.logger.info('[TaskPersistence] Auto-save stopped');
    }
  }

  /**
   * Получить статистику
   */
  async getStats() {
    const all = await this.getAllTasks();

    const stats = {
      total: all.length,
      pending: 0,
      waiting: 0,
      assigned: 0,
      inProgress: 0,
      completed: 0,
      failed: 0,
      cancelled: 0
    };

    for (const task of all) {
      if (stats[task.status] !== undefined) {
        stats[task.status]++;
      }
    }

    const state = await this.redis.get(this.queueKey);
    if (state) {
      stats.lastSaved = state.savedAt;
    }

    return stats;
  }

  /**
   * Очистить все данные
   */
  async clear() {
    await this.redis.del(this.queueKey);
    await this.redis.execute('del', this.tasksKey);

    this.logger.info('[TaskPersistence] All task data cleared');
  }
}

module.exports = { TaskPersistence };
