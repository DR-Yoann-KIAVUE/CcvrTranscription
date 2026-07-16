// Marque CCVR simplifiée : croissant plein à gauche + arcs concentriques à
// droite (évoque le tore / stent du logo). Monochrome, suit currentColor.
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" fill="none" className={className} aria-hidden="true">
      <path
        d="M20 3 a17 17 0 0 0 0 34 a11 11 0 0 1 0 -34 z"
        fill="currentColor"
      />
      <path
        d="M20 5 a15 15 0 0 1 0 30"
        stroke="currentColor"
        strokeWidth="1.4"
        fill="none"
      />
      <path
        d="M20 8.5 a11.5 11.5 0 0 1 0 23"
        stroke="currentColor"
        strokeWidth="1.2"
        fill="none"
      />
      <path
        d="M20 12 a8 8 0 0 1 0 16"
        stroke="currentColor"
        strokeWidth="1"
        fill="none"
      />
    </svg>
  );
}
