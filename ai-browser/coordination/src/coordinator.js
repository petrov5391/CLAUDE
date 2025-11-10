/**
 * Coordinator - координатор действий AI моделей
 * Управляет согласованием действий, предотвращает конфликты, распределяет ресурсы
 */

const { v4: uuidv4 } = require('uuid');

class Coordinator {
  constructor(messageBus, logger) {
    this.messageBus = messageBus;
    this.logger = logger;

    // Состояние
    this.models = new Map(); // modelId -> model info
    this.tasks = new Map(); // taskId -> task info
    this.resources = new Map(); // resourceId -> resource state
    this.locks = new Map(); // resourceId -> modelId (кто держит блокировку)

    // Подписываемся на события
    this.setupListeners();
  }

  /**
   * Настройка обработчиков событий
   */
  setupListeners() {
    // Регистрация модели
    this.messageBus.subscribe('coordinator:register', (message) => {
      this.handleRegisterModel(message);
    }, 'coordinator');

    // Запрос на выполнение задачи
    this.messageBus.subscribe('coordinator:task:request', (message) => {
      this.handleTaskRequest(message);
    }, 'coordinator');

    // Запрос ресурса
    this.messageBus.subscribe('coordinator:resource:request', (message) => {
      this.handleResourceRequest(message);
    }, 'coordinator');

    // Освобождение ресурса
    this.messageBus.subscribe('coordinator:resource:release', (message) => {
      this.handleResourceRelease(message);
    }, 'coordinator');

    // Отмена модели
    this.messageBus.subscribe('coordinator:unregister', (message) => {
      this.handleUnregisterModel(message);
    }, 'coordinator');

    this.logger.info('[Coordinator] Listeners установлены');
  }

  /**
   * Регистрация модели в координаторе
   */
  handleRegisterModel(message) {
    const { modelId, capabilities, priority } = message.data;

    this.models.set(modelId, {
      id: modelId,
      capabilities: capabilities || [],
      priority: priority || 0,
      status: 'idle',
      registeredAt: Date.now(),
      tasksCompleted: 0,
      currentTask: null
    });

    this.logger.info(`[Coordinator] Модель зарегистрирована: ${modelId}`);

    // Отправляем подтверждение
    this.messageBus.respond(message, {
      success: true,
      modelId
    }, 'coordinator');
  }

  /**
   * Обработка запроса на выполнение задачи
   */
  async handleTaskRequest(message) {
    const { taskId, modelId, description, requiredCapabilities, priority } = message.data;

    try {
      // Проверяем, зарегистрирована ли модель
      if (!this.models.has(modelId)) {
        throw new Error(`Модель ${modelId} не зарегистрирована`);
      }

      // Проверяем конфликты
      const conflict = await this.checkTaskConflicts(taskId, modelId, description);
      if (conflict) {
        this.logger.warn(`[Coordinator] Конфликт задачи ${taskId}: ${conflict.reason}`);
        this.messageBus.respond(message, {
          success: false,
          conflict: true,
          reason: conflict.reason,
          suggestion: conflict.suggestion
        }, 'coordinator');
        return;
      }

      // Проверяем возможности модели
      const model = this.models.get(modelId);
      if (requiredCapabilities) {
        const hasCapabilities = requiredCapabilities.every(cap =>
          model.capabilities.includes(cap)
        );

        if (!hasCapabilities) {
          // Ищем подходящую модель
          const suitableModel = this.findSuitableModel(requiredCapabilities);
          this.messageBus.respond(message, {
            success: false,
            reason: 'Недостаточно возможностей',
            suggestion: suitableModel ? `Используйте модель ${suitableModel}` : null
          }, 'coordinator');
          return;
        }
      }

      // Создаем задачу
      const task = {
        id: taskId || uuidv4(),
        modelId,
        description,
        priority: priority || 0,
        status: 'approved',
        createdAt: Date.now(),
        approvedAt: Date.now()
      };

      this.tasks.set(task.id, task);

      // Обновляем статус модели
      model.status = 'busy';
      model.currentTask = task.id;

      this.logger.info(`[Coordinator] Задача ${task.id} одобрена для модели ${modelId}`);

      // Отправляем подтверждение
      this.messageBus.respond(message, {
        success: true,
        taskId: task.id,
        approved: true
      }, 'coordinator');

      // Уведомляем других
      this.messageBus.publish('coordinator:task:approved', {
        taskId: task.id,
        modelId,
        description
      }, 'coordinator');

    } catch (error) {
      this.logger.error(`[Coordinator] Ошибка обработки задачи:`, error);
      this.messageBus.respond(message, {
        success: false,
        error: error.message
      }, 'coordinator');
    }
  }

  /**
   * Проверка конфликтов задачи
   */
  async checkTaskConflicts(taskId, modelId, description) {
    // Проверяем, не занята ли модель другой задачей
    const model = this.models.get(modelId);
    if (model.currentTask && model.status === 'busy') {
      return {
        reason: 'Модель занята другой задачей',
        suggestion: 'Дождитесь завершения текущей задачи'
      };
    }

    // Проверяем дублирование задач
    for (const [id, task] of this.tasks.entries()) {
      if (task.description === description && task.status !== 'completed') {
        return {
          reason: 'Похожая задача уже выполняется',
          suggestion: `См. задачу ${id}`
        };
      }
    }

    // Проверяем ресурсы (если требуются эксклюзивные ресурсы)
    // TODO: Добавить проверку ресурсов из описания задачи

    return null; // Нет конфликтов
  }

