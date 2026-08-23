import json, html
cat=json.load(open('catalogue.json'))
SEC=[('univReq','University Requirements'),('univElec','University Electives'),
     ('colgReq','College / Faculty Requirements'),('specReq','Specialization Requirements'),
     ('specElec','Specialization Electives'),('freeElec','Free Electives'),
     ('supportCourses','Support Courses')]
e=html.escape
out=[]
out.append("""<!doctype html><html><head><meta charset="utf-8"><title>AAUP Academic Plans</title>
<style>
@page{size:A4;margin:14mm 12mm;}
*{box-sizing:border-box}
body{font:11px/1.45 "DejaVu Sans",Arial,sans-serif;color:#111;margin:0}
h1{font-size:26px;margin:0 0 4px}
.sub{color:#555;font-size:12px;margin-bottom:18px}
h2.fac{font-size:17px;background:#7a1e2e;color:#fff;padding:7px 10px;margin:22px 0 10px;
  page-break-before:always;page-break-after:avoid}
h2.fac:first-of-type{page-break-before:avoid}
h3.prog{font-size:13.5px;margin:14px 0 3px;padding:5px 8px;background:#f1eae6;
  border-left:4px solid #7a1e2e;page-break-after:avoid}
.meta{font-size:10.5px;color:#444;margin:0 0 7px 8px}
h4{font-size:11.5px;margin:9px 0 3px 8px;color:#7a1e2e;page-break-after:avoid}
table{border-collapse:collapse;width:100%;margin:0 0 8px 8px;page-break-inside:auto}
tr{page-break-inside:avoid}
th{background:#efefef;text-align:left;font-size:9.5px;padding:3px 5px;border:1px solid #ccc}
td{padding:3px 5px;border:1px solid #ddd;font-size:9.5px;vertical-align:top}
td.c{text-align:center;white-space:nowrap}
.code{font-family:"DejaVu Sans Mono",monospace;font-size:9px;white-space:nowrap}
.note{font-size:10px;color:#666;margin:0 0 6px 8px}
</style></head><body>""")
out.append('<h1>AAUP — Academic Plans</h1>')
tot_p=sum(len(f['programs']) for f in cat)
tot_c=sum(len(s['courses']) for f in cat for p in f['programs'] for s in p['requirements'].values())
out.append(f'<div class="sub">Extracted from the university catalogue document · '
           f'{len(cat)} faculties · {tot_p} programs · {tot_c} course entries</div>')
for f in cat:
    out.append(f'<h2 class="fac" id="fac{f["blockIndex"]}">{e(f["faculty"])}</h2>')
    if not f['programs']:
        out.append('<div class="note">No program tables in the source document for this faculty.</div>')
    for p in f['programs']:
        out.append(f'<h3 class="prog" id="p{p["blockIndex"]}">{e(p["name"])}</h3>')
        bits=[]
        if 'degreeHours' in p: bits.append(f'Total: <b>{p["degreeHours"]}</b> credit hours')
        n=sum(len(s['courses']) for s in p['requirements'].values())
        bits.append(f'{n} course entries')
        out.append(f'<div class="meta">{" · ".join(bits)}</div>')
        for key,label in SEC:
            s=p['requirements'].get(key)
            if not s: continue
            req=''
            if s.get('mustPassAll'): req=' — must pass all'
            elif 'requiredHours' in s: req=f' — must pass {s["requiredHours"]} credit hours'
            out.append(f'<h4>{label}{req}</h4>')
            if not s['courses']:
                out.append('<div class="note">(no course table in source)</div>'); continue
            out.append('<table><tr><th>Code</th><th>Course</th><th>Th</th><th>Pr</th>'
                       '<th>Cr</th><th>Prerequisite(s)</th></tr>')
            for c in s['courses']:
                out.append('<tr>'
                    f'<td class="code">{e(c["code"])}</td><td>{e(c["name"])}</td>'
                    f'<td class="c">{c.get("theoretical","")!=""and c.get("theoretical","") or ""}</td>'
                    f'<td class="c">{c.get("practical","") if c.get("practical") is not None else ""}</td>'
                    f'<td class="c"><b>{c.get("credits","") if c.get("credits") is not None else "?"}</b></td>'
                    f'<td class="code">{e(", ".join(c.get("prerequisites",[])))}</td></tr>')
            out.append('</table>')
out.append('</body></html>')
open('plans.html','w',encoding='utf-8').write('\n'.join(out))
print('wrote plans.html', len('\n'.join(out)), 'chars')
