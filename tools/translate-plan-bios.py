#!/usr/bin/env python3
"""Fill in the Arabic side of every plan's bio in web/plans.json.

Sixty-four of the seventy-seven plans had an empty `bio.ar`, so the blurb
under a plan's name on its card and header was English on an otherwise
Arabic screen.

A bio has up to three parts, and each is handled differently:

1. A leading description of the programme. These are the app's own prose,
   not the catalogue's, so they are translated by hand in LEADS below.
2. An hours breakdown — "127 CH — Univ. Req. 14 · Univ. Elec. 8 · …".
   Every token in it is a bucket name or a number, so it is rewritten by
   rule. If a token is not recognised the whole bio is skipped rather
   than half-translated.
3. A boilerplate note about where the semester order came from. Ten
   distinct ones, all in NOTES.

The Arabic is a translation of the English blurb, which itself paraphrases
the catalogue; it is not the university's own Arabic description.
"""
import json
import re
import sys

MARKERS = [
    'Semester order is a suggested prerequisite-valid sequence',
    'Year-by-year layout is the university’s published Advisory Plan',
    '\U0001f6a7 The department has not published an academic plan',
]

LEADS = {
 'aaup-ai-digital-media': 'يدمج الذكاء الاصطناعي (تعلّم الآلة والرؤية الحاسوبية ومعالجة اللغات الطبيعية) مع الإعلام الرقمي — التصميم الجرافيكي والسرد القصصي الرقمي وإنتاج الوسائط المتعددة — لبناء أنظمة توصية ذكية ومحتوى إعلامي تفاعلي وتحليلات لأنماط الاستهلاك.',
 'aaup-ai-education-tech': 'برنامج بيني يمزج الذكاء الاصطناعي (تعلّم الآلة ومعالجة اللغات الطبيعية وتحليل البيانات) بالنظرية التربوية والتصميم التعليمي، ويؤهل معلمين وتقنيين قادرين على توظيف الذكاء الاصطناعي لتحسين تجارب التعلم والبيئات التعليمية الرقمية.',
 'aaup-ai-fintech': 'يزوّد الطلبة بمهارات الذكاء الاصطناعي وتعلّم الآلة مطبَّقة على الأسواق المالية الحديثة — البلوك تشين والمدفوعات الرقمية والتداول الخوارزمي — لقطاع التكنولوجيا المالية. متطلبات الجامعة 14 + اختياري الجامعة 8 + متطلبات الكلية 47 + متطلبات التخصص 42 + اختياري التخصص 6 (اختر 2 من 5 مساقات) + مساقات حرة 6 = 123 ساعة، أي ساعتان فوق المجموع المعلن للبرنامج نفسه وهو 121 ساعة — تعارض صغير في المصدر تعذّر حسمه مما هو متاح، وقد أُشير إليه هنا بدل إسقاطه بصمت. لم يُنشر ترتيب فصلي رسمي؛ التوزيع المعروض تسلسل مقترح صحيح من حيث المتطلبات السابقة — تأكد من الأمرين مع مرشدك الأكاديمي.',
 'aaup-ai-public-relations': 'يطبّق تطورات الذكاء الاصطناعي (تعلّم الآلة ومعالجة اللغات الطبيعية وتحليل البيانات) على العلاقات العامة — بناء استراتيجيات فعّالة وإدارة العلاقات مع وسائل الإعلام ومخاطبة الجمهور برؤى مدعومة بالذكاء الاصطناعي.',
 'aaup-accounting': 'رسالة قسم المحاسبة تزويد الطلبة بمعرفة المبادئ والنظريات الأساسية في المحاسبة، وتمكينهم من أحدث ما وصلت إليه المحاسبة…',
 'aaup-dip-ambulance-and-emergency': 'دبلوم الإسعاف والطوارئ برنامج مهني تطبيقي يهدف إلى إعداد كوادر مؤهلة (انظر الكتلة 17 في المصدر للنص الكامل).',
 'aaup-arabic-language-and-media': 'أُنشئ قسم اللغة العربية والإعلام عام 2008م وفق رؤية جديدة تجمع اللغة العربية والإعلام في إطار برنامج واحد، وفقًا…',
 'aaup-ai-innovation': 'يجمع أساسًا متينًا في علم الحاسوب مع تخصص في الذكاء الاصطناعي وتعلّم الآلة والتحول الرقمي، مع التركيز على الجانب الاستراتيجي والأخلاقي لتطبيق الذكاء الاصطناعي في المؤسسات الفعلية.',
 'aaup-cybersecurity-engineering': 'برنامج هندسة الأمن السيبراني في الجامعة العربية الأمريكية في فلسطين وثيق الصلة ببرنامج هندسة الحاسوب، ويدمج المفاهيم الأساسية والمتقدمة من…',
 'aaup-data-science-ml': 'برنامج بيني في علم البيانات والذكاء الاصطناعي وتعلّم الآلة، يجمع الرياضيات والإحصاء وعلم الحاسوب وخوارزميات تعلّم الآلة — ويغطي المعالجة الأولية للبيانات وتصويرها والاستدلال الإحصائي والنمذجة التنبؤية وأدوات مثل TensorFlow وPyTorch.',
 'aaup-dip-dental-technology': 'دبلوم تكنولوجيا وصناعة الأسنان برنامج أكاديمي متخصص صُمّم لتأهيل مهنيين مهرة في تصنيع التعويضات السنية وصيانتها.',
 'aaup-dip-education-for-upper-basic-level-teaching-arabic': '',
 'aaup-english-language': 'يتلقى جميع الطلبة تدريبًا في علم اللغة والأدب والإنجليزية كتابةً ومحادثةً لتطوير مهاراتهم وتوسيع معرفتهم بالعالم الناطق بالإنجليزية. وللحصول على…',
 'aaup-environmental-sciences-and-technology': 'مواكبةً لتطوير البرامج الأكاديمية واستحداث برامج جديدة، افتتحت كلية العلوم الطبية المساندة قسم الصحة العامة والبيئية بما ينسجم مع…',
 'aaup-finance-data-science': 'يطبّق علم البيانات وتعلّم الآلة على التمويل الحديث — إدارة بيانات العملاء وكشف الاحتيال وتحليلات المخاطر والتداول الخوارزمي.',
 'aaup-financial-engineering': 'يستخدم أساليب الرياضيات وهندسة الحاسوب لحل المشكلات المالية وابتكار منتجات مالية وأدوات تداول جديدة، لصالح البنوك وبيوت الاستثمار وشركات التأمين وصناديق التحوط.',
 'aaup-hearing-and-speech-speech-language-and-hearing-d': 'يسهم برنامج البكالوريوس في اضطرابات النطق واللغة والسمع في إعداد أخصائيين قادرين على مساعدة الأشخاص من كل الأعمار ممن يعانون من اضطرابات تطورية…',
 'aaup-interior-architecture': 'العمارة الداخلية تخصص متعدد الجوانب يهدف إلى دراسة البيئة الداخلية وتحليلها، مع مراعاة العناصر المادية وغير المادية من أجل…',
 'aaup-land-and-property-management': 'قطاع الأراضي والعقارات من القطاعات الحيوية في فلسطين، وقد شهدت السنوات الأخيرة إقبالًا ملحوظًا من المستثمرين ورجال الأعمال على شراء الأراضي و…',
 'aaup-languages': 'تتزايد فوائد تعلّم اللغات الأجنبية مع ازدياد عولمة العالم وانتشار ثنائية اللغة.',
 'aaup-management-environmental-management-and-recyclin': 'تسعى الإدارة البيئية إلى تحديد العوامل صاحبة المصلحة في التعارض الذي قد ينشأ بين تلبية الاحتياجات وحماية البيئة. والتحديات البيئية…',
 'aaup-medical-equipment-engineering': 'هندسة الأجهزة الطبية برنامج بيني يجمع علم الأحياء والنظرية الطبية مع تدريب متخصص في الهندسة الكهربائية والفيزياء والمواد والميكانيكا…',
 'aaup-medical-laboratory-sciences': 'نظرًا لحاجة المجتمع الملحّة إلى خريجين متخصصين في الفحوصات الطبية والمخبرية.',
 'aaup-modern-media-digital-media': 'يقوم «برنامج الإعلام الرقمي» في كلية الإعلام الحديث على منهاج جديد في حقل إعلامي تكنولوجي دائم التجدد، يمكّن الطلبة من اكتساب المعرفة النظرية…',
 'aaup-modern-media-digital-media-and-communication': 'يسهم برنامج «الإعلام الرقمي والاتصال» الذي افتتحته الجامعة العربية الأمريكية في حل مشكلة كبيرة في فلسطين والعالم العربي لارتباطه باستخدام…',
 'aaup-occupational-therapy': 'العلاج الوظيفي أحد مهن العلوم الطبية المساندة، ويركّز على تحسين الوضع الصحي ونمط حياة الأفراد من خلال أنشطة وبرامج محددة.',
 'aaup-res-prosthodontics': 'برنامج تخصص مدته ثلاث سنوات.',
 'aaup-public-safety-engineering': 'يؤهل بكالوريوس هندسة السلامة العامة مهندسين لحماية الناس والمجتمعات من المخاطر الصناعية والإنشائية والبيئية والصحية. و…',
 'aaup-statistics-data-science': 'برنامج مشترك مع الجهاز المركزي للإحصاء الفلسطيني، يُعدّ إحصائيين بمهارات عملية في الإحصاء وتحليل البيانات للمؤسسات الحكومية والخاصة — وهو الأول من نوعه في الضفة الغربية.',
 'aaup-telecommunications-engineering': 'يقدّم هذا القسم برنامج بكالوريوس في هندسة الاتصالات، يركّز على الدراسات النظرية والعملية التي تنمّي قدرة الطلبة على تقديم حلول هندسية…',
 'aaup-virtual-reality': 'يغطي الواقع الافتراضي والواقع المعزز والواقع المختلط — الأجهزة التقنية المستخدمة لإنشاء بيئات تفاعلية، إضافة إلى تصميم واجهة المستخدم وتجربته والنمذجة والتحريك ثلاثي الأبعاد وتطبيق أساليب الذكاء الاصطناعي وتعلّم الآلة داخلها.',
}

