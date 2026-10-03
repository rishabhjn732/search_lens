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
  frontend/            the app, created by spec 001
```

`frontend/` layout: `src/screens/<Screen>/`, `src/components/`, `src/opensearch/` (the only code that
calls the cluster: `client.ts`, `guard.ts`, `errors.ts`), `src/styles/`.
