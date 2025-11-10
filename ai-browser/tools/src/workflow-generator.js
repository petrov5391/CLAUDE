/**
 * WorkflowGenerator - генерация n8n workflows
 * Создание автоматизированных процессов для n8n
 */

const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class WorkflowGenerator {
  constructor(logger, options = {}) {
    this.logger = logger;
    this.outputDir = options.outputDir || './generated-workflows';
    this.templatesDir = options.templatesDir || './workflow-templates';
    this.n8nEndpoint = options.n8nEndpoint || process.env.N8N_ENDPOINT || 'http://localhost:5678';
    this.n8nApiKey = options.n8nApiKey || process.env.N8N_API_KEY;

    // Статистика
    this.stats = {
      total: 0,
      success: 0,
      failed: 0,
      byType: {}
    };

    // Шаблоны узлов
    this.nodeTemplates = this.initializeNodeTemplates();

    // Создаем директории
    this.ensureDirectories();
  }

  /**
   * Создать необходимые директории
   */
  async ensureDirectories() {
    try {
      await fs.mkdir(this.outputDir, { recursive: true });
      await fs.mkdir(this.templatesDir, { recursive: true });
      this.logger.info(`[WorkflowGenerator] Output directory: ${this.outputDir}`);
    } catch (error) {
      this.logger.error(`[WorkflowGenerator] Failed to create directories:`, error);
    }
  }

  /**
   * Инициализация шаблонов узлов
   */
  initializeNodeTemplates() {
    return {
      trigger: {
        webhook: {
          type: 'n8n-nodes-base.webhook',
          typeVersion: 1,
          position: [250, 300],
          parameters: {
            path: '',
            responseMode: 'onReceived',
            httpMethod: 'POST'
          }
        },
        cron: {
          type: 'n8n-nodes-base.cron',
          typeVersion: 1,
          position: [250, 300],
          parameters: {
            triggerTimes: {
              item: []
            }
          }
        }
      },
      ai: {
        openai: {
          type: 'n8n-nodes-base.openAi',
          typeVersion: 1,
          position: [450, 300],
          parameters: {
            operation: 'create',
            model: 'gpt-4',
            prompt: '',
            temperature: 0.7
          }
        }
      },
      utility: {
        code: {
          type: 'n8n-nodes-base.code',
          typeVersion: 1,
          position: [650, 300],
          parameters: {
            mode: 'runOnceForAllItems',
            jsCode: ''
          }
        },
        set: {
          type: 'n8n-nodes-base.set',
          typeVersion: 1,
          position: [650, 300],
          parameters: {
            values: {
              string: []
            }
          }
        }
      },
      output: {
        http: {
          type: 'n8n-nodes-base.httpRequest',
          typeVersion: 1,
          position: [850, 300],
          parameters: {
            method: 'POST',
            url: '',
            responseFormat: 'json'
          }
        }
      }
    };
  }

  /**
   * Создать новый workflow
   */
  async create(config) {
    const workflowId = uuidv4();

    this.logger.info(`[WorkflowGenerator] Creating workflow: ${config.name}`);

    this.stats.total++;
    const type = config.type || 'custom';
    if (!this.stats.byType[type]) {
      this.stats.byType[type] = { total: 0, success: 0, failed: 0 };
    }
    this.stats.byType[type].total++;

    try {
      const workflow = this.buildWorkflow(config);
      const filename = `${config.name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.json`;
      const filepath = path.join(this.outputDir, filename);

      await fs.writeFile(filepath, JSON.stringify(workflow, null, 2), 'utf-8');

      this.stats.success++;
      this.stats.byType[type].success++;

      this.logger.info(`[WorkflowGenerator] Workflow created: ${filename}`);

      return {
        success: true,
        workflowId,
        name: config.name,
        filename,
        filepath,
        nodeCount: workflow.nodes.length,
        connectionCount: workflow.connections ? Object.keys(workflow.connections).length : 0
      };

    } catch (error) {
      this.stats.failed++;
      this.stats.byType[type].failed++;

      this.logger.error(`[WorkflowGenerator] Failed to create workflow:`, error);

      return {
        success: false,
        workflowId,
        error: error.message
      };
    }
  }

  /**
   * Построить workflow
   */
  buildWorkflow(config) {
    const nodes = [];
    const connections = {};

    let xOffset = 250;
    const yOffset = 300;
    let previousNodeName = null;

    // Добавляем узлы
    config.nodes.forEach((nodeConfig, index) => {
      const nodeName = `${nodeConfig.type}${index}`;
      const template = this.getNodeTemplate(nodeConfig);

      if (!template) {
        throw new Error(`Unknown node type: ${nodeConfig.type}`);
      }

      const node = {
        ...template,
        name: nodeName,
        position: [xOffset, yOffset],
        parameters: {
          ...template.parameters,
          ...nodeConfig.parameters
        }
      };

      // Credentials
      if (nodeConfig.credentials) {
        node.credentials = nodeConfig.credentials;
      }

      nodes.push(node);

      // Connections
      if (previousNodeName && !nodeConfig.skipConnection) {
        if (!connections[previousNodeName]) {
          connections[previousNodeName] = {
            main: [[{ node: nodeName, type: 'main', index: 0 }]]
          };
        } else {
          connections[previousNodeName].main[0].push({
            node: nodeName,
            type: 'main',
            index: 0
          });
        }
      }

      previousNodeName = nodeName;
      xOffset += 200;
    });

    // Кастомные connections
    if (config.connections) {
      Object.assign(connections, config.connections);
    }

    return {
      name: config.name,
      nodes,
      connections,
      active: config.active !== false,
      settings: config.settings || {},
      tags: config.tags || []
    };
  }

  /**
   * Получить шаблон узла
   */
  getNodeTemplate(nodeConfig) {
    const parts = nodeConfig.type.split('.');
    let template = this.nodeTemplates;

    for (const part of parts) {
      template = template[part];
      if (!template) {
        return null;
      }
    }

    return JSON.parse(JSON.stringify(template)); // Deep copy
  }

  /**
   * Создать AI чат workflow
   */
  async createAIChatWorkflow(options = {}) {
    return this.create({
      name: options.name || 'AI Chat Assistant',
      type: 'ai-chat',
      nodes: [
        {
          type: 'trigger.webhook',
          parameters: {
            path: options.webhookPath || 'ai-chat',
            httpMethod: 'POST'
          }
        },
        {
          type: 'ai.openai',
          parameters: {
            operation: 'create',
            model: options.model || 'gpt-4',
            prompt: '={{ $json.message }}',
            temperature: options.temperature || 0.7
          },
          credentials: {
            openAiApi: {
              id: options.openaiCredId || '1',
              name: 'OpenAI Account'
            }
          }
        },
        {
          type: 'utility.code',
          parameters: {
            jsCode: `
              return {
                response: items[0].json.choices[0].message.content,
                timestamp: new Date().toISOString()
              };
            `
          }
        }
      ],
      active: true,
      tags: ['ai', 'chat', 'assistant']
    });
  }

  /**
   * Создать workflow для обработки данных
   */
  async createDataProcessingWorkflow(options = {}) {
    return this.create({
      name: options.name || 'Data Processing Pipeline',
      type: 'data-processing',
      nodes: [
        {
          type: 'trigger.webhook',
          parameters: {
            path: options.webhookPath || 'process-data',
            httpMethod: 'POST'
          }
        },
        {
          type: 'utility.code',
          parameters: {
            jsCode: options.processingCode || `
              // Data processing logic
              const processedData = items.map(item => ({
                ...item.json,
                processed: true,
                processedAt: new Date().toISOString()
              }));
              return processedData;
            `
          }
        },
        {
          type: 'output.http',
          parameters: {
            method: 'POST',
            url: options.outputUrl || 'http://localhost:3000/api/data',
            bodyParametersUi: {
              parameter: [
                {
                  name: 'data',
                  value: '={{ $json }}'
                }
              ]
            }
          }
        }
      ],
      active: true,
      tags: ['data', 'processing', 'automation']
    });
  }

  /**
   * Создать scheduled workflow
   */
  async createScheduledWorkflow(options = {}) {
    return this.create({
      name: options.name || 'Scheduled Task',
      type: 'scheduled',
      nodes: [
        {
          type: 'trigger.cron',
          parameters: {
            triggerTimes: {
              item: [
                {
                  mode: 'everyHour'
                }
              ]
            }
          }
        },
        {
          type: 'utility.code',
          parameters: {
            jsCode: options.taskCode || `
              // Scheduled task logic
              return [{
                json: {
                  executedAt: new Date().toISOString(),
                  message: 'Scheduled task executed successfully'
                }
              }];
            `
          }
        }
      ],
      active: true,
      tags: ['scheduled', 'automation', 'cron']
    });
  }

  /**
   * Загрузить workflow в n8n
   */
  async uploadToN8n(workflowPath) {
    if (!this.n8nApiKey) {
      throw new Error('n8n API key is not configured');
    }

    const axios = require('axios');
    const workflowData = JSON.parse(await fs.readFile(workflowPath, 'utf-8'));

    try {
      const response = await axios.post(
        `${this.n8nEndpoint}/api/v1/workflows`,
        workflowData,
        {
          headers: {
            'X-N8N-API-KEY': this.n8nApiKey,
            'Content-Type': 'application/json'
          }
        }
      );

      this.logger.info(`[WorkflowGenerator] Workflow uploaded to n8n: ${response.data.id}`);

      return {
        success: true,
        workflowId: response.data.id,
        name: response.data.name
      };

    } catch (error) {
      this.logger.error('[WorkflowGenerator] Failed to upload workflow:', error.message);

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Получить статистику
   */
  getStats() {
    return {
      ...this.stats,
      successRate: this.stats.total > 0
        ? (this.stats.success / this.stats.total * 100).toFixed(2) + '%'
        : '0%'
    };
  }

  /**
   * Список сгенерированных workflows
   */
  async listGenerated() {
    try {
      const files = await fs.readdir(this.outputDir);
      const workflows = files.filter(f => f.endsWith('.json'));

      const details = await Promise.all(
        workflows.map(async (filename) => {
          const filepath = path.join(this.outputDir, filename);
          const stats = await fs.stat(filepath);
          const content = JSON.parse(await fs.readFile(filepath, 'utf-8'));

          return {
            filename,
            filepath,
            name: content.name,
            nodeCount: content.nodes?.length || 0,
            active: content.active,
            tags: content.tags || [],
            size: stats.size,
            created: stats.birthtime
          };
        })
      );

      return details.sort((a, b) => b.created - a.created);

    } catch (error) {
      this.logger.error('[WorkflowGenerator] Failed to list workflows:', error);
      return [];
    }
  }

  /**
   * Сохранить шаблон
   */
  async saveTemplate(name, workflow) {
    const filename = `${name.toLowerCase().replace(/\s+/g, '-')}.json`;
    const filepath = path.join(this.templatesDir, filename);

    await fs.writeFile(filepath, JSON.stringify(workflow, null, 2), 'utf-8');

    this.logger.info(`[WorkflowGenerator] Template saved: ${filename}`);

    return { filename, filepath };
  }

  /**
   * Загрузить шаблон
   */
  async loadTemplate(name) {
    const filename = `${name.toLowerCase().replace(/\s+/g, '-')}.json`;
    const filepath = path.join(this.templatesDir, filename);

    try {
      const content = await fs.readFile(filepath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      throw new Error(`Template not found: ${name}`);
    }
  }
}

module.exports = { WorkflowGenerator };
