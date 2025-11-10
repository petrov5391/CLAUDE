/**
 * DocumentGenerator - генерация документов (PDF, DOCX, Markdown)
 * Поддержка различных форматов и шаблонов
 */

const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class DocumentGenerator {
  constructor(logger, options = {}) {
    this.logger = logger;
    this.outputDir = options.outputDir || './generated-documents';
    this.templatesDir = options.templatesDir || './templates';

    // Статистика
    this.stats = {
      total: 0,
      success: 0,
      failed: 0,
      byFormat: {}
    };

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
      this.logger.info(`[DocumentGenerator] Output directory: ${this.outputDir}`);
    } catch (error) {
      this.logger.error(`[DocumentGenerator] Failed to create directories:`, error);
    }
  }

  /**
   * Генерировать документ
   */
  async generate(content, options = {}) {
    const format = options.format || 'pdf';
    const taskId = uuidv4();

    this.logger.info(`[DocumentGenerator] Generating ${format.toUpperCase()} document`);

    this.stats.total++;
    if (!this.stats.byFormat[format]) {
      this.stats.byFormat[format] = { total: 0, success: 0, failed: 0 };
    }
    this.stats.byFormat[format].total++;

    try {
      let result;

      switch (format.toLowerCase()) {
        case 'pdf':
          result = await this.generatePDF(content, options);
          break;
        case 'docx':
          result = await this.generateDOCX(content, options);
          break;
        case 'markdown':
        case 'md':
          result = await this.generateMarkdown(content, options);
          break;
        case 'html':
          result = await this.generateHTML(content, options);
          break;
        default:
          throw new Error(`Unsupported format: ${format}`);
      }

      this.stats.success++;
      this.stats.byFormat[format].success++;

      this.logger.info(`[DocumentGenerator] Document generated: ${result.filename}`);

      return {
        success: true,
        taskId,
        format,
        filename: result.filename,
        filepath: result.filepath,
        size: result.size,
        metadata: result.metadata
      };

    } catch (error) {
      this.stats.failed++;
      this.stats.byFormat[format].failed++;

      this.logger.error(`[DocumentGenerator] Failed to generate document:`, error);

      return {
        success: false,
        taskId,
        format,
        error: error.message
      };
    }
  }

  /**
   * Генерация PDF
   */
  async generatePDF(content, options = {}) {
    // Используем динамический импорт для pdfkit
    let PDFDocument;
    try {
      PDFDocument = require('pdfkit');
    } catch (error) {
      throw new Error('pdfkit is not installed. Run: npm install pdfkit');
    }

    const filename = options.filename || `document-${Date.now()}.pdf`;
    const filepath = path.join(this.outputDir, filename);

    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: options.pageSize || 'A4',
          margins: options.margins || {
            top: 50,
            bottom: 50,
            left: 50,
            right: 50
          }
        });

        const writeStream = require('fs').createWriteStream(filepath);
        doc.pipe(writeStream);

        // Заголовок
        if (options.title) {
          doc.fontSize(24)
             .font('Helvetica-Bold')
             .text(options.title, { align: 'center' })
             .moveDown(2);
        }

        // Основной контент
        if (typeof content === 'string') {
          doc.fontSize(12)
             .font('Helvetica')
             .text(content, {
               align: options.align || 'left',
               lineGap: 5
             });
        } else if (Array.isArray(content)) {
          // Массив параграфов
          content.forEach((paragraph, index) => {
            if (paragraph.type === 'heading') {
              doc.fontSize(paragraph.size || 18)
                 .font('Helvetica-Bold')
                 .text(paragraph.text)
                 .moveDown();
            } else if (paragraph.type === 'text') {
              doc.fontSize(12)
                 .font('Helvetica')
                 .text(paragraph.text)
                 .moveDown(0.5);
            } else if (paragraph.type === 'list') {
              paragraph.items.forEach(item => {
                doc.fontSize(12)
                   .font('Helvetica')
                   .text(`• ${item}`, { indent: 20 });
              });
              doc.moveDown();
            }
          });
        }

        // Метаданные
        if (options.author) {
          doc.info.Author = options.author;
        }
        if (options.subject) {
          doc.info.Subject = options.subject;
        }
        if (options.keywords) {
          doc.info.Keywords = options.keywords;
        }

        doc.end();

        writeStream.on('finish', async () => {
          const stats = await fs.stat(filepath);
          resolve({
            filename,
            filepath,
            size: stats.size,
            metadata: {
              pages: doc.bufferedPageRange().count,
              pageSize: options.pageSize || 'A4',
              author: options.author,
              subject: options.subject
            }
          });
        });

        writeStream.on('error', reject);

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Генерация DOCX
   */
  async generateDOCX(content, options = {}) {
    // Используем динамический импорт для docx
    let docx;
    try {
      docx = require('docx');
    } catch (error) {
      throw new Error('docx is not installed. Run: npm install docx');
    }

    const { Document, Packer, Paragraph, TextRun, HeadingLevel } = docx;

    const filename = options.filename || `document-${Date.now()}.docx`;
    const filepath = path.join(this.outputDir, filename);

    const sections = [];
    const children = [];

    // Заголовок
    if (options.title) {
      children.push(
        new Paragraph({
          text: options.title,
          heading: HeadingLevel.HEADING_1,
          spacing: { after: 400 }
        })
      );
    }

    // Контент
    if (typeof content === 'string') {
      // Разбиваем на параграфы
      const paragraphs = content.split('\n\n');
      paragraphs.forEach(text => {
        if (text.trim()) {
          children.push(
            new Paragraph({
              children: [new TextRun(text)],
              spacing: { after: 200 }
            })
          );
        }
      });
    } else if (Array.isArray(content)) {
      content.forEach(item => {
        if (item.type === 'heading') {
          children.push(
            new Paragraph({
              text: item.text,
              heading: HeadingLevel[`HEADING_${item.level || 2}`],
              spacing: { after: 200 }
            })
          );
        } else if (item.type === 'text') {
          children.push(
            new Paragraph({
              children: [new TextRun(item.text)],
              spacing: { after: 200 }
            })
          );
        } else if (item.type === 'list') {
          item.items.forEach(listItem => {
            children.push(
              new Paragraph({
                text: `• ${listItem}`,
                spacing: { after: 100 },
                indent: { left: 720 }
              })
            );
          });
        }
      });
    }

    sections.push({ children });

    const doc = new Document({
      sections,
      creator: options.author || 'AI Browser',
      description: options.subject || '',
      title: options.title || ''
    });

    const buffer = await Packer.toBuffer(doc);
    await fs.writeFile(filepath, buffer);

    const stats = await fs.stat(filepath);

    return {
      filename,
      filepath,
      size: stats.size,
      metadata: {
        author: options.author,
        subject: options.subject,
        title: options.title
      }
    };
  }

  /**
   * Генерация Markdown
   */
  async generateMarkdown(content, options = {}) {
    const filename = options.filename || `document-${Date.now()}.md`;
    const filepath = path.join(this.outputDir, filename);

    let markdown = '';

    // Заголовок
    if (options.title) {
      markdown += `# ${options.title}\n\n`;
    }

    // Метаданные
    if (options.author || options.date) {
      markdown += '---\n';
      if (options.author) markdown += `Author: ${options.author}\n`;
      if (options.date) markdown += `Date: ${options.date}\n`;
      markdown += '---\n\n';
    }

    // Контент
    if (typeof content === 'string') {
      markdown += content;
    } else if (Array.isArray(content)) {
      content.forEach(item => {
        if (item.type === 'heading') {
          const level = '#'.repeat(item.level || 2);
          markdown += `${level} ${item.text}\n\n`;
        } else if (item.type === 'text') {
          markdown += `${item.text}\n\n`;
        } else if (item.type === 'list') {
          item.items.forEach(listItem => {
            markdown += `- ${listItem}\n`;
          });
          markdown += '\n';
        } else if (item.type === 'code') {
          markdown += `\`\`\`${item.language || ''}\n${item.text}\n\`\`\`\n\n`;
        }
      });
    }

    await fs.writeFile(filepath, markdown, 'utf-8');

    const stats = await fs.stat(filepath);

    return {
      filename,
      filepath,
      size: stats.size,
      metadata: {
        author: options.author,
        date: options.date,
        title: options.title
      }
    };
  }

  /**
   * Генерация HTML
   */
  async generateHTML(content, options = {}) {
    const filename = options.filename || `document-${Date.now()}.html`;
    const filepath = path.join(this.outputDir, filename);

    let html = '<!DOCTYPE html>\n<html lang="ru">\n<head>\n';
    html += '  <meta charset="UTF-8">\n';
    html += `  <title>${options.title || 'Document'}</title>\n`;

    // CSS стили
    html += '  <style>\n';
    html += '    body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; line-height: 1.6; }\n';
    html += '    h1 { color: #333; border-bottom: 2px solid #333; padding-bottom: 10px; }\n';
    html += '    h2 { color: #555; margin-top: 30px; }\n';
    html += '    code { background: #f4f4f4; padding: 2px 5px; border-radius: 3px; }\n';
    html += '    pre { background: #f4f4f4; padding: 15px; border-radius: 5px; overflow-x: auto; }\n';
    html += '  </style>\n';
    html += '</head>\n<body>\n';

    // Заголовок
    if (options.title) {
      html += `  <h1>${this.escapeHtml(options.title)}</h1>\n`;
    }

    // Контент
    if (typeof content === 'string') {
      html += `  <p>${this.escapeHtml(content).replace(/\n/g, '<br>')}</p>\n`;
    } else if (Array.isArray(content)) {
      content.forEach(item => {
        if (item.type === 'heading') {
          const level = item.level || 2;
          html += `  <h${level}>${this.escapeHtml(item.text)}</h${level}>\n`;
        } else if (item.type === 'text') {
          html += `  <p>${this.escapeHtml(item.text)}</p>\n`;
        } else if (item.type === 'list') {
          html += '  <ul>\n';
          item.items.forEach(listItem => {
            html += `    <li>${this.escapeHtml(listItem)}</li>\n`;
          });
          html += '  </ul>\n';
        } else if (item.type === 'code') {
          html += `  <pre><code>${this.escapeHtml(item.text)}</code></pre>\n`;
        }
      });
    }

    html += '</body>\n</html>';

    await fs.writeFile(filepath, html, 'utf-8');

    const stats = await fs.stat(filepath);

    return {
      filename,
      filepath,
      size: stats.size,
      metadata: {
        title: options.title
      }
    };
  }

  /**
   * Экранирование HTML
   */
  escapeHtml(text) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
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
   * Список сгенерированных документов
   */
  async listGenerated() {
    try {
      const files = await fs.readdir(this.outputDir);
      const documents = files.filter(f => /\.(pdf|docx|md|html)$/i.test(f));

      const details = await Promise.all(
        documents.map(async (filename) => {
          const filepath = path.join(this.outputDir, filename);
          const stats = await fs.stat(filepath);
          const ext = path.extname(filename).substring(1);

          return {
            filename,
            filepath,
            format: ext,
            size: stats.size,
            created: stats.birthtime
          };
        })
      );

      return details.sort((a, b) => b.created - a.created);

    } catch (error) {
      this.logger.error('[DocumentGenerator] Failed to list documents:', error);
      return [];
    }
  }
}

module.exports = { DocumentGenerator };
