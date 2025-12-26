import { useState, useEffect, useCallback } from "react";

interface ViewportState {
  height: number;
  offsetTop: number;
  isKeyboardVisible: boolean;
  keyboardHeight: number;
}

export function useVisualViewport() {
  const [viewportState, setViewportState] = useState<ViewportState>({
    height: typeof window !== "undefined" ? window.innerHeight : 0,
    offsetTop: 0,
    isKeyboardVisible: false,
    keyboardHeight: 0,
  });

  const updateViewport = useCallback(() => {
    if (typeof window === "undefined") return;

    const visualViewport = window.visualViewport;
    if (visualViewport) {
      const keyboardHeight = window.innerHeight - visualViewport.height;
      setViewportState({
        height: visualViewport.height,
        offsetTop: visualViewport.offsetTop,
        isKeyboardVisible: keyboardHeight > 100,
        keyboardHeight: Math.max(0, keyboardHeight),
      });
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const visualViewport = window.visualViewport;
    if (!visualViewport) {
      return;
    }

    updateViewport();

    visualViewport.addEventListener("resize", updateViewport);
    visualViewport.addEventListener("scroll", updateViewport);

    return () => {
      visualViewport.removeEventListener("resize", updateViewport);
      visualViewport.removeEventListener("scroll", updateViewport);
    };
  }, [updateViewport]);

  return viewportState;
}

export function useScrollInputIntoView(inputRef: React.RefObject<HTMLInputElement | HTMLTextAreaElement>) {
  const { isKeyboardVisible } = useVisualViewport();

  useEffect(() => {
    if (isKeyboardVisible && inputRef.current) {
      setTimeout(() => {
        inputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 100);
    }
  }, [isKeyboardVisible, inputRef]);
}
