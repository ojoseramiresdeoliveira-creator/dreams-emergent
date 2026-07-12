# Monument of Dreams — Fase 2: Guardian com Memória Real

**Estado:** proposta para aprovação · **Autor:** Lead Software Architect · **Data:** 2026-07-11

---

## 0. Princípio orientador

> O Monument of Dreams não é um diário, não é um gestor de objetivos e não é uma rede social.
> É um arquivo vivo da caminhada humana.

Consequências técnicas diretas deste princípio nesta fase:

1. **A Stone é a verdade e é imutável.** O pipeline da Fase 2 nunca escreve nas colunas de verdade de uma stone (`type`, `body`, `media_url`, `happened_at`, `title`, `moment_type` escolhido pelo utilizador). As únicas colunas de stone que o pipeline toca são as duas colunas *mecânicas* já definidas no schema da Fase 1 para este fim: `embedding` (representação matemática derivada, não interpretação) e `guardian_processed` (flag de processamento).
2. **Decisão que fecha a "zona cinzenta" da auditoria:** as colunas "Guardian-inferred" da Fase 1 (`summary`, `emotion`, `impact_score`, `traits`, `phase` em stones) **não serão preenchidas pelo pipeline**. Toda a interpretação vive exclusivamente nas tabelas Guardian. Essas colunas ficam reservadas a edição explícita do utilizador (futuro), ou serão removidas numa migração de limpeza posterior.
3. **Proveniência obrigatória.** Nenhuma linha de interpretação existe sem apontar para as stones que a justificam (`source_stone_ids`). O Guardian responde "porque sabe" — e sabe porque cada afirmação tem um caminho de volta até à verdade.
4. **A interpretação é descartável e reconstruível.** Como as stones são imutáveis e o pipeline é determinístico-idempotente, toda a camada Guardian pode ser apagada e reconstruída do zero a qualquer momento. Isto é a rede de segurança da fase inteira.

---

## 1. Modelo de dados

### 1.1 Diagrama de relações

```
auth.users ─┬─< journeys ─────< stones (VERDADE, imutável)
            │                     │ embedding vector(1024)  ← única escrita do pipeline
            │                     │ guardian_processed      ← única escrita do pipeline
            │                     │
            │      ┌──────────────┴───── source_stone_ids / evidence_stone_ids (proveniência)
            │      ▼
            ├─< guardian_memories   (factos interpretados, atómicos, com embedding)
            ├─< guardian_patterns   (padrões recorrentes, fortalecidos com o tempo)
            ├─< guardian_traits     (traços acumulados, com tendência)
            ├─< stone_links         (ligações stone↔stone com tipo e nota)
            ├─< guardian_context    (memória de trabalho compilada — 1 por utilizador, cache)
            └─< guardian_jobs       (fila de processamento, idempotente)
```

### 1.2 `guardian_memories` — o que o Guardian sabe

Uma memory é **um facto atómico interpretado**, em linguagem natural, sempre ancorado a stones.
Exemplos: *"Em março, três restarts seguidos giraram todos em torno de treinar de manhã."* · *"A primeira vez que nomeou o medo de falhar em público foi na stone 'A apresentação' (2026-02-11)."*

```sql
CREATE TABLE guardian_memories (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  journey_id       uuid REFERENCES journeys(id) ON DELETE CASCADE,   -- nullable: memórias transversais
  kind             text NOT NULL CHECK (kind IN
                     ('observation','emotion','commitment','turning_point','relationship','growth')),
  content          text NOT NULL,                 -- o facto, ≤ 400 chars, citável em conversa
  source_stone_ids uuid[] NOT NULL,               -- proveniência OBRIGATÓRIA (≥ 1)
  confidence       real NOT NULL DEFAULT 0.8 CHECK (confidence BETWEEN 0 AND 1),
  embedding        vector(1024),
  is_active        boolean NOT NULL DEFAULT true, -- revisão sem destruição:
  superseded_by    uuid REFERENCES guardian_memories(id),  -- nova versão aponta para trás
  times_reinforced int  NOT NULL DEFAULT 1,       -- quantas stones novas confirmaram este facto
  last_seen_at     timestamptz NOT NULL DEFAULT now(),     -- última evidência
  created_at       timestamptz NOT NULL DEFAULT now()
);
```

