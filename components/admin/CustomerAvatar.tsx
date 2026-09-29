import { createAvatar } from "@dicebear/core";
import * as notionists from "@dicebear/notionists";

/** Fondo claro del avatar (independiente del sidebar carbón). */
const AVATAR_PLATE_DEFAULT = "fafafa";

type Props = {
  /** Email o id (vía `customerAvatarSeed`) → mismo personaje siempre. */
  seed: string;
  size?: number;
  className?: string;
  label: string;
  /** Fondo circular (hex sin `#`). Por defecto cromado admin/tienda. */
  backgroundHex?: string;
};

/**
 * Personajes ilustrados estilo [Notionists](https://www.dicebear.com/styles/notionists/) (DiceBear).
 */
export function CustomerAvatar({
  seed,
  size = 40,
  className = "",
  label,
  backgroundHex,
}: Props) {
  const safe = seed.trim() || "default";
  const bg =
    (backgroundHex ?? AVATAR_PLATE_DEFAULT).replace(/^#/, "") || "ffffff";
  const svg = createAvatar(notionists, {
    seed: safe,
    size,
    backgroundColor: [bg],
    radius: 50,
  }).toString();

  return (
    <span
      className={`pointer-events-none inline-flex shrink-0 select-none overflow-hidden rounded-full shadow-[0_0_0_1px_rgba(24,24,27,0.12)] [caret-color:transparent] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.12)] [&_svg]:pointer-events-none [&_svg]:block [&_svg]:size-full [&_svg]:select-none ${className}`}
      style={{ width: size, height: size }}
      dangerouslySetInnerHTML={{ __html: svg }}
      role="img"
      aria-label={label}
    />
  );
}
