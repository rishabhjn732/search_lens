# Structure

```
search-lens/
  CLAUDE.md            project instructions, loaded in every session
  .claude/             settings, rules, skills, subagents, output style
  docs/steering/       what the product is, the stack, this file
  docs/learning/       lessons and exercises for the user
  specs/               one folder per feature
  prototypes/          visual experiments, not production code
  dev/                 local practice cluster and sample data
  backend/             created by spec 001, task 1
  frontend/            created by spec 001, task 2
```

`backend/` layout: `app/main.py`, `app/routes/`, `app/opensearch/`, `app/models.py`, `tests/`.

`frontend/` layout: `src/screens/<Screen>/`, `src/components/`, `src/api/client.ts`.
