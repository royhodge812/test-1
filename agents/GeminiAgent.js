/**
 * GeminiAgent - Agent Worker for Google Gemini API
 *
 * Handles prompt execution, response parsing, and structured JSON output.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

export class GeminiAgent {
  /**
   * Initialize the Gemini agent
   * @param {Object} config - Configuration object
   * @param {string} config.apiKey   - Google Gemini API key
   * @param {string} config.model    - Model name (default: 'gemini-1.5-flash')
   * @param {number} config.maxTokens    - Max response tokens
   * @param {number} config.temperature  - Response temperature (0-1)
   */
  constructor(config = {}) {
    const apiKey = config.apiKey || process.env.GEMINI_API_KEY;

    if (!apiKey) {
      throw new Error('GEMINI_API_KEY not provided and not found in environment variables');
    }

    // Correct constructor: takes the key directly, not an object wrapper
    this.client = new GoogleGenerativeAI(apiKey);
    this.modelName = config.model || 'gemini-1.5-flash';
    this.maxTokens = config.maxTokens || 2048;
    this.temperature = config.temperature !== undefined ? config.temperature : 0.7;

    this.executionCount = 0;
    this.totalTokensUsed = 0;
  }

  /**
   * Execute a prompt against Gemini API
   * @param {string} prompt   - The prompt to send
   * @param {Object} context  - Optional key/value context injected as a prefix
   * @returns {Promise<Object>} Structured result object
   */
  async execute(prompt, context = {}) {
    if (!prompt || typeof prompt !== 'string') {
      return {
        success: false,
        error: 'Invalid prompt: must be a non-empty string',
      };
    }

    try {
      this.executionCount++;

      const fullPrompt = this._buildPrompt(prompt, context);

      // Correct SDK path: getGenerativeModel → generateContent
      const model = this.client.getGenerativeModel({
        model: this.modelName,
        generationConfig: {
          maxOutputTokens: this.maxTokens,
          temperature: this.temperature,
        },
      });

      const result = await model.generateContent(fullPrompt);
      const text = result.response.text();

      if (!text) {
        throw new Error('No response content from Gemini');
      }

      // Attempt JSON parsing; fall back to raw text envelope
      let parsedContent;
      try {
        parsedContent = JSON.parse(text);
      } catch {
        parsedContent = { raw_text: text };
      }

      // Track token usage if available
      const usage = result.response?.usageMetadata;
      if (usage?.totalTokenCount) {
        this.totalTokensUsed += usage.totalTokenCount;
      }

      return {
        success: true,
        model: this.modelName,
        content: parsedContent,
        timestamp: new Date().toISOString(),
        executionCount: this.executionCount,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        model: this.modelName,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Build the full prompt string, injecting context as a prefix if supplied
   * @private
   */
  _buildPrompt(prompt, context) {
    if (context && Object.keys(context).length > 0) {
      return `Context: ${JSON.stringify(context)}\n\nPrompt: ${prompt}`;
    }
    return prompt;
  }

  /**
   * Get agent statistics
   * @returns {Object} Agent metrics
   */
  getStats() {
    return {
      model: this.modelName,
      executionCount: this.executionCount,
      totalTokensUsed: this.totalTokensUsed,
      averageTokensPerExecution:
        this.executionCount > 0
          ? Math.round(this.totalTokensUsed / this.executionCount)
          : 0,
    };
  }

  /** Reset statistics */
  resetStats() {
    this.executionCount = 0;
    this.totalTokensUsed = 0;
  }
}
