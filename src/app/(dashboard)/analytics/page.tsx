import { BarChart3 } from "lucide-react";
import { PageHeader, ComingSoon } from "@/components/PageHeader";

export default function AnalyticsPage() {
  return (
    <div className="h-full overflow-y-auto p-6 lg:p-8">
      <div className="max-w-6xl mx-auto">
        <PageHeader
          title="Analytics"
          description="Metricas de atendimento e conversao"
        />
        <ComingSoon
          icon={BarChart3}
          title="Dashboards em desenvolvimento"
          description="Tempo medio de resposta, taxa de conversao por etapa, performance por agente, volume de mensagens por hora/dia e relatorios exportaveis."
        />
      </div>
    </div>
  );
}
