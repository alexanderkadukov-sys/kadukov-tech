(() => {
'use strict';
const $=id=>document.getElementById(id), form=$('form'), login=$('login'), verify=$('verify');
const say=(id,v)=>{$(id).textContent=v;};
if(!window.supabase?.createClient){say('connection','Библиотека подключения не загрузилась. Обновите страницу.');login.hidden=true;return;}
const client=window.supabase.createClient('https://qlggbdzodqagtxqifslg.supabase.co',"sb_publishable_xmpxNkuvDizZoYOl12CJCw_lM-h9kSW",{auth:{persistSession:false,autoRefreshToken:true,detectSessionInUrl:false}});
const PAGE=30, fields=['sku','name','catalog','category','brand','compatibility','description','price_rub','stock_status','published'];
let editing=null,page=0,factorId=null,ready=false,loadEpoch=0,authEpoch=0;
const labels={parts:'Запчасти',electronics:'Электроника'},stocks={unknown:'Уточняется',in_stock:'В наличии',on_order:'Под заказ',out_of_stock:'Нет в наличии'};
const message=e=>e?.code==='23505'?'Такой артикул уже существует.':e?.code==='42501'?'Недостаточно прав. Проверьте роль администратора и MFA.':e?.message||'Ошибка запроса.';
function guard(result){if(result.error)throw result.error;return result.data;}
function node(tag,text,cls){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;}
function button(text,fn){const e=node('button',text);e.type='button';e.addEventListener('click',fn);return e;}
async function busy(event,fn,status){const btn=event.submitter||event.currentTarget;btn.disabled=true;try{await fn();}catch(e){say(status,message(e));}finally{btn.disabled=false;}}
function clearMfa(){factorId=null;$('mfa').hidden=true;$('secretBox').hidden=true;say('secret','');verify.reset();verify.hidden=true;$('enroll').hidden=true;}
function reset(){editing=null;form.reset();say('formTitle','Новый товар');say('formStatus','');}
function locked(){ready=false;++loadEpoch;$('editor').hidden=true;$('products').replaceChildren();reset();$('authPanel').hidden=false;}
async function assess(){
 const epoch=++authEpoch;locked();clearMfa();const session=guard(await client.auth.getSession()).session;if(epoch!==authEpoch)return;
 login.hidden=!!session;$('logoutAuth').hidden=!session;if(!session){say('authStatus','');return;}
 const user=guard(await client.auth.getUser()).user;if(epoch!==authEpoch)return;
 if(user?.app_metadata?.catalog_role!=='admin'){say('authStatus','У этой учётной записи нет роли администратора. Обратитесь к владельцу проекта.');return;}
 const aal=guard(await client.auth.mfa.getAuthenticatorAssuranceLevel());if(epoch!==authEpoch)return;
 if(aal.currentLevel==='aal2'){ready=true;$('editor').hidden=false;$('authPanel').hidden=true;say('authStatus','');page=0;await load();return;}
 $('mfa').hidden=false;
 const factors=guard(await client.auth.mfa.listFactors());if(epoch!==authEpoch)return;
 const existing=factors.totp.find(x=>x.status==='verified');
 if(existing){factorId=existing.id;verify.hidden=false;say('mfaHint','Введите актуальный код из приложения-аутентификатора.');}
 else{$('enroll').hidden=false;say('mfaHint','Для доступа требуется привязать приложение-аутентификатор.');}
}
login.addEventListener('submit',e=>{e.preventDefault();busy(e,async()=>{const data=new FormData(login);const password=data.get('password');login.elements.namedItem('password').value='';guard(await client.auth.signInWithPassword({email:String(data.get('email')).trim(),password}));await assess();},'authStatus');});
$('enroll').addEventListener('click',e=>busy(e,async()=>{const r=guard(await client.auth.mfa.enroll({factorType:'totp',friendlyName:'KADUKOV test admin'}));factorId=r.id;say('secret',r.totp.secret);$('secretBox').hidden=false;$('enroll').hidden=true;verify.hidden=false;say('mfaHint','Добавьте ключ в приложение и введите код.');},'authStatus'));
verify.addEventListener('submit',e=>{e.preventDefault();busy(e,async()=>{if(!factorId)throw Error('Сначала подключите фактор');const code=String(new FormData(verify).get('code'));guard(await client.auth.mfa.challengeAndVerify({factorId,code}));await assess();},'authStatus');});
async function logout(){++authEpoch;locked();clearMfa();login.reset();try{guard(await client.auth.signOut({scope:'local'}));}catch{say('authStatus','Не удалось завершить серверную сессию. Закройте вкладку.');return;}await assess();}
$('logout').addEventListener('click',logout);$('logoutAuth').addEventListener('click',logout);
function edit(x){if(!ready)return;editing=x;for(const k of fields){const el=form.elements.namedItem(k);if(k==='published')el.checked=x[k];else el.value=x[k]??'';}say('formTitle','Редактирование');say('formStatus','');form.scrollIntoView({block:'start'});form.elements.namedItem('name').focus();}
async function load(){
 if(!ready)return;const epoch=++loadEpoch;say('listStatus','Загрузка…');
 try{const rows=guard(await client.from('catalog_products').select('*').order('created_at',{ascending:false}).order('id',{ascending:true}).range(page*PAGE,(page+1)*PAGE));if(!ready||epoch!==loadEpoch)return;
 const list=$('products');list.replaceChildren();for(const x of rows.slice(0,PAGE)){const p=node('article',undefined,'product');p.append(node('p',labels[x.catalog]+' · '+x.category+' · '+x.sku,'meta'),node('h3',x.name),node('p',x.price_rub===null?'По запросу':x.price_rub.toLocaleString('ru-RU')+' ₽','price'),node('p',(x.published?'Публичный':'Черновик')+' · '+stocks[x.stock_status],'pill'));if(x.compatibility)p.append(node('p',x.compatibility,'meta'));p.append(button('Изменить',()=>edit(x)));list.append(p);}
 if(!rows.length)list.append(node('p','Нет товаров на этой странице.','empty'));
 $('prev').disabled=page===0;$('next').disabled=rows.length<=PAGE;say('listStatus','Страница '+(page+1)+' · '+Math.min(rows.length,PAGE)+' позиций');
 }catch(e){if(epoch===loadEpoch)say('listStatus',message(e));}
}
$('reload').addEventListener('click',load);$('prev').addEventListener('click',()=>{if(page>0){page--;load();}});$('next').addEventListener('click',()=>{page++;load();});$('cancel').addEventListener('click',reset);
form.addEventListener('submit',e=>{e.preventDefault();if(!ready)return;busy(e,async()=>{const fd=new FormData(form),data={};for(const k of fields){if(k==='published')data[k]=form.elements.namedItem(k).checked;else if(k==='price_rub')data[k]=fd.get(k)===''?null:Number(fd.get(k));else data[k]=String(fd.get(k)||'').trim();}
 if(!data.name||!data.sku||!data.category)throw Error('Заполните название, артикул и категорию');if(data.price_rub!==null&&(!Number.isInteger(data.price_rub)||data.price_rub<0||data.price_rub>100000000))throw Error('Некорректная цена');
 let result;if(editing)result=await client.from('catalog_products').update(data).eq('id',editing.id).eq('updated_at',editing.updated_at).select('id');else result=await client.from('catalog_products').insert(data).select('id');
 const rows=guard(result);if(rows.length!==1)throw Error('Запись не изменена: проверьте права или обновите данные после параллельного изменения.');reset();say('formStatus','Сохранено в Supabase.');await load();
 },'formStatus');});
client.auth.onAuthStateChange((event)=>{if(event==='SIGNED_OUT'){locked();clearMfa();login.hidden=false;$('logoutAuth').hidden=true;}});
(async()=>{try{guard(await client.from('catalog_products').select('id').limit(1));say('connection','Подключение к каталогу установлено. Публичное чтение доступно.');}catch(e){say('connection','Проверка API не пройдена: '+message(e));}})();
})();