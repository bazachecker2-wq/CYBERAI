import React, { useRef, useState, useEffect, useMemo, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Sphere, MeshDistortMaterial, Float, useGLTF, PerspectiveCamera, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const CustomGLTFModel = ({ url, analyser }: { url: string, analyser?: AnalyserNode | null }) => {
  const { scene } = useGLTF(url);
  const meshRef = useRef<THREE.Group>(null);
  const dataArray = useMemo(() => analyser ? new Uint8Array(analyser.frequencyBinCount) : new Uint8Array(0), [analyser]);

  // Center and scale the model automatically
  useEffect(() => {
    if (scene) {
      const box = new THREE.Box3().setFromObject(scene);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      const scale = 2.5 / maxDim;
      scene.scale.set(scale, scale, scale);
      scene.position.set(-center.x * scale, -center.y * scale, -center.z * scale);
      
      // Add a subtle cyan emissive glow to all materials to match the HUD
      scene.traverse((child) => {
        if (child instanceof THREE.Mesh && child.material) {
          const mat = child.material as THREE.MeshStandardMaterial;
          mat.emissive = new THREE.Color('#00FFFF');
          mat.emissiveIntensity = 0.2;
          mat.needsUpdate = true;
        }
      });
    }
  }, [scene]);

  useFrame((state) => {
    let volume = 0;
    if (analyser && dataArray.length > 0) {
      analyser.getByteFrequencyData(dataArray);
      let sum = 0;
      for(let i = 0; i < dataArray.length; i++) sum += dataArray[i];
      volume = sum / dataArray.length / 255.0;
    }

    if (meshRef.current) {
      const time = state.clock.getElapsedTime();
      // Floating animation
      meshRef.current.position.y = Math.sin(time * 0.8) * 0.15;
      
      // Pulse scale with volume
      const targetScale = 1 + volume * 0.3;
      meshRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.1);
      
      // Rotate slowly
      meshRef.current.rotation.y += 0.005;
    }
  });

  return (
    <group ref={meshRef}>
      <primitive object={scene} />
    </group>
  );
};

const AudioVisualizer3D = ({ analyser }: { analyser: AnalyserNode | null }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const count = 64;
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const dataArray = useMemo(() => analyser ? new Uint8Array(analyser.frequencyBinCount) : new Uint8Array(0), [analyser]);

  useFrame(() => {
    if (analyser && meshRef.current && dataArray.length > 0) {
      analyser.getByteFrequencyData(dataArray);
      
      // Use lower half of frequencies for better visual response
      const step = Math.max(1, Math.floor((dataArray.length * 0.5) / count));
      
      for (let i = 0; i < count; i++) {
        const value = dataArray[i * step] / 255.0;
        const angle = (i / count) * Math.PI * 2;
        const radius = 1.8;
        
        dummy.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius, 0);
        dummy.rotation.z = angle;
        // Base scale + audio reactive scale
        dummy.scale.set(0.02, 0.02 + value * 0.8, 0.02);
        dummy.updateMatrix();
        meshRef.current.setMatrixAt(i, dummy.matrix);
        
        // Dynamic color based on intensity
        const color = new THREE.Color();
        color.setHSL(0.5, 1.0, 0.4 + value * 0.6); // Cyan hue
        meshRef.current.setColorAt(i, color);
      }
      meshRef.current.instanceMatrix.needsUpdate = true;
      if (meshRef.current.instanceColor) {
        meshRef.current.instanceColor.needsUpdate = true;
      }
    }
  });

  if (!analyser) return null;

  return (
    <instancedMesh ref={meshRef} count={count} rotation={[0, 0, 0]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="#00FFFF" emissive="#00FFFF" emissiveIntensity={1} transparent opacity={0.8} />
    </instancedMesh>
  );
};

