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

const bucket=client.storage.from('catalog-photos');
let photoProduct=null, photoEpoch=0, photoBusy=false, photoListed=false, photoNames=[], previewUrls=[], imageUrls=[];
const SLOTS=['1.jpg','2.jpg','3.jpg','4.jpg','5.jpg'];
function revokeAll(urls){for(const url of urls)URL.revokeObjectURL(url);urls.length=0;}
function clearSelection(){revokeAll(previewUrls);$('photoFiles').value='';$('photoPreview').replaceChildren();}
function photoControls(){const current=!!photoProduct&&ready;const disabled=!current||photoBusy||!photoListed;$('photoFiles').disabled=disabled;$('photoUpload').disabled=disabled||!$('photoFiles').files.length||photoNames.length>=5;$('photoReload').disabled=!current||photoBusy;for(const b of $('photoGrid').querySelectorAll('button'))b.disabled=photoBusy;}
function hidePhotos(){++photoEpoch;photoProduct=null;photoListed=false;photoNames=[];clearSelection();revokeAll(imageUrls);$('photoGrid').replaceChildren();$('photoPanel').hidden=true;say('photoStatus','');photoControls();}
function openPhotos(x){hidePhotos();photoProduct=x.id;$('photoPanel').hidden=false;loadPhotos();}
async function loadPhotos(){
 if(!ready||!photoProduct)return;const product=photoProduct,epoch=++photoEpoch;photoListed=false;photoControls();say('photoStatus','Загрузка фотографий…');
 try{const entries=guard(await bucket.list(product,{limit:10}));if(epoch!==photoEpoch||!ready)return;photoNames=entries.map(x=>x.name).filter(x=>SLOTS.includes(x));photoListed=true;
 const grid=$('photoGrid');revokeAll(imageUrls);grid.replaceChildren();
 for(const name of SLOTS){const tile=node('div',undefined,'photo-tile');tile.append(node('span','Фото '+name[0]+(name===photoNames.slice().sort()[0]?' · главное':'')));
 if(photoNames.includes(name)){const img=node('img');img.alt='Фото товара '+name[0];tile.append(img);const remove=button('Удалить',()=>removePhoto(product,name));tile.append(remove);
 bucket.download(product+'/'+name).then(result=>{if(epoch!==photoEpoch||!ready)return;if(result.error){img.alt='Не удалось загрузить фото';return;}const url=URL.createObjectURL(result.data);imageUrls.push(url);img.src=url;}).catch(()=>{if(epoch===photoEpoch)img.alt='Не удалось загрузить фото';});
 }else tile.append(node('div','Нет фото','photo-empty'));grid.append(tile);}
 say('photoStatus',photoNames.length+' из 5 фотографий');photoControls();
 }catch(e){if(epoch===photoEpoch){say('photoStatus',message(e));photoControls();}}
}
function loadImage(file){return new Promise((resolve,reject)=>{const url=URL.createObjectURL(file),img=new Image();img.onload=()=>{URL.revokeObjectURL(url);resolve(img);};img.onerror=()=>{URL.revokeObjectURL(url);reject(Error('Фотография не читается. Выберите JPEG, PNG или WebP.'));};img.src=url;});}
function jpeg(canvas,q){return new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('Не удалось подготовить фото')),'image/jpeg',q));}
async function compress(file){
 if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>15*1024*1024)throw Error('Допустимы JPEG, PNG и WebP до 15 МБ.');
 const img=await loadImage(file);if(!img.naturalWidth||!img.naturalHeight||img.naturalWidth*img.naturalHeight>50000000)throw Error('Слишком большое разрешение фотографии');
 const scale=Math.min(1,1600/Math.max(img.naturalWidth,img.naturalHeight)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));const ctx=canvas.getContext('2d');if(!ctx)throw Error('Обработка изображения недоступна');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);
 try{for(const quality of [.86,.72,.55]){const b=await jpeg(canvas,quality);if(b.size<=2097152&&b.type==='image/jpeg')return b;}throw Error('Не удалось сжать фото до 2 МБ');}finally{canvas.width=0;canvas.height=0;}
}
$('photoFiles').addEventListener('change',()=>{revokeAll(previewUrls);$('photoPreview').replaceChildren();const files=Array.from($('photoFiles').files);if(files.length>5-photoNames.length||files.some(f=>!['image/jpeg','image/png','image/webp'].includes(f.type)||f.size>15*1024*1024)){clearSelection();say('photoStatus','Выберите не более '+(5-photoNames.length)+' свободных фото JPEG/PNG/WebP до 15 МБ.');photoControls();return;}for(const f of files){const img=node('img');img.alt='Предпросмотр';const url=URL.createObjectURL(f);previewUrls.push(url);img.src=url;$('photoPreview').append(img);}say('photoStatus','Выбрано: '+files.length);photoControls();});
$('photoReload').addEventListener('click',()=>{clearSelection();loadPhotos();});
$('photoUpload').addEventListener('click',async()=>{
 if(!ready||!photoProduct||photoBusy||!photoListed)return;const product=photoProduct,epoch=photoEpoch,files=Array.from($('photoFiles').files),slots=SLOTS.filter(n=>!photoNames.includes(n));if(!files.length||files.length>slots.length)return;
 photoBusy=true;photoControls();let done=0,err='';
 try{for(let i=0;i<files.length;i++){if(!ready||photoProduct!==product||photoEpoch!==epoch)throw Error('Карточка закрыта');say('photoStatus','Подготовка и загрузка '+(i+1)+' из '+files.length);const b=await compress(files[i]);if(!ready||photoProduct!==product||photoEpoch!==epoch)throw Error('Карточка закрыта');guard(await bucket.upload(product+'/'+slots[i],b,{contentType:'image/jpeg',upsert:false,cacheControl:'60'}));done++;}}catch(e){err=message(e);}
 finally{photoBusy=false;if(ready&&photoProduct===product&&epoch===photoEpoch){clearSelection();await loadPhotos();say('photoStatus','Загружено: '+done+' из '+files.length+(err?'. '+err+'. Проверьте список перед повтором.':'. Готово.'));}photoControls();}
});
async function removePhoto(product,name){
 if(!ready||photoProduct!==product||photoBusy||!photoListed||!SLOTS.includes(name)||!confirm('Удалить фото '+name[0]+' из хранилища?'))return;const epoch=photoEpoch;photoBusy=true;photoControls();let error='';
 try{const result=guard(await bucket.remove([product+'/'+name]));if(!result?.length)throw Error('Удаление не подтверждено. Обновите список.');}catch(e){error=message(e);}finally{photoBusy=false;if(ready&&photoProduct===product&&epoch===photoEpoch){await loadPhotos();if(error)say('photoStatus',error);}photoControls();}
}


