import { useState } from 'react';
import { Drawer, Button, Input, Tag, Spin, message, Divider } from 'antd';
import { Sparkles, Bot, CheckCircle2 } from 'lucide-react';

const DocumentAssistantDrawer = ({ open, onClose, onApplyRecommendations }) => {
  const [cargoDesc, setCargoDesc] = useState('Lô hàng linh kiện viễn thông và thiết bị quang nhập khẩu từ Hàn Quốc về Nội Bài giao nhà máy tại KCN Tiên Sơn Bắc Ninh');
  const [loading, setLoading] = useState(false);
  const [analysisResult] = useState({
    cargoCategory: 'Linh kiện điện tử & Viễn thông',
    route: 'Kho ALS Nội Bài -> KCN Tiên Sơn',
    riskLevel: 'Cao',
    recommendedDocs: [
      { name: 'Tờ khai hải quan', reason: 'Áp dụng cho lô hàng nhập khẩu' },
      { name: 'Lệnh giao hàng & Vận đơn', reason: 'Thủ tục nhận hàng tại kho cảng' },
      { name: 'Hóa đơn thương mại', reason: 'Đối chiếu giá trị hàng hóa' },
      { name: 'Phiếu đóng gói', reason: 'Kiểm tra quy cách kiện' },
      { name: 'Hợp đồng mua bán', reason: 'Căn cứ pháp lý giao dịch' }
    ]
  });

  const handleAskAI = () => {
    if (!cargoDesc.trim()) return;
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      message.success('Đã phân tích xong loại hàng hóa!');
    }, 600);
  };

  return (
    <Drawer
      title={
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-gradient-to-tr from-purple-500 to-indigo-600 text-white rounded-lg">
            <Sparkles size={18} />
          </div>
          <div>
            <span className="font-bold text-gray-800 text-base">Trợ lý AI</span>
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
            Mô tả lô hàng:
          </label>
          <Input.TextArea 
            rows={3} 
            value={cargoDesc} 
            onChange={(e) => setCargoDesc(e.target.value)}
            placeholder="Nhập loại hàng hóa, điểm lấy và điểm giao..."
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
              Phân tích
            </Button>
          </div>
        </div>

        <Divider className="my-2" />

        {loading ? (
          <div className="py-12 text-center space-y-2">
            <Spin size="large" />
            <p className="text-xs text-gray-500">Đang phân tích danh mục chứng từ...</p>
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
                <span className="text-gray-500">Tuyến đường:</span>
                <span className="font-medium text-gray-700">{analysisResult.route}</span>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-gray-800 uppercase tracking-wider">
                  Chứng từ đề xuất:
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
                message.success('Đã áp dụng danh mục chứng từ!');
              }}
            >
              Áp dụng vào đơn hàng
            </Button>
          </div>
        )}
      </div>
    </Drawer>
  );
};

export default DocumentAssistantDrawer;