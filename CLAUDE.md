# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Claude Code specifics

- `.claude/settings.json` pre-allowlists the Python toolchain (`uv
  sync/run/add/lock`, `pytest`, `ruff check/format`, `mypy`) and denies
  destructive git/shell operations — extend it as new commands are
  introduced rather than working around it.
- `.claude/skills/` mirrors `.agents/skills/`; both are placeholders until
  there's real code for a skill to operate on.
