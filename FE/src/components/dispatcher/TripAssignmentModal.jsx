import React, { useState, useEffect, useMemo } from 'react';
import { Modal, Button, Tag, Input, message } from 'antd';
import { Box, ExternalLink } from 'lucide-react';
import { dispatcherApi } from '../../api/dispatcherApi';
import {
  getVehicleSpecByKey,
  analyzeVehicleRecommendation,
  VEHICLE_SPECS
} from '../../data/dispatcherPresets';
import LoadPlan3DModal from './LoadPlan3DModal';

// Các subcomponents tách module
import TripAssignmentFleetConfig from './tripAssignment/TripAssignmentFleetConfig';
import TripAssignmentStopsList from './tripAssignment/TripAssignmentStopsList';
import TripAssignmentVendorConfig from './tripAssignment/TripAssignmentVendorConfig';
import TripAssignmentMapPanel from './tripAssignment/TripAssignmentMapPanel';
import { useTripRouteStops } from './tripAssignment/useTripRouteStops';

// Danh mục đội xe nội bộ chuẩn gắn với thông số thùng xe
const BASE_INTERNAL_FLEET_OPTIONS = [
  {
    value: '29A-112.34 - 1.250 kg - Sẵn sàng',
    plate: '29A-112.34',
    specKey: 'TRUCK_1.25T',
    label: '29A-112.34 · Xe 1.25 tấn (3,1×1,6×1,6m) · 1.250 kg · Sẵn sàng'
  },
  {
    value: '29A-115.68 - 1.250 kg - Sẵn sàng',
    plate: '29A-115.68',
    specKey: 'TRUCK_1.25T',
    label: '29A-115.68 · Xe 1.25 tấn (3,1×1,6×1,6m) · 1.250 kg · Sẵn sàng'
  },
  {
    value: '29C-456.78 - 2.500 kg - Sẵn sàng',
    plate: '29C-456.78',
    specKey: 'TRUCK_2.5T',
    label: '29C-456.78 · Xe 2.5 tấn (4,2×1,9×1,9m) · 2.500 kg · Sẵn sàng'
  },
  {
    value: '29C-458.99 - 2.500 kg - Sẵn sàng',
    plate: '29C-458.99',
    specKey: 'TRUCK_2.5T',
    label: '29C-458.99 · Xe 2.5 tấn (4,2×1,9×1,9m) · 2.500 kg · Sẵn sàng'
  },
  {
    value: '29H-995.72 - 3.500 kg - Sẵn sàng',
    plate: '29H-995.72',
    specKey: 'TRUCK_3.5T',
    label: '29H-995.72 · Xe 3.5 tấn (5,0×2,05×2,05m) · 3.500 kg · Sẵn sàng'
  },
  {
    value: '29H-996.88 - 3.500 kg - Sẵn sàng',
    plate: '29H-996.88',
    specKey: 'TRUCK_3.5T',
    label: '29H-996.88 · Xe 3.5 tấn (5,0×2,05×2,05m) · 3.500 kg · Sẵn sàng'
  },
  {
    value: '29H-767.99 - 5.000 kg - Sẵn sàng',
    plate: '29H-767.99',
    specKey: 'TRUCK_5T',
    label: '29H-767.99 · Xe 5 tấn (6,2×2,2×2,2m) · 5.000 kg · Sẵn sàng'
  },
  {
    value: '29H-888.68 - 8.000 kg - Sẵn sàng',
    plate: '29H-888.68',
    specKey: 'TRUCK_8T',
    label: '29H-888.68 · Xe 8 tấn (7,8×2,35×2,4m) · 8.000 kg · Sẵn sàng'
  },
  {
    value: '29R-150.99 - 15.000 kg - Sẵn sàng',
    plate: '29R-150.99',
    specKey: 'CONTAINER_20',
    label: '29R-150.99 · Cont 20ft (5,9×2,35×2,39m) · 12.000 kg · Sẵn sàng'
  }
];

export default function TripAssignmentModal({
  open,
  onCancel,
  order,
  incidentContext = null,
  onAssignSuccess
}) {
  if (!open || !order) return null;

  return (
    <TripAssignmentModalContent
      key={`${order.id || order.order_id}`}
      open={open}
      onCancel={onCancel}
      order={order}
      incidentContext={incidentContext}
      onAssignSuccess={onAssignSuccess}
    />
  );
}

