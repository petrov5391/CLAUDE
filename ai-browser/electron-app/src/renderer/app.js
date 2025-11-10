/**
 * Renderer процесс - логика Dashboard интерфейса
 */

// Проверяем доступность API
if (!window.electronAPI) {
  console.error('electronAPI не доступен! Проверьте preload скрипт.');
}

const { tabs, ai, system, utils } = window.electronAPI;

// Глобальное состояние
const state = {
  tabs: [],
  models: [],
  logs: [],
  systemInfo: null,
  startTime: Date.now()
};

/**
 * Инициализация приложения
 */
async function initialize() {
  console.log('🚀 Инициализация Dashboard...');

  try {
    // Загружаем системную информацию
    state.systemInfo = await system.getInfo();
    console.log('✓ Системная информация загружена', state.systemInfo);

    // Загружаем список моделей
    await loadModels();

    // Загружаем вкладки
    await loadTabs();

    // Загружаем логи
    await loadLogs();

    // Обновляем статистику
    updateStatistics();

    // Запускаем периодическое обновление
    startPeriodicUpdates();

    // Подписываемся на события
    subscribeToEvents();

    console.log('✓ Dashboard инициализирован успешно');
  } catch (error) {
    console.error('❌ Ошибка инициализации:', error);
  }
}

/**
 * Загрузка списка AI моделей
 */
async function loadModels() {
  try {
    state.models = await ai.listModels();
    console.log(`✓ Загружено ${state.models.length} моделей`);

    renderModels();
  } catch (error) {
    console.error('Ошибка загрузки моделей:', error);
  }
}

/**
 * Отображение списка моделей
 */
function renderModels() {
  const container = document.getElementById('models-list');

  if (state.models.length === 0) {
    container.innerHTML = '<div class="empty-state"><div>Модели не найдены</div></div>';
    return;
  }

  container.innerHTML = state.models
    .slice(0, 5) // Показываем только первые 5
    .map(model => {
      const badgeClass = model.type === 'web' ? 'web' : model.type === 'local' ? 'local' : '';
      return `
        <div class="model-item">
          <div class="model-info">
            <div class="model-name">${model.name}</div>
            <div class="model-provider">${model.provider}</div>
          </div>
          <div class="model-badge ${badgeClass}">${model.type.toUpperCase()}</div>
        </div>
      `;
    })
    .join('');
}

/**
 * Загрузка вкладок
 */
async function loadTabs() {
  try {
    state.tabs = await tabs.getAll();
    console.log(`✓ Загружено ${state.tabs.length} вкладок`);

    renderTabs();
  } catch (error) {
    console.error('Ошибка загрузки вкладок:', error);
  }
}

/**
 * Отображение списка вкладок
 */
function renderTabs() {
  const container = document.getElementById('tabs-list');

  if (state.tabs.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📑</div>
        <div class="empty-state-text">Нет открытых вкладок</div>
      </div>
    `;
    return;
  }

  container.innerHTML = state.tabs
    .map(tab => `
      <div class="tab-item" onclick="selectTab('${tab.id}')">
        <div class="tab-item-title">${tab.title}</div>
        <div class="tab-item-url">${tab.url}</div>
        ${tab.modelId ? `<div class="tab-item-model">🤖 ${tab.modelId}</div>` : ''}
      </div>
    `)
    .join('');
}

/**
 * Загрузка логов
 */
async function loadLogs() {
  try {
    const logs = await system.getLogs(50);
    state.logs = logs;

    renderLogs();
  } catch (error) {
    console.error('Ошибка загрузки логов:', error);
  }
}

/**
 * Отображение логов
 */
function renderLogs() {
  const container = document.getElementById('log-container');

  if (state.logs.length === 0) {
    container.innerHTML = '<div class="log-entry">Логи пусты</div>';
    return;
  }

  container.innerHTML = state.logs
    .slice(-20) // Последние 20 записей
    .map(log => {
      // Парсим лог (формат: timestamp [LEVEL] message)
      const match = log.match(/(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}) \[(\w+)\] (.+)/);

      if (!match) {
        return `<div class="log-entry">${log}</div>`;
      }

      const [, timestamp, level, message] = match;
      const levelClass = level.toLowerCase();

      return `
        <div class="log-entry">
          <span class="log-timestamp">[${timestamp}]</span>
          <span class="log-level ${levelClass}">[${level}]</span>
          <span>${message}</span>
        </div>
      `;
    })
    .join('');

  // Прокручиваем вниз
  container.scrollTop = container.scrollHeight;
}

/**
 * Обновление статистики
 */
function updateStatistics() {
  document.getElementById('stat-tabs').textContent = state.tabs.length;
  document.getElementById('stat-models').textContent = state.models.length;
  document.getElementById('stat-tasks').textContent = '0'; // TODO: Реальное количество задач

  // Время работы
  const uptime = Math.floor((Date.now() - state.startTime) / 1000 / 60);
  document.getElementById('stat-uptime').textContent = `${uptime}m`;
}

/**
 * Создание новой вкладки
 */
async function createNewTab() {
  try {
    console.log('Создание новой вкладки...');

    const result = await tabs.create({
      url: 'https://google.com',
      modelId: null,
      isolated: true
    });

    if (result.success) {
      console.log('✓ Вкладка создана:', result.tabId);
      await loadTabs();
      updateStatistics();
    } else {
      console.error('Ошибка создания вкладки:', result.error);
    }
  } catch (error) {
    console.error('Ошибка:', error);
  }
}

/**
 * Выбор вкладки
 */
function selectTab(tabId) {
  console.log('Выбрана вкладка:', tabId);
  // TODO: Переключение на вкладку
}

/**
 * Обновление Dashboard
 */
async function refreshDashboard() {
  console.log('Обновление Dashboard...');
  await loadTabs();
  await loadModels();
  await loadLogs();
  updateStatistics();
}

/**
 * Открытие настроек
 */
function openSettings() {
  console.log('Открытие настроек...');
  // TODO: Открыть окно настроек
  alert('Настройки будут реализованы в следующей версии');
}

/**
 * Периодическое обновление данных
 */
function startPeriodicUpdates() {
  // Обновляем статистику каждую секунду
  setInterval(() => {
    updateStatistics();
  }, 1000);

  // Обновляем логи каждые 5 секунд
  setInterval(async () => {
    await loadLogs();
  }, 5000);

  // Обновляем вкладки каждые 10 секунд
  setInterval(async () => {
    await loadTabs();
  }, 10000);
}

/**
 * Подписка на события
 */
function subscribeToEvents() {
  // События вкладок
  tabs.onTabCreated((data) => {
    console.log('Событие: вкладка создана', data);
    loadTabs();
  });

  tabs.onTabClosed((data) => {
    console.log('Событие: вкладка закрыта', data);
    loadTabs();
  });

  tabs.onTabUpdated((data) => {
    console.log('Событие: вкладка обновлена', data);
    loadTabs();
  });

  // События AI
  ai.onModelResponse((data) => {
    console.log('Событие: ответ от модели', data);
  });

  ai.onModelError((data) => {
    console.error('Событие: ошибка модели', data);
  });

  // События системы
  system.onLog((data) => {
    console.log('Событие: новый лог', data);
    state.logs.push(data);
    renderLogs();
  });
}

// Запускаем инициализацию при загрузке страницы
document.addEventListener('DOMContentLoaded', initialize);

// Экспортируем функции для использования из HTML
window.createNewTab = createNewTab;
window.refreshDashboard = refreshDashboard;
window.openSettings = openSettings;
window.selectTab = selectTab;
