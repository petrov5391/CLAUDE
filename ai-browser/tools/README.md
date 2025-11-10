# Tools Module

Специализированные инструменты для AI Browser: генерация изображений, документов и n8n workflows.

## Возможности

- 🎨 **Image Generator** - генерация изображений через DALL-E и Stable Diffusion
- 📄 **Document Generator** - создание документов в форматах PDF, DOCX, Markdown, HTML
- ⚙️ **Workflow Generator** - генерация n8n workflows для автоматизации

## Установка

```bash
cd tools
npm install

# Опционально для PDF и DOCX:
npm install pdfkit docx
```

## Быстрый старт

```javascript
const winston = require('winston');
const { createToolsSystem } = require('./src');

const logger = winston.createLogger({
  level: 'info',
  transports: [new winston.transports.Console()]
});

// Создать все инструменты
const { imageGenerator, documentGenerator, workflowGenerator } = createToolsSystem(logger);

// Использование
```

## Image Generator

Генерация изображений через AI сервисы.

### Поддерживаемые провайдеры

- **DALL-E** (OpenAI) - через API
- **Stable Diffusion** - через локальный сервер или API
- **Midjourney** - в разработке

### Использование

```javascript
const { ImageGenerator } = require('./src');

const imageGen = new ImageGenerator(logger, {
  outputDir: './generated-images',
  defaultProvider: 'dalle',
  openaiApiKey: process.env.OPENAI_API_KEY
});

// Генерация через DALL-E
const result = await imageGen.generate(
  'A futuristic AI-powered browser interface',
  {
    provider: 'dalle',
    size: '1024x1024',
    quality: 'standard'
  }
);

console.log('Image generated:', result.filepath);
```

### Методы

#### `generate(prompt, options)`

Генерация изображения.

**Параметры:**
- `prompt` (string) - текстовое описание
- `options` (object):
  - `provider` ('dalle' | 'stable-diffusion') - провайдер
  - `size` (string) - размер изображения (DALL-E: '1024x1024', '1792x1024', '1024x1792')
  - `quality` ('standard' | 'hd') - качество (только DALL-E)
  - `count` (number) - количество изображений
  - `width`, `height` (number) - размеры (Stable Diffusion)
  - `steps` (number) - количество шагов (Stable Diffusion)
  - `cfgScale` (number) - CFG scale (Stable Diffusion)

**Возвращает:**
```javascript
{
  success: true,
  taskId: 'uuid',
  provider: 'dalle',
  prompt: 'original prompt',
  filename: 'dalle-1234567890.png',
  filepath: '/path/to/image.png',
  url: 'https://...',  // для DALL-E
  metadata: { /* ... */ }
}
```

#### `generateBatch(prompts, options)`

Пакетная генерация изображений.

```javascript
const results = await imageGen.generateBatch([
  'A sunset over mountains',
  'A futuristic city',
  'An abstract pattern'
], {
  provider: 'dalle',
  delay: 2000  // Задержка между запросами
});
```

#### `createVariation(imagePath, options)`

Создание вариации изображения (только DALL-E).

```javascript
const variation = await imageGen.createVariation('./image.png', {
  count: 1,
  size: '1024x1024'
});
```

#### `getStats()`

Получить статистику генерации.

```javascript
const stats = imageGen.getStats();
// {
//   total: 10,
//   success: 9,
//   failed: 1,
//   successRate: '90.00%',
//   byProvider: {
//     dalle: { total: 7, success: 7, failed: 0 },
//     'stable-diffusion': { total: 3, success: 2, failed: 1 }
//   }
// }
```

### Настройка Stable Diffusion

Для использования Stable Diffusion локально:

```bash
# Установите Stable Diffusion WebUI
git clone https://github.com/AUTOMATIC1111/stable-diffusion-webui
cd stable-diffusion-webui

# Запустите с API флагом
./webui.sh --api
```

Затем используйте:

```javascript
const imageGen = new ImageGenerator(logger, {
  defaultProvider: 'stable-diffusion',
  sdEndpoint: 'http://localhost:7860'
});
```

## Document Generator

Создание документов в различных форматах.

### Поддерживаемые форматы

- **PDF** - через pdfkit
- **DOCX** - через docx
- **Markdown** - нативно
- **HTML** - нативно

### Использование

```javascript
const { DocumentGenerator } = require('./src');

const docGen = new DocumentGenerator(logger, {
  outputDir: './generated-documents'
});

// Генерация Markdown
const result = await docGen.generate(
  '# Hello World\n\nThis is a test document.',
  {
    format: 'markdown',
    filename: 'test.md',
    title: 'Test Document',
    author: 'AI Browser'
  }
);
```

