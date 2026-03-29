import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Terminal as TerminalIcon } from 'lucide-react';
import { SystemLog } from '../../types';

interface TerminalProps {
  logs: SystemLog[];
}

export const Terminal: React.FC<TerminalProps> = ({ logs }) => {
  return (
    <div className="flex-1 p-2 border-l border-cyan-400/20 overflow-hidden flex flex-col">
      <div className="text-[10px] text-cyan-400/50 mb-2 flex items-center gap-2 font-mono tracking-widest">
        <TerminalIcon size={12} />
        СИСТЕМНЫЙ_ЖУРНАЛ
      </div>
      <div className="flex-1 space-y-1 overflow-y-auto scrollbar-hide flex flex-col-reverse">
        <AnimatePresence mode="popLayout">
          {logs.map((log) => (
            <motion.div
              key={log.id}
              initial={{ opacity: 0, x: -5 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 5 }}
              className={`text-[10px] font-mono leading-tight ${log.type === 'error' ? 'text-red-500' : 'text-cyan-400/70'}`}
            >
              <span className="opacity-40 mr-2">[{log.timestamp.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}]</span>
              {log.message}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};
