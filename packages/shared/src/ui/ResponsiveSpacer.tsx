import { useEffect, useState } from "react";

function readInnerHeight(): number {
  const g = globalThis as typeof globalThis & { innerHeight?: number };
  return typeof g.innerHeight === "number" ? g.innerHeight : 9999;
}

export type ResponsiveSpacerProps = {
  /** CSS height when not collapsed (number = px) */
  height: number | string;
  /** When window inner height is below this threshold, the spacer collapses (0 height / null). */
  collapseBelow?: number;
  className?: string;
};

/**
 * Vertical spacer that can collapse on short viewports so primary CTAs stay visible
 * without relying on document scroll (see viewport-zero-scroll skill).
 */
export function ResponsiveSpacer({
  height,
  collapseBelow,
  className,
}: ResponsiveSpacerProps) {
  const [innerHeight, setInnerHeight] = useState(readInnerHeight);

  useEffect(() => {
    const g = globalThis as typeof globalThis & {
      addEventListener?: (type: string, listener: () => void) => void;
      removeEventListener?: (type: string, listener: () => void) => void;
    };
    const onResize = () => setInnerHeight(readInnerHeight());
    g.addEventListener?.("resize", onResize);
    return () => g.removeEventListener?.("resize", onResize);
  }, []);

  if (collapseBelow !== undefined && innerHeight < collapseBelow) {
    return null;
  }

  const h = typeof height === "number" ? `${height}px` : height;

  return (
    <div
      className={className}
      style={{ height: h, flexShrink: 0 }}
      aria-hidden
    />
  );
}
