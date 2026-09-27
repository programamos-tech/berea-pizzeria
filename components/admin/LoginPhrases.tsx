"use client";

import { useEffect, useState } from "react";

const PHRASES = [
  "Hoy también puedes empezar.",
  "Cada pedido cuenta.",
  "Tu pizzería, en orden.",
  "Confía en lo que estás armando.",
  "Tu esfuerzo de hoy cuenta.",
  "Sigue. Ya vas más lejos.",
];

export function LoginPhrases() {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const id = window.setInterval(() => {
      setVisible(false);
      window.setTimeout(() => {
        setIndex((current) => (current + 1) % PHRASES.length);
        setVisible(true);
      }, 280);
    }, 3800);
    return () => window.clearInterval(id);
  }, []);

  return (
    <p
      className="mt-8 h-10 max-w-[18rem] text-center text-sm font-medium text-white/95 transition-opacity duration-300"
      style={{ opacity: visible ? 1 : 0 }}
      aria-live="polite"
    >
      {PHRASES[index]}
    </p>
  );
}
