// The tests shown in the test section: the 100 built-in ones, then the user's own (spec 007, R3.1, R3.11).
import { LESSONS } from '../../analysis/tests';
import type { OwnTest } from './labStore';

export const MINE = 'mine';

export interface Case {
  id: string;
  lesson: string;
  saved: string;
  typed: string;
  // the place in the list of own tests, for Remove
  own?: number;
}

export interface LessonInfo {
  id: string;
  name: string;
  teaches: string;
}

export function buildCases(own: OwnTest[]): Case[] {
  const built = LESSONS.flatMap((l) => l.cases.map(([saved, typed], i) => ({ id: `${l.id}:${i}`, lesson: l.id, saved, typed })));
  return [...built, ...own.map(([saved, typed], i) => ({ id: `${MINE}:${i}`, lesson: MINE, saved, typed, own: i }))];
}

export function lessonsFor(own: OwnTest[]): LessonInfo[] {
  const list: LessonInfo[] = LESSONS.map(({ id, name, teaches }) => ({ id, name, teaches }));
  if (own.length) list.push({ id: MINE, name: 'My tests', teaches: 'Tests you added. They are kept in this browser.' });
  return list;
}
