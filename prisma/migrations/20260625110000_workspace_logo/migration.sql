-- Adiciona coluna `logo` no Workspace pra logo personalizada do
-- cliente exibida na sidebar. Nullable porque workspaces antigos
-- nao tem logo (caem no fallback "MASTER" texto).
ALTER TABLE "Workspace" ADD COLUMN "logo" TEXT;
