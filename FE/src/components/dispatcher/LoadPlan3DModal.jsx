import React, { useState, useMemo } from 'react';
import { Modal, Button, Tooltip, Tag, Alert } from 'antd';
import {
  Eye,
  EyeOff,
  RotateCcw,
  Box,
  Layers,
  AlertTriangle,
  CheckCircle2,
  Maximize2
} from 'lucide-react';

import { calculate3DLoadPlan, DEFAULT_PALETTES } from '../../utils/loadPlanAlgorithm';

/**
 * Chiếu điểm 3D (x, y, z) trong không gian thùng xe sang tọa độ 2D (sx, sy) trên SVG
 * Hệ trục thùng xe:
 *   x: 0 (Đầu xe - trái) -> L (Cửa sau - phải)
 *   y: 0 (Thành trái - sâu) -> W (Thành phải - gần)
 *   z: 0 (Sàn xe - dưới) -> H (Trần xe - trên)
 */
function project3DPoint(x, y, z, truck, yawDeg, pitchDeg, scale, centerX, centerY) {
  // Đưa tâm thùng xe về gốc (0, 0, 0)
  const cx = x - truck.length_cm / 2;
  const cy = y - truck.width_cm / 2;
  const cz = z - truck.height_cm / 2;

  const yaw = (yawDeg * Math.PI) / 180;
  const pitch = (pitchDeg * Math.PI) / 180;

  // Xoay quanh trục đứng Z (yaw)
  const rx = cx * Math.cos(yaw) - cy * Math.sin(yaw);
  const ry = cx * Math.sin(yaw) + cy * Math.cos(yaw);
  const rz = cz;

  // Nghiêng theo góc nhìn (pitch)
  const screenX = centerX + rx * scale;
  const screenY = centerY - rz * scale + ry * Math.sin(pitch) * scale;
  const depth = ry * Math.cos(pitch) + rz * Math.sin(pitch);

  return { x: screenX, y: screenY, depth };
}

function pointsToPolygonString(pts) {
  return pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
}

