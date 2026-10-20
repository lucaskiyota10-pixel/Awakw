import { pageContext } from "@/lib/server/access";
import { presentationData } from "@/lib/server/presentation";
import { loadCreative } from "@/lib/server/creative-data";
import { brandStyle, fontHref } from "@/lib/brand";
import { SlideDeck } from "@/components/SlideDeck";

export const metadata = { title: "Apresentação — Campaign Forge" };

export default async function PresentPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  await pageContext(projectId);
  const [data, creative] = await Promise.all([presentationData(projectId), loadCreative(projectId)]);
  return (
    <div style={brandStyle(data.brand) as React.CSSProperties}>
      <link rel="stylesheet" href={fontHref(data.brand)} />
      <SlideDeck slides={data.slides} creative={creative} backHref={`/p/${projectId}/apresentacao`} exportBase={`/api/export/${projectId}/presentation`} />
    </div>
  );
}
