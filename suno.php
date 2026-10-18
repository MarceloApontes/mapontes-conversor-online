<?php
declare(strict_types=1);
/**
 * MAPONTES Audio Lab 4.0 — pública e estritamente limitada ao domínio Suno.
 * Nenhuma URL arbitrária é baixada. Sem cookies, login, chave ou desproteção.
 * Fluxo principal: CDN de vídeo MP4 público -> MP4 no navegador -> M4A -> MP3.
 * Requer PHP >=8.0 e extensão cURL com HTTPS. Não exige FFmpeg no host.
 */
header('Cache-Control: no-store, private');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: no-referrer');
header('X-Robots-Tag: noindex, nofollow');
const UUID_RX='[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}';
const MAX_META=1600000;
const MAX_VIDEO=188743680; // 180 MiB
function response(int $code,array $data): never {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
    exit;
}
function errorResponse(int $code,string $message): never {response($code,['ok'=>false,'error'=>$message]);}
function curlCheck(): void {if(!function_exists('curl_init') && !filter_var(ini_get('allow_url_fopen'), FILTER_VALIDATE_BOOLEAN)) errorResponse(503,'A hospedagem precisa habilitar PHP cURL ou allow_url_fopen.');}
function streamOptions(int $timeout,string $accept): array {return ['http'=>['method'=>'GET','timeout'=>$timeout,'ignore_errors'=>true,'follow_location'=>0,'max_redirects'=>0,'header'=>"Accept: $accept\r\nUser-Agent: Mozilla/5.0 MAPONTES-Audio-Lab/4.0\r\n"],'ssl'=>['verify_peer'=>true,'verify_peer_name'=>true]];}
function streamStatus(array $headers): int {foreach($headers as $h){if(preg_match('~^HTTP/\S+\s+(\d{3})~i',(string)$h,$m))return (int)$m[1];}return 0;}
function streamHeaders(array $headers): array {$out=[];foreach($headers as $h){if(str_contains((string)$h,':')){[$k,$v]=explode(':',(string)$h,2);$out[strtolower(trim($k))]=trim($v);}}return $out;}
function checkId(string $s): string {if(!preg_match('~^'.UUID_RX.'$~iD',$s))errorResponse(400,'ID inválido.');return strtolower($s);}
function parsePublicUrl(string $s): array {
    $s=trim($s);
    if(strlen($s)>1700)errorResponse(400,'URL muito longa.');
    $p=parse_url($s);
    if(!is_array($p)||strtolower((string)($p['scheme']??''))!=='https'
       ||!in_array(strtolower((string)($p['host']??'')),['suno.com','www.suno.com'],true)
       ||isset($p['user'])||isset($p['pass'])||isset($p['port']))errorResponse(400,'Utilize HTTPS e um link de suno.com.');
    $path=rtrim((string)($p['path']??''),'/');
    if(preg_match('~^/song/('.UUID_RX.')$~iD',$path,$m))return ['id'=>strtolower($m[1]),'short'=>null];
    if(preg_match('~^/s/([A-Za-z0-9_-]{6,64})$~D',$path,$m))return ['id'=>null,'short'=>$m[1]];
    errorResponse(400,'Cole o endereço de uma música: suno.com/song/... ou suno.com/s/...');
}
function getSmall(string $url,int $limit=MAX_META): array {
    if(!function_exists('curl_init')){
        $fp=@fopen($url,'rb',false,stream_context_create(streamOptions(25,'application/json, text/html;q=0.8, */*;q=0.5')));
        if($fp===false)return ['ok'=>false,'status'=>0,'headers'=>[],'body'=>''];
        $headers=(array)(stream_get_meta_data($fp)['wrapper_data']??[]);$code=streamStatus($headers);$body='';$over=false;
        while(!feof($fp)){$chunk=fread($fp,min(65536,$limit-strlen($body)+1));if($chunk===false)break;$body.=$chunk;if(strlen($body)>$limit){$over=true;break;}}
        fclose($fp);return ['ok'=>!$over,'status'=>$code,'headers'=>streamHeaders($headers),'body'=>$body];
    }
    $head=[];$body='';$size=0;
    $ch=curl_init($url);
    curl_setopt_array($ch,[
      CURLOPT_FOLLOWLOCATION=>false, CURLOPT_CONNECTTIMEOUT=>7, CURLOPT_TIMEOUT=>20,
      CURLOPT_SSL_VERIFYPEER=>true, CURLOPT_SSL_VERIFYHOST=>2,
      CURLOPT_USERAGENT=>'Mozilla/5.0 (compatible; MAPONTES-Audio-Lab/4.0)',
      CURLOPT_HTTPHEADER=>['Accept: application/json, text/html;q=0.8, */*;q=0.5'],
      CURLOPT_HEADERFUNCTION=>static function($ch,string $h)use(&$head):int{
        if(str_contains($h,':')){[$k,$v]=explode(':',$h,2);$head[strtolower(trim($k))]=trim($v);}return strlen($h);
      },
      CURLOPT_WRITEFUNCTION=>static function($ch,string $chunk)use(&$body,&$size,$limit):int {
        $n=strlen($chunk);if($size+$n>$limit)return 0;$body.=$chunk;$size+=$n;return $n;
      },
    ]);
    $ok=curl_exec($ch);$status=(int)curl_getinfo($ch,CURLINFO_RESPONSE_CODE);curl_close($ch);
    return ['ok'=>$ok!==false,'status'=>$status,'headers'=>$head,'body'=>$body];
}
function expandShort(string $short): string {
    $url='https://suno.com/s/'.rawurlencode($short);
    for($i=0;$i<3;$i++){
        $r=getSmall($url);
        $location=(string)($r['headers']['location']??'');
        if($location!==''){
            if(str_starts_with($location,'/'))$location='https://suno.com'.$location;
            $parsed=parsePublicUrl($location);
            if($parsed['id'])return $parsed['id'];
            $url='https://suno.com/s/'.rawurlencode($parsed['short']);
            continue;
        }
        // Suno sometimes serves a 200 HTML page containing a canonical song link.
        if($r['ok']&&$r['status']===200 && preg_match('~(?:https?://(?:www\.)?suno\.com)?/song/('.UUID_RX.')~i',$r['body'],$m))return strtolower($m[1]);
        break;
    }
    errorResponse(422,'Não foi possível identificar esse link curto. Abra no Suno e copie o endereço completo /song/UUID.');
}
function safeTitle(string $title): string {
    $title=strip_tags($title);
    $title=preg_replace('/[\\\\\/:*?"<>|\x00-\x1F\x7F]/u',' ',trim($title))??'Música do Suno';
    $title=trim(preg_replace('/\s+/u',' ',$title)??'');
    return $title!==''?substr($title,0,120):'Música do Suno';
}
function videoAllowed(string $url,string $id): bool {
    $p=parse_url($url);
    if(!is_array($p)||strtolower((string)($p['scheme']??''))!=='https'||isset($p['user'])||isset($p['pass'])||isset($p['port']))return false;
    $host=strtolower((string)($p['host']??''));
    return in_array($host,['cdn1.suno.ai','cdn2.suno.ai'],true) && strtolower((string)($p['path']??''))==='/'.$id.'.mp4';
}
function clipInfo(string $id): array {
    $info=['title'=>'Música do Suno','artist'=>'Suno','video_urls'=>[],'known'=>false];
    $url='https://studio-api.prod.suno.com/api/clip/'.$id;
    $r=getSmall($url);
    if($r['ok']&&$r['status']===200){
        $json=json_decode($r['body'],true);
        $clip=is_array($json)?($json['clip']??$json['data']??$json):null;
        if(is_array($clip)){
            $info['known']=true;
            if(array_key_exists('is_public',$clip)&&$clip['is_public']===false)errorResponse(403,'A música não está identificada como pública.');
            if(is_string($clip['title']??null))$info['title']=safeTitle($clip['title']);
            if(is_string($clip['display_name']??null))$info['artist']=safeTitle($clip['display_name']);
            $candidate=$clip['video_url']??'';
            if(is_string($candidate)&&videoAllowed($candidate,$id))$info['video_urls'][]=$candidate;
        }
    }
    // Fallback constructed from the public video CDN convention.
    $info['video_urls'][]='https://cdn1.suno.ai/'.$id.'.mp4';
    $info['video_urls'][]='https://cdn2.suno.ai/'.$id.'.mp4';
    $info['video_urls']=array_values(array_unique($info['video_urls']));
    return $info;
}
function getVideo(string $url): ?array {
    if(!function_exists('curl_init')){
        $src=@fopen($url,'rb',false,stream_context_create(streamOptions(130,'video/mp4, */*;q=0.2')));
        if($src===false)return null;
        $code=streamStatus((array)(stream_get_meta_data($src)['wrapper_data']??[]));
        if($code!==200){fclose($src);return null;}
        $tmp=tmpfile();if(!$tmp){fclose($src);errorResponse(503,'Sem espaço temporário no servidor.');}
        $written=0;while(!feof($src)){$chunk=fread($src,65536);if($chunk===false)break;$n=strlen($chunk);$written+=$n;if($written>MAX_VIDEO){fclose($src);fclose($tmp);errorResponse(413,'Vídeo maior que 180 MB.');}if($n&&!fwrite($tmp,$chunk)){fclose($src);fclose($tmp);return null;}}
        fclose($src);rewind($tmp);$prefix=fread($tmp,24);rewind($tmp);
        if($written<64||!is_string($prefix)||substr($prefix,4,4)!=='ftyp'){fclose($tmp);return null;}
        return ['file'=>$tmp,'size'=>$written];
    }
    $tmp=tmpfile();if(!$tmp)errorResponse(503,'Não há espaço para arquivo temporário no servidor.');
    $written=0;$over=false;$ch=curl_init($url);
    curl_setopt_array($ch,[
        CURLOPT_FOLLOWLOCATION=>false, CURLOPT_CONNECTTIMEOUT=>8, CURLOPT_TIMEOUT=>135,
        CURLOPT_SSL_VERIFYPEER=>true, CURLOPT_SSL_VERIFYHOST=>2,
        CURLOPT_USERAGENT=>'Mozilla/5.0 (compatible; MAPONTES-Audio-Lab/4.0)',
        CURLOPT_HTTPHEADER=>['Accept: video/mp4, */*;q=0.2'],
        CURLOPT_WRITEFUNCTION=>static function($ch,string $data)use($tmp,&$written,&$over):int{
            $len=strlen($data);if($written+$len>MAX_VIDEO){$over=true;return 0;}
            $n=fwrite($tmp,$data);if($n===false)return 0;$written+=$n;return $n;
        },
    ]);
    $ok=curl_exec($ch);$status=(int)curl_getinfo($ch,CURLINFO_RESPONSE_CODE);curl_close($ch);
    if($over){fclose($tmp);errorResponse(413,'Vídeo maior que o limite de 180 MB.');}
    if($ok===false||$status!==200||$written<64){fclose($tmp);return null;}
    rewind($tmp);$head=fread($tmp,24);rewind($tmp);
    if(!is_string($head)||substr($head,4,4)!=='ftyp'){fclose($tmp);return null;}
    return ['file'=>$tmp,'size'=>$written];
}
$action=(string)($_GET['action']??'');
if($action==='health')response(200,['ok'=>(function_exists('curl_init')||filter_var(ini_get('allow_url_fopen'),FILTER_VALIDATE_BOOLEAN)),'php'=>PHP_VERSION,'curl'=>function_exists('curl_init'),'streams'=>filter_var(ini_get('allow_url_fopen'),FILTER_VALIDATE_BOOLEAN),'method'=>'video_mp4_publico']);
if($action==='resolve'){
    if(($_SERVER['REQUEST_METHOD']??'')!=='POST')errorResponse(405,'Use POST.');
    curlCheck();
    $in=json_decode((string)file_get_contents('php://input',false,null,0,2048),true);
    $parsed=parsePublicUrl((string)($in['url']??''));
    $id=$parsed['id']?:expandShort($parsed['short']);
    $info=clipInfo($id);
    response(200,['ok'=>true,'id'=>$id,'title'=>$info['title'],'artist'=>$info['artist'],
      'page'=>'https://suno.com/song/'.$id,
      'note'=>$info['known']?'Metadados localizados. O download depende da disponibilidade do vídeo público.':'Link reconhecido. Não foi possível confirmar metadados; tentaremos a mídia pública.']);
}
if($action==='video'){
    if(($_SERVER['REQUEST_METHOD']??'')!=='GET')errorResponse(405,'Use GET.');
    curlCheck();
    $id=checkId((string)($_GET['id']??''));
    if(function_exists('set_time_limit'))@set_time_limit(170);
    $info=clipInfo($id);
    foreach($info['video_urls'] as $url){
        if(!videoAllowed($url,$id))continue;
        $r=getVideo($url);
        if(!$r)continue;
        header('Content-Type: video/mp4');
        header('Content-Length: '.$r['size']);
        header('Content-Disposition: attachment; filename="Suno-'.$id.'.mp4"');
        header('X-MAPONTES-Source: public-video');
        fpassthru($r['file']);fclose($r['file']);exit;
    }
    errorResponse(502,'Nenhum MP4 público válido foi disponibilizado para esta música. Talvez não exista vídeo, ou o acesso esteja restrito pelo Suno.');
}
errorResponse(404,'Ação desconhecida.');
