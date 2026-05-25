-- Indice composto para a query principal da lista de conversas:
--   WHERE workspaceId = ? ORDER BY lastMessageAt DESC LIMIT 100
-- Sem este indice o Postgres faz seq scan por workspace e ordena
-- em memoria, o que fica caro conforme o numero de conversas cresce.
CREATE INDEX IF NOT EXISTS "Conversation_workspaceId_lastMessageAt_idx"
  ON "Conversation"("workspaceId", "lastMessageAt" DESC);