### Структурированный контент

Вместо простого текста можно передать массив блоков:

```javascript
const content = [
  { type: 'heading', level: 1, text: 'Document Title' },
  { type: 'text', text: 'This is a paragraph.' },
  { type: 'heading', level: 2, text: 'Features' },
  {
    type: 'list',
    items: ['Feature 1', 'Feature 2', 'Feature 3']
  },
  {
    type: 'code',
    language: 'javascript',
    text: 'const hello = "world";'
  }
];

const result = await docGen.generate(content, {
  format: 'html',
  title: 'My Document'
});
```

### Методы

#### `generate(content, options)`

Генерация документа.

**Параметры:**
- `content` (string | array) - содержимое документа
- `options` (object):
  - `format` ('pdf' | 'docx' | 'markdown' | 'html') - формат
  - `filename` (string) - имя файла
  - `title` (string) - заголовок документа
  - `author` (string) - автор
  - `subject` (string) - тема (PDF/DOCX)
  - `date` (string) - дата (Markdown)

**Типы блоков контента:**
- `{ type: 'heading', level: 1-6, text: '...' }` - заголовок
- `{ type: 'text', text: '...' }` - текст
- `{ type: 'list', items: [...] }` - список
- `{ type: 'code', language: '...', text: '...' }` - код (MD/HTML)

**Возвращает:**
```javascript
{
  success: true,
  taskId: 'uuid',
  format: 'pdf',
  filename: 'document.pdf',
  filepath: '/path/to/document.pdf',
  size: 12345,
  metadata: { /* ... */ }
}
```

#### `listGenerated()`

Список всех сгенерированных документов.

```javascript
const documents = await docGen.listGenerated();
// [
//   {
//     filename: 'document.pdf',
//     filepath: '/path/to/document.pdf',
//     format: 'pdf',
//     size: 12345,
//     created: Date
//   },
//   ...
// ]
```

### Примеры

#### PDF документ

```javascript
const pdfResult = await docGen.generate([
  { type: 'heading', text: 'Technical Report' },
  { type: 'text', text: 'This report contains...' },
  {
    type: 'list',
    items: ['Point 1', 'Point 2', 'Point 3']
  }
], {
  format: 'pdf',
  title: 'Q4 Report',
  author: 'John Doe',
  subject: 'Quarterly Analysis'
});
```

#### DOCX документ

```javascript
const docxResult = await docGen.generate([
  { type: 'heading', level: 1, text: 'Project Proposal' },
  { type: 'text', text: 'Executive summary...' },
  { type: 'heading', level: 2, text: 'Objectives' },
  {
    type: 'list',
    items: ['Objective 1', 'Objective 2']
  }
], {
  format: 'docx',
  title: 'Proposal',
  author: 'Team Lead'
});
```

## Workflow Generator

Генерация n8n workflows для автоматизации.

### Использование

```javascript
const { WorkflowGenerator } = require('./src');

const workflowGen = new WorkflowGenerator(logger, {
  outputDir: './generated-workflows',
  n8nEndpoint: 'http://localhost:5678',
  n8nApiKey: process.env.N8N_API_KEY
});
```

### Готовые шаблоны

#### AI Chat Workflow

```javascript
const chatWorkflow = await workflowGen.createAIChatWorkflow({
  name: 'AI Assistant',
  webhookPath: 'chat',
  model: 'gpt-4',
  temperature: 0.7
});
```

Создает workflow:
```
Webhook → OpenAI → Code (format response)
```

#### Data Processing Workflow

```javascript
const dataWorkflow = await workflowGen.createDataProcessingWorkflow({
  name: 'Process Data',
  webhookPath: 'process',
  processingCode: `
    // Custom processing logic
    return items.map(item => ({
      ...item.json,
      processed: true
    }));
  `,
  outputUrl: 'http://localhost:3000/api/data'
});
```

Создает workflow:
```
Webhook → Code (process) → HTTP Request (output)
```

#### Scheduled Workflow

```javascript
const scheduledWorkflow = await workflowGen.createScheduledWorkflow({
  name: 'Daily Backup',
  taskCode: `
    // Backup logic
    return [{ json: { status: 'completed' } }];
  `
});
```

Создает workflow:
```
Cron Trigger → Code (task)
```

### Кастомные workflows

