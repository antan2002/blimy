# Ultimate Blimy AI Feature Expansion Prompt

**Objective:** Implement advanced agentic features (inspired by Cursor and Antigravity) into the Blimy codebase strictly **without** disrupting the existing layout, relying on background processes, Monaco editor diagnostics, and hidden agent loops.

Please implement the following architectural features exactly as described in their specified locations:

---

## 1. Native `@Web` Context

**Goal:** Allow the AI to natively search the web without needing the user to configure external MCP servers manually.
**Locations:**

- Frontend Tool: `src/features/ai/tools/web-search-tool.ts`
- Prompt Injection: `src/features/ai/lib/composer-context.ts`

**Implementation Details:**

1. Create a `web-search-tool.ts` that defines a `search_web` tool schema using the standard Blimy tool interface.
2. The tool should utilize the native `fetch` API via Tauri to hit a lightweight search API (e.g., DuckDuckGo HTML parsing or a free tier search API).
3. Update `composer-context.ts` so that if the user prompt contains the string `@web`, it appends a hidden system instruction: _"The user requested @web context. You MUST use the search_web tool to look up recent information before answering."_

---

## 2. Native `@Docs` Indexing

**Goal:** Allow users to paste a doc URL and have Blimy crawl and vectorize it for context.
**Locations:**

- Rust Backend: `crates/docs-indexer/src/main.rs` (New crate)
- Frontend Manager: `src/features/ai/docs/docs-indexer.ts`

**Implementation Details:**

1. Create a Tauri command `crawl_and_index_docs(url: String)` in Rust. Use the `reqwest` and `scraper` crates to extract plain text from the URL and its immediate sub-links.
2. Instead of a heavy Vector DB, use a lightweight TF-IDF or BM25 local index in Rust, or chunk the text and store it in SQLite (`rusqlite`).
3. Provide the AI with a `query_indexed_docs` tool. When the user types `@docs <url>`, the frontend triggers the indexing (showing a subtle toast notification), and the agent queries the SQLite database for relevant chunks.

---

## 3. Bug Finder (Proactive Background Review)

**Goal:** Proactively scan unsaved/uncommitted code for bugs and render them as Monaco editor squiggles, bypassing the chat UI entirely.
**Locations:**

- Rust Monitor: `crates/git-monitor/src/lib.rs`
- Frontend Service: `src/features/ai/continuous-agents/bug-finder-service.ts`
- UI Integration: `src/features/editor/lsp/lsp-client.ts` or Diagnostics Toolbar

**Implementation Details:**

1. In Rust, use the `notify` crate to watch for file saves in the workspace. Emit a `file-saved` Tauri event containing the file diff.
2. In `bug-finder-service.ts`, listen for this event. Quietly instantiate a **headless** instance of the AI model (bypassing `ai-chat.store`) with a strict system prompt: _"Review this diff. Output ONLY JSON array of bugs with line numbers. If no bugs, output empty array."_
3. Map the resulting JSON directly into Monaco Editor markers (squiggles) using the existing diagnostics architecture. No chat UI changes required.

---

## 4. Background Task Scheduling (Cron)

**Goal:** Allow the agent to set timers to poll pipelines or wake itself up.
**Locations:**

- Rust Scheduler: `crates/scheduler/src/lib.rs`
- Frontend Tool: `src/features/ai/tools/schedule-tool.ts`

**Implementation Details:**

1. Implement `schedule_tool` in the frontend that takes `cron_expression` and `prompt`.
2. Pass this to a Tauri command `add_cron_job`. Use the `tokio-cron-scheduler` crate in Rust.
3. When the cron fires, Rust emits an `agent-wakeup` event.
4. The frontend listener intercepts this event and silently pushes the `prompt` into the `ai-chat.store` as a high-priority system message, causing the `ContinuousAgentRunner` to wake up and process it in the background.

---

## 5. Hierarchical Subagents

**Goal:** Allow the main agent to spawn child agents for parallel tasks.
**Locations:**

- Frontend Logic: `src/features/ai/continuous-agents/subagent-manager.ts`
- Frontend Tool: `src/features/ai/tools/spawn-subagent-tool.ts`

**Implementation Details:**

1. Give the main agent a `spawn_subagent(task_description)` tool.
2. In `subagent-manager.ts`, when the tool is called, create an isolated `ChatSession` in memory that is NOT bound to the React UI store.
3. Run the standard `ContinuousAgentRunner` loop on this isolated session.
4. When the subagent concludes (stops calling tools), return its final message back as the tool response to the parent agent.

---

## 6. Visual Browser Subagent

**Goal:** Allow the agent to visually inspect local dev servers (e.g., `localhost:14321`).
**Locations:**

- Rust Backend: `crates/browser-automation/`
- Frontend Tool: `src/features/ai/tools/browser-tool.ts`

**Implementation Details:**

1. Integrate the `playwright-rust` or `headless_chrome` crate into the Tauri backend.
2. The agent uses the `browser_action(url, action)` tool.
3. Rust spins up a headless Chromium instance, executes the action, captures a viewport screenshot, compresses it to WebP, and returns the base64 image data.
4. The frontend injects the base64 image into the LLM context so the agent can visually verify UI changes.

---

## 7. Community Rules Directory

**Goal:** Allow users to install `.cursorrules` equivalents from the community.
**Locations:**

- UI Component: `src/features/settings/components/ai/rules-directory.tsx` (Add as a new tab in settings)

**Implementation Details:**

1. Fetch a public `rules.json` from a GitHub repository containing community prompts.
2. Render a simple grid of rules (e.g., "Next.js Expert", "Tauri/Rust Architect").
3. When "Install" is clicked, write the raw markdown directly to `.blimy/rules/<name>.md`.
4. Because `project-rules.ts` already automatically parses `.blimy/rules/`, the rules take effect immediately across the app with zero further wiring.
