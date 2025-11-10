/**
 * Browser Control - точка входа
 * Экспортирует все необходимые модули для управления браузером
 */

const { BrowserController } = require('./browser-controller');
const { BrowserSession } = require('./browser-session');
const { ChatGPTProvider } = require('./providers/chatgpt-provider');
const { ClaudeProvider } = require('./providers/claude-provider');
const { DeepSeekProvider } = require('./providers/deepseek-provider');

module.exports = {
  BrowserController,
  BrowserSession,
  providers: {
    ChatGPTProvider,
    ClaudeProvider,
    DeepSeekProvider
  }
};
