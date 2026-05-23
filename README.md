About The Project
Most agent frameworks trap you in dependency hell and over-architected abstractions. OrchestrAIt is built on a different philosophy: highly compact, deterministic control structures that orchestrate fluid, multi-turn AI interactions without losing state or dropping performance.

Here is why it is built this way:

Single-File Execution Potential: Written cleanly so core components can be dropped into an MVP without sprawling directory structures.

Low Latency Routing: Event-driven mechanics handle messaging and task distribution instantly.

Deterministic Output: Structured JSON control loops prevent infinite execution and runaway token usage.

Built With
Getting Started
Prerequisites
Make sure you have Node.js installed on your machine.

npm

npm install npm@latest -g


### Installation

1. Get an API key from Google AI Studio.
2. Clone the repository:
   ```sh
git clone https://github.com/yourusername/OrchestrAIt.git
Install the minimal package footprints:

npm install

4. Set up your environment variables in a `.env` file:
   ```env
GEMINI_API_KEY="your_api_key_here"
NODE_ENV="production"
Usage
Run the primary orchestration cycle directly via CLI to process complex, multi-turn prompts:

Bash


node index.js --task "analyze-vulnerability-surface"
Pipeline Example
JavaScript


const { Orchestrator } = require('./index.js');

const engine = new Orchestrator({
  mode: 'autonomous',
  telemetry: true
});

engine.dispatch('Execute scan and stream structured JSON output.');
Roadmap
[x] High-velocity single-file core engine architecture

[x] Structured JSON parsing logic and defensive validation loops

[ ] Integration with Hyperswarm/DHT layers for decentralized command and control telemetry

[ ] Multi-turn adversarial response testing tools

Contributing
Contributions are welcome, keeping a strict eye on simplicity. Keep it flat, keep it fast.

Fork the Project

Create your Feature Branch (git checkout -b feature/AmazingFeature)

Commit your Changes (git commit -m 'Add some AmazingFeature')

Push to the Branch (git push origin feature/AmazingFeature)

Open a Pull Request

License
Distributed under the Unlicense License. See LICENSE for more information.

Contact
Project Link: https://github.com/yourusername/OrchestrAIt
