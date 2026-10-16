'use client';
import { useState, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Modal, Tabs, Tag, Button, Input, InputNumber, Space, Table, message, Select, Popconfirm, Tooltip, Alert, Popover } from 'antd';
import { 
  FileText, 
  AlertTriangle, 
  Download, 
  Upload, 
  ShieldCheck, 
  PhoneCall, 
  MessageCircle, 
  Mail, 
  DollarSign, 
  ArrowUpRight, 
  XCircle, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  Clock, 
  Route, 
  Navigation,
  FileCheck,
  Building,
  Sparkles,
  HelpCircle,
  Calculator,
  Info,
  Package
} from 'lucide-react';
import CancelOrderModal from './CancelOrderModal';
import RouteMapPicker from '../common/RouteMapPicker';
import DocumentAssistantDrawer from './DocumentAssistantDrawer';
import { 
  BASIC_CUSTOMS_DOCUMENTS, 
  SPECIALIZED_CARGO_CATEGORIES, 
  getRecommendedDocsByCargo,
  getCoordsFromAddress
} from '../../data/dispatcherPresets';
import { orderApi } from '../../api/orderApi';

const { Option, OptGroup } = Select;

// Danh mục phụ phí gợi ý phổ biến
const EXTRA_FEE_TYPES = [
  'Phí nâng hạ bốc xếp tại kho',
  'Phí chờ đợi bốc dỡ quá giờ (>60p)',
  'Phí lưu đêm / lưu ca phương tiện',
  'Phí cầu đường, phà, vé BOT',
  'Phí giao hàng ngoài giờ hành chính',
  'Phí đóng gói chèn lót hàng giá trị cao',
  'Chi phí phát sinh khác'
];

export default function OrderDetailsModal({ open, order, onCancel, onUpdateOrder }) {
  if (!open || !order) return null;

  return (
    <OrderDetailsModalContent
      key={order.id || order.order_id}
      open={open}
      order={order}
      onCancel={onCancel}
      onUpdateOrder={onUpdateOrder}
    />
  );
}

