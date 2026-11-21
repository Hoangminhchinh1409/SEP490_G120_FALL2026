import { useState, useMemo, useEffect, useRef } from 'react';
import { Modal, Form, Input, message, Progress } from 'antd';
import { FileText, Sparkles, UploadCloud, CheckCircle2, AlertCircle } from 'lucide-react';
import { 
  calculateRouteEstimate, 
  calculateAlsPricing,
  calculateExportPickupSuggestion,
  getCoordsFromAddress,
  analyzeVehicleRecommendation,
  getVehicleSpecByKey,
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

  // State AI Document Agent (OCR Tờ khai / HAWB)
  const [isAiScanning, setIsAiScanning] = useState(false);
  const [aiScanProgress, setAiScanProgress] = useState(0);
  const [aiScanResult, setAiScanResult] = useState(null);
  const aiFileInputRef = useRef(null);

  // Tải danh sách điểm giao nhận từ database
  useEffect(() => {
    let active = true;
    const fetchLocations = async () => {
      try {
        const locs = await dispatcherApi.getLocations();
        if (active && Array.isArray(locs)) {
          setDbLocations(locs);
          const firstAls = locs.find(l => l.is_als_hub || l.raw_id === 1 || l.id === 1);
          if (firstAls) {
            setSelectedPickupPreset(firstAls.raw_id || firstAls.id);
            form.setFieldsValue({
              pickup_address: firstAls.address || firstAls.name
            });
            setPickupCoords({ lat: firstAls.lat || 21.2187, lng: firstAls.lng || 105.8042 });
          }
        }
      } catch (err) {
        console.error('Không tải được danh sách điểm giao nhận:', err);
      }
    };
    if (open) {
      fetchLocations();
    }
    return () => { active = false; };
  }, [open, form]);

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
    const defaultAls = dbLocations.find(l => l.is_als_hub || l.raw_id === 1 || l.id === 1) || {
      name: 'Kho ALS Cảng HKQT Nội Bài',
      address: 'Sân bay Quốc tế Nội Bài, Sóc Sơn, Hà Nội',
      lat: 21.2187,
      lng: 105.8042,
      raw_id: 1
    };

    if (direction === 'IMPORT') {
      setPickupMode('PRESET');
      setSelectedPickupPreset(defaultAls.raw_id || defaultAls.id);
      form.setFieldsValue({
        pickup_address: defaultAls.address || defaultAls.name,
        delivery_address: custAddr || ''
      });
      setPickupCoords({ lat: defaultAls.lat || 21.2187, lng: defaultAls.lng || 105.8042 });
      if (custAddr) {
        setDeliveryMode('CUSTOM');
        setDeliveryCoords(getCoordsFromAddress(custAddr, 'B'));
      } else {
        setDeliveryCoords(null);
      }
    } else {
      setDeliveryMode('PRESET');
      setSelectedDeliveryPreset(defaultAls.raw_id || defaultAls.id);
      form.setFieldsValue({
        pickup_address: custAddr || '',
        delivery_address: defaultAls.address || defaultAls.name
      });
      setDeliveryCoords({ lat: defaultAls.lat || 21.2187, lng: defaultAls.lng || 105.8042 });
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
    setPickupMode('PRESET');
    const found = dbLocations.find(l => (l.raw_id || l.id) === val);
    if (found) {
      form.setFieldsValue({ pickup_address: found.address || found.name });
      setPickupCoords(found.lat && found.lng ? { lat: parseFloat(found.lat), lng: parseFloat(found.lng) } : null);
    }
  };

  const handleSelectDeliveryPreset = (val) => {
    setSelectedDeliveryPreset(val);
    setDeliveryMode('PRESET');
    const found = dbLocations.find(l => (l.raw_id || l.id) === val);
    if (found) {
      form.setFieldsValue({ delivery_address: found.address || found.name });
      setDeliveryCoords(found.lat && found.lng ? { lat: parseFloat(found.lat), lng: parseFloat(found.lng) } : null);
    }
  };

  // --- XỬ LÝ AI DOCUMENT AGENT (OCR & TỰ ĐỘNG ĐIỀN FORM TRONG 15S) ---
  const handleAiFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input
    e.target.value = '';

    const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      message.error('Vui lòng chọn tệp định dạng PDF hoặc ảnh (JPG, PNG) của Tờ khai hoặc HAWB!');
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      message.error('Dung lượng tệp không được vượt quá 15MB!');
      return;
    }

    setIsAiScanning(true);
    setAiScanProgress(15);
    setAiScanResult(null);

    // Hiệu ứng tiến trình quét trong 12-15s
    const progressInterval = setInterval(() => {
      setAiScanProgress(prev => {
        if (prev >= 90) return prev;
        return prev + Math.floor(Math.random() * 12) + 5;
      });
    }, 600);

    try {
      const reader = new FileReader();
      const base64Promise = new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
      });
      reader.readAsDataURL(file);
      const fileBase64 = await base64Promise;

      const extracted = await dispatcherApi.extractOrderDocument({
        fileBase64,
        mimeType: file.type,
        fileName: file.name
      });

      clearInterval(progressInterval);
      setAiScanProgress(100);

      if (extracted) {
        setAiScanResult(extracted);
        message.success('AI Document Agent đã trích xuất thành công dữ liệu chứng từ!');

        // 1. Tự động điền hướng vận chuyển (IMPORT/EXPORT)
        const direction = extracted.order_type === 'EXPORT' ? 'EXPORT' : 'IMPORT';
        applyDirectionPreset(direction);

        // 2. Tự động điền thông tin khách hàng & người nhận
        form.setFieldsValue({
          customer_name: extracted.customer_name || form.getFieldValue('customer_name'),
          customer_tax_code: extracted.customer_tax_code || form.getFieldValue('customer_tax_code'),
          customer_phone: extracted.customer_phone || form.getFieldValue('customer_phone'),
          customer_email: extracted.customer_email || form.getFieldValue('customer_email'),
          receiver_name: extracted.receiver_name || extracted.customer_name || form.getFieldValue('receiver_name'),
          receiver_phone: extracted.receiver_phone || extracted.customer_phone || form.getFieldValue('receiver_phone'),
          customer_address: extracted.delivery_address || form.getFieldValue('customer_address'),
          delivery_address: extracted.delivery_address || form.getFieldValue('delivery_address'),
          hawb_number: extracted.hawb_number || '',
          declaration_number: extracted.declaration_number || '',
          order_notes: `[AI OCR: ${file.name}] Mã tờ khai: ${extracted.declaration_number || 'N/A'} - HAWB: ${extracted.hawb_number || 'N/A'}`
        });

        // Tự động Geocode tọa độ địa chỉ giao hàng
        if (extracted.delivery_address) {
          const coords = getCoordsFromAddress(extracted.delivery_address, 'B');
          if (coords) setDeliveryCoords(coords);
        }

        // 3. Tự động điền các dòng hàng hóa
        if (Array.isArray(extracted.cargo_lines) && extracted.cargo_lines.length > 0) {
          const newCargos = extracted.cargo_lines.map((c, idx) => ({
            id: Date.now() + idx,
            cargo_name: c.cargo_name || 'Hàng hóa linh kiện',
            cargo_type: c.cargo_type || 'GENERAL',
            package_count: Number(c.package_count) || 1,
            package_unit: c.package_unit || 'Kiện',
            length_cm: Number(c.length_cm) || 60,
            width_cm: Number(c.width_cm) || 40,
            height_cm: Number(c.height_cm) || 40,
            weight: Number(c.actual_weight_kg) || 50
          }));
          setCargoItems(newCargos);
        }

        // 4. Gợi ý loại xe tối ưu
        if (extracted.recommended_vehicle) {
          form.setFieldsValue({
            vehicle_type_required: extracted.recommended_vehicle
          });
        }
      }
    } catch (scanErr) {
      clearInterval(progressInterval);
      console.error('AI Scan Document error:', scanErr);
      message.error(scanErr.message || 'Lỗi khi quét chứng từ với AI. Vui lòng thử lại hoặc nhập liệu thủ công!');
    } finally {
      setTimeout(() => {
        setIsAiScanning(false);
      }, 500);
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

  // Tính tổng hàng hóa theo chuẩn logistics (1 m3 = 200 kg)
  const totals = useMemo(() => {
    let totalCount = 0;
    let actualWeight = 0;
    let chargeableWeight = 0;

    cargoItems.forEach(it => {
      const cnt = Math.max(1, parseInt(it.package_count, 10) || 1);
      const unitW = Number(it.weight) || 0;
      const totalItemWeight = unitW * cnt;
      totalCount += cnt;
      actualWeight += totalItemWeight;

      if (it.cargo_type === 'BULK') {
        chargeableWeight += totalItemWeight;
      } else {
        const l = Number(it.length_cm) || 0;
        const width = Number(it.width_cm) || 0;
        const h = Number(it.height_cm) || 0;
        // Quy đổi thể tích chuẩn IATA / Vận tải đường bộ: (D x R x C cm) / 5000
        const itemVolWeight = ((l * width * h) / 5000) * cnt;
        chargeableWeight += Math.max(totalItemWeight, itemVolWeight);
      }
    });

    return {
      totalCount,
      actualWeight: actualWeight.toFixed(2),
      chargeableWeight: chargeableWeight.toFixed(2)
    };
  }, [cargoItems]);

  const watchedValues = Form.useWatch([], form);

  // Phân tích loại xe tối ưu theo tải trọng & kích thước hàng
  const vehicleRecommendation = useMemo(() => {
    return analyzeVehicleRecommendation({
      actualWeightKg: parseFloat(totals.actualWeight) || 0,
      chargeableWeightKg: parseFloat(totals.chargeableWeight) || 0,
      items: cargoItems,
      customerRequestedVehicle: watchedValues?.vehicle_type_required || 'TRUCK_2.5T'
    });
  }, [totals.actualWeight, totals.chargeableWeight, cargoItems, watchedValues?.vehicle_type_required]);

  // Tính lộ trình & cước phí
  const routeInfo = useMemo(() => {
    const pCoords = pickupCoords || getCoordsFromAddress(watchedValues?.pickup_address, 'A');
    const dCoords = deliveryCoords || getCoordsFromAddress(watchedValues?.delivery_address, 'B');
    if (!pCoords || !dCoords) {
      return { distanceKm: 0, durationMins: 0, isDefault: true };
    }
    return calculateRouteEstimate(pCoords.lat, pCoords.lng, dCoords.lat, dCoords.lng);
  }, [pickupCoords, deliveryCoords, watchedValues?.pickup_address, watchedValues?.delivery_address]);

  const hasBothLocations = Boolean(
    (pickupCoords || watchedValues?.pickup_address) && 
    (deliveryCoords || watchedValues?.delivery_address) && 
    routeInfo.distanceKm > 0
  );

  const estimatedPricing = useMemo(() => {
    if (!hasBothLocations) {
      return { baseTransportFee: 0, loadingFee: 0, customsFee: 0, totalRate: 0, isFixedRoute: false };
    }
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
    hasBothLocations,
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
    form.validateFields().then((fieldValues) => {
      for (let i = 0; i < cargoItems.length; i++) {
        const it = cargoItems[i];
        if (!it.cargo_name?.trim()) { message.error(`Vui lòng nhập tên hàng cho mặt hàng #${i + 1}`); return; }
        if (!it.cargo_type) { message.error(`Vui lòng chọn loại hàng cho mặt hàng #${i + 1}`); return; }
        if (!it.weight || Number(it.weight) <= 0) { message.error(`Vui lòng nhập trọng lượng hợp lệ (> 0 kg) cho mặt hàng #${i + 1}`); return; }
      }
      // Validate tải trọng: Tổng tải trọng thực tế hoặc tải trọng quy đổi tính cước không được vượt quá tải trọng xe
      const selectedVehicleKey = fieldValues.vehicle_type_required || 'TRUCK_2.5T';
      const vehicleSpec = getVehicleSpecByKey(selectedVehicleKey);
      const effectiveWeight = Math.max(parseFloat(totals.actualWeight) || 0, parseFloat(totals.chargeableWeight) || 0);

      if (vehicleSpec && effectiveWeight > vehicleSpec.maxPayloadKg) {
        const recommendedName = vehicleRecommendation?.recommendedSpec?.label || 'loại xe có tải trọng lớn hơn';
        message.error(
          `Lô hàng (${effectiveWeight.toLocaleString('vi-VN')} kg) vượt quá tải trọng tối đa của ${vehicleSpec.label} (${vehicleSpec.maxPayloadKg.toLocaleString('vi-VN')} kg). Vui lòng chọn ${recommendedName} phù hợp hơn!`
        );
        return;
      }

      // Validate kích thước lòng thùng & thể tích xếp hàng 3D: Không cho phép chọn loại xe quá nhỏ không thể xếp vừa toàn bộ kiện hàng
      if (vehicleRecommendation && vehicleRecommendation.status === 'UNDER_CAPACITY') {
        message.error(
          `Loại xe đã chọn (${vehicleRecommendation.customerSpec.label}) không đủ không gian chứa toàn bộ các kiện hàng. Vui lòng chọn ${vehicleRecommendation.recommendedSpec.label} để đảm bảo xếp đủ hàng!`
        );
        return;
      }

      // Kiểm tra bắt buộc đủ Địa chỉ cụ thể + Phường/Xã + Tỉnh/Thành phố chuẩn hành chính 2026
      if (pickupMode === 'CUSTOM' || shippingDirection === 'EXPORT') {
        const pickupParts = (fieldValues.pickup_address || '').split(',').map(s => s.trim()).filter(Boolean);
        if (pickupParts.length < 3 || (fieldValues.pickup_address || '').trim().length < 10) {
          message.error('Vui lòng nhập Địa chỉ cụ thể và chọn đầy đủ Phường/Xã, Tỉnh/Thành phố cho Điểm lấy hàng (A)!');
          return;
        }
      }

      if (deliveryMode === 'CUSTOM' || shippingDirection === 'IMPORT') {
        const deliveryParts = (fieldValues.delivery_address || '').split(',').map(s => s.trim()).filter(Boolean);
        if (deliveryParts.length < 3 || (fieldValues.delivery_address || '').trim().length < 10) {
          message.error('Vui lòng nhập Địa chỉ cụ thể và chọn đầy đủ Phường/Xã, Tỉnh/Thành phố cho Điểm giao hàng (B)!');
          return;
        }
      }

      const primaryItem = cargoItems[0] || {};
      const cargoDescription = cargoItems
        .map(it => `${it.cargo_name}${it.package_count ? ` (${it.package_count} ${it.package_unit || 'kiện'})` : ''}`)
        .join(', ');

      let currentDispatcherId = null;
      try {
        const cached = typeof window !== 'undefined' ? window.sessionStorage.getItem('nexlog_cached_user') : null;
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && parsed.id && !isNaN(Number(parsed.id))) {
            currentDispatcherId = Number(parsed.id);
          }
        }
      } catch (e) {
        // ignore
      }

      onSubmit({
        ...fieldValues,
        dispatcher_id: currentDispatcherId,
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
        request_split_trucks: Boolean(fieldValues.request_split_trucks),
        split_details: fieldValues.request_split_trucks ? {
          split_count: fieldValues.split_truck_count || 2,
          vehicle_target: fieldValues.split_target_vehicle || 'TRUCK_2.5T',
          vehicle_target_label: getVehicleSpecByKey(fieldValues.split_target_vehicle || 'TRUCK_2.5T').label,
          reason: fieldValues.split_reason || 'Đường kho hẹp/cấm xe tải lớn'
        } : null,
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

      {/* AI DOCUMENT AGENT BANNER & OCR TRIGGER */}
      <div className="mb-4 p-3.5 bg-gradient-to-r from-indigo-50 via-purple-50 to-blue-50 border border-indigo-200/70 rounded-xl shadow-xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-sm shrink-0">
              <Sparkles size={18} className="animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-gray-800 text-sm">AI Document Agent</span>
                <span className="text-[11px] px-2 py-0.5 bg-indigo-100 text-indigo-700 font-semibold rounded-full">
                  OCR 15s
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Tự động bóc tách Tờ khai hải quan (VNACCS) / Vận đơn HAWB để điền form tự động
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <input
              type="file"
              ref={aiFileInputRef}
              className="hidden"
              accept=".pdf,image/png,image/jpeg,image/jpg"
              onChange={handleAiFileSelect}
            />
            <button
              type="button"
              disabled={isAiScanning}
              onClick={() => aiFileInputRef.current?.click()}
              className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg shadow-sm transition-all ${
                isAiScanning
                  ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white cursor-pointer'
              }`}
            >
              <UploadCloud size={15} />
              {isAiScanning ? 'Đang phân tích...' : 'Tải lên Tờ khai / HAWB để AI đọc'}
            </button>
          </div>
        </div>

        {/* Thanh tiến trình khi AI đang OCR */}
        {isAiScanning && (
          <div className="mt-3 pt-2.5 border-t border-indigo-100/80">
            <div className="flex justify-between items-center text-xs mb-1">
              <span className="text-indigo-700 font-medium flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-full bg-indigo-600 animate-ping" />
                Gemini Vision đang đọc cấu trúc chứng từ và trích xuất hàng hóa...
              </span>
              <span className="font-bold text-indigo-600">{aiScanProgress}%</span>
            </div>
            <Progress 
              percent={aiScanProgress} 
              showInfo={false} 
              strokeColor={{ '0%': '#7367f0', '100%': '#6366f1' }}
              size="small" 
            />
          </div>
        )}

        {/* Kết quả scan thành công */}
        {aiScanResult && !isAiScanning && (
          <div className="mt-2.5 pt-2 border-t border-indigo-100 flex items-center justify-between text-xs text-emerald-700 bg-emerald-50/60 px-3 py-1.5 rounded-md">
            <div className="flex items-center gap-1.5 font-medium">
              <CheckCircle2 size={14} className="text-emerald-600" />
              <span>Đã tự động điền form: {aiScanResult.customer_name || 'Doanh nghiệp'} ({aiScanResult.cargo_lines?.length || 1} dòng hàng)</span>
            </div>
            <span className="text-[11px] text-gray-400">Độ tin cậy: {Math.round((aiScanResult.confidence_score || 0.95) * 100)}%</span>
          </div>
        )}
      </div>

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
        <OrderFormCustomerSection
          form={form}
          shippingDirection={shippingDirection}
          setPickupCoords={setPickupCoords}
          setDeliveryCoords={setDeliveryCoords}
        />

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
          totals={totals}
          vehicleRecommendation={vehicleRecommendation}
          form={form}
          watchedValues={watchedValues}
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
