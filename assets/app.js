'use strict';
// MAPONTES Audio Lab v4 — audio publicamente disponível, sem login, proteção ou DRM.
const el=id=>document.getElementById(id);
const ui={url:el('songUrl'),rights:el('rights'),lookup:el('lookup'),findStatus:el('findStatus'),
 title:el('songTitle'),artist:el('songArtist'),page:el('songPage'),id:el('songId'),songInfo:el('songInfo'),
 actions:el('actions'),getMp3:el('getMp3'),getM4a:el('getM4a'),getMp4:el('getMp4'),
 bitrate:el('bitrate'),localFile:el('localFile'),localBtn:el('localBtn'),localName:el('localName'),
 convertLocal:el('convertLocal'),status:el('status'),progress:el('progress'),bar:el('bar'),
 result:el('result'),resultFile:el('resultFile'),resultButton:el('resultButton'),preview:el('preview'),
 check:el('check')};
let track=null,videoCache=null,selectedLocal=null,busy=false,previewUrl=null;
function setStatus(text,type='info'){ui.status.className='message '+type;ui.status.textContent=text;}
function setFind(text,type='info'){ui.findStatus.className='message '+type;ui.findStatus.textContent=text;}
function progress(n,label){ui.progress.hidden=false;ui.bar.value=Math.max(0,Math.min(100,n));el('progressText').textContent=label;}
function doneProgress(){ui.progress.hidden=true;ui.bar.value=0;}
function lock(flag){busy=flag;[ui.lookup,ui.getMp3,ui.getM4a,ui.getMp4,ui.localFile].forEach(b=>b.disabled=flag);ui.convertLocal.disabled=flag||!selectedLocal;}
function validLink(url){try{const u=new URL(url);return u.protocol==='https:'&&['suno.com','www.suno.com'].includes(u.hostname)&&(/^\/song\/[0-9a-f-]{36}\/?$/i.test(u.pathname)||/^\/s\/[A-Za-z0-9_-]{6,64}\/?$/.test(u.pathname));}catch{return false;}}
function sanitize(s){return (s||'Musica do Suno').replace(/[\\/:*?"<>|\x00-\x1f]/g,' ').replace(/\s+/g,' ').trim().slice(0,100)||'Musica do Suno';}
function fileName(ext,local=false){return `${sanitize((local?selectedLocal?.name?.replace(/\.[^.]+$/,''):track?.title)||'Audio MAPONTES')}.${ext}`;}
function sniff(d){const str=(p,n)=>String.fromCharCode(...d.subarray(p,p+n));if(d.length<16)return 'invalid';if(str(0,3)==='ID3'||(d[0]===255&&(d[1]&224)===224))return 'mp3';if(str(4,4)==='ftyp')return 'mp4';if(str(0,4)==='RIFF'&&str(8,4)==='WAVE')return 'wav';if(str(0,4)==='OggS')return 'ogg';if(str(0,4)==='fLaC')return 'flac';if(d[0]===26&&d[1]===69&&d[2]===223&&d[3]===163)return 'webm';return 'invalid';}
function saveBlob(blob,name,kind){if(previewUrl)URL.revokeObjectURL(previewUrl);previewUrl=URL.createObjectURL(blob);ui.result.hidden=false;ui.resultFile.textContent=`${name} · ${(blob.size/1048576).toFixed(2)} MB`;ui.resultButton.href=previewUrl;ui.resultButton.download=name;ui.resultButton.textContent='↓ Baixar '+kind;ui.preview.src=previewUrl;ui.preview.hidden=kind==='MP4';setStatus('Arquivo preparado! Clique em Baixar para salvar no dispositivo.','good');}
async function fetchJson(url,options){const resp=await fetch(url,options);const data=await resp.json().catch(()=>null);if(!resp.ok||!data?.ok)throw Error(data?.error||`Erro HTTP ${resp.status}`);return data;}
async function resolveLink(evt){if(evt)evt.preventDefault();if(busy)return;ui.result.hidden=true;track=null;videoCache=null;ui.actions.hidden=true;ui.songInfo.hidden=true;const url=ui.url.value.trim();if(!validLink(url)){setFind('Informe um link completo de música do Suno: suno.com/song/... ou suno.com/s/...','bad');return;}if(!ui.rights.checked){setFind('Confirme que tem autorização para salvar o áudio antes de continuar.','bad');return;}lock(true);setFind('Consultando o link público do Suno...');try{const data=await fetchJson('suno.php?action=resolve',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url})});track=data;ui.title.textContent=data.title;ui.artist.textContent=data.artist;ui.id.textContent=data.id;ui.page.href=data.page;ui.songInfo.hidden=false;ui.actions.hidden=false;setFind(data.note||'Link reconhecido! Selecione o formato.','good');setStatus('Escolha MP3, M4A ou vídeo MP4 para iniciar.');}catch(e){setFind(e.message,'bad');setStatus('Não foi possível consultar esse link.','bad');}finally{lock(false);}}
async function fetchVideo(){if(!track)throw Error('Analise um link primeiro.');if(videoCache&&videoCache.id===track.id)return videoCache.bytes;
 progress(5,'Solicitando vídeo público ao servidor...');
 const res=await fetch('suno.php?action=video&id='+encodeURIComponent(track.id));
 if(!res.ok){const body=await res.json().catch(()=>null);throw Error(body?.error||`Servidor respondeu HTTP ${res.status}`);}
 const total=Number(res.headers.get('content-length'))||0;
 if(total>188743680)throw Error('O vídeo ultrapassa 180 MB.');
 let arr;
 if(res.body?.getReader){const reader=res.body.getReader();const chunks=[];let loaded=0;
  for(;;){const {done,value}=await reader.read();if(done)break;chunks.push(value);loaded+=value.byteLength;if(loaded>188743680)throw Error('Arquivo maior que 180 MB.');progress(total?5+45*loaded/total:25,`Recebendo vídeo: ${(loaded/1048576).toFixed(1)} MB`);}
  arr=new Uint8Array(loaded);let p=0;for(const c of chunks){arr.set(c,p);p+=c.length;}
 }else{arr=new Uint8Array(await res.arrayBuffer());}
 if(sniff(arr)!=='mp4')throw Error('O servidor retornou dados que não são um vídeo MP4 válido.');
 videoCache={id:track.id,bytes:arr};return arr;
}
function extractM4a(mp4){progress(55,'Separando a faixa de áudio do vídeo...');if(!window.MapontesMP4?.extractAudio)throw Error('Módulo de extração MP4 não foi carregado.');const m4a=window.MapontesMP4.extractAudio(mp4);if(sniff(m4a)!=='mp4')throw Error('O arquivo de saída não contém uma estrutura M4A válida.');return m4a;}
function toInt16(float){const out=new Int16Array(float.length);for(let i=0;i<float.length;i++){let s=Math.max(-1,Math.min(1,float[i]));out[i]=s<0?s*32768:s*32767;}return out;}
async function toMp3(bytes){if(!window.lamejs?.Mp3Encoder)throw Error('Codificador MP3 indisponível. Confirme o acesso à biblioteca lamejs na internet. Você ainda pode salvar o M4A.');
 progress(59,'Decodificando o áudio AAC...');const context=new (window.OfflineAudioContext||window.webkitOfflineAudioContext)(1,1,44100);
 const raw=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
 let audio;try{audio=await context.decodeAudioData(raw);}catch{throw Error('O navegador não conseguiu decodificar este arquivo. Tente extrair M4A e abrir no VLC.');}
 const channels=Math.min(audio.numberOfChannels,2),l=toInt16(audio.getChannelData(0)),r=channels===2?toInt16(audio.getChannelData(1)):null;
 const bitrate=Number(ui.bitrate.value)||192,encoder=new window.lamejs.Mp3Encoder(channels,audio.sampleRate,bitrate),parts=[];
 const frames=Math.ceil(l.length/1152);for(let k=0;k<frames;k++){
  const start=k*1152,end=Math.min(l.length,start+1152);const part=channels===2?encoder.encodeBuffer(l.subarray(start,end),r.subarray(start,end)):encoder.encodeBuffer(l.subarray(start,end));
  if(part.length)parts.push(Uint8Array.from(part));if(k%85===0){progress(60+39*k/frames,`Codificando MP3 (${Math.round(k/frames*100)}%)...`);await new Promise(resolve=>setTimeout(resolve,0));}
 }
 const tail=encoder.flush();if(tail.length)parts.push(Uint8Array.from(tail));progress(100,'MP3 pronto!');return new Blob(parts,{type:'audio/mpeg'});
}
async function actionForTrack(kind){if(!track||busy)return;if(!ui.rights.checked){setStatus('Marque a confirmação de direitos de uso.','bad');return;}ui.result.hidden=true;lock(true);try{
 const video=await fetchVideo();if(kind==='mp4'){saveBlob(new Blob([video],{type:'video/mp4'}),fileName('mp4'),'MP4');return;}
 const m4a=extractM4a(video);if(kind==='m4a'){saveBlob(new Blob([m4a],{type:'audio/mp4'}),fileName('m4a'),'M4A');return;}
 const mp3=await toMp3(m4a);saveBlob(mp3,fileName('mp3'),'MP3');
 }catch(e){setStatus(e.message,'bad');}finally{doneProgress();lock(false);}}
