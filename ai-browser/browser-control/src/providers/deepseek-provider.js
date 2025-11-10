/**
 * DeepSeek Provider - автоматизация работы с chat.deepseek.com
 * Управление через web-интерфейс без использования API ключей
 */

class DeepSeekProvider {
  constructor(page, logger, options = {}) {
    this.page = page;
    this.logger = logger;
    this.options = options;
    this.baseUrl = 'https://chat.deepseek.com';
    this.isAuthenticated = false;
  }

  /**
   * Инициализация провайдера
   */
  async initialize() {
    try {
      this.logger.info('[DeepSeek] Инициализация провайдера...');

      // Переходим на страницу DeepSeek
      await this.page.goto(this.baseUrl, {
        waitUntil: 'networkidle',
        timeout: 30000
      });

      // Проверяем авторизацию
      await this.checkAuthentication();

      if (!this.isAuthenticated) {
        this.logger.warn('[DeepSeek] Требуется авторизация. Используйте метод authenticate()');
      } else {
        this.logger.info('[DeepSeek] ✓ Провайдер инициализирован (авторизован)');
      }
    } catch (error) {
      this.logger.error('[DeepSeek] Ошибка инициализации:', error);
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
        // Ищем textarea для ввода или другие характерные элементы
        const textarea = document.querySelector('textarea') ||
                        document.querySelector('[contenteditable="true"]') ||
                        document.querySelector('input[type="text"]');
        return !!textarea;
      });

      this.isAuthenticated = isLoggedIn;
      return isLoggedIn;
    } catch (error) {
      this.logger.error('[DeepSeek] Ошибка проверки авторизации:', error);
      return false;
    }
  }

  /**
   * Авторизация
   */
  async authenticate(credentials = null) {
    try {
      this.logger.info('[DeepSeek] Начало авторизации...');

      if (credentials && credentials.cookies) {
        // Устанавливаем сохраненные cookies
        await this.page.context().addCookies(credentials.cookies);
        await this.page.reload();
        await this.page.waitForTimeout(2000);
      } else {
        // Ожидаем ручной авторизации
        this.logger.info('[DeepSeek] Ожидание ручной авторизации пользователем...');
        return false;
      }

      // Проверяем результат
      const authenticated = await this.checkAuthentication();

      if (authenticated) {
        this.logger.info('[DeepSeek] ✓ Авторизация успешна');
      } else {
        this.logger.warn('[DeepSeek] Авторизация не удалась');
      }

      return authenticated;
    } catch (error) {
      this.logger.error('[DeepSeek] Ошибка авторизации:', error);
      throw error;
    }
  }

  /**
   * Отправить промпт
   */
  async sendPrompt(prompt, options = {}) {
    if (!this.isAuthenticated) {
      throw new Error('DeepSeek: не авторизован. Вызовите authenticate() сначала.');
    }

    try {
      this.logger.info('[DeepSeek] Отправка промпта...');

      // Ждем загрузки интерфейса
      await this.page.waitForSelector('textarea, [contenteditable="true"]', { timeout: 10000 });

      // Находим поле ввода
      const inputField = await this.page.$('textarea') ||
                        await this.page.$('[contenteditable="true"]');

      if (!inputField) {
        throw new Error('Не найден элемент для ввода текста');
      }

      // Вводим текст
      await inputField.click();
      await inputField.fill(prompt);

      // Небольшая задержка
      await this.page.waitForTimeout(500);

      // Отправляем
      const sendButton = await this.page.$('button[type="submit"]') ||
                        await this.page.$('button:has-text("Send")') ||
                        await this.page.$('[aria-label*="Send"]');

      if (sendButton) {
        await sendButton.click();
      } else {
        // Альтернативно - Enter
        await inputField.press('Enter');
      }

      this.logger.info('[DeepSeek] ✓ Промпт отправлен, ожидание ответа...');

      // Ждем появления ответа
      const response = await this.waitForResponse(options.timeout || 60000);

      this.logger.info('[DeepSeek] ✓ Ответ получен');

      return {
        success: true,
        response,
        timestamp: Date.now()
      };
    } catch (error) {
      this.logger.error('[DeepSeek] Ошибка отправки промпта:', error);
      throw error;
    }
  }

  /**
   * Ожидание ответа от модели
   */
  async waitForResponse(timeout = 60000) {
    try {
      const startTime = Date.now();
      let lastResponseLength = 0;
      let stableCount = 0;

      // Ждем стабилизации ответа
      while (Date.now() - startTime < timeout) {
        const responseText = await this.page.evaluate(() => {
          // Ищем последнее сообщение ассистента
          const messages = Array.from(document.querySelectorAll('[class*="message"], [class*="answer"]'));
          if (messages.length === 0) return null;

          const lastMessage = messages[messages.length - 1];

          // Проверяем, что это сообщение ассистента
          const isAssistant = !lastMessage.classList.contains('user') &&
                             !lastMessage.querySelector('[class*="user"]');

          if (!isAssistant) return null;

          // Извлекаем текст
          const text = lastMessage.textContent || lastMessage.innerText;
          return text;
        });

        if (responseText) {
          const currentLength = responseText.length;

          // Если длина не изменилась 3 раза подряд - ответ завершен
          if (currentLength === lastResponseLength && currentLength > 10) {
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
      this.logger.error('[DeepSeek] Ошибка ожидания ответа:', error);
      throw error;
    }
  }

  /**
   * Создать новый чат
   */
  async newChat() {
    try {
      this.logger.info('[DeepSeek] Создание нового чата...');

      const newChatButton = await this.page.$('button:has-text("New")') ||
                           await this.page.$('a[href="/"]');

      if (newChatButton) {
        await newChatButton.click();
        await this.page.waitForTimeout(1000);
        this.logger.info('[DeepSeek] ✓ Новый чат создан');
      }
    } catch (error) {
      this.logger.error('[DeepSeek] Ошибка создания чата:', error);
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
        const messageElements = document.querySelectorAll('[class*="message"], [class*="answer"]');

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
      this.logger.error('[DeepSeek] Ошибка получения истории:', error);
      return [];
    }
  }
}

module.exports = { DeepSeekProvider };
