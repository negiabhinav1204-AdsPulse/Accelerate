---
name: update-claude-docs
description: Updates CLAUDE.md files at repo root and each major module level to reflect current codebase state
user_invocable: true
---

# Update CLAUDE.md Documentation

You are updating CLAUDE.md files to reflect the current state of the codebase. CLAUDE.md files serve as contextual documentation that helps Claude Code (and developers) understand each part of the codebase quickly.

## Rules

1. **Two levels of CLAUDE.md:**
   - **Repo root** (`CLAUDE.md`): High-level overview — what the service does, tech stack, project structure, key modules with links to child CLAUDE.md files, API endpoints, env vars, inter-service deps
   - **Major module level** (e.g., `src/agentic_platform/tools/CLAUDE.md`): Deep usage guide — architecture, code examples, configuration, error handling, file inventory

2. **Child CLAUDE.md linking:**
   - Root CLAUDE.md must reference child CLAUDE.md files: `See [tools/CLAUDE.md](src/agentic_platform/tools/CLAUDE.md) for details.`
   - This tells Claude Code to load the child docs when working in that module

3. **What to include:**
   - Purpose of the module/service
   - How to use it (code examples for modules, CLI commands for service)
   - How to add new things (e.g., "How to add a new tool" in tools/CLAUDE.md)
   - Configuration options (env vars, dataclass configs)
   - Key design decisions that aren't obvious from code
   - "DO NOT create alternatives" warnings for shared infrastructure

4. **What NOT to include:**
   - Implementation details that are obvious from reading the code
   - Git history or changelog
   - TODOs or planned features
   - Overly verbose explanations

5. **When a module-level CLAUDE.md is needed:**
   - The module has 3+ files
   - The module is infrastructure that other modules depend on
   - The module has non-obvious usage patterns or configuration

## Process

1. Read the current directory structure: `ls -R src/agentic_platform/`
2. For each major module directory, check if CLAUDE.md exists and if it's up to date
3. Read key source files to understand current state
4. Create or update module-level CLAUDE.md files for: tools/, strategies/, infra/http_client/, domains/
5. Update the repo-root CLAUDE.md to reflect structural changes and link to all child CLAUDE.md files
6. Ensure root CLAUDE.md has "See [path/CLAUDE.md]" links for every module that has one

## CLAUDE.md Template (Repo Root)

```markdown
# [Service Name]

## What This Service Does
[1-2 sentences]

## Tech Stack
[Bullet list of key technologies]

## Project Structure
[Tree view of src/ directory]

## How to Run
[Setup + run commands]

## Key Modules
[For each major module: 1-line description + usage example + link to module CLAUDE.md]
[Include "DO NOT create alternatives" warnings for shared infra]

## API Endpoints
[Table: Method | Path | Description]

## Environment Variables
[Table: Variable | Default | Description]

## Inter-Service Dependencies
[Bullet list of services called/called by]
```

## CLAUDE.md Template (Module Level)

```markdown
# [Module Name] (`path/`)

## Purpose
[What and why]

## Architecture
[ASCII diagram if helpful]

## How to Add New [Thing]
[Step-by-step guide for the most common task in this module]

## Usage
[Code examples — the primary way to use this module]

## Files
[Table: File | Purpose]

## Key Design Decisions
[Non-obvious choices and why they were made]
```
