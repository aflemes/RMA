# RMA - Regras do Projeto

## Versionamento
- A cada prompt, gere uma nova versão patch, mesmo que a alteração seja pequena
- Mostre no output a versão gerada (ex: "v1.1.9")
- Atualize SEMPRE ambos os arquivos:
  - `utils.js` — `RMA_BUILD_VERSION`
  - `manifest.json` — `"version"`

## Edição de Código
- Não adicione comentários ao código
- Siga o estilo existente (vanilla JS, sem frameworks, sem bundlers)
- Prefira editar arquivos existentes em vez de criar novos
- Verifique a ordem de carregamento em `init.js` antes de usar dependências entre scripts
