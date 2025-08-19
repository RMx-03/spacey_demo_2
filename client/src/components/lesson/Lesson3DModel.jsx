import React, { Suspense, useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { useGLTF, Environment, OrbitControls, useAnimations, Stars } from '@react-three/drei';
import * as THREE from 'three';

function Model({ modelPath, isAnimating }) {
  const group = useRef();
  const { scene, animations } = useGLTF(modelPath);
  const { actions } = useAnimations(animations, group);

  // Check if there are any animations and get the name of the first one
  const animationName = animations.length > 0 ? animations[0].name : null;

  React.useEffect(() => {
    // Only try to play animation if it exists
    if (actions && animationName) {
      const action = actions[animationName];
      if (isAnimating) {
        action.reset().fadeIn(0.5).play();
      } else {
        action.fadeOut(0.5).stop();
      }
    }
  }, [actions, animationName, isAnimating]);

  React.useEffect(() => {
    if (scene) {
      console.log("Model loaded successfully:", scene);
      scene.traverse((object) => {
        if (object.isMesh) {
          const material = new THREE.MeshStandardMaterial({
            map: object.material.map,
            color: object.material.color,
            metalness: 0.7,
            roughness: 0.3,
          });
          object.material = material;
          object.castShadow = true;
          object.receiveShadow = true;
        }
      });
    }
  }, [scene]);

  return (
    <primitive 
      ref={group} 
      object={scene} 
      scale={2.5}
      position={[0, -1.5, 0]}
    />
  );
}

const Lesson3DModel = ({ modelPath }) => {
  const [isAnimating, setIsAnimating] = useState(false);
  const [resolvedPath, setResolvedPath] = useState(null);
  const [checking, setChecking] = useState(true);
  const controlsRef = useRef();

  // Allow-list of models we ship in public/models
  const allowedModels = new Set([
    '/models/greet-untitled.glb',
    '/models/breath-idle.glb',
    '/models/jumping_space-suit1.glb',
    '/models/talking11.glb'
  ]);
  const fallbackModel = '/models/greet-untitled.glb';

  useEffect(() => {
    let cancelled = false;
    async function validate() {
      try {
        setChecking(true);
        const candidate = typeof modelPath === 'string' && modelPath.endsWith('.glb') ? modelPath : null;
        // Prefer allow-list; otherwise, attempt a HEAD check to see if file exists
        // Only load from allow-list; otherwise force fallback to prevent 404 HTML being parsed by GLTF loader
        if (candidate && allowedModels.has(candidate)) {
          if (!cancelled) setResolvedPath(candidate);
        } else {
          if (!cancelled) setResolvedPath(fallbackModel);
        }
      } finally {
        if (!cancelled) setChecking(false);
      }
    }
    validate();
    return () => { cancelled = true; };
  }, [modelPath]);

  const handleModelClick = () => {
    // Animation will only be triggered if the model has animations
    setIsAnimating(true);
    setTimeout(() => setIsAnimating(false), 1000);
  };

  return (
    <div 
      className="w-full h-80 rounded-lg overflow-hidden cursor-pointer" // Made the whole div clickable
      onClick={handleModelClick} // Click handler on the main div
    >
      <Canvas camera={{ position: [0, 2, 5], fov: 45 }} onCreated={(state) => {
        // Handle context loss gracefully
        state.gl.getContext().canvas.addEventListener('webglcontextlost', (e) => {
          e.preventDefault();
        }, { passive: false });
      }}>
        <directionalLight position={[5, 5, 5]} intensity={3} castShadow shadow-mapSize-width={2048} shadow-mapSize-height={2048} color={0xffffff} />
        <directionalLight position={[-5, 5, -5]} intensity={1.5} color={0xffffff} />
        <ambientLight intensity={1} color={0xffffff} />
        
        <Suspense fallback={null}>
          {!checking && resolvedPath ? (
            <Model modelPath={resolvedPath} isAnimating={isAnimating} />
          ) : (
            <group />
          )}
          <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade />
        </Suspense>
        <OrbitControls 
          ref={controlsRef}
          minDistance={2}
          maxDistance={8}
        />
      </Canvas>
    </div>
  );
};

export default Lesson3DModel;
