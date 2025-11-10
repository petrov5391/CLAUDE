/**
 * Демонстрация модуля Tools
 * Показывает работу генераторов изображений, документов и workflows
 */

const winston = require('winston');
const { createToolsSystem } = require('../tools/src');

// Создаем logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.colorize(),
    winston.format.simple()
  ),
  transports: [new winston.transports.Console()]
});

/**
 * Демонстрация
 */
async function demo() {
  console.log('\n🛠️  Демонстрация Tools Module\n');

  // Создаем систему инструментов
  const { imageGenerator, documentGenerator, workflowGenerator } = createToolsSystem(logger, {
    imageOutputDir: './demo-output/images',
    documentOutputDir: './demo-output/documents',
    workflowOutputDir: './demo-output/workflows'
  });

  console.log('✅ Система инструментов создана\n');

  // === 1. Генерация документов ===

  console.log('📄 === Генерация документов ===\n');

  // Markdown документ
  console.log('  📝 Генерация Markdown документа...');
  const markdownResult = await documentGenerator.generate([
    { type: 'heading', level: 1, text: 'AI Browser - Руководство пользователя' },
    { type: 'text', text: 'AI Browser - это инновационный браузер с интегрированными AI-агентами.' },
    { type: 'heading', level: 2, text: 'Возможности' },
    {
      type: 'list',
      items: [
        'Генерация изображений через DALL-E и Stable Diffusion',
        'Автоматическое создание документов',
        'Генерация n8n workflows',
        'Интеграция с множеством AI моделей'
      ]
    },
    { type: 'heading', level: 2, text: 'Быстрый старт' },
    { type: 'code', language: 'bash', text: 'npm install\nnpm run dev' }
  ], {
    format: 'markdown',
    filename: 'user-guide.md',
    title: 'AI Browser - Руководство пользователя',
    author: 'AI Browser Team',
    date: new Date().toISOString().split('T')[0]
  });

  if (markdownResult.success) {
    console.log(`  ✅ Markdown: ${markdownResult.filename} (${markdownResult.size} bytes)\n`);
  }

  // HTML документ
  console.log('  🌐 Генерация HTML документа...');
  const htmlResult = await documentGenerator.generate([
    { type: 'heading', level: 1, text: 'Отчет о работе AI моделей' },
    { type: 'text', text: 'Данный отчет содержит статистику работы AI моделей за последний час.' },
    { type: 'heading', level: 2, text: 'Статистика' },
    {
      type: 'list',
      items: [
        'Обработано задач: 152',
        'Успешно выполнено: 148 (97.4%)',
        'Среднее время выполнения: 2.3 секунды',
        'Наиболее активная модель: GPT-4 (85 задач)'
      ]
    }
  ], {
    format: 'html',
    filename: 'report.html',
    title: 'AI Models Report'
  });

  if (htmlResult.success) {
    console.log(`  ✅ HTML: ${htmlResult.filename} (${htmlResult.size} bytes)\n`);
  }

  // PDF документ (если установлен pdfkit)
  console.log('  📕 Генерация PDF документа...');
  try {
    const pdfResult = await documentGenerator.generate([
      { type: 'heading', text: 'AI Browser Technical Documentation' },
      { type: 'text', text: 'This document describes the technical architecture of AI Browser.' },
      { type: 'heading', text: 'Components' },
      {
        type: 'list',
        items: [
          'Electron App - main application',
          'Browser Control - Playwright automation',
          'Coordination - inter-model communication',
          'Task Queue - task management',
          'Tools - specialized generators'
        ]
      }
    ], {
      format: 'pdf',
      filename: 'technical-docs.pdf',
      title: 'Technical Documentation',
      author: 'AI Browser Team',
      subject: 'Architecture and Components'
    });

    if (pdfResult.success) {
      console.log(`  ✅ PDF: ${pdfResult.filename} (${pdfResult.size} bytes)\n`);
    }
  } catch (error) {
    console.log(`  ⚠️  PDF: ${error.message}\n`);
  }

  // DOCX документ (если установлен docx)
  console.log('  📘 Генерация DOCX документа...');
  try {
    const docxResult = await documentGenerator.generate([
      { type: 'heading', level: 1, text: 'Project Proposal' },
      { type: 'text', text: 'This proposal outlines the next steps for AI Browser development.' },
      { type: 'heading', level: 2, text: 'Goals' },
      {
        type: 'list',
        items: [
          'Implement Redis integration',
          'Add more AI model providers',
          'Improve UI/UX',
          'Write comprehensive tests'
        ]
      }
    ], {
      format: 'docx',
      filename: 'proposal.docx',
      title: 'AI Browser Proposal',
      author: 'Development Team'
    });

    if (docxResult.success) {
      console.log(`  ✅ DOCX: ${docxResult.filename} (${docxResult.size} bytes)\n`);
    }
  } catch (error) {
    console.log(`  ⚠️  DOCX: ${error.message}\n`);
  }

  // === 2. Генерация n8n workflows ===

  console.log('⚙️  === Генерация n8n Workflows ===\n');

  // AI Chat Workflow
  console.log('  💬 Создание AI Chat Workflow...');
  const chatWorkflow = await workflowGenerator.createAIChatWorkflow({
    name: 'AI Assistant Chatbot',
    webhookPath: 'chat',
    model: 'gpt-4',
    temperature: 0.7
  });

  if (chatWorkflow.success) {
    console.log(`  ✅ AI Chat: ${chatWorkflow.filename} (${chatWorkflow.nodeCount} nodes)\n`);
  }

  // Data Processing Workflow
  console.log('  📊 Создание Data Processing Workflow...');
  const dataWorkflow = await workflowGenerator.createDataProcessingWorkflow({
    name: 'Log Data Processor',
    webhookPath: 'process-logs',
    processingCode: `
      // Process log entries
      const processed = items.map(item => {
        const log = item.json;
        return {
          timestamp: new Date(log.timestamp).toISOString(),
          level: log.level.toUpperCase(),
          message: log.message,
          severity: log.level === 'error' ? 'high' : 'low'
        };
      });
      return processed;
    `,
    outputUrl: 'http://localhost:3000/api/logs'
  });

  if (dataWorkflow.success) {
    console.log(`  ✅ Data Processing: ${dataWorkflow.filename} (${dataWorkflow.nodeCount} nodes)\n`);
  }

  // Scheduled Workflow
  console.log('  ⏰ Создание Scheduled Workflow...');
  const scheduledWorkflow = await workflowGenerator.createScheduledWorkflow({
    name: 'Hourly Health Check',
    taskCode: `
      // Health check logic
      const services = ['api', 'database', 'cache'];
      const results = services.map(service => ({
        service,
        status: 'healthy',
        timestamp: new Date().toISOString()
      }));
      return [{ json: { services: results } }];
    `
  });

  if (scheduledWorkflow.success) {
    console.log(`  ✅ Scheduled: ${scheduledWorkflow.filename} (${scheduledWorkflow.nodeCount} nodes)\n`);
  }

  // Custom Workflow
  console.log('  🔧 Создание Custom Workflow...');
  const customWorkflow = await workflowGenerator.create({
    name: 'Image Analysis Pipeline',
    type: 'image-processing',
    nodes: [
      {
        type: 'trigger.webhook',
        parameters: { path: 'analyze-image', httpMethod: 'POST' }
      },
      {
        type: 'utility.code',
        parameters: {
          jsCode: `
            // Extract image URL from request
            return [{
              json: {
                imageUrl: $json.url,
                requestedAt: new Date().toISOString()
              }
            }];
          `
        }
      },
      {
        type: 'ai.openai',
        parameters: {
          operation: 'analyze',
          model: 'gpt-4-vision',
          prompt: 'Describe this image in detail'
        }
      },
      {
        type: 'output.http',
        parameters: {
          method: 'POST',
          url: 'http://localhost:3000/api/results'
        }
      }
    ],
    active: true,
    tags: ['ai', 'vision', 'image-analysis']
  });

  if (customWorkflow.success) {
    console.log(`  ✅ Custom: ${customWorkflow.filename} (${customWorkflow.nodeCount} nodes)\n`);
  }

  // === 3. Статистика ===

  console.log('📊 === Статистика ===\n');

  const docStats = documentGenerator.getStats();
  console.log('  Документы:');
  console.log(`    Всего: ${docStats.total}`);
  console.log(`    Успешно: ${docStats.success}`);
  console.log(`    Успешность: ${docStats.successRate}`);
  console.log('    По форматам:');
  for (const [format, stats] of Object.entries(docStats.byFormat)) {
    console.log(`      ${format}: ${stats.total} (успешно: ${stats.success})`);
  }

  console.log('');

  const workflowStats = workflowGenerator.getStats();
  console.log('  Workflows:');
  console.log(`    Всего: ${workflowStats.total}`);
  console.log(`    Успешно: ${workflowStats.success}`);
  console.log(`    Успешность: ${workflowStats.successRate}`);
  console.log('    По типам:');
  for (const [type, stats] of Object.entries(workflowStats.byType)) {
    console.log(`      ${type}: ${stats.total} (успешно: ${stats.success})`);
  }

  console.log('');

  // === 4. Список сгенерированных файлов ===

  console.log('📁 === Сгенерированные файлы ===\n');

  const documents = await documentGenerator.listGenerated();
  console.log(`  Документов: ${documents.length}`);
  documents.slice(0, 5).forEach(doc => {
    console.log(`    - ${doc.filename} (${doc.format}, ${doc.size} bytes)`);
  });

  console.log('');

  const workflows = await workflowGenerator.listGenerated();
  console.log(`  Workflows: ${workflows.length}`);
  workflows.slice(0, 5).forEach(wf => {
    console.log(`    - ${wf.name} (${wf.nodeCount} nodes)`);
  });

  console.log('\n✅ Демонстрация завершена!\n');
  console.log('📂 Файлы сохранены в: ./demo-output/\n');
}

// Запуск
demo().catch(console.error);
