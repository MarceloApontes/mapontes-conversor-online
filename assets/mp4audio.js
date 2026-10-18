/*
 * MAPONTES Audio Lab — MP4 -> M4A remux (AAC/ALAC audio samples, no re-encoding).
 * Based on the MP4 audio-track remuxer from Suno Capture by cs-eliseev:
 * https://github.com/cs-eliseev/suno-music-downloader
 * Suno Capture is MIT licensed. See LICENSE-SUNO-CAPTURE.txt.
 * Only for conventional, unencrypted MP4 files containing an audio track.
 */
(function (root) {
 'use strict';
 const enc=new TextEncoder();
 const containers=new Set(['moov','trak','mdia','minf','stbl']);
 function num(d,p){return ((d[p]<<24)|(d[p+1]<<16)|(d[p+2]<<8)|d[p+3])>>>0;}
 function num64(d,p){return num(d,p)*4294967296+num(d,p+4);}
 function name(d,p){return String.fromCharCode(d[p],d[p+1],d[p+2],d[p+3]);}
 function boxes(d,start,end){const a=[];let p=start;while(p+8<=end){let n=num(d,p),h=8;if(n===1){if(p+16>end)throw Error('MP4 incompleto');n=num64(d,p+8);h=16;}else if(n===0)n=end-p;if(n<h||p+n>end||!Number.isSafeInteger(n))throw Error('MP4 com estrutura inválida');a.push({type:name(d,p+4),start:p,end:p+n,body:p+h});p+=n;}return a;}
 function child(d,b,t){return boxes(d,b.body,b.end).find(v=>v.type===t)||null;}
 function descend(d,b,path){for(const t of path)b=b?child(d,b,t):null;return b;}
 function cat(parts){const l=parts.reduce((a,b)=>a+b.length,0),out=new Uint8Array(l);let p=0;for(const b of parts){out.set(b,p);p+=b.length;}return out;}
 function be32(v){if(!Number.isSafeInteger(v)||v<0||v>4294967295)throw Error('MP4 acima do limite do conversor');return Uint8Array.from([v>>>24,v>>>16&255,v>>>8&255,v&255]);}
 function latin(s){return Uint8Array.from(s,c=>c.charCodeAt(0)&255);}
 function box(t,...chunks){let l=8+chunks.reduce((a,b)=>a+b.length,0);return cat([be32(l),latin(t),...chunks]);}
 function whole(d,b){return d.subarray(b.start,b.end);}
 function stsz(d,stbl){const b=child(d,stbl,'stsz');if(!b)throw Error('Formato do MP4 não suportado (stsz ausente)');const fixed=num(d,b.body+4),count=num(d,b.body+8);if(count>2000000||b.body+12+(fixed?0:4*count)>b.end)throw Error('Tabela de amostras inválida');return Array.from({length:count},(_,i)=>fixed||num(d,b.body+12+4*i));}
 function offsets(d,stbl){let b=child(d,stbl,'stco');if(b){const n=num(d,b.body+4);if(n>100000||b.body+8+n*4>b.end)throw Error('Tabela de chunks inválida');return Array.from({length:n},(_,i)=>num(d,b.body+8+i*4));}b=child(d,stbl,'co64');if(!b)throw Error('MP4 não possui tabela stco/co64');const n=num(d,b.body+4);if(n>100000||b.body+8+n*8>b.end)throw Error('Tabela co64 inválida');return Array.from({length:n},(_,i)=>num64(d,b.body+8+i*8));}
 function chunkCounts(d,stbl,n){const b=child(d,stbl,'stsc');if(!b)throw Error('MP4 sem tabela stsc');const qty=num(d,b.body+4);if(qty>100000||b.body+8+12*qty>b.end)throw Error('Tabela stsc inválida');const runs=Array.from({length:qty},(_,i)=>({start:num(d,b.body+8+i*12),per:num(d,b.body+12+i*12)}));const out=new Array(n);for(let r=0;r<runs.length;r++){const a=runs[r].start-1,z=r+1<runs.length?runs[r+1].start-1:n;for(let i=a;i<z&&i<n;i++)out[i]=runs[r].per;}return out;}
 function audioRanges(d,stbl){const off=offsets(d,stbl),sizes=stsz(d,stbl),counts=chunkCounts(d,stbl,off.length);let si=0;return off.map((start,c)=>{let len=0;for(let j=0;j<(counts[c]||0)&&si<sizes.length;j++)len+=sizes[si++];if(start+len>d.length)throw Error('Mídia incompleta: chunk além do arquivo');return {start,length:len};});}
 function rebuild(d,b,offsets){if(b.type==='stco'||b.type==='co64'){return box('stco',new Uint8Array(4),be32(offsets.length),...offsets.map(be32));}if(!containers.has(b.type))return whole(d,b);return box(b.type,...boxes(d,b.body,b.end).map(v=>rebuild(d,v,offsets)));}
 function handler(d,track){const h=descend(d,track,['mdia','hdlr']);return h?name(d,h.body+8):'';}
 function extractAudio(bytes){const d=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes);const top=boxes(d,0,d.length),moov=top.find(v=>v.type==='moov');if(top.some(v=>v.type==='moof'))throw Error('Vídeo MP4 fragmentado não é compatível com a extração local.');if(!moov)throw Error('Vídeo inválido: caixa moov não encontrada.');const kids=boxes(d,moov.body,moov.end);const track=kids.find(v=>v.type==='trak'&&handler(d,v)==='soun');if(!track)throw Error('O vídeo não contém uma faixa de áudio.');const stbl=descend(d,track,['mdia','minf','stbl']);if(!stbl)throw Error('Tabela de áudio ausente no vídeo.');const ranges=audioRanges(d,stbl);const mvhd=kids.find(v=>v.type==='mvhd');const ftyp=box('ftyp',enc.encode('M4A '),be32(0),enc.encode('M4A '),enc.encode('mp42'),enc.encode('isom'));
 const createMoov=(off)=>box('moov',...(mvhd?[whole(d,mvhd)]:[]),rebuild(d,track,off));const test=createMoov(ranges.map(()=>0));let next=ftyp.length+test.length+8;const starts=ranges.map(r=>{const s=next;next+=r.length;return s;});const mdat=box('mdat',...ranges.map(r=>d.subarray(r.start,r.start+r.length)));return cat([ftyp,createMoov(starts),mdat]);}
 root.MapontesMP4={extractAudio};
})(typeof self!=='undefined'?self:globalThis);
