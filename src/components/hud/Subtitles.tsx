import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface SubtitlesProps {
  text: string;
  className?: string;
}

export const Subtitles: React.FC<SubtitlesProps> = ({ text, className }) => {
  const [visibleText, setVisibleText] = useState('');

  useEffect(() => {
    if (text) {
      setVisibleText(text);
      
      const timer = setTimeout(() => {
        setVisibleText('');
      }, 5000);

      return () => clearTimeout(timer);
    } else {
      setVisibleText('');
    }
  }, [text]);

  return (
    <div className={className || "fixed bottom-24 left-1/2 -translate-x-1/2 w-full max-w-xl px-4 pointer-events-none z-40"}>
      <div className="flex flex-col items-center gap-2">
        <AnimatePresence mode="popLayout">
          {visibleText && (
            <motion.div
              key="subtitle-text"
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.4 }}
              className="px-4 py-1.5 text-center"
            >
              <span className="text-white font-mono text-sm tracking-widest drop-shadow-[0_2px_4px_rgba(0,0,0,1)] relative inline-block">
                <span className="absolute inset-0 text-cyan-400 opacity-50 translate-x-[1px] mix-blend-screen">{visibleText}</span>
                <span className="absolute inset-0 text-red-500 opacity-50 -translate-x-[1px] mix-blend-screen">{visibleText}</span>
                <span className="relative z-10">{visibleText}</span>
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
