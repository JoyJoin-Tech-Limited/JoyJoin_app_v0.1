import { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";

interface IcebreakerOverlayContextValue {
  registerOverlay: () => () => void;
  isOverlayActive: boolean;
  surfaceRef: React.RefObject<HTMLDivElement>;
}

const IcebreakerOverlayContext = createContext<IcebreakerOverlayContextValue | null>(null);

export function useIcebreakerOverlay() {
  const context = useContext(IcebreakerOverlayContext);
  if (!context) {
    throw new Error('useIcebreakerOverlay must be used within IcebreakerOverlayProvider');
  }
  return context;
}

interface IcebreakerOverlayProviderProps {
  children: React.ReactNode;
}

export function IcebreakerOverlayProvider({ children }: IcebreakerOverlayProviderProps) {
  const [overlayCount, setOverlayCount] = useState(0);
  const surfaceRef = useRef<HTMLDivElement>(null);
  
  const isOverlayActive = overlayCount > 0;

  const registerOverlay = useCallback(() => {
    setOverlayCount(prev => prev + 1);
    return () => {
      setOverlayCount(prev => Math.max(0, prev - 1));
    };
  }, []);

  useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface) return;

    if (isOverlayActive) {
      surface.style.pointerEvents = 'none';
      surface.style.overflow = 'hidden';
      surface.setAttribute('aria-hidden', 'true');
      surface.setAttribute('inert', '');
      // 阻止 body 滚动
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
    } else {
      surface.style.pointerEvents = '';
      surface.style.overflow = '';
      surface.removeAttribute('aria-hidden');
      surface.removeAttribute('inert');
      // 恢复 body 滚动
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    }
  }, [isOverlayActive]);

  return (
    <IcebreakerOverlayContext.Provider value={{ registerOverlay, isOverlayActive, surfaceRef }}>
      {children}
    </IcebreakerOverlayContext.Provider>
  );
}

interface IcebreakerSurfaceProps {
  children: React.ReactNode;
  className?: string;
}

export function IcebreakerSurface({ children, className = '' }: IcebreakerSurfaceProps) {
  const { surfaceRef } = useIcebreakerOverlay();
  
  return (
    <div ref={surfaceRef} className={className} data-icebreaker-surface>
      {children}
    </div>
  );
}
