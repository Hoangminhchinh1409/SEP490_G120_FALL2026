import React from 'react';
import { Button, Input } from 'antd';
import { Plus, Sparkles, GripVertical, ArrowUp, ArrowDown, Trash2 } from 'lucide-react';

export default function TripAssignmentStopsList({
  stops,
  multiDropMode,
  showAddDropoffInput,
  setShowAddDropoffInput,
  newDropoffAddress,
  setNewDropoffAddress,
  handleConfirmAddDropoff,
  optimizingRoute,
  handleOptimizeShortestRoute,
  draggedIndex,
  setDraggedIndex,
  dragOverIndex,
  setDragOverIndex,
  handleDragDrop,
  moveStop,
  handleRemoveStop,
  handleAddBreak,
  routeSummary
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs flex-wrap gap-2">
        <span className="font-semibold text-gray-700">
          Thứ tự điểm dừng <span className="text-indigo-600 font-medium">· Kéo thả ≡ hoặc bấm ↑↓ để đổi vị trí</span>
        </span>
        <div className="flex items-center gap-1.5">
          {stops.filter(s => s.type === 'DROPOFF').length > 1 && (
            <Button
              size="small"
              loading={optimizingRoute}
              icon={<Sparkles size={11} />}
              onClick={handleOptimizeShortestRoute}
              className="text-[11px] h-6 px-2 text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100 font-semibold"
            >
              Tối ưu đường bộ ngắn nhất
            </Button>
          )}
          {multiDropMode === 'MULTI_POINTS' && (
            <Button 
              size="small" 
              icon={<Plus size={11} />} 
              onClick={() => setShowAddDropoffInput(prev => !prev)}
              className="text-[11px] h-6 px-2 text-indigo-700 bg-indigo-50 border-indigo-200 hover:bg-indigo-100 font-semibold"
            >
              Thêm điểm trả hàng
            </Button>
          )}
        </div>
      </div>

      {/* Khung nhập địa chỉ điểm trả bổ sung khi khách yêu cầu nhiều điểm trả */}
      {multiDropMode === 'MULTI_POINTS' && showAddDropoffInput && (
        <div className="p-2.5 bg-indigo-50/70 border border-indigo-200 rounded space-y-2 text-xs">
          <div className="font-semibold text-indigo-900">
            Nhập địa chỉ điểm trả hàng bổ sung (hoặc chọn nhanh KCN trên tuyến):
          </div>
          <div className="flex items-center gap-2">
            <Input
              size="small"
              value={newDropoffAddress}
              onChange={e => setNewDropoffAddress(e.target.value)}
              onPressEnter={() => handleConfirmAddDropoff()}
              placeholder="VD: KCN Phố Nối A, Hưng Yên hoặc KCN Yên Phong, Bắc Ninh..."
              className="text-xs flex-1"
            />
            <Button
              size="small"
              type="primary"
              onClick={() => handleConfirmAddDropoff()}
              className="bg-indigo-600 text-xs font-semibold"
            >
              Thêm vào lộ trình
            </Button>
          </div>
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {[
              'KCN Phố Nối A, Yên Mỹ, Hưng Yên',
              'KCN Thăng Long II, Mỹ Hào, Hưng Yên',
              'KCN VSIP Từ Sơn, Bắc Ninh',
              'KCN Quế Võ, Bắc Ninh',
              'KCN Yên Phong, Bắc Ninh'
            ].map(presetAddr => (
              <button
                key={presetAddr}
                type="button"
                onClick={() => handleConfirmAddDropoff(presetAddr)}
                className="px-2 py-0.5 bg-white border border-indigo-200 rounded text-[11px] text-indigo-700 hover:bg-indigo-100 transition"
              >
                + {presetAddr}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Danh sách điểm dừng kéo thả */}
      <div className="space-y-1.5 border border-gray-300 rounded p-2 bg-gray-50/50">
        {stops.map((stop, index) => {
          const isDraggable = stop.type !== 'START';
          const isBeingDragged = draggedIndex === index;
          const isDragTarget = dragOverIndex === index && draggedIndex !== index;

          return (
            <div
              key={stop.id}
              draggable={isDraggable}
              onDragStart={(e) => {
                if (!isDraggable) {
                  e.preventDefault();
                  return;
                }
                setDraggedIndex(index);
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', String(index));
              }}
              onDragOver={(e) => {
                if (!isDraggable || index === 0) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                if (dragOverIndex !== index) {
                  setDragOverIndex(index);
                }
              }}
              onDragLeave={() => {
                if (dragOverIndex === index) {
                  setDragOverIndex(null);
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                handleDragDrop(index);
              }}
              onDragEnd={() => {
                setDraggedIndex(null);
                setDragOverIndex(null);
              }}
              className={`p-2 bg-white border rounded text-xs flex items-center justify-between gap-2 transition-all ${
                isBeingDragged
                  ? 'opacity-40 border-dashed border-indigo-400 bg-indigo-50'
                  : isDragTarget
                  ? 'border-indigo-600 bg-indigo-50 shadow-sm translate-y-0.5'
                  : 'border-gray-200 hover:border-gray-400'
              }`}
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div 
                  className={`cursor-grab active:cursor-grabbing text-gray-400 hover:text-indigo-600 p-0.5 ${
                    !isDraggable ? 'opacity-20 cursor-not-allowed' : ''
                  }`}
                  title={isDraggable ? "Kéo thả để thay đổi thứ tự điểm dừng" : "Điểm xuất phát cố định"}
                >
                  <GripVertical size={14} />
                </div>
                
                <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 ${
                  stop.type === 'START' ? 'bg-slate-700 text-white' :
                  stop.type === 'PICKUP' ? 'bg-blue-600 text-white' :
                  stop.type === 'REST' ? 'bg-amber-500 text-white' :
                  'bg-emerald-600 text-white'
                }`}>
                  {stop.badge}
                </span>

                <span className="font-semibold text-gray-900 truncate" title={stop.name}>
                  {stop.name}
                </span>
                <span className="text-gray-500 text-[11px] shrink-0">· {stop.action}</span>
              </div>
              
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-gray-500 font-mono text-[11px]">{stop.eta}</span>

                {/* Nút di chuyển Lên / Xuống */}
                {isDraggable && (
                  <div className="flex items-center gap-0.5 ml-1">
                    <button
                      type="button"
                      disabled={index <= 1}
                      onClick={() => moveStop(index, index - 1)}
                      className="p-0.5 rounded text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 disabled:opacity-30 disabled:pointer-events-none"
                      title="Đưa lên trước"
                    >
                      <ArrowUp size={12} />
                    </button>
                    <button
                      type="button"
                      disabled={index >= stops.length - 1}
                      onClick={() => moveStop(index, index + 1)}
                      className="p-0.5 rounded text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 disabled:opacity-30 disabled:pointer-events-none"
                      title="Đưa xuống sau"
                    >
                      <ArrowDown size={12} />
                    </button>
                  </div>
                )}

                {stop.type !== 'START' && stop.type !== 'PICKUP' && (stop.type === 'REST' || stops.filter(s => s.type === 'DROPOFF').length > 1) && (
                  <button
                    type="button"
                    onClick={() => handleRemoveStop(stop.id)}
                    className="text-gray-400 hover:text-red-500 p-0.5"
                    title="Xóa điểm này"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between pt-1">
        <Button
          size="small"
          icon={<Plus size={12} />}
          onClick={handleAddBreak}
          className="text-xs border-dashed border-gray-400 text-gray-700 hover:text-gray-900 hover:border-gray-600"
        >
          + Thêm điểm nghỉ
        </Button>
        <span className="text-xs text-gray-500 font-medium">
          Tổng quãng đường ngắn nhất: <b>{routeSummary.distanceKm} km</b> · <b>chuyến {Math.floor(routeSummary.durationMins / 60)}h{routeSummary.durationMins % 60}ph</b>
        </span>
      </div>
    </div>
  );
}

