# Guia de Produção — Master CRM

Setup completo para deixar o sistema robusto em produção.

## 🛡️ Segurança aplicada (OWASP Top 10)

| OWASP Risk | Mitigação implementada |
|---|---|
| **A01 — Broken Access Control** | Middleware Next.js valida JWT em toda rota não-pública. Cada API rechecagem sessão. `workspaceId` filtra TODA query (multi-tenancy seguro). |
| **A02 — Cryptographic Failures** | Senhas com bcrypt 12 rounds. JWT HS256 com chave 64 bytes. Cookies `httpOnly` + `Secure` + `SameSite=Lax`. HTTPS obrigatório (Vercel/Cloudflare). |
| **A03 — Injection** | Prisma ORM (parametrized queries). Zod valida todo input do cliente. Sem template strings em queries SQL. |
| **A04 — Insecure Design** | Princípio do menor privilégio (roles owner/admin/agent). Rate limit por IP+email (Upstash Redis). Audit log de toda ação sensível. |
| **A05 — Security Misconfiguration** | `next.config.mjs` com `poweredByHeader=false`. Cabeçalhos HSTS, X-Frame-Options DENY, X-Content-Type-Options, Referrer-Policy. CSP em produção. |
| **A06 — Vulnerable Components** | `npm audit` zero high. Patches via Dependabot ativo no GitHub. |
| **A07 — Auth Failures** | Anti-enumeration: bcrypt sempre roda mesmo se email não existe. Delay constante 250ms. Rate limit 5 tentativas/15min por email. Reset com token único de uso único, 1h validade. |
| **A08 — Software/Data Integrity** | Webhook Evolution validado por header `apikey`. Pusher channels privados com auth server-side. Tokens JWT assinados não modificáveis. |
| **A09 — Security Logging** | Audit log persistente em `AuditLog`: login, logout, failed login, password reset, mudança de senha, criação/exclusão de usuário, mudança de configurações. |
| **A10 — SSRF** | Webhooks só aceitam payloads, não fazem requisições para URLs do payload. Evolution URL configurada por admin, validada como HTTPS. |

## 🗄️ Backups do Postgres

### Automáticos (Railway)
- **Frequência**: snapshots diários
- **Retenção**: 7 dias no plano Hobby
- **Restauração**: 1 clique no painel Railway → Postgres → Backups

### Backup manual (recomendado fazer semanal)

```bash
# Local: precisa ter pg_dump instalado (do PostgreSQL client)
pg_dump $DATABASE_URL > backup-$(date +%Y%m%d).sql

# Comprimir
gzip backup-*.sql

# Subir pro Backblaze B2 (10GB grátis) ou Google Drive
```

### Backup automatizado externo (opcional)

GitHub Actions workflow rodando diariamente:
```yaml
# .github/workflows/backup.yml
name: DB Backup
on:
  schedule:
    - cron: "0 3 * * *"  # 03:00 UTC
jobs:
  backup:
    runs-on: ubuntu-latest
    steps:
      - run: |
          pg_dump ${{ secrets.DATABASE_URL }} | gzip > backup.sql.gz
          # Upload para B2/S3/etc
```

## 📊 Monitoramento

### Sentry (erros + performance)
1. Cria conta grátis em https://sentry.io
2. Cria projeto Next.js, copia o DSN
3. Adiciona na Vercel:
   - `SENTRY_DSN` (servidor)
   - `NEXT_PUBLIC_SENTRY_DSN` (cliente, mesmo valor)
   - `SENTRY_ORG` (slug da org)
   - `SENTRY_PROJECT` (slug do projeto)
   - `SENTRY_AUTH_TOKEN` (token de upload de source maps, opcional)
4. Redeploy → erros começam a aparecer no Sentry

**Plano Free do Sentry**: 5k erros/mês, 10k transactions, 7 dias retenção. Suficiente pra começar.

### UptimeRobot (uptime monitoring)
1. Cria conta grátis em https://uptimerobot.com (até 50 monitores, ping a cada 5min)
2. Adiciona monitor:
   - Type: **HTTP(s)**
   - URL: `https://SEU-DOMINIO.vercel.app/api/health`
   - Interval: **5 minutes**
   - Alert: seu email (notifica em ≤5min se sair do ar)

### Vercel Analytics (built-in)
- Já incluso no plano Hobby
- Páginas mais acessadas, geolocalização, velocidade

## 🔄 Vercel Cron Jobs

Configurado em `vercel.json`:
- `/api/cron/followup` — todos os dias às 10h (Brasília) processa follow-ups

Para verificar:
1. Painel Vercel → seu projeto → **Settings → Cron Jobs**
2. Deve aparecer `/api/cron/followup` agendado
3. Logs de execução em **Logs → Cron**

## 🔑 Rotação de credenciais (a cada 90 dias)

Lista de chaves para rotacionar:

| Credencial | Onde |
|---|---|
| Postgres password | Railway → Postgres → Settings → Reset Password |
| Redis password (Upstash) | Upstash → Database → Rotate Token |
| Pusher secret | dashboard.pusher.com → App → App Keys → Rotate |
| JWT_SECRET | Gera novo (`node -e "console.log(crypto.randomBytes(64).toString('hex'))"`) e atualiza na Vercel. Vai invalidar TODAS as sessões ativas. |
| WEBHOOK_SECRET | Mesmo processo |
| Evolution API Key | Evolution Manager → Instance → Rotate API Key |
| OpenAI/Anthropic key | console.openai.com → API Keys → Revoke + Create new |

**Após rotacionar, atualize as variáveis na Vercel e refaça o redeploy.**

## 🚨 Checklist antes do Go-Live oficial

- [ ] Domínio próprio configurado (`crm.mastercongonhas.com.br` em vez de `vercel.app`)
- [ ] HTTPS forçado (Vercel já faz por padrão)
- [ ] Sentry DSN cadastrado e recebendo erros
- [ ] UptimeRobot monitorando `/api/health` a cada 5min
- [ ] Vercel Cron `/api/cron/followup` ativo
- [ ] Postgres Railway com backup diário ativo
- [ ] Senha do admin owner trocada (não a do seed inicial)
- [ ] JWT_SECRET e WEBHOOK_SECRET rotacionados pós-desenvolvimento
- [ ] Pelo menos 1 agent + 1 admin extras criados (não depender só do owner)
- [ ] Política de senha forte comunicada à equipe (12+ chars, U/l/n)
- [ ] Limite mensal de tokens IA configurado em `/configuracoes?tab=ia` (evita estouro de orçamento)
- [ ] System prompt da IA revisado e validado
- [ ] Pelo menos 1 automation criada para classificar leads
- [ ] Pelo menos 1 follow-up criado para reengajamento
- [ ] Cron de follow-up testado uma vez manualmente

## 📞 Suporte

- **Postgres caiu**: Railway → Postgres → Restart
- **Redis caiu**: Upstash → Database → Restart
- **IA estourou tokens**: aumentar limite em /configuracoes ou desligar até virar mês
- **Evolution desconectou WhatsApp**: Evolution Manager → Restart Instance → reconectar QR

---
Sistema validado: OWASP Top 10 mitigado · Backups diários · Monitoramento end-to-end
