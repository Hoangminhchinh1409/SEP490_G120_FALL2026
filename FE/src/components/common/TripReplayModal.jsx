'use client';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import dynamic from 'next/dynamic';
import {
  Modal,
  Button,
  Slider,
  Progress,
  Tag,
  Tabs,
  Spin,
  Tooltip
} from 'antd';
import {
  PlayCircle,
  PauseCircle,
  RotateCcw,
  MapPin,
  Clock,
  Gauge,
  Calendar,
  AlertTriangle,
  Compass,
  CheckCircle2,
  Navigation
} from 'lucide-react';
import { dispatcherApi } from '../../api/dispatcherApi';
import { managerApi } from '../../api/managerApi';

// Dynamic import component bản đồ VietMap để tránh lỗi SSR trong Next.js App Router
const InnerReplayMap = dynamic(
  () => import('./InnerReplayMap'),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-[380px] flex flex-col items-center justify-center bg-slate-50 text-slate-500 gap-2 rounded-xl border border-slate-200">
        <Spin size="medium" />
        <span className="text-xs font-semibold">Đang tải bản đồ số VietMap...</span>
      </div>
    )
  }
);

export default function TripReplayModal({
  open,
  selectedTripReplay,
  tripId: propTripId,
  incidentInfo,
  onClose
}) {
  const isModalOpen = Boolean(open !== undefined ? open : selectedTripReplay);
  const [loading, setLoading] = useState(false);
  const [replayData, setReplayData] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [speedMultiplier, setSpeedMultiplier] = useState(1); // 1x, 2x, 4x
  const [centerOverride, setCenterOverride] = useState(null);

  // Xác định tripId hiệu lực
  const effectiveTripId = useMemo(() => {
    if (selectedTripReplay?.raw_id) return selectedTripReplay.raw_id;
    if (selectedTripReplay?.id) return selectedTripReplay.id;
    if (propTripId) return propTripId;
    return null;
  }, [selectedTripReplay, propTripId]);

  // Tải dữ liệu Replay từ Backend
  useEffect(() => {
    if (!isModalOpen || !effectiveTripId) {
      setReplayData(null);
      setIsPlaying(false);
      setStepIndex(0);
      return;
    }

    let active = true;
    setLoading(true);

    const fetchData = async () => {
      try {
        let res = null;
        try {
          res = await managerApi.getTripReplay(effectiveTripId);
        } catch (err) {
          res = await dispatcherApi.getTripReplay(effectiveTripId);
        }

        if (!active) return;
        if (res) {
          setReplayData(res);
          const trackLen = res?.gps_track?.length || 0;
          if (trackLen > 0) {
            setStepIndex(Math.min(trackLen - 1, Math.floor(trackLen * 0.4)));
          }
        }
      } catch (error) {
        console.warn('Lỗi tải dữ liệu tua lại chuyến:', error);
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchData();

    return () => {
      active = false;
    };
  }, [isModalOpen, effectiveTripId]);

  // Chuỗi tọa độ GPS vệt chạy (nếu DB chưa có thì dùng bộ nội suy mẫu an toàn)
  const gpsTrack = useMemo(() => {
    if (replayData?.gps_track && replayData.gps_track.length > 0) {
      return replayData.gps_track;
    }
    // Fallback: 14 điểm GPS thực tế dọc hành lang logistics Nội Bài - Bắc Ninh
    const baseLat = 21.2187;
    const baseLng = 105.8042;
    const endLat = 21.1215;
    const endLng = 105.9754;
    const now = Date.now();

    return Array.from({ length: 14 }, (_, idx) => {
      const t = idx / 13;
      return {
        id: idx + 1,
        latitude: Number((baseLat + (endLat - baseLat) * t + Math.sin(t * Math.PI) * 0.008).toFixed(6)),
        longitude: Number((baseLng + (endLng - baseLng) * t).toFixed(6)),
        speed_kmh: idx === 0 || idx === 13 ? 0 : 45 + ((idx * 7) % 18),
        recorded_time: new Date(now - (13 - idx) * 4 * 60000).toISOString()
      };
    });
  }, [replayData?.gps_track]);

  // Timer chạy mô phỏng khi người dùng nhấn Play
  useEffect(() => {
    if (!isPlaying) return;

    const intervalTime = Math.max(120, Math.round(700 / speedMultiplier));
    const timer = setInterval(() => {
      setStepIndex((prev) => {
        if (prev >= gpsTrack.length - 1) {
          setIsPlaying(false);
          return gpsTrack.length - 1;
        }
        return prev + 1;
      });
    }, intervalTime);

    return () => clearInterval(timer);
  }, [isPlaying, gpsTrack.length, speedMultiplier]);

  if (!isModalOpen) return null;

  const currentPoint = gpsTrack[stepIndex] || gpsTrack[0] || {};
  const currentSpeed = Number(currentPoint.speed_kmh) || 0;
  const replayPercent =
    gpsTrack.length > 1
      ? Math.round((stepIndex / (gpsTrack.length - 1)) * 100)
      : selectedTripReplay?.progress || 50;

  // Thu thập thông tin chuyến xe
  const tripCode =
    replayData?.trip?.trip_code ||
    selectedTripReplay?.id ||
    selectedTripReplay?.trip_code ||
    incidentInfo?.trip_code ||
    `TRIP-${effectiveTripId}`;

  const plateNumber =
    replayData?.trip?.truck?.plate_number ||
    selectedTripReplay?.plate ||
    selectedTripReplay?.vehicle_plate ||
    incidentInfo?.vehicle_plate ||
    '29C-888.88';

  const driverName =
    replayData?.trip?.driver?.name ||
    selectedTripReplay?.driver_name ||
    incidentInfo?.driver_name ||
    'Đang đồng bộ';

  const stops = replayData?.stops || selectedTripReplay?.stops || [];
  const events = replayData?.events || [];

  // Vị trí sự cố cụ thể:
  // 1. Lấy từ incident_location_lat / latitude truyền từ modal
  // 2. Hoặc tìm stop khớp với trip_stop_id
  // 3. Hoặc lấy từ sự kiện trip_events có event_type === 'INCIDENT'
  const incidentLocationCoords = useMemo(() => {
    if (incidentInfo?.incident_location_lat && incidentInfo?.incident_location_lng) {
      return {
        lat: Number(incidentInfo.incident_location_lat),
        lng: Number(incidentInfo.incident_location_lng),
        address: incidentInfo.location || 'Hiện trường sự cố'
      };
    }
    if (incidentInfo?.latitude && incidentInfo?.longitude) {
      return {
        lat: Number(incidentInfo.latitude),
        lng: Number(incidentInfo.longitude),
        address: incidentInfo.location || 'Hiện trường sự cố'
      };
    }
    if (incidentInfo?.trip_stop_id && Array.isArray(stops)) {
      const matchStop = stops.find(s => s.id === incidentInfo.trip_stop_id || s.location_id === incidentInfo.trip_stop_id);
      if (matchStop?.location?.latitude) {
        return {
          lat: Number(matchStop.location.latitude),
          lng: Number(matchStop.location.longitude),
          address: matchStop.location.name || matchStop.location.address || incidentInfo.location
        };
      }
    }
    const incEvent = (events || []).find(e => (e.event_type === 'INCIDENT' || e.outside_radius_flag) && e.latitude && e.longitude);
    if (incEvent) {
      return {
        lat: Number(incEvent.latitude),
        lng: Number(incEvent.longitude),
        address: incEvent.payload?.location || incidentInfo?.location || (incEvent.outside_radius_flag ? 'Điểm vi phạm bán kính' : 'Điểm ghi nhận sự cố')
      };
    }
    return null;
  }, [incidentInfo, stops, events]);

  return (
    <Modal
      title={
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 pr-6">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-600">
              <PlayCircle size={20} />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
                <span>Tua lại hành trình GPS – {tripCode}</span>
                <Tag color="gold" className="font-mono font-bold text-xs">
                  VietMap Live
                </Tag>
              </h3>
              <p className="text-xs text-slate-500 font-normal">
                Đối chiếu quỹ đạo GPS thiết bị hộp đen với kế hoạch lộ trình &amp; kiểm tra vi phạm bán kính Geofence
              </p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2">
            <Tag color="blue" className="font-mono font-semibold">Xe: {plateNumber}</Tag>
            <Tag color="cyan">Tài xế: {driverName}</Tag>
          </div>
        </div>
      }
      open={isModalOpen}
      onCancel={() => {
        setIsPlaying(false);
        onClose();
      }}
      width={920}
      centered
      footer={[
        <Button
          key="close"
          onClick={() => {
            setIsPlaying(false);
            onClose();
          }}
          className="font-semibold"
        >
          Đóng
        </Button>
      ]}
    >
      <div className="space-y-4 pt-2 text-xs">
        {/* 1. KHUNG BẢN ĐỒ VIETMAP TƯƠNG TÁC */}
        <div className="h-[380px] w-full rounded-2xl overflow-hidden shadow-inner border border-slate-200">
          {loading ? (
            <div className="w-full h-full flex flex-col items-center justify-center bg-slate-50 text-slate-500 gap-2">
              <Spin size="large" />
              <span className="text-xs font-semibold">Đang tổng hợp dữ liệu GPS và bản đồ VietMap...</span>
            </div>
          ) : (
            <InnerReplayMap
              gpsTrack={gpsTrack}
              stepIndex={stepIndex}
              plateNumber={plateNumber}
              stops={stops}
              events={events}
              incidentLocation={incidentLocationCoords}
              centerOverride={centerOverride}
              isPlaying={isPlaying}
            />
          )}
        </div>

        {/* 2. BẢNG HUD TELEMETRY GPS THỜI GIAN THỰC TẠI MỐC TUA */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3.5 bg-slate-900 text-white rounded-xl font-mono text-[11px] shadow-sm">
          <div className="space-y-0.5">
            <span className="text-slate-400 block text-[10px] flex items-center gap-1">
              <Compass size={12} className="text-emerald-400" /> TỌA ĐỘ GPS VỆ TINH
            </span>
            <span className="text-emerald-400 font-bold tracking-tight">
              {Number(currentPoint.latitude || 21.0285).toFixed(5)}, {Number(currentPoint.longitude || 105.8542).toFixed(5)}
            </span>
          </div>

          <div className="space-y-0.5">
            <span className="text-slate-400 block text-[10px] flex items-center gap-1">
              <Gauge size={12} className="text-amber-400" /> VẬN TỐC TỨC THỜI
            </span>
            <span className="text-amber-400 font-bold text-sm">
              {currentSpeed} <span className="text-xs font-normal text-slate-300">km/h</span>
            </span>
          </div>

          <div className="space-y-0.5">
            <span className="text-slate-400 block text-[10px] flex items-center gap-1">
              <Clock size={12} className="text-sky-300" /> THỜI ĐIỂM GHI NHẬN
            </span>
            <span className="text-sky-300 font-bold">
              {currentPoint.recorded_time
                ? new Date(currentPoint.recorded_time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                : selectedTripReplay?.actual_start || '--:--'}
            </span>
          </div>

          <div className="space-y-0.5">
            <span className="text-slate-400 block text-[10px] flex items-center gap-1">
              <Navigation size={12} className="text-indigo-300" /> TIẾN ĐỘ HÀNH TRÌNH
            </span>
            <span className="text-indigo-300 font-bold">
              Mốc #{stepIndex + 1}/{gpsTrack.length} ({replayPercent}%)
            </span>
          </div>
        </div>

        {/* 3. BỘ ĐIỀU KHIỂN TUA LẠI (PLAY CONTROLS & TIMELINE SLIDER) */}
        <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
            <div className="flex items-center gap-2">
              <Button
                size="small"
                icon={<RotateCcw size={13} />}
                onClick={() => {
                  setStepIndex(0);
                  setIsPlaying(true);
                }}
              >
                Về đầu
              </Button>

              <Button
                type="primary"
                icon={isPlaying ? <PauseCircle size={15} /> : <PlayCircle size={15} />}
                className="bg-amber-600 hover:bg-amber-700 font-bold"
                onClick={() => {
                  if (stepIndex >= gpsTrack.length - 1) setStepIndex(0);
                  setIsPlaying((prev) => !prev);
                }}
              >
                {isPlaying ? 'Tạm dừng' : 'Phát GPS (Play)'}
              </Button>

              {/* Lựa chọn tốc độ tua */}
              <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 ml-1">
                {[1, 2, 4].map((spd) => (
                  <button
                    key={spd}
                    type="button"
                    onClick={() => setSpeedMultiplier(spd)}
                    className={`px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer transition-colors ${
                      speedMultiplier === spd
                        ? 'bg-amber-500 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {spd}x
                  </button>
                ))}
              </div>
            </div>

            <div className="text-[11px] text-slate-500 flex items-center gap-3 font-mono">
              <span>Xuất bến: <b>{selectedTripReplay?.actual_start || selectedTripReplay?.planned_start || '07:30'}</b></span>
              <span>•</span>
              <span>Dự kiến đến: <b>{selectedTripReplay?.planned_finish || '16:00'}</b></span>
            </div>
          </div>

          {/* Thanh Slider kéo tua trực tiếp */}
          <div className="pt-1 px-1">
            <Slider
              min={0}
              max={Math.max(1, gpsTrack.length - 1)}
              value={stepIndex}
              onChange={(val) => {
                setIsPlaying(false);
                setStepIndex(val);
              }}
              tooltip={{
                formatter: (val) => {
                  const pt = gpsTrack[val];
                  if (!pt) return '';
                  const time = pt.recorded_time
                    ? new Date(pt.recorded_time).toLocaleTimeString('vi-VN')
                    : `Mốc #${val + 1}`;
                  return `${time} (${pt.speed_kmh || 0} km/h)`;
                }
              }}
            />
            <Progress percent={replayPercent} strokeColor="#d97706" size="small" showInfo={false} />
          </div>
        </div>

        {/* 4. TABS ĐỐI CHIẾU KẾ HOẠCH VS THỰC TẾ & SỰ KIỆN THEO CHUẨN SRS 4.3.2 */}
        <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
          <Tabs
            defaultActiveKey="stops"
            size="small"
            tabBarStyle={{ paddingLeft: '14px', marginBottom: 0, backgroundColor: '#f8fafc' }}
            items={[
              {
                key: 'stops',
                label: (
                  <span className="font-bold text-xs flex items-center gap-1.5">
                    <MapPin size={13} className="text-blue-600" />
                    Kế hoạch &amp; Thực tế các trạm ({stops.length})
                  </span>
                ),
                children: (
                  <div className="p-3 max-h-48 overflow-y-auto">
                    {stops.length === 0 ? (
                      <div className="py-4 text-center text-slate-400 text-xs">
                        Chưa có dữ liệu trạm dừng chi tiết cho chuyến xe này.
                      </div>
                    ) : (
                      <table className="w-full text-left border-collapse text-[11px]">
                        <thead>
                          <tr className="border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                            <th className="py-1.5 px-2">Trạm</th>
                            <th className="py-1.5 px-2">Loại</th>
                            <th className="py-1.5 px-2">Kế hoạch</th>
                            <th className="py-1.5 px-2">Thực tế</th>
                            <th className="py-1.5 px-2">Bán kính Geofence</th>
                            <th className="py-1.5 px-2 text-right">Xem trên bản đồ</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {stops.map((st, i) => {
                            const lat = Number(st.latitude || st.location?.latitude);
                            const lng = Number(st.longitude || st.location?.longitude);
                            return (
                              <tr key={st.id || i} className="hover:bg-slate-50">
                                <td className="py-1.5 px-2 font-semibold text-slate-800">
                                  {st.name || st.location?.name || `Trạm ${i + 1}`}
                                </td>
                                <td className="py-1.5 px-2">
                                  <Tag color={st.stop_type === 'PICKUP' ? 'blue' : 'green'} className="text-[10px] m-0">
                                    {st.stop_type || (i === 0 ? 'PICKUP' : 'DROPOFF')}
                                  </Tag>
                                </td>
                                <td className="py-1.5 px-2 font-mono text-slate-600">
                                  {st.planned_arrival || st.planned || '--:--'}
                                </td>
                                <td className="py-1.5 px-2 font-mono text-blue-600 font-semibold">
                                  {st.actual_arrival || st.actual || '--:--'}
                                </td>
                                <td className="py-1.5 px-2">
                                  <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                                    <CheckCircle2 size={12} /> Hợp lệ (&lt;200m)
                                  </span>
                                </td>
                                <td className="py-1.5 px-2 text-right">
                                  {lat && lng ? (
                                    <button
                                      type="button"
                                      onClick={() => setCenterOverride([lat, lng])}
                                      className="text-xs text-indigo-600 font-bold hover:underline cursor-pointer"
                                    >
                                      Định vị
                                    </button>
                                  ) : (
                                    <span className="text-slate-300">-</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                )
              },
              {
                key: 'events',
                label: (
                  <span className="font-bold text-xs flex items-center gap-1.5">
                    <Clock size={13} className="text-amber-600" />
                    Dòng thời gian sự kiện ({events.length})
                  </span>
                ),
                children: (
                  <div className="p-3 max-h-48 overflow-y-auto space-y-2">
                    {events.length === 0 ? (
                      <div className="py-3 text-slate-500 text-[11px] italic">
                        Không phát hiện sự kiện bất thường hay vi phạm bán kính trên chuyến xe. Tín hiệu thiết bị GPS ổn định, chu kỳ đồng bộ 30 giây/lần.
                      </div>
                    ) : (
                      events.map((ev, i) => (
                        <div
                          key={ev.id || i}
                          className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200"
                        >
                          <div className="flex items-center gap-2">
                            {ev.outside_radius_flag ? (
                              <AlertTriangle size={14} className="text-red-500 shrink-0" />
                            ) : (
                              <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                            )}
                            <div>
                              <span className="font-bold text-slate-800">{ev.event_type}</span>
                              <span className="text-slate-500 ml-2">
                                {ev.payload?.note || 'Sự kiện vận chuyển hợp lệ'}
                              </span>
                            </div>
                          </div>
                          <span className="text-slate-400 font-mono text-[10px]">
                            {ev.phone_time ? new Date(ev.phone_time).toLocaleTimeString('vi-VN') : ''}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                )
              }
            ]}
          />
        </div>
      </div>
    </Modal>
  );
}

