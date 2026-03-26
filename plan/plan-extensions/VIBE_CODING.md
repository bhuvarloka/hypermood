# AI Collaboration Rules (Vibe Coding)

This document contains best practices extracted for Human-AI collaboration on the HyperMood codebase, based on the principles of Vibe Coding.

## 🤖 Agent Instructions

1. **Architecture & Scope Before Code** 
   When tasked with a new phase listed in the main `PLAN.md` (e.g., executing the pgvector query logic or building the Inngest jobs pipeline), **STOP** and output a brief architecture plan. Do not write code until the human approves the architecture and strategy.

2. **Self-Critique & Anti-Over-Engineering**
   Before recommending new complex infrastructure (e.g., Neo4j, Knowledge Graphs, exotic search types, heavy libraries), proactively self-critique. Always evaluate and justify if the goal can be confidently achieved with the existing defined stack (`Next.js`, `Supabase`, `pgvector`, `ImageKit`, `Inngest`). Simplicity is heavily favored.

3. **Test Queries First**
   For the Semantic Image App functionality, before modifying the vision indexing `prompt.md` or changing the natural language search mapping logic, define 3-5 concrete edge-case test queries (e.g., specific object vs. broad theme vs. comparative abstraction). Verify the architecture supports them to avoid garbage-in scenarios.

4. **Human-in-the-Loop Validation**
   Always follow the `Prompt -> Generate Plan -> Review -> Code` structure. After completing a milestone from `tasks.md`, explicitly pause for human validation and review before chaining into the next task.
