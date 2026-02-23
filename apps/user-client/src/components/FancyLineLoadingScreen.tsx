import { useEffect, useState } from "react";
import styles from "./FancyLineLoadingScreen.module.css";

type Props = {
  loop?: boolean;
  onFinish?: () => void;
  visible?: boolean;
};

export function FancyLineLoadingScreen({
  loop = false,
  onFinish,
  visible = true,
}: Props) {
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!loop) {
      const t = setTimeout(() => {
        setDone(true);
        onFinish?.();
      }, 1000);
      return () => clearTimeout(t);
    }
  }, [loop, onFinish]);

  if (!visible) return null;

  return (
    <div
      className={`${styles.wrap} ${done ? styles.fadeOut : ""}`}
      role="status"
      aria-live="polite"
      aria-label="Loading"
    >
      <svg
        className={styles.svg}
        viewBox="0 0 200 80"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="joy-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#a259c6" />
            <stop offset="50%" stopColor="#8B5CF6" />
            <stop offset="100%" stopColor="#a259c6" />
          </linearGradient>
        </defs>
        {/* Infinity symbol path centred in 200×80 viewport */}
        <path
          className={styles.line}
          d="M100,40
             C100,20 120,10 140,10
             C160,10 180,20 180,40
             C180,60 160,70 140,70
             C120,70 100,50 100,40
             C100,30 80,10 60,10
             C40,10 20,20 20,40
             C20,60 40,70 60,70
             C80,70 100,50 100,40 Z"
        />
      </svg>
    </div>
  );
}

