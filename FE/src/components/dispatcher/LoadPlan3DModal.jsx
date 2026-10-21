import React, { useState } from 'react';
import { Modal, Button, Tag, Tabs, Tooltip } from 'antd';
import { Eye, EyeOff, Box, Info, X } from 'lucide-react';

/**
 * Figure 25 / Section 3.1.3: 3D Load Plan (Xếp hàng 3D)
 * Chuẩn SRS:
 * (1) Thông tin chuyến (Trip summary): Mã chuyến, Biển số xe, Kích thước thùng xe (D x R x C), Tải cho phép, Tổng khối lượng, Số đơn, Số điểm giao.
 * (2) Danh sách điểm dừng (Stops): Các điểm giao (giao trước -> sau), kèm mã màu, số đơn, khối lượng và icon con mắt ẩn/hiện kiện hàng.
 * (3) Góc nhìn (View tabs): 3D, Trên (Top), Cạnh (Side), Trước (Front).
 * (4) Hình thùng xe (Truck box): Thùng xe với các khối kiện hàng phân màu theo điểm giao, đánh dấu ĐẦU XE (vách trước) và CỬA SAU.
 * (5) Chi tiết khối hàng (Block details): Khi click vào một khối kiện, hiển thị mã đơn, khách hàng, kích thước, khối lượng, điểm giao, xếp chồng: Có/Không.
 * (6) Tổng hợp thùng xe (Box summary): Tải trọng (kg / % tải) và Thể tích (m³ / % thể tích thùng).
 * (7) Nút Đóng (Close).
 * (8) Hàng rời không xếp 3D (Bulk cargo): Danh sách hàng rời không có kích thước không vẽ được vào mô hình 3D nhưng vẫn tính vào tổng tải.
 */
