// Released configurations are identified exactly; gameplay resumes under current rules.
const releasedHashes=new Set(['041c19ffba1e51ff7c7ed8b7a0f63b2cb89fa8ed9f3b2bcef11c52dc28c81519','971ceb021e03d8ac4bb4fa64c44c10835e74d1ffd0a0fc19a06f62ca547303a1']);
export async function createSaveCompatibility(current:string,keys:readonly string[]) {
  const accepted=new Set([current]);
  const candidates=new Set<string>();
  for(const key of keys) {
    try {
      const config=JSON.parse(localStorage.getItem(key)??'null')?.config;
      if(typeof config==='string'&&config.length<=250_000&&config!==current)candidates.add(config);
    }catch{/* Each save loader handles invalid or unavailable storage. */}
  }
  await Promise.all([...candidates].map(async config=>{
    const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(config));
    const hash=[...new Uint8Array(bytes)].map(byte=>byte.toString(16).padStart(2,'0')).join('');
    if(releasedHashes.has(hash))accepted.add(config);
  }));
  return (config:unknown)=>typeof config==='string'&&accepted.has(config);
}
