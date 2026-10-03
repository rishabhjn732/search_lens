// The Mapping lab page (spec 007): paste, the fields as pictures, the tests, and the request to create the index.
import { useEffect, useMemo, useRef, useState } from 'react';
import { checkDefinition, listFields, readDefinition, type Definition } from '../../analysis/definition';
import { EXAMPLES, type Example } from '../../analysis/tests';
import ChecksList from './ChecksList';
import CreateIndex from './CreateIndex';
import ExampleList, { exampleText } from './ExampleList';
import FieldCards from './FieldCards';
import ModeBanner from './ModeBanner';
import PasteBox, { type Status } from './PasteBox';
import TestSection, { type Focus } from './TestSection';
import { buildCases, lessonsFor, MINE } from './cases';
import { useLabStore } from './useLabStore';
import { currentField, testableFields, useLabResults } from './useLabResults';
import './mappinglab.css';

const TYPING_PAUSE_MS = 350; // R1.1: read the text about a third of a second after typing stops
const DEFAULT_EXAMPLE_TEXT = "Women's Running Shoes – Café Wi-Fi Edition";
const ONLINE_SHOP = exampleText(EXAMPLES.find((e) => e.id === 'shop')!);

interface View {
  definition: Definition | null;
  status: Status;
}

// Reads the text. A text that cannot be read keeps the last good result on screen (R1.3);
// an empty box shows no result at all.
function read(text: string, last: Definition | null): View {
  if (!text.trim()) return { definition: null, status: { kind: 'empty' } };
  const r = readDefinition(text);
  if (!r.ok) return { definition: last, status: { kind: 'error', error: r.error } };
  const { definition } = r;
  const analyzers = Object.keys((definition.analysis.analyzer as object | undefined) ?? {}).length;
  const fields = listFields(definition.mappings, definition.analysis).filter((f) => f.kind !== 'object').length;
  const problems = checkDefinition(definition).filter((c) => c.level === 'problem').length;
  return { definition, status: { kind: 'ok', fields, analyzers, problems } };
}

export default function MappingLabScreen() {
  const store = useLabStore();
  const [text, setText] = useState(() => store.definitionText() ?? ONLINE_SHOP);
  const [view, setView] = useState<View>(() => read(text, null));
  const [example, setExample] = useState(DEFAULT_EXAMPLE_TEXT);
  const [focus, setFocus] = useState<Focus>({ field: null, lesson: 'all' });
  const [storageMessage, setStorageMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  function apply(next: string) {
    clearTimeout(timer.current);
    setView((v) => read(next, v.definition));
    setStorageMessage(store.saveDefinition(next)); // R1.8
  }

  function change(next: string) {
    setText(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => apply(next), TYPING_PAUSE_MS);
  }

  function pick(e: Example) {
    const next = exampleText(e);
    setText(next);
    apply(next);
  }

  function tidy() {
    let next = text;
    try {
      next = JSON.stringify(JSON.parse(text), null, 2);
    } catch {
      // not valid JSON: apply() shows what is wrong
    }
    setText(next);
    apply(next);
  }

  function clear() {
    setText('');
    apply('');
  }

  function testField(path: string) {
    setFocus({ field: path, lesson: 'all' });
    document.getElementById('test')?.scrollIntoView?.({ behavior: 'smooth' });
  }

  // Own tests (R3.11): a message comes back when the test cannot be added.
  function addOwn(saved: string, typed: string): string | null {
    const err = store.addOwnTest(saved, typed);
    if (!err) setFocus((f) => ({ ...f, lesson: MINE }));
    return err;
  }

  const { definition } = view;
  const checks = useMemo(() => (definition ? checkDefinition(definition) : []), [definition]);
  const own = store.ownTests();
  const cases = useMemo(() => buildCases(own), [own]);
  const lessons = useMemo(() => lessonsFor(own), [own]);
  const pairs = useMemo<[string, string][]>(() => cases.map((c) => [c.saved, c.typed]), [cases]);
  const results = useLabResults(definition, example, pairs);
  const field = currentField(results.fields, focus.field);

  return (
    <div className="mappinglab wrap">
      <div className="page-head">
        <p className="eyebrow">Mapping lab</p>
        <h1>
          See how your index <mark>saves</mark> words, and how it <mark>finds</mark> them.
        </h1>
        <p className="lead">
          Paste an index definition. Search Lens draws every field, then tries 100 real shop searches against it, and shows
          which are found and why the others are not.
        </p>
        <ModeBanner />
        <nav className="stepper" aria-label="Steps">
          <a href="#paste">
            <b>1</b>Paste your index
          </a>
          <a href="#fields">
            <b>2</b>See your fields
          </a>
          <a href="#test">
            <b>3</b>Test 100 searches
          </a>
          <a href="#create">
            <b>4</b>Create the index
          </a>
        </nav>
      </div>

      <section className="block" id="paste" aria-labelledby="ml-h-paste">
        <h2 id="ml-h-paste">
          <span className="step-no">1</span>Paste your index definition
        </h2>
        <p className="sub">
          The JSON with <code>settings</code> and <code>mappings</code>. It is read in this page and not sent anywhere.
        </p>
        <div className="paste">
          <PasteBox text={text} status={view.status} storageMessage={storageMessage} onChange={change} onTidy={tidy} onClear={clear} />
          <ExampleList text={text} onPick={pick} />
        </div>
      </section>

      {definition && (
        <section className="block" id="fields" aria-labelledby="ml-h-fields">
          <h2 id="ml-h-fields">
            <span className="step-no">2</span>Your fields, as pictures
          </h2>
          <p className="sub">
            Each card shows the steps a field uses to turn text into <b>tokens</b> (the small pieces that are saved and
            compared). Change the example text and watch every card.
          </p>
          <div className="demo-in">
            <div>
              <label className="lbl" htmlFor="ml-example">
                Example text for every card
              </label>
              <input id="ml-example" type="text" autoComplete="off" spellCheck={false} value={example} onChange={(e) => setExample(e.target.value)} />
            </div>
            <div className="legend" aria-label="Colours of the steps">
              <span>
                <i className="c" />
                changes the text first
              </span>
              <span>
                <i className="t" />
                cuts into tokens
              </span>
              <span>
                <i className="f" />
                changes the tokens
              </span>
            </div>
          </div>
          <FieldCards results={results} exampleText={example} selected={field?.field.path ?? null} onTest={testField} />
          <ChecksList checks={checks} />
        </section>
      )}

      {definition &&
        (testableFields(results.fields).length ? (
          <TestSection
            results={results}
            cases={cases}
            lessons={lessons}
            focus={focus}
            onFocus={setFocus}
            onAddOwn={addOwn}
            onRemoveOwn={(i) => store.removeOwnTest(i)}
          />
        ) : (
          <section className="block" id="test">
            <p className="sub">This index has no text or keyword fields to test.</p>
          </section>
        ))}

      {definition && <CreateIndex definition={definition} />}
    </div>
  );
}
