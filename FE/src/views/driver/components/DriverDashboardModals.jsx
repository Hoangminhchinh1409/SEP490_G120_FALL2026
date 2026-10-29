import React from 'react';
import { Modal, Upload, Input, InputNumber, Checkbox, Select, Button } from 'antd';
import { Camera, Ban, DollarSign, FileText } from 'lucide-react';

export default function DriverDashboardModals({
  trip,
  tripData,
  stops,
  truck,
  activeStopTarget,
  actionLoading,
  // Accept Modal
  acceptModalOpen,
  setAcceptModalOpen,
  handleAcceptTrip,
  // Seal / Pickup Modal
  sealModalOpen,
  setSealModalOpen,
  handleSubmitPickup,
  cargoPhotoUrl,
  setCargoPhotoUrl,
  loadedCargoPhotoUrl,
  setLoadedCargoPhotoUrl,
  sealPhotoUrl,
  setSealPhotoUrl,
  sealNumber,
  setSealNumber,
  loadedPackages,
  setLoadedPackages,
  loadedWeight,
  setLoadedWeight,
  // POD / Delivery Modal
  podModalOpen,
  setPodModalOpen,
  handleSubmitDelivery,
  podPhotoUrl,
  setPodPhotoUrl,
  cutSealPhotoUrl,
  setCutSealPhotoUrl,
  unloadedCargoPhotoUrl,
  setUnloadedCargoPhotoUrl,
  receiverName,
  setReceiverName,
  deliveredPackages,
  setDeliveredPackages,
  docsHandedOver,
  setDocsHandedOver,
  // Refusal Modal
  refusalModalOpen,
  setRefusalModalOpen,
  handleSubmitRefusal,
  refusalReason,
  setRefusalReason,
  refusalCargoPhoto,
  setRefusalCargoPhoto,
  refusalNote,
  setRefusalNote,
  // Extra Fee Modal
  extraFeeModalOpen,
  setExtraFeeModalOpen,
  handleSubmitExtraFee,
  feeType,
  setFeeType,
  feeAmount,
  setFeeAmount,
  feeReason,
  setFeeReason,
  feePhotoUrl,
  setFeePhotoUrl,
  // Docs Modal
  docsModalOpen,
  setDocsModalOpen
}) {
  return (
    <>
      {/* MODAL 0: XÁC NHẬN NHẬN CHUYẾN */}
      <Modal
        open={acceptModalOpen}
        onCancel={() => setAcceptModalOpen(false)}
        title={<span className="font-bold text-slate-800">Xác nhận nhận chuyến xe</span>}
        okText="Tôi đồng ý nhận chuyến"
        cancelText="Đóng"
        confirmLoading={actionLoading}
        okButtonProps={{ className: "bg-blue-600 font-bold" }}
        onOk={() => handleAcceptTrip(trip?.id)}
      >
        <p className="text-sm text-slate-600 my-2">
          Bạn có chắc chắn muốn nhận chuyến xe <b>{trip?.trip_code}</b> không? (MSG17)
        </p>
        <p className="text-xs text-slate-400">
          Sau khi xác nhận, chuyến xe sẽ chuyển sang trạng thái Đã nhận (Accepted).
        </p>
      </Modal>

      {/* MODAL 1: BỐC HÀNG & NIÊM CHÌ 3 BƯỚC */}
      <Modal 
        open={sealModalOpen} 
        onCancel={() => setSealModalOpen(false)} 
        title={<span className="font-bold text-slate-800">Lấy hàng & Niêm chì 3 Bước (BR-11)</span>} 
        okText="Lưu lấy hàng (BR-11)"
        confirmLoading={actionLoading}
        okButtonProps={{ className: "bg-blue-600 font-bold" }}
        onOk={handleSubmitPickup}
      >
        <div className="space-y-3 py-2 text-xs">
          <p className="text-slate-500">
            Bắt buộc chụp đủ 3 ảnh: Hàng trước bốc, Hàng trong thùng xe, và Niêm chì kèm biển số xe.
          </p>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="font-bold text-slate-700 block mb-1">1. Hàng trước bốc (*)</label>
              <Upload 
                listType="picture-card" 
                maxCount={1} 
                beforeUpload={() => false}
                defaultFileList={[{ uid: "-1", name: "cargo.jpg", status: "done", url: cargoPhotoUrl }]}
                onChange={(i) => {
                  const f = i.fileList[0];
                  if (f) setCargoPhotoUrl(f.thumbUrl || f.url || cargoPhotoUrl);
                }}
              >
                <div className="flex flex-col items-center text-slate-400">
                  <Camera size={16}/>
                  <span className="text-[10px]">Trước bốc</span>
                </div>
              </Upload>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">2. Hàng trên xe (*)</label>
              <Upload 
                listType="picture-card" 
                maxCount={1} 
                beforeUpload={() => false}
                defaultFileList={[{ uid: "-2", name: "loaded.jpg", status: "done", url: loadedCargoPhotoUrl }]}
                onChange={(i) => {
                  const f = i.fileList[0];
                  if (f) setLoadedCargoPhotoUrl(f.thumbUrl || f.url || loadedCargoPhotoUrl);
                }}
              >
                <div className="flex flex-col items-center text-slate-400">
                  <Camera size={16}/>
                  <span className="text-[10px]">Trong thùng</span>
                </div>
              </Upload>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">3. Chì & Biển số (*)</label>
              <Upload 
                listType="picture-card" 
                maxCount={1} 
                beforeUpload={() => false}
                defaultFileList={[{ uid: "-3", name: "seal.jpg", status: "done", url: sealPhotoUrl }]}
                onChange={(i) => {
                  const f = i.fileList[0];
                  if (f) setSealPhotoUrl(f.thumbUrl || f.url || sealPhotoUrl);
                }}
              >
                <div className="flex flex-col items-center text-slate-400">
                  <Camera size={16}/>
                  <span className="text-[10px]">Chì & biển</span>
                </div>
              </Upload>
            </div>
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Số chì niêm phong (*)</label>
            <Input 
              value={sealNumber} 
              onChange={(e) => setSealNumber(e.target.value)} 
              placeholder="VD: SEAL-998811" 
              className="py-1.5 font-mono font-bold"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Số kiện bốc (*)</label>
              <InputNumber 
                min={1} 
                value={loadedPackages} 
                onChange={setLoadedPackages} 
                className="w-full"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">Khối lượng (kg) (*)</label>
              <InputNumber 
                min={1} 
                value={loadedWeight} 
                onChange={setLoadedWeight} 
                className="w-full"
              />
            </div>
          </div>
          {tripData?.trip?.truck && (
            <span className="text-[11px] text-slate-400 block">
              Tải trọng cho phép của xe: <b>{tripData.trip.truck.allowed_payload} kg</b> (BR-33)
            </span>
          )}
        </div>
      </Modal>

      {/* MODAL 2: GIAO HÀNG & BIÊN BẢN POD */}
      <Modal 
        open={podModalOpen} 
        onCancel={() => setPodModalOpen(false)} 
        title={<span className="font-bold text-slate-800">Biên bản Giao nhận Hàng POD (BR-12)</span>} 
        okText="Lưu giao hàng (BR-12)"
        confirmLoading={actionLoading}
        okButtonProps={{ className: "bg-emerald-600 font-bold" }}
        onOk={handleSubmitDelivery}
      >
        <div className="space-y-3 py-2 text-xs">
          {activeStopTarget?.order?.order_type === "Export" ? (
            <div>
              <p className="text-blue-600 font-bold mb-2">Đơn hàng Xuất Khẩu: Chụp ảnh cắt chì & ảnh dỡ hàng</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Ảnh cắt chì (*)</label>
                  <Upload 
                    listType="picture-card" 
                    maxCount={1} 
                    beforeUpload={() => false}
                    defaultFileList={[{ uid: "-1", name: "cut.jpg", status: "done", url: cutSealPhotoUrl }]}
                    onChange={(i) => {
                      const f = i.fileList[0];
                      if (f) setCutSealPhotoUrl(f.thumbUrl || f.url || cutSealPhotoUrl);
                    }}
                  >
                    <div className="flex flex-col items-center text-slate-400">
                      <Camera size={16}/>
                      <span className="text-[10px]">Cắt chì</span>
                    </div>
                  </Upload>
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Ảnh dỡ hàng (*)</label>
                  <Upload 
                    listType="picture-card" 
                    maxCount={1} 
                    beforeUpload={() => false}
                    defaultFileList={[{ uid: "-2", name: "unloaded.jpg", status: "done", url: unloadedCargoPhotoUrl }]}
                    onChange={(i) => {
                      const f = i.fileList[0];
                      if (f) setUnloadedCargoPhotoUrl(f.thumbUrl || f.url || unloadedCargoPhotoUrl);
                    }}
                  >
                    <div className="flex flex-col items-center text-slate-400">
                      <Camera size={16}/>
                      <span className="text-[10px]">Dỡ hàng</span>
                    </div>
                  </Upload>
                </div>
              </div>
            </div>
          ) : (
            <div>
              <label className="font-bold text-slate-700 block mb-1">Ảnh biên bản POD có ký nhận (*)</label>
              <Upload 
                listType="picture-card" 
                maxCount={1} 
                beforeUpload={() => false}
                defaultFileList={[{ uid: "-1", name: "pod.jpg", status: "done", url: podPhotoUrl }]}
                onChange={(i) => {
                  const f = i.fileList[0];
                  if (f) setPodPhotoUrl(f.thumbUrl || f.url || podPhotoUrl);
                }}
              >
                <div className="flex flex-col items-center text-slate-400">
                  <Camera size={16}/>
                  <span className="text-[10px]">Chụp POD</span>
                </div>
              </Upload>
              <div>
                <label className="font-bold text-slate-700 block mb-1 mt-2">Họ tên người nhận hàng (*)</label>
                <Input 
                  value={receiverName} 
                  onChange={(e) => setReceiverName(e.target.value)} 
                  placeholder="VD: Nguyễn Văn C" 
                  className="py-1.5"
                />
              </div>
            </div>
          )}

          <div>
            <label className="font-bold text-slate-700 block mb-1">Số kiện đã giao thực tế</label>
            <InputNumber 
              min={1} 
              value={deliveredPackages} 
              onChange={setDeliveredPackages} 
              className="w-full"
            />
          </div>

          <div className="pt-1">
            <Checkbox 
              checked={docsHandedOver} 
              onChange={(e) => setDocsHandedOver(e.target.checked)}
              className="font-bold text-slate-700"
            >
              Đã bàn giao đủ chứng từ (BR-12)
            </Checkbox>
          </div>
        </div>
      </Modal>

      {/* MODAL 3: KHÁCH KHÔNG NHẬN HÀNG */}
      <Modal
        open={refusalModalOpen}
        onCancel={() => setRefusalModalOpen(false)}
        title={<span className="font-bold text-red-600 flex items-center gap-1.5"><Ban size={18}/> Khách không nhận hàng (BR-57)</span>}
        okText="Gửi báo cáo từ chối"
        confirmLoading={actionLoading}
        okButtonProps={{ danger: true, className: "font-bold" }}
        onOk={handleSubmitRefusal}
      >
        <div className="space-y-3 py-2 text-xs">
          <p className="text-slate-500">
            Ghi nhận khách từ chối nhận hàng tại điểm giao. Đơn hàng sẽ được chuyển sang <b>Delivered (Exception)</b> và gửi cảnh báo cho Điều phối viên (MSG75).
          </p>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Lý do từ chối (*) (Bắt buộc)</label>
            <Input 
              value={refusalReason} 
              onChange={(e) => setRefusalReason(e.target.value)} 
              placeholder="VD: Hàng móp méo, khách không nhận; sai địa chỉ..." 
              className="py-1.5"
            />
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Ảnh hiện trường hàng hóa (*) (Bắt buộc)</label>
            <Upload 
              listType="picture-card" 
              maxCount={1} 
              beforeUpload={() => false}
              defaultFileList={[{ uid: "-1", name: "refusal.jpg", status: "done", url: refusalCargoPhoto }]}
              onChange={(i) => {
                const f = i.fileList[0];
                if (f) setRefusalCargoPhoto(f.thumbUrl || f.url || refusalCargoPhoto);
              }}
            >
              <div className="flex flex-col items-center text-slate-400">
                <Camera size={16}/>
                <span className="text-[10px]">Ảnh hàng</span>
              </div>
            </Upload>
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Ghi chú bổ sung (Tùy chọn)</label>
            <Input.TextArea 
              rows={2}
              value={refusalNote} 
              onChange={(e) => setRefusalNote(e.target.value)} 
              placeholder="Ý kiến của khách, thời gian chờ..." 
            />
          </div>
        </div>
      </Modal>

      {/* MODAL 4: ĐỀ XUẤT PHỤ PHÍ */}
      <Modal
        open={extraFeeModalOpen}
        onCancel={() => setExtraFeeModalOpen(false)}
        title={<span className="font-bold text-amber-600 flex items-center gap-1.5"><DollarSign size={18}/> Đề xuất Phụ phí (BR-30)</span>}
        okText="Gửi đề xuất phí (MSG85)"
        confirmLoading={actionLoading}
        okButtonProps={{ className: "bg-amber-600 font-bold" }}
        onOk={handleSubmitExtraFee}
      >
        <div className="space-y-3 py-2 text-xs">
          <p className="text-slate-500">
            Phụ phí đề xuất sẽ ở trạng thái <b>Proposed</b>. Điều phối viên sẽ nhận được thông báo để xác nhận hoặc từ chối (BR-30).
          </p>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Loại phụ phí (*) (Bắt buộc)</label>
            <Select 
              value={feeType} 
              onChange={setFeeType} 
              className="w-full"
            >
              <Select.Option value="Bốc xếp thêm">Bốc xếp thêm</Select.Option>
              <Select.Option value="Nâng hạ">Nâng hạ</Select.Option>
              <Select.Option value="Trả kho thay khách">Trả kho thay khách</Select.Option>
            </Select>
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Số tiền đề xuất (VND) (*)</label>
            <InputNumber 
              min={1000} 
              step={10000} 
              value={feeAmount} 
              onChange={setFeeAmount} 
              formatter={(val) => `${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
              className="w-full"
            />
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Lý do phát sinh (*) (Bắt buộc)</label>
            <Input 
              value={feeReason} 
              onChange={(e) => setFeeReason(e.target.value)} 
              placeholder="VD: Không có xe nâng, phải thuê nhân công bốc dỡ ngoài..." 
              className="py-1.5"
            />
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Ảnh chứng từ / Biên lai (*) (Bắt buộc)</label>
            <Upload 
              listType="picture-card" 
              maxCount={1} 
              beforeUpload={() => false}
              defaultFileList={[{ uid: "-1", name: "receipt.jpg", status: "done", url: feePhotoUrl }]}
              onChange={(i) => {
                const f = i.fileList[0];
                if (f) setFeePhotoUrl(f.thumbUrl || f.url || feePhotoUrl);
              }}
            >
              <div className="flex flex-col items-center text-slate-400">
                <Camera size={16}/>
                <span className="text-[10px]">Chứng từ</span>
              </div>
            </Upload>
          </div>
        </div>
      </Modal>

      {/* MODAL 5: CHỨNG TỪ CHUYẾN XE */}
      <Modal
        open={docsModalOpen}
        onCancel={() => setDocsModalOpen(false)}
        title={<span className="font-bold text-slate-800 flex items-center gap-1.5"><FileText size={18}/> Chứng từ chuyến xe</span>}
        footer={[
          <Button key="close" type="primary" onClick={() => setDocsModalOpen(false)}>
            Đóng
          </Button>
        ]}
      >
        <div className="py-2 text-xs space-y-3">
          <div className="bg-slate-100 p-3 rounded-xl border border-slate-200">
            <span className="font-bold text-slate-800 block mb-1">1. Giấy vận tải điện tử (Waybill)</span>
            <p className="text-slate-600">Mã chuyến: <b>{trip?.trip_code}</b></p>
            <p className="text-slate-600">Xe phụ trách: <b>{truck?.plate_number}</b> ({truck?.model})</p>
            <p className="text-slate-600">Lộ trình: {stops.length} điểm dừng</p>
          </div>

          <div className="bg-slate-100 p-3 rounded-xl border border-slate-200">
            <span className="font-bold text-slate-800 block mb-1">2. Chứng từ khách hàng đính kèm</span>
            {stops.map((s) => (
              <div key={s.id} className="py-1 border-b border-slate-200 last:border-0">
                <span className="font-semibold text-slate-700">Điểm #{s.sequence} - Đơn {s.order?.order_code || 'N/A'}:</span>
                <p className="text-slate-500 text-[11px]">Người nhận: {s.order?.receiver_name || 'Khách hàng'} • ĐT: {s.order?.receiver_phone || 'N/A'}</p>
              </div>
            ))}
          </div>

          <p className="text-[11px] text-slate-400 italic">
            Chứng từ chuyến xe đã được lưu đệm trên thiết bị để bạn có thể xem lại ngay cả khi mất sóng (BR-27).
          </p>
        </div>
      </Modal>
    </>
  );
}

