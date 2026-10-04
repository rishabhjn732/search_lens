// Reading the query lab's console-style request block (spec 004): a first line like
// "GET products/_search", then the JSON body underneath, pasted as one piece. No network.

type Json = Record<string, unknown>;

export interface ParsedRequest {
  method: string;
  index: string;
  path: string;
  body: Json;
}

export type ParseResult = ({ ok: true } & ParsedRequest) | { ok: false; message: string };

const FIRST_LINE_RE = /^(GET|POST|PUT|DELETE|HEAD)\s+\/?([^\s/]+)\/(_search|_validate\/query)\s*$/i;

// Browsers do not say where JSON breaks in plain words, so this reads the position V8 puts
// in the error message and turns it into a line and column (R2.3).
function jsonMessage(err: unknown, bodyText: string): string {
  const message = err instanceof Error ? err.message : String(err);
  const match = message.match(/position (\d+)/);
  if (!match) return message;
  const position = Number(match[1]);
  const before = bodyText.slice(0, position);
  const line = before.split('\n').length;
  const col = position - before.lastIndexOf('\n');
  return `Line ${line}, column ${col}: ${message}`;
}

export function parseRequestBlock(text: string): ParseResult {
  const firstBreak = text.indexOf('\n');
  const firstLine = (firstBreak === -1 ? text : text.slice(0, firstBreak)).trim();
  const rest = firstBreak === -1 ? '' : text.slice(firstBreak + 1).trim();

  const match = firstLine.match(FIRST_LINE_RE);
  if (!match) {
    return {
      ok: false,
      message: 'The first line must be a method and a path ending in _search, like GET products/_search.',
    };
  }

  const [, method, index, suffix] = match;

  let body: unknown;
  try {
    body = rest === '' ? {} : JSON.parse(rest);
  } catch (err) {
    return { ok: false, message: jsonMessage(err, rest) };
  }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { ok: false, message: 'The body must be a JSON object, like {"query": {...}}.' };
  }

  return {
    ok: true,
    method: method.toUpperCase(),
    index,
    path: `/${index}/${suffix}`,
    body: body as Json,
  };
}

export interface Toggles {
  explain: boolean;
  profile: boolean;
  // Not used by withToggles (validate is a separate call, R2.6); kept here so the one
  // Toggles type covers everything RequestBlock's three switches control.
  validate: boolean;
}

// Overwrites explain/profile/size per the toggles (R2.5); every other key the user pasted
// (query, sort, aggs, ...) is left alone.
export function withToggles(body: Json, toggles: Toggles): Json {
  return {
    ...body,
    explain: toggles.explain,
    profile: toggles.profile,
    size: 10,
  };
}
