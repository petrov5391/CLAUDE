/**
 * Shared State - общее состояние между AI моделями
 * Предоставляет key-value хранилище с поддержкой транзакций и версионирования
 */

const EventEmitter = require('eventemitter3');

class SharedState extends EventEmitter {
  constructor(logger) {
    super();
    this.logger = logger;
    this.state = new Map(); // key -> { value, version, updatedAt, updatedBy }
    this.history = new Map(); // key -> Array of versions
    this.maxHistorySize = 100;
  }

  /**
   * Установить значение
   */
  set(key, value, updatedBy = 'system') {
    const previous = this.state.get(key);
    const version = previous ? previous.version + 1 : 1;

    const entry = {
      value,
      version,
      updatedAt: Date.now(),
      updatedBy
    };

    this.state.set(key, entry);

    // Сохраняем в историю
    if (!this.history.has(key)) {
      this.history.set(key, []);
    }
    const history = this.history.get(key);
    history.push({ ...entry });
    if (history.length > this.maxHistorySize) {
      history.shift();
    }

    this.logger.debug(`[SharedState] Set: ${key} = ${JSON.stringify(value)} by ${updatedBy}`);

    // Событие изменения
    this.emit('change', { key, value, version, updatedBy, previous: previous?.value });
    this.emit(`change:${key}`, { value, version, updatedBy, previous: previous?.value });

    return version;
  }

  /**
   * Получить значение
   */
  get(key, defaultValue = undefined) {
    const entry = this.state.get(key);
    return entry ? entry.value : defaultValue;
  }

  /**
   * Получить полную информацию о ключе
   */
  getEntry(key) {
    return this.state.get(key);
  }

  /**
   * Проверить существование ключа
   */
  has(key) {
    return this.state.has(key);
  }

  /**
   * Удалить ключ
   */
  delete(key, deletedBy = 'system') {
    const previous = this.state.get(key);
    if (!previous) {
      return false;
    }

    this.state.delete(key);

    this.logger.debug(`[SharedState] Delete: ${key} by ${deletedBy}`);

    // Событие удаления
    this.emit('delete', { key, deletedBy, previous: previous.value });
    this.emit(`delete:${key}`, { deletedBy, previous: previous.value });

    return true;
  }

  /**
   * Получить все ключи
   */
  keys() {
    return Array.from(this.state.keys());
  }

  /**
   * Получить все значения
   */
  values() {
    return Array.from(this.state.values()).map(entry => entry.value);
  }

  /**
   * Получить весь state
   */
  getAll() {
    const result = {};
    for (const [key, entry] of this.state.entries()) {
      result[key] = entry.value;
    }
    return result;
  }

  /**
   * Условное обновление (CAS - Compare And Set)
   */
  compareAndSet(key, expectedVersion, newValue, updatedBy = 'system') {
    const entry = this.state.get(key);

    if (!entry && expectedVersion === 0) {
      // Создание нового ключа
      return this.set(key, newValue, updatedBy);
    }

    if (!entry || entry.version !== expectedVersion) {
      this.logger.warn(`[SharedState] CAS failed for ${key}: expected v${expectedVersion}, got v${entry?.version}`);
      return null;
    }

    return this.set(key, newValue, updatedBy);
  }

  /**
   * Атомарное обновление
   */
  update(key, updateFn, updatedBy = 'system') {
    const current = this.get(key);
    const newValue = updateFn(current);
    return this.set(key, newValue, updatedBy);
  }

  /**
   * Инкремент числового значения
   */
  increment(key, delta = 1, updatedBy = 'system') {
    const current = this.get(key, 0);
    if (typeof current !== 'number') {
      throw new Error(`Cannot increment non-numeric value at ${key}`);
    }
    return this.set(key, current + delta, updatedBy);
  }

  /**
   * Декремент числового значения
   */
  decrement(key, delta = 1, updatedBy = 'system') {
    return this.increment(key, -delta, updatedBy);
  }

  /**
   * Добавить элемент в массив
   */
  push(key, value, updatedBy = 'system') {
    const current = this.get(key, []);
    if (!Array.isArray(current)) {
      throw new Error(`Cannot push to non-array value at ${key}`);
    }
    return this.set(key, [...current, value], updatedBy);
  }

  /**
   * Удалить элемент из массива
   */
  pull(key, value, updatedBy = 'system') {
    const current = this.get(key, []);
    if (!Array.isArray(current)) {
      throw new Error(`Cannot pull from non-array value at ${key}`);
    }
    return this.set(key, current.filter(v => v !== value), updatedBy);
  }

  /**
   * Объединить объекты
   */
  merge(key, value, updatedBy = 'system') {
    const current = this.get(key, {});
    if (typeof current !== 'object' || Array.isArray(current)) {
      throw new Error(`Cannot merge into non-object value at ${key}`);
    }
    return this.set(key, { ...current, ...value }, updatedBy);
  }

  /**
   * Получить историю изменений ключа
   */
  getHistory(key, limit = null) {
    const history = this.history.get(key) || [];
    return limit ? history.slice(-limit) : history;
  }

  /**
   * Получить версию конкретного состояния
   */
  getVersion(key, version) {
    const history = this.history.get(key) || [];
    return history.find(entry => entry.version === version);
  }

  /**
   * Откатиться к предыдущей версии
   */
  rollback(key, version, rolledBackBy = 'system') {
    const targetVersion = this.getVersion(key, version);
    if (!targetVersion) {
      throw new Error(`Version ${version} not found for key ${key}`);
    }

    return this.set(key, targetVersion.value, rolledBackBy);
  }

  /**
   * Очистить всё состояние
   */
  clear() {
    this.logger.info('[SharedState] Clearing all state');
    this.state.clear();
    this.history.clear();
    this.emit('clear');
  }

  /**
   * Подписаться на изменения ключа
   */
  watch(key, callback) {
    this.on(`change:${key}`, callback);
    return () => this.off(`change:${key}`, callback);
  }

  /**
   * Статистика
   */
  getStats() {
    return {
      keysCount: this.state.size,
      totalVersions: Array.from(this.history.values())
        .reduce((sum, h) => sum + h.length, 0),
      keys: this.keys()
    };
  }

  /**
   * Экспорт состояния
   */
  export() {
    const exported = {};
    for (const [key, entry] of this.state.entries()) {
      exported[key] = {
        value: entry.value,
        version: entry.version,
        updatedAt: entry.updatedAt,
        updatedBy: entry.updatedBy
      };
    }
    return exported;
  }

  /**
   * Импорт состояния
   */
  import(data, importedBy = 'system') {
    for (const [key, entry] of Object.entries(data)) {
      this.set(key, entry.value, importedBy);
    }
    this.logger.info(`[SharedState] Imported ${Object.keys(data).length} keys`);
  }
}

module.exports = { SharedState };