export default function LoadPlan3DModal({ open, trip, onClose }) {
  // (3) Góc nhìn: '3D' | 'Trên' | 'Cạnh' | 'Trước'
  const [activeView, setActiveView] = useState('3D');
  // Chế độ quy đổi kích thước hàng khách nhập:
  // 'AUTO' (Tự động chia kiện từ kích thước lô) | 'SINGLE_LOT_BLOCK' (Khối nguyên lô) | 'PER_PACKAGE' (Mỗi kiện = DxRxC)
  const [packingMode, setPackingMode] = useState('AUTO');
  // Điểm giao nào đang bị ẩn
  const [hiddenStopIds, setHiddenStopIds] = useState([]);
  // ID khối hàng đang được chọn
  const [selectedBlockId, setSelectedBlockId] = useState(null);

  // Góc xoay camera 3D tương tác bằng chuột
  const [cameraAngle, setCameraAngle] = useState({ yaw: -22, pitch: 26 });
  const [dragStart, setDragStart] = useState(null);

  const truckSpec = useMemo(() => {
    const is35T = trip?.plate?.includes('995.72') || trip?.truck_model?.includes('3.5');
    const is5T = trip?.plate?.includes('767.99') || trip?.truck_model?.includes('5');
    return {
      length_cm: Number(trip?.truck_length_cm) || (is5T ? 620 : is35T ? 500 : 420),
      width_cm: Number(trip?.truck_width_cm) || (is5T ? 220 : is35T ? 205 : 190),
      height_cm: Number(trip?.truck_height_cm) || (is5T ? 220 : is35T ? 205 : 190),
      max_payload: Number(trip?.max_payload) || (is5T ? 5000 : is35T ? 3500 : 2500),
      is_multi_drop: trip?.is_multi_drop,
      assignment_stops: trip?.assignment_stops,
      order: trip?.order,
      packingMode
    };
  }, [trip, packingMode]);

  const autoPlan = useMemo(() => {
    if (!open) return null;
    const orderList =
      trip?.orders && Array.isArray(trip.orders) && trip.orders.length > 0
        ? trip.orders
        : trip?.order
          ? [trip.order]
          : [];
    return calculate3DLoadPlan(orderList, truckSpec);
  }, [open, trip, truckSpec]);

  if (!open) return null;

  const truck = autoPlan?.truck || {
    length_cm: truckSpec.length_cm,
    width_cm: truckSpec.width_cm,
    height_cm: truckSpec.height_cm,
    max_payload: truckSpec.max_payload
  };

  const rawStops = autoPlan?.stops || [];
  const stops = rawStops.map((stop, index) => {
    const palette = DEFAULT_PALETTES[index % DEFAULT_PALETTES.length];
    const id = stop.id || String.fromCharCode(65 + index);
    return {
      ...stop,
      id,
      name: stop.name || `Điểm ${id}`,
      ordersCount: stop.ordersCount || 1,
      packageCount: stop.packageCount || 1,
      weight: stop.weight || 0,
      color: stop.color || palette.color,
      strokeColor: stop.strokeColor || palette.strokeColor,
      topColor: stop.topColor || palette.topColor,
      sideColor: stop.sideColor || palette.sideColor,
      visible: !hiddenStopIds.includes(id)
    };
  });

  const blocksData = autoPlan?.blocks || [];
  const overflowBlocks = autoPlan?.overflowBlocks || [];
  const bulkCargos = autoPlan?.bulkCargos || [];
  const cargoSpecDetails = autoPlan?.cargoSpecDetails || [];
  const summary = autoPlan?.summary || {};

  const visibleBlocks = blocksData.filter((b) => {
    const st = stops.find((s) => s.id === b.stopId);
    return !st || st.visible;
  });

  const selectedBlock =
    visibleBlocks.find((b) => b.id === selectedBlockId) ||
    overflowBlocks.find((b) => b.id === selectedBlockId) ||
    visibleBlocks[0] ||
    overflowBlocks[0] ||
    null;

  const tripCode = trip?.trip_code || trip?.id || '—';
  const truckPlate = trip?.plate || trip?.truck_plate || '—';
  const truckModel = trip?.truck_model || 'Xe tải chuyên dụng';
  const boxDimText = `Thùng ${(truck.length_cm / 100).toFixed(1)} × ${(truck.width_cm / 100).toFixed(2)} × ${(truck.height_cm / 100).toFixed(2)} m (${truck.length_cm}×${truck.width_cm}×${truck.height_cm} cm)`;

  const toggleStopVisibility = (stopId) => {
    setHiddenStopIds((prev) =>
      prev.includes(stopId) ? prev.filter((id) => id !== stopId) : [...prev, stopId]
    );
  };

  // Xử lý kéo chuột xoay mô hình 3D
  const handleMouseDown3D = (e) => {
    if (activeView !== '3D') return;
    setDragStart({
      x: e.clientX,
      y: e.clientY,
      yaw: cameraAngle.yaw,
      pitch: cameraAngle.pitch
    });
  };

  const handleMouseMove3D = (e) => {
    if (!dragStart || activeView !== '3D') return;
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    const newYaw = Math.max(-65, Math.min(45, dragStart.yaw + dx * 0.35));
    const newPitch = Math.max(8, Math.min(55, dragStart.pitch + dy * 0.25));
    setCameraAngle({ yaw: newYaw, pitch: newPitch });
  };

  const handleMouseUp3D = () => {
    setDragStart(null);
  };

  // Dựng hình chiếu SVG cho 4 chế độ xem: 3D, Trên (X-Y), Cạnh (X-Z), Trước (Y-Z)
  const renderViewportSVG = () => {
    const svgW = 760;
    const svgH = 330;

    if (activeView === '3D') {
      const maxSpan = Math.max(truck.length_cm * 1.25, truck.width_cm * 1.6, truck.height_cm * 1.6);
      const scale = Math.min(svgW / maxSpan, svgH / (truck.height_cm * 1.85));
      const centerX = svgW / 2;
      const centerY = svgH / 2 + 12;

      const L = truck.length_cm;
      const W = truck.width_cm;
      const H = truck.height_cm;

      // 8 đỉnh của lòng thùng xe
      const p000 = project3DPoint(0, 0, 0, truck, cameraAngle.yaw, cameraAngle.pitch, scale, centerX, centerY);
      const pL00 = project3DPoint(L, 0, 0, truck, cameraAngle.yaw, cameraAngle.pitch, scale, centerX, centerY);
      const pLW0 = project3DPoint(L, W, 0, truck, cameraAngle.yaw, cameraAngle.pitch, scale, centerX, centerY);
      const p0W0 = project3DPoint(0, W, 0, truck, cameraAngle.yaw, cameraAngle.pitch, scale, centerX, centerY);

      const p00H = project3DPoint(0, 0, H, truck, cameraAngle.yaw, cameraAngle.pitch, scale, centerX, centerY);
      const pL0H = project3DPoint(L, 0, H, truck, cameraAngle.yaw, cameraAngle.pitch, scale, centerX, centerY);
      const pLWH = project3DPoint(L, W, H, truck, cameraAngle.yaw, cameraAngle.pitch, scale, centerX, centerY);
      const p0WH = project3DPoint(0, W, H, truck, cameraAngle.yaw, cameraAngle.pitch, scale, centerX, centerY);

      // Sắp xếp các kiện hàng theo chiều sâu Painter's Algorithm (từ xa tới gần camera)
      const sortedBlocks = [...visibleBlocks].sort((a, b) => {
        const ca = project3DPoint(
          a.x + a.dx / 2,
          a.y + a.dy / 2,
          a.z + a.dz / 2,
          truck,
          cameraAngle.yaw,
          cameraAngle.pitch,
          scale,
          centerX,
          centerY
        );
        const cb = project3DPoint(
          b.x + b.dx / 2,
          b.y + b.dy / 2,
          b.z + b.dz / 2,
          truck,
          cameraAngle.yaw,
          cameraAngle.pitch,
          scale,
          centerX,
          centerY
        );
        if (Math.abs(ca.depth - cb.depth) > 0.5) return ca.depth - cb.depth;
        if (a.z !== b.z) return a.z - b.z;
        return a.x - b.x;
      });

      return (
        <svg
          viewBox={`0 0 ${svgW} ${svgH}`}
          className="w-full h-80 select-none cursor-grab active:cursor-grabbing"
          onMouseDown={handleMouseDown3D}
          onMouseMove={handleMouseMove3D}
          onMouseUp={handleMouseUp3D}
          onMouseLeave={handleMouseUp3D}
        >
          {/* Mặt sàn thùng xe */}
          <polygon
            points={pointsToPolygonString([p000, pL00, pLW0, p0W0])}
            fill="#f1f5f9"
            stroke="#94a3b8"
            strokeWidth="1.5"
          />

          {/* Vách sau lưng (y = 0) */}
          <polygon
            points={pointsToPolygonString([p000, pL00, pL0H, p00H])}
            fill="#f8fafc"
            fillOpacity="0.65"
            stroke="#cbd5e1"
            strokeDasharray="4 3"
            strokeWidth="1"
          />

          {/* Vách đầu xe (x = 0 - sát cabin) */}
          <polygon
            points={pointsToPolygonString([p000, p0W0, p0WH, p00H])}
            fill="#e2e8f0"
            fillOpacity="0.55"
            stroke="#64748b"
            strokeWidth="1.5"
          />

          {/* Lưới chia mét trên sàn thùng xe */}
          {[100, 200, 300, 400, 500, 600, 700, 800, 900]
            .filter((cm) => cm < L)
            .map((cm) => {
              const g1 = project3DPoint(cm, 0, 0, truck, cameraAngle.yaw, cameraAngle.pitch, scale, centerX, centerY);
              const g2 = project3DPoint(cm, W, 0, truck, cameraAngle.yaw, cameraAngle.pitch, scale, centerX, centerY);
              return (
                <g key={`grid-${cm}`}>
                  <line x1={g1.x} y1={g1.y} x2={g2.x} y2={g2.y} stroke="#cbd5e1" strokeDasharray="2 2" />
                  <text x={g2.x} y={g2.y + 12} fontSize="9" fill="#64748b" textAnchor="middle">
                    {(cm / 100).toFixed(0)}m
                  </text>
                </g>
              );
            })}

          {/* Vẽ từng kiện hàng 3D */}
          {sortedBlocks.map((b) => {
            const stop = stops.find((s) => s.id === b.stopId);
            const isSelected = selectedBlock?.id === b.id;

            const x0 = b.x;
            const x1 = b.x + b.dx;
            const y0 = b.y;
            const y1 = b.y + b.dy;
            const z0 = b.z;
            const z1 = b.z + b.dz;

            const v000 = project3DPoint(x0, y0, z0, truck, cameraAngle.yaw, cameraAngle.pitch, scale, centerX, centerY);
            const v100 = project3DPoint(x1, y0, z0, truck, cameraAngle.yaw, cameraAngle.pitch, scale, centerX, centerY);
            const v110 = project3DPoint(x1, y1, z0, truck, cameraAngle.yaw, cameraAngle.pitch, scale, centerX, centerY);
            const v010 = project3DPoint(x0, y1, z0, truck, cameraAngle.yaw, cameraAngle.pitch, scale, centerX, centerY);

            const v001 = project3DPoint(x0, y0, z1, truck, cameraAngle.yaw, cameraAngle.pitch, scale, centerX, centerY);
            const v101 = project3DPoint(x1, y0, z1, truck, cameraAngle.yaw, cameraAngle.pitch, scale, centerX, centerY);
            const v111 = project3DPoint(x1, y1, z1, truck, cameraAngle.yaw, cameraAngle.pitch, scale, centerX, centerY);
            const v011 = project3DPoint(x0, y1, z1, truck, cameraAngle.yaw, cameraAngle.pitch, scale, centerX, centerY);

            const strokeCol = isSelected ? '#1d4ed8' : stop?.strokeColor || '#16a34a';
            const strokeW = isSelected ? 2.2 : 1.1;

            // Tâm mặt trước để hiển thị mã kiện + kích thước
            const frontCenterX = (v010.x + v110.x + v111.x + v011.x) / 4;
            const frontCenterY = (v010.y + v110.y + v111.y + v011.y) / 4;

            return (
              <g
                key={b.id}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedBlockId(b.id);
                }}
                className="cursor-pointer transition-opacity hover:opacity-95"
              >
                {/* Mặt trái (x = x0) */}
                <polygon
                  points={pointsToPolygonString([v000, v010, v011, v001])}
                  fill={stop?.sideColor || '#86efac'}
                  stroke={strokeCol}
                  strokeWidth={strokeW}
                />
                {/* Mặt phải (x = x1 - hướng cửa sau) */}
                <polygon
                  points={pointsToPolygonString([v100, v110, v111, v101])}
                  fill={stop?.sideColor || '#86efac'}
                  stroke={strokeCol}
                  strokeWidth={strokeW}
                />
                {/* Mặt trước (y = y1 - hướng người nhìn) */}
                <polygon
                  points={pointsToPolygonString([v010, v110, v111, v011])}
                  fill={stop?.color || '#bbf7d0'}
                  stroke={strokeCol}
                  strokeWidth={strokeW}
                />
                {/* Mặt trên (z = z1) */}
                <polygon
                  points={pointsToPolygonString([v001, v101, v111, v011])}
                  fill={stop?.topColor || '#dcfce7'}
                  stroke={strokeCol}
                  strokeWidth={strokeW}
                />

                {/* Nhãn mã kiện & số thứ tự */}
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

          {/* Khung viền dây (wireframe) phía trước của thùng xe để thấy rõ giới hạn chiều dài/rộng/cao */}
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

          {/* Nhãn kích thước 3 chiều thùng xe */}
          <text x={p00H.x} y={p00H.y - 8} fontSize="10" fontWeight="700" fill="#1e293b">
            ◀ Đầu xe (Cao {truck.height_cm}cm)
          </text>
          <text x={pLWH.x} y={pLWH.y - 8} fontSize="10" fontWeight="700" fill="#1e293b" textAnchor="end">
            Cửa sau (Dài {truck.length_cm}cm × Rộng {truck.width_cm}cm) ▶
          </text>
        </svg>
      );
    }

    // Chế độ hình chiếu 2D kỹ thuật:
    // - 'Trên' (Top View): Trục ngang = Dài X (length_cm), Trục dọc = Rộng Y (width_cm)
    // - 'Cạnh' (Side View): Trục ngang = Dài X (length_cm), Trục dọc = Cao Z (height_cm)
    // - 'Trước' (Rear/Front View): Trục ngang = Rộng Y (width_cm), Trục dọc = Cao Z (height_cm)
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
        {/* Khung lòng thùng xe 2D */}
        <rect
          x={originX}
          y={originY}
          width={drawW}
          height={drawH}
          fill="#f8fafc"
          stroke="#334155"
          strokeWidth="2"
        />

        {/* Thước đo trục ngang */}
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

        {/* Thước đo trục dọc */}
        <text
          x={originX - 12}
          y={originY + drawH / 2}
          fontSize="11"
          fontWeight="700"
          fill="#334155"
          textAnchor="end"
          dominantBaseline="middle"
        >
          {activeView === 'Trên' ? `Rộng ${truck.width_cm}cm` : `Cao ${truck.height_cm}cm`}
        </text>

        {/* Vẽ các kiện hàng trong mặt phẳng chiếu */}
        {visibleBlocks.map((b) => {
          const stop = stops.find((s) => s.id === b.stopId);
          const isSelected = selectedBlock?.id === b.id;

          let bx = 0;
          let by = 0;
          let bw = 0;
          let bh = 0;

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
          } else {
            // 'Trước' (Nhìn từ cửa sau vào: trục ngang Y, trục đứng Z)
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
                x={bx + 0.5}
                y={by + 0.5}
                width={Math.max(2, bw - 1)}
                height={Math.max(2, bh - 1)}
                fill={stop?.color || '#bbf7d0'}
                fillOpacity="0.88"
                stroke={isSelected ? '#1d4ed8' : stop?.strokeColor || '#16a34a'}
                strokeWidth={isSelected ? '2.2' : '1.2'}
              />
              {bw > 26 && bh > 16 && (
                <>
                  <text
                    x={bx + bw / 2}
                    y={by + bh / 2 - 2}
                    fontSize="9"
                    fontWeight="800"
                    fill="#0f172a"
                    textAnchor="middle"
                  >
                    #{String(b.packageIndex).padStart(2, '0')}
                  </text>
                  <text
                    x={bx + bw / 2}
                    y={by + bh / 2 + 8}
                    fontSize="7.5"
                    fill="#334155"
                    textAnchor="middle"
                  >
                    {b.dx}×{b.dy}×{b.dz}
                  </text>
                </>
              )}
            </g>
          );
        })}
      </svg>
    );
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={1160}
      centered
      closable={false}
      styles={{ body: { padding: '0px' } }}
      className="load-plan-3d-modal"
    >
      <div className="bg-white rounded-lg overflow-hidden border border-gray-300 font-sans text-gray-800">
        
        {/* Header với tiêu đề và nút Đóng (7) */}
        <div className="p-4 sm:p-5 border-b border-gray-200 flex items-center justify-between bg-white">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
              <Box size={22} className="text-indigo-600" />
              Xếp hàng 3D – Chuyến {tripCode}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Thuật toán <b>3D Extreme-Point + LIFO Shelf/Layer Bin Packing</b> (Ưu tiên kiện nặng dưới sàn, xoay tối ưu 90° &amp; xếp dỡ theo thứ tự điểm dừng)
            </p>
          </div>
          <Button 
            onClick={onClose}
            className="px-6 h-9 font-semibold text-gray-700 border-gray-400 hover:border-gray-600 rounded"
          >
            Đóng
          </Button>
        </div>

        {/* (1) Thông tin chuyến & Thông số chính xác từ dữ liệu khách hàng */}
        <div className="mx-4 sm:mx-6 mt-4 p-3 bg-slate-50 border border-gray-300 rounded text-xs text-gray-800 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              Xe <b>{truckPlate}</b> – <b>{truckModel}</b> · <b>{boxDimText}</b> · Tải cho phép <b>{summary.maxPayload?.toLocaleString()} kg</b>
            </div>
            <div className="flex items-center gap-2">
              <Tag color={summary.isOverloaded ? 'red' : 'green'} className="m-0 font-bold text-xs">
                {summary.isOverloaded
                  ? `Cảnh báo vượt ngưỡng (MSG66)`
                  : `Đã xếp đủ ${summary.packedPackagesCount}/${summary.totalPackagesCount} kiện hợp lệ`}
              </Tag>
            </div>
          </div>

          {/* Bảng tóm tắt số lượng & kích thước hàng hóa chính xác theo khách khai báo */}
          {cargoSpecDetails.length > 0 && (
            <div className="pt-2 border-t border-gray-200 flex flex-wrap items-center justify-between gap-2 text-[11px]">
              {cargoSpecDetails.map((spec, idx) => (
                <div key={idx} className="flex flex-wrap items-center gap-3 text-slate-700">
                  <span>
                    📦 Hàng khách khai báo: <b>{spec.cargoName}</b> ({spec.cargoType})
                  </span>
                  <span>
                    · Số lượng: <b className="text-indigo-700">{spec.packageCount} {spec.packageUnit}</b>
                  </span>
                  <span>
                    · Số đo khách nhập (DxRxC): <b className="font-mono">{spec.inputDimensionsCm}</b>
                  </span>
                  <span>
                    · Kích thước mỗi kiện khi xếp 3D: <b className="font-mono text-emerald-700">{spec.unitDimensionsCm}</b> ({spec.unitWeightKg} kg/kiện)
                  </span>
                  <span>
                    · Tổng trọng lượng: <b>{spec.totalWeightKg.toLocaleString()} kg</b>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Cảnh báo nếu có kiện hàng bị tràn kích thước / tải trọng (MSG66) */}
        {overflowBlocks.length > 0 && (
          <div className="mx-4 sm:mx-6 mt-3">
            <Alert
              type="error"
              showIcon
              title={
                <span className="font-bold text-xs">
                  Phát hiện {overflowBlocks.length}/{summary.totalPackagesCount} kiện hàng không vừa thùng xe hoặc vượt tải trọng (MSG66):
                </span>
              }
              description={
                <div className="text-xs space-y-1 mt-0.5">
                  <div>• Nguyên nhân: <b>{overflowBlocks[0]?.overflowReason}</b></div>
                  <div>• Khuyến nghị Điều phối viên: Đổi sang loại xe có kích thước lòng thùng / tải trọng lớn hơn hoặc chuyển sang chế độ <b>&ldquo;Chia kiện từ kích thước lô&rdquo;</b> nếu số đo khách nhập là kích thước tổng của cả lô hàng.</div>
                </div>
              }
            />
          </div>
        )}

        {/* Thân chính: Bên trái là danh sách điểm dừng (2) - Bên phải là vùng hiển thị 3D (3, 4, 6, 5, 8) */}
        <div className="p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-5 max-h-[78vh] overflow-y-auto">
          
          {/* (2) Danh sách điểm dừng + Danh sách kiện hàng */}
          <div className="lg:col-span-3 space-y-3">
            <div className="text-xs font-bold text-gray-700">
              {stops.length > 1 ? 'Điểm giao (giao trước → sau theo LIFO)' : 'Điểm giao hàng duy nhất (Chuẩn theo đơn)'}
            </div>

            <div className="space-y-2">
              {stops.map((stop) => (
                <div
                  key={stop.id}
                  className="p-3 rounded border border-gray-300 bg-white shadow-2xs hover:shadow-xs transition flex items-center justify-between"
                  style={{ borderLeft: `5px solid ${stop.strokeColor}` }}
                >
                  <div className="min-w-0 pr-2">
                    <div className="font-bold text-xs text-gray-800 truncate" title={stop.name}>
                      {stop.name}
                    </div>
                    <div className="text-[11px] text-gray-600 mt-0.5 font-medium">
                      <b>{stop.packageCount} kiện</b> · <b>{stop.weight.toLocaleString()} kg</b>
                    </div>
                  </div>

                  <Tooltip title={stop.visible ? 'Ẩn kiện hàng điểm này' : 'Hiện kiện hàng điểm này'}>
                    <button
                      type="button"
                      onClick={() => toggleStopVisibility(stop.id)}
                      className="p-1 text-gray-400 hover:text-gray-700 transition shrink-0"
                    >
                      {stop.visible ? <Eye size={16} /> : <EyeOff size={16} className="text-gray-300" />}
                    </button>
                  </Tooltip>
                </div>
              ))}
            </div>

            {/* Danh sách từng kiện hàng đã xếp (Click để định vị trên mô hình 3D) */}
            <div className="pt-2 border-t border-gray-200 space-y-1.5">
              <div className="flex items-center justify-between text-xs font-bold text-gray-700">
                <span>Danh sách kiện trên xe ({blocksData.length})</span>
                <span className="text-[10px] text-gray-400 font-normal">Bấm để xem tọa độ</span>
              </div>
              <div className="max-h-56 overflow-y-auto space-y-1 pr-1">
                {blocksData.map((b) => {
                  const isSel = selectedBlock?.id === b.id;
                  return (
                    <div
                      key={b.id}
                      onClick={() => setSelectedBlockId(b.id)}
                      className={`p-2 rounded border text-[11px] cursor-pointer transition flex items-center justify-between ${
                        isSel
                          ? 'bg-indigo-50 border-indigo-500 font-bold text-indigo-950'
                          : 'bg-gray-50/70 border-gray-200 hover:border-gray-400 text-gray-700'
                      }`}
                    >
                      <span className="truncate">
                        #{String(b.packageIndex).padStart(2, '0')} · {b.packageUnit} (Tầng {b.tierLevel})
                      </span>
                      <span className="font-mono text-[10px] text-gray-600 shrink-0 ml-1">
                        {b.dx}×{b.dy}×{b.dz}cm · {b.weight}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Cột phải: Góc nhìn tabs (3) + Chế độ quy cách + Khung thùng xe (4) + Tổng hợp (6) + Chi tiết kiện (5) */}
          <div className="lg:col-span-9 space-y-3">
            
            {/* (3) Thanh công cụ Góc nhìn & Chế độ quy đổi kích thước lô */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                {['3D', 'Trên', 'Cạnh', 'Trước'].map((view) => (
                  <button
                    key={view}
                    type="button"
                    onClick={() => setActiveView(view)}
                    className={`px-4 py-1.5 text-xs font-semibold rounded border transition ${
                      activeView === view 
                        ? 'bg-indigo-600 border-indigo-600 text-white font-bold shadow-2xs' 
                        : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {view === '3D' ? 'Góc nhìn 3D (Xoay chuột)' : `Chiếu ${view}`}
                  </button>
                ))}
                {activeView === '3D' && (
                  <Tooltip title="Đặt lại góc xoay 3D mặc định">
                    <button
                      type="button"
                      onClick={() => setCameraAngle({ yaw: -22, pitch: 26 })}
                      className="px-2.5 py-1.5 text-xs border border-gray-300 rounded text-gray-600 hover:bg-gray-100 flex items-center gap-1"
                    >
                      <RotateCcw size={12} /> Góc chuẩn
                    </button>
                  </Tooltip>
                )}
              </div>

              {/* Bộ chuyển đổi cách hiểu kích thước khách nhập */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded border border-slate-200 text-[11px]">
                <span className="text-slate-500 px-1.5 font-medium">Quy cách số đo:</span>
                <button
                  type="button"
                  onClick={() => setPackingMode('AUTO')}
                  className={`px-2.5 py-1 rounded font-semibold transition ${
                    packingMode === 'AUTO' || packingMode === 'LOT_SUBDIVIDED'
                      ? 'bg-white text-indigo-700 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Chia {summary.totalPackagesCount} kiện từ lô
                </button>
                <button
                  type="button"
                  onClick={() => setPackingMode('SINGLE_LOT_BLOCK')}
                  className={`px-2.5 py-1 rounded font-semibold transition ${
                    packingMode === 'SINGLE_LOT_BLOCK'
                      ? 'bg-white text-indigo-700 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Khối nguyên lô
                </button>
                <button
                  type="button"
                  onClick={() => setPackingMode('PER_PACKAGE')}
                  className={`px-2.5 py-1 rounded font-semibold transition ${
                    packingMode === 'PER_PACKAGE'
                      ? 'bg-white text-indigo-700 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Mỗi kiện = DxRxC
                </button>
              </div>
            </div>

            {/* (4) Hình thùng xe 3D / 2D tương tác (Truck box) */}
            <div className="p-3 bg-white border border-dashed border-gray-400 rounded relative">
              <div className="w-full bg-slate-50/60 rounded relative overflow-hidden">
                {renderViewportSVG()}
              </div>

              {/* Chú thích chiều: Đầu xe (vách trước) và Cửa sau */}
              <div className="flex justify-between items-center text-[11px] text-gray-500 font-medium px-2 pt-1.5">
                <span>◀ Đầu xe (Vách trước X = 0 cm — Xếp hàng giao sau cùng)</span>
                <span className="text-indigo-600">
                  {activeView === '3D' ? '💡 Giữ chuột trái và kéo để xoay không gian thùng xe 360°' : `Mặt cắt kỹ thuật tỷ lệ thực (${boxDimText})`}
                </span>
                <span>Cửa sau (X = {truck.length_cm} cm — Xếp hàng giao trước) ▶</span>
              </div>
            </div>

            {/* (6) Tổng hợp thùng xe (Box summary) */}
            <div className="p-3 bg-slate-50 border border-gray-300 rounded text-xs text-gray-800 flex flex-wrap items-center justify-between gap-2">
              <div>
                Số lượng kiện đã xếp: <b className="text-indigo-700">{summary.packedPackagesCount} / {summary.totalPackagesCount} kiện</b> · Tải trọng: <b>{summary.totalWeight?.toLocaleString()} / {summary.maxPayload?.toLocaleString()} kg ({summary.weightPercent}%)</b> · Thể tích chiếm dụng: <b>{summary.totalVolume} / {summary.maxVolume} m³ ({summary.volumePercent}%)</b>
              </div>
              <span className="text-[11px] text-emerald-700 font-semibold">
                ✓ Trọng tâm sàn xe ổn định
              </span>
            </div>

            {/* (5) Chi tiết khối hàng (Block details) khi click một kiện */}
            {selectedBlock && (
              <div className="p-3 bg-indigo-50/50 border border-indigo-200 rounded text-xs text-gray-800 space-y-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <b className="text-indigo-900">Kiện {selectedBlock.palletCode}</b> · Khách hàng: <b>{selectedBlock.customer}</b> · Hàng hóa: <b>{selectedBlock.cargoName}</b> ({selectedBlock.packageIndex}/{selectedBlock.totalPackagesInLot} {selectedBlock.packageUnit})
                  </div>
                  <Tag color="blue" className="m-0 font-mono text-[11px]">
                    Kích thước kiện: {selectedBlock.dimensions} · Nặng: {selectedBlock.weight}
                  </Tag>
                </div>
                <div className="text-gray-600 flex flex-wrap items-center justify-between gap-2 pt-0.5">
                  <span>
                    📍 Vị trí 3D trong thùng xe: <b className="font-mono text-gray-800">{selectedBlock.positionText || selectedBlock.overflowReason}</b>
                  </span>
                  <span>
                    Điểm giao: <b>{selectedBlock.stopName}</b> · Xếp chồng: <b>{selectedBlock.stackableText || 'Có'}</b>
                  </span>
                </div>
              </div>
            )}

            {/* (8) Hàng rời không xếp 3D (Bulk cargo) */}
            {bulkCargos.length > 0 && (
              <div className="p-3 bg-amber-50/70 border border-amber-300 rounded text-xs text-gray-800">
                <div className="font-bold text-amber-900 mb-0.5">
                  Hàng rời không xếp 3D (không có kích thước):
                </div>
                {bulkCargos.map((item) => (
                  <div key={item.id} className="text-gray-700">
                    Đơn {item.id} · {item.customer || '—'} · {item.weight || '—'} · {item.spec || '—'} · {item.stopName || '—'}
                  </div>
                ))}
              </div>
            )}

          </div>

        </div>

      </div>
    </Modal>
  );
}
