/**
 * Normaliza texto (gerado por IA ou por templates) para a sintaxe de
 * formatacao que o WhatsApp REALMENTE renderiza.
 *
 * Problema: modelos de linguagem produzem Markdown (`**negrito**`, `## titulo`,
 * `[link](url)`...). O WhatsApp NAO entende Markdown — a sintaxe dele e:
 *
 *   *negrito*   _italico_   ~tachado~   ```monoespacado```
 *
 * Entao `**Valentina**` chega no celular como o literal "**Valentina**"
 * (negrito falso, com os asteriscos aparecendo). Esta funcao converte o
 * Markdown comum para a sintaxe do WhatsApp e elimina marcadores soltos,
 * garantindo negrito de verdade sem mostrar os asteriscos.
 *
 * Idempotente: rodar de novo em texto ja normalizado nao muda nada.
 */
export function toWhatsAppFormat(input: string): string {
  if (!input) return input;
  let s = input;

  // Negrito Markdown -> negrito WhatsApp (um asterisco)
  // ***x*** (negrito+italico) -> *x*
  s = s.replace(/\*\*\*(.+?)\*\*\*/g, "*$1*");
  // **x** -> *x*
  s = s.replace(/\*\*(.+?)\*\*/g, "*$1*");
  // __x__ (negrito no Markdown) -> *x*  (o _ simples ja e italico nos dois)
  s = s.replace(/__(.+?)__/g, "*$1*");

  // Titulos Markdown (#, ##, ...) viram a linha inteira em negrito
  s = s.replace(/^[ \t]{0,3}#{1,6}[ \t]+(.+?)[ \t]*$/gm, "*$1*");

  // Links Markdown [texto](url) -> texto (url)
  s = s.replace(/\[([^\]\n]+)\]\((https?:\/\/[^)\s]+)\)/g, "$1 ($2)");

  // Sobra de asteriscos repetidos (pares nao casados) -> simples
  s = s.replace(/\*{2,}/g, "*");

  return s;
}
