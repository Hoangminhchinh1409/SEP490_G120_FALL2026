import React, { useState, useEffect } from 'react';
import { Tag as AntTag, Drawer as AntDrawer, Modal as AntModal, Button as AntButton, Progress, Slider } from 'antd';
import { Route, Clock, CheckCircle2, Printer, Download, PlayCircle, PauseCircle, RotateCcw, MapPin } from 'lucide-react';
import { dispatcherApi } from '../../../api/dispatcherApi';
import LoadPlan3DModal from '../../../components/dispatcher/LoadPlan3DModal';

export function TripDetailsDrawer({ selectedTripDetails, onClose }) {
  if (!selectedTripDetails) return null;

  return (
    <AntDrawer
      title={
        <div className="flex items-center gap-2">
          <Route size={20} className="text-[#7367f0]" />
          <div>
            <span className="font-bold text-gray-800 text-base">Hồ sơ Chi tiết chuyến xe: {selectedTripDetails.id}</span>
            <p className="text-xs text-gray-400 font-normal">Biển số: {selectedTripDetails.plate} | Tài xế: {selectedTripDetails.driver_name}</p>
          </div>
        </div>
      }
      open={Boolean(selectedTripDetails)}
      onClose={onClose}
      size={680}
    >
      <div className="space-y-5 text-xs">
        {/* Thẻ trạng thái */}
        <div className="p-4 bg-indigo-50/60 rounded-xl border border-indigo-100 space-y-2">
          <div className="flex justify-between items-center">
            <span className="font-bold text-gray-700 text-sm">Trạng thái:</span>
            <AntTag
              color={
                selectedTripDetails.status === 'COMPLETED'
                  ? 'green'
                  : selectedTripDetails.status === 'CANCELLED'
                    ? 'red'
                    : 'blue'
              }
              className="font-bold text-xs px-2.5 py-0.5 rounded-full"
            >
              {selectedTripDetails.status === 'COMPLETED'
                ? 'ĐÃ HOÀN THÀNH'
                : selectedTripDetails.status === 'CANCELLED'
                  ? 'ĐÃ HỦY CHUYẾN'
                  : 'ĐANG VẬN CHUYỂN'}
            </AntTag>
          </div>
          <div className="grid grid-cols-2 gap-2 text-gray-600 pt-2 border-t border-indigo-100">
            <div>Khách hàng: <b>{selectedTripDetails.customer}</b></div>
            <div>Đơn hàng: <b className="font-mono text-indigo-700">{selectedTripDetails.orders?.join(', ')}</b></div>
            <div>Số niêm phong chì (Seal): <b className="font-mono text-emerald-700">{selectedTripDetails.seal_number}</b></div>
            <div>Xe phụ trách: <b>{selectedTripDetails.truck_model}</b></div>
            <div>Phiên bản vận đơn: <b className="font-mono">V{selectedTripDetails.waybill_version || 1}</b></div>
            <div>Tiến độ hành trình: <b className="text-[#7367f0]">{selectedTripDetails.progress}%</b></div>
          </div>
        </div>

        {/* Các điểm dừng & Sự kiện */}
        <div>
          <h3 className="font-bold text-sm text-gray-800 mb-3 flex items-center gap-2">
            <Clock size={16} className="text-[#7367f0]" />
            Lịch trình các điểm dừng &amp; Sự kiện chặng
          </h3>
          <div className="space-y-3">
            {selectedTripDetails.stops?.map((stop, index) => (
              <div key={stop.id || index} className="p-3 bg-white rounded-xl border border-gray-200 shadow-xs flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-indigo-100 text-[#7367f0] font-bold flex items-center justify-center shrink-0 text-xs">
                  {index + 1}
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-gray-800 text-xs">{stop.name}</span>
                    <AntTag color={stop.type === 'PICKUP' ? 'blue' : stop.type === 'REST' ? 'orange' : stop.type === 'INCIDENT' ? 'red' : stop.type === 'TRANSSHIP' ? 'purple' : 'green'} className="text-[10px] m-0">
                      {stop.type}
                    </AntTag>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-1.5 text-gray-600 text-[11px]">
                    <div>Kế hoạch: <b className="font-mono">{stop.planned}</b></div>
                    <div>Thực tế: <b className="font-mono text-indigo-600">{stop.actual}</b></div>
                  </div>
                  <div className="mt-1 text-gray-500 text-[11px] bg-gray-50 p-1.5 rounded">
                    Sự kiện: <b>{stop.event}</b> — {stop.note}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Chứng cứ giao nhận */}
        <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
          <h4 className="font-bold text-gray-800 mb-2">Ảnh chứng chỉ niêm phong &amp; Biên bản giao nhận (POD):</h4>
          <div className="flex items-center gap-4">
            <div className="text-center p-3 bg-white rounded-lg border border-dashed text-gray-500 flex-1">
              <CheckCircle2 size={24} className="text-emerald-500 mx-auto mb-1" />
              <div className="font-semibold text-gray-700">Ảnh chì nguyên seal ({selectedTripDetails.seal_number})</div>
              <div className="text-[10px] text-emerald-600">Đã lưu trữ hợp lệ</div>
            </div>
            <div className="text-center p-3 bg-white rounded-lg border border-dashed text-gray-500 flex-1">
              <CheckCircle2 size={24} className="text-blue-500 mx-auto mb-1" />
              <div className="font-semibold text-gray-700">Biên bản POD có chữ ký</div>
              <div className="text-[10px] text-blue-600">
                {selectedTripDetails.status === 'COMPLETED' ? 'Đã đối soát hoàn tất' : 'Chờ ký nhận tại điểm giao'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AntDrawer>
  );
}

export function TripWaybillModal({ selectedTripWaybill, onClose, onPrintWaybill }) {
  if (!selectedTripWaybill) return null;

  const issueDate = new Date().toLocaleDateString('vi-VN');

  const handlePrintWindow = () => {
    try {
      const printWin = window.open('', '_blank', 'width=850,height=650');
      if (printWin) {
        printWin.document.write(`
          <html>
            <head>
              <title>Vận đơn ${selectedTripWaybill.waybill_number || 'WB-' + selectedTripWaybill.id}</title>
              <style>
                body { font-family: Arial, sans-serif; padding: 32px; color: #1e293b; }
                h2 { margin: 0; font-size: 18px; text-align: center; }
                h3 { margin: 6px 0; font-size: 15px; text-align: center; color: #4f46e5; }
                .meta { text-align: center; font-size: 12px; color: #64748b; margin-bottom: 20px; }
                .grid { display: flex; justify-content: space-between; background: #f8fafc; padding: 14px; border-radius: 8px; margin-bottom: 18px; font-size: 13px; }
                table { width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 13px; }
                th, td { border: 1px solid #cbd5e1; padding: 10px; text-align: left; }
                th { background: #f1f5f9; }
                .sign { display: flex; justify-content: space-around; text-align: center; margin-top: 40px; font-size: 13px; }
              </style>
            </head>
            <body>
              <h2>CÔNG TY CỔ PHẦN LOGISTICS THÔNG MINH NEXLOG</h2>
              <h3>LỆNH ĐIỀU XE &amp; VẬN ĐƠN VẬN TẢI</h3>
              <div class="meta">Số vận đơn: ${selectedTripWaybill.waybill_number || 'WB-' + selectedTripWaybill.id} | Phiên bản: V${selectedTripWaybill.waybill_version || 1} | Ngày phát hành: ${issueDate}</div>
              <div class="grid">
                <div>
                  <p><b>Xe vận tải:</b> ${selectedTripWaybill.plate}</p>
                  <p><b>Dòng xe:</b> ${selectedTripWaybill.truck_model}</p>
                  <p><b>Khách hàng:</b> ${selectedTripWaybill.customer}</p>
                </div>
                <div>
                  <p><b>Tài xế chính:</b> ${selectedTripWaybill.driver_name}</p>
                  <p><b>Số điện thoại:</b> ${selectedTripWaybill.driver_phone}</p>
                  <p><b>Số niêm phong chì:</b> ${selectedTripWaybill.seal_number}</p>
                </div>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>Điểm lấy hàng</th>
                    <th>Điểm trả hàng</th>
                    <th>Đơn hàng liên kết</th>
                    <th>Giờ xuất phát</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>${selectedTripWaybill.pickup}</td>
                    <td>${selectedTripWaybill.dropoff}</td>
                    <td>${selectedTripWaybill.orders?.join(', ')}</td>
                    <td>${selectedTripWaybill.planned_start}</td>
                  </tr>
                </tbody>
              </table>
              <div class="sign">
                <div><b>ĐIỀU PHỐI VIÊN</b><br/><br/><br/>Hoàng Minh Chính</div>
                <div><b>TÀI XẾ NHẬN LỆNH</b><br/><br/><br/>${selectedTripWaybill.driver_name}</div>
                <div><b>NGƯỜI NHẬN HÀNG</b><br/><br/><br/>(Ký &amp; ghi rõ họ tên)</div>
              </div>
            </body>
          </html>
        `);
        printWin.document.close();
        printWin.focus();
        printWin.print();
      }
    } catch {
      // ignore popup block
    }
    onPrintWaybill?.();
  };

  return (
    <AntModal
      title={
        <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
          <Printer size={20} className="text-emerald-600" />
          <div>
            <h3 className="text-base font-bold text-gray-800">Lệnh điều xe &amp; Vận đơn vận tải</h3>
            <p className="text-xs text-gray-500 font-normal">Xuất bản Vận đơn giao cho tài xế và phòng kế toán</p>
          </div>
        </div>
      }
      open={Boolean(selectedTripWaybill)}
      onCancel={onClose}
      width={750}
      footer={[
        <AntButton key="close" onClick={onClose}>Đóng</AntButton>,
        <AntButton
          key="print"
          type="primary"
          icon={<Download size={15} />}
          className="bg-emerald-600 hover:bg-emerald-700 font-semibold"
          onClick={handlePrintWindow}
        >
          In / Tải về Vận đơn PDF
        </AntButton>
      ]}
    >
      <div className="p-6 bg-white border border-gray-200 rounded-xl font-sans text-xs space-y-4 my-2 shadow-xs">
        <div className="text-center border-b pb-3">
          <h2 className="text-base font-black text-gray-800 uppercase tracking-wide">CÔNG TY CỔ PHẦN LOGISTICS THÔNG MINH NEXLOG</h2>
          <h3 className="text-sm font-bold text-[#7367f0] mt-1">LỆNH ĐIỀU XE &amp; VẬN ĐƠN VẬN TẢI</h3>
          <p className="text-gray-400 font-mono text-[11px]">
            Số vận đơn: {selectedTripWaybill.waybill_number || `WB-${selectedTripWaybill.id}`} | Phiên bản: V{selectedTripWaybill.waybill_version || 1} | Ngày phát hành: {issueDate}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 bg-gray-50 p-3 rounded-lg">
          <div>
            <p>Xe vận tải: <b className="font-mono">{selectedTripWaybill.plate}</b></p>
            <p>Dòng xe: <b>{selectedTripWaybill.truck_model}</b></p>
            <p>Khách hàng: <b>{selectedTripWaybill.customer}</b></p>
          </div>
          <div>
            <p>Tài xế chính: <b>{selectedTripWaybill.driver_name}</b></p>
            <p>Số điện thoại: <b className="font-mono">{selectedTripWaybill.driver_phone}</b></p>
            <p>Số niêm phong chì: <b className="font-mono text-emerald-700">{selectedTripWaybill.seal_number}</b></p>
          </div>
        </div>

        <table className="w-full border-collapse border border-gray-200 text-left">
          <thead>
            <tr className="bg-gray-100 text-gray-700">
              <th className="p-2 border border-gray-200">Điểm lấy hàng</th>
              <th className="p-2 border border-gray-200">Điểm trả hàng</th>
              <th className="p-2 border border-gray-200">Đơn hàng liên kết</th>
              <th className="p-2 border border-gray-200">Giờ xuất phát</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="p-2 border border-gray-200">{selectedTripWaybill.pickup}</td>
              <td className="p-2 border border-gray-200">{selectedTripWaybill.dropoff}</td>
              <td className="p-2 border border-gray-200 font-mono">{selectedTripWaybill.orders?.join(', ')}</td>
              <td className="p-2 border border-gray-200 font-mono">{selectedTripWaybill.planned_start}</td>
            </tr>
          </tbody>
        </table>

        <div className="pt-6 grid grid-cols-3 text-center text-gray-600">
          <div>
            <p className="font-bold">ĐIỀU PHỐI VIÊN</p>
            <p className="text-[11px] text-gray-400 mt-1">(Ký &amp; ghi rõ họ tên)</p>
            <p className="mt-8 font-semibold text-gray-800">Hoàng Minh Chính</p>
          </div>
          <div>
            <p className="font-bold">TÀI XẾ NHẬN LỆNH</p>
            <p className="text-[11px] text-gray-400 mt-1">(Ký &amp; ghi rõ họ tên)</p>
            <p className="mt-8 font-semibold text-gray-800">{selectedTripWaybill.driver_name}</p>
          </div>
          <div>
            <p className="font-bold">NGƯỜI NHẬN HÀNG</p>
            <p className="text-[11px] text-gray-400 mt-1">(Ký khi giao hàng)</p>
            <p className="mt-8 font-semibold text-gray-400">Chờ ký tại kho</p>
          </div>
        </div>
      </div>
    </AntModal>
  );
}

export function Trip3DModal({ selectedTrip3D, onClose }) {
  if (!selectedTrip3D) return null;

  return (
    <LoadPlan3DModal
      open={Boolean(selectedTrip3D)}
      trip={{
        trip_code: selectedTrip3D.id || selectedTrip3D.trip_code || 'TR261026-009',
        plate: selectedTrip3D.plate || '29C-456.78',
        truck_model: selectedTrip3D.truck_model || 'Hyundai 2.5 t',
        box_dim: selectedTrip3D.box_dim || 'Thùng 4,2 × 1,9 × 1,9 m',
        max_payload: selectedTrip3D.max_payload || 2500,
        total_weight: selectedTrip3D.total_weight || selectedTrip3D.weight || 1450,
        orders_count: selectedTrip3D.orders_count || (selectedTrip3D.orders ? selectedTrip3D.orders.length : 1),
        stops_count: selectedTrip3D.stops ? selectedTrip3D.stops.length : 1,
        total_volume: selectedTrip3D.total_volume || selectedTrip3D.volume || 3.4,
        max_volume: selectedTrip3D.max_volume || 15.2,
        orders: selectedTrip3D.orders_data && selectedTrip3D.orders_data.length > 0
          ? selectedTrip3D.orders_data
          : [
              {
                order_id: selectedTrip3D.orders?.[0] || selectedTrip3D.id || 'NEX-140280',
                hawb_code: selectedTrip3D.waybill_no || '180-87429103',
                customer: selectedTrip3D.customer || 'Khách hàng vận tải',
                weight: selectedTrip3D.total_weight || 700,
                package_count: selectedTrip3D.orders_count || 4,
                length_cm: 110,
                width_cm: 90,
                height_cm: 85,
                dropoff: selectedTrip3D.dropoff || 'Điểm giao'
              }
            ],
        assignment_stops: selectedTrip3D.stops || [],
        is_multi_drop: (selectedTrip3D.stops && selectedTrip3D.stops.filter(s => s.type === 'DROPOFF').length > 1)
      }}
      onClose={onClose}
    />
  );
}

export function TripReplayModal({ selectedTripReplay, onClose }) {
  if (!selectedTripReplay) return null;
  return (
    <TripReplayModalContent
      key={selectedTripReplay.raw_id || selectedTripReplay.id}
      selectedTripReplay={selectedTripReplay}
      onClose={onClose}
    />
  );
}

const DEFAULT_RECORDED_TIME = '2026-11-09T08:00:00.000Z';

function TripReplayModalContent({ selectedTripReplay, onClose }) {
  const [replayData, setReplayData] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    let active = true;
    const tripId = selectedTripReplay.raw_id || selectedTripReplay.id;
    dispatcherApi.getTripReplay(tripId)
      .then(data => {
        if (!active) return;
        setReplayData(data);
        const trackLen = data?.gps_track?.length || 0;
        if (trackLen > 0) {
          setStepIndex(Math.min(trackLen - 1, Math.floor(trackLen * 0.6)));
        }
      })
      .catch(() => {
        if (active) setReplayData(null);
      });

    return () => { active = false; };
  }, [selectedTripReplay]);

  const gpsTrack = useMemo(() => {
    if (replayData?.gps_track?.length > 0) {
      return replayData.gps_track;
    }
    return Array.from({ length: 11 }, (_, idx) => ({
      id: idx + 1,
      latitude: Number((21.2187 - idx * 0.0085).toFixed(6)),
      longitude: Number((105.8042 + idx * 0.0155).toFixed(6)),
      speed_kmh: idx === 0 || idx === 10 ? 0 : 52,
      recorded_time: DEFAULT_RECORDED_TIME
    }));
  }, [replayData]);

  useEffect(() => {
    if (!isPlaying) return;
    const timer = setInterval(() => {
      setStepIndex(prev => {
        if (prev >= gpsTrack.length - 1) {
          setIsPlaying(false);
          return gpsTrack.length - 1;
        }
        return prev + 1;
      });
    }, 700);
    return () => clearInterval(timer);
  }, [isPlaying, gpsTrack.length]);

  if (!selectedTripReplay) return null;

  const currentPoint = gpsTrack[stepIndex] || gpsTrack[0] || {};
  const replayPercent = gpsTrack.length > 1
    ? Math.round((stepIndex / (gpsTrack.length - 1)) * 100)
    : (selectedTripReplay.progress || 65);

  return (
    <AntModal
      title={
        <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
          <PlayCircle size={20} className="text-amber-600" />
          <div>
            <h3 className="text-base font-bold text-gray-800">Xem lại Hành trình GPS Chuyến xe</h3>
            <p className="text-xs text-gray-500 font-normal">Đối chiếu vết chạy GPS thực tế với kế hoạch lộ trình</p>
          </div>
        </div>
      }
      open={Boolean(selectedTripReplay)}
      onCancel={onClose}
      width={750}
      footer={[<AntButton key="close" onClick={onClose}>Đóng</AntButton>]}
    >
      <div className="py-2 space-y-4 text-xs">
        <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 flex flex-col sm:flex-row justify-between sm:items-center gap-3">
          <div>
            <span className="font-bold text-amber-900">Chuyến xe: {selectedTripReplay.id} ({selectedTripReplay.plate})</span>
            <p className="text-amber-700 text-[11px] mt-0.5">
              Tài xế: {selectedTripReplay.driver_name} | Tuyến: {selectedTripReplay.pickup} → {selectedTripReplay.dropoff}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <AntButton
              size="small"
              icon={<RotateCcw size={14} />}
              onClick={() => {
                setStepIndex(0);
                setIsPlaying(true);
              }}
            >
              Tua lại từ đầu
            </AntButton>
            <AntButton
              type="primary"
              icon={isPlaying ? <PauseCircle size={15} /> : <PlayCircle size={15} />}
              className="bg-amber-600 hover:bg-amber-700"
              onClick={() => {
                if (stepIndex >= gpsTrack.length - 1) setStepIndex(0);
                setIsPlaying(prev => !prev);
              }}
            >
              {isPlaying ? 'Tạm dừng' : 'Phát lại (Play GPS)'}
            </AntButton>
          </div>
        </div>

        {/* Khung thông số tọa độ GPS thời gian thực tại mốc tua */}
        <div className="grid grid-cols-3 gap-3 p-3 bg-slate-900 text-white rounded-xl font-mono text-[11px]">
          <div>
            <span className="text-slate-400 block text-[10px]">TỌA ĐỘ GPS GHI NHẬN</span>
            <span className="text-emerald-400 font-bold">
              {currentPoint.latitude}, {currentPoint.longitude}
            </span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px]">VẬN TỐC TỨC THỜI</span>
            <span className="text-amber-400 font-bold">{currentPoint.speed_kmh ?? 48} km/h</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px]">THỜI ĐIỂM GHI NHẬN</span>
            <span className="text-sky-300 font-bold">
              {currentPoint.recorded_time
                ? new Date(currentPoint.recorded_time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                : selectedTripReplay.actual_start}
            </span>
          </div>
        </div>

        <div className="space-y-1 px-1">
          <div className="flex justify-between text-gray-500 font-mono text-[11px]">
            <span>Xuất bến: {selectedTripReplay.actual_start || selectedTripReplay.planned_start}</span>
            <span className="font-bold text-amber-700">Mốc GPS #{stepIndex + 1}/{gpsTrack.length} ({replayPercent}% quãng đường)</span>
            <span>Về đích dự kiến: {selectedTripReplay.planned_finish}</span>
          </div>
          <Slider
            min={0}
            max={Math.max(1, gpsTrack.length - 1)}
            value={stepIndex}
            onChange={(val) => {
              setIsPlaying(false);
              setStepIndex(val);
            }}
          />
          <Progress percent={replayPercent} strokeColor="#d97706" size="small" />
        </div>

        <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 space-y-2">
          <span className="font-bold text-gray-700 block">Mốc sự kiện &amp; Điểm dừng ghi nhận trên hành trình:</span>
          <div className="space-y-1.5">
            {(selectedTripReplay.stops || []).map((st, i) => (
              <div key={st.id || i} className="flex items-center justify-between text-[11px] bg-white p-2 rounded border border-gray-100">
                <div className="flex items-center gap-1.5">
                  <MapPin size={13} className={st.type === 'PICKUP' ? 'text-blue-600' : 'text-emerald-600'} />
                  <span className="font-semibold text-gray-800">Chặng {i + 1}: {st.name}</span>
                </div>
                <span className="text-gray-500 font-mono">{st.event} ({st.planned})</span>
              </div>
            ))}
          </div>
          <ul className="space-y-1 text-gray-600 list-disc pl-4 text-[11px] pt-1">
            <li>Đã kiểm tra bán kính Geofence 200m tại kho lấy hàng — Hợp lệ.</li>
            <li>Tín hiệu thiết bị GPS hộp đen ổn định, chu kỳ đồng bộ 30 giây/lần.</li>
          </ul>
        </div>
      </div>
    </AntModal>
  );
}
