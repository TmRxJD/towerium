import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {createWriteStream} from 'node:fs';

// Laya's documented stdio protocol keeps local Kev entirely off the network.
export function openKev(executable,model,log) {
  const startupTimeoutMs=Number(process.env.TOWERIUM_KEV_STARTUP_TIMEOUT_MS||180000);
  if(!Number.isFinite(startupTimeoutMs)||startupTimeoutMs<=0||startupTimeoutMs>600000)throw new Error('TOWERIUM_KEV_STARTUP_TIMEOUT_MS must be between 1 and 600000');
  // Avoid repeated graph capture for dynamic gameplay shapes. This is not a
  // claimed fix for the separately observed long-lived daemon termination.
  const runtime={transport:'stdio',device:'auto',threads:4,cudaGraphs:false,startupTimeoutMs};
  const errors=createWriteStream(log);errors.write(`[towerium] runtime ${JSON.stringify(runtime)}; GGML_CUDA_DISABLE_GRAPHS=1\n`);
  const pending=new Map();let counter=0,closed=false;
  let child,exited,generation=0,readyPromise,resolveReady,rejectReady,readyBuffer='';
  const cleanup=()=>{if(child&&child.exitCode===null&&child.signalCode===null)child.kill();};
  process.once('exit',cleanup);
  const rejectAll=error=>{for(const item of pending.values()){clearTimeout(item.timer);item.reject(error);}pending.clear();};
  function start() {
    child=spawn(executable,['daemon',model,'--device','auto','--threads','4'],{shell:false,windowsHide:true,stdio:['pipe','pipe','pipe'],env:{...process.env,GGML_CUDA_DISABLE_GRAPHS:'1'}});
    generation++;closed=false;errors.write(`[towerium] daemon generation=${generation} pid=${child.pid}\n`);
    readyBuffer='';readyPromise=new Promise((resolve,reject)=>{resolveReady=resolve;rejectReady=reject;});
    readyPromise.catch(()=>{});
    child.stderr.on('data',chunk=>{readyBuffer=(readyBuffer+chunk.toString()).slice(-512);if(readyBuffer.includes('[laya] ready'))resolveReady();});
    exited=new Promise(resolve=>child.once('close',resolve));
    child.on('error',error=>{closed=true;rejectReady(error);rejectAll(error);});
    child.stdin.on('error',rejectAll);
    child.on('exit',(code,signal)=>{closed=true;const error=new Error(`Kev daemon exited: code=${code} signal=${signal}; see ${log}`);rejectReady(error);rejectAll(error);});
    child.stderr.pipe(errors,{end:false});
    createInterface({input:child.stdout}).on('line',line=>{
    let data;try{data=JSON.parse(line);}catch{return;}
    const item=pending.get(String(data.id));if(!item)return;
    pending.delete(String(data.id));clearTimeout(item.timer);
    if(data.error||data.ok===false)item.reject(new Error(`Kev daemon: ${JSON.stringify(data.error||data)}`));
    else item.resolve(data.result??data);
    });
  }
  async function stop() {
    if(child.exitCode===null&&child.signalCode===null){child.stdin.end();child.kill();}
    await exited;
  }
  start();
  return {
    runtime,
    async restart(){if(pending.size)throw new Error('Cannot restart Kev with a pending decision');await stop();start();return {generation};},
    async request(body){
      let startupTimer;
      try { await Promise.race([readyPromise,new Promise((_,reject)=>{startupTimer=setTimeout(()=>reject(new Error(`Kev daemon startup timed out after ${startupTimeoutMs}ms; see ${log}`)),startupTimeoutMs);})]); }
      finally { clearTimeout(startupTimer); }
      return new Promise((resolve,reject)=>{
      if(closed){reject(new Error('Kev daemon is closed'));return;}
      const id=String(++counter),timer=setTimeout(()=>{pending.delete(id);reject(new Error(`Kev daemon timed out; see ${log}`));child.kill();},60000);
      pending.set(id,{resolve,reject,timer});child.stdin.write(JSON.stringify({...body,id})+'\n');
    });},
    async close(){closed=true;await stop();process.removeListener('exit',cleanup);errors.end();},
  };
}
