import { useState, useEffect, useCallback, useRef } from 'react';
import { ConnectionStatus, GeminiLiveState, DetectedObject } from '../types';
import { db, auth } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { AudioRecorder, AudioStreamPlayer } from './audio-processing';
import GeminiWorker from './gemini-live.worker?worker';

export function useGeminiLive() {
  const [state, setState] = useState<GeminiLiveState>({
    status: ConnectionStatus.DISCONNECTED,
    transcript: '',
    lastResponse: '',
    error: null,
    analyser: null,
    detectedObjects: [],
    assistantMode: 'hud',
    frameControl: { zoom: 1, x: 0, y: 0, active: false }
  });

  const workerRef = useRef<Worker | null>(null);
  const audioRecorderRef = useRef<AudioRecorder | null>(null);
  const audioPlayerRef = useRef<AudioStreamPlayer | null>(null);

  const saveFact = async (fact: string) => {
    if (!auth.currentUser) return;
    try {
      const factsRef = collection(db, 'users', auth.currentUser.uid, 'facts');
      await addDoc(factsRef, {
        userId: auth.currentUser.uid,
        fact,
        createdAt: serverTimestamp()
      });
    } catch (error) {
      console.error("Error saving fact:", error);
    }
  };

  const setAssistantMode = useCallback((mode: 'hud' | 'assistant') => {
    setState(prev => ({ ...prev, assistantMode: mode }));
  }, []);

  const connect = useCallback(async () => {
    if (state.status !== ConnectionStatus.DISCONNECTED) return;

    setState(prev => ({ ...prev, status: ConnectionStatus.CONNECTING, error: null }));

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      setState(prev => ({ ...prev, error: "GEMINI_API_KEY is missing", status: ConnectionStatus.ERROR }));
      return;
    }

    // Initialize Worker
    workerRef.current = new GeminiWorker();
    
    workerRef.current.onmessage = (e) => {
      const { type, payload } = e.data;
      if (type === 'CONNECTED') {
        audioRecorderRef.current?.start().then(() => {
          setState(prev => ({ 
            ...prev, 
            status: ConnectionStatus.CONNECTED,
            analyser: audioRecorderRef.current?.getAnalyser() || null
          }));
        });
      } else if (type === 'MESSAGE') {
        const message = payload;
        const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
        if (base64Audio) audioPlayerRef.current?.play(base64Audio);
        
        // Handle transcriptions/text (simplified for audio-first)
        if (message.serverContent?.turnComplete) {
          setState(prev => ({ ...prev, transcript: '' }));
        }
      } else if (type === 'ERROR') {
        setState(prev => ({ ...prev, error: payload, status: ConnectionStatus.ERROR }));
      }
    };

    audioPlayerRef.current = new AudioStreamPlayer();
    audioRecorderRef.current = new AudioRecorder((base64Data) => {
      workerRef.current?.postMessage({ type: 'SEND_AUDIO', payload: base64Data });
    });

    workerRef.current.postMessage({ type: 'CONNECT', payload: { apiKey } });
  }, [state.status]);

  const disconnect = useCallback(() => {
    workerRef.current?.postMessage({ type: 'DISCONNECT' });
    workerRef.current?.terminate();
    workerRef.current = null;
    audioRecorderRef.current?.stop();
    audioPlayerRef.current?.stop();
    setState(prev => ({ ...prev, status: ConnectionStatus.DISCONNECTED, analyser: null }));
  }, []);

  const sendVideoFrame = useCallback((base64Data: string) => {
    if (state.status === ConnectionStatus.CONNECTED) {
      workerRef.current?.postMessage({ type: 'SEND_VIDEO', payload: base64Data });
    }
  }, [state.status]);

  return {
    ...state,
    connect,
    disconnect,
    sendVideoFrame,
    setAssistantMode,
    saveFact
  };
}



