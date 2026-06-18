import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface StartupScreenProps {
  onComplete: () => void;
}

const STATUS_MESSAGES = [
  "Awakening Archival Core",
  "Resolving Visual Vectors",
  "Synchronizing Neural Lattice",
  "Calibrating Spatial Optics",
  "Structuring Memory Arrays",
  "Finalizing Environment Matrix"
];

export const StartupScreen: React.FC<StartupScreenProps> = ({ onComplete }) => {
  const [progress, setProgress] = useState(0);
  const [isExiting, setIsExiting] = useState(false);
  const [statusIndex, setStatusIndex] = useState(0);

  useEffect(() => {
    const nextIndex = Math.min(
      STATUS_MESSAGES.length - 1,
      Math.floor((progress / 100) * STATUS_MESSAGES.length)
    );
    if (nextIndex !== statusIndex) {
      setStatusIndex(nextIndex);
    }
  }, [progress, statusIndex]);

  useEffect(() => {
    let currentProgress = 0;
    let timer: any;

    const tick = () => {
      let increment = 1;
      if (currentProgress < 30) increment = Math.random() * 2 + 0.5;
      else if (currentProgress < 70) increment = Math.random() * 3 + 1;
      else if (currentProgress < 90) increment = Math.random() * 1 + 0.2;
      else increment = 0.5;

      currentProgress = Math.min(100, currentProgress + increment);
      setProgress(currentProgress);

      if (currentProgress < 100) {
        const nextDelay = currentProgress > 85 ? 150 : 40;
        timer = setTimeout(tick, nextDelay);
      } else {
        setTimeout(() => {
          setIsExiting(true);
          setTimeout(onComplete, 1200);
        }, 1000);
      }
    };

    timer = setTimeout(tick, 500);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <motion.div 
      initial={{ opacity: 1 }}
      animate={isExiting ? { opacity: 0, scale: 1.05, filter: 'blur(30px)' } : { opacity: 1 }}
      transition={{ duration: 1.5, ease: [0.22, 1, 0.36, 1] }}
      className="fixed inset-0 z-[10000] bg-white flex flex-col items-center justify-center select-none overflow-hidden"
    >
      {/* Central Composition */}
      <div className="relative flex flex-col items-center z-10 w-full max-w-sm px-12">
        
        {/* Branding Area */}
        <div className="relative mb-20">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
            className="relative"
          >
// The Logo - Brutalist Stark
            <div className="relative w-40 h-40 md:w-56 md:h-56 flex items-center justify-center overflow-hidden">
              <motion.img 
                initial={{ scale: 1.2, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 2, ease: [0.16, 1, 0.3, 1] }}
                src="/logo.jpg" 
                alt="VIAS"
                className="w-full h-full object-contain contrast-125"
                draggable={false}
              />
            </div>
          </motion.div>
        </div>

        {/* Identity & Progress */}
        <div className="flex flex-col items-start gap-12 w-full">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4, duration: 1 }}
            className="space-y-4 w-full"
          >
            <div className="flex flex-col gap-1">
              <h1 className="text-black text-2xl font-black tracking-tighter uppercase leading-none">
                VIAS ARCHIVE
              </h1>
              <div className="flex justify-between items-center w-full">
                <span className="text-[9px] font-mono font-bold tracking-widest text-black/40 uppercase">Global Indexing</span>
                <span className="text-[9px] font-mono font-bold text-black">v1.2.0</span>
              </div>
            </div>
            <div className="h-2 w-full bg-black shadow-[4px_4px_0px_rgba(0,0,0,0.1)]" />
          </motion.div>

          <div className="w-full flex flex-col gap-8">
            {/* Status & Percent */}
            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-end w-full">
                <AnimatePresence mode="wait">
                  <motion.span
                    key={statusIndex}
                    initial={{ opacity: 0, x: -5 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 5 }}
                    transition={{ duration: 0.3 }}
                    className="text-[10px] text-black font-mono font-black uppercase tracking-tighter"
                  >
                    {STATUS_MESSAGES[statusIndex]}
                  </motion.span>
                </AnimatePresence>
                <span className="text-xl font-mono text-black font-black tabular-nums">{Math.floor(progress)}%</span>
              </div>
              
              {/* Minimal Progress Bar */}
              <div className="w-full h-2 bg-black/10 relative overflow-hidden border border-black/5">
                <motion.div 
                  className="absolute left-0 top-0 bottom-0 bg-black"
                  initial={{ width: "0%" }}
                  animate={{ width: `${progress}%` }}
                  transition={{ ease: "linear" }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Brutalist Fine Print */}
      <div 
        className="absolute bottom-6 left-12 right-12 flex justify-between items-end"
        style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex flex-col gap-1">
          <span className="text-[8px] font-mono text-black/40 uppercase tracking-[0.4em]">Proprietary Visual OS</span>
          <span className="text-[8px] font-mono text-black/20 uppercase tracking-[0.4em]">No Permissions Required</span>
        </div>
        <div className="text-[8px] font-mono text-black/40 text-right font-bold">
          © 2026 VIAS ECOSYSTEM<br />
          STARK_MODE_ACTIVE
        </div>
      </div>
    </motion.div>
  );
};
