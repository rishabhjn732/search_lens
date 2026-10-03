// Part 3 of the Mapping lab: test 100 searches (spec 007, R3.2 to R3.12).
import { useEffect, useState } from 'react';
import type { MatchMode } from '../../analysis/compare';
import MatchChoice from './MatchChoice';
import OwnTestForm from './OwnTestForm';
import TestGrid from './TestGrid';
import TestList, { type Verdict } from './TestList';
import TestSummary from './TestSummary';
import type { Case, LessonInfo } from './cases';
import { currentField, testableFields, type LabResults } from './useLabResults';

export interface Focus {
  field: string | null;
  lesson: string; // a lesson id, or 'all'
}

interface Props {
  results: LabResults;
  cases: Case[];
  lessons: LessonInfo[];
  focus: Focus;
  onFocus: (focus: Focus) => void;
  onAddOwn: (saved: string, typed: string) => string | null;
  onRemoveOwn: (index: number) => void;
}

const PAGE = 30;
const VERDICTS: [Verdict, string][] = [['all', 'All'], ['found', 'Found'], ['partly', 'Partly'], ['not_found', 'Not found']];

export default function TestSection({ results, cases, lessons, focus, onFocus, onAddOwn, onRemoveOwn }: Props) {
  const [mode, setMode] = useState<MatchMode>('any');
  const [verdict, setVerdict] = useState<Verdict>('all');
  const [shown, setShown] = useState(PAGE);
  const [open, setOpen] = useState<Set<string>>(new Set());

  const view = currentField(results.fields, focus.field);
  const lesson = lessons.some((l) => l.id === focus.lesson) ? focus.lesson : 'all';
  const key = `${view?.field.path}|${lesson}`;

  // Another field or lesson starts the list again.
  useEffect(() => {
    setShown(PAGE);
    setOpen(new Set());
  }, [key]);

  if (!view) return null;
  const path = view.field.path;
  const inLesson = lesson === 'all' ? cases : cases.filter((c) => c.lesson === lesson);
  const lessonInfo = lessons.find((l) => l.id === lesson);
  const names = Object.fromEntries(lessons.map((l) => [l.id, l.name]));
  const select = (field: string, l: string) => {
    onFocus({ field, lesson: l });
    setVerdict('all');
  };

  return (
    <section className="block" id="test" aria-labelledby="ml-h-test">
      <h2 id="ml-h-test">
        <span className="step-no">3</span>Test 100 real searches
      </h2>
      <p className="sub">
        Each test has a product name (saved in the index) and what a shopper types. A search is <b>found</b> when the typed
        tokens are also in the saved tokens.
      </p>

      <MatchChoice mode={mode} onChange={setMode} />
      <TestGrid results={results} fields={testableFields(results.fields)} lessons={lessons} cases={cases} field={path} lesson={lesson} onSelect={select} />
      <TestSummary results={results} view={view} lessonName={lessonInfo?.name ?? null} cases={inLesson} mode={mode} />

      <div className="filters" role="group" aria-label="Lesson">
        <span className="lbl2">Lesson:</span>
        {[{ id: 'all', name: 'All' }, ...lessons].map((l) => (
          <button key={l.id} type="button" className="small" aria-pressed={lesson === l.id} onClick={() => select(path, l.id)}>
            {l.name}
          </button>
        ))}
      </div>
      <div className="filters">
        <span className="lbl2">Show:</span>
        <div className="seg" role="group" aria-label="Show tests">
          {VERDICTS.map(([v, label]) => (
            <button key={v} type="button" aria-pressed={verdict === v} onClick={() => { setVerdict(v); setShown(PAGE); }}>
              {label}
            </button>
          ))}
        </div>
      </div>
      {lessonInfo && <p className="sub tight">{lessonInfo.teaches}</p>}

      <TestList
        results={results}
        view={view}
        cases={inLesson}
        lessonNames={names}
        mode={mode}
        verdict={verdict}
        shown={shown}
        open={open}
        onToggle={(id) => setOpen((o) => { const n = new Set(o); if (n.has(id)) n.delete(id); else n.add(id); return n; })}
        onMore={() => setShown((n) => n + PAGE)}
        onRemoveOwn={onRemoveOwn}
      />
      <OwnTestForm onAdd={onAddOwn} />
    </section>
  );
}
