"use client";
import React from "react";
import { Tag, Button } from "antd";
import {
  MapPin,
  Camera,
  CheckCircle,
  AlertTriangle,
  Navigation2,
  Clock,
  DollarSign,
  Ban,
} from "lucide-react";
import Link from "next/link";
import { orderApi } from "../../../api/orderApi";
import {
  isPickupStop,
  isReturnWarehouseStop,
  isDropoffStop,
  formatStopStatus,
} from "./driverDashboardHelpers";

export default function DriverWorkflowControlBox({
  trip,
  currentStop,
  stops,
  actionLoading,
  setActionLoading,
  setActiveStopTarget,
  setExtraFeeModalOpen,
  setSealModalOpen,
  setPodModalOpen,
  setRefusalModalOpen,
  handleOpenNavigation,
  handleArriveStop,
  handleStartLoading,
  handleLeftStop,
  fetchDashboardData,
  setSelectedTripId,
  setTripData,
  message,
}) {
  if (!trip) return null;

  return (
    <div className="bg-slate-800/90 backdrop-blur-md border border-slate-700/60 rounded-2xl p-3 mb-4 shadow-2xl">
      {/* Header Toolbar: Title on left, Action pills on right (1 clean row on all screen sizes, never overflows) */}
      <div className="flex items-center justify-between gap-1 mb-3">
        <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5 shrink-0">
          <Navigation2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
          <span>Thao tác chuyến xe</span>
        </span>

        {trip.status !== "Completed" && (
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => {
                setActiveStopTarget(currentStop);
                setExtraFeeModalOpen(true);
              }}
              style={{ whiteSpace: "nowrap", flexShrink: 0 }}
              className="text-[10px] font-bold text-amber-300 hover:text-amber-200 flex items-center gap-1 bg-amber-500/15 hover:bg-amber-500/25 px-2 py-1 rounded-lg border border-amber-500/35 transition-all shrink-0 active:scale-95 shadow-sm"
              title="Đề xuất phụ phí phát sinh"
            >
              <DollarSign size={11} className="text-amber-400 shrink-0" />
              <span>Đề xuất phí</span>
            </button>

            <Link
              href={`/driver/incidents?trip_id=${trip.id}`}
              style={{
                backgroundColor: "#dc2626",
                color: "#ffffff",
                border: "1px solid #ef4444",
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: "3.5px",
                padding: "3px 7.5px",
                borderRadius: "8px",
                fontSize: "10px",
                fontWeight: "700",
                boxShadow: "0 2px 6px rgba(220, 38, 38, 0.45)",
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
              className="shrink-0 transition-transform active:scale-95 cursor-pointer hover:opacity-90"
              title="Báo cáo sự cố trên đường"
            >
              <AlertTriangle
                size={11}
                color="#ffffff"
                style={{ color: "#ffffff", stroke: "#ffffff" }}
                className="shrink-0"
              />
              <span style={{ color: "#ffffff", fontWeight: "700" }}>
                Báo sự cố
              </span>
            </Link>
          </div>
        )}
      </div>

      {/* Auto vào thực hiện chuỗi 4 bước cho chuyến xe được điều phối */}
      {trip.status !== "Completed" && currentStop && (
        <div className="space-y-3">
          <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-700 flex justify-between items-center">
            <div>
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="text-[10px] text-slate-400 font-bold uppercase">
                  Điểm dừng tiếp theo
                </span>
                <Tag
                  color="processing"
                  className="font-bold text-[10px] m-0 py-0"
                >
                  #{currentStop.sequence}
                </Tag>
              </div>
              <p className="text-white font-bold text-xs">
                {currentStop.location?.name || currentStop.location?.address}
              </p>
            </div>
            <button
              onClick={() =>
                handleOpenNavigation(
                  currentStop.location?.address,
                  currentStop.location?.latitude,
                  currentStop.location?.longitude,
                )
              }
              className="p-2.5 bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 rounded-xl border border-blue-500/40"
              title="Mở Google Maps"
            >
              <MapPin size={18} />
            </button>
          </div>

          {/* 4-Step Progress Stepper (BR-36, Workflow Spec Giai đoạn 3) */}
          <div className="bg-slate-900/60 p-3 rounded-2xl border border-slate-700/80 mb-2">
            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-2 flex justify-between items-center">
              <span>
                Tiến trình điểm dừng #{currentStop.sequence} (Chuỗi 4 bước)
              </span>
              <span className="text-blue-300 font-mono">
                {formatStopStatus(
                  currentStop.status,
                  isPickupStop(currentStop) ? "Pickup" : "Drop-off",
                )}
              </span>
            </div>
            <div className="grid grid-cols-4 gap-1.5 text-center text-[10px] font-bold">
              {/* Step 1: Arrived */}
              <div
                className={`p-2 rounded-xl border transition-all ${
                  currentStop.status !== "Pending"
                    ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                    : "bg-blue-600/30 border-blue-500 text-blue-200 animate-pulse"
                }`}
              >
                <span className="block text-xs mb-0.5">
                  {currentStop.status !== "Pending" ? "✓" : "1"}
                </span>
                <span>Đã đến</span>
              </div>

              {/* Step 2: Loading Started */}
              <div
                className={`p-2 rounded-xl border transition-all ${
                  ["Loading Started", "Loading Done", "Done"].includes(
                    currentStop.status,
                  )
                    ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                    : currentStop.status === "Arrived"
                      ? "bg-blue-600/30 border-blue-500 text-blue-200 animate-pulse"
                      : "bg-slate-800 border-slate-700 text-slate-500"
                }`}
              >
                <span className="block text-xs mb-0.5">
                  {["Loading Started", "Loading Done", "Done"].includes(
                    currentStop.status,
                  )
                    ? "✓"
                    : "2"}
                </span>
                <span>Bắt đầu</span>
              </div>

              {/* Step 3: Loading Done */}
              <div
                className={`p-2 rounded-xl border transition-all ${
                  ["Loading Done", "Done"].includes(currentStop.status)
                    ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                    : currentStop.status === "Loading Started"
                      ? "bg-blue-600/30 border-blue-500 text-blue-200 animate-pulse"
                      : "bg-slate-800 border-slate-700 text-slate-500"
                }`}
              >
                <span className="block text-xs mb-0.5">
                  {["Loading Done", "Done"].includes(currentStop.status)
                    ? "✓"
                    : "3"}
                </span>
                <span>
                  {isPickupStop(currentStop) ? "Bốc/Chì" : "Dỡ/POD"}
                </span>
              </div>

              {/* Step 4: Left */}
              <div
                className={`p-2 rounded-xl border transition-all ${
                  currentStop.status === "Done"
                    ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                    : currentStop.status === "Loading Done"
                      ? "bg-blue-600/30 border-blue-500 text-blue-200 animate-pulse"
                      : "bg-slate-800 border-slate-700 text-slate-500"
                }`}
              >
                <span className="block text-xs mb-0.5">
                  {currentStop.status === "Done" ? "✓" : "4"}
                </span>
                <span>Rời đi</span>
              </div>
            </div>
          </div>

          {/* Step 1: If Pending -> Arrive Button */}
          {currentStop.status === "Pending" && (
            <Button
              type="primary"
              size="large"
              loading={actionLoading}
              onClick={() => handleArriveStop(trip.id, currentStop.id)}
              className="w-full bg-blue-600 hover:bg-blue-500 border-none font-bold rounded-xl h-auto py-2.5 shadow-lg shadow-blue-600/30 flex items-center justify-center text-center text-white"
            >
              <div className="flex flex-col items-center justify-center w-full leading-tight">
                <span className="text-xs font-black flex items-center gap-1.5">
                  <MapPin size={15} /> BƯỚC 1: ĐÃ ĐẾN NƠI (ARRIVED)
                </span>
                <span className="text-[10px] font-normal opacity-85">
                  Ghi nhận mốc giờ thực tế
                </span>
              </div>
            </Button>
          )}

          {/* Step 2: If Arrived -> Bắt đầu bốc / dỡ (Loading Started - BR-30) */}
          {currentStop.status === "Arrived" && (
            <div className="space-y-2">
              <Button
                type="primary"
                size="large"
                loading={actionLoading}
                onClick={() => handleStartLoading(trip.id, currentStop.id)}
                className="w-full bg-amber-600 hover:bg-amber-500 border-none rounded-xl h-auto py-2.5 shadow-lg shadow-amber-600/30 flex items-center justify-center text-center text-white"
              >
                <div className="flex flex-col items-center justify-center w-full leading-tight">
                  <span className="text-xs font-black flex items-center gap-1.5">
                    <Clock size={15} /> BƯỚC 2:{" "}
                    {isReturnWarehouseStop(currentStop)
                      ? "BẮT ĐẦU HẠ HÀNG HOÀN VÀO KHO ALS"
                      : "BẮT ĐẦU BỐC / DỠ"}
                  </span>
                  <span className="text-[10px] font-normal opacity-85">
                    {isReturnWarehouseStop(currentStop)
                      ? "Xác nhận bắt đầu dỡ hàng bị từ chối xuống Kho ALS"
                      : "Xác nhận bắt đầu bốc dỡ"}
                  </span>
                </div>
              </Button>

              {/* Nút Khách không nhận hàng ngay khi xe vừa đến điểm giao */}
              {isDropoffStop(currentStop) &&
                !isReturnWarehouseStop(currentStop) &&
                currentStop.order?.order_type !== "Export" && (
                  <Button
                    danger
                    size="large"
                    onClick={() => {
                      setActiveStopTarget(currentStop);
                      setRefusalModalOpen(true);
                    }}
                    className="w-full !bg-red-600/20 hover:!bg-red-600/35 !border !border-red-500/50 !text-red-200 rounded-xl h-auto py-2 flex items-center justify-center text-center"
                  >
                    <div className="flex flex-col items-center justify-center w-full leading-tight">
                      <span className="text-xs font-bold flex items-center gap-1.5 text-red-300">
                        <Ban size={14} /> KHÁCH KHÔNG NHẬN HÀNG (TỪ CHỐI NHẬN)
                      </span>
                      <span className="text-[10px] font-normal text-red-200/80">
                        Báo cáo lý do & chụp ảnh để Điều phối viên điều về Kho
                        ALS
                      </span>
                    </div>
                  </Button>
                )}
            </div>
          )}

          {/* Step 3: If Loading Started & Pickup -> Bốc hàng & Niêm chì Modal */}
          {currentStop.status === "Loading Started" &&
            isPickupStop(currentStop) && (
              <Button
                type="primary"
                size="large"
                onClick={() => {
                  setActiveStopTarget(currentStop);
                  setSealModalOpen(true);
                }}
                className="w-full bg-indigo-600 hover:bg-indigo-500 border-none rounded-xl h-auto py-2.5 shadow-lg shadow-indigo-600/30 flex items-center justify-center text-center text-white"
              >
                <div className="flex flex-col items-center justify-center w-full leading-tight">
                  <span className="text-xs font-black flex items-center gap-1.5">
                    <Camera size={15} /> BƯỚC 3: BỐC HÀNG & ẢNH CHÌ
                  </span>
                  <span className="text-[10px] font-normal opacity-85">
                    Chụp ảnh seal & xác nhận số lượng
                  </span>
                </div>
              </Button>
            )}

          {/* Step 3: If Loading Started & Drop-off -> Giao hàng & POD Modal (hoặc Hạ hàng hoàn kho ALS) */}
          {currentStop.status === "Loading Started" &&
            isDropoffStop(currentStop) && (
              <div className="space-y-2">
                <Button
                  type="primary"
                  size="large"
                  onClick={() => {
                    setActiveStopTarget(currentStop);
                    setPodModalOpen(true);
                  }}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 border-none rounded-xl h-auto py-2.5 shadow-lg shadow-emerald-600/30 flex items-center justify-center text-center text-white"
                >
                  <div className="flex flex-col items-center justify-center w-full leading-tight">
                    <span className="text-xs font-black flex items-center gap-1.5">
                      <Camera size={15} />{" "}
                      {isReturnWarehouseStop(currentStop)
                        ? "BƯỚC 3: HẠ HÀNG HOÀN TẠI KHO ALS & ĐÓNG ĐƠN"
                        : "BƯỚC 3: GIAO HÀNG & POD"}
                    </span>
                    <span className="text-[10px] font-normal opacity-85">
                      {isReturnWarehouseStop(currentStop)
                        ? "Chụp ảnh hàng hạ vào kho lưu giữ ALS để đóng đơn & hoàn thành chuyến"
                        : currentStop.order?.order_type === "Export"
                          ? "Đơn Xuất khẩu: Chụp ảnh cắt chì & ảnh dỡ hàng vào Kho ALS"
                          : "Chụp ảnh biên bản giao nhận (POD) có chữ ký & bàn giao"}
                    </span>
                  </div>
                </Button>

                {/* Nút Khách không nhận hàng ở Bước 3 */}
                {!isReturnWarehouseStop(currentStop) &&
                  currentStop.order?.order_type !== "Export" && (
                    <Button
                      danger
                      size="large"
                      onClick={() => {
                        setActiveStopTarget(currentStop);
                        setRefusalModalOpen(true);
                      }}
                      className="w-full !bg-red-600/20 hover:!bg-red-600/35 !border !border-red-500/50 !text-red-200 rounded-xl h-auto py-2 flex items-center justify-center text-center"
                    >
                      <div className="flex flex-col items-center justify-center w-full leading-tight">
                        <span className="text-xs font-bold flex items-center gap-1.5 text-red-300">
                          <Ban size={14} /> KHÁCH KHÔNG NHẬN HÀNG (TỪ CHỐI NHẬN)
                        </span>
                        <span className="text-[10px] font-normal text-red-200/80">
                          Chuyển đơn sang Delivered (Exception) & chờ điều về
                          Kho ALS
                        </span>
                      </div>
                    </Button>
                  )}

                {/* Ghi chú nghiệp vụ rõ ràng cho Đơn Xuất khẩu tại Kho ALS */}
                {!isReturnWarehouseStop(currentStop) &&
                  currentStop.order?.order_type === "Export" && (
                    <div className="p-2.5 rounded-xl bg-blue-950/60 border border-blue-500/30 text-[11px] text-blue-200 space-y-1.5">
                      <p className="leading-snug">
                        💡 <b>Quy chuẩn đơn Xuất khẩu:</b> Khi xe đã hạ hàng
                        xuống <b>Kho ALS</b>, bấm{" "}
                        <b>&quot;BƯỚC 3: GIAO HÀNG &amp; POD&quot;</b> để hoàn
                        tất đơn vận chuyển. Nếu hàng của khách chưa xuất khẩu
                        được và phải nằm chờ tại kho, khách sẽ chịu phí lưu kho
                        theo ngày tại ALS.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveStopTarget(currentStop);
                          setRefusalModalOpen(true);
                        }}
                        className="text-[10px] text-red-300 hover:text-red-200 underline font-semibold cursor-pointer"
                      >
                        Trường hợp đặc biệt: Kho đích từ chối không cho hạ hàng
                        xuống kho → Báo ngoại lệ
                      </button>
                    </div>
                  )}
              </div>
            )}

          {/* Trạng thái chờ Điều phối viên điều về Kho ALS sau khi báo Khách từ chối nhận hàng */}
          {currentStop.status === "Done" &&
            stops.every((s) => s.status === "Done") && (
              <div className="p-3.5 bg-red-500/15 border border-red-500/40 rounded-2xl space-y-2.5 text-xs">
                <div className="flex items-start gap-2.5">
                  <Ban className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-bold text-red-200 text-xs">
                      Đã báo cáo Khách từ chối nhận hàng (Delivered - Exception)
                    </p>
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      Hệ thống đã gửi cảnh báo tới Điều phối viên để chỉ định{" "}
                      <b>Kho ALS</b> nhận hàng hoàn trả. Khi Điều phối viên bấm{" "}
                      <b>&quot;Điều về kho ALS&quot;</b>, điểm dừng Kho ALS mới
                      sẽ xuất hiện ngay bên dưới để bạn hạ hàng và đóng đơn.
                    </p>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 pt-1">
                  <Button
                    type="primary"
                    loading={actionLoading}
                    onClick={fetchDashboardData}
                    className="flex-1 bg-blue-600 hover:bg-blue-500 border-none font-bold rounded-xl text-xs h-9"
                  >
                    Làm mới kiểm tra lộ trình
                  </Button>
                  {(() => {
                    const refusedStop = stops.find(
                      (s) =>
                        s.order_id &&
                        String(s.order?.status || "")
                          .toUpperCase()
                          .replace(/[^A-Z0-9]+/g, "_") ===
                          "DELIVERED_EXCEPTION" &&
                        !s.order?.is_closed,
                    );
                    const targetOrderId =
                      refusedStop?.order_id || currentStop?.order_id;
                    if (!targetOrderId) return null;
                    return (
                      <Button
                        loading={actionLoading}
                        onClick={async () => {
                          try {
                            setActionLoading(true);
                            const res = await orderApi.redirectToAlsWarehouse(
                              targetOrderId,
                              {
                                warehouse_name:
                                  "Nhà Ga Hàng Hóa ALS Nội Bài (ALSC)",
                                close_immediately: false,
                              },
                            );
                            message.success(
                              res.message ||
                                "Đã nhận điểm dừng hoàn hàng về Kho ALS Nội Bài!",
                            );
                            await fetchDashboardData();
                          } catch (e) {
                            message.error(
                              e.message || "Không thể nhận điểm hoàn kho ALS",
                            );
                          } finally {
                            setActionLoading(false);
                          }
                        }}
                        className="flex-1 !bg-amber-600 hover:!bg-amber-500 !text-white !border-none font-bold rounded-xl text-xs h-9"
                      >
                        Hoàn về Kho ALS Nội Bài ngay
                      </Button>
                    );
                  })()}
                </div>
              </div>
            )}

          {/* Step 4: If Loading Done -> Rời khỏi điểm dừng (Left) */}
          {currentStop.status === "Loading Done" && (
            <Button
              type="primary"
              size="large"
              loading={actionLoading}
              onClick={() => handleLeftStop(trip.id, currentStop.id)}
              className="w-full bg-emerald-600 hover:bg-emerald-500 border-none rounded-xl h-auto py-2.5 shadow-lg shadow-emerald-600/30 flex items-center justify-center text-center text-white"
            >
              <div className="flex flex-col items-center justify-center w-full leading-tight">
                <span className="text-xs font-black flex items-center gap-1.5">
                  <CheckCircle size={15} /> BƯỚC 4: RỜI ĐI (LEFT)
                </span>
                <span className="text-[10px] font-normal opacity-85">
                  Tiếp tục lộ trình
                </span>
              </div>
            </Button>
          )}
        </div>
      )}

      {/* Case 3: Completed */}
      {trip.status === "Completed" && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-center">
          <CheckCircle className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
          <p className="text-sm text-emerald-200 font-bold">
            Chúc mừng! Bạn đã hoàn thành toàn bộ chuyến xe.
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Xe và hồ sơ tài xế đã được giải phóng về trạng thái sẵn sàng.
          </p>
          <Button
            type="primary"
            onClick={() => {
              setSelectedTripId(null);
              setTripData({ hasActiveTrip: false, trip: null });
              fetchDashboardData();
            }}
            className="mt-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl h-10 px-6 shadow-lg shadow-emerald-600/30"
          >
            Hoàn tất & Sẵn sàng nhận chuyến mới
          </Button>
        </div>
      )}
    </div>
  );
}
