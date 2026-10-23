'use client';
import { useState, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Modal, Tabs, Tag, Button, message } from 'antd';
import { 
  MessageCircle, 
  ArrowUpRight 
} from 'lucide-react';
import CancelOrderModal from './CancelOrderModal';
import DocumentAssistantDrawer from './DocumentAssistantDrawer';
import { 
  SPECIALIZED_CARGO_CATEGORIES, 
  getRecommendedDocsByCargo,
  getCoordsFromAddress
} from '../../data/dispatcherPresets';
import { orderApi } from '../../api/orderApi';

// Subcomponents đã được tách module
import OrderOverviewTab from './orderDetails/OrderOverviewTab';
import OrderDocumentsTab from './orderDetails/OrderDocumentsTab';
import OrderContractTab from './orderDetails/OrderContractTab';
import OrderFinancialTab from './orderDetails/OrderFinancialTab';
import OrderDriverChatTab from './orderDetails/OrderDriverChatTab';

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

  // State Chứng từ vận tải
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

  // State Chat nội bộ
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

  // Tính giá cước sàn gợi ý
  const pricingBreakdown = useMemo(() => {
    const dist = parseFloat(routeInfo.distanceKm) || 35.5;
    const weight = parseFloat(order.chargeable || order.chargeable_weight || order.weight || 1000);
    const baseFare = 1500000;
    const distanceFee = Math.round(dist * 45000);
    const weightFee = Math.round(weight * 850);
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

  // Tọa độ
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

  // 1. Chốt giá cước thỏa thuận
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
      setActiveTab('2');
    } catch (err) {
      console.error(err);
      message.error(err.message || 'Lỗi khi cập nhật giá cước lên máy chủ');
    } finally {
      setSavingPrice(false);
    }
  };

  // 2. Xử lý Tải lên chứng từ
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

    const nowFormatted = new Date().toLocaleDateString('vi-VN');

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

  // 2b. Xử lý Tải lên tệp hợp đồng
  const handleContractFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const sizeFormatted = file.size > 1024 * 1024 
      ? `${(file.size / (1024 * 1024)).toFixed(1)} MB` 
      : `${Math.round(file.size / 1024)} KB`;

    try {
      setUploadingContract(true);
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

  // 3. Duyệt và Từ chối chứng từ
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

  // 4. Bổ sung chứng từ tùy biến
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

  // 5. Xác nhận toàn bộ chứng từ
  const handleConfirmAllDocuments = async () => {
    const unuploaded = documents.filter(d => d.file === 'Chờ tải lên' || d.status === 'WAITING_UPLOAD');
    if (unuploaded.length > 0) {
      const hasUnuploadedCustoms = unuploaded.some(d => d.preparedBy === 'DISPATCHER' || d.key === 'doc-basic-1' || d.name?.toLowerCase().includes('tờ khai hải quan'));
      if (hasUnuploadedCustoms) {
        message.warning(`Vui lòng đính kèm Tệp Tờ khai hải quan (phần Điều phối chuẩn bị) trước khi phê duyệt toàn bộ hồ sơ!`);
      } else {
        message.warning(`Còn ${unuploaded.length} chứng từ chưa được tải tệp lên! Hãy tải đầy đủ trước khi xác nhận toàn bộ.`);
      }
      return;
    }

    const isWebOrder = order.source === 'HOMEPAGE';

    try {
      setConfirmingDocs(true);
      const approvedDocs = documents.map(d => ({ ...d, status: 'APPROVED' }));
      setDocuments(approvedDocs);

      if (isWebOrder) {
        await orderApi.approveWebOrderDocuments(order.id || order.order_id, approvedDocs);
        
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
        setActiveTab('3');
      } else {
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

  // 8. Gửi tin nhắn trao đổi nội bộ
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

  // Cấu hình Tabs
  const tabItems = [
    {
      key: '1',
      label: <span className="font-semibold text-xs">Tổng quan &amp; Hàng hóa</span>,
      children: (
        <OrderOverviewTab
          order={order}
          routeInfo={routeInfo}
          setRouteInfo={setRouteInfo}
          pickupAddress={pickupAddress}
          deliveryAddress={deliveryAddress}
          pickupCoords={pickupCoords}
          deliveryCoords={deliveryCoords}
          pricingBreakdown={pricingBreakdown}
          estimatedBaselineRate={estimatedBaselineRate}
          currentAgreedPrice={currentAgreedPrice}
          setCurrentAgreedPrice={setCurrentAgreedPrice}
          savingPrice={savingPrice}
          handleConfirmPriceAndOrder={handleConfirmPriceAndOrder}
        />
      )
    }
  ];

  if (order.status !== 'DRAFT') {
    tabItems.push({
      key: '2',
      label: <span className="font-semibold text-xs">Kiểm duyệt Chứng từ</span>,
      children: (
        <OrderDocumentsTab
          order={order}
          isWebOrder={isWebOrder}
          documents={documents}
          setDocuments={setDocuments}
          selectedSpecializedDoc={selectedSpecializedDoc}
          setSelectedSpecializedDoc={setSelectedSpecializedDoc}
          newDocName={newDocName}
          setNewDocName={setNewDocName}
          setAssistantDrawerOpen={setAssistantDrawerOpen}
          handleAddCustomDoc={handleAddCustomDoc}
          handleDeleteCustomDoc={handleDeleteCustomDoc}
          handleApproveDoc={handleApproveDoc}
          handleRejectDoc={handleRejectDoc}
          triggerUploadDoc={triggerUploadDoc}
          handleConfirmAllDocuments={handleConfirmAllDocuments}
          confirmingDocs={confirmingDocs}
        />
      )
    });

    tabItems.push({
      key: '3',
      label: <span className="font-semibold text-xs">Hợp đồng vận tải</span>,
      children: (
        <OrderContractTab
          order={order}
          isWebOrder={isWebOrder}
          contractUploaded={contractUploaded}
          contractFile={contractFile}
          contractFileData={contractFileData}
          contractUploadedAt={contractUploadedAt}
          uploadingContract={uploadingContract}
          contractInputRef={contractInputRef}
          currentAgreedPrice={currentAgreedPrice}
          pickupAddress={pickupAddress}
          deliveryAddress={deliveryAddress}
        />
      )
    });

    tabItems.push({
      key: '4',
      label: <span className="font-semibold text-xs">Tài chính &amp; Phụ phí</span>,
      children: (
        <OrderFinancialTab
          order={order}
          currentAgreedPrice={currentAgreedPrice}
          totalExtraFees={totalExtraFees}
          extraFees={extraFees}
          setExtraFees={setExtraFees}
          newFeeType={newFeeType}
          setNewFeeType={setNewFeeType}
          newFeeAmount={newFeeAmount}
          setNewFeeAmount={setNewFeeAmount}
          newFeeReason={newFeeReason}
          setNewFeeReason={setNewFeeReason}
          extraFeeTypes={EXTRA_FEE_TYPES}
          handleAddExtraFee={handleAddExtraFee}
        />
      )
    });

    if (['IN_TRANSIT', 'ASSIGNED'].includes(order.status)) {
      tabItems.push({
        key: '5',
        label: (
          <span className="font-semibold text-xs flex items-center gap-1">
            <MessageCircle size={13} /> Trao đổi với tài xế (Đang chạy)
          </span>
        ),
        children: (
          <OrderDriverChatTab
            orderMessages={orderMessages}
            newMessageText={newMessageText}
            setNewMessageText={setNewMessageText}
            handleSendMessage={handleSendMessage}
          />
        )
      });
    }
  }

  return (
    <>
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        className="hidden" 
        accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx"
      />

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

      <CancelOrderModal
        open={cancelModalOpen}
        order={order}
        onCancel={() => setCancelModalOpen(false)}
        onConfirmCancel={handleExecuteCancel}
      />

      <DocumentAssistantDrawer
        open={assistantDrawerOpen}
        onClose={() => setAssistantDrawerOpen(false)}
        onApplyRecommendations={handleApplyAssistantRecommendations}
        currentCargo={order.cargo_name || order.cargo_type || ''}
      />
    </>
  );
}