import React, { useState, useEffect } from 'react';
import { Modal, Radio, Select, Button, Alert, Tag, Input, message, Tooltip } from 'antd';
import { 
  Truck, 
  MapPin, 
  Clock, 
  AlertTriangle, 
  Plus, 
  GripVertical, 
  Coffee, 
  Box, 
  ArrowRight, 
  ExternalLink,
  Save,
  CheckCircle2,
  Trash2
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { dispatcherApi } from '../../api/dispatcherApi';
import LoadPlan3DModal from './LoadPlan3DModal';

// Dynamic import bản đồ tương tác Leaflet để tránh lỗi SSR trong Next.js
const TripAssignmentMap = dynamic(
  () => import('./TripAssignmentMap'),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full min-h-[340px] flex items-center justify-center text-xs text-gray-500 bg-slate-50">
        Đang tải bản đồ số tuyến đường...
      </div>
    )
  }
);

const { Option } = Select;

/**
 * Figure 23: 3.1.1 Trip Assignment (Chọn xe & tài xế – Đơn NEX-XXXXXX)
 * Chuẩn SRS:
 * (1) Thông tin đơn (Trip summary): Đơn, HAWB, Khách hàng, Điểm dừng, KL tính cước, Thể tích, Trạng thái, Xuất phát dự kiến, Quãng đường, Thời gian chuyến.
 * (2) Phương thức vận chuyển (Transport mode): Toggle Đội xe nội bộ (mặc định) / Nhà xe đối tác.
 * (3) Ghép chuyến nhiều điểm trả (Multi-drop grouping): Chỉ kích hoạt khi khách yêu cầu 1 đơn nhưng trả nhiều điểm khác nhau trên cùng tuyến đường.
 * (4) Xe (Truck): Dropdown chọn xe (Biển số, tải trọng, trạng thái).
 * (5) Số tài xế (Number of drivers): Toggle 1 tài xế / 2 tài xế. Cảnh báo vàng nếu chuyến > 8 giờ (MSG62).
 * (6) Tài xế 1 & Tài xế 2 (Driver 1 / Driver 2): Giờ đã lái hôm nay, giờ còn lại.
 * (7) Thứ tự điểm dừng (Stop order): Danh sách kéo thả các điểm S (Xuất phát), Lấy hàng, Điểm trả 1, 2... và Điểm nghỉ.
 * (8) Bản đồ tuyến (Route map): Tích hợp trực tiếp API đường bộ thực tế (OSRM / Geoapify) kết nối các điểm dừng.
 * (9) Nút Xem xếp hàng 3D: Mở Modal Xếp hàng 3D (Figure 25).
 * (10, 11, 12) Nhà xe đối tác: Nhà xe, Mã vận đơn nhà xe, Chuyển xe ngoài.
 * (13) Giao xe & tạo chuyến (Assign).
 * (14) Chứng từ chuyến (Trip documents).
 * (15, 16) Lý do thay đổi & Lưu thay đổi: Dùng khi thay đổi xe / tài xế qua sự cố.
 */
