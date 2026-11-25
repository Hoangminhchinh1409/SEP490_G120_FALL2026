import { useState, useEffect, useMemo } from 'react';
import { message } from 'antd';
import { dispatcherApi } from '../../../api/dispatcherApi';
import { getCoordsFromAddress, getVehicleSpecByKey } from '../../../data/dispatcherPresets';
import {
  fetchShortestRoadRoute,
  optimizeDropoffsByRoadDistance,
  computeStopsLiveEta
} from '../../../utils/roadRouting';

function buildInitialStops(order) {
  const pickupAddr = order?.pickup_address || order?.pickup || 'Kho ALS Sân Bay Nội Bài';
  const dropoffAddr = order?.delivery_address || order?.dropoff || 'KCN Quế Võ, Bắc Ninh';
  const pickupCoords =
    order?.pickup_coords ||
    getCoordsFromAddress(pickupAddr, 'A') || { lat: 21.2187, lng: 105.8042 };
  const dropoffCoords =
    order?.dropoff_coords ||
    order?.delivery_coords ||
    getCoordsFromAddress(dropoffAddr, 'B') || { lat: 21.1458, lng: 106.1265 };

  return [
    {
      id: 'start',
      badge: 'S',
      name: 'Bãi xe ALS – Long Biên',
      action: 'Xuất phát',
      eta: 'dự kiến 07:00',
      type: 'START',
      coords: { lat: 21.0375, lng: 105.8942 }
    },
    {
      id: 'pickup',
      badge: '1',
      name: `Lấy hàng: ${pickupAddr}`,
      action: 'Đã đóng chì xuất phát',
      eta: 'dự kiến 07:45',
      type: 'PICKUP',
      coords: pickupCoords
    },
    {
      id: 'dropoff-1',
      badge: '2',
      name: `Điểm trả 1: ${dropoffAddr}`,
      action: 'Giao hàng',
      eta: 'dự kiến 09:15',
      type: 'DROPOFF',
      coords: dropoffCoords
    }
  ];
}