```javascript
const customWorkflow = await workflowGen.create({
  name: 'My Custom Workflow',
  type: 'custom',
  nodes: [
    {
      type: 'trigger.webhook',
      parameters: { path: 'my-webhook' }
    },
    {
      type: 'ai.openai',
      parameters: {
        operation: 'create',
        model: 'gpt-4',
        prompt: '={{ $json.input }}'
      }
    },
    {
      type: 'utility.code',
      parameters: {
        jsCode: 'return [{ json: { result: items[0].json } }];'
      }
    }
  ],
  active: true,
  tags: ['ai', 'custom']
});
```

### Типы узлов

Доступные типы узлов:

**Triggers:**
- `trigger.webhook` - HTTP webhook
- `trigger.cron` - Расписание (cron)

**AI:**
- `ai.openai` - OpenAI (GPT-4, GPT-3.5, etc.)

**Utility:**
- `utility.code` - Выполнение JavaScript кода
- `utility.set` - Установка значений

**Output:**
- `output.http` - HTTP запрос

### Методы

#### `create(config)`

Создание кастомного workflow.

```javascript
const result = await workflowGen.create({
  name: 'Workflow Name',
  type: 'custom',
  nodes: [...],
  connections: {...},  // опционально
  active: true,
  tags: [...]
});
```

#### `uploadToN8n(workflowPath)`

Загрузка workflow в n8n.

```javascript
const result = await workflowGen.uploadToN8n('./my-workflow.json');
// { success: true, workflowId: '123', name: '...' }
```

#### `saveTemplate(name, workflow)`

Сохранение workflow как шаблона.

```javascript
await workflowGen.saveTemplate('my-template', workflowData);
```

#### `loadTemplate(name)`

Загрузка шаблона.

```javascript
const template = await workflowGen.loadTemplate('my-template');
```

## createToolsSystem

Создание полной системы инструментов.

```javascript
const { createToolsSystem } = require('./src');

const tools = createToolsSystem(logger, {
  // Image Generator
  imageOutputDir: './images',
  defaultImageProvider: 'dalle',
  openaiApiKey: process.env.OPENAI_API_KEY,
  sdEndpoint: 'http://localhost:7860',

  // Document Generator
  documentOutputDir: './documents',
  documentTemplatesDir: './templates',

  // Workflow Generator
  workflowOutputDir: './workflows',
  workflowTemplatesDir: './workflow-templates',
  n8nEndpoint: 'http://localhost:5678',
  n8nApiKey: process.env.N8N_API_KEY
});

// Использование
const { imageGenerator, documentGenerator, workflowGenerator } = tools;
```

## Тестирование

```bash
npm test
```

Все 29 тестов должны пройти успешно:
- 4 теста импорта
- 3 теста ImageGenerator
- 7 тестов DocumentGenerator
- 8 тестов WorkflowGenerator
- 3 теста системы
- 4 теста статистики

## Примеры

См. `examples/tools-demo.js` для полной демонстрации всех возможностей.

```bash
cd ../examples
NODE_PATH=../tools/node_modules node tools-demo.js
```

## Переменные окружения

```bash
# OpenAI API Key (для DALL-E и GPT)
OPENAI_API_KEY=sk-...

# Stable Diffusion endpoint
SD_ENDPOINT=http://localhost:7860

# n8n configuration
N8N_ENDPOINT=http://localhost:5678
N8N_API_KEY=n8n_api_...
```

## Интеграция с AI Browser

```javascript
// В main process
const { createToolsSystem } = require('./tools/src');

const tools = createToolsSystem(logger);

// IPC handlers
ipcMain.handle('tools:generate-image', async (event, prompt, options) => {
  return await tools.imageGenerator.generate(prompt, options);
});

ipcMain.handle('tools:generate-document', async (event, content, options) => {
  return await tools.documentGenerator.generate(content, options);
});

ipcMain.handle('tools:create-workflow', async (event, config) => {
  return await tools.workflowGenerator.create(config);
});
```

## Производительность

- **Image Generation**: 10-30 секунд на изображение (DALL-E), 5-15 секунд (Stable Diffusion)
- **Document Generation**: < 1 секунда для Markdown/HTML, 1-3 секунды для PDF/DOCX
- **Workflow Generation**: < 100мс на workflow

## Лимиты

- **DALL-E**: до 50 изображений в минуту (зависит от тарифа OpenAI)
- **Stable Diffusion**: зависит от локального сервера
- **Документы**: без ограничений
- **Workflows**: без ограничений

## Roadmap

- [ ] Поддержка Midjourney
- [ ] Больше форматов документов (ODT, RTF)
- [ ] Шаблоны документов
- [ ] Визуальный редактор workflows
- [ ] Интеграция с другими платформами автоматизации (Zapier, Make.com)

## Лицензия

MIT
