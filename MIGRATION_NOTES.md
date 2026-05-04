# Notas de Reestruturação e Migração - Mythra

## Premissas de Arquitetura de Dados

### 1. Reestruturação da Hierarquia de Documentos
- **Nós da Sidebar (Raiz)**: 
    - Devem ser tratados apenas como contêineres organizacionais.
    - **Não** devem possuir um arquivo `index.md` próprio.
    - Devem conter apenas `metadata.json` para definir propriedades do nó (nome, ícone, etc.).
- **Arquivos Editáveis (Abas)**:
    - O conteúdo editável reside exclusivamente nas abas.
    - No sistema de arquivos, estas abas continuam sendo sub-diretórios ou arquivos dentro da pasta do nó raiz, mas a lógica de edição é restrita a elas.
    - Isso elimina a redundância de ter um conteúdo "na pasta pai" que compete com o conteúdo das abas filhas.

---

### 2. Remoção do Sistema de Entities
- O sistema de `entities` (Character, Location, Item, Event) será **descontinuado**.
- Toda a lógica de dados do mundo deve ser centralizada no sistema de Documentos e Abas.
- Os arquivos e serviços relacionados a `entities` serão removidos na migração para limpar o codebase.

---

### 3. Remoção do Sistema de Relations Atual
- O sistema de `relations` (extração de links via regex no Markdown) será **descontinuado**.
- A funcionalidade de conexões entre páginas será refeita do zero após a migração, para ser compatível com a nova estrutura de dados do editor de blocos.

---

### 4. Simplificação Extrema (Lean Migration)
- **Funcionalidades Suspensas**: `templates`, `maps` e `media`.
- **Objetivo**: Reduzir o projeto ao seu núcleo essencial (**Core Hierarchy**).
- **Estratégia**: Remover estas funcionalidades do codebase atual para garantir que a migração do editor e da nova estrutura de abas seja feita de forma limpa e sem interferências de sistemas legados. Elas serão reconstruídas sobre a nova arquitetura em fases posteriores.

---
*Documento em construção para futura migração funcional.*
