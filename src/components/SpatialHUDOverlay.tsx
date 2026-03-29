import React, { useRef, useMemo, useState, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Text, Line } from '@react-three/drei';
import { useSpring, animated } from '@react-spring/three';
import * as THREE from 'three';
import { DetectedObject } from '../types';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import * as poseDetection from '@tensorflow-models/pose-detection';

import * as faceLandmarksDetection from '@tensorflow-models/face-landmarks-detection';

// Helper to map 2D video coordinates to 3D viewport coordinates
const mapCoordinates = (
  x: number, y: number, w: number, h: number, 
  videoWidth: number, videoHeight: number, 
  canvasWidth: number, canvasHeight: number,
  viewportWidth: number, viewportHeight: number
) => {
  // Calculate scale to match object-cover
  const videoRatio = videoWidth / videoHeight;
  const canvasRatio = canvasWidth / canvasHeight;
  
  let scaleX = 1;
  let scaleY = 1;
  
  if (canvasRatio > videoRatio) {
    scaleX = canvasWidth / videoWidth;
    scaleY = scaleX;
  } else {
    scaleY = canvasHeight / videoHeight;
    scaleX = scaleY;
  }

  const offsetX = (canvasWidth - videoWidth * scaleX) / 2;
  const offsetY = (canvasHeight - videoHeight * scaleY) / 2;

  const screenX = x * scaleX + offsetX;
  const screenY = y * scaleY + offsetY;
  const screenW = w * scaleX;
  const screenH = h * scaleY;

  // Map to 3D viewport
  const x3d = (screenX / canvasWidth - 0.5) * viewportWidth;
  const y3d = -(screenY / canvasHeight - 0.5) * viewportHeight;
  const w3d = (screenW / canvasWidth) * viewportWidth;
  const h3d = (screenH / canvasHeight) * viewportHeight;

  return { x3d, y3d, w3d, h3d };
};

