#!/usr/bin/env python3
"""Fill in the Arabic side of every plan's majorName in web/plans.json.

Sixty-four of the seventy-seven plans carried an empty `majorName.ar`, so
the plan picker, Change Major, the plan header and every screen that names
the programme fell back to English however the language switch was set.

The `big` names below are translations of the English programme titles that
were transcribed from the catalogue. They are NOT copied from the
university's Arabic catalogue — that document is not in this repository —
so they are the app's own Arabic wording for each programme and should be
checked against the official Arabic titles before anyone treats them as
authoritative. Where a plan already carried an Arabic name it is left
exactly as it was; this only fills in blanks.

The `small` subtitles are formulaic ("B.Sc. · 127 CH", "Diploma · 72 CH ·
Program 30013"), so they are rewritten by rule rather than by hand — every
piece of them is a degree kind, an hour count or a programme number.
"""
import json
import re
import sys

BIG = {
    'aaup-ai-digital-media': 'الذكاء الاصطناعي والإعلام الرقمي',
    'aaup-ai-education-tech': 'الذكاء الاصطناعي وتكنولوجيا التعليم',
    'aaup-ai-fintech': 'الذكاء الاصطناعي والتكنولوجيا المالية',
    'aaup-ai-public-relations': 'الذكاء الاصطناعي والعلاقات العامة',
    'aaup-accounting': 'المحاسبة',
    'aaup-dip-ambulance-and-emergency': 'الإسعاف والطوارئ',
    'aaup-arabic-language-and-media': 'اللغة العربية والإعلام',
    'aaup-architecture-engineering': 'الهندسة المعمارية',
    'aaup-ai-innovation': 'الذكاء الاصطناعي والابتكار',
    'aaup-basic-elementary-education': 'التعليم الأساسي الابتدائي',
    'aaup-biomedical-sciences': 'العلوم الطبية الحيوية',
    'aaup-business-administration': 'إدارة الأعمال',
    'aaup-civil-engineering': 'الهندسة المدنية',
    'aaup-computer-systems-engineering': 'هندسة أنظمة الحاسوب',
    'aaup-dip-cosmetics-and-skincare': 'التجميل والعناية بالبشرة',
    'aaup-cybersecurity-engineering': 'هندسة الأمن السيبراني',
    'aaup-data-science-ml': 'علم البيانات وتعلّم الآلة',
    'aaup-dip-dental-assistance': 'مساعد طبيب أسنان',
    'aaup-dental-technology': 'تكنولوجيا صناعة الأسنان',
    'aaup-dip-dental-technology': 'تكنولوجيا صناعة الأسنان',
    'aaup-doctor-of-dental-surgery': 'طب وجراحة الأسنان',
    'aaup-doctor-of-medicine': 'الطب البشري',
    'aaup-economy-and-islamic-banking': 'الاقتصاد والمصارف الإسلامية',
    'aaup-dip-education-for-upper-basic-level-teaching-arabic':
        'التعليم للمرحلة الأساسية العليا - تعليم اللغة العربية',
    'aaup-dip-education-for-upper-basic-level-teaching-english':
        'التعليم للمرحلة الأساسية العليا - تعليم اللغة الإنجليزية',
    'aaup-dip-education-for-upper-basic-level-teaching-mathema':
        'التعليم للمرحلة الأساسية العليا - تعليم الرياضيات',
    'aaup-dip-education-for-upper-basic-level-teaching-science':
        'التعليم للمرحلة الأساسية العليا - تعليم العلوم',
    'aaup-electrical-engineering-and-renewable-energy': 'الهندسة الكهربائية والطاقة المتجددة',
    'aaup-english-language': 'اللغة الإنجليزية',
    'aaup-environmental-sciences-and-technology': 'العلوم والتكنولوجيا البيئية',
    'aaup-finance-data-science': 'التمويل وعلم البيانات',
    'aaup-financial-engineering': 'الهندسة المالية',
    'aaup-fiqh-and-law': 'الفقه والقانون',
    'aaup-hearing-and-speech-speech-language-and-hearing-d':
        'السمع والنطق - تخصص اضطرابات النطق واللغة والسمع وعلاجها',
    'aaup-human-resources-management': 'إدارة الموارد البشرية',
    'aaup-industrial-product-design': 'تصميم المنتجات الصناعية',
    'aaup-interior-architecture': 'العمارة الداخلية',
    'aaup-land-and-property-management': 'إدارة الأراضي والعقارات',
    'aaup-languages': 'اللغات',
    'aaup-law': 'القانون',
    'aaup-law-law-in-english': 'القانون - تركيز القانون باللغة الإنجليزية',
    'aaup-management-environmental-management-and-recyclin':
        'الإدارة - تخصص الإدارة البيئية وإعادة التدوير',
    'aaup-mechatronics-engineering': 'هندسة الميكاترونكس',
    'aaup-medical-equipment-engineering': 'هندسة الأجهزة الطبية',
    'aaup-medical-imaging': 'التصوير الطبي',
    'aaup-medical-laboratory-sciences': 'علوم المختبرات الطبية',
    'aaup-dip-mobile-application-development': 'تطوير تطبيقات الهواتف الذكية',
    'aaup-modern-media-digital-media': 'الإعلام الحديث - تخصص الإعلام الرقمي',
    'aaup-modern-media-digital-media-and-communication':
        'الإعلام الحديث - تخصص الإعلام الرقمي والاتصال',
    'aaup-dip-occupational-health-and-safety': 'الصحة والسلامة المهنية',
    'aaup-occupational-therapy': 'العلاج الوظيفي',
    'aaup-operations-management-management-information-sys':
        'إدارة العمليات - تخصص نظم المعلومات الإدارية',
    'aaup-res-orthodontics': 'تقويم الأسنان',
    'aaup-physio-therapy': 'العلاج الطبيعي',
    'aaup-dip-property-valuation': 'تثمين العقارات',
    'aaup-prosthetics-and-orthotics': 'الأطراف والأجهزة التعويضية',
    'aaup-res-prosthodontics': 'استعاضة الأسنان',
    'aaup-public-relations': 'العلاقات العامة',
    'aaup-public-safety-engineering': 'هندسة السلامة العامة',
    'aaup-statistics-data-science': 'الإحصاء وعلم البيانات',
    'aaup-teaching-english': 'تعليم اللغة الإنجليزية',
    'aaup-telecommunications-engineering': 'هندسة الاتصالات',
    'aaup-virtual-reality-arts': 'فنون الواقع الافتراضي',
    'aaup-virtual-reality': 'علوم الواقع الافتراضي',
}

