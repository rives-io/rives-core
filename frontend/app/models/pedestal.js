import React, { useRef } from "react";
import { useGLTF } from "@react-three/drei";


// 3D Model from: https://sketchfab.com/3d-models/phoenix-bird-844ba0cf144a413ea92c779f18912042
export function Pedestal(props) {
    const { nodes, materials } = useGLTF("/tech_pedestal.glb");
    return (
      <group {...props} dispose={null}>
        <mesh
          castShadow
          receiveShadow
          geometry={nodes.tech_pedestal.geometry}
          material={materials.tech_pedestal_mat}
          position={[0, 0, 0.747]}
          scale={2.056}
        />
      </group>
    );
  }

  useGLTF.preload("/tech_pedestal.glb");