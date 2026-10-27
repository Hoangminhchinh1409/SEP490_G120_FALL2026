import React, { useState, useEffect, useMemo } from 'react';
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
  Trash2,
  ArrowUp,
  ArrowDown,
  Sparkles
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { dispatcherApi } from '../../api/dispatcherApi';
import {
  getCoordsFromAddress,
  getVehicleSpecByKey,
  analyzeVehicleRecommendation
} from '../../data/dispatcherPresets';
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

// Danh mục đội xe nội bộ chuẩn gắn với thông số thùng xe
const INTERNAL_FLEET_OPTIONS = [
  {
    value: '29A-112.34 - 1.250 kg - Sẵn sàng',
    plate: '29A-112.34',
    specKey: '1.25T',
    label: '29A-112.34 · Xe 1.25 tấn (3,2×1,65×1,7m) · 1.250 kg · Sẵn sàng'
  },
  {
    value: '29C-456.78 - 2.500 kg - Sẵn sàng',
    plate: '29C-456.78',
    specKey: '2.5T',
    label: '29C-456.78 · Xe 2.5 tấn (4,2×1,9×1,9m) · 2.500 kg · Sẵn sàng'
  },
  {
    value: '29H-995.72 - 3.500 kg - Sẵn sàng',
    plate: '29H-995.72',
    specKey: '3.5T',
    label: '29H-995.72 · Xe 3.5 tấn (5,0×2,05×2,05m) · 3.500 kg · Sẵn sàng'
  },
  {
    value: '29H-767.99 - 5.000 kg - Sẵn sàng',
    plate: '29H-767.99',
    specKey: '5T',
    label: '29H-767.99 · Xe 5 tấn (6,2×2,2×2,2m) · 5.000 kg · Sẵn sàng'
  },
  {
    value: '29H-888.68 - 8.000 kg - Sẵn sàng',
    plate: '29H-888.68',
    specKey: '8T',
    label: '29H-888.68 · Xe 8 tấn (7,8×2,35×2,4m) · 8.000 kg · Sẵn sàng'
  },
  {
    value: '29R-150.99 - 15.000 kg - Sẵn sàng',
    plate: '29R-150.99',
    specKey: '15T',
    label: '29R-150.99 · Xe 15 tấn / Cont (9,6×2,4×2,5m) · 15.000 kg · Sẵn sàng'
  }
];

function haversineKm(a, b) {
  if (!a?.lat || !a?.lng || !b?.lat || !b?.lng) return 0;
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s1 =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(s1), Math.sqrt(1 - s1));
  return R * c;
}

function formatTimeFromMinutes(baseHours, baseMinutes, addMinutes) {
  const totalMins = baseHours * 60 + baseMinutes + Math.round(addMinutes);
  const hh = String(Math.floor((totalMins / 60) % 24)).padStart(2, '0');
  const mm = String(totalMins % 60).padStart(2, '0');
  return `dự kiến ${hh}:${mm}`;
}

// Hàm chuẩn hóa lại badge thứ tự và nhãn Điểm trả 1, 2... + tính lại ETA
function normalizeStopsAndEta(rawStops, legMinutes = []) {
  let numBadge = 1;
  let dropCount = 0;
  let elapsedMinutes = 0;

  return rawStops.map((stop, idx) => {
    if (idx > 0) {
      const driveMins = legMinutes[idx - 1] ?? 25;
      elapsedMinutes += driveMins;
    }

    const eta = formatTimeFromMinutes(7, 0, elapsedMinutes);
    const serviceMins = parseInt(stop.duration) || (stop.type === 'START' ? 0 : stop.type === 'REST' ? 15 : 25);
    elapsedMinutes += serviceMins;

    if (stop.type === 'START') {
      return { ...stop, badge: 'S', eta: 'dự kiến 07:00' };
    }
    if (stop.type === 'REST') {
      return { ...stop, badge: 'Nghỉ', eta };
    }

    const currentBadge = String(numBadge++);
    if (stop.type === 'PICKUP') {
      return {
        ...stop,
        badge: currentBadge,
        eta
      };
    }

    if (stop.type === 'DROPOFF') {
      dropCount += 1;
      const cleanAddress = (stop.rawAddress || stop.name || '')
        .replace(/^Điểm trả(\s+\d+)?:?\s*/i, '')
        .trim();
      return {
        ...stop,
        badge: currentBadge,
        rawAddress: cleanAddress,
        name: `Điểm trả ${dropCount}: ${cleanAddress}`,
        eta
      };
    }

    return { ...stop, badge: currentBadge, eta };
  });
}

