# Handoff: Workspace Sidebar, Assets e Editor Migration

## Estado Atual

- Branch atual: `master`.
- Últimos commits relevantes:
  - `9d80ef2 feat(assets): add sidebar media management`
  - `ffdf25e chore: add more to .gitignore`
- A fase de Assets foi commitada em `9d80ef2`.
- Há mudanças locais ainda não commitadas relacionadas à nova estrutura flutuante da área de edição.
- Validações rodadas depois das mudanças da área de edição:
  - `npm test` passou.
  - `npm run lint` em `client` passou.
  - `npm run build` em `client` passou.
- No momento deste handoff, `git status --short` mostra mudanças em:
  - `HANDOFF_WORKSPACE_SIDEBAR_ASSETS.md`
  - `client/src/WorldWorkspace.jsx`
  - `client/src/index.css`
  - `client/src/locales/en.json`
  - `client/src/locales/pt.json`

## Últimas Validações Conhecidas

Depois da implementação de Assets e depois da remodelação da área de edição, foram rodados:

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

## Área De Edição

A área principal foi remodelada novamente para se aproximar de um fluxo tipo Notion: o topo agora faz parte do documento, em vez de parecer uma barra flutuante separada.

Estado atual:

- o título exibido é o do documento/container selecionado, não o da aba ativa;
- o título pode ser renomeado com duplo clique no cabeçalho da página;
- o duplo clique para renomear deve responder apenas sobre o texto do título, não sobre o espaço vazio da linha;
- o input de renomear título é visualmente limpo, sem caixa/destaque, mostrando apenas o caret;
- o ícone ao lado do título representa o documento/container selecionado e pode ser alterado clicando nele;
- há uma capa/banner no topo da página;
- o banner usa altura maior, atualmente `clamp(190px, 30vh, 340px)` no desktop e `190px` no mobile;
- a capa pode ser adicionada/trocada por upload de imagem/GIF e fica salva em `metadata.coverAssetPath` do documento/container selecionado;
- os controles da capa ficam sempre visíveis no canto superior esquerdo do banner, sem depender de hover;
- a capa pode ser removida, limpando `metadata.coverAssetPath`;
- a capa pode ser reposicionada verticalmente por drag, salvando `metadata.coverPositionY`;
- o drag da capa atualiza a variável CSS diretamente via `requestAnimationFrame` e só sincroniza React/metadata ao soltar, para manter fluidez;
- o upload da capa reutiliza o pipeline de assets, incluindo conversão de imagem estática para `.webp`;
- a lista de abas fica integrada ao cabeçalho do documento, logo abaixo do título, com botão `+` para criar nova aba;
- a aba ativa tem destaque visual mais forte com superfície sutil e linha inferior acesa;
- as abas do editor possuem menu de contexto com renomear, duplicar e excluir;
- renomear aba acontece inline na própria barra de abas;
- criar nova aba não usa popup: o botão `+` abre um painel inline na área de conteúdo;
- o painel inline de nova aba tem input de nome, seleção de tipo `Wiki`/`Mapa`, criar e cancelar;
- ao criar uma aba pelo painel inline, a árvore é atualizada e a aba recém-criada é selecionada automaticamente;
- o controle visualização/edição virou um único cadeado no topo direito do banner;
- o título/ícone agora ficam centrados na linha divisória entre banner e área de edição;
- o header usa `pointer-events` apenas nos elementos interativos para não bloquear o botão de capa;
- as scrollbars visuais da área de edição ficam escondidas, mantendo a rolagem funcional;
- o modo bloqueado/preview não deve ter bloco de fundo destacado; o conteúdo fica direto sobre a superfície;
- a aba ativa é indicada por linha inferior simples, alinhada à linha do seletor;
- a UI recebeu polimento visual no padrão Nexus: animações discretas de entrada, hover nos controles, brilho sutil do ícone e indicador animado nas abas;
- o botão manual de salvar foi removido da UI;
- conteúdo wiki em modo edição usa autosave com debounce e indicador discreto de estado no topo direito do banner;
- ao trocar de aba com alterações pendentes, o app tenta salvar antes de carregar a próxima aba;
- modo visitante não mostra controles mutáveis;
- BlockNote ainda não foi implementado, mas o espaço do editor ficou preparado para essa migração.

Arquivos tocados nesta fase não commitada:

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

No momento deste handoff, as mudanças não commitadas são da fase "Estrutura Flutuante Da Área De Edição":

- `client/src/WorldWorkspace.jsx`
  - remove header/navbar rígido da área principal;
  - usa aba ativa como entidade visual principal;
  - adiciona autosave com debounce e indicador de estado;
  - adiciona seletor de ícone para a aba ativa.
- `client/src/index.css`
  - adiciona a composição flutuante, pílulas de abas, indicador de save e superfície de conteúdo.
- `client/src/locales/en.json` e `client/src/locales/pt.json`
  - adicionam textos de autosave, modo de visualização e estado sem aba ativa.
- `HANDOFF_WORKSPACE_SIDEBAR_ASSETS.md`
  - atualizado para orientar o próximo chat.

## Próximos Pontos Prováveis

1. Revisar manualmente a nova área de edição.
   - Conferir se os controles flutuantes não cobrem o preview/editor em diferentes tamanhos.
   - Validar se o título/ícone sempre seguem a aba ativa.
   - Validar autosave em edição rápida e troca de abas.

2. Commitar a fase da área de edição se a UI estiver aceita.
   - Sugestão: `feat(workspace): add floating editor controls`

3. Preparar a migração para BlockNote.
   - A moldura já está mais limpa.
   - Próximo passo provável é substituir o editor transitório/preview por BlockNote sem refazer a navegação.

4. Verificar manualmente upload real no navegador.
   - Especialmente conversão PNG/JPG para WebP.
   - Confirmar GIF animado preservado.
   - Confirmar `<audio controls>` para MP3/OGG/WAV/M4A.

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
- A sidebar está em um ponto funcional bom; a área principal/editor virou o foco atual.
- BlockNote ainda deve ser tratado como próxima fase, não como algo já integrado.