const HolographicBox = ({ 
  obj, 
  videoWidth, 
  videoHeight, 
  canvasWidth, 
  canvasHeight,
  color = '#00ffff',
  isGemini = false
}: { 
  obj: any, 
  videoWidth: number, 
  videoHeight: number, 
  canvasWidth: number, 
  canvasHeight: number,
  color?: string,
  isGemini?: boolean
}) => {
  const isCoco = !isGemini;
  const rawX = isCoco ? obj.bbox[0] : obj.x * canvasWidth;
  const rawY = isCoco ? obj.bbox[1] : obj.y * canvasHeight;
  const rawW = isCoco ? obj.bbox[2] : obj.w * canvasWidth;
  const rawH = isCoco ? obj.bbox[3] : obj.h * canvasHeight;
  const label = isCoco ? obj.class : obj.label;
  const score = isCoco ? obj.score : obj.confidence;
  const depth = obj.depth || 0;

  const { viewport } = useThree();

  const { x3d, y3d, w3d, h3d } = mapCoordinates(
    rawX, rawY, rawW, rawH, 
    videoWidth, videoHeight, 
    canvasWidth, canvasHeight,
    viewport.width, viewport.height
  );

  // Center of the box
  const cx = x3d + w3d / 2;
  const cy = y3d - h3d / 2;
  
  // Perspective: deeper objects are further back and smaller
  const cz = isGemini ? -depth * 2 : 0;
  const depthScale = isGemini ? Math.max(0.3, 1 / (1 + depth * 0.15)) : 1;
  const depthOpacity = isGemini ? Math.max(0.2, 1 / (1 + depth * 0.1)) : 1;

  // Corners for the box
  const b = Math.min(w3d, h3d) * 0.15; // bracket size
  const hw = w3d / 2;
  const hh = h3d / 2;

  const { position, scale, opacity } = useSpring({
    position: [cx, cy, cz] as [number, number, number],
    scale: depthScale,
    opacity: depthOpacity,
    from: { position: [cx, cy, cz], scale: 0, opacity: 0 },
    config: { mass: 1, tension: 170, friction: 26 }
  });

  return (
    <animated.group position={position as any} scale={scale as any}>
        <Line points={[new THREE.Vector3(-hw, hh - b, 0), new THREE.Vector3(-hw, hh, 0), new THREE.Vector3(-hw + b, hh, 0)]} color={color} lineWidth={2} transparent opacity={opacity as any} />
        <Line points={[new THREE.Vector3(hw - b, hh, 0), new THREE.Vector3(hw, hh, 0), new THREE.Vector3(hw, hh - b, 0)]} color={color} lineWidth={2} transparent opacity={opacity as any} />
        <Line points={[new THREE.Vector3(hw, -hh + b, 0), new THREE.Vector3(hw, -hh, 0), new THREE.Vector3(hw - b, -hh, 0)]} color={color} lineWidth={2} transparent opacity={opacity as any} />
        <Line points={[new THREE.Vector3(-hw + b, -hh, 0), new THREE.Vector3(-hw, -hh, 0), new THREE.Vector3(-hw, -hh + b, 0)]} color={color} lineWidth={2} transparent opacity={opacity as any} />
        
        {/* Holographic glowing plane behind the box */}
        <mesh position={[0, 0, -0.1]}>
          <planeGeometry args={[w3d, h3d]} />
          <animated.meshBasicMaterial color={color} transparent opacity={opacity as any} blending={THREE.AdditiveBlending} />
        </mesh>

        <Text
          position={[-hw, hh + 0.2, 0]}
          anchorX="left"
          anchorY="bottom"
          fontSize={0.3}
          color={color}
          font="https://fonts.gstatic.com/s/jetbrainsmono/v13/tDbY2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8yKxTOlOV.woff"
          characters="ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789[%] "
        >
          {`${label.toUpperCase()} [${Math.round(score * 100)}%]`}
          <animated.meshBasicMaterial attach="material" color={color} toneMapped={false} transparent opacity={opacity as any} />
        </Text>
        
        {isGemini && (
          <Text
            position={[-hw, -hh - 0.2, 0]}
            anchorX="left"
            anchorY="top"
            fontSize={0.25}
            color={color}
            font="https://fonts.gstatic.com/s/jetbrainsmono/v13/tDbY2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8yKxTOlOV.woff"
          >
            {`DEPTH: ${depth.toFixed(1)}m`}
            <animated.meshBasicMaterial attach="material" color={color} toneMapped={false} transparent opacity={opacity as any} />
          </Text>
        )}
    </animated.group>
  );
};

const AnimatedKeypoint = ({ kp }: { kp: any }) => {
  const { position, scale } = useSpring({
    position: [kp.x3d, kp.y3d, 0] as [number, number, number],
    scale: 1,
    from: { position: [kp.x3d, kp.y3d, 0], scale: 0 },
    config: { mass: 1, tension: 200, friction: 20 }
  });

  return (
    <animated.mesh position={position as any} scale={scale as any}>
      <sphereGeometry args={[0.08, 16, 16]} />
      <meshBasicMaterial color="#00ffff" transparent opacity={0.8} toneMapped={false} />
    </animated.mesh>
  );
};

