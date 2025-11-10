/**
 * ChatGPT Provider - автоматизация работы с chat.openai.com
 * Управление через web-интерфейс без использования API ключей
 */

class ChatGPTProvider {
  constructor(page, logger, options = {}) {
    this.page = page;
    this.logger = logger;
    this.options = options;
    this.baseUrl = 'https://chat.openai.com';
    this.isAuthenticated = false;
  }

  /**
   * Инициализация провайдера
   */
  async initialize() {
    try {
      this.logger.info('[ChatGPT] Инициализация провайдера...');

      // Переходим на страницу ChatGPT
      await this.page.goto(this.baseUrl, {
        waitUntil: 'networkidle',
        timeout: 30000
      });

      // Проверяем авторизацию
      await this.checkAuthentication();

      if (!this.isAuthenticated) {
        this.logger.warn('[ChatGPT] Требуется авторизация. Используйте метод authenticate()');
      } else {
        this.logger.info('[ChatGPT] ✓ Провайдер инициализирован (авторизован)');
      }
    } catch (error) {
      this.logger.error('[ChatGPT] Ошибка инициализации:', error);
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
        // Ищем textarea для ввода промпта или другие характерные элементы
        const textarea = document.querySelector('textarea[placeholder*="Message"]') ||
                        document.querySelector('textarea[data-id="root"]');
        return !!textarea;
      });

      this.isAuthenticated = isLoggedIn;
      return isLoggedIn;
    } catch (error) {
      this.logger.error('[ChatGPT] Ошибка проверки авторизации:', error);
      return false;
    }
  }

  /**
   * Авторизация (требует ручного входа или сохраненных cookies)
   */
  async authenticate(credentials = null) {
    try {
      this.logger.info('[ChatGPT] Начало авторизации...');

      if (credentials && credentials.sessionToken) {
        // Устанавливаем сохраненные cookies
        await this.page.context().addCookies(credentials.cookies);
        await this.page.reload();
        await this.page.waitForTimeout(2000);
      } else {
        // Ожидаем ручной авторизации
        this.logger.info('[ChatGPT] Ожидание ручной авторизации пользователем...');
        this.logger.info('[ChatGPT] После авторизации вызовите checkAuthentication()');
        return false;
      }

      // Проверяем результат
      const authenticated = await this.checkAuthentication();

      if (authenticated) {
        this.logger.info('[ChatGPT] ✓ Авторизация успешна');
      } else {
        this.logger.warn('[ChatGPT] Авторизация не удалась');
      }

      return authenticated;
    } catch (error) {
      this.logger.error('[ChatGPT] Ошибка авторизации:', error);
      throw error;
    }
  }

  /**
   * Отправить промпт
   */
  async sendPrompt(prompt, options = {}) {
    if (!this.isAuthenticated) {
      throw new Error('ChatGPT: не авторизован. Вызовите authenticate() сначала.');
    }

    try {
      this.logger.info('[ChatGPT] Отправка промпта...');

      // Ждем загрузки интерфейса
      await this.page.waitForSelector('textarea', { timeout: 10000 });

      // Находим textarea для ввода
      const textarea = await this.page.$('textarea[placeholder*="Message"]') ||
                      await this.page.$('textarea[data-id="root"]') ||
                      await this.page.$('textarea');

      if (!textarea) {
        throw new Error('Не найден элемент для ввода текста');
      }

      // Вводим текст
      await textarea.click();
      await textarea.fill(prompt);

      // Небольшая задержка для корректного ввода
      await this.page.waitForTimeout(500);

      // Отправляем (ищем кнопку отправки)
      const sendButton = await this.page.$('button[data-testid="send-button"]') ||
                        await this.page.$('button[aria-label*="Send"]');

      if (sendButton) {
        await sendButton.click();
      } else {
        // Альтернативно - Enter
        await textarea.press('Enter');
      }

      this.logger.info('[ChatGPT] ✓ Промпт отправлен, ожидание ответа...');

      // Ждем появления ответа
      const response = await this.waitForResponse(options.timeout || 60000);

      this.logger.info('[ChatGPT] ✓ Ответ получен');

      return {
        success: true,
        response,
        timestamp: Date.now()
      };
    } catch (error) {
      this.logger.error('[ChatGPT] Ошибка отправки промпта:', error);
      throw error;
    }
  }

  /**
   * Ожидание ответа от модели
   */
  async waitForResponse(timeout = 60000) {
    try {
      const startTime = Date.now();

      // Ждем появления нового сообщения с ответом
      while (Date.now() - startTime < timeout) {
        const responseText = await this.page.evaluate(() => {
          // Ищем последнее сообщение ассистента
          const messages = Array.from(document.querySelectorAll('[data-message-author-role="assistant"]'));
          if (messages.length === 0) return null;

          const lastMessage = messages[messages.length - 1];

          // Проверяем, что генерация завершена (нет индикатора загрузки)
          const isGenerating = lastMessage.querySelector('[class*="loading"]') ||
                              lastMessage.querySelector('[class*="generating"]');

          if (isGenerating) return null;

          // Извлекаем текст
          const textElements = lastMessage.querySelectorAll('p, pre, code');
          return Array.from(textElements).map(el => el.textContent).join('\n');
        });

        if (responseText) {
          return responseText;
        }

        // Ждем перед следующей проверкой
        await this.page.waitForTimeout(500);
      }

      throw new Error('Timeout: ответ не получен за отведенное время');
    } catch (error) {
      this.logger.error('[ChatGPT] Ошибка ожидания ответа:', error);
      throw error;
    }
  }

  /**
   * Создать новый чат
   */
  async newChat() {
    try {
      this.logger.info('[ChatGPT] Создание нового чата...');

      const newChatButton = await this.page.$('a[href="/"]') ||
                           await this.page.$('button:has-text("New chat")');

      if (newChatButton) {
        await newChatButton.click();
        await this.page.waitForTimeout(1000);
        this.logger.info('[ChatGPT] ✓ Новый чат создан');
      }
    } catch (error) {
      this.logger.error('[ChatGPT] Ошибка создания чата:', error);
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
        const messageElements = document.querySelectorAll('[data-message-author-role]');

        messageElements.forEach(el => {
          const role = el.getAttribute('data-message-author-role');
          const textElements = el.querySelectorAll('p, pre, code');
          const text = Array.from(textElements).map(e => e.textContent).join('\n');

          messages.push({ role, text });
        });

        return messages;
      });

      return history;
    } catch (error) {
      this.logger.error('[ChatGPT] Ошибка получения истории:', error);
      return [];
    }
  }
}

module.exports = { ChatGPTProvider };
