# AWAKE CAMPAIGN LAB

Plataforma web colaborativa para planejar, simular, comparar e documentar a campanha de lançamento da **Awake Home Decor** (extensível a outras agências e projetos): autenticação, papéis, chat em tempo real, tarefas, calendário, Instagram Studio (perfil fictício), campanhas com testes A/B simulados, simulador de métricas, **Awake Growth Simulator** (semana → ano), planejamento de verba, painel de Planejamento Digital, pesquisa/SWOT, documentos colaborativos com exportação **DOCX/PDF (ABNT)** e modo apresentação com exportação **PDF/PPTX**.

> **SIMULAÇÃO ACADÊMICA — RESULTADOS HIPOTÉTICOS. NÃO REPRESENTAM DESEMPENHO GARANTIDO.**
> A plataforma não se conecta ao Instagram/Meta, não inventa desempenho, bibliografia nem aprovações. Toda premissa declara sua origem (briefing confirmado, fonte externa documentada, hipótese da equipe ou cálculo).

## Arquitetura

| Camada | Escolha |
| --- | --- |
| Front/back | Next.js 15 (App Router, Server Components + Server Actions), React 19, TypeScript |
| Estilo | Tailwind CSS com tokens da marca (Quiet Luxury) editáveis por projeto |
| Banco | PostgreSQL + Prisma (migrações em `prisma/migrations`) |
| Autenticação | Sessões próprias: token aleatório em cookie `httpOnly`/`SameSite=Lax`, hash SHA-256 no banco, senhas com bcrypt (custo 12), limitação de tentativas |
| Tempo real | Server-Sent Events (`/api/events/[projectId]`) com barramento em memória |
| Arquivos | Disco local fora de `public/` (`UPLOAD_DIR`), servidos só por rota autenticada; verificação de tipo, extensão, tamanho e assinatura binária |
| Gráficos | Recharts (tela), barras vetoriais (PDF), PNG gerado sem dependências nativas (DOCX), gráficos nativos (PPTX) |
| Exportação | `docx` (DOCX), `pdf-lib` (PDF com motor de layout próprio), `pptxgenjs` (PPTX editável) |
| Testes | Vitest (motores de cálculo, permissões, exportadores) + script E2E multiusuário com Playwright |

```
prisma/            schema, migração e seed demonstrativo
src/lib/sim/       motores puros: métricas, crescimento temporal, agregação, datas, origem das premissas
src/lib/docs/      parser Markdown, exportadores DOCX/PDF/PPTX
src/lib/server/    auth, controle de acesso, auditoria, tempo real, arquivos, geração de documentos
src/app/actions/   server actions (validação zod + permissão + auditoria em todas)
src/app/p/[id]/    módulos do projeto
tests/             testes unitários   ·   scripts/e2e.mjs  teste ponta a ponta
```

### Modelos de cálculo (resumo)
- **Métricas**: CPM, CPC e CTR nunca são premissas independentes — escolhe-se a base (CPM ou CPC) + CTR e a terceira é derivada (`CPC = CPM ÷ (1000 × CTR)`). Alcance só existe com premissa de frequência; sessões só com taxa de chegada. Totais recalculam taxas a partir das somas.
- **Growth Simulator**: simulação diária agregada em semanas, meses, trimestres, semestres e anos (relativos ao início), com visão por período e acumulada e variações absolutas/percentuais. Orçamento **único** e **mensal recorrente** são modos distintos (nada é multiplicado por 12 automaticamente). Ajustes opcionais e declarados: saturação (CTR cai com a frequência acumulada), aumento mensal de CPM, sazonalidade (12 multiplicadores) e variação de conversão. Sem eles, o sistema avisa que o modelo é linear. Alcance único usa curva de Poisson e exige tamanho de público. CPA/ROAS são "combinados" (sem atribuição causal).
- Todas as fórmulas aparecem nas telas e estão cobertas por testes em `tests/`.

## Executar localmente

Pré-requisitos: Node 20+ e PostgreSQL 14+.