Memories nunca são editadas destrutivamente: quando o entendimento muda, a antiga fica `is_active=false` com `superseded_by` a apontar para a nova — o Guardian tem histórico do próprio entendimento (matéria-prima para Life Chapters).

### 1.3 `guardian_patterns` — o que se repete

```sql
CREATE TABLE guardian_patterns (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  journey_id         uuid REFERENCES journeys(id) ON DELETE CASCADE,
  pattern_type       text NOT NULL CHECK (pattern_type IN
                       ('behavioral','emotional','cycle','trigger','pre_breakthrough','growth')),
  title              text NOT NULL,               -- "Restart após silêncio de 5+ dias"
  description        text NOT NULL,               -- explicação citável
  evidence_stone_ids uuid[] NOT NULL,
  occurrences        int  NOT NULL DEFAULT 2,     -- padrão exige ≥ 2 ocorrências por definição
  status             text NOT NULL DEFAULT 'emerging'
                       CHECK (status IN ('emerging','confirmed','dormant','broken')),
  confidence         real NOT NULL DEFAULT 0.6,
  embedding          vector(1024),
  first_seen_at      timestamptz NOT NULL,
  last_seen_at       timestamptz NOT NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
```

Ciclo de vida: `emerging` (2 ocorrências) → `confirmed` (≥ 3 e confiança ≥ 0.75) → `dormant` (sem evidência há 90 dias) → `broken` (evidência contrária explícita, ex.: o padrão de desistir foi quebrado — isto é informação valiosíssima para o Guardian celebrar a caminhada). Padrões **fortalecem-se** (occurrences++, evidence append, last_seen_at) em vez de duplicar.

### 1.4 `guardian_traits` — quem a pessoa está a tornar-se

```sql
CREATE TABLE guardian_traits (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trait_key          text NOT NULL,               -- normalizado: 'resiliente-nos-recomecos'
  label              text NOT NULL,               -- exibível: "Resiliente nos recomeços"
  strength           real NOT NULL DEFAULT 0.3 CHECK (strength BETWEEN 0 AND 1),
  trend              text NOT NULL DEFAULT 'rising' CHECK (trend IN ('rising','stable','fading')),
  evidence_stone_ids uuid[] NOT NULL,
  first_seen_at      timestamptz NOT NULL,
  last_seen_at       timestamptz NOT NULL,
  updated_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, trait_key)
);
```

`strength` sobe com reforço (assimptótico: `s' = s + (1-s)*0.15`) e decai lentamente sem evidência (recalculado no recompile do contexto, não por cron). O `UNIQUE (user_id, trait_key)` torna a acumulação estrutural — não há traits duplicados por construção.

### 1.5 `stone_links` — a teia entre momentos

```sql
CREATE TABLE stone_links (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  from_stone_id uuid NOT NULL REFERENCES stones(id) ON DELETE CASCADE,
  to_stone_id   uuid NOT NULL REFERENCES stones(id) ON DELETE CASCADE,
  link_type     text NOT NULL CHECK (link_type IN
                  ('echoes','continues','answers','contrasts','caused','resolves')),
  note          text,                              -- porquê da ligação, citável
  created_by    text NOT NULL DEFAULT 'guardian' CHECK (created_by IN ('guardian','user')),
  confidence    real NOT NULL DEFAULT 0.7,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (from_stone_id, to_stone_id, link_type),
  CHECK (from_stone_id <> to_stone_id)
);
```

É isto que permite "mostra-me os momentos que construíram quem sou hoje": caminhar a teia a partir de uma stone recente. `created_by='user'` deixa a porta aberta para o utilizador confirmar/criar ligações no futuro sem mudar o schema.

### 1.6 `guardian_context` — memória de trabalho (cache compilada)

