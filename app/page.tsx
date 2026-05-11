"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";

const FLIP_DURATION = 700;

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export default function Home() {
  const [flipped, setFlipped] = useState(false);
  const flippedRef = useRef(false);

  const wrapperRef = useRef<HTMLDivElement>(null); // tilt target (.flip-entrance)
  const innerRef = useRef<HTMLDivElement>(null);   // flip target (.flip-inner)

  const gyroStarted = useRef(false);
  const peekTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const peekRaf = useRef<number | null>(null);
  const flipRaf = useRef<number | null>(null);
  const interacted = useRef(false);

  /* ── Tilt ── */
  const applyTilt = useCallback((x: number, y: number, instant: boolean) => {
    if (!wrapperRef.current) return;
    wrapperRef.current.style.transform = `rotateX(${(-x * 14).toFixed(2)}deg) rotateY(${(y * 14).toFixed(2)}deg)`;
    wrapperRef.current.style.transition = instant
      ? "transform 80ms linear"
      : "transform 600ms cubic-bezier(0.23, 1, 0.32, 1)";
  }, []);

  /* ── Peek (rAF) ── */
  const cancelPeek = useCallback(() => {
    if (peekTimer.current) clearTimeout(peekTimer.current);
    if (peekRaf.current) cancelAnimationFrame(peekRaf.current);
    peekTimer.current = null;
    peekRaf.current = null;
  }, []);

  useEffect(() => {
    const runPeek = (iteration: number) => {
      if (interacted.current || iteration >= 2) return;
      const start = performance.now();
      const duration = 1100;
      const frame = (now: number) => {
        const t = Math.min(1, (now - start) / duration);
        const angle = Math.sin(t * Math.PI) * 25;
        if (wrapperRef.current) {
          wrapperRef.current.style.transform = `rotateY(${angle.toFixed(2)}deg)`;
          wrapperRef.current.style.transition = "none";
        }
        if (t < 1) {
          peekRaf.current = requestAnimationFrame(frame);
        } else {
          if (wrapperRef.current) {
            wrapperRef.current.style.transform = "";
            wrapperRef.current.style.transition = "";
          }
          if (!interacted.current) {
            peekTimer.current = setTimeout(() => runPeek(iteration + 1), 700);
          }
        }
      };
      peekRaf.current = requestAnimationFrame(frame);
    };
    peekTimer.current = setTimeout(() => runPeek(0), 2500);
    return () => cancelPeek();
  }, [cancelPeek]);

  /* ── Flip (rAF — CSS transition-г bypass хийж iOS Safari-д ажиллана) ── */
  const doFlip = useCallback((toFlipped: boolean) => {
    if (!innerRef.current) return;
    if (flipRaf.current) cancelAnimationFrame(flipRaf.current);

    const el = innerRef.current;
    const match = el.style.transform.match(/rotateY\(([-\d.]+)deg\)/);
    const startAngle = match ? parseFloat(match[1]) : (toFlipped ? 0 : 180);
    const endAngle = toFlipped ? 180 : 0;
    const startTime = performance.now();

    // CSS transition-г унтраана — rAF animate хийна
    el.style.webkitTransition = "none";
    el.style.transition = "none";

    const frame = (now: number) => {
      const t = Math.min(1, (now - startTime) / FLIP_DURATION);
      const angle = startAngle + (endAngle - startAngle) * easeInOutCubic(t);
      (el.style as any).webkitTransform = `rotateY(${angle.toFixed(2)}deg)`;
      el.style.transform = `rotateY(${angle.toFixed(2)}deg)`;
      if (t < 1) {
        flipRaf.current = requestAnimationFrame(frame);
      } else {
        flipRaf.current = null;
      }
    };
    flipRaf.current = requestAnimationFrame(frame);
  }, []);

  /* ── Gyroscope ── */
  const startGyroscope = useCallback(() => {
    if (gyroStarted.current) return;
    gyroStarted.current = true;
    let neutralBeta: number | null = null;
    let neutralGamma: number | null = null;
    window.addEventListener(
      "deviceorientation",
      (e: DeviceOrientationEvent) => {
        if (e.beta === null || e.gamma === null) return;
        if (neutralBeta === null) {
          neutralBeta = e.beta;
          neutralGamma = e.gamma ?? 0;
          return;
        }
        const x = Math.max(-1, Math.min(1, (e.beta - neutralBeta) / 25));
        const y = Math.max(-1, Math.min(1, ((e.gamma ?? 0) - neutralGamma!) / 25));
        applyTilt(x, y, true);
      },
      true
    );
  }, [applyTilt]);

  useEffect(() => {
    if (typeof window === "undefined" || !("DeviceOrientationEvent" in window)) return;
    const DOE = DeviceOrientationEvent as any;
    if (typeof DOE.requestPermission !== "function") startGyroscope();
  }, [startGyroscope]);

  /* ── Mouse ── */
  const onMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      cancelPeek();
      interacted.current = true;
      const rect = e.currentTarget.getBoundingClientRect();
      const x = (e.clientY - rect.top) / rect.height - 0.5;
      const y = (e.clientX - rect.left) / rect.width - 0.5;
      applyTilt(x, y, true);
    },
    [applyTilt, cancelPeek]
  );

  const onMouseLeave = useCallback(() => applyTilt(0, 0, false), [applyTilt]);

  /* ── Toggle ── */
  const toggle = () => {
    cancelPeek();
    interacted.current = true;
    const next = !flippedRef.current;
    flippedRef.current = next;
    setFlipped(next);
    doFlip(next);

    const DOE = DeviceOrientationEvent as any;
    if (typeof DOE.requestPermission === "function") {
      DOE.requestPermission()
        .then((s: string) => { if (s === "granted") startGyroscope(); })
        .catch(() => {});
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); }
  };

  return (
    <div className="page-wrapper">
      <div className="page-bg" aria-hidden="true" />
      <main className="invitation-main">
        <div className="ornament" aria-hidden="true">
          <div className="ornament-line" />
          <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M7 0L8.3 5.7L14 7L8.3 8.3L7 14L5.7 8.3L0 7L5.7 5.7L7 0Z" opacity="0.75" />
          </svg>
          <div className="ornament-line ornament-line--right" />
        </div>

        <div
          ref={wrapperRef}
          className="flip-entrance"
          onMouseMove={onMouseMove}
          onMouseLeave={onMouseLeave}
        >
          <div className="flip-card-wrapper">
            <div
              role="button"
              tabIndex={0}
              onClick={toggle}
              onKeyDown={onKeyDown}
              className="flip-card"
              aria-pressed={flipped}
              aria-label={flipped ? "Урд талыг харах" : "Арийн талыг харах"}
            >
              <div ref={innerRef} className="flip-inner">
                <div className="flip-sizer" aria-hidden="true" />
                <div className="flip-face">
                  <Image src="/Front_Side.png" alt="Урилгын урд тал" fill style={{ objectFit: "contain" }} draggable={false} priority />
                </div>
                <div className="flip-face flip-back">
                  <Image src="/Back_side.png" alt="Урилгын арийн тал" fill style={{ objectFit: "contain" }} draggable={false} />
                </div>
              </div>
            </div>
          </div>
        </div>

        <p className="tap-hint">
          <span className="tap-dot" />
          <span>{flipped ? "Дахин дараад эргүүлнэ үү" : "Дараад эргүүлнэ үү"}</span>
          <span className="tap-dot" />
        </p>

        <div className="ornament" aria-hidden="true">
          <div className="ornament-line" />
          <span className="ornament-diamonds">◆ ◆ ◆</span>
          <div className="ornament-line ornament-line--right" />
        </div>
      </main>
    </div>
  );
}
