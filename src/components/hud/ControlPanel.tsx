import React from 'react';
import { Camera, CameraOff, Mic, MicOff } from 'lucide-react';
import { motion } from 'motion/react';
import { ConnectionStatus } from '../../types';

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ControlPanelProps {
  isCameraActive: boolean;
  onToggleCamera: () => void;
  status: ConnectionStatus;
  onToggleLink: () => void;
  className?: string;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({ 
  isCameraActive, 
  onToggleCamera, 
  status, 
  onToggleLink,
  className
}) => {
  const isConnected = status === ConnectionStatus.CONNECTED;

  return (
    <footer className={cn("h-16 flex items-center justify-between px-6 z-50", className)}>
      <div className="flex gap-4">
        <button 
          onClick={onToggleCamera}
          className={`p-3 rounded-full backdrop-blur-md transition-all ${isCameraActive ? 'bg-cyan-400/20 text-cyan-400' : 'bg-red-500/20 text-red-500'}`}
        >
          {isCameraActive ? <Camera size={18} /> : <CameraOff size={18} />}
        </button>
        <button 
          className={`p-3 rounded-full backdrop-blur-md transition-all ${isConnected ? 'bg-cyan-400/20 text-cyan-400' : 'bg-red-500/20 text-red-500'}`}
        >
          {isConnected ? <Mic size={18} /> : <MicOff size={18} />}
        </button>
      </div>

      <div className="flex-1 mx-8 h-[1px] bg-white/10 relative">
        <motion.div 
          className="absolute top-0 left-0 h-full bg-cyan-400 shadow-[0_0_10px_#00FFFF]"
          animate={{ width: isConnected ? "100%" : "0%" }}
          transition={{ duration: 2 }}
        />
      </div>

      <button
        onClick={onToggleLink}
        className={`px-6 py-2.5 text-[10px] font-mono border transition-all tracking-widest ${
          isConnected 
            ? 'border-red-500/40 text-red-500 hover:bg-red-500/20' 
            : 'border-cyan-400/40 text-cyan-400 hover:bg-cyan-400/20'
        }`}
      >
        {isConnected ? "ОТКЛЮЧИТЬ" : "СОЕДИНИТЬ"}
      </button>
    </footer>
  );
};
