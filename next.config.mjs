/** @type {import('next').NextConfig} */
const nextConfig = {
  // Prisma e bcrypt sao bibliotecas Node nativas - nao podem ser bundladas
  serverExternalPackages: ["@prisma/client", "prisma", "bcryptjs"],

  // Ignora ESLint em build de producao (rodamos lint manual)
  eslint: { ignoreDuringBuilds: true },

  // Permite o build em caso de warnings do TS (mantemos typecheck manual via `npm run typecheck`)
  typescript: { ignoreBuildErrors: false },

  poweredByHeader: false,
};

export default nextConfig;