function showLocalFile(file){selectedLocal=file;ui.localName.textContent=`Selecionado: ${file.name} · ${(file.size/1048576).toFixed(2)} MB`;ui.convertLocal.disabled=!file;ui.result.hidden=true;}
async function convertLocal(){if(busy||!selectedLocal)return;lock(true);try{if(selectedLocal.size>188743680)throw Error('Envie arquivos com no máximo 180 MB.');progress(12,'Abrindo arquivo do dispositivo...');const bytes=new Uint8Array(await selectedLocal.arrayBuffer());const type=sniff(bytes);
 if(type==='invalid')throw Error('Formato não reconhecido. Arquivos M4A cifrados não são áudio convencional e não podem ser convertidos por esta ferramenta.');
 if(type==='mp3'){saveBlob(new Blob([bytes],{type:'audio/mpeg'}),fileName('mp3',true),'MP3');return;}
 let source=bytes;if(type==='mp4'&&selectedLocal.name.toLowerCase().endsWith('.mp4'))source=extractM4a(bytes);
 const mp3=await toMp3(source);saveBlob(mp3,fileName('mp3',true),'MP3');
 }catch(e){setStatus(e.message,'bad');}finally{doneProgress();lock(false);}}
ui.url.addEventListener('input',()=>{track=null;videoCache=null;ui.actions.hidden=true;ui.songInfo.hidden=true;setFind(validLink(ui.url.value.trim())?'Link válido. Clique em Analisar música.':'Cole um link público do Suno.');});
el('songForm').addEventListener('submit',resolveLink);
ui.getMp3.addEventListener('click',()=>actionForTrack('mp3'));
ui.getM4a.addEventListener('click',()=>actionForTrack('m4a'));
ui.getMp4.addEventListener('click',()=>actionForTrack('mp4'));
ui.localFile.addEventListener('change',()=>showLocalFile(ui.localFile.files?.[0]||null));
ui.convertLocal.addEventListener('click',convertLocal);
ui.localBtn.addEventListener('click',()=>ui.localFile.click());
(async()=>{try{const res=await fetch('suno.php?action=health',{cache:'no-store'});const d=await res.json();ui.check.textContent=d.ok?'Conector PHP pronto':'PHP cURL não está disponível';ui.check.className=d.ok?'health good':'health bad';}catch{ui.check.textContent='Execute na hospedagem com PHP (não apenas HTML local)';ui.check.className='health bad';}})();