const HeadModel = ({ isAssistantMode, analyser, userPosition }: { isAssistantMode: boolean, analyser?: AnalyserNode | null, userPosition?: {x: number, y: number} | null }) => {
  const meshRef = useRef<THREE.Group>(null);
  const coreRef = useRef<THREE.Mesh>(null);
  const { mouse, viewport } = useThree();
  
  const dataArray = useMemo(() => analyser ? new Uint8Array(analyser.frequencyBinCount) : new Uint8Array(0), [analyser]);
  
  useFrame((state) => {
    let volume = 0;
    if (analyser && dataArray.length > 0) {
      analyser.getByteFrequencyData(dataArray);
      let sum = 0;
      for(let i = 0; i < dataArray.length; i++) sum += dataArray[i];
      volume = sum / dataArray.length / 255.0;
    }

    if (meshRef.current) {
      // Target rotation based on user position or mouse
      let targetX = 0;
      let targetY = 0;
      
      if (userPosition) {
        // userPosition is expected to be normalized -1 to 1
        targetX = (userPosition.y * viewport.height) / 4;
        targetY = (userPosition.x * viewport.width) / 4;
      } else {
        targetX = (mouse.y * viewport.height) / 4;
        targetY = (mouse.x * viewport.width) / 4;
      }
      
      meshRef.current.rotation.x = THREE.MathUtils.lerp(meshRef.current.rotation.x, -targetX, 0.03);
      meshRef.current.rotation.y = THREE.MathUtils.lerp(meshRef.current.rotation.y, targetY, 0.03);
      
      // Floating animation - more complex
      const time = state.clock.getElapsedTime();
      meshRef.current.position.y = Math.sin(time * 0.8) * 0.15;
      meshRef.current.position.x = Math.cos(time * 0.5) * 0.05;
    }
    
    if (coreRef.current) {
      coreRef.current.rotation.z += 0.01 + volume * 0.05;
      coreRef.current.rotation.y += 0.005 + volume * 0.05;
      
      // Base breathing animation (independent of audio)
      const time = state.clock.getElapsedTime();
      const breathScale = 1 + Math.sin(time * 1.5) * 0.08;
      
      // Core pulses with audio volume + base breathing
      const targetScale = breathScale + volume * 0.8;
      coreRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.1);
    }
  });

  return (
    <group ref={meshRef}>
      {/* Audio Visualizer Ring */}
      <AudioVisualizer3D analyser={analyser || null} />

      {/* Outer Shell - Geometric Skull-like structure */}
      <mesh>
        <icosahedronGeometry args={[1, 2]} />
        <meshStandardMaterial 
          color="#00FFFF" 
          wireframe 
          transparent 
          opacity={0.15} 
          emissive="#00FFFF"
          emissiveIntensity={0.2}
        />
      </mesh>

      {/* Inner Shell - More detailed wireframe */}
      <mesh scale={0.95}>
        <octahedronGeometry args={[1, 4]} />
        <meshStandardMaterial 
          color="#00FFFF" 
          wireframe 
          transparent 
          opacity={0.3} 
          emissive="#00FFFF"
          emissiveIntensity={0.5}
        />
      </mesh>

      {/* Eyes / Optical Sensors */}
      <group position={[0, 0.2, 0.7]}>
        {/* Left Eye */}
        <group position={[-0.35, 0, 0]}>
          <mesh>
            <sphereGeometry args={[0.08, 16, 16]} />
            <meshStandardMaterial color="#00FFFF" emissive="#00FFFF" emissiveIntensity={2} />
          </mesh>
          <mesh scale={1.5}>
            <torusGeometry args={[0.08, 0.01, 16, 32]} />
            <meshBasicMaterial color="#00FFFF" transparent opacity={0.5} />
          </mesh>
        </group>
        {/* Right Eye */}
        <group position={[0.35, 0, 0]}>
          <mesh>
            <sphereGeometry args={[0.08, 16, 16]} />
            <meshStandardMaterial color="#00FFFF" emissive="#00FFFF" emissiveIntensity={2} />
          </mesh>
          <mesh scale={1.5}>
            <torusGeometry args={[0.08, 0.01, 16, 32]} />
            <meshBasicMaterial color="#00FFFF" transparent opacity={0.5} />
          </mesh>
        </group>
      </group>

      {/* Neural Core */}
      <mesh ref={coreRef}>
        <dodecahedronGeometry args={[0.4, 0]} />
        <MeshDistortMaterial
          color="#00FFFF"
          speed={4}
          distort={0.5}
          radius={1}
          emissive="#00FFFF"
          emissiveIntensity={1}
        />
      </mesh>

      {/* Data Orbits */}
      <Float speed={3} rotationIntensity={2} floatIntensity={1}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.4, 0.002, 16, 100]} />
          <meshBasicMaterial color="#00FFFF" transparent opacity={0.2} />
        </mesh>
      </Float>
      <Float speed={2} rotationIntensity={3} floatIntensity={1}>
        <mesh rotation={[0, Math.PI / 2, 0]}>
          <torusGeometry args={[1.5, 0.002, 16, 100]} />
          <meshBasicMaterial color="#00FFFF" transparent opacity={0.1} />
        </mesh>
      </Float>
      
      {/* Vertical Ring */}
      <mesh rotation={[0, 0, 0]}>
        <torusGeometry args={[1.3, 0.003, 16, 100]} />
        <meshBasicMaterial color="#00FFFF" transparent opacity={0.15} />
      </mesh>
    </group>
  );
};

export const AssistantHead: React.FC<{ className?: string; isAssistantMode?: boolean; analyser?: AnalyserNode | null; modelUrl?: string | null; userPosition?: {x: number, y: number} | null }> = ({ 
  className, 
  isAssistantMode = false,
  analyser,
  modelUrl,
  userPosition
}) => {
  return (
    <div className={cn("relative", className)}>
      <Canvas 
        shadows 
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
        onCreated={({ gl }) => {
          gl.setClearColor('#000000', 0);
        }}
      >
        <PerspectiveCamera makeDefault position={[0, 0, isAssistantMode ? 2.5 : 3.5]} fov={45} />
        <ambientLight intensity={0.8} />
        <pointLight position={[10, 10, 10]} intensity={2} />
        <spotLight position={[-10, 10, 10]} angle={0.15} penumbra={1} intensity={2} />
        <Suspense fallback={null}>
          {modelUrl ? (
            <CustomGLTFModel url={modelUrl} analyser={analyser} />
          ) : (
            <HeadModel isAssistantMode={isAssistantMode} analyser={analyser} userPosition={userPosition} />
          )}
        </Suspense>
      </Canvas>
      
      {/* Loading/Fallback indicator */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
        <div className="w-32 h-32 border border-cyan-400/10 rounded-full animate-ping" />
      </div>
    </div>
  );
};
