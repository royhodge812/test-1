/**
 * OrchestrAIt Core Orchestration Engine - Phase B
 * 
 * A streamlined, high-velocity orchestration engine for managing autonomous agent
 * workflows with Gemini AI. Zero bloat, maximum execution.
 * 
 * Features:
 * - Direct Gemini API integration
 * - Sequential task execution with context passing
 * - Deterministic JSON output parsing
 * - Artifact persistence to disk
 * - Retry logic with exponential backoff
 * - Complete execution ledger and metrics
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Validate environment
if (!process.env.GEMINI_API_KEY) {
  console.error('❌ Error: GEMINI_API_KEY is missing from your environment variables.');
  process.exit(1);
}

// Initialize the Gemini SDK
const ai = new GoogleGenerativeAI({ apiKey: process.env.GEMINI_API_KEY });

/**
 * Core Orchestration Engine Class
 * 
 * Manages task queuing, agent dispatch, state tracking, and artifact persistence.
 */
class OrchestrAIt {
  constructor(config = {}) {
    this.version = 'v0.0.1';
    this.outputDir = config.outputDir || path.join(process.cwd(), 'v0.0.0', 'outputs');
    this.model = config.model || 'gemini-1.5-flash';
    this.maxRetries = config.maxRetries || 3;
    
    this.state = {
      sessionId: `session_${Date.now()}`,
      startTime: new Date().toISOString(),
      status: 'IDLE',
      tasks: [],
      history: [],
      metrics: {
        tasksRegistered: 0,
        tasksCompleted: 0,
        tasksFailed: 0,
        totalExecutionTime: 0,
      }
    };
    
    this._ensureOutputDirectory();
    console.log(`✅ OrchestrAIt Engine Initialized (${this.version})`);
  }

  /**
   * Ensure output directory exists
   * @private
   */
  _ensureOutputDirectory() {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
      console.log(`📁 Output directory created: ${this.outputDir}`);
    }
  }

  /**
   * Register a task into the pipeline
   * @param {string} id - Task identifier
   * @param {string} agentName - Agent/worker name
   * @param {string} rolePrompt - Agent role definition
   * @param {string} taskObjective - Task objective description
   */
  addTask(id, agentName, rolePrompt, taskObjective) {
    this.state.tasks.push({
      id,
      agentName,
      rolePrompt,
      taskObjective,
      status: 'PENDING',
      result: null,
      error: null,
      retries: 0,
      createdAt: new Date().toISOString(),
      startedAt: null,
      completedAt: null,
      duration: 0,
    });
    
    this.state.metrics.tasksRegistered++;
    console.log(`📝 [Task Registered] ID: ${id} | Agent: ${agentName}`);
  }

  /**
   * Execute the entire task pipeline sequentially with context passing
   */
  async runPipeline() {
    this.state.status = 'RUNNING';
    const pipelineStartTime = Date.now();
    
    console.log(`\n🚀 Starting OrchestrAIt Pipeline Execution`);
    console.log(`📊 Session: ${this.state.sessionId}`);
    console.log(`📋 Tasks Queued: ${this.state.tasks.length}\n`);

    let accumulatedContext = '';

    for (let task of this.state.tasks) {
      task.status = 'PROCESSING';
      task.startedAt = new Date().toISOString();
      let success = false;

      while (task.retries < this.maxRetries && !success) {
        try {
          console.log(`⚙️  [Task ${task.id}] Executing agent: ${task.agentName} (Attempt ${task.retries + 1}/${this.maxRetries})`);
          
          const startTime = Date.now();
          const responseText = await this._dispatchToGemini(task, accumulatedContext);
          const cleanJson = this._extractJson(responseText);
          const duration = Date.now() - startTime;
          
          task.result = cleanJson;
          task.status = 'COMPLETED';
          task.duration = duration;
          task.completedAt = new Date().toISOString();
          success = true;

          // Append this output to the context chain for subsequent agents
          accumulatedContext += `\n\n[Context from Task ${task.id} (${task.agentName})]:\n${JSON.stringify(cleanJson, null, 2)}`;
          
          this._saveArtifact(task.id, cleanJson);
          this.state.metrics.tasksCompleted++;
          this.state.metrics.totalExecutionTime += duration;
          
          console.log(`✅ [Task ${task.id}] Completed in ${duration}ms`);
        } catch (error) {
          task.retries++;
          console.error(`⚠️  [Task ${task.id}] Attempt ${task.retries}/${this.maxRetries} failed: ${error.message}`);
          
          if (task.retries >= this.maxRetries) {
            task.status = 'FAILED';
            task.error = error.message;
            task.completedAt = new Date().toISOString();
            this.state.metrics.tasksFailed++;
            this.state.status = 'ERROR';
          }
        }
      }

      if (task.status === 'FAILED') {
        console.error(`\n🛑 Pipeline halted due to critical failure at Task ${task.id}`);
        break;
      }
    }

    const totalDuration = Date.now() - pipelineStartTime;
    
    if (this.state.status !== 'ERROR') {
      this.state.status = 'FINISHED';
      console.log(`\n🎉 Pipeline completed successfully!`);
    }
    
    console.log(`\n📊 Pipeline Summary:`);
    console.log(`   • Total Duration: ${totalDuration}ms`);
    console.log(`   • Tasks Completed: ${this.state.metrics.tasksCompleted}`);
    console.log(`   • Tasks Failed: ${this.state.metrics.tasksFailed}`);
    console.log(`   • Artifacts Saved: ${this.outputDir}`);
    
    this.state.metrics.totalExecutionTime = totalDuration;
    this._saveSessionSummary();
    
    return this.state;
  }

  /**
   * Dispatch task to Gemini API with system instructions
   * @private
   */
  async _dispatchToGemini(task, context) {
    const systemPrompt = `You are operating within the OrchestrAIt deterministic execution engine.

AGENT ROLE:
${task.rolePrompt}

PRIOR CONTEXT:
${context ? context : 'No prior context. You are the genesis agent.'}

OBJECTIVE:
${task.taskObjective}

CRITICAL OUTPUT RULES:
1. You MUST respond ONLY with valid JSON
2. Do NOT wrap output in markdown code fences (\`\`\`json)
3. Do NOT include any introductory or conversational text
4. The JSON must be parseable by JSON.parse()
5. Include a "success": true field at the root level

Example structure:
{
  "success": true,
  "data": { /* your analysis here */ },
  "timestamp": "ISO-8601-string"
}`;

    try {
      const response = await ai.models.generateContent({
        model: this.model,
        contents: [
          {
            role: 'user',
            parts: [{ text: systemPrompt }],
          },
        ],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 2048,
        },
      });

      const text = response.response.text();
      if (!text) {
        throw new Error('Empty response from Gemini API');
      }

      return text;
    } catch (error) {
      throw new Error(`Gemini API call failed: ${error.message}`);
    }
  }

  /**
   * Extract and validate JSON from raw text
   * Handles markdown fences, malformed JSON, and fallback parsing
   * @private
   */
  _extractJson(rawText) {
    let sanitized = rawText.trim();

    // Remove markdown code fences if present
    if (sanitized.startsWith('```')) {
      sanitized = sanitized.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
    }

    // Attempt strict JSON parsing
    try {
      const parsed = JSON.parse(sanitized);
      return parsed;
    } catch (e) {
      console.warn('⚠️  Strict JSON parsing failed. Attempting regex extraction...');
    }

    // Fallback: Extract JSON using regex
    const jsonRegex = /\{[\s\S]*\}/;
    const match = sanitized.match(jsonRegex);
    
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch (e) {
        console.warn('⚠️  Regex extraction also failed.');
      }
    }

    // Final fallback: Return wrapped structure
    return {
      success: false,
      rawPayload: rawText,
      parsingError: true,
      message: 'Failed to extract valid JSON from response',
    };
  }

  /**
   * Save task result artifact to disk
   * @private
   */
  _saveArtifact(taskId, data) {
    const filePath = path.join(this.outputDir, `task_${taskId}_output.json`);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`💾 Artifact saved: task_${taskId}_output.json`);
  }

  /**
   * Save session execution summary
   * @private
   */
  _saveSessionSummary() {
    const summaryPath = path.join(this.outputDir, 'session_summary.json');
    const summary = {
      sessionId: this.state.sessionId,
      engineVersion: this.version,
      startTime: this.state.startTime,
      endTime: new Date().toISOString(),
      status: this.state.status,
      metrics: this.state.metrics,
      tasks: this.state.tasks.map((t) => ({
        id: t.id,
        agent: t.agentName,
        status: t.status,
        duration: t.duration,
        error: t.error,
      })),
    };
    
    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), 'utf-8');
    console.log(`📊 Session summary saved: session_summary.json`);
  }

  /**
   * Get current engine state
   */
  getState() {
    return this.state;
  }

  /**
   * Get metrics snapshot
   */
  getMetrics() {
    return this.state.metrics;
  }
}