NOTES = {
 'Semester order is a suggested prerequisite-valid sequence — no official one was published. Courses, hours and prerequisites are as published.':
   'ترتيب الفصول تسلسل مقترح صحيح من حيث المتطلبات السابقة — لم يُنشر ترتيب رسمي. المساقات والساعات والمتطلبات السابقة كما هي منشورة.',
 'Year-by-year layout is the university’s published Advisory Plan.':
   'التوزيع السنوي هو الخطة الإرشادية المنشورة من الجامعة.',
 '\U0001f6a7 The department has not published an academic plan for this program yet.':
   '\U0001f6a7 لم ينشر القسم خطة دراسية لهذا البرنامج بعد.',
 'Note: the published document does not agree with itself here.':
   'ملاحظة: الوثيقة المنشورة تتعارض مع نفسها هنا.',
 'Note: the published plan is cut off in the source; these are every course it lists.':
   'ملاحظة: الخطة المنشورة مقطوعة في المصدر؛ هذه كل المساقات التي أوردتها.',
 'Note: 6 prerequisite pairs point at each other in the source; they are treated as co-requisites.':
   'ملاحظة: 6 أزواج من المتطلبات السابقة يشير كل منها إلى الآخر في المصدر؛ عوملت كمتطلبات متزامنة.',
 'Note: 5 prerequisite pairs point at each other in the source; they are treated as co-requisites.':
   'ملاحظة: 5 أزواج من المتطلبات السابقة يشير كل منها إلى الآخر في المصدر؛ عوملت كمتطلبات متزامنة.',
 'Note: the published Advisory Plan schedules 1 course before one of its own prerequisites; shown as published.':
   'ملاحظة: الخطة الإرشادية المنشورة تضع مساقًا واحدًا قبل أحد متطلباته السابقة؛ معروض كما نُشر.',
 'Note: the published Advisory Plan schedules 2 courses before one of its own prerequisites; shown as published.':
   'ملاحظة: الخطة الإرشادية المنشورة تضع مساقين قبل أحد متطلباتهما السابقة؛ معروض كما نُشر.',
}