export default function TripAssignmentModal({
  open,
  order,
  incidentContext = null,
  onCancel,
  onAssignSuccess
}) {
  // (2) Phương thức vận chuyển
  const [transportMode, setTransportMode] = useState('INTERNAL');

  // (3) Mặc định luôn để Chuyến thẳng 1 điểm trả (STANDALONE) trừ khi khách yêu cầu nhiều điểm trả
  const [multiDropMode, setMultiDropMode] = useState('STANDALONE');

  // (4) Xe tải
  const [trucks, setTrucks] = useState([]);
  const [selectedTruckPlate, setSelectedTruckPlate] = useState('29H-995.72 - 3.500 kg - Sẵn sàng');

  // (5) Số tài xế: 1 hoặc 2
  const [driverCount, setDriverCount] = useState(1);

  // (6) Tài xế 1 & Tài xế 2
  const [drivers, setDrivers] = useState([]);
  const [selectedDriver1, setSelectedDriver1] = useState('Hồ Chí Học - Đã lái 4,5h');
  const [selectedDriver2, setSelectedDriver2] = useState('');

  // (7) Thứ tự điểm dừng & Tọa độ thực tế
  const [stops, setStops] = useState([]);
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  // Ô nhập thêm điểm trả hàng tùy chỉnh khi ở chế độ nhiều điểm trả
  const [newDropoffAddress, setNewDropoffAddress] = useState('');
  const [showAddDropoffInput, setShowAddDropoffInput] = useState(false);

  // (8) Routing Polyline & Thông tin lộ trình tính từ API
  const [routePolyline, setRoutePolyline] = useState([]);
  const [routeSummary, setRouteSummary] = useState({ distanceKm: 0, durationMins: 0 });

  // (10, 11) Nhà xe đối tác
  const [vendors, setVendors] = useState([]);
  const [selectedVendor, setSelectedVendor] = useState('Vận tải Hải Long');
  const [vendorTrackingCode, setVendorTrackingCode] = useState('VT-485214');

  // (15) Lý do thay đổi (khi có incidentContext)
  const [changeReason, setChangeReason] = useState('Tài xế Hồ Chí Học báo ốm, đổi sang Tài xế Sức Hải');

  // Modal 3D Load Plan
  const [is3DOpen, setIs3DOpen] = useState(false);

  // Phân tích xe gợi ý & xe đã chốt với khách
  const vehicleAnalysis = useMemo(() => {
    if (!order) return null;
    return analyzeVehicleRecommendation({
      actualWeightKg: order.weight || order.actual_weight_kg || 0,
      chargeableWeightKg: order.chargeable || order.chargeable_weight_kg || 0,
      lengthCm: order.length_cm || 0,
      widthCm: order.width_cm || 0,
      heightCm: order.height_cm || 0,
      packageCount: order.package_count || 1,
      customerRequestedVehicle: order.customer_requested_vehicle || order.vehicle_type_required || '2.5T',
      items: order.items || []
    });
  }, [order]);

  // Khởi tạo đúng lộ trình đơn hàng (1 điểm lấy, 1 điểm trả) và phương án xe đã chốt khi mở Modal
  useEffect(() => {
    if (!open || !order) return;

    const pickupAddr =
      order.pickup_address ||
      order.pickup ||
      'Sân bay Quốc tế Nội Bài, Sóc Sơn, Hà Nội';
    const deliveryAddr =
      order.delivery_address ||
      order.dropoff ||
      'Khu công nghiệp Nguyễn Đức Cảnh, Phường Trần Hưng Đạo, Tỉnh Hưng Yên, Việt Nam';

    const pickupCoords =
      order.pickup_coords?.lat && order.pickup_coords?.lng
        ? order.pickup_coords
        : getCoordsFromAddress(pickupAddr, 'PICKUP');
    const deliveryCoords =
      order.delivery_coords?.lat && order.delivery_coords?.lng
        ? order.delivery_coords
        : getCoordsFromAddress(deliveryAddr, 'DELIVERY');

    // Chọn bãi xuất phát gần điểm lấy hàng nhất
    const isNearNoiBai = pickupAddr.toLowerCase().includes('nội bài') || pickupCoords.lat > 21.15;
    const depotStop = isNearNoiBai
      ? {
          id: 'S',
          type: 'START',
          badge: 'S',
          name: 'Xuất phát: Bãi xe ALS – Nội Bài',
          action: 'Xuất phát',
          eta: 'dự kiến 07:00',
          duration: '0 phút',
          lat: 21.2145,
          lng: 105.7985
        }
      : {
          id: 'S',
          type: 'START',
          badge: 'S',
          name: 'Xuất phát: Bãi xe ALS – Long Biên',
          action: 'Xuất phát',
          eta: 'dự kiến 07:00',
          duration: '0 phút',
          lat: 21.0375,
          lng: 105.8942
        };

    const initialStops = normalizeStopsAndEta([
      depotStop,
      {
        id: 'PICKUP-1',
        type: 'PICKUP',
        badge: '1',
        name: `Lấy hàng: ${pickupAddr}`,
        rawAddress: pickupAddr,
        action: 'bốc 30 phút',
        eta: 'dự kiến 07:20',
        duration: '30 phút',
        lat: pickupCoords.lat,
        lng: pickupCoords.lng
      },
      {
        id: 'DROP-1',
        type: 'DROPOFF',
        badge: '2',
        rawAddress: deliveryAddr,
        name: `Điểm trả 1: ${deliveryAddr}`,
        action: 'dỡ 30 phút',
        eta: 'dự kiến 09:00',
        duration: '30 phút',
        lat: deliveryCoords.lat,
        lng: deliveryCoords.lng
      }
    ]);

    setStops(initialStops);
    setMultiDropMode('STANDALONE');
    setShowAddDropoffInput(false);
    setNewDropoffAddress('');

    // Chọn xe mặc định theo phương án xe đã chốt với khách hoặc hệ thống khuyến nghị
    const targetSpecKey =
      order.agreed_vehicle_type ||
      order.proposed_vehicle_type ||
      vehicleAnalysis?.recommendedVehicle?.key ||
      getVehicleSpecByKey(order.vehicle_type_required)?.key ||
      '3.5T';

    const matchedFleet =
      INTERNAL_FLEET_OPTIONS.find(f => f.specKey === targetSpecKey) ||
      INTERNAL_FLEET_OPTIONS[2];
    setSelectedTruckPlate(matchedFleet.value);
  }, [open, order, vehicleAnalysis]);

  useEffect(() => {
    if (!open) return;

    let isMounted = true;
    Promise.all([
      dispatcherApi.getTrucks(),
      dispatcherApi.getDrivers(),
      dispatcherApi.getVendors()
    ])
      .then(([trucksData, driversData, vendorsData]) => {
        if (!isMounted) return;
        setTrucks(trucksData || []);
        setDrivers(driversData || []);
        setVendors(vendorsData || []);
        if (vendorsData?.length > 0 && !selectedVendor) {
          setSelectedVendor(vendorsData[0].name || vendorsData[0].id);
        }
      })
      .catch(err => {
        console.warn('Load assignment data error:', err);
      });

    return () => {
      isMounted = false;
    };
  }, [open, selectedVendor]);

  // Chuyển đổi chế độ Chuyến thẳng 1 điểm trả vs Ghép nhiều điểm trả
  const handleChangeMultiDropMode = (mode) => {
    setMultiDropMode(mode);
    if (mode === 'STANDALONE') {
      // Giữ lại duy nhất điểm trả đầu tiên của đơn hàng
      let keptFirstDrop = false;
      const filtered = stops.filter(s => {
        if (s.type !== 'DROPOFF') return true;
        if (!keptFirstDrop) {
          keptFirstDrop = true;
          return true;
        }
        return false;
      });
      setStops(normalizeStopsAndEta(filtered));
      setShowAddDropoffInput(false);
    }
  };

  // TÍCH HỢP ROUTING API THỰC TẾ QUA BACKEND PROXY (HOẶC OSRM FALLBACK)
  // Chạy mỗi khi thứ tự stops thay đổi
  const stopsCoordSignature = useMemo(
    () => stops.map(s => `${s.id}:${s.lat},${s.lng}`).join('|'),
    [stops]
  );

  useEffect(() => {
    if (!open) return;
    const validPoints = stops.filter(s => s.lat && s.lng);
    if (validPoints.length < 2) return;

    let isMounted = true;
    const fetchFullRoute = async () => {
      try {
        let combinedPolyline = [];
        let totalDist = 0;
        let totalDriveMins = 0;
        const legMins = [];

        for (let i = 0; i < validPoints.length - 1; i++) {
          const p1 = validPoints[i];
          const p2 = validPoints[i + 1];

          let legFound = false;

          // 1. Thử gọi backend proxy
          try {
            const beUrl = `http://localhost:9999/api/routing/road-route?startLng=${p1.lng}&startLat=${p1.lat}&endLng=${p2.lng}&endLat=${p2.lat}`;
            const res = await fetch(beUrl);
            if (res.ok) {
              const data = await res.json();
              if (data?.success && Array.isArray(data.polyline)) {
                combinedPolyline = combinedPolyline.concat(data.polyline);
                const dKm = data.distanceKm || 0;
                const dMins = data.durationMins || Math.max(10, Math.round(dKm * 1.4));
                totalDist += dKm;
                totalDriveMins += dMins;
                legMins.push(dMins);
                legFound = true;
              }
            }
          } catch (e) {
            // fallback OSRM direct
          }

          if (!legFound) {
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
                  const dKm = parseFloat((r.distance / 1000).toFixed(1));
                  const dMins = Math.max(5, Math.round(r.duration / 60));
                  totalDist += dKm;
                  totalDriveMins += dMins;
                  legMins.push(dMins);
                  legFound = true;
                }
              }
            } catch (e) {
              // fallback haversine
            }
          }

          if (!legFound) {
            combinedPolyline.push([p1.lat, p1.lng], [p2.lat, p2.lng]);
            const approxKm = parseFloat((haversineKm(p1, p2) * 1.25).toFixed(1));
            const approxMins = Math.max(10, Math.round(approxKm * 1.4));
            totalDist += approxKm;
            totalDriveMins += approxMins;
            legMins.push(approxMins);
          }
        }

        // Cộng thêm thời gian bốc/dỡ/nghỉ tại các điểm dừng
        const serviceMins = stops.reduce(
          (sum, s) => sum + (parseInt(s.duration) || 0),
          0
        );

        if (isMounted) {
          setRoutePolyline(combinedPolyline);
          setRouteSummary({
            distanceKm: parseFloat(totalDist.toFixed(1)),
            durationMins: totalDriveMins + serviceMins
          });
          setStops(prev => normalizeStopsAndEta(prev, legMins));
        }
      } catch (err) {
        console.warn('Trip routing error:', err);
      }
    };

    fetchFullRoute();
    return () => { isMounted = false; };
  }, [open, stopsCoordSignature]);

  if (!order) return null;

  // Thông số thùng xe của chiếc xe đang được chọn
  const currentFleetItem =
    INTERNAL_FLEET_OPTIONS.find(f => f.value === selectedTruckPlate) ||
    INTERNAL_FLEET_OPTIONS.find(f => selectedTruckPlate?.includes(f.plate)) ||
    INTERNAL_FLEET_OPTIONS[2];
  const selectedTruckSpec = getVehicleSpecByKey(currentFleetItem.specKey);

  // Tính toán thông tin hiển thị (1)
  const orderCode = order.order_id || order.id || 'NEX-140280';
  const hawbCode = order.hawb || order.hawb_code || orderCode;
  const customerName = order.customer || order.customer_name || 'Khách hàng';
  const stopsCount = stops.filter(s => s.type === 'DROPOFF' || s.type === 'PICKUP').length;
  const actualWeight = Number(order.weight || order.actual_weight_kg || 0);
  const chargeableWeight = Number(order.chargeable || order.chargeable_weight_kg || actualWeight || 2000);
  const cargoVolume =
    vehicleAnalysis?.totalVolumeM3 ||
    Number(
      (((order.length_cm || 100) * (order.width_cm || 100) * (order.height_cm || 100)) / 1000000).toFixed(2)
    );
  const plannedStart = order.planned_start || '28/10/2026 07:00';
  const totalTripHours = Number((routeSummary.durationMins / 60).toFixed(1));

  // Kiểm tra tính hợp lệ của thứ tự điểm dừng (BR-43 / MSG40)
  const validateStopOrder = (candidateStops) => {
    if (candidateStops[0]?.type !== 'START') {
      message.warning('Điểm Xuất phát (S) phải luôn nằm ở vị trí đầu tiên của chuyến xe!');
      return false;
    }
    const pickupIndex = candidateStops.findIndex(s => s.type === 'PICKUP');
    const firstDropoffIndex = candidateStops.findIndex(s => s.type === 'DROPOFF');
    if (pickupIndex !== -1 && firstDropoffIndex !== -1 && firstDropoffIndex < pickupIndex) {
      message.error('Không thể xếp điểm trả hàng trước điểm lấy hàng (MSG40 - BR-43)!');
      return false;
    }
    return true;
  };

  // Di chuyển điểm dừng từ fromIdx sang toIdx (Kéo thả hoặc nút Lên/Xuống)
  const moveStop = (fromIdx, toIdx) => {
    if (fromIdx === toIdx || fromIdx < 0 || toIdx < 0 || fromIdx >= stops.length || toIdx >= stops.length) {
      return;
    }
    const updated = [...stops];
    const [moved] = updated.splice(fromIdx, 1);
    updated.splice(toIdx, 0, moved);

    if (!validateStopOrder(updated)) return;

    setStops(normalizeStopsAndEta(updated));
    message.success('Đã cập nhật thứ tự điểm dừng & tính lại lộ trình!');
  };

  // Tối ưu thứ tự điểm dừng theo tuyến đường ngắn nhất (Nearest-Neighbor từ điểm lấy hàng)
  const handleOptimizeShortestRoute = () => {
    const startStop = stops.find(s => s.type === 'START');
    const pickupStops = stops.filter(s => s.type === 'PICKUP');
    const restStops = stops.filter(s => s.type === 'REST');
    const remainingDropoffs = [...stops.filter(s => s.type === 'DROPOFF')];

    if (remainingDropoffs.length <= 1) {
      message.info('Tuyến đường thẳng 1 điểm trả hiện đã là lộ trình ngắn nhất theo OSRM!');
      return;
    }

    const orderedDropoffs = [];
    let currentPos = pickupStops[pickupStops.length - 1] || startStop;

    while (remainingDropoffs.length > 0) {
      let bestIdx = 0;
      let bestDist = Infinity;
      remainingDropoffs.forEach((cand, idx) => {
        const d = haversineKm(currentPos, cand);
        if (d < bestDist) {
          bestDist = d;
          bestIdx = idx;
        }
      });
      const [nextStop] = remainingDropoffs.splice(bestIdx, 1);
      orderedDropoffs.push(nextStop);
      currentPos = nextStop;
    }

    const combined = [
      ...(startStop ? [startStop] : []),
      ...pickupStops,
      ...restStops,
      ...orderedDropoffs
    ];

    setStops(normalizeStopsAndEta(combined));
    message.success('Đã sắp xếp tối ưu thứ tự các điểm trả theo lộ trình ngắn nhất!');
  };

  // Thêm điểm nghỉ mới vào (7)
  const handleAddBreak = () => {
    const pickupStop = stops.find(s => s.type === 'PICKUP') || stops[0];
    const lastDrop = stops[stops.length - 1] || pickupStop;
    const midLat = Number(((pickupStop.lat + lastDrop.lat) / 2).toFixed(5));
    const midLng = Number(((pickupStop.lng + lastDrop.lng) / 2).toFixed(5));

    const newBreak = {
      id: `REST-${Date.now()}`,
      type: 'REST',
      badge: 'Nghỉ',
      name: 'Nghỉ 15 phút (Trạm dừng nghỉ trên tuyến)',
      action: 'Nghỉ giải lao',
      eta: 'dự kiến +15 phút',
      duration: '15 phút',
      lat: midLat,
      lng: midLng
    };
    const updated = [...stops];
    updated.splice(Math.max(2, updated.length - 1), 0, newBreak);
    setStops(normalizeStopsAndEta(updated));
    message.success('Đã bổ sung điểm dừng nghỉ trên tuyến!');
  };

  // Thêm điểm trả hàng trên cùng tuyến (khi khách yêu cầu giao nhiều điểm)
  const handleConfirmAddDropoff = (customAddr) => {
    const addressText = (customAddr || newDropoffAddress || '').trim();
    if (!addressText) {
      message.warning('Vui lòng nhập hoặc chọn địa chỉ điểm trả hàng bổ sung!');
      return;
    }
    const coords = getCoordsFromAddress(addressText, 'DELIVERY');
    const nextIdx = stops.filter(s => s.type === 'DROPOFF').length + 1;
    const newDropoff = {
      id: `DROP-${Date.now()}`,
      type: 'DROPOFF',
      badge: `${nextIdx + 1}`,
      rawAddress: addressText,
      name: `Điểm trả ${nextIdx}: ${addressText}`,
      action: 'dỡ 25 phút',
      eta: 'dự kiến linh hoạt',
      duration: '25 phút',
      lat: coords.lat,
      lng: coords.lng
    };
    const updated = normalizeStopsAndEta([...stops, newDropoff]);
    setStops(updated);
    setNewDropoffAddress('');
    setShowAddDropoffInput(false);
    message.success(`Đã thêm Điểm trả ${nextIdx}: ${addressText}!`);
  };

  // Xóa điểm dừng
  const handleRemoveStop = (stopId) => {
    const target = stops.find(s => s.id === stopId);
    if (target?.type === 'DROPOFF' && stops.filter(s => s.type === 'DROPOFF').length <= 1) {
      message.warning('Cần tối thiểu 1 điểm trả hàng cho chuyến xe!');
      return;
    }
    const updated = normalizeStopsAndEta(stops.filter(s => s.id !== stopId));
    setStops(updated);
    message.info('Đã xóa điểm dừng & cập nhật lại thứ tự hành trình');
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
      truck_spec_key: selectedTruckSpec.key,
      driver1: selectedDriver1,
      driver2: driverCount === 2 ? selectedDriver2 : null,
      waybill_no: waybillNo,
      stops: stops,
      distanceKm: routeSummary.distanceKm,
      durationMins: routeSummary.durationMins,
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
        width={1160}
        centered
        closable={false}
        styles={{ body: { padding: '0px' } }}
        className="trip-assignment-modal"
      >
        <div className="bg-white rounded-lg overflow-hidden border border-gray-300 font-sans text-gray-800">
          
          {/* Header Title theo thiết kế Prototype */}
          <div className="p-4 sm:p-5 border-b border-gray-200 flex items-center justify-between bg-white">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
                Chọn xe &amp; tài xế – Đơn {orderCode}
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Lộ trình chuẩn theo đơn: <b>{order.pickup_address || order.pickup}</b> → <b>{order.delivery_address || order.dropoff}</b>
              </p>
            </div>
            <Button 
              onClick={onCancel}
              className="px-5 h-8 font-medium text-gray-600 border-gray-300 hover:border-gray-500 rounded text-xs"
            >
              Đóng
            </Button>
          </div>

          <div className="p-4 sm:p-6 space-y-4 max-h-[85vh] overflow-y-auto">
            
            {/* (1) Thông tin chuyến (Trip summary) */}
            <div className="p-3 bg-white border border-gray-300 rounded text-xs text-gray-800 leading-relaxed flex flex-wrap items-center justify-between gap-2">
              <div>
                Đơn: <b>{orderCode}</b> · HAWB <b>{hawbCode}</b> · {customerName} · <b>{order.package_count || 1} {order.package_unit || 'kiện'}</b> ({order.length_cm || 0}×{order.width_cm || 0}×{order.height_cm || 0} cm) · KL thực <b>{actualWeight.toLocaleString()} kg</b> · KL tính cước <b>{chargeableWeight.toLocaleString()} kg</b> · Thể tích <b>{cargoVolume} m³</b><br />
                Trạng thái: <b>Sẵn sàng điều xe</b> · Xuất phát dự kiến: <b>{plannedStart}</b> · Quãng đường ngắn nhất <b>{routeSummary.distanceKm} km</b> · Thời gian chuyến <b>{Math.floor(routeSummary.durationMins / 60)}h{routeSummary.durationMins % 60}ph</b>
              </div>
              <div className="flex items-center gap-1.5">
                <Tag color="indigo" className="m-0 font-bold text-[11px]">
                  Xe đã chốt/đề xuất: {getVehicleSpecByKey(order.agreed_vehicle_type || order.proposed_vehicle_type || vehicleAnalysis?.recommendedVehicle?.key || '3.5T').label}
                </Tag>
              </div>
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
                  
                  {/* (3) Chế độ điểm trả: Mặc định luôn là Chuyến thẳng 1 điểm trả */}
                  <div className="p-3 bg-white border border-gray-300 rounded text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-gray-700">
                        Cấu hình điểm trả hàng: <span className="text-gray-500 font-normal">Mặc định 1 điểm trả chuẩn theo đơn</span>
                      </span>
                      <Tag color={multiDropMode === 'MULTI_POINTS' ? 'blue' : 'green'} className="m-0 text-[10px] font-semibold">
                        {multiDropMode === 'MULTI_POINTS' ? `${stops.filter(s => s.type === 'DROPOFF').length} điểm trả` : '1 điểm trả duy nhất'}
                      </Tag>
                    </div>
                    
                    <Radio.Group 
                      value={multiDropMode} 
                      onChange={e => handleChangeMultiDropMode(e.target.value)}
                      className="space-y-1.5 block"
                    >
                      <Radio value="STANDALONE" className="text-xs text-gray-700 block">
                        <b>Chuyến thẳng 1 điểm trả (Mặc định):</b> Xe chạy tuyến ngắn nhất trả toàn bộ hàng tại 1 điểm giao duy nhất của đơn
                      </Radio>
                      <Radio value="MULTI_POINTS" className="text-xs text-gray-700 block">
                        <b>Ghép chuyến nhiều điểm trả theo yêu cầu:</b> Khi khách yêu cầu chia hàng trả tại nhiều kho/điểm nhận khác nhau (bổ sung vào thứ tự điểm dừng bên dưới)
                      </Radio>
                    </Radio.Group>
                  </div>

                  {/* (4) & (5) Chọn Xe và Số tài xế */}
                  <div className="grid grid-cols-12 gap-3 items-end">
                    <div className="col-span-8 space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-gray-700">
                          Xe (tỉnh, độ dài, đăng kiểm còn hạn) *
                        </label>
                        <span className="text-[11px] text-indigo-600 font-medium">
                          Thùng: {selectedTruckSpec.boxText} · Tối đa {selectedTruckSpec.maxPayloadKg.toLocaleString()} kg
                        </span>
                      </div>
                      <Select
                        className="w-full text-xs"
                        value={selectedTruckPlate}
                        onChange={setSelectedTruckPlate}
                      >
                        {INTERNAL_FLEET_OPTIONS.map(opt => (
                          <Option key={opt.value} value={opt.value}>
                            {opt.label}
                          </Option>
                        ))}
                        {trucks
                          .filter(t => !INTERNAL_FLEET_OPTIONS.some(o => o.plate === t.plate))
                          .map(t => (
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

                  {/* Cảnh báo nếu chọn xe nhỏ hơn tải trọng/kích thước hàng hoặc cảnh báo MSG62 nếu > 8 giờ */}
                  {chargeableWeight > selectedTruckSpec.maxPayloadKg && (
                    <div className="p-2.5 bg-red-50 border border-red-300 rounded text-[11px] text-red-900 flex items-center gap-1.5">
                      <AlertTriangle size={14} className="text-red-600 shrink-0" />
                      <span>
                        Cảnh báo quá tải (BR-25 / MSG66): Khối lượng hàng (<b>{chargeableWeight.toLocaleString()} kg</b>) vượt tải trọng xe đang chọn (<b>{selectedTruckSpec.maxPayloadKg.toLocaleString()} kg</b>). Đề xuất chọn <b>{vehicleAnalysis?.recommendedVehicle?.label}</b>!
                      </span>
                    </div>
                  )}

                  {totalTripHours > 8 && (
                    <div className="p-2.5 bg-amber-50 border border-amber-300 rounded text-[11px] text-amber-900 flex items-center gap-1.5">
                      <AlertTriangle size={14} className="text-amber-600 shrink-0" />
                      <span>
                        Thời gian chuyến &gt; 8 giờ: <b>Thời gian chạy dự kiến {totalTripHours} giờ – đề xuất bố trí 2 tài xế (MSG62)</b>
                      </span>
                    </div>
                  )}

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
                        {drivers.map(d => (
                          <Option key={d.id || d.name} value={`${d.name} - Đã lái ${d.driven_hours || 1}h`}>
                            {d.name} · Đã lái {d.driven_hours || 1}h
                          </Option>
                        ))}
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

                  {/* (7) Thứ tự điểm dừng (Hỗ trợ kéo thả trực tiếp + nút lên/xuống + tối ưu tuyến ngắn nhất) */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs flex-wrap gap-2">
                      <span className="font-semibold text-gray-700">
                        Thứ tự điểm dừng <span className="text-indigo-600 font-medium">· Kéo thả ≡ hoặc bấm ↑↓ để đổi vị trí</span>
                      </span>
                      <div className="flex items-center gap-1.5">
                        {stops.filter(s => s.type === 'DROPOFF').length > 1 && (
                          <Button
                            size="small"
                            icon={<Sparkles size={11} />}
                            onClick={handleOptimizeShortestRoute}
                            className="text-[11px] h-6 px-2 text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100 font-semibold"
                          >
                            Tối ưu tuyến ngắn nhất
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
                              e.preventDefault();
                              if (index === 0) return; // Không thả đè lên điểm START (S)
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
                              const fromIdx = draggedIndex ?? parseInt(e.dataTransfer.getData('text/plain'), 10);
                              setDraggedIndex(null);
                              setDragOverIndex(null);
                              if (!Number.isNaN(fromIdx) && index > 0) {
                                moveStop(fromIdx, index);
                              }
                            }}
                            onDragEnd={() => {
                              setDraggedIndex(null);
                              setDragOverIndex(null);
                            }}
                            className={`flex items-center justify-between p-2 bg-white border rounded text-xs transition select-none ${
                              isBeingDragged
                                ? 'opacity-50 border-indigo-400 bg-indigo-50/40'
                                : isDragTarget
                                  ? 'border-2 border-indigo-500 bg-indigo-50/30 shadow-sm'
                                  : 'border-gray-200 hover:border-gray-400 shadow-2xs'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0 flex-1 pr-2">
                              <Tooltip title={isDraggable ? 'Giữ chuột và kéo để đổi thứ tự điểm dừng' : 'Điểm xuất phát cố định ở đầu chuyến'}>
                                <span className={isDraggable ? 'cursor-grab active:cursor-grabbing text-gray-400 hover:text-indigo-600' : 'text-gray-200 cursor-not-allowed'}>
                                  <GripVertical size={15} />
                                </span>
                              </Tooltip>
                              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                                stop.type === 'START' ? 'bg-gray-200 text-gray-700' :
                                stop.type === 'PICKUP' ? 'bg-blue-600 text-white' :
                                stop.type === 'REST' ? 'bg-amber-100 text-amber-800' :
                                'bg-emerald-600 text-white'
                              }`}>
                                {stop.badge}
                              </span>
                              <span className="font-medium text-gray-800 truncate" title={stop.name}>
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

                </div>

                {/* Cột phải: (8) Bản đồ tuyến TÍCH HỢP ROUTING API THỰC TẾ */}
                <div className="lg:col-span-5 flex flex-col justify-between">
                  <div className="border border-gray-300 rounded overflow-hidden h-full flex flex-col bg-white">
                    <div className="p-2 border-b border-gray-200 bg-gray-50 text-xs font-semibold text-gray-700 flex items-center justify-between">
                      <span>Bản đồ tuyến ngắn nhất (OSRM Routing thực tế)</span>
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
                      <span>{stops.map(s => s.badge).join(' → ')}</span>
                      <span>{routeSummary.distanceKm} km · {Math.floor(routeSummary.durationMins / 60)}h{routeSummary.durationMins % 60}ph</span>
                      <span>{currentFleetItem.plate} ({selectedTruckSpec.shortLabel})</span>
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
            {incidentContext && (
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
            )}

            {/* FOOTER ACTIONS CHUẨN SRS: (9) XEM XẾP HÀNG 3D, (14) CHỨNG TỪ CHUYẾN, (13) GIAO XE & TẠO CHUYẾN */}
            <div className="pt-3 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-4">
                {/* (9) Xem xếp hàng 3D */}
                <Button
                  onClick={() => setIs3DOpen(true)}
                  icon={<Box size={14} />}
                  className="font-semibold text-xs text-indigo-700 bg-indigo-50 border-indigo-300 hover:border-indigo-500 rounded h-9 px-4"
                >
                  Xem xếp hàng 3D ({order.package_count || 1} {order.package_unit || 'kiện'})
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

      {/* Modal Xếp hàng 3D Figure 25 với đúng thông số thùng xe đã chọn & dữ liệu hàng khách cung cấp */}
      <LoadPlan3DModal
        open={is3DOpen}
        trip={{
          trip_code: `TR-${orderCode}`,
          plate: currentFleetItem.plate,
          truck_model: selectedTruckSpec.label,
          box_dim: selectedTruckSpec.boxText,
          truck_length_cm: selectedTruckSpec.lengthCm,
          truck_width_cm: selectedTruckSpec.widthCm,
          truck_height_cm: selectedTruckSpec.heightCm,
          max_payload: selectedTruckSpec.maxPayloadKg,
          max_volume: selectedTruckSpec.maxVolumeM3,
          total_weight: actualWeight || chargeableWeight,
          orders_count: 1,
          total_volume: cargoVolume,
          order: order,
          orders: [order],
          assignment_stops: stops,
          is_multi_drop: multiDropMode === 'MULTI_POINTS'
        }}
        onClose={() => setIs3DOpen(false)}
      />
    </>
  );
}
