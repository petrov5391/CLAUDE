/**
 * Tools Module - точка входа
 * Экспортирует все инструменты для AI Browser
 */

const { ImageGenerator } = require('./image-generator');
const { DocumentGenerator } = require('./document-generator');
const { WorkflowGenerator } = require('./workflow-generator');

/**
 * Создать полный набор инструментов
 */
function createToolsSystem(logger, options = {}) {
  const imageGenerator = new ImageGenerator(logger, {
    outputDir: options.imageOutputDir || './generated-images',
    defaultProvider: options.defaultImageProvider || 'dalle',
    openaiApiKey: options.openaiApiKey,
    sdEndpoint: options.sdEndpoint
  });

  const documentGenerator = new DocumentGenerator(logger, {
    outputDir: options.documentOutputDir || './generated-documents',
    templatesDir: options.documentTemplatesDir || './templates'
  });

  const workflowGenerator = new WorkflowGenerator(logger, {
    outputDir: options.workflowOutputDir || './generated-workflows',
    templatesDir: options.workflowTemplatesDir || './workflow-templates',
    n8nEndpoint: options.n8nEndpoint,
    n8nApiKey: options.n8nApiKey
  });

  logger.info('[ToolsSystem] All tools initialized');

  return {
    imageGenerator,
    documentGenerator,
    workflowGenerator
  };
}

module.exports = {
  ImageGenerator,
  DocumentGenerator,
  WorkflowGenerator,
  createToolsSystem
};