export default function TripAssignmentModal({
  open,
  order,
  incidentContext = null,
  onCancel,
  onAssignSuccess
}) {
  // (2) Phương thức vận chuyển
  const [transportMode, setTransportMode] = useState('INTERNAL');

  // (3) Tùy chọn ghép nhiều điểm giao của đơn
  const [isMultiDropOrder, setIsMultiDropOrder] = useState(true);
  const [multiDropMode, setMultiDropMode] = useState('MULTI_POINTS'); // 'MULTI_POINTS' hoặc 'STANDALONE'

  // (4) Xe tải
  const [trucks, setTrucks] = useState([]);
  const [selectedTruckPlate, setSelectedTruckPlate] = useState('29H-995.72 - 3.500 kg - Sẵn sàng');

  // (5) Số tài xế: 1 hoặc 2
  const [driverCount, setDriverCount] = useState(1);

  // (6) Tài xế 1 & Tài xế 2
  const [drivers, setDrivers] = useState([]);
  const [selectedDriver1, setSelectedDriver1] = useState('Hồ Chí Học - Đã lái 4,5h');
  const [selectedDriver2, setSelectedDriver2] = useState('');

  // (7) Thứ tự điểm dừng & Tọa độ thực tế phục vụ bản đồ Routing API
  const [stops, setStops] = useState([
    {
      id: 'S',
      type: 'START',
      badge: 'S',
      name: 'Xuất phát: Bãi xe ALS – Long Biên',
      action: 'Xuất phát',
      eta: 'dự kiến 07:00',
      duration: '0 phút',
      lat: 21.0375,
      lng: 105.8942
    },
    {
      id: '1',
      type: 'PICKUP',
      badge: '1',
      name: 'Lấy hàng: Kho T1 – Nội Bài',
      action: 'bốc 30 phút',
      eta: 'dự kiến 07:45',
      duration: '30 phút',
      lat: 21.2187,
      lng: 105.8042
    },
    {
      id: 'REST-1',
      type: 'REST',
      badge: 'Nghỉ',
      name: 'Nghỉ 15 phút (Trạm dừng Km18)',
      action: 'Nghỉ ngơi',
      eta: 'dự kiến 08:30',
      duration: '15 phút',
      lat: 21.1550,
      lng: 105.9520
    },
    {
      id: '2',
      type: 'DROPOFF',
      badge: '2',
      name: 'Điểm trả 1: KCN Quế Võ – Bắc Ninh',
      action: 'dỡ 30 phút',
      eta: 'dự kiến 09:15',
      duration: '30 phút',
      lat: 21.1628,
      lng: 106.1285
    },
    {
      id: '3',
      type: 'DROPOFF',
      badge: '3',
      name: 'Điểm trả 2: Kho VSIP Từ Sơn (Cùng tuyến)',
      action: 'dỡ 20 phút',
      eta: 'dự kiến 10:00',
      duration: '20 phút',
      lat: 21.1150,
      lng: 105.9750
    }
  ]);

  // (8) Routing Polyline & Thông tin lộ trình tính từ API
  const [routePolyline, setRoutePolyline] = useState([]);
  const [routeSummary, setRouteSummary] = useState({ distanceKm: 68, durationMins: 160 });

  // (10, 11) Nhà xe đối tác
  const [vendors, setVendors] = useState([]);
  const [selectedVendor, setSelectedVendor] = useState('Vận tải Hải Long');
  const [vendorTrackingCode, setVendorTrackingCode] = useState('VT-485214');

  // (15) Lý do thay đổi (khi có incidentContext)
  const [changeReason, setChangeReason] = useState('Tài xế Hồ Chí Học báo ốm, đổi sang Tài xế Sức Hải');

  // Modal 3D Load Plan
  const [is3DOpen, setIs3DOpen] = useState(false);
  const [loadingResources, setLoadingResources] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoadingResources(true);

    Promise.all([
      dispatcherApi.getTrucks(),
      dispatcherApi.getDrivers(),
      dispatcherApi.getVendors()
    ])
      .then(([trucksData, driversData, vendorsData]) => {
        setTrucks(trucksData || []);
        setDrivers(driversData || []);
        setVendors(vendorsData || []);
        if (vendorsData?.length > 0 && !selectedVendor) {
          setSelectedVendor(vendorsData[0].name || vendorsData[0].id);
        }
      })
      .catch(err => {
        console.warn('Load assignment data error:', err);
      })
      .finally(() => {
        setLoadingResources(false);
      });
  }, [open]);

  // TÍCH HỢP ROUTING API THỰC TẾ QUA BACKEND PROXY (HOẶC OSRM FALLBACK)
  useEffect(() => {
    if (!open) return;
    const validPoints = stops.filter(s => s.lat && s.lng);
    if (validPoints.length < 2) return;

    let isMounted = true;
    const fetchFullRoute = async () => {
      try {
        // Gọi API nối lần lượt các chặng dừng
        let combinedPolyline = [];
        let totalDist = 0;
        let totalTime = 0;

        for (let i = 0; i < validPoints.length - 1; i++) {
          const p1 = validPoints[i];
          const p2 = validPoints[i + 1];

          // 1. Thử gọi backend proxy
          try {
            const beUrl = `http://localhost:9999/api/routing/road-route?startLng=${p1.lng}&startLat=${p1.lat}&endLng=${p2.lng}&endLat=${p2.lat}`;
            const res = await fetch(beUrl);
            if (res.ok) {
              const data = await res.json();
              if (data?.success && Array.isArray(data.polyline)) {
                combinedPolyline = combinedPolyline.concat(data.polyline);
                totalDist += data.distanceKm || 0;
                totalTime += data.durationMins || 0;
                continue;
              }
            }
          } catch (e) {
            // fallback OSRM direct
          }

          // 2. Fallback OSRM direct
          try {
            const directUrl = `https://routing.openstreetmap.de/routed-car/route/v1/driving/${p1.lng},${p1.lat};${p2.lng},${p2.lat}?overview=full&geometries=geojson`;
            const directRes = await fetch(directUrl);
            if (directRes.ok) {
              const dData = await directRes.json();
              if (dData?.routes?.[0]) {
                const r = dData.routes[0];
                const poly = r.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
                combinedPolyline = combinedPolyline.concat(poly);
                totalDist += parseFloat((r.distance / 1000).toFixed(1));
                totalTime += Math.round(r.duration / 60);
                continue;
              }
            }
          } catch (e) {
            // fallback đường thẳng
          }

          combinedPolyline.push([p1.lat, p1.lng], [p2.lat, p2.lng]);
        }

        if (isMounted && combinedPolyline.length > 0) {
          setRoutePolyline(combinedPolyline);
          if (totalDist > 0) {
            setRouteSummary({
              distanceKm: parseFloat(totalDist.toFixed(1)),
              durationMins: totalTime
            });
          }
        }
      } catch (err) {
        console.warn('Trip routing error:', err);
      }
    };

    fetchFullRoute();
    return () => { isMounted = false; };
  }, [open, stops]);

  if (!order) return null;

  // Tính toán thông tin hiển thị (1)
  const orderCode = order.order_id || order.id || 'NEX-140280';
  const hawbCode = order.hawb || '180-87429103';
  const customerName = order.customer || order.customer_name || 'ADTEK (VIET NAM) CO., LTD';
  const stopsCount = stops.filter(s => s.type === 'DROPOFF').length + 1;
  const chargeableWeight = order.chargeable || order.weight || 2050;
  const cargoVolume = order.volume || 3.4;
  const plannedStart = order.planned_start || '28/10/2026 07:00';

  // Thêm điểm nghỉ mới vào (7)
  const handleAddBreak = () => {
    const newBreak = {
      id: `REST-${Date.now()}`,
      type: 'REST',
      badge: 'Nghỉ',
      name: 'Nghỉ 15 phút (Điểm nghỉ an toàn)',
      action: 'Nghỉ giải lao',
      eta: 'dự kiến +15 phút',
      duration: '15 phút',
      lat: 21.1400,
      lng: 106.0500
    };
    const updated = [...stops];
    updated.splice(updated.length - 1, 0, newBreak);
    setStops(updated);
    message.success('Đã bổ sung điểm dừng nghỉ theo quy chuẩn lái xe an toàn!');
  };

  // Thêm điểm trả hàng trên cùng tuyến (khi khách yêu cầu giao nhiều điểm)
  const handleAddDropoff = () => {
    const nextIdx = stops.filter(s => s.type === 'DROPOFF').length + 1;
    const newDropoff = {
      id: `DROP-${Date.now()}`,
      type: 'DROPOFF',
      badge: `${nextIdx}`,
      name: `Điểm trả ${nextIdx}: Kho phụ trợ (Trên tuyến)`,
      action: 'dỡ 20 phút',
      eta: 'dự kiến linh hoạt',
      duration: '20 phút',
      lat: 21.1350,
      lng: 106.0200
    };
    setStops([...stops, newDropoff]);
    message.success(`Đã thêm Điểm trả ${nextIdx} trên cung đường chuyến xe!`);
  };

  // Xóa điểm dừng
  const handleRemoveStop = (stopId) => {
    if (stops.length <= 3) {
      message.warning('Cần tối thiểu 1 điểm lấy và 1 điểm giao hàng!');
      return;
    }
    setStops(stops.filter(s => s.id !== stopId));
    message.info('Đã xóa điểm dừng khỏi hành trình');
  };

  // Xác nhận tạo chuyến nội bộ (13)
  const handleAssignInternal = () => {
    const generatedTripId = `TR${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${Math.floor(100 + Math.random() * 900)}`;
    const waybillNo = `WB-${orderCode}`;

    onAssignSuccess?.({
      ...order,
      status: 'ASSIGNED',
      allocationType: 'INTERNAL',
      trip_id: generatedTripId,
      truck: selectedTruckPlate,
      driver1: selectedDriver1,
      driver2: driverCount === 2 ? selectedDriver2 : null,
      waybill_no: waybillNo,
      stops: stops,
      distanceKm: routeSummary.distanceKm,
      is_multi_drop: multiDropMode === 'MULTI_POINTS'
    });
    message.success(`Đã giao xe & tạo chuyến ${generatedTripId} thành công!`);
  };

  // Xác nhận chuyển xe ngoài (12)
  const handleAssignVendor = () => {
    if (!vendorTrackingCode.trim()) {
      message.error('Vui lòng nhập Mã vận đơn nhà xe đối tác!');
      return;
    }

    onAssignSuccess?.({
      ...order,
      status: 'HANDED_OVER_VENDOR',
      allocationType: 'VENDOR',
      vendor: selectedVendor,
      vendor_tracking_code: vendorTrackingCode.trim(),
      waybill_no: vendorTrackingCode.trim()
    });
    message.success(`Đã chuyển đơn sang nhà xe đối tác ${selectedVendor} với mã vận đơn ${vendorTrackingCode}!`);
  };

  // Lưu thay đổi (16) khi có sự cố
  const handleSaveChange = () => {
    if (!changeReason.trim()) {
      message.error('Vui lòng nhập lý do thay đổi xe / tài xế!');
      return;
    }
    onAssignSuccess?.({
      ...order,
      status: 'ASSIGNED',
      truck: selectedTruckPlate,
      driver1: selectedDriver1,
      change_reason: changeReason
    });
    message.success('Đã lưu thay đổi phương tiện và tái cấp vận đơn mới thành công!');
  };

  return (
    <>
      <Modal
        open={open}
        onCancel={onCancel}
        footer={null}
        width={1140}
        centered
        closable={false}
        styles={{ body: { padding: '0px' } }}
        className="trip-assignment-modal"
      >
        <div className="bg-white rounded-lg overflow-hidden border border-gray-300 font-sans text-gray-800">
          
          {/* Header Title theo thiết kế Prototype */}
          <div className="p-4 sm:p-5 border-b border-gray-200 flex items-center justify-between bg-white">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
              Chọn xe &amp; tài xế – Đơn {orderCode}
            </h2>
            <Button 
              onClick={onCancel}
              className="px-5 h-8 font-medium text-gray-600 border-gray-300 hover:border-gray-500 rounded text-xs"
            >
              Đóng
            </Button>
          </div>

          <div className="p-4 sm:p-6 space-y-4 max-h-[85vh] overflow-y-auto">
            
            {/* (1) Thông tin chuyến (Trip summary) */}
            <div className="p-3 bg-white border border-gray-300 rounded text-xs text-gray-800 leading-relaxed">
              Đơn: <b>{orderCode}</b> · HAWB <b>{hawbCode}</b> · {customerName} · {stopsCount} điểm dừng · KL tính cước <b>{chargeableWeight.toLocaleString()} kg</b> · Thể tích <b>{cargoVolume} m³</b><br />
              Trạng thái: <b>Sẵn sàng điều xe</b> · Xuất phát dự kiến: <b>{plannedStart}</b> · Quãng đường <b>{routeSummary.distanceKm} km</b> · Thời gian chuyến <b>{Math.floor(routeSummary.durationMins / 60)}h{routeSummary.durationMins % 60}ph</b>
            </div>

            {/* (2) Phương thức vận chuyển (Toggle) */}
            <div className="flex items-center gap-4 text-xs">
              <span className="font-semibold text-gray-700">Phương thức vận chuyển *</span>
              <div className="inline-flex rounded border border-gray-300 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setTransportMode('INTERNAL')}
                  className={`px-4 py-1.5 text-xs font-semibold transition ${
                    transportMode === 'INTERNAL'
                      ? 'bg-blue-900 text-white font-bold'
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Đội xe nội bộ
                </button>
                <button
                  type="button"
                  onClick={() => setTransportMode('VENDOR')}
                  className={`px-4 py-1.5 text-xs font-semibold border-l border-gray-300 transition ${
                    transportMode === 'VENDOR'
                      ? 'bg-blue-900 text-white font-bold'
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Nhà xe đối tác
                </button>
              </div>
            </div>

            {/* NỘI DUNG KHI CHỌN ĐỘI XE NỘI BỘ */}
            {transportMode === 'INTERNAL' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                
                {/* Cột trái: Cấu hình phân xe, tài xế, thứ tự điểm dừng */}
                <div className="lg:col-span-7 space-y-3.5">
                  
                  {/* (3) Ghép chuyến nhiều điểm trả theo yêu cầu của khách */}
                  <div className="p-3 bg-white border border-gray-300 rounded text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-gray-700">
                        Ghép chuyến theo yêu cầu của khách: <span className="text-gray-500 font-normal">Giao nhiều điểm trả trên cùng cung đường</span>
                      </span>
                      <Tag color={multiDropMode === 'MULTI_POINTS' ? 'blue' : 'default'} className="m-0 text-[10px]">
                        {multiDropMode === 'MULTI_POINTS' ? 'Nhiều điểm trả' : '1 điểm trả'}
                      </Tag>
                    </div>
                    
                    <Radio.Group 
                      value={multiDropMode} 
                      onChange={e => setMultiDropMode(e.target.value)}
                      className="space-y-1.5 block"
                    >
                      <Radio value="MULTI_POINTS" className="text-xs text-gray-700 block">
                        <b>Ghép chuyến nhiều điểm trả theo yêu cầu:</b> Đơn hàng của khách được trả tại nhiều điểm nhận khác nhau trên cùng tuyến đường
                      </Radio>
                      <Radio value="STANDALONE" className="text-xs text-gray-700 block">
                        <b>Chuyến thẳng 1 điểm trả:</b> Xe chỉ trả toàn bộ hàng tại một kho duy nhất, không ghép điểm khác
                      </Radio>
                    </Radio.Group>
                  </div>

                  {/* (4) & (5) Chọn Xe và Số tài xế */}
                  <div className="grid grid-cols-12 gap-3 items-end">
                    <div className="col-span-8 space-y-1">
                      <label className="text-xs font-semibold text-gray-700 block">
                        Xe (tỉnh, độ dài, cảng kèm còn hạn) *
                      </label>
                      <Select
                        className="w-full text-xs"
                        value={selectedTruckPlate}
                        onChange={setSelectedTruckPlate}
                      >
                        <Option value="29H-995.72 - 3.500 kg - Sẵn sàng">
                          29H-995.72 · 3.500 kg · Sẵn sàng
                        </Option>
                        <Option value="29C-456.78 - 2.500 kg - Sẵn sàng">
                          29C-456.78 · 2.500 kg · Sẵn sàng
                        </Option>
                        <Option value="29H-767.99 - 5.000 kg - Sẵn sàng">
                          29H-767.99 · 5.000 kg · Sẵn sàng
                        </Option>
                        {trucks.map(t => (
                          <Option key={t.plate} value={`${t.plate} - ${t.payload_kg} kg - ${t.status}`}>
                            {t.plate} · {t.payload_kg} kg · {t.status}
                          </Option>
                        ))}
                      </Select>
                    </div>

                    <div className="col-span-4 space-y-1">
                      <label className="text-xs font-semibold text-gray-700 block">
                        Số tài xế *
                      </label>
                      <div className="inline-flex rounded border border-gray-300 overflow-hidden w-full">
                        <button
                          type="button"
                          onClick={() => setDriverCount(1)}
                          className={`flex-1 py-1 text-xs font-semibold transition ${
                            driverCount === 1 
                              ? 'bg-blue-100 text-blue-900 border-r border-blue-200' 
                              : 'bg-white text-gray-700 hover:bg-gray-50 border-r border-gray-300'
                          }`}
                        >
                          1 tài xế
                        </button>
                        <button
                          type="button"
                          onClick={() => setDriverCount(2)}
                          className={`flex-1 py-1 text-xs font-semibold transition ${
                            driverCount === 2 
                              ? 'bg-blue-100 text-blue-900' 
                              : 'bg-white text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          2 tài xế
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Banner Cảnh báo thời gian chuyến > 8 giờ */}
                  <div className="p-2.5 bg-amber-50 border border-amber-300 rounded text-[11px] text-amber-900 flex items-center gap-1.5">
                    <AlertTriangle size={14} className="text-amber-600 shrink-0" />
                    <span>
                      Chỉ còn đủ thời gian chuyến &gt; 8 giờ: <b>Thời gian chạy dự kiến 8,5 giờ – đề xuất 2 tài xế (MSG62)</b>
                    </span>
                  </div>

                  {/* (6) Tài xế 1 & Tài xế 2 */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-gray-700 block">
                        Tài xế 1 *
                      </label>
                      <Select
                        className="w-full text-xs"
                        value={selectedDriver1}
                        onChange={setSelectedDriver1}
                      >
                        <Option value="Hồ Chí Học - Đã lái 4,5h">Hồ Chí Học · Đã lái 4,5h</Option>
                        <Option value="Nguyễn Văn A - Đã lái 2,0h">Nguyễn Văn A · Đã lái 2,0h</Option>
                        <Option value="Trần Sức Hải - Đã lái 1,0h">Trần Sức Hải · Đã lái 1,0h</Option>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-gray-700 block">
                        Tài xế 2 {driverCount === 2 ? '*' : '(chỉ khi chọn 2 tài xế)'}
                      </label>
                      <Select
                        className="w-full text-xs"
                        disabled={driverCount !== 2}
                        placeholder="-- Chọn tài xế 2 --"
                        value={selectedDriver2}
                        onChange={setSelectedDriver2}
                      >
                        <Option value="Trần Sức Hải - Đã lái 1,0h">Trần Sức Hải · Đã lái 1,0h</Option>
                        <Option value="Lê Văn Hùng - Đã lái 3,0h">Lê Văn Hùng · Đã lái 3,0h</Option>
                      </Select>
                    </div>
                  </div>

                  {/* (7) Thứ tự điểm dừng */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-gray-700">
                        Thứ tự điểm dừng <span className="text-gray-400 font-normal">Kéo ≡ để đổi thứ tự · Xếp dỡ trước/sau</span>
                      </span>
                      {multiDropMode === 'MULTI_POINTS' && (
                        <Button 
                          size="small" 
                          icon={<Plus size={11} />} 
                          onClick={handleAddDropoff}
                          className="text-[11px] h-6 px-2 text-indigo-700 bg-indigo-50 border-indigo-200 hover:bg-indigo-100"
                        >
                          Thêm điểm trả hàng
                        </Button>
                      )}
                    </div>

                    <div className="space-y-1.5 border border-gray-300 rounded p-2 bg-gray-50/50">
                      {stops.map((stop, index) => (
                        <div
                          key={stop.id}
                          className="flex items-center justify-between p-2 bg-white border border-gray-200 rounded text-xs shadow-2xs hover:border-gray-400 transition"
                        >
                          <div className="flex items-center gap-2">
                            <GripVertical size={14} className="text-gray-400 cursor-grab" />
                            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                              stop.type === 'START' ? 'bg-gray-200 text-gray-700' :
                              stop.type === 'REST' ? 'bg-amber-100 text-amber-800' :
                              'bg-emerald-600 text-white'
                            }`}>
                              {stop.badge}
                            </span>
                            <span className="font-medium text-gray-800">{stop.name}</span>
                            <span className="text-gray-500 text-[11px]">· {stop.action}</span>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <span className="text-gray-500 font-mono text-[11px]">{stop.eta}</span>
                            {stop.type !== 'START' && stop.type !== 'PICKUP' && stops.length > 3 && (
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
                      ))}
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
                        Tổng: <b>{routeSummary.distanceKm} km</b> · <b>chuyến {Math.floor(routeSummary.durationMins / 60)}h{routeSummary.durationMins % 60}ph</b>
                      </span>
                    </div>
                  </div>

                </div>

                {/* Cột phải: (8) Bản đồ tuyến TÍCH HỢP ROUTING API THỰC TẾ */}
                <div className="lg:col-span-5 flex flex-col justify-between">
                  <div className="border border-gray-300 rounded overflow-hidden h-full flex flex-col bg-white">
                    <div className="p-2 border-b border-gray-200 bg-gray-50 text-xs font-semibold text-gray-700 flex items-center justify-between">
                      <span>Bản đồ tuyến (Routing API thực tế)</span>
                      <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-mono font-medium">
                        Live OSRM / Google Map
                      </span>
                    </div>

                    {/* Vùng bản đồ tương tác với Leaflet và Google Maps Tiles */}
                    <div className="flex-1 min-h-[340px] relative">
                      <TripAssignmentMap stops={stops} routePolyline={routePolyline} />
                    </div>

                    {/* Thanh tóm tắt chân bản đồ (8) */}
                    <div className="p-2 bg-white border-t border-gray-200 text-[11px] text-gray-700 font-mono flex items-center justify-between">
                      <span>{stops.map(s => s.badge).join(' · ')}</span>
                      <span>{routeSummary.distanceKm} km · {Math.floor(routeSummary.durationMins / 60)}h{routeSummary.durationMins % 60}ph</span>
                      <span>{selectedTruckPlate.split(' - ')[0]}</span>
                    </div>
                  </div>
                </div>

              </div>
            )}

            {/* NỘI DUNG KHI CHỌN NHÀ XE ĐỐI TÁC (10, 11, 12) */}
            {transportMode === 'VENDOR' && (
              <div className="p-4 bg-gray-50 border border-gray-300 rounded space-y-3">
                <div className="font-semibold text-xs text-gray-700">
                  Khi chọn &quot;Nhà xe đối tác&quot; <span className="text-gray-400 font-normal">(xe nội bộ, tài xế, điểm dừng chỉ cho đơn Sẵn sàng điều xe)</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                  <div className="sm:col-span-5 space-y-1">
                    <label className="text-xs font-semibold text-gray-700 block">Nhà xe đối tác *</label>
                    <Select
                      className="w-full text-xs"
                      value={selectedVendor}
                      onChange={setSelectedVendor}
                    >
                      <Option value="Vận tải Hải Long">Vận tải Hải Long</Option>
                      <Option value="Vận tải Á Châu">Vận tải Á Châu</Option>
                      <Option value="Logistics Hưng Phát">Logistics Hưng Phát</Option>
                      {vendors.map(v => (
                        <Option key={v.id} value={v.name}>{v.name}</Option>
                      ))}
                    </Select>
                  </div>

                  <div className="sm:col-span-4 space-y-1">
                    <label className="text-xs font-semibold text-gray-700 block">Mã vận đơn nhà xe *</label>
                    <Input
                      className="text-xs font-mono font-semibold"
                      value={vendorTrackingCode}
                      onChange={e => setVendorTrackingCode(e.target.value)}
                      placeholder="VT-485214"
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <Button
                      type="primary"
                      onClick={handleAssignVendor}
                      className="w-full bg-blue-900 hover:bg-blue-800 text-white font-semibold text-xs h-8 rounded"
                    >
                      Chuyển xe ngoài
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* KHUNG THAY ĐỔI SỰ CỐ (15, 16) */}
            <div className="p-3.5 bg-gray-50 border border-gray-300 rounded space-y-2">
              <div className="font-semibold text-xs text-gray-700">
                Khi mở từ sự cố (Điều xe thay thế): <span className="text-gray-400 font-normal">đổi xe hoặc tài xế của chuyến đã tạo</span>
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <div className="flex-1 space-y-1">
                  <label className="text-[11px] text-gray-500 block">Lý do thay đổi * (tối đa 255 ký tự)</label>
                  <Input
                    className="text-xs"
                    value={changeReason}
                    onChange={e => setChangeReason(e.target.value)}
                    placeholder="Tài xế Hồ Chí Học báo ốm, đổi sang Tài xế Sức Hải"
                  />
                </div>
                <div className="pt-4 sm:pt-4">
                  <Button
                    type="primary"
                    onClick={handleSaveChange}
                    className="bg-blue-900 hover:bg-blue-800 text-white font-semibold text-xs h-8 px-6 rounded"
                  >
                    Lưu thay đổi
                  </Button>
                </div>
              </div>
            </div>

            {/* FOOTER ACTIONS CHUẨN SRS: (9) XEM XẾP HÀNG 3D, (14) CHỨNG TỪ CHUYẾN, (13) GIAO XE & TẠO CHUYẾN */}
            <div className="pt-3 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-4">
                {/* (9) Xem xếp hàng 3D */}
                <Button
                  onClick={() => setIs3DOpen(true)}
                  className="font-semibold text-xs text-gray-800 border-gray-400 hover:border-gray-600 rounded h-9 px-4"
                >
                  Xem xếp hàng 3D
                </Button>

                {/* (14) Chứng từ chuyến (sau khi tạo chuyến) */}
                <a 
                  href="#waybill" 
                  onClick={(e) => {
                    e.preventDefault();
                    message.info('Chứng từ chuyến (Giấy vận tải & Hồ sơ khách) sẽ sẵn sàng sau khi chuyến được khởi tạo!');
                  }}
                  className="text-xs text-blue-700 hover:underline flex items-center gap-1"
                >
                  <ExternalLink size={13} />
                  Chứng từ chuyến <span className="text-gray-400">(sau khi tạo chuyến)</span>
                </a>
              </div>

              {/* (13) Giao xe & tạo chuyến */}
              {transportMode === 'INTERNAL' && (
                <div className="flex flex-col items-end">
                  <Button
                    type="primary"
                    onClick={handleAssignInternal}
                    className="bg-blue-900 hover:bg-blue-800 text-white font-bold text-xs h-9 px-8 rounded shadow-sm"
                  >
                    Giao xe &amp; tạo chuyến
                  </Button>
                  <span className="text-[10px] text-gray-400 mt-0.5">Tạo chuyến, lưu vận tải và gửi chuyến cho tài xế</span>
                </div>
              )}
            </div>

          </div>

        </div>
      </Modal>

      {/* Modal Xếp hàng 3D Figure 25 */}
      <LoadPlan3DModal
        open={is3DOpen}
        trip={{
          trip_code: 'TR261026-009',
          plate: selectedTruckPlate?.split(' - ')[0] || '29C-456.78',
          truck_model: 'Hyundai 2.5 t',
          box_dim: 'Thùng 4,2 × 1,9 × 1,9 m',
          max_payload: 2500,
          total_weight: chargeableWeight || 1450,
          orders_count: 6,
          stops_count: stops.filter(s => s.type === 'DROPOFF').length,
          total_volume: cargoVolume || 5.6,
          max_volume: 15.2
        }}
        onClose={() => setIs3DOpen(false)}
      />
    </>
  );
}