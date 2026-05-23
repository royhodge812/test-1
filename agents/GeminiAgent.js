/**
 * GeminiAgent - Agent Worker for Google Gemini API
 * 
 * Handles prompt execution, response parsing, and structured JSON output.
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');

class GeminiAgent {
  /**
   * Initialize the Gemini agent
   * @param {Object} config - Configuration object
   * @param {string} config.apiKey - Google Gemini API key
   * @param {string} config.model - Model name (default: 'gemini-1.5-flash')
   * @param {number} config.maxTokens - Max response tokens
   * @param {number} config.temperature - Response temperature (0-1)
   */
  constructor(config = {}) {
    const apiKey = config.apiKey || process.env.GEMINI_API_KEY;

    if (!apiKey) {
      throw new Error('GEMINI_API_KEY not provided and not found in environment variables');
    }

    this.client = new GoogleGenerativeAI({ apiKey });
    this.model = config.model || 'gemini-1.5-flash';
    this.maxTokens = config.maxTokens || 2048;
    this.temperature = config.temperature !== undefined ? config.temperature : 0.7;

    this.executionCount = 0;
    this.totalTokensUsed = 0;
  }

  /**
   * Execute a prompt against Gemini API
   * @param {string} prompt - The prompt to send
   * @param {Object} context - Additional context (not used in basic implementation)
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

      // Construct messages
      const messages = this._buildMessages(prompt, context);

      // Call Gemini API
      const response = await this.client.models.generateContent({
        model: this.model,
        contents: messages,
        generationConfig: {
          maxOutputTokens: this.maxTokens,
          temperature: this.temperature,
        },
      });

      // Extract and validate response
      const text = response.response?.text?.();
      if (!text) {
        throw new Error('No response content from Gemini');
      }

      // Attempt JSON parsing
      let parsedContent;
      try {
        parsedContent = JSON.parse(text);
      } catch {
        // If not JSON, return as string
        parsedContent = { raw_text: text };
      }

      // Track token usage (if available in response)
      if (response.response?.usageMetadata) {
        this.totalTokensUsed += response.response.usageMetadata.totalTokenCount || 0;
      }

      return {
        success: true,
        model: this.model,
        content: parsedContent,
        timestamp: new Date().toISOString(),
        executionCount: this.executionCount,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        model: this.model,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Build message structure for API call
   * @private
   */
  _buildMessages(prompt, context) {
    let fullPrompt = prompt;

    // Inject context if available
    if (context && Object.keys(context).length > 0) {
      fullPrompt = `Context: ${JSON.stringify(context)}\n\nPrompt: ${prompt}`;
    }

    return [
      {
        role: 'user',
        parts: [{ text: fullPrompt }],
      },
    ];
  }

  /**
   * Get agent statistics
   * @returns {Object} Agent metrics
   */
  getStats() {
    return {
      model: this.model,
      executionCount: this.executionCount,
      totalTokensUsed: this.totalTokensUsed,
      averageTokensPerExecution:
        this.executionCount > 0
          ? Math.round(this.totalTokensUsed / this.executionCount)
          : 0,
    };
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.executionCount = 0;
    this.totalTokensUsed = 0;
  }
}

module.exports = { GeminiAgent };
