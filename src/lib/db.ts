import { PrismaClient } from "@prisma/client";

/**
 * Singleton do PrismaClient.
 *
 * Em Next.js dev mode, o hot reload recria modulos e pode criar
 * dezenas de conexoes Prisma rapidamente — esgotando o pool do Postgres.
 * Usamos globalThis pra reaproveitar a mesma instancia entre reloads.
 *
 * Em serverless (Vercel), cada lambda fria abre nova conexao TCP+TLS+auth
 * com o Postgres (~300-400ms se o banco esta longe). Limitamos a 1
 * conexao por lambda pra nao esgotar o pool do banco quando varias
 * lambdas sobem ao mesmo tempo, e cortamos pool_timeout pra falhar
 * rapido em vez de pendurar.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function buildDatasourceUrl(): string | undefined {
  const raw = process.env.DATABASE_URL;
  if (!raw) return undefined;
  // So aplica os parametros em producao (serverless). Em dev local nao
  // precisa e o pool default do Prisma e melhor pra hot reload.
  if (process.env.NODE_ENV !== "production") return raw;
  try {
    const u = new URL(raw);
    if (!u.searchParams.has("connection_limit"))
      u.searchParams.set("connection_limit", "1");
    if (!u.searchParams.has("pool_timeout"))
      u.searchParams.set("pool_timeout", "15");
    return u.toString();
  } catch {
    // Se a URL nao parsear, devolve sem mexer pra nao quebrar o boot.
    return raw;
  }
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl: buildDatasourceUrl(),
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
