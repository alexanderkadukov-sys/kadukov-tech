'use strict';
function csv(text){
 let delimiter=';',quoted=false,semi=0,comma=0,tab=0;
 for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){i++;continue;}quoted=!quoted;}else if(!quoted){if(c==='\r'||c==='\n')break;if(c===';')semi++;if(c===',')comma++;if(c==='\t')tab++;}}
 delimiter=tab>semi&&tab>comma?'\t':semi>=comma?';':',';
 const rows=[];let row=[],cell='',state=0;
 function pushCell(){row.push(cell);cell='';state=0;if(row.length>30)throw Error('Слишком много столбцов');}
 function pushRow(){pushCell();if(row.some(v=>v.trim()!==''))rows.push(row);row=[];if(rows.length>501)throw Error('Не более 500 товаров в файле');}
 for(let i=0;i<text.length;i++){const c=text[i];
 if(state===1){if(c==='"'){if(text[i+1]==='"'){cell+='"';i++;}else state=2;}else cell+=c;}
 else if(c===delimiter)pushCell();
 else if(c==='\r'||c==='\n'){if(c==='\r'&&text[i+1]==='\n')i++;pushRow();}
 else if(state===2){if(c!==' '&&c!=='\t')throw Error('Неверные кавычки CSV');}
 else if(c==='"'){if(cell!=='')throw Error('Неверные кавычки CSV');state=1;}
 else cell+=c;
 }
 if(state===1)throw Error('Незакрытые кавычки CSV');if(row.length||cell||state===2)pushRow();return rows;
}
self.onmessage=e=>{try{const {buffer,ext}=e.data;let rows;
 if(ext==='csv'){rows=csv(new TextDecoder('utf-8',{fatal:true}).decode(buffer).replace(/^\uFEFF/,''));}
 else if(ext==='xlsx'){
 importScripts('https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js');
 const book=XLSX.read(buffer,{type:'array',sheetRows:502,cellFormula:true,cellDates:true});
 const sheet=book.Sheets[book.SheetNames[0]];if(!sheet||!sheet['!ref'])throw Error('Первый лист пуст');
 const range=XLSX.utils.decode_range(sheet['!ref']);if(range.e.r>=501||range.e.c>=30||range.s.r!==0||range.s.c!==0)throw Error('Требуются заголовки с A1, до 500 товаров и 30 столбцов');
 rows=[];for(let r=0;r<=range.e.r;r++){const row=[];for(let c=0;c<=range.e.c;c++){const cell=sheet[XLSX.utils.encode_cell({r,c})];if(cell?.f)throw Error('Формулы не поддерживаются: строка '+(r+1));row.push(cell?.v??'');}if(row.some(v=>v!==''))rows.push(row);}
 }else throw Error('Выберите CSV или XLSX');
 if(rows.length<2||rows.length>501)throw Error('Нужны заголовки и от 1 до 500 товаров');
 self.postMessage({rows});
 }catch(err){self.postMessage({error:String(err.message||err)});}};
