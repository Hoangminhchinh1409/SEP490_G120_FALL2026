"use client";
import React from 'react';
import { Image } from 'antd';

const ORDER_TYPE_VI = {
  IMPORT: 'Nhập khẩu',
  EXPORT: 'Xuất khẩu'
};

const ORDER_STATUS_VI = {
  DRAFT: 'Nháp',
  PENDING: 'Chờ duyệt',
  CONFIRMED: 'Đã xác nhận',
  ASSIGNED: 'Đã phân công xe',
  ACCEPTED: 'Tài xế đã nhận chuyến',
  IN_PROGRESS: 'Đang thực hiện',
  PICKED_UP: 'Đã lấy hàng',
  IN_TRANSIT: 'Đang vận chuyển',
  DELIVERED: 'Đã giao hàng',
  COMPLETED: 'Hoàn thành',
  CANCELLED: 'Đã hủy',
  EXCEPTION: 'Gặp sự cố'
};

export default function IncidentEvidenceSection({
  orderCode,
  orderType,
  orderStatus,
  customerName,
  receiverName,
  contactPhone,
  routeDisplay,
  agreedPrice,
  cargoDescription,
  declaredValue,
  tripCode,
  truckPlate,
  driverName,
  driverPhone,
  sealNumber,
  contractNumber,
  requestedClaimAmount,
  claimCode,
  incidentSource,
  escalatedTimeDisplay,
  escalationReasonDisplay,
  incidentCode,
  incidentTitle,
  incidentTime,
  incidentLocation,
  incidentDescription,
  tripEventsTimeline,
  pickupPhoto,
  sealPhoto,
  podPhoto,
  incidentPhoto,
  incidentPhotosList,
  onOpenContractViewer,
  onOpenLocationMap
}) {
  return (
    <>
      {/* MỤC 1 & 2: THÔNG TIN ĐƠN HÀNG & CHUYẾN XE */}
      <div className="p-3.5 bg-surface-container-lowest rounded-2xl border border-surface-container space-y-3 shadow-2xs">
        <div className="pb-1 border-b border-surface-container/60">
          <span className="font-bold text-primary uppercase text-xs tracking-wider">
            Thông tin đơn hàng &amp; chuyến xe
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
          {/* Cột trái */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-on-surface-variant shrink-0">Đơn hàng:</span>
              <strong className="font-mono text-primary font-bold text-right">
                {orderCode} ({ORDER_TYPE_VI[String(orderType || '').toUpperCase()] || orderType})
              </strong>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-on-surface-variant shrink-0">Trạng thái đơn:</span>
              <strong className="text-primary font-bold text-right">
                {ORDER_STATUS_VI[String(orderStatus || '').toUpperCase()] || orderStatus}
              </strong>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-on-surface-variant shrink-0">Khách hàng:</span>
              <strong className="text-primary font-bold text-right">{customerName}</strong>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-on-surface-variant shrink-0">Người nhận / Liên hệ:</span>
              <strong className="text-primary font-semibold text-right">{receiverName} - {contactPhone}</strong>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-on-surface-variant shrink-0">Tuyến:</span>
              <strong className="text-primary font-semibold text-right">{routeDisplay}</strong>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-on-surface-variant shrink-0">Cước phí vận chuyển:</span>
              <strong className="text-primary font-mono font-bold text-right">{agreedPrice.toLocaleString('vi-VN')} đ</strong>
            </div>
          </div>

          {/* Cột phải */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-on-surface-variant shrink-0">Hàng hóa:</span>
              <strong className="text-primary font-semibold text-right">{cargoDescription}</strong>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-on-surface-variant shrink-0">Giá trị khai báo:</span>
              <strong className="text-error font-mono font-bold text-sm text-right">{declaredValue.toLocaleString('vi-VN')} đ</strong>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-on-surface-variant shrink-0">Chuyến xe:</span>
              <strong className="font-mono text-primary font-bold text-right">{tripCode}</strong>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-on-surface-variant shrink-0">Xe vận chuyển:</span>
              <strong className="font-mono text-primary font-bold text-right">{truckPlate}</strong>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-on-surface-variant shrink-0">Tài xế:</span>
              <strong className="text-primary font-bold text-right">{driverName} ({driverPhone})</strong>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-on-surface-variant shrink-0">Số niêm phong chì:</span>
              <strong className="font-mono text-primary font-bold text-right">{sealNumber}</strong>
            </div>
          </div>
        </div>

        {/* Hàng chân Mục 1 & 2: Hợp đồng áp dụng & Nút Xem PDF */}
        <div className="pt-2 border-t border-surface-container/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <span className="text-primary font-semibold text-xs">
            Hợp đồng áp dụng: <b>{contractNumber}</b>
          </span>

          <button
            type="button"
            onClick={onOpenContractViewer}
            className="h-8.5 px-3.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-primary font-bold text-xs cursor-pointer border border-surface-container-highest transition-all shadow-2xs shrink-0"
          >
            Xem hợp đồng
          </button>
        </div>
      </div>

      {/* MỤC 3 & 4: YÊU CẦU BỒI THƯỜNG & THÔNG TIN CHUYỂN CẤP TỪ ĐPV */}
      <div className="p-3.5 bg-surface-container-low rounded-2xl border border-surface-container flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-2xs">
        <div className="flex items-center gap-6 shrink-0">
          <div>
            <span className="text-[11px] font-semibold text-outline uppercase tracking-wider block">
              Số tiền yêu cầu bồi thường
            </span>
            <div className="font-mono font-black text-2xl text-error mt-0.5">
              {requestedClaimAmount > 0 ? `${requestedClaimAmount.toLocaleString('vi-VN')} đ` : 'Chưa ghi nhận (Chờ giám định)'}
            </div>
          </div>

          <div className="border-l border-surface-container pl-6 space-y-0.5">
            <div className="text-xs text-on-surface-variant font-medium">
              Mã yêu cầu: <b className="font-mono text-primary">{claimCode}</b>
            </div>
            <div className="text-xs text-on-surface-variant font-medium">
              Nguồn gửi: <b className="text-primary">{incidentSource}</b>
            </div>
          </div>
        </div>

        {/* Thông tin chuyển cấp từ Điều phối viên */}
        <div className="lg:max-w-md w-full p-2.5 rounded-xl bg-surface-container-lowest border border-surface-container space-y-0.5">
          <div className="flex items-center justify-between gap-2 text-[11px]">
            <span className="font-bold text-primary uppercase tracking-wider flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px] text-amber-600">forward_to_inbox</span>
              Chuyển cấp từ Điều phối viên
            </span>
            <span className="font-mono text-on-surface-variant">{escalatedTimeDisplay}</span>
          </div>
          <p className="text-[11px] text-on-surface-variant leading-snug line-clamp-2">
            {escalationReasonDisplay}
          </p>
        </div>
      </div>

      {/* MỤC 5, 6, 7, 8, 9: THÔNG TIN SỰ CỐ PHÁT SINH */}
      <div className="p-4 bg-surface-container-lowest rounded-2xl border border-surface-container space-y-3 shadow-2xs">
        <div className="pb-1 border-b border-surface-container/60">
          <span className="font-bold text-primary uppercase text-xs tracking-wider">
            Thông tin sự cố phát sinh
          </span>
        </div>

        {/* Mục 6: Header Sự cố */}
        <div className="space-y-1.5">
          <h4 className="font-bold text-primary text-xs flex items-center gap-2">
            <span className="font-mono font-black text-error">{incidentCode}</span>
            <span>-</span>
            <span>{incidentTitle}</span>
          </h4>
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 text-xs text-on-surface-variant">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
              <span>Nguồn gốc: <strong className="text-primary font-semibold">{incidentSource}</strong></span>
              <span>Thời điểm báo: <strong className="text-error font-mono font-semibold">{incidentTime}</strong></span>
              <span className="inline-flex items-center gap-1">
                <span>Vị trí:</span>
                <strong className="text-error font-mono font-semibold">{incidentLocation}</strong>
              </span>
            </div>
            <button
              type="button"
              onClick={onOpenLocationMap}
              className="h-8 px-3 rounded-xl bg-red-50 hover:bg-red-100 text-error font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer border border-red-200 transition-colors shrink-0 shadow-2xs"
              title="Mở bản đồ VietMap xác định vị trí xảy ra sự cố khi tài xế gửi báo cáo"
            >
              <span className="material-symbols-outlined text-[16px]">location_on</span>
              <span>Xác định vị trí sự cố trên bản đồ</span>
            </button>
          </div>
        </div>

        {/* Mục 7: Mô tả nguyên nhân / Thiệt hại */}
        <div className="space-y-1">
          <span className="text-[11px] text-on-surface-variant font-medium block">
            Mô tả nguyên nhân / Thiệt hại:
          </span>
          <div className="p-3 bg-surface-container-low rounded-xl border border-surface-container text-xs text-primary font-medium leading-relaxed">
            {incidentDescription}
          </div>
        </div>

        {/* Mục 8: Các sự kiện của chuyến quanh thời điểm sự cố */}
        <div className="space-y-1">
          <span className="text-[11px] text-error font-semibold block">
            Các sự kiện của chuyến quanh thời điểm sự cố:
          </span>
          <div className="p-2.5 bg-surface-container-low rounded-xl border border-surface-container text-xs text-primary font-mono leading-relaxed">
            {tripEventsTimeline}
          </div>
        </div>

        {/* Mục 9: 4 Khung hình ảnh minh chứng */}
        <div className="space-y-1.5 pt-1">
          <span className="text-[11px] font-bold text-outline uppercase tracking-wider block">
            Hình ảnh minh chứng:
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Image.PreviewGroup>
              {/* 1. Ảnh hàng khi nhận */}
              <div className="p-2 rounded-xl bg-surface-container-low border border-surface-container flex flex-col items-center justify-between text-center gap-1.5">
                <div className="w-full h-20 rounded-lg overflow-hidden bg-black/5 shadow-inner">
                  <Image src={pickupPhoto} alt="Ảnh hàng khi nhận" className="w-full h-20 object-cover" />
                </div>
                <span className="text-[11px] font-bold text-primary">Ảnh hàng khi nhận</span>
              </div>

              {/* 2. Ảnh seal chì & biển số */}
              <div className="p-2 rounded-xl bg-surface-container-low border border-surface-container flex flex-col items-center justify-between text-center gap-1.5">
                <div className="w-full h-20 rounded-lg overflow-hidden bg-black/5 shadow-inner">
                  <Image src={sealPhoto} alt="Ảnh seal chì & biển số" className="w-full h-20 object-cover" />
                </div>
                <span className="text-[11px] font-bold text-primary">Ảnh seal chì &amp; biển số</span>
              </div>

              {/* 3. Biên bản / POD giao hàng */}
              <div className="p-2 rounded-xl bg-surface-container-low border border-surface-container flex flex-col items-center justify-between text-center gap-1.5">
                <div className="w-full h-20 rounded-lg overflow-hidden bg-black/5 shadow-inner">
                  <Image src={podPhoto} alt="Biên bản / POD giao hàng" className="w-full h-20 object-cover" />
                </div>
                <span className="text-[11px] font-bold text-primary">Biên bản / POD giao hàng</span>
              </div>

              {/* 4. Ảnh hiện trường */}
              <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-300 flex flex-col items-center justify-between text-center gap-1.5 relative">
                {incidentPhotosList.length > 1 && (
                  <span className="absolute top-3 right-3 z-10 px-1.5 py-0.5 rounded bg-slate-900/80 text-white text-[10px] font-bold pointer-events-none">
                    +{incidentPhotosList.length - 1} ảnh
                  </span>
                )}
                <div className="w-full h-20 rounded-lg overflow-hidden bg-black/5 shadow-inner">
                  <Image src={incidentPhoto} alt="Ảnh hiện trường" className="w-full h-20 object-cover" />
                </div>
                {incidentPhotosList.length > 1 && (
                  <div style={{ display: 'none' }}>
                    {incidentPhotosList.slice(1).map((imgUrl, idx) => (
                      <Image key={idx} src={imgUrl} alt={`Ảnh hiện trường ${idx + 2}`} />
                    ))}
                  </div>
                )}
                <span className="text-[11px] font-bold text-amber-950">
                  Ảnh hiện trường ({incidentPhotosList.length})
                </span>
              </div>
            </Image.PreviewGroup>
          </div>
        </div>
      </div>
    </>
  );
}
