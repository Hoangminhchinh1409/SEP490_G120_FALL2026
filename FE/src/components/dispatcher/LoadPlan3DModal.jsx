import React, { useState, useMemo } from 'react';
import { Modal, Button, Tooltip, Tag, Alert, message } from 'antd';
import {
  Eye,
  EyeOff,
  RotateCcw,
  Box,
  Sparkles,
  Bot
} from 'lucide-react';
import { calculate3DLoadPlan } from '../../utils/loadPlanAlgorithm';
import { aiApi } from '../../api/aiApi';
import { LoadPlanCanvas } from './loadPlan/LoadPlanCanvas';

export default function LoadPlan3DModal({ open, trip, onClose }) {
  const [activeView, setActiveView] = useState('3D');
  const [packingMode, setPackingMode] = useState('AUTO');
  const [hiddenStopIds, setHiddenStopIds] = useState([]);
  const [selectedBlockId, setSelectedBlockId] = useState(null);

  const [cameraAngle, setCameraAngle] = useState({ yaw: -22, pitch: 26 });
  const [dragStart, setDragStart] = useState(null);

  const [aiLoadPlanLoading, setAiLoadPlanLoading] = useState(false);
  const [aiLoadPlanAdvice, setAiLoadPlanAdvice] = useState(null);

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
    height_cm: truckSpec.height_cm
  };

  const tripCode = trip?.trip_code || trip?.id || 'TR-261026-009';
  const truckPlate = trip?.plate || trip?.truck_plate || '29H-995.72';
  const truckModel = trip?.truck_model || 'Hyundai 3.5 tấn';
  const boxDimText = `Thùng ${(truck.length_cm / 100).toFixed(1)} × ${(truck.width_cm / 100).toFixed(1)} × ${(truck.height_cm / 100).toFixed(1)} m`;

  const stops = (autoPlan?.stops || []).map((s) => ({
    ...s,
    visible: !hiddenStopIds.includes(s.id)
  }));

  const stopPaletteMap = {};
  stops.forEach((s) => {
    stopPaletteMap[s.id] = s;
  });

  const blocksData = autoPlan?.blocks || [];
  const overflowBlocks = autoPlan?.overflowBlocks || [];
  const bulkCargos = autoPlan?.bulkCargos || [];
  const summary = autoPlan?.summary || {};
  const cargoSpecDetails = autoPlan?.cargoSpecDetails || [];

  const visibleBlocks = blocksData.filter((b) => !hiddenStopIds.includes(b.stopId));
  const selectedBlock = blocksData.find((b) => b.id === selectedBlockId) || null;

  const toggleStopVisibility = (stopId) => {
    setHiddenStopIds((prev) =>
      prev.includes(stopId) ? prev.filter((id) => id !== stopId) : [...prev, stopId]
    );
  };

  const handleAskGeminiLoadPlan = async () => {
    try {
      setAiLoadPlanLoading(true);
      const res = await aiApi.analyzeLoadPlan3D({
        tripCode,
        truckPlate,
        truckModel,
        boxDimText,
        truck,
        summary,
        stops,
        blocksData,
        overflowBlocks,
        cargoSpecDetails
      });
      setAiLoadPlanAdvice(res);
      message.success(`Google Gemini AI (${res.model || 'Gemini Pro'}) đã hoàn tất phân tích bốc xếp 3D!`);
    } catch (err) {
      console.error(err);
      message.error('Không thể kết nối Gemini AI lúc này');
    } finally {
      setAiLoadPlanLoading(false);
    }
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
        {/* Header */}
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

        {/* Thông tin chuyến & Thông số */}
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

        {/* Cảnh báo overflow */}
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
                  <div>• Khuyến nghị: Đổi sang loại xe có kích thước lớn hơn hoặc chia nhỏ số đo nếu khách nhập là cả lô.</div>
                </div>
              }
            />
          </div>
        )}

        {/* Thân chính */}
        <div className="p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-5 max-h-[78vh] overflow-y-auto">
          {/* Danh sách điểm dừng */}
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

            {/* Danh sách từng kiện hàng */}
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

          {/* Vùng hiển thị 3D */}
          <div className="lg:col-span-9 space-y-3">
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

            {/* Khung thùng xe Canvas */}
            <div className="p-3 bg-white border border-dashed border-gray-400 rounded relative">
              <div className="w-full bg-slate-50/60 rounded relative overflow-hidden">
                <LoadPlanCanvas
                  activeView={activeView}
                  truck={truck}
                  visibleBlocks={visibleBlocks}
                  stopPaletteMap={stopPaletteMap}
                  selectedBlockId={selectedBlockId}
                  setSelectedBlockId={setSelectedBlockId}
                  cameraAngle={cameraAngle}
                  dragStart={dragStart}
                  setDragStart={setDragStart}
                  setCameraAngle={setCameraAngle}
                />
              </div>

              <div className="flex justify-between items-center text-[11px] text-gray-500 font-medium px-2 pt-1.5">
                <span>◀ Đầu xe (Vách trước X = 0 cm — Xếp hàng giao sau cùng)</span>
                <span className="text-indigo-600">
                  {activeView === '3D' ? '💡 Giữ chuột trái và kéo để xoay không gian thùng xe 360°' : `Mặt cắt kỹ thuật tỷ lệ thực (${boxDimText})`}
                </span>
                <span>Cửa sau (X = {truck.length_cm} cm — Xếp hàng giao trước) ▶</span>
              </div>
            </div>

            {/* Tổng hợp thùng xe */}
            <div className="p-3 bg-slate-50 border border-gray-300 rounded text-xs text-gray-800 flex flex-wrap items-center justify-between gap-2">
              <div>
                Số lượng kiện đã xếp: <b className="text-indigo-700">{summary.packedPackagesCount} / {summary.totalPackagesCount} kiện</b> · Tải trọng: <b>{summary.totalWeight?.toLocaleString()} / {summary.maxPayload?.toLocaleString()} kg ({summary.weightPercent}%)</b> · Thể tích chiếm dụng: <b>{summary.totalVolume} / {summary.maxVolume} m³ ({summary.volumePercent}%)</b>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-emerald-700 font-semibold">
                  ✓ Trọng tâm sàn xe ổn định
                </span>
                <Button
                  size="small"
                  icon={<Sparkles size={12} />}
                  loading={aiLoadPlanLoading}
                  onClick={handleAskGeminiLoadPlan}
                  className="bg-purple-50 border-purple-300 text-purple-700 hover:bg-purple-100 text-[11px] font-bold"
                >
                  Gemini AI Tư vấn Bốc xếp
                </Button>
              </div>
            </div>

            {/* Gemini AI Advice */}
            {aiLoadPlanAdvice && (
              <div className="p-3 bg-gradient-to-r from-purple-50/90 to-indigo-50/90 border border-purple-200 rounded text-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-purple-950 flex items-center gap-1.5">
                    <Bot size={14} className="text-purple-600" />
                    Hướng dẫn Bốc xếp &amp; Chằng buộc từ Google Gemini AI ({aiLoadPlanAdvice.model || 'Gemini Pro'}):
                  </span>
                  <Tag color={aiLoadPlanAdvice.safetyStatus === 'SAFE' ? 'green' : 'gold'} className="m-0 text-[10px] font-bold">
                    {aiLoadPlanAdvice.safetyStatus || 'SAFE'}
                  </Tag>
                </div>
                {aiLoadPlanAdvice.headline && (
                  <div className="font-semibold text-indigo-900">{aiLoadPlanAdvice.headline}</div>
                )}
                {Array.isArray(aiLoadPlanAdvice.stepByStepInstructions) && (
                  <ul className="list-disc pl-4 m-0 space-y-0.5 text-gray-700">
                    {aiLoadPlanAdvice.stepByStepInstructions.map((step, i) => (
                      <li key={i}>{step}</li>
                    ))}
                  </ul>
                )}
                {aiLoadPlanAdvice.driverChecklist && (
                  <div className="text-[11px] text-purple-900 pt-1 border-t border-purple-200/60">
                    <b>📋 Lưu ý cho Tài xế &amp; Đội kho:</b> {aiLoadPlanAdvice.driverChecklist}
                  </div>
                )}
              </div>
            )}

            {/* Chi tiết khối hàng khi click */}
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

            {/* Hàng rời */}
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
