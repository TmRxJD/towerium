"""Compress the sandbox's exported WAVs; verify non-silent decoded audio."""
import hashlib,json,os
from pathlib import Path
import soundfile as sf
source=Path(os.environ.get('TOWER_AUDIO_INPUT','/inputs'));target=Path('/out/music');target.mkdir(exist_ok=True)
tracks=[('MorningDewMain','Morning Dew'),('MyDyingStarMain','My Dying Star'),('OceansSingMain','Oceans Sing'),('HidingInHimalayaMain','Hiding in Himalaya'),('AskaMain','Aska'),('The Ethereal and I Main','The Ethereal and I'),('Forest Bathing Main','Forest Bathing'),('Embrace Oblivion Main','Embrace Oblivion')]
manifest=[]
for clip,title in tracks:
    wav=source/(clip+'.wav');name='krisu-'+title.lower().replace(' ','-')+'.ogg';out=target/name
    energy=0.0;count=0
    with sf.SoundFile(wav) as incoming,sf.SoundFile(out,'w',samplerate=incoming.samplerate,channels=incoming.channels,format='OGG',subtype='VORBIS') as encoded:
        for block in incoming.blocks(blocksize=65536,dtype='float32'):
            encoded.write(block);energy+=float((block.astype('float64')**2).sum());count+=block.size
        duration=incoming.frames/incoming.samplerate
    if count==0 or energy/count<1e-8:raise RuntimeError('Empty or silent track: '+clip)
    manifest.append({'artist':'Krisu','title':title,'clip':clip,'file':name,'duration':duration,'rms':(energy/count)**.5,'bytes':out.stat().st_size,'sha256':hashlib.sha256(out.read_bytes()).hexdigest(),'source_wav_sha256':hashlib.sha256(wav.read_bytes()).hexdigest()})
(target/'manifest.json').write_text(json.dumps({'source':'Tower v29.0.0 local extraction; artist labels verified against serialized-assets.json','tracks':manifest},indent=2))
print(json.dumps({'tracks':len(manifest),'bytes':sum(t['bytes'] for t in manifest)}),flush=True)
