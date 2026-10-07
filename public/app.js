import {api,h,toast} from './shared.js';
import {mountVisitor} from './visitor.js';
import {mountEditor} from './editor.js';

const root=document.querySelector('#app');
async function boot(){try{
  if(location.pathname==='/app'){
    const session=await api('/api/auth/me');
    if(session.user)return mountEditor(root,session);
    return authScreen();
  }
  if(location.pathname.startsWith('/e/')){const {project}=await api('/api/public/'+encodeURIComponent(location.pathname.split('/')[2]));return mountVisitor(root,project);}
  const {project}=await api('/api/demo');mountVisitor(root,project,{demo:true});
}catch(error){root.innerHTML=`<main class="empty-page"><span class="eyebrow">ATELIER STORIES</span><h1>이 전시를 아직 만날 수 없어요.</h1><p>${h(error.message)}</p><a class="pill-btn" href="/">샘플 전시 둘러보기 ↗</a></main>`;}}
function authScreen(mode='register'){
  root.innerHTML=`<div class="auth-layout"><section class="auth-art"><a class="brand" href="/">Atelier<span>Stories ✳</span></a><div><span class="eyebrow">YOUR ART HAS A STORY.</span><h1>작품의 세계를,<br>당신의 웹사이트로.</h1><p>전시를 준비하는 작가를 위한 작은 아틀리에.<br>그림 속 사물부터 전시의 첫인상까지, 직접 만들어보세요.</p></div><img src="/assets/characters.png" alt="곰과 토끼 샘플 일러스트"><a class="text-btn" href="/">샘플 전시 먼저 둘러보기 ↗</a></section><section class="auth-form"><span class="eyebrow">WELCOME TO YOUR ATELIER</span><h2>${mode==='register'?'새로운 이야기를 시작해요.':'다시 만나 반가워요.'}</h2><p>작품을 올리고, 이야기를 붙이고, 전시를 공개하세요.</p><form><label>이메일<input type="email" name="email" autocomplete="email" required placeholder="artist@example.com"></label><label>비밀번호<input type="password" name="password" minlength="10" maxlength="200" autocomplete="${mode==='register'?'new-password':'current-password'}" required placeholder="10자 이상 입력하세요"></label><p class="form-error" role="alert"></p><button class="primary-btn" type="submit">${mode==='register'?'내 아틀리에 만들기':'로그인'} ↗</button></form><p class="auth-switch">${mode==='register'?'이미 계정이 있으신가요?':'처음 방문하셨나요?'} <button class="text-btn" data-mode>${mode==='register'?'로그인':'계정 만들기'}</button></p><small>계정과 초안은 이 서버에 저장됩니다. 공개 버튼을 누른 전시만 관람객에게 보입니다.</small></section></div>`;
  root.querySelector('[data-mode]').onclick=()=>authScreen(mode==='register'?'login':'register');
  root.querySelector('form').onsubmit=async event=>{event.preventDefault();const form=event.target,button=form.querySelector('button'),values=Object.fromEntries(new FormData(form));button.disabled=true;button.textContent='준비하고 있어요…';try{const session=await api('/api/auth/'+mode,{method:'POST',body:values});mountEditor(root,session);}catch(error){form.querySelector('.form-error').textContent=error.message;button.disabled=false;button.textContent=mode==='register'?'내 아틀리에 만들기 ↗':'로그인 ↗';}};
}
window.addEventListener('unhandledrejection',event=>{toast(event.reason?.message||'잠시 후 다시 시도해 주세요.');});
boot();