function OrderDetailsModalContent({ open, order, onCancel, onUpdateOrder }) {
  const router = useRouter();

  // Xác định tab mặc định dựa trên trạng thái đơn hàng
  const defaultTab = order.targetTab || (
    order.status === 'DRAFT' ? '1' :
    order.status === 'CONFIRMED' ? '2' :
    order.status === 'READY_FOR_PLANNING' ? '1' : '1'
  );

  const [activeTab, setActiveTab] = useState(defaultTab);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [savingPrice, setSavingPrice] = useState(false);
  const [confirmingDocs, setConfirmingDocs] = useState(false);

  // State Giá thỏa thuận & Hợp đồng
  const [currentAgreedPrice, setCurrentAgreedPrice] = useState(order.agreed_price || 0);
  const [contractUploaded, setContractUploaded] = useState(order.contract_uploaded || false);
  const [contractFile, setContractFile] = useState(order.contract_file || null);
  const [contractFileData, setContractFileData] = useState(order.contract_file_data || null);
  const [contractUploadedAt, setContractUploadedAt] = useState(order.contract_uploaded_at || null);
  const [uploadingContract, setUploadingContract] = useState(false);

  // State Tuyến đường & Ước tính
  const [routeInfo, setRouteInfo] = useState({
    distanceKm: order.estimated_distance_km || 35.5,
    durationMins: order.estimated_duration_mins || 45
  });

  // State Chứng từ vận tải (Ưu tiên danh sách chứng từ đã có hoặc khách đã nộp)
  const [documents, setDocuments] = useState(() => {
    if (Array.isArray(order.documents) && order.documents.length > 0) {
      return order.documents;
    }
    return getRecommendedDocsByCargo(
      order.cargo_name || order.cargo_type || '',
      order.cargo_type || '',
      order.order_notes || ''
    );
  });
  const [newDocName, setNewDocName] = useState('');
  const [selectedSpecializedDoc, setSelectedSpecializedDoc] = useState('');
  const [assistantDrawerOpen, setAssistantDrawerOpen] = useState(false);
  const [uploadingDocKey, setUploadingDocKey] = useState(null);
  const fileInputRef = useRef(null);
  const contractInputRef = useRef(null);

  // State Phụ phí phát sinh
  const [extraFees, setExtraFees] = useState(order.extra_fees_list || []);
  const [newFeeType, setNewFeeType] = useState(EXTRA_FEE_TYPES[0]);
  const [newFeeAmount, setNewFeeAmount] = useState(0);
  const [newFeeReason, setNewFeeReason] = useState('');

  // State Chat nội bộ / Nhật ký ghi chú
  const [orderMessages, setOrderMessages] = useState(() => {
    if (order.notes && order.notes.length > 0) {
      return order.notes.map((n, i) => ({
        id: n.id || i,
        sender: 'Hệ thống / Ghi chú',
        role: 'SYSTEM',
        time: n.created_at ? new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Vừa xong',
        content: n.content
      }));
    }
    if (order.order_notes) {
      return [{
        id: 1,
        sender: 'Thông tin tiếp nhận',
        role: 'SYSTEM',
        time: 'Vừa xong',
        content: order.order_notes
      }];
    }
    return [];
  });
  const [newMessageText, setNewMessageText] = useState('');

  // Tính giá cước sàn gợi ý theo cước khoảng cách và tải trọng để điều phối dễ chốt với khách
  const pricingBreakdown = useMemo(() => {
    const dist = parseFloat(routeInfo.distanceKm) || 35.5;
    const weight = parseFloat(order.chargeable || order.chargeable_weight || order.weight || 1000);
    const baseFare = 1500000; // Cước xuất bến / chuyến cơ bản
    const distanceFee = Math.round(dist * 45000); // 45.000 VNĐ / km
    const weightFee = Math.round(weight * 850); // 850 VNĐ / kg tải trọng tính cước
    const totalRaw = baseFare + distanceFee + weightFee;
    const totalRounded = Math.round(totalRaw / 50000) * 50000;

    return {
      dist,
      weight,
      baseFare,
      distanceFee,
      weightFee,
      totalRaw,
      totalRounded
    };
  }, [routeInfo, order]);

  const estimatedBaselineRate = pricingBreakdown.totalRounded;

  // Tổng các khoản phụ phí phát sinh
  const totalExtraFees = useMemo(() => {
    return extraFees.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  }, [extraFees]);

  // Chuẩn hóa địa chỉ điểm lấy và điểm giao
  const pickupAddress = useMemo(() => {
    return order.pickup || order.pickup_address || order.pickup_location?.address || 'Kho ALS Cảng HKQT Nội Bài';
  }, [order]);

  const deliveryAddress = useMemo(() => {
    return order.dropoff || order.delivery_address || order.delivery_location?.address || 'KCN Tiên Sơn, Bắc Ninh';
  }, [order]);

  // Tọa độ điểm lấy và điểm giao
  const pickupCoords = useMemo(() => {
    if (order.pickup_coords?.lat && order.pickup_coords?.lng) return order.pickup_coords;
    if (order.pickup_location?.lat && order.pickup_location?.lng) {
      return { lat: parseFloat(order.pickup_location.lat), lng: parseFloat(order.pickup_location.lng) };
    }
    return getCoordsFromAddress(pickupAddress, 'A');
  }, [order, pickupAddress]);

  const deliveryCoords = useMemo(() => {
    if (order.dropoff_coords?.lat && order.dropoff_coords?.lng) return order.dropoff_coords;
    if (order.delivery_coords?.lat && order.delivery_coords?.lng) return order.delivery_coords;
    if (order.delivery_location?.lat && order.delivery_location?.lng) {
      return { lat: parseFloat(order.delivery_location.lat), lng: parseFloat(order.delivery_location.lng) };
    }
    return getCoordsFromAddress(deliveryAddress, 'B');
  }, [order, deliveryAddress]);

  // 1. Chốt giá cước thỏa thuận và chuyển đơn DRAFT sang CONFIRMED (Đã xác nhận đơn & ký hợp đồng)
  const handleConfirmPriceAndOrder = async () => {
    if (!currentAgreedPrice || currentAgreedPrice <= 0) {
      message.error('Vui lòng nhập giá cước thỏa thuận đã chốt với khách hàng (> 0 VNĐ)!');
      return;
    }

    try {
      setSavingPrice(true);
      await orderApi.updateAgreedPrice(order.id || order.order_id, currentAgreedPrice);
      
      const updatedOrder = {
        ...order,
        status: 'CONFIRMED',
        agreed_price: currentAgreedPrice
      };

      onUpdateOrder?.(updatedOrder);
      message.success(`Đã chốt giá ${currentAgreedPrice.toLocaleString()} đ! Đơn đã chuyển sang trạng thái Cần xác nhận chứng từ.`);
      setActiveTab('2'); // Tự động chuyển sang tab Kiểm duyệt chứng từ
    } catch (err) {
      console.error(err);
      message.error(err.message || 'Lỗi khi cập nhật giá cước lên máy chủ');
    } finally {
      setSavingPrice(false);
    }
  };

  // 2. Xử lý Tải lên từng chứng từ một (kể cả chứng từ thêm)
  const triggerUploadDoc = (docKey) => {
    setUploadingDocKey(docKey);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file || !uploadingDocKey) return;

    const sizeFormatted = file.size > 1024 * 1024 
      ? `${(file.size / (1024 * 1024)).toFixed(1)} MB` 
      : `${Math.round(file.size / 1024)} KB`;

    const reader = new FileReader();
    reader.onload = async (uploadEvent) => {
      const base64Data = uploadEvent.target?.result;

      const updatedDocs = documents.map(d => {
        if (d.key === uploadingDocKey) {
          return {
            ...d,
            file: file.name,
            file_data: base64Data,
            size: sizeFormatted,
            uploadDate: nowFormatted,
            status: 'PENDING_REVIEW'
          };
        }
        return d;
      });

      setDocuments(updatedDocs);
      setUploadingDocKey(null);

      // Lưu ngay vào CSDL để không bao giờ bị mất tệp khi đóng modal hoặc reload
      try {
        await orderApi.uploadOrderDocuments(order.id || order.order_id, updatedDocs);
        onUpdateOrder?.({
          ...order,
          documents: updatedDocs,
          web_workflow: {
            ...(order.web_workflow || {}),
            documents: updatedDocs
          }
        });
        message.success(`Đã tải lên và lưu tệp chứng từ: ${file.name}`);
      } catch (err) {
        console.error('Lỗi lưu chứng từ:', err);
        message.warning(`Đã đính kèm tệp ${file.name} nhưng chưa lưu được vào máy chủ.`);
      }
    };

    reader.readAsDataURL(file);
  };

  // 2b. Xử lý Tải lên tệp hợp đồng đã ký THẬT vào cơ sở dữ liệu
  const handleContractFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const sizeFormatted = file.size > 1024 * 1024 
      ? `${(file.size / (1024 * 1024)).toFixed(1)} MB` 
      : `${Math.round(file.size / 1024)} KB`;

    try {
      setUploadingContract(true);

      // Đọc file thành base64 để lưu và cho phép tải xuống/mở xem lại
      const reader = new FileReader();
      reader.onload = async (uploadEvent) => {
        const base64Data = uploadEvent.target?.result;

        try {
          const res = await orderApi.uploadContractFile(order.id || order.order_id, {
            file_name: file.name,
            file_data: base64Data,
            file_size: sizeFormatted
          });

          setContractUploaded(true);
          setContractFile(file.name);
          setContractFileData(base64Data);
          setContractUploadedAt(res.contract_uploaded_at || new Date().toISOString());

          const updatedOrder = {
            ...order,
            contract_uploaded: true,
            contract_file: file.name,
            contract_file_data: base64Data,
            contract_uploaded_at: res.contract_uploaded_at || new Date().toISOString()
          };

          onUpdateOrder?.(updatedOrder);
          message.success(`Đã lưu tệp hợp đồng [${file.name}] thật vào cơ sở dữ liệu!`);
        } catch (apiErr) {
          console.error('Upload contract api error:', apiErr);
          message.error(apiErr.message || 'Lỗi khi lưu tệp hợp đồng lên máy chủ');
        } finally {
          setUploadingContract(false);
        }
      };

      reader.onerror = () => {
        message.error('Không thể đọc dữ liệu tệp hợp đồng');
        setUploadingContract(false);
      };

      reader.readAsDataURL(file);
    } catch (err) {
      console.error('Upload error:', err);
      message.error('Lỗi khi tải tệp');
      setUploadingContract(false);
    }
  };

  // 3. Duyệt và Từ chối từng chứng từ
  const handleApproveDoc = async (docKey) => {
    const updated = documents.map(d => d.key === docKey ? { ...d, status: 'APPROVED' } : d);
    setDocuments(updated);
    try {
      await orderApi.uploadOrderDocuments(order.id || order.order_id, updated);
      onUpdateOrder?.({ ...order, documents: updated });
      message.success('Đã duyệt tính hợp lệ của chứng từ!');
    } catch (e) {
      message.success('Đã duyệt tính hợp lệ của chứng từ!');
    }
  };

  const handleRejectDoc = async (docKey) => {
    const updated = documents.map(d => d.key === docKey ? { ...d, status: 'REJECTED' } : d);
    setDocuments(updated);
    try {
      await orderApi.uploadOrderDocuments(order.id || order.order_id, updated);
      onUpdateOrder?.({ ...order, documents: updated });
      message.warning('Đã từ chối chứng từ. Vui lòng yêu cầu tải lên lại.');
    } catch (e) {
      message.warning('Đã từ chối chứng từ. Vui lòng yêu cầu tải lên lại.');
    }
  };

  // 4. Thêm chứng từ mới linh hoạt (từ danh mục chuyên ngành hoặc nhập tên tùy biến)
  const handleAddCustomDoc = (docTitle) => {
    const title = (typeof docTitle === 'string' && docTitle.trim()) 
      ? docTitle.trim() 
      : (selectedSpecializedDoc || newDocName).trim();

    if (!title) {
      message.error('Vui lòng chọn hoặc nhập tên loại chứng từ cần bổ sung!');
      return;
    }

    if (documents.some(d => d.name.toLowerCase() === title.toLowerCase())) {
      message.warning(`Chứng từ "${title}" đã có trong danh mục!`);
      return;
    }

    let docDesc = 'Chứng từ hồ sơ đối chiếu bổ sung theo yêu cầu';
    let catName = 'Chứng từ bổ sung';
    for (const cat of SPECIALIZED_CARGO_CATEGORIES) {
      const match = cat.specializedDocs.find(d => d.name === title);
      if (match) {
        docDesc = match.description;
        catName = cat.categoryName;
        break;
      }
    }

    const newKey = `custom-doc-${Date.now()}`;
    const newDoc = {
      key: newKey,
      name: title,
      description: docDesc,
      file: 'Chờ tải lên',
      status: 'WAITING_UPLOAD',
      size: '-',
      uploadDate: '-',
      isBasic: false,
      isCustom: true,
      categoryName: catName
    };

    const updated = [...documents, newDoc];
    setDocuments(updated);
    setNewDocName('');
    setSelectedSpecializedDoc('');
    orderApi.uploadOrderDocuments(order.id || order.order_id, updated).catch(() => {});
    message.success(`Đã thêm mục chứng từ mới: "${newDoc.name}"`);
  };

  // Áp dụng danh mục khuyến nghị từ Trợ lý AI (giữ nguyên các tệp đã upload)
  const handleApplyAssistantRecommendations = (recommendedList) => {
    const updated = recommendedList.map(rec => {
      const exist = documents.find(p => p.name === rec.name);
      if (exist && exist.file !== 'Chờ tải lên') {
        return { 
          ...rec, 
          file: exist.file, 
          size: exist.size, 
          uploadDate: exist.uploadDate, 
          status: exist.status 
        };
      }
      return rec;
    });
    setDocuments(updated);
    orderApi.uploadOrderDocuments(order.id || order.order_id, updated).catch(() => {});
    message.success('Đã cập nhật danh mục chứng từ từ Trợ lý AI!');
  };

  const handleDeleteCustomDoc = (docKey) => {
    const updated = documents.filter(d => d.key !== docKey);
    setDocuments(updated);
    orderApi.uploadOrderDocuments(order.id || order.order_id, updated).catch(() => {});
    message.info('Đã xóa mục chứng từ.');
  };

  // 5. Xác nhận toàn bộ chứng từ:
  // - Nếu là ĐƠN WEB: Điều phối viên duyệt chứng từ -> Hệ thống tự động gửi email hợp đồng PDF và link ký chữ ký số
  // - Nếu là ĐƠN NỘI BỘ: Xác nhận hợp đồng và chuyển thẳng sang READY_FOR_PLANNING (Xếp xe)
  const handleConfirmAllDocuments = async () => {
    const unuploaded = documents.filter(d => d.file === 'Chờ tải lên' || d.status === 'WAITING_UPLOAD');
    if (unuploaded.length > 0) {
      message.warning(`Còn ${unuploaded.length} chứng từ chưa được tải tệp lên! Hãy tải đầy đủ trước khi xác nhận toàn bộ.`);
      return;
    }

    const isWebOrder = order.source === 'HOMEPAGE';

    try {
      setConfirmingDocs(true);
      const approvedDocs = documents.map(d => ({ ...d, status: 'APPROVED' }));
      setDocuments(approvedDocs);

      if (isWebOrder) {
        // Gọi API duyệt chứng từ đơn web và gửi email hợp đồng + link ký số
        const res = await orderApi.approveWebOrderDocuments(order.id || order.order_id, approvedDocs);
        
        const updatedOrder = {
          ...order,
          documents: approvedDocs,
          web_workflow: {
            ...(order.web_workflow || {}),
            stage: 'DOCS_APPROVED',
            approved_documents: approvedDocs
          }
        };

        onUpdateOrder?.(updatedOrder);
        message.success('Đã duyệt hồ sơ chứng từ! Hệ thống đã tự động gửi email kèm hợp đồng PDF và link chữ ký số tới khách hàng.');
        setActiveTab('3'); // Chuyển sang tab hợp đồng
      } else {
        // Đơn nội bộ
        await orderApi.confirmOrder(order.id || order.order_id, currentAgreedPrice);
        const updatedOrder = {
          ...order,
          status: 'READY_FOR_PLANNING',
          documents: approvedDocs,
          contract_uploaded: true
        };
        onUpdateOrder?.(updatedOrder);
        message.success('Đã xác nhận toàn bộ chứng từ! Đơn hàng đã sẵn sàng để xếp xe.');
      }
    } catch (err) {
      console.error(err);
      message.error(err.message || 'Lỗi khi xác nhận chứng từ trên máy chủ');
    } finally {
      setConfirmingDocs(false);
    }
  };

  // 6. Thêm phụ phí phát sinh
  const handleAddExtraFee = () => {
    if (!newFeeAmount || newFeeAmount <= 0) {
      message.error('Vui lòng nhập số tiền phụ phí hợp lệ (> 0)!');
      return;
    }

    const newFee = {
      id: Date.now(),
      type: newFeeType,
      amount: newFeeAmount,
      reason: newFeeReason || 'Phát sinh trong quá trình vận hành',
      time: new Date().toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    };

    const updatedList = [...extraFees, newFee];
    setExtraFees(updatedList);
    setNewFeeAmount(0);
    setNewFeeReason('');

    onUpdateOrder?.({
      ...order,
      extra_fees_list: updatedList,
      extra_fees_surcharge: updatedList.reduce((s, f) => s + f.amount, 0)
    });
    message.success(`Đã thêm phụ phí: ${newFeeType} (${newFee.amount.toLocaleString()} đ)`);
  };

  // 7. Xử lý Hủy đơn hàng
  const handleExecuteCancel = async (cancelData) => {
    try {
      await orderApi.cancelOrder(order.id || order.order_id, cancelData);
    } catch (err) {
      console.warn('cancelOrder API note:', err);
    }
    onUpdateOrder?.({
      ...order,
      status: 'CANCELLED',
      cancellation_reason: cancelData.cancellation_reason,
      cancellation_fee: cancelData.cancellation_fee,
      cancelled_at: cancelData.cancelled_at
    });
    setCancelModalOpen(false);
  };

  // 8. Gửi tin nhắn trao đổi nội bộ với tài xế
  const handleSendMessage = () => {
    if (!newMessageText.trim()) return;
    setOrderMessages(prev => [...prev, {
      id: Date.now(),
      sender: 'Điều phối viên (Bạn)',
      role: 'DISPATCHER',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      content: newMessageText.trim()
    }]);
    setNewMessageText('');
    message.success('Đã gửi tin nhắn cho tài xế!');
  };

  const isWebOrder = order.source === 'HOMEPAGE';

  // Cột bảng chứng từ theo chuẩn
  const docColumns = [
    { 
      title: 'Tên chứng từ', 
      dataIndex: 'name', 
      key: 'name',
      width: '40%',
      render: (text, record) => (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-semibold text-gray-800 text-xs">{text}</span>
          {record.isBasic ? (
            <Tag color="blue" className="text-[10px] m-0 py-0 px-1 font-semibold">Cơ bản</Tag>
          ) : (
            <Tag color="purple" className="text-[10px] m-0 py-0 px-1 font-semibold">Chuyên ngành</Tag>
          )}
        </div>
      )
    },
    { 
      title: 'Tệp đính kèm', 
      dataIndex: 'file', 
      key: 'file',
      width: '28%',
      render: (text, record) => (
        record.file === 'Chờ tải lên' || record.status === 'WAITING_UPLOAD' ? (
          isWebOrder ? (
            <span className="text-xs text-gray-400 italic flex items-center gap-1">
              <Clock size={12} className="text-amber-500" /> Chờ khách nộp qua link Web
            </span>
          ) : (
            <Button 
              size="small" 
              icon={<Upload size={13} />} 
              className="text-xs border-dashed border-indigo-300 text-indigo-700 hover:border-indigo-500 hover:text-indigo-800"
              onClick={() => triggerUploadDoc(record.key)}
            >
              Tải lên tệp
            </Button>
          )
        ) : (
          <div className="flex items-center gap-1.5 font-mono text-xs text-blue-600">
            <FileText size={14} className="shrink-0" />
            <span 
              className="truncate max-w-[130px] font-semibold underline cursor-pointer hover:text-blue-800" 
              title="Bấm để tải về / xem tệp"
              onClick={() => {
                if (record.file_data) {
                  const a = document.createElement('a');
                  a.href = record.file_data;
                  a.download = record.file;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  message.success(`Đang mở / tải xuống: ${record.file}`);
                } else {
                  message.info(`Tệp: ${record.file}`);
                }
              }}
            >
              {text}
            </span>
            <span className="text-gray-400 font-sans text-[11px] shrink-0">({record.size})</span>
            {!isWebOrder && (
              <Tooltip title="Tải lại tệp khác">
                <Button 
                  type="text" 
                  size="small" 
                  icon={<Upload size={11} />} 
                  className="p-0.5 text-gray-400 hover:text-indigo-600"
                  onClick={() => triggerUploadDoc(record.key)}
                />
              </Tooltip>
            )}
          </div>
        )
      )
    },
    { 
      title: 'Trạng thái', 
      dataIndex: 'status', 
      key: 'status',
      width: '18%',
      render: (st) => (
        st === 'APPROVED' ? <Tag color="success" className="font-semibold text-[11px]">ĐÃ HỢP LỆ</Tag> :
        st === 'REJECTED' ? <Tag color="error" className="font-semibold text-[11px]">TỪ CHỐI</Tag> :
        st === 'PENDING_REVIEW' ? <Tag color="warning" className="font-semibold text-[11px]">CHỜ KIỂM TRA</Tag> :
        <Tag color="default" className="text-[11px]">CHỜ TẢI LÊN</Tag>
      )
    },
    { 
      title: 'Thao tác', 
      key: 'action',
      width: '16%',
      render: (_, record) => (
        <Space size="small">
          <Button 
            size="small" 
            type="primary" 
            ghost 
            className="text-xs"
            onClick={() => handleApproveDoc(record.key)}
            disabled={record.status === 'APPROVED' || record.file === 'Chờ tải lên'}
          >
            Duyệt
          </Button>
          <Button 
            size="small" 
            danger 
            ghost 
            className="text-xs"
            onClick={() => handleRejectDoc(record.key)}
            disabled={record.status === 'REJECTED' || record.file === 'Chờ tải lên'}
          >
            Từ chối
          </Button>
          {record.isCustom && (
            <Tooltip title="Xóa chứng từ bổ sung">
              <Button 
                size="small" 
                type="text" 
                danger 
                icon={<Trash2 size={13} />} 
                onClick={() => handleDeleteCustomDoc(record.key)}
              />
            </Tooltip>
          )}
        </Space>
      )
    }
  ];

  const cleanPhone = (order.customer_phone || '').replace(/[^0-9]/g, '');

  // Xây dựng danh sách Tabs theo yêu cầu nghiệp vụ:
  // 1. ĐƠN DRAFT (Chưa chốt giá): Chỉ hiện duy nhất tab "Tổng quan & Hàng hóa" có bản đồ và số km để chốt cước
  // 2. ĐƠN CONFIRMED (Đã chốt giá): Hiện Tổng quan, Kiểm duyệt chứng từ (tải từng cái), Hợp đồng, Tài chính & Chi phí
  // 3. ĐƠN IN_TRANSIT (Xe đã lăn bánh): Mới mở tab "Trao đổi nội bộ" để chat với tài xế
  const tabItems = [
    {
      key: '1',
      label: <span className="font-semibold text-xs">Tổng quan &amp; Hàng hóa</span>,
      children: (
        <div className="space-y-4">
          {/* Banner hướng dẫn luồng xử lý đối với đơn DRAFT */}
          {order.status === 'DRAFT' && (
            <div className="p-3.5 bg-gradient-to-r from-amber-50 to-indigo-50 rounded-xl border border-amber-200">
              <div className="flex items-center gap-2 font-bold text-amber-900 text-xs mb-1">
                <AlertTriangle size={15} className="text-amber-600" />
                <span>Quy trình xử lý đơn hàng nháp (Chưa chốt cước):</span>
              </div>
              <div className="text-xs text-gray-700 space-y-0.5">
                <p>1. Quan sát <b>hình ảnh bản đồ tuyến đường, số km và cước tham chiếu</b> bên dưới để chuẩn bị phương án báo giá.</p>
                <p>2. <b>Gọi điện / nhắn Zalo</b> cho khách hàng để tư vấn lộ trình và thống nhất giá cước thỏa thuận.</p>
                <p>3. Nhập giá đã chốt và bấm <b>&quot;Chốt giá &amp; Xác nhận đơn&quot;</b> để chuyển sang bước kiểm duyệt chứng từ và ký hợp đồng.</p>
              </div>
            </div>
          )}

          {/* Box Liên hệ khách hàng & Chốt giá cước thỏa thuận */}
          <div className="bg-gradient-to-r from-blue-50/60 to-indigo-50/60 p-4 rounded-xl border border-indigo-100 space-y-3">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
              <div>
                <span className="text-xs font-bold text-gray-700 uppercase tracking-wide flex items-center gap-1.5">
                  <PhoneCall size={14} className="text-indigo-600" /> Liên hệ khách hàng &amp; Chốt cước:
                </span>
                <span className="text-xs text-gray-600 font-medium mt-0.5 block">
                  {order.customer || order.customer_name} - SĐT: <b className="text-gray-900">{order.customer_phone || 'Chưa có'}</b>
                </span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {cleanPhone && (
                  <>
                    <a 
                      href={`tel:${cleanPhone}`} 
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 font-semibold text-xs shadow-xs"
                    >
                      <PhoneCall size={13} /> Gọi điện
                    </a>
                    <a 
                      href={`https://zalo.me/${cleanPhone}`} 
                      target="_blank" 
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 font-semibold text-xs shadow-xs"
                    >
                      <MessageCircle size={13} /> Nhắn Zalo
                    </a>
                  </>
                )}
                {order.customer_email && (
                  <a 
                    href={`mailto:${order.customer_email}`}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white text-gray-700 hover:bg-gray-50 font-medium text-xs border border-gray-200"
                  >
                    <Mail size={13} /> Gửi Email
                  </a>
                )}
              </div>
            </div>

            {/* Ô Chốt giá cước thỏa thuận */}
            <div className="p-3 bg-white rounded-lg border border-indigo-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-50 text-[#7367f0] rounded-lg">
                  <DollarSign size={18} />
                </div>
                <div>
                  <div className="text-xs font-bold text-gray-800">Giá cước thỏa thuận:</div>
                  <div className="text-[11px] text-gray-400">
                    {order.status === 'DRAFT' ? (
                      <span className="flex items-center gap-1 flex-wrap">
                        <span>Cước phí chốt với khách sau khi tư vấn (Giá gợi ý hệ thống:</span>
                        <Popover
                          title={
                            <div className="flex items-center gap-1.5 font-bold text-xs text-indigo-700 py-0.5 border-b border-indigo-50">
                              <Calculator size={14} /> Chi tiết công thức tính giá gợi ý hệ thống
                            </div>
                          }
                          content={
                            <div className="text-xs space-y-2.5 p-1 w-72">
                              <div className="bg-gray-50 p-2.5 rounded-lg border border-gray-100 space-y-1.5 font-mono text-[11px]">
                                <div className="flex justify-between items-center text-gray-600">
                                  <span>1. Cước xuất bến / mở chuyến:</span>
                                  <span className="font-semibold text-gray-800">{pricingBreakdown.baseFare.toLocaleString()} đ</span>
                                </div>
                                <div className="flex justify-between items-center text-gray-600">
                                  <span>2. Cước cự ly ({pricingBreakdown.dist} km × 45.000đ):</span>
                                  <span className="font-semibold text-gray-800">{pricingBreakdown.distanceFee.toLocaleString()} đ</span>
                                </div>
                                <div className="flex justify-between items-center text-gray-600">
                                  <span>3. Cước tải trọng ({pricingBreakdown.weight} kg × 850đ):</span>
                                  <span className="font-semibold text-gray-800">{pricingBreakdown.weightFee.toLocaleString()} đ</span>
                                </div>
                                <div className="border-t border-gray-200 pt-1.5 mt-1 flex justify-between items-center text-gray-500 text-[10px]">
                                  <span>Tổng thô chưa làm tròn:</span>
                                  <span>{pricingBreakdown.totalRaw.toLocaleString()} đ</span>
                                </div>
                              </div>

                              <div className="p-2 bg-indigo-50/70 border border-indigo-100 rounded-lg flex items-center justify-between">
                                <span className="font-semibold text-indigo-900 text-xs">Giá gợi ý (làm tròn 50k):</span>
                                <span className="font-bold text-sm text-indigo-700 font-mono">
                                  {estimatedBaselineRate.toLocaleString()} VNĐ
                                </span>
                              </div>

                              <div className="text-[10px] text-gray-400 italic">
                                * Điều phối viên có thể dựa vào mức giá sàn này để thương lượng và chốt giá cuối cùng phù hợp với khách hàng.
                              </div>
                            </div>
                          }
                          trigger="click"
                          placement="bottomLeft"
                        >
                          <button 
                            type="button"
                            className="inline-flex items-center gap-1 font-bold text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer bg-indigo-50/70 hover:bg-indigo-100/70 px-1.5 py-0.5 rounded transition-all"
                            title="Bấm để xem công thức tính chi tiết"
                          >
                            <span>{estimatedBaselineRate.toLocaleString()} đ</span>
                            <Calculator size={12} className="text-indigo-500" />
                          </button>
                        </Popover>
                        <span>)</span>
                      </span>
                    ) : (
                      <>Giá cước cố định đã chốt với khách hàng và ghi nhận vào hợp đồng</>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {order.status === 'DRAFT' ? (
                  <>
                    <InputNumber 
                      className="w-44 font-bold text-blue-700"
                      value={currentAgreedPrice}
                      onChange={val => setCurrentAgreedPrice(val || 0)}
                      formatter={val => `${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                      parser={val => val.replace(/\$\s?|(,*)/g, '')}
                      placeholder="Nhập giá cước..."
                      min={0}
                    />
                    <span className="text-xs text-gray-500 font-medium">VNĐ</span>
                    <Button 
                      type="primary" 
                      size="middle" 
                      loading={savingPrice}
                      className="bg-indigo-600 hover:bg-indigo-700 font-semibold text-xs shadow-xs"
                      onClick={handleConfirmPriceAndOrder}
                    >
                      Chốt giá &amp; Xác nhận đơn
                    </Button>
                  </>
                ) : (
                  <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2">
                    <span className="font-bold text-sm text-blue-700 font-mono bg-blue-50/80 px-3 py-1.5 rounded-lg border border-blue-200">
                      {currentAgreedPrice > 0 ? `${currentAgreedPrice.toLocaleString()} VNĐ` : 'Chưa nhập'}
                    </span>
                    {(order.status === 'CANCELLED' || order.status === 'CLOSED') && (order.cancel_reason || order.cancellation_reason) ? (
                      <div className="flex flex-col items-end gap-0.5">
                        <Tag color="red" className="font-semibold text-xs py-0.5 px-2 m-0">
                          Đơn đã hủy
                        </Tag>
                        <span className="text-[11px] text-red-600 font-medium max-w-[260px] text-right truncate" title={order.cancel_reason || order.cancellation_reason}>
                          Lý do: <span className="italic">{order.cancel_reason || order.cancellation_reason}</span>
                        </span>
                      </div>
                    ) : (
                      <Tag color="blue" className="font-medium text-xs py-0.5 px-2">Đã chốt giá</Tag>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Bản đồ hình ảnh tuyến đường & Số km ước tính */}
          <div className="p-3.5 bg-gray-50/80 rounded-xl border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 font-bold text-gray-800 text-xs">
                <Route size={15} className="text-[#7367f0]" />
                <span>Bản đồ lộ trình &amp; Khoảng cách vận chuyển thực tế:</span>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="text-gray-500">
                  Quãng đường: <b className="text-indigo-700 font-mono text-sm">{routeInfo.distanceKm} km</b>
                </span>
                <span className="text-gray-400">|</span>
                <span className="text-gray-500">
                  Thời gian xe chạy: <b className="text-indigo-700 font-mono text-sm">{routeInfo.durationMins} phút</b>
                </span>
              </div>
            </div>

            <div className="rounded-lg overflow-hidden border border-gray-200 h-64 w-full">
              <RouteMapPicker
                pickupAddress={pickupAddress}
                deliveryAddress={deliveryAddress}
                pickupCoords={pickupCoords}
                deliveryCoords={deliveryCoords}
                onRouteChange={setRouteInfo}
                height={256}
              />
            </div>
          </div>

          {/* Thông tin hàng hóa & Thông số tải trọng */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
            <div>
              <div className="text-xs text-gray-500">Khách hàng:</div>
              <div className="font-bold text-gray-800 text-sm mt-0.5">{order.customer || order.customer_name}</div>
              <div className="text-xs text-gray-500 mt-1">Mã HAWB: <span className="font-mono font-semibold text-indigo-600">{order.hawb_code || order.order_id}</span></div>
              <div className="text-xs text-gray-500 mt-1">SĐT: {order.customer_phone || 'Chưa cung cấp'} | Email: {order.customer_email || 'Chưa cung cấp'}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Địa điểm giao nhận:</div>
              <div className="font-medium text-gray-700 text-xs mt-1">
                <span className="font-bold text-blue-600">Điểm lấy:</span> {pickupAddress}
              </div>
              <div className="font-medium text-gray-700 text-xs mt-1">
                <span className="font-bold text-emerald-600">Điểm giao:</span> {deliveryAddress}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100">
              <div className="text-[11px] text-gray-500">Số lượng / Quy cách</div>
              <div className="font-bold text-gray-800 text-sm mt-0.5">{order.package_count || 1} {order.package_unit || (order.cargo_type === 'BULK' ? 'Chuyến' : 'Kiện')}</div>
            </div>
            <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100">
              <div className="text-[11px] text-gray-500">Kích thước (DxRxC)</div>
              <div className="font-bold text-gray-800 text-xs mt-1">
                {order.cargo_type === 'BULK' || (!order.length_cm && !order.width_cm && !order.height_cm)
                  ? 'Hàng rời (Không đo)'
                  : `${order.length_cm || 0}x${order.width_cm || 0}x${order.height_cm || 0} cm`}
              </div>
            </div>
            <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100">
              <div className="text-[11px] text-gray-500">{order.cargo_type === 'BULK' ? 'Trọng tải hàng rời' : 'Trọng lượng thực'}</div>
              <div className="font-bold text-gray-800 text-sm mt-0.5">{order.weight || order.weight_kg || 0} kg</div>
            </div>
            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
              <div className="text-[11px] text-amber-800 font-medium">Tải trọng tính cước</div>
              <div className="font-bold text-amber-600 text-base mt-0.5">{order.chargeable || order.chargeable_weight || 0} kg</div>
            </div>
          </div>

          {/* Bảng danh sách mặt hàng nếu có nhiều loại hàng */}
          {order.items && Array.isArray(order.items) && order.items.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-3">
              <div className="px-3.5 py-2 bg-indigo-50/70 border-b border-indigo-150 flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
                  <Package size={14} className="text-indigo-600" /> Danh mục các loại hàng trong đơn ({order.items.length} loại)
                </span>
              </div>
              <div className="divide-y divide-gray-100 text-xs">
                {order.items.map((it, idx) => (
                  <div key={idx} className="p-2.5 flex items-center justify-between hover:bg-gray-50">
                    <div>
                      <span className="font-bold text-gray-800">{idx + 1}. {it.cargo_name}</span>
                      <span className="ml-2 text-gray-500 font-mono">({it.cargo_type})</span>
                    </div>
                    <div className="flex items-center gap-4 text-gray-600">
                      <span>SL: <b>{it.package_count} {it.package_unit}</b></span>
                      <span>Kích thước: <b>{it.length_cm}x{it.width_cm}x{it.height_cm} cm</b></span>
                      <span>Trọng lượng: <b className="text-indigo-600">{it.weight} kg</b></span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CHỈ HIỂN THỊ GHI CHÚ YÊU CẦU CỦA KHÁCH NẾU CÓ GHI CHÚ THẬT (KHÔNG HIỆN TEXT TỔNG HỢP GIẢ MẠO) */}
          {order.order_notes && 
           order.order_notes.trim().length > 0 && 
           !order.order_notes.includes('Đơn hàng nhận tư vấn từ Website') && 
           !order.order_notes.includes('Cần liên hệ tư vấn lộ trình') && (
            <div className="p-3 bg-yellow-50/80 rounded-xl border border-yellow-200 text-xs text-yellow-900">
              <div className="font-bold flex items-center gap-1 mb-1">
                <AlertTriangle size={14} /> Ghi chú yêu cầu của khách:
              </div>
              {order.order_notes}
            </div>
          )}
        </div>
      )
    }
  ];

  // Chỉ hiển thị các tab sau nếu đơn đã vượt qua bước nháp (CONFIRMED trở lên)
  if (order.status !== 'DRAFT') {
    // TAB 2: KIỂM DUYỆT CHỨNG TỪ
    tabItems.push({
      key: '2',
      label: <span className="font-semibold text-xs">Kiểm duyệt Chứng từ</span>,
      children: (
        <div className="space-y-4">
          {/* Header danh mục chứng từ */}
          <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 flex justify-between items-center gap-3">
            <div>
              <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wide m-0">
                Danh mục chứng từ hồ sơ xuất nhập khẩu
              </h4>
              <p className="text-[11px] text-gray-500 m-0">
                {isWebOrder 
                  ? 'Khách hàng tải lên trực tiếp qua liên kết web. Điều phối viên kiểm tra và phê duyệt tính hợp lệ trước khi xếp chuyến.' 
                  : 'Tải lên và kiểm duyệt tính hợp lệ của từng loại chứng từ trước khi xếp chuyến.'}
              </p>
            </div>
            <Button
              icon={<Sparkles size={14} className="text-purple-600" />}
              className="bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100 text-xs font-semibold shrink-0"
              onClick={() => setAssistantDrawerOpen(true)}
            >
              Trợ lý AI Gợi ý
            </Button>
          </div>

          {/* Thanh thêm chứng từ chuyên ngành hoặc tự do */}
          <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-200 flex flex-col lg:flex-row justify-between lg:items-center gap-3">
            <div>
              <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wide m-0">
                Thêm chứng từ vào hồ sơ:
              </h4>
              <p className="text-[11px] text-gray-500 m-0">Chọn từ danh mục chuyên ngành hoặc nhập tên chứng từ bổ sung</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Dropdown chọn chứng từ chuyên ngành theo 5 nhóm hàng */}
              <Select
                placeholder="Chọn chứng từ chuyên ngành..."
                value={selectedSpecializedDoc || undefined}
                onChange={val => {
                  setSelectedSpecializedDoc(val);
                  setNewDocName(val);
                }}
                className="w-72 text-xs"
                allowClear
              >
                {SPECIALIZED_CARGO_CATEGORIES.map(cat => (
                  <OptGroup key={cat.categoryKey} label={cat.categoryName}>
                    {cat.specializedDocs.map((sDoc, idx) => (
                      <Option key={`${cat.categoryKey}-${idx}`} value={sDoc.name}>
                        {sDoc.name}
                      </Option>
                    ))}
                  </OptGroup>
                ))}
              </Select>

              {/* Hoặc gõ tên chứng từ tự do */}
              <Input
                placeholder="Hoặc gõ tên chứng từ khác..."
                value={newDocName}
                onChange={e => setNewDocName(e.target.value)}
                onPressEnter={() => handleAddCustomDoc()}
                className="text-xs w-56 rounded-lg"
              />

              <Button 
                icon={<Plus size={14} />} 
                onClick={() => handleAddCustomDoc()}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shrink-0 shadow-xs"
              >
                Thêm chứng từ
              </Button>
            </div>
          </div>

          {/* Bảng danh mục chứng từ */}
          <Table 
            columns={docColumns} 
            dataSource={documents} 
            pagination={false} 
            size="small"
            className="border border-gray-100 rounded-lg"
          />

          {/* Tiến độ kiểm duyệt chứng từ (Chỉ để 1 nút xác nhận tại chân Modal) */}
          <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 flex items-center justify-between">
            <span className="text-xs text-gray-700">
              Tiến độ kiểm duyệt: <b className="text-indigo-600">{documents.filter(d => d.status === 'APPROVED').length}/{documents.length}</b> tệp đã duyệt hợp lệ
            </span>
            <span className="text-xs text-gray-500">
              Đã nộp tệp: <b>{documents.filter(d => d.file !== 'Chờ tải lên').length}/{documents.length}</b> tệp
            </span>
          </div>
        </div>
      )
    });

    // TAB 3: HỢP ĐỒNG VẬN TẢI
    const signedContractData = order.web_workflow?.signed_contract;

    tabItems.push({
      key: '3',
      label: <span className="font-semibold text-xs">Hợp đồng vận tải</span>,
      children: (
        <div className="space-y-4">
          <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
            <div className="flex justify-between items-center mb-3">
              <h4 className="font-bold text-gray-800 text-sm m-0">Ký kết &amp; Quản lý Hợp đồng Vận chuyển</h4>
              {signedContractData ? (
                <Tag color="success" className="font-bold text-xs py-0.5 px-2.5 flex items-center gap-1">
                  <CheckCircle2 size={12} /> ĐÃ KÝ CHỮ KÝ SỐ ĐIỆN TỬ
                </Tag>
              ) : contractUploaded ? (
                <Tag color="success" className="font-bold text-xs py-0.5 px-2.5 flex items-center gap-1">
                  <CheckCircle2 size={12} /> ĐÃ NỘP HỢP ĐỒNG ĐÃ KÝ
                </Tag>
              ) : isWebOrder ? (
                <Tag color="processing" className="font-bold text-xs py-0.5 px-2.5">
                  CHỜ KHÁCH HÀNG KÝ SỐ TRỰC TUYẾN
                </Tag>
              ) : (
                <Tag color="warning" className="font-bold text-xs py-0.5 px-2.5">CHƯA TẢI TỆP HỢP ĐỒNG</Tag>
              )}
            </div>

            {/* ĐỐI VỚI ĐƠN WEB: HIỂN THỊ TRẠNG THÁI KÝ SỐ VÀ CHỮ KÝ TRỰC TIẾP */}
            {isWebOrder ? (
              <div className="p-3.5 bg-white rounded-xl border border-indigo-100 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-gray-800 block">Hợp đồng điện tử ký số tự động (Đơn Web):</span>
                    <span className="text-[11px] text-gray-500">
                      Hợp đồng được hệ thống sinh tự động và gửi cho khách ký số qua email sau khi điều phối viên duyệt chứng từ.
                    </span>
                  </div>
                  {signedContractData ? (
                    <Tag color="cyan" className="font-mono text-xs">
                      {signedContractData.contract_file || `HD-${order.order_id}-SIGNED.pdf`}
                    </Tag>
                  ) : (
                    <Tag color="gold" className="text-xs">Đang chờ khách ký qua link mail</Tag>
                  )}
                </div>

                {signedContractData && (
                  <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200 text-xs">
                    <div className="font-bold text-emerald-800 mb-1 flex items-center gap-1.5">
                      <CheckCircle2 size={14} className="text-emerald-600" />
                      Chữ ký số đã được ghi nhận vào hồ sơ:
                    </div>
                    <div className="text-emerald-900">
                      Người ký: <b>{signedContractData.signer_name}</b> | Thời gian ký: <b>{new Date(signedContractData.signed_at).toLocaleString('vi-VN')}</b>
                    </div>
                    {signedContractData.signature_data && (
                      <div className="mt-2 bg-white p-2 rounded border border-emerald-200 inline-block">
                        <img 
                          src={signedContractData.signature_data} 
                          alt="Chữ ký điện tử của khách hàng" 
                          className="h-14 object-contain"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              /* ĐƠN NỘI BỘ / HOTLINE: NÚT TẢI MẪU VÀ TẢI TỆP HỢP ĐỒNG THẬT LÊN CƠ SỞ DỮ LIỆU */
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2.5">
                  <Button 
                    icon={<Download size={15} />} 
                    onClick={() => {
                      // Tạo file hợp đồng mẫu giả lập để tải về
                      const element = document.createElement('a');
                      const file = new Blob([
                        `CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM\nĐộc lập - Tự do - Hạnh phúc\n\nHỢP ĐỒNG VẬN CHUYỂN HÀNG HÓA\nSố: HD-${order.order_id || '2026'}\n\nBÊN A: CÔNG TY CỔ PHẦN LOGISTICS NEXLOG\nBÊN B: ${order.customer || 'Khách hàng'}\n\nCước phí thỏa thuận: ${currentAgreedPrice?.toLocaleString()} VNĐ\nĐiểm lấy: ${pickupAddress}\nĐiểm giao: ${deliveryAddress}`
                      ], { type: 'text/plain;charset=utf-8' });
                      element.href = URL.createObjectURL(file);
                      element.download = `Mau_Hop_Dong_Van_Chuyen_${order.order_id || 'NEXLOG'}.txt`;
                      document.body.appendChild(element);
                      element.click();
                      document.body.removeChild(element);
                      message.success('Đã tải xuống tệp mẫu hợp đồng vận chuyển!');
                    }}
                  >
                    Tải mẫu hợp đồng
                  </Button>
                  <Button 
                    type={contractUploaded ? "default" : "primary"}
                    icon={<Upload size={15} />} 
                    loading={uploadingContract}
                    className={!contractUploaded ? "bg-[#7367f0] hover:bg-[#5e50ee]" : ""}
                    onClick={() => {
                      if (contractInputRef.current) {
                        contractInputRef.current.value = '';
                        contractInputRef.current.click();
                      }
                    }}
                  >
                    {contractUploaded ? 'Tải lên tệp thay thế' : 'Tải lên tệp hợp đồng đã ký'}
                  </Button>
                </div>

                {/* Hộp hiển thị thông tin tệp hợp đồng thật đã tải lên */}
                {contractUploaded && contractFile && (
                  <div className="p-3 bg-white rounded-lg border border-emerald-200 flex items-center justify-between shadow-xs">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                        <FileCheck size={18} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-gray-800 flex items-center gap-2">
                          <span className="truncate">{contractFile}</span>
                          <Tag color="green" className="text-[10px] m-0 px-1.5 py-0 font-medium">Đã lưu trữ vào CSDL</Tag>
                        </div>
                        <div className="text-[11px] text-gray-400 mt-0.5">
                          Thời gian nộp: {contractUploadedAt ? new Date(contractUploadedAt).toLocaleString('vi-VN') : 'Vừa xong'}
                        </div>
                      </div>
                    </div>
                    {contractFileData && (
                      <Button 
                        size="small" 
                        type="link" 
                        icon={<Download size={13} />}
                        onClick={() => {
                          const a = document.createElement('a');
                          a.href = contractFileData;
                          a.download = contractFile;
                          document.body.appendChild(a);
                          a.click();
                          document.body.removeChild(a);
                          message.success(`Đang mở / tải xuống tệp: ${contractFile}`);
                        }}
                        className="text-indigo-600 font-semibold text-xs"
                      >
                        Tải tệp về
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="mt-4 p-3.5 bg-white rounded-lg border border-gray-200">
              <div className="text-xs font-bold text-gray-700 mb-1.5 flex items-center gap-1.5">
                <FileCheck size={14} className="text-indigo-600" /> Điều khoản hợp đồng vận chuyển áp dụng:
              </div>
              <ul className="text-xs text-gray-600 space-y-1 list-disc pl-4 m-0">
                <li>Thời gian chờ bốc xếp miễn phí tại kho: <b>60 phút</b>. Phí lưu ca phát sinh: <b>150.000 VNĐ / giờ</b>.</li>
                <li>Hủy đơn trước khi điều xe (nháp hoặc đang duyệt hồ sơ): <b>Miễn phí phạt (0 VNĐ)</b>.</li>
                <li>Hủy sau khi điều xe đến lấy hàng: <b>Tính tiền công tài xế &amp; phí điều xe</b> theo thỏa thuận.</li>
                <li>Hạn mức bồi thường hàng hóa: <b>100% giá trị khai báo</b> có niêm phong kẹp chì nguyên vẹn.</li>
              </ul>
            </div>
          </div>
        </div>
      )
    });

    // TAB 4: TÀI CHÍNH & PHỤ PHÍ PHÁT SINH
    tabItems.push({
      key: '4',
      label: <span className="font-semibold text-xs">Tài chính &amp; Phụ phí</span>,
      children: (
        <div className="space-y-4">
          {/* Tóm tắt tài chính */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 bg-blue-50/60 rounded-xl border border-blue-200">
              <div className="text-xs text-gray-500">Giá cước thỏa thuận:</div>
              <div className="text-lg font-bold text-blue-700 mt-1 font-mono">
                {currentAgreedPrice > 0 ? `${currentAgreedPrice.toLocaleString()} VNĐ` : 'Chưa chốt giá'}
              </div>
            </div>

            <div className="p-3.5 bg-indigo-50/60 rounded-xl border border-indigo-200">
              <div className="text-xs text-indigo-700 font-semibold">Tổng phụ phí phát sinh:</div>
              <div className="text-lg font-bold text-indigo-800 mt-1 font-mono">
                {totalExtraFees.toLocaleString()} VNĐ
              </div>
            </div>

            <div className="p-3.5 bg-emerald-50/60 rounded-xl border border-emerald-200">
              <div className="text-xs text-emerald-700 font-semibold">Tổng thanh toán dự kiến:</div>
              <div className="text-xl font-bold text-emerald-700 mt-1 font-mono">
                {(currentAgreedPrice + totalExtraFees).toLocaleString()} VNĐ
              </div>
            </div>
          </div>

          {/* Form thêm phụ phí phát sinh */}
          <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
            <div className="font-bold text-xs text-gray-800 uppercase tracking-wide flex items-center gap-1.5">
              <Plus size={14} className="text-indigo-600" /> Thêm phụ phí phát sinh (Sau khi chốt đơn &amp; ký hợp đồng):
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Select 
                value={newFeeType} 
                onChange={setNewFeeType} 
                className="w-full text-xs"
              >
                {EXTRA_FEE_TYPES.map((t, idx) => (
                  <Option key={idx} value={t}>{t}</Option>
                ))}
              </Select>
              <InputNumber
                placeholder="Nhập số tiền phát sinh..."
                value={newFeeAmount}
                onChange={val => setNewFeeAmount(val || 0)}
                formatter={val => `${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                parser={val => val.replace(/\$\s?|(,*)/g, '')}
                min={0}
                className="w-full font-bold text-indigo-700 text-xs"
              />
              <Input
                placeholder="Lý do / Biên bản ghi nhận phát sinh..."
                value={newFeeReason}
                onChange={e => setNewFeeReason(e.target.value)}
                className="text-xs"
              />
            </div>

            <div className="flex justify-end">
              <Button 
                type="primary" 
                size="small" 
                icon={<Plus size={13} />} 
                className="bg-[#7367f0] text-xs font-semibold"
                onClick={handleAddExtraFee}
              >
                Ghi nhận phụ phí
              </Button>
            </div>
          </div>

          {/* Danh sách các phụ phí đã thêm */}
          {extraFees.length > 0 && (
            <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
              <div className="bg-gray-100/70 px-4 py-2 text-xs font-bold text-gray-700 border-b border-gray-200">
                Các khoản phụ phí đã ghi nhận ({extraFees.length}):
              </div>
              <div className="divide-y divide-gray-100">
                {extraFees.map(fee => (
                  <div key={fee.id} className="p-3 flex justify-between items-center text-xs hover:bg-gray-50">
                    <div>
                      <div className="font-bold text-gray-800">{fee.type}</div>
                      <div className="text-[11px] text-gray-500 mt-0.5">{fee.reason} | Ghi nhận lúc: {fee.time}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold font-mono text-indigo-700 text-sm">{fee.amount.toLocaleString()} VNĐ</span>
                      <Button 
                        type="text" 
                        danger 
                        size="small" 
                        icon={<Trash2 size={13} />} 
                        onClick={() => {
                          const updated = extraFees.filter(f => f.id !== fee.id);
                          setExtraFees(updated);
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )
    });

    // TAB 5: TRAO ĐỔI NỘI BỘ VỚI TÀI XẾ
    // Yêu cầu: Nếu đang chưa xếp xong chuyến thì CHƯA CÓ CHAT, phải tài xế đã nhận chuyến rồi và đang di chuyển mới có chat!
    if (['IN_TRANSIT', 'ASSIGNED'].includes(order.status)) {
      tabItems.push({
        key: '5',
        label: (
          <span className="font-semibold text-xs flex items-center gap-1">
            <MessageCircle size={13} /> Trao đổi với tài xế (Đang chạy)
          </span>
        ),
        children: (
          <div className="space-y-4">
            <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
              <div className="text-xs font-bold text-gray-700 mb-2">Kênh liên lạc điều hành hiện trường:</div>
              <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                {orderMessages.map(msg => (
                  <div 
                    key={msg.id} 
                    className={`p-2.5 rounded-lg text-xs ${msg.role === 'DISPATCHER' ? 'bg-indigo-50 border border-indigo-200 ml-6 text-indigo-950' : 'bg-white border border-gray-200 mr-6 text-gray-800'}`}
                  >
                    <div className="flex justify-between items-center mb-1 text-[11px]">
                      <span className="font-bold">{msg.sender}</span>
                      <span className="text-gray-400 font-mono">{msg.time}</span>
                    </div>
                    <p className="m-0 leading-relaxed">{msg.content}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2 items-center">
              <Input 
                placeholder="Nhập tin nhắn hướng dẫn hoặc cảnh báo cho tài xế..." 
                value={newMessageText}
                onChange={e => setNewMessageText(e.target.value)}
                onPressEnter={handleSendMessage}
                className="text-xs"
              />
              <Button 
                type="primary" 
                onClick={handleSendMessage}
                className="bg-[#7367f0] hover:bg-[#5e50ee] text-xs font-semibold"
              >
                Gửi tin
              </Button>
            </div>
          </div>
        )
      });
    }
  }

  return (
    <>
      {/* Hidden File Input để tải lên từng chứng từ */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        className="hidden" 
        accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx"
      />

      {/* Hidden File Input để tải lên hợp đồng THẬT */}
      <input 
        type="file" 
        ref={contractInputRef} 
        onChange={handleContractFileChange} 
        className="hidden" 
        accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
      />

      <Modal
        title={
          <div className="flex items-center justify-between pb-3 border-b border-gray-100 pr-8">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-50 text-[#7367f0] rounded-xl font-bold font-mono">
                {order.order_id}
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-800">Hồ sơ Chi tiết Đơn hàng</h3>
                <p className="text-[11px] text-gray-400 m-0">Khách hàng: <b>{order.customer}</b></p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {order.source === 'HOMEPAGE' ? (
                <Tag color="orange" className="font-semibold text-xs rounded-full px-3 py-0.5">
                  Nguồn: Website
                </Tag>
              ) : (
                <Tag color="blue" className="font-semibold text-xs rounded-full px-3 py-0.5">
                  Nguồn: Hotline / Trực tiếp
                </Tag>
              )}
              <Tag color={
                order.status === 'DELIVERED' ? 'green' : 
                order.status === 'CANCELLED' ? 'red' : 
                order.status === 'READY_FOR_PLANNING' ? 'cyan' : 
                order.status === 'CONFIRMED' ? 'blue' : 'default'
              } className="px-3 py-1 font-semibold text-xs rounded-full">
                {order.status === 'DRAFT' ? 'ĐƠN NHÁP' : 
                 order.status === 'CONFIRMED' ? 'CẦN XÁC NHẬN CHỨNG TỪ' : 
                 order.status === 'READY_FOR_PLANNING' ? 'SẴN SÀNG XẾP XE' : order.status}
              </Tag>
            </div>
          </div>
        }
        open={open}
        onCancel={onCancel}
        width={980}
        footer={[
          <Button key="close" onClick={onCancel}>Đóng</Button>,
          order.status === 'DRAFT' && (
            <Button 
              key="confirmPrice" 
              type="primary" 
              loading={savingPrice}
              className="bg-indigo-600 hover:bg-indigo-700 font-semibold" 
              onClick={handleConfirmPriceAndOrder}
            >
              Chốt giá &amp; Xác nhận đơn
            </Button>
          ),
          order.status === 'CONFIRMED' && (
            <Button 
              key="confirmDocs" 
              type="primary" 
              loading={confirmingDocs}
              className="bg-emerald-600 hover:bg-emerald-700 font-semibold" 
              onClick={handleConfirmAllDocuments}
            >
              {order.source === 'HOMEPAGE' 
                ? 'Duyệt chứng từ & Gửi hợp đồng ký số' 
                : 'Xác nhận chứng từ & Xếp chuyến'}
            </Button>
          ),
          order.status === 'READY_FOR_PLANNING' && (
            <Button 
              key="planTrip" 
              type="primary" 
              icon={<ArrowUpRight size={14} />} 
              className="bg-[#7367f0] hover:bg-[#5e50ee] font-semibold"
              onClick={() => {
                onCancel();
                router.push('/dispatcher/trips');
              }}
            >
              Chuyển sang Xếp chuyến &amp; Điều xe
            </Button>
          ),
          // Chỉ cho phép hủy đơn nếu chưa lăn bánh (không hủy đơn IN_TRANSIT)
          ['DRAFT', 'CONFIRMED', 'READY_FOR_PLANNING', 'ASSIGNED'].includes(order.status) && (
            <Button key="cancel" danger onClick={() => setCancelModalOpen(true)}>
              Hủy đơn
            </Button>
          )
        ]}
      >
        <div className="py-1">
          <Tabs 
            activeKey={activeTab} 
            onChange={setActiveTab}
            items={tabItems}
          />
        </div>
      </Modal>

      {/* Modal Hủy Đơn Hàng chuyên biệt */}
      <CancelOrderModal
        open={cancelModalOpen}
        order={order}
        onCancel={() => setCancelModalOpen(false)}
        onConfirmCancel={handleExecuteCancel}
      />

      {/* Drawer Trợ Lý AI Tư Vấn Chứng Từ */}
      <DocumentAssistantDrawer
        open={assistantDrawerOpen}
        onClose={() => setAssistantDrawerOpen(false)}
        onApplyRecommendations={handleApplyAssistantRecommendations}
        currentCargo={order.cargo_name || order.cargo_type || ''}
      />
    </>
  );
}