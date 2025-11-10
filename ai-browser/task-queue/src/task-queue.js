/**
 * TaskQueue - очередь задач с поддержкой приоритетов и зависимостей
 * Управляет задачами, обеспечивает правильный порядок выполнения
 */

const EventEmitter = require('eventemitter3');
const { Task } = require('./task');

class TaskQueue extends EventEmitter {
  constructor(logger) {
    super();
    this.logger = logger;
    this.tasks = new Map(); // taskId -> Task
    this.maxQueueSize = 10000;

    // Мониторинг тайм-аутов
    this.timeoutCheckInterval = 5000; // 5 секунд
    this.startTimeoutMonitoring();
  }

  /**
   * Добавить задачу в очередь
   */
  add(taskOptions) {
    if (this.tasks.size >= this.maxQueueSize) {
      throw new Error('Queue is full');
    }

    const task = taskOptions instanceof Task ? taskOptions : new Task(taskOptions);

    // Проверяем зависимости
    for (const depId of task.dependencies) {
      if (!this.tasks.has(depId)) {
        throw new Error(`Dependency task ${depId} not found`);
      }
    }

    this.tasks.set(task.id, task);

    // Проверяем готовность
    if (this.isTaskReady(task)) {
      task.resume();
    } else {
      task.wait();
    }

    this.logger.info(`[TaskQueue] Added task ${task.id} (${task.type}) with priority ${task.priority}`);

    this.emit('task:added', { task });

    return task.id;
  }

  /**
   * Получить задачу по ID
   */
  get(taskId) {
    return this.tasks.get(taskId);
  }

  /**
   * Удалить задачу
   */
  remove(taskId) {
    const task = this.tasks.get(taskId);
    if (!task) {
      return false;
    }

    this.tasks.delete(taskId);
    this.logger.info(`[TaskQueue] Removed task ${taskId}`);

    this.emit('task:removed', { taskId, task });

    return true;
  }

  /**
   * Получить следующую задачу для выполнения
   * Учитывает приоритет и готовность (зависимости)
   */
  getNext(filter = {}) {
    const readyTasks = this.getReadyTasks(filter);

    if (readyTasks.length === 0) {
      return null;
    }

    // Сортируем по приоритету (выше - первым), затем по времени создания
    readyTasks.sort((a, b) => {
      if (b.priority !== a.priority) {
        return b.priority - a.priority;
      }
      return a.createdAt - b.createdAt;
    });

    return readyTasks[0];
  }

