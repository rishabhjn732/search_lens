// Fetches one index's fields for the mapping-mistake warning (spec 004, R6.2), caching by
// index name so retyping the same index in the request block does not refetch (design.md).
import { useEffect, useRef, useState } from 'react';
import { getIndexDetail, type Request } from '../../opensearch/overview';
import type { Field } from '../../analysis/types';

export function useIndexFields(request: Request, indexName: string | null): Field[] {
  const [fields, setFields] = useState<Field[]>([]);
  const cache = useRef(new Map<string, Field[]>());

  useEffect(() => {
    if (!indexName) {
      setFields([]);
      return;
    }
    const cached = cache.current.get(indexName);
    if (cached) {
      setFields(cached);
      return;
    }
    let cancelled = false;
    getIndexDetail(request, indexName)
      .then((detail) => {
        const result = detail.fields ?? [];
        cache.current.set(indexName, result);
        if (!cancelled) setFields(result);
      })
      .catch(() => {
        if (!cancelled) setFields([]);
      });
    return () => {
      cancelled = true;
    };
  }, [request, indexName]);

  return fields;
}
