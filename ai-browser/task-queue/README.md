# Task Queue Module

Модуль управления задачами с поддержкой приоритетов, зависимостей и автоматического распределения между AI моделями.

## Возможности

- ⚡ **Приоритетная очередь** - задачи выполняются в порядке приоритета
- 🔗 **Зависимости задач** - автоматическая активация при выполнении зависимостей
- 🤖 **Автоматическое распределение** - умный выбор модели на основе возможностей и загрузки
- ⏱️ **Тайм-ауты** - автоматическое обнаружение зависших задач
- 🔄 **Повторные попытки** - автоматический retry при ошибках
- 📊 **Статистика** - подробная аналитика выполнения задач
- 📝 **Версионирование** - полная история изменений задач
- 🎯 **Возможности моделей** - сопоставление задач с нужными моделями

## Установка

```bash
cd task-queue
npm install
```

## Быстрый старт

```javascript
const winston = require('winston');
const { createCoordinationSystem } = require('../coordination/src');
const { createTaskSystem } = require('../task-queue/src');

const logger = winston.createLogger({
  level: 'info',
  transports: [new winston.transports.Console()]
});

// Создать систему координации
const { coordinator } = createCoordinationSystem(logger);

// Создать систему управления задачами
const { taskQueue, taskDistributor, Task } = createTaskSystem(coordinator, logger);

// Добавить задачу
const taskId = taskQueue.add({
  type: 'coding',
  description: 'Написать функцию',
  priority: 8,
  requiredCapabilities: ['coding']
});

// Запустить автоматическое распределение
taskDistributor.startAutoDistribution();
```

## API

### Task

Класс для представления задачи.

#### Создание задачи

```javascript
const task = new Task({
  type: 'coding',
  description: 'Написать код',
  priority: 5,              // 0-10, где 10 - наивысший
  data: { foo: 'bar' },     // Произвольные данные
  dependencies: [taskId1],  // Список ID задач-зависимостей
  requiredCapabilities: ['coding'],
  preferredModel: 'gpt-4',  // Опционально
  maxRetries: 3,            // Количество повторных попыток
  timeout: 300000,          // Тайм-аут в мс (5 минут)
  tags: ['urgent', 'feature']
});
```

#### Методы

```javascript
// Назначение модели
task.assign('model-id');

// Начало выполнения
task.start();

// Успешное завершение
task.complete({ result: 'success' });

// Завершение с ошибкой
task.fail('Error message');

// Отмена
task.cancel('Reason');

// Проверка тайм-аута
task.isTimedOut(); // -> boolean

// Получение длительности
task.getDuration(); // -> number (мс)

// Проверка готовности
task.isReady([completedTaskIds]); // -> boolean

// Экспорт/импорт
const json = task.toJSON();
const restored = Task.fromJSON(json);
```

#### Статусы задачи

- `pending` - ожидает назначения
- `waiting` - ожидает выполнения зависимостей
- `assigned` - назначена модели
- `in-progress` - выполняется
- `completed` - успешно завершена
- `failed` - провалена (после всех retry)
- `cancelled` - отменена

### TaskQueue

Очередь задач с приоритетами и зависимостями.

#### Создание

```javascript
const { TaskQueue } = require('./src/task-queue');
const queue = new TaskQueue(logger);
```

#### Методы

```javascript
// Добавить задачу
const taskId = queue.add({
  type: 'coding',
  description: 'Написать код',
  priority: 8
});

// Получить задачу
const task = queue.get(taskId);

// Удалить задачу
queue.remove(taskId);

// Получить следующую задачу для выполнения
const next = queue.getNext();
const nextOfType = queue.getNext({ type: 'coding' });

// Получить готовые к выполнению задачи
const readyTasks = queue.getReadyTasks();
const readyWithTag = queue.getReadyTasks({ tags: ['urgent'] });

// Обновить статус задачи
queue.updateTaskStatus(taskId, 'assigned', { modelId: 'model-1' });
queue.updateTaskStatus(taskId, 'in-progress');
queue.updateTaskStatus(taskId, 'completed', { result: 'done' });
queue.updateTaskStatus(taskId, 'failed', { error: 'Error message' });

// Получить задачи по фильтру
const tasks = queue.getTasks({ status: 'pending' });
const tasksByType = queue.getTasks({ type: 'coding' });
const tasksByModel = queue.getTasks({ assignedTo: 'model-1' });

// Очистить завершенные задачи
const cleared = queue.clearCompleted();

// Очистить проваленные/отмененные задачи
const clearedFailed = queue.clearFailed();

// Статистика
const stats = queue.getStats();
// {
//   total: 10,
//   pending: 3,
//   waiting: 2,
//   assigned: 1,
//   inProgress: 2,
//   completed: 2,
//   failed: 0,
//   cancelled: 0
// }

// Экспорт/импорт
const exported = queue.export();
queue.import(exported);

// Очистка и уничтожение
queue.clear();
queue.destroy();
```

