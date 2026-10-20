import Link from "next/link";
import { pageContext } from "@/lib/server/access";
import { presentationData } from "@/lib/server/presentation";
import { loadCreative } from "@/lib/server/creative-data";
import { PageHeader } from "@/components/ui";
import { SlideThumbs } from "./SlideThumbs";

export default async function PresentationPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  await pageContext(projectId);
  const [data, creative] = await Promise.all([presentationData(projectId), loadCreative(projectId)]);
  return (
    <div>
      <PageHeader
        title="Apresentação"
        subtitle="Modo apresentação para professor/cliente, montado com os dados atuais: briefing, objetivos, SWOT, público, estratégia, Instagram, calendário, mídia, orçamento, cenários, gráficos temporais, KPIs e conclusões. Controles administrativos ficam ocultos."
        actions={<>
          <a className="btn-secondary" href={`/api/export/${projectId}/presentation?format=pdf`}>Exportar PDF</a>
          <a className="btn-secondary" href={`/api/export/${projectId}/presentation?format=pptx`}>Exportar PPTX editável</a>
          <Link className="btn-primary" href={`/apresentar/${projectId}`}>Iniciar apresentação</Link>
        </>}
      />
      <SlideThumbs slides={data.slides} creative={creative} />
    </div>
  );
}
