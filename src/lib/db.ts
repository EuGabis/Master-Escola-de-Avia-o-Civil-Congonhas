import { PrismaClient } from "@prisma/client";

/**
 * Singleton do PrismaClient.
 *
 * Em Next.js dev mode, o hot reload recria modulos e pode criar
 * dezenas de conexoes Prisma rapidamente — esgotando o pool do Postgres.
 * Usamos globalThis pra reaproveitar a mesma instancia entre reloads.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
