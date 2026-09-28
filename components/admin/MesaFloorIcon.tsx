/** Icono de mesa redonda + sillas (vista salón) — compartido Reportes / Pedidos. */
export function MesaFloorIcon({
  occupied,
  className = "",
}: {
  occupied: boolean;
  className?: string;
}) {
  const ink = occupied ? "var(--admin-coral)" : "currentColor";
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden fill="none">
      <rect
        x="27"
        y="4"
        width="10"
        height="8"
        rx="2.5"
        fill={ink}
        opacity={occupied ? 0.9 : 0.35}
      />
      <rect
        x="27"
        y="52"
        width="10"
        height="8"
        rx="2.5"
        fill={ink}
        opacity={occupied ? 0.9 : 0.35}
      />
      <rect
        x="4"
        y="27"
        width="8"
        height="10"
        rx="2.5"
        fill={ink}
        opacity={occupied ? 0.9 : 0.35}
      />
      <rect
        x="52"
        y="27"
        width="8"
        height="10"
        rx="2.5"
        fill={ink}
        opacity={occupied ? 0.9 : 0.35}
      />
      <circle
        cx="32"
        cy="32"
        r="16"
        stroke={ink}
        strokeWidth="2.5"
        fill={
          occupied
            ? "color-mix(in srgb, var(--admin-coral) 18%, white)"
            : "transparent"
        }
      />
      <circle
        cx="32"
        cy="32"
        r="6"
        fill={ink}
        opacity={occupied ? 0.85 : 0.22}
      />
    </svg>
  );
}
