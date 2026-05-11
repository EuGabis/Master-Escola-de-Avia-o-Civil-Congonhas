import { redirect } from "next/navigation";

export default function AutomacoesPage() {
  redirect("/configuracoes?tab=automacoes");
}
