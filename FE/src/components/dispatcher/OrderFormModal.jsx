import { useState, useMemo, useEffect, useRef } from 'react';
import { Modal, Form, Input, message } from 'antd';
import { FileText } from 'lucide-react';
import { 
  calculateRouteEstimate, 
  calculateAlsPricing,
  calculateExportPickupSuggestion,
  getCoordsFromAddress,
  BASIC_CUSTOMS_DOCUMENTS,
  SPECIALIZED_CARGO_CATEGORIES
} from '../../data/dispatcherPresets';
import { dispatcherApi } from '../../api/dispatcherApi';
import DocumentAssistantDrawer from './DocumentAssistantDrawer';

// Các module chức năng đã được tách gọn
import OrderFormCustomerSection from './orderForm/OrderFormCustomerSection';
import OrderFormRouteSection from './orderForm/OrderFormRouteSection';
import OrderFormVehicleSection from './orderForm/OrderFormVehicleSection';
import OrderFormCargoSection from './orderForm/OrderFormCargoSection';
import OrderFormPricingSection from './orderForm/OrderFormPricingSection';
import OrderFormDocumentsSection from './orderForm/OrderFormDocumentsSection';

const CUSTOMS_SERVICE_FEE = 500000; // Phí dịch vụ làm thủ tục hải quan hộ (VNĐ)

