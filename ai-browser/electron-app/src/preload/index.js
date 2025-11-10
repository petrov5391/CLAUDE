/**
 * Preload скрипт для безопасного взаимодействия между main и renderer процессами
 * Предоставляет API для renderer через contextBridge
 */

const { contextBridge, ipcRenderer } = require('electron');

/**
 * API для взаимодействия с главным процессом
 */
const api = {
  // === Управление вкладками ===
  tabs: {
    create: (options) => ipcRenderer.invoke('tab:create', options),
    close: (tabId) => ipcRenderer.invoke('tab:close', tabId),
    navigate: (tabId, url) => ipcRenderer.invoke('tab:navigate', { tabId, url }),
    getAll: () => ipcRenderer.invoke('tab:getAll'),

    // Подписка на события вкладок
    onTabCreated: (callback) => {
      ipcRenderer.on('tab:created', (event, data) => callback(data));
    },
    onTabClosed: (callback) => {
      ipcRenderer.on('tab:closed', (event, data) => callback(data));
    },
    onTabUpdated: (callback) => {
      ipcRenderer.on('tab:updated', (event, data) => callback(data));
    }
  },

  // === Управление AI моделями ===
  ai: {
    listModels: () => ipcRenderer.invoke('ai:listModels'),
    assignModel: (tabId, modelId, config) =>
      ipcRenderer.invoke('ai:assignModel', { tabId, modelId, config }),
    sendPrompt: (tabId, prompt, context) =>
      ipcRenderer.invoke('ai:sendPrompt', { tabId, prompt, context }),

    // События от моделей
    onModelResponse: (callback) => {
      ipcRenderer.on('ai:response', (event, data) => callback(data));
    },
    onModelError: (callback) => {
      ipcRenderer.on('ai:error', (event, data) => callback(data));
    }
  },

  // === Системная информация ===
  system: {
    getInfo: () => ipcRenderer.invoke('system:getInfo'),
    getLogs: (limit) => ipcRenderer.invoke('system:getLogs', { limit }),

    // События системы
    onLog: (callback) => {
      ipcRenderer.on('system:log', (event, data) => callback(data));
    }
  },

  // === Утилиты ===
  utils: {
    // Валидация URL
    isValidURL: (string) => {
      try {
        new URL(string);
        return true;
      } catch (_) {
        return false;
      }
    },

    // Форматирование времени
    formatTime: (timestamp) => {
      return new Date(timestamp).toLocaleString('ru-RU');
    }
  }
};

// Экспортируем API в renderer процесс
contextBridge.exposeInMainWorld('electronAPI', api);

// Логируем успешную загрузку preload
console.log('✓ Preload скрипт загружен успешно');
