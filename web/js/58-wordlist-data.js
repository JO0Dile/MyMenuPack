// ==========================
// WORD LIST — the data the filter works from, kept out of the filter itself.
//
// Two reasons this is its own file:
//
// 1. You can replace it. Drop in a bigger list downloaded from anywhere,
//    keep the shape below, and the filter picks it up with no code change.
//    tools/import-wordlist.py merges a plain "one word per line" file into
//    this one and puts each word in the right tier.
// 2. The filter can be read without scrolling past four hundred slurs.
//
// THE TWO TIERS, AND WHY IT IS NOT ONE LIST
//
// ALWAYS: words that are an insult in every sentence anyone will ever write
// in this app. No context saves them, so none is looked for.
//
// CONTEXTUAL: words that are only an insult when aimed at a person. "حمار"
// in "يا حمار" is abuse; in "درسنا عن الحمير" it is a farm animal in a
// biology sentence. A flat list cannot tell those apart and blocking both
// makes the app stupid in a way students notice immediately. These are the
// words the context rules in js/58-wordfilter.js are for.
//
// MARKERS: the evidence those rules weigh. Aiming a word at someone leaves
// traces in both languages — a vocative, a second-person pronoun, a
// possessive ending, "you are a". Talking ABOUT something leaves different
// ones — "about", "we studied", "species", "I have a".
// ==========================
(function(){
  'use strict';

  window.AAUP_WORDLIST = {
    version: 1,

    // ---- always blocked ---------------------------------------------------
    always: {
      en: [
        'nigger', 'nigga', 'niger', 'nigg', 'faggot', 'fag', 'retard', 'retarded',
        'tranny', 'kike', 'spic', 'chink', 'coon', 'wetback', 'paki', 'gook',
        'fuck', 'fucking', 'fucker', 'motherfucker', 'shit', 'bullshit', 'bitch',
        'bastard', 'asshole', 'arsehole', 'dick', 'cock', 'prick', 'pussy',
        'cunt', 'whore', 'slut', 'wanker', 'twat', 'douche', 'jackass',
        'dumbass', 'dickhead', 'shithead', 'bollocks',
        // Hebrew and Arabizi abuse typed in Latin letters
        'sharmuta', 'sharmoota', 'sharmoot', 'sharmout', 'manyak', 'manyook',
        'manyouk', 'kusit', 'zona', 'ars'
      ],
      ar: [
        'شرموط', 'شرموطه', 'شرموتا', 'قحبه', 'عاهره', 'زانيه', 'منيوك', 'منيك',
        'خول', 'لوطي', 'كسم', 'كسمك', 'طيز', 'طيزك', 'خرا', 'خره',
        'زبي', 'معرص', 'ابن الحرام', 'يلعن', 'انعل'
      ]
    },

    // ---- blocked only when aimed at a person ------------------------------
    contextual: {
      en: [
        'ass', 'arse', 'piss', 'crap', 'idiot', 'stupid', 'dumb', 'moron',
        'loser', 'trash', 'garbage', 'filthy', 'dirty',
        'donkey', 'pig', 'dog', 'monkey', 'swine', 'mule', 'cow', 'rat', 'snake',
        'kelev', 'kelef', 'kalb', 'kelb', 'hmar', '7mar', 'himar', 'jahsh',
        'khanzeer', 'khanzir', 'kus', 'kess', 'teez', 'tiz', 'zbala'
      ],
      ar: [
        'حمار', 'حماره', 'حمير', 'جحش', 'جحشه', 'حيمار', 'كلب', 'كلبه', 'كلاب',
        'خنزير', 'خنزيره', 'خنازير', 'بسه', 'قطه', 'بقره', 'بغل', 'تيس', 'ثور',
        'قرد', 'قروده', 'مونكي', 'حيه', 'فار', 'صرصار',
        'وسخ', 'وسخه', 'قذر', 'قذره', 'نجس', 'زفت', 'زباله',
        'غبي', 'غبيه', 'اغبياء', 'تافه', 'حقير', 'حقيره', 'واطي', 'وطي',
        'صايع', 'مجنون', 'معتوه', 'ابله', 'خرع', 'فاشل', 'فاشله',
        'كيليف', 'كيلف', 'مانياك'
      ]
    },

    // ---- comparative insults, blocked on sight ----------------------------
    //
    // "درسنا عن الحمير بس أحمر من هيك دكتور ما شفت" — studied donkeys, but
    // never saw a bigger donkey than this professor. The topical half is
    // real, which is the point: the sentence is built to look like the
    // innocent one. What gives it away is the comparative — أفعل + من — and
    // that shape is not something anyone writes by accident in a sentence
    // about biology.
    //
    // Listed as phrases, not words, because the elative on its own is
    // innocent: "أحمر" is also the colour red, and blocking it would reject
    // every sentence about a red pen.
    comparatives: {
      ar: ['احمر من', 'اغبى من', 'اغبا من', 'احقر من', 'اوسخ من', 'اتفه من',
           'اجحش من', 'اكلب من', 'انجس من', 'اقذر من', 'اوطى من', 'افشل من',
           'زي الحمار', 'متل الحمار', 'زي الكلب', 'متل الكلب', 'زي الخنزير',
           'مثل الحمار', 'مثل الكلب', 'اكبر حمار', 'اكبر كلب', 'اكبر غبي'],
      en: ['than a donkey', 'than a pig', 'than a dog', 'than an idiot',
           'bigger idiot', 'biggest idiot', 'bigger donkey', 'biggest donkey',
           'more of an idiot', 'like a donkey', 'like a pig', 'like a dog']
    },

    // ---- the evidence the context rules read ------------------------------
    markers: {
      // "This is aimed at a person." A vocative, a second-person pronoun, a
      // possessive ending, a demonstrative pointing at someone, or the
      // English shapes that only ever introduce an insult.
      // STRONG — someone is being addressed or labelled. Nothing else in the
      // sentence changes what this means.
      targeting: {
        ar: ['يا', 'انت', 'انتي', 'انتو', 'انتم', 'هاد', 'هذا', 'هيك',
             'ابن', 'بنت', 'اخو', 'امك', 'ابوك', 'اختك', 'شكلك', 'بتطلع'],
        en: ['you', 'your', "you're", 'youre', 'ur', 'u'],
        phrases_en: ['what a', 'such a', 'is a', 'are a', 'like a', 'acting like'],
        phrases_ar: ['شو هال', 'كإنه', 'كانه', 'زي ال', 'متل ال', 'بتصرف']
      },
      // WEAK — a person is in the sentence, which makes an insult likely but
      // proves nothing on its own. "الدكتور حمار" is abuse; "الدكتور بحكي عن
      // الحمير" is a biology lecture, and the only difference between them is
      // the topical marker. So a weak marker only decides when there is no
      // topical marker at all — treating these as proof blocked six ordinary
      // sentences out of nine in testing.
      people: {
        ar: ['الدكتور', 'دكتور', 'استاذ', 'الاستاذ', 'مدرس', 'المدرس', 'المعلم',
             'الطالب', 'زميل', 'رئيس', 'المدير', 'مدير'],
        en: ['doctor', 'dr', 'professor', 'prof', 'teacher', 'lecturer',
             'instructor', 'student', 'guy', 'dude', 'people', 'he', 'she',
             'they', 'him', 'her', 'them']
      },
      // "This is about the thing itself." Study, description, ownership of a
      // pet, an animal in a list of animals.
      topical: {
        ar: ['عن', 'حول', 'درسنا', 'ندرس', 'دراسه', 'بحث', 'مساق', 'محاضره',
             'حيوان', 'حيوانات', 'فصيله', 'ثدييات', 'مزرعه', 'حديقه', 'طبيعه',
             'عندي', 'عندنا', 'ربيت', 'اشتريت', 'شفت', 'صوره', 'فيلم', 'كتاب',
             'لحمه', 'اكل', 'وصفه',
             // ordinary description rather than abuse: someone's pet, an
             // animal in the street, a thing that barks
             'الجيران', 'جاري', 'الشارع', 'البيت', 'بينبح', 'ينبح', 'صوت'],
        en: ['about', 'study', 'studied', 'studying', 'course', 'lecture',
             'chapter', 'animal', 'animals', 'species', 'mammal', 'mammals',
             'farm', 'zoo', 'nature', 'biology', 'my', 'i have', 'we have',
             'bought', 'adopted', 'photo', 'picture', 'movie', 'book', 'recipe',
             'neighbour', 'neighbor', 'street', 'barking', 'barks', 'explained',
             'talked', 'covers', 'learn', 'learns']
      }
    }
  };
})();
