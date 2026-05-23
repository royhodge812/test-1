/**
 * OrchestrAIt — Basic Usage Example
 *
 * Demonstrates a single-agent pipeline using the OrchestrAIt engine.
 * Run: node examples/basic-usage.js
 */

import { OrchestrAIt } from '../index.js';

const orchestrator = new OrchestrAIt({
  model: 'gemini-1.5-flash',
  maxRetries: 2,
});

orchestrator.addTask(
  '001',
  'SummaryAgent',
  'You are a concise technical summarizer.',
  `Summarize the key benefits of deterministic agent orchestration in 3 bullet points.

Expected JSON format:
{
  "success": true,
  "summary": ["point 1", "point 2", "point 3"],
  "timestamp": "ISO-8601-string"
}`
);

const state = await orchestrator.runPipeline();
console.log('\nFinal state:', JSON.stringify(state.metrics, null, 2));
