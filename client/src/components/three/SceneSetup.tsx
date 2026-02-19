import { Grid, Environment, GizmoHelper, GizmoViewport } from "@react-three/drei";

interface SceneSetupProps {
  gridSize?: number;
  showGizmo?: boolean;
}

export function SceneSetup({ gridSize = 20, showGizmo = true }: SceneSetupProps) {
  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.4} />
      <directionalLight position={[10, 15, 10]} intensity={0.8} castShadow />
      <directionalLight position={[-5, 10, -5]} intensity={0.3} />
      <pointLight position={[0, 8, 0]} intensity={0.4} color="#22d3ee" />

      {/* Ground grid */}
      <Grid
        args={[gridSize, gridSize]}
        cellSize={1}
        cellThickness={0.5}
        cellColor="#1a2a3a"
        sectionSize={5}
        sectionThickness={1}
        sectionColor="#2a4a6a"
        fadeDistance={gridSize}
        fadeStrength={1}
        infiniteGrid
        position={[0, -0.01, 0]}
      />

      {/* Ground plane for shadows */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[gridSize * 2, gridSize * 2]} />
        <meshStandardMaterial color="#0a1520" transparent opacity={0.5} />
      </mesh>

      {/* Environment */}
      <fog attach="fog" args={["#0a1520", 15, 40]} />

      {/* Gizmo helper */}
      {showGizmo && (
        <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
          <GizmoViewport axisColors={["#ef4444", "#22c55e", "#3b82f6"]} labelColor="white" />
        </GizmoHelper>
      )}
    </>
  );
}
