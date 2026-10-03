"""Export local Tower AudioClips inside the extraction pipeline's offline CPU sandbox.

Mount the pipeline's numerically reassembled assets read-only at /inputs, this
script read-only at /code, and a bounded tmpfs at /out. No APK parsing runs on host.
"""
import argparse
import hashlib
import json
import re
from pathlib import Path
import UnityPy

parser=argparse.ArgumentParser()
parser.add_argument('--input',default='/inputs')
parser.add_argument('--output',default='/out')
parser.add_argument('--match',default='krisu',help='Explicit clip-name expression; no inferred artist attribution')
parser.add_argument('--list',action='store_true')
args=parser.parse_args()
out=Path(args.output);out.mkdir(parents=True,exist_ok=True)
env=UnityPy.load(args.input)
clips=[];written=0
for obj in env.objects:
    if obj.type.name!='AudioClip':continue
    clip=obj.read()
    record={'name':clip.m_Name,'duration':clip.m_Length,'channels':clip.m_Channels,'frequency':clip.m_Frequency,'path_id':obj.path_id}
    clips.append(record)
    if args.list or not re.search(args.match,clip.m_Name,re.I):continue
    record['files']=[]
    for name,data in clip.samples.items():
        safe=re.sub(r'[^a-zA-Z0-9._ -]','_',Path(name).name)
        written+=len(data)
        if written>450*1024*1024:raise RuntimeError('Audio extraction exceeds bounded output budget')
        (out/safe).write_bytes(data)
        record['files'].append({'name':safe,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()})
manifest={'source':'Local Tower extraction pipeline serialized assets','clips':clips,'exported_bytes':written}
(out/'audio-manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
print(json.dumps(manifest),flush=True)
