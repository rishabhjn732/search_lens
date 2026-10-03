// Lessons × fields, with "found/tests" in each cell (spec 007, R3.3, R3.4).
import type { Case, LessonInfo } from './cases';
import type { FieldView, LabResults } from './useLabResults';

interface Props {
  results: LabResults;
  fields: FieldView[];
  lessons: LessonInfo[];
  cases: Case[];
  field: string;
  lesson: string;
  onSelect: (field: string, lesson: string) => void;
}

// How many of these tests the field finds. "Found" does not depend on any/all (see notes, task 3).
function count(results: LabResults, path: string, cases: Case[]) {
  let found = 0;
  let ready = true;
  for (const c of cases) {
    const o = results.test(path, c.saved, c.typed, 'any');
    if (o.status !== 'done') ready = false;
    else if (o.comparison.result === 'found') found++;
  }
  return { found, ready, total: cases.length };
}

const shade = (share: number) => `color-mix(in srgb, var(--green) ${Math.round(share * 60)}%, #fff)`;

export default function TestGrid({ results, fields, lessons, cases, field, lesson, onSelect }: Props) {
  return (
    <div className="matrix-wrap">
      <table className="matrix" aria-label="Searches found for each lesson and field">
        <thead>
          <tr>
            <td />
            {fields.map((v) => (
              <th key={v.field.path} scope="col">
                <button type="button" aria-pressed={v.field.path === field} title={`Show all tests for ${v.field.path}`} onClick={() => onSelect(v.field.path, 'all')}>
                  {v.field.path}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lessons.map((l) => {
            const inLesson = cases.filter((c) => c.lesson === l.id);
            return (
              <tr key={l.id}>
                <th scope="row">
                  <button type="button" aria-pressed={lesson === l.id} onClick={() => onSelect(field, lesson === l.id ? 'all' : l.id)}>
                    {l.name}
                  </button>
                </th>
                {fields.map((v) => {
                  const n = count(results, v.field.path, inLesson);
                  return (
                    <td key={v.field.path}>
                      <button
                        type="button"
                        className={v.field.path === field && lesson === l.id ? 'sel' : undefined}
                        style={n.ready ? { background: shade(n.total ? n.found / n.total : 0) } : undefined}
                        aria-label={`${v.field.path}, ${l.name}: ${n.ready ? `${n.found} of ${n.total} found` : 'checking'}`}
                        onClick={() => onSelect(v.field.path, l.id)}
                      >
                        {n.ready ? `${n.found}/${n.total}` : '…'}
                      </button>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">All tests</th>
            {fields.map((v) => {
              const n = count(results, v.field.path, cases);
              return <td key={v.field.path}>{n.ready ? `${n.found} / ${n.total}` : '…'}</td>;
            })}
          </tr>
        </tfoot>
      </table>
      <div className="scale">
        <span>Click a number to see those tests.</span>
        <span className="end">0 found</span>
        <span className="bar" />
        <span>all found</span>
      </div>
    </div>
  );
}