let importEpoch=0,importPlan=null,importWorker=null,importBusy=false;
const importHeader=['sku','name','catalog','category','brand','compatibility','description','price_rub','stock_status'];
const allowedHeaders=new Set(importHeader);
function clearImport(){++importEpoch;importPlan=null;if(importWorker){importWorker.terminate();importWorker=null;}$('importApply').disabled=true;$('importTable').hidden=true;$('importTable').replaceChildren();say('importCounts','');say('importErrors','');}
function resetImport(){clearImport();$('importFile').value='';$('importUpdate').checked=false;say('importStatus','');}
function readImportFile(file,epoch){return new Promise(async(resolve,reject)=>{try{
 const ext=file.name.toLowerCase().split('.').pop();if(!['csv','xlsx'].includes(ext)||file.size>5*1024*1024||!file.size)throw Error('Нужен непустой CSV/XLSX до 5 МБ');
 const buffer=await file.arrayBuffer();if(epoch!==importEpoch)throw Error('Проверка отменена');
 const w=new Worker('import-worker.js?v=1');importWorker=w;const timer=setTimeout(()=>{w.terminate();if(importWorker===w)importWorker=null;reject(Error('Превышено время разбора файла'));},20000);
 const finish=()=>{clearTimeout(timer);w.terminate();if(importWorker===w)importWorker=null;};
 w.onmessage=e=>{finish();e.data.error?reject(Error(e.data.error)):resolve(e.data.rows);};w.onerror=()=>{finish();reject(Error('Не удалось прочитать файл. Для XLSX требуется доступ к библиотеке SheetJS; попробуйте CSV UTF-8.'));};
 w.postMessage({buffer,ext},[buffer]);
 }catch(e){reject(e);}});}
