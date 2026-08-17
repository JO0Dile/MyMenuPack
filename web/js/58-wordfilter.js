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
    // Collapse letter runs: "assssss" -> "ass", "كلللب" -> "كلب". Done after
    // leet mapping so "a55" has already become "ass".
    s = s.replace(/(.)\1{1,}/g, '$1');
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

  // Because runs are collapsed in the haystack, the needles must be too, or
  // "kalb" would never match a haystack that reads "kalb" but a needle that
  // reads "kallb".
  function collapse(word){ return word.replace(/(.)\1{1,}/g, '$1'); }

  // ---- the lists ----------------------------------------------------------
  //
  // Entries are matched as whole words unless listed in ALWAYS. Keeping the
  // strong slurs and the ordinary rude words in one list is deliberate: the
  // rejection message does not vary by severity, so neither does the check.

  var EN = [
    // slurs — these are the ones the feature exists to stop
    'nigger', 'nigga', 'niger', 'nigg', 'faggot', 'fag', 'retard', 'retarded',
    'tranny', 'kike', 'spic', 'chink', 'coon', 'wetback', 'paki', 'gook',
    // crude abuse
    'fuck', 'fucking', 'fucker', 'motherfucker', 'shit', 'bullshit', 'bitch',
    'bastard', 'asshole', 'arsehole', 'ass', 'arse', 'dick', 'cock', 'prick',
    'pussy', 'cunt', 'whore', 'slut', 'wanker', 'twat', 'douche', 'jackass',
    'dumbass', 'dickhead', 'shithead', 'piss', 'crap', 'bollocks',
    // animal insults, which travel between both languages
    'donkey', 'pig', 'dog', 'monkey', 'swine', 'mule', 'cow', 'rat',
    // Hebrew abuse written in Latin letters
    'kelev', 'kelef', 'zona', 'sharmuta', 'sharmoota', 'manyak', 'kus', 'kusit',
    // Arabizi — Arabic insults typed in Latin letters and digits, which is
    // how a lot of this is actually written on a phone keyboard. The digits
    // are already mapped to letters by normalize(), so "7mar" arrives here
    // as "tmar"... which is why the digit spellings are listed too.
    'hmar', '7mar', 'himar', 'jahsh', 'ja7sh', 'kalb', 'kelb', 'chelb',
    'khanzeer', 'khanzir', '5anzeer', 'sharmoot', 'sharmout', 'manyook',
    'manyouk', 'zbala', 'wesikh', 'wisikh', 'ars', 'teez', 'tiz', 'kess'
  ];

  var AR = [
    // animals as insults — the exact list a student named, plus the
    // spellings people actually type
    'حمار', 'حماره', 'حمير', 'جحش', 'جحشه', 'حيمار', 'كلب', 'كلبه', 'كلاب',
    'خنزير', 'خنزيره', 'خنازير', 'بسه', 'قطه', 'بقره', 'بغل', 'تيس', 'ثور',
    'قرد', 'قروده', 'مونكي', 'زفت', 'وسخ', 'وسخه', 'قذر', 'قذره', 'نجس',
    // crude abuse and slurs
    'شرموط', 'شرموطه', 'قحبه', 'عاهره', 'زانيه', 'منيوك', 'منيك', 'خول',
    'لوطي', 'زبي', 'زب', 'كس', 'كسم', 'كسمك', 'طيز', 'طيزك', 'خرا', 'خره',
    'زق', 'يلعن', 'العن', 'لعنه', 'يخرب', 'انعل', 'نعل',
    'غبي', 'غبيه', 'اغبياء', 'تافه', 'حقير', 'حقيره', 'واطي', 'وطي',
    'صايع', 'مجنون', 'معتوه', 'ابله', 'خرع', 'زباله',
    // Hebrew abuse written in Arabic letters — "كيليف" is the one a student
    // pointed out by name
    'كيليف', 'كيلف', 'زونا', 'مانياك', 'شرموتا'
  ];

  // Matched anywhere, not just as whole words: these have no innocent
  // occurrence inside another word in either language.
  var ALWAYS = ['nigger', 'nigga', 'faggot', 'motherfucker', 'cunt', 'sharmuta',
                'شرموط', 'قحبه', 'منيوك', 'كسمك'];

  // Arabic words rarely stand alone: conjunctions, prepositions, the article
  // and the vocative attach to the front; possessives to the back.
  // Levantine speech glues more than Modern Standard Arabic does: "هالحمار"
  // is ها + ال + حمار ("this donkey") and is how anyone here would actually
  // type it, so the demonstrative and the "على" contraction belong here too.
  var AR_PREFIX = '(?:[وفبكل]|ال|وال|بال|كال|فال|لل|يا|ها|هال|وهال|لهال|عال|ع)*';
  var AR_SUFFIX = '(?:ك|كم|كن|ه|ها|هم|هن|ي|نا|ين|ات|ه)*';

  var ALWAYS_SET = Object.create(null);
  ALWAYS.forEach(function(w){ ALWAYS_SET[collapse(normalize(w))] = true; });

  function escapeRe(s){ return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  function buildPatterns(){
    var out = [];
    EN.concat(AR).forEach(function(raw){
      var w = collapse(normalize(raw));
      if(!w) return;
      var body = escapeRe(w);
      var src;
      var OPEN = '(?:^|[^\\p{L}\\p{N}])';   // start of text, or a non-letter
      var CLOSE = '(?:$|[^\\p{L}\\p{N}])';
      if(ALWAYS_SET[w]){
        src = body;                                   // anywhere in the text
      } else if(/[؀-ۿ]/.test(w)){
        // Arabic: allow the clitics, but nothing else may touch the word.
        src = OPEN + AR_PREFIX + body + AR_SUFFIX + CLOSE;
      } else {
        // Latin: plain whole word, with the usual plural/verb endings.
        src = OPEN + body + '(?:s|es|ed|ing|y|ies)?' + CLOSE;
      }
      try{ out.push({ word: raw, re: new RegExp(src, 'u') }); }catch(e){}
    });
    return out;
  }

  var PATTERNS = buildPatterns();

  // ---- the check ----------------------------------------------------------

  // Returns { clean: true } or { clean: false, word: '<the entry that hit>' }.
  // The offending word is returned so the caller can tell the student which
  // one to remove — being vague about it just gets the same post retried.
  function check(text){
    var hay = normalize(text);
    if(!hay) return { clean: true };
    // Collapse runs AGAIN after squeezing: "n i g g e r" has no ADJACENT
    // repeats while the spaces are still in it, so normalize() left the
    // double g alone — and the needles are stored collapsed ("niger"), so
    // without this the padded spelling walked straight through.
    // Three readings of the same sentence: as typed, with padded runs closed
    // up, and with every separator gone. Collapsed again each time, because
    // the needles are stored collapsed and "n i g g e r" only grows its
    // double letter once the spaces are out.
    var variants = [hay, collapse(depad(hay)), collapse(squeeze(hay))];
    for(var i = 0; i < PATTERNS.length; i++){
      var re = PATTERNS[i].re;
      for(var v = 0; v < variants.length; v++){
        if(variants[v] && re.test(variants[v])){
          return { clean: false, word: PATTERNS[i].word };
        }
      }
    }
    return { clean: true };
  }

  window.AAUP_WORDFILTER = {
    check: check,
    // Exposed for the test page and for anything else that needs the same
    // normalization (search, for one) rather than writing its own.
    normalize: normalize,
    size: function(){ return PATTERNS.length; }
  };
})();
