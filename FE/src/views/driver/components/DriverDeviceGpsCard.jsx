"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { Navigation, Radio, LocateFixed, CheckCircle2, AlertCircle, Code2 } from "lucide-react";
import { driverApi } from "../../../api/driverApi";

const LIVE_SEND_INTERVAL_MS = 4000;

export default function DriverDeviceGpsCard({ trip, message }) {
  const [gpsData, setGpsData] = useState(null);
  const [syncInfo, setSyncInfo] = useState(null);
  const [statusText, setStatusText] = useState("Sẵn sàng lấy tọa độ GPS thiết bị");
  const [errorText, setErrorText] = useState("");
  const [fetching, setFetching] = useState(false);
  const [isLiveTracking, setIsLiveTracking] = useState(false);
  const [showRawJson, setShowRawJson] = useState(false);

  const watchIdRef = useRef(null);
  const lastSentAtRef = useRef(0);

  const formatPositionPayload = (position) => ({
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracy: position.coords.accuracy,
    altitude: position.coords.altitude,
    heading: position.coords.heading,
    speed: position.coords.speed,
    timestamp: new Date(position.timestamp).toISOString(),
  });

  const tripId = trip?.id || null;

  const pushPositionToServer = useCallback(
    async (data, { silent = false } = {}) => {
      try {
        const res = await driverApi.sendDeviceGps({
          ...data,
          trip_id: tripId,
        });
        setSyncInfo(res);
        setErrorText("");
        if (res?.synced_to_map) {
          setStatusText(
            `Đã đồng bộ lên bản đồ điều phối${res.truck_plate ? ` (${res.truck_plate})` : ""}`,
          );
        } else {
          setStatusText("Đã ghi nhận GPS thiết bị (chưa có chuyến xe đang chạy)");
        }
        if (!silent && message) {
          message.success(
            res?.synced_to_map
              ? "Đã gửi tọa độ GPS thực tế lên bản đồ theo dõi!"
              : "Đã lấy tọa độ GPS thiết bị thành công!",
          );
        }
      } catch (err) {
        const errMsg = err?.message || "Không thể gửi GPS lên máy chủ";
        setErrorText(errMsg);
        if (!silent && message) {
          message.warning(errMsg);
        }
      }
    },
    [tripId, message],
  );

  const handleGetGpsOnce = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setErrorText("Trình duyệt không hỗ trợ Geolocation.");
      return;
    }

    setFetching(true);
    setErrorText("");
    setStatusText("Đang định vị GPS thiết bị...");

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const data = formatPositionPayload(position);
        setGpsData(data);
        await pushPositionToServer(data, { silent: false });
        setFetching(false);
      },
      (error) => {
        setFetching(false);
        setErrorText(`Lỗi GPS: ${error.message}`);
        setStatusText("Không lấy được tọa độ GPS");
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      },
    );
  };

  const stopLiveTracking = useCallback(() => {
    if (
      watchIdRef.current !== null &&
      typeof navigator !== "undefined" &&
      navigator.geolocation
    ) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsLiveTracking(false);
    setStatusText("Đã dừng phát GPS liên tục");
  }, []);

  const handleToggleLiveTracking = () => {
    if (isLiveTracking) {
      stopLiveTracking();
      return;
    }

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setErrorText("Trình duyệt không hỗ trợ Geolocation.");
      return;
    }

    setErrorText("");
    setIsLiveTracking(true);
    setStatusText("Đang phát GPS trực tiếp lên bản đồ...");
    lastSentAtRef.current = 0;

    watchIdRef.current = navigator.geolocation.watchPosition(
      async (position) => {
        const data = formatPositionPayload(position);
        setGpsData(data);
        const now = Date.now();
        if (now - lastSentAtRef.current >= LIVE_SEND_INTERVAL_MS) {
          lastSentAtRef.current = now;
          await pushPositionToServer(data, { silent: true });
        }
      },
      (error) => {
        setErrorText(`Lỗi GPS: ${error.message}`);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      },
    );
  };

  useEffect(() => {
    return () => {
      if (
        watchIdRef.current !== null &&
        typeof navigator !== "undefined" &&
        navigator.geolocation
      ) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  const speedKmh =
    gpsData?.speed !== null && gpsData?.speed !== undefined
      ? (Number(gpsData.speed) * 3.6).toFixed(1)
      : "0.0";

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center ${
              isLiveTracking
                ? "bg-emerald-50 text-emerald-600"
                : "bg-indigo-50 text-indigo-600"
            }`}
          >
            {isLiveTracking ? (
              <Radio size={18} className="animate-pulse" />
            ) : (
              <Navigation size={18} />
            )}
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 m-0 leading-tight">
              GPS Thiết bị thực tế (Live Demo)
            </h3>
            <p className="text-[11px] text-slate-500 m-0 mt-0.5">{statusText}</p>
          </div>
        </div>

        {syncInfo?.synced_to_map && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
            <CheckCircle2 size={11} /> Live Map
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={handleGetGpsOnce}
          disabled={fetching}
          className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 disabled:opacity-60 transition cursor-pointer"
        >
          <LocateFixed size={15} className={fetching ? "animate-spin" : ""} />
          <span>{fetching ? "Đang lấy GPS..." : "Lấy vị trí ngay"}</span>
        </button>

        <button
          type="button"
          onClick={handleToggleLiveTracking}
          className={`flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer border ${
            isLiveTracking
              ? "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100"
              : "bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700"
          }`}
        >
          <Radio size={15} className={isLiveTracking ? "animate-pulse" : ""} />
          <span>{isLiveTracking ? "Dừng phát GPS" : "Phát GPS trực tiếp"}</span>
        </button>
      </div>

      {errorText && (
        <div className="flex items-start gap-2 px-3 py-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
          <AlertCircle size={14} className="shrink-0 mt-0.5" />
          <span>{errorText}</span>
        </div>
      )}

      {gpsData && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
              <div className="text-[10px] text-slate-400 uppercase font-semibold">
                Vĩ độ (Lat)
              </div>
              <div className="font-mono font-bold text-slate-800 mt-0.5">
                {gpsData.latitude.toFixed(6)}
              </div>
            </div>
            <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
              <div className="text-[10px] text-slate-400 uppercase font-semibold">
                Kinh độ (Lng)
              </div>
              <div className="font-mono font-bold text-slate-800 mt-0.5">
                {gpsData.longitude.toFixed(6)}
              </div>
            </div>
            <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
              <div className="text-[10px] text-slate-400 uppercase font-semibold">
                Độ chính xác
              </div>
              <div className="font-mono font-bold text-slate-800 mt-0.5">
                ±{Math.round(gpsData.accuracy || 0)} m
              </div>
            </div>
            <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
              <div className="text-[10px] text-slate-400 uppercase font-semibold">
                Tốc độ
              </div>
              <div className="font-mono font-bold text-slate-800 mt-0.5">
                {speedKmh} km/h
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-500">
            <span>
              Cập nhật:{" "}
              {new Date(gpsData.timestamp).toLocaleTimeString("vi-VN")}
              {syncInfo?.trip_code ? ` · Chuyến ${syncInfo.trip_code}` : ""}
            </span>
            <button
              type="button"
              onClick={() => setShowRawJson((v) => !v)}
              className="inline-flex items-center gap-1 text-indigo-600 font-semibold hover:underline bg-transparent border-0 p-0 cursor-pointer"
            >
              <Code2 size={12} />
              <span>{showRawJson ? "Ẩn JSON" : "Xem JSON"}</span>
            </button>
          </div>

          {showRawJson && (
            <pre className="p-3 rounded-xl bg-slate-900 text-emerald-300 text-[11px] font-mono overflow-x-auto m-0">
              {JSON.stringify(gpsData, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
