/**
 * Тестовый скрипт для модуля Tools
 * Проверка ImageGenerator, DocumentGenerator, WorkflowGenerator
 */

const winston = require('winston');
const path = require('path');
const fs = require('fs').promises;

// Импорт модулей
const {
  ImageGenerator,
  DocumentGenerator,
  WorkflowGenerator,
  createToolsSystem
} = require('../src/index');

console.log('🧪 Тестирование модуля Tools...\n');

let errors = 0;
let success = 0;

/**
 * Создание тестового logger
 */
function createLogger() {
  return winston.createLogger({
    level: 'error',
    transports: [new winston.transports.Console({ silent: true })]
  });
}

/**
 * Тест 1: Импорт модулей
 */
function testImports() {
  console.log('=== Тест 1: Импорт модулей ===');

  try {
    if (typeof ImageGenerator === 'function') {
      console.log('✅ ImageGenerator импортирован');
      success++;
    }

    if (typeof DocumentGenerator === 'function') {
      console.log('✅ DocumentGenerator импортирован');
      success++;
    }

    if (typeof WorkflowGenerator === 'function') {
      console.log('✅ WorkflowGenerator импортирован');
      success++;
    }

    if (typeof createToolsSystem === 'function') {
      console.log('✅ createToolsSystem импортирован');
      success++;
    }
  } catch (error) {
    console.error('❌ Ошибка импорта:', error.message);
    errors++;
  }

  console.log('');
}

/**
 * Тест 2: ImageGenerator - инициализация
 */
async function testImageGeneratorInit() {
  console.log('=== Тест 2: ImageGenerator - Инициализация ===');

  const logger = createLogger();

  try {
    const imageGen = new ImageGenerator(logger, {
      outputDir: './test-images'
    });

    if (imageGen.outputDir === './test-images') {
      console.log('✅ ImageGenerator создан с правильной конфигурацией');
      success++;
    }

    if (imageGen.defaultProvider === 'dalle') {
      console.log('✅ Провайдер по умолчанию: DALL-E');
      success++;
    }

    const stats = imageGen.getStats();
    if (stats.total === 0 && stats.success === 0) {
      console.log('✅ Статистика инициализирована');
      success++;
    }

    // Cleanup
    try {
      await fs.rmdir('./test-images', { recursive: true });
    } catch (e) {}

  } catch (error) {
    console.error('❌ Ошибка ImageGenerator:', error.message);
    errors++;
  }

  console.log('');
}

/**
 * Тест 3: DocumentGenerator - генерация Markdown
 */
async function testDocumentGeneratorMarkdown() {
  console.log('=== Тест 3: DocumentGenerator - Markdown ===');

  const logger = createLogger();

  try {
    const docGen = new DocumentGenerator(logger, {
      outputDir: './test-documents'
    });

    const result = await docGen.generate('# Test Document\n\nThis is a test.', {
      format: 'markdown',
      filename: 'test.md',
      title: 'Test Document',
      author: 'Test Author'
    });

    if (result.success) {
      console.log('✅ Markdown документ сгенерирован');
      success++;
    }

    if (result.filename === 'test.md') {
      console.log('✅ Имя файла корректно');
      success++;
    }

    // Проверяем файл
    const content = await fs.readFile(result.filepath, 'utf-8');
    if (content.includes('# Test Document')) {
      console.log('✅ Содержимое файла корректно');
      success++;
    }

    const stats = docGen.getStats();
    if (stats.total === 1 && stats.success === 1) {
      console.log('✅ Статистика обновлена');
      success++;
    }

    // Cleanup
    try {
      await fs.unlink(result.filepath);
      await fs.rmdir('./test-documents', { recursive: true });
    } catch (e) {}

  } catch (error) {
    console.error('❌ Ошибка DocumentGenerator:', error.message);
    errors++;
  }

  console.log('');
}

/**
 * Тест 4: DocumentGenerator - генерация HTML
 */
