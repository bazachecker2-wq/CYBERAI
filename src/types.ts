export enum ConnectionStatus {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  ERROR = 'ERROR',
}

export interface DetectedObject {
  label: string;
  confidence: number;
  x: number;
  y: number;
  w: number;
  h: number;
  depth?: number;
}

export interface SystemLog {
  id: string;
  timestamp: Date;
  message: string;
  type: 'info' | 'error' | 'neural' | 'system';
}

export interface GeminiLiveState {
  status: ConnectionStatus;
  transcript: string;
  lastResponse: string;
  error: string | null;
  analyser: AnalyserNode | null;
  detectedObjects: DetectedObject[];
  assistantMode: 'hud' | 'assistant';
  frameControl: {
    zoom: number;
    x: number;
    y: number;
    active: boolean;
  };
}
