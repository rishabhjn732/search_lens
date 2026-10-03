---
paths:
  - "frontend/**"
---

# Frontend rules

- React with TypeScript (strict mode) and Vite. Function components only.
- One folder per screen under `src/screens/`. Shared pieces go in `src/components/`.
- All calls to the backend go through `src/api/client.ts`. Components do not call `fetch` directly.
- Animations are drawn with SVG and CSS. They must work with "reduce motion" turned on.
- The picture is drawn from the raw OpenSearch response shape. Do not invent a new shape in the UI.
  `prototypes/token-playground.html` shows the visual style to follow.
- Text on screen is simple English. Buttons say what they do: "Connect", not "Submit".
- Tests use Vitest and React Testing Library, next to the source: `Foo.tsx` and `Foo.test.tsx`.
