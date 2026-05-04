# Handoff: Workspace Sidebar, Assets e Editor Migration

## Estado Atual

- Branch atual: `master`.
- Último commit relevante no histórico: `59e1a6a feat: side menu tabs, (assets, template) placeholder frontend`.
- Há mudanças locais ainda não commitadas relacionadas à primeira versão funcional da aba `Assets` e sua reorganização de UI.
- Validações rodadas depois das mudanças de Assets:
  - `npm test` passou.
  - `npm run lint` em `client` passou.
  - `npm run build` em `client` passou.

## Contexto Da Reformulação

Estamos no meio de uma reformulação do editor/workspace. O foco recente foi a sidebar da workspace no visual "Nexus":

- A sidebar foi remodelada com header imersivo, nome do mundo, árvore mais limpa e busca no rodapé.
- O menu de contexto foi ajustado para fechar ao clicar fora usando overlay full viewport.
- Criação de documentos na raiz e como filhos não abre mais popup; cria com nome temporário e entra direto em rename inline.
- Seletor de ícones foi reposicionado para abrir corretamente ao lado do ícone, com visual Nexus.
- Menu de contexto ganhou `Duplicar`, com modal perguntando se duplica só o arquivo ou também filhos.
- Delete deixou de usar `window.confirm` e passou a usar modal centralizado com blur/escurecimento.
- Botão de idioma `pt/en` foi reaproveitado e adicionado discretamente no rodapé direito da workspace, fora da sidebar.
- Sidebar ganhou abas: `Wiki`, `Assets`, `Templates`.

## Sidebar Hoje

### Wiki

A aba `Wiki` continua sendo a árvore principal de documentos.

Funcionalidades preservadas:

- selecionar container;
- buscar no rodapé;
- criar raiz por empty state ou clique direito no vazio;
- criar raiz pelo botão no dock inferior acima da busca, visível quando já existe ao menos um documento;
- criar filho por hover/menu de contexto;
- renomear inline;
- deletar com modal;
- duplicar via menu de contexto;
- trocar ícone;
- bloquear ações mutáveis em modo visitante.

Arquivos principais:

- `client/src/WorldWorkspace.jsx`
- `client/src/index.css`
- `client/src/locales/pt.json`
- `client/src/locales/en.json`

### Assets

A aba `Assets` agora tem uma primeira versão funcional.

Backend:

- Pasta padrão do mundo agora inclui `assets` em `src/data/filesystem.js`.
- Diretórios legados `Assets` são migrados/mesclados automaticamente para `assets` ao garantir a estrutura do mundo.
- Serviço novo: `src/services/assets.js`.
- Rotas novas em `src/routes/index.js`:
  - `GET /api/worlds/:id/assets?path=`
  - `POST /api/worlds/:id/assets/folders`
  - `POST /api/worlds/:id/assets/upload?path=&filename=`
  - `GET /api/worlds/:id/assets/file?path=`
  - `PATCH /api/worlds/:id/assets/rename`
  - `PATCH /api/worlds/:id/assets/move`
  - `POST /api/worlds/:id/assets/duplicate`
  - `DELETE /api/worlds/:id/assets?path=`
- `src/services/index.js` exporta o serviço de assets.
- `src/utils/static.js` recebeu MIME types para `webp`, `mp3`, `ogg`, `wav`, `m4a`, `mp4`.

Frontend:

- Upload aceita `image/*`, `.gif`, `audio/*`.
- Imagens estáticas são convertidas no navegador para `.webp` usando `canvas`.
- GIF é preservado para manter animação.
- Áudios web-friendly são salvos sem transcodificação: `mp3`, `ogg`, `wav`, `m4a/mp4`.
- Não há limite rígido de tamanho.
- Arquivos são salvos com base do nome original + extensão final real.
- Conflitos de nome recebem sufixo automático no backend: `nome.webp`, `nome 2.webp`.
- Criação de pasta não abre modal; cria `Nova pasta` e entra em rename inline, como na Wiki.
- Menu de contexto de assets segue o padrão visual da Wiki e permite upload direto na pasta/raiz, criar pasta, mover, duplicar, renomear e deletar conforme o item.
- Visitantes podem listar e visualizar, mas não veem upload/criar pasta.

