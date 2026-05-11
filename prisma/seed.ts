/**
 * Seed inicial — cria workspace + usuario admin.
 *
 * USO:
 *   ADMIN_EMAIL=voce@dominio.com ADMIN_PASSWORD='SenhaForte123' npm run db:seed
 *
 * Em producao, defina ADMIN_EMAIL/ADMIN_PASSWORD via Railway antes do primeiro deploy.
 * O seed NAO sobrescreve admin existente.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";

const db = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL ?? "admin@master.local";
  const password =
    process.env.ADMIN_PASSWORD ?? crypto.randomBytes(12).toString("base64url");

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Admin '${email}' ja existe. Seed nao sobrescreveu.`);
    return;
  }

  let workspace = await db.workspace.findUnique({ where: { slug: "master" } });
  if (!workspace) {
    workspace = await db.workspace.create({
      data: {
        name: "Master Escola de Aviacao",
        slug: "master",
      },
    });
    console.log(`Workspace criado: ${workspace.name}`);
  }

  // Colunas iniciais do Kanban (funil tipico de escola)
  const columnCount = await db.kanbanColumn.count({
    where: { workspaceId: workspace.id },
  });
  if (columnCount === 0) {
    await db.kanbanColumn.createMany({
      data: [
        { workspaceId: workspace.id, name: "Lead", color: "#94a3b8", order: 0 },
        { workspaceId: workspace.id, name: "Em contato", color: "#3b82f6", order: 1 },
        { workspaceId: workspace.id, name: "Visita agendada", color: "#f59e0b", order: 2 },
        { workspaceId: workspace.id, name: "Matriculado", color: "#10b981", order: 3 },
        { workspaceId: workspace.id, name: "Perdido", color: "#ef4444", order: 4 },
      ],
    });
    console.log("Kanban inicial criado");
  }

  const hash = await bcrypt.hash(password, 12);
  const user = await db.user.create({
    data: {
      workspaceId: workspace.id,
      name: "Administrador",
      email,
      password: hash,
      role: "owner",
    },
  });
  console.log(`\nUsuario admin criado:`);
  console.log(`  email:    ${user.email}`);
  console.log(`  senha:    ${process.env.ADMIN_PASSWORD ? "(definida em ADMIN_PASSWORD)" : password}`);
  console.log(`\nGUARDE a senha agora — ela nao sera mostrada de novo.`);
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
