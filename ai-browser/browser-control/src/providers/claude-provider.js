/**
 * Claude Provider - автоматизация работы с claude.ai
 * Управление через web-интерфейс без использования API ключей
 */

class ClaudeProvider {
  constructor(page, logger, options = {}) {
    this.page = page;
    this.logger = logger;
    this.options = options;
    this.baseUrl = 'https://claude.ai';
    this.isAuthenticated = false;
  }

  /**
   * Инициализация провайдера
   */
  async initialize() {
    try {
      this.logger.info('[Claude] Инициализация провайдера...');

      // Переходим на страницу Claude
      await this.page.goto(this.baseUrl, {
        waitUntil: 'networkidle',
        timeout: 30000
      });

      // Проверяем авторизацию
      await this.checkAuthentication();

      if (!this.isAuthenticated) {
        this.logger.warn('[Claude] Требуется авторизация. Используйте метод authenticate()');
      } else {
        this.logger.info('[Claude] ✓ Провайдер инициализирован (авторизован)');
      }
    } catch (error) {
      this.logger.error('[Claude] Ошибка инициализации:', error);
      throw error;
    }
  }

  /**
   * Проверка статуса авторизации
   */
  async checkAuthentication() {
    try {
      // Проверяем наличие элементов интерфейса чата
      const isLoggedIn = await this.page.evaluate(() => {
        // Ищем характерные элементы Claude интерфейса
        const chatInput = document.querySelector('[contenteditable="true"]') ||
                         document.querySelector('textarea') ||
                         document.querySelector('[placeholder*="Reply"]');
        return !!chatInput;
      });

      this.isAuthenticated = isLoggedIn;
      return isLoggedIn;
    } catch (error) {
      this.logger.error('[Claude] Ошибка проверки авторизации:', error);
      return false;
    }
  }

  /**
   * Авторизация
   */
  async authenticate(credentials = null) {
    try {
      this.logger.info('[Claude] Начало авторизации...');

      if (credentials && credentials.cookies) {
        // Устанавливаем сохраненные cookies
        await this.page.context().addCookies(credentials.cookies);
        await this.page.reload();
        await this.page.waitForTimeout(2000);
      } else {
        // Ожидаем ручной авторизации
        this.logger.info('[Claude] Ожидание ручной авторизации пользователем...');
        return false;
      }

      // Проверяем результат
      const authenticated = await this.checkAuthentication();

      if (authenticated) {
        this.logger.info('[Claude] ✓ Авторизация успешна');
      } else {
        this.logger.warn('[Claude] Авторизация не удалась');
      }

      return authenticated;
    } catch (error) {
      this.logger.error('[Claude] Ошибка авторизации:', error);
      throw error;
    }
  }

  /**
   * Отправить промпт
   */
  async sendPrompt(prompt, options = {}) {
    if (!this.isAuthenticated) {
      throw new Error('Claude: не авторизован. Вызовите authenticate() сначала.');
    }

    try {
      this.logger.info('[Claude] Отправка промпта...');

      // Ждем загрузки интерфейса
      await this.page.waitForTimeout(1000);

      // Находим поле ввода (Claude использует contenteditable)
      const inputField = await this.page.$('[contenteditable="true"]') ||
                        await this.page.$('textarea') ||
                        await this.page.$('[role="textbox"]');

      if (!inputField) {
        throw new Error('Не найден элемент для ввода текста');
      }

      // Вводим текст
      await inputField.click();
      await inputField.fill(prompt);

      // Небольшая задержка
      await this.page.waitForTimeout(500);

      // Отправляем (обычно Ctrl+Enter или кнопка)
      const sendButton = await this.page.$('button[aria-label*="Send"]') ||
                        await this.page.$('button:has-text("Send")');

      if (sendButton) {
        await sendButton.click();
      } else {
        // Альтернативно - Ctrl+Enter
        await this.page.keyboard.press('Control+Enter');
      }

      this.logger.info('[Claude] ✓ Промпт отправлен, ожидание ответа...');

      // Ждем появления ответа
      const response = await this.waitForResponse(options.timeout || 120000);

      this.logger.info('[Claude] ✓ Ответ получен');

      return {
        success: true,
        response,
        timestamp: Date.now()
      };
    } catch (error) {
      this.logger.error('[Claude] Ошибка отправки промпта:', error);
      throw error;
    }
  }

  /**
   * Ожидание ответа от модели
   */
  async waitForResponse(timeout = 120000) {
    try {
      const startTime = Date.now();
      let lastResponseLength = 0;
      let stableCount = 0;

      // Ждем стабилизации ответа (когда длина перестает меняться)
      while (Date.now() - startTime < timeout) {
        const responseText = await this.page.evaluate(() => {
          // Ищем последнее сообщение Claude (ассистента)
          const messages = Array.from(document.querySelectorAll('[data-is-streaming], [class*="message"]'));
          if (messages.length === 0) return null;

          // Берем последнее сообщение
          const lastMessage = messages[messages.length - 1];

          // Извлекаем текст
          const text = lastMessage.textContent || lastMessage.innerText;
          return text;
        });

        if (responseText) {
          const currentLength = responseText.length;

          // Если длина не изменилась несколько раз подряд - считаем ответ завершенным
          if (currentLength === lastResponseLength) {
            stableCount++;
            if (stableCount >= 3) {
              return responseText;
            }
          } else {
            stableCount = 0;
          }

          lastResponseLength = currentLength;
        }

        // Ждем перед следующей проверкой
        await this.page.waitForTimeout(1000);
      }

      throw new Error('Timeout: ответ не получен за отведенное время');
    } catch (error) {
      this.logger.error('[Claude] Ошибка ожидания ответа:', error);
      throw error;
    }
  }

  /**
   * Создать новый чат
   */
  async newChat() {
    try {
      this.logger.info('[Claude] Создание нового чата...');

      const newChatButton = await this.page.$('button:has-text("New Chat")') ||
                           await this.page.$('a[href*="/new"]');

      if (newChatButton) {
        await newChatButton.click();
        await this.page.waitForTimeout(1000);
        this.logger.info('[Claude] ✓ Новый чат создан');
      }
    } catch (error) {
      this.logger.error('[Claude] Ошибка создания чата:', error);
      throw error;
    }
  }

  /**
   * Получить историю чата
   */
  async getChatHistory() {
    try {
      const history = await this.page.evaluate(() => {
        const messages = [];
        const messageElements = document.querySelectorAll('[class*="message"]');

        messageElements.forEach(el => {
          const text = el.textContent || el.innerText;
          const isUser = el.classList.contains('user') || el.querySelector('[class*="user"]');
          const role = isUser ? 'user' : 'assistant';

          if (text.trim()) {
            messages.push({ role, text: text.trim() });
          }
        });

        return messages;
      });

      return history;
    } catch (error) {
      this.logger.error('[Claude] Ошибка получения истории:', error);
      return [];
    }
  }
}

module.exports = { ClaudeProvider };
