"""Lossless docx -> ordered JSONL of blocks (paragraphs + tables).

Every <w:p> and <w:tbl> in document order becomes one record, so nothing
is skipped and order is preserved for later verification.
"""
import zipfile, json, sys
from xml.etree import ElementTree as ET

SRC='/root/.claude/uploads/7acd1c29-e67f-55d3-9e3a-07fb3ded50f8/2e2543da-data_600.docx'
W='{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'

z=zipfile.ZipFile(SRC)
root=ET.fromstring(z.read('word/document.xml'))
body=root.find(W+'body')

def para_text(p):
    out=[]
    for node in p.iter():
        tag=node.tag
        if tag==W+'t':
            out.append(node.text or '')
        elif tag==W+'tab':
            out.append('\t')
        elif tag in (W+'br', W+'cr'):
            out.append('\n')
    return ''.join(out)

def cell_text(tc):
    return '\n'.join(para_text(p) for p in tc.findall(W+'p')).strip()

def table_rows(tbl):
    rows=[]
    for tr in tbl.findall(W+'tr'):
        rows.append([cell_text(tc) for tc in tr.findall(W+'tc')])
    return rows

blocks=[]
for child in body:
    if child.tag==W+'p':
        t=para_text(child)
        blocks.append({'i':len(blocks),'kind':'p','text':t})
    elif child.tag==W+'tbl':
        blocks.append({'i':len(blocks),'kind':'table','rows':table_rows(child)})
    elif child.tag==W+'sectPr':
        continue
    else:
        blocks.append({'i':len(blocks),'kind':'other','tag':child.tag.replace(W,'')})

with open('blocks.jsonl','w',encoding='utf-8') as f:
    for b in blocks:
        f.write(json.dumps(b,ensure_ascii=False)+'\n')

kinds={}
for b in blocks: kinds[b['kind']]=kinds.get(b['kind'],0)+1
nonempty=sum(1 for b in blocks if b['kind']=='p' and b['text'].strip())
tblrows=sum(len(b['rows']) for b in blocks if b['kind']=='table')
print('blocks total      :', len(blocks))
print('  by kind         :', kinds)
print('  non-empty paras :', nonempty)
print('  table rows      :', tblrows)