export function useTripRouteStops({
  order,
  plannedStart,
  selectedTruckSpec,
  selectedTruckPlate,
  currentFleetItem
}) {
  const [multiDropMode, setMultiDropMode] = useState('STANDALONE');
  const [showAddDropoffInput, setShowAddDropoffInput] = useState(false);
  const [newDropoffAddress, setNewDropoffAddress] = useState('');
  const [optimizingRoute, setOptimizingRoute] = useState(false);

  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  const [stops, setStops] = useState(() => buildInitialStops(order));
  const [routePolyline, setRoutePolyline] = useState([]);
  const [trafficSegments, setTrafficSegments] = useState([]);
  const [trafficSummary, setTrafficSummary] = useState(null);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [routeSummary, setRouteSummary] = useState({
    distanceKm: 68,
    durationMins: 160,
    delayMins: 0,
    etaText: null,
    legs: [],
    provider: 'vietmap_live'
  });

  useEffect(() => {
    let isCancelled = false;
    const fetchRoute = async () => {
      setLoadingRoute(true);
      try {
        const waypoints = stops.map((s) => s.coords).filter((c) => c && c.lat && c.lng);
        if (waypoints.length >= 2) {
          const res = await fetchShortestRoadRoute(waypoints);
          if (!isCancelled && res) {
            setRoutePolyline(res.polyline || res.coordinates || []);
            setTrafficSegments(Array.isArray(res.trafficSegments) ? res.trafficSegments : []);
            setTrafficSummary(res.trafficSummary || null);
            setRouteSummary({
              distanceKm: res.distanceKm || 68,
              durationMins: res.durationMins || 160,
              delayMins: res.delayMins || 0,
              etaText: res.etaText || null,
              legs: Array.isArray(res.legs) ? res.legs : [],
              provider: res.provider || 'vietmap_live'
            });
          }
        }
      } catch (err) {
        console.error('Không tính được lộ trình đường bộ:', err);
      } finally {
        if (!isCancelled) setLoadingRoute(false);
      }
    };
    fetchRoute();
    return () => {
      isCancelled = true;
    };
  }, [stops]);

  const stopsWithLiveEta = useMemo(() => {
    if (typeof computeStopsLiveEta === 'function') {
      return computeStopsLiveEta(stops, routeSummary, plannedStart);
    }
    return stops;
  }, [stops, routeSummary, plannedStart]);

  const moveStop = (fromIndex, toIndex) => {
    if (fromIndex <= 0 || toIndex <= 0 || fromIndex >= stops.length || toIndex >= stops.length)
      return;
    setStops((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next.map((s, idx) => ({
        ...s,
        badge: s.type === 'START' ? 'S' : s.type === 'REST' ? 'Nghỉ' : String(idx)
      }));
    });
  };

  const handleDragDrop = (targetIndex) => {
    if (draggedIndex === null || draggedIndex === targetIndex) return;
    moveStop(draggedIndex, targetIndex);
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleChangeMultiDropMode = (mode) => {
    setMultiDropMode(mode);
    if (mode === 'STANDALONE') {
      setStops(buildInitialStops(order));
      setShowAddDropoffInput(false);
      message.info('Đã chuyển về Chuyến thẳng 1 điểm trả duy nhất');
    } else {
      setShowAddDropoffInput(true);
      message.success('Đã bật chế độ Ghép chuyến nhiều điểm trả theo yêu cầu');
    }
  };

  const handleConfirmAddDropoff = (addrToAdd = null) => {
    const targetAddr = (addrToAdd || newDropoffAddress || '').trim();
    if (!targetAddr) {
      message.warning('Vui lòng nhập địa chỉ điểm trả hàng cần bổ sung!');
      return;
    }

    const newCoords = getCoordsFromAddress(targetAddr, 'B') || { lat: 21.1158, lng: 106.0125 };
    const currentDropoffs = stops.filter((s) => s.type === 'DROPOFF');
    const newDropoffIndex = currentDropoffs.length + 1;

    const newStop = {
      id: `dropoff-${Date.now()}`,
      badge: String(stops.length),
      name: `Điểm trả ${newDropoffIndex}: ${targetAddr}`,
      action: 'Giao hàng',
      eta: 'dự kiến +30p',
      type: 'DROPOFF',
      coords: newCoords
    };

    setStops((prev) => {
      const next = [...prev, newStop];
      return next.map((s, idx) => ({
        ...s,
        badge: s.type === 'START' ? 'S' : s.type === 'REST' ? 'Nghỉ' : String(idx)
      }));
    });
    setNewDropoffAddress('');
    message.success(`Đã thêm Điểm trả ${newDropoffIndex} vào lộ trình!`);
  };

  const handleOptimizeShortestRoute = async () => {
    const pickupStop = stops.find((s) => s.type === 'PICKUP');
    const dropoffStops = stops.filter((s) => s.type === 'DROPOFF');
    if (!pickupStop || dropoffStops.length <= 1) {
      message.info('Cần tối thiểu 2 điểm trả hàng để tối ưu thứ tự lộ trình.');
      return;
    }

    setOptimizingRoute(true);
    try {
      let truckPayloadKg = selectedTruckSpec?.maxPayloadKg || 2500;
      if (selectedTruckPlate) {
        const spec = getVehicleSpecByKey(currentFleetItem?.specKey || selectedTruckPlate);
        if (spec?.maxPayloadKg) {
          truckPayloadKg = spec.maxPayloadKg;
        } else if (
          selectedTruckPlate.includes('1.250 kg') ||
          selectedTruckPlate.includes('1.25T')
        ) {
          truckPayloadKg = 1250;
        } else if (
          selectedTruckPlate.includes('3.500 kg') ||
          selectedTruckPlate.includes('3.5T')
        ) {
          truckPayloadKg = 3500;
        } else if (
          selectedTruckPlate.includes('5.000 kg') ||
          selectedTruckPlate.includes('5T')
        ) {
          truckPayloadKg = 5000;
        } else if (
          selectedTruckPlate.includes('8.000 kg') ||
          selectedTruckPlate.includes('8T')
        ) {
          truckPayloadKg = 8000;
        }
      }

      const res = await dispatcherApi.optimizeMultiStopRoute({
        stops,
        startTime: plannedStart || new Date().toISOString(),
        truckPayloadKg,
        avoidTruckBan: true
      });

      const vrptwData = res?.data || res;
      if (res?.success && Array.isArray(vrptwData?.optimizedStops)) {
        const optimizedStops = vrptwData.optimizedStops.map((s, idx) => ({
          ...s,
          badge: s.type === 'START' ? 'S' : s.type === 'REST' ? 'Nghỉ' : String(idx)
        }));

        setStops(optimizedStops);

        if (vrptwData.warnings && vrptwData.warnings.length > 0) {
          message.warning({
            content: `VRPTW hoàn tất: Có ${vrptwData.warnings.length} lưu ý về khung giờ cấm tải hoặc thời gian giao nhận.`,
            duration: 5
          });
        } else if (vrptwData.restStopsAdded > 0) {
          message.info({
            content: `Hệ thống đã tự động chèn điểm nghỉ 15 phút tuân thủ quy định lái xe liên tục (<= 4h).`,
            duration: 4
          });
        } else {
          message.success(
            'Đã tối ưu lộ trình VRPTW (khung giờ cấm tải Hà Nội & cửa sổ thời gian)!'
          );
        }
        return;
      }

      const optimizedDropoffs = await optimizeDropoffsByRoadDistance(
        pickupStop.coords,
        dropoffStops
      );
      const startStop = stops.find((s) => s.type === 'START');
      const restStops = stops.filter((s) => s.type === 'REST');

      const reorderedStops = [startStop, pickupStop, ...restStops, ...optimizedDropoffs]
        .filter(Boolean)
        .map((s, idx) => ({
          ...s,
          badge: s.type === 'START' ? 'S' : s.type === 'REST' ? 'Nghỉ' : String(idx)
        }));

      setStops(reorderedStops);
      message.success('Đã tối ưu thứ tự điểm trả theo tuyến đường bộ ngắn nhất!');
    } catch (err) {
      console.error('VRPTW optimization error, falling back:', err);
      try {
        const optimizedDropoffs = await optimizeDropoffsByRoadDistance(
          pickupStop.coords,
          dropoffStops
        );
        const startStop = stops.find((s) => s.type === 'START');
        const restStops = stops.filter((s) => s.type === 'REST');

        const reorderedStops = [startStop, pickupStop, ...restStops, ...optimizedDropoffs]
          .filter(Boolean)
          .map((s, idx) => ({
            ...s,
            badge: s.type === 'START' ? 'S' : s.type === 'REST' ? 'Nghỉ' : String(idx)
          }));

        setStops(reorderedStops);
        message.success('Đã tối ưu thứ tự điểm trả theo tuyến đường bộ!');
      } catch (fallbackErr) {
        console.error(fallbackErr);
        message.error('Không thể tối ưu lộ trình lúc này.');
      }
    } finally {
      setOptimizingRoute(false);
    }
  };

  const handleAddBreak = () => {
    // Đã bỏ tính năng thêm điểm nghỉ - hệ thống chỉ quản lý thời gian xe lăn bánh trên đường
  };

  const handleRemoveStop = (id) => {
    setStops((prev) => {
      const next = prev.filter((s) => s.id !== id);
      return next.map((s, idx) => ({
        ...s,
        badge: s.type === 'START' ? 'S' : s.type === 'REST' ? 'Nghỉ' : String(idx)
      }));
    });
    message.info('Đã xóa điểm dừng khỏi hành trình');
  };

  return {
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
  };
}
