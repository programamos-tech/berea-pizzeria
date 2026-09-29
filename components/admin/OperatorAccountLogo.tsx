import Image from "next/image";

export function OperatorAccountLogo({
  src,
  name,
  size = 56,
  plateColor = "#18181B",
  fullColor = false,
}: {
  src: string;
  name: string;
  size?: 32 | 40 | 56 | 64;
  /** Fondo del recuadro; `transparent` = sin placa (p. ej. sidebar carbón). */
  plateColor?: string;
  fullColor?: boolean;
}) {
  const box =
    size === 32
      ? "size-8 rounded-md"
      : size === 40
        ? "size-10 rounded-lg"
        : size === 64
          ? "size-16 rounded-xl"
          : "size-14 rounded-xl";
  const pad =
    fullColor
      ? "p-0"
      : size === 32 || size === 40
        ? "p-[14%]"
        : "p-[16%]";
  const tone = fullColor ? "" : "brightness-0 invert";
  const clearPlate =
    !plateColor ||
    plateColor === "transparent" ||
    plateColor === "rgba(0,0,0,0)";

  return (
    <span
      className={`relative block aspect-square ${box} shrink-0 overflow-hidden`}
      style={clearPlate ? undefined : { backgroundColor: plateColor }}
    >
      <Image
        src={src}
        alt={name}
        fill
        sizes={`${size}px`}
        unoptimized
        className={`bg-transparent object-contain ${tone} ${pad}`}
      />
    </span>
  );
}