const OrderFormModal = ({ open, onCancel, onSubmit }) => {
  const [form] = Form.useForm();
  const [dbLocations, setDbLocations] = useState([]);

  // Chế độ chọn kho bãi: 'PRESET' hoặc 'CUSTOM'
  const [pickupMode, setPickupMode] = useState('PRESET');
  const [deliveryMode, setDeliveryMode] = useState('CUSTOM');
  const [selectedPickupPreset, setSelectedPickupPreset] = useState('ALS_NOI_BAI');
  const [selectedDeliveryPreset, setSelectedDeliveryPreset] = useState('ALS_NOI_BAI');

  // Tích chọn làm thủ tục hải quan hộ
  const [customsServiceRequired, setCustomsServiceRequired] = useState(false);

  const [pickupCoords, setPickupCoords] = useState(null);
  const [deliveryCoords, setDeliveryCoords] = useState(null);

  // State Hồ sơ chứng từ đính kèm (khách gửi qua Zalo / Hotline)
  const [documents, setDocuments] = useState(() => {
    return BASIC_CUSTOMS_DOCUMENTS.map((doc, idx) => ({
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
  });
  const [assistantDrawerOpen, setAssistantDrawerOpen] = useState(false);
  const [uploadingDocKey, setUploadingDocKey] = useState(null);
  const [selectedSpecializedDoc, setSelectedSpecializedDoc] = useState('');
  const [newCustomDocName, setNewCustomDocName] = useState('');
  const fileInputRef = useRef(null);

  // Tải danh sách điểm giao nhận từ database
  useEffect(() => {
    let active = true;
    const fetchLocations = async () => {
      try {
        const locs = await dispatcherApi.getLocations();
        if (active && Array.isArray(locs)) {
          setDbLocations(locs);
        }
      } catch (err) {
        console.error('Không tải được danh sách điểm giao nhận:', err);
      }
    };
    if (open) {
      fetchLocations();
    }
    return () => { active = false; };
  }, [open]);

  // Danh sách mặt hàng
  const [cargoItems, setCargoItems] = useState([
    {
      id: 1,
      cargo_name: '',
      cargo_type: undefined,
      package_count: null,
      package_unit: '',
      length_cm: null,
      width_cm: null,
      height_cm: null,
      weight: null
    }
  ]);

  const [shippingDirection, setShippingDirection] = useState('IMPORT');

  // Khởi tạo địa chỉ theo chiều vận chuyển
  const applyDirectionPreset = (direction) => {
    setShippingDirection(direction);
    form.setFieldsValue({ shipping_direction: direction });
    const custAddr = form.getFieldValue('customer_address') || '';

    if (direction === 'IMPORT') {
      setPickupMode('PRESET');
      setSelectedPickupPreset('ALS_NOI_BAI');
      form.setFieldsValue({
        pickup_address: 'Kho ALS tại Sân Bay Nội Bài',
        delivery_address: custAddr || ''
      });
      setPickupCoords({ lat: 21.2187, lng: 105.8042 });
      if (custAddr) {
        setDeliveryMode('CUSTOM');
        setDeliveryCoords(getCoordsFromAddress(custAddr, 'B'));
      } else {
        setDeliveryCoords(null);
      }
    } else {
      setDeliveryMode('PRESET');
      setSelectedDeliveryPreset('ALS_NOI_BAI');
      form.setFieldsValue({
        pickup_address: custAddr || '',
        delivery_address: 'Kho ALS tại Sân Bay Nội Bài'
      });
      setDeliveryCoords({ lat: 21.2187, lng: 105.8042 });
      if (custAddr) {
        setPickupMode('CUSTOM');
        setPickupCoords(getCoordsFromAddress(custAddr, 'A'));
      } else {
        setPickupCoords(null);
      }
    }
  };

  const handleSelectPickupPreset = (val) => {
    setSelectedPickupPreset(val);
    if (val === 'ALS_NOI_BAI') {
      setPickupMode('PRESET');
      form.setFieldsValue({ pickup_address: 'Kho ALS tại Sân Bay Nội Bài' });
      setPickupCoords({ lat: 21.2187, lng: 105.8042 });
    } else if (val === 'CUSTOM') {
      setPickupMode('CUSTOM');
      form.setFieldsValue({ pickup_address: '' });
      setPickupCoords(null);
    } else {
      setPickupMode('PRESET');
      const found = dbLocations.find(l => (l.raw_id || l.id) === val);
      if (found) {
        form.setFieldsValue({ pickup_address: found.address || found.name });
        setPickupCoords(found.lat && found.lng ? { lat: parseFloat(found.lat), lng: parseFloat(found.lng) } : null);
      }
    }
  };

  const handleSelectDeliveryPreset = (val) => {
    setSelectedDeliveryPreset(val);
    if (val === 'ALS_NOI_BAI') {
      setDeliveryMode('PRESET');
      form.setFieldsValue({ delivery_address: 'Kho ALS tại Sân Bay Nội Bài' });
      setDeliveryCoords({ lat: 21.2187, lng: 105.8042 });
    } else if (val === 'CUSTOM') {
      setDeliveryMode('CUSTOM');
      form.setFieldsValue({ delivery_address: '' });
      setDeliveryCoords(null);
    } else {
      setDeliveryMode('PRESET');
      const found = dbLocations.find(l => (l.raw_id || l.id) === val);
      if (found) {
        form.setFieldsValue({ delivery_address: found.address || found.name });
        setDeliveryCoords(found.lat && found.lng ? { lat: parseFloat(found.lat), lng: parseFloat(found.lng) } : null);
      }
    }
  };

  const addCargoItem = () => {
    setCargoItems(prev => [
      ...prev,
      {
        id: Date.now(),
        cargo_name: '',
        cargo_type: undefined,
        package_count: null,
        package_unit: '',
        length_cm: null,
        width_cm: null,
        height_cm: null,
        weight: null
      }
    ]);
  };

  const removeCargoItem = (id) => {
    if (cargoItems.length <= 1) return;
    setCargoItems(prev => prev.filter(it => it.id !== id));
  };

  const updateCargoItem = (id, field, value) => {
    setCargoItems(prev => prev.map(it => {
      if (it.id === id) {
        const updated = { ...it, [field]: value };
        if (field === 'cargo_type' && value === 'BULK') {
          updated.length_cm = null;
          updated.width_cm = null;
          updated.height_cm = null;
        }
        return updated;
      }
      return it;
    }));
  };

  // Tính tổng hàng hóa
  const totals = useMemo(() => {
    let totalCount = 0;
    let actualWeight = 0;
    let chargeableWeight = 0;

    cargoItems.forEach(it => {
      const cnt = Number(it.package_count) || 1;
      const w = Number(it.weight) || 0;
      totalCount += cnt;
      actualWeight += w;

      if (it.cargo_type === 'BULK') {
        chargeableWeight += w;
      } else {
        const l = Number(it.length_cm) || 0;
        const width = Number(it.width_cm) || 0;
        const h = Number(it.height_cm) || 0;
        const volCbm = (l * width * h * cnt) / 1000000;
        const dimWeight = volCbm * 167;
        chargeableWeight += Math.max(w, dimWeight);
      }
    });

    return {
      totalCount,
      actualWeight: actualWeight.toFixed(1),
      chargeableWeight: chargeableWeight.toFixed(1)
    };
  }, [cargoItems]);

  const watchedValues = Form.useWatch([], form);

  // Tính lộ trình & cước phí
  const routeInfo = useMemo(() => {
    const pCoords = pickupCoords || getCoordsFromAddress(watchedValues?.pickup_address, 'A');
    const dCoords = deliveryCoords || getCoordsFromAddress(watchedValues?.delivery_address, 'B');
    if (!pCoords || !dCoords) {
      return { distanceKm: 30, durationMins: 45, isDefault: true };
    }
    return calculateRouteEstimate(pCoords.lat, pCoords.lng, dCoords.lat, dCoords.lng);
  }, [pickupCoords, deliveryCoords, watchedValues?.pickup_address, watchedValues?.delivery_address]);

  const estimatedPricing = useMemo(() => {
    return calculateAlsPricing({
      distanceKm: routeInfo.distanceKm,
      chargeableWeightKg: parseFloat(totals.chargeableWeight) || 0,
      vehicleType: watchedValues?.vehicle_type_required || 'TRUCK_2.5T',
      timeSlot: watchedValues?.operating_time_slot || 'FULL_DAY',
      pickupAddress: watchedValues?.pickup_address || '',
      deliveryAddress: watchedValues?.delivery_address || '',
      loadingUnloadingRequired: watchedValues?.loading_unloading_required === true,
      customsServiceRequired: customsServiceRequired
    });
  }, [
    routeInfo.distanceKm,
    totals.chargeableWeight,
    watchedValues?.vehicle_type_required,
    watchedValues?.operating_time_slot,
    watchedValues?.pickup_address,
    watchedValues?.delivery_address,
    watchedValues?.loading_unloading_required,
    customsServiceRequired
  ]);

  const estimatedBaselineRate = estimatedPricing.totalRate || 0;

  const exportPickupSuggestion = useMemo(() => {
    if (shippingDirection !== 'EXPORT' || !watchedValues?.flight_datetime) return null;
    return calculateExportPickupSuggestion(watchedValues.flight_datetime, routeInfo.distanceKm || 30);
  }, [shippingDirection, watchedValues?.flight_datetime, routeInfo.distanceKm]);

  useEffect(() => {
    if (estimatedBaselineRate > 0 && !form.isFieldTouched('agreed_price')) {
      form.setFieldsValue({ agreed_price: estimatedBaselineRate });
    }
  }, [estimatedBaselineRate, form]);

  const handleTriggerAiSuggestDocs = () => {
    setAssistantDrawerOpen(true);
  };

  const handleApplyAssistantDocs = (newDocList) => {
    setDocuments(newDocList);
    setAssistantDrawerOpen(false);
    message.success(`Đã cập nhật ${newDocList.length} loại chứng từ theo tư vấn của Gemini AI!`);
  };

  const triggerUploadDoc = (docKey) => {
    setUploadingDocKey(docKey);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleDocFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file || !uploadingDocKey) return;

    const fileSizeStr = file.size > 1024 * 1024
      ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
      : `${Math.round(file.size / 1024)} KB`;

    const now = new Date();
    const dateStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')} ${now.getDate()}/${now.getMonth() + 1}`;

    const reader = new FileReader();
    reader.onload = () => {
      const base64Data = reader.result;
      setDocuments(prev => prev.map(d => {
        if (d.key === uploadingDocKey) {
          return {
            ...d,
            file: file.name,
            file_data: base64Data,
            size: fileSizeStr,
            uploadDate: dateStr,
            status: 'APPROVED'
          };
        }
        return d;
      }));
      message.success(`Đã đính kèm tệp "${file.name}" cho chứng từ!`);
      setUploadingDocKey(null);
    };
    reader.readAsDataURL(file);
  };

  const handleAddDirectCustomDoc = () => {
    const title = (newCustomDocName || selectedSpecializedDoc || '').trim();
    if (!title) {
      message.warning('Vui lòng chọn hoặc nhập tên loại chứng từ cần thêm!');
      return;
    }

    if (documents.some(d => d.name.toLowerCase() === title.toLowerCase())) {
      message.warning('Loại chứng từ này đã có trong danh mục của đơn!');
      return;
    }

    let docDesc = 'Chứng từ chuyên ngành bổ sung theo yêu cầu hàng hóa/khách hàng.';
    let catName = 'Chứng từ bổ sung';
    for (const cat of SPECIALIZED_CARGO_CATEGORIES) {
      const match = cat.specializedDocs.find(d => d.name === title);
      if (match) {
        docDesc = match.description;
        catName = cat.categoryName;
        break;
      }
    }

    const newKey = `custom-direct-doc-${Date.now()}`;
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

    setDocuments(prev => [...prev, newDoc]);
    setNewCustomDocName('');
    setSelectedSpecializedDoc('');
    message.success(`Đã thêm chứng từ: "${newDoc.name}"`);
  };

  const handleDeleteDirectDoc = (docKey) => {
    setDocuments(prev => prev.filter(d => d.key !== docKey));
    message.info('Đã xóa loại chứng từ khỏi danh mục.');
  };

  const handleReset = () => {
    form.resetFields();
    setCargoItems([{ id: 1, cargo_name: '', cargo_type: undefined, package_count: null, package_unit: '', length_cm: null, width_cm: null, height_cm: null, weight: null }]);
    setPickupCoords(null);
    setDeliveryCoords(null);
    setPickupMode('PRESET');
    setDeliveryMode('CUSTOM');
    setSelectedPickupPreset('ALS_NOI_BAI');
    setSelectedDeliveryPreset('ALS_NOI_BAI');
    setCustomsServiceRequired(false);
    onCancel();
  };

  const handleOk = () => {
    for (let i = 0; i < cargoItems.length; i++) {
      const it = cargoItems[i];
      if (!it.cargo_name?.trim()) { message.error(`Vui lòng nhập tên hàng cho mặt hàng #${i + 1}`); return; }
      if (!it.cargo_type) { message.error(`Vui lòng chọn loại hàng cho mặt hàng #${i + 1}`); return; }
      if (!it.weight || Number(it.weight) <= 0) { message.error(`Vui lòng nhập trọng lượng hợp lệ (> 0 kg) cho mặt hàng #${i + 1}`); return; }
    }

    form.validateFields().then((fieldValues) => {
      const primaryItem = cargoItems[0] || {};
      const cargoDescription = cargoItems
        .map(it => `${it.cargo_name}${it.package_count ? ` (${it.package_count} ${it.package_unit || 'kiện'})` : ''}`)
        .join(', ');

      onSubmit({
        ...fieldValues,
        required_pickup_date: shippingDirection === 'IMPORT'
          ? (fieldValues.flight_arrival_date || fieldValues.required_pickup_date || null)
          : (fieldValues.required_pickup_date || null),
        required_delivery_date: fieldValues.required_delivery_date || fieldValues.required_pickup_date || null,
        flight_arrival_date: fieldValues.flight_arrival_date || null,
        flight_arrival_time: fieldValues.flight_arrival_time || null,
        flight_datetime: fieldValues.flight_datetime || null,
        export_pickup_suggestion: exportPickupSuggestion?.latestPickupFormatted || null,
        shipping_direction: shippingDirection,
        customs_service_required: customsServiceRequired,
        customs_fee: customsServiceRequired ? CUSTOMS_SERVICE_FEE : 0,
        items: cargoItems,
        cargo_name: cargoDescription,
        cargo_type: primaryItem.cargo_type || 'GENERAL',
        package_count: totals.totalCount || 1,
        package_unit: cargoItems.length > 1 ? 'Loại hàng kết hợp' : (primaryItem.package_unit || 'Kiện'),
        length_cm: primaryItem.cargo_type === 'BULK' ? 0 : (primaryItem.length_cm || 0),
        width_cm: primaryItem.cargo_type === 'BULK' ? 0 : (primaryItem.width_cm || 0),
        height_cm: primaryItem.cargo_type === 'BULK' ? 0 : (primaryItem.height_cm || 0),
        weight_kg: parseFloat(totals.actualWeight) || 0,
        chargeable_weight: parseFloat(totals.chargeableWeight) || 0,
        pickup_coords: pickupCoords,
        delivery_coords: deliveryCoords,
        estimated_distance_km: routeInfo.distanceKm,
        estimated_duration_mins: routeInfo.durationMins,
        estimated_baseline_rate: estimatedBaselineRate,
        documents: documents,
        created_at: new Date().toISOString()
      });
      handleReset();
    });
  };

  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => {
        applyDirectionPreset('IMPORT');
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [open]);

  return (
    <Modal
      title={
        <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
          <div className="p-2 bg-indigo-50 text-[#7367f0] rounded-lg">
            <FileText size={20} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-800">Tạo đơn vận chuyển</h3>
            <p className="text-xs text-gray-500 font-normal">Điều phối viên tạo đơn trực tiếp</p>
          </div>
        </div>
      }
      open={open}
      destroyOnHidden={true}
      onOk={handleOk}
      onCancel={handleReset}
      width={960}
      okText="Xác nhận tạo đơn"
      cancelText="Đóng"
      okButtonProps={{ className: "bg-[#7367f0] hover:bg-[#5e50ee] font-semibold h-9 px-5" }}
      cancelButtonProps={{ className: "h-9 px-4" }}
    >
      <div className="pt-2"></div>

      <Form 
        form={form} 
        layout="vertical" 
        initialValues={{ 
          source: 'HOTLINE',
          status: 'READY_FOR_PLANNING',
          is_new_customer: false,
          address_same_as_customer: false,
          pickup_address: '',
          delivery_address: '',
          customer_address: '',
          vehicle_type_required: 'TRUCK_2.5T',
          operating_time_slot: 'FULL_DAY',
          loading_unloading_required: false
        }}
      >
        <OrderFormCustomerSection form={form} shippingDirection={shippingDirection} />

        <OrderFormRouteSection
          form={form}
          shippingDirection={shippingDirection}
          applyDirectionPreset={applyDirectionPreset}
          pickupMode={pickupMode}
          deliveryMode={deliveryMode}
          selectedPickupPreset={selectedPickupPreset}
          selectedDeliveryPreset={selectedDeliveryPreset}
          handleSelectPickupPreset={handleSelectPickupPreset}
          handleSelectDeliveryPreset={handleSelectDeliveryPreset}
          pickupCoords={pickupCoords}
          deliveryCoords={deliveryCoords}
          setPickupCoords={setPickupCoords}
          setDeliveryCoords={setDeliveryCoords}
          dbLocations={dbLocations}
          routeInfo={routeInfo}
          exportPickupSuggestion={exportPickupSuggestion}
        />

        <OrderFormVehicleSection
          shippingDirection={shippingDirection}
          estimatedPricing={estimatedPricing}
          routeInfo={routeInfo}
        />

        <OrderFormCargoSection
          cargoItems={cargoItems}
          updateCargoItem={updateCargoItem}
          removeCargoItem={removeCargoItem}
          addCargoItem={addCargoItem}
          totals={totals}
        />

        <OrderFormPricingSection
          customsServiceRequired={customsServiceRequired}
          setCustomsServiceRequired={setCustomsServiceRequired}
          estimatedPricing={estimatedPricing}
          estimatedBaselineRate={estimatedBaselineRate}
          routeInfo={routeInfo}
        />

        {/* Ghi chú vận hành */}
        <Form.Item label="Ghi chú vận hành" name="order_notes" className="mb-4">
          <Input.TextArea rows={2} placeholder="Ghi chú cho tài xế, yêu cầu đặc biệt về bốc xếp, nhiệt độ bảo quản..." />
        </Form.Item>

        <OrderFormDocumentsSection
          documents={documents}
          handleTriggerAiSuggestDocs={handleTriggerAiSuggestDocs}
          triggerUploadDoc={triggerUploadDoc}
          handleDeleteDirectDoc={handleDeleteDirectDoc}
          selectedSpecializedDoc={selectedSpecializedDoc}
          setSelectedSpecializedDoc={setSelectedSpecializedDoc}
          newCustomDocName={newCustomDocName}
          setNewCustomDocName={setNewCustomDocName}
          handleAddDirectCustomDoc={handleAddDirectCustomDoc}
        />
      </Form>

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleDocFileChange}
        className="hidden"
        accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx"
      />

      <DocumentAssistantDrawer
        open={assistantDrawerOpen}
        onClose={() => setAssistantDrawerOpen(false)}
        currentCargo={cargoItems.map(it => it.cargo_name).filter(Boolean).join(', ') || 'Hàng hóa xuất nhập khẩu'}
        onApplyRecommendations={handleApplyAssistantDocs}
      />
    </Modal>
  );
};

export default OrderFormModal;
