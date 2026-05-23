/**
 * Unit Tests for Orchestrator
 * 
 * Tests core orchestrator functionality including:
 * - Task dispatching and execution
 * - Agent registration
 * - State management
 * - Error handling and retries
 */

const { Orchestrator } = require('../index.js');

// Mock agent for testing
class MockAgent {
  constructor(shouldFail = false) {
    this.shouldFail = shouldFail;
    this.executionCount = 0;
  }

  async execute(prompt, context) {
    this.executionCount++;

    if (this.shouldFail) {
      throw new Error('Mock agent error');
    }

    return {
      success: true,
      prompt: prompt.substring(0, 50),
      context: context,
      executionCount: this.executionCount,
    };
  }
}

describe('Orchestrator', () => {
  let orchestrator;

  beforeEach(async () => {
    orchestrator = new Orchestrator({
      mode: 'manual',
      telemetry: false,
      maxRetries: 2,
    });
    await orchestrator.initialize();
  });

  describe('Initialization', () => {
    test('should initialize successfully', async () => {
      expect(orchestrator.initialized).toBe(true);
      expect(orchestrator.mode).toBe('manual');
    });

    test('should validate mode configuration', () => {
      const invalidOrch = new Orchestrator({ mode: 'invalid' });
      expect(() => {
        invalidOrch._validateConfiguration();
      }).toThrow('Invalid mode');
    });

    test('should validate execution timeout', () => {
      const invalidOrch = new Orchestrator({ executionTimeout: 500 });
      expect(() => {
        invalidOrch._validateConfiguration();
      }).toThrow('executionTimeout must be at least 1000ms');
    });
  });

  describe('Agent Registration', () => {
    test('should register an agent successfully', () => {
      const agent = new MockAgent();
      orchestrator.registerAgent('mock-agent', agent);

      expect(orchestrator.agents.has('mock-agent')).toBe(true);
      expect(orchestrator.agents.get('mock-agent')).toBe(agent);
    });

    test('should reject invalid agents', () => {
      expect(() => {
        orchestrator.registerAgent('invalid-agent', {});
      }).toThrow('Agent must have an execute() method');
    });

    test('should reject null agents', () => {
      expect(() => {
        orchestrator.registerAgent('null-agent', null);
      }).toThrow('Agent must have an execute() method');
    });
  });

  describe('Task Dispatching', () => {
    beforeEach(() => {
      orchestrator.registerAgent('mock-agent', new MockAgent());
    });

    test('should dispatch a task successfully', async () => {
      const result = await orchestrator.dispatch('Test prompt');

      expect(result.success).toBe(true);
      expect(result.taskId).toBeDefined();
      expect(result.result).toBeDefined();
    });

    test('should reject task dispatch without initialization', async () => {
      const newOrch = new Orchestrator();
      await expect(newOrch.dispatch('Test')).rejects.toThrow('not initialized');
    });

    test('should reject dispatch without registered agents', async () => {
      const emptyOrch = new Orchestrator();
      await emptyOrch.initialize();

      await expect(emptyOrch.dispatch('Test')).rejects.toThrow('No agents registered');
    });

    test('should increment task metrics', async () => {
      const initialCount = orchestrator.metrics.tasksDispatched;
      await orchestrator.dispatch('Test 1');
      await orchestrator.dispatch('Test 2');

      expect(orchestrator.metrics.tasksDispatched).toBe(initialCount + 2);
    });

    test('should track task history', async () => {
      const initialLength = orchestrator.taskHistory.length;
      await orchestrator.dispatch('Test prompt');

      expect(orchestrator.taskHistory.length).toBe(initialLength + 1);
    });
  });

  describe('Task Execution', () => {
    beforeEach(() => {
      orchestrator.registerAgent('mock-agent', new MockAgent());
    });

    test('should execute task with correct agent', async () => {
      const agent = new MockAgent();
      orchestrator.registerAgent('custom-agent', agent);

      await orchestrator.dispatch('Test', { agentId: 'custom-agent' });

      expect(agent.executionCount).toBe(1);
    });

    test('should handle task failures', async () => {
      const failingAgent = new MockAgent(true);
      orchestrator.registerAgent('failing-agent', failingAgent);

      const result = await orchestrator.dispatch('Test', {
        agentId: 'failing-agent',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(orchestrator.metrics.tasksFailed).toBeGreaterThan(0);
    });

    test('should retry failed tasks', async () => {
      const failingAgent = new MockAgent(true);
      orchestrator.registerAgent('failing-agent', failingAgent);

      const result = await orchestrator.dispatch('Test', {
        agentId: 'failing-agent',
      });

      // Should retry up to maxRetries times
      expect(failingAgent.executionCount).toBe(orchestrator.maxRetries);
      expect(result.success).toBe(false);
    });

    test('should pass context to agent', async () => {
      const agent = new MockAgent();
      orchestrator.registerAgent('mock-agent', agent);

      const context = { userId: '123', action: 'test' };
      const result = await orchestrator.dispatch('Test', { context });

      expect(result.result.context).toEqual(context);
    });
  });

  describe('State Management', () => {
    test('should return current state', async () => {
      orchestrator.registerAgent('mock-agent', new MockAgent());
      const state = orchestrator.getState();

      expect(state.initialized).toBe(true);
      expect(state.mode).toBe('manual');
      expect(state.agents).toContain('mock-agent');
    });

    test('should return metrics', async () => {
      orchestrator.registerAgent('mock-agent', new MockAgent());
      await orchestrator.dispatch('Test');

      const metrics = orchestrator.getMetrics();

      expect(metrics.tasksDispatched).toBeGreaterThan(0);
      expect(metrics.tasksCompleted).toBeGreaterThan(0);
      expect(metrics.uptime).toBeDefined();
      expect(metrics.memoryUsage).toBeDefined();
    });

    test('should filter task history', async () => {
      orchestrator.registerAgent('mock-agent', new MockAgent());

      await orchestrator.dispatch('Test 1');
      await orchestrator.dispatch('Test 2');

      const completed = orchestrator.getTaskHistory({ status: 'completed' });
      expect(completed.length).toBeGreaterThan(0);
      expect(completed.every((t) => t.status === 'completed')).toBe(true);
    });
  });

  describe('Event Emission', () => {
    test('should emit task-queued event', (done) => {
      orchestrator.registerAgent('mock-agent', new MockAgent());

      orchestrator.once('task-queued', (data) => {
        expect(data.taskId).toBeDefined();
        done();
      });

      orchestrator.dispatch('Test');
    });

    test('should emit task-started event', (done) => {
      orchestrator.registerAgent('mock-agent', new MockAgent());

      orchestrator.once('task-started', (data) => {
        expect(data.taskId).toBeDefined();
        expect(data.agentId).toBe('mock-agent');
        done();
      });

      orchestrator.dispatch('Test');
    });

    test('should emit task-completed event', (done) => {
      orchestrator.registerAgent('mock-agent', new MockAgent());

      orchestrator.once('task-completed', (data) => {
        expect(data.taskId).toBeDefined();
        expect(data.duration).toBeDefined();
        done();
      });

      orchestrator.dispatch('Test');
    });

    test('should emit task-failed event', (done) => {
      orchestrator.registerAgent('mock-agent', new MockAgent(true));

      orchestrator.once('task-failed', (data) => {
        expect(data.taskId).toBeDefined();
        expect(data.error).toBeDefined();
        done();
      });

      orchestrator.dispatch('Test');
    });
  });
});
