/**
 * OrchestrAIt Core Orchestrator Engine
 * 
 * Central event loop managing task dispatch, state, and execution control.
 * Designed for deterministic, stateful agent coordination with zero bloat.
 */

const EventEmitter = require('events');

class Orchestrator extends EventEmitter {
  /**
   * Initialize the OrchestrAIt orchestrator
   * @param {Object} config - Configuration object
   * @param {string} config.mode - Execution mode: 'autonomous' or 'manual'
   * @param {boolean} config.telemetry - Enable telemetry tracking
   * @param {number} config.maxRetries - Max execution retries (default: 3)
   * @param {number} config.executionTimeout - Task timeout in ms (default: 30000)
   */
  constructor(config = {}) {
    super();

    this.mode = config.mode || 'manual';
    this.telemetryEnabled = config.telemetry !== false;
    this.maxRetries = config.maxRetries || 3;
    this.executionTimeout = config.executionTimeout || 30000;

    // State management
    this.taskQueue = [];
    this.activeTask = null;
    this.taskHistory = [];
    this.globalState = {};
    this.agents = new Map();

    // Telemetry
    this.metrics = {
      tasksDispatched: 0,
      tasksCompleted: 0,
      tasksFailed: 0,
      totalExecutionTime: 0,
      averageLatency: 0,
    };

    this.initialized = false;

    if (this.telemetryEnabled) {
      this._setupTelemetry();
    }
  }

  /**
   * Initialize the orchestrator (setup, validation, preflight checks)
   */
  async initialize() {
    try {
      this._validateConfiguration();
      this._setupEventHandlers();
      this.initialized = true;
      this.emit('initialized', { timestamp: new Date().toISOString() });
      return { success: true, message: 'Orchestrator initialized successfully' };
    } catch (error) {
      this.emit('error', { error: error.message, timestamp: new Date().toISOString() });
      throw new Error(`Initialization failed: ${error.message}`);
    }
  }

  /**
   * Register an agent worker with the orchestrator
   * @param {string} agentId - Unique agent identifier
   * @param {Object} agent - Agent instance with execute() method
   */
  registerAgent(agentId, agent) {
    if (!agent || typeof agent.execute !== 'function') {
      throw new Error('Agent must have an execute() method');
    }
    this.agents.set(agentId, agent);
    this.emit('agent-registered', { agentId, timestamp: new Date().toISOString() });
  }

  /**
   * Dispatch a task for execution
   * @param {string} prompt - Task prompt/description
   * @param {Object} options - Execution options
   * @param {string} options.agentId - Target agent (defaults to first available)
   * @param {Object} options.context - Additional context/state to pass
   * @param {string} options.workflowId - Workflow identifier for tracking
   * @returns {Promise<Object>} Task result
   */
  async dispatch(prompt, options = {}) {
    if (!this.initialized) {
      throw new Error('Orchestrator not initialized. Call initialize() first.');
    }

    const taskId = this._generateTaskId();
    const task = {
      id: taskId,
      prompt,
      agentId: options.agentId || this._getDefaultAgent(),
      context: options.context || {},
      workflowId: options.workflowId || null,
      status: 'queued',
      createdAt: new Date().toISOString(),
      startedAt: null,
      completedAt: null,
      result: null,
      error: null,
      retries: 0,
    };

    // Enqueue task
    this.taskQueue.push(task);
    this.metrics.tasksDispatched++;

    this.emit('task-queued', {
      taskId,
      prompt: prompt.substring(0, 100),
      timestamp: new Date().toISOString(),
    });

    // Attempt execution
    return this._executeTask(task);
  }