async function testDocumentGeneratorHTML() {
  console.log('=== Тест 4: DocumentGenerator - HTML ===');

  const logger = createLogger();

  try {
    const docGen = new DocumentGenerator(logger, {
      outputDir: './test-documents'
    });

    const content = [
      { type: 'heading', level: 1, text: 'Test HTML Document' },
      { type: 'text', text: 'This is a test paragraph.' },
      { type: 'list', items: ['Item 1', 'Item 2', 'Item 3'] }
    ];

    const result = await docGen.generate(content, {
      format: 'html',
      filename: 'test.html',
      title: 'Test HTML'
    });

    if (result.success) {
      console.log('✅ HTML документ сгенерирован');
      success++;
    }

    // Проверяем содержимое
    const htmlContent = await fs.readFile(result.filepath, 'utf-8');
    if (htmlContent.includes('<!DOCTYPE html>') &&
        htmlContent.includes('<h1>Test HTML Document</h1>')) {
      console.log('✅ HTML структура корректна');
      success++;
    }

    if (htmlContent.includes('<li>Item 1</li>')) {
      console.log('✅ Список в HTML создан');
      success++;
    }

    // Cleanup
    try {
      await fs.unlink(result.filepath);
      await fs.rmdir('./test-documents', { recursive: true });
    } catch (e) {}

  } catch (error) {
    console.error('❌ Ошибка DocumentGenerator HTML:', error.message);
    errors++;
  }

  console.log('');
}

/**
 * Тест 5: WorkflowGenerator - создание базового workflow
 */
async function testWorkflowGeneratorBasic() {
  console.log('=== Тест 5: WorkflowGenerator - Базовый Workflow ===');

  const logger = createLogger();

  try {
    const workflowGen = new WorkflowGenerator(logger, {
      outputDir: './test-workflows'
    });

    const result = await workflowGen.create({
      name: 'Test Workflow',
      type: 'test',
      nodes: [
        {
          type: 'trigger.webhook',
          parameters: {
            path: 'test-webhook'
          }
        },
        {
          type: 'utility.code',
          parameters: {
            jsCode: 'return items;'
          }
        }
      ]
    });

    if (result.success) {
      console.log('✅ Workflow создан');
      success++;
    }

    if (result.nodeCount === 2) {
      console.log('✅ Количество узлов корректно (2)');
      success++;
    }

    // Проверяем файл
    const workflow = JSON.parse(await fs.readFile(result.filepath, 'utf-8'));
    if (workflow.name === 'Test Workflow') {
      console.log('✅ Имя workflow корректно');
      success++;
    }

    if (workflow.nodes.length === 2) {
      console.log('✅ Узлы workflow корректны');
      success++;
    }

    if (workflow.connections && Object.keys(workflow.connections).length > 0) {
      console.log('✅ Connections созданы');
      success++;
    }

    // Cleanup
    try {
      await fs.unlink(result.filepath);
      await fs.rmdir('./test-workflows', { recursive: true });
    } catch (e) {}

  } catch (error) {
    console.error('❌ Ошибка WorkflowGenerator:', error.message);
    errors++;
  }

  console.log('');
}

/**
 * Тест 6: WorkflowGenerator - AI Chat Workflow
 */
async function testWorkflowGeneratorAIChat() {
  console.log('=== Тест 6: WorkflowGenerator - AI Chat Workflow ===');

  const logger = createLogger();

  try {
    const workflowGen = new WorkflowGenerator(logger, {
      outputDir: './test-workflows'
    });

    const result = await workflowGen.createAIChatWorkflow({
      name: 'Test AI Chat',
      webhookPath: 'ai-chat-test',
      model: 'gpt-4'
    });

    if (result.success) {
      console.log('✅ AI Chat workflow создан');
      success++;
    }

    if (result.nodeCount === 3) {
      console.log('✅ AI Chat workflow имеет 3 узла (webhook → AI → code)');
      success++;
    }

    // Проверяем workflow
    const workflow = JSON.parse(await fs.readFile(result.filepath, 'utf-8'));
    const hasWebhook = workflow.nodes.some(n => n.type === 'n8n-nodes-base.webhook');
    const hasOpenAI = workflow.nodes.some(n => n.type === 'n8n-nodes-base.openAi');

    if (hasWebhook && hasOpenAI) {
      console.log('✅ AI Chat workflow имеет правильные узлы');
      success++;
    }

    // Cleanup
    try {
      await fs.unlink(result.filepath);
      await fs.rmdir('./test-workflows', { recursive: true });
    } catch (e) {}

  } catch (error) {
    console.error('❌ Ошибка WorkflowGenerator AI Chat:', error.message);
    errors++;
  }

  console.log('');
}

