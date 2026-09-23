/**
 * Fixed, pointer-events-none film-grain overlay applied once at the page
 * root. Never placed on a scrolling container (continuous GPU repaint would
 * tank mobile FPS).
 */
export function GrainOverlay() {
  return (
    <svg
      aria-hidden
      className="fixed inset-0 z-[60] h-full w-full pointer-events-none opacity-[0.035] mix-blend-overlay"
    >
      <filter id="grain-noise">
        <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves={2} stitchTiles="stitch" />
        <feColorMatrix type="saturate" values="0" />
      </filter>
      <rect width="100%" height="100%" filter="url(#grain-noise)" />
    </svg>
  );
}
