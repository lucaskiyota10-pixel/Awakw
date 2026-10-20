import "server-only";
import { prisma } from "./db";
import { publish } from "./realtime";

export async function notify(
  projectId: string,
  userIds: string[],
  n: { type: string; title: string; body?: string; link?: string; dedupeKey?: string },
  exceptUserId?: string,
) {
  const targets = [...new Set(userIds)].filter((u) => u && u !== exceptUserId);
  for (const userId of targets) {
    try {
      if (n.dedupeKey) {
        await prisma.notification.upsert({
          where: { userId_dedupeKey: { userId, dedupeKey: n.dedupeKey } },
          update: {},
          create: { userId, projectId, ...n },
        });
      } else {
        await prisma.notification.create({ data: { userId, projectId, ...n } });
      }
      publish({ type: "notification", projectId, userId });
    } catch (err) {
      console.error("[notify]", err);
    }
  }
}
