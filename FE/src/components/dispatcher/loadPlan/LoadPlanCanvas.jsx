import React from 'react';

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
  setCameraAngle
}) {
  const svgW = 740;
  const svgH = 340;

  if (activeView === '3D') {
    const scale = 0.44;
    const centerX = svgW / 2;
    const centerY = svgH / 2 + 10;
    const { yaw, pitch } = cameraAngle;

    const p000 = project3DPoint(0, 0, 0, truck, yaw, pitch, scale, centerX, centerY);
    const pL00 = project3DPoint(truck.length_cm, 0, 0, truck, yaw, pitch, scale, centerX, centerY);
    const pLW0 = project3DPoint(truck.length_cm, truck.width_cm, 0, truck, yaw, pitch, scale, centerX, centerY);
    const p0W0 = project3DPoint(0, truck.width_cm, 0, truck, yaw, pitch, scale, centerX, centerY);
    const p00H = project3DPoint(0, 0, truck.height_cm, truck, yaw, pitch, scale, centerX, centerY);
    const pL0H = project3DPoint(truck.length_cm, 0, truck.height_cm, truck, yaw, pitch, scale, centerX, centerY);
    const pLWH = project3DPoint(truck.length_cm, truck.width_cm, truck.height_cm, truck, yaw, pitch, scale, centerX, centerY);
    const p0WH = project3DPoint(0, truck.width_cm, truck.height_cm, truck, yaw, pitch, scale, centerX, centerY);

    const sortedBlocks = [...visibleBlocks].sort((a, b) => {
      const depthA = project3DPoint(a.x + a.dx / 2, a.y + a.dy / 2, a.z + a.dz / 2, truck, yaw, pitch, scale, centerX, centerY).depth;
      const depthB = project3DPoint(b.x + b.dx / 2, b.y + b.dy / 2, b.z + b.dz / 2, truck, yaw, pitch, scale, centerX, centerY).depth;
      return depthA - depthB;
    });

    return (
      <svg
        viewBox={`0 0 ${svgW} ${svgH}`}
        className="w-full h-80 select-none cursor-grab active:cursor-grabbing"
        onMouseDown={(e) => setDragStart({ x: e.clientX, y: e.clientY, yaw, pitch })}
        onMouseMove={(e) => {
          if (!dragStart) return;
          const dx = e.clientX - dragStart.x;
          const dy = e.clientY - dragStart.y;
          setCameraAngle({
            yaw: Math.max(-80, Math.min(80, dragStart.yaw + dx * 0.35)),
            pitch: Math.max(10, Math.min(60, dragStart.pitch - dy * 0.25))
          });
        }}
        onMouseUp={() => setDragStart(null)}
        onMouseLeave={() => setDragStart(null)}
      >
        <polygon
          points={pointsToPolygonString([p000, pL00, pLW0, p0W0])}
          fill="#e2e8f0"
          stroke="#94a3b8"
          strokeWidth="1.5"
        />
        <polygon
          points={pointsToPolygonString([p000, pL00, pL0H, p00H])}
          fill="#f1f5f9"
          stroke="#cbd5e1"
          strokeWidth="1"
          strokeDasharray="4 3"
        />
        <polygon
          points={pointsToPolygonString([p000, p0W0, p0WH, p00H])}
          fill="#e2e8f0"
          stroke="#94a3b8"
          strokeWidth="1.5"
        />

        {sortedBlocks.map((b) => {
          const stop = stopPaletteMap[b.stopId] || { color: '#86efac', topColor: '#bbf7d0', sideColor: '#4ade80' };
          const isSelected = selectedBlockId === b.id;

          const v000 = project3DPoint(b.x, b.y, b.z, truck, yaw, pitch, scale, centerX, centerY);
          const v100 = project3DPoint(b.x + b.dx, b.y, b.z, truck, yaw, pitch, scale, centerX, centerY);
          const v110 = project3DPoint(b.x + b.dx, b.y + b.dy, b.z, truck, yaw, pitch, scale, centerX, centerY);
          const v010 = project3DPoint(b.x, b.y + b.dy, b.z, truck, yaw, pitch, scale, centerX, centerY);
          const v001 = project3DPoint(b.x, b.y, b.z + b.dz, truck, yaw, pitch, scale, centerX, centerY);
          const v101 = project3DPoint(b.x + b.dx, b.y, b.z + b.dz, truck, yaw, pitch, scale, centerX, centerY);
          const v111 = project3DPoint(b.x + b.dx, b.y + b.dy, b.z + b.dz, truck, yaw, pitch, scale, centerX, centerY);
          const v011 = project3DPoint(b.x, b.y + b.dy, b.z + b.dz, truck, yaw, pitch, scale, centerX, centerY);

          const frontCenterX = (v010.x + v110.x + v111.x + v011.x) / 4;
          const frontCenterY = (v010.y + v110.y + v111.y + v011.y) / 4;

          const strokeCol = isSelected ? '#1e1b4b' : '#334155';
          const strokeW = isSelected ? '2.2' : '1';

          return (
            <g
              key={b.id}
              onClick={() => setSelectedBlockId(b.id)}
              className="cursor-pointer transition-opacity hover:opacity-95"
            >
              <polygon
                points={pointsToPolygonString([v100, v110, v111, v101])}
                fill={stop?.sideColor || '#86efac'}
                stroke={strokeCol}
                strokeWidth={strokeW}
              />
              <polygon
                points={pointsToPolygonString([v010, v110, v111, v011])}
                fill={stop?.color || '#bbf7d0'}
                stroke={strokeCol}
                strokeWidth={strokeW}
              />
              <polygon
                points={pointsToPolygonString([v001, v101, v111, v011])}
                fill={stop?.topColor || '#dcfce7'}
                stroke={strokeCol}
                strokeWidth={strokeW}
              />

              <text
                x={frontCenterX}
                y={frontCenterY - 2}
                fontSize={visibleBlocks.length > 10 ? '8.5' : '10'}
                fontWeight="800"
                fill="#0f172a"
                textAnchor="middle"
                style={{ pointerEvents: 'none' }}
              >
                {visibleBlocks.length > 6 ? `#${String(b.packageIndex).padStart(2, '0')}` : b.palletCode}
              </text>
              <text
                x={frontCenterX}
                y={frontCenterY + 9}
                fontSize="7.5"
                fontWeight="600"
                fill="#334155"
                textAnchor="middle"
                style={{ pointerEvents: 'none' }}
              >
                {b.dx}×{b.dy}×{b.dz}
              </text>
            </g>
          );
        })}

        <polyline
          points={pointsToPolygonString([p0W0, pLW0, pLWH, p0WH, p0W0])}
          fill="none"
          stroke="#475569"
          strokeDasharray="5 3"
          strokeWidth="1.3"
          style={{ pointerEvents: 'none' }}
        />
        <line
          x1={pL00.x}
          y1={pL00.y}
          x2={pL0H.x}
          y2={pL0H.y}
          stroke="#475569"
          strokeDasharray="5 3"
          strokeWidth="1.2"
        />
        <line
          x1={pL0H.x}
          y1={pL0H.y}
          x2={pLWH.x}
          y2={pLWH.y}
          stroke="#475569"
          strokeDasharray="5 3"
          strokeWidth="1.2"
        />
        <line
          x1={p00H.x}
          y1={p00H.y}
          x2={pL0H.x}
          y2={pL0H.y}
          stroke="#94a3b8"
          strokeDasharray="4 3"
          strokeWidth="1"
        />

        <text x={p00H.x} y={p00H.y - 8} fontSize="10" fontWeight="700" fill="#1e293b">
          ◀ Đầu xe (Cao {truck.height_cm}cm)
        </text>
        <text x={pLWH.x} y={pLWH.y - 8} fontSize="10" fontWeight="700" fill="#1e293b" textAnchor="end">
          Cửa sau (Dài {truck.length_cm}cm × Rộng {truck.width_cm}cm) ▶
        </text>
      </svg>
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
          ? `Chiều rộng lòng thùng (Y): ${truck.width_cm} cm (${(truck.width_cm / 100).toFixed(2)} m)`
          : `Chiều dài lòng thùng (X): ${truck.length_cm} cm (${(truck.length_cm / 100).toFixed(2)} m) — [Đầu xe 0cm → Cửa sau ${truck.length_cm}cm]`}
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
              fill={stop?.color || '#86efac'}
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

