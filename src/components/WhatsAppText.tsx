import React from "react";

/**
 * Renderiza texto com a formatacao do WhatsApp como HTML, pra o atendente
 * ver negrito/italico de verdade no chat em vez dos caracteres crus.
 *
 *   *negrito*   _italico_   ~tachado~   `monoespacado`
 *
 * Nao-aninhado (igual ao WhatsApp). Quebras de linha sao preservadas pelo
 * `whitespace-pre-wrap` do container pai.
 */
const TOKEN = /(\*[^*\n]+\*|_[^_\n]+_|~[^~\n]+~|`[^`\n]+`)/g;

export function WhatsAppText({ text }: { text: string }) {
  if (!text) return null;
  const parts = text.split(TOKEN);
  return (
    <>
      {parts.map((part, i) => {
        if (!part) return null;
        const inner = part.slice(1, -1);
        if (part.length > 2 && part.startsWith("*") && part.endsWith("*"))
          return <strong key={i}>{inner}</strong>;
        if (part.length > 2 && part.startsWith("_") && part.endsWith("_"))
          return <em key={i}>{inner}</em>;
        if (part.length > 2 && part.startsWith("~") && part.endsWith("~"))
          return <s key={i}>{inner}</s>;
        if (part.length > 2 && part.startsWith("`") && part.endsWith("`"))
          return (
            <code key={i} className="font-mono text-[0.9em]">
              {inner}
            </code>
          );
        return <React.Fragment key={i}>{part}</React.Fragment>;
      })}
    </>
  );
}
