// Prototype only. Saved word lists in the browser's localStorage, with the same checks
// the real feature will need. Used by a-clean-lab.html and a-word-lists.html.
(function () {
  var KEY = 'searchlens.wordlists.v1';
  var QUOTA = 5 * 1024 * 1024;              // about 5 MB, browsers differ
  var MAX_LIST = 1024 * 1024;               // 1 MB per list file
  var MAX_HUNSPELL = 4 * 1024 * 1024;       // 4 MB for .aff + .dic together

  var TYPES = {
    entity:    { label: 'Entities',        one: 'entity',     many: 'entities',     accept: '.txt',      hint: '.txt, one phrase per line' },
    protected: { label: 'Protected words', one: 'word',       many: 'words',        accept: '.txt',      hint: '.txt, one word per line' },
    synonym:   { label: 'Synonyms',        one: 'rule',       many: 'rules',        accept: '.txt',      hint: '.txt, Solr format' },
    hunspell:  { label: 'Hunspell',        one: 'word',       many: 'words',        accept: '.aff,.dic', hint: 'choose the .aff and .dic together' }
  };

  var WORD = /^[\p{L}\p{N}][\p{L}\p{N}'._-]*$/u;

  function norm(s) { return s.trim().toLowerCase().replace(/\s+/g, ' '); }
  function normSyn(s) {
    return s.split('=>').map(function (side) {
      return side.split(',').map(norm).join(', ');
    }).join(' => ');
  }

  // Each check returns an error message, or null when the line is fine.
  var checkLine = {
    protected: function (s) {
      if (s.indexOf(' ') >= 0) return '"' + s + '" has a space. A protected word must be one word. Put phrases in Entities.';
      if (!WORD.test(s)) return '"' + s + '" has a character that is not allowed. Use letters, numbers, - _ . or \'.';
      return null;
    },
    entity: function (s) {
      var parts = s.split(' ');
      if (parts.length < 2) return '"' + s + '" is one word. An entity needs two or more words. Put single words in Protected words.';
      var bad = parts.filter(function (p) { return !WORD.test(p); })[0];
      if (bad) return '"' + bad + '" has a character that is not allowed. Use letters, numbers, - _ . or \'.';
      return null;
    },
    synonym: function (s) {
      var sides = s.split('=>');
      if (sides.length > 2) return 'Use "=>" only once in a rule.';
      if (sides.length === 2 && (!sides[0].trim() || !sides[1].trim()))
        return 'Put words on both sides of "=>", for example: tv => television';
      var terms = [];
      for (var i = 0; i < sides.length; i++) {
        var t = sides[i].split(',').map(norm);
        if (t.some(function (x) { return !x; })) return 'There is an empty word between commas. Remove the extra comma.';
        terms = terms.concat(t);
      }
      if (sides.length === 1 && terms.length < 2)
        return '"' + s + '" has only one word. Write two or more words with commas, for example: couch, sofa';
      return null;
    }
  };

  function parseList(type, text) {
    var res = { errors: [], warnings: [], entries: [] };
    var seen = {};
    text.split(/\r?\n/).forEach(function (raw, i) {
      var s = raw.trim();
      if (!s || s[0] === '#') return;
      var line = type === 'synonym' ? normSyn(s) : norm(s);
      var err = checkLine[type](line);
      if (err) { res.errors.push({ line: i + 1, msg: err }); return; }
      if (seen[line]) { res.warnings.push({ line: i + 1, msg: '"' + line + '" is already on line ' + seen[line] + '. Kept once.' }); return; }
      seen[line] = i + 1;
      res.entries.push(line);
    });
    if (!res.errors.length && !res.entries.length)
      res.errors.push({ line: 0, msg: 'The file has no entries. Lines that start with # are comments.' });
    return res;
  }

  function baseName(n) { return n.replace(/\.[^.]+$/, ''); }

  function parseHunspell(files) {
    var res = { errors: [], warnings: [], entries: [] };
    var aff = files.filter(function (f) { return /\.aff$/i.test(f.name); });
    var dic = files.filter(function (f) { return /\.dic$/i.test(f.name); });
    if (files.length !== 2 || aff.length !== 1 || dic.length !== 1) {
      res.errors.push({ line: 0, msg: 'Choose two files together: one .aff and one .dic, for example en_US.aff and en_US.dic.' });
      return res;
    }
    aff = aff[0]; dic = dic[0];
    if (baseName(aff.name) !== baseName(dic.name))
      res.errors.push({ line: 0, msg: 'The names do not match: ' + aff.name + ' and ' + dic.name + '. Use two files for the same language.' });
    if (!/^\s*(SET|SFX|PFX)\s/m.test(aff.text))
      res.errors.push({ line: 0, msg: aff.name + ' has no SET, PFX or SFX lines. Is it a Hunspell .aff file?' });

    var lines = dic.text.split(/\r?\n/);
    var first = lines[0].trim();
    if (!/^\d+$/.test(first)) {
      res.errors.push({ line: 0, msg: dic.name + ', line 1: the first line must be the number of words, for example 49000.' });
      return res;
    }
    lines.slice(1).forEach(function (l) {
      var w = l.trim().split('/')[0];
      if (w) res.entries.push(w);
    });
    if (!res.entries.length) res.errors.push({ line: 0, msg: dic.name + ' has no words after line 1.' });
    else if (Number(first) !== res.entries.length)
      res.warnings.push({ line: 0, msg: dic.name + ' says ' + first + ' words on line 1, but has ' + res.entries.length + '. Saved anyway.' });
    res.name = baseName(dic.name);
    return res;
  }

  // ---- storage ----

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* broken data: start again with samples */ }
    var data = sample();
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* storage off */ }
    return data;
  }

  function used() {
    var raw = localStorage.getItem(KEY) || '';
    return (KEY.length + raw.length) * 2;   // the browser counts UTF-16, 2 bytes a character
  }

  function kb(n) { return n < 1024 * 1024 ? Math.max(1, Math.round(n / 1024)) + ' KB' : (n / 1024 / 1024).toFixed(1) + ' MB'; }

  // Returns an error message, or null when saved.
  function trySave(data) {
    var json = JSON.stringify(data);
    try {
      localStorage.setItem(KEY, json);
      return null;
    } catch (e) {
      var need = (KEY.length + json.length) * 2;
      return 'Storage is full. Saving needs about ' + kb(need) + ', and the browser allows about ' + kb(QUOTA) +
        '. Remove a list and try again.';
    }
  }

  function uid() { return 'f' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  function list(type) { return load().files.filter(function (f) { return f.type === type; }); }

  function enabledEntries(type) {
    var out = [];
    list(type).forEach(function (f) { if (f.enabled) out = out.concat(f.entries); });
    return out;
  }

  function readText(file) {
    return file.text().then(function (text) { return { name: file.name, text: text }; });
  }

  // Check and save one list file (or a .aff + .dic pair). Never throws.
  function addFiles(type, fileList) {
    var t = TYPES[type];
    var files = Array.from(fileList);
    var names = files.map(function (f) { return f.name; }).join(' + ');
    var fail = function (errors) { return { ok: false, name: names, errors: errors, warnings: [] }; };

    if (type !== 'hunspell' && files.length !== 1) return Promise.resolve(fail([{ line: 0, msg: 'Choose one file at a time.' }]));
    var accept = t.accept.split(',');
    var limit = type === 'hunspell' ? MAX_HUNSPELL : MAX_LIST;
    var total = 0, problems = [];
    files.forEach(function (f) {
      total += f.size;
      if (!accept.some(function (a) { return f.name.toLowerCase().endsWith(a); }))
        problems.push({ line: 0, msg: f.name + ': this list needs a ' + accept.join(' or ') + ' file.' });
      else if (f.size === 0) problems.push({ line: 0, msg: f.name + ' is empty.' });
    });
    if (!problems.length && total > limit)
      problems.push({ line: 0, msg: 'The file is ' + kb(total) + '. The limit is ' + kb(limit) + '. Split it into smaller files.' });
    if (problems.length) return Promise.resolve(fail(problems));

    return Promise.all(files.map(readText)).then(function (texts) {
      var binary = texts.filter(function (f) { return /[\u0000�]/.test(f.text); })[0];
      if (binary) return fail([{ line: 0, msg: binary.name + ' does not look like a text file. Save it as UTF-8 text and try again.' }]);

      var res = type === 'hunspell' ? parseHunspell(texts) : parseList(type, texts[0].text);
      if (res.errors.length) return { ok: false, name: names, errors: res.errors, warnings: res.warnings };

      var name = type === 'hunspell' ? res.name : texts[0].name;
      var data = load();
      var old = data.files.filter(function (f) { return f.type === type && f.name === name; })[0];
      var rec = { id: old ? old.id : uid(), type: type, name: name, enabled: old ? old.enabled : true,
                  entries: res.entries, updated: Date.now() };
      if (old) data.files[data.files.indexOf(old)] = rec; else data.files.push(rec);
      var err = trySave(data);
      if (err) return fail([{ line: 0, msg: err }]);
      return { ok: true, id: rec.id, name: name, replaced: !!old, count: rec.entries.length, errors: [], warnings: res.warnings };
    }, function () {
      return fail([{ line: 0, msg: 'The browser could not read the file. Try again.' }]);
    });
  }

  function change(id, fn) {
    var data = load();
    var f = data.files.filter(function (x) { return x.id === id; })[0];
    if (!f) return 'This file is gone. Reload the page.';
    var msg = fn(f, data);
    if (msg) return msg;
    return trySave(data);
  }

  function remove(id) {
    return change(id, function (f, data) { data.files.splice(data.files.indexOf(f), 1); });
  }

  function toggle(id) {
    return change(id, function (f) { f.enabled = !f.enabled; });
  }

  function addEntry(id, text) {
    return change(id, function (f) {
      if (f.type === 'hunspell') return 'Hunspell words come from the .dic file. Change the file and add it again.';
      if (!text.trim()) return 'Type something first.';
      var line = f.type === 'synonym' ? normSyn(text) : norm(text);
      var err = checkLine[f.type](line);
      if (err) return err;
      if (f.entries.indexOf(line) >= 0) return '"' + line + '" is already in ' + f.name + '.';
      f.entries.unshift(line);
      f.updated = Date.now();
    });
  }

  function removeEntry(id, entry) {
    return change(id, function (f) {
      var i = f.entries.indexOf(entry);
      if (i < 0) return '"' + entry + '" is not in ' + f.name + '.';
      if (f.entries.length === 1) return 'This is the last entry. Remove the whole file instead.';
      f.entries.splice(i, 1);
      f.updated = Date.now();
    });
  }

  function reset() {
    try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
    load();
  }

  function sample() {
    var now = Date.now(), day = 86400000;
    function file(type, name, enabled, age, entries) {
      return { id: uid(), type: type, name: name, enabled: enabled, updated: now - age, entries: entries };
    }
    return { files: [
      file('entity', 'entity.txt', true, 0, ['ai supplychain', 'machine learning', 'new york', 'data lake',
        'purchase order', 'supply chain management', 'large language model', 'cloud native']),
      file('entity', 'brands-2026.txt', false, 2 * day, ['north face', 'under armour', 'new balance']),
      file('protected', 'protected.txt', true, 0, ['iphone', 'adidas', 'running', 'news', 'kubernetes', 'opensearch', 'wifi']),
      file('synonym', 'synonyms.txt', true, 0, ['sneakers, running shoes', 'tv => television',
        'mobile, cell phone, smartphone', 'laptop, notebook', 'couch, sofa']),
      file('synonym', 'abbreviations.txt', true, 7 * day, ['scm => supply chain management',
        'ai => artificial intelligence', 'po => purchase order']),
      file('hunspell', 'en_US-sample', true, 3 * day, ['run', 'mouse', 'study', 'good', 'shoe', 'walk'])
    ] };
  }

  window.WordLists = {
    TYPES: TYPES, QUOTA: QUOTA, kb: kb, used: used, list: list, enabledEntries: enabledEntries,
    addFiles: addFiles, remove: remove, toggle: toggle, addEntry: addEntry, removeEntry: removeEntry, reset: reset
  };
})();
