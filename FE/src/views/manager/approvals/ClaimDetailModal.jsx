"use client";
import React from 'react';
import { Modal, Input, InputNumber, Select, Spin, Tag, Image, Alert, Button, Upload, message } from 'antd';
import { PhoneCall, CheckCircle2, XCircle, Calculator, CreditCard, Upload as UploadIcon } from 'lucide-react';
import { uploadApi } from '../../../api/uploadApi';

export default function ClaimDetailModal({
  open,
  onClose,
  detailLoading,
  selectedClaim,
  selectedStatus,
  statusBadges,
  allEvidencePhotos,
  isReadOnly,
  canRecordCallForSelected,
  canRecordPaymentForSelected,
  onOpenTripReplay,
  // Payment form
  paymentDate,
  setPaymentDate,
  transactionCode,
  setTransactionCode,
  paymentProofUrl,
  setPaymentProofUrl,
  paymentNote,
  setPaymentNote,
  recordingPayment,
  onRecordManagerPayment,
  // Manager decision form
  decisionMode,
  setDecisionMode,
  assessmentResult,
  setAssessmentResult,
  damagePercentage,
  setDamagePercentage,
  outcome,
  setOutcome,
  approvedAmount,
  setApprovedAmount,
  contractClauseRef,
  setContractClauseRef,
  contactHotline,
  setContactHotline,
  claimComment,
  setClaimComment,
  rejectionReason,
  setRejectionReason,
  decidingClaim,
  onAutoCalculateAmount,
  onDecideClaim,
  // Dispatcher call form
  callContactPhone,
  setCallContactPhone,
  callNote,
  setCallNote,
  recordingCall,
  onRecordDispatcherCall
}) {
  return (
    <Modal
      title={
        <div className="flex items-center justify-between w-full pr-6">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary text-[22px]">gavel</span>
            <span className="font-bold text-base text-primary">
              Hồ sơ Bồi thường: {selectedClaim?.claim_code} – Đơn {selectedClaim?.order_code}
            </span>
          </div>
          {selectedClaim && (
            <Tag color={(statusBadges[selectedStatus] || {}).color || 'default'} className="font-bold text-xs">
              {(statusBadges[selectedStatus] || {}).label || selectedStatus}
            </Tag>
          )}
        </div>
      }
      open={open}
      onCancel={onClose}
      footer={null}
      width={900}
    >
      {detailLoading && !selectedClaim ? (
        <div className="py-16 flex justify-center"><Spin size="large" /></div>
      ) : selectedClaim && (
        <div className="space-y-4 pt-2 text-xs">
          {/* 1. Khách hàng & Đơn hàng */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="p-3.5 bg-surface-container-low rounded-xl border border-surface-container space-y-1">
              <div className="font-bold text-primary uppercase text-[11px] mb-1">1. Khách hàng &amp; Liên hệ</div>
              <div>Công ty / Người gửi: <strong>{selectedClaim.customer?.company_name || 'N/A'}</strong></div>
              <div>Người liên hệ: <strong>{selectedClaim.customer?.contact_person || selectedClaim.receiver_name || 'N/A'}</strong></div>
              <div>SĐT: <strong className="font-mono">{selectedClaim.contact_phone || 'Chưa có'}</strong></div>
              <div>Email: <strong>{selectedClaim.customer_email || 'Chưa có'}</strong></div>
            </div>

            <div className="p-3.5 bg-surface-container-low rounded-xl border border-surface-container space-y-1">
              <div className="font-bold text-primary uppercase text-[11px] mb-1">2. Đơn hàng &amp; Chuyến xe</div>
              <div>Đơn hàng: <strong className="font-mono">{selectedClaim.order_code}</strong> ({selectedClaim.order_type})</div>
              {selectedClaim.route_display && <div>Tuyến: <strong>{selectedClaim.route_display}</strong></div>}
              <div>Hàng hóa: <strong>{selectedClaim.cargo_description}</strong></div>
              <div>Giá trị khai báo: <strong className="font-mono text-error">{Number(selectedClaim.declared_value || 0).toLocaleString('vi-VN')} đ</strong></div>
              <div className="flex items-center justify-between pt-1">
                <span>Chuyến: <strong className="font-mono">{selectedClaim.trip_code || 'Không gắn chuyến'}</strong></span>
                {selectedClaim.trip_id && (
                  <button
                    type="button"
                    onClick={() => onOpenTripReplay(selectedClaim.trip_id)}
                    className="px-2.5 py-1 rounded-lg bg-surface-container-lowest hover:bg-surface-container text-secondary font-bold inline-flex items-center gap-1 cursor-pointer border border-surface-container"
                  >
                    <span className="material-symbols-outlined text-[14px]">play_circle</span>
                    <span>Tua GPS</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* 3. Hợp đồng & Hạn mức (BR-37) */}
          <div className="p-3.5 bg-surface-container-low rounded-xl border border-surface-container space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-primary uppercase text-[11px]">3. Hợp đồng &amp; Giới hạn trách nhiệm (BR-37)</span>
              <span className="font-mono font-bold text-primary">
                {selectedClaim.contract?.contract_number || 'Khách vãng lai (Trần mặc định 500M)'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>Trần hợp đồng: <strong className="font-mono">{selectedClaim.contract_cap ? `${Number(selectedClaim.contract_cap).toLocaleString('vi-VN')} đ` : 'Không có HĐ khung'}</strong></div>
              <div>Hạn mức trách nhiệm: <strong className="font-mono text-error">{Number(selectedClaim.liability_limit || 500000000).toLocaleString('vi-VN')} đ</strong></div>
            </div>
            {selectedClaim.is_exceeding_cap && (
              <Alert
                type="warning"
                showIcon
                title={`Số tiền yêu cầu (${Number(selectedClaim.amount || 0).toLocaleString('vi-VN')} đ) vượt giới hạn trách nhiệm. Nếu duyệt phải nhập lý do ngoại lệ (MSG56).`}
                className="rounded-lg"
              />
            )}
          </div>

          {/* 4. Nội dung Claim & Sự cố liên quan */}
          <div className="p-3.5 bg-surface-container-low rounded-xl border border-surface-container space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="font-bold text-primary uppercase text-[11px]">4. Chi tiết yêu cầu &amp; Sự cố liên quan</span>
              <span className="font-mono font-black text-error text-sm">
                Yêu cầu: {Number(selectedClaim.amount || 0).toLocaleString('vi-VN')} đ
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>Nguồn: <strong>{selectedClaim.source_display}</strong></div>
              <div>Phân loại: <strong>{selectedClaim.claim_type || 'Damage'}</strong></div>
            </div>
            {selectedClaim.incident_code && (
              <div className="p-2.5 bg-surface-container-lowest rounded-lg border border-surface-container text-[11px]">
                <b>Sự cố {selectedClaim.incident_code} ({selectedClaim.incident_type_display}):</b> {selectedClaim.incident_description}
              </div>
            )}
            <div className="p-2.5 bg-surface-container-lowest rounded-lg border border-surface-container">
              <b>Mô tả thiệt hại / Lý do Claim:</b> {selectedClaim.reason}
            </div>
          </div>

          {/* 5. Ảnh bằng chứng */}
          <div className="p-3.5 bg-surface-container-low rounded-xl border border-surface-container space-y-2">
            <div className="font-bold text-primary uppercase text-[11px]">5. Hình ảnh minh chứng</div>
            {allEvidencePhotos.length > 0 ? (
              <Image.PreviewGroup>
                <div className="flex flex-wrap gap-2">
                  {allEvidencePhotos.map((url, idx) => (
                    <Image
                      key={idx}
                      src={url}
                      alt={`Evidence ${idx + 1}`}
                      width={76}
                      height={76}
                      className="rounded-lg object-cover border border-surface-container"
                    />
                  ))}
                </div>
              </Image.PreviewGroup>
            ) : (
              <p className="text-on-surface-variant italic">Chưa có ảnh minh chứng đính kèm.</p>
            )}
          </div>

          {/* 6. Kết quả thẩm định đã lưu (nếu đã qua bước PENDING) */}
          {selectedStatus !== 'PENDING' && (
            <div className="p-3.5 bg-blue-50/70 rounded-xl border border-blue-200 space-y-1.5">
              <div className="font-bold text-blue-900 uppercase text-[11px]">6. Kết quả thẩm định của Quản lý</div>
              {selectedClaim.assessment_result && (
                <div><b>Kết quả giám định (Assessment):</b> {selectedClaim.assessment_result}</div>
              )}
              {Number(selectedClaim.approved_amount || 0) > 0 && (
                <div>
                  <b>Số tiền phê duyệt:</b>{' '}
                  <span className="font-mono font-bold text-emerald-700">
                    {Number(selectedClaim.approved_amount).toLocaleString('vi-VN')} đ
                  </span>
                  {selectedClaim.outcome && ` · Phương án: ${selectedClaim.outcome}`}
                </div>
              )}
              {selectedClaim.rejection_reason && (
                <div className="text-red-800"><b>Lý do từ chối:</b> {selectedClaim.rejection_reason}</div>
              )}
              {selectedClaim.contract_clause_ref && (
                <div><b>Điều khoản áp dụng:</b> {selectedClaim.contract_clause_ref}</div>
              )}
              {selectedClaim.review_comment && (
                <div><b>Nhận xét:</b> {selectedClaim.review_comment}</div>
              )}
            </div>
          )}

          {/* 7. Nhật ký cuộc gọi của Dispatcher (nếu đã gọi) */}
          {selectedClaim.called_at && (
            <div className="p-3.5 bg-emerald-50/70 rounded-xl border border-emerald-200 space-y-1">
              <div className="font-bold text-emerald-900 uppercase text-[11px] flex items-center gap-1.5">
                <PhoneCall size={14} /> Đã gọi điện thông báo khách hàng
              </div>
              <div>
                Người gọi: <strong>{selectedClaim.called_by_name || 'Điều phối viên'}</strong> · SĐT: <strong className="font-mono">{selectedClaim.call_contact_phone || 'N/A'}</strong> · Lúc: <strong>{new Date(selectedClaim.called_at).toLocaleString('vi-VN')}</strong>
              </div>
              <div>Nội dung / Lý do cuộc gọi: <strong>{selectedClaim.call_note}</strong></div>
              {selectedStatus === 'APPROVED' && !canRecordPaymentForSelected && (
                <div className="text-blue-800 font-semibold pt-1">
                  → Đã mở khóa bước ghi nhận thanh toán cho Quản lý.
                </div>
              )}
              {selectedStatus === 'CLOSED_REJECTED' && (
                <div className="text-red-800 font-semibold pt-1">
                  → Hồ sơ đã đóng (Từ chối sau khi gọi khách hàng).
                </div>
              )}
            </div>
          )}

          {/* CẢNH BÁO CHỜ ĐPV GỌI KHÁCH TRƯỚC KHI THANH TOÁN */}
          {!isReadOnly && selectedStatus === 'APPROVED' && !selectedClaim.called_at && (
            <Alert
              type="info"
              showIcon
              title="Đang chờ Điều phối viên gọi điện xác nhận với khách hàng"
              description="Theo quy trình BF-04, Điều phối viên cần gọi điện cho khách hàng và ghi nhận cuộc gọi trước khi Quản lý thực hiện ghi nhận thanh toán bồi thường."
              className="rounded-xl"
            />
          )}

          {/* FORM GHI NHẬN THANH TOÁN CỦA MANAGER (khi APPROVED & đã gọi khách) */}
          {canRecordPaymentForSelected && (
            <div className="p-4 bg-emerald-50/70 rounded-xl border-2 border-emerald-300 space-y-3">
              <div className="font-bold text-emerald-950 uppercase text-[11px] flex items-center gap-1.5">
                <CreditCard size={15} /> Quản lý: Ghi nhận Thanh toán Bồi thường &amp; Chứng từ (BF-04)
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-gray-800 block mb-1">Ngày chuyển khoản *</label>
                  <input
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="w-full h-8.5 px-3 bg-white border border-gray-300 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="font-bold text-gray-800 block mb-1">Mã giao dịch ngân hàng (UNC) *</label>
                  <Input
                    value={transactionCode}
                    onChange={(e) => setTransactionCode(e.target.value)}
                    placeholder="VD: FT2611250012"
                  />
                </div>
              </div>
              <div>
                <label className="font-bold text-gray-800 block mb-1">Ảnh biên lai / Chứng từ chuyển khoản *</label>
                <div className="flex flex-wrap items-center gap-2">
                  <Upload
                    showUploadList={false}
                    accept="image/*,.pdf"
                    customRequest={async ({ file, onSuccess, onError }) => {
                      try {
                        const uploaded = await uploadApi.uploadToCloudinary(file, 'nexlog/claims');
                        setPaymentProofUrl(uploaded.url);
                        onSuccess?.({ url: uploaded.url });
                        message.success('Đã tải chứng từ thanh toán lên Cloudinary.');
                      } catch (err) {
                        message.error(err?.message || 'Lỗi tải chứng từ lên Cloudinary');
                        onError?.(err);
                      }
                    }}
                  >
                    <Button icon={<UploadIcon size={14} />}>Tải biên lai lên Cloudinary</Button>
                  </Upload>
                  <Input
                    className="flex-1 min-w-[220px]"
                    value={paymentProofUrl}
                    onChange={(e) => setPaymentProofUrl(e.target.value)}
                    placeholder="Hoặc dán URL chứng từ chuyển khoản..."
                  />
                </div>
                {paymentProofUrl && (
                  <div className="mt-2">
                    <Image
                      src={paymentProofUrl}
                      alt="Biên lai chuyển khoản"
                      width={120}
                      height={80}
                      className="rounded-lg object-cover border border-emerald-200"
                    />
                  </div>
                )}
              </div>
              <div>
                <label className="font-bold text-gray-800 block mb-1">Ghi chú chi trả</label>
                <Input.TextArea
                  rows={2}
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                  placeholder="Ghi chú nội dung chuyển khoản bồi thường..."
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button onClick={onClose}>Đóng</Button>
                <Button
                  type="primary"
                  loading={recordingPayment}
                  icon={<CreditCard size={14} />}
                  onClick={onRecordManagerPayment}
                  className="bg-emerald-600 hover:bg-emerald-700 font-bold"
                >
                  Ghi nhận thanh toán &amp; Gửi Email khách hàng
                </Button>
              </div>
            </div>
          )}

          {/* THÔNG TIN THANH TOÁN & ĐÓNG HỒ SƠ (PAID / CLOSED_COMPENSATED) */}
          {(selectedStatus === 'PAID' || selectedStatus === 'CLOSED_COMPENSATED') && (
            <div className="p-3.5 bg-cyan-50/70 rounded-xl border border-cyan-200 space-y-2">
              <div className="font-bold text-cyan-950 uppercase text-[11px] flex items-center gap-1.5">
                <CreditCard size={14} /> Thông tin Thanh toán &amp; Trạng thái Đóng hồ sơ
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>Số tiền chi trả: <strong className="font-mono text-emerald-700">{Number(selectedClaim.approved_amount || selectedClaim.amount || 0).toLocaleString('vi-VN')} đ</strong></div>
                <div>Mã giao dịch (UNC): <strong className="font-mono">{selectedClaim.transaction_code || 'N/A'}</strong></div>
                <div>Ngày chuyển khoản: <strong>{selectedClaim.payment_date || 'N/A'}</strong></div>
                <div>Người ghi nhận: <strong>{selectedClaim.paid_by_name || 'Quản lý'}</strong></div>
              </div>
              {selectedClaim.payment_note && <div><b>Ghi chú chi trả:</b> {selectedClaim.payment_note}</div>}
              {selectedClaim.payment_proof_url && (
                <div className="pt-1">
                  <Image
                    src={selectedClaim.payment_proof_url}
                    alt="Chứng từ thanh toán"
                    width={120}
                    height={80}
                    className="rounded-lg object-cover border border-cyan-200"
                  />
                </div>
              )}
              {selectedStatus === 'PAID' ? (
                <div className="text-cyan-900 font-semibold pt-1">
                  ⏳ Đang chờ khách hàng xác nhận đã nhận tiền trên Tracking Page
                  {selectedClaim.auto_close_deadline ? ` (tự động đóng lúc ${new Date(selectedClaim.auto_close_deadline).toLocaleString('vi-VN')})` : ' (tự động đóng sau 7 ngày)'}.
                </div>
              ) : (
                <div className="text-emerald-800 font-bold pt-1">
                  ✔ Đã đóng hồ sơ ({selectedClaim.close_method === 'AUTO_7_DAYS' ? 'Tự động đóng sau 7 ngày' : 'Khách hàng xác nhận đã nhận tiền'})
                  {selectedClaim.closed_at ? ` lúc ${new Date(selectedClaim.closed_at).toLocaleString('vi-VN')}` : ''}.
                </div>
              )}
            </div>
          )}

          {/* FORM THẨM ĐỊNH CỦA MANAGER (khi PENDING và không phải readOnly) */}
          {!isReadOnly && selectedStatus === 'PENDING' && (
            <div className="p-4 bg-white rounded-xl border-2 border-primary/20 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-surface-container pb-2">
                <span className="font-bold text-primary uppercase text-[11px]">
                  Quyết định của Quản lý (Manager Review)
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    size="small"
                    type={decisionMode === 'APPROVE' ? 'primary' : 'default'}
                    className={decisionMode === 'APPROVE' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
                    icon={<CheckCircle2 size={14} />}
                    onClick={() => setDecisionMode('APPROVE')}
                  >
                    Phê duyệt bồi thường
                  </Button>
                  <Button
                    size="small"
                    danger
                    type={decisionMode === 'REJECT' ? 'primary' : 'default'}
                    icon={<XCircle size={14} />}
                    onClick={() => setDecisionMode('REJECT')}
                  >
                    Từ chối bồi thường
                  </Button>
                </div>
              </div>

              <div>
                <label className="font-bold text-primary block mb-1">Kết quả giám định / Đánh giá (Assessment Result):</label>
                <Input.TextArea
                  rows={2}
                  value={assessmentResult}
                  onChange={(e) => setAssessmentResult(e.target.value)}
                  placeholder="Ghi nhận kết quả kiểm tra thực tế hoặc biên bản giám định..."
                />
              </div>

              {decisionMode === 'APPROVE' ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="font-bold text-primary block mb-1">Tỷ lệ hư hỏng (%)</label>
                      <InputNumber
                        className="w-full"
                        min={0}
                        max={100}
                        value={damagePercentage}
                        onChange={setDamagePercentage}
                        placeholder="0 - 100"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-primary block mb-1">Phương án xử lý (Outcome) *</label>
                      <Select className="w-full" value={outcome} onChange={setOutcome}>
                        <Select.Option value="CUSTOMER_RETAIN">Khách giữ hàng &amp; Bồi thường phần hỏng</Select.Option>
                        <Select.Option value="COMPANY_RECOVERY">ALS thu hồi hàng &amp; Bồi thường 100%</Select.Option>
                      </Select>
                    </div>
                    <div>
                      <label className="font-bold text-primary block mb-1">Số tiền duyệt bồi thường (VNĐ) *</label>
                      <div className="flex gap-1">
                        <InputNumber
                          className="w-full"
                          min={0}
                          step={100000}
                          value={approvedAmount}
                          onChange={setApprovedAmount}
                          formatter={(v) => (v !== null && v !== undefined ? `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : '')}
                          parser={(v) => (v ? v.replace(/,/g, '') : '')}
                        />
                        <Button
                          title="Tính tự động theo giá trị khai báo & % hư hỏng"
                          icon={<Calculator size={14} />}
                          onClick={onAutoCalculateAmount}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="font-bold text-primary block mb-1">Điều khoản hợp đồng áp dụng</label>
                      <Input
                        value={contractClauseRef}
                        onChange={(e) => setContractClauseRef(e.target.value)}
                        placeholder="VD: Điều 8.2 - Bồi thường thiệt hại hàng hóa"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-primary block mb-1">Hotline hỗ trợ</label>
                      <Input value={contactHotline} onChange={(e) => setContactHotline(e.target.value)} />
                    </div>
                  </div>

                  <div>
                    <label className="font-bold text-primary block mb-1">
                      Nhận xét phê duyệt {Number(approvedAmount || 0) > Number(selectedClaim.liability_limit || 500000000) ? '* (Bắt buộc do vượt hạn mức)' : ''}
                    </label>
                    <Input.TextArea
                      rows={2}
                      value={claimComment}
                      onChange={(e) => setClaimComment(e.target.value)}
                      placeholder="Nhập ghi chú phê duyệt..."
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="font-bold text-primary block mb-1">Điều khoản viện dẫn từ chối</label>
                      <Input
                        value={contractClauseRef}
                        onChange={(e) => setContractClauseRef(e.target.value)}
                        placeholder="VD: Điều 4.2 - Miễn trừ trách nhiệm"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-primary block mb-1">Hotline giải đáp khiếu nại</label>
                      <Input value={contactHotline} onChange={(e) => setContactHotline(e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <label className="font-bold text-red-700 block mb-1">Lý do từ chối bồi thường *:</label>
                    <Input.TextArea
                      rows={3}
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="Nêu rõ lý do và căn cứ từ chối bồi thường..."
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button onClick={onClose}>Đóng</Button>
                <Button
                  type="primary"
                  danger={decisionMode === 'REJECT'}
                  loading={decidingClaim}
                  onClick={onDecideClaim}
                  className={decisionMode === 'APPROVE' ? 'bg-emerald-600 hover:bg-emerald-700 font-bold' : 'font-bold'}
                >
                  {decisionMode === 'APPROVE'
                    ? 'Xác nhận Phê duyệt (Chờ ĐPV gọi khách)'
                    : 'Xác nhận Từ chối (Chờ ĐPV gọi khách)'}
                </Button>
              </div>
            </div>
          )}

          {/* FORM GHI NHẬN CUỘC GỌI CỦA DISPATCHER */}
          {canRecordCallForSelected && (
            <div className="p-4 bg-amber-50/70 rounded-xl border-2 border-amber-300 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-bold text-amber-950 uppercase text-[11px] flex items-center gap-1.5">
                  <PhoneCall size={15} /> Điều phối viên: Gọi điện thông báo khách hàng &amp; Ghi nhận kết quả (BF-04)
                </span>
                {(callContactPhone || selectedClaim.contact_phone) && (
                  <a
                    href={`tel:${callContactPhone || selectedClaim.contact_phone}`}
                    className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs inline-flex items-center gap-1"
                  >
                    <PhoneCall size={13} /> Gọi ngay: {callContactPhone || selectedClaim.contact_phone}
                  </a>
                )}
              </div>

              <Alert
                type={selectedStatus === 'REJECTED' ? 'warning' : 'info'}
                showIcon
                title={
                  selectedStatus === 'REJECTED'
                    ? 'Hồ sơ này đang bị TỪ CHỐI. Sau khi bạn ghi nhận cuộc gọi thông báo lý do cho khách hàng, hồ sơ sẽ tự động ĐÓNG (CLOSED_REJECTED).'
                    : 'Hồ sơ này đã được PHÊ DUYỆT. Sau khi bạn ghi nhận cuộc gọi xác nhận với khách hàng, Quản lý mới có thể ghi nhận thanh toán.'
                }
                className="rounded-lg text-xs"
              />

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-gray-800 block mb-1">Số điện thoại đã gọi</label>
                  <Input
                    value={callContactPhone}
                    onChange={(e) => setCallContactPhone(e.target.value)}
                    placeholder="SĐT liên hệ khách hàng"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="font-bold text-gray-800 block mb-1">Nội dung trao đổi / Lý do &amp; Kết quả cuộc gọi *</label>
                  <Input.TextArea
                    rows={2}
                    value={callNote}
                    onChange={(e) => setCallNote(e.target.value)}
                    placeholder="VD: Đã gọi trao đổi với anh/chị..., khách đã nắm thông tin..."
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button onClick={onClose}>Đóng</Button>
                <Button
                  type="primary"
                  loading={recordingCall}
                  icon={<PhoneCall size={14} />}
                  onClick={onRecordDispatcherCall}
                  className="bg-amber-600 hover:bg-amber-700 font-bold"
                >
                  {selectedStatus === 'REJECTED'
                    ? 'Ghi nhận cuộc gọi & Đóng hồ sơ Từ chối'
                    : 'Ghi nhận cuộc gọi & Mở khóa thanh toán'}
                </Button>
              </div>
            </div>
          )}

          {/* Footer đóng mặc định nếu không ở mode thao tác */}
          {!(!isReadOnly && selectedStatus === 'PENDING') && !canRecordCallForSelected && !canRecordPaymentForSelected && (
            <div className="flex justify-end pt-2">
              <Button onClick={onClose}>Đóng</Button>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