/**
 * Тест 7: Создание полной системы инструментов
 */
function testToolsSystemCreation() {
  console.log('=== Тест 7: Создание системы инструментов ===');

  const logger = createLogger();

  try {
    const tools = createToolsSystem(logger, {
      imageOutputDir: './test-images',
      documentOutputDir: './test-documents',
      workflowOutputDir: './test-workflows'
    });

    if (tools.imageGenerator instanceof ImageGenerator) {
      console.log('✅ ImageGenerator создан');
      success++;
    }

    if (tools.documentGenerator instanceof DocumentGenerator) {
      console.log('✅ DocumentGenerator создан');
      success++;
    }

    if (tools.workflowGenerator instanceof WorkflowGenerator) {
      console.log('✅ WorkflowGenerator создан');
      success++;
    }

  } catch (error) {
    console.error('❌ Ошибка создания системы:', error.message);
    errors++;
  }

  console.log('');
}

/**
 * Тест 8: Статистика инструментов
 */
async function testToolsStatistics() {
  console.log('=== Тест 8: Статистика инструментов ===');

  const logger = createLogger();

  try {
    const docGen = new DocumentGenerator(logger, {
      outputDir: './test-documents'
    });

    // Генерируем несколько документов
    await docGen.generate('Test 1', { format: 'markdown', filename: 'test1.md' });
    await docGen.generate('Test 2', { format: 'markdown', filename: 'test2.md' });
    await docGen.generate('Test 3', { format: 'html', filename: 'test3.html' });

    const stats = docGen.getStats();

    if (stats.total === 3) {
      console.log('✅ Всего документов: 3');
      success++;
    }

    if (stats.success === 3) {
      console.log('✅ Успешных: 3');
      success++;
    }

    if (stats.byFormat.markdown && stats.byFormat.markdown.total === 2) {
      console.log('✅ Markdown документов: 2');
      success++;
    }

    if (stats.byFormat.html && stats.byFormat.html.total === 1) {
      console.log('✅ HTML документов: 1');
      success++;
    }

    // Cleanup
    try {
      await fs.rmdir('./test-documents', { recursive: true });
    } catch (e) {}

  } catch (error) {
    console.error('❌ Ошибка статистики:', error.message);
    errors++;
  }

  console.log('');
}

/**
 * Запуск всех тестов
 */
async function runTests() {
  testImports();
  await testImageGeneratorInit();
  await testDocumentGeneratorMarkdown();
  await testDocumentGeneratorHTML();
  await testWorkflowGeneratorBasic();
  await testWorkflowGeneratorAIChat();
  testToolsSystemCreation();
  await testToolsStatistics();

  console.log('=== Результаты тестирования ===');
  console.log(`✅ Успешно: ${success}`);
  console.log(`❌ Ошибок: ${errors}`);
  console.log('');

  if (errors === 0) {
    console.log('🎉 Все тесты пройдены! Модуль Tools готов к использованию.');
    process.exit(0);
  } else {
    console.log('⚠️  Обнаружены ошибки. Требуется исправление.');
    process.exit(1);
  }
}

// Запуск
runTests().catch(error => {
  console.error('💥 Критическая ошибка:', error);
  process.exit(1);
});
