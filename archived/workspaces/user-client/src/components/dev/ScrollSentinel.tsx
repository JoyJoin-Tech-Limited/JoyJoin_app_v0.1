import { useLayoutEffect, useState } from "react";

/**
 * Dev-only overlay: highlights when layout extends past the visual viewport.
 * Mount once under App (import.meta.env.DEV). See viewport-zero-scroll skill.
 */
export function ScrollSentinel() {
  const [px, setPx] = useState(0);

  useLayoutEffect(() => {
    if (!import.meta.env.DEV) return;

    const measure = () => {
      const el = document.getElementById("jj-scroll-chassis");
      const scrollRoot = el ?? document.documentElement;
      const total =
        scrollRoot === document.documentElement
          ? document.documentElement.scrollHeight
          : scrollRoot.scrollHeight;
      const visible = window.innerHeight;
      setPx(Math.max(0, Math.round(total - visible)));
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(document.documentElement);
    const chassis = document.getElementById("jj-scroll-chassis");
    if (chassis) ro.observe(chassis);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  if (!import.meta.env.DEV || px <= 0) return null;

  const band = Math.min(px, Math.round(window.innerHeight * 0.35));

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[9999] border-t-2 border-red-500/80"
      style={{
        height: band,
        background: "rgba(220, 38, 38, 0.28)",
        boxSizing: "border-box",
      }}
      aria-hidden
      data-scroll-sentinel-overflow={px}
    >
      <div className="absolute left-2 top-1 max-w-[min(100%-1rem,420px)] rounded bg-red-950/90 px-2 py-1 font-mono text-[11px] text-red-100 shadow">
        ScrollSentinel: ~{px}px past viewport (jj-scroll-chassis or document)
      </div>
    </div>
  );
}
