import { z } from "zod";

/**
 * Validacao de variaveis de ambiente.
 * Se algo estiver faltando ou invalido, o app NAO sobe.
 * Isso evita bugs silenciosos em producao por env mal configurada.
 */
const envSchema = z.object({
  // Banco
  DATABASE_URL: z.string().url().startsWith("postgresql://"),

  // Redis
  REDIS_URL: z.string().min(1),

  // Seguranca
  JWT_SECRET: z.string().min(64, "JWT_SECRET deve ter pelo menos 64 caracteres"),
  WEBHOOK_SECRET: z.string().min(32, "WEBHOOK_SECRET deve ter pelo menos 32 caracteres"),

  // Evolution API
  EVOLUTION_API_URL: z.string().url().or(z.literal("")),
  EVOLUTION_API_KEY: z.string().default(""),
  EVOLUTION_INSTANCE_NAME: z.string().default(""),

  // App
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  // Sentry
  SENTRY_DSN: z.string().default(""),
  NEXT_PUBLIC_SENTRY_DSN: z.string().default(""),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("\nERRO: variaveis de ambiente invalidas\n");
  console.error(parsed.error.flatten().fieldErrors);
  throw new Error("Variaveis de ambiente invalidas. Veja .env.example");
}

export const env = parsed.data;
export type Env = typeof env;