function normalizeImport(rows){
 const header=rows[0].map(v=>String(v).trim().toLowerCase());if(header.some(v=>!allowedHeaders.has(v))||new Set(header).size!==header.length)throw Error('Неизвестные или повторяющиеся заголовки. Используйте CSV-шаблон.');
 for(const required of ['sku','name','catalog','category','price_rub'])if(!header.includes(required))throw Error('Нет обязательного столбца '+required);
 const data=[],errors=[],seen=new Set();
 for(let i=1;i<rows.length;i++){try{const cells=rows[i];if(cells.length>header.length&&cells.slice(header.length).some(x=>x!==''))throw Error('Лишние столбцы');const x=Object.fromEntries(header.map((k,c)=>[k,cells[c]??'']));if(typeof x.sku!=='string')throw Error('Артикул Excel должен быть текстом (сохранение ведущих нулей)');
 const row={};for(const [k,max] of Object.entries({sku:80,name:160,category:80,brand:80,compatibility:300,description:1500})){if(x[k]!==undefined&&typeof x[k]!=='string')throw Error(k+': ожидается текст');row[k]=(x[k]??'').trim();if(row[k].length>max)throw Error(k+': слишком длинное значение');}
 if(!row.sku||!row.name||!row.category)throw Error('Пустой артикул, название или категория');
 const sku=row.sku.toLowerCase();if(seen.has(sku))throw Error('Повтор артикула '+row.sku);seen.add(sku);
 const c=String(x.catalog).trim().toLowerCase();row.catalog=({electronics:'electronics',parts:'parts','электроника':'electronics','запчасти':'parts'})[c];if(!row.catalog)throw Error('Каталог: electronics или parts');
 const stock=String(x.stock_status||'unknown').trim().toLowerCase();row.stock_status=({unknown:'unknown',in_stock:'in_stock',on_order:'on_order',out_of_stock:'out_of_stock','уточняется':'unknown','в наличии':'in_stock','под заказ':'on_order','нет в наличии':'out_of_stock'})[stock];if(!row.stock_status)throw Error('Неизвестный статус наличия');
 const value=String(x.price_rub??'').trim();row.price_rub=value===''?null:Number(value);if(value!==''&&(!/^\d+$/.test(value)||!Number.isSafeInteger(row.price_rub)||row.price_rub>100000000))throw Error('Цена: целое число от 0 до 100000000 или пусто');
 data.push({row:i+1,data:row});
 }catch(e){errors.push('Строка '+(i+1)+': '+e.message);}}
 return {data,errors};
}
function drawImport(entries){const table=node('table'),thead=node('thead'),head=node('tr');for(const s of ['Строка','Артикул','Название','Действие','Цена, ₽'])head.append(node('th',s));thead.append(head);table.append(thead);const tbody=node('tbody');for(const x of entries){const tr=node('tr');for(const v of [x.row,x.data.sku,x.data.name,x.label,x.priceLabel])tr.append(node('td',String(v)));tbody.append(tr);}table.append(tbody);$('importTable').replaceChildren(table);$('importTable').hidden=false;}
$('importFile').addEventListener('change',()=>{clearImport();say('importStatus','Нажмите «Проверить и показать».');});
$('importUpdate').addEventListener('change',()=>{clearImport();say('importStatus','Настройки изменены. Повторите проверку.');});
$('importClear').addEventListener('click',resetImport);
$('importPreview').addEventListener('click',async()=>{if(!ready||importBusy)return;const file=$('importFile').files[0];clearImport();const epoch=importEpoch;if(!file){say('importStatus','Выберите файл');return;}say('importStatus','Проверка файла…');
 try{const rows=await readImportFile(file,epoch);if(!ready||epoch!==importEpoch)return;const {data,errors}=normalizeImport(rows);if(errors.length){say('importErrors',errors.join('\n'));say('importStatus','Ошибок: '+errors.length+'. Импорт заблокирован; исправьте файл.');return;}
 const matches=guard(await client.rpc('catalog_import_lookup',{p_skus:data.map(x=>x.data.sku.toLowerCase())}));if(!ready||epoch!==importEpoch)return;const bySku=new Map(matches.map(x=>[x.sku.trim().toLowerCase(),x]));const update=$('importUpdate').checked,plan=[],entries=[];let added=0,updated=0,skipped=0;
 for(const x of data){const old=bySku.get(x.data.sku.toLowerCase());let label,priceLabel=x.data.price_rub??'По запросу';if(!old){label='Новый черновик';added++;plan.push({action:'insert',data:x.data});}else if(update&&x.data.price_rub!==null&&old.price_rub!==x.data.price_rub){label='Цена'+(old.published?' (публичная)':'');priceLabel=(old.price_rub??'По запросу')+' → '+x.data.price_rub;updated++;plan.push({action:'price',id:old.id,updated_at:old.updated_at,data:{sku:x.data.sku,price_rub:x.data.price_rub}});}else{label='Пропуск';skipped++;}entries.push({...x,label,priceLabel});}
 drawImport(entries);say('importCounts','Новые: '+added+' · Цены: '+updated+' · Пропуск: '+skipped);say('importStatus',plan.length?'Проверьте список. До подтверждения изменений нет.':'Нет изменений для импорта.');importPlan=plan;$('importApply').disabled=!plan.length;
 }catch(e){if(epoch===importEpoch)say('importStatus',message(e));}});