```sql
CREATE TABLE guardian_context (
  user_id                uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  narrative              text,          -- 1 parágrafo: onde a pessoa está na caminhada
  top_traits             jsonb NOT NULL DEFAULT '[]',
  active_patterns        jsonb NOT NULL DEFAULT '[]',
  key_memories           jsonb NOT NULL DEFAULT '[]',  -- as 10 memories mais reforçadas/recentes
  stats                  jsonb NOT NULL DEFAULT '{}',  -- dias, stones, restarts, última stone…
  stones_at_compile      int  NOT NULL DEFAULT 0,
  compiled_at            timestamptz NOT NULL DEFAULT now(),
  version                int  NOT NULL DEFAULT 1
);
```

É **cache, não fonte de verdade** — 100% reconstruível. Existe para que cada mensagem ao Guardian não precise de dezenas de queries: o contexto base entra pré-compilado e barato.

### 1.7 `guardian_jobs` — fila de processamento

```sql
CREATE TABLE guardian_jobs (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stone_id   uuid REFERENCES stones(id) ON DELETE CASCADE,
  job_type   text NOT NULL CHECK (job_type IN ('process_stone','recompile_context')),
  status     text NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending','running','done','failed')),
  attempts   int  NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (stone_id, job_type)          -- idempotência estrutural: 1 job por stone
);
```

### 1.8 Alteração a tabela existente (não destrutiva)

```sql
ALTER TABLE stones ALTER COLUMN embedding TYPE vector(1024);  -- coluna está vazia; ver §3
```

RLS: **todas** as tabelas novas com a mesma policy owner-only da Fase 1 (`auth.uid() = user_id`, FOR ALL, USING + WITH CHECK).

---

## 2. Fluxo de processamento

### 2.1 Quando uma stone é inscrita (pipeline de interpretação)

```
POST /api/entries
 ├─ 1. Stone gravada (verdade). Resposta devolvida JÁ — o utilizador nunca espera pelo Guardian.
 ├─ 2. Job (stone_id, 'process_stone') inserido na fila (UNIQUE → nunca duplica).
 └─ 3. after() do Next 15 (pós-resposta, mesmo processo): tenta processar o job de imediato.
        │   Se falhar/timeout: o job fica 'pending'/'failed' e o drain apanha-o depois.
        ▼
   PROCESSAMENTO (idempotente, por job):
   a. Embedding da stone (título + body) → stones.embedding
   b. Recuperação de vizinhança: top-8 stones semanticamente próximas (excluindo a própria)
      + top-5 memories ativas próximas + padrões ativos do utilizador
   c. UMA chamada Claude "Guardian Interpreter" com structured output (JSON schema estrito):
      {
        memories:  [{ kind, content, source_stone_ids, confidence }],   // 0–3
        links:     [{ to_stone_id, link_type, note, confidence }],      // só para ids fornecidos
        traits:    [{ trait_key, label, direction }],                   // 0–3 sinais
        pattern_signals: [{ matches_pattern_id | null, title, description,
                            pattern_type, evidence_stone_ids }]
      }
      Regra dura no prompt: só pode referenciar stone_ids que recebeu. O código VALIDA
      cada id devolvido contra os ids fornecidos — id inventado é descartado.
   d. Escrita com dedup (ver §4)
   e. guardian_processed = true · job 'done'
   f. Se stones novas desde o último compile ≥ 5 (ou compile > 7 dias): job 'recompile_context'
```

**Porquê `after()` + fila, e não só um dos dois:** `after()` dá interpretação quase-imediata sem atrasar a resposta; a fila dá fiabilidade (retry até 3 tentativas, backfill de stones antigas, reconstrução total). O processamento é o mesmo código nos dois caminhos e é idempotente — correr duas vezes não duplica nada.

**Drain:** `POST /api/guardian/process` processa jobs pendentes do utilizador autenticado (chamado de forma oportunista no arranque da app) e aceita também `x-cron-secret` para um drain global agendado (Supabase cron / GitHub Action) que apanha o que o `after()` perdeu.

### 2.2 Quando o utilizador fala com o Guardian (contexto inteligente)

