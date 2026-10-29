import React from 'react';
import { Tag, Button, Input, Select, Popover, message } from 'antd';
import { Sparkles, Trash2, Plus, PhoneCall, MessageCircle, Mail, DollarSign, Calculator } from 'lucide-react';
import { SPECIALIZED_CARGO_CATEGORIES, getVehicleSpecByKey } from '../../../data/dispatcherPresets';

export function OrderVehicleRecommendationBox({
  proposedVehicleType,
  setProposedVehicleType,
  vehicleRecommendation,
  currentProposedSpec,
  customerInitialSpec,
  estimatedBaselineRate,
  canEditPrice,
  aiAnalyzingVehicle,
  handleGeminiAnalyzeVehicle,
  aiVehicleInsight,
  vehicleAnalysisNote,
  setVehicleAnalysisNote
}) {
  return (
    <div className="bg-gradient-to-r from-emerald-50/70 via-teal-50/50 to-indigo-50/60 p-4 rounded-xl border border-emerald-200/80 space-y-3">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 border-b border-emerald-150 pb-2.5">
        <div>
          <span className="text-xs font-bold text-emerald-950 uppercase tracking-wide flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[17px] text-emerald-600">local_shipping</span>
            Đánh giá kỹ thuật &amp; Gợi ý phân tích chọn xe tối ưu:
          </span>
          <span className="text-[11px] text-emerald-800 mt-0.5 block">
            Dựa trên tải trọng thực tế, kích thước hàng (D×R×C) và yêu cầu bảo quản để chọn xe phù hợp nhất.
          </span>
        </div>
        {vehicleRecommendation?.isDifferent && (
          <Tag color="orange" className="font-bold text-xs px-2.5 py-0.5 m-0 rounded-full animate-pulse self-start sm:self-auto">
            Khách chọn xe khác gợi ý kỹ thuật
          </Tag>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        {/* Xe khách chọn ban đầu */}
        <div className="p-3 bg-white rounded-lg border border-gray-200 shadow-2xs space-y-1.5">
          <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
            1. Xe khách đã chọn khi tạo đơn:
          </div>
          <div className="font-bold text-gray-800 text-sm flex items-center gap-1.5">
            <span>{customerInitialSpec?.label || 'Chưa chọn'}</span>
            <Tag color="default" className="m-0 text-[10px]">Khách chọn</Tag>
          </div>
          <div className="text-[10px] text-gray-500">
            {customerInitialSpec?.boxDimText || 'Chưa có thông số thùng'}
          </div>
        </div>

        {/* Phương án xe Điều phối phân tích & Đề xuất */}
        <div className="p-3 bg-white rounded-lg border-2 border-indigo-200 shadow-2xs space-y-1.5">
          <div className="text-[11px] font-bold text-indigo-900 uppercase tracking-wider flex items-center justify-between">
            <span>2. Xe Đề xuất sau xem xét:</span>
            {canEditPrice && <span className="text-[10px] text-indigo-500 font-normal">(Điều phối chọn lại)</span>}
          </div>
          {canEditPrice ? (
            <Select
              size="small"
              value={proposedVehicleType}
              onChange={(val) => setProposedVehicleType?.(val)}
              className="w-full font-bold text-xs"
            >
              <Select.Option value="VAN_500KG">Xe Van 500kg (1.8 × 1.2 × 1.1 m - Max 500kg)</Select.Option>
              <Select.Option value="TRUCK_1.25T">Xe tải 1.25 tấn (3.1 × 1.6 × 1.6 m - Max 1,250kg)</Select.Option>
              <Select.Option value="TRUCK_1.9T">Xe tải 1.9 tấn (4.3 × 1.8 × 1.8 m - Max 1,900kg)</Select.Option>
              <Select.Option value="TRUCK_2.5T">Xe tải 2.5 tấn (4.3 × 1.9 × 1.9 m - Max 2,500kg)</Select.Option>
              <Select.Option value="TRUCK_3.5T">Xe tải 3.5 tấn (5.2 × 2.0 × 2.0 m - Max 3,500kg)</Select.Option>
              <Select.Option value="TRUCK_5T">Xe tải 5 tấn (6.2 × 2.1 × 2.2 m - Max 5,000kg)</Select.Option>
              <Select.Option value="TRUCK_8T">Xe tải 8 tấn (7.9 × 2.3 × 2.3 m - Max 8,000kg)</Select.Option>
              <Select.Option value="TRUCK_15T">Xe tải 15 tấn (9.5 × 2.35 × 2.5 m - Max 15,000kg)</Select.Option>
              <Select.Option value="CONTAINER_20DC">Container 20ft DC (5.9 × 2.35 × 2.39 m - Max 25,000kg)</Select.Option>
              <Select.Option value="CONTAINER_40GP">Container 40ft GP (12.0 × 2.35 × 2.39 m - Max 28,000kg)</Select.Option>
              <Select.Option value="CONTAINER_40HC">Container 40ft High-Cube (12.0 × 2.35 × 2.69 m)</Select.Option>
            </Select>
          ) : (
            <div className="font-bold text-indigo-700 text-sm flex items-center gap-1.5">
              <span>✓ {currentProposedSpec.label}</span>
              <Tag color="blue" className="m-0 text-[10px]">Đã thống nhất</Tag>
            </div>
          )}
          <div className="text-[10px] text-indigo-600">
            {currentProposedSpec.boxDimText} · Giá sàn tương ứng: <b>{estimatedBaselineRate.toLocaleString('vi-VN')} đ</b>
          </div>
        </div>
      </div>

      {/* Nhận xét phân tích tự động & Ghi chú tư vấn chọn xe gửi khách */}
      <div className="p-2.5 bg-white rounded-lg border border-emerald-100 text-xs space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-gray-700 leading-relaxed flex-1">
            <b className="text-emerald-800">📊 Nhận định kỹ thuật xếp hàng: </b>
            <span>{aiVehicleInsight?.technicalAssessment || vehicleRecommendation?.reason}</span>
          </div>
          <Button
            size="small"
            icon={<Sparkles size={12} />}
            loading={aiAnalyzingVehicle}
            onClick={handleGeminiAnalyzeVehicle}
            className="bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100 text-[11px] font-semibold shrink-0"
          >
            Gemini AI Phân tích &amp; Soạn tư vấn
          </Button>
        </div>
        {aiVehicleInsight?.loadingTips && (
          <div className="text-[11px] text-purple-900 bg-purple-50/70 px-2.5 py-1.5 rounded border border-purple-200">
            <b>🤖 Gemini AI gợi ý bốc xếp ({aiVehicleInsight.model || 'Gemini Pro'}):</b> {aiVehicleInsight.loadingTips}
          </div>
        )}
        {canEditPrice ? (
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 pt-1.5 border-t border-gray-100">
            <span className="text-[11px] font-semibold text-gray-600 shrink-0">
              Ghi chú phương án xe gửi khách:
            </span>
            <Input
              size="small"
              value={vehicleAnalysisNote}
              onChange={(e) => setVehicleAnalysisNote?.(e.target.value)}
              placeholder="VD: Lô hàng 20 thùng (200x200x200cm) cần đi Xe tải 3.5 tấn (thùng rộng 2.05m) để xếp vừa an toàn không bị cấn thùng..."
              className="text-xs flex-1"
            />
          </div>
        ) : (
          vehicleAnalysisNote && (
            <div className="text-[11px] text-indigo-800 bg-indigo-50/60 px-2.5 py-1.5 rounded border border-indigo-100">
              <b>Ghi chú phương án xe đã chốt với khách:</b> {vehicleAnalysisNote}
            </div>
          )
        )}
      </div>
    </div>
  );
}

export function OrderOverviewPreDocsBox({
  documents,
  onOpenAssistant,
  handleDeleteOverviewDoc,
  overviewSelectedSpecDoc,
  setOverviewSelectedSpecDoc,
  overviewCustomDocName,
  setOverviewCustomDocName,
  handleAddOverviewCustomDoc
}) {
  return (
    <div className="p-3.5 bg-white rounded-lg border border-purple-100 space-y-3 shadow-2xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-indigo-50 pb-2.5">
        <div>
          <div className="text-xs font-bold text-gray-800 flex items-center gap-1.5 uppercase">
            <span>DANH MỤC CHỨNG TỪ HỒ SƠ XUẤT NHẬP KHẨU</span>
            <Tag color="purple" className="m-0 text-[10px] font-semibold">Chuẩn bị trước khi gửi báo giá</Tag>
          </div>
          <div className="text-[11px] text-gray-500 mt-0.5">
            Khách hàng sẽ tải lên trực tiếp các loại giấy tờ này qua link xác nhận. Điều phối viên xem và cấu hình đầy đủ trước khi chốt giá gửi khách.
          </div>
        </div>

        {onOpenAssistant && (
          <Button 
            size="small" 
            icon={<Sparkles size={13} className="text-purple-600" />} 
            className="bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-200 font-semibold text-xs flex items-center self-start sm:self-auto"
            onClick={onOpenAssistant}
          >
            Trợ lý AI gợi ý
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
        {documents && documents.length > 0 ? (
          documents.map((doc, idx) => (
            <div key={doc.key || idx} className="p-2 rounded-lg bg-gray-50/90 border border-gray-150 flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-[10px] shrink-0">
                  {idx + 1}
                </span>
                <div className="truncate">
                  <span className="font-semibold text-gray-800 block truncate" title={doc.name}>
                    {doc.name}
                  </span>
                  <span className="text-[10px] text-gray-400 block truncate">
                    {doc.categoryName || (doc.isBasic ? 'Chứng từ cơ bản' : 'Chuyên ngành')}
                  </span>
                </div>
              </div>
              <div className="shrink-0 flex items-center gap-1">
                {doc.isBasic ? (
                  <Tag color="blue" className="text-[10px] m-0">Cơ bản</Tag>
                ) : (
                  <Tag color="purple" className="text-[10px] m-0">Chuyên ngành</Tag>
                )}
                {doc.isCustom && (
                  <Button
                    size="small"
                    danger
                    type="text"
                    icon={<Trash2 size={12} />}
                    onClick={() => handleDeleteOverviewDoc(doc.key)}
                    title="Xóa loại chứng từ này"
                  />
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-2 text-[11px] text-gray-400 italic text-center py-2">
            Chưa có danh mục chứng từ nào. Vui lòng bấm "Trợ lý AI gợi ý" để AI tự động cấu hình theo loại hàng.
          </div>
        )}
      </div>

      {/* Bổ sung thêm loại chứng từ khác */}
      <div className="mt-2.5 pt-2.5 border-t border-gray-150">
        <div className="text-[11px] font-bold text-gray-700 mb-1.5 flex items-center gap-1">
          <Plus size={13} className="text-indigo-600" /> Bổ sung thêm loại chứng từ khác:
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
          <div className="sm:col-span-6">
            <Select
              placeholder="-- Chọn chứng từ chuyên ngành có sẵn --"
              value={overviewSelectedSpecDoc || undefined}
              onChange={val => {
                setOverviewSelectedSpecDoc(val);
                setOverviewCustomDocName('');
              }}
              allowClear
              className="w-full text-xs"
            >
              {SPECIALIZED_CARGO_CATEGORIES.map(cat => (
                <Select.OptGroup key={cat.categoryKey} label={cat.categoryName}>
                  {cat.specializedDocs.map(d => (
                    <Select.Option key={d.name} value={d.name}>
                      {d.name}
                    </Select.Option>
                  ))}
                </Select.OptGroup>
              ))}
            </Select>
          </div>

          <div className="sm:col-span-4">
            <Input
              placeholder="Hoặc tự gõ tên chứng từ khác..."
              value={overviewCustomDocName}
              onChange={e => {
                setOverviewCustomDocName(e.target.value);
                setOverviewSelectedSpecDoc('');
              }}
              className="text-xs"
            />
          </div>

          <div className="sm:col-span-2">
            <Button
              type="primary"
              icon={<Plus size={13} />}
              className="w-full bg-[#7367f0] hover:bg-[#5e50ee] text-xs font-semibold"
              onClick={handleAddOverviewCustomDoc}
            >
              Thêm
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

