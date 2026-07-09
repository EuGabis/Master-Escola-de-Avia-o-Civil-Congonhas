import { cn } from "@/lib/cn";
import { avatarGradient, avatarInitial } from "@/lib/avatar";

interface UserAvatarProps {
  name: string;
  avatar?: string | null;
  /** Tamanho em pixels (largura == altura). Default 36. */
  size?: number;
  /** Ring decorativo ao redor. */
  ring?: boolean;
  /** Indicador online verde no canto inferior direito. */
  online?: boolean;
  className?: string;
  /** alt customizado. Default = name. */
  alt?: string;
}

/**
 * Avatar unico de usuario/contato. Se `avatar` for um data URL ou http(s)
 * URL, renderiza a imagem; senao mostra um gradient deterministico com
 * a inicial. Usado em sidebar, listas, painel de conversa, etc.
 *
 * Tamanho da fonte e calculado proporcional ao size pra inicial nunca
 * cortar/sumir em tamanhos pequenos.
 */
export function UserAvatar({
  name,
  avatar,
  size = 36,
  ring = false,
  online = false,
  className,
  alt,
}: UserAvatarProps) {
  const hasImage = !!avatar && /^(data:|https?:|\/)/.test(avatar);
  const fontPx = Math.max(11, Math.round(size * 0.42));

  return (
    <div
      className={cn(
        "relative inline-flex items-center justify-center rounded-full shrink-0 overflow-hidden text-white font-bold shadow-sm",
        ring && "ring-2 ring-white/10",
        className
      )}
      style={{
        width: size,
        height: size,
        fontSize: fontPx,
        // Gradiente + inicial ficam SEMPRE no fundo. Quando ha foto, a imagem
        // cobre por cima; se a URL falhar/expirar (comum em foto do WhatsApp),
        // o gradiente aparece por baixo — fallback sem precisar de JS.
        ...avatarGradient(name).style,
      }}
    >
      <span aria-hidden="true">{avatarInitial(name)}</span>
      {hasImage && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatar!}
          alt={alt ?? name}
          className="absolute inset-0 w-full h-full object-cover"
          draggable={false}
        />
      )}
      {online && (
        <span
          aria-label="online"
          className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900"
        />
      )}
    </div>
  );
}