```bash
cp .env.example .env            # ajuste DATABASE_URL e defina SEED_DEMO_PASSWORD (mín. 10 caracteres)
npm install
npx prisma migrate deploy       # cria as tabelas
npm run db:seed                 # dados DEMONSTRATIVOS identificados (opcional)
npm run dev                     # http://localhost:3000
```

Sem seed, a primeira visita abre **/configurar** para criar o administrador e a agência; depois convide a equipe em *Configurações → Equipe e convites*.

### Usuários demonstrativos (seed)
Todos com a senha definida em `SEED_DEMO_PASSWORD`, e-mail `<nome>@awake.demo`:

| Usuário | Papel | Setor |
| --- | --- | --- |
| lucas | Administrador | Planejamento (mensuração, Pixel, UTMs, KPIs) |
| juh (Jhiulyana), gustavo | Coordenador | Planejamento / Atendimento |
| isabely, nicole, danielle, vitoria, beatriz, gabriella, leticia | Integrante | conforme o briefing |
| professor | Visualizador | lê e comenta |

O projeto e os usuários do seed são marcados como demonstrativos (`isDemo`). Taxas de mídia/funil carregadas são **hipóteses da equipe**, não benchmarks.

### Testes
```bash
npm test                         # unitários (39): cálculos, agregação, verba, UTM, permissões, menções, diff, DOCX/PDF
npm run typecheck
SEED_DEMO_PASSWORD=... npm run test:e2e   # com o app rodando e o seed aplicado
```
O E2E (26 verificações) abre várias sessões de navegador e valida: geração de documento, autosave, edição concorrente com detecção de conflito e mesclagem, histórico de autoria, exportações DOCX/PDF/PPTX, chat em tempo real com menção e notificação, bloqueio de aprovação para integrantes, aprovação por coordenador, permissões de visualizador, isolamento entre agências (páginas, exportação e SSE) e uploads protegidos.

### Testar o multiusuário manualmente
Abra duas janelas (uma anônima) e entre com usuários diferentes — ex.: `lucas@awake.demo` e `juh@awake.demo`. Teste: mensagens com `@Juh` no chat, mover tarefas no Kanban, editar o mesmo documento (a outra janela recebe a versão nova; com edições simultâneas aparece o assistente de conflito), solicitar aprovação com um integrante e aprovar com um coordenador.

## Publicação

1. Provisione PostgreSQL gerenciado (Neon, Supabase, RDS…) e configure as variáveis de `.env.example` no provedor (nunca no código).
2. `npm ci && npx prisma migrate deploy && npm run build && npm start` (Node em servidor/contêiner — Render, Railway, Fly.io, VM).
3. Configure `APP_URL` com a URL pública (https) — usada nos links de convite e recuperação.
4. **Armazenamento**: `UPLOAD_DIR` precisa de disco persistente. Em plataformas sem disco persistente (ex.: serverless), troque a implementação de `src/lib/server/files.ts` por S3/R2 mantendo a interface `storeFile/readStored/deleteStored`.
5. **Tempo real**: o barramento SSE é em memória e atende uma instância. Para várias instâncias, substitua `src/lib/server/realtime.ts` por Postgres `LISTEN/NOTIFY` ou Redis pub/sub (mesma interface `publish/subscribe`). Plataformas serverless com tempo de execução curto não são adequadas para SSE.
6. **E-mail**: preencha `SMTP_*` para enviar convites e recuperação de senha. Sem SMTP, o link de convite é exibido ao administrador e o de recuperação é registrado no log do servidor — nada é enviado nem declarado como enviado.