$('importApply').addEventListener('click',async()=>{if(!ready||importBusy||!importPlan?.length)return;if(!confirm('Записать '+importPlan.length+' изменений одной транзакцией?'))return;const plan=importPlan,epoch=importEpoch;importBusy=true;$('importApply').disabled=true;$('importPreview').disabled=true;$('importClear').disabled=true;$('importFile').disabled=true;$('importUpdate').disabled=true;say('importStatus','Сохранение…');
 try{const result=guard(await client.rpc('catalog_apply_import',{p_rows:plan}));if(epoch===importEpoch&&ready){resetImport();say('importStatus','Импорт завершён. Добавлено: '+result.inserted+', обновлено цен: '+result.updated+'.');page=0;await load();}}
 catch(e){if(epoch===importEpoch){clearImport();say('importStatus','Импорт не подтверждён: '+message(e)+'. Повторите предпросмотр, прежде чем повторять запись.');}}
 finally{importBusy=false;$('importPreview').disabled=false;$('importClear').disabled=false;$('importFile').disabled=false;$('importUpdate').disabled=false;}});

function clearMfa(){factorId=null;$('mfa').hidden=true;$('secretBox').hidden=true;say('secret','');verify.reset();verify.hidden=true;$('enroll').hidden=true;}
function reset(){hidePhotos();editing=null;form.reset();say('formTitle','Новый товар');say('formStatus','');}
function locked(){resetImport();ready=false;++loadEpoch;$('editor').hidden=true;$('products').replaceChildren();reset();$('authPanel').hidden=false;}
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
function edit(x){if(!ready)return;editing=x;openPhotos(x);for(const k of fields){const el=form.elements.namedItem(k);if(k==='published')el.checked=x[k];else el.value=x[k]??'';}say('formTitle','Редактирование');say('formStatus','');form.scrollIntoView({block:'start'});form.elements.namedItem('name').focus();}
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
 const rows=guard(result);if(rows.length!==1)throw Error('Запись не изменена: проверьте права или обновите данные после параллельного изменения.');const savedId=rows[0].id;const saved=guard(await client.from('catalog_products').select('*').eq('id',savedId).single());edit(saved);say('formStatus','Сохранено в Supabase. Можно загрузить фотографии.');await load();
 },'formStatus');});
client.auth.onAuthStateChange((event)=>{if(event==='SIGNED_OUT'){locked();clearMfa();login.hidden=false;$('logoutAuth').hidden=true;}});
(async()=>{try{guard(await client.from('catalog_products').select('id').limit(1));say('connection','Подключение к каталогу установлено. Публичное чтение доступно.');}catch(e){say('connection','Проверка API не пройдена: '+message(e));}})();
})();