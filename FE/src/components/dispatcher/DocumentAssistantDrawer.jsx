import { useState } from 'react';
import { Drawer, Button, Input, Tag, Spin, message, Divider, Space, Card, Radio } from 'antd';
import { Sparkles, Bot, CheckCircle2, ShieldCheck, FileText, Info, HelpCircle } from 'lucide-react';
import { BASIC_CUSTOMS_DOCUMENTS, SPECIALIZED_CARGO_CATEGORIES } from '../../data/dispatcherPresets';

export default function DocumentAssistantDrawer({ open, onClose, onApplyRecommendations, currentCargo = '' }) {
  const [selectedCategoryKey, setSelectedCategoryKey] = useState('GENERAL');
  const [cargoDesc, setCargoDesc] = useState(
    currentCargo || 'Lô hàng linh kiện viễn thông và thiết bị quang nhập khẩu từ Hàn Quốc về Nội Bài giao nhà máy tại KCN Tiên Sơn Bắc Ninh'
  );
  const [loading, setLoading] = useState(false);
  const [activeAnalysis, setActiveAnalysis] = useState(() => {
    return SPECIALIZED_CARGO_CATEGORIES[0];
  });

  const handleSelectPresetCategory = (catKey) => {
    setSelectedCategoryKey(catKey);
    const cat = SPECIALIZED_CARGO_CATEGORIES.find(c => c.categoryKey === catKey);
    if (cat) {
      setActiveAnalysis(cat);
      setCargoDesc(cat.categoryName);
      message.info(`Đã chuyển sang: ${cat.categoryName}`);
    }
  };

  const handleAskAI = () => {
    if (!cargoDesc.trim()) return;
    setLoading(true);

    setTimeout(() => {
      setLoading(false);
      const text = cargoDesc.toLowerCase();
      let matched = SPECIALIZED_CARGO_CATEGORIES[0];

      for (const cat of SPECIALIZED_CARGO_CATEGORIES) {
        if (cat.keywords.some(kw => text.includes(kw))) {
          matched = cat;
          break;
        }
      }

      setSelectedCategoryKey(matched.categoryKey);
      setActiveAnalysis(matched);
      message.success(`Đã nhận diện nhóm hàng: ${matched.categoryName}`);
    }, 450);
  };

  const handleApply = () => {
    // Tổng hợp bộ chứng từ: 5 chứng từ cơ bản + các chứng từ đặc thù chuyên ngành
    const basicList = BASIC_CUSTOMS_DOCUMENTS.map((doc, idx) => ({
      key: `doc-basic-${idx + 1}`,
      name: doc.name,
      description: doc.description,
      file: 'Chờ tải lên',
      status: 'WAITING_UPLOAD',
      size: '-',
      uploadDate: '-',
      isBasic: true,
      isCustom: false
    }));

    const specializedList = activeAnalysis.specializedDocs.map((sDoc, sIdx) => ({
      key: `doc-spec-${activeAnalysis.categoryKey}-${sIdx + 1}`,
      name: sDoc.name,
      description: sDoc.description,
      file: 'Chờ tải lên',
      status: 'WAITING_UPLOAD',
      size: '-',
      uploadDate: '-',
      isBasic: false,
      isCustom: true,
      categoryName: activeAnalysis.categoryName
    }));

    const fullList = [...basicList, ...specializedList];
    onApplyRecommendations?.(fullList);
    onClose?.();
    message.success(`Đã áp dụng ${fullList.length} loại chứng từ cho đơn hàng!`);
  };

  return (
    <Drawer
      title={
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-gradient-to-tr from-purple-600 to-indigo-600 text-white rounded-xl shadow-xs">
            <Sparkles size={18} />
          </div>
          <div>
            <span className="font-bold text-gray-800 text-base block leading-tight">
              Trợ lý Chứng từ Xuất Nhập Khẩu
            </span>
            <span className="text-[11px] text-gray-400 font-normal">
              Quy chuẩn 5 chứng từ cơ bản &amp; Chuyên ngành theo nhóm hàng hóa
            </span>
          </div>
        </div>
      }
      placement="right"
      width={560}
      onClose={onClose}
      open={open}
    >
      <div className="space-y-4">
        {/* Phím tắt chọn nhanh 5 nhóm hàng */}
        <div>
          <label className="text-xs font-bold text-gray-700 mb-1.5 block uppercase tracking-wider">
            Chọn nhanh nhóm hàng theo quy chuẩn:
          </label>
          <div className="space-y-1.5">
            {SPECIALIZED_CARGO_CATEGORIES.map(cat => (
              <div 
                key={cat.categoryKey}
                onClick={() => handleSelectPresetCategory(cat.categoryKey)}
                className={`p-2.5 rounded-lg border text-xs cursor-pointer transition-all flex items-center justify-between ${
                  selectedCategoryKey === cat.categoryKey 
                    ? 'border-indigo-600 bg-indigo-50/70 font-semibold text-indigo-900 shadow-xs' 
                    : 'border-gray-200 hover:border-indigo-200 hover:bg-gray-50 text-gray-700'
                }`}
              >
                <span>{cat.categoryName}</span>
                <Tag color={selectedCategoryKey === cat.categoryKey ? 'indigo' : 'default'} className="text-[10px] m-0">
                  +{cat.specializedDocs.length} chứng từ
                </Tag>
              </div>
            ))}
          </div>
        </div>

        {/* Ô nhập mô tả tự do để AI tự động phân tích */}
        <div className="pt-2 border-t border-gray-150">
          <label className="text-xs font-bold text-gray-700 mb-1 block">
            Hoặc nhập mô tả chi tiết lô hàng để AI nhận diện:
          </label>
          <Input.TextArea 
            rows={2} 
            value={cargoDesc} 
            onChange={(e) => setCargoDesc(e.target.value)}
            placeholder="VD: Nhập khẩu 5 máy ép kim loại đã qua sử dụng từ Nhật về Hải Phòng..."
            className="text-xs"
          />
          <div className="mt-2 flex justify-end">
            <Button 
              type="primary" 
              icon={<Bot size={14} />}
              loading={loading}
              onClick={handleAskAI}
              className="bg-indigo-600 hover:bg-indigo-700 text-xs h-8 font-semibold shadow-xs"
            >
              Phân tích nhóm hàng
            </Button>
          </div>
        </div>

        <Divider className="my-2" />

        {loading ? (
          <div className="py-12 text-center space-y-2">
            <Spin size="large" />
            <p className="text-xs text-gray-500">Đang đối chiếu quy định hải quan chuyên ngành...</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Phân loại được xác định */}
            <div className="p-3 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl border border-indigo-100 text-xs">
              <div className="flex items-center justify-between mb-1">
                <span className="text-gray-500">Nhóm hàng áp dụng:</span>
                <span className="font-bold text-indigo-950">{activeAnalysis.categoryName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Tổng số chứng từ cần nộp:</span>
                <Tag color="blue" className="font-bold m-0">
                  {BASIC_CUSTOMS_DOCUMENTS.length + activeAnalysis.specializedDocs.length} loại chứng từ
                </Tag>
              </div>
            </div>

            {/* I. Bộ chứng từ cơ bản (Áp dụng cho mọi loại hàng hóa) */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-gray-900 uppercase tracking-wide flex items-center gap-1.5">
                  <ShieldCheck size={15} className="text-blue-600" />
                  I. Bộ chứng từ cơ bản (Áp dụng cho mọi loại hàng hóa):
                </span>
                <Tag color="cyan">5 chứng từ bắt buộc</Tag>
              </div>
              <div className="space-y-2">
                {BASIC_CUSTOMS_DOCUMENTS.map((doc, idx) => (
                  <div key={idx} className="p-2.5 bg-blue-50/40 rounded-lg border border-blue-100 text-xs">
                    <div className="flex items-start gap-2">
                      <CheckCircle2 size={15} className="text-blue-600 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-bold text-gray-800">{doc.name}</div>
                        <div className="text-[11px] text-gray-600 mt-0.5">{doc.description}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* II. Chứng từ theo từng loại hàng hóa cụ thể */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-gray-900 uppercase tracking-wide flex items-center gap-1.5">
                  <FileText size={15} className="text-purple-600" />
                  II. Chứng từ theo nhóm hàng hóa cụ thể:
                </span>
                <Tag color="purple">+{activeAnalysis.specializedDocs.length} chứng từ chuyên ngành</Tag>
              </div>
              <div className="space-y-2">
                {activeAnalysis.specializedDocs.map((doc, idx) => (
                  <div key={idx} className="p-2.5 bg-purple-50/50 rounded-lg border border-purple-200 text-xs">
                    <div className="flex items-start gap-2">
                      <CheckCircle2 size={15} className="text-purple-600 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-bold text-gray-900">{doc.name}</div>
                        <div className="text-[11px] text-purple-900 mt-0.5 leading-relaxed">{doc.description}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Nút Áp dụng vào đơn hàng */}
            <div className="pt-2 sticky bottom-0 bg-white pb-2">
              <Button 
                type="primary" 
                block 
                size="large"
                className="bg-emerald-600 hover:bg-emerald-700 h-10 font-bold text-xs shadow-md"
                onClick={handleApply}
              >
                Áp dụng danh mục này vào Đơn hàng ({BASIC_CUSTOMS_DOCUMENTS.length + activeAnalysis.specializedDocs.length} chứng từ)
              </Button>
            </div>
          </div>
        )}
      </div>
    </Drawer>
  );
}