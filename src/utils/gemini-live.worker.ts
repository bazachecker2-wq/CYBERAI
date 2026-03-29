import { GoogleGenAI, Modality, LiveServerMessage } from "@google/genai";

let session: any = null;

self.onmessage = async (e) => {
  const { type, payload } = e.data;

  if (type === 'CONNECT') {
    const { apiKey } = payload;
    const ai = new GoogleGenAI({ apiKey });

    // Timeout mechanism
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error("Connection timeout")), 10000)
    );

    try {
      const connectPromise = ai.live.connect({
        model: "gemini-2.5-flash-native-audio-preview-12-2025",
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
          },
          systemInstruction: "Ты — ядро интеллекта кибернетического организма. ОТВЕЧАЙ МГНОВЕННО, КРАТКО. Естественный язык, без стиля робота. Язык: РУССКИЙ.",
          outputAudioTranscription: {},
          inputAudioTranscription: {},
        },
        callbacks: {
          onopen: () => {
            console.log("Worker: Connected");
            self.postMessage({ type: 'CONNECTED' });
          },
          onmessage: (message: LiveServerMessage) => {
            self.postMessage({ type: 'MESSAGE', payload: message });
          },
          onclose: () => {
            console.log("Worker: Disconnected");
            self.postMessage({ type: 'DISCONNECTED' });
          },
          onerror: (err) => {
            console.error("Worker: Error", err);
            self.postMessage({ type: 'ERROR', payload: err?.message || String(err) });
          }
        }
      });

      session = await Promise.race([connectPromise, timeoutPromise]);
    } catch (err: any) {
      console.error("Worker: Connection failed", err);
      self.postMessage({ type: 'ERROR', payload: err.message || String(err) });
    }
  } else if (type === 'SEND_AUDIO') {
    if (session) {
      session.sendRealtimeInput({
        audio: { data: payload, mimeType: 'audio/pcm;rate=16000' }
      });
    }
  } else if (type === 'SEND_VIDEO') {
    if (session) {
      session.sendRealtimeInput({
        video: { data: payload, mimeType: 'image/jpeg' }
      });
    }
  } else if (type === 'DISCONNECT') {
    if (session) {
      session.close();
      session = null;
    }
  }
};
