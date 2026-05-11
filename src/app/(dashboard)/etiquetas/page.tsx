import { Tag } from "lucide-react";
import { PageHeader, ComingSoon } from "@/components/PageHeader";

export default function EtiquetasPage() {
  return (
    <div className="h-full overflow-y-auto p-6 lg:p-8">
      <div className="max-w-6xl mx-auto">
        <PageHeader
          title="Etiquetas"
          description="Tags coloridas para organizar conversas"
        />
        <ComingSoon
          icon={Tag}
          title="Etiquetas em construcao"
          description="Crie tags por curso (PP, PC, Comissario), interesse (visita, prova) ou status. Aplique em conversas e filtre rapidamente."
        />
      </div>
    </div>
  );
}
