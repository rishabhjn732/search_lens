/* Search Lens prototype: a tiny BM25 search over a few documents, so the explorer can show
   real-looking `_search` answers with `"explain": true`. Not production code. The real tool
   sends the query to the cluster and draws the `_explanation` it gets back. */
(function (root) {
'use strict';
var L = root.Lens;
var K1 = 1.2, B = 0.75;
var f32 = Math.fround;

function getValues(src, path) {
  var parts = path.split('.'), cur = [src];
  parts.forEach(function (p) {
    var next = [];
    cur.forEach(function (c) {
      if (c == null) return;
      if (Array.isArray(c)) c.forEach(function (x) { if (x && x[p] !== undefined) next.push(x[p]); });
      else if (c[p] !== undefined) next.push(c[p]);
    });
    cur = next;
  });
  var out = [];
  cur.forEach(function (v) { if (Array.isArray(v)) out.push.apply(out, v); else if (v != null) out.push(v); });
  return out;
}

// Build the inverted index: per field, per document, which tokens and where.
function buildIndex(def, docs) {
  var parsed = {mappings: def.mappings, analysis: (def.settings || {}).analysis || {}, settings: def.settings || {}};
  var fields = L.listFields(parsed.mappings, parsed.analysis);
  var idx = {parsed: parsed, fields: {}, docs: docs};
  fields.forEach(function (f) {
    if (f.kind === 'object') return;
    var srcPath = f.parent || f.path;
    var info = {field: f, perDoc: [], df: {}, N: 0, sumLen: 0};
    var chain = (f.kind === 'text' || f.kind === 'keyword') ? L.chainFor(f, 'index', parsed.analysis) : null;
    docs.forEach(function (d, i) {
      var vals = getValues(d._source, srcPath);
      if (!vals.length) { info.perDoc[i] = null; return; }
      var entry = {tf: {}, pos: {}, len: 0, values: vals, tokens: []};
      if (chain && !chain.error) {
        var base = 0;
        vals.forEach(function (v) {
          var toks = L.finalTokens(L.analyze(String(v), chain));
          toks.forEach(function (t) {
            entry.tf[t.token] = (entry.tf[t.token] || 0) + 1;
            (entry.pos[t.token] = entry.pos[t.token] || []).push(base + t.position);
            entry.tokens.push(t);
          });
          var maxPos = toks.reduce(function (m, t) { return Math.max(m, t.position); }, -1);
          entry.len += new Set(toks.map(function (t) { return t.position; })).size;
          base += maxPos + 100;
        });
      }
      info.perDoc[i] = entry;
      info.N++;
      info.sumLen += f.kind === 'keyword' ? 1 : entry.len;
      Object.keys(entry.tf).forEach(function (t) { info.df[t] = (info.df[t] || 0) + 1; });
    });
    info.avgdl = info.N ? info.sumLen / info.N : 1;
    idx.fields[f.path] = info;
  });
  return idx;
}

function E(value, description, details) { return {value: f32(value), description: description, details: details || []}; }

function termScore(idx, path, term, i, userBoost) {
  var info = idx.fields[path], e = info && info.perDoc[i];
  if (!e || !e.tf[term]) return null;
  var freq = e.tf[term], n = info.df[term], N = info.N;
  var idf = f32(Math.log(1 + (N - n + 0.5) / (n + 0.5)));
  var boost = f32((K1 + 1) * (userBoost || 1));
  var tf, tfE;
  if (info.field.kind === 'keyword') {
    tf = f32(freq / (freq + K1));
    tfE = E(tf, 'tf, computed as freq / (freq + k1) from:', [E(freq, 'freq, occurrences of term within document'), E(K1, 'k1, term saturation parameter')]);
  } else {
    var dl = e.len, avgdl = info.avgdl;
    tf = f32(freq / (freq + K1 * (1 - B + B * dl / avgdl)));
    tfE = E(tf, 'tf, computed as freq / (freq + k1 * (1 - b + b * dl / avgdl)) from:', [
      E(freq, 'freq, occurrences of term within document'), E(K1, 'k1, term saturation parameter'),
      E(B, 'b, length normalization parameter'), E(dl, 'dl, length of field'), E(avgdl, 'avgdl, average length of field')]);
  }
  var score = f32(boost * idf * tf);
  return E(score, 'weight(' + path + ':' + term + ' in ' + i + ') [PerFieldSimilarity], result of:', [
    E(score, 'score(freq=' + freq + '.0), computed as boost * idf * tf from:', [
      E(boost, 'boost'),
      E(idf, 'idf, computed as log(1 + (N - n + 0.5) / (n + 0.5)) from:', [E(n, 'n, number of documents containing term'), E(N, 'N, total number of documents with field')]),
      tfE])]);
}

function QueryError(msg) { this.msg = msg; }

function oneKey(obj, what) {
  var keys = Object.keys(obj || {});
  if (keys.length !== 1) throw new QueryError(what + ' needs exactly one field name inside it.');
  return keys[0];
}
function fieldOf(idx, path, warnings) {
  var info = idx.fields[path];
  if (!info) warnings.push('The field "' + path + '" is not in the mapping, so nothing can match it.');
  return info;
}
function analyzeQuery(idx, info, text) {
  var f = info.field;
  if (f.kind !== 'text' && f.kind !== 'keyword') return [String(text)];
  var chain = L.chainFor(f, f.kind === 'keyword' ? 'index' : 'search', idx.parsed.analysis);
  var seen = new Set(), out = [];
  L.finalTokens(L.analyze(String(text), chain)).forEach(function (t) { if (!seen.has(t.token)) { seen.add(t.token); out.push(t.token); } });
  return out;
}
function exactMatch(info, i, value) {
  var e = info.perDoc[i];
  if (!e) return false;
  if (info.field.kind === 'keyword' || info.field.kind === 'text') return !!e.tf[String(value)];
  return e.values.some(function (v) { return String(v) === String(value) || (typeof v === 'number' && v === Number(value)); });
}
function shown(v) { return typeof v === 'string' ? '"' + v + '"' : String(v); }

// Returns {match, score, expl, reasons, terms:[{field, term}]} for document i.
function evalQuery(idx, q, i, warnings) {
  var type = oneKey(q, 'A query');
  var body = q[type];
  switch (type) {
    case 'match_all': return {match: true, score: 1, expl: E(1, '*:*'), reasons: [], terms: []};

    case 'match': case 'match_phrase': {
      var path = oneKey(body, '"' + type + '"'), opts = body[path];
      if (typeof opts !== 'object' || opts === null) opts = {query: opts};
      var info = fieldOf(idx, path, warnings);
      if (!info) return {match: false, score: 0, reasons: ['"' + path + '" is not a field of this index.'], terms: []};
      var terms = analyzeQuery(idx, info, opts.query);
      if (!terms.length) return {match: false, score: 0, reasons: ['Every word of "' + opts.query + '" was removed by the analyzer, so there is nothing to search for.'], terms: []};
      if (info.field.kind === 'other') {
        var okv = exactMatch(info, i, opts.query);
        return okv ? {match: true, score: 1, expl: E(1, path + ':' + opts.query), reasons: [], terms: []}
          : {match: false, score: 0, reasons: [path + ' is ' + (info.perDoc[i] ? info.perDoc[i].values.join(', ') : 'empty') + ', not ' + opts.query + '.'], terms: []};
      }
      var parts = terms.map(function (t) { return {t: t, e: termScore(idx, path, t, i, opts.boost)}; });
      var hit = parts.filter(function (p) { return p.e; }), miss = parts.filter(function (p) { return !p.e; });
      if (type === 'match_phrase' && !miss.length && hit.length > 1) {
        var pos = info.perDoc[i].pos, inRow = (pos[terms[0]] || []).some(function (p0) {
          return terms.every(function (t, k) { return (pos[t] || []).indexOf(p0 + k) >= 0; });
        });
        if (!inRow) return {match: false, score: 0, reasons: [path + ' has all the words, but not next to each other in this order.'], terms: []};
      }
      var need = (opts.operator || '').toLowerCase() === 'and' || type === 'match_phrase' ? terms.length : 1;
      if (hit.length < need) {
        var r = hit.length === 0 ? path + ' has none of the words: ' + terms.map(shown).join(', ') + '.'
          : path + ' is missing ' + miss.map(function (p) { return shown(p.t); }).join(', ') + ', and every word is needed.';
        return {match: false, score: 0, reasons: [r], terms: []};
      }
      var sum = hit.reduce(function (s, p) { return s + p.e.value; }, 0);
      var expl = hit.length === 1 ? hit[0].e : E(sum, 'sum of:', hit.map(function (p) { return p.e; }));
      return {match: true, score: f32(sum), expl: expl, reasons: [], terms: hit.map(function (p) { return {field: path, term: p.t}; })};
    }

    case 'multi_match': {
      var fields = (body.fields || ['*']).map(function (s) { var m = /^(.+?)(\^([\d.]+))?$/.exec(s); return {path: m[1], boost: m[3] ? +m[3] : 1}; });
      var mode = body.type || 'best_fields';
      var per = [], why = [];
      fields.forEach(function (fb) {
        if (fb.path === '*') throw new QueryError('This prototype needs the field names in "fields", for example ["title^2", "description"].');
        var sub = {}; sub[fb.path] = {query: body.query, operator: body.operator, boost: fb.boost * (body.boost || 1)};
        var r = evalQuery(idx, {match: sub}, i, warnings);
        if (r.match) per.push(r); else why = why.concat(r.reasons);
      });
      if (!per.length) return {match: false, score: 0, reasons: why.length ? ['No field has the words. ' + why.join(' ')] : ['No field has the words.'], terms: []};
      var tot;
      if (mode === 'most_fields') tot = per.reduce(function (s, r) { return s + r.score; }, 0);
      else tot = Math.max.apply(null, per.map(function (r) { return r.score; }));
      var ex = per.length === 1 ? per[0].expl : E(tot, mode === 'most_fields' ? 'sum of:' : 'max of:', per.map(function (r) { return r.expl; }));
      var tl = mode === 'most_fields' ? per : per.filter(function (r) { return r.score === tot; });
      return {match: true, score: f32(tot), expl: ex, reasons: [], terms: [].concat.apply([], per.map(function (r) { return r.terms; })), counted: tl};
    }

    case 'term': {
      var tp = oneKey(body, '"term"'), tv = body[tp], tb = 1;
      if (tv && typeof tv === 'object') { tb = tv.boost || 1; tv = tv.value; }
      var ti = fieldOf(idx, tp, warnings);
      if (!ti) return {match: false, score: 0, reasons: ['"' + tp + '" is not a field of this index.'], terms: []};
      var token = ti.field.kind === 'keyword' && ti.field.normalizer ? analyzeQuery(idx, ti, tv)[0] : String(tv);
      if (ti.field.kind === 'other') {
        return exactMatch(ti, i, tv) ? {match: true, score: tb, expl: E(tb, tp + ':' + tv), reasons: [], terms: []}
          : {match: false, score: 0, reasons: [tp + ' is ' + (ti.perDoc[i] ? ti.perDoc[i].values.join(', ') : 'empty') + ', not ' + tv + '.'], terms: []};
      }
      var te = termScore(idx, tp, token, i, tb);
      if (!te) {
        var have = ti.perDoc[i] ? ti.perDoc[i].values.map(shown).join(', ') : 'empty';
        var reason = ti.field.kind === 'keyword' ? tp + ' is ' + have + ', not ' + shown(token) + '.' : tp + ' has no token exactly equal to ' + shown(token) + '.';
        if (ti.field.kind === 'text') reason += ' A term query does not analyze the text, but ' + tp + ' was saved as small tokens. Use a match query.';
        return {match: false, score: 0, reasons: [reason], terms: []};
      }
      return {match: true, score: te.value, expl: te, reasons: [], terms: [{field: tp, term: token}]};
    }

    case 'terms': {
      var sp = Object.keys(body).filter(function (k) { return k !== 'boost'; })[0], si = fieldOf(idx, sp, warnings);
      var vals = [].concat(body[sp] || []);
      var okT = si && vals.some(function (v) { return exactMatch(si, i, v); });
      return okT ? {match: true, score: 1, expl: E(1, sp + ':(' + vals.join(' ') + ')'), reasons: [], terms: []}
        : {match: false, score: 0, reasons: [sp + ' is none of: ' + vals.map(shown).join(', ') + '.'], terms: []};
    }

    case 'range': {
      var rp = oneKey(body, '"range"'), rb = body[rp], ri = fieldOf(idx, rp, warnings);
      var v = ri && ri.perDoc[i] ? ri.perDoc[i].values[0] : undefined;
      var cmp = function (a, b) { return typeof a === 'number' ? a - Number(b) : String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0; };
      var okR = v !== undefined &&
        (rb.gte === undefined || cmp(v, rb.gte) >= 0) && (rb.gt === undefined || cmp(v, rb.gt) > 0) &&
        (rb.lte === undefined || cmp(v, rb.lte) <= 0) && (rb.lt === undefined || cmp(v, rb.lt) < 0);
      var lo = rb.gte !== undefined ? rb.gte : rb.gt !== undefined ? rb.gt : '*', hi = rb.lte !== undefined ? rb.lte : rb.lt !== undefined ? rb.lt : '*';
      var desc = rp + ':[' + lo + ' TO ' + hi + ']';
      return okR ? {match: true, score: 1, expl: E(1, desc), reasons: [], terms: []}
        : {match: false, score: 0, reasons: [rp + ' is ' + (v === undefined ? 'empty' : v) + ', but the range needs ' + rangeSay(rb) + '.'], terms: [], desc: desc};
    }

    case 'bool': {
      var arr = function (x) { return x === undefined ? [] : [].concat(x); };
      var must = arr(body.must), should = arr(body.should), filter = arr(body.filter), mustNot = arr(body.must_not);
      var details = [], total = 0, reasons = [], terms2 = [], counted = [];
      for (var a = 0; a < must.length; a++) {
        var rm = evalQuery(idx, must[a], i, warnings);
        if (!rm.match) return {match: false, score: 0, reasons: ['A "must" part failed: ' + rm.reasons.join(' ')], terms: []};
        total += rm.score; details.push(rm.expl); terms2 = terms2.concat(rm.terms); if (rm.counted) counted = counted.concat(rm.counted);
      }
      for (var b = 0; b < filter.length; b++) {
        var rf = evalQuery(idx, filter[b], i, warnings);
        if (!rf.match) return {match: false, score: 0, reasons: ['A filter failed: ' + rf.reasons.join(' ')], terms: []};
        details.push(E(0, 'match on required clause, product of:', [E(0, '# clause'), E(1, (rf.expl && rf.expl.description.indexOf('weight(') === 0 ? rf.expl.description.replace(/^weight\((.+?) in \d+\).*$/, '$1') : rf.expl.description))]));
      }
      for (var c = 0; c < mustNot.length; c++) {
        var rn = evalQuery(idx, mustNot[c], i, warnings);
        if (rn.match) return {match: false, score: 0, reasons: ['A "must_not" part matched, so this document is left out.'], terms: []};
      }
      var nShould = 0, shouldWhy = [];
      should.forEach(function (sq) {
        var rs = evalQuery(idx, sq, i, warnings);
        if (rs.match) { nShould++; total += rs.score; details.push(rs.expl); terms2 = terms2.concat(rs.terms); if (rs.counted) counted = counted.concat(rs.counted); }
        else shouldWhy = shouldWhy.concat(rs.reasons);
      });
      var msm = body.minimum_should_match !== undefined ? parseInt(body.minimum_should_match, 10) : (must.length || filter.length ? 0 : (should.length ? 1 : 0));
      if (nShould < msm) return {match: false, score: 0, reasons: ['Not enough "should" parts matched. ' + shouldWhy.join(' ')], terms: []};
      if (!must.length && !should.length && !filter.length && !mustNot.length) return {match: true, score: 1, expl: E(1, '*:*'), reasons: [], terms: []};
      return {match: true, score: f32(total), expl: E(total, 'sum of:', details), reasons: [], terms: terms2, counted: counted};
    }
  }
  throw new QueryError('"' + type + '" is not in this prototype. It knows match, match_phrase, multi_match, term, terms, range, bool and match_all.');
}

function rangeSay(rb) {
  var p = [];
  if (rb.gte !== undefined) p.push('at least ' + rb.gte);
  if (rb.gt !== undefined) p.push('more than ' + rb.gt);
  if (rb.lte !== undefined) p.push('at most ' + rb.lte);
  if (rb.lt !== undefined) p.push('less than ' + rb.lt);
  return p.join(' and ');
}

// Same shape as POST /<index>/_search with "explain": true, plus `_lens` with extra help.
function search(idx, indexName, body) {
  var started = Date.now();
  if (!body || typeof body !== 'object') throw new QueryError('The request must be a JSON object, like {"query": {...}}.');
  var q = body.query, warnings = [];
  if (!q) {
    if (Object.keys(body).length === 1 && /^(match|multi_match|term|terms|range|bool|match_all|match_phrase)$/.test(Object.keys(body)[0])) {
      q = body; warnings.push('The query should be inside "query": {...}. Search Lens added it for you.');
    } else q = {match_all: {}};
  }
  var hits = [], misses = [];
  idx.docs.forEach(function (d, i) {
    var r = evalQuery(idx, q, i, warnings);
    if (r.match) hits.push({_index: indexName, _id: d._id, _score: r.score, _source: d._source, _explanation: r.expl, _lens: {terms: r.terms}});
    else misses.push({_id: d._id, _source: d._source, reasons: r.reasons});
  });
  hits.sort(function (a, b) { return b._score - a._score; });
  var size = body.size === undefined ? 10 : body.size;
  return {
    took: Math.max(1, Date.now() - started),
    timed_out: false,
    hits: {total: {value: hits.length, relation: 'eq'}, max_score: hits.length ? hits[0]._score : null, hits: hits.slice(0, size)},
    _lens: {notMatched: misses, warnings: warnings.filter(function (w, k, a) { return a.indexOf(w) === k; }), docCount: idx.docs.length}
  };
}

// Read an _explanation tree into parts a person can understand.
function readExplanation(expl) {
  var parts = [], filters = [];
  (function walk(node, counted, under) {
    if (!node) return;
    var d = node.description;
    var w = /^weight\((.+?):(.+?) in \d+\)/.exec(d);
    if (w) {
      var inner = node.details[0], boost = 0, idf = null, tf = null;
      inner.details.forEach(function (x) {
        if (x.description === 'boost') boost = x.value;
        else if (/^idf/.test(x.description)) idf = {value: x.value, n: x.details[0].value, N: x.details[1].value};
        else if (/^tf/.test(x.description)) {
          var get = function (k) { var f = x.details.find(function (y) { return y.description.indexOf(k + ',') === 0; }); return f ? f.value : null; };
          tf = {value: x.value, freq: get('freq'), dl: get('dl'), avgdl: get('avgdl'), norms: /dl/.test(x.description)};
        }
      });
      parts.push({field: w[1], term: w[2], value: node.value, boost: boost, idf: idf, tf: tf, counted: counted, group: under});
      return;
    }
    if (/^match on required clause/.test(d)) { filters.push(node.details[1] ? node.details[1].description : ''); return; }
    if (d === 'max of:') {
      var best = Math.max.apply(null, node.details.map(function (x) { return x.value; }));
      var gid = Math.random().toString(36).slice(2);
      var won = false;
      node.details.forEach(function (x) { var isBest = !won && x.value === best; if (isBest) won = true; walk(x, counted && isBest, gid); });
      return;
    }
    if (!node.details.length && !/^weight/.test(d)) { parts.push({constant: true, desc: d, value: node.value, counted: counted, group: under}); return; }
    node.details.forEach(function (x) { walk(x, counted, under); });
  })(expl, true, null);
  return {parts: parts, filters: filters};
}

function describeQuery(q, idx) {
  var out = [];
  var say = function (q, lead) {
    var type = Object.keys(q || {})[0], b = q[type];
    if (!type) return;
    if (type === 'match' || type === 'match_phrase') {
      var f = Object.keys(b)[0], o = b[f]; if (typeof o !== 'object') o = {query: o};
      var info = idx.fields[f], words = info ? analyzeQuery(idx, info, o.query) : [];
      var how = type === 'match_phrase' ? 'all the words, next to each other' : ((o.operator || '').toLowerCase() === 'and' ? 'all of the words' : 'any of the words');
      out.push(lead + f + ' has ' + how + ': ' + (words.length ? words.map(shown).join(', ') : '(none left after analysis)') + (o.boost ? ' (counts ' + o.boost + '×)' : '') + '.');
    } else if (type === 'multi_match') {
      out.push(lead + 'one of the fields ' + (b.fields || []).join(', ') + ' has any of the words of "' + b.query + '". ' + ((b.type || 'best_fields') === 'best_fields' ? 'Only the best field counts.' : 'All fields add up.'));
    } else if (type === 'term') {
      var tf = Object.keys(b)[0], tv = typeof b[tf] === 'object' ? b[tf].value : b[tf];
      out.push(lead + tf + ' is exactly ' + shown(tv) + ' (not analyzed).');
    } else if (type === 'terms') {
      var sf = Object.keys(b)[0]; out.push(lead + sf + ' is one of: ' + [].concat(b[sf]).map(shown).join(', ') + '.');
    } else if (type === 'range') {
      var rf = Object.keys(b)[0]; out.push(lead + rf + ' is ' + rangeSay(b[rf]) + '.');
    } else if (type === 'match_all') {
      out.push(lead + 'every document (no condition).');
    } else if (type === 'bool') {
      [].concat(b.must || []).forEach(function (x) { say(x, 'Must: '); });
      [].concat(b.should || []).forEach(function (x) { say(x, 'Bonus if: '); });
      [].concat(b.filter || []).forEach(function (x) { say(x, 'Only if (no score): '); });
      [].concat(b.must_not || []).forEach(function (x) { say(x, 'Never if: '); });
    }
  };
  say(q.query || q, 'Find documents where ');
  return out;
}

root.LensSearch = {buildIndex: buildIndex, search: search, readExplanation: readExplanation, describeQuery: describeQuery, QueryError: QueryError, K1: K1, B: B};
})(typeof window !== 'undefined' ? window : globalThis);
