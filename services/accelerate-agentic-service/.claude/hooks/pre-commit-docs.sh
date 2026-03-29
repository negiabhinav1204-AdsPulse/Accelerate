#!/bin/bash
# PreToolUse hook: blocks git commit if source files changed but CLAUDE.md wasn't updated.
# Exit 0 = allow, exit 2 = block (stdout shown to Claude as reason).

INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('tool_name',''))" 2>/dev/null)
COMMAND=$(echo "$INPUT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('tool_input',{}).get('command',''))" 2>/dev/null)

# Only act on git commit commands
if [ "$TOOL_NAME" != "Bash" ]; then
    exit 0
fi

if ! echo "$COMMAND" | grep -qE 'git commit'; then
    exit 0
fi

# Check if any source files are staged
STAGED_SRC=$(git diff --cached --name-only -- 'src/' 'tests/' 2>/dev/null)
if [ -z "$STAGED_SRC" ]; then
    exit 0
fi

# Check if any CLAUDE.md file is staged
STAGED_DOCS=$(git diff --cached --name-only -- '**/CLAUDE.md' 'CLAUDE.md' 2>/dev/null)
if [ -n "$STAGED_DOCS" ]; then
    exit 0
fi

# Source files staged but no CLAUDE.md — block the commit
echo "BLOCKED: Source files are staged but CLAUDE.md files were not updated."
echo "Run /update-claude-docs first, then stage the updated CLAUDE.md files before committing."
echo ""
echo "Staged source files:"
echo "$STAGED_SRC" | head -10
exit 2
