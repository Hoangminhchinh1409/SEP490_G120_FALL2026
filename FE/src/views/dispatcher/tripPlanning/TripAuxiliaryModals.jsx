import React from 'react';
import { Tag as AntTag, Drawer as AntDrawer, Modal as AntModal, Button as AntButton, Progress } from 'antd';
import { Route, Clock, CheckCircle2, Printer, Download, Box, PlayCircle } from 'lucide-react';

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
            <AntTag color={selectedTripDetails.status === 'COMPLETED' ? 'green' : 'blue'} className="font-bold text-xs px-2.5 py-0.5 rounded-full">
              {selectedTripDetails.status === 'COMPLETED' ? 'ĐÃ HOÀN THÀNH' : 'ĐANG VẬN CHUYỂN'}
            </AntTag>
          </div>
          <div className="grid grid-cols-2 gap-2 text-gray-600 pt-2 border-t border-indigo-100">
            <div>Khách hàng: <b>{selectedTripDetails.customer}</b></div>
            <div>Đơn hàng: <b className="font-mono text-indigo-700">{selectedTripDetails.orders?.join(', ')}</b></div>
            <div>Số niêm phong chì (Seal): <b className="font-mono text-emerald-700">{selectedTripDetails.seal_number}</b></div>
            <div>Xe phụ trách: <b>{selectedTripDetails.truck_model}</b></div>
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
              <div key={stop.id} className="p-3 bg-white rounded-xl border border-gray-200 shadow-xs flex items-start gap-3">
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
          <h4 className="font-bold text-gray-800 mb-2">Ảnh chứng chỉ niêm phong &amp; Biên bản giao nhận:</h4>
          <div className="flex items-center gap-4">
            <div className="text-center p-3 bg-white rounded-lg border border-dashed text-gray-500">
              <CheckCircle2 size={24} className="text-emerald-500 mx-auto mb-1" />
              <span>Ảnh chì nguyên seal</span>
            </div>
            <div className="text-center p-3 bg-white rounded-lg border border-dashed text-gray-500">
              <CheckCircle2 size={24} className="text-blue-500 mx-auto mb-1" />
              <span>Biên bản POD có chữ ký</span>
            </div>
          </div>
        </div>
      </div>
    </AntDrawer>
  );
}

export function TripWaybillModal({ selectedTripWaybill, onClose, onPrintWaybill }) {
  if (!selectedTripWaybill) return null;

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
          onClick={onPrintWaybill}
        >
          Tải về Vận đơn PDF
        </AntButton>
      ]}
    >
      <div className="p-6 bg-white border border-gray-200 rounded-xl font-sans text-xs space-y-4 my-2 shadow-xs">
        <div className="text-center border-b pb-3">
          <h2 className="text-base font-black text-gray-800 uppercase tracking-wide">CÔNG TY CỔ PHẦN LOGISTICS THÔNG MINH NEXLOG</h2>
          <h3 className="text-sm font-bold text-[#7367f0] mt-1">LỆNH ĐIỀU XE &amp; VẬN ĐƠN VẬN TẢI</h3>
          <p className="text-gray-400 font-mono text-[11px]">
            Số vận đơn: WB-{selectedTripWaybill.id} | Phiên bản: V{selectedTripWaybill.waybill_version || 1} | Ngày phát hành: 14/10/2026
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

import LoadPlan3DModal from '../../../components/dispatcher/LoadPlan3DModal';

export function Trip3DModal({ selectedTrip3D, onClose }) {
  if (!selectedTrip3D) return null;

  return (
    <LoadPlan3DModal
      open={Boolean(selectedTrip3D)}
      trip={{
        trip_code: selectedTrip3D.id || 'TR261026-009',
        plate: selectedTrip3D.plate || '29C-456.78',
        truck_model: selectedTrip3D.truck_model || 'Hyundai 2.5 t',
        box_dim: selectedTrip3D.box_dim || 'Thùng 4,2 × 1,9 × 1,9 m',
        max_payload: selectedTrip3D.max_payload || 2500,
        total_weight: selectedTrip3D.total_weight || 1450,
        orders_count: selectedTrip3D.orders_count || 6,
        stops_count: selectedTrip3D.stops_count || 3,
        total_volume: selectedTrip3D.total_volume || 5.6,
        max_volume: selectedTrip3D.max_volume || 15.2
      }}
      onClose={onClose}
    />
  );
}

export function TripReplayModal({ selectedTripReplay, onClose }) {
  if (!selectedTripReplay) return null;

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
        <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 flex justify-between items-center">
          <div>
            <span className="font-bold text-amber-900">Chuyến xe: {selectedTripReplay.id} ({selectedTripReplay.plate})</span>
            <p className="text-amber-700 text-[11px] mt-0.5">Tài xế: {selectedTripReplay.driver_name} | Tuyến: {selectedTripReplay.pickup} → {selectedTripReplay.dropoff}</p>
          </div>
          <AntButton type="primary" icon={<PlayCircle size={15} />} className="bg-amber-600 hover:bg-amber-700">
            Phát lại (Play GPS)
          </AntButton>
        </div>

        <div className="space-y-1">
          <div className="flex justify-between text-gray-500 font-mono text-[11px]">
            <span>Xuất bến: {selectedTripReplay.actual_start || selectedTripReplay.planned_start}</span>
            <span>Hiện tại: 65% quãng đường</span>
            <span>Về đích dự kiến: {selectedTripReplay.planned_finish}</span>
          </div>
          <Progress percent={65} strokeColor="#d97706" />
        </div>

        <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
          <span className="font-bold text-gray-700 block mb-1">Mốc ghi nhận GPS trên hành trình:</span>
          <ul className="space-y-1 text-gray-600 list-disc pl-4 text-[11px]">
            <li>09:35 - Nghỉ tại Trạm dừng nghỉ Km12 (Thời gian dừng: 12 phút).</li>
            <li>10:05 - Tắc đường cục bộ tại nút giao Phù Đổng (Vận tốc 12 km/h - Cảnh báo trễ hẹn).</li>
          </ul>
        </div>
      </div>
    </AntModal>
  );
}
