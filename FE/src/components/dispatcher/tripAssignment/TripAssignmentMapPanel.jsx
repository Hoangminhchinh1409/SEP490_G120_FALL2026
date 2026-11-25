import React from 'react';
import dynamic from 'next/dynamic';

const TripAssignmentMap = dynamic(() => import('../TripAssignmentMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full min-h-[340px] flex items-center justify-center text-xs text-gray-500 bg-slate-50">
      Đang tải bản đồ số tuyến đường...
    </div>
  )
});

export default function TripAssignmentMapPanel({
  stopsWithLiveEta,
  routePolyline,
  trafficSegments,
  trafficSummary,
  loadingRoute,
  routeSummary,
  currentFleetItem,
  selectedTruckSpec
}) {
  return (
    <div className="lg:col-span-5 flex flex-col justify-between">
      <div className="border border-gray-300 rounded overflow-hidden h-full flex flex-col bg-white">
        <div className="p-2 border-b border-gray-200 bg-gray-50 text-xs font-semibold text-gray-700 flex items-center justify-between">
          <span>Bản đồ Giao thông &amp; ETA Thời gian thực</span>
          <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded font-mono font-bold">
            VietMap Live Traffic &amp; Tilemap
          </span>
        </div>

        {/* Thanh cảnh báo mật độ giao thông & ETA trực tiếp */}
        {trafficSummary && (
          <div
            className={`px-2.5 py-1.5 border-b text-[11px] flex flex-wrap items-center justify-between gap-1.5 ${
              trafficSummary.status === 'CONGESTED'
                ? 'bg-red-50 border-red-200 text-red-800'
                : trafficSummary.status === 'SLOW'
                  ? 'bg-amber-50 border-amber-200 text-amber-900'
                  : 'bg-emerald-50/70 border-emerald-200 text-emerald-800'
            }`}
          >
            <div className="font-semibold">
              {trafficSummary.status === 'CONGESTED' ? (
                <span>
                  🔴 Đang ùn tắc trên: <b>{trafficSummary.congestedRoads.join(', ')}</b>
                  {trafficSummary.slowRoads?.length > 0 && (
                    <span> · Đông xe: {trafficSummary.slowRoads.join(', ')}</span>
                  )}
                </span>
              ) : trafficSummary.status === 'SLOW' ? (
                <span>
                  🟠 Đông xe di chuyển chậm trên: <b>{trafficSummary.slowRoads.join(', ')}</b>
                </span>
              ) : (
                <span>🟢 Toàn tuyến thông thoáng, không có điểm ùn tắc</span>
              )}
            </div>
            <div className="font-mono font-bold shrink-0">
              TB {trafficSummary.avgSpeedKmh} km/h
              {trafficSummary.delayMins > 0 ? ` · Trễ +${trafficSummary.delayMins}p` : ''}
              {routeSummary.etaText ? ` · Dự kiến đến ${routeSummary.etaText}` : ''}
            </div>
          </div>
        )}

        <div className="flex-1 min-h-[340px] relative">
          <TripAssignmentMap
            stops={stopsWithLiveEta}
            routePolyline={routePolyline}
            trafficSegments={trafficSegments}
            trafficSummary={trafficSummary}
            loadingRoute={loadingRoute}
          />
        </div>

        <div className="p-2 bg-white border-t border-gray-200 text-[11px] text-gray-700 font-mono flex items-center justify-between">
          <span>{stopsWithLiveEta.map((s) => s.badge).join(' → ')}</span>
          <span>
            {routeSummary.distanceKm} km · {Math.floor(routeSummary.durationMins / 60)}h
            {routeSummary.durationMins % 60}ph
            {stopsWithLiveEta.length > 0 &&
            stopsWithLiveEta[stopsWithLiveEta.length - 1]?.liveEtaTime
              ? ` · Hoàn tất ${stopsWithLiveEta[stopsWithLiveEta.length - 1].liveEtaTime}`
              : ''}
          </span>
          <span>
            {currentFleetItem.plate} ({selectedTruckSpec.shortLabel})
          </span>
        </div>
      </div>
    </div>
  );
}
