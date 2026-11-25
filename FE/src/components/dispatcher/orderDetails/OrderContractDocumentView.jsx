import React from 'react';
import { Button, Tag, Input, Alert, Modal, Divider } from 'antd';
import { FileText, Send } from 'lucide-react';

export default function OrderContractDocumentView({
  open,
  onClose,
  order,
  isContractLocked,
  isEditingForm,
  setIsEditingForm,
  sendingEmail,
  contractSentAt,
  handleSendContractEmail,
  contractDetails,
  handleUpdateContractField,
  customTerms,
  newTerm,
  setNewTerm,
  handleAddTerm,
  handleRemoveTerm
}) {
  return (
    <Modal
      title={
        <div className="flex items-center justify-between w-full pr-8">
          <div className="flex items-center gap-2 text-indigo-900 text-sm font-bold">
            <FileText size={16} className="text-indigo-600" />
            <span>
              Hợp đồng Vận tải Đường bộ (NĐ 158/2024/NĐ-CP) — Đơn #
              {order.order_code || order.tracking_number || order.id}
            </span>
          </div>
          {!isContractLocked && (
            <Button
              size="small"
              type={isEditingForm ? 'primary' : 'default'}
              onClick={() => setIsEditingForm(!isEditingForm)}
              className={
                isEditingForm ? 'bg-amber-600 font-semibold text-xs' : 'text-xs font-semibold'
              }
            >
              {isEditingForm
                ? '✓ Xem bản xem trước (Preview)'
                : '✏️ Chỉnh sửa thông tin hợp đồng'}
            </Button>
          )}
        </div>
      }
      open={open}
      onCancel={onClose}
      width={900}
      footer={[
        <Button key="close" onClick={onClose}>
          Đóng
        </Button>,
        <Button
          key="send"
          type="primary"
          icon={<Send size={14} />}
          loading={sendingEmail}
          disabled={isContractLocked}
          onClick={() => {
            handleSendContractEmail();
            onClose();
          }}
          className="bg-indigo-600 font-bold"
        >
          {contractSentAt
            ? 'Lưu & Gửi lại Email cho Khách'
            : 'Lưu & Gửi Email Hợp đồng cho Khách'}
        </Button>
      ]}
    >
      <div className="max-h-[72vh] overflow-y-auto p-5 bg-white rounded-xl border border-gray-200 text-xs text-gray-800 space-y-4 font-sans leading-relaxed">
        {/* Thông báo chế độ chỉnh sửa */}
        {isEditingForm && !isContractLocked && (
          <Alert
            type="info"
            showIcon
            title="Chế độ Chỉnh sửa Hợp đồng trực tiếp"
            description="Điều phối viên có thể chỉnh sửa mọi thông tin về chủ thể, hành trình, cước phí, hạn mức bồi thường và quy tắc giờ chờ theo đàm phán với khách hàng trước khi bấm gửi."
            className="rounded-lg mb-2"
          />
        )}

        {/* Quốc hiệu & Tiêu ngữ chuẩn */}
        <div className="text-center space-y-1">
          <div className="font-bold text-xs uppercase tracking-wider text-gray-800">
            CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
          </div>
          <div className="font-semibold text-xs text-gray-800">Độc lập - Tự do - Hạnh phúc</div>
          <div className="text-gray-400 text-xs">---o0o---</div>
          <div className="font-bold text-base text-indigo-950 uppercase mt-2">
            HỢP ĐỒNG VẬN TẢI HÀNG HÓA ĐƯỜNG BỘ
          </div>
          <div className="text-gray-500 italic text-[11px]">
            Số: {order.order_code || order.tracking_number || order.id}/HĐVT-
            {new Date().getFullYear()}
          </div>
          <div className="text-[10px] text-gray-400 italic space-y-0.5 pt-1">
            <div>- Căn cứ Bộ luật Dân sự số 91/2015/QH13;</div>
            <div>- Căn cứ Luật Đường bộ số 35/2024/QH15;</div>
            <div>
              - Căn cứ Nghị định số 158/2024/NĐ-CP quy định về hoạt động vận tải đường bộ;
            </div>
            <div>
              - Hôm nay, ngày {new Date().getDate()} tháng {new Date().getMonth() + 1} năm{' '}
              {new Date().getFullYear()}, chúng tôi gồm có:
            </div>
          </div>
        </div>

        <Divider className="my-2" />

        {/* BÊN A: BÊN VẬN TẢI (ĐƠN VỊ KINH DOANH VẬN TẢI) */}
        <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-150 space-y-1.5">
          <div className="font-bold text-xs text-indigo-950 uppercase flex items-center justify-between">
            <span>BÊN VẬN TẢI (BÊN A): ĐƠN VỊ KINH DOANH VẬN TẢI</span>
            <Tag color="blue" className="m-0 text-[10px]">
              ALS LOGISTICS
            </Tag>
          </div>
          {isEditingForm ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] pt-1">
              <div>
                <span className="text-gray-500 block mb-0.5">Tên đơn vị vận tải:</span>
                <Input
                  size="small"
                  value={contractDetails.carrier_name}
                  onChange={(e) => handleUpdateContractField('carrier_name', e.target.value)}
                  className="text-xs"
                />
              </div>
              <div>
                <span className="text-gray-500 block mb-0.5">Mã số thuế:</span>
                <Input
                  size="small"
                  value={contractDetails.carrier_tax_code}
                  onChange={(e) => handleUpdateContractField('carrier_tax_code', e.target.value)}
                  className="text-xs"
                />
              </div>
              <div>
                <span className="text-gray-500 block mb-0.5">Địa chỉ trụ sở:</span>
                <Input
                  size="small"
                  value={contractDetails.carrier_address}
                  onChange={(e) => handleUpdateContractField('carrier_address', e.target.value)}
                  className="text-xs"
                />
              </div>
              <div>
                <span className="text-gray-500 block mb-0.5">Hotline / Điện thoại:</span>
                <Input
                  size="small"
                  value={contractDetails.carrier_phone}
                  onChange={(e) => handleUpdateContractField('carrier_phone', e.target.value)}
                  className="text-xs"
                />
              </div>
              <div>
                <span className="text-gray-500 block mb-0.5">Đại diện ký hợp đồng:</span>
                <Input
                  size="small"
                  value={contractDetails.carrier_rep}
                  onChange={(e) => handleUpdateContractField('carrier_rep', e.target.value)}
                  className="text-xs"
                />
              </div>
              <div>
                <span className="text-gray-500 block mb-0.5">Số CCCD đại diện Bên A:</span>
                <Input
                  size="small"
                  value={contractDetails.carrier_cid}
                  onChange={(e) => handleUpdateContractField('carrier_cid', e.target.value)}
                  className="text-xs"
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
              <div>
                • Tên đơn vị vận tải: <b>{contractDetails.carrier_name}</b>
              </div>
              <div>
                • Mã số thuế: <b>{contractDetails.carrier_tax_code}</b>
              </div>
              <div>• Địa chỉ trụ sở: {contractDetails.carrier_address}</div>
              <div>
                • Điện thoại / Hotline: <b>{contractDetails.carrier_phone}</b>
              </div>
              <div>
                • Đại diện theo pháp luật: <b>{contractDetails.carrier_rep}</b>
              </div>
              <div>
                • Số định danh cá nhân / CCCD đại diện: <b>{contractDetails.carrier_cid}</b>
              </div>
            </div>
          )}
        </div>

        {/* BÊN B: BÊN THUÊ VẬN TẢI (KHÁCH HÀNG) */}
        <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 space-y-1.5">
          <div className="font-bold text-xs text-gray-900 uppercase flex items-center justify-between">
            <span>BÊN THUÊ VẬN TẢI (BÊN B): TỔ CHỨC / CÁ NHÂN THUÊ VẬN TẢI</span>
            <Tag color="cyan" className="m-0 text-[10px]">
              KHÁCH HÀNG
            </Tag>
          </div>
          {isEditingForm ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] pt-1">
              <div>
                <span className="text-gray-500 block mb-0.5">
                  Tên tổ chức / cá nhân khách hàng:
                </span>
                <Input
                  size="small"
                  value={contractDetails.customer_name}
                  onChange={(e) => handleUpdateContractField('customer_name', e.target.value)}
                  className="text-xs"
                />
              </div>
              <div>
                <span className="text-gray-500 block mb-0.5">
                  Mã số thuế / Số CCCD khách hàng:
                </span>
                <Input
                  size="small"
                  value={contractDetails.customer_tax_code}
                  onChange={(e) => handleUpdateContractField('customer_tax_code', e.target.value)}
                  className="text-xs"
                />
              </div>
              <div>
                <span className="text-gray-500 block mb-0.5">Địa chỉ khách hàng:</span>
                <Input
                  size="small"
                  value={contractDetails.customer_address}
                  onChange={(e) => handleUpdateContractField('customer_address', e.target.value)}
                  className="text-xs"
                />
              </div>
              <div>
                <span className="text-gray-500 block mb-0.5">Số điện thoại liên hệ:</span>
                <Input
                  size="small"
                  value={contractDetails.customer_phone}
                  onChange={(e) => handleUpdateContractField('customer_phone', e.target.value)}
                  className="text-xs"
                />
              </div>
              <div>
                <span className="text-gray-500 block mb-0.5">Email tiếp nhận hợp đồng:</span>
                <Input
                  size="small"
                  value={contractDetails.customer_email}
                  onChange={(e) => handleUpdateContractField('customer_email', e.target.value)}
                  className="text-xs"
                />
              </div>
              <div>
                <span className="text-gray-500 block mb-0.5">Mã đơn hàng:</span>
                <span className="font-mono font-bold text-indigo-700">
                  {order.order_code || order.order_id || order.tracking_number}
                </span>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
              <div>
                • Tên tổ chức / cá nhân: <b>{contractDetails.customer_name}</b>
              </div>
              <div>
                • Mã số thuế / Số CCCD: <b>{contractDetails.customer_tax_code || 'Chưa cung cấp'}</b>
              </div>
              <div>
                • Địa chỉ: <b>{contractDetails.customer_address || 'Địa chỉ khách hàng'}</b>
              </div>
              <div>
                • Số điện thoại liên hệ: <b>{contractDetails.customer_phone || 'Chưa cung cấp'}</b>
              </div>
              <div>
                • Email tiếp nhận: <b>{contractDetails.customer_email || 'Chưa cung cấp'}</b>
              </div>
              <div>
                • Mã đơn hàng: <b>{order.order_code || order.order_id || order.tracking_number}</b>
              </div>
            </div>
          )}
        </div>

        <div className="text-[11px] text-gray-600 italic">
          Hai bên cùng thỏa thuận và ký kết Hợp đồng vận tải với các điều khoản cụ thể sau đây:
        </div>

        {/* ĐIỀU 1 */}
        <div className="space-y-1.5">
          <div className="font-bold text-indigo-900 uppercase text-xs">
            ĐIỀU 1. THÔNG TIN CHI TIẾT VỀ VIỆC THỰC HIỆN HỢP ĐỒNG
          </div>
          <div className="p-3 bg-gray-50/70 rounded-lg border border-gray-200 text-[11px] space-y-2">
            <div>
              <b>1. Thời gian thực hiện:</b>
              {isEditingForm ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                  <div>
                    <span className="text-gray-500 block mb-0.5">Thời gian bắt đầu (dự kiến):</span>
                    <Input
                      size="small"
                      value={contractDetails.pickup_time}
                      onChange={(e) => handleUpdateContractField('pickup_time', e.target.value)}
                      className="text-xs"
                    />
                  </div>
                  <div>
                    <span className="text-gray-500 block mb-0.5">Thời gian kết thúc:</span>
                    <Input
                      size="small"
                      value={contractDetails.delivery_time}
                      onChange={(e) => handleUpdateContractField('delivery_time', e.target.value)}
                      className="text-xs"
                    />
                  </div>
                </div>
              ) : (
                <div className="pl-3 mt-0.5 space-y-0.5">
                  <div>
                    - Thời gian bắt đầu thực hiện: <b>{contractDetails.pickup_time}</b>
                  </div>
                  <div>
                    - Thời gian kết thúc hợp đồng: <b>{contractDetails.delivery_time}</b>
                  </div>
                </div>
              )}
            </div>

            <div>
              <b>2. Hành trình vận chuyển:</b>
              {isEditingForm ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                  <div>
                    <span className="text-gray-500 block mb-0.5">Điểm đầu (Điểm lấy hàng):</span>
                    <Input
                      size="small"
                      value={contractDetails.pickup_address}
                      onChange={(e) => handleUpdateContractField('pickup_address', e.target.value)}
                      className="text-xs"
                    />
                  </div>
                  <div>
                    <span className="text-gray-500 block mb-0.5">Điểm cuối (Điểm trả hàng):</span>
                    <Input
                      size="small"
                      value={contractDetails.delivery_address}
                      onChange={(e) =>
                        handleUpdateContractField('delivery_address', e.target.value)
                      }
                      className="text-xs"
                    />
                  </div>
                  <div>
                    <span className="text-gray-500 block mb-0.5">Cự ly ước tính (km):</span>
                    <Input
                      size="small"
                      value={contractDetails.distance_km}
                      onChange={(e) => handleUpdateContractField('distance_km', e.target.value)}
                      className="text-xs"
                    />
                  </div>
                </div>
              ) : (
                <div className="pl-3 mt-0.5 space-y-0.5">
                  <div>
                    - Địa chỉ điểm đầu (Điểm lấy hàng): <b>{contractDetails.pickup_address}</b>
                  </div>
                  <div>
                    - Địa chỉ điểm cuối (Điểm trả hàng): <b>{contractDetails.delivery_address}</b>
                  </div>
                  <div>
                    - Các điểm xếp, dỡ hàng hóa trên hành trình:{' '}
                    <b>Theo lộ trình gán chuyến của Điều phối viên</b>
                  </div>
                  <div>
                    - Cự ly hành trình vận chuyển ước tính: <b>{contractDetails.distance_km} km</b>
                  </div>
                </div>
              )}
            </div>

            <div>
              <b>3. Số lượng &amp; Khối lượng hàng hóa vận chuyển:</b>
              {isEditingForm ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                  <div>
                    <span className="text-gray-500 block mb-0.5">Tên loại hàng hóa:</span>
                    <Input
                      size="small"
                      value={contractDetails.cargo_name}
                      onChange={(e) => handleUpdateContractField('cargo_name', e.target.value)}
                      className="text-xs"
                    />
                  </div>
                  <div>
                    <span className="text-gray-500 block mb-0.5">Quy cách đóng gói:</span>
                    <Input
                      size="small"
                      value={contractDetails.package_info}
                      onChange={(e) => handleUpdateContractField('package_info', e.target.value)}
                      className="text-xs"
                    />
                  </div>
                  <div>
                    <span className="text-gray-500 block mb-0.5">Khối lượng thực tế (kg):</span>
                    <Input
                      size="small"
                      value={contractDetails.weight}
                      onChange={(e) => handleUpdateContractField('weight', e.target.value)}
                      className="text-xs"
                    />
                  </div>
                  <div>
                    <span className="text-gray-500 block mb-0.5">Phương án xe Bên A bố trí:</span>
                    <Input
                      size="small"
                      value={contractDetails.truck_model}
                      onChange={(e) => handleUpdateContractField('truck_model', e.target.value)}
                      className="text-xs"
                    />
                  </div>
                </div>
              ) : (
                <div className="pl-3 mt-0.5 space-y-0.5">
                  <div>
                    - Tên hàng hóa: <b>{contractDetails.cargo_name}</b>
                  </div>
                  <div>
                    - Quy cách đóng gói: <b>{contractDetails.package_info}</b>
                  </div>
                  <div>
                    - Khối lượng hàng hóa thực tế: <b>{contractDetails.weight} kg</b> · Trọng lượng
                    tính cước: <b>{contractDetails.chargeable_weight} kg</b>
                  </div>
                  <div>
                    - Phương án phương tiện vận chuyển Bên A bố trí:{' '}
                    <b>{contractDetails.truck_model}</b>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ĐIỀU 2 */}
        <div className="space-y-1.5">
          <div className="font-bold text-indigo-900 uppercase text-xs">
            ĐIỀU 2. GIÁ TRỊ HỢP ĐỒNG VÀ PHƯƠNG THỨC THANH TOÁN
          </div>
          <div className="p-3 bg-gray-50/70 rounded-lg border border-gray-200 text-[11px] space-y-1.5">
            {isEditingForm ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <span className="text-gray-500 block mb-0.5">Tổng giá trị hợp đồng (VNĐ):</span>
                  <Input
                    size="small"
                    value={contractDetails.price_amount}
                    onChange={(e) =>
                      handleUpdateContractField('price_amount', Number(e.target.value) || 0)
                    }
                    className="text-xs font-bold text-red-600"
                  />
                </div>
                <div>
                  <span className="text-gray-500 block mb-0.5">Phương thức thanh toán:</span>
                  <Input
                    size="small"
                    value={contractDetails.payment_method}
                    onChange={(e) => handleUpdateContractField('payment_method', e.target.value)}
                    className="text-xs"
                  />
                </div>
                <div className="sm:col-span-2">
                  <span className="text-gray-500 block mb-0.5">Thời hạn thanh toán:</span>
                  <Input
                    size="small"
                    value={contractDetails.payment_term}
                    onChange={(e) => handleUpdateContractField('payment_term', e.target.value)}
                    className="text-xs"
                  />
                </div>
                <div className="sm:col-span-2">
                  <span className="text-gray-500 block mb-0.5">Quy định giờ chờ bốc dỡ:</span>
                  <Input
                    size="small"
                    value={contractDetails.waiting_fee_rule}
                    onChange={(e) => handleUpdateContractField('waiting_fee_rule', e.target.value)}
                    className="text-xs"
                  />
                </div>
              </div>
            ) : (
              <>
                <div>
                  • <b>Tổng giá trị hợp đồng:</b>{' '}
                  <b className="text-red-700 font-mono text-xs">
                    {Number(contractDetails.price_amount || 0).toLocaleString('vi-VN')} VNĐ
                  </b>{' '}
                  (Đã bao gồm chi phí nhiên liệu, phương tiện, lái xe và phí cầu đường cơ bản).
                </div>
                <div>
                  • <b>Phương thức thanh toán:</b> {contractDetails.payment_method}.
                </div>
                <div>
                  • <b>Thời hạn thanh toán:</b> {contractDetails.payment_term}.
                </div>
                <div>
                  • <b>Định mức thời gian chờ:</b> {contractDetails.waiting_fee_rule}.
                </div>
              </>
            )}
          </div>
        </div>

        {/* ĐIỀU 3 */}
        <div className="space-y-1.5">
          <div className="font-bold text-indigo-900 uppercase text-xs">
            ĐIỀU 3. QUYỀN VÀ NGHĨA VỤ CỦA BÊN A (BÊN VẬN TẢI)
          </div>
          <div className="p-3 bg-gray-50/70 rounded-lg border border-gray-200 text-[11px] space-y-1">
            <div>
              • Cung cấp phương tiện vận chuyển đúng chất lượng, đúng thời gian và địa điểm đã thỏa
              thuận tại Điều 1; đảm bảo phương tiện đáp ứng đầy đủ các điều kiện an toàn kỹ thuật
              theo quy định pháp luật.
            </div>
            <div>
              • Thực hiện nghiêm chỉnh các nghĩa vụ thuế đối với Nhà nước liên quan đến hoạt động
              cung cấp dịch vụ vận tải theo hợp đồng này.
            </div>
            <div>
              • Mua bảo hiểm trách nhiệm dân sự của chủ xe cơ giới đối với hàng hóa theo quy định
              pháp luật.
            </div>
            <div>
              • Có quyền yêu cầu Bên B thanh toán đầy đủ, đúng hạn giá trị hợp đồng; từ chối vận
              chuyển nếu Bên B vi phạm các quy định về an toàn, cấm vận chuyển hàng hóa nguy hiểm,
              chất cấm.
            </div>
            <div>
              •{' '}
              <b>
                Đường dây nóng tiếp nhận phản ánh, khiếu nại của khách hàng: 1900 3133 / 0988 123
                456
              </b>{' '}
              (Ban Điều phối ALS).
            </div>
          </div>
        </div>

        {/* ĐIỀU 4 */}
        <div className="space-y-1.5">
          <div className="font-bold text-indigo-900 uppercase text-xs">
            ĐIỀU 4. QUYỀN VÀ NGHĨA VỤ CỦA BÊN B (BÊN THUÊ VẬN TẢI)
          </div>
          <div className="p-3 bg-gray-50/70 rounded-lg border border-gray-200 text-[11px] space-y-1">
            <div>
              • Thanh toán đầy đủ giá trị hợp đồng cho Bên A theo đúng thời hạn và phương thức đã
              thỏa thuận.
            </div>
            <div>
              • Cung cấp chính xác, đầy đủ thông tin về hàng hóa và tạo điều kiện thuận lợi để Bên A
              thực hiện việc xếp dỡ hàng hóa đúng tiến độ.
            </div>
            <div>
              • Chấp hành nghiêm chỉnh các quy định về an toàn giao thông; không gửi vũ khí, chất
              cháy nổ, chất độc hại hoặc hàng hóa cấm lưu thông lên phương tiện.
            </div>
            <div>
              • Có quyền yêu cầu Bên A bồi thường thiệt hại nếu Bên A vi phạm cam kết trong hợp đồng
              gây thiệt hại về hàng hóa (hư hỏng, mất mát). Khách hàng có quyền tạo khiếu nại trong
              vòng <b>14 ngày</b> kể từ khi nhận hàng.
            </div>
          </div>
        </div>

        {/* ĐIỀU 5 */}
        <div className="space-y-1.5">
          <div className="font-bold text-indigo-900 uppercase text-xs">
            ĐIỀU 5. CAM KẾT THỰC HIỆN VÀ ĐỀN BÙ THIỆT HẠI
          </div>
          <div className="p-3 bg-gray-50/70 rounded-lg border border-gray-200 text-[11px] space-y-1.5">
            <div>
              • Hai bên cam kết thực hiện nghiêm túc các điều khoản đã thỏa thuận trong hợp đồng
              này. Mọi sửa đổi, bổ sung phải được sự đồng ý bằng văn bản của cả hai bên.
            </div>
            <div>
              • <b>Quy định về đền bù thiệt hại:</b>
              <div className="pl-3 mt-0.5 space-y-0.5">
                <div>
                  - Trường hợp Bên A vi phạm cam kết dẫn đến việc chậm trễ thời gian, hủy chuyến
                  hoặc làm hư hỏng, mất mát tài sản (hàng hóa) của Bên B do lỗi chủ quan của Bên A,
                  Bên A chịu trách nhiệm đền bù thiệt hại thỏa đáng theo thỏa thuận hoặc theo quy
                  định của pháp luật hiện hành.
                </div>
                <div>
                  - <b>Trường hợp miễn trách nhiệm cho Bên A:</b> Nếu Bên A đã chủ động liên hệ
                  trước với Bên B để thông báo về lịch trình/thời gian di chuyển, nhưng khi phương
                  tiện hoặc nhân sự của Bên A đến điểm giao nhận đúng theo thông báo mà đại diện
                  hoặc người nhận của Bên B vắng mặt, không có người tiếp nhận, thì mọi gián đoạn,
                  phát sinh hoặc thiệt hại liên quan được tính là <b>lỗi thuộc về Bên B</b>. Trong
                  trường hợp này, Bên A được miễn toàn bộ trách nhiệm về việc chậm trễ các điểm tiếp
                  theo và có quyền áp dụng chi phí chờ đợi, chi phí lưu kho/bãi hoặc chi phí vận
                  chuyển phát sinh (nếu có) theo quy định của công ty.
                </div>
                <div>
                  - Trường hợp Bên B hủy hợp đồng hoặc vi phạm các nghĩa vụ gây thiệt hại cho Bên A,
                  Bên B chịu trách nhiệm bồi thường chi phí phát sinh thực tế cho Bên A theo biểu
                  phí hủy đơn đã công bố.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ĐIỀU 6: ĐIỀU KHOẢN BỔ SUNG RIÊNG */}
        <div className="space-y-1.5">
          <div className="font-bold text-indigo-900 uppercase text-xs flex items-center justify-between">
            <span>ĐIỀU 6. CÁC ĐIỀU KHOẢN BỔ SUNG THỎA THUẬN RIÊNG</span>
            <span className="text-[10px] text-gray-500 font-normal">
              ({customTerms.length} điều khoản)
            </span>
          </div>
          <div className="p-3 bg-indigo-50/60 rounded-lg border border-indigo-150 text-[11px] space-y-1.5">
            {customTerms.length > 0 ? (
              customTerms.map((term, i) => (
                <div key={i} className="flex items-start justify-between gap-2">
                  <div>• {term}</div>
                  {isEditingForm && !isContractLocked && (
                    <button
                      type="button"
                      onClick={() => handleRemoveTerm(i)}
                      className="text-red-500 hover:text-red-700 font-semibold cursor-pointer shrink-0"
                    >
                      [Xóa]
                    </button>
                  )}
                </div>
              ))
            ) : (
              <div className="text-gray-400 italic">Chưa có điều khoản bổ sung riêng nào.</div>
            )}

            {isEditingForm && !isContractLocked && (
              <div className="pt-2 flex items-center gap-2">
                <Input
                  size="small"
                  placeholder="Thêm điều khoản riêng mới..."
                  value={newTerm}
                  onChange={(e) => setNewTerm(e.target.value)}
                  onPressEnter={handleAddTerm}
                  className="text-xs"
                />
                <Button
                  size="small"
                  type="primary"
                  onClick={handleAddTerm}
                  className="bg-indigo-600 text-xs shrink-0"
                >
                  Thêm
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* ĐIỀU 7 */}
        <div className="space-y-1.5">
          <div className="font-bold text-indigo-900 uppercase text-xs">
            ĐIỀU 7. ĐIỀU KHOẢN THI HÀNH
          </div>
          <div className="p-3 bg-gray-50/70 rounded-lg border border-gray-200 text-[11px] space-y-1">
            <div>• Hợp đồng này có hiệu lực kể từ ngày ký.</div>
            <div>
              • Hợp đồng được lập thành 02 bản có giá trị pháp lý như nhau, mỗi bên giữ 01 bản để
              thực hiện. Khách hàng thực hiện tải lên bản scan có dấu đỏ lên hệ thống NEXLOG và có
              nghĩa vụ gửi bản cứng có dấu đỏ gốc qua đường bưu chính về cho Ban Điều phối ALS.
            </div>
          </div>
        </div>

        {/* Chữ ký 2 bên chuẩn form mẫu */}
        <div className="pt-6 grid grid-cols-2 text-center text-xs font-bold text-gray-800">
          <div>
            <div className="uppercase">ĐẠI DIỆN BÊN A (BÊN VẬN TẢI)</div>
            <div className="text-[10px] font-normal text-gray-500 italic mt-0.5">
              (Ký, đóng dấu và ghi rõ họ tên)
            </div>
            <div className="h-20"></div>
            <div className="text-indigo-800 font-bold">{contractDetails.carrier_name}</div>
          </div>
          <div>
            <div className="uppercase">ĐẠI DIỆN BÊN B (THUÊ VẬN TẢI)</div>
            <div className="text-[10px] font-normal text-gray-500 italic mt-0.5">
              (Ký, đóng dấu và ghi rõ họ tên)
            </div>
            <div className="h-20"></div>
            <div className="text-gray-400 font-normal">
              [{contractDetails.customer_name || 'Chữ ký & Con dấu bên thuê'}]
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
