'use client';
import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Modal, Tabs, Tag, message } from 'antd';
import { MessageCircle } from 'lucide-react';
import CancelOrderModal from './CancelOrderModal';
import DocumentAssistantDrawer from './DocumentAssistantDrawer';
import LoadPlan3DModal from './LoadPlan3DModal';
import SplitOrderModal from './SplitOrderModal';
import {
  getCoordsFromAddress,
  calculateAlsPricing,
  analyzeVehicleRecommendation,
  getVehicleSpecByKey,
  VEHICLE_SPECS
} from '../../data/dispatcherPresets';
import { orderApi } from '../../api/orderApi';

// Subcomponents đã được tách module
import OrderOverviewTab from './orderDetails/OrderOverviewTab';
import OrderDocumentsTab from './orderDetails/OrderDocumentsTab';
import OrderContractTab from './orderDetails/OrderContractTab';
import OrderFinancialTab from './orderDetails/OrderFinancialTab';
import OrderDriverChatTab from './orderDetails/OrderDriverChatTab';
import { RejectDocModal } from './orderDetails/RejectDocModal';
import { useOrderDocumentActions } from './orderDetails/useOrderDocumentActions';
import {
  OrderDetailsModalTitle,
  getOrderDetailsModalFooter
} from './orderDetails/OrderDetailsHeaderAndFooter';

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

export default function OrderDetailsModal({ open, order, onCancel, onUpdateOrder, readOnly = false }) {
  if (!open || !order) return null;

  return (
    <OrderDetailsModalContent
      key={`${order.id || order.order_id}`}
      open={open}
      order={order}
      onCancel={onCancel}
      onUpdateOrder={onUpdateOrder}
      readOnly={readOnly}
    />
  );
}

