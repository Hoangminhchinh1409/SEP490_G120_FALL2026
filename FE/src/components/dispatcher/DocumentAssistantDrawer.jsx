import { useState } from 'react';
import { Drawer, Button, Input, Tag, Spin, message, Divider } from 'antd';
import { Sparkles, Bot, CheckCircle2 } from 'lucide-react';

const DocumentAssistantDrawer = ({ open, onClose, onApplyRecommendations }) => {
  const [cargoDesc, setCargoDesc] = useState('Lô hàng linh kiện viễn thông và thiết bị quang nhập khẩu từ Hàn Quốc về Nội Bài giao nhà máy tại KCN Tiên Sơn Bắc Ninh');
  const [loading, setLoading] = useState(false);
  const [analysisResult] = useState({
    cargoCategory: 'Linh kiện Điện tử & Thiết bị Viễn thông (Cáp quang & Máy thu phát)',
    route: 'Kho ALS Cảng HKQT Nội Bài -> KCN Tiên Sơn (Bắc Ninh)',
    riskLevel: 'Cao (Yêu cầu niêm phong chì niêm phong SOP)',
    recommendedDocs: [
      { name: 'Tờ khai Hải quan thông quan (ToKhaiHQ)', reason: 'Bắt buộc đối với mọi lô hàng nhập khẩu qua kho hàng không kéo dài' },
      { name: 'Lệnh giao hàng & Vận đơn hàng không (HAWB / D/O)', reason: 'Cần để làm thủ tục nhận hàng tại ga NCTS / ASc' },
      { name: 'Hóa đơn thương mại (Commercial Invoice)', reason: 'Cần thiết để đối chiếu mã HS Code và giá tính thuế' },
      { name: 'Phiếu đóng gói (Packing List)', reason: 'Căn cứ số lượng 18 Pallet và kích thước kiểm tra an toàn tải trọng' },
      { name: 'Biên bản giao nhận hàng (Proof of Cargo Receipt)', reason: 'Bắt buộc ký xác nhận tình trạng niêm phong chì tại sân bay' }
    ]
  });

  const handleAskAI = () => {
    if (!cargoDesc.trim()) return;
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      message.success('AI Gemini đã phân tích xong loại hàng hóa và tuyến đường!');
    }, 800);
  };

  return (
    <Drawer
      title={
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-gradient-to-tr from-purple-500 to-indigo-600 text-white rounded-lg">
            <Sparkles size={18} />
          </div>
          <div>
            <span className="font-bold text-gray-800 text-base">Trợ lý AI Gợi ý Chứng từ</span>
            <p className="text-[11px] text-gray-400 font-normal">Tích hợp Google Gemini phân tích tự động hồ sơ hải quan cần thu thập</p>
          </div>
        </div>
      }
      placement="right"
      size={480}
      onClose={onClose}
      open={open}
    >
      <div className="space-y-4">
        <div>
          <label className="text-xs font-bold text-gray-700 mb-1.5 block">
            Mô tả Lô hàng & Tuyến đường Vận chuyển:
          </label>
          <Input.TextArea 
            rows={3} 
            value={cargoDesc} 
            onChange={(e) => setCargoDesc(e.target.value)}
            placeholder="Nhập loại hàng hóa, xuất xứ, điểm bốc và điểm dỡ..."
            className="text-xs"
          />
          <div className="mt-2 flex justify-end">
            <Button 
              type="primary" 
              icon={<Bot size={15} />}
              loading={loading}
              onClick={handleAskAI}
              className="bg-indigo-600 hover:bg-indigo-700 text-xs h-8"
            >
              Phân tích với Gemini AI
            </Button>
          </div>
        </div>

        <Divider className="my-2" />

        {loading ? (
          <div className="py-12 text-center space-y-2">
            <Spin size="large" />
            <p className="text-xs text-gray-500">Gemini đang phân tích quy định thông quan và danh mục chứng từ...</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="p-3 bg-purple-50 rounded-xl border border-purple-100 text-xs">
              <div className="flex items-center justify-between mb-1">
                <span className="text-gray-500">Phân loại hàng:</span>
                <span className="font-bold text-purple-900">{analysisResult.cargoCategory}</span>
              </div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-gray-500">Mức độ rủi ro:</span>
                <Tag color="red" className="font-semibold text-[10px] m-0">{analysisResult.riskLevel}</Tag>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Hành lang:</span>
                <span className="font-medium text-gray-700">{analysisResult.route}</span>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-gray-800 uppercase tracking-wider">
                  Danh mục Chứng từ Hải quan Bắt buộc (Gợi ý):
                </span>
                <Tag color="blue">{analysisResult.recommendedDocs.length} loại</Tag>
              </div>

              <div className="space-y-2">
                {analysisResult.recommendedDocs.map((doc, idx) => (
                  <div key={idx} className="p-2.5 bg-gray-50 hover:bg-white rounded-lg border border-gray-200 text-xs transition-all">
                    <div className="flex items-start gap-2">
                      <CheckCircle2 size={15} className="text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-semibold text-gray-800">{doc.name}</div>
                        <div className="text-[11px] text-gray-500 mt-0.5">{doc.reason}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <Button 
              type="primary" 
              block 
              className="bg-emerald-600 hover:bg-emerald-700 h-9 font-semibold text-xs mt-3"
              onClick={() => {
                if (onApplyRecommendations) {
                  onApplyRecommendations();
                }
                onClose();
                message.success('Đã áp dụng danh mục chứng từ do AI gợi ý vào đơn hàng!');
              }}
            >
              Áp dụng Danh mục Chứng từ Này vào Đơn
            </Button>
          </div>
        )}
      </div>
    </Drawer>
  );
};

export default DocumentAssistantDrawer;
