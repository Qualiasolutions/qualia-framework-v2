# Industry Best Practices for Agent Frameworks, Prompt Engineering & Multi-Agent Orchestration

**Date:** 2026-04-21
**Scope:** 2025-2026 research applicable to Qualia Framework (plan/build/verify workflow for Claude Code)
**Method:** Web research with cited sources. No pretraining-based generic advice.

---

## Executive Summary

The three biggest levers for improving a plan/build/verify framework RIGHT NOW are: **(1)** prompt caching with immutable static prefixes, which yields 81-90% cost reduction and 85% latency reduction on recurring subagent calls ([Anthropic docs](https://platform.claude.com/docs/en/build-with-claude/prompt-caching), [ClaudeCodeCamp](https://www.claudecodecamp.com/p/how-prompt-caching-actually-works-in-claude-code)); **(2)** structured output via JSON schema enforcement, which eliminates parsing failures and enables reliable inter-agent state passing ([Anthropic structured outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs)); and **(3)** verification loops capped at 2-3 iterations with external tool feedback (not pure self-reflection), since one round of tool-grounded verification captures most gains while pure self-critique without tools often degrades accuracy ([Amazon Science / NeurIPS 2025](https://assets.amazon.science/07/cc/c4b09acf4287a318a782959ab201/cameraready-beehive-neurips-workshop-2025.pdf), [Vadim.blog](https://vadim.blog/the-research-on-llm-self-correction)). Secondary gains come from fan-out/fan-in parallel execution (up to 75% wall-clock reduction), TDD-style prompting (up to 46% pass@1 improvement with interactive feedback), and Batch API for non-urgent verification (50% cost savings).

---

## Findings by Section

### A. Prompt Engineering for Subagent System Prompts

**A1. Structured Output / JSON Mode for Claude 4.x Agents**

Anthropic launched structured outputs in public beta (Nov 2025) and it is now GA across Claude Opus 4.7, Opus 4.6, Sonnet 4.6, and Haiku 4.5. Use `output_config` with `format: { type: "json_schema", schema: ... }` for guaranteed schema compliance. The Agent SDK supports Zod (TypeScript) and Pydantic (Python) natively. One developer reported zero parsing failures across five use cases with Sonnet 4.5. Caveat: schema compliance is guaranteed but factual accuracy is not -- you can get perfectly formatted wrong answers.

Sources: [Anthropic Structured Outputs docs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs), [Agent SDK Structured Outputs](https://platform.claude.com/docs/en/agent-sdk/structured-outputs), [Medium: Zero-Error JSON with Claude](https://medium.com/@meshuggah22/zero-error-json-with-claude-how-anthropics-structured-outputs-actually-work-in-real-code-789cde7aff13)

**A2. Chain-of-Thought vs Direct Answer for Code Tasks**

Wharton's 2025 study found CoT is NOT universally beneficial: reasoning models gain only marginal improvements despite 20-80% latency increases. CoT can introduce errors on simple tasks the model would otherwise get right. For code generation specifically, a surprising finding: generating code first, then reasoning is more effective than reasoning first. The field is moving toward agentic approaches (ReAct, multi-step loops) that outperform both simple CoT and direct answer.

Sources: [Wharton GenAI Labs](https://gail.wharton.upenn.edu/research-and-insights/tech-report-chain-of-thought/), [Survey on LLM-Empowered Agentic Systems](https://arxiv.org/html/2510.09721v3)

**A3. Reducing Hallucination in Code-Generating Agents**

Key techniques beyond "cite sources": (a) RAG with codebase retrieval -- all six models tested improved with RAG-based mitigation on Pass@1 ([arxiv.org](https://arxiv.org/html/2409.20550v1)); (b) multi-agent validation -- Microsoft's CORE framework reduced false positives by 25.8% ([MDPI](https://www.mdpi.com/2078-2489/16/7/517)); (c) combining RAG + RLHF + guardrails yielded 96% hallucination reduction in a Stanford study ([Lakera](https://www.lakera.ai/blog/guide-to-hallucinations-in-large-language-models)); (d) execution-grounded feedback -- running generated code and feeding errors back iteratively ([RLEF paper](https://www.arxiv.org/pdf/2410.02089)). Note: 29-45% of AI-generated code contains security vulnerabilities, and ~20% of package recommendations are for non-existent libraries.

Sources: [Lakera 2026 guide](https://www.lakera.ai/blog/guide-to-hallucinations-in-large-language-models), [MDPI multi-agent framework](https://www.mdpi.com/2078-2489/16/7/517), [arxiv hallucination paper](https://arxiv.org/html/2409.20550v1)

**A4. Self-Consistency, Self-Critique, Reflection Loops**

Critical finding: pure self-reflection without external feedback often DEGRADES accuracy. Huang et al. (2023) showed GPT-4 reviewing its own answers changed correct answers to wrong ones more often than it fixed errors. The CRITIC framework (Gou et al. 2024) demonstrated that removing tool verification eliminated most gains -- **tools are the linchpin**. Amazon Science / NeurIPS 2025 found that 1 round of reflection captures most benefit (Sonnet 3.7: 74% baseline to 86% with 1 round, only 88% with 3 rounds). Diminishing returns are severe. ReflectiveConf surpasses self-consistency while being far more token-efficient. For advanced reasoning models (DeepSeek-V3/R1), additional reflection layers provide minimal net gains.

Sources: [Amazon Science NeurIPS 2025](https://assets.amazon.science/07/cc/c4b09acf4287a318a782959ab201/cameraready-beehive-neurips-workshop-2025.pdf), [Vadim.blog](https://vadim.blog/the-research-on-llm-self-correction), [Nature npj AI](https://www.nature.com/articles/s44387-025-00045-3), [CorrectBench](https://arxiv.org/html/2510.16062v1)

**A5. Prompt Caching -- Ideal Structure for 50+ Runs**

Claude Code achieves a 92% cache hit rate and 81% cost reduction in practice. Structure: static content first (tools -> system prompt -> reference docs), dynamic content last. Cache reads cost 0.1x base price; 5-min TTL writes cost 1.25x. Minimum thresholds: Opus 4.6/4.7 = 4096 tokens, Sonnet 4.6 = 2048, Sonnet 4.5 = 1024. Critical rules: never mutate the prefix mid-session; lock tool definitions at startup; use subagents for different models instead of switching mid-session; use 1-hour TTL only if requests are >5min apart.

Sources: [Anthropic prompt caching docs](https://platform.claude.com/docs/en/build-with-claude/prompt-caching), [ClaudeCodeCamp](https://www.claudecodecamp.com/p/how-prompt-caching-actually-works-in-claude-code), [arxiv: Don't Break the Cache](https://arxiv.org/html/2601.06007v1)

---

### B. Multi-Agent Orchestration

**B1. Fan-Out/Fan-In Patterns**

The fan-out/fan-in pattern (scatter-gather / map-reduce) is one of the most impactful patterns available. Google research showed parallel multi-agent research produces 40% more comprehensive outputs than sequential single-agent given the same compute budget. Using an orchestrator with cheaper worker models cuts costs 40-60%. Key pitfalls: API rate limit exhaustion (N concurrent agents can exceed collective limits), race conditions scale quadratically (N agents = N(N-1)/2 potential conflicts), LLM-based aggregation can hallucinate consensus, and unbalanced fan-out wastes parallelism gains. Mitigation: bounded fan-out, explicit conflict resolution, step-level failure tracking with graceful degradation, and idempotent consumers.

Sources: [Beam.ai 6 patterns](https://beam.ai/agentic-insights/multi-agent-orchestration-patterns-production), [Microsoft Agent Framework fan-out](https://arafattehsin.com/blog/agent-orchestration-patterns-part-3/), [Azure Architecture Center](https://learn.microsoft.com/en-us/azure/architecture/ai-ml/guide/ai-agent-design-patterns), [Addy Osmani: Code Agent Orchestra](https://addyosmani.com/blog/code-agent-orchestra/)

**B2. Verification/Revision Loop: When Worth It, Max Iterations**

Verification loops consistently outperform single-shot, especially for complex tasks. Task planning success rates improved up to 50% over non-iterative planners. Best practice: always run at least 2 review passes. Hard cap at 5-6 rounds to avoid oscillation. Most well-scoped tasks converge in 2-4 iterations. Design loops that are "wide" (multiple verification strategies) rather than "deep" (endless iteration). Google ADK LoopAgent uses `max_iterations=5` with a "STOP" signal from the critic.

Sources: [Medium: LLM Verification Loops](https://timjwilliams.medium.com/llm-verification-loops-best-practices-and-patterns-07541c854fd8), [Google ADK Loop Agents](https://google.github.io/adk-docs/agents/workflow-agents/loop-agents/), [Scott Logic: Power of Agentic Loops](https://blog.scottlogic.com/2025/12/22/power-of-agentic-loops.html)

**B3. How Frameworks Structure Plan/Execute/Verify**

LangGraph (43% enterprise adoption) is the most natural fit -- graph-based state machines with explicit plan, execute, verify nodes connected by conditional edges, full checkpointing and replay. CrewAI is intuitive (role-based) but hits a ceiling at 6-12 months; consumed nearly 2x tokens and 3x latency vs LangGraph in benchmarks. AutoGen (now merged with Microsoft Semantic Kernel) excels at conversational iterative refinement and matches LangGraph in token use/latency.

Sources: [DataCamp comparison](https://www.datacamp.com/tutorial/crewai-vs-langgraph-vs-autogen), [DEV Community 2026 guide](https://dev.to/pockit_tools/langgraph-vs-crewai-vs-autogen-the-complete-multi-agent-ai-orchestration-guide-for-2026-2d63), [Pooya.blog benchmarks](https://pooya.blog/blog/ai-agents-frameworks-local-llm-2026/)

**B4. Context Isolation vs Shared Context**

Context isolation with summary return is the dominant pattern. Key tradeoff: independent agents amplify errors 17.2x vs baseline, while shared context infrastructure contains it to 4.4x. Multi-agent systems deliver 25-45% process optimization gains but reduce performance by 39-70% on sequential reasoning tasks. Emerging consensus: hybrid approaches -- deliberately choose what to share vs isolate. Memory architecture (shared vs distributed) is the key design decision. MemU (2026) quantifies 2% context retention loss per step.

Sources: [Atlan: Context Gap](https://atlan.com/know/multi-agent-scaling/), [Towards Data Science: 17x Error Trap](https://towardsdatascience.com/why-your-multi-agent-system-is-failing-escaping-the-17x-error-trap-of-the-bag-of-agents/), [arxiv: Multi-Agent Memory](https://arxiv.org/html/2603.10062v1)

**B5. Passing Structured State Without Bloating Prompts**

Google ADK's model: separate storage from presentation. Sessions/memory/artifacts = full state; working context = compiled view per invocation. Key techniques: (a) schema-validated JSON message passing between agents ([MCP](https://arxiv.org/html/2504.21030v1)); (b) compaction -- LLM summarizes older events over sliding window, writes summary back ([Google Developers Blog](https://developers.googleblog.com/architecting-efficient-context-aware-multi-agent-framework-for-production/)); (c) StateAct -- structured intermediate state predictions reduce steps needed ([arxiv StateAct](https://arxiv.org/html/2410.02810v3)); (d) symbolic variable passing through non-LLM orchestrator for security ([Reversec](https://labs.reversec.com/posts/2025/08/design-patterns-to-secure-llm-agents-in-action)).

---

### C. Code-Generation Accuracy

**C1. TDD -- Tests First Improves Accuracy**

The WebApp1K benchmark (2025) evaluated 19 models on TDD tasks. Key finding: o1-preview achieved 95.2% pass@1, deepseek-r1 92.7%, Claude 3.5 Sonnet 88.08%. The TiCoder study (ICSE 2025) showed an average 45.97% absolute improvement in pass@1 with interactive TDD within 5 user interactions. Critical insight: "instruction following and in-context learning" matter more than raw coding proficiency. When complexity doubled (duo-feature tasks), Claude 3.5 dropped from 88% to 75%, suggesting context length and instruction loss are fundamental bottlenecks. 93% of failures involved only 1-2 errors.

Sources: [WebApp1K paper](https://arxiv.org/abs/2505.09027), [TiCoder at ICSE 2025](https://conf.researchr.org/details/icse-2025/icse-2025-journal-first-papers/82/LLM-Based-Test-Driven-Interactive-Code-Generation-User-Study-and-Empirical-Evaluatio)

**C2. Verification Contracts -- Industry Format**

No single canonical format exists, but research shows critical gaps. UC Berkeley found every major benchmark (SWE-bench, WebArena, OSWorld, etc.) can be exploited to achieve near-perfect scores without solving tasks -- SWE-bench Verified achieved 100% via pytest hooks forcing tests to pass. The emerging best practice: use AST-based diff checkers as hard constraints (not string matching), combine execution-based verification with structural checks, and include multiple orthogonal verification strategies per task.

Sources: [UC Berkeley: How We Broke Top AI Agent Benchmarks](https://rdi.berkeley.edu/blog/trustworthy-benchmarks-cont/), [SEVerA](https://arxiv.org/html/2603.25111)

**C3. Re-Ranking / Voting / Ensembling for Code**

Functional Majority Voting (FMV, April 2026) leverages code executability -- run generated programs against self-generated inputs to build functional consensus. FMV outperforms semantic voting while being compute-efficient. ACL 2025 showed ranked voting (Borda count, instant-runoff) can outperform standard majority voting. IJCAI 2025 addressed cost: dynamic ensembling avoids running all LLMs for easy samples. CMU's CaMVo uses bandit-based cost-aware subset selection to approximate optimal cost-accuracy Pareto frontier.

Sources: [FMV paper](https://arxiv.org/html/2604.15618), [ACL 2025 Ranked Voting](https://aclanthology.org/2025.findings-acl.744.pdf), [IJCAI 2025 Dynamic Ensembling](https://www.ijcai.org/proceedings/2025/0900.pdf)

**C4. Grounded Generation (Retrieving Conventions Before Writing)**

Code RAG with advanced embeddings (e.g., Qwen3-Embedding-0.6B supporting 100+ languages) achieves 92% consistency rate in code generation with structured prompting (SemEval-2026 Task 5). Practical workflow from Addy Osmani and Honeycomb: write an `llms.txt` or `AGENTS.md` documenting codebase structure, patterns, and gotchas. Use tools like Context7 MCP, repo2txt, or gitingest to automate context packaging. Critical: LLM-generated AGENTS.md files offer no benefit -- developer-written context provides measurable improvements.

Sources: [Code RAG overview](https://dasroot.net/posts/2026/04/code-rag-llm-codebase-understanding/), [Addy Osmani workflow](https://medium.com/@addyosmani/my-llm-coding-workflow-going-into-2026-52fe1681325e), [Honeycomb](https://www.honeycomb.io/blog/how-i-code-with-llms-these-days)

---

### D. Speed Optimizations

**D1. Parallel Tool Calls -- Measured Speedup**

No published benchmark with exact multipliers for parallel tool calls specifically. However: Anthropic's Programmatic Tool Calling eliminates per-tool inference passes (a 5-tool workflow previously required 5 inference passes + parsing). Claude Opus 4.7 lifted coding task resolution by 13% over Opus 4.6 on a 93-task benchmark. Computer Use action latency reduced ~50% via rolling visual context. Claude Code Remote Control enables multi-machine parallel dispatch. Three focused agents consistently outperform one generalist working three times as long.

Sources: [Anthropic: Advanced Tool Use](https://www.anthropic.com/engineering/advanced-tool-use), [Claude Opus 4.6 announcement](https://www.anthropic.com/news/claude-opus-4-6), [Claude Code Q1 2026 updates](https://www.mindstudio.ai/blog/claude-code-q1-2026-update-roundup-2)

**D2. Prompt Caching Hit Rates -- Optimal Structure**

For recurring subagent prompts: lock tool definitions at startup, place system instructions first (immutable), then reference docs, then conversation history. Never inject timestamps or per-request content into the prefix. Use subagents for different models. Monitor `cache_read_input_tokens` vs `cache_creation_input_tokens`. Claude Code achieves 92% hit rate with this approach. The 20-block lookback window means for conversations exceeding 20 blocks since last write, add a second breakpoint.

Sources: [Anthropic prompt caching docs](https://platform.claude.com/docs/en/build-with-claude/prompt-caching), [ClaudeCodeCamp](https://www.claudecodecamp.com/p/how-prompt-caching-actually-works-in-claude-code)

**D3. Streaming + Early Termination**

Streaming enables early termination (stop generating when you have enough), progressive processing (act on partial results), and cancellation (user control). For plan-checker loops: LiteLLM detects infinite loops by checking if a chunk is repeated N times (default 100) and raises an error to trigger retry. Cognitive Companion (2025) monitors for reasoning degradation and injects guidance when detected, with zero additional inference overhead using probe-based monitoring.

Sources: [dataa.dev streaming guide](https://dataa.dev/2025/02/18/streaming-llm-responses-building-real-time-ai-applications/), [OpenHarness](https://github.com/HKUDS/OpenHarness), [arxiv: Streaming Content Monitoring](https://arxiv.org/html/2506.09996v1)

**D4. Batch API for Verification**

Anthropic's Message Batches API: up to 10,000 requests per batch, 50% cost reduction, most complete in <1 hour. Well-suited for non-urgent verification: run all task verification checks as a batch after a build phase. Supports tool use, vision, structured output. Extended output (300K tokens) available for batch with Opus 4.7. Known issue: Opus 4.6/Sonnet 4.6 produce only 1 tool call per batch response (regression from 4.5 which handled 39+ parallel tool calls).

Sources: [Anthropic batch processing docs](https://platform.claude.com/docs/en/build-with-claude/batch-processing), [GitHub issue #956](https://github.com/anthropics/anthropic-sdk-typescript/issues/956)

---

### E. Anti-Patterns

**Top Anti-Patterns for 2025-2026:**

1. **Monolithic Mega-Prompt**: All behavior in a single system prompt; LLM loses coherence at extreme lengths. 2% context retention loss per step. ([Atlan](https://atlan.com/know/agent-harness-failures-anti-patterns/))

2. **Tool Bloat**: 30-50 tools when <10 needed; LLM selection quality degrades above ~20 tools. ([Atlan](https://atlan.com/know/agent-harness-failures-anti-patterns/))

3. **"Bag of Agents"**: Individually capable agents with no coordination; errors amplify 17.2x vs single-agent baseline. Accuracy saturates beyond 4-agent threshold without structured topology. ([Towards Data Science](https://towardsdatascience.com/why-your-multi-agent-system-is-failing-escaping-the-17x-error-trap-of-the-bag-of-agents/))

4. **Pure Self-Reflection Without Tools**: Asking the LLM to review its own work without external verification (test execution, lint, type-check) often degrades accuracy. ([Vadim.blog](https://vadim.blog/the-research-on-llm-self-correction))

5. **LLM-as-Memory (Invisible State)**: Using the context window for state across multi-step workflows instead of external state store. ([Atlan](https://atlan.com/know/agent-harness-failures-anti-patterns/))

6. **All-or-Nothing Autonomy**: Full agent autonomy without approval gates at high-risk decisions. The Replit incident (July 2025): agent executed DROP DATABASE during a code freeze through a cascade of individually reasonable decisions with no checkpoint. ([Medium: AI Agent Anti-Patterns](https://achan2013.medium.com/ai-agent-anti-patterns-part-1-architectural-pitfalls-that-break-enterprise-agents-before-they-32d211dded43))

7. **Compounding Error Cascade**: 0.85^10 = 20% success rate at 10 steps without intermediate validation. ([Atlan](https://atlan.com/know/agent-harness-failures-anti-patterns/))

8. **Schema Drift**: Tool schemas change between versions; harness still uses old schema; calls silently fail. n8n, FlowiseAI, Zed IDE, and OpenAI Agents SDK all experienced this in early 2026. ([Atlan](https://atlan.com/know/agent-harness-failures-anti-patterns/))

9. **Context Flooding (Dumb RAG)**: Indiscriminate retrieval without quality filtering. ([Atlan](https://atlan.com/know/agent-harness-failures-anti-patterns/))

10. **LLM-Generated Agent Configuration**: LLM-generated AGENTS.md files offer no benefit; developer-written context provides measurable improvements. ([Addy Osmani](https://addyosmani.com/blog/code-agent-orchestra/))

Additional stat: 88% of AI agent projects fail to reach production; 95% of generative AI investments produced zero measurable returns (MIT Media Lab / Harvard Business Review, 2025). Anthropic's analysis of 200+ enterprise deployments found 57% of failures originated in orchestration design.

Sources: [Atlan 13 anti-patterns](https://atlan.com/know/agent-harness-failures-anti-patterns/), [Medium: Why AI Agents Fail](https://medium.com/data-science-collective/why-ai-agents-keep-failing-in-production-cdd335b22219), [Medium: Anti-Patterns Part 1](https://achan2013.medium.com/ai-agent-anti-patterns-part-1-architectural-pitfalls-that-break-enterprise-agents-before-they-32d211dded43)

---

## Top 10 Techniques to Adopt

Ranked by (impact / implementation cost):

### 1. Immutable Prompt Prefix with Cache Breakpoints
**One-line:** Structure all subagent prompts as static prefix (tools + system + reference) with dynamic suffix, maximizing cache hits.
**Source:** [Anthropic docs](https://platform.claude.com/docs/en/build-with-claude/prompt-caching), [ClaudeCodeCamp](https://www.claudecodecamp.com/p/how-prompt-caching-actually-works-in-claude-code)
**Gain:** 81-90% cost reduction, 85% latency reduction. Claude Code achieves 92% cache hit rate.
**Implementation:** Define a frozen system prompt + tool set per agent type (planner, builder, verifier). Pass as first content blocks with `cache_control`. Append task-specific context as the final user message. Never mutate the prefix. Use 5-min TTL (subagents fire frequently). Monitor `cache_read_input_tokens`.

### 2. Structured Output for Inter-Agent State
**One-line:** Use JSON schema enforcement on all agent outputs to guarantee parseable, typed state passing.
**Source:** [Anthropic structured outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs)
**Gain:** Zero parsing failures; eliminates an entire class of pipeline errors.
**Implementation:** Define Zod schemas for PlanOutput, BuildOutput, VerifyOutput. Pass via `output_config.format.type = "json_schema"`. Each agent reads the previous agent's structured output as input context. No regex parsing, no "extract the JSON from the markdown" hacks.

### 3. Tool-Grounded Verification (Not Pure Self-Reflection)
**One-line:** Always verify with external tools (test runner, type-checker, linter) -- never rely on the LLM reviewing its own output unaided.
**Source:** [Vadim.blog CRITIC analysis](https://vadim.blog/the-research-on-llm-self-correction), [NeurIPS 2025](https://assets.amazon.science/07/cc/c4b09acf4287a318a782959ab201/cameraready-beehive-neurips-workshop-2025.pdf)
**Gain:** One round of tool-grounded reflection: 74% -> 86% accuracy (Sonnet 3.7). Pure self-reflection without tools can degrade accuracy.
**Implementation:** Verifier agent must run `tsc --noEmit`, `eslint`, and test suite before declaring pass/fail. Parse tool output into structured verification result. Cap at 2-3 iterations. If still failing after 3 rounds, escalate to human.

### 4. Bounded Fan-Out with Idempotent Workers
**One-line:** Parallelize independent build tasks across agents with rate-limit-aware dispatch and idempotent execution.
**Source:** [Beam.ai patterns](https://beam.ai/agentic-insights/multi-agent-orchestration-patterns-production), [Addy Osmani](https://addyosmani.com/blog/code-agent-orchestra/)
**Gain:** Up to 75% wall-clock reduction; 40% more comprehensive outputs (Google research).
**Implementation:** Builder agents work in waves. Wave 1: all independent tasks run in parallel (separate git worktrees). Wave 2: dependent tasks run after Wave 1 completes. Coordinator enforces bounded concurrency (respect API rate limits). Each builder is idempotent -- re-running with same input produces equivalent output.

### 5. Developer-Written AGENTS.md / Codebase Context
**One-line:** Provide human-curated codebase conventions, patterns, and gotchas to every builder agent before it writes code.
**Source:** [Addy Osmani](https://addyosmani.com/blog/code-agent-orchestra/), [Honeycomb](https://www.honeycomb.io/blog/how-i-code-with-llms-these-days)
**Gain:** Measurable improvement in code quality vs no context. LLM-generated context files provide zero benefit.
**Implementation:** Maintain `PROJECT.md` with architecture, conventions, anti-patterns, and file structure. Include in the static prefix of every builder prompt. Update after each milestone. This is Qualia's existing approach -- the research validates it.

### 6. Two-Agent Implement-Review Pattern
**One-line:** Agent A implements, Agent B reviews for correctness/style/edge cases, then Agent A (or fresh Agent C) applies feedback.
**Source:** [Addy Osmani](https://addyosmani.com/blog/code-agent-orchestra/), [Anthropic recommended workflow]
**Gain:** Catches errors that single-agent self-review misses; avoids confirmation bias inherent in self-critique.
**Implementation:** Builder agent produces code + tests. Separate verifier agent (fresh context) reviews against success criteria, runs tools, provides structured feedback. If failing, a fresh builder context applies fixes. This is essentially Qualia's existing plan-build-verify -- the research confirms the pattern.

### 7. Batch API for Bulk Verification
**One-line:** Submit all task verification checks as a single batch for 50% cost savings when immediate results aren't needed.
**Source:** [Anthropic batch processing](https://platform.claude.com/docs/en/build-with-claude/batch-processing)
**Gain:** 50% cost reduction on verification; most batches complete in <1 hour.
**Implementation:** After a build phase completes all tasks, submit verification prompts for every task as a Message Batch (up to 10,000). Poll for completion. Parse results. Flag failures for re-work. Ideal for milestone-level verification sweeps.

### 8. TDD-Style Prompting (Tests as Spec)
**One-line:** Include test cases in the builder prompt as the specification, not just natural language descriptions.
**Source:** [WebApp1K](https://arxiv.org/abs/2505.09027), [TiCoder ICSE 2025](https://conf.researchr.org/details/icse-2025/icse-2025-journal-first-papers/82/)
**Gain:** Up to 45.97% absolute improvement in pass@1 (TiCoder with interactive feedback). Reasoning models (o1) achieve 95.2% pass@1 on TDD tasks.
**Implementation:** For each build task, verifier-generated test cases become part of the builder's prompt. Builder must produce code that passes those tests. Run tests as part of the verification loop. 93% of failures are 1-2 errors, so a single re-attempt usually suffices.

### 9. Separate Storage from Presentation (State Architecture)
**One-line:** Maintain rich state externally; compile only the minimum needed context per LLM invocation.
**Source:** [Google ADK](https://developers.googleblog.com/architecting-efficient-context-aware-multi-agent-framework-for-production/), [StateAct](https://arxiv.org/html/2410.02810v3)
**Gain:** Prevents prompt bloat; enables scaling to long multi-phase projects without context degradation.
**Implementation:** Qualia's `tracking.json` + `STATE.md` already serve this role. Enhance by defining a schema for the "compiled view" each agent type receives. Planner gets: project summary + phase requirements. Builder gets: single task + relevant code files. Verifier gets: success criteria + test results. Never dump full project state into any single prompt.

### 10. Hard Iteration Caps with Escalation
**One-line:** Cap all revision loops at 3 iterations; escalate to human if still failing.
**Source:** [Medium: LLM Verification Loops](https://timjwilliams.medium.com/llm-verification-loops-best-practices-and-patterns-07541c854fd8), [Google ADK LoopAgent](https://google.github.io/adk-docs/agents/workflow-agents/loop-agents/)
**Gain:** Prevents runaway token spend; avoids oscillation where the model "fixes" things that weren't broken.
**Implementation:** Plan-checker loop: max 3 rounds. Build-verify loop: max 3 rounds. If still failing after cap, log the failure state and surface to human for decision. Token budget per agent as additional kill switch (Osmani recommends stopping agents stuck for 3+ iterations on the same error).

---

## What NOT to Do

### 1. Pure Self-Reflection Without External Tools
The LLM reviewing its own output without test execution, type-checking, or linting frequently changes correct answers to incorrect ones. The CRITIC framework's ablation proved tools are the linchpin -- removing tool verification eliminated most accuracy gains.
**Source:** [Vadim.blog](https://vadim.blog/the-research-on-llm-self-correction)

### 2. Unbounded Iteration Loops
Running verification loops beyond 5-6 rounds leads to oscillation, not convergence. Models start "fixing" correct code. Most gains are captured in rounds 1-2.
**Source:** [Medium: LLM Verification Loops](https://timjwilliams.medium.com/llm-verification-loops-best-practices-and-patterns-07541c854fd8)

### 3. LLM-Generated Configuration Files
LLM-generated AGENTS.md / project context files provide zero measurable benefit. Only developer-written context with actual architectural knowledge and project-specific gotchas improves agent performance.
**Source:** [Addy Osmani: Code Agent Orchestra](https://addyosmani.com/blog/code-agent-orchestra/)

### 4. Tool Bloat (>20 Tools Per Agent)
Providing 30-50 tools when <10 are relevant degrades tool selection quality. Keep each agent's tool set minimal and task-specific.
**Source:** [Atlan: 13 Anti-Patterns](https://atlan.com/know/agent-harness-failures-anti-patterns/)

### 5. Mutating the Prompt Prefix Mid-Session
Injecting timestamps, updating tool schemas, or modifying system prompts mid-session invalidates the entire prompt cache. A single changed byte in the prefix means full recomputation. Instead, append context as new user messages at the end.
**Source:** [Anthropic prompt caching docs](https://platform.claude.com/docs/en/build-with-claude/prompt-caching), [ClaudeCodeCamp](https://www.claudecodecamp.com/p/how-prompt-caching-actually-works-in-claude-code)