  /**
   * Execute a single task with retry logic
   * @private
   */
  async _executeTask(task) {
    const startTime = Date.now();
    task.status = 'running';
    task.startedAt = new Date().toISOString();
    this.activeTask = task;

    this.emit('task-started', {
      taskId: task.id,
      agentId: task.agentId,
      timestamp: new Date().toISOString(),
    });

    while (task.retries < this.maxRetries) {
      try {
        // Fetch agent
        const agent = this.agents.get(task.agentId);
        if (!agent) {
          throw new Error(`Agent '${task.agentId}' not found`);
        }

        // Execute with timeout
        const result = await Promise.race([
          agent.execute(task.prompt, task.context),
          this._createTimeout(this.executionTimeout),
        ]);

        // Validate result structure
        this._validateTaskResult(result);

        // Success
        task.status = 'completed';
        task.result = result;
        task.completedAt = new Date().toISOString();
        this.metrics.tasksCompleted++;

        const duration = Date.now() - startTime;
        this.metrics.totalExecutionTime += duration;
        this.metrics.averageLatency =
          this.metrics.totalExecutionTime / this.metrics.tasksCompleted;

        this.taskHistory.push(task);
        this.activeTask = null;

        this.emit('task-completed', {
          taskId: task.id,
          duration,
          agentId: task.agentId,
          timestamp: new Date().toISOString(),
        });

        return {
          success: true,
          taskId: task.id,
          result: result,
          duration,
        };
      } catch (error) {
        task.retries++;

        if (task.retries < this.maxRetries) {
          this.emit('task-retry', {
            taskId: task.id,
            attempt: task.retries,
            error: error.message,
            timestamp: new Date().toISOString(),
          });

          // Exponential backoff
          await this._delay(Math.pow(2, task.retries) * 1000);
        } else {
          task.status = 'failed';
          task.error = error.message;
          task.completedAt = new Date().toISOString();
          this.metrics.tasksFailed++;
          this.taskHistory.push(task);
          this.activeTask = null;

          this.emit('task-failed', {
            taskId: task.id,
            agentId: task.agentId,
            error: error.message,
            timestamp: new Date().toISOString(),
          });

          return {
            success: false,
            taskId: task.id,
            error: error.message,
          };
        }
      }
    }
  }

  /**
   * Get task history with optional filtering
   * @param {Object} filters - Filter options
   * @param {string} filters.status - Filter by status ('completed', 'failed', etc.)
   * @param {string} filters.agentId - Filter by agent ID
   * @param {number} filters.limit - Limit results
   * @returns {Array} Filtered task history
   */
  getTaskHistory(filters = {}) {
    let history = [...this.taskHistory];

    if (filters.status) {
      history = history.filter((t) => t.status === filters.status);
    }
    if (filters.agentId) {
      history = history.filter((t) => t.agentId === filters.agentId);
    }
    if (filters.limit) {
      history = history.slice(-filters.limit);
    }

    return history;
  }

  /**
   * Get current orchestrator metrics
   * @returns {Object} Metrics snapshot
   */
  getMetrics() {
    return {
      ...this.metrics,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      queueLength: this.taskQueue.length,
      registeredAgents: this.agents.size,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get current state snapshot
   * @returns {Object} State snapshot
   */
  getState() {
    return {
      mode: this.mode,
      initialized: this.initialized,
      activeTask: this.activeTask ? this.activeTask.id : null,
      queueLength: this.taskQueue.length,
      globalState: this.globalState,
      agents: Array.from(this.agents.keys()),
    };
  }

  /**
   * Setup telemetry tracking
   * @private
   */
  _setupTelemetry() {
    this.on('task-completed', (data) => {
      if (process.env.LOG_LEVEL === 'debug') {
        console.log(`[TELEMETRY] Task ${data.taskId} completed in ${data.duration}ms`);
      }
    });

    this.on('task-failed', (data) => {
      console.warn(`[TELEMETRY] Task ${data.taskId} failed: ${data.error}`);
    });
  }

  /**
   * Validate orchestrator configuration
   * @private
   */
  _validateConfiguration() {
    if (!['autonomous', 'manual'].includes(this.mode)) {
      throw new Error(`Invalid mode: ${this.mode}. Must be 'autonomous' or 'manual'.`);
    }

    if (this.executionTimeout < 1000) {
      throw new Error('executionTimeout must be at least 1000ms');
    }

    if (this.maxRetries < 0) {
      throw new Error('maxRetries cannot be negative');
    }
  }

  /**
   * Setup core event handlers
   * @private
   */
  _setupEventHandlers() {
    this.on('error', (error) => {
      console.error(`[ORCHESTRATOR ERROR] ${error.error} at ${error.timestamp}`);
    });
  }

  /**
   * Validate task result structure
   * @private
   */
  _validateTaskResult(result) {
    if (!result || typeof result !== 'object') {
      throw new Error('Task result must be a valid object');
    }

    if (result.error) {
      throw new Error(`Agent returned error: ${result.error}`);
    }

    return true;
  }

  /**
   * Get the default agent ID
   * @private
   */
  _getDefaultAgent() {
    if (this.agents.size === 0) {
      throw new Error('No agents registered');
    }
    return Array.from(this.agents.keys())[0];
  }

  /**
   * Generate unique task ID
   * @private
   */
  _generateTaskId() {
    return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Create a promise that rejects after timeout
   * @private
   */
  _createTimeout(ms) {
    return new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Task timeout after ${ms}ms`)), ms)
    );
  }

  /**
   * Delay execution (for backoff)
   * @private
   */
  _delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Export for use
module.exports = { Orchestrator };
