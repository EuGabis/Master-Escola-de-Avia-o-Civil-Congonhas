import { Columns3 } from "lucide-react";
import { PageHeader, ComingSoon } from "@/components/PageHeader";

export default function PipelinePage() {
  return (
    <div className="h-full overflow-y-auto p-6 lg:p-8">
      <div className="max-w-6xl mx-auto">
        <PageHeader
          title="Pipeline"
          description="Funil visual estilo Kanban com etapas customizaveis"
        />
        <ComingSoon
          icon={Columns3}
          title="Kanban em construcao"
          description="Visualize leads e matriculas em colunas (Lead, Em contato, Visita agendada, Matriculado, Perdido). Arraste cartoes entre etapas, defina limites WIP e veja metricas por coluna."
        />
      </div>
    </div>
  );
}
