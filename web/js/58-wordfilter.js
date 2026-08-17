// ==========================
// WORD FILTER — what a student may not publish to everyone else.
//
// Thoughts (js/59-thoughts.js) go live the moment Send is pressed, and every
// student in the major reads them. This is the only thing standing between
// that feed and the first person who decides to be foul in it, so it is
// deliberately blunt: on a match the thought is rejected outright, before it
// is stored or sent anywhere.
//
// WHAT MAKES THIS HARD
//
// Nobody types a slur cleanly when they know it is being checked. They pad
// it (n i g g e r), repeat letters (assssss), swap digits for letters
// (a55), mix scripts, add diacritics (كـلـب), or write one language in
// another's alphabet — "kelef" is Hebrew for dog written in Latin, "كيليف"
// the same thing in Arabic letters. So matching runs on a NORMALIZED copy of
// the text: case folded, diacritics stripped, tatweel removed, Arabic letter
// forms unified (أ إ آ -> ا, ة -> ه, ى -> ي), leet digits mapped back to
// letters, and runs of the same letter collapsed. The original text is never
// modified — only inspected.
//
// WHY WORD BOUNDARIES MATTER MORE THAN THE LIST
//
// A naive substring check is worse than useless: "class" contains an English
// slur for a backside, "Basra" and "assessment" and the Arabic "حمارة" (a
// place name) all trip it. Every entry is matched as a whole word — with
// Arabic's clitics (و ف ب ك ل ال يا) allowed as prefixes and its possessive
// endings as suffixes, because "وكلبك" is one word to a regex and three
// pieces to a reader. A handful of entries that are only ever insults are
// allowed to match inside longer words; everything else needs boundaries.
//
// WHAT IT DELIBERATELY DOES NOT DO
//
// It does not try to detect tone, sarcasm, or being unkind about a lecturer
// — that is not a word list's job and pretending otherwise would reject half
// the honest posts. It catches slurs and crude abuse. Everything else is a
// human problem.
// ==========================
(function(){
  'use strict';

  // ---- normalization ------------------------------------------------------

  // Arabic diacritics (harakat), the tatweel stretch character, and the
  // zero-width joiners people paste between letters to break matching.
  var STRIP = /[ؐ-ًؚ-ٰٟۖ-ۭـ​-‏‪-‮﻿]/g;

  var ARABIC_FOLD = [
    [/[آأإٱٲٳ]/g, 'ا'],  // آ أ إ -> ا
    [/[ة]/g, 'ه'],                                 // ة -> ه
    [/[ىی]/g, 'ي'],                           // ى ی -> ي
    [/[ؤ]/g, 'و'],                                 // ؤ -> و
    [/[ئ]/g, 'ي'],                                 // ئ -> ي
    [/[ک]/g, 'ك'],                                 // ک -> ك
    [/[گ]/g, 'ج']                                  // گ -> ج (dialect spelling)
  ];

  // Digits and symbols standing in for letters. Kept small and unambiguous:
  // mapping every digit would turn course codes into words.
  var LEET = { '0':'o', '1':'i', '3':'e', '4':'a', '5':'s', '7':'t', '8':'b', '9':'g', '@':'a', '$':'s', '!':'i', '|':'i', '+':'t' };

  function normalize(text){
    var s = String(text == null ? '' : text);
    // Unicode-normalize so composed and decomposed forms match, then drop
    // combining marks — this is what handles "ｎｉｇｇｅｒ" and "n̈aughty" alike.
    try{ s = s.normalize('NFKD').replace(/[̀-ͯ]/g, ''); }catch(e){}
    s = s.toLowerCase().replace(STRIP, '');
    ARABIC_FOLD.forEach(function(pair){ s = s.replace(pair[0], pair[1]); });
    s = s.replace(/[0134578|@$!+]/g, function(ch){ return LEET[ch] || ch; });
    return s;
  }

  // "n i g g e r", "k.e.l.b", "f*u*c*k" — padding a word with separators is
  // the oldest trick there is, and stripping separators from the whole text
  // would glue innocent words together into new ones. So the text is checked
  // TWICE: once as written, once with every separator removed. A word only
  // has to be found in one of them.
  //
  // Deliberately no lookbehind anywhere in this file: Safari only learned it
  // in 16.4 and plenty of students are on older phones, where a lookbehind
  // regex is a syntax error that would take the whole module down and let
  // everything through.
  var SEP_CLASS = "[\\s._\\-*'\"`~^()\\[\\]{}/\\\\]";
  var SEP_RE = new RegExp(SEP_CLASS, 'gu');
  var PADDED_TOKEN = new RegExp('^\\p{L}(?:' + SEP_CLASS + '+\\p{L})+$', 'u');

  // Close up a word that has been padded apart — "f u c k", "k.e.l.b",
  // "n-i-g-g-e-r" — without touching the rest of the sentence.
  //
  // Done by token, not by regex over the whole string. The obvious pattern
  // ("letter separator letter separator ...") is greedy: on "f u c k this
  // exam" it matched "f u c k t" and produced "fuckthis exam", where the
  // whole-word rule no longer fires and the post sailed straight through.
  // Splitting first makes the boundaries explicit and the result exact.
  function depad(s){
    var words = s.split(/\s+/);
    var out = [];
    var run = [];
    function flushRun(){
      // Three or more single letters in a row is padding; one or two is
      // ordinary writing ("I a", "a b").
      if(run.length >= 3){ out.push(run.join('')); }
      else { out.push.apply(out, run); }
      run = [];
    }
    words.forEach(function(w){
      if(!w) return;
      // "k.e.l.b" — separators inside one token.
      if(PADDED_TOKEN.test(w)){ flushRun(); out.push(w.replace(SEP_RE, '')); return; }
      if(Array.from(w).length === 1){ run.push(w); return; }
      flushRun();
      out.push(w);
    });
    flushRun();
    return out.join(' ');
  }

  // Still checked with every separator gone as well, for the entries that
  // match anywhere rather than as whole words.
  function squeeze(s){ return s.replace(SEP_RE, ''); }

  function escapeRe(s){ return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  // Elongation ("assssss", "كلللب", "yaaaa") used to be handled by collapsing
  // every repeated letter in BOTH the text and the word list. That was wrong
  // in a way only a big corpus showed: collapsing turns "ass" into "as", and
  // the filter then rejected every English sentence containing the word "as"
  // — "save it as a PDF", "signed in as", "mark calculus i as completed".
  // 22 sentences out of 13,589 died on that alone.
  //
  // The pattern absorbs the repetition instead: "ass" compiles to /a+s+s+/,
  // which matches "ass" and "asssss" but NOT "as" — the second s still has to
  // be there. Nothing is collapsed anywhere now.
  function elongate(word){
    var out = '';
    for(var i = 0; i < word.length; i++){ out += escapeRe(word[i]) + '+'; }
    return out;
  }

  // ---- the lists, and the two tiers -------------------------------------
  //
  // The words themselves live in js/58-wordlist-data.js so the list can be
  // swapped for a bigger one without touching this file. If that file is
  // missing the filter still runs on a small built-in core rather than
  // silently letting everything through — a moderation feature that fails
  // open is worse than one that is not there.
  var CORE = {
    always: { en: ['nigger', 'faggot', 'fuck', 'shit', 'bitch', 'cunt', 'asshole'],
              ar: ['شرموط', 'قحبه', 'منيوك', 'كسمك', 'خرا'] },
    contextual: { en: ['donkey', 'dog', 'pig', 'idiot', 'stupid'],
                  ar: ['حمار', 'كلب', 'خنزير', 'غبي', 'وسخ'] },
    markers: { targeting: { ar: ['يا', 'انت'], en: ['you', 'your'], phrases_en: [], phrases_ar: [] },
               topical: { ar: ['عن', 'درسنا'], en: ['about', 'study'] } }
  };

  function data(){
    var d = window.AAUP_WORDLIST || CORE;
    // A student-supplied list, merged on top. Same shape, added through
    // Settings or the admin panel; never replaces the shipped one.
    var extra = null;
    try{ extra = JSON.parse(localStorage.getItem('aaup_wordlistExtra') || 'null'); }catch(e){}
    if(!extra) return d;
    var merged = { always: { en: [], ar: [] }, contextual: { en: [], ar: [] }, markers: d.markers };
    ['always', 'contextual'].forEach(function(tier){
      ['en', 'ar'].forEach(function(lang){
        merged[tier][lang] = ((d[tier] && d[tier][lang]) || []).concat(
          (extra[tier] && Array.isArray(extra[tier][lang])) ? extra[tier][lang] : []);
      });
    });
    return merged;
  }

  // Arabic words rarely stand alone: conjunctions, prepositions, the article
  // and the vocative attach to the front; possessives to the back.
  //
  // Levantine speech glues more than Modern Standard Arabic does: "هالحمار"
  // is ها + ال + حمار ("this donkey") and is how anyone here would actually
  // type it, so the demonstrative and the "على" contraction belong here too.
  var AR_PREFIX = '(?:[وفبكل]|ال|وال|بال|كال|فال|لل|يا|ها|هال|وهال|لهال|عال|ع)*';
  // Possessive endings are always safe: "كلبك" is "your dog", the same word.
  var AR_SUFFIX_POSS = '(?:ك|كم|كن|ها|هم|هن|ي|نا)*';
  // These BUILD words: "ثور" + ة is "ثورة" (revolution), "قرد" + ات is
  // unrelated. Allowed only on entries long enough that a collision is
  // unlikely — short roots take the possessives alone.
  var AR_SUFFIX_FORMS = '(?:ه|ات|ين)?';
  var AR_SUFFIX = AR_SUFFIX_POSS + AR_SUFFIX_FORMS;

  // A word this short and this specific has no innocent occurrence inside a
  // longer one, so it may match anywhere rather than as a whole word.
  var ANYWHERE = ['nigger', 'nigga', 'faggot', 'motherfucker', 'cunt', 'sharmuta',
                  'شرموط', 'قحبه', 'منيوك', 'كسمك'];
  var ANYWHERE_SET = Object.create(null);
  ANYWHERE.forEach(function(w){ ANYWHERE_SET[normalize(w)] = true; });

  function patternFor(raw){
    var w = normalize(raw);
    if(!w) return null;
    var body = elongate(w);
    var OPEN = '(?:^|[^\\p{L}\\p{N}])';
    var CLOSE = '(?:$|[^\\p{L}\\p{N}])';
    var src;
    if(ANYWHERE_SET[w]){
      src = body;
    } else if(/[؀-ۿ]/.test(w)){
      // A three-letter Arabic root plus a "ة" is usually a different word,
      // not an inflection of the same one: "ثور" (bull) + ه is "ثورة"
      // (revolution), which the corpus caught 32 times. Short entries take
      // the clitic prefixes only; anything that really is an inflection is
      // listed in its own right.
      var suffix = w.length >= 4 ? AR_SUFFIX : AR_SUFFIX_POSS;
      src = OPEN + AR_PREFIX + body + suffix + CLOSE;
    } else {
      src = OPEN + body + '(?:s|es|ed|ing|y|ies)?' + CLOSE;
    }
    try{ return { word: raw, re: new RegExp(src, 'u') }; }catch(e){ return null; }
  }

  var built = null;
  function patterns(){
    if(built) return built;
    var d = data();
    var mk = function(list){
      return (list || []).map(patternFor).filter(Boolean);
    };
    built = {
      comparatives: ((d.comparatives && d.comparatives.ar) || [])
        .concat((d.comparatives && d.comparatives.en) || [])
        .map(function(ph){ return normalize(ph); })
        .filter(Boolean),
      always: mk((d.always && d.always.en) || []).concat(mk((d.always && d.always.ar) || [])),
      contextual: mk((d.contextual && d.contextual.en) || []).concat(mk((d.contextual && d.contextual.ar) || [])),
      markers: (d.markers || CORE.markers)
    };
    return built;
  }
  // Called after a list is imported so the next check uses it.
  function reload(){ built = null; }

  // ---- context ------------------------------------------------------------
  //
  // A contextual word is only abuse when it is aimed at somebody. Both
  // languages leave traces when that happens — a vocative, a second-person
  // pronoun, "you are a", a demonstrative — and different traces when the
  // sentence is ABOUT the thing: "we studied", "about", "species", "I have a".
  //
  // The rule, in order:
  //   1. a STRONG targeting marker ("يا", "you are a")   -> abuse
  //   2. otherwise a topical marker ("about", "درسنا")   -> allowed
  //   3. otherwise a person in the sentence ("الدكتور")  -> abuse
  //   4. otherwise                                       -> abuse
  //
  // Step 3 is the deliberate part. On a wall every student reads, an
  // unexplained "الدكتور حمار" is far likelier to be an insult than a
  // zoology observation, and the cost of being wrong is a rephrase — the
  // message says which word to change. The cost of the opposite default is
  // the thing this feature exists to prevent.
  function hasMarker(hay, words){
    for(var i = 0; i < (words || []).length; i++){
      var w = normalize(words[i]);
      if(!w) continue;
      var re;
      try{
        re = /[؀-ۿ]/.test(w)
          ? new RegExp('(?:^|[^\\p{L}\\p{N}])' + AR_PREFIX + elongate(w) + (w.length >= 4 ? AR_SUFFIX : AR_SUFFIX_POSS) + '(?:$|[^\\p{L}\\p{N}])', 'u')
          : new RegExp('(?:^|[^\\p{L}\\p{N}])' + elongate(w) + '(?:s|es)?(?:$|[^\\p{L}\\p{N}])', 'u');
      }catch(e){ continue; }
      if(re.test(hay)) return true;
    }
    return false;
  }
  function hasPhrase(hay, phrases){
    for(var i = 0; i < (phrases || []).length; i++){
      var pnorm = normalize(phrases[i]);
      if(pnorm && hay.indexOf(pnorm) !== -1) return true;
    }
    return false;
  }

  function aimedAtSomeone(hay, markers){
    var t = markers.targeting || {};
    if(hasMarker(hay, t.ar) || hasMarker(hay, t.en)) return true;
    if(hasPhrase(hay, t.phrases_en) || hasPhrase(hay, t.phrases_ar)) return true;
    return false;
  }
  // An inanimate subject is being described. Calling a course rubbish is not
  // abuse; calling a person rubbish is.
  function aboutAThing(hay, markers){
    var th = markers.things || {};
    return hasMarker(hay, th.ar) || hasMarker(hay, th.en);
  }

  // A person is mentioned. Likely an insult, but not proof — see the note on
  // `people` in the word list.
  // Split on the joins people actually use between two statements —
  // punctuation, and the Arabic/English "but", "and", "though". Kept crude on
  // purpose: this is not parsing, it is refusing to let one half of a
  // sentence vouch for the other.
  var CLAUSE_SPLIT = /[.!?،؛,;\n]+|\s(?:بس|لكن|لاكن|ولكن|اما|اما|though|but|however|and yet)\s/u;
  function splitClauses(hay){
    var parts = hay.split(CLAUSE_SPLIT).map(function(x){ return (x || '').trim(); }).filter(Boolean);
    return parts.length ? parts : [hay];
  }

  function personMentioned(hay, markers){
    var pe = markers.people || {};
    return hasMarker(hay, pe.ar) || hasMarker(hay, pe.en);
  }
  function talkingAboutIt(hay, markers){
    var t = markers.topical || {};
    return hasMarker(hay, t.ar) || hasMarker(hay, t.en) ||
           hasPhrase(hay, t.en) || hasPhrase(hay, t.ar);
  }

  // ---- the check ----------------------------------------------------------

  // Returns { clean: true } or { clean: false, word: '<the entry that hit>' }.
  // The offending word is returned so the caller can tell the student which
  // one to remove — being vague about it just gets the same post retried.
  function check(text){
    var hay = normalize(text);
    if(!hay) return { clean: true };
    // Three readings of the same sentence: as typed, with padded runs closed
    // up, and with every separator gone. Collapsed again each time, because
    // the needles are stored collapsed and "n i g g e r" only grows its
    // double letter once the spaces are out.
    var variants = [hay, depad(hay), squeeze(hay)];
    var p = patterns();

    function hit(list){
      for(var i = 0; i < list.length; i++){
        for(var v = 0; v < variants.length; v++){
          if(variants[v] && list[i].re.test(variants[v])) return list[i].word;
        }
      }
      return null;
    }

    var always = hit(p.always);
    if(always) return { clean: false, word: always, tier: 'always' };

    // "more X than" — an insult wearing a topical sentence as a coat.
    //
    // It still needs somebody to be aimed at, or the shape collides with
    // ordinary Arabic: "الأحمر من الناحية العلمية" is "the red one, from a
    // scientific standpoint". So a comparative is abuse unless the sentence
    // is plainly about a subject and mentions no person at all.
    for(var c = 0; c < p.comparatives.length; c++){
      if(hay.indexOf(p.comparatives[c]) !== -1){
        var excused = talkingAboutIt(hay, p.markers) && !personMentioned(hay, p.markers);
        if(!excused) return { clean: false, word: p.comparatives[c], tier: 'comparative' };
      }
    }

    var soft = hit(p.contextual);
    if(!soft) return { clean: true };

    // Judged CLAUSE BY CLAUSE, not sentence by sentence.
    //
    // "درسنا عن الحمير بس الدكتور حمار" is two statements: a lecture and an
    // insult. Weighed as one sentence the topical half excuses the other
    // half, which is exactly how someone would get an insult past a filter
    // that reads whole sentences. Each clause is judged alone and any
    // abusive clause rejects the post.
    // Every variant is split, not just the text as typed: "ي ا ح م ا ر" only
    // becomes a word once the padding is closed up, and a clause list built
    // from the raw text would never contain it.
    // PROXIMITY, before anything else.
    //
    // Clause splitting cannot see "و": in "درسنا عن الحمير والدكتور حمار" the
    // "and" is glued to the next word, so the lecture and the insult are one
    // clause and the lecture half excuses the insult half. Both evasions
    // found in testing worked exactly that way.
    //
    // So each OCCURRENCE is judged by its own neighbourhood: a person right
    // beside the word, with no topical word in between, is an insult
    // regardless of what the rest of the sentence is about. Two tokens either
    // side — wide enough for "الدكتور حمار" and "the professor is a pig",
    // tight enough that "الدكتور بحكي عن الحمير" keeps its "عن".
    var WINDOW = 2;
    for(var vi = 0; vi < variants.length; vi++){
      var toks = (variants[vi] || '').split(/\s+/).filter(Boolean);
      for(var ti = 0; ti < toks.length; ti++){
        var word = null;
        for(var pi = 0; pi < p.contextual.length; pi++){
          if(p.contextual[pi].re.test(' ' + toks[ti] + ' ')){ word = p.contextual[pi].word; break; }
        }
        if(!word) continue;
        var near = toks.slice(Math.max(0, ti - WINDOW), ti + WINDOW + 1).join(' ');
        // Only a GOVERNOR excuses a word standing next to a person, and only
        // from in front of it: "عن" and "درسنا" govern what follows, so
        // "الدكتور بحكي عن الحمير" is a lecture. A field name does not govern
        // anything — "استاذ الاحياء كلب" is an insult with a subject noun in
        // it, and treating "الأحياء" as cover let it through.
        var before = toks.slice(Math.max(0, ti - WINDOW), ti).join(' ');
        if(hasMarker(before, (p.markers.governors || {}).ar) ||
           hasMarker(before, (p.markers.governors || {}).en)) continue;
        if(aimedAtSomeone(near, p.markers) || personMentioned(near, p.markers)){
          return { clean: false, word: word, tier: 'nearPerson' };
        }
      }
    }

    var clauses = [];
    variants.forEach(function(v){
      splitClauses(v).forEach(function(c){ if(clauses.indexOf(c) === -1) clauses.push(c); });
    });
    var verdict = null;
    for(var i = 0; i < clauses.length; i++){
      var cl = clauses[i];
      if(!cl) continue;
      var here = null;
      for(var j = 0; j < p.contextual.length; j++){
        if(p.contextual[j].re.test(cl)){ here = p.contextual[j].word; break; }
      }
      if(!here) continue;
      if(aimedAtSomeone(cl, p.markers)) return { clean: false, word: here, tier: 'aimed' };
      if(talkingAboutIt(cl, p.markers)){ continue; }          // this clause is fine
      if(personMentioned(cl, p.markers)) return { clean: false, word: here, tier: 'aboutPerson' };
      // Only once no person is in the clause: a thing can be called rubbish.
      if(aboutAThing(cl, p.markers)){ continue; }
      verdict = { clean: false, word: here, tier: 'unclear' };
    }
    return verdict || { clean: true, note: 'topical' };
  }

  window.AAUP_WORDFILTER = {
    check: check,
    // Call after writing aaup_wordlistExtra so the next check uses it.
    reload: reload,
    // Exposed for the test page and for anything else that needs the same
    // normalization (search, for one) rather than writing its own.
    normalize: normalize,
    size: function(){ var p = patterns(); return p.always.length + p.contextual.length; },
    tiers: function(){ var p = patterns(); return { always: p.always.length, contextual: p.contextual.length }; }
  };
})();
