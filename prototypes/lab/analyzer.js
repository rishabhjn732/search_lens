/* Search Lens prototype: a small copy of OpenSearch text analysis that runs in the browser.
   Not production code. The real tool sends POST /_analyze with the same parts inline
   (char_filter, tokenizer, filter) and draws the answer. Tokens from this copy can differ
   a little from a real cluster. */
(function (root) {
'use strict';

var STOP_EN = new Set('a an and are as at be but by for if in into is it no not of on or such that the their then there these they this to was will with'.split(' '));
var FOLD = {'ß':'ss','æ':'ae','Æ':'AE','ø':'o','Ø':'O','œ':'oe','Œ':'OE','ł':'l','Ł':'L','đ':'d','Đ':'D','þ':'th','ð':'d','å':'a','Å':'A'};

function fold(s) {
  return s.replace(/[ßæÆøØœŒłŁđĐþðåÅ]/g, function (c) { return FOLD[c]; })
    .normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// A simple English stemmer, close to Porter for common shop words.
function stem(w, light) {
  if (w.length < 3) return w;
  var s = w.replace(/['’]s$/, '');
  if (/sses$/.test(s)) s = s.slice(0, -2);
  else if (/ies$/.test(s) && s.length > 4) s = light ? s.slice(0, -3) + 'y' : s.slice(0, -3) + 'i';
  else if (/(ch|sh|x|z)es$/.test(s)) s = s.slice(0, -2);
  else if (/[^su]s$/.test(s) && s.length > 3) s = s.slice(0, -1);
  if (light) return s;
  var hasVowel = function (x) { return /[aeiouy]/.test(x); };
  var m = /^(.+?)(ing|ed)$/.exec(s);
  if (m && !/eed$/.test(s) && m[1].length >= 2 && hasVowel(m[1])) {
    s = m[1];
    if (/(at|bl|iz)$/.test(s)) s += 'e';
    else if (/([^aeioulsz])\1$/.test(s)) s = s.slice(0, -1);
  }
  if (s.length > 2 && /y$/.test(s) && hasVowel(s.slice(0, -1))) s = s.slice(0, -1) + 'i';
  return s;
}

function tok(token, start, end, position, type) {
  return {token: token, start_offset: start, end_offset: end, type: type || (/^\d+$/.test(token) ? '<NUM>' : '<ALPHANUM>'), position: position};
}

function splitBy(re, text, lower) {
  var out = [], m, i = 0;
  re.lastIndex = 0;
  while ((m = re.exec(text)) !== null) {
    out.push(tok(lower ? m[0].toLowerCase() : m[0], m.index, m.index + m[0].length, i++, 'word'));
  }
  return out;
}

function charClassOk(ch, classes) {
  return classes.some(function (c) {
    if (c === 'letter') return /\p{L}/u.test(ch);
    if (c === 'digit') return /\p{N}/u.test(ch);
    if (c === 'whitespace') return /\s/.test(ch);
    if (c === 'punctuation') return /\p{P}/u.test(ch);
    if (c === 'symbol') return /\p{S}/u.test(ch);
    return false;
  });
}

function grams(word, min, max, edge) {
  var out = [];
  if (edge) {
    for (var n = min; n <= Math.min(max, word.length); n++) out.push(word.slice(0, n));
  } else {
    for (var a = 0; a < word.length; a++) {
      for (var b = min; b <= max && a + b <= word.length; b++) out.push(word.slice(a, a + b));
    }
  }
  return out;
}

// ---- tokenizers -----------------------------------------------------------

var TOKENIZERS = {
  standard: {say: 'Cuts the text into words at spaces and punctuation marks.',
    run: function (t) {
      return splitBy(/[\p{L}\p{N}]+(?:[.'’_][\p{L}\p{N}]+)*/gu, t).map(function (x) { x.type = /^\d+([.,]\d+)?$/.test(x.token) ? '<NUM>' : '<ALPHANUM>'; return x; });
    }},
  whitespace: {say: 'Cuts the text only at spaces. Punctuation stays inside the words.',
    run: function (t) { return splitBy(/\S+/g, t); }},
  letter: {say: 'Cuts the text at anything that is not a letter.',
    run: function (t) { return splitBy(/\p{L}+/gu, t); }},
  lowercase: {say: 'Cuts the text at anything that is not a letter, and makes letters small.',
    run: function (t) { return splitBy(/\p{L}+/gu, t, true); }},
  keyword: {say: 'Keeps the whole text as one single token. Nothing is cut.',
    run: function (t) { return t.length ? [tok(t, 0, t.length, 0, 'word')] : []; }},
  pattern: {say: 'Cuts the text where a pattern matches (by default: anything that is not a letter or digit).',
    run: function (t, d) {
      var re = new RegExp(d.pattern || '\\W+', 'gu'), out = [], last = 0, i = 0, m;
      while ((m = re.exec(t)) !== null) {
        if (m.index > last) out.push(tok(t.slice(last, m.index), last, m.index, i++, 'word'));
        last = m.index + m[0].length;
        if (!m[0].length) re.lastIndex++;
      }
      if (last < t.length) out.push(tok(t.slice(last), last, t.length, i++, 'word'));
      return out.map(function (x) { if (d.lowercase !== false && d._lower) x.token = x.token.toLowerCase(); return x; });
    }},
  edge_ngram: {say: 'Cuts each word into its first letters, so a few typed letters can find the whole word.',
    run: function (t, d) {
      var min = d.min_gram || 1, max = d.max_gram || 2, classes = d.token_chars || [];
      var words = classes.length ? splitWords(t, classes) : (t.length ? [{w: t, s: 0}] : []);
      var out = [], i = 0;
      words.forEach(function (x) {
        grams(x.w, min, max, true).forEach(function (g) { out.push(tok(g, x.s, x.s + g.length, i++, 'word')); });
      });
      return out;
    }},
  ngram: {say: 'Cuts each word into small overlapping pieces, so a part from the middle of a word can match.',
    run: function (t, d) {
      var min = d.min_gram || 1, max = d.max_gram || 2, classes = d.token_chars || [];
      var words = classes.length ? splitWords(t, classes) : (t.length ? [{w: t, s: 0}] : []);
      var out = [], i = 0;
      words.forEach(function (x) {
        for (var a = 0; a < x.w.length; a++) {
          for (var b = min; b <= max && a + b <= x.w.length; b++) out.push(tok(x.w.slice(a, a + b), x.s + a, x.s + a + b, i++, 'word'));
        }
      });
      return out;
    }}
};
TOKENIZERS.classic = TOKENIZERS.standard;
TOKENIZERS.uax_url_email = TOKENIZERS.standard;

function splitWords(t, classes) {
  var out = [], cur = '', start = 0;
  Array.from(t).forEach(function (ch, idx) {
    if (charClassOk(ch, classes)) { if (!cur) start = idx; cur += ch; }
    else if (cur) { out.push({w: cur, s: start}); cur = ''; }
  });
  if (cur) out.push({w: cur, s: start});
  return out;
}

// ---- character filters ----------------------------------------------------

var CHAR_FILTERS = {
  html_strip: {say: 'Removes HTML tags like <b> from the text.',
    run: function (t) { return t.replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' '); }},
  mapping: {say: 'Swaps some characters or words for others before the text is cut.',
    run: function (t, d) {
      (d.mappings || []).forEach(function (line) {
        var p = line.split('=>');
        if (p.length !== 2) return;
        var from = p[0].trim(), to = p[1].trim();
        if (from) t = t.split(from).join(to);
      });
      return t;
    }},
  pattern_replace: {say: 'Changes text that matches a pattern before the text is cut.',
    run: function (t, d) {
      try { return t.replace(new RegExp(d.pattern || '', 'gu'), (d.replacement || '').replace(/\$(\d)/g, '$$$1')); }
      catch (e) { return t; }
    }}
};

// ---- token filters --------------------------------------------------------

function mapTokens(fn) {
  return function (toks) { return toks.map(function (x) { var y = Object.assign({}, x); if (!y.keyword) y.token = fn(y.token); return y; }); };
}

function parseSynonyms(lines) {
  var rules = [];
  var norm = function (s) { return fold(s.trim().toLowerCase()).split(/\s+/).filter(Boolean); };
  (lines || []).forEach(function (line) {
    line = String(line).trim();
    if (!line || line[0] === '#') return;
    if (line.indexOf('=>') >= 0) {
      var p = line.split('=>');
      rules.push({lhs: p[0].split(',').map(norm), rhs: p[1].split(',').map(norm), replace: true});
    } else {
      var all = line.split(',').map(norm);
      rules.push({lhs: all, rhs: all, replace: false});
    }
  });
  return rules;
}

function renumber(toks) {
  var pos = -1, last = null;
  return toks.map(function (x) {
    if (x._samePos && last !== null) return Object.assign({}, x, {position: pos, _samePos: undefined});
    pos++; last = x;
    return Object.assign({}, x, {position: pos, _samePos: undefined});
  });
}

var FILTERS = {
  lowercase: {say: 'Makes every letter small, so "Shoes" and "shoes" become the same word.',
    run: mapTokens(function (s) { return s.toLowerCase(); })},
  uppercase: {say: 'Makes every letter big.',
    run: mapTokens(function (s) { return s.toUpperCase(); })},
  asciifolding: {say: 'Removes accent marks, so "café" becomes "cafe".',
    run: mapTokens(fold)},
  stop: {say: 'Removes very common words like "the" and "for". They do not help the search.',
    run: function (toks, d) {
      var words = d.stopwords;
      var set = (!words || words === '_english_') ? STOP_EN : (words === '_none_' ? new Set() : new Set([].concat(words).map(function (w) { return d.ignore_case ? w.toLowerCase() : w; })));
      return toks.filter(function (x) { return !set.has(d.ignore_case ? x.token.toLowerCase() : x.token); });
    }},
  stemmer: {say: 'Cuts each word to its root, so "running" and "runs" both become "run".',
    run: function (toks, d) {
      var lang = d.language || d.name || 'english';
      if (lang === 'possessive_english') return mapTokens(function (s) { return s.replace(/['’]s$/i, ''); })(toks);
      var light = /light|minimal|plural/.test(lang);
      return mapTokens(function (s) { return stem(s, light); })(toks);
    }},
  keyword_marker: {say: 'Protects some words, so the stemmer does not change them.',
    run: function (toks, d) {
      var list = new Set((d.keywords || []).map(function (w) { return d.ignore_case ? w.toLowerCase() : w; }));
      var re = d.keywords_pattern ? new RegExp(d.keywords_pattern, 'u') : null;
      return toks.map(function (x) {
        var t = d.ignore_case ? x.token.toLowerCase() : x.token;
        return (list.has(t) || (re && re.test(x.token))) ? Object.assign({}, x, {keyword: true}) : x;
      });
    }},
  synonym: {say: 'Adds words with the same meaning. "sneakers" also becomes "trainers".',
    run: function (toks, d) {
      var rules = parseSynonyms(d.synonyms);
      var out = [], i = 0;
      while (i < toks.length) {
        var best = null;
        rules.forEach(function (r) {
          r.lhs.forEach(function (seq, si) {
            if (!seq.length || i + seq.length > toks.length) return;
            for (var k = 0; k < seq.length; k++) if (fold(toks[i + k].token.toLowerCase()) !== seq[k]) return;
            if (!best || seq.length > best.seq.length) best = {rule: r, seq: seq, si: si};
          });
        });
        if (!best) { out.push(toks[i]); i++; continue; }
        var first = toks[i], len = best.seq.length;
        var keep = toks.slice(i, i + len);
        if (!best.rule.replace) keep.forEach(function (x) { out.push(x); });
        best.rule.rhs.forEach(function (alt, ai) {
          if (!best.rule.replace && ai === best.si) return;
          alt.forEach(function (w, k) {
            out.push({token: w, start_offset: first.start_offset, end_offset: keep[keep.length - 1].end_offset,
              type: 'SYNONYM', position: first.position + Math.min(k, len - 1), _synonym: true});
          });
        });
        i += len;
      }
      return out;
    }},
  word_delimiter_graph: {say: 'Splits words at hyphens and other marks, and can also glue the parts back together, so "Wi-Fi" can match "wifi".',
    run: function (toks, d) {
      var on = function (k, def) { return d[k] === undefined ? def : !!d[k]; };
      var protectedW = new Set(d.protected_words || []);
      var out = [];
      toks.forEach(function (x) {
        if (protectedW.has(x.token)) { out.push(x); return; }
        var parts = [], re = /[\p{L}\p{N}]+/gu, m;
        while ((m = re.exec(x.token)) !== null) {
          var piece = m[0], base = m.index;
          var sub = piece;
          if (on('split_on_case_change', true)) sub = sub.replace(/(\p{Ll})(\p{Lu})/gu, '$1\u0000$2');
          if (on('split_on_numerics', true)) sub = sub.replace(/(\p{L})(\p{N})/gu, '$1\u0000$2').replace(/(\p{N})(\p{L})/gu, '$1\u0000$2');
          var off = 0;
          sub.split('\u0000').forEach(function (p) {
            parts.push({w: p, s: x.start_offset + base + off});
            off += p.length;
          });
        }
        if (on('stem_english_possessive', true) && parts.length > 1 && /^s$/i.test(parts[parts.length - 1].w) && /['’]s$/i.test(x.token)) parts.pop();
        var mk = function (w, s, e, same) { var t = tok(w, s, e, 0, x.type); t._samePos = same; return t; };
        if (parts.length <= 1) { out.push(Object.assign({}, x, {token: parts.length ? parts[0].w : x.token})); return; }
        var first = true;
        if (on('preserve_original', false)) { out.push(mk(x.token, x.start_offset, x.end_offset, false)); first = false; }
        parts.forEach(function (p, idx) {
          out.push(mk(p.w, p.s, p.s + p.w.length, idx === 0 && !first));
          if (idx === 0) {
            if (on('catenate_all', false)) out.push(mk(parts.map(function (q) { return q.w; }).join(''), x.start_offset, x.end_offset, true));
            else if (on('catenate_words', false) && parts.every(function (q) { return /^\p{L}+$/u.test(q.w); })) out.push(mk(parts.map(function (q) { return q.w; }).join(''), x.start_offset, x.end_offset, true));
          }
        });
      });
      return renumber(out);
    }},
  edge_ngram: {say: 'Keeps the first letters of each word (for example 2 to 5), so typing "run" can find "running".',
    run: function (toks, d) {
      var min = d.min_gram || 1, max = d.max_gram || 2, out = [];
      toks.forEach(function (x) {
        grams(x.token, min, max, true).forEach(function (g) { out.push(Object.assign({}, x, {token: g})); });
        if (d.preserve_original && x.token.length > max) out.push(x);
      });
      return out;
    }},
  ngram: {say: 'Cuts each word into small overlapping pieces, so "melon" can find "watermelon".',
    run: function (toks, d) {
      var min = d.min_gram || 1, max = d.max_gram || 2, out = [];
      toks.forEach(function (x) { grams(x.token, min, max, false).forEach(function (g) { out.push(Object.assign({}, x, {token: g})); }); });
      return out;
    }},
  shingle: {say: 'Also adds pairs of words next to each other, like "running shoes".',
    run: function (toks, d) {
      var out = [];
      toks.forEach(function (x, i) {
        if (d.output_unigrams !== false) out.push(x);
        if (i + 1 < toks.length) out.push(Object.assign({}, x, {token: x.token + ' ' + toks[i + 1].token, type: 'shingle', end_offset: toks[i + 1].end_offset}));
      });
      return out;
    }},
  trim: {say: 'Removes spaces at the start and end of each token.', run: mapTokens(function (s) { return s.trim(); })},
  reverse: {say: 'Writes each token backwards.', run: mapTokens(function (s) { return Array.from(s).reverse().join(''); })},
  unique: {say: 'Removes tokens that appear twice.',
    run: function (toks) { var seen = new Set(); return toks.filter(function (x) { if (seen.has(x.token)) return false; seen.add(x.token); return true; }); }},
  length: {say: 'Removes tokens that are too short or too long.',
    run: function (toks, d) { var min = d.min || 0, max = d.max || Infinity; return toks.filter(function (x) { return x.token.length >= min && x.token.length <= max; }); }},
  truncate: {say: 'Cuts long tokens to a maximum length.',
    run: function (toks, d) { var n = d.length || 10; return mapTokens(function (s) { return s.slice(0, n); })(toks); }},
  apostrophe: {say: 'Removes everything after an apostrophe.',
    run: mapTokens(function (s) { return s.replace(/['’].*$/, ''); })},
  elision: {say: 'Removes short words glued with an apostrophe, like "l\'" in "l\'avion".',
    run: function (toks, d) {
      var arts = d.articles || ['l', 'm', 't', 'qu', 'n', 's', 'j', 'd', 'c'];
      var re = new RegExp('^(' + arts.join('|') + ')[\'’]', 'i');
      return mapTokens(function (s) { return s.replace(re, ''); })(toks);
    }},
  pattern_replace: {say: 'Changes parts of each token that match a pattern.',
    run: function (toks, d) {
      try { var re = new RegExp(d.pattern || '', 'gu'); return mapTokens(function (s) { return s.replace(re, d.replacement || ''); })(toks); }
      catch (e) { return toks; }
    }},
  decimal_digit: {say: 'Changes digits from other writing systems into 0 to 9.', run: function (toks) { return toks; }}
};
FILTERS.synonym_graph = FILTERS.synonym;
FILTERS.word_delimiter = FILTERS.word_delimiter_graph;
FILTERS.porter_stem = {say: FILTERS.stemmer.say, run: function (t) { return FILTERS.stemmer.run(t, {language: 'english'}); }};
FILTERS.kstem = FILTERS.porter_stem;
FILTERS.snowball = FILTERS.porter_stem;
FILTERS.edgeNGram = FILTERS.edge_ngram;
FILTERS.nGram = FILTERS.ngram;

// ---- analyzers ------------------------------------------------------------

var LANGS = 'arabic armenian basque bengali brazilian bulgarian catalan cjk czech danish dutch estonian finnish french galician german greek hindi hungarian indonesian irish italian latvian lithuanian norwegian persian portuguese romanian russian sorani spanish swedish turkish thai'.split(' ');

function builtinAnalyzer(name, d) {
  d = d || {};
  var c = function (n, def) { return {name: n, def: def || {type: n}, ok: true}; };
  var stopF = d.stopwords && d.stopwords !== '_none_' ? [c('stop', {type: 'stop', stopwords: d.stopwords})] : [];
  switch (name) {
    case 'standard': return {charFilters: [], tokenizer: c('standard'), filters: [c('lowercase')].concat(stopF)};
    case 'simple': return {charFilters: [], tokenizer: c('lowercase'), filters: []};
    case 'whitespace': return {charFilters: [], tokenizer: c('whitespace'), filters: []};
    case 'keyword': return {charFilters: [], tokenizer: c('keyword'), filters: []};
    case 'stop': return {charFilters: [], tokenizer: c('lowercase'), filters: [c('stop', {type: 'stop', stopwords: d.stopwords || '_english_'})]};
    case 'pattern': return {charFilters: [], tokenizer: c('pattern', {type: 'pattern', pattern: d.pattern || '\\W+'}), filters: [c('lowercase')]};
    case 'english': return {charFilters: [], tokenizer: c('standard'), filters: [
      c('english_possessive_stemmer', {type: 'stemmer', language: 'possessive_english'}),
      c('lowercase'),
      c('english_stop', {type: 'stop', stopwords: d.stopwords || '_english_'}),
      c('english_stemmer', {type: 'stemmer', language: 'english'})]};
  }
  if (LANGS.indexOf(name) >= 0) {
    return {charFilters: [], tokenizer: c('standard'), filters: [c('lowercase')], note: 'The "' + name + '" analyzer is simplified here: only standard + lowercase. A real cluster also removes ' + name + ' stop words and stems the words.'};
  }
  return null;
}

function resolvePart(kind, ref, analysis) {
  var table = kind === 'tokenizer' ? 'tokenizer' : kind === 'char' ? 'char_filter' : 'filter';
  var known = kind === 'tokenizer' ? TOKENIZERS : kind === 'char' ? CHAR_FILTERS : FILTERS;
  if (ref && typeof ref === 'object') return {name: (ref.type || '?') + ' (inline)', def: ref, ok: !!known[ref.type]};
  var custom = ((analysis || {})[table] || {})[ref];
  if (custom) return {name: ref, def: custom, ok: !!known[custom.type]};
  return {name: ref, def: {type: ref}, ok: !!known[ref], builtin: true};
}

function resolveAnalyzer(name, analysis) {
  analysis = analysis || {};
  var def = (analysis.analyzer || {})[name];
  if (!def) {
    var b = builtinAnalyzer(name);
    return b ? Object.assign({name: name, builtin: true}, b) : null;
  }
  var type = def.type || 'custom';
  if (type !== 'custom') {
    var bt = builtinAnalyzer(type, def);
    return bt ? Object.assign({name: name}, bt) : {name: name, error: 'Unknown analyzer type "' + type + '".'};
  }
  if (!def.tokenizer) return {name: name, error: 'The analyzer "' + name + '" has no tokenizer. Every custom analyzer needs one.'};
  return {
    name: name,
    charFilters: [].concat(def.char_filter || []).map(function (r) { return resolvePart('char', r, analysis); }),
    tokenizer: resolvePart('tokenizer', def.tokenizer, analysis),
    filters: [].concat(def.filter || []).map(function (r) { return resolvePart('filter', r, analysis); })
  };
}

function resolveNormalizer(name, analysis) {
  var def = ((analysis || {}).normalizer || {})[name];
  if (!def) {
    if (name === 'lowercase') return {name: name, builtin: true, charFilters: [], tokenizer: {name: 'keyword', def: {type: 'keyword'}, ok: true}, filters: [{name: 'lowercase', def: {type: 'lowercase'}, ok: true}]};
    return null;
  }
  return {
    name: name,
    charFilters: [].concat(def.char_filter || []).map(function (r) { return resolvePart('char', r, analysis); }),
    tokenizer: {name: 'keyword', def: {type: 'keyword'}, ok: true},
    filters: [].concat(def.filter || []).map(function (r) { return resolvePart('filter', r, analysis); })
  };
}

var KEYWORD_CHAIN = {name: '(no analyzer)', charFilters: [], tokenizer: {name: 'keyword', def: {type: 'keyword'}, ok: true}, filters: []};

// Same shape as the answer of POST /_analyze with "explain": true.
function analyze(text, chain) {
  var t = String(text == null ? '' : text), notes = [];
  var cf = chain.charFilters.map(function (c) {
    var impl = CHAR_FILTERS[c.def.type];
    if (impl) t = impl.run(t, c.def); else notes.push('Character filter "' + c.name + '" is not copied in this prototype; the text was passed through unchanged.');
    return {name: c.name, filtered_text: [t]};
  });
  var tk = TOKENIZERS[chain.tokenizer.def.type] || TOKENIZERS.standard;
  if (!TOKENIZERS[chain.tokenizer.def.type]) notes.push('Tokenizer "' + chain.tokenizer.name + '" is not copied in this prototype; the standard tokenizer was used.');
  var toks = tk.run(t, chain.tokenizer.def);
  var copy = function (a) { return a.map(function (x) { var y = Object.assign({}, x); delete y._synonym; delete y._samePos; if (y.keyword) { y.keyword = true; } return y; }); };
  var tokenizer = {name: chain.tokenizer.name, tokens: copy(toks)};
  var tf = chain.filters.map(function (f) {
    var impl = FILTERS[f.def.type];
    if (impl) toks = impl.run(toks, Object.assign({name: f.def.language}, f.def));
    else notes.push('Token filter "' + f.name + '" (' + f.def.type + ') is not copied in this prototype; tokens were passed through unchanged.');
    return {name: f.name, tokens: copy(toks)};
  });
  if (chain.note) notes.push(chain.note);
  return {detail: {custom_analyzer: true, charfilters: cf, tokenizer: tokenizer, tokenfilters: tf}, notes: notes};
}

function finalTokens(resp) {
  var d = resp.detail;
  var last = d.tokenfilters.length ? d.tokenfilters[d.tokenfilters.length - 1] : d.tokenizer;
  return last.tokens;
}

function describe(kind, type) {
  var t = kind === 'tokenizer' ? TOKENIZERS : kind === 'char' ? CHAR_FILTERS : FILTERS;
  return (t[type] && t[type].say) || 'Not copied in this prototype. A real cluster runs it.';
}

// ---- reading an index definition -------------------------------------------

// Browsers do not always say where JSON breaks, so find the place with a small scanner.
function jsonErrorAt(text) {
  var i = 0;
  var ws = function () { while (i < text.length && /\s/.test(text[i])) i++; };
  var fail = function (msg) { throw {at: i, msg: msg}; };
  var value = function () {
    ws();
    var ch = text[i];
    if (ch === '{') {
      i++; ws();
      if (text[i] === '}') { i++; return; }
      for (;;) {
        ws(); if (text[i] !== '"') fail('Expected a name in double quotes, like "title".');
        str(); ws();
        if (text[i] !== ':') fail('Expected a colon (:) after the name.');
        i++; value(); ws();
        if (text[i] === ',') { i++; ws(); if (text[i] === '}') fail('Remove the comma before }.'); continue; }
        if (text[i] === '}') { i++; return; }
        fail('Expected a comma (,) or a closing brace (}).');
      }
    }
    if (ch === '[') {
      i++; ws();
      if (text[i] === ']') { i++; return; }
      for (;;) {
        value(); ws();
        if (text[i] === ',') { i++; ws(); if (text[i] === ']') fail('Remove the comma before ].'); continue; }
        if (text[i] === ']') { i++; return; }
        fail('Expected a comma (,) or a closing bracket (]).');
      }
    }
    if (ch === '"') return str();
    var m = /^(-?\d+(\.\d+)?([eE][+-]?\d+)?|true|false|null)/.exec(text.slice(i));
    if (m) { i += m[0].length; return; }
    if (ch === "'") fail('Use double quotes ("), not single quotes.');
    if (ch === undefined) fail('The text ends too early. Is a } or ] missing?');
    fail('Unexpected "' + ch + '" here.');
  };
  var str = function () {
    i++;
    while (i < text.length && text[i] !== '"') { if (text[i] === '\\') i++; if (text[i] === '\n') fail('A text in quotes cannot go over two lines.'); i++; }
    if (i >= text.length) fail('A double quote (") is missing at the end of a text.');
    i++;
  };
  try { value(); ws(); if (i < text.length) fail('There is extra text after the last }.'); return null; }
  catch (e) { if (e && e.at !== undefined) return e; throw e; }
}

function jsonError(text, e) {
  var found = jsonErrorAt(text);
  if (!found) return {line: null, col: null, msg: String(e.message || e)};
  var before = text.slice(0, found.at).split('\n');
  return {line: before.length, col: before[before.length - 1].length + 1, msg: found.msg};
}

// Accepts: {settings, mappings}, GET /<index> output, GET /<index>/_mapping output, or {properties}.
function readIndexJson(text) {
  var data;
  try { data = JSON.parse(text); } catch (e) { return {error: jsonError(text, e)}; }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return {error: {msg: 'The text must be one JSON object, starting with {.'}};
  var name = null, keys = Object.keys(data);
  if (keys.length === 1 && data[keys[0]] && typeof data[keys[0]] === 'object' && (data[keys[0]].mappings || data[keys[0]].settings)) {
    name = keys[0]; data = data[keys[0]];
  }
  var mappings = data.mappings || (data.properties ? data : null);
  if (!mappings || !mappings.properties) return {error: {msg: 'No "mappings.properties" found. Paste the body you would send to PUT /<index>, or the answer of GET /<index>.'}};
  var settings = data.settings || {};
  var analysis = settings.analysis || (settings.index && settings.index.analysis) || {};
  return {name: name, mappings: mappings, settings: settings, analysis: analysis};
}

var TEXT_TYPES = ['text', 'match_only_text', 'search_as_you_type'];

function fieldInfo(path, f, analysis, parent) {
  var type = f.type || (f.properties ? 'object' : 'object');
  var info = {path: path, type: type, parent: parent || null, raw: f};
  var has = function (n) { return !!(analysis.analyzer || {})[n]; };
  if (TEXT_TYPES.indexOf(type) >= 0) {
    info.kind = 'text';
    info.indexAnalyzer = f.analyzer || (has('default') ? 'default' : 'standard');
    info.searchAnalyzer = f.search_analyzer || (has('default_search') ? 'default_search' : (f.analyzer || (has('default') ? 'default' : 'standard')));
  } else if (type === 'keyword' || type === 'constant_keyword' || type === 'wildcard') {
    info.kind = 'keyword';
    info.normalizer = f.normalizer || null;
  } else {
    info.kind = 'other';
  }
  return info;
}

function listFields(mappings, analysis) {
  var out = [];
  (function walk(props, prefix) {
    Object.keys(props || {}).forEach(function (k) {
      var f = props[k] || {}, path = prefix + k;
      if (f.properties) {
        out.push({path: path, type: f.type || 'object', kind: 'object', raw: f});
        walk(f.properties, path + '.');
        return;
      }
      out.push(fieldInfo(path, f, analysis));
      Object.keys(f.fields || {}).forEach(function (sk) {
        out.push(fieldInfo(path + '.' + sk, f.fields[sk], analysis, path));
      });
    });
  })(mappings.properties, '');
  return out;
}

function chainFor(field, side, analysis) {
  if (field.kind === 'text') {
    var n = side === 'search' ? field.searchAnalyzer : field.indexAnalyzer;
    return resolveAnalyzer(n, analysis) || {name: n, error: 'The analyzer "' + n + '" is not defined in settings.analysis and is not a built-in analyzer.'};
  }
  if (field.kind === 'keyword') {
    if (!field.normalizer) return KEYWORD_CHAIN;
    return resolveNormalizer(field.normalizer, analysis) || {name: field.normalizer, error: 'The normalizer "' + field.normalizer + '" is not defined in settings.analysis.normalizer.'};
  }
  return null;
}

// Problems a person should know about before creating the index.
function checkIndex(parsed) {
  var fields = listFields(parsed.mappings, parsed.analysis), out = [];
  fields.forEach(function (f) {
    if (f.kind === 'text' || f.kind === 'keyword') {
      ['index', 'search'].forEach(function (side) {
        if (f.kind === 'keyword' && side === 'search') return;
        var c = chainFor(f, side, parsed.analysis);
        if (c && c.error) out.push({level: 'bad', field: f.path, msg: c.error});
        else if (c) {
          [c.tokenizer].concat(c.filters || [], c.charFilters || []).forEach(function (p) {
            if (p && !p.ok && !p.builtin) out.push({level: 'warn', field: f.path, msg: '"' + p.name + '" has type "' + p.def.type + '", which this prototype does not copy. A real cluster will run it.'});
            else if (p && !p.ok && p.builtin) out.push({level: 'bad', field: f.path, msg: '"' + p.name + '" is not defined in settings.analysis and is not built in. OpenSearch will refuse this index.'});
          });
          if (c.filters && c.filters.some(function (p) { return p.def.type === 'hunspell'; })) out.push({level: 'warn', field: f.path, msg: 'Hunspell reads dictionary files from the server disk. Check that the dictionary exists on every node.'});
          if (c.filters && c.filters.some(function (p) { return p.def.synonyms_path; })) out.push({level: 'warn', field: f.path, msg: 'synonyms_path reads a file from the server disk. Search Lens cannot test that file; paste the synonyms inline to test them.'});
        }
      });
    }
    if (f.kind === 'keyword' && !f.normalizer && !f.parent) out.push({level: 'tip', field: f.path, msg: 'Keyword field without a normalizer: "Nike" and "nike" are different values. Add "normalizer": "lowercase" if case should not matter.'});
    if (f.kind === 'text' && f.raw.search_analyzer && f.raw.search_analyzer !== f.raw.analyzer) out.push({level: 'tip', field: f.path, msg: 'This field uses one analyzer when saving and another when searching. That is fine for autocomplete, but check the test results.'});
  });
  var s = parsed.settings.index || parsed.settings;
  if (s.number_of_shards === undefined) out.push({level: 'tip', field: null, msg: 'number_of_shards is not set, so OpenSearch uses 1 shard. That is fine for small indexes (under about 30 GB).'});
  return out;
}

// ---- comparing tokens -----------------------------------------------------

function editDistance(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 3;
  var d = [], i, j;
  for (i = 0; i <= a.length; i++) d[i] = [i];
  for (j = 0; j <= b.length; j++) d[0][j] = j;
  for (i = 1; i <= a.length; i++) for (j = 1; j <= b.length; j++) {
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
  }
  return d[a.length][b.length];
}

// operator: 'or' (any word is enough) or 'and' (all words needed)
function compare(docToks, qToks, operator) {
  var docSet = new Set(docToks.map(function (x) { return x.token; }));
  var qWords = [], seen = new Set();
  qToks.forEach(function (x) { if (!seen.has(x.token)) { seen.add(x.token); qWords.push(x); } });
  // tokens at the same position (synonyms) count as one "word"
  var byPos = {};
  qWords.forEach(function (x) { (byPos[x.position] = byPos[x.position] || []).push(x.token); });
  var groups = Object.keys(byPos).map(function (p) { return byPos[p]; });
  var foundGroups = groups.filter(function (g) { return g.some(function (t) { return docSet.has(t); }); }).length;
  var found = qWords.filter(function (x) { return docSet.has(x.token); }).map(function (x) { return x.token; });
  var missing = qWords.filter(function (x) { return !docSet.has(x.token); }).map(function (x) { return x.token; });
  var verdict;
  if (!groups.length) verdict = 'empty';
  else if (foundGroups === groups.length) verdict = 'match';
  else if (foundGroups === 0) verdict = 'none';
  else verdict = operator === 'and' ? 'none' : 'partial';
  return {verdict: verdict, found: found, missing: missing, groups: groups.length, foundGroups: foundGroups, partialAnd: operator === 'and' && foundGroups > 0 && foundGroups < groups.length};
}

// A short reason, in plain words, why a search token is not in the document.
function hintFor(q, docToks) {
  var docs = docToks.map(function (x) { return x.token; });
  var low = function (s) { return s.toLowerCase(); };
  var d;
  if ((d = docs.find(function (x) { return x !== q && low(x) === low(q); }))) return {fix: 'lowercase', text: '"' + q + '" and "' + d + '" differ only in big and small letters. Add the lowercase filter.'};
  if ((d = docs.find(function (x) { return x !== q && fold(low(x)) === fold(low(q)); }))) return {fix: 'asciifolding', text: '"' + q + '" and "' + d + '" differ only in accents. Add the asciifolding filter.'};
  if ((d = docs.find(function (x, i) { return i + 1 < docs.length && x + docs[i + 1] === q; }))) {
    var i2 = docs.indexOf(d);
    return {fix: 'word_delimiter_graph', text: 'The document has "' + d + '" and "' + docs[i2 + 1] + '" as two words; the search has "' + q + '" as one. word_delimiter_graph with catenate_all glues them.'};
  }
  if ((d = docs.find(function (x) { return x.length > q.length && x.indexOf(q) === 0; }))) {
    if (stem(d) === stem(q) || stem(d, true) === stem(q, true)) return {fix: 'stemmer', text: '"' + q + '" and "' + d + '" are forms of the same word. A stemmer makes them equal.'};
    return {fix: 'edge_ngram', text: '"' + q + '" is the start of "' + d + '". Saving the first letters of each word (edge_ngram) lets a partial word match.'};
  }
  if ((d = docs.find(function (x) { return q.length > x.length && q.indexOf(x) === 0 && q.length - x.length <= 3; }))) return {fix: 'stemmer', text: '"' + q + '" and "' + d + '" look like forms of the same word. A stemmer makes them equal.'};
  if ((d = docs.find(function (x) { return x.length > q.length + 1 && x.indexOf(q) > 0; }))) return {fix: 'ngram', text: '"' + q + '" is inside "' + d + '", not at its start. Only small pieces (ngram) can find a word from the middle.'};
  if (q.length > 3 && (d = docs.find(function (x) { return x.length > 3 && (editDistance(x, q) <= 2 || editDistance(x, stem(q)) <= 1); }))) return {fix: 'fuzziness', text: '"' + q + '" looks like a typo of "' + d + '". Use "fuzziness": "AUTO" in the match query.'};
  if (docs.indexOf(q.replace(/[^\p{L}\p{N}]/gu, '')) >= 0) return {fix: 'word_delimiter_graph', text: '"' + q + '" has marks like - or & that the document does not. Remove them in both, with word_delimiter_graph or a mapping char filter.'};
  return {fix: 'synonym', text: 'The document has no word like "' + q + '". If they mean the same thing, add a synonym.'};
}

root.Lens = {
  STOP_EN: STOP_EN, fold: fold, stem: stem,
  analyze: analyze, finalTokens: finalTokens, describe: describe,
  resolveAnalyzer: resolveAnalyzer, resolveNormalizer: resolveNormalizer, KEYWORD_CHAIN: KEYWORD_CHAIN,
  readIndexJson: readIndexJson, listFields: listFields, chainFor: chainFor, checkIndex: checkIndex,
  compare: compare, hintFor: hintFor, editDistance: editDistance
};
})(typeof window !== 'undefined' ? window : globalThis);
