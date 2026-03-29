import { useState, useEffect, useRef } from 'react';
import * as tf from '@tensorflow/tfjs';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import * as poseDetection from '@tensorflow-models/pose-detection';
import * as faceLandmarksDetection from '@tensorflow-models/face-landmarks-detection';

export function useLocalVision(videoRef: React.RefObject<HTMLVideoElement | null>, isActive: boolean) {
  const [objects, setObjects] = useState<cocoSsd.DetectedObject[]>([]);
  const [poses, setPoses] = useState<poseDetection.Pose[]>([]);
  const [faces, setFaces] = useState<faceLandmarksDetection.Face[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const objectDetectorRef = useRef<cocoSsd.ObjectDetection | null>(null);
  const poseDetectorRef = useRef<poseDetection.PoseDetector | null>(null);
  const faceDetectorRef = useRef<faceLandmarksDetection.FaceLandmarksDetector | null>(null);
  const requestRef = useRef<number>(0);

  useEffect(() => {
    let mounted = true;
    const loadModels = async (retries = 3) => {
      for (let i = 0; i < retries; i++) {
        try {
          await tf.ready();
          const model = faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh;
          const detectorConfig = {
            runtime: 'tfjs',
          };
          
          console.log(`Loading models (attempt ${i + 1})...`);
          const [objDetector, pDetector, fDetector] = await Promise.all([
            cocoSsd.load({ base: 'lite_mobilenet_v2' }),
            poseDetection.createDetector(poseDetection.SupportedModels.MoveNet, {
              modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING
            }),
            faceLandmarksDetection.createDetector(model, detectorConfig as any)
          ]);
          
          if (mounted) {
            objectDetectorRef.current = objDetector;
            poseDetectorRef.current = pDetector;
            faceDetectorRef.current = fDetector;
            setIsReady(true);
            setError(null);
            console.log("Models loaded successfully");
            return;
          }
        } catch (e) {
          console.error(`Failed to load local vision models (attempt ${i + 1}):`, e);
          if (i === retries - 1) {
            if (mounted) setError("Vision models failed to load. Local scanning disabled.");
          } else {
            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }
      }
    };
    
    loadModels();
    
    return () => {
      mounted = false;
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isActive || !isReady || !videoRef.current) return;

    const detect = async () => {
      const video = videoRef.current;
      if (video && video.readyState === 4 && objectDetectorRef.current && poseDetectorRef.current && faceDetectorRef.current) {
        try {
          const [detectedObjects, detectedPoses, detectedFaces] = await Promise.all([
            objectDetectorRef.current.detect(video),
            poseDetectorRef.current.estimatePoses(video),
            faceDetectorRef.current.estimateFaces(video)
          ]);
          
          setObjects(detectedObjects);
          setPoses(detectedPoses);
          setFaces(detectedFaces);
        } catch (e) {
          // Ignore detection errors during unmount or video state changes
        }
      }
      requestRef.current = requestAnimationFrame(detect);
    };

    requestRef.current = requestAnimationFrame(detect);

    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [isActive, isReady, videoRef]);

  return { objects, poses, faces, isReady, error };
}
