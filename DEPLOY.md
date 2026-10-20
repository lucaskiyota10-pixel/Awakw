# Colocar o Campaign Forge no ar (grátis, sem instalar nada)

Resultado: um endereço público, como `https://campaign-forge.onrender.com`, que qualquer pessoa da equipe abre no navegador. Cada pessoa tem o próprio login, e ninguém precisa de conta no Claude.

Você vai usar dois serviços gratuitos:

| Serviço | Para quê | Custo |
| --- | --- | --- |
| **Neon** (neon.tech) | Banco de dados PostgreSQL: usuários, projetos e arquivos enviados | Gratuito (0,5 GB) |
| **Render** (render.com) | Roda o site | Gratuito |

Leva uns 15 minutos. Tudo é feito pelo navegador.

---

## Passo 1 — Criar o banco no Neon

1. Acesse **https://neon.tech** → **Sign up** e entre com sua conta do GitHub (ou e-mail).
2. Na criação do projeto:
   - **Project name:** `campaign-forge`
   - **Postgres version:** a padrão
   - **Region:** **AWS US East (N. Virginia)**, a mesma região do Render, para o site ficar mais rápido
3. Clique em **Create project**.
4. Na tela do projeto, clique em **Connect** (ou procure **Connection string**).
   - **Desligue** a opção **Connection pooling**. Precisa ser a conexão *direta*: o endereço **não** pode ter `-pooler`.
   - Copie a string inteira. Ela tem este formato:
     ```
     postgresql://neondb_owner:SENHA@ep-xxxx-xxxx.us-east-1.aws.neon.tech/neondb?sslmode=require
     ```
   - Ela precisa terminar com `?sslmode=require`. Se não terminar, acrescente.
5. Guarde essa string. Ela é a **senha do banco**: não publique nem coloque no código.

## Passo 2 — Criar o site no Render

1. Acesse **https://render.com** → **Get Started** e entre com a **mesma conta do GitHub** onde está o repositório `Awakw`.
2. No painel, clique em **New +** → **Blueprint**.
3. Conecte o GitHub, se for pedido, e escolha o repositório **lucaskiyota10-pixel/Awakw**.
   - Se o Render pedir permissão, autorize o acesso a esse repositório.
4. Em **Branch**, escolha **`claude/new-session-skwtaj`** (ou `main`, se você já tiver juntado as mudanças lá).
5. O Render lê o arquivo `render.yaml` e mostra o serviço **campaign-forge**. Ele pede os valores das variáveis:

   | Variável | O que colocar |
   | --- | --- |
   | `DATABASE_URL` | a string do Neon (Passo 1) |
   | `APP_URL` | **deixe em branco**: o endereço `*.onrender.com` é usado automaticamente |
   | `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | **deixe em branco** (opcional, veja abaixo) |

   As demais variáveis já vêm preenchidas:
   - `STORAGE_DRIVER=db`: os arquivos ficam no banco, porque o plano grátis não guarda arquivos em disco;
   - `UPLOAD_MAX_MB=8`;
   - `NODE_VERSION=22`.
6. Clique em **Apply** (ou **Deploy Blueprint**).
7. Aguarde o primeiro deploy, que leva de 5 a 10 minutos. Ele instala, cria as tabelas no Neon e compila o site. Quando aparecer **Live**, clique no endereço no topo da página do serviço.

> Prefere sem Blueprint? Use **New + → Web Service** e escolha o mesmo repositório e branch:
> - **Runtime:** Node
> - **Build Command:** `npm ci --include=dev && npx prisma migrate deploy && npm run build`
> - **Start Command:** `npm start`
> - **Instance type:** Free
> - **Health Check Path:** `/api/health`
> - Em **Environment**, adicione `DATABASE_URL` (string do Neon), `STORAGE_DRIVER=db`, `UPLOAD_MAX_MB=8` e `NODE_VERSION=22`.

## Passo 3 — Primeiro acesso

1. Abra o endereço do site. Como o banco está vazio, ele abre direto a tela **Configurar**.
2. Preencha o nome da **agência** (ex.: Awake), o **seu nome**, o **e-mail** e uma **senha**. Esse é o administrador.
3. Crie o projeto em **Projetos → Novo projeto**. Informe a marca, a data de lançamento, a verba inicial e o ticket médio: eles alimentam os simuladores, e tudo pode ser editado depois em **Configurações**.
4. Para chamar a equipe, vá em **Configurações → Equipe e convites**, informe o e-mail e o papel e clique para convidar.
   - Sem e-mail configurado, o site **mostra o link do convite** para você copiar e mandar pelo WhatsApp.
   - Cada pessoa abre o link e cria a própria senha.

Pronto: o site funciona sem o Claude e sem o seu computador ligado.

---

## Bom saber

- **Hibernação do plano grátis:** sem acessos por uns 15 minutos, o Render "adormece" o site. O próximo acesso demora de 30 a 60 segundos para acordar, depois volta ao normal. Antes de uma apresentação, abra o site um minuto antes. O banco do Neon também hiberna e acorda sozinho.
- **Espaço:** o Neon grátis tem 0,5 GB. Isso é bastante para textos e imagens otimizadas. Prefira JPG/WebP com menos de 1–2 MB, porque vídeos grandes enchem rápido.
- **Atualizações:** cada `git push` na branch escolhida faz o Render publicar a nova versão sozinho (`autoDeploy`). Novas tabelas e colunas são aplicadas no build (`prisma migrate deploy`), sem apagar dados.
- **E-mail (opcional):** para mandar convites e recuperação de senha por e-mail, preencha no Render (**Environment**):
  - `SMTP_HOST` (ex.: `smtp.gmail.com`), `SMTP_PORT=587`, `SMTP_USER` (o e-mail) e `SMTP_PASS`;
  - no Gmail, `SMTP_PASS` é uma *senha de app*, não a senha normal;
  - depois clique em **Manual Deploy → Deploy latest commit**.
- **Domínio próprio (opcional):** no Render, use **Settings → Custom Domains**. Depois defina `APP_URL=https://seu-dominio` para os links de convite usarem esse endereço.
- **Dados de demonstração (opcional):** só para testar, nunca em produção real. Rode localmente, apontando para o banco do Neon:
  ```
  DATABASE_URL="string do Neon" SEED_DEMO_PASSWORD="umaSenhaComMais10" npm run db:seed
  ```
  Isso cria usuários `@awake.demo` com essa senha.
- **Segurança:** a string do banco e as senhas ficam só nas variáveis do Render, nunca no repositório. Se a string vazar, troque a senha em **Neon → Roles → Reset password** e atualize `DATABASE_URL` no Render.

## Se algo der errado

| Sintoma | Causa provável e solução |
| --- | --- |
| Build falha em `prisma migrate deploy` com erro de conexão | `DATABASE_URL` errada, com `-pooler` ou sem `?sslmode=require`. Corrija em **Environment** e faça **Manual Deploy**. |
| Build falha com "out of memory" | Raro no Free. Faça **Manual Deploy → Clear build cache & deploy**. |
| Site abre, mas dá erro ao logar | Veja **Logs** no Render. Se o erro for de banco, confira se o projeto do Neon não foi suspenso nem apagado. |
| Primeiro acesso demora | É a hibernação do plano grátis (veja acima). |
| Deploy fica "unhealthy" | A rota `/api/health` não conseguiu falar com o banco: confira `DATABASE_URL`. |

> SIMULAÇÃO ACADÊMICA — RESULTADOS HIPOTÉTICOS. NÃO REPRESENTAM DESEMPENHO GARANTIDO.
