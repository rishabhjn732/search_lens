import type { Chain, Field } from '../../analysis/types';

interface Props {
  fields: Field[];
  analyzers: Record<string, Chain>;
  onTryField: (field: Field, chain: Chain) => void;
}

// R4.5: listFields() never throws, so a field whose raw data had no usable type or
// properties comes back as kind 'other' with type 'object' — that combination is this
// screen's signal that the field could not be read.
function isUnreadable(field: Field): boolean {
  return field.kind === 'other' && field.type === 'object';
}

// R4.2: always names the field by its full path, not just its last segment, so a
// nested field (e.g. "address.city") is never confused with a top-level one of the
// same name.
function sentence(field: Field): string {
  if (field.kind === 'object') return `${field.path} groups the fields below it.`;
  if (field.kind === 'text') return `${field.path} is text, analyzed with ${field.indexAnalyzer}.`;
  if (field.kind === 'keyword') {
    return field.normalizer
      ? `${field.path} is keyword (exact values), normalized with ${field.normalizer}.`
      : `${field.path} is keyword (exact values).`;
  }
  return `${field.path} is ${field.type}.`;
}

// R4.3: the pills are the analyzer's real step names (as configured on the cluster, e.g.
// "lowercase", "english_stop"), not a plain-English description of what each one does.
function pillsFor(chain: Chain): string[] {
  return [...chain.charFilters.map((s) => s.name), chain.tokenizer.name, ...chain.filters.map((s) => s.name)];
}

interface ChainRowProps {
  label: string;
  analyzerName: string;
  chain: Chain;
  onTry: () => void;
}

function ChainRow({ label, analyzerName, chain, onTry }: ChainRowProps) {
  return (
    <div className="field-chain-row">
      <p className="field-chain-label">
        {label}: <strong>{analyzerName}</strong>
      </p>
      <div className="field-row-bottom">
        <div className="field-pills">
          {pillsFor(chain).map((pill, i) => (
            <span key={i} className="pill">
              {pill}
            </span>
          ))}
        </div>
        <button type="button" className="btn ghost small try-it-button" onClick={onTry}>
          Try it
        </button>
      </div>
    </div>
  );
}

export default function FieldTree({ fields, analyzers, onTryField }: Props) {
  return (
    <ul className="field-tree">
      {fields.map((field) => {
        const indexChain =
          field.kind === 'text' && field.indexAnalyzer ? analyzers[field.indexAnalyzer] : undefined;
        const searchChain =
          field.kind === 'text' && field.searchAnalyzer ? analyzers[field.searchAnalyzer] : undefined;
        // R4.3: a field saved with one analyzer can search with a different one (e.g. one
        // that adds synonyms) — both chains are shown so neither is silently hidden.
        const searchDiffers = searchChain && field.searchAnalyzer !== field.indexAnalyzer;

        return (
          <li key={field.path} className="field-row">
            {isUnreadable(field) ? (
              <p className="field-unreadable">This field could not be read.</p>
            ) : (
              <div className="field-row-inner">
                <p className="field-sentence" style={{ paddingLeft: `${(field.path.split('.').length - 1) * 20}px` }}>
                  {sentence(field)}
                  {field.parent && <span className="field-of"> Extra way to save {field.parent}.</span>}
                </p>
                {indexChain && (
                  <ChainRow
                    label={searchDiffers ? 'Saved with' : 'Analyzed with'}
                    analyzerName={field.indexAnalyzer!}
                    chain={indexChain}
                    onTry={() => onTryField(field, indexChain)}
                  />
                )}
                {searchDiffers && searchChain && (
                  <ChainRow
                    label="Searched with"
                    analyzerName={field.searchAnalyzer!}
                    chain={searchChain}
                    onTry={() => onTryField(field, searchChain)}
                  />
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