```
POST /api/mentor { message }
 ├─ 1. Embedding da pergunta                                (~150 ms)
 ├─ 2. Recuperação em paralelo (1 round-trip Supabase cada):
 │     • match_stones(query, k=6)      — verdade relevante, com happened_at
 │     • match_memories(query, k=6)    — factos interpretados relevantes
 │     • guardian_context              — memória de trabalho compilada
 │     • padrões ativos + traits top-5 — SQL simples
 │     • âncoras temporais: primeira stone (génese) + 3 mais recentes
 │     • últimas 20 mensagens da conversa (já existente)
 ├─ 3. System prompt em camadas:
 │     [identidade Guardian — inalterada da Fase 1]
 │     [CONTEXTO COMPILADO: narrative + stats]
 │     [VERDADE: stones recuperadas, verbatim, cada uma com data real]
 │     [MEMÓRIA: memories com datas e nº de reforços]
 │     [PADRÕES e TRAITS ativos]
 │     [CONTRATO DE FIDELIDADE — ver §2.3]
 └─ 4. Resposta Claude → gravada como hoje (mentor_messages)
```

### 2.3 Contrato de fidelidade ("responde porque sabe, não porque inventa")

Quatro defesas em camadas:

1. **Grounding por construção** — o prompt só contém registos reais com datas reais; perguntas temporais ("quando foi a última vez…") são respondidas a partir de `happened_at`, nunca da imaginação do modelo.
2. **Instrução explícita no prompt** — *"Only speak from the records provided. If the archive does not contain it, say the archive does not hold that yet — that absence is itself an answer. Never invent a date, an inscription, or a feeling the walker did not record."*
3. **Proveniência em todas as camadas** — memories/patterns/links citam stone ids; a validação de ids no interpreter impede contaminação da base de memória com alucinações.
4. **Confiança propagada** — interpretações com `confidence < 0.5` não entram no contexto de conversa.

---

## 3. Pipeline de embeddings

| Decisão | Recomendação | Alternativa |
|---|---|---|
| Fornecedor | **Voyage AI** (`voyage-3.5`) — parceiro oficial de embeddings da Anthropic, excelente multilingue (o conteúdo dos utilizadores será largamente em português), $0.06/1M tokens | OpenAI `text-embedding-3-small` com `dimensions: 1024`, $0.02/1M |
| Dimensão | **1024** — funciona nos dois fornecedores (evita lock-in), 33% menos storage/IO que 1536 | — |
| Migração | `ALTER COLUMN embedding TYPE vector(1024)` — segura: a coluna está vazia em produção | — |

Implementação: módulo único `lib/embeddings.js` provider-agnóstico (`EMBEDDINGS_PROVIDER=voyage|openai`, `EMBEDDINGS_API_KEY`), com timeout duro (10s), normalização de input (título + body truncados a ~8k chars) e suporte a batch (backfill). **Nova chave de API necessária — decisão tua (ver §13).**

O que é embebido: stones (na inscrição), memories (na criação), patterns (na criação/revisão), e a pergunta do utilizador (por mensagem ao mentor). Conversas do mentor **não** são embebidas nesta fase — não são verdade.

---

## 4. Como evitar duplicação

Três camadas estruturais, não heurísticas soltas:

1. **Idempotência do pipeline** — `UNIQUE (stone_id, job_type)` na fila + `guardian_processed` na stone: uma stone nunca é interpretada duas vezes por acidente (reprocesso deliberado é permitido e limpa antes).
2. **Dedup semântico na escrita de memories** — antes de inserir, a candidata é comparada (cosine) com as memories ativas do utilizador: similaridade ≥ **0.90** → não insere; em vez disso **reforça** a existente (`times_reinforced++`, append de `source_stone_ids`, `last_seen_at`). 0.75–0.90 → insere mas liga como relacionada. A memória do Guardian *converge* em vez de inchar.
3. **Unicidade estrutural** — traits: `UNIQUE (user_id, trait_key)` com chave normalizada (lowercase, sem acentos, kebab); links: `UNIQUE (from, to, link_type)`; patterns: o interpreter recebe os padrões existentes e devolve `matches_pattern_id` quando é reforço — só cria novo se nenhum corresponder (verificação adicional por embedding ≥ 0.85 no código).

