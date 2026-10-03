// Three example definitions to start from (spec 007, R1.6).
import { useMemo } from 'react';
import { bestFieldFinds } from '../../analysis/compare';
import { readDefinition } from '../../analysis/definition';
import { EXAMPLES, LESSONS, type Example } from '../../analysis/tests';

const ALL_TESTS = LESSONS.flatMap((l) => l.cases);

export const exampleText = (e: Example) => JSON.stringify(e.body, null, 2);

interface Props {
  text: string;
  onPick: (example: Example) => void;
}

export default function ExampleList({ text, onPick }: Props) {
  // Always the browser copy, so the numbers show at once (user answer, 2026-10-03).
  const best = useMemo(
    () =>
      EXAMPLES.map((e) => {
        const r = readDefinition(JSON.stringify(e.body));
        return r.ok ? bestFieldFinds(r.definition, ALL_TESTS) : 0;
      }),
    [],
  );
  return (
    <div className="ex">
      <span className="lbl">Or start with an example</span>
      {EXAMPLES.map((e, i) => (
        <button key={e.id} type="button" aria-pressed={text === exampleText(e)} onClick={() => onPick(e)}>
          <b>{e.name}</b>
          <span>{e.say}</span>
          <em>
            best field finds {best[i]} of {ALL_TESTS.length}
          </em>
        </button>
      ))}
      <div className="where">
        <p>
          <b>Where do I find my index definition?</b>
        </p>
        <p>
          In OpenSearch Dashboards, open Dev Tools and run <code>GET /my-index</code>. Copy the whole answer and paste it
          here. Search Lens understands that shape too.
        </p>
      </div>
    </div>
  );
}
