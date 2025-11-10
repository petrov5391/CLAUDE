/**
 * Coordination Module - точка входа
 * Экспортирует все компоненты для межмодельной координации
 */

const { MessageBus } = require('./message-bus');
const { Coordinator } = require('./coordinator');
const { SharedState } = require('./shared-state');

/**
 * Создать полноценную систему координации
 */
function createCoordinationSystem(logger) {
  // Создаем компоненты
  const messageBus = new MessageBus(logger);
  const sharedState = new SharedState(logger);
  const coordinator = new Coordinator(messageBus, logger);

  // Связываем SharedState с MessageBus для синхронизации
  sharedState.on('change', (data) => {
    messageBus.publish('state:change', data, 'shared-state');
  });

  sharedState.on('delete', (data) => {
    messageBus.publish('state:delete', data, 'shared-state');
  });

  logger.info('[Coordination] Система координации создана');

  return {
    messageBus,
    coordinator,
    sharedState
  };
}

module.exports = {
  MessageBus,
  Coordinator,
  SharedState,
  createCoordinationSystem
};