const HolographicPose = React.memo(({ 
  pose, 
  videoWidth, 
  videoHeight, 
  canvasWidth, 
  canvasHeight 
}: { 
  pose: poseDetection.Pose, 
  videoWidth: number, 
  videoHeight: number, 
  canvasWidth: number, 
  canvasHeight: number 
}) => {
  const { viewport } = useThree();
  
  const mappedKeypoints = useMemo(() => {
    return pose.keypoints.map(kp => {
      const { x3d, y3d } = mapCoordinates(
        kp.x, kp.y, 0, 0, 
        videoWidth, videoHeight, 
        canvasWidth, canvasHeight,
        viewport.width, viewport.height
      );
      return { ...kp, x3d, y3d };
    });
  }, [pose, videoWidth, videoHeight, canvasWidth, canvasHeight, viewport.width, viewport.height]);

  const adjacentPairs = useMemo(() => poseDetection.util.getAdjacentPairs(poseDetection.SupportedModels.MoveNet), []);

  return (
    <group>
      {mappedKeypoints.map((kp, i) => {
        if (kp.score && kp.score > 0.3) {
          return <AnimatedKeypoint key={i} kp={kp} />;
        }
        return null;
      })}
      
      {adjacentPairs.map(([i, j], idx) => {
        const kp1 = mappedKeypoints[i];
        const kp2 = mappedKeypoints[j];
        if (kp1.score && kp1.score > 0.3 && kp2.score && kp2.score > 0.3) {
          return (
            <Line 
              key={`line-${idx}`}
              points={[new THREE.Vector3(kp1.x3d, kp1.y3d, 0), new THREE.Vector3(kp2.x3d, kp2.y3d, 0)]}
              color="#00ffff"
              lineWidth={2}
              transparent
              opacity={0.5}
            />
          );
        }
        return null;
      })}
    </group>
  );
});

