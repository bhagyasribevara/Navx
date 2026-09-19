import React, { useState, useEffect, useRef } from 'react';
import './NavXSplashScreen.css';

const TOTAL_DURATION = 4600;
const FADE_START = 3700;

/**
 * Cinematic NavX splash screen — neon-purple letter materialization
 * inspired by the Xevon reference animation.
 *
 * Props:
 *   onComplete – called when the animation finishes and the overlay is removed
 */
export default function NavXSplashScreen({ onComplete }) {
  const [fadeOut, setFadeOut] = useState(false);
  const [visible, setVisible] = useState(true);
  const canvasRef = useRef(null);
  const particlesRef = useRef([]);
  const animFrameRef = useRef(null);
  const startRef = useRef(null);

  /* ---- Canvas particle system ---- */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;

    const resize = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    startRef.current = performance.now();

    function spawnParticle(burst = false) {
      const angle = Math.random() * Math.PI * 2;
      const speed = burst ? 1.5 + Math.random() * 2 : 0.3 + Math.random() * 0.5;
      return {
        x: cx + (Math.random() - 0.5) * 320,
        y: cy + (Math.random() - 0.5) * 60,
        vx: Math.cos(angle) * speed * (burst ? 1 : 0.4),
        vy: Math.sin(angle) * speed * (burst ? 1 : 0.3) - 0.4,
        size: burst ? 1.5 + Math.random() * 2 : 0.6 + Math.random() * 2,
        life: 1,
        decay: burst ? 0.015 + Math.random() * 0.01 : 0.004 + Math.random() * 0.006,
        hue: 258 + Math.random() * 28,
        sat: 65 + Math.random() * 20,
        bri: 60 + Math.random() * 35,
      };
    }

    // Schedule burst particles when each character materializes
    const charTimes = [450, 670, 890, 1110]; // ms
    const burstTimers = charTimes.map((t) =>
      setTimeout(() => {
        for (let i = 0; i < 18; i++) {
          const p = spawnParticle(true);
          // Offset x toward each character's approximate position
          const charIdx = charTimes.indexOf(t);
          p.x = cx + (charIdx - 1.5) * (window.innerWidth < 600 ? 28 : 52);
          p.y = cy + (Math.random() - 0.5) * 30;
          particlesRef.current.push(p);
        }
      }, t)
    );

    function frame() {
      const elapsed = performance.now() - startRef.current;
      const w = window.innerWidth;
      const h = window.innerHeight;

      ctx.clearRect(0, 0, w, h);

      // Continuous ambient particles (0.3s — 3.2s)
      if (elapsed > 300 && elapsed < 3200) {
        const rate = elapsed < 1400 ? 3 : 1;
        for (let i = 0; i < rate; i++) particlesRef.current.push(spawnParticle(false));
      }

      // Update & draw
      const alive = [];
      for (const p of particlesRef.current) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy -= 0.003;
        p.life -= p.decay;
        if (p.life <= 0) continue;

        const a = Math.min(p.life, 1) * 0.75;
        const color = `hsla(${p.hue}, ${p.sat}%, ${p.bri}%, ${a})`;

        ctx.save();
        ctx.globalAlpha = a;

        // Glow ring
        ctx.shadowBlur = 14;
        ctx.shadowColor = color;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();

        // Hot white core for larger particles
        if (p.size > 1.4) {
          ctx.shadowBlur = 0;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * 0.28, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255,255,255,${a * 0.7})`;
          ctx.fill();
        }

        ctx.restore();
        alive.push(p);
      }
      particlesRef.current = alive;

      if (elapsed < TOTAL_DURATION + 800) {
        animFrameRef.current = requestAnimationFrame(frame);
      }
    }

    animFrameRef.current = requestAnimationFrame(frame);

    return () => {
      window.removeEventListener('resize', resize);
      burstTimers.forEach(clearTimeout);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  /* ---- Phase timing ---- */
  useEffect(() => {
    const t1 = setTimeout(() => setFadeOut(true), FADE_START);
    const t2 = setTimeout(() => {
      setVisible(false);
      onComplete?.();
    }, TOTAL_DURATION);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [onComplete]);

  if (!visible) return null;

  const chars = ['N', 'a', 'v', 'X'];

  return (
    <div className={`navx-splash-overlay${fadeOut ? ' fade-out' : ''}`}>
      {/* Background */}
      <div className="splash-bg-ambient" />
      <div className="splash-vignette" />
      <div className="splash-noise" />

      {/* Particles */}
      <canvas ref={canvasRef} className="splash-canvas" />

      {/* Light beam */}
      <div className="splash-light-beam" />

      {/* Shockwave ring */}
      <div className="splash-shockwave" />

      {/* Text + effects */}
      <div className="splash-text-wrapper">
        {/* Blurred glow copy */}
        <div className="splash-glow-backdrop">
          <div className="splash-glow-text">NavX</div>
        </div>

        {/* Energy line */}
        <div className="splash-energy-line" />

        {/* Characters */}
        <div className="splash-text">
          {chars.map((ch, i) => (
            <span key={i} className="splash-char" style={{ '--char-index': i }}>
              {ch}
            </span>
          ))}
        </div>
      </div>

      {/* Tagline */}
      <div className="splash-subtitle">Indoor Navigation Platform</div>
    </div>
  );
}