BUCKETS = {
 'Univ. Req.': 'متطلبات الجامعة', 'Univ. Elec.': 'اختياري الجامعة',
 'Colg. Req.': 'متطلبات الكلية', 'Colg. Elec.': 'اختياري الكلية',
 'Spec. Req.': 'متطلبات التخصص', 'Spec. Elec.': 'اختياري التخصص',
 'Free Elec.': 'مساقات حرة', 'Support': 'مساقات مساندة',
}

HOURS_LINE = re.compile(r'^(\d+(?:\.\d+)?) CH — (.+?)\.?$')


def hours_ar(chunk):
    """'127 CH — Univ. Req. 14 · Free Elec. 6' -> Arabic, or None."""
    m = HOURS_LINE.match(chunk.strip())
    if not m:
        return None
    parts = []
    for piece in m.group(2).split('·'):
        piece = piece.strip()
        for en, ar in BUCKETS.items():
            if piece.startswith(en):
                parts.append(ar + ' ' + piece[len(en):].strip())
                break
        else:
            return None
    return m.group(1) + ' ساعة — ' + ' · '.join(parts) + '.'


def split_notes(tail):
    """Split a boilerplate tail into its sentences, keeping 'Note:' whole."""
    out = []
    rest = tail.strip()
    while rest:
        idx = rest.find('Note:', 1)
        if idx < 0:
            out.append(rest.strip())
            break
        out.append(rest[:idx].strip())
        rest = rest[idx:]
    return [x for x in out if x]


