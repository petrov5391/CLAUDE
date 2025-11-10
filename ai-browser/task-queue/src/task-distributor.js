/**
 * TaskDistributor - автоматическое распределение задач между AI моделями
 * Выбирает оптимальную модель на основе возможностей, загрузки и истории
 */

const EventEmitter = require('eventemitter3');

class TaskDistributor extends EventEmitter {
  constructor(taskQueue, coordinator, logger) {
    super();
    this.taskQueue = taskQueue;
    this.coordinator = coordinator;
    this.logger = logger;

    // Настройки
    this.autoDistribute = false;
    this.distributionInterval = 2000; // мс
    this.maxTasksPerModel = 5;

    // Статистика моделей
    this.modelStats = new Map(); // modelId -> stats

    // Подписываемся на события
    this.setupListeners();
  }

  /**
   * Настройка обработчиков
   */
  setupListeners() {
    // Когда задача добавлена - пытаемся распределить
    this.taskQueue.on('task:added', () => {
      if (this.autoDistribute) {
        this.distributeNext();
      }
    });

    // Когда задача завершена - обновляем статистику и распределяем следующую
    this.taskQueue.on('task:status-changed', ({ task, newStatus }) => {
      if (newStatus === 'completed') {
        this.updateModelStats(task.assignedTo, task, true);
        if (this.autoDistribute) {
          this.distributeNext();
        }
      } else if (newStatus === 'failed') {
        this.updateModelStats(task.assignedTo, task, false);
        if (this.autoDistribute && task.status === 'pending') {
          // Задача в pending - будет повторная попытка
          this.distributeNext();
        }
      }
    });

    // Когда задача готова (зависимости выполнены)
    this.taskQueue.on('task:ready', () => {
      if (this.autoDistribute) {
        this.distributeNext();
      }
    });

    this.logger.info('[TaskDistributor] Listeners установлены');
  }

  /**
   * Запустить автоматическое распределение
   */
  startAutoDistribution() {
    if (this.autoDistribute) {
      return;
    }

    this.autoDistribute = true;
    this.logger.info('[TaskDistributor] Автоматическое распределение включено');

    // Периодически проверяем и распределяем
    this.distributionTimer = setInterval(() => {
      this.distributeAll();
    }, this.distributionInterval);

    // Распределяем сразу
    this.distributeAll();
  }

  /**
   * Остановить автоматическое распределение
   */
  stopAutoDistribution() {
    if (!this.autoDistribute) {
      return;
    }

    this.autoDistribute = false;
    if (this.distributionTimer) {
      clearInterval(this.distributionTimer);
      this.distributionTimer = null;
    }

    this.logger.info('[TaskDistributor] Автоматическое распределение выключено');
  }

  /**
   * Распределить одну следующую задачу
   */
  async distributeNext() {
    const task = this.taskQueue.getNext();
    if (!task) {
      return null;
    }

    return await this.assignTask(task);
  }

  /**
   * Распределить все доступные задачи
   */
  async distributeAll() {
    let distributed = 0;

    while (true) {
      const task = this.taskQueue.getNext();
      if (!task) {
        break;
      }

      const assigned = await this.assignTask(task);
      if (assigned) {
        distributed++;
      } else {
        // Не удалось назначить - прекращаем
        break;
      }
    }

    if (distributed > 0) {
      this.logger.info(`[TaskDistributor] Распределено задач: ${distributed}`);
    }

    return distributed;
  }

  /**
   * Назначить задачу подходящей модели
   */
  async assignTask(task) {
    try {
      // Получаем доступные модели
      const models = this.coordinator.getModels();

      // Фильтруем по статусу и загрузке
      const availableModels = models.filter(model => {
        // Модель должна быть свободна или не слишком загружена
        if (model.status === 'busy') {
          const currentTasks = this.taskQueue.getTasks({
            status: 'in-progress',
            assignedTo: model.id
          });
          if (currentTasks.length >= this.maxTasksPerModel) {
            return false;
          }
        }

        // Проверяем возможности
        if (task.requiredCapabilities.length > 0) {
          const hasCapabilities = task.requiredCapabilities.every(cap =>
            model.capabilities.includes(cap)
          );
          if (!hasCapabilities) {
            return false;
          }
        }

        return true;
      });

      if (availableModels.length === 0) {
        this.logger.warn(`[TaskDistributor] Нет доступных моделей для задачи ${task.id}`);
        return false;
      }

      // Выбираем оптимальную модель
      const selectedModel = this.selectBestModel(task, availableModels);

      if (!selectedModel) {
        return false;
      }

      // Назначаем задачу через координатор
      const response = await this.coordinator.messageBus.request(
        'coordinator:task:request',
        {
          taskId: task.id,
          modelId: selectedModel.id,
          description: task.description,
          requiredCapabilities: task.requiredCapabilities,
          priority: task.priority
        },
        'task-distributor',
        10000
      );

      if (response.success) {
        // Обновляем статус в очереди
        this.taskQueue.updateTaskStatus(task.id, 'assigned', {
          modelId: selectedModel.id
        });

        this.logger.info(`[TaskDistributor] Задача ${task.id} назначена модели ${selectedModel.id}`);

        this.emit('task:assigned', { task, model: selectedModel });

        return true;
      } else {
        this.logger.warn(`[TaskDistributor] Не удалось назначить задачу ${task.id}: ${response.reason || response.error}`);
        return false;
      }

    } catch (error) {
      this.logger.error(`[TaskDistributor] Ошибка назначения задачи ${task.id}:`, error);
      return false;
    }
  }