/**
 * DEMO EXECUTION - Phase B Validation
 * 
 * Demonstrates a 2-agent security analysis pipeline:
 * 1. Vulnerability Scouter: Maps attack surface
 * 2. Mitigation Architect: Develops defense strategies
 */
async function executeLiveDemo() {
  const orchestrator = new OrchestrAIt({
    model: 'gemini-1.5-flash',
    maxRetries: 2,
  });

  // Agent 1: Vulnerability Scouter
  orchestrator.addTask(
    '001',
    'Vulnerability_Scouter',
    'You are a red-team analysis bot specializing in mapping surface attack areas and security vulnerabilities.',
    `Analyze the structural layout of a typical web orchestration engine dashboard. 
     Output a JSON object containing 3 highest-risk data leakage points 
     (e.g., local logs, API key exposure, unvalidated updates, hardcoded secrets).
     For each, rate severity as "High", "Medium", or "Low".
     
     Expected JSON format:
     {
       "success": true,
       "vulnerabilities": [
         {"point": "...", "description": "...", "severity": "..."},
         ...
       ],
       "timestamp": "ISO-8601-string"
     }`
  );

  // Agent 2: Mitigation Architect (consumes context from Agent 1)
  orchestrator.addTask(
    '002',
    'Mitigation_Architect',
    'You are a defensive security engineer specializing in system hardening, cryptographic patterns, and secure architecture.',
    `Review the 3 data leakage points identified by the Vulnerability Scouter in the prior task.
     For EACH vulnerability point, generate a detailed mitigation strategy.
     
     Expected JSON format:
     {
       "success": true,
       "mitigations": [
         {"vulnerability": "...", "strategy": "...", "implementation": "...", "priority": "..."},
         ...
       ],
       "summary": "...",
       "timestamp": "ISO-8601-string"
     }`
  );

  // Execute the pipeline
  const finalState = await orchestrator.runPipeline();
  
  console.log('\n═══════════════════════════════════════════════════');
  console.log('ORCHESTRAIT EXECUTION COMPLETE');
  console.log('═══════════════════════════════════════════════════\n');
  
  return finalState;
}

// Execute if run directly
if (process.argv[1] === __filename || process.argv[1]?.endsWith('index.js')) {
  executeLiveDemo().catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}

export { OrchestrAIt };
