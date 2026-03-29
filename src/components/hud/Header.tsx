import React from 'react';
import { Cpu, Radio, Zap, Shield } from 'lucide-react';
import { ConnectionStatus } from '../../types';

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface HeaderProps {
  status: ConnectionStatus;
  className?: string;
}

export const Header: React.FC<HeaderProps> = ({ status, className }) => {
  const isConnected = status === ConnectionStatus.CONNECTED;

  return (
    <header className={cn("h-12 flex items-center justify-between px-6 z-50", className)}>
      <div className="flex items-center gap-3">
        <Cpu className="w-4 h-4 animate-pulse text-cyan-400" />
        <span className="text-[11px] font-mono tracking-widest text-white/90">CYBER_CORE v2.0</span>
      </div>
      <div className="flex items-center gap-6 text-[10px] font-mono tracking-widest text-white/60">
        <div className="flex items-center gap-2">
          <Radio className={isConnected ? "text-cyan-400" : "text-red-500"} size={12} />
          LINK: {isConnected ? "ACTIVE" : "OFFLINE"}
        </div>
        <div className="flex items-center gap-2">
          <Zap size={12} className="text-cyan-400" />
          PWR: 98.4%
        </div>
        <div className="flex items-center gap-2 hidden sm:flex">
          <Shield size={12} className="text-cyan-400" />
          SYS: STABLE
        </div>
      </div>
    </header>
  );
};
