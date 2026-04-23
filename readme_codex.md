# README_CODEX.md

## Purpose

This document defines how to use Codex effectively to build the project defined in `specs.md` and `tasks.md`.

Codex should behave as a focused backend/frontend engineer following strict instructions.

---

## Global Rules for Codex

- Always read `specs.md` before starting
- Always follow `tasks.md` step-by-step
- Do NOT skip phases
- Do NOT introduce a database
- Use filesystem only
- Keep code simple and modular
- Do NOT overengineer
- Prefer clarity over cleverness

---

## Execution Strategy

Codex must work in **small iterations**.

For EACH task:

1. Implement the task
2. Run tests related to that task to validate it
3. Confirm the tests passed
4. Update `project_status.md`
5. Show created/modified files
6. Explain what was done
7. Wait for confirmation before continuing

---

## Standard Prompt Template

Use this template for every task:

```
Read specs.md and tasks.md

Execute Task X.X

Requirements:
- Follow the spec strictly
- Keep implementation minimal
- Do not add extra features

After completing:
- Run tests for the task and confirm they passed
- Update `project_status.md`
- Show all created/modified files
- Explain decisions briefly
- Confirm task completion
```

---

## Phase Execution Prompts

### Phase 1 — Core Foundation

```
Read specs.md and tasks.md

Start Phase 1

Execute Task 1.1 only
```

Then continue:

```
Execute Task 1.2
```

```
Execute Task 1.3
```

---

### Phase 2 — Page System

```
Execute Task 2.1
```

```
Execute Task 2.2
```

```
Execute Task 2.3
```

```
Execute Task 2.4
```

```
Execute Task 2.5
```

---

### Phase 3 — Rendering

```
Execute Task 3.1
```

```
Execute Task 3.2
```

```
Execute Task 3.3
```

---

### Phase 4 — Wikilinks

```
Execute Task 4.1
```

```
Execute Task 4.2
```

```
Execute Task 4.3
```

---

### Phase 5 — Entities

```
Execute Task 5.1
```

```
Execute Task 5.2
```

```
Execute Task 5.3
```

---

### Phase 6 — Themes

```
Execute Task 6.1
```

```
Execute Task 6.2
```

---

### Phase 7 — Templates

```
Execute Task 7.1
```

```
Execute Task 7.2
```

---

### Phase 8 — Frontend

```
Execute Task 8.1
```

```
Execute Task 8.2
```

```
Execute Task 8.3
```

```
Execute Task 8.4
```

---

### Phase 9 — Quality

```
Execute Task 9.1
```

```
Execute Task 9.2
```

```
Execute Task 9.3
```

---

## Debugging Prompt

If something breaks:

```
Analyze the current codebase

Find the issue

Fix it with minimal changes

Explain the fix clearly
```

---

## Refactoring Prompt

```
Review the current implementation

Improve structure and readability

Do NOT change behavior

Keep everything aligned with specs.md
```

---

## Final Notes

- Never skip tasks
- Never assume features not in spec
- Always keep filesystem as source of truth
- Always prioritize simplicity
- Always validate each completed task with tests before moving on
- Always update `project_status.md` after successful task validation

---

## End of README_CODEX
