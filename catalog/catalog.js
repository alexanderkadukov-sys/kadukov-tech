(() => {
'use strict';
const $=id=>document.getElementById(id),container=$('products'), status=$('status');
const say=s=>status.textContent=s;
const node=(tag,value,cls)=>{const el=document.createElement(tag);if(value!==undefined)el.textContent=value;if(cls)el.className=cls;return el;};
const button=(label,fn)=>{const el=node('button',label);el.type='button';el.addEventListener('click',fn);return el;};
if(!window.supabase?.createClient){say('Не удалось подключить каталог. Обновите страницу.');return;}
const client=window.supabase.createClient('https://qlggbdzodqagtxqifslg.supabase.co',"sb_publishable_xmpxNkuvDizZoYOl12CJCw_lM-h9kSW",{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
const bucket=client.storage.from('catalog-photos'), PAGE=12,labels={electronics:'Электроника',parts:'Запчасти'},stocks={unknown:'Наличие уточняется',in_stock:'В наличии',on_order:'Под заказ',out_of_stock:'Нет в наличии'};
const params=new URLSearchParams(location.search);let type=['parts','electronics'].includes(params.get('type'))?params.get('type'):'',page=0,epoch=0,debounce,urls=new Set();
function release(){for(const u of urls)URL.revokeObjectURL(u);urls.clear();}
function guard(r){if(r.error)throw r.error;return r.data;}
const price=x=>x.price_rub===null?'Цена по запросу':x.price_rub.toLocaleString('ru-RU')+' ₽';
function setTab(){for(const b of document.querySelectorAll('[data-type]'))b.setAttribute('aria-pressed',String(b.dataset.type===type));}
async function gallery(x,photo,controls,token){
 try{const entries=guard(await bucket.list(x.id,{limit:10}));if(token!==epoch)return;const names=entries.map(e=>e.name).filter(n=>/^[1-5]\.jpg$/.test(n)).sort();if(!names.length){photo.textContent='Фото уточняется';return;}
 let index=0,turn=0,activeUrl=null;const back=button('‹',()=>{index=(index+names.length-1)%names.length;show();}),next=button('›',()=>{index=(index+1)%names.length;show();}),count=node('span');back.setAttribute('aria-label','Предыдущее фото');next.setAttribute('aria-label','Следующее фото');controls.append(back,count,next);controls.hidden=names.length<2;
 async function show(){const current=++turn;count.textContent=(index+1)+' / '+names.length;photo.textContent='Загрузка фото…';if(activeUrl){URL.revokeObjectURL(activeUrl);urls.delete(activeUrl);activeUrl=null;}try{const blob=guard(await bucket.download(x.id+'/'+names[index]));if(token!==epoch||current!==turn)return;if(blob.type!=='image/jpeg')throw Error('Unexpected image type');activeUrl=URL.createObjectURL(blob);urls.add(activeUrl);const img=node('img');img.alt=x.name+' — фото '+(index+1);img.src=activeUrl;photo.replaceChildren(img);}catch{if(token===epoch&&current===turn)photo.textContent='Фото недоступно';}}
 await show();
 }catch{if(token===epoch)photo.textContent='Фото недоступно';}
}
function card(x,token){const item=node('article',undefined,'product'),photo=node('div','Загрузка фото…','photo'),controls=node('div',undefined,'photo-controls');controls.hidden=true;const body=node('div',undefined,'product-body');body.append(node('p',labels[x.catalog]+' · '+x.category,'eyebrow'),node('h3',x.name),node('p',price(x),'price'),node('p',stocks[x.stock_status]||stocks.unknown,'meta'),node('p','Артикул: '+x.sku,'meta'));if(x.brand)body.append(node('p','Бренд: '+x.brand,'meta'));if(x.compatibility)body.append(node('p','Совместимость: '+x.compatibility,'meta'));if(x.description){const details=node('details');details.append(node('summary','Характеристики'),node('p',x.description,'description'));body.append(details);}
 const actions=node('div',undefined,'actions'),telegram=node('a','Уточнить в Telegram','button primary');telegram.href='https://t.me/Kaduk0v';telegram.target='_blank';telegram.rel='noopener noreferrer';
 const copy=button('Копировать товар',async()=>{try{await navigator.clipboard.writeText(x.name+' · '+x.sku+' · '+price(x));copy.textContent='Скопировано';}catch{copy.textContent='Не удалось скопировать';}});actions.append(telegram,copy);body.append(actions);item.append(photo,controls,body);gallery(x,photo,controls,token);return item;}
function safeTerms(q){return q.normalize('NFKC').toLowerCase().replace(/айфон[ауы]?/g,'iphone').replace(/самсунг[ауы]?/g,'samsung').replace(/[^\p{L}\p{N}\s-]/gu,' ').trim().split(/\s+/).filter(Boolean).slice(0,5);}
async function load(){const token=++epoch;release();container.replaceChildren();say('Загрузка товаров…');$('prev').disabled=true;$('next').disabled=true;$('page').textContent=page+1;
 try{let query=client.from('catalog_products').select('id,sku,name,catalog,category,brand,compatibility,description,price_rub,stock_status,created_at').eq('published',true);
 if(type)query=query.eq('catalog',type);if($('stock').value)query=query.eq('stock_status',$('stock').value);
 for(const term of safeTerms($('search').value))query=query.or(['name','sku','brand','compatibility','category'].map(k=>k+'.ilike.*'+term+'*').join(','));
 const sort=$('sort').value;if(sort==='asc'||sort==='desc')query=query.order('price_rub',{ascending:sort==='asc',nullsFirst:false});else if(sort==='name')query=query.order('name',{ascending:true});else query=query.order('created_at',{ascending:false});
 const rows=guard(await query.order('id',{ascending:true}).range(page*PAGE,(page+1)*PAGE));if(token!==epoch)return;
 if(!rows.length){const empty=node('div',undefined,'empty');empty.append(node('h3','Товаров пока нет'),node('p','Измените фильтры или напишите мастеру. В витрину попадают только опубликованные позиции.','muted'));container.append(empty);}
 else for(const x of rows.slice(0,PAGE))container.append(card(x,token));
 say(rows.length?'На странице: '+Math.min(rows.length,PAGE)+' товаров':'Нет опубликованных позиций по запросу');$('prev').disabled=page===0;$('next').disabled=rows.length<=PAGE;
 }catch{if(token===epoch){say('Не удалось загрузить каталог. Нажмите «Обновить».');container.append(node('div','Каталог временно недоступен. Свяжитесь с мастером.','empty'));$('prev').disabled=page===0;}}}
 for(const b of document.querySelectorAll('[data-type]'))b.addEventListener('click',()=>{type=b.dataset.type;page=0;setTab();load();});$('search').addEventListener('input',()=>{clearTimeout(debounce);++epoch;release();container.replaceChildren();say('Поиск…');$('prev').disabled=true;$('next').disabled=true;debounce=setTimeout(()=>{page=0;load();},300);});for(const k of ['sort','stock'])$(k).addEventListener('change',()=>{clearTimeout(debounce);page=0;load();});$('refresh').addEventListener('click',()=>{clearTimeout(debounce);load();});$('prev').addEventListener('click',()=>{if(page>0){page--;load();}});$('next').addEventListener('click',()=>{page++;load();});window.addEventListener('pagehide',()=>{++epoch;release();});window.addEventListener('pageshow',e=>{if(e.persisted)load();});setTab();load();
})();