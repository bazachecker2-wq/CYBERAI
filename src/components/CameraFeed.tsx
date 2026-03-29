import React, { useRef, useEffect, useCallback, forwardRef } from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface CameraFeedProps {
  className?: string;
  onFrame?: (base64: string) => void;
  isActive: boolean;
  filter?: string;
  style?: React.CSSProperties;
  onError?: (error: string) => void;
}

export const CameraFeed = forwardRef<HTMLVideoElement, CameraFeedProps>(({ className, onFrame, isActive, filter = "sepia(0.5) contrast(1.2) brightness(0.8)", style, onError }, ref) => {
  const internalVideoRef = useRef<HTMLVideoElement>(null);
  const videoRef = (ref as React.RefObject<HTMLVideoElement>) || internalVideoRef;
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!isActive) {
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
        videoRef.current.srcObject = null;
      }
      return;
    }

    const startCamera = async () => {
      try {
        const constraints: MediaStreamConstraints = { 
          video: { 
            facingMode: 'environment', 
            width: { ideal: 1280 }, 
            height: { ideal: 720 } 
          } 
        };
        
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia(constraints);
        } catch (e) {
          console.warn("Failed to get environment camera, falling back to any video source", e);
          stream = await navigator.mediaDevices.getUserMedia({ video: true });
        }

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Error accessing camera:", err);
        if (onError) onError(err instanceof Error ? err.message : "Unknown camera error");
      }
    };

    startCamera();
  }, [isActive, onError]);

  const captureFrame = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || !onFrame || !isActive) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    if (ctx && video.readyState === video.HAVE_ENOUGH_DATA) {
      // Maintain aspect ratio
      canvas.width = 640;
      canvas.height = 360;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      const base64 = canvas.toDataURL('image/jpeg', 0.6).split(',')[1];
      onFrame(base64);
    }
  }, [onFrame, isActive]);

  useEffect(() => {
    if (!isActive) return;
    const interval = setInterval(captureFrame, 300); // Send frame every 300ms (~3fps) for instant reaction
    return () => clearInterval(interval);
  }, [captureFrame, isActive]);

  return (
    <div className={cn("relative overflow-hidden bg-black flex items-center justify-center", className)}>
      {!isActive && (
        <div className="text-[8px] opacity-30 uppercase tracking-widest animate-pulse">
          Сенсор деактивирован
        </div>
      )}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{ ...style, filter }}
        className="w-full h-full object-cover"
      />
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
});

CameraFeed.displayName = 'CameraFeed';
