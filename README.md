# Portfólio — Alyton Cogo

Portfólio pessoal para apresentar a trajetória, os projetos e as formas de contato de Alyton Cogo. O site é uma aplicação estática feita com Astro, com conteúdo administrável pelo Sanity e projetos obtidos da API do GitHub.

## Conteúdo

- Página inicial com apresentação profissional.
- Seção sobre e linha do tempo.
- Página de projetos em `/projects`.
- Formulário de contato protegido com Cloudflare Turnstile e enviado ao endpoint configurado.
- Layout responsivo com tema escuro e fonte Fira Code local.
- Sanity Studio para editar conteúdo do site.
- Integração com GitHub para listar repositórios públicos do perfil `toncogo`.

## Tecnologias

- [Astro](https://astro.build/) para geração do site estático.
- [Tailwind CSS 4](https://tailwindcss.com/) integrado pelo plugin do Vite.
- [Sanity](https://www.sanity.io/) para gerenciamento de conteúdo.
- API REST do GitHub para obter repositórios.
- [Cloudflare Pages](https://pages.cloudflare.com/) para hospedagem e deploy.
- Cloudflare Turnstile para proteção do formulário de contato.
- Cloudflare Workers e Resend podem ser usados no endpoint de envio de e-mail, conforme a configuração do ambiente.

## Requisitos

- Node.js em uma versão LTS compatível com as dependências do projeto.
- npm.
- Acesso ao projeto Sanity para editar conteúdo.
- Conta Cloudflare para publicar o site e configurar variáveis de produção.

## Instalação e execução local

Clone o repositório e instale as dependências:

```bash
git clone <URL_DO_REPOSITORIO>
cd <PASTA_DO_PROJETO>
npm ci
```

Crie um arquivo `.env` na raiz usando `.env.example` como referência e preencha as variáveis necessárias. Em seguida, inicie o servidor local:

```bash
npm run dev
```

O Astro informa no terminal o endereço local, normalmente `http://localhost:4321`.

## Variáveis de ambiente

Use `.env.example` como modelo. Nunca publique tokens, chaves privadas ou arquivos `.env` no GitHub.

### Site Astro

```dotenv
PUBLIC_SANITY_PROJECT_ID=
PUBLIC_SANITY_DATASET=production
PUBLIC_GITHUB_USERNAME=toncogo
PUBLIC_CONTACT_API_URL=
PUBLIC_TURNSTILE_SITE_KEY=
```

As variáveis `PUBLIC_*` são disponibilizadas ao código executado no navegador. Use somente valores que possam ser públicos, como o ID do projeto Sanity, o nome de usuário do GitHub, a URL do endpoint e a chave pública do Turnstile.

### Sanity Studio

```dotenv
SANITY_STUDIO_PROJECT_ID=
SANITY_STUDIO_DATASET=production
```

O ID do projeto Sanity usado pelo site e pelo Studio deve apontar para o mesmo projeto. O dataset usado atualmente é `production`.

### Endpoint de contato

As credenciais do serviço de e-mail e os demais segredos devem ficar somente no ambiente do endpoint — por exemplo, como secrets do Cloudflare Worker. Para desenvolvimento local de um Worker, mantenha-os em `workers/contact/.dev.vars`, se esse diretório fizer parte da configuração atual:

```dotenv
RESEND_API_KEY=
CONTACT_EMAIL=
CONTACT_FROM_EMAIL=
```

Não use o prefixo `PUBLIC_` em segredos. Não reutilize nem copie valores de chaves privadas para este README.

## Comandos

Os comandos principais do projeto são:

| Comando | Descrição |
| --- | --- |
| `npm run dev` | Inicia o servidor de desenvolvimento Astro. |
| `npm run build` | Gera a versão estática de produção em `dist/`. |
| `npm run preview` | Exibe localmente a versão gerada para produção. |
| `npm run studio` | Inicia o Sanity Studio localmente. |

Se o endpoint de contato estiver neste repositório como Cloudflare Worker, o deploy dele pode ser feito pelo script `npm run contact:deploy`, depois de configurar os segredos e o ambiente no Cloudflare.

## Sanity Studio

Inicie o Studio com:

```bash
npm run studio
```

O terminal mostrará o endereço local, normalmente `http://localhost:3333`. Entre com a conta autorizada no projeto Sanity e edite o conteúdo pelos schemas disponíveis no Studio. Depois de publicar uma alteração, gere um novo build e faça deploy do site para refletir o conteúdo atualizado na versão estática.

## GitHub e listagem de projetos

O perfil usado para carregar repositórios é definido por `PUBLIC_GITHUB_USERNAME`. A leitura de repositórios públicos pode funcionar sem autenticação; se o projeto usar `GITHUB_TOKEN` durante o build para aumentar o limite da API, configure-o como variável privada no ambiente de build do Cloudflare e nunca como `PUBLIC_GITHUB_TOKEN`.

## Formulário de contato

O frontend envia os dados para o endereço definido em `PUBLIC_CONTACT_API_URL` e usa `PUBLIC_TURNSTILE_SITE_KEY` para exibir e validar o Turnstile. O endpoint deve validar a requisição e encaminhar o e-mail usando credenciais mantidas no servidor, como `RESEND_API_KEY`, `CONTACT_FROM_EMAIL` e `CONTACT_EMAIL`.

Para desenvolvimento local com Cloudflare Workers, configure as chaves privadas no arquivo local `.dev.vars` correspondente ao Worker. Para produção, armazene os segredos nas configurações do Cloudflare. O `.dev.vars` não deve ser enviado ao repositório.

## Build e publicação

Gere e confira a versão de produção localmente:

```bash
npm run build
npm run preview
```

Na configuração do Cloudflare Pages, use:

- **Comando de build:** `npm run build`
- **Diretório de saída:** `dist`
- **Branch de produção:** `production`
- **Branch de teste/preview:** `test`

Configure as variáveis de ambiente necessárias em cada ambiente do Cloudflare Pages. O deploy de produção deve usar as variáveis de produção; o ambiente de preview deve usar suas próprias variáveis e endpoint de teste, quando aplicável. Se o Worker de contato for um projeto separado, publique-o e configure sua URL em `PUBLIC_CONTACT_API_URL` antes de reconstruir o site.

## Fluxo de trabalho com branches

- `test`: desenvolvimento e validação por deploy de preview.
- `production`: versão estável publicada em produção.

Faça alterações em `test`, confira o preview e integre as mudanças em `production` quando estiverem prontas para publicação.

## Segurança

- Não versione `.env`, `.dev.vars`, tokens do GitHub, chaves do Resend ou credenciais de contas.
- Mantenha segredos do endpoint apenas no ambiente de servidor/Worker.
- Use chaves distintas para desenvolvimento, preview e produção sempre que disponíveis.
- Valide no endpoint os dados recebidos pelo formulário; a proteção do Turnstile no navegador não substitui a validação do servidor.
- Revogue e substitua qualquer chave privada que tenha sido publicada ou compartilhada acidentalmente.

## Licença

Este repositório contém o portfólio pessoal de Alyton Cogo. Defina aqui uma licença explícita caso o código ou os recursos sejam destinados à reutilização por terceiros.