---

## 5. Estratégia de atualização

| Objeto | Como muda | Nunca |
|---|---|---|
| Stone | **Não muda.** | Ser editada/reescrita pelo Guardian |
| Memory | Reforço (contadores/evidência) ou supersessão (`is_active=false` + `superseded_by`) | Update destrutivo do `content` |
| Pattern | Fortalece/transita de estado (`emerging→confirmed→dormant/broken`) | Apagar histórico de evidência |
| Trait | `strength` sobe/decai, `trend` recalculado | Duplicar |
| Context | Recompilado (debounce: 5 stones novas ou 7 dias) e versionado | Ser tratado como fonte de verdade |
| Tudo | **Reconstrução total**: apagar camada Guardian + reenfileirar todas as stones por ordem cronológica → estado equivalente | — |

A reconstrução total é também o mecanismo de upgrade: quando o prompt do interpreter melhorar (ou o modelo mudar), reprocessa-se o arquivo inteiro sem perder um único registo de verdade.

---

## 6. Estratégia de pesquisa

Funções SQL `SECURITY INVOKER` (RLS aplica-se dentro delas — impossível pesquisar o arquivo de outro utilizador):

```sql
match_stones(query_embedding vector(1024), match_count int, min_similarity real)
match_memories(query_embedding vector(1024), match_count int, min_similarity real)
```

- Distância: **cosine** (`<=>`), threshold mínimo 0.30 de similaridade para cortar ruído.
- Índices: **HNSW** `vector_cosine_ops` parciais (`WHERE embedding IS NOT NULL`) em `stones` e `guardian_memories` (m=16, ef_construction=64 — defaults sólidos).
- **Recuperação híbrida, não só semântica:** o contexto de conversa junta (a) top-k semântico, (b) âncoras temporais (génese + recentes), (c) memories reforçadas, (d) padrões/traits ativos. É esta mistura que responde tanto a "já senti isto antes?" (semântico) como a "o que mudou desde o primeiro dia?" (temporal).
- Nota de escala: HNSW com filtro `user_id` faz pós-filtragem; irrelevante até dezenas de milhares de utilizadores (ver §8), e o pgvector ≥ 0.8 tem `iterative_scan` como mitigação já disponível no Supabase.

---

## 7. Performance

| Operação | Custo de latência | Quem espera |
|---|---|---|
| Inscrever stone | +0 ms (pipeline corre pós-resposta via `after()`) | Ninguém |
| Interpretação de stone | 2–6 s em background | Ninguém |
| Mensagem ao Guardian | +≈300–500 ms (1 embedding ~150ms + retrievals em paralelo <50ms) sobre a chamada LLM existente | Utilizador — aceitável numa conversa contemplativa |
| Vector search | <10 ms com HNSW nas cardinalidades esperadas | — |

Budgets duros: embedding 10s timeout, interpreter 30s, retrieval 5s — nenhum caminho pode pendurar (regra da Fase 1 mantém-se).

## 8. Custos (estimativa por utilizador ativo/mês: ~30 stones + ~100 mensagens)

| Componente | Modelo | Custo/mês/utilizador |
|---|---|---|
| Embeddings (stones + memories + queries) | voyage-3.5 | **< $0.01** (centenas de milhares de tokens no máximo) |
| Interpreter (1 chamada/stone, ~1.5k in / 400 out) | opus-4-8: ~$0.53 · haiku-4.5: ~$0.11 | $0.11–0.53 |
| Recompile de contexto (~6/mês, ~2k in / 300 out) | idem | $0.02–0.10 |
| Conversa (contexto extra ~1.5k tokens/mensagem) | opus-4-8 | ~$0.75 |
| **Total** | | **~$1–1.5/mês** (dominado pela conversa, que já existia) |

Decisão de modelo do interpreter é tua (§13). A minha recomendação: **opus-4-8 também no interpreter** — a qualidade da extração define a qualidade da memória para anos; o delta de custo (~$0.40/utilizador/mês) é barato para o produto que isto quer ser. Haiku fica como downgrade consciente se o custo apertar.

