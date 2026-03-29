#!/bin/bash
# PostToolUse hook: detects git commit/push and suggests CLAUDE.md update.
# Claude Code reads stdout as context for its next action.

INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('tool_name',''))" 2>/dev/null)
COMMAND=$(echo "$INPUT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('tool_input',{}).get('command',''))" 2>/dev/null)

# Only act on Bash tool calls that are git commit or push
if [ "$TOOL_NAME" = "Bash" ]; then
    if echo "$COMMAND" | grep -qE 'git (commit|push)'; then
        echo "Git operation detected. Run /update-claude-docs in background to keep CLAUDE.md files in sync."
    fi
fi

exit 0
