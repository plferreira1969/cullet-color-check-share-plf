# Análise Qualitativa Cores de Caco Vidro — versão Netlify com base compartilhada

App (PWA) + API própria no Netlify. Todos os celulares que abrirem o endereço do site usam a
**mesma base**: histórico de análises, banco de imagens e cadastros (equipamentos, superfícies,
tipos, pontos da linha, classes de amostra e cabeçalho do relatório).

## Estrutura

```
triagem-vidro-netlify/
├── netlify.toml                 configuração (pasta publicada, functions, cabeçalhos)
├── package.json                 dependência @netlify/blobs
├── netlify/functions/api.mjs    API em /api/* (Netlify Functions)
└── public/                      o app
    ├── index.html               app completo (análise, histórico, imagens, ajustes, relatório PDF)
    ├── sw.js                    service worker (offline; nunca guarda a API em cache)
    ├── manifest.webmanifest     instalação na tela inicial
    ├── icon-192.png / icon-512.png
    ├── ff/                      conversor HEVC → MP4 (ffmpeg.wasm, baixado só quando usado)
    └── historico_15-16out.csv   histórico inicial para importar
```

**Onde ficam os dados:** Netlify Blobs, armazenamento que já vem no Netlify, sem banco externo.
- store `dados`: `config` (cadastros), `analises/<id>` e `imagens/<id>` (documentos JSON)
- store `imagens`: os arquivos JPEG

## Publicar (escolha um caminho)

> O "arrastar e soltar" (Netlify Drop) **não** roda a API. Nesse caso o app abre, mas cada
> celular fica com seus próprios dados. Use um dos caminhos abaixo.

### A) GitHub + Netlify (recomendado: cada atualização publica sozinha)
1. Crie um repositório no GitHub e envie esta pasta inteira (sem `node_modules`).
2. No Netlify: **Add new project → Import an existing project → GitHub** e escolha o repositório.
   As configurações vêm do `netlify.toml`; não precisa mudar nada.
3. Em **Project configuration → Environment variables**, crie `APP_KEY` com o código de acesso da
   equipe (ex.: uma frase longa). Depois faça **Deploys → Trigger deploy**.

### B) Netlify CLI (pelo computador)
```bash
npm install -g netlify-cli
cd triagem-vidro-netlify
npm install
netlify login
netlify init          # cria o site e liga a esta pasta
netlify env:set APP_KEY "seu-codigo-da-equipe"
netlify deploy --prod
```

## Primeiro uso
1. Abra o endereço do site no celular e digite o código de acesso (o mesmo de `APP_KEY`).
   O código fica salvo no aparelho.
2. Aba **Histórico → Importar CSV** → escolha `historico_15-16out.csv` para carregar as 11 análises de 15–16/10.
3. Instale na tela inicial: iPhone (Safari) → Compartilhar → Adicionar à Tela de Início;
   Android (Chrome) → menu → Instalar app.

O cabeçalho do app mostra **"base compartilhada"** quando está ligado à API. Os outros celulares
recebem as mudanças em até 30 s ou ao voltar para o app.

## Segurança e limites
- Sem `APP_KEY`, qualquer pessoa com o endereço lê e grava. **Defina a variável.**
- Para trocar o código, mude `APP_KEY` e publique de novo. Os celulares pedem o código novo.
- O código de acesso é um só para toda a equipe. Não há usuário individual nem registro de quem alterou.
- Imagens até ~5,5 MB por arquivo (o app já reduz para 1600 px, normalmente < 1 MB).
- Última gravação vence: dois celulares editando o mesmo cadastro ao mesmo tempo, fica a última.
- Uso de Functions e Blobs entra na cota do plano Netlify. Confira o plano da conta.

## Rotas da API
| Método | Rota | Uso |
|---|---|---|
| GET | /api/ping | testa a API e se o código é necessário/válido |
| GET/PUT | /api/config | cadastros |
| GET | /api/list/analises · /api/list/imagens | lista documentos |
| POST | /api/doc/:colecao | cria documento |
| PUT/DELETE | /api/doc/:colecao/:id | altera / apaga |
| POST | /api/blob | grava imagem (corpo binário) |
| GET/DELETE | /api/blob/:id | lê (`?k=código`) / apaga imagem |

Todas as rotas, exceto `/api/ping`, exigem o cabeçalho `x-app-key: <APP_KEY>`.