Testes adicionados:

- `test/services/core-worlds.test.js` cobre:
  - criação/listagem de assets;
  - sanitização de nome;
  - conflito de nome;
  - renomear, mover, duplicar e deletar assets;
  - migração de diretório legado `Assets` para `assets`;
  - bloqueio de path traversal.

### Reorganização Visual Recente De Assets

Foi pedido anteriormente que:

- a pasta raiz `Assets` aparecesse na árvore;
- o conteúdo ficasse dentro dela;
- a busca fique no rodapé como na Wiki;
- upload e criar pasta fiquem no bottom acima da busca.

Isso foi revisado depois: a aba `Assets` agora segue a convenção da `Wiki`, ou seja, a pasta física raiz não aparece no tree. A árvore mostra apenas o conteúdo interno de `assets`.

Estado atual no frontend:

- estado `assetSearchQuery`;
- sem raiz virtual `Assets` visível;
- criação de pasta inline sem popup;
- menu de contexto para arquivos/pastas e área vazia, com upload direto no destino clicado e realocação via modal;
- busca local de assets;
- dock inferior `.assets-bottom-dock`;
- toolbar no bottom acima da barra de busca;
- clique no espaço vazio da árvore volta a seleção para a raiz lógica;
- chip de localização foi removido.

Ponto importante: as APIs públicas continuam iguais; a persistência mudou apenas na convenção física de `Assets` para `assets`, com migração compatível.

## Templates

A aba `Templates` ainda é apenas placeholder visual. Não há backend, listagem, criação, nem integração com editor.

## Estado Dos Arquivos Não Commitados

No momento deste handoff, `git status --short` mostra mudanças em:

- `client/src/WorldWorkspace.jsx`
- `client/src/index.css`
- `client/src/locales/en.json`
- `client/src/locales/pt.json`
- `src/data/filesystem.js`
- `src/routes/index.js`
- `src/services/index.js`
- `src/utils/static.js`
- `test/data/filesystem.test.js`
- `test/services/core-worlds.test.js`
- arquivo novo: `src/services/assets.js`

Essas mudanças são da implementação funcional de Assets, da reorganização visual mais recente e da migração compatível `Assets` -> `assets`.

## Próximos Pontos Prováveis

1. Melhorar ainda mais a UI da aba `Assets`.
   - O usuário gostou mais da reorganização, mas disse que ainda dá para melhorar.
   - Possíveis pontos: densidade da árvore, preview mais elegante, indicação de pasta selecionada, empty states e dock inferior.

2. Verificar manualmente upload real no navegador.
   - Especialmente conversão PNG/JPG para WebP.
   - Confirmar GIF animado preservado.
   - Confirmar `<audio controls>` para MP3/OGG/WAV/M4A.

3. Decidir se Assets precisa de menu de contexto próprio.
   - Nesta versão não foi implementado deletar, renomear ou mover assets.
   - O plano original explicitamente deixou isso fora.

4. Commitar a fase Assets quando a UI estiver aceita.
   - Padrão recente de commits:
     - `feat(workspace): remodel sidebar and streamline document flows`
     - `feat: side menu tabs, (assets, template) placeholder frontend`
   - Sugestão futura: `feat(assets): add sidebar upload and media library`

## Comandos Úteis

```bash
npm test
cd client
npm run lint
npm run build
```

## Observações De Produto

- O usuário está refinando incrementalmente a UI/UX e prefere evoluir junto, testando e corrigindo detalhes.
- Manter o visual dark/Nexus, mas com legibilidade e produtividade.
- Evitar criar funcionalidades amplas antes de fechar a experiência visual básica.
- A sidebar é o foco atual; a área principal/editor ainda está em transição.
