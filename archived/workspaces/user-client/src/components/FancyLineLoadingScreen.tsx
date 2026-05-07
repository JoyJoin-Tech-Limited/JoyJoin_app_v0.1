import { useEffect, useState } from "react";
import styles from "./FancyLineLoadingScreen.module.css";
import joyJoinLogo from "@/assets/JoyJoinapp_logo_chi_ZhanKuQingKeHuangYouTi.png";

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
      <img
        src={joyJoinLogo}
        alt="悦聚 JoyJoin"
        className={styles.logo}
        draggable={false}
      />
    </div>
  );
}

