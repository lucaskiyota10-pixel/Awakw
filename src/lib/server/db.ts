import { PrismaClient } from "@prisma/client";

// O conteúdo dos arquivos (FileAsset.data) só é carregado quando pedido explicitamente.
const make = () => new PrismaClient({ omit: { fileAsset: { data: true } } });
const g = globalThis as unknown as { prisma?: ReturnType<typeof make> };
export const prisma = g.prisma ?? make();
if (process.env.NODE_ENV !== "production") g.prisma = prisma;