MINORS = {
    'Information Security': 'أمن المعلومات',
    'Computer Information Technology': 'تكنولوجيا معلومات الحاسوب',
}


def small_ar(small):
    """Rewrite a formulaic English subtitle in Arabic, or return '' if the
    shape is not one this understands — better an empty subtitle than a
    half-translated one."""
    s = (small or '').strip()
    if not s:
        return ''
    if s == '🚧 No Academic Plan available yet':
        return '🚧 لا توجد خطة دراسية متاحة بعد'
    if s.startswith('🚧 Study plan coming soon'):
        rest = s[len('🚧 Study plan coming soon'):]
        return '🚧 الخطة الدراسية قريبًا' + _tail(rest)
    out = []
    for part in [p.strip() for p in s.split('·')]:
        t = _part_ar(part)
        if t is None:
            return ''
        out.append(t)
    return ' · '.join(out)


def _tail(rest):
    rest = rest.strip()
    if not rest:
        return ''
    return ' · ' + ' · '.join(_part_ar(p.strip()) or p.strip()
                              for p in rest.lstrip('·').split('·'))


def _part_ar(part):
    if part in ('B.Sc.', 'BSc', 'B.Sc'):
        return 'بكالوريوس'
    if part == 'Diploma':
        return 'دبلوم'
    if part == 'Residency':
        return 'إقامة'
    m = re.fullmatch(r'(\d+(?:\.\d+)?) CH', part)
    if m:
        return m.group(1) + ' ساعة'
    m = re.fullmatch(r'(\d+(?:\.\d+)?) CH \(as stated\)', part)
    if m:
        return m.group(1) + ' ساعة (كما هو مذكور)'
    m = re.fullmatch(r'Program (\S+)', part)
    if m:
        return 'برنامج ' + m.group(1)
    m = re.fullmatch(r'(\d+) years?', part)
    if m:
        return m.group(1) + ' سنوات'
    m = re.fullmatch(r'Minor: (.+)', part)
    if m and m.group(1) in MINORS:
        return 'تخصص فرعي: ' + MINORS[m.group(1)]
    return None


def main():
    path = 'web/plans.json'
    doc = json.load(open(path, encoding='utf-8'))
    filled_big = filled_small = skipped = 0
    unknown = []
    for plan in doc['plans']:
        mn = plan.setdefault('majorName', {})
        en = mn.setdefault('en', {})
        ar = mn.setdefault('ar', {})
        if not (ar.get('big') or '').strip():
            name = BIG.get(plan['id'])
            if name:
                ar['big'] = name
                filled_big += 1
            else:
                unknown.append((plan['id'], en.get('big')))
        else:
            skipped += 1
        if not (ar.get('small') or '').strip():
            t = small_ar(en.get('small'))
            if t:
                ar['small'] = t
                filled_small += 1
    if unknown:
        print('NO ARABIC NAME FOR:', file=sys.stderr)
        for pid, name in unknown:
            print('  ', pid, '|', name, file=sys.stderr)
        return 1
    # web/plans.json ships minified on one line — it is a shipped asset, not
    # a file anyone reads — so write it back the same way. Pretty-printing it
    # would turn a sixty-four-value edit into a sixty-seven-thousand-line diff.
    with open(path, 'w', encoding='utf-8') as fh:
        json.dump(doc, fh, ensure_ascii=False, separators=(',', ':'))
    print('filled %d big names, %d subtitles; %d already had Arabic'
          % (filled_big, filled_small, skipped))
    return 0


if __name__ == '__main__':
    sys.exit(main())