function TripAssignmentModalContent({
  open,
  onCancel,
  order,
  incidentContext = null,
  onAssignSuccess
}) {
  const orderCode = order?.order_id || order?.id || 'NEX-ORD';
  const customerName = order?.customer || order?.customer_name || 'Khách hàng';
  const actualWeight = Number(order?.weight || order?.weight_kg || 2000);
  const chargeableWeight = Number(order?.chargeable || order?.chargeable_weight || actualWeight);
  const plannedStart = useMemo(() => {
    const pad2 = (n) => String(n).padStart(2, '0');
    const formatYmdToVn = (ymd) => {
      const m = String(ymd || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
      return m ? `${m[3]}/${m[2]}/${m[1]}` : null;
    };

    if (order?.requested_pickup_date) {
      const raw = String(order.requested_pickup_date).trim();
      const onlyYmd = formatYmdToVn(raw);
      if (onlyYmd) {
        const slotTime =
          order?.operating_time_slot === 'AFTERNOON'
            ? '12:00'
            : order?.flight_arrival_time || '08:00';
        return `${onlyYmd} ${String(slotTime).slice(0, 5)}`;
      }
      return raw;
    }

    if (order?.flight_arrival_date) {
      const d = formatYmdToVn(order.flight_arrival_date) || order.flight_arrival_date;
      const t = String(order.flight_arrival_time || '08:00').slice(0, 5);
      return `${d} ${t}`;
    }

    if (order?.required_pickup_date) {
      const d = formatYmdToVn(order.required_pickup_date) || order.required_pickup_date;
      const t = order?.operating_time_slot === 'AFTERNOON' ? '12:00' : '08:00';
      return `${d} ${t}`;
    }

    if (order?.export_pickup_suggestion) {
      return order.export_pickup_suggestion;
    }

    const fallbackDate = order?.date ? new Date(order.date.replace(' ', 'T')) : new Date();
    const validDt = Number.isNaN(fallbackDate.getTime()) ? new Date() : fallbackDate;
    return `${pad2(validDt.getDate())}/${pad2(validDt.getMonth() + 1)}/${validDt.getFullYear()} ${pad2(validDt.getHours())}:${pad2(validDt.getMinutes())}`;
  }, [order]);

  const [transportMode, setTransportMode] = useState('INTERNAL');

  const vehicleAnalysis = useMemo(() => {
    if (!order) return null;
    return analyzeVehicleRecommendation({
      chargeableWeightKg: chargeableWeight,
      actualWeightKg: actualWeight,
      lengthCm: order.length_cm,
      widthCm: order.width_cm,
      heightCm: order.height_cm,
      cargoType: order.cargo_type,
      items: order.items || [],
      customerRequestedVehicle:
        order.agreed_vehicle_type ||
        order.proposed_vehicle_type ||
        order.vehicle_type_required ||
        'TRUCK_2.5T'
    });
  }, [chargeableWeight, actualWeight, order]);

  // Xe đã chốt của đơn
  const agreedVehicleSpecKey = useMemo(() => {
    const rawKey =
      order?.web_workflow?.agreed_vehicle_type ||
      order?.agreed_vehicle_type ||
      order?.web_workflow?.proposed_vehicle_type ||
      order?.proposed_vehicle_type ||
      order?.vehicle_type_required ||
      'TRUCK_3.5T';
    const spec = getVehicleSpecByKey(rawKey) || VEHICLE_SPECS[2];
    return spec.key;
  }, [order]);

  const [trucks, setTrucks] = useState([]);
  const [drivers, setDrivers] = useState([
    { id: 6, name: 'Nguyễn Văn Lái', status: 'AVAILABLE', hours_driven: 2.0 },
    { id: 15, name: 'Nguyễn Tấn Tài', status: 'AVAILABLE', hours_driven: 3.5 },
    { id: 16, name: 'Đỗ Duy Hải', status: 'AVAILABLE', hours_driven: 2.0 }
  ]);
  const [vendors, setVendors] = useState([]);

  // Đồng bộ trạng thái thực tế từ database vào danh sách xe nội bộ (BR-23)
  const internalFleetOptions = useMemo(() => {
    return BASE_INTERNAL_FLEET_OPTIONS.map((opt) => {
      const liveTruck = trucks.find((t) => (t.plate_number || t.plate) === opt.plate);
      if (!liveTruck) return opt;
      const rawStatus = String(liveTruck.status || '').toUpperCase();
      const isAvailable = rawStatus === 'AVAILABLE' || rawStatus === 'ACTIVE';
      const isMaintenance = rawStatus === 'MAINTENANCE';
      const isOnTrip =
        rawStatus === 'ON TRIP' || rawStatus === 'ON_TRIP' || rawStatus === 'IN_TRANSIT';

      let statusLabel = 'Sẵn sàng';
      if (isOnTrip) statusLabel = 'Đang chạy chuyến (On Trip)';
      else if (isMaintenance) statusLabel = 'Đang bảo dưỡng';
      else if (!isAvailable) statusLabel = liveTruck.status || 'Không khả dụng';

      const parts = opt.label.split('·');
      const middlePart =
        parts.length > 2 ? parts.slice(1, -1).join('·').trim() : parts[1]?.trim() || '';

      return {
        ...opt,
        disabled: !isAvailable,
        status: liveTruck.status,
        label: `${opt.plate} · ${middlePart} · ${statusLabel}`
      };
    });
  }, [trucks]);

  // Bộ lọc danh sách xe: CHỈ hiển thị các xe CÙNG HẠNG TẢI TRỌNG đã chốt (khác biển số)
  const filteredFleetOptions = useMemo(() => {
    const safeKey = String(agreedVehicleSpecKey || 'TRUCK_3.5T');
    const specKeyNorm = safeKey.replace('TRUCK_', '');
    const matchedOptions = internalFleetOptions.filter(
      (o) =>
        o.specKey === safeKey || String(o.specKey || '').replace('TRUCK_', '') === specKeyNorm
    );
    return matchedOptions.length > 0 ? matchedOptions : internalFleetOptions;
  }, [agreedVehicleSpecKey, internalFleetOptions]);

  const defaultOption = useMemo(() => {
    const available = filteredFleetOptions.find((o) => !o.disabled);
    return (
      available?.value || filteredFleetOptions[0]?.value || internalFleetOptions[0]?.value
    );
  }, [filteredFleetOptions, internalFleetOptions]);

  const [selectedTruckPlateState, setSelectedTruckPlate] = useState(defaultOption);

  const selectedTruckPlate = useMemo(() => {
    const currentOpt = filteredFleetOptions.find((o) => o.value === selectedTruckPlateState);
    if (currentOpt && !currentOpt.disabled) return selectedTruckPlateState;
    return defaultOption || selectedTruckPlateState;
  }, [filteredFleetOptions, selectedTruckPlateState, defaultOption]);

  const currentFleetItem = useMemo(() => {
    return (
      internalFleetOptions.find((o) => o.value === selectedTruckPlate) ||
      internalFleetOptions[2] ||
      BASE_INTERNAL_FLEET_OPTIONS[2]
    );
  }, [selectedTruckPlate, internalFleetOptions]);

  const selectedTruckSpec = useMemo(() => {
    const matched = getVehicleSpecByKey(currentFleetItem.specKey || '3.5T');
    if (matched) return matched;
    if (currentFleetItem.specKey === 'TRUCK_8T') {
      return {
        key: 'TRUCK_8T',
        label: 'Xe tải 8 tấn',
        shortLabel: 'Xe 8 tấn',
        maxPayloadKg: 8000,
        length_cm: 780,
        width_cm: 235,
        height_cm: 240,
        volumeM3: 44.0,
        boxDimText: 'Thùng 7,8 × 2,35 × 2,4 m'
      };
    }
    return VEHICLE_SPECS[2];
  }, [currentFleetItem]);

  const [driverCount, setDriverCount] = useState(1);
  const [selectedDriver1, setSelectedDriver1] = useState('Nguyễn Văn Lái');
  const [selectedDriver2, setSelectedDriver2] = useState(undefined);
  const [selectedVendor, setSelectedVendor] = useState(
    'Công ty TNHH Vận tải & Tiếp vận Hà Nội (Hanoitrans)'
  );
  const [vendorVehicleCount, setVendorVehicleCount] = useState(1);
  const [vendorCost, setVendorCost] = useState('3.500.000');
  const [vendorTrackingCode, setVendorTrackingCode] = useState(
    () => `3PL-${order?.order_id || order?.id || '8829'}`
  );
  const [changeReason, setChangeReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [is3DOpen, setIs3DOpen] = useState(false);

  useEffect(() => {
    let active = true;
    const loadFleetData = async () => {
      try {
        const [truckData, driverData, vendorData] = await Promise.all([
          dispatcherApi.getTrucks().catch(() => []),
          dispatcherApi.getDrivers().catch(() => []),
          dispatcherApi.getVendors().catch(() => [])
        ]);
        if (active) {
          if (Array.isArray(truckData) && truckData.length > 0) setTrucks(truckData);
          if (Array.isArray(driverData) && driverData.length > 0) {
            setDrivers(driverData);
            const availDriver = driverData.find((d) => {
              const rawSt = String(d.status || '').toUpperCase();
              return rawSt === 'AVAILABLE' || rawSt === 'ACTIVE';
            });
            if (availDriver?.name) {
              setSelectedDriver1(availDriver.name);
            } else if (driverData[0]?.name) {
              setSelectedDriver1(driverData[0].name);
            }
          }
          if (Array.isArray(vendorData) && vendorData.length > 0) {
            setVendors(vendorData);
            if (vendorData[0]?.name) {
              setSelectedVendor(vendorData[0].name);
            }
          }
        }
      } catch (err) {
        console.warn('Không tải được dữ liệu đội xe / tài xế:', err.message || err);
      }
    };
    loadFleetData();
    return () => {
      active = false;
    };
  }, []);

  const {
    multiDropMode,
    showAddDropoffInput,
    setShowAddDropoffInput,
    newDropoffAddress,
    setNewDropoffAddress,
    optimizingRoute,
    draggedIndex,
    setDraggedIndex,
    dragOverIndex,
    setDragOverIndex,
    stops,
    routePolyline,
    trafficSegments,
    trafficSummary,
    loadingRoute,
    routeSummary,
    stopsWithLiveEta,
    moveStop,
    handleDragDrop,
    handleChangeMultiDropMode,
    handleConfirmAddDropoff,
    handleOptimizeShortestRoute,
    handleAddBreak,
    handleRemoveStop
  } = useTripRouteStops({
    order,
    plannedStart,
    selectedTruckSpec,
    selectedTruckPlate,
    currentFleetItem
  });

  const cargoVolume = useMemo(() => {
    if (!order) return '0.0';
    if (order.cargo_type === 'BULK') return (actualWeight / 1000).toFixed(1);
    const l = Number(order.length_cm) || 120;
    const w = Number(order.width_cm) || 100;
    const h = Number(order.height_cm) || 150;
    const cnt = Number(order.package_count) || 1;
    return ((l * w * h * cnt) / 1000000).toFixed(1);
  }, [order, actualWeight]);

  if (!open || !order) return null;

  const totalTripHours = routeSummary.durationMins / 60;

  const handleAssignInternal = async () => {
    if (!selectedDriver1) {
      message.error('Vui lòng chọn Tài xế 1!');
      return;
    }
    if (driverCount === 2 && !selectedDriver2) {
      message.error('Bạn đã chọn 2 tài xế, vui lòng chọn đủ Tài xế 2!');
      return;
    }

    const cleanPlate =
      currentFleetItem?.plate || String(selectedTruckPlate || '').split(' ')[0].trim();
    const cleanDriver1 = String(selectedDriver1).split('·')[0].trim();
    const cleanDriver2 =
      driverCount === 2 && selectedDriver2 ? String(selectedDriver2).split('·')[0].trim() : null;

    setSubmitting(true);
    try {
      const createdTrip = await dispatcherApi.createTrip({
        order_id: order.id,
        order_code: order.order_code || order.order_id || orderCode,
        allocation_type: 'INTERNAL',
        truck_plate: cleanPlate,
        driver_name: cleanDriver1,
        driver1_name: cleanDriver1,
        driver2_name: cleanDriver2,
        stops: stops,
        planned_start: order?.planned_start_iso || undefined,
        planned_distance: routeSummary.distanceKm,
        planned_duration: routeSummary.durationMins
      });

      message.success(
        `Đã phân bổ chuyến xe ${createdTrip?.trip_code || ''} thành công! (Đã tự động gửi thông báo đến Đội Ops Sân bay qua Zalo)`
      );
      onAssignSuccess?.({
        ...order,
        ...createdTrip,
        trip_id: createdTrip?.id || createdTrip?.trip_id,
        order_id: order.id || order.order_id,
        order_code: orderCode,
        allocation_type: 'INTERNAL',
        status: 'ASSIGNED',
        truck: cleanPlate,
        truck_model: selectedTruckSpec.label,
        driver1: cleanDriver1,
        driver2: cleanDriver2,
        stops: stops,
        distanceKm: routeSummary.distanceKm,
        durationMins: routeSummary.durationMins
      });
    } catch (err) {
      console.warn('handleAssignInternal warning:', err.message || err);
      message.error(err.message || 'Lỗi khi tạo chuyến và phân bổ xe trên máy chủ');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAssignVendor = async () => {
    if (!vendorTrackingCode.trim()) {
      message.error('Vui lòng nhập Mã vận đơn nhà xe đối tác!');
      return;
    }

    setSubmitting(true);
    try {
      const createdVendorTrip = await dispatcherApi.createTrip({
        order_id: order.id,
        order_code: order.order_code || order.order_id || orderCode,
        allocation_type: 'VENDOR',
        vendor_name: selectedVendor,
        vendor_tracking_code: vendorTrackingCode.trim(),
        vendor_cost: vendorCost,
        vendor_vehicles_count: vendorVehicleCount
      });

      onAssignSuccess?.({
        ...order,
        ...createdVendorTrip,
        order_id: order.id || order.order_id,
        order_code: orderCode,
        allocation_type: 'VENDOR',
        status: 'HANDED_OVER_VENDOR',
        vendor: selectedVendor,
        vendor_tracking: vendorTrackingCode.trim(),
        vendor_cost: vendorCost,
        vendor_vehicles_count: vendorVehicleCount
      });
    } catch (err) {
      console.warn('handleAssignVendor warning:', err.message || err);
      message.error(err.message || 'Lỗi khi bàn giao đơn hàng cho nhà xe đối tác');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveChange = async () => {
    if (!changeReason.trim()) {
      message.error('Vui lòng nhập lý do thay đổi xe / tài xế!');
      return;
    }
    const cleanPlate =
      currentFleetItem?.plate || String(selectedTruckPlate || '').split(' ')[0].trim();
    const cleanDriver1 = String(selectedDriver1).split('·')[0].trim();

    setSubmitting(true);
    try {
      if (incidentContext?.id || incidentContext?.raw_id) {
        await dispatcherApi.updateIncidentStatus(incidentContext.raw_id || incidentContext.id, {
          status: 'RESOLVED_REPLACED',
          new_truck: cleanPlate,
          new_driver: cleanDriver1,
          replacement_reason: changeReason.trim()
        });
      }
      onAssignSuccess?.({
        ...order,
        status: 'ASSIGNED',
        truck: cleanPlate,
        driver1: cleanDriver1,
        change_reason: changeReason
      });
      message.success('Đã lưu thay đổi phương tiện và tái cấp vận đơn mới thành công!');
    } catch (err) {
      console.error('handleSaveChange error:', err);
      message.error(err.message || 'Lỗi khi lưu thay đổi phương tiện');
    } finally {
      setSubmitting(false);
    }
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
                Lộ trình chuẩn theo đơn:{' '}
                <b>{order.pickup_address || order.pickup}</b> →{' '}
                <b>{order.delivery_address || order.dropoff}</b>
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
            {/* Thông tin chuyến */}
            <div className="p-3 bg-white border border-gray-300 rounded text-xs text-gray-800 leading-relaxed flex flex-wrap items-center justify-between gap-2">
              <div>
                Đơn: <b>{orderCode}</b> · {customerName} ·{' '}
                <b>
                  {order.package_count || 1} {order.package_unit || 'kiện'}
                </b>{' '}
                ({order.length_cm || 0}×{order.width_cm || 0}×{order.height_cm || 0} cm) · KL thực{' '}
                <b>{actualWeight.toLocaleString()} kg</b> · KL tính cước{' '}
                <b>{chargeableWeight.toLocaleString()} kg</b> · Thể tích <b>{cargoVolume} m³</b>
                <br />
                Trạng thái: <b>Sẵn sàng điều xe</b> · Xuất phát dự kiến: <b>{plannedStart}</b> ·
                Quãng đường ngắn nhất <b>{routeSummary.distanceKm} km</b> · Thời gian chuyến{' '}
                <b>
                  {Math.floor(routeSummary.durationMins / 60)}h{routeSummary.durationMins % 60}ph
                </b>
              </div>
              <div className="flex items-center gap-1.5">
                <Tag color="indigo" className="m-0 font-bold text-[11px]">
                  Xe đã chốt/đề xuất:{' '}
                  {getVehicleSpecByKey(
                    order.agreed_vehicle_type ||
                      order.proposed_vehicle_type ||
                      vehicleAnalysis?.recommendedVehicleKey ||
                      '3.5T'
                  )?.label || 'Xe tải 3.5 tấn'}
                </Tag>
              </div>
            </div>

            {/* Toggle Phương thức vận chuyển */}
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

            {/* Khi chọn Đội xe nội bộ */}
            {transportMode === 'INTERNAL' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                <div className="lg:col-span-7 space-y-3.5">
                  <TripAssignmentFleetConfig
                    order={order}
                    orderCode={orderCode}
                    customerName={customerName}
                    actualWeight={actualWeight}
                    chargeableWeight={chargeableWeight}
                    cargoVolume={cargoVolume}
                    plannedStart={plannedStart}
                    routeSummary={routeSummary}
                    vehicleAnalysis={vehicleAnalysis}
                    transportMode={transportMode}
                    setTransportMode={setTransportMode}
                    multiDropMode={multiDropMode}
                    handleChangeMultiDropMode={handleChangeMultiDropMode}
                    stops={stops}
                    selectedTruckPlate={selectedTruckPlate}
                    setSelectedTruckPlate={setSelectedTruckPlate}
                    selectedTruckSpec={selectedTruckSpec}
                    INTERNAL_FLEET_OPTIONS={filteredFleetOptions}
                    trucks={trucks.filter((t) => {
                      const spec = getVehicleSpecByKey(agreedVehicleSpecKey) || VEHICLE_SPECS[2];
                      return (
                        Math.abs((t.payload_kg || t.allowed_payload || 0) - spec.maxPayloadKg) <
                        100
                      );
                    })}
                    driverCount={driverCount}
                    setDriverCount={setDriverCount}
                    totalTripHours={totalTripHours}
                    selectedDriver1={selectedDriver1}
                    setSelectedDriver1={setSelectedDriver1}
                    selectedDriver2={selectedDriver2}
                    setSelectedDriver2={setSelectedDriver2}
                    drivers={drivers}
                  />

                  <TripAssignmentStopsList
                    stops={stopsWithLiveEta}
                    multiDropMode={multiDropMode}
                    showAddDropoffInput={showAddDropoffInput}
                    setShowAddDropoffInput={setShowAddDropoffInput}
                    newDropoffAddress={newDropoffAddress}
                    setNewDropoffAddress={setNewDropoffAddress}
                    handleConfirmAddDropoff={handleConfirmAddDropoff}
                    optimizingRoute={optimizingRoute}
                    handleOptimizeShortestRoute={handleOptimizeShortestRoute}
                    draggedIndex={draggedIndex}
                    setDraggedIndex={setDraggedIndex}
                    dragOverIndex={dragOverIndex}
                    setDragOverIndex={setDragOverIndex}
                    handleDragDrop={handleDragDrop}
                    moveStop={moveStop}
                    handleRemoveStop={handleRemoveStop}
                    handleAddBreak={handleAddBreak}
                    routeSummary={routeSummary}
                    trafficSummary={trafficSummary}
                  />
                </div>

                {/* Cột phải: Bản đồ tuyến */}
                <TripAssignmentMapPanel
                  stopsWithLiveEta={stopsWithLiveEta}
                  routePolyline={routePolyline}
                  trafficSegments={trafficSegments}
                  trafficSummary={trafficSummary}
                  loadingRoute={loadingRoute}
                  routeSummary={routeSummary}
                  currentFleetItem={currentFleetItem}
                  selectedTruckSpec={selectedTruckSpec}
                />
              </div>
            )}

            {/* Khi chọn Nhà xe đối tác */}
            {transportMode === 'VENDOR' && (
              <TripAssignmentVendorConfig
                selectedVendor={selectedVendor}
                setSelectedVendor={setSelectedVendor}
                vendorVehicleCount={vendorVehicleCount}
                setVendorVehicleCount={setVendorVehicleCount}
                vendorCost={vendorCost}
                setVendorCost={setVendorCost}
                vendorTrackingCode={vendorTrackingCode}
                setVendorTrackingCode={setVendorTrackingCode}
                vendors={vendors}
              />
            )}

            {/* Khung sự cố */}
            {incidentContext && (
              <div className="p-3.5 bg-gray-50 border border-gray-300 rounded space-y-2">
                <div className="font-semibold text-xs text-gray-700">
                  Khi mở từ sự cố (Điều xe thay thế):{' '}
                  <span className="text-gray-400 font-normal">
                    đổi xe hoặc tài xế của chuyến đã tạo
                  </span>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <div className="flex-1 space-y-1">
                    <label className="text-[11px] text-gray-500 block">
                      Lý do thay đổi * (tối đa 255 ký tự)
                    </label>
                    <Input
                      className="text-xs"
                      value={changeReason}
                      onChange={(e) => setChangeReason(e.target.value)}
                      placeholder="Tài xế Hồ Chí Học báo ốm, đổi sang Tài xế Sức Hải"
                    />
                  </div>
                  <div className="pt-4 sm:pt-4">
                    <Button
                      type="primary"
                      loading={submitting}
                      onClick={handleSaveChange}
                      className="bg-blue-900 hover:bg-blue-800 text-white font-semibold text-xs h-8 px-6 rounded"
                    >
                      Lưu thay đổi
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Footer actions */}
            <div className="pt-3 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-4">
                <Button
                  onClick={() => setIs3DOpen(true)}
                  icon={<Box size={14} />}
                  className="font-semibold text-xs text-indigo-700 bg-indigo-50 border-indigo-300 hover:border-indigo-500 rounded h-9 px-4"
                >
                  Xem xếp hàng 3D ({order.package_count || 1} {order.package_unit || 'kiện'})
                </Button>

                <a
                  href="#waybill"
                  onClick={(e) => {
                    e.preventDefault();
                    message.info(
                      'Chứng từ chuyến (Giấy vận tải & Hồ sơ khách) sẽ sẵn sàng sau khi chuyến được khởi tạo!'
                    );
                  }}
                  className="text-xs text-blue-700 hover:underline flex items-center gap-1"
                >
                  <ExternalLink size={13} />
                  Chứng từ chuyến <span className="text-gray-400">(sau khi tạo chuyến)</span>
                </a>
              </div>

              {transportMode === 'INTERNAL' ? (
                <div className="flex flex-col items-end">
                  <Button
                    type="primary"
                    loading={submitting}
                    onClick={handleAssignInternal}
                    className="bg-blue-900 hover:bg-blue-800 text-white font-bold text-xs h-9 px-8 rounded shadow-sm"
                  >
                    Giao xe &amp; tạo chuyến
                  </Button>
                  <span className="text-[10px] text-gray-400 mt-0.5">
                    Tạo chuyến, lưu vận tải và gửi chuyến cho tài xế
                  </span>
                </div>
              ) : (
                <Button
                  type="primary"
                  loading={submitting}
                  onClick={handleAssignVendor}
                  className="bg-blue-900 hover:bg-blue-800 text-white font-bold text-xs h-9 px-8 rounded shadow-sm"
                >
                  Xác nhận giao nhà xe đối tác
                </Button>
              )}
            </div>
          </div>
        </div>
      </Modal>

      <LoadPlan3DModal
        open={is3DOpen}
        trip={{
          id: `PREVIEW-${order.id || order.order_id}`,
          trip_code: `XEM-XE-${selectedTruckSpec.key || currentFleetItem.specKey}`,
          plate: currentFleetItem.plate,
          truck_model: selectedTruckSpec.label,
          box_dim: selectedTruckSpec.boxDimText || selectedTruckSpec.boxText,
          truck_length_cm: selectedTruckSpec.length_cm || selectedTruckSpec.lengthCm,
          truck_width_cm: selectedTruckSpec.width_cm || selectedTruckSpec.widthCm,
          truck_height_cm: selectedTruckSpec.height_cm || selectedTruckSpec.heightCm,
          max_payload: selectedTruckSpec.maxPayloadKg,
          max_volume: selectedTruckSpec.volumeM3 || selectedTruckSpec.maxVolumeM3,
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
