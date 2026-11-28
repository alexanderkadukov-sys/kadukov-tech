(() => {
'use strict';
const $=id=>document.getElementById(id),container=$('products'), status=$('status');
const say=s=>status.textContent=s;
const node=(tag,value,cls)=>{const el=document.createElement(tag);if(value!==undefined)el.textContent=value;if(cls)el.className=cls;return el;};
const button=(label,fn)=>{const el=node('button',label);el.type='button';el.addEventListener('click',fn);return el;};
const client=window.supabase?.createClient?.('https://qlggbdzodqagtxqifslg.supabase.co',"sb_publishable_xmpxNkuvDizZoYOl12CJCw_lM-h9kSW",{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
const bucket=client?.storage.from('catalog-photos'), PAGE=12,labels={electronics:'Электроника',parts:'Запчасти'},stocks={unknown:'Наличие уточняется',in_stock:'В наличии',on_order:'Под заказ',out_of_stock:'Нет в наличии'};
const checkedParts = (window.kadukovVerifiedParts || []).map(part => ({
  id: part.id, name: part.name, catalog: 'parts', category: part.category, brand: part.brand,
  compatibility: part.compatibility, description: part.details || 'Цена за деталь. Установка рассчитывается отдельно.',
  variant: part.variant, price_rub: part.price, stock_status: 'unknown', checked: part.checked,
  created_at: part.checked.split('.').reverse().join('-') + 'T00:00:00Z'
}));
const params=new URLSearchParams(location.search);let category='',applied={stock:'',brand:'',min:null,max:null},type=['parts','electronics'].includes(params.get('type'))?params.get('type'):'',page=0,epoch=0,debounce,urls=new Set();
function release(){for(const u of urls)URL.revokeObjectURL(u);urls.clear();}
function guard(r){if(r.error)throw r.error;return r.data;}
const price=x=>x.price_rub===null?'Цена по запросу':x.price_rub.toLocaleString('ru-RU')+' ₽';
const categoryMap={phones:{type:'electronics',label:'Смартфоны',terms:['смартфон','телефон']},laptops:{type:'electronics',label:'Ноутбуки',terms:['ноутбук','laptop']},computers:{type:'electronics',label:'Компьютеры',terms:['компьютер','системн','монитор','пк','комплектующ']},displays:{type:'parts',label:'Дисплеи',terms:['диспле','экран','матриц']},batteries:{type:'parts',label:'Аккумуляторы',terms:['аккумулятор','батаре','акб']},accessories:{type:'electronics',label:'Аксессуары',terms:['аксессуар','наушник','заряд','кабел','чехол']}};
function setTab(){for(const b of document.querySelectorAll('[data-type]'))b.setAttribute('aria-pressed',String(b.dataset.type===type));for(const b of document.querySelectorAll('[data-cat]'))b.setAttribute('aria-pressed',String(b.dataset.cat===category));$('resultTitle').textContent=category?categoryMap[category].label:labels[type]||'Все товары';}
function filterSummary(){const a=[];if(applied.stock)a.push(stocks[applied.stock]);if(applied.brand)a.push(applied.brand);if(applied.min!==null)a.push('от '+applied.min+' ₽');if(applied.max!==null)a.push('до '+applied.max+' ₽');$('filterCount').hidden=!a.length;$('filterCount').textContent=a.length;$('activeFilters').hidden=!a.length;$('filterText').textContent=a.join(' · ');}
function resetFilters(){applied={stock:'',brand:'',min:null,max:null};for(const id of ['stock','brandFilter','minPrice','maxPrice'])$(id).value='';filterSummary();page=0;load();}
function toggleFilters(open){$('filters').hidden=!open;$('toggleFilters').setAttribute('aria-expanded',String(open));}
function contact(x) {
 const link = node('a','Написать','button primary');
 const url = new URL('https://t.me/Kaduk0v');
 const lines = ['Здравствуйте! Подскажите наличие и цену:', x.name, x.variant, x.sku ? 'Артикул: ' + x.sku : ''];
 url.searchParams.set('text', lines.filter(Boolean).join('\n'));
 link.href = url.href;
 link.target = '_blank';
 link.rel = 'noopener noreferrer';
 return link;
}
function copyItem(x){const b=button('Копировать товар',async()=>{try{await navigator.clipboard.writeText([x.name,x.sku,price(x)].filter(Boolean).join(' · '));b.textContent='Скопировано';}catch{b.textContent='Не удалось скопировать';}});return b;}
function stockLabel(x){const p=node('p',stocks[x.stock_status]||stocks.unknown,'stock');p.dataset.status=x.stock_status;return p;}
function showDetail(x,cover){
 $('detailTitle').textContent=x.name;
 const body=$('detailBody');
 body.replaceChildren();
 const info=node('div',undefined,'detail-info');
 if(cover?.src){
  const box=node('div',undefined,'photo detail-photo'),img=node('img');
  img.src=cover.src;img.alt=x.name;box.append(img);body.append(box);
 }
 info.append(node('p',price(x),'price'),stockLabel(x));
 if(x.checked)info.append(node('p','Цена проверена '+x.checked,'meta'));
 if(x.sku)info.append(node('p','Артикул: '+x.sku,'meta'));
 info.append(node('p',labels[x.catalog]+' · '+x.category,'meta'));
 if(x.brand)info.append(node('p','Бренд: '+x.brand));
 if(x.variant)info.append(node('p',x.variant));
 if(x.compatibility)info.append(node('p','Совместимость: '+x.compatibility));
 if(x.description)info.append(node('p',x.description));
 const actions=node('div',undefined,'actions');
 actions.append(contact(x),copyItem(x));info.append(actions);body.append(info);
 const dialog=$('productDialog');
 if(!dialog.open)dialog.showModal();
}
$('closeDetail').addEventListener('click',()=>$('productDialog').close());

async function gallery(x,photo,controls,token){
 try{const entries=guard(await bucket.list(x.id,{limit:10}));if(token!==epoch)return;const names=entries.map(e=>e.name).filter(n=>/^[1-5]\.jpg$/.test(n)).sort();if(!names.length){photo.textContent='Фото уточняется';return;}
 let index=0,turn=0,activeUrl=null;const back=button('‹',()=>{index=(index+names.length-1)%names.length;show();}),next=button('›',()=>{index=(index+1)%names.length;show();}),count=node('span');back.setAttribute('aria-label','Предыдущее фото');next.setAttribute('aria-label','Следующее фото');controls.append(back,count,next);controls.hidden=names.length<2;
 async function show(){const current=++turn;count.textContent=(index+1)+' / '+names.length;photo.textContent='Загрузка фото…';if(activeUrl){URL.revokeObjectURL(activeUrl);urls.delete(activeUrl);activeUrl=null;}try{const blob=guard(await bucket.download(x.id+'/'+names[index]));if(token!==epoch||current!==turn)return;if(blob.type!=='image/jpeg')throw Error('Unexpected image type');activeUrl=URL.createObjectURL(blob);urls.add(activeUrl);const img=node('img');img.alt=x.name+' — фото '+(index+1);img.src=activeUrl;photo.replaceChildren(img);}catch{if(token===epoch&&current===turn)photo.textContent='Фото недоступно';}}
 await show();
 }catch{if(token===epoch)photo.textContent='Фото недоступно';}
}
function card(x,token){
 const item=node('article',undefined,'product'),body=node('div',undefined,'product-body');
 let photo;
 if(!x.checked){
  photo=node('div','Фото загружается…','photo');
  const controls=node('div',undefined,'photo-controls');controls.hidden=true;
  item.append(photo,controls);gallery(x,photo,controls,token);
 }
 body.append(node('p',price(x),'price'),node('h3',x.name));
 if(x.variant || x.compatibility)body.append(node('p',x.variant || x.compatibility,'meta compat'));
 body.append(stockLabel(x));
 const actions=node('div',undefined,'actions');
 const details=button('Подробнее',()=>showDetail(x,photo?.querySelector('img')));
 details.className='secondary';actions.append(details,contact(x));body.append(actions);item.append(body);
 return item;
}
function safeTerms(q){return q.normalize('NFKC').toLowerCase().replace(/айфон[ауы]?/g,'iphone').replace(/самсунг[ауы]?/g,'samsung').replace(/ксиаоми|сяоми/g,'xiaomi').replace(/ё/g,'е').replace(/(iphone|samsung|xiaomi|galaxy|poco)(?=[a-z0-9])/g,'$1 ').replace(/([a-zа-я])(\d{1,})/gu,'$1 $2').replace(/(\d)([a-zа-я])/gu,'$1 $2').replace(/[^\p{L}\p{N}\s-]/gu,' ').trim().split(/\s+/).filter(Boolean).slice(0,5);}
function partTerms(value) {
 return value.normalize('NFKC').toLowerCase().replace(/\+/g,' plus ').replace(/ё/g,'е')
  .replace(/айфон/g,'iphone').replace(/самсунг/g,'samsung').replace(/(?:ксиаоми|сяоми)/g,'xiaomi')
  .replace(/редми/g,'redmi').replace(/(?:ноут|нот)(?=\s*\d)/g,'note')
  .replace(/экран(?:ы|а)?/g,'дисплей').replace(/батаре[а-я]*/g,'аккумулятор').replace(/\b(?:iphone|galaxy|redmi)(?=\d)/g,'$& ')
  .replace(/(^|\s)[сs]\s*(?=\d)/g,'$1s').replace(/(^|\s)[аa]\s*(?=\d)/g,'$1a')
  .replace(/(^|\s)(\d+)[асе](?=\s|$)/g,(_,space,n)=>space+n+({а:'a',с:'c',е:'e'})[_.slice(-1)])
  .replace(/(\b(?:samsung(?:\s+galaxy)?|galaxy)\s+)10\b/g,'$1s10')
  .split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}
function filterChecked(queryText) {
 const terms=partTerms(queryText).filter(word=>!['купить','кутить','кпить','цена','на','для','и'].includes(word));
 const brand=partTerms(applied.brand);
 return checkedParts.filter(x=>{
  if(type==='electronics'||(applied.stock&&applied.stock!==x.stock_status))return false;
  if(category&&!categoryMap[category].terms.some(term=>x.category.toLowerCase().includes(term)))return false;
  if(!brand.every(word=>x.brand.toLowerCase().includes(word)))return false;
  if((applied.min!==null&&x.price_rub<applied.min)||(applied.max!==null&&x.price_rub>applied.max))return false;
  const words=partTerms([x.name,x.brand,x.compatibility,x.category,x.variant].join(' '));
  return terms.every(term=>words.includes(term)||(term.length>4&&/\p{Script=Cyrillic}/u.test(term)&&words.some(word=>word.startsWith(term))));
 });
}
function compareProducts(a,b,sort) {
 let order;
 if(sort==='asc'||sort==='desc'){
  if(a.price_rub===null||b.price_rub===null)order=Number(a.price_rub===null)-Number(b.price_rub===null);
  else order=(a.price_rub-b.price_rub)*(sort==='desc'?-1:1);
 } else if(sort==='name') order=a.name.localeCompare(b.name,'ru');
 else order=Date.parse(b.created_at)-Date.parse(a.created_at);
 return order||a.id.localeCompare(b.id);
}
function showRows(rows,token) {
 if(!rows.length){
  const empty=node('div',undefined,'empty');
  empty.append(node('h3','Нет товаров по запросу'),node('p','Попробуйте другую модель или сбросьте фильтры.'));
  empty.append(button('Показать все товары',()=>{type='';category='';$('search').value='';setTab();resetFilters();}));
  container.append(empty);
 } else for(const x of rows.slice(0,PAGE))container.append(card(x,token));
 say(rows.length?'Показано: '+Math.min(rows.length,PAGE):'Нет совпадений');
 $('pager').hidden=page===0&&rows.length<=PAGE;$('prev').disabled=page===0;$('next').disabled=rows.length<=PAGE;
}
function showFallback(localRows, sort, start, token) {
 const fallback = localRows.sort((a,b) => compareProducts(a,b,sort)).slice(start,start+PAGE+1);
 if (fallback.length) {
  showRows(fallback,token);
  say('Показаны проверенные цены. Остальные товары не загрузились.');
 } else {
  say('Не удалось загрузить каталог. Нажмите «Обновить».');
  container.append(node('div','Каталог временно недоступен. Свяжитесь с мастером.','empty'));
  $('pager').hidden = page === 0;
  $('prev').disabled = page === 0;
 }
}
async function load(){clearTimeout(debounce);if($('productDialog').open)$('productDialog').close();const token=++epoch;release();container.replaceChildren();say('Загрузка товаров…');$('prev').disabled=true;$('next').disabled=true;$('page').textContent=page+1;
 const localRows=filterChecked($('search').value);
 const sort=$('sort').value;
 const start=page*PAGE;
 if (!client) { showFallback(localRows,sort,start,token); return; }
 const first=Math.max(0,start-localRows.length);
 try{let query=client.from('catalog_products').select('id,sku,name,catalog,category,brand,compatibility,description,price_rub,stock_status,created_at').eq('published',true);
 if(type)query=query.eq('catalog',type);if(applied.stock)query=query.eq('stock_status',applied.stock);
 if(category)query=query.or(categoryMap[category].terms.map(t=>'category.ilike.*'+t+'*').join(','));
 if(applied.brand)for(const term of safeTerms(applied.brand))query=query.ilike('brand','%'+term+'%');
 if(applied.min!==null)query=query.gte('price_rub',applied.min);if(applied.max!==null)query=query.lte('price_rub',applied.max);
 for(const term of safeTerms($('search').value))query=query.or(['name','sku','brand','compatibility','category'].map(k=>k+'.ilike.*'+term+'*').join(','));
 if(sort==='asc'||sort==='desc')query=query.order('price_rub',{ascending:sort==='asc',nullsFirst:false});else if(sort==='name')query=query.order('name',{ascending:true});else query=query.order('created_at',{ascending:false});
 const remoteRows=guard(await query.order('id',{ascending:true}).range(first,start+PAGE));
 if(token!==epoch)return;
 const merged=localRows.length?[...remoteRows,...localRows].sort((a,b)=>compareProducts(a,b,sort)):remoteRows;
 showRows(merged.slice(start-first,start-first+PAGE+1),token);
 }catch{
  if(token!==epoch)return;
  showFallback(localRows,sort,start,token);
 }}
for(const b of document.querySelectorAll('[data-type]'))b.addEventListener('click',()=>{type=b.dataset.type;category='';page=0;setTab();load();});
for(const b of document.querySelectorAll('[data-cat]'))b.addEventListener('click',()=>{const selected=b.dataset.cat;if(category===selected){category='';}else{category=selected;type=categoryMap[selected].type;}page=0;setTab();load();});
$('search').addEventListener('input',()=>{clearTimeout(debounce);++epoch;release();container.replaceChildren();say('Поиск…');$('prev').disabled=true;$('next').disabled=true;debounce=setTimeout(()=>{page=0;load();},300);});
$('sort').addEventListener('change',()=>{page=0;load();});
$('toggleFilters').addEventListener('click',()=>toggleFilters($('filters').hidden));
$('applyFilters').addEventListener('click',()=>{const min=$('minPrice').value===''?null:Number($('minPrice').value),max=$('maxPrice').value===''?null:Number($('maxPrice').value);if([min,max].some(v=>v!==null&&(!Number.isInteger(v)||v<0||v>100000000))||(min!==null&&max!==null&&min>max)){say('Проверьте диапазон цен');return;}applied={stock:$('stock').value,brand:$('brandFilter').value.trim(),min,max};filterSummary();toggleFilters(false);page=0;load();});
$('resetFilters').addEventListener('click',()=>{resetFilters();toggleFilters(false);});$('clearActive').addEventListener('click',resetFilters);
$('refresh').addEventListener('click', () => {
 if (client) load();
 else location.reload();
});
$('prev').addEventListener('click',()=>{if(page>0){page--;load();}});$('next').addEventListener('click',()=>{page++;load();});window.addEventListener('pagehide',()=>{++epoch;release();});window.addEventListener('pageshow',e=>{if(e.persisted)load();});setTab();filterSummary();load();
})();