#### События

```javascript
// Задача добавлена
queue.on('task:added', ({ task }) => {
  console.log('Добавлена задача:', task.id);
});

// Задача удалена
queue.on('task:removed', ({ taskId, task }) => {
  console.log('Удалена задача:', taskId);
});

// Статус изменен
queue.on('task:status-changed', ({ taskId, task, oldStatus, newStatus }) => {
  console.log(`Задача ${taskId}: ${oldStatus} -> ${newStatus}`);
});

// Задача готова к выполнению
queue.on('task:ready', ({ task }) => {
  console.log('Задача готова:', task.id);
});

// Тайм-аут задачи
queue.on('task:timeout', ({ task }) => {
  console.log('Тайм-аут задачи:', task.id);
});

// Очередь очищена
queue.on('queue:cleared', () => {
  console.log('Очередь очищена');
});
```

### TaskDistributor

Автоматическое распределение задач между моделями.

#### Создание

```javascript
const { TaskDistributor } = require('./src/task-distributor');
const distributor = new TaskDistributor(taskQueue, coordinator, logger);
```

#### Методы

```javascript
// Запустить автоматическое распределение
distributor.startAutoDistribution();

// Остановить автоматическое распределение
distributor.stopAutoDistribution();

// Распределить одну следующую задачу
const assigned = await distributor.distributeNext();

// Распределить все доступные задачи
const count = await distributor.distributeAll();

// Получить статистику моделей
const allStats = distributor.getModelStats();
const modelStats = distributor.getModelStats('model-id');
// {
//   completed: 10,
//   failed: 1,
//   totalDuration: 15000,
//   avgDuration: 1500,
//   byType: {
//     coding: { completed: 5, failed: 0 },
//     analysis: { completed: 5, failed: 1 }
//   }
// }

// Получить статус
const status = distributor.getStatus();
// {
//   autoDistribute: true,
//   distributionInterval: 2000,
//   maxTasksPerModel: 5,
//   modelStatsCount: 3
// }

// Очистить статистику
distributor.clearStats();

// Уничтожить
distributor.destroy();
```

#### События

```javascript
// Задача назначена
distributor.on('task:assigned', ({ task, model }) => {
  console.log(`Задача ${task.id} назначена модели ${model.id}`);
});
```

#### Алгоритм выбора модели

Distributor выбирает оптимальную модель на основе:

1. **Предпочитаемая модель** (если указана в задаче)
2. **Оценка модели** (score):
   - Базовый приоритет модели (+10 за каждую единицу priority)
   - Статус модели (+50 если idle, штраф если busy)
   - Успешность выполнения (+30 * successRate)
   - Скорость выполнения (+20 - duration/1000)
   - Опыт с типом задачи (+15 + 10 * typeSuccessRate)
   - Соответствие возможностей (+5 за каждую matching capability)

### createTaskSystem

Создание полной системы управления задачами.

```javascript
const { createTaskSystem } = require('./src');

const { taskQueue, taskDistributor, Task } = createTaskSystem(coordinator, logger);
```

## Примеры использования

### Пример 1: Базовое использование

```javascript
const winston = require('winston');
const { TaskQueue } = require('./src');

const logger = winston.createLogger({ level: 'info' });
const queue = new TaskQueue(logger);

// Добавить задачи
const task1 = queue.add({
  type: 'coding',
  description: 'Написать функцию',
  priority: 8
});

const task2 = queue.add({
  type: 'testing',
  description: 'Написать тесты',
  priority: 7,
  dependencies: [task1] // Зависит от первой задачи
});

// Получить следующую задачу
const next = queue.getNext();
console.log('Следующая задача:', next.description);

// Обновить статусы
queue.updateTaskStatus(task1, 'assigned', { modelId: 'gpt-4' });
queue.updateTaskStatus(task1, 'in-progress');
queue.updateTaskStatus(task1, 'completed', { result: 'success' });

// Задача 2 автоматически станет готовой
const next2 = queue.getNext();
console.log('Теперь готова:', next2.description); // "Написать тесты"
```

### Пример 2: Автоматическое распределение

```javascript
const { createCoordinationSystem } = require('../coordination/src');
const { createTaskSystem } = require('./src');

const logger = winston.createLogger({ level: 'info' });

// Создать системы
const { messageBus, coordinator } = createCoordinationSystem(logger);
const { taskQueue, taskDistributor } = createTaskSystem(coordinator, logger);

// Зарегистрировать модели
messageBus.publish('coordinator:register', {
  modelId: 'gpt-4',
  capabilities: ['text', 'coding'],
  priority: 10
}, 'system');

messageBus.publish('coordinator:register', {
  modelId: 'claude-3',
  capabilities: ['text', 'creative'],
  priority: 9
}, 'system');

// Добавить задачи
taskQueue.add({
  type: 'coding',
  description: 'Написать сервис',
  requiredCapabilities: ['coding']
});

taskQueue.add({
  type: 'creative',
  description: 'Написать статью',
  requiredCapabilities: ['creative']
});

// Запустить автоматическое распределение
taskDistributor.startAutoDistribution();

// Задачи будут автоматически назначены подходящим моделям
// gpt-4 получит задачу с coding
// claude-3 получит задачу с creative
```

### Пример 3: Сложные зависимости

```javascript
// Создать цепочку задач
const analyze = queue.add({
  type: 'analysis',
  description: 'Проанализировать требования',
  priority: 10
});

const design = queue.add({
  type: 'design',
  description: 'Спроектировать архитектуру',
  priority: 9,
  dependencies: [analyze]
});

const implement = queue.add({
  type: 'coding',
  description: 'Реализовать код',
  priority: 8,
  dependencies: [design]
});

const test = queue.add({
  type: 'testing',
  description: 'Написать тесты',
  priority: 7,
  dependencies: [implement]
});

const docs = queue.add({
  type: 'documentation',
  description: 'Написать документацию',
  priority: 6,
  dependencies: [implement, test] // Зависит от двух задач
});

// Задачи будут выполняться в правильном порядке:
// 1. analyze
// 2. design (после analyze)
// 3. implement (после design)
// 4. test (после implement)
// 5. docs (после implement И test)
```

### Пример 4: Повторные попытки

```javascript
// Задача с повторными попытками
const taskId = queue.add({
  type: 'api-call',
  description: 'Вызвать внешний API',
  maxRetries: 3,
  retryDelay: 5000, // 5 секунд между попытками
  timeout: 10000    // 10 секунд тайм-аут
});

// Первая попытка провалена
queue.updateTaskStatus(taskId, 'assigned', { modelId: 'model-1' });
queue.updateTaskStatus(taskId, 'in-progress');
queue.updateTaskStatus(taskId, 'failed', { error: 'Network error' });

// Задача автоматически вернется в pending для повторной попытки
const task = queue.get(taskId);
console.log(task.status);      // 'pending'
console.log(task.retryCount);  // 1

// После 3 неудачных попыток задача окончательно провалится
```

## Производительность

- **Очередь**: O(n) для getNext (с сортировкой), O(1) для add/get/remove
- **Зависимости**: O(n) для проверки при завершении задачи
- **Распределение**: O(n*m) где n - задачи, m - модели
- **Память**: ~1KB на задачу (без данных результата)

## Тестирование

```bash
npm test
```

Все 32 теста должны пройти успешно:
- 4 теста импорта модулей
- 6 тестов Task
- 6 тестов TaskQueue
- 5 тестов TaskDistributor
- 4 теста создания системы
- 4 теста приоритетов и зависимостей
- 4 теста повторных попыток и тайм-аутов

## Интеграция

### С Coordinator

Task Queue тесно интегрирован с модулем Coordination:

```javascript
const { createCoordinationSystem } = require('../coordination/src');
const { createTaskSystem } = require('./src');

const { coordinator } = createCoordinationSystem(logger);
const { taskQueue, taskDistributor } = createTaskSystem(coordinator, logger);

// TaskDistributor использует Coordinator для:
// - Получения списка доступных моделей
// - Проверки возможностей моделей
// - Назначения задач через coordinator:task:request
```

### С Electron App

```javascript
// В main process
const { taskQueue, taskDistributor } = createTaskSystem(coordinator, logger);

// Добавить IPC handlers
ipcMain.handle('task:add', (event, taskOptions) => {
  return taskQueue.add(taskOptions);
});

ipcMain.handle('task:get', (event, taskId) => {
  return taskQueue.get(taskId)?.toJSON();
});

ipcMain.handle('task:stats', () => {
  return taskQueue.getStats();
});

// В renderer process
const taskId = await window.electronAPI.task.add({
  type: 'coding',
  description: 'Написать функцию'
});

const stats = await window.electronAPI.task.stats();
console.log('Завершено задач:', stats.completed);
```

## Roadmap

- [ ] Приоритетные очереди по типам задач
- [ ] Пакетное выполнение задач
- [ ] Отложенные задачи (scheduled tasks)
- [ ] Периодические задачи (cron-like)
- [ ] Webhook уведомления о завершении
- [ ] Персистентность в Redis
- [ ] Web UI для мониторинга очереди
- [ ] Метрики для Prometheus

## Лицензия

MIT
