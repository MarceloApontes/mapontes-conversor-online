# 🎵 MAPONTES Audio Lab — Conversor Online v4.0

Projeto independente de interface web para conversão de arquivos de áudio e tentativa de obtenção de **vídeo MP4 público** de uma música compartilhada no Suno, com extração de sua faixa AAC para M4A e conversão opcional para MP3 no navegador.

> **Versão experimental:** ainda **não foi confirmado** que os servidores do Suno entregam mídia MP4 para as músicas de exemplo. Nem todo link público oferece uma fonte para download. Este projeto não remove DRM, não descriptografa M4A e não acessa conteúdo privado.

## Funcionalidades

- Colar endereços `https://suno.com/song/UUID` e `https://suno.com/s/CODIGO`.
- Tentar identificar o link, consultar metadados e buscar um vídeo MP4 público da música.
- Quando um MP4 comum está disponível, extrair a faixa AAC em M4A sem recodificá-la.
- Converter o áudio para MP3 no navegador com opções de 128, 192, 256 ou 320 kbps (recodificação com perdas).
- Converter arquivos locais compatíveis; MP3 enviado é apenas preparado para baixar.
- Validar os formatos e comunicar quando a mídia não estiver disponível.

## Requisitos

- Servidor web com **PHP 8 ou superior**; cURL com HTTPS recomendado (`allow_url_fopen` como alternativa).
- Navegador atualizado, JavaScript ativado, suporte a `OfflineAudioContext`/`decodeAudioData`.
- Internet para baixar `lamejs` da CDN usada pelo front-end.

## Executar

Copie `index.html`, `suno.php` e a pasta `assets/` para **a mesma pasta** da hospedagem, por exemplo `public_html/conversor/`. Abra por HTTPS, marque a confirmação de autorização e cole um link de música pública. O indicador do canto superior deve mostrar **Conector PHP pronto**.

Para testar localmente, use PHP instalado:

```bash
php -S 127.0.0.1:8080
```

Abra `http://127.0.0.1:8080/` no navegador. Para uso público, use um servidor web configurado com HTTPS e limites adequados.

## ⚠️ GitHub Pages

**GitHub Pages não executa PHP.** Ele pode exibir a interface estática, mas os botões que precisam de `suno.php` não funcionarão se você publicar apenas pelo Pages. Para usar a extração por link, hospede todos os arquivos em um serviço que suporte PHP. Alternativamente, uma futura versão poderá separar o front-end e uma API hospedada em outro lugar.

## Organização

```text
index.html                 Interface web
suno.php                   Resolução de links e obtenção restrita de MP4 público
assets/app.js              Interface e conversão MP3
assets/mp4audio.js         Extração de áudio MP4 -> M4A
LICENSE-SUNO-CAPTURE.txt   Aviso MIT da rotina adaptada
README.md                  Documentação do projeto
DEPLOY.md                  Instalação em hospedagem PHP e limitações
.gitignore                 Arquivos locais ignorados
```

## Limites técnicos

- O código somente tenta acessar endpoints públicos e URLs de MP4 correspondentes à música; isso **não garante** download em todos os links.
- A disponibilidade de mídia e o acesso aos endpoints podem mudar sem aviso.
- Conversão de AAC para MP3 **não melhora** a qualidade do áudio.
- O servidor limita o tamanho do MP4 a 180 MiB.
- Áudios locais são processados no navegador. Para links públicos, o servidor PHP recebe o URL e transfere a mídia.
- Use apenas mídias que você tenha direito de baixar ou converter, respeitando os termos da plataforma.

## Créditos

Projeto MAPONTES. Independente e não afiliado ao Suno ou UseSuno. Parte do módulo de remux é adaptada do projeto [Suno Capture](https://github.com/cs-eliseev/suno-music-downloader) sob licença MIT, reproduzida em `LICENSE-SUNO-CAPTURE.txt`.