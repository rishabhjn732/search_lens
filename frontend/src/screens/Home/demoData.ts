// Fixed example for the home page. Same shape as OpenSearch answers, so the drawing code
// reads the real format: `_analyze` with "explain": true, and one search hit.

export interface AnalyzeToken {
  token: string;
  start_offset: number;
  end_offset: number;
  type: string;
  position: number;
}

export interface AnalyzeStep {
  name: string;
  tokens: AnalyzeToken[];
}

export interface AnalyzeExplainResponse {
  detail: {
    custom_analyzer: boolean;
    charfilters?: AnalyzeStep[];
    tokenizer: AnalyzeStep;
    tokenfilters: AnalyzeStep[];
  };
}

export interface SearchHit {
  _index: string;
  _id: string;
  _score: number;
  _source: { title: string };
}

export const demoQuery = 'Running Shoes!';

function tok(token: string, start: number, end: number, position: number): AnalyzeToken {
  return { token, start_offset: start, end_offset: end, type: '<ALPHANUM>', position };
}

export const demoAnalyze: AnalyzeExplainResponse = {
  detail: {
    custom_analyzer: true,
    charfilters: [],
    tokenizer: { name: 'standard', tokens: [tok('Running', 0, 7, 0), tok('Shoes', 8, 13, 1)] },
    tokenfilters: [
      { name: 'lowercase', tokens: [tok('running', 0, 7, 0), tok('shoes', 8, 13, 1)] },
      { name: 'stemmer', tokens: [tok('run', 0, 7, 0), tok('shoe', 8, 13, 1)] },
    ],
  },
};

export const demoHit: SearchHit = {
  _index: 'products',
  _id: '1042',
  _score: 7.84,
  _source: { title: 'RunFast trail shoe, size 42' },
};
