import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { AppError } from './validation.js';

export function imageWorker(pythonBin='python3') {
  const child=spawn(pythonBin,[fileURLToPath(new URL('../workers/image_tools.py',import.meta.url))],{stdio:['pipe','pipe','pipe'],env:{...process.env,PYTHONUNBUFFERED:'1'}});
  const waiting=new Map(); let next=0, dead=false, stderr='';
  child.stderr.on('data',chunk=>{stderr=(stderr+chunk.toString()).slice(-3000);});
  createInterface({input:child.stdout}).on('line',line=>{
    let data; try{data=JSON.parse(line);}catch{return;}
    const job=waiting.get(data.id); if(!job)return; waiting.delete(data.id); clearTimeout(job.timer);
    if(data.error)job.reject(new AppError(422,data.error));else job.resolve(data.result);
  });
  function fail(){dead=true;for(const job of waiting.values()){clearTimeout(job.timer);job.reject(new AppError(503,'이미지 처리 환경을 확인해 주세요. Python 패키지 설정은 README에 안내되어 있습니다.'));}waiting.clear();}
  child.on('error',fail); child.on('exit',fail);
  return {
    run(payload){
      if(dead)return Promise.reject(new AppError(503,'이미지 처리 기능을 사용할 수 없습니다. Python 패키지를 설치하고 서버를 다시 시작해 주세요.'));
      if(waiting.size>=10)return Promise.reject(new AppError(429,'이미지 처리 요청이 많습니다. 잠시 후 다시 시도해 주세요.'));
      return new Promise((resolve,reject)=>{
        const id=++next; const timer=setTimeout(()=>{waiting.delete(id);reject(new AppError(504,'처리가 오래 걸리고 있습니다. 잠시 후 다시 시도해 주세요.'));},180000);
        waiting.set(id,{resolve,reject,timer});child.stdin.write(JSON.stringify({...payload,id})+'\n');
      });
    },
    close(){child.kill();fail();}
  };
}
