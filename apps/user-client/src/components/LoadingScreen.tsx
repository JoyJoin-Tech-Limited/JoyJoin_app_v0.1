import React, { useEffect, useMemo, useState } from "react";
import styles from "./LoadingScreen.module.css";
import joyjoinLogo from "../assets/joyjoin-logo.png";

const STATUS_LINES = [
  "正在匹配你的氛围...",
  "正在酝酿破冰话题...",
  "正在寻找完美组合...",
  "正在检测性格契合度...",
  "正在排队一场温暖相聚..."
];

export const LoadingScreen: React.FC = () => {
  const [statusIndex, setStatusIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setStatusIndex((i) => (i + 1) % STATUS_LINES.length);
    }, 1800);
    return () => clearInterval(id);
  }, []);

  const status = useMemo(() => STATUS_LINES[statusIndex], [statusIndex]);

  return (
    <div className={styles.wrapper}>
      <img
        src={joyjoinLogo}
        alt="JoyJoin logo"
        className={styles.logo}
        draggable={false}
      />

      <div
        className={styles.boxScene}
        role="img"
        aria-label="JoyJoin 吉祥物从盒子里探出头"
      >
        <div className={styles.box}>
          <div className={`${styles.boxFace} ${styles.front}`}>悦聚</div>
          <div className={`${styles.boxFace} ${styles.side}`}></div>
          <div className={`${styles.boxFace} ${styles.lid}`}></div>
        </div>

        <div className={styles.mascots}>
          <div className={`${styles.mascot} ${styles.fox}`}></div>
          <div className={`${styles.mascot} ${styles.koala}`}></div>
          <div className={`${styles.mascot} ${styles.turtle}`}></div>
        </div>
      </div>

      <div className={styles.status} aria-live="polite">
        {status}
      </div>
    </div>
  );
};
