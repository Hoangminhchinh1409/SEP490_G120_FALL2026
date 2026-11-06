import React from 'react';
import { LoadPlanThreeCanvas } from './LoadPlanThreeCanvas';

function project3DPoint(x, y, z, truck, yawDeg, pitchDeg, scale, centerX, centerY) {
  const cx = x - truck.length_cm / 2;
  const cy = y - truck.width_cm / 2;
  const cz = z - truck.height_cm / 2;

  const yaw = (yawDeg * Math.PI) / 180;
  const pitch = (pitchDeg * Math.PI) / 180;

  const rx = cx * Math.cos(yaw) - cy * Math.sin(yaw);
  const ry = cx * Math.sin(yaw) + cy * Math.cos(yaw);
  const rz = cz;

  const screenX = centerX + rx * scale;
  const screenY = centerY - rz * scale + ry * Math.sin(pitch) * scale;
  const depth = ry * Math.cos(pitch) + rz * Math.sin(pitch);

  return { x: screenX, y: screenY, depth };
}

function pointsToPolygonString(pts) {
  return pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
}

export function LoadPlanCanvas({
  activeView,
  truck,
  visibleBlocks,
  stopPaletteMap,
  selectedBlockId,
  setSelectedBlockId,
  cameraAngle,
  dragStart,
  setDragStart,
  setCameraAngle,
  onResetViewRef
}) {
  const svgW = 740;
  const svgH = 340;

  if (activeView === '3D') {
    return (
      <LoadPlanThreeCanvas
        truck={truck}
        visibleBlocks={visibleBlocks}
        stopPaletteMap={stopPaletteMap}
        selectedBlockId={selectedBlockId}
        setSelectedBlockId={setSelectedBlockId}
        onResetViewRef={onResetViewRef}
      />
    );
  }

  // Chế độ 2D
  const padLeft = 56;
  const padRight = 36;
  const padTop = 28;
  const padBottom = 38;

  const availW = svgW - padLeft - padRight;
  const availH = svgH - padTop - padBottom;

  const realW = activeView === 'Trước' ? truck.width_cm : truck.length_cm;
  const realH = activeView === 'Trên' ? truck.width_cm : truck.height_cm;

  const scale2D = Math.min(availW / realW, availH / realH);
  const drawW = realW * scale2D;
  const drawH = realH * scale2D;
  const originX = padLeft + (availW - drawW) / 2;
  const originY = padTop + (availH - drawH) / 2;

  return (
    <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full h-80 select-none">
      <rect
        x={originX}
        y={originY}
        width={drawW}
        height={drawH}
        fill="#f8fafc"
        stroke="#334155"
        strokeWidth="2"
      />

      <text
        x={originX + drawW / 2}
        y={originY + drawH + 24}
        fontSize="11"
        fontWeight="700"
        fill="#334155"
        textAnchor="middle"
      >
        {activeView === 'Trước'
          ? `Chiều rộng lòng thùng: ${truck.width_cm} cm · ${(truck.width_cm / 100).toFixed(2)} m`
          : `Chiều dài lòng thùng: ${truck.length_cm} cm · ${(truck.length_cm / 100).toFixed(2)} m — [Đầu xe 0cm → Cửa sau ${truck.length_cm}cm]`}
      </text>

      <text
        x={originX - 12}
        y={originY + drawH / 2}
        fontSize="11"
        fontWeight="700"
        fill="#334155"
        textAnchor="end"
      >
        {activeView === 'Trên'
          ? `Rộng: ${truck.width_cm}cm`
          : `Cao: ${truck.height_cm}cm`}
      </text>

      {visibleBlocks.map((b) => {
        const stop = stopPaletteMap[b.stopId] || { color: '#86efac' };
        const isSelected = selectedBlockId === b.id;
        const cargoColor = b.palette?.color || b.palette?.sideColor || stop?.color || '#86efac';

        let bx = 0, by = 0, bw = 0, bh = 0;
        if (activeView === 'Trên') {
          bx = originX + b.x * scale2D;
          by = originY + b.y * scale2D;
          bw = b.dx * scale2D;
          bh = b.dy * scale2D;
        } else if (activeView === 'Cạnh') {
          bx = originX + b.x * scale2D;
          by = originY + (truck.height_cm - (b.z + b.dz)) * scale2D;
          bw = b.dx * scale2D;
          bh = b.dz * scale2D;
        } else if (activeView === 'Trước') {
          bx = originX + b.y * scale2D;
          by = originY + (truck.height_cm - (b.z + b.dz)) * scale2D;
          bw = b.dy * scale2D;
          bh = b.dz * scale2D;
        }

        const isRound = b.shapeType === 'CYLINDER' || b.shapeType === 'DRUM';

        return (
          <g
            key={b.id}
            onClick={() => setSelectedBlockId(b.id)}
            className="cursor-pointer"
          >
            <rect
              x={bx}
              y={by}
              width={bw}
              height={bh}
              rx={isRound && activeView === 'Trên' ? bw / 2 : 2}
              ry={isRound && activeView === 'Trên' ? bh / 2 : 2}
              fill={cargoColor}
              stroke={isSelected ? '#1e1b4b' : '#334155'}
              strokeWidth={isSelected ? '2' : '1'}
            />
            <text
              x={bx + bw / 2}
              y={by + bh / 2 + 3}
              fontSize="9"
              fontWeight="bold"
              fill="#0f172a"
              textAnchor="middle"
              style={{ pointerEvents: 'none' }}
            >
              #{String(b.packageIndex).padStart(2, '0')}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

