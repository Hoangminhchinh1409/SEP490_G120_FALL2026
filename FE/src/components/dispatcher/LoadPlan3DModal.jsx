import React, { useState } from 'react';
import { Modal, Button, Tooltip } from 'antd';
import { Eye, EyeOff } from 'lucide-react';

import { calculate3DLoadPlan, DEFAULT_PALETTES } from '../../utils/loadPlanAlgorithm';

export default function LoadPlan3DModal({ open, trip, onClose }) {
  // (3) Góc nhìn
  const [activeView, setActiveView] = useState('3D');
  // Điểm giao nào đang bị ẩn (lưu set id bị ẩn)
  const [hiddenStopIds, setHiddenStopIds] = useState([]);
  // ID khối hàng đang được chọn
  const [selectedBlockId, setSelectedBlockId] = useState(null);

  // TUÂN THỦ RULES OF HOOKS: Kiểm tra if (!open) sau các hook cơ bản
  if (!open) return null;

  // THUẬT TOÁN TỰ ĐỘNG XẾP HÀNG 3D:
  // Nếu trip truyền danh sách orders, tự động chạy thuật toán calculate3DLoadPlan
  // Nếu trip đã có sẵn blocks/stops (từ backend hoặc tính trước), ưu tiên sử dụng
  const truckSpec = {
    length_cm: trip?.truck_length_cm || 420,
    width_cm: trip?.truck_width_cm || 190,
    height_cm: trip?.truck_height_cm || 190,
    max_payload: Number(trip?.max_payload) || 2500,
    is_multi_drop: trip?.is_multi_drop,
    assignment_stops: trip?.assignment_stops,
    order: trip?.order
  };

  const autoPlan = (trip?.orders && Array.isArray(trip.orders) && trip.orders.length > 0) || trip?.order
    ? calculate3DLoadPlan(trip.orders || [trip.order], truckSpec)
    : null;

  // Lấy dữ liệu stops: từ autoPlan hoặc từ trip.stops
  const rawStops = autoPlan?.stops || (Array.isArray(trip?.stops) ? trip.stops : []);
  const stops = rawStops.map((stop, index) => {
    const palette = DEFAULT_PALETTES[index % DEFAULT_PALETTES.length];
    const id = stop.id || stop.stop_id || String.fromCharCode(65 + index);
    return {
      id,
      name: stop.name || stop.stop_name || `Điểm ${String.fromCharCode(65 + index)}`,
      ordersCount: stop.orders_count || stop.ordersCount || (stop.orders ? stop.orders.length : 0),
      weight: stop.weight || stop.total_weight || 0,
      color: stop.color || palette.color,
      strokeColor: stop.strokeColor || palette.strokeColor,
      badgeColor: stop.badgeColor || palette.badgeColor,
      visible: !hiddenStopIds.includes(id)
    };
  });

  const blocksData = autoPlan?.blocks || (Array.isArray(trip?.blocks) ? trip.blocks : []);
  const bulkCargos = autoPlan?.bulkCargos || (Array.isArray(trip?.bulk_cargos || trip?.bulkCargos)
    ? (trip.bulk_cargos || trip.bulkCargos)
    : []);

  const selectedBlock = blocksData.find(b => b.id === selectedBlockId) || blocksData[0] || null;

  const tripCode = trip?.trip_code || trip?.id || '—';
  const truckPlate = trip?.plate || trip?.truck_plate || '—';
  const truckModel = trip?.truck_model || '—';
  const boxDim = trip?.box_dim || 'Thùng 4,2 × 1,9 × 1,9 m';
  const maxPayload = autoPlan?.summary?.maxPayload ?? (Number(trip?.max_payload) || 2500);
  const totalWeight = autoPlan?.summary?.totalWeight ?? (Number(trip?.total_weight) || 0);
  const totalOrdersCount = autoPlan?.summary?.ordersCount ?? (trip?.orders_count ?? (trip?.orders?.length || 0));
  const totalStopsCount = autoPlan?.summary?.stopsCount ?? (trip?.stops_count ?? stops.length);
  const totalVolume = autoPlan?.summary?.totalVolume ?? (Number(trip?.total_volume) || 0);
  const maxVolume = autoPlan?.summary?.maxVolume ?? (Number(trip?.max_volume) || 15.2);

  const toggleStopVisibility = (stopId) => {
    setHiddenStopIds(prev => 
      prev.includes(stopId) ? prev.filter(id => id !== stopId) : [...prev, stopId]
    );
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={1120}
      centered
      closable={false}
      styles={{ body: { padding: '0px' } }}
      className="load-plan-3d-modal"
    >
      <div className="bg-white rounded-lg overflow-hidden border border-gray-300 font-sans text-gray-800">
        
        {/* Header với tiêu đề và nút Đóng (7) */}
        <div className="p-4 sm:p-5 border-b border-gray-200 flex items-center justify-between bg-white">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
            Xếp hàng 3D – Chuyến {tripCode}
          </h2>
          <Button 
            onClick={onClose}
            className="px-6 h-9 font-semibold text-gray-700 border-gray-400 hover:border-gray-600 rounded"
          >
            Đóng
          </Button>
        </div>

        {/* (1) Thông tin chuyến (Trip summary) */}
        <div className="mx-4 sm:mx-6 mt-4 p-3 bg-white border border-gray-300 rounded text-xs sm:text-sm text-gray-800">
          Xe <b>{truckPlate}</b> – {truckModel} · {boxDim} · Tải cho phép <b>{maxPayload.toLocaleString()} kg</b> · Tổng khối lượng <b>{totalWeight.toLocaleString()} kg</b> · {totalOrdersCount} đơn, {totalStopsCount} điểm giao
        </div>

        {/* Thân chính: Bên trái là danh sách điểm dừng (2) - Bên phải là vùng hiển thị 3D (3, 4, 6, 5, 8) */}
        <div className="p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-5">
          
          {/* (2) Danh sách điểm dừng */}
          <div className="lg:col-span-3 space-y-3">
            <div className="text-xs font-bold text-gray-700">
              {stops.length > 1 ? 'Điểm giao (giao trước → sau)' : 'Điểm giao hàng'}
            </div>

            <div className="space-y-2.5">
              {stops.length === 0 ? (
                <div className="p-3 text-xs text-gray-400 border border-dashed border-gray-200 rounded text-center">
                  Chưa có điểm giao
                </div>
              ) : (
                stops.map((stop) => (
                  <div
                    key={stop.id}
                    className="p-3 rounded border border-gray-300 bg-white shadow-2xs hover:shadow-xs transition flex items-center justify-between"
                    style={{ borderLeft: `5px solid ${stop.strokeColor}` }}
                  >
                    <div>
                      <div className="font-bold text-xs sm:text-sm text-gray-800">
                        {stop.name}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {stop.ordersCount} đơn · {stop.weight} kg
                      </div>
                    </div>

                    <Tooltip title={stop.visible ? 'Ẩn kiện hàng điểm này' : 'Hiện kiện hàng điểm này'}>
                      <button
                        type="button"
                        onClick={() => toggleStopVisibility(stop.id)}
                        className="p-1 text-gray-400 hover:text-gray-700 transition"
                      >
                        {stop.visible ? <Eye size={16} /> : <EyeOff size={16} className="text-gray-300" />}
                      </button>
                    </Tooltip>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Cột phải: Góc nhìn tabs (3) + Khung thùng xe (4) + Tổng hợp (6) + Chi tiết kiện (5) + Hàng rời (8) */}
          <div className="lg:col-span-9 space-y-3.5">
            
            {/* (3) Góc nhìn tabs: 3D, Trên, Cạnh, Trước */}
            <div className="flex items-center gap-2">
              {['3D', 'Trên', 'Cạnh', 'Trước'].map(view => (
                <button
                  key={view}
                  type="button"
                  onClick={() => setActiveView(view)}
                  className={`px-5 py-1.5 text-xs font-semibold rounded border transition ${
                    activeView === view 
                      ? 'bg-blue-50 border-blue-500 text-blue-700 font-bold shadow-2xs' 
                      : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {view}
                </button>
              ))}
            </div>

            {/* (4) Hình thùng xe (Truck box) */}
            <div className="p-3 bg-white border border-dashed border-gray-400 rounded relative">
              
              {/* Mô phỏng khung không gian thùng xe */}
              <div className="h-72 w-full bg-slate-50/50 rounded relative overflow-hidden flex items-end justify-center select-none">
                
                {/* Lưới tọa độ sàn thùng xe */}
                <div className="absolute inset-x-4 bottom-2 h-14 border-b border-l border-r border-gray-300/80 bg-gray-100/40 transform -skew-x-12"></div>

                {blocksData.length === 0 ? (
                  <div className="absolute inset-0 flex items-center justify-center text-xs text-gray-400">
                    Chưa có kiện hàng được xếp 3D
                  </div>
                ) : (
                  blocksData.map((block) => {
                    const stop = stops.find(s => s.id === block.stopId);
                    if (stop && !stop.visible) return null; // Ẩn khi dispatcher toggle eye
                    
                    const isSelected = selectedBlock?.id === block.id;

                    return (
                      <div
                        key={block.id}
                        onClick={() => setSelectedBlockId(block.id)}
                        className={`absolute cursor-pointer transition-all duration-150 transform hover:-translate-y-1 ${
                          isSelected ? 'z-20 filter drop-shadow-md' : 'z-10'
                        }`}
                        style={{
                          left: block.left,
                          bottom: block.bottom,
                          width: block.width,
                          height: block.height
                        }}
                      >
                        {/* Mặt trước của khối hộp */}
                        <div
                          className="w-full h-full border text-center flex items-center justify-center font-bold font-mono text-xs text-gray-800 transition"
                          style={{
                            backgroundColor: stop?.color || '#e2e8f0',
                            borderColor: isSelected ? '#1d4ed8' : stop?.strokeColor || '#94a3b8',
                            borderWidth: isSelected ? '2px' : '1px'
                          }}
                        >
                          {block.palletCode || block.id}
                        </div>

                        {/* Mặt trên khối hộp (isometric top face) */}
                        {activeView === '3D' && (
                          <div
                            className="absolute -top-3 left-1 right-0 border-t border-l border-r opacity-90 pointer-events-none"
                            style={{
                              height: '14px',
                              backgroundColor: stop?.color || '#e2e8f0',
                              borderColor: stop?.strokeColor || '#94a3b8',
                              transform: 'skewX(-45deg)',
                              filter: 'brightness(1.08)'
                            }}
                          />
                        )}

                        {/* Mặt cạnh phải (isometric right face) */}
                        {activeView === '3D' && (
                          <div
                            className="absolute top-0 -right-2 bottom-0 border-t border-r border-b opacity-80 pointer-events-none"
                            style={{
                              width: '9px',
                              backgroundColor: stop?.color || '#e2e8f0',
                              borderColor: stop?.strokeColor || '#94a3b8',
                              transform: 'skewY(-45deg)',
                              transformOrigin: 'top left',
                              filter: 'brightness(0.92)'
                            }}
                          />
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Chú thích chiều: Đầu xe (vách trước) và Cửa sau */}
              <div className="flex justify-between items-center text-[11px] text-gray-500 font-medium px-2 pt-2">
                <span>◀ Đầu xe (vách trước)</span>
                <span>Cửa sau ▶</span>
              </div>
            </div>

            {/* (6) Tổng hợp thùng xe (Box summary) */}
            <div className="p-2.5 bg-white border border-gray-300 rounded text-xs text-gray-800">
              Tải: <b>{totalWeight.toLocaleString()} / {maxPayload.toLocaleString()} kg ({maxPayload > 0 ? Math.round((totalWeight / maxPayload) * 100) : 0}%)</b> · Thể tích (chỉ hàng có kích thước): <b>{totalVolume} / {maxVolume} m³ ({maxVolume > 0 ? Math.round((totalVolume / maxVolume) * 100) : 0}%)</b>
            </div>

            {/* (5) Chi tiết khối hàng (Block details) khi click một kiện */}
            {selectedBlock && (
              <div className="p-3 bg-white border border-gray-300 rounded text-xs text-gray-800 space-y-1">
                <div>
                  <b>Đơn {selectedBlock.palletCode || selectedBlock.id}</b> · {selectedBlock.customer || '—'} · {selectedBlock.type || 'Kiện hàng'}: {selectedBlock.dimensions || '—'} · {selectedBlock.weight || '—'}
                </div>
                <div>
                  Điểm giao {stops.find(s => s.id === selectedBlock.stopId)?.name || selectedBlock.stopName || '—'} · Xếp chồng được: <b>{selectedBlock.stackable || 'Không'}</b>
                </div>
              </div>
            )}

            {/* (8) Hàng rời không xếp 3D (Bulk cargo) */}
            {bulkCargos.length > 0 && (
              <div className="p-3 bg-amber-50/70 border border-amber-300 rounded text-xs text-gray-800">
                <div className="font-bold text-amber-900 mb-0.5">
                  Hàng rời không xếp 3D (không có kích thước):
                </div>
                {bulkCargos.map(item => (
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
