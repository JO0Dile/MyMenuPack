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
        // Animals that are actually used as insults. "cow", "rat", "snake" and
        // "mule" came out: a 13,589-string corpus showed them colliding with
        // ordinary sentences far more often than they caught anything, which
        // is a bad trade for a word nobody insults anyone with here.
        'donkey', 'pig', 'dog', 'monkey', 'swine',
        'kelev', 'kelef', 'kalb', 'kelb', 'hmar', '7mar', 'himar', 'jahsh',
        'khanzeer', 'khanzir', 'kus', 'kess', 'teez', 'tiz', 'zbala'
      ],
      ar: [
        'حمار', 'حماره', 'حمير', 'جحش', 'جحشه', 'حيمار', 'كلب', 'كلبه', 'كلاب',
        'خنزير', 'خنزيره', 'خنازير', 'قرد', 'قروده', 'صرصار', 'مونكي',
        // Removed after the corpus run, not on a hunch: قطة، بسة، بقرة، بغل،
        // تيس، ثور، حية، فار are barely used as insults here and collide with
        // ordinary words — "ثورة" (revolution) is "ثور" plus a ة, "لحية"
        // (beard) is "حية" behind the ل clitic, and "قطة" is just a cat.
        // A word that catches nothing and blocks homework does not belong on
        // a list whose whole job is to be trusted.
        'وسخ', 'وسخه', 'قذر', 'قذره', 'نجس', 'زفت', 'زباله',
        'غبي', 'غبيه', 'اغبياء', 'تافه', 'حقير', 'حقيره',
        // واطي came off: normalization folds ئ to ي, which makes it identical
        // to "واطئ" (low, shallow) — a perfectly ordinary word that appeared
        // 15 times in the corpus and nowhere as an insult.
        'صايع', 'معتوه', 'ابله', 'خرع',
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
      // A THING is being criticised, not a person. "هالمساق فاشل" and "the
      // registration system is garbage" are ordinary student speech — blunt,
      // fair, and nobody's abuse. The app exists partly so students can say
      // that, and a filter that eats it would be worse than no filter.
      // Only decides when no person is mentioned; "الدكتور والمساق فاشلين"
      // still goes through the person rules.
      things: {
        ar: ['المساق', 'مساق', 'المحاضره', 'محاضره', 'الامتحان', 'امتحان',
             'النظام', 'نظام', 'التطبيق', 'تطبيق', 'الموقع', 'موقع', 'الجدول',
             'جدول', 'الخطه', 'خطه', 'المشروع', 'مشروع', 'الكتاب', 'كتاب',
             'الواجب', 'واجب', 'القاعه', 'المختبر', 'التسجيل', 'المنهاج',
             'الماده', 'ماده', 'الفصل', 'الترم', 'الدوام', 'الباص', 'الكافتيريا'],
        en: ['course', 'lecture', 'exam', 'midterm', 'final', 'system', 'app',
             'website', 'site', 'schedule', 'plan', 'project', 'book',
             'assignment', 'homework', 'lab', 'room', 'registration',
             'semester', 'term', 'timetable', 'bus', 'cafeteria', 'material']
      },
      // Words that GOVERN what comes after them — a preposition or a verb of
      // study. Only these excuse an animal word sitting next to a person,
      // and only from in front of it. A field name ("الأحياء") is a noun and
      // governs nothing, which is why it is in `topical` below and not here.
      governors: {
        ar: ['عن', 'حول', 'درسنا', 'ندرس', 'يدرس', 'يشرح', 'شرح', 'اوضح',
             'تحدث', 'تحدثت', 'بحث', 'قرأت', 'قريت', 'يتناول', 'تناول', 'بحكي',
             'بيحكي', 'حكى', 'حكينا'],
        en: ['about', 'on', 'studied', 'study', 'studying', 'explained',
             'talked', 'covers', 'covered', 'read', 'discussed']
      },
      // "This is about the thing itself." Study, description, ownership of a
      // pet, an animal in a list of animals.
      topical: {
        ar: ['عن', 'حول', 'درسنا', 'ندرس', 'دراسه', 'بحث', 'مساق', 'محاضره',
             'حيوان', 'حيوانات', 'فصيله', 'ثدييات', 'مزرعه', 'حديقه', 'طبيعه',
             // "شفت" (I saw) came out: too weak to excuse anything, and it
             // let "اغبى من هيك ما شفت" through the comparative rule.
             'عندي', 'عندنا', 'ربيت', 'اشتريت', 'صوره', 'فيلم', 'كتاب',
             'لحمه', 'اكل', 'وصفه',
             // ordinary description rather than abuse: someone's pet, an
             // animal in the street, a thing that barks
             'الجيران', 'جاري', 'الشارع', 'البيت', 'بينبح', 'ينبح', 'صوت',
             // academic register: a sentence built like a textbook is not a
             // sentence built like an insult
             'يتناول', 'تناول', 'الفصل', 'الناحيه', 'ناحيه', 'علميه', 'العلميه',
             'تعد', 'تُعد', 'الموضوعات', 'موضوع', 'دراسه', 'الباحثون', 'مقال',
             'يشرح', 'شرح', 'اوضح', 'مفهوم', 'تطبيقات', 'نظري', 'عملي',
             // an animal in a sentence about animals
             'احياء', 'الاحياء', 'علم', 'العلوم', 'بيطري', 'تجارب', 'مدربه',
             'منزليه', 'حلوب', 'تربيه', 'سلوك', 'انواع', 'نوع'],
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
