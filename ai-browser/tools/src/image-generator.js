/**
 * ImageGenerator - генерация изображений через различные AI сервисы
 * Поддержка: DALL-E, Stable Diffusion, Midjourney
 */

const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class ImageGenerator {
  constructor(logger, options = {}) {
    this.logger = logger;
    this.outputDir = options.outputDir || './generated-images';
    this.defaultProvider = options.defaultProvider || 'dalle';

    // API конфигурация
    this.config = {
      dalle: {
        apiKey: options.openaiApiKey || process.env.OPENAI_API_KEY,
        endpoint: 'https://api.openai.com/v1/images/generations',
        model: 'dall-e-3'
      },
      stableDiffusion: {
        endpoint: options.sdEndpoint || process.env.SD_ENDPOINT || 'http://localhost:7860',
        apiPath: '/sdapi/v1/txt2img'
      },
      midjourney: {
        enabled: false,
        // Требует отдельной интеграции через Discord bot
      }
    };

    // Статистика
    this.stats = {
      total: 0,
      success: 0,
      failed: 0,
      byProvider: {}
    };

    // Создаем выходную директорию
    this.ensureOutputDir();
  }

  /**
   * Создать выходную директорию
   */
  async ensureOutputDir() {
    try {
      await fs.mkdir(this.outputDir, { recursive: true });
      this.logger.info(`[ImageGenerator] Output directory: ${this.outputDir}`);
    } catch (error) {
      this.logger.error(`[ImageGenerator] Failed to create output directory:`, error);
    }
  }

  /**
   * Генерировать изображение
   */
  async generate(prompt, options = {}) {
    const provider = options.provider || this.defaultProvider;
    const taskId = uuidv4();

    this.logger.info(`[ImageGenerator] Generating image with ${provider}: "${prompt}"`);

    this.stats.total++;
    if (!this.stats.byProvider[provider]) {
      this.stats.byProvider[provider] = { total: 0, success: 0, failed: 0 };
    }
    this.stats.byProvider[provider].total++;

    try {
      let result;

      switch (provider) {
        case 'dalle':
          result = await this.generateWithDallE(prompt, options);
          break;
        case 'stable-diffusion':
          result = await this.generateWithStableDiffusion(prompt, options);
          break;
        case 'midjourney':
          result = await this.generateWithMidjourney(prompt, options);
          break;
        default:
          throw new Error(`Unknown provider: ${provider}`);
      }

      this.stats.success++;
      this.stats.byProvider[provider].success++;

      this.logger.info(`[ImageGenerator] Image generated successfully: ${result.filename}`);

      return {
        success: true,
        taskId,
        provider,
        prompt,
        filename: result.filename,
        filepath: result.filepath,
        url: result.url,
        metadata: result.metadata
      };

    } catch (error) {
      this.stats.failed++;
      this.stats.byProvider[provider].failed++;

      this.logger.error(`[ImageGenerator] Failed to generate image:`, error);

      return {
        success: false,
        taskId,
        provider,
        prompt,
        error: error.message
      };
    }
  }

  /**
   * Генерация через DALL-E
   */
  async generateWithDallE(prompt, options = {}) {
    if (!this.config.dalle.apiKey) {
      throw new Error('OpenAI API key is not configured');
    }

    const requestData = {
      model: options.model || this.config.dalle.model,
      prompt: prompt,
      n: options.count || 1,
      size: options.size || '1024x1024',
      quality: options.quality || 'standard',
      response_format: 'url'
    };

    const response = await axios.post(
      this.config.dalle.endpoint,
      requestData,
      {
        headers: {
          'Authorization': `Bearer ${this.config.dalle.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 120000 // 2 минуты
      }
    );

    const imageUrl = response.data.data[0].url;
    const revisedPrompt = response.data.data[0].revised_prompt;

    // Скачиваем изображение
    const filename = `dalle-${Date.now()}-${uuidv4().substring(0, 8)}.png`;
    const filepath = path.join(this.outputDir, filename);

    const imageResponse = await axios.get(imageUrl, {
      responseType: 'arraybuffer'
    });

    await fs.writeFile(filepath, imageResponse.data);

    return {
      filename,
      filepath,
      url: imageUrl,
      metadata: {
        model: requestData.model,
        size: requestData.size,
        quality: requestData.quality,
        originalPrompt: prompt,
        revisedPrompt: revisedPrompt
      }
    };
  }

  /**
   * Генерация через Stable Diffusion
   */
  async generateWithStableDiffusion(prompt, options = {}) {
    const endpoint = `${this.config.stableDiffusion.endpoint}${this.config.stableDiffusion.apiPath}`;

    const requestData = {
      prompt: prompt,
      negative_prompt: options.negativePrompt || '',
      steps: options.steps || 20,
      cfg_scale: options.cfgScale || 7,
      width: options.width || 512,
      height: options.height || 512,
      sampler_name: options.sampler || 'Euler a',
      seed: options.seed || -1,
      batch_size: 1,
      n_iter: 1
    };

    try {
      const response = await axios.post(endpoint, requestData, {
        timeout: 120000
      });

      // Stable Diffusion возвращает base64
      const imageBase64 = response.data.images[0];
      const imageBuffer = Buffer.from(imageBase64, 'base64');

      const filename = `sd-${Date.now()}-${uuidv4().substring(0, 8)}.png`;
      const filepath = path.join(this.outputDir, filename);

      await fs.writeFile(filepath, imageBuffer);

      return {
        filename,
        filepath,
        url: null,
        metadata: {
          steps: requestData.steps,
          cfgScale: requestData.cfg_scale,
          size: `${requestData.width}x${requestData.height}`,
          sampler: requestData.sampler_name,
          seed: response.data.info?.seed || requestData.seed
        }
      };

    } catch (error) {
      if (error.code === 'ECONNREFUSED') {
        throw new Error('Stable Diffusion server is not running. Start it with --api flag.');
      }
      throw error;
    }
  }

  /**
   * Генерация через Midjourney (заглушка)
   */
  async generateWithMidjourney(prompt, options = {}) {
    throw new Error('Midjourney integration is not yet implemented. Use DALL-E or Stable Diffusion.');
  }

  /**
   * Пакетная генерация
   */
  async generateBatch(prompts, options = {}) {
    const results = [];

    for (const prompt of prompts) {
      const result = await this.generate(prompt, options);
      results.push(result);

      // Задержка между запросами (для избежания rate limit)
      if (options.delay) {
        await new Promise(resolve => setTimeout(resolve, options.delay));
      }
    }

    return results;
  }

  /**
   * Вариации изображения (только DALL-E)
   */
  async createVariation(imagePath, options = {}) {
    if (!this.config.dalle.apiKey) {
      throw new Error('OpenAI API key is not configured');
    }

    const FormData = require('form-data');
    const form = new FormData();

    const imageBuffer = await fs.readFile(imagePath);
    form.append('image', imageBuffer, {
      filename: path.basename(imagePath),
      contentType: 'image/png'
    });

    form.append('n', options.count || 1);
    form.append('size', options.size || '1024x1024');

    const response = await axios.post(
      'https://api.openai.com/v1/images/variations',
      form,
      {
        headers: {
          ...form.getHeaders(),
          'Authorization': `Bearer ${this.config.dalle.apiKey}`
        },
        timeout: 120000
      }
    );

    const imageUrl = response.data.data[0].url;
    const filename = `dalle-variation-${Date.now()}-${uuidv4().substring(0, 8)}.png`;
    const filepath = path.join(this.outputDir, filename);

    const imageResponse = await axios.get(imageUrl, {
      responseType: 'arraybuffer'
    });

    await fs.writeFile(filepath, imageResponse.data);

    return {
      success: true,
      filename,
      filepath,
      url: imageUrl
    };
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
   * Очистить статистику
   */
  clearStats() {
    this.stats = {
      total: 0,
      success: 0,
      failed: 0,
      byProvider: {}
    };
  }

  /**
   * Список сгенерированных изображений
   */
  async listGenerated() {
    try {
      const files = await fs.readdir(this.outputDir);
      const images = files.filter(f => /\.(png|jpg|jpeg|webp)$/i.test(f));

      const details = await Promise.all(
        images.map(async (filename) => {
          const filepath = path.join(this.outputDir, filename);
          const stats = await fs.stat(filepath);

          return {
            filename,
            filepath,
            size: stats.size,
            created: stats.birthtime
          };
        })
      );

      return details.sort((a, b) => b.created - a.created);

    } catch (error) {
      this.logger.error('[ImageGenerator] Failed to list images:', error);
      return [];
    }
  }
}

module.exports = { ImageGenerator };