export default function LoadPlan3DModal({ open, trip, onClose }) {
  if (!open) return null;

  // Dữ liệu mẫu chuẩn prototype khi mở với trip hoặc fallback
  const tripCode = trip?.trip_code || trip?.id || 'TR261026-009';
  const truckPlate = trip?.plate || '29C-456.78';
  const truckModel = trip?.truck_model || 'Hyundai 2.5 t';
  const boxDim = trip?.box_dim || 'Thùng 4,2 × 1,9 × 1,9 m';
  const maxPayload = trip?.max_payload || 2500;
  const totalWeight = trip?.total_weight || 1450;
  const totalOrdersCount = trip?.orders_count || 6;
  const totalStopsCount = trip?.stops_count || 3;
  const totalVolume = trip?.total_volume || 5.6;
  const maxVolume = trip?.max_volume || 15.2;

  // (2) Danh sách các điểm giao (giao trước -> sau)
  const [stops, setStops] = useState([
    {
      id: 'A',
      name: 'A - Gia Lâm',
      ordersCount: 2,
      weight: 440,
      color: '#bbf7d0', // green-200
      strokeColor: '#22c55e',
      badgeColor: 'green',
      visible: true
    },
    {
      id: 'B',
      name: 'B - Long Biên',
      ordersCount: 2,
      weight: 560,
      color: '#fed7aa', // orange-200
      strokeColor: '#f97316',
      badgeColor: 'orange',
      visible: true
    },
    {
      id: 'C',
      name: 'C - Hà Đông',
      ordersCount: 2,
      weight: 450,
      color: '#bfdbfe', // blue-200
      strokeColor: '#3b82f6',
      badgeColor: 'blue',
      visible: true
    }
  ]);

  // (3) Góc nhìn
  const [activeView, setActiveView] = useState('3D');

  // Danh sách các khối kiện hàng 3D
  const blocksData = [
    {
      id: '0031',
      stopId: 'A',
      customer: 'Cty TNHH Tiếp Vận Gia Lâm',
      type: 'Pallet gỗ',
      dimensions: '110 × 90 × 85 cm',
      weight: '240 kg',
      stackable: 'Có',
      left: '8%',
      bottom: '12%',
      width: '26%',
      height: '48%',
      topFaceHeight: 22,
      rightFaceWidth: 26,
      palletCode: '0031'
    },
    {
      id: '0032',
      stopId: 'A',
      customer: 'Cty TNHH Thiết bị Ánh Dương',
      type: 'Kiện thùng carton',
      dimensions: '100 × 80 × 55 cm',
      weight: '200 kg',
      stackable: 'Có (Tầng trên)',
      left: '8%',
      bottom: '62%',
      width: '26%',
      height: '24%',
      topFaceHeight: 18,
      rightFaceWidth: 26,
      palletCode: '0032'
    },
    {
      id: '0033',
      stopId: 'B',
      customer: 'Cty CP Minh Phát',
      type: 'Pallet',
      dimensions: '100 × 80 × 85 cm',
      weight: '260 kg',
      stackable: 'Có',
      left: '38%',
      bottom: '12%',
      width: '23%',
      height: '42%',
      topFaceHeight: 20,
      rightFaceWidth: 24,
      palletCode: '0033'
    },
    {
      id: '0034',
      stopId: 'C',
      customer: 'Cty TNHH May Mặc Hà Đông',
      type: 'Pallet nhựa dệt may',
      dimensions: '120 × 90 × 120 cm',
      weight: '250 kg',
      stackable: 'Không',
      left: '65%',
      bottom: '12%',
      width: '20%',
      height: '56%',
      topFaceHeight: 24,
      rightFaceWidth: 22,
      palletCode: '0034'
    },
    {
      id: '0035',
      stopId: 'C',
      customer: 'Cty TNHH May Mặc Hà Đông',
      type: 'Kiện hàng may mặc',
      dimensions: '90 × 75 × 60 cm',
      weight: '200 kg',
      stackable: 'Có',
      left: '88%',
      bottom: '12%',
      width: '18%',
      height: '35%',
      topFaceHeight: 16,
      rightFaceWidth: 20,
      palletCode: '0035'
    }
  ];

  // (5) Chi tiết khối hàng đang được chọn
  const [selectedBlock, setSelectedBlock] = useState(blocksData[2]); // mặc định 0033 như trong ảnh mẫu

  // (8) Hàng rời không xếp 3D
  const bulkCargos = [
    {
      id: '0036',
      customer: 'Cty CP Minh Phát',
      weight: '300 kg',
      spec: '10 bao',
      stopName: 'Điểm giao B - Long Biên'
    }
  ];

  const toggleStopVisibility = (stopId) => {
    setStops(prev => prev.map(s => s.id === stopId ? { ...s, visible: !s.visible } : s));
  };

  const getStopColor = (stopId) => {
    const s = stops.find(item => item.id === stopId);
    return s || { color: '#e2e8f0', strokeColor: '#94a3b8' };
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
          
          {/* (2) Danh sách điểm dừng (giao trước -> sau) */}
          <div className="lg:col-span-3 space-y-3">
            <div className="text-xs font-bold text-gray-700">
              Điểm giao (giao trước → sau)
            </div>

            <div className="space-y-2.5">
              {stops.map((stop) => (
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
              ))}
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

                {/* Các khối kiện hàng (Blocks) */}
                {blocksData.map((block) => {
                  const stop = stops.find(s => s.id === block.stopId);
                  if (stop && !stop.visible) return null; // Ẩn khi dispatcher toggle eye
                  
                  const isSelected = selectedBlock?.id === block.id;

                  return (
                    <div
                      key={block.id}
                      onClick={() => setSelectedBlock(block)}
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
                        {block.palletCode}
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
                })}
              </div>

              {/* Chú thích chiều: Đầu xe (vách trước) và Cửa sau */}
              <div className="flex justify-between items-center text-[11px] text-gray-500 font-medium px-2 pt-2">
                <span>◀ Đầu xe (vách trước)</span>
                <span>Cửa sau ▶</span>
              </div>
            </div>

            {/* (6) Tổng hợp thùng xe (Box summary) */}
            <div className="p-2.5 bg-white border border-gray-300 rounded text-xs text-gray-800">
              Tải: <b>{totalWeight.toLocaleString()} / {maxPayload.toLocaleString()} kg ({Math.round((totalWeight / maxPayload) * 100)}%)</b> · Thể tích (chỉ hàng có kích thước): <b>{totalVolume} / {maxVolume} m³ ({Math.round((totalVolume / maxVolume) * 100)}%)</b>
            </div>

            {/* (5) Chi tiết khối hàng (Block details) khi click một kiện */}
            {selectedBlock && (
              <div className="p-3 bg-white border border-gray-300 rounded text-xs text-gray-800 space-y-1">
                <div>
                  <b>Đơn {selectedBlock.palletCode}</b> · {selectedBlock.customer} · {selectedBlock.type}: {selectedBlock.dimensions} · {selectedBlock.weight}
                </div>
                <div>
                  Điểm giao {stops.find(s => s.id === selectedBlock.stopId)?.name} · Xếp chồng được: <b>{selectedBlock.stackable}</b>
                </div>
              </div>
            )}

            {/* (8) Hàng rời không xếp 3D (Bulk cargo) */}
            <div className="p-3 bg-amber-50/70 border border-amber-300 rounded text-xs text-gray-800">
              <div className="font-bold text-amber-900 mb-0.5">
                Hàng rời không xếp 3D (không có kích thước):
              </div>
              {bulkCargos.map(item => (
                <div key={item.id} className="text-gray-700">
                  Đơn {item.id} · {item.customer} · {item.weight} · {item.spec} · {item.stopName}
                </div>
              ))}
            </div>

          </div>

        </div>

      </div>
    </Modal>
  );
}