  /**
   * Получить все готовые к выполнению задачи
   */
  getReadyTasks(filter = {}) {
    const completedIds = this.getCompletedTaskIds();
    const tasks = Array.from(this.tasks.values());

    return tasks.filter(task => {
      // Проверяем статус
      if (task.status !== 'pending') {
        return false;
      }

      // Проверяем готовность (зависимости)
      if (!task.isReady(completedIds)) {
        return false;
      }

      // Применяем фильтры
      if (filter.type && task.type !== filter.type) {
        return false;
      }

      if (filter.tags && filter.tags.length > 0) {
        const hasTag = filter.tags.some(tag => task.tags.includes(tag));
        if (!hasTag) {
          return false;
        }
      }

      if (filter.requiredCapabilities && filter.requiredCapabilities.length > 0) {
        const hasCapability = filter.requiredCapabilities.every(cap =>
          task.requiredCapabilities.includes(cap)
        );
        if (!hasCapability) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Получить ID завершенных задач
   */
  getCompletedTaskIds() {
    return Array.from(this.tasks.values())
      .filter(task => task.status === 'completed')
      .map(task => task.id);
  }

  /**
   * Проверить, готова ли задача к выполнению
   */
  isTaskReady(task) {
    const completedIds = this.getCompletedTaskIds();
    return task.isReady(completedIds);
  }

  /**
   * Обновить статус задачи и проверить зависимые
   */
  updateTaskStatus(taskId, status, data = {}) {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    const oldStatus = task.status;

    // Обновляем статус
    switch (status) {
      case 'assigned':
        task.assign(data.modelId);
        break;
      case 'in-progress':
        task.start();
        break;
      case 'completed':
        task.complete(data.result);
        break;
      case 'failed':
        task.fail(data.error);
        break;
      case 'cancelled':
        task.cancel(data.reason);
        break;
    }

    this.logger.info(`[TaskQueue] Task ${taskId} status changed: ${oldStatus} -> ${status}`);

    this.emit('task:status-changed', { taskId, task, oldStatus, newStatus: status });

    // Если задача завершена, проверяем зависимые
    if (status === 'completed') {
      this.checkDependentTasks(taskId);
    }

    return task;
  }

  /**
   * Проверить и активировать задачи, зависящие от данной
   */
  checkDependentTasks(completedTaskId) {
    const dependentTasks = Array.from(this.tasks.values())
      .filter(task => task.dependencies.includes(completedTaskId) && task.status === 'waiting');

    for (const task of dependentTasks) {
      if (this.isTaskReady(task)) {
        task.resume();
        this.logger.info(`[TaskQueue] Task ${task.id} is now ready (dependency ${completedTaskId} completed)`);
        this.emit('task:ready', { task });
      }
    }
  }

  /**
   * Получить задачи по фильтру
   */
  getTasks(filter = {}) {
    let tasks = Array.from(this.tasks.values());

    if (filter.status) {
      tasks = tasks.filter(t => t.status === filter.status);
    }

    if (filter.type) {
      tasks = tasks.filter(t => t.type === filter.type);
    }

    if (filter.assignedTo) {
      tasks = tasks.filter(t => t.assignedTo === filter.assignedTo);
    }

    if (filter.tags && filter.tags.length > 0) {
      tasks = tasks.filter(t => filter.tags.some(tag => t.tags.includes(tag)));
    }

    return tasks;
  }

  /**
   * Очистить завершенные задачи
   */
  clearCompleted() {
    const completed = this.getTasks({ status: 'completed' });
    let count = 0;

    for (const task of completed) {
      // Проверяем, нет ли зависимых незавершенных задач
      const hasDependents = Array.from(this.tasks.values())
        .some(t => t.dependencies.includes(task.id) && t.status !== 'completed' && t.status !== 'cancelled');

      if (!hasDependents) {
        this.tasks.delete(task.id);
        count++;
      }
    }

    this.logger.info(`[TaskQueue] Cleared ${count} completed tasks`);

    return count;
  }

  /**
   * Очистить отмененные и проваленные задачи
   */
  clearFailed() {
    const failed = this.getTasks({ status: 'failed' });
    const cancelled = this.getTasks({ status: 'cancelled' });
    const toRemove = [...failed, ...cancelled];
    let count = 0;

    for (const task of toRemove) {
      this.tasks.delete(task.id);
      count++;
    }

    this.logger.info(`[TaskQueue] Cleared ${count} failed/cancelled tasks`);

    return count;
  }

  /**
   * Мониторинг тайм-аутов
   */
  startTimeoutMonitoring() {
    this.timeoutInterval = setInterval(() => {
      const inProgressTasks = this.getTasks({ status: 'in-progress' });

      for (const task of inProgressTasks) {
        if (task.isTimedOut()) {
          this.logger.warn(`[TaskQueue] Task ${task.id} timed out`);
          this.updateTaskStatus(task.id, 'failed', {
            error: `Task timed out after ${task.timeout}ms`
          });
          this.emit('task:timeout', { task });
        }
      }
    }, this.timeoutCheckInterval);
  }

  /**
   * Остановить мониторинг тайм-аутов
   */
  stopTimeoutMonitoring() {
    if (this.timeoutInterval) {
      clearInterval(this.timeoutInterval);
      this.timeoutInterval = null;
    }
  }

  /**
   * Получить статистику
   */
  getStats() {
    const tasks = Array.from(this.tasks.values());

    return {
      total: tasks.length,
      pending: tasks.filter(t => t.status === 'pending').length,
      waiting: tasks.filter(t => t.status === 'waiting').length,
      assigned: tasks.filter(t => t.status === 'assigned').length,
      inProgress: tasks.filter(t => t.status === 'in-progress').length,
      completed: tasks.filter(t => t.status === 'completed').length,
      failed: tasks.filter(t => t.status === 'failed').length,
      cancelled: tasks.filter(t => t.status === 'cancelled').length
    };
  }

  /**
   * Экспорт состояния
   */
  export() {
    return {
      tasks: Array.from(this.tasks.values()).map(task => task.toJSON()),
      maxQueueSize: this.maxQueueSize
    };
  }

  /**
   * Импорт состояния
   */
  import(data) {
    this.tasks.clear();
    this.maxQueueSize = data.maxQueueSize || this.maxQueueSize;

    for (const taskData of data.tasks) {
      const task = Task.fromJSON(taskData);
      this.tasks.set(task.id, task);
    }

    this.logger.info(`[TaskQueue] Imported ${data.tasks.length} tasks`);
  }

  /**
   * Очистить всю очередь
   */
  clear() {
    this.tasks.clear();
    this.logger.info('[TaskQueue] Queue cleared');
    this.emit('queue:cleared');
  }

  /**
   * Уничтожить очередь
   */
  destroy() {
    this.stopTimeoutMonitoring();
    this.clear();
    this.removeAllListeners();
  }
}

module.exports = { TaskQueue };