function OrderDetailsModalContent({ open, order, onCancel, onUpdateOrder, readOnly = false }) {
  const router = useRouter();
  const isClosed = order.status === 'CANCELLED' || order.status === 'CLOSED';
  const isLocked =
    isClosed ||
    [
      'READY_FOR_PLANNING',
      'ASSIGNED',
      'ACCEPTED',
      'PICKED_UP',
      'IN_TRANSIT',
      'HANDED_OVER_VENDOR',
      'DELIVERED',
      'DELIVERED_EXCEPTION'
    ].includes(order.status);

  // Xác định tab mặc định dựa trên trạng thái đơn hàng
  const defaultTab =
    order.targetTab ||
    (order.status === 'DRAFT' ? '1' : order.status === 'CONFIRMED' ? '2' : '1');

  const [activeTab, setActiveTab] = useState(defaultTab);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [splitModalOpen, setSplitModalOpen] = useState(false);
  const [savingPrice, setSavingPrice] = useState(false);

  // State Giá thỏa thuận, Phương án xe đề xuất, Lý do điều chỉnh lại giá
  const [currentAgreedPrice, setCurrentAgreedPrice] = useState(order.agreed_price || 0);
  const [adjustmentReason, setAdjustmentReason] = useState('');
  const [proposedVehicleType, setProposedVehicleType] = useState(
    order.proposed_vehicle_type ||
      order.web_workflow?.proposed_vehicle_type ||
      order.vehicle_type_required ||
      'TRUCK_2.5T'
  );
  const [vehicleAnalysisNote, setVehicleAnalysisNote] = useState(
    order.vehicle_analysis_note || order.web_workflow?.vehicle_analysis_note || ''
  );

  // State Modal mô phỏng xếp xe 3D
  const [is3DModalOpen, setIs3DModalOpen] = useState(false);
  const [selected3DVehicleType, setSelected3DVehicleType] = useState(null);

  // State Tuyến đường & Ước tính
  const [routeInfo, setRouteInfo] = useState({
    distanceKm: order.estimated_distance_km || 35.5,
    durationMins: order.estimated_duration_mins || 45
  });

  const [assistantDrawerOpen, setAssistantDrawerOpen] = useState(false);

  // Custom hook quản lý chứng từ & đính kèm hợp đồng
  const {
    documents,
    setDocuments,
    hasRejectedDocs,
    isDocsApprovedStage,
    confirmingDocs,
    rejectDocModalOpen,
    setRejectDocModalOpen,
    rejectingDocKey,
    setRejectingDocKey,
    rejectDocReason,
    setRejectDocReason,
    submittingRejectDoc,
    contractUploaded,
    uploadingContract,
    newDocName,
    setNewDocName,
    selectedSpecializedDoc,
    setSelectedSpecializedDoc,
    fileInputRef,
    contractInputRef,
    triggerUploadDoc,
    handleFileChange,
    handleContractFileChange,
    handleApproveDoc,
    handleRejectDoc,
    handleConfirmRejectDoc,
    handleAddCustomDoc,
    handleApplyAssistantRecommendations,
    handleDeleteCustomDoc,
    handleConfirmAllDocuments
  } = useOrderDocumentActions({
    order,
    onUpdateOrder,
    currentAgreedPrice
  });

  // State Phụ phí phát sinh
  const [extraFees, setExtraFees] = useState(order.extra_fees_list || []);
  useEffect(() => {
    setExtraFees(order.extra_fees_list || []);
  }, [order.id, order.order_id, order.extra_fees_list]);
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
        time: n.created_at
          ? new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : 'Vừa xong',
        content: n.content
      }));
    }
    if (order.order_notes) {
      return [
        {
          id: 1,
          sender: 'Thông tin tiếp nhận',
          role: 'SYSTEM',
          time: 'Vừa xong',
          content: order.order_notes
        }
      ];
    }
    return [];
  });
  const [newMessageText, setNewMessageText] = useState('');

  // Phân tích gợi ý chọn xe
  const vehicleRecommendation = useMemo(() => {
    return analyzeVehicleRecommendation({
      actualWeightKg: parseFloat(order.weight || order.weight_kg || 0),
      chargeableWeightKg: parseFloat(
        order.chargeable || order.chargeable_weight || order.weight || 0
      ),
      length_cm: parseFloat(order.length_cm || 0),
      width_cm: parseFloat(order.width_cm || 0),
      height_cm: parseFloat(order.height_cm || 0),
      package_count: parseInt(order.package_count, 10) || 1,
      items: order.items || [],
      customerRequestedVehicle:
        order.customer_requested_vehicle || order.vehicle_type_required || 'TRUCK_2.5T'
    });
  }, [order]);

  // Tính giá cước sàn gợi ý
  const pricingBreakdown = useMemo(() => {
    const dist = parseFloat(routeInfo.distanceKm) || 35.5;
    const weight = parseFloat(
      order.chargeable || order.chargeable_weight || order.weight || 1000
    );
    const vehicleType =
      proposedVehicleType || order.vehicle_type_required || order.vehicle_type || 'TRUCK_2.5T';
    const timeSlot = order.operating_time_slot || 'FULL_DAY';
    const isUnloading = order.loading_unloading_required === true;
    const isCustoms = order.customs_service_required === true;

    const alsPricing = calculateAlsPricing({
      distanceKm: dist,
      chargeableWeightKg: weight,
      vehicleType,
      timeSlot,
      pickupAddress: order.pickup || order.pickup_address || '',
      deliveryAddress: order.dropoff || order.delivery_address || '',
      loadingUnloadingRequired: isUnloading,
      customsServiceRequired: isCustoms
    });

    return {
      dist,
      weight,
      vehicleType,
      timeSlot,
      isFixedRoute: alsPricing.isFixedRoute,
      routeName: alsPricing.routeName,
      baseFare: alsPricing.baseTransportFee,
      loadingFee: alsPricing.loadingFee,
      customsFee: alsPricing.customsFee,
      totalRaw: alsPricing.totalRate,
      totalRounded: alsPricing.totalRate
    };
  }, [routeInfo, order, proposedVehicleType]);

  const estimatedBaselineRate = pricingBreakdown.totalRounded;

  // Tổng các khoản phụ phí phát sinh (chỉ cộng các khoản đã xác nhận, không cộng Proposed / Rejected)
  const totalExtraFees = useMemo(() => {
    return extraFees
      .filter(
        (item) => !['PROPOSED', 'REJECTED'].includes(String(item.status || '').toUpperCase())
      )
      .reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  }, [extraFees]);

  // Chuẩn hóa địa chỉ điểm lấy và điểm giao
  const pickupAddress = useMemo(() => {
    return (
      order.pickup ||
      order.pickup_address ||
      order.pickup_location?.address ||
      'Kho ALS Cảng HKQT Nội Bài'
    );
  }, [order]);

  const deliveryAddress = useMemo(() => {
    return (
      order.dropoff ||
      order.delivery_address ||
      order.delivery_location?.address ||
      'KCN Tiên Sơn, Bắc Ninh'
    );
  }, [order]);

  // Tọa độ
  const pickupCoords = useMemo(() => {
    if (order.pickup_coords?.lat && order.pickup_coords?.lng) return order.pickup_coords;
    if (order.pickup_location?.lat && order.pickup_location?.lng) {
      return {
        lat: parseFloat(order.pickup_location.lat),
        lng: parseFloat(order.pickup_location.lng)
      };
    }
    return getCoordsFromAddress(pickupAddress, 'A');
  }, [order, pickupAddress]);

  const deliveryCoords = useMemo(() => {
    if (order.dropoff_coords?.lat && order.dropoff_coords?.lng) return order.dropoff_coords;
    if (order.delivery_coords?.lat && order.delivery_coords?.lng) return order.delivery_coords;
    if (order.delivery_location?.lat && order.delivery_location?.lng) {
      return {
        lat: parseFloat(order.delivery_location.lat),
        lng: parseFloat(order.delivery_location.lng)
      };
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
      await orderApi
        .uploadOrderDocuments(order.id || order.order_id, documents)
        .catch(console.error);

      const res = await orderApi.updateAgreedPrice(
        order.id || order.order_id,
        currentAgreedPrice,
        adjustmentReason.trim(),
        {
          proposed_vehicle_type: proposedVehicleType,
          vehicle_analysis_note: vehicleAnalysisNote.trim()
        }
      );

      const isWebOrder = order.source === 'HOMEPAGE' || Boolean(order.customer_email);
      const selectedSpec = getVehicleSpecByKey(proposedVehicleType) || VEHICLE_SPECS[1];
      const updatedOrder = {
        ...order,
        status: isWebOrder ? 'DRAFT' : 'CONFIRMED',
        agreed_price: currentAgreedPrice,
        vehicle_type_required: proposedVehicleType,
        proposed_vehicle_type: proposedVehicleType,
        vehicle_analysis_note: vehicleAnalysisNote.trim(),
        documents: documents,
        web_workflow: res?.web_workflow || {
          ...(order.web_workflow || {}),
          stage: 'PRICE_AGREED_BY_DISPATCHER',
          agreed_price: currentAgreedPrice,
          proposed_vehicle_type: proposedVehicleType,
          vehicle_analysis_note: vehicleAnalysisNote.trim(),
          adjustment_reason: adjustmentReason.trim() || order.web_workflow?.adjustment_reason
        }
      };

      onUpdateOrder?.(updatedOrder);
      if (isWebOrder) {
        message.success(
          `Đã chốt phương án ${selectedSpec.label} & giá ${currentAgreedPrice.toLocaleString('vi-VN')} đ, đồng thời gửi email báo giá và yêu cầu chứng từ cho khách hàng!`
        );
      } else {
        message.success(
          `Đã chốt phương án ${selectedSpec.label} & giá ${currentAgreedPrice.toLocaleString('vi-VN')} đ! Đơn đã chuyển sang trạng thái Cần xác nhận chứng từ.`
        );
        setActiveTab('2');
      }
    } catch (err) {
      console.error(err);
      message.error(err.message || 'Lỗi khi cập nhật giá cước lên máy chủ');
    } finally {
      setSavingPrice(false);
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
      time: new Date().toLocaleString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
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
    setOrderMessages((prev) => [
      ...prev,
      {
        id: Date.now(),
        sender: 'Điều phối viên (Bạn)',
        role: 'DISPATCHER',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        content: newMessageText.trim()
      }
    ]);
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
          onUpdateOrder={onUpdateOrder}
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
          adjustmentReason={adjustmentReason}
          setAdjustmentReason={setAdjustmentReason}
          proposedVehicleType={proposedVehicleType}
          setProposedVehicleType={setProposedVehicleType}
          vehicleAnalysisNote={vehicleAnalysisNote}
          setVehicleAnalysisNote={setVehicleAnalysisNote}
          vehicleRecommendation={vehicleRecommendation}
          savingPrice={savingPrice}
          handleConfirmPriceAndOrder={handleConfirmPriceAndOrder}
          documents={documents}
          setDocuments={setDocuments}
          onOpenAssistant={() => setAssistantDrawerOpen(true)}
          onOpen3DModal={(vType) => {
            setSelected3DVehicleType(vType || proposedVehicleType);
            setIs3DModalOpen(true);
          }}
          onOpenSplitModal={
            !isLocked && !isClosed && order.status === 'DRAFT'
              ? () => setSplitModalOpen(true)
              : null
          }
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
      label: (
        <span className="font-semibold text-xs flex items-center gap-1">
          <span>Hợp đồng vận tải</span>
          {order.contract_hardcopy_received && (
            <Tag color="green" className="m-0 text-[9px] px-1 py-0">
              Bản cứng
            </Tag>
          )}
        </span>
      ),
      children: (
        <OrderContractTab
          order={order}
          currentAgreedPrice={currentAgreedPrice}
          proposedVehicleType={proposedVehicleType}
          currentProposedSpec={getVehicleSpecByKey(proposedVehicleType) || VEHICLE_SPECS[1]}
          onUpdateOrder={onUpdateOrder}
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

  const rejectingDocObj = documents.find((d) => d.key === rejectingDocKey);

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
        accept=".pdf"
      />

      <Modal
        title={
          <OrderDetailsModalTitle
            order={order}
            hasRejectedDocs={hasRejectedDocs}
            isDocsApprovedStage={isDocsApprovedStage}
          />
        }
        open={open}
        onCancel={onCancel}
        width={980}
        footer={getOrderDetailsModalFooter({
          order,
          isClosed,
          readOnly,
          onCancel,
          savingPrice,
          handleConfirmPriceAndOrder,
          isDocsApprovedStage,
          confirmingDocs,
          hasRejectedDocs,
          handleConfirmAllDocuments,
          contractUploaded,
          uploadingContract,
          onClickUploadScannedContract: () => {
            setActiveTab('3');
            if (contractInputRef.current) {
              contractInputRef.current.value = '';
              contractInputRef.current.click();
            }
          },
          onClickPlanTrip: () => {
            onCancel();
            router.push('/dispatcher/trips');
          },
          onClickCancelOrder: () => setCancelModalOpen(true)
        })}
      >
        <div className="py-1">
          <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} />
        </div>
      </Modal>

      {/* Modal nhập lý do từ chối chứng từ */}
      <RejectDocModal
        open={rejectDocModalOpen}
        onCancel={() => {
          setRejectDocModalOpen(false);
          setRejectingDocKey(null);
        }}
        rejectingDocObj={rejectingDocObj}
        rejectDocReason={rejectDocReason}
        setRejectDocReason={setRejectDocReason}
        onConfirm={handleConfirmRejectDoc}
        confirmLoading={submittingRejectDoc}
      />

      <CancelOrderModal
        open={cancelModalOpen}
        order={order}
        onCancel={() => setCancelModalOpen(false)}
        onConfirmCancel={handleExecuteCancel}
      />

      {/* Modal Tách đơn sang nhiều xe nhỏ theo chuẩn BR-29 */}
      <SplitOrderModal
        open={splitModalOpen}
        order={order}
        onCancel={() => setSplitModalOpen(false)}
        onSuccess={() => {
          onCancel?.();
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('nexlog_orders_updated'));
          }
        }}
      />

      <DocumentAssistantDrawer
        open={assistantDrawerOpen}
        onClose={() => setAssistantDrawerOpen(false)}
        onApplyRecommendations={handleApplyAssistantRecommendations}
        currentCargo={order.cargo_name || order.cargo_type || ''}
        order={order}
      />

      {/* Modal Mô phỏng xếp hàng 3D trong bước chốt xe với khách */}
      {is3DModalOpen && (
        <LoadPlan3DModal
          open={is3DModalOpen}
          onClose={() => setIs3DModalOpen(false)}
          trip={{
            id: `PREVIEW-${order.id || order.order_id}`,
            trip_code: `XEM-XE-${selected3DVehicleType || proposedVehicleType}`,
            truck_model:
              getVehicleSpecByKey(selected3DVehicleType || proposedVehicleType)?.label ||
              'Xe tải ALS',
            plate: 'XE-DU-KIEN',
            truck_length_cm:
              getVehicleSpecByKey(selected3DVehicleType || proposedVehicleType)?.length_cm || 420,
            truck_width_cm:
              getVehicleSpecByKey(selected3DVehicleType || proposedVehicleType)?.width_cm || 190,
            truck_height_cm:
              getVehicleSpecByKey(selected3DVehicleType || proposedVehicleType)?.height_cm || 190,
            max_payload:
              getVehicleSpecByKey(selected3DVehicleType || proposedVehicleType)?.maxPayloadKg ||
              2500,
            order: order
          }}
        />
      )}
    </>
  );
}
