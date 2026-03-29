import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { CameraFeed } from './CameraFeed';
import { SpatialHUDOverlay } from './SpatialHUDOverlay';
import { useGeminiLive } from '../utils/useGeminiLive';
import { useLocalVision } from '../utils/useLocalVision';
import { Header } from './hud/Header';
import { Terminal } from './hud/Terminal';
import { ControlPanel } from './hud/ControlPanel';
import { AudioVisualizer } from './hud/AudioVisualizer';
import { AssistantHead } from './hud/AssistantHead';
import { Subtitles } from './hud/Subtitles';
import { ConnectionStatus, SystemLog } from '../types';
import { Activity, Settings, List, X, Mic } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const CyberHUD: React.FC = () => {
  const { 
    status, 
    transcript,
    lastResponse, 
    error, 
    connect, 
    disconnect, 
    sendVideoFrame, 
    analyser, 
    detectedObjects, 
    assistantMode, 
    setAssistantMode,
    frameControl,
    saveFact
  } = useGeminiLive();
  
  const [isCameraActive, setIsCameraActive] = useState(true);
  const [hudMode, setHudMode] = useState<'standard' | 'immersive'>('standard');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [activeModal, setActiveModal] = useState<'none' | 'logs' | 'settings'>('none');
  const videoRef = useRef<HTMLVideoElement>(null);

  // Local vision models (COCO-SSD & MoveNet)
  const { objects: localObjects, poses: localPoses, faces: localFaces, isReady: visionReady, error: visionError } = useLocalVision(videoRef, isCameraActive);

  const [customModelUrl, setCustomModelUrl] = useState<string | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && (file.name.endsWith('.glb') || file.name.endsWith('.gltf'))) {
      const url = URL.createObjectURL(file);
      setCustomModelUrl(url);
    }
  };

  const addLog = useCallback((message: string, type: SystemLog['type'] = 'info') => {
    const newLog: SystemLog = {
      id: Math.random().toString(36).substring(7),
      timestamp: new Date(),
      message,
      type
    };
    setLogs(prev => [newLog, ...prev].slice(0, 50));
  }, []);

  useEffect(() => {
    addLog("СИСТЕМА ИНИЦИАЛИЗИРОВАНА", "system");
    addLog("ОЖИДАНИЕ НЕЙРОСВЯЗИ...", "system");
  }, [addLog]);

  useEffect(() => {
    if (visionReady) {
      addLog("ЛОКАЛЬНЫЕ МОДЕЛИ ЗРЕНИЯ АКТИВНЫ", "system");
    }
  }, [visionReady, addLog]);

  useEffect(() => {
    if (lastResponse) {
      const observationMatch = lastResponse.match(/^([^.!?]{5,50}[.!?])/);
      if (observationMatch) {
        addLog(`ОБНАРУЖЕНО: ${observationMatch[1]}`, "info");
      }
    }
  }, [lastResponse, addLog]);

  useEffect(() => {
    if (transcript) {
      addLog(`ВВОД: ${transcript}`, "info");
      if (transcript.toLowerCase().includes("запомни") || transcript.toLowerCase().includes("факт")) {
        saveFact(transcript);
        addLog("ФАКТ СОХРАНЕН В БАЗУ", "system");
      }
    }
  }, [transcript, addLog, saveFact]);

  useEffect(() => {
    if (error) {
      addLog(error, "error");
    }
  }, [error, addLog]);

  useEffect(() => {
    if (status === ConnectionStatus.CONNECTED) {
      addLog("НЕЙРОСВЯЗЬ УСТАНОВЛЕНА", "system");
    } else if (status === ConnectionStatus.DISCONNECTED) {
      addLog("НЕЙРОСВЯЗЬ РАЗОРВАНА", "system");
    }
  }, [status, addLog]);

  const handleToggleLink = () => {
    if (status === ConnectionStatus.CONNECTED) {
      disconnect();
      setIsCameraActive(false);
    } else {
      connect();
      setIsCameraActive(true);
    }
  };

  const toggleAssistantMode = () => {
    setAssistantMode(assistantMode === 'hud' ? 'assistant' : 'hud');
  };

  const userPosition = useMemo(() => {
    if (localPoses && localPoses.length > 0 && localPoses[0].keypoints) {
      const nose = localPoses[0].keypoints.find((kp: any) => kp.name === 'nose');
      if (nose && nose.score && nose.score > 0.3 && videoRef.current) {
        return {
          x: (nose.x / videoRef.current.videoWidth) * 2 - 1,
          y: -(nose.y / videoRef.current.videoHeight) * 2 + 1
        };
      }
    }
    return null;
  }, [localPoses]);

  // Frame control styles
  const videoStyle = useMemo(() => {
    if (!frameControl.active) return {};
    const scale = frameControl.zoom;
    const tx = (0.5 - frameControl.x) * 100 * scale;
    const ty = (0.5 - frameControl.y) * 100 * scale;
    return {
      transform: `scale(${scale}) translate(${tx}%, ${ty}%)`,
      transition: 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)'
    };
  }, [frameControl]);

  return (
    <div className="fixed inset-0 bg-[#050505] text-primary font-mono text-[10px] overflow-hidden">
      {/* Background Effects Overlay */}
      <div className="absolute inset-0 pointer-events-none z-[100] opacity-50" />

      {/* Full Screen Video Feed */}
      <div className="absolute inset-0 z-0 overflow-hidden bg-black">
        {assistantMode === 'hud' ? (
          <div className="w-full h-full relative">
            <CameraFeed 
              ref={videoRef}
              isActive={isCameraActive} 
              onFrame={sendVideoFrame}
              className="w-full h-full"
              style={videoStyle}
              filter="contrast(1.2) brightness(0.8) hue-rotate(180deg) saturate(0.5)"
              onError={(err) => setCameraError(err)}
            />
            <SpatialHUDOverlay 
              isScanning={status === ConnectionStatus.CONNECTED} 
              detectedObjects={detectedObjects} 
              localObjects={localObjects}
              localPoses={localPoses}
              localFaces={localFaces}
              videoRef={videoRef}
              status={status}
              isFocused={frameControl.active}
              hudMode={hudMode}
            />
            {(cameraError || visionError) && (
              <div className="absolute top-20 left-6 z-50 bg-black/80 p-4 border border-red-500/50 rounded-lg text-red-500 font-mono text-xs">
                {cameraError && <div>Camera Error: {cameraError}</div>}
                {visionError && <div>Vision Error: {visionError}</div>}
              </div>
            )}
          </div>
        ) : (
          <div className="w-full h-full bg-black flex items-center justify-center cursor-pointer relative" onClick={toggleAssistantMode}>
            <AssistantHead className="w-full h-full" isAssistantMode={true} analyser={analyser} modelUrl={customModelUrl} userPosition={userPosition} />
            <Subtitles text={lastResponse} className="absolute top-1/2 left-1/2 translate-x-32 -translate-y-1/2 w-80 z-50" />
          </div>
        )}
      </div>

      {/* Floating UI Overlays */}
      <Header status={status} className="absolute top-0 left-0 right-0 z-50" />

      <div className="absolute inset-0 pointer-events-none z-10">
        {/* User Transcript Overlay */}
        {transcript && (
          <div className="absolute top-24 left-1/2 -translate-x-1/2 max-w-lg w-full px-4 text-center">
            <div className="inline-block p-3">
              <div className="flex items-center justify-center gap-2 mb-1 opacity-70 drop-shadow-[0_2px_2px_rgba(0,0,0,1)]">
                <Mic size={12} className="animate-pulse text-cyan-400" />
                <span className="text-[10px] uppercase font-mono tracking-widest text-cyan-400">ВВОД ПОЛЬЗОВАТЕЛЯ</span>
              </div>
              <p className="text-sm text-white font-mono tracking-widest drop-shadow-[0_2px_2px_rgba(0,0,0,1)]">{transcript}</p>
            </div>
          </div>
        )}

        {/* Subtitles with shadow removed from here, moved to head */}

        {/* HUD Elements */}
        <div className="absolute inset-0 p-6 flex flex-col justify-between pointer-events-none">
          {/* Top minimal status bar */}
          <div className="flex justify-between items-start w-full">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <div className={`w-1.5 h-1.5 rounded-full ${isCameraActive ? 'bg-cyan-400 animate-pulse shadow-[0_0_8px_#00FFFF]' : 'bg-red-600'}`} />
                <span className="text-[10px] font-mono tracking-widest text-white/80">OPTIC_SENSOR</span>
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-1.5 h-1.5 rounded-full ${status === ConnectionStatus.CONNECTED ? 'bg-cyan-400 animate-pulse shadow-[0_0_8px_#00FFFF]' : 'bg-red-600'}`} />
                <span className="text-[10px] font-mono tracking-widest text-white/80">NEURAL_LINK</span>
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-1.5 h-1.5 rounded-full ${visionReady ? 'bg-cyan-400 animate-pulse shadow-[0_0_8px_#00FFFF]' : 'bg-red-600'}`} />
                <span className="text-[10px] font-mono tracking-widest text-white/80">LOCAL_AI</span>
              </div>
            </div>

            <div className="flex flex-col gap-1 text-right">
              <div className="text-[10px] font-mono tracking-widest text-white/80">MEM: 0x4F2A</div>
              <div className="text-[10px] font-mono tracking-widest text-white/80">CPU: 42%</div>
              <div className="text-[10px] font-mono tracking-widest text-white/80">NET: 12ms</div>
            </div>
          </div>

          {/* Audio visualizer bottom left */}
          <div className="flex justify-between items-end w-full">
            <div className="w-48 h-16">
              {status === ConnectionStatus.CONNECTED && (
                <AudioVisualizer analyser={analyser} className="opacity-80" />
              )}
            </div>
            <div className="text-[10px] font-mono tracking-widest text-cyan-400/50">SYS.OP.NORMAL</div>
          </div>
        </div>
      </div>

      {/* Interactive Controls Layer */}
      <div className="absolute inset-0 pointer-events-none z-30">
        {/* Minimal Overlay Controls */}
        <div className="absolute top-6 right-6 flex flex-col gap-3 pointer-events-auto">
          <button 
            onClick={() => setActiveModal(activeModal === 'logs' ? 'none' : 'logs')}
            className={`p-2.5 rounded-full backdrop-blur-md transition-all ${activeModal === 'logs' ? 'bg-cyan-400 text-black' : 'bg-black/40 text-cyan-400 hover:bg-cyan-400/20'}`}
          >
            <List size={18} />
          </button>
          <button 
            onClick={() => setActiveModal(activeModal === 'settings' ? 'none' : 'settings')}
            className={`p-2.5 rounded-full backdrop-blur-md transition-all ${activeModal === 'settings' ? 'bg-cyan-400 text-black' : 'bg-black/40 text-cyan-400 hover:bg-cyan-400/20'}`}
          >
            <Settings size={18} />
          </button>
        </div>

        {/* Picture-in-Picture Window */}
        <AnimatePresence>
          {status === ConnectionStatus.CONNECTED && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.8, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 20 }}
              onClick={toggleAssistantMode}
              className={`absolute bottom-24 right-4 cursor-pointer z-50 transition-all pointer-events-auto ${
                assistantMode === 'hud' 
                  ? 'w-48 h-48 bg-transparent border-none shadow-none' 
                  : 'w-56 h-36 border border-cyan-400/40 rounded-lg overflow-hidden shadow-[0_0_30px_rgba(0,255,255,0.1)] bg-black/80'
              }`}
            >
              {assistantMode === 'hud' ? (
                <>
                  <AssistantHead className="w-full h-full" analyser={analyser} modelUrl={customModelUrl} userPosition={userPosition} />
                  <Subtitles text={lastResponse} className="absolute top-1/2 -left-64 -translate-y-1/2 w-60 z-50" />
                </>
              ) : (
                <CameraFeed 
                  isActive={isCameraActive} 
                  onFrame={() => {}} 
                  className="w-full h-full"
                  filter="grayscale(1) contrast(1.3) brightness(0.7)"
                />
              )}
              <div className="absolute top-2 left-2 text-[8px] bg-black/80 px-1.5 py-0.5 rounded border border-cyan-400/20 uppercase font-mono text-cyan-400 tracking-widest">
                {assistantMode === 'hud' ? 'ASSISTANT' : 'LIVE FEED'}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Modals */}
        <AnimatePresence>
          {activeModal !== 'none' && (
            <motion.div 
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 30 }}
              className="absolute top-6 right-20 bottom-24 w-80 bg-black/80 backdrop-blur-xl border border-cyan-400/20 p-5 z-40 flex flex-col pointer-events-auto rounded-xl shadow-[0_0_30px_rgba(0,255,255,0.05)]"
            >
              <div className="flex justify-between items-center mb-5 border-b border-cyan-400/20 pb-3">
                <h3 className="text-sm font-mono tracking-widest text-cyan-400">
                  {activeModal === 'logs' ? 'СИСТЕМНЫЙ ЖУРНАЛ' : 'НАСТРОЙКИ'}
                </h3>
                <button onClick={() => setActiveModal('none')} className="text-cyan-400/50 hover:text-cyan-400 transition-colors">
                  <X size={18} />
                </button>
              </div>
              
              <div className="flex-1 overflow-hidden">
                {activeModal === 'logs' ? (
                  <Terminal logs={logs} />
                ) : (
                  <div className="space-y-5">
                    <div className="p-3 border border-cyan-400/20 rounded-lg bg-cyan-400/5">
                      <div className="text-[10px] opacity-60 mb-2 font-mono tracking-widest text-cyan-400">ОПТИМИЗАЦИЯ ГАРНИТУРЫ</div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-white/80">Режим VR/HMD</span>
                          <div 
                            className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors ${hudMode === 'immersive' ? 'bg-cyan-400' : 'bg-cyan-400/20'}`}
                            onClick={() => setHudMode(hudMode === 'standard' ? 'immersive' : 'standard')}
                          >
                            <div className={`absolute top-1 w-3 h-3 bg-white rounded-full shadow-[0_0_8px_#00FFFF] transition-all ${hudMode === 'immersive' ? 'right-1' : 'left-1'}`} />
                          </div>
                      </div>
                    </div>
                    
                    <div className="p-3 border border-cyan-400/20 rounded-lg bg-cyan-400/5">
                      <div className="text-[10px] opacity-60 mb-2 font-mono tracking-widest text-cyan-400">МОДЕЛЬ АССИСТЕНТА</div>
                      <div className="flex flex-col gap-3">
                        <span className="text-[10px] text-white/60">Загрузите свой .glb файл или укажите прямую ссылку</span>
                        
                        <input 
                          type="text" 
                          placeholder="https://.../model.glb"
                          className="w-full bg-black/50 border border-cyan-400/30 text-cyan-400 px-3 py-2 text-[10px] rounded focus:outline-none focus:border-cyan-400"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              const val = (e.target as HTMLInputElement).value;
                              if (val) setCustomModelUrl(val);
                            }
                          }}
                        />

                        <div className="text-[9px] text-cyan-400/50">
                          * Ссылки на Sketchfab (skfb.ly) нужно сначала скачать как .glb
                        </div>

                        <label className="cursor-pointer border border-cyan-400/30 hover:bg-cyan-400/10 transition-colors rounded px-3 py-2 text-center text-xs font-mono tracking-widest text-cyan-400">
                          ВЫБРАТЬ ФАЙЛ
                          <input 
                            type="file" 
                            accept=".glb,.gltf" 
                            className="hidden" 
                            onChange={handleFileUpload}
                          />
                        </label>
                        {customModelUrl && (
                          <button 
                            onClick={() => setCustomModelUrl(null)}
                            className="text-[10px] text-red-400 hover:text-red-300 font-mono tracking-widest text-right mt-1"
                          >
                            СБРОСИТЬ НА СТАНДАРТНУЮ
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Connection Overlay */}
        {status === ConnectionStatus.DISCONNECTED && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-md z-[60] pointer-events-auto">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-center p-8 border border-cyan-400/20 bg-black/80 max-w-sm rounded-xl"
            >
              <Activity className="w-12 h-12 mx-auto mb-4 text-cyan-400 animate-pulse" />
              <h2 className="text-xl font-mono mb-2 tracking-widest text-cyan-400">СИСТЕМА ОЖИДАЕТ</h2>
              <p className="text-[10px] font-mono text-white/50 mb-8 leading-relaxed">
                Установите защищенный канал связи с центральным ядром для активации интерфейса.
              </p>
              <button
                onClick={handleToggleLink}
                className="w-full py-3 bg-cyan-400/10 border border-cyan-400/50 text-cyan-400 font-mono text-xs hover:bg-cyan-400 hover:text-black transition-all cursor-pointer tracking-widest"
              >
                УСТАНОВИТЬ СОЕДИНЕНИЕ
              </button>
            </motion.div>
          </div>
        )}

        {status === ConnectionStatus.ERROR && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-xl z-[60] pointer-events-auto">
            <div className="text-center p-8 border border-red-500/20 bg-black/80 max-w-sm rounded-xl">
              <h2 className="text-xl font-mono mb-2 tracking-widest text-red-500">ОШИБКА СВЯЗИ</h2>
              <p className="text-[10px] font-mono text-white/50 mb-8 leading-relaxed">
                Не удалось установить защищенный канал. Проверьте сетевое подключение.
              </p>
              <button
                onClick={handleToggleLink}
                className="w-full py-3 bg-red-500/10 border border-red-500/50 text-red-500 font-mono text-xs hover:bg-red-500 hover:text-black transition-all cursor-pointer tracking-widest"
              >
                ПОВТОРИТЬ ПОДКЛЮЧЕНИЕ
              </button>
            </div>
          </div>
        )}

        {status === ConnectionStatus.CONNECTING && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-xl z-[60]">
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-cyan-400/20 border-t-cyan-400 rounded-full animate-spin mx-auto mb-4" />
              <div className="text-xs font-mono animate-pulse tracking-widest text-cyan-400">СИНХРОНИЗАЦИЯ...</div>
            </div>
          </div>
        )}
      </div>

      <ControlPanel 
        isCameraActive={isCameraActive}
        onToggleCamera={() => setIsCameraActive(!isCameraActive)}
        status={status}
        onToggleLink={handleToggleLink}
        className="absolute bottom-0 left-0 right-0 z-50"
      />
    </div>
  );
};

