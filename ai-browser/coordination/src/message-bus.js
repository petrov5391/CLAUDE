/**
 * Message Bus - шина сообщений для межмодельной коммуникации
 * Обеспечивает pub/sub паттерн для обмена сообщениями между AI моделями
 */

const EventEmitter = require('eventemitter3');
const { v4: uuidv4 } = require('uuid');

class MessageBus extends EventEmitter {
  constructor(logger) {
    super();
    this.logger = logger;
    this.messages = []; // История сообщений
    this.subscribers = new Map(); // topic -> Set of subscribers
    this.maxHistorySize = 1000; // Максимальный размер истории
  }

  /**
   * Отправить сообщение в шину
   */
  publish(topic, data, sender = null) {
    const message = {
      id: uuidv4(),
      topic,
      data,
      sender,
      timestamp: Date.now()
    };

    // Сохраняем в историю
    this.messages.push(message);
    if (this.messages.length > this.maxHistorySize) {
      this.messages.shift(); // Удаляем старые сообщения
    }

    this.logger.debug(`[MessageBus] Publish: ${topic} from ${sender || 'unknown'}`);

    // Отправляем подписчикам
    this.emit(topic, message);

    // Также отправляем в общий канал (для глобальных подписчиков)
    this.emit('*', message);

    return message.id;
  }

  /**
   * Подписаться на топик
   */
  subscribe(topic, callback, subscriberId = null) {
    this.logger.debug(`[MessageBus] Subscribe: ${subscriberId || 'anonymous'} -> ${topic}`);

    // Добавляем в список подписчиков
    if (!this.subscribers.has(topic)) {
      this.subscribers.set(topic, new Set());
    }
    this.subscribers.get(topic).add(subscriberId || 'anonymous');

    // Подписываемся на события
    this.on(topic, callback);

    // Возвращаем функцию для отписки
    return () => this.unsubscribe(topic, callback, subscriberId);
  }

  /**
   * Отписаться от топика
   */
  unsubscribe(topic, callback, subscriberId = null) {
    this.logger.debug(`[MessageBus] Unsubscribe: ${subscriberId || 'anonymous'} from ${topic}`);

    this.off(topic, callback);

    // Удаляем из списка подписчиков
    if (this.subscribers.has(topic)) {
      this.subscribers.get(topic).delete(subscriberId || 'anonymous');
      if (this.subscribers.get(topic).size === 0) {
        this.subscribers.delete(topic);
      }
    }
  }

  /**
   * Отправить запрос и ждать ответа (request-response паттерн)
   */
  async request(topic, data, sender, timeout = 30000) {
    return new Promise((resolve, reject) => {
      const requestId = uuidv4();
      const responseTopic = `${topic}:response:${requestId}`;

      // Таймаут
      const timeoutHandle = setTimeout(() => {
        this.unsubscribe(responseTopic, responseHandler);
        reject(new Error(`Request timeout: ${topic}`));
      }, timeout);

      // Обработчик ответа
      const responseHandler = (message) => {
        clearTimeout(timeoutHandle);
        this.unsubscribe(responseTopic, responseHandler);
        resolve(message.data);
      };

      // Подписываемся на ответ
      this.subscribe(responseTopic, responseHandler, sender);

      // Отправляем запрос
      this.publish(topic, {
        ...data,
        requestId,
        responseTopic
      }, sender);
    });
  }

  /**
   * Ответить на запрос
   */
  respond(requestMessage, responseData, sender) {
    if (!requestMessage.data.responseTopic) {
      this.logger.warn('[MessageBus] Attempt to respond to non-request message');
      return;
    }

    this.publish(requestMessage.data.responseTopic, responseData, sender);
  }

  /**
   * Получить историю сообщений
   */
  getHistory(filter = {}) {
    let filtered = this.messages;

    // Фильтр по топику
    if (filter.topic) {
      filtered = filtered.filter(m => m.topic === filter.topic);
    }

    // Фильтр по отправителю
    if (filter.sender) {
      filtered = filtered.filter(m => m.sender === filter.sender);
    }

    // Фильтр по времени
    if (filter.since) {
      filtered = filtered.filter(m => m.timestamp >= filter.since);
    }

    // Лимит
    if (filter.limit) {
      filtered = filtered.slice(-filter.limit);
    }

    return filtered;
  }

  /**
   * Получить список активных подписчиков
   */
  getSubscribers(topic = null) {
    if (topic) {
      return Array.from(this.subscribers.get(topic) || []);
    }

    // Все подписчики
    const all = {};
    for (const [t, subs] of this.subscribers.entries()) {
      all[t] = Array.from(subs);
    }
    return all;
  }

  /**
   * Очистить историю
   */
  clearHistory() {
    this.logger.info('[MessageBus] Clearing message history');
    this.messages = [];
  }

  /**
   * Статистика
   */
  getStats() {
    return {
      messagesCount: this.messages.length,
      topicsCount: this.subscribers.size,
      subscribersCount: Array.from(this.subscribers.values())
        .reduce((sum, subs) => sum + subs.size, 0),
      topics: Array.from(this.subscribers.keys())
    };
  }
}

module.exports = { MessageBus };
