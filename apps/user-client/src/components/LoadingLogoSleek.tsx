import { useEffect, useState } from "react";
import styles from "./LoadingLogoSleek.module.css";
import joyjoinLogo from "@/assets/joyjoin-logo.png";

type Props = {
  loop?: boolean;
  onFinish?: () => void;
  visible?: boolean;
};

export function LoadingLogoSleek({
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
      className={`${styles.wrap} ${done ? styles.fadeOut : ""} ${
        loop ? styles.loop : ""
      }`}
      role="status"
      aria-live="polite"
    >
      <img
        src={joyjoinLogo}
        alt="JoyJoin"
        className={styles.logo}
        draggable={false}
      />
    </div>
  );
}

export default LoadingLogoSleek;
