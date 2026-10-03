// Shapes shared by the browser copy of analysis and the cluster (spec 007 design).
// AnalyzeResponse is the raw answer of POST /_analyze with "explain": true.

export interface Token {
  token: string;
  start_offset: number;
  end_offset: number;
  type: string;
  position: number;
  // true when a keyword_marker protected the token (the cluster sends this in explain mode)
  keyword?: boolean;
}

export interface AnalyzeResponse {
  detail: {
    custom_analyzer: boolean;
    charfilters: { name: string; filtered_text: string[] }[];
    tokenizer: { name: string; tokens: Token[] };
    tokenfilters: { name: string; tokens: Token[] }[];
  };
}

// The settings of one step, as written in settings.analysis (always with a type).
export interface StepDef {
  type: string;
  [setting: string]: unknown;
}

export interface Step {
  name: string;
  def: StepDef;
  // false when the browser copy does not know this type (R7.3)
  known: boolean;
}

export interface Chain {
  name: string;
  charFilters: Step[];
  tokenizer: Step;
  filters: Step[];
  // a sentence about how this chain was simplified, shown with the test (R7.3)
  note?: string;
}

export type FieldKind = 'text' | 'keyword' | 'other' | 'object';

export interface Field {
  path: string;
  type: string;
  kind: FieldKind;
  parent?: string;
  indexAnalyzer?: string;
  searchAnalyzer?: string;
  normalizer?: string;
}
