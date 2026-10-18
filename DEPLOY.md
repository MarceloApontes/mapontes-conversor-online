# Implantação em servidor PHP

1. Contrate/utilize uma hospedagem com PHP 8+ e SSL ativo.
2. Envie `index.html`, `suno.php` e a pasta `assets` para o mesmo diretório público.
3. Verifique que `suno.php?action=health` responde em JSON com `"ok":true`.
4. Teste um arquivo MP3 local. Em seguida, teste um link público do Suno autorizado.
5. Se o link não produzir MP4, isso pode indicar que não há vídeo público ou que a origem bloqueia o acesso. Não confunda com erro na conversão de um M4A convencional.
6. Observe as regras de uso da plataforma, tempo máximo de PHP, memória, espaço temporário e limites de tráfego da sua hospedagem.

**Não utilizar apenas GitHub Pages** para os recursos de link do Suno. Pages é hospedagem estática e não executa `suno.php`.

**Atenção:** não coloque tokens, cookies ou senhas em arquivos públicos do GitHub. Este pacote não inclui credenciais.