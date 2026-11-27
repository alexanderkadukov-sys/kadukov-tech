(() => {
'use strict';
const KEY='kadukov-admin-demo-v1', MAX=5000;
const $=id=>document.getElementById(id), form=$('form'), list=$('products');
const catalogs={parts:'Запчасти',electronics:'Электроника'}, stocks={unknown:'Уточняется',in_stock:'В наличии',on_order:'Под заказ',out_of_stock:'Нет в наличии'};
let rows=[],editing=null,storageOK=true;
const str=(v,max,required=false)=>{if(typeof v!=='string')throw Error('Ожидался текст');const s=v.trim();if(s.length>max||(required&&!s))throw Error('Проверьте обязательные поля и длину текста');return s;};
function normalize(x){
 if(!x||typeof x!=='object'||Array.isArray(x))throw Error('Неверная запись товара');
 const id=str(x.id,80,true),sku=str(x.sku,80,true),name=str(x.name,160,true),category=str(x.category,80,true),brand=str(x.brand,80),compatibility=str(x.compatibility,300),description=str(x.description,1500);
 if(!Object.hasOwn(catalogs,x.catalog)||!Object.hasOwn(stocks,x.stock))throw Error('Неизвестный каталог или наличие');
 const price=x.price;if(price!==null&&(!Number.isSafeInteger(price)||price<0||price>100000000))throw Error('Цена должна быть целым неотрицательным числом рублей');
 return {id,sku,name,category,brand,compatibility,description,catalog:x.catalog,stock:x.stock,price};
}
function validateRows(input){if(!Array.isArray(input)||input.length>MAX)throw Error('Нужен массив не более '+MAX+' товаров');const ids=new Set(),skus=new Set();return input.map(x=>{const v=normalize(x),sku=v.sku.toLowerCase();if(ids.has(v.id)||skus.has(sku))throw Error('Дублирующийся артикул или ID: '+v.sku);ids.add(v.id);skus.add(sku);return v;});}
function say(where,s){$(where).textContent=s;}
try{const raw=localStorage.getItem(KEY);if(raw)rows=validateRows(JSON.parse(raw));}catch{storageOK=false;say('listStatus','Локальные данные не удалось прочитать. Сохранение отключено до перезагрузки или восстановления хранилища.');}
function commit(next){const clean=validateRows(next);if(!storageOK)throw Error('Хранилище недоступно: данные не изменены');try{localStorage.setItem(KEY,JSON.stringify(clean));}catch{throw Error('Сохранение не удалось: данные не изменены');}rows=clean;render();}
function node(tag,text,cls){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;}
function btn(label,action){const b=node('button',label);b.type='button';b.addEventListener('click',action);return b;}
function render(){
 $('total').textContent=rows.length;$('electronics').textContent=rows.filter(x=>x.catalog==='electronics').length;$('parts').textContent=rows.filter(x=>x.catalog==='parts').length;
 const q=$('search').value.trim().toLowerCase(),f=$('filter').value;
 let shown=rows.filter(x=>(!f||x.catalog===f)&&[x.name,x.sku,x.brand,x.category,x.compatibility].join(' ').toLowerCase().includes(q));
 if($('sort').value==='name')shown.sort((a,b)=>a.name.localeCompare(b.name,'ru'));else shown.reverse();
 list.replaceChildren();if(!shown.length){list.append(node('p',rows.length?'Ничего не найдено.':'Пока нет товаров. Добавьте тестовую позицию.','empty'));return;}
 for(const x of shown){const card=node('article',undefined,'product');card.append(node('p',catalogs[x.catalog]+' · '+x.category+' · '+x.sku,'meta'),node('h3',x.name),node('p',x.price===null?'Цена по запросу':x.price.toLocaleString('ru-RU')+' ₽','price'),node('p',stocks[x.stock],'pill'));if(x.brand)card.append(node('p','Бренд: '+x.brand,'meta'));if(x.compatibility)card.append(node('p','Совместимость: '+x.compatibility,'meta'));if(x.description)card.append(node('p',x.description,'meta'));const actions=node('div',undefined,'actions');actions.append(btn('Изменить',()=>edit(x)),btn('Удалить',()=>{if(!confirm('Удалить тестовый товар «'+x.name+'»?'))return;try{commit(rows.filter(y=>y.id!==x.id));if(editing===x.id)reset();say('listStatus','Товар удалён.');}catch(e){say('listStatus',e.message);}}));card.append(actions);list.append(card);}
}
function reset(){editing=null;form.reset();$('formTitle').textContent='Новый товар';$('save').textContent='Добавить товар';say('formStatus','');}
function edit(x){editing=x.id;for(const k of ['name','sku','catalog','category','brand','compatibility','price','stock','description'])form.elements.namedItem(k).value=x[k]??'';$('formTitle').textContent='Редактирование';$('save').textContent='Сохранить';say('formStatus','');form.scrollIntoView({block:'start'});form.elements.namedItem('name').focus();}
form.addEventListener('submit',e=>{e.preventDefault();try{const data=Object.fromEntries(new FormData(form));data.id=editing||crypto.randomUUID();data.price=data.price.trim()===''?null:Number(data.price);const x=normalize(data);const next=editing?rows.map(y=>y.id===editing?x:y):[...rows,x];commit(next);reset();say('formStatus','Сохранено в этом браузере.');}catch(e){say('formStatus',e.message);}});
$('cancel').addEventListener('click',reset);$('search').addEventListener('input',render);$('filter').addEventListener('change',render);$('sort').addEventListener('change',render);
$('export').addEventListener('click',()=>{const url=URL.createObjectURL(new Blob([JSON.stringify({version:1,products:rows},null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='kadukov-catalog-demo.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
$('import').addEventListener('click',()=>$('file').click());
$('file').addEventListener('change',async e=>{const f=e.target.files?.[0];e.target.value='';if(!f)return;try{if(f.size>10*1024*1024)throw Error('Файл больше 10 МБ');const input=JSON.parse(await f.text());if(input.version!==1)throw Error('Неподдерживаемый формат');const clean=validateRows(input.products);if(!confirm('Заменить локальные '+rows.length+' позиций на '+clean.length+' из файла? Сначала экспортируйте текущие данные.'))return;commit(clean);reset();say('listStatus','Импортировано: '+clean.length);}catch(err){say('listStatus','Импорт отменён: '+err.message);}});
render();
})();