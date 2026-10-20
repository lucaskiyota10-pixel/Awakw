import { pageContext } from "@/lib/server/access";
import { loadCreative } from "@/lib/server/creative-data";
import { Editorial } from "./Editorial";

export default async function EditorialPage({ params, searchParams }: { params: Promise<{ projectId: string }>; searchParams: Promise<{ p?: string }> }) {
  const { projectId } = await params;
  const { p } = await searchParams;
  await pageContext(projectId);
  const data = await loadCreative(projectId);
  return <Editorial {...data} openId={p ?? null} />;
}
