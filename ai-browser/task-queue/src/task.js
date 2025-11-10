/**
 * Task - представляет задачу в системе
 * Содержит данные задачи, приоритет, зависимости, статус
 */

const { v4: uuidv4 } = require('uuid');

class Task {
  constructor(options = {}) {
    this.id = options.id || uuidv4();
    this.type = options.type || 'general'; // general, image-gen, document-gen, n8n-workflow, etc.
    this.description = options.description || '';
    this.data = options.data || {};

    // Приоритет (0-10, где 10 - наивысший)
    this.priority = options.priority !== undefined ? options.priority : 5;

    // Зависимости (список ID задач, которые должны завершиться перед этой)
    this.dependencies = options.dependencies || [];

    // Требуемые возможности модели
    this.requiredCapabilities = options.requiredCapabilities || [];

    // Предпочитаемая модель (необязательно)
    this.preferredModel = options.preferredModel || null;

    // Статус
    this.status = 'pending'; // pending, waiting, assigned, in-progress, completed, failed, cancelled

    // Мета-информация
    this.createdAt = Date.now();
    this.assignedAt = null;
    this.startedAt = null;
    this.completedAt = null;
    this.createdBy = options.createdBy || 'system';
    this.assignedTo = null; // ID модели

    // Результат выполнения
    this.result = null;
    this.error = null;

    // Повторные попытки
    this.maxRetries = options.maxRetries !== undefined ? options.maxRetries : 3;
    this.retryCount = 0;
    this.retryDelay = options.retryDelay || 5000; // мс

    // Тайм-аут (максимальное время выполнения в мс)
    this.timeout = options.timeout || 300000; // 5 минут по умолчанию

    // Теги для группировки
    this.tags = options.tags || [];
  }

  /**
   * Назначить задачу модели
   */
  assign(modelId) {
    if (this.status !== 'pending' && this.status !== 'waiting') {
      throw new Error(`Cannot assign task in status ${this.status}`);
    }

    this.status = 'assigned';
    this.assignedTo = modelId;
    this.assignedAt = Date.now();
  }

  /**
   * Начать выполнение
   */
  start() {
    if (this.status !== 'assigned') {
      throw new Error(`Cannot start task in status ${this.status}`);
    }

    this.status = 'in-progress';
    this.startedAt = Date.now();
  }

  /**
   * Завершить успешно
   */
  complete(result) {
    if (this.status !== 'in-progress') {
      throw new Error(`Cannot complete task in status ${this.status}`);
    }

    this.status = 'completed';
    this.result = result;
    this.completedAt = Date.now();
  }

  /**
   * Завершить с ошибкой
   */
  fail(error) {
    this.error = error;

    if (this.retryCount < this.maxRetries) {
      this.status = 'pending';
      this.retryCount++;
      this.assignedTo = null;
      this.assignedAt = null;
      this.startedAt = null;
    } else {
      this.status = 'failed';
      this.completedAt = Date.now();
    }
  }

  /**
   * Отменить задачу
   */
  cancel(reason = '') {
    if (this.status === 'completed') {
      throw new Error('Cannot cancel completed task');
    }

    this.status = 'cancelled';
    this.error = reason;
    this.completedAt = Date.now();
  }

  /**
   * Поставить в ожидание (зависимости не выполнены)
   */
  wait() {
    if (this.status === 'pending') {
      this.status = 'waiting';
    }
  }

  /**
   * Возобновить (зависимости выполнены)
   */
  resume() {
    if (this.status === 'waiting') {
      this.status = 'pending';
    }
  }

  /**
   * Проверить, истек ли тайм-аут
   */
  isTimedOut() {
    if (this.status !== 'in-progress' || !this.startedAt) {
      return false;
    }

    return (Date.now() - this.startedAt) > this.timeout;
  }

  /**
   * Получить длительность выполнения
   */
  getDuration() {
    if (!this.startedAt) {
      return 0;
    }

    const endTime = this.completedAt || Date.now();
    return endTime - this.startedAt;
  }

  /**
   * Проверить, готова ли задача к выполнению
   */
  isReady(completedTaskIds) {
    if (this.status !== 'pending' && this.status !== 'waiting') {
      return false;
    }

    // Проверяем зависимости
    return this.dependencies.every(depId => completedTaskIds.includes(depId));
  }

  /**
   * Клонировать задачу
   */
  clone() {
    return new Task({
      type: this.type,
      description: this.description,
      data: { ...this.data },
      priority: this.priority,
      dependencies: [...this.dependencies],
      requiredCapabilities: [...this.requiredCapabilities],
      preferredModel: this.preferredModel,
      createdBy: this.createdBy,
      maxRetries: this.maxRetries,
      retryDelay: this.retryDelay,
      timeout: this.timeout,
      tags: [...this.tags]
    });
  }

  /**
   * Экспорт в JSON
   */
  toJSON() {
    return {
      id: this.id,
      type: this.type,
      description: this.description,
      data: this.data,
      priority: this.priority,
      dependencies: this.dependencies,
      requiredCapabilities: this.requiredCapabilities,
      preferredModel: this.preferredModel,
      status: this.status,
      createdAt: this.createdAt,
      assignedAt: this.assignedAt,
      startedAt: this.startedAt,
      completedAt: this.completedAt,
      createdBy: this.createdBy,
      assignedTo: this.assignedTo,
      result: this.result,
      error: this.error,
      retryCount: this.retryCount,
      maxRetries: this.maxRetries,
      timeout: this.timeout,
      tags: this.tags
    };
  }

  /**
   * Импорт из JSON
   */
  static fromJSON(data) {
    const task = new Task(data);
    Object.assign(task, data);
    return task;
  }
}

module.exports = { Task };