## 9. Escalabilidade

- Pipeline **stateless e por-job** — move-se de `after()` para um worker/Edge Function/fila externa sem tocar na lógica (o drain endpoint já é essa interface).
- Dados por utilizador são pequenos por natureza (10 anos de stone diária = ~3.650 linhas + ~2–5k memories) — a escala vem do nº de utilizadores, e tudo está particionado por `user_id` com índices para isso.
- Embeddings suportam batch (backfill/reconstrução de milhares de stones em minutos).
- `guardian_context` amortiza o custo por conversa: o trabalho pesado é por-stone (raro), não por-mensagem (frequente).
- Rate limit do mentor (Fase 1) já protege o novo caminho mais caro.

## 10. Segurança

- **RLS owner-only em todas as 6 tabelas novas**; funções de pesquisa `SECURITY INVOKER` — a fronteira entre utilizadores é imposta pelo Postgres, não pela aplicação.
- Pipeline via `after()` usa o **token do próprio pedido** (RLS aplica-se); o drain por cron usa service role mas opera job a job com `user_id` do job — nunca queries cross-user abertas.
- `x-cron-secret` (env `CRON_SECRET`) para o drain global; sem o header, o endpoint só processa os jobs do utilizador autenticado.
- Conteúdo enviado ao fornecedor de embeddings: ativar **zero data retention** (Voyage e OpenAI têm-no para API); chave só server-side.
- Structured output + validação de ids no interpreter: o LLM não consegue escrever proveniência falsa na base de memória.
- Inputs do interpreter são os dados do próprio utilizador — sem novos vetores de injeção externos; ainda assim o output JSON é validado com Zod antes de qualquer escrita.

## 11. Fundação para Life Chapters (Fase 3 — não implementar agora)

Esta arquitetura deixa pronto, sem trabalho extra:

- **Material:** memories com `kind='turning_point'`, patterns com transições de estado, `stone_links` do tipo `caused/resolves`, e o histórico de supersessão de memories — são exatamente os sinais de fronteira de capítulo.
- **Forma:** um Life Chapter será mais uma tabela de interpretação (`guardian_chapters`: intervalo temporal + narrativa + evidence_stone_ids), escrita por um job `compile_chapter` na mesma fila, com o mesmo contrato de proveniência. Zero alterações às tabelas desta fase.

## 12. Entregáveis de implementação

| Ficheiro | Conteúdo |
|---|---|
| `schema_phase3_guardian.sql` | 6 tabelas + RLS + índices HNSW + funções `match_*` + alter da dimensão |
| `lib/embeddings.js` | Fornecedor-agnóstico, timeout, batch |
| `lib/guardian/interpreter.js` | Chamada Claude structured-output + validação Zod + escrita com dedup |
| `lib/guardian/retrieval.js` | Recuperação híbrida para conversa |
| `lib/guardian/context.js` | Compilação do guardian_context |
| `lib/guardian/queue.js` | enqueue/claim/drain idempotente |
| `route.js` | `entries POST` + `after()`; `mentor` com contexto inteligente; `POST /api/guardian/process` |
| Testes E2E | pipeline completo: stone → memory → pattern → pergunta "quando foi a última vez…" respondida com data real |

## 13. Decisões que precisam da tua aprovação

1. **Fornecedor de embeddings** — Voyage AI (recomendado) ou OpenAI. Qualquer um exige criares uma conta/chave nova (`EMBEDDINGS_API_KEY`). A Anthropic não oferece embeddings.
2. **Modelo do interpreter** — opus-4-8 (recomendado, ~$0.53/utilizador/mês) ou haiku-4.5 (~$0.11).
3. **Fecho da zona cinzenta** — confirmar que as colunas Guardian-inferred de `stones` ficam por preencher (interpretação só nas tabelas Guardian), conforme §0.2.
4. Confirmação de que a `ANTHROPIC_API_KEY` real será colocada — a Fase 2 não tem caminho de fallback para o interpreter (sem LLM não há interpretação; os jobs ficam pendentes e recuperam sozinhos quando a chave existir).