  /**
   * Найти подходящую модель для задачи
   */
  findSuitableModel(requiredCapabilities) {
    for (const [modelId, model] of this.models.entries()) {
      if (model.status === 'idle') {
        const hasAll = requiredCapabilities.every(cap =>
          model.capabilities.includes(cap)
        );
        if (hasAll) {
          return modelId;
        }
      }
    }
    return null;
  }

  /**
   * Обработка запроса ресурса
   */
  async handleResourceRequest(message) {
    const { resourceId, modelId, exclusive } = message.data;

    try {
      // Проверяем, не заблокирован ли ресурс
      if (this.locks.has(resourceId)) {
        const lockedBy = this.locks.get(resourceId);
        if (lockedBy !== modelId) {
          this.logger.warn(`[Coordinator] Ресурс ${resourceId} заблокирован моделью ${lockedBy}`);
          this.messageBus.respond(message, {
            success: false,
            locked: true,
            lockedBy
          }, 'coordinator');
          return;
        }
      }

      // Блокируем ресурс если требуется эксклюзивный доступ
      if (exclusive) {
        this.locks.set(resourceId, modelId);
        this.logger.info(`[Coordinator] Ресурс ${resourceId} заблокирован для ${modelId}`);
      }

      // Обновляем информацию о ресурсе
      if (!this.resources.has(resourceId)) {
        this.resources.set(resourceId, {
          id: resourceId,
          users: new Set()
        });
      }
      this.resources.get(resourceId).users.add(modelId);

      this.messageBus.respond(message, {
        success: true,
        resourceId,
        granted: true
      }, 'coordinator');

    } catch (error) {
      this.logger.error(`[Coordinator] Ошибка запроса ресурса:`, error);
      this.messageBus.respond(message, {
        success: false,
        error: error.message
      }, 'coordinator');
    }
  }

  /**
   * Освобождение ресурса
   */
  handleResourceRelease(message) {
    const { resourceId, modelId } = message.data;

    // Снимаем блокировку
    if (this.locks.get(resourceId) === modelId) {
      this.locks.delete(resourceId);
      this.logger.info(`[Coordinator] Ресурс ${resourceId} освобожден моделью ${modelId}`);
    }

    // Удаляем из пользователей
    if (this.resources.has(resourceId)) {
      this.resources.get(resourceId).users.delete(modelId);
    }

    this.messageBus.respond(message, {
      success: true,
      released: true
    }, 'coordinator');
  }

  /**
   * Отмена регистрации модели
   */
  handleUnregisterModel(message) {
    const { modelId } = message.data;

    // Освобождаем все ресурсы
    for (const [resourceId, lockedBy] of this.locks.entries()) {
      if (lockedBy === modelId) {
        this.locks.delete(resourceId);
      }
    }

    // Удаляем из пользователей ресурсов
    for (const resource of this.resources.values()) {
      resource.users.delete(modelId);
    }

    // Удаляем модель
    this.models.delete(modelId);

    this.logger.info(`[Coordinator] Модель ${modelId} удалена`);

    this.messageBus.respond(message, {
      success: true
    }, 'coordinator');
  }

  /**
   * Завершение задачи
   */
  completeTask(taskId, modelId, result) {
    const task = this.tasks.get(taskId);
    if (!task) {
      this.logger.warn(`[Coordinator] Задача ${taskId} не найдена`);
      return false;
    }

    if (task.modelId !== modelId) {
      this.logger.warn(`[Coordinator] Модель ${modelId} пытается завершить чужую задачу ${taskId}`);
      return false;
    }

    // Обновляем задачу
    task.status = 'completed';
    task.completedAt = Date.now();
    task.result = result;

    // Обновляем модель
    const model = this.models.get(modelId);
    if (model) {
      model.status = 'idle';
      model.currentTask = null;
      model.tasksCompleted++;
    }

    this.logger.info(`[Coordinator] Задача ${taskId} завершена моделью ${modelId}`);

    // Уведомляем
    this.messageBus.publish('coordinator:task:completed', {
      taskId,
      modelId,
      result
    }, 'coordinator');

    return true;
  }

  /**
   * Получить статус координатора
   */
  getStatus() {
    return {
      models: this.models.size,
      activeTasks: Array.from(this.tasks.values()).filter(t => t.status !== 'completed').length,
      completedTasks: Array.from(this.tasks.values()).filter(t => t.status === 'completed').length,
      lockedResources: this.locks.size,
      resources: this.resources.size
    };
  }

  /**
   * Получить список моделей
   */
  getModels() {
    return Array.from(this.models.values());
  }

  /**
   * Получить список задач
   */
  getTasks(filter = {}) {
    let tasks = Array.from(this.tasks.values());

    if (filter.status) {
      tasks = tasks.filter(t => t.status === filter.status);
    }

    if (filter.modelId) {
      tasks = tasks.filter(t => t.modelId === filter.modelId);
    }

    return tasks;
  }
}

module.exports = { Coordinator };