const HolographicFace = React.memo(({ 
  face, 
  videoWidth, 
  videoHeight, 
  canvasWidth, 
  canvasHeight 
}: { 
  face: faceLandmarksDetection.Face, 
  videoWidth: number, 
  videoHeight: number, 
  canvasWidth: number, 
  canvasHeight: number 
}) => {
  const { viewport } = useThree();
  
  const mappedKeypoints = useMemo(() => {
    return face.keypoints.map((kp: any) => {
      const { x3d, y3d } = mapCoordinates(
        kp.x, kp.y, 0, 0, 
        videoWidth, videoHeight, 
        canvasWidth, canvasHeight,
        viewport.width, viewport.height
      );
      return { ...kp, x3d, y3d };
    });
  }, [face, videoWidth, videoHeight, canvasWidth, canvasHeight, viewport.width, viewport.height]);

  return (
    <group>
      {mappedKeypoints.map((kp: any, i: number) => (
        <mesh key={i} position={[kp.x3d, kp.y3d, 0]}>
          <circleGeometry args={[0.015, 8]} />
          <meshBasicMaterial color="#00ffff" transparent opacity={0.4} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
});

// A floating grid in the background to give a sense of 3D space
const SpatialGrid = () => {
  const ref = useRef<THREE.Group>(null);
  
  useFrame((state) => {
    if (ref.current) {
      // Slight parallax based on mouse
      ref.current.rotation.x = THREE.MathUtils.lerp(ref.current.rotation.x, (state.pointer.y * Math.PI) / 20, 0.05);
      ref.current.rotation.y = THREE.MathUtils.lerp(ref.current.rotation.y, (state.pointer.x * Math.PI) / 20, 0.05);
    }
  });

  return (
    <group ref={ref} position={[0, 0, -5]}>
      <gridHelper args={[50, 50, '#00ffff', '#00ffff']} position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]} material-opacity={0.05} material-transparent />
      
      {/* Floating particles for depth */}
      {Array.from({ length: 50 }).map((_, i) => (
        <mesh 
          key={i} 
          position={[
            (Math.random() - 0.5) * 20, 
            (Math.random() - 0.5) * 20, 
            (Math.random() - 0.5) * 10
          ]}
        >
          <sphereGeometry args={[0.02, 8, 8]} />
          <meshBasicMaterial color="#00ffff" transparent opacity={Math.random() * 0.5} />
        </mesh>
      ))}
    </group>
  );
};

const Crosshair = ({ status, isFocused }: { status: string, isFocused: boolean }) => {
  const ref = useRef<THREE.Group>(null);
  const innerRef = useRef<THREE.Group>(null);
  
  useFrame((state) => {
    if (ref.current) {
      ref.current.rotation.z = state.clock.elapsedTime * 0.5;
    }
    if (innerRef.current) {
      innerRef.current.rotation.z = -state.clock.elapsedTime * 1.2;
    }
  });

  // Determine color based on status
  let targetColor = '#00ffff'; // Default / Connected
  if (status === 'ERROR') targetColor = '#ff0000';
  else if (status === 'CONNECTING') targetColor = '#ffaa00';
  else if (status === 'DISCONNECTED') targetColor = '#555555';

  // Dynamic spring animation for size and opacity
  const { scale, opacity, color } = useSpring({
    scale: isFocused ? 1.5 : 1,
    opacity: isFocused ? 1 : 0.6,
    color: targetColor,
    config: { mass: 1, tension: 200, friction: 20 }
  });

  const animatedColor = useMemo(() => new THREE.Color(color as any), [color]);

  // Create arc points
  const outerArc1 = useMemo(() => {
    const pts = [];
    for (let i = 0; i <= 20; i++) {
      const angle = (i / 20) * Math.PI * 0.8;
      pts.push(Math.cos(angle) * 2, Math.sin(angle) * 2, 0);
    }
    return pts;
  }, []);

  const outerArc2 = useMemo(() => {
    const pts = [];
    for (let i = 0; i <= 20; i++) {
      const angle = Math.PI + (i / 20) * Math.PI * 0.8;
      pts.push(Math.cos(angle) * 2, Math.sin(angle) * 2, 0);
    }
    return pts;
  }, []);

  const innerCircle = useMemo(() => {
    const pts = [];
    for (let i = 0; i <= 40; i++) {
      const angle = (i / 40) * Math.PI * 2;
      pts.push(Math.cos(angle) * 1.2, Math.sin(angle) * 1.2, 0);
    }
    return pts;
  }, []);

  return (
    <animated.group position={[0, 0, 0]} scale={scale as any}>
      <group ref={ref}>
        <Line points={outerArc1.map(p => new THREE.Vector3(p[0], p[1], p[2]))} color={animatedColor} lineWidth={1} transparent opacity={0.3} />
        <Line points={outerArc2.map(p => new THREE.Vector3(p[0], p[1], p[2]))} color={animatedColor} lineWidth={1} transparent opacity={0.3} />
      </group>
      
      <group ref={innerRef}>
        <Line points={innerCircle.map(p => new THREE.Vector3(p[0], p[1], p[2]))} color={animatedColor} lineWidth={1} transparent opacity={0.2} dashed dashScale={10} dashSize={0.5} gapSize={0.5} />
      </group>

      {/* Center cross */}
      <Line points={[new THREE.Vector3(-0.3, 0, 0), new THREE.Vector3(0.3, 0, 0)]} color={animatedColor} lineWidth={1.5} transparent opacity={opacity as any} />
      <Line points={[new THREE.Vector3(0, -0.3, 0), new THREE.Vector3(0, 0.3, 0)]} color={animatedColor} lineWidth={1.5} transparent opacity={opacity as any} />
      
      {/* Center dot */}
      <animated.mesh>
        <circleGeometry args={[0.05, 16]} />
        <animated.meshBasicMaterial color={color} transparent opacity={opacity as any} />
      </animated.mesh>

      {/* Focus ring */}
      {isFocused && (
        <animated.mesh>
          <ringGeometry args={[0.4, 0.45, 32]} />
          <animated.meshBasicMaterial color={color} transparent opacity={0.8} />
        </animated.mesh>
      )}
    </animated.group>
  );
};

interface SpatialHUDOverlayProps {
  className?: string;
  isScanning: boolean;
  detectedObjects?: DetectedObject[];
  localObjects?: cocoSsd.DetectedObject[];
  localPoses?: poseDetection.Pose[];
  localFaces?: faceLandmarksDetection.Face[];
  videoRef?: React.RefObject<HTMLVideoElement>;
  status: string;
  isFocused: boolean;
  hudMode: 'standard' | 'immersive';
}

const Scene = ({ isScanning, detectedObjects, localObjects, localPoses, localFaces, videoRef, status, isFocused, hudMode }: any) => {
  const [dimensions, setDimensions] = useState({ w: 1, h: 1, vw: 1, vh: 1 });
  const { size } = useThree();

  useEffect(() => {
    const updateDimensions = () => {
      if (videoRef?.current) {
        setDimensions({
          w: size.width,
          h: size.height,
          vw: videoRef.current.videoWidth || size.width,
          vh: videoRef.current.videoHeight || size.height
        });
      }
    };

    updateDimensions();
    
    // Poll for video dimensions in case they change or load late
    const interval = setInterval(updateDimensions, 500);
    return () => clearInterval(interval);
  }, [size, videoRef]);

  // Camera sway effect
  useFrame((state) => {
    const swayFactor = hudMode === 'immersive' ? 1.5 : 0.5;
    state.camera.position.x = THREE.MathUtils.lerp(state.camera.position.x, (state.pointer.x * swayFactor), 0.05);
    state.camera.position.y = THREE.MathUtils.lerp(state.camera.position.y, (state.pointer.y * swayFactor), 0.05);
    state.camera.lookAt(0, 0, 0);
    
    // Adjust FOV for immersive mode
    if (hudMode === 'immersive') {
      (state.camera as THREE.PerspectiveCamera).fov = THREE.MathUtils.lerp((state.camera as THREE.PerspectiveCamera).fov, 70, 0.05);
    } else {
      (state.camera as THREE.PerspectiveCamera).fov = THREE.MathUtils.lerp((state.camera as THREE.PerspectiveCamera).fov, 50, 0.05);
    }
    (state.camera as THREE.PerspectiveCamera).updateProjectionMatrix();
  });

  return (
    <>
      <ambientLight intensity={1} />
      {isScanning && <SpatialGrid />}
      
      <Crosshair status={status} isFocused={isFocused} />

      {localObjects?.map((obj: any, i: number) => (
        <HolographicBox 
          key={`coco-${obj.class}-${i}`} 
          obj={obj} 
          videoWidth={dimensions.vw} 
          videoHeight={dimensions.vh} 
          canvasWidth={dimensions.w} 
          canvasHeight={dimensions.h} 
        />
      ))}

      {localPoses?.map((pose: any, i: number) => (
        <HolographicPose 
          key={`pose-${i}`} 
          pose={pose} 
          videoWidth={dimensions.vw} 
          videoHeight={dimensions.vh} 
          canvasWidth={dimensions.w} 
          canvasHeight={dimensions.h} 
        />
      ))}

      {localFaces?.map((face: any, i: number) => (
        <HolographicFace 
          key={`face-${i}`} 
          face={face} 
          videoWidth={dimensions.vw} 
          videoHeight={dimensions.vh} 
          canvasWidth={dimensions.w} 
          canvasHeight={dimensions.h} 
        />
      ))}

      {detectedObjects?.map((obj: any, i: number) => (
        <HolographicBox 
          key={`gemini-${obj.label}-${i}`} 
          obj={obj} 
          videoWidth={dimensions.vw} 
          videoHeight={dimensions.vh} 
          canvasWidth={dimensions.w} 
          canvasHeight={dimensions.h} 
          color="#00ffff"
          isGemini={true}
        />
      ))}
    </>
  );
};

export const SpatialHUDOverlay: React.FC<SpatialHUDOverlayProps> = (props) => {
  return (
    <div className={`absolute inset-0 pointer-events-none ${props.className || ''}`}>
      <Canvas 
        camera={{ position: [0, 0, 5], fov: 50 }}
        gl={{ alpha: true, antialias: true }}
      >
        <Scene {...props} />
      </Canvas>
    </div>
  );
};
