- [ ] 25d95627e3fe26fd4a55399598f30c385be7e6e5 is commit hash for 0.0.0 PoC
- [ ] deployment of index.html is verified by user manually @royhodge812 at https://royhodge812.github.io/test-1/
  - [ ] attach screenshot or image to repo an commit for checkpoint status!!


## [0.0.2] — fixes

### Fixed
- `package.json` `"type"` field corrected from `"commonjs"` to `"module"` — all source files are ESM
- `@google/generative-ai` dependency pinned to `^0.24.1` (was `^0.3.0`; API surface changed significantly)
- `dotenv` added as explicit dependency (was imported but not declared)
- Node.js engine requirement bumped to `>=18.0.0` (ESM top-level await support)
- `GoogleGenerativeAI` constructor fixed: takes `apiKey` string directly, not `{ apiKey }` object wrapper
- `ai.models.generateContent()` replaced with correct SDK path: `getGenerativeModel({ model }) → generateContent()`
- `agents/GeminiAgent.js` and `agents/index.js` converted from CJS (`require`/`module.exports`) to ESM (`import`/`export`)
- `OrchestrAIt` in `index.js` now instantiates and delegates to `GeminiAgent` — unified execution path, no parallel dispatch logic
- `_extractJson()` updated to handle already-parsed objects returned by `GeminiAgent` (avoids double-parse)
- Exponential backoff added between retries (was missing in original retry loop)
- `session_summary.json` now includes `agentStats` from `GeminiAgent.getStats()`
- `examples/basic-usage.js` updated to ESM and correct API usage
