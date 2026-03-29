import React, { useRef, useEffect } from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { DetectedObject } from '../types';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import * as poseDetection from '@tensorflow-models/pose-detection';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface HUDOverlayProps {
  className?: string;
  isScanning: boolean;
  detectedObjects?: DetectedObject[];
  localObjects?: cocoSsd.DetectedObject[];
  localPoses?: poseDetection.Pose[];
  videoRef?: React.RefObject<HTMLVideoElement>;
}

export const HUDOverlay: React.FC<HUDOverlayProps> = ({ 
  className, 
  isScanning, 
  detectedObjects = [],
  localObjects = [],
  localPoses = [],
  videoRef
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const smoothedObjects = useRef<Map<string, { x: number, y: number, w: number, h: number }>>(new Map());
  const smoothedPoses = useRef<Map<number, { x: number, y: number }[]>>(new Map());

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrame: number;
    let scanLineY = 0;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (isScanning) {
        // Draw scan line with ghosting/trails
        const scanHeight = 80; // Trail length
        const gradient = ctx.createLinearGradient(0, scanLineY - scanHeight, 0, scanLineY);
        gradient.addColorStop(0, 'rgba(255, 107, 0, 0)');
        gradient.addColorStop(0.5, 'rgba(255, 107, 0, 0.05)');
        gradient.addColorStop(1, 'rgba(255, 107, 0, 0.3)');

        ctx.fillStyle = gradient;
        ctx.fillRect(0, scanLineY - scanHeight, canvas.width, scanHeight);

        // Leading edge of the scanline
        ctx.strokeStyle = 'rgba(255, 107, 0, 0.8)';
        ctx.lineWidth = 1.5;
        ctx.shadowColor = 'rgba(255, 107, 0, 1)';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.moveTo(0, scanLineY);
        ctx.lineTo(canvas.width, scanLineY);
        ctx.stroke();
        
        // Reset shadow
        ctx.shadowBlur = 0;

        scanLineY = (scanLineY + 3) % (canvas.height + scanHeight);

        // Draw refined grid (subtle dashed lines)
        ctx.strokeStyle = 'rgba(255, 107, 0, 0.04)';
        ctx.lineWidth = 0.5;
        ctx.setLineDash([2, 10]); // Dashed lines for less intrusion
        const gridSize = 100;
        ctx.beginPath();
        for (let x = 0; x < canvas.width; x += gridSize) {
          ctx.moveTo(x, 0);
          ctx.lineTo(x, canvas.height);
        }
        for (let y = 0; y < canvas.height; y += gridSize) {
          ctx.moveTo(0, y);
          ctx.lineTo(canvas.width, y);
        }
        ctx.stroke();
        ctx.setLineDash([]); // Reset line dash
      }

      // Calculate scale if videoRef is provided
      let scaleX = 1;
      let scaleY = 1;
      if (videoRef?.current && videoRef.current.videoWidth) {
        // The video is object-cover, so we need to calculate the actual displayed size and offset
        const videoRatio = videoRef.current.videoWidth / videoRef.current.videoHeight;
        const canvasRatio = canvas.width / canvas.height;
        
        if (canvasRatio > videoRatio) {
          // Canvas is wider than video
          scaleX = canvas.width / videoRef.current.videoWidth;
          scaleY = scaleX;
        } else {
          // Canvas is taller than video
          scaleY = canvas.height / videoRef.current.videoHeight;
          scaleX = scaleY;
        }
      }

      const offsetX = (canvas.width - (videoRef?.current?.videoWidth || 0) * scaleX) / 2;
      const offsetY = (canvas.height - (videoRef?.current?.videoHeight || 0) * scaleY) / 2;

      // Draw local objects (COCO-SSD)
      const currentObjKeys = new Set<string>();
      
      localObjects.forEach((obj, index) => {
        const [x, y, width, height] = obj.bbox;
        const targetX = x * scaleX + offsetX;
        const targetY = y * scaleY + offsetY;
        const targetW = width * scaleX;
        const targetH = height * scaleY;

        // Use class name + index as a rough unique key for smoothing
        const key = `${obj.class}_${index}`;
        currentObjKeys.add(key);

        let current = smoothedObjects.current.get(key);
        if (!current) {
          current = { x: targetX, y: targetY, w: targetW, h: targetH };
        } else {
          // Lerp for smoothing (0.3 is the smoothing factor)
          current.x += (targetX - current.x) * 0.3;
          current.y += (targetY - current.y) * 0.3;
          current.w += (targetW - current.w) * 0.3;
          current.h += (targetH - current.h) * 0.3;
        }
        smoothedObjects.current.set(key, current);

        const { x: sx, y: sy, w: sw, h: sh } = current;

        // Draw bounding box corners
        ctx.strokeStyle = 'rgba(0, 255, 255, 0.8)';
        ctx.lineWidth = 2;
        ctx.shadowColor = 'rgba(0, 255, 255, 0.5)';
        ctx.shadowBlur = 5;
        
        const b = 12; // Increased bracket size
        ctx.beginPath();
        ctx.moveTo(sx, sy + b); ctx.lineTo(sx, sy); ctx.lineTo(sx + b, sy);
        ctx.moveTo(sx + sw - b, sy); ctx.lineTo(sx + sw, sy); ctx.lineTo(sx + sw, sy + b);
        ctx.moveTo(sx + sw, sy + sh - b); ctx.lineTo(sx + sw, sy + sh); ctx.lineTo(sx + sw - b, sy + sh);
        ctx.moveTo(sx + b, sy + sh); ctx.lineTo(sx, sy + sh); ctx.lineTo(sx, sy + sh - b);
        ctx.stroke();
        ctx.shadowBlur = 0; // Reset shadow

        // Draw label with background
        const labelText = `${obj.class.toUpperCase()} [${Math.round(obj.score * 100)}%]`;
        ctx.font = 'bold 12px monospace';
        const textMetrics = ctx.measureText(labelText);
        const padding = 4;
        
        ctx.fillStyle = 'rgba(0, 255, 255, 0.2)';
        ctx.fillRect(sx, sy - 18, textMetrics.width + padding * 2, 16);
        
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.fillText(labelText, sx + padding, sy - 6);
      });

      // Cleanup old objects
      smoothedObjects.current.forEach((_, key) => {
        if (!currentObjKeys.has(key)) smoothedObjects.current.delete(key);
      });

      // Draw local poses (MoveNet)
      const currentPoseKeys = new Set<number>();

      localPoses.forEach((pose, index) => {
        if (pose.score && pose.score < 0.3) return;
        
        currentPoseKeys.add(index);
        let currentPose = smoothedPoses.current.get(index);
        
        if (!currentPose || currentPose.length !== pose.keypoints.length) {
          currentPose = pose.keypoints.map(kp => ({
            x: kp.x * scaleX + offsetX,
            y: kp.y * scaleY + offsetY
          }));
        } else {
          currentPose = pose.keypoints.map((kp, i) => {
            const targetX = kp.x * scaleX + offsetX;
            const targetY = kp.y * scaleY + offsetY;
            return {
              x: currentPose![i].x + (targetX - currentPose![i].x) * 0.4,
              y: currentPose![i].y + (targetY - currentPose![i].y) * 0.4
            };
          });
        }
        smoothedPoses.current.set(index, currentPose);
        
        ctx.fillStyle = 'rgba(255, 0, 255, 0.8)';
        ctx.strokeStyle = 'rgba(255, 0, 255, 0.5)';
        ctx.lineWidth = 2;

        // Draw keypoints
        pose.keypoints.forEach((kp, i) => {
          if (kp.score && kp.score > 0.3) {
            const { x: kx, y: ky } = currentPose![i];
            ctx.beginPath();
            ctx.arc(kx, ky, 3, 0, 2 * Math.PI);
            ctx.fill();
          }
        });

        // Draw skeleton lines (simplified)
        const adjacentKeyPoints = poseDetection.util.getAdjacentPairs(poseDetection.SupportedModels.MoveNet);
        adjacentKeyPoints.forEach(([i, j]) => {
          const kp1 = pose.keypoints[i];
          const kp2 = pose.keypoints[j];
          if (kp1.score && kp1.score > 0.3 && kp2.score && kp2.score > 0.3) {
            ctx.beginPath();
            ctx.moveTo(currentPose![i].x, currentPose![i].y);
            ctx.lineTo(currentPose![j].x, currentPose![j].y);
            ctx.stroke();
          }
        });
      });

      // Cleanup old poses
      smoothedPoses.current.forEach((_, key) => {
        if (!currentPoseKeys.has(key)) smoothedPoses.current.delete(key);
      });

      // Draw Gemini detected objects with simulated VR depth
      detectedObjects.forEach(obj => {
        const x = obj.x * canvas.width;
        const y = obj.y * canvas.height;
        const w = obj.w * canvas.width;
        const h = obj.h * canvas.height;
        
        // Depth simulation: smaller scale and lower opacity for distant objects
        const depth = obj.depth || 1;
        const scale = 1 / (depth * 0.5 + 0.5);
        const opacity = Math.min(1, scale * 1.2);

        ctx.save();
        ctx.translate(x + w/2, y + h/2);
        ctx.scale(scale, scale);
        ctx.translate(-(x + w/2), -(y + h/2));

        // Glow effect
        ctx.shadowColor = 'rgba(255, 107, 0, 0.8)';
        ctx.shadowBlur = 4;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;

        ctx.strokeStyle = `rgba(255, 107, 0, ${opacity * 0.6})`;
        ctx.lineWidth = 1.5;
        
        // Minimal corners
        const b = 8; 
        ctx.beginPath();
        ctx.moveTo(x, y + b); ctx.lineTo(x, y); ctx.lineTo(x + b, y);
        ctx.moveTo(x + w - b, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + b);
        ctx.moveTo(x + w, y + h - b); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w - b, y + h);
        ctx.moveTo(x + b, y + h); ctx.lineTo(x, y + h); ctx.lineTo(x, y + h - b);
        ctx.stroke();

        // Label with shadow
        ctx.shadowColor = 'rgba(0, 0, 0, 1)';
        ctx.shadowBlur = 2;
        ctx.shadowOffsetX = 1;
        ctx.shadowOffsetY = 1;
        
        ctx.fillStyle = `rgba(255, 107, 0, ${opacity * 0.9})`;
        ctx.font = `bold ${Math.max(7, 9 * scale)}px monospace`;
        const labelText = `${obj.label.toUpperCase()} [${Math.round(obj.confidence * 100)}%]`;
        ctx.fillText(labelText, x, y - 6);
        
        const distText = `DEPTH: ${depth.toFixed(1)}m`;
        ctx.fillText(distText, x, y + h + 12);
        
        ctx.restore();
      });

      // Draw advanced crosshair and rotating arcs
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const time = Date.now() / 1000;

      ctx.save();
      ctx.translate(centerX, centerY);

      // Rotating outer arc
      ctx.rotate(time * 0.5);
      ctx.strokeStyle = 'rgba(255, 107, 0, 0.15)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 0, 120, 0, Math.PI * 0.8);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, 120, Math.PI, Math.PI * 1.8);
      ctx.stroke();

      // Rotating inner dashed arc (opposite direction)
      ctx.rotate(-time * 1.2);
      ctx.strokeStyle = 'rgba(0, 255, 255, 0.2)';
      ctx.setLineDash([4, 8]);
      ctx.beginPath();
      ctx.arc(0, 0, 80, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.restore();

      // Static center crosshair
      ctx.strokeStyle = 'rgba(255, 107, 0, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(centerX - 15, centerY); ctx.lineTo(centerX + 15, centerY);
      ctx.moveTo(centerX, centerY - 15); ctx.lineTo(centerX, centerY + 15);
      ctx.stroke();
      
      // Center dot
      ctx.fillStyle = 'rgba(255, 107, 0, 0.8)';
      ctx.beginPath();
      ctx.arc(centerX, centerY, 2, 0, Math.PI * 2);
      ctx.fill();

      // Corner brackets for the center focus area
      const focusSize = 40;
      ctx.strokeStyle = 'rgba(255, 107, 0, 0.3)';
      ctx.beginPath();
      // Top Left
      ctx.moveTo(centerX - focusSize, centerY - focusSize + 10);
      ctx.lineTo(centerX - focusSize, centerY - focusSize);
      ctx.lineTo(centerX - focusSize + 10, centerY - focusSize);
      // Top Right
      ctx.moveTo(centerX + focusSize - 10, centerY - focusSize);
      ctx.lineTo(centerX + focusSize, centerY - focusSize);
      ctx.lineTo(centerX + focusSize, centerY - focusSize + 10);
      // Bottom Right
      ctx.moveTo(centerX + focusSize, centerY + focusSize - 10);
      ctx.lineTo(centerX + focusSize, centerY + focusSize);
      ctx.lineTo(centerX + focusSize - 10, centerY + focusSize);
      // Bottom Left
      ctx.moveTo(centerX - focusSize + 10, centerY + focusSize);
      ctx.lineTo(centerX - focusSize, centerY + focusSize);
      ctx.lineTo(centerX - focusSize, centerY + focusSize - 10);
      ctx.stroke();

      animationFrame = requestAnimationFrame(render);
    };

    const handleResize = () => {
      const parent = canvas.parentElement;
      if (parent) {
        canvas.width = parent.clientWidth;
        canvas.height = parent.clientHeight;
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize();
    render();

    return () => {
      cancelAnimationFrame(animationFrame);
      window.removeEventListener('resize', handleResize);
    };
  }, [isScanning, detectedObjects, localObjects, localPoses, videoRef]);

  return (
    <canvas 
      ref={canvasRef} 
      className={cn("absolute inset-0 pointer-events-none", className)}
    />
  );
};
