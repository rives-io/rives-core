/*
Auto-generated by: https://github.com/pmndrs/gltfjsx
Author: J4747 (https://sketchfab.com/J4747)
License: CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/)
Source: https://sketchfab.com/3d-models/sci-fi-pedestal-1c510c2da66446f3931e06b2644b818f
Title: Sci-fi Pedestal
*/

import React, { useRef } from "react";
import { useGLTF } from "@react-three/drei";

export function SciFiPedestal(props) {
  const { nodes, materials } = useGLTF("sci-fi_pedestal.glb");
  return (
    <group {...props} dispose={null}>
      <group position={[0, -1.109, -6.674]}>
        <mesh
          castShadow
          receiveShadow
          geometry={nodes.Object_8.geometry}
          material={materials.Material}
        />
        <mesh
          castShadow
          receiveShadow
          geometry={nodes.Object_9.geometry}
          material={materials["Material.001"]}
        />
        <mesh
          castShadow
          receiveShadow
          geometry={nodes.Object_10.geometry}
          material={materials["Material.002"]}
        />
      </group>
      <mesh
        castShadow
        receiveShadow
        geometry={nodes.Object_4.geometry}
        material={materials.Material}
      />
      <mesh
        castShadow
        receiveShadow
        geometry={nodes.Object_5.geometry}
        material={materials["Material.001"]}
      />
      <mesh
        castShadow
        receiveShadow
        geometry={nodes.Object_6.geometry}
        material={materials["Material.002"]}
      />
      <mesh
        castShadow
        receiveShadow
        geometry={nodes.Object_12.geometry}
        material={materials["Material.003"]}
        position={[0, -2.379, -10.5]}
      />
    </group>
  );
}

useGLTF.preload("/sci-fi_pedestal.glb");
