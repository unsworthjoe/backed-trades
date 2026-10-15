// SessionStart hook: shows LAUNCH-TODO.md when Claude Code starts in this project.
const fs = require('fs');
const path = require('path');

const root = process.env.CLAUDE_PROJECT_DIR || path.resolve(__dirname, '..', '..');
let todo;
try {
  todo = fs.readFileSync(path.join(root, 'LAUNCH-TODO.md'), 'utf8');
} catch {
  process.exit(0);
}

process.stdout.write(
  JSON.stringify({
    systemMessage: '\n' + todo,
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext:
        "The user's launch to-do list is in LAUNCH-TODO.md (it was shown to them at startup). " +
        'When a step or sub-step gets done, or new launch tasks come up, update that file.',
    },
  }),
);
