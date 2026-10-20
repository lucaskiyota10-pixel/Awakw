import { pageContext } from "@/lib/server/access";
import { loadCreative } from "@/lib/server/creative-data";
import { Studio } from "./Studio";

export default async function InstagramPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  await pageContext(projectId);
  const data = await loadCreative(projectId);
  return <Studio {...data} />;
}
