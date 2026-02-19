import { useRef, useState, useMemo } from "react";
import * as THREE from "three";

export interface CabinetGroupModelParams {
  columns: number;
  columnSpacing: number;
  cabinetWidth: number;
  cabinetHeight: number;
  cabinetDepth: number;
  shelves: number;
}

export const DEFAULT_MODEL: CabinetGroupModelParams = {
  columns: 2,
  columnSpacing: 0.05,
  cabinetWidth: 0.6,
  cabinetHeight: 1.8,
  cabinetDepth: 0.5,
  shelves: 6,
};

interface CabinetGroup3DProps {
  model: CabinetGroupModelParams;
  status?: "normal" | "warning" | "alarm";
  selected?: boolean;
  hovered?: boolean;
  label?: string;
  onClick?: (e: any) => void;
  onPointerOver?: (e: any) => void;
  onPointerOut?: (e: any) => void;
}

const STATUS_COLORS = {
  normal: "#22d3ee",
  warning: "#f59e0b",
  alarm: "#ef4444",
};

const STATUS_EMISSIVE = {
  normal: "#0e4a5a",
  warning: "#5a3a00",
  alarm: "#5a0000",
};

export function CabinetGroup3D({
  model,
  status = "normal",
  selected = false,
  hovered = false,
  label,
  onClick,
  onPointerOver,
  onPointerOut,
}: CabinetGroup3DProps) {
  const groupRef = useRef<THREE.Group>(null);
  const { columns, columnSpacing, cabinetWidth, cabinetHeight, cabinetDepth, shelves } = model;

  const totalWidth = columns * cabinetWidth + (columns - 1) * columnSpacing;
  const shelfHeight = cabinetHeight / shelves;
  const wallThickness = 0.015;

  const baseColor = STATUS_COLORS[status];
  const emissiveColor = STATUS_EMISSIVE[status];
  const outlineIntensity = selected ? 0.6 : hovered ? 0.3 : 0.1;

  const frameMaterial = useMemo(() => (
    <meshStandardMaterial
      color="#1a2332"
      metalness={0.8}
      roughness={0.3}
      emissive={emissiveColor}
      emissiveIntensity={outlineIntensity}
    />
  ), [emissiveColor, outlineIntensity]);

  const shelfMaterial = useMemo(() => (
    <meshStandardMaterial
      color="#0f1923"
      metalness={0.6}
      roughness={0.4}
    />
  ), []);

  const edgeMaterial = useMemo(() => (
    <meshStandardMaterial
      color={baseColor}
      metalness={0.9}
      roughness={0.1}
      emissive={baseColor}
      emissiveIntensity={selected ? 0.8 : hovered ? 0.5 : 0.2}
    />
  ), [baseColor, selected, hovered]);

  return (
    <group
      ref={groupRef}
      onClick={onClick}
      onPointerOver={onPointerOver}
      onPointerOut={onPointerOut}
    >
      {/* Base platform */}
      <mesh position={[0, -0.02, 0]}>
        <boxGeometry args={[totalWidth + 0.06, 0.04, cabinetDepth + 0.06]} />
        {edgeMaterial}
      </mesh>

      {/* Columns */}
      {Array.from({ length: columns }).map((_, colIdx) => {
        const colX = -totalWidth / 2 + cabinetWidth / 2 + colIdx * (cabinetWidth + columnSpacing);
        return (
          <group key={`col-${colIdx}`} position={[colX, cabinetHeight / 2, 0]}>
            {/* Outer frame */}
            {/* Left wall */}
            <mesh position={[-cabinetWidth / 2, 0, 0]}>
              <boxGeometry args={[wallThickness, cabinetHeight, cabinetDepth]} />
              {frameMaterial}
            </mesh>
            {/* Right wall */}
            <mesh position={[cabinetWidth / 2, 0, 0]}>
              <boxGeometry args={[wallThickness, cabinetHeight, cabinetDepth]} />
              {frameMaterial}
            </mesh>
            {/* Back wall */}
            <mesh position={[0, 0, -cabinetDepth / 2 + wallThickness / 2]}>
              <boxGeometry args={[cabinetWidth, cabinetHeight, wallThickness]} />
              {frameMaterial}
            </mesh>
            {/* Top */}
            <mesh position={[0, cabinetHeight / 2, 0]}>
              <boxGeometry args={[cabinetWidth + wallThickness, wallThickness, cabinetDepth]} />
              {frameMaterial}
            </mesh>

            {/* Shelves */}
            {Array.from({ length: shelves + 1 }).map((_, shelfIdx) => {
              const y = -cabinetHeight / 2 + shelfIdx * shelfHeight;
              return (
                <mesh key={`shelf-${shelfIdx}`} position={[0, y, 0]}>
                  <boxGeometry args={[cabinetWidth - wallThickness * 2, wallThickness * 0.5, cabinetDepth - wallThickness * 2]} />
                  {shelfMaterial}
                </mesh>
              );
            })}

            {/* Front edge strips (decorative) */}
            <mesh position={[-cabinetWidth / 2, 0, cabinetDepth / 2]}>
              <boxGeometry args={[wallThickness * 0.5, cabinetHeight, wallThickness * 0.5]} />
              {edgeMaterial}
            </mesh>
            <mesh position={[cabinetWidth / 2, 0, cabinetDepth / 2]}>
              <boxGeometry args={[wallThickness * 0.5, cabinetHeight, wallThickness * 0.5]} />
              {edgeMaterial}
            </mesh>
          </group>
        );
      })}

      {/* Selection outline glow */}
      {(selected || hovered) && (
        <mesh position={[0, cabinetHeight / 2, 0]}>
          <boxGeometry args={[totalWidth + 0.08, cabinetHeight + 0.08, cabinetDepth + 0.08]} />
          <meshBasicMaterial
            color={baseColor}
            transparent
            opacity={selected ? 0.12 : 0.06}
            side={THREE.BackSide}
          />
        </mesh>
      )}
    </group>
  );
}