def translate(pid, en):
    cut = len(en)
    for marker in MARKERS:
        i = en.find(marker)
        if i >= 0:
            cut = min(cut, i)
    head, tail = en[:cut].strip(), en[cut:].strip()

    # The head is a lead sentence, an hours line, or both.
    hm = re.search(r'\d+(?:\.\d+)?\s*CH — ', head)
    if hm:
        lead_en, hours_en = head[:hm.start()].strip(), head[hm.start():].strip()
    else:
        lead_en, hours_en = head, ''

    pieces = []
    if lead_en:
        if pid not in LEADS:
            return None, 'no hand translation for the lead sentence'
        if LEADS[pid]:
            pieces.append(LEADS[pid])
    if hours_en:
        h = hours_ar(hours_en)
        if h is None:
            return None, 'unrecognised hours breakdown: ' + hours_en[:60]
        pieces.append(h)
    for note in split_notes(tail):
        if note not in NOTES:
            return None, 'unknown note: ' + note[:60]
        pieces.append(NOTES[note])
    return ' '.join(pieces).strip(), None


def main():
    path = 'web/plans.json'
    doc = json.load(open(path, encoding='utf-8'))
    done = skipped = 0
    problems = []
    for plan in doc['plans']:
        bio = plan.setdefault('bio', {})
        if (bio.get('ar') or '').strip() or not (bio.get('en') or '').strip():
            skipped += 1
            continue
        ar, why = translate(plan['id'], bio['en'])
        if ar is None:
            problems.append((plan['id'], why))
            continue
        bio['ar'] = ar
        done += 1
    if problems:
        print('COULD NOT TRANSLATE:', file=sys.stderr)
        for pid, why in problems:
            print('  ', pid, '|', why, file=sys.stderr)
        return 1
    with open(path, 'w', encoding='utf-8') as fh:
        json.dump(doc, fh, ensure_ascii=False, separators=(',', ':'))
    print('translated %d bios; %d already had Arabic or had no English' % (done, skipped))
    return 0


if __name__ == '__main__':
    sys.exit(main())
