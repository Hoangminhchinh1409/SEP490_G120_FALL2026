"use client";
import React from 'react';
import { Input, Select, InputNumber, Space, Alert } from 'antd';

export default function IncidentCompensationForm({
  currentData,
  isPending,
  isRejected,
  isDone,
  isReadOnly,
  submitting,
  damagePercentage,
  fault,
  surveyOrgReport,
  setSurveyOrgReport,
  goodsHandlingMethod,
  contractClauseRef,
  setContractClauseRef,
  compensationAmount,
  setCompensationAmount,
  resolutionNote,
  setResolutionNote,
  hasFrameworkContract,
  effectiveLiabilityCap,
  declaredValue,
  customerEmailDisplay,
  handlePercentageChange,
  handleFaultChange,
  handleHandlingMethodChange,
  handleApproveCompensation,
  onOpenRejectModal,
  onOpenRequestInfoModal,
  onOpenEmailPreview
}) {
  return (
    <>
      {/* MỤC 10: KẾT QUẢ GIÁM ĐỊNH (GIÁM ĐỊNH THỰC HIỆN NGOÀI HỆ THỐNG) */}
      <div className="p-4 bg-surface-container-low rounded-2xl border border-surface-container space-y-3 shadow-2xs">
        <div className="pb-1 border-b border-surface-container/60">
          <span className="font-bold text-primary uppercase text-xs tracking-wider">
            Kết quả giám định (giám định thực hiện ngoài hệ thống)
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Cột 1: Tỷ lệ hàng hỏng (%) */}
          <div className="space-y-1.5">
            <label className="block font-bold text-primary text-xs">
              Tỷ lệ hàng hỏng (%) * :
            </label>
            <div className="space-y-2">
              <Space.Compact block className="w-full">
                <InputNumber
                  min={0}
                  max={100}
                  controls={false}
                  value={damagePercentage}
                  onChange={handlePercentageChange}
                  disabled={isDone || isReadOnly || goodsHandlingMethod === 'COMPANY_RECOVERY'}
                  placeholder="Nhập %"
                  style={{ width: '100%' }}
                  className="w-full font-mono font-bold text-center h-9 text-xs"
                />
                <span className="inline-flex items-center px-3 bg-surface-container border border-l-0 border-outline-variant/40 text-on-surface-variant font-bold text-xs rounded-r-lg select-none flex-shrink-0">
                  %
                </span>
              </Space.Compact>

              <div className="grid grid-cols-4 gap-1.5">
                {[10, 30, 50, 100].map((p) => (
                  <button
                    key={p}
                    type="button"
                    disabled={isDone || isReadOnly || goodsHandlingMethod === 'COMPANY_RECOVERY'}
                    onClick={() => handlePercentageChange(p)}
                    className={`h-7.5 rounded-lg text-xs font-bold cursor-pointer border transition-all text-center flex items-center justify-center ${
                      damagePercentage === p
                        ? 'bg-secondary text-white border-secondary shadow-xs font-black'
                        : 'bg-surface-container-lowest border-surface-container hover:bg-surface-container text-primary'
                    }`}
                  >
                    {p}%
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Cột 2: Lỗi thuộc về */}
          <div className="space-y-1.5">
            <label className="block font-bold text-primary text-xs">
              Lỗi thuộc về * :
            </label>
            <Select
              value={fault}
              onChange={handleFaultChange}
              disabled={isDone || isReadOnly}
              placeholder="Chọn bên chịu trách nhiệm lỗi..."
              className="w-full h-9"
              options={[
                { value: 'COMPANY', label: 'Công ty vận chuyển (ALS)' },
                { value: 'CUSTOMER', label: 'Khách hàng' },
                { value: 'THIRD_PARTY', label: 'Bên thứ ba / Khách quan' }
              ]}
            />
            {fault === 'CUSTOMER' && (
              <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1 leading-snug">
                Gợi ý: Lỗi thuộc Khách hàng → đã đưa mức bồi thường về 0 đ (có thể bấm Từ chối hoặc nhập hỗ trợ ngoại lệ).
              </p>
            )}
            {fault === 'THIRD_PARTY' && (
              <p className="text-[11px] text-blue-800 bg-blue-50 border border-blue-200 rounded-lg px-2 py-1 leading-snug">
                Lưu ý: Lỗi bên thứ ba/khách quan → đối chiếu điều khoản bất khả kháng &amp; quyền truy đòi trong hợp đồng.
              </p>
            )}
          </div>

          {/* Cột 3: Đơn vị giám định / Số biên bản */}
          <div className="space-y-1.5">
            <label className="block font-bold text-primary text-xs">
              Đơn vị giám định / số biên bản:
            </label>
            <Input
              value={surveyOrgReport}
              onChange={(e) => setSurveyOrgReport(e.target.value)}
              disabled={isDone || isReadOnly}
              placeholder="VD: Giám định ABC - BB-2026-118"
              className="h-9 rounded-xl text-xs font-medium"
            />
          </div>
        </div>

        <p className="text-[11px] text-on-surface-variant italic pt-0.5">
          * Nhập từ biên bản giám định của ALS hoặc bên thứ ba. Bắt buộc có trước khi duyệt.
        </p>
      </div>

      {/* MỤC 11: HẠN MỨC VÀ CÁCH TÍNH THEO HỢP ĐỒNG (HỘP VÀNG HIGHLIGHT) */}
      <div className="p-3.5 bg-amber-500/10 rounded-2xl border border-amber-300 space-y-1.5 shadow-2xs">
        <span className="font-bold text-amber-950 uppercase text-xs tracking-wider block">
          Hạn mức và cách tính theo hợp đồng
        </span>
        <div className="space-y-1 text-xs text-amber-950 leading-relaxed">
          <div>
            Hạn mức bồi thường áp dụng ({hasFrameworkContract ? 'Hợp đồng khung đối tác' : 'Khách vãng lai - NĐ 163/2017/NĐ-CP'}): <b className="font-mono font-bold">{effectiveLiabilityCap.toLocaleString('vi-VN')} đ</b>
          </div>
          <div>
            {damagePercentage !== null && damagePercentage !== undefined ? (
              <>
                Giá trị khai báo {declaredValue.toLocaleString('vi-VN')} đ × {Number(damagePercentage)}% hỏng = <b className="font-mono font-bold text-error">{(declaredValue * (Number(damagePercentage) / 100)).toLocaleString('vi-VN')} đ</b>, {Number(compensationAmount || 0) <= effectiveLiabilityCap ? 'trong hạn mức.' : <span className="text-error font-bold">⚠ VƯỢT HẠN MỨC TRÁCH NHIỆM!</span>}
              </>
            ) : (
              <span>Giá trị khai báo hàng hóa: <b className="font-mono font-bold">{declaredValue.toLocaleString('vi-VN')} đ</b> (Vui lòng chọn tỷ lệ hàng hỏng bên dưới để hệ thống tính mức đề xuất).</span>
            )}
          </div>
        </div>
      </div>

      {/* MỤC 12, 13, 14: QUYẾT ĐỊNH CỦA NGƯỜI DUYỆT */}
      <div className="p-4 bg-surface-container-lowest rounded-2xl border border-surface-container space-y-3.5 shadow-2xs">
        <div className="pb-1 border-b border-surface-container/60">
          <span className="font-bold text-primary uppercase text-xs tracking-wider">
            Quyết định của người duyệt
          </span>
        </div>

        {/* Mục 12: Hướng xử lý */}
        <div className="space-y-1.5">
          <label className="block font-bold text-primary text-xs">
            Hướng xử lý * :
          </label>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <Select
              value={goodsHandlingMethod}
              onChange={(val) => handleHandlingMethodChange(val)}
              disabled={isDone || isReadOnly}
              placeholder="Chọn hướng xử lý bồi thường..."
              className="w-full sm:w-[420px] h-9"
              options={[
                { value: 'CUSTOMER_RETAIN', label: 'Bồi thường' },
                { value: 'COMPANY_RECOVERY', label: 'Lấy hàng về và bồi thường' }
              ]}
            />
            <span className="text-[11px] text-on-surface-variant italic">
              (Bồi thường - Giao phần hàng tốt và bồi thường phần hỏng · Lấy hàng về và bồi thường)
            </span>
          </div>
        </div>

        {/* Điều khoản hợp đồng viện dẫn */}
        <div className="space-y-1.5">
          <label className="block font-bold text-primary text-xs">
            Điều khoản Hợp đồng viện dẫn:
          </label>
          <Input
            value={contractClauseRef}
            onChange={(e) => setContractClauseRef(e.target.value)}
            disabled={isDone || isReadOnly}
            placeholder="VD: Điều 8.2 - Bồi thường thiệt hại hàng hóa (HĐVC-2026/01)"
            className="w-full sm:w-[420px] h-9 rounded-xl text-xs font-medium"
          />
        </div>

        {/* Mục 13: Số tiền duyệt (đ) */}
        <div className="space-y-1.5">
          <label className="block font-bold text-primary text-xs">
            Số tiền duyệt (đ) * :
          </label>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="w-full sm:w-[420px]">
              <Space.Compact block className="w-full">
                <InputNumber
                  min={0}
                  step={500000}
                  controls={false}
                  value={compensationAmount}
                  onChange={(val) => setCompensationAmount(val === null || val === undefined ? null : Number(val))}
                  disabled={isDone || isReadOnly}
                  placeholder="Nhập số tiền chốt bồi thường..."
                  formatter={(val) => (val !== undefined && val !== null && val !== '') ? `${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : ''}
                  parser={(val) => String(val || '').replace(/\./g, '')}
                  style={{ width: '100%' }}
                  className="w-full font-mono font-bold text-sm text-error h-9 text-right pr-2 [&_input]:text-right"
                />
                <span className="inline-flex items-center px-3 bg-surface-container border border-l-0 border-outline-variant/40 text-on-surface-variant font-bold text-xs rounded-r-lg select-none font-mono flex-shrink-0">
                  đ
                </span>
              </Space.Compact>
            </div>
            <span className="text-[11px] text-on-surface-variant italic">
              Mặc định theo hợp đồng, người duyệt có thể sửa kèm nhận xét.
            </span>
          </div>
        </div>

        {/* Mục 14: Nhận xét của người duyệt */}
        <div className="space-y-1.5">
          <label className="block font-bold text-primary text-xs">
            Nhận xét * <span className="font-normal text-on-surface-variant">(Bắt buộc khi từ chối, khi sửa số tiền, hoặc vượt hạn mức)</span>:
          </label>
          <Input.TextArea
            rows={3}
            maxLength={500}
            showCount
            value={resolutionNote}
            onChange={(e) => setResolutionNote(e.target.value)}
            disabled={isDone || isReadOnly}
            placeholder="Nhập nhận xét; khi từ chối đây là lý do gửi cho khách..."
            className="rounded-xl text-xs p-3 leading-relaxed border-surface-container focus:border-secondary transition-colors"
          />
        </div>

        <div className="pt-1 text-[11px] text-error font-semibold">
          * Vui lòng kiểm tra kỹ kết quả giám định và căn cứ hợp đồng trước khi ban hành quyết định.
        </div>

        {/* CỤM NÚT HÀNH ĐỘNG (MỤC 15, 16, 17) */}
        {isPending && !isReadOnly ? (
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-surface-container/60">
            {/* Nút 15: Từ chối bồi thường */}
            <button
              type="button"
              onClick={onOpenRejectModal}
              disabled={submitting}
              className="w-full sm:w-auto h-10 px-5 rounded-xl bg-red-100 hover:bg-red-200 text-error font-bold cursor-pointer transition-all border border-red-300 inline-flex items-center justify-center gap-1.5 text-xs shadow-2xs"
            >
              <span className="material-symbols-outlined text-[18px]">cancel</span>
              <span>Từ chối bồi thường</span>
            </button>

            <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto justify-end">
              {/* Nút Xem mẫu Email gửi khách */}
              <button
                type="button"
                onClick={() => onOpenEmailPreview('APPROVAL')}
                className="w-full sm:w-auto h-10 px-4 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 font-bold cursor-pointer transition-all border border-teal-200 inline-flex items-center justify-center gap-1.5 text-xs shadow-2xs"
              >
                <span className="material-symbols-outlined text-[18px]">mail</span>
                <span>Xem mẫu Email gửi khách</span>
              </button>

              {/* Nút 16: Yêu cầu bổ sung hồ sơ */}
              <button
                type="button"
                onClick={onOpenRequestInfoModal}
                disabled={submitting}
                className="w-full sm:w-auto h-10 px-5 rounded-xl bg-surface-container hover:bg-surface-container-high text-primary font-bold cursor-pointer transition-all border border-surface-container-highest inline-flex items-center justify-center gap-1.5 text-xs shadow-2xs"
              >
                <span className="material-symbols-outlined text-[18px]">contact_support</span>
                <span>Yêu cầu bổ sung hồ sơ</span>
              </button>

              {/* Nút 17: Chốt bồi thường, gửi email khách xác nhận & kết thúc luồng */}
              <button
                type="button"
                onClick={handleApproveCompensation}
                disabled={submitting}
                className="w-full sm:w-auto h-10 px-6 rounded-xl bg-secondary hover:bg-blue-700 text-white font-bold cursor-pointer transition-all shadow-xs inline-flex items-center justify-center gap-1.5 text-xs hover:scale-102"
              >
                <span className="material-symbols-outlined text-[18px]">task_alt</span>
                <span>{submitting ? 'Đang lưu & gửi email...' : 'Chốt bồi thường & Gửi email'}</span>
              </button>
            </div>
          </div>
        ) : isDone && (
          <div className={`pt-2.5 mt-1 border-t border-surface-container/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-bold ${
            isRejected ? 'text-error' : 'text-emerald-700'
          }`}>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">
                {isRejected ? 'block' : 'lock'}
              </span>
              <span>
                {isRejected
                  ? 'Đã ban hành quyết định Từ chối bồi thường · Hồ sơ đã khóa'
                  : Number(currentData.approved_compensation_amount || compensationAmount) > 0
                    ? '✔ Đã chốt mức bồi thường & gửi email xác nhận cho khách · Hồ sơ đã hoàn tất (Đóng)'
                    : '✔ Sự cố đã xử lý hoàn tất (không phát sinh chi trả) · Hồ sơ đã khóa'}
              </span>
            </div>

            <button
              type="button"
              onClick={() => onOpenEmailPreview(isRejected ? 'REJECTION' : 'APPROVAL')}
              className="h-8 px-3 rounded-lg bg-surface-container hover:bg-surface-container-high text-primary font-bold text-[11px] inline-flex items-center gap-1.5 cursor-pointer border border-surface-container-highest shrink-0"
            >
              <span className="material-symbols-outlined text-[15px]">mark_email_read</span>
              <span>Xem Email đã gửi khách hàng</span>
            </button>
          </div>
        )}
      </div>

      {/* KHI ĐÃ ĐÓNG (DONE): READ-ONLY SUMMARY KẾT QUẢ CHỐT BỒI THƯỜNG */}
      {isDone && (
        <div className="p-4 bg-emerald-500/5 rounded-2xl border border-emerald-400/40 space-y-3 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-emerald-200/70">
            <span className="font-bold text-primary uppercase text-xs flex items-center gap-2 tracking-wide">
              <span className={`material-symbols-outlined text-[20px] ${isRejected ? 'text-error' : 'text-emerald-600'}`}>
                {isRejected ? 'cancel' : 'verified'}
              </span>
              {isRejected
                ? 'Hồ sơ bồi thường đã đóng (Từ chối)'
                : 'Quyết định Chốt Bồi thường & Xác nhận Email (DONE)'}
            </span>
            <span className="text-[11px] text-outline font-mono">
              Đã xử lý lúc: {currentData.closed_at ? new Date(currentData.closed_at).toLocaleString('vi-VN') : (currentData.resolved_time ? new Date(currentData.resolved_time).toLocaleString('vi-VN') : new Date().toLocaleString('vi-VN'))}
            </span>
          </div>

          {isRejected || currentData.rejection_reason ? (
            <Alert
              type="error"
              showIcon
              title={<b className="text-xs">ĐÃ TỪ CHỐI BỒI THƯỜNG</b>}
              description={
                <div className="text-xs mt-1 space-y-1 leading-relaxed">
                  <p>• Điều khoản viện dẫn: <b>{currentData.contract_clause_ref || contractClauseRef}</b></p>
                  <p>• Lý do từ chối: {currentData.rejection_reason || resolutionNote}</p>
                  <p>• Hotline hỗ trợ khiếu nại: <b className="font-mono text-primary font-bold">{currentData.contact_hotline || '1900 1234'}</b></p>
                </div>
              }
              className="rounded-xl p-3 border border-red-200"
            />
          ) : Number(currentData.approved_compensation_amount || compensationAmount) > 0 ? (
            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 bg-white rounded-xl border border-emerald-200/80 space-y-0.5">
                  <span className="text-[11px] text-on-surface-variant block">Mức bồi thường đã chốt:</span>
                  <strong className="text-error font-mono text-base font-black block">
                    {Number(currentData.approved_compensation_amount || compensationAmount).toLocaleString('vi-VN')} đ
                  </strong>
                </div>

                <div className="p-3 bg-white rounded-xl border border-emerald-200/80 space-y-0.5">
                  <span className="text-[11px] text-on-surface-variant block">Email thông báo khách hàng:</span>
                  <strong className="text-emerald-700 font-bold block">
                    {currentData.customer_email || customerEmailDisplay}
                  </strong>
                </div>

                <div className="p-3 bg-white rounded-xl border border-emerald-200/80 space-y-0.5">
                  <span className="text-[11px] text-on-surface-variant block">Trạng thái luồng xử lý:</span>
                  <strong className="text-emerald-700 font-bold block">
                    Đã chốt &amp; Kết thúc luồng
                  </strong>
                </div>
              </div>

              <div className="p-3 bg-white rounded-xl border border-emerald-200/80 space-y-1">
                <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider block">
                  Nội dung / Căn cứ chốt bồi thường:
                </span>
                <p className="text-xs text-primary font-medium leading-relaxed">
                  {currentData.resolution_note || resolutionNote || 'Đã chốt mức bồi thường và gửi email thông báo cho khách hàng.'}
                </p>
              </div>
            </div>
          ) : (
            <Alert
              type="success"
              showIcon
              title={<b className="text-xs">Hồ sơ sự cố đã xử lý hoàn tất · Không phát sinh khoản chi bồi thường</b>}
              description={
                <p className="text-xs mt-1 text-slate-700 leading-relaxed">
                  {currentData.resolution_note || 'Sự cố đã được xử lý xong tại hiện trường và đóng hồ sơ.'}
                </p>
              }
              className="rounded-xl p-3 border border-emerald-200"
            />
          )}
        </div>
      )}
    </>
  );
}