  /**
   * Выбрать лучшую модель для задачи
   */
  selectBestModel(task, availableModels) {
    // Если указана предпочитаемая модель
    if (task.preferredModel) {
      const preferred = availableModels.find(m => m.id === task.preferredModel);
      if (preferred) {
        return preferred;
      }
    }

    // Оцениваем модели
    const scores = availableModels.map(model => ({
      model,
      score: this.calculateModelScore(task, model)
    }));

    // Сортируем по баллам
    scores.sort((a, b) => b.score - a.score);

    return scores[0]?.model || null;
  }

  /**
   * Рассчитать оценку модели для задачи
   */
  calculateModelScore(task, model) {
    let score = 0;

    // Базовый приоритет модели
    score += model.priority * 10;

    // Бонус за статус
    if (model.status === 'idle') {
      score += 50;
    } else if (model.status === 'busy') {
      // Штраф за текущую загрузку
      const currentTasks = this.taskQueue.getTasks({
        status: 'in-progress',
        assignedTo: model.id
      });
      score -= currentTasks.length * 10;
    }

    // Статистика модели
    const stats = this.modelStats.get(model.id);
    if (stats) {
      // Бонус за успешность
      if (stats.completed > 0) {
        const successRate = stats.completed / (stats.completed + stats.failed);
        score += successRate * 30;
      }

      // Бонус за скорость (если есть данные)
      if (stats.avgDuration > 0) {
        // Чем быстрее, тем лучше (инвертируем)
        const speedBonus = Math.max(0, 20 - (stats.avgDuration / 1000));
        score += speedBonus;
      }

      // Бонус за опыт с данным типом задач
      const typeStats = stats.byType[task.type];
      if (typeStats && typeStats.completed > 0) {
        score += 15;
        const typeSuccessRate = typeStats.completed / (typeStats.completed + typeStats.failed);
        score += typeSuccessRate * 10;
      }
    }

    // Соответствие возможностей
    const matchingCapabilities = task.requiredCapabilities.filter(cap =>
      model.capabilities.includes(cap)
    );
    score += matchingCapabilities.length * 5;

    return score;
  }

  /**
   * Обновить статистику модели
   */
  updateModelStats(modelId, task, success) {
    if (!modelId) {
      return;
    }

    if (!this.modelStats.has(modelId)) {
      this.modelStats.set(modelId, {
        completed: 0,
        failed: 0,
        totalDuration: 0,
        avgDuration: 0,
        byType: {}
      });
    }

    const stats = this.modelStats.get(modelId);

    if (success) {
      stats.completed++;
      const duration = task.getDuration();
      stats.totalDuration += duration;
      stats.avgDuration = stats.totalDuration / stats.completed;
    } else {
      stats.failed++;
    }

    // Статистика по типу
    if (!stats.byType[task.type]) {
      stats.byType[task.type] = { completed: 0, failed: 0 };
    }

    if (success) {
      stats.byType[task.type].completed++;
    } else {
      stats.byType[task.type].failed++;
    }
  }

  /**
   * Получить статистику моделей
   */
  getModelStats(modelId = null) {
    if (modelId) {
      return this.modelStats.get(modelId) || null;
    }

    const result = {};
    for (const [id, stats] of this.modelStats.entries()) {
      result[id] = { ...stats };
    }
    return result;
  }

  /**
   * Получить статус дистрибьютора
   */
  getStatus() {
    return {
      autoDistribute: this.autoDistribute,
      distributionInterval: this.distributionInterval,
      maxTasksPerModel: this.maxTasksPerModel,
      modelStatsCount: this.modelStats.size
    };
  }

  /**
   * Очистить статистику
   */
  clearStats() {
    this.modelStats.clear();
    this.logger.info('[TaskDistributor] Статистика очищена');
  }

  /**
   * Уничтожить дистрибьютор
   */
  destroy() {
    this.stopAutoDistribution();
    this.clearStats();
    this.removeAllListeners();
  }
}

module.exports = { TaskDistributor };
