/**
 * Basic Usage Example - OrchestrAIt Orchestrator
 * 
 * This demonstrates:
 * 1. Initialize the orchestrator
 * 2. Register a Gemini agent
 * 3. Dispatch tasks for execution
 * 4. Handle results and errors
 */

require('dotenv').config();

const { Orchestrator } = require('../index.js');
const { GeminiAgent } = require('../agents');

async function main() {
  try {
    // Step 1: Create orchestrator instance
    console.log('🚀 Initializing OrchestrAIt Orchestrator...');
    const orchestrator = new Orchestrator({
      mode: 'autonomous',
      telemetry: true,
      maxRetries: 2,
      executionTimeout: 60000, // 60 second timeout for API calls
    });

    // Step 2: Initialize orchestrator
    await orchestrator.initialize();
    console.log('✅ Orchestrator initialized\n');

    // Step 3: Create and register Gemini agent
    console.log('📦 Registering Gemini Agent...');
    const geminiAgent = new GeminiAgent({
      apiKey: process.env.GEMINI_API_KEY,
      model: 'gemini-1.5-flash',
      temperature: 0.7,
    });
    orchestrator.registerAgent('gemini-agent', geminiAgent);
    console.log('✅ Agent registered\n');

    // Step 4: Setup event listeners
    orchestrator.on('task-queued', (data) => {
      console.log(`📋 Task queued: ${data.taskId}`);
    });

    orchestrator.on('task-started', (data) => {
      console.log(`⚙️  Task started: ${data.taskId} (Agent: ${data.agentId})`);
    });

    orchestrator.on('task-completed', (data) => {
      console.log(`✅ Task completed: ${data.taskId} (${data.duration}ms)`);
    });

    orchestrator.on('task-failed', (data) => {
      console.error(`❌ Task failed: ${data.taskId} - ${data.error}`);
    });

    // Step 5: Dispatch a task
    console.log('\n🎯 Dispatching task...\n');
    const result = await orchestrator.dispatch(
      'Generate a JSON object containing telemetry data for a mock system with three nodes. Include timestamp, memory usage, and CPU metrics.',
      {
        agentId: 'gemini-agent',
        context: { nodeCount: 3, format: 'json' },
      }
    );

    // Step 6: Display results
    console.log('\n📊 TASK RESULT:\n');
    console.log(JSON.stringify(result, null, 2));

    // Step 7: Display metrics
    console.log('\n📈 ORCHESTRATOR METRICS:\n');
    console.log(JSON.stringify(orchestrator.getMetrics(), null, 2));

    // Step 8: Display agent statistics
    console.log('\n🤖 AGENT STATISTICS:\n');
    console.log(JSON.stringify(geminiAgent.getStats(), null, 2));

    // Step 9: Display task history
    console.log('\n📋 TASK HISTORY:\n');
    const history = orchestrator.getTaskHistory({ limit: 5 });
    console.log(JSON.stringify(history, null, 2));

    console.log('\n✨ Example completed successfully!');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Run the example
main();