## Segurança e privacidade
- Autorização verificada no servidor em toda ação/rota (`actionContext`/`pageContext`); dados isolados por agência; IDs de outras agências retornam 404/401.
- Papéis: **Administrador** (tudo), **Coordenador** (aprovações finais, decisões, verba aprovada, convites, auditoria), **Integrante** (cria/edita, solicita aprovação), **Visualizador** (lê e comenta).
- Validação com zod; exclusões exigem confirmação e são auditadas (autor, data, dados anteriores); trilha de auditoria por projeto.
- Uploads: lista de tipos permitidos (sem SVG/HTML), checagem de extensão, tamanho e *magic bytes*; download com `nosniff` e CSP restritiva.
- Cabeçalhos de segurança, cookies `httpOnly`, server actions com verificação de origem do Next.js, upload com verificação de `Origin`.
- LGPD: dados mínimos (nome, e-mail, papel, conteúdo produzido); remoção de integrante encerra as sessões; orientações de consentimento no painel de Pixel.

## Status por fase

| Fase | Funcional | Parcial / limitações |
| --- | --- | --- |
| 1. Base | Login, sessões, configuração inicial, convites (link de 7 dias), recuperação de senha, papéis, múltiplas agências/projetos com isolamento, dashboard com filtros (setor, responsável, período), identidade visual editável (cores, fontes, logo, opção “rosa modernidade”), confirmação de nome oficial | — |
| 2. Colaboração | Chat geral/setores/grupos/privado, menções e @todos, respostas, anexos, vínculo a tarefas/documentos/decisões, busca, notificações, tempo real; Central de Decisões com trilha; Kanban com 6 colunas, checklist, dependências, anexos, comentários e histórico; calendário dia/semana/mês; alertas de prazo; arquivos; aprovações | Tempo real em instância única (ver Publicação) |
| 3. Criação | Instagram Studio (perfil fictício, bio, link, destaques, feed reorganizável por arrastar, stories, Reels, carrosséis, prévia mobile, versões comparáveis, comentários, aprovação, modo apresentação); calendário editorial com fluxo Redação → Criação → Planejamento → Atendimento; campanhas com A/B simulado; simulador de métricas com cenários e CSV | Vídeos MP4 são exibidos, não editados |
| 4. Simulação temporal | Growth Simulator (semanal a anual e personalizado), comparação de cenários, orçamentos (R$ 10/15/20 mil ou qualquer valor) e estratégias, linha do tempo nov/2026–nov/2027 ajustável com marcos clicáveis e evolução hipotética do perfil; planejamento de verba (proposta × aprovada, soma validada, redistribuição) | — |
| 5. Planejamento digital | Diagnóstico, plano de mensuração, Pixel/API de Conversões (status só “validado” com evidência), gerador de UTMs com histórico, KPIs com dados reais × projeção, checklists e relatório semanal; concorrentes, SWOT interna/externa com evidência × hipótese e conversão em tarefas; referências bibliográficas | Sem integração com APIs da Meta/GA4 (intencional: dados reais são lançados manualmente com fonte) |
| 6. Documentos e apresentação | 13 modelos gerados com dados reais (relatório final, planejamento, SWOT, mídia, calendário, mensuração, simulações, ata, relatório individual…), editor com prévia, autosave, conflito/mesclagem, versões restauráveis, sugestões, comentários, presença, aprovação final, relatório de contribuições; DOCX/PDF ABNT (capa, folha de rosto, sumário, seções numeradas, figuras e tabelas com fonte, referências); apresentação com PDF e PPTX editável | Edição simultânea por controle otimista + mesclagem (não é CRDT caractere a caractere). No DOCX o sumário é um campo do Word (atualiza ao abrir no Word; no LibreOffice use *Atualizar índice*). O PDF usa fontes padrão (Helvetica): símbolos fora do Latin-1 são substituídos |

## Pendências do cliente (sinalizadas na própria plataforma)
- Confirmar o nome oficial (**Awake** × **Wake** Home Decor).
- Confirmar a data exata de lançamento (1ª ou 2ª semana de novembro/2026; 09/11/2026 está como provisória).
- Aprovar a verba (a sugestão 30/60/10 sobre R$ 10.000 está carregada como **não aprovada**).
- Substituir as hipóteses de mídia/funil por fontes documentadas ou dados reais quando existirem.
