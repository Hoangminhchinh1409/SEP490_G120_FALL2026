const BASE_URL = 'http://127.0.0.1:9999/api';

async function login(username, password) {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: username, password })
  });
  const data = await res.json();
  if (res.status !== 200) throw new Error(`Login failed for ${username}: ${JSON.stringify(data)}`);
  const rawCookie = res.headers.get('set-cookie') || '';
  const tokenMatch = rawCookie.match(/token=([^;]+)/);
  const token = tokenMatch ? tokenMatch[1] : null;
  return { user: data.user, token, cookie: `token=${token}` };
}

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (options.token) {
    headers['Authorization'] = `Bearer ${options.token}`;
    headers['Cookie'] = `token=${options.token}`;
  }
  const res = await fetch(url, { ...options, headers });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, data: json, headers: res.headers };
}

async function runE2E() {
  console.log('=== BẮT ĐẦU TEST E2E FULL 6 GIAI ĐOẠN NGHIỆP VỤ ===\n');

  // 1. Login các actors
  const dispatcherAuth = await login('vuxtrung', '123456');
  const driverAuth = await login('driver01', '123456');
  const managerAuth = await login('manager01', '123456');
  const adminAuth = await login('admin', '123456');
  console.log('✓ Đăng nhập thành công 4 Roles: Dispatcher, Driver, Manager, Admin\n');

  // GIAI ĐOẠN 1: TẠO ĐƠN TỪ HOMEPAGE / CONSULTATION
  console.log('--- [GIAI ĐOẠN 1]: Khách tạo đơn Web & Chốt Hợp đồng ---');
  const consultPayload = {
    customer_name: 'Công ty TNHH Sản Xuất E2E Test',
    contact_phone: '0988776655',
    contact_email: 'khachhang_test_e2e@nexlog.vn',
    service_flow: 'IMPORT',
    pickup_address: 'Kho ALS Nội Bài, Sóc Sơn, Hà Nội',
    delivery_address: 'KCN Quế Võ 1, Phường Nam Sơn, TP Bắc Ninh',
    cargo_type: 'Hàng điện tử & Linh kiện',
    package_count: 8,
    package_unit: 'Kiện',
    actual_weight_kg: 850,
    length_cm: 120,
    width_cm: 80,
    height_cm: 100,
    user_note: 'Đơn hàng test tự động hóa full luồng E2E'
  };

  const createRes = await request('/orders/consultation', {
    method: 'POST',
    body: JSON.stringify(consultPayload)
  });
  console.log('1.1 Tạo đơn tư vấn:', createRes.status, createRes.data?.message || createRes.data);
  const order = createRes.data?.order;
  if (!order) throw new Error('Không tạo được order: ' + JSON.stringify(createRes.data));
  const orderId = order.id;
  const trackingToken = order.tracking_token;
  console.log(`   -> Order ID: ${orderId}, Code: ${order.order_code}, Token: ${trackingToken}`);

  // 1.2 Khách view đơn qua Token
  const viewRes = await request(`/orders/customer-view/${trackingToken}`);
  console.log('1.2 Khách xem đơn bằng Token:', viewRes.status, 'Stage:', viewRes.data?.web_workflow?.stage || viewRes.data?.status);

  // 1.3 Dispatcher chốt giá & phương án xe
  const priceRes = await request(`/orders/${orderId}/price`, {
    method: 'PATCH',
    token: dispatcherAuth.token,
    body: JSON.stringify({
      agreed_price: 2500000,
      adjustment_reason: 'Tư vấn xe 2.5 tấn phù hợp kích thước 8 kiện',
      proposed_vehicle_type: '2.5T',
      vehicle_analysis_note: 'Hàng 850kg xếp 8 kiện gọn gàng trong thùng 4.3m'
    })
  });
  console.log('1.3 Dispatcher chốt giá & loại xe:', priceRes.status, priceRes.data?.message || priceRes.data);

  // 1.4 Khách đồng ý chốt giá
  const agreeRes = await request(`/orders/customer-agree/${trackingToken}`, {
    method: 'POST'
  });
  console.log('1.4 Khách chốt giá qua token:', agreeRes.status, agreeRes.data?.message || agreeRes.data);

  // 1.5 Khách upload tài liệu chứng từ
  const uploadDocsRes = await request(`/orders/customer-upload-docs/${trackingToken}`, {
    method: 'POST',
    body: JSON.stringify({
      documents: [
        { key: 'doc-basic-1', name: 'Tờ khai hải quan điện tử', file: 'To_khai_VNACCS.pdf', status: 'WAITING_APPROVAL' },
        { key: 'doc-basic-2', name: 'Hóa đơn thương mại (Invoice)', file: 'Commercial_Invoice.pdf', status: 'WAITING_APPROVAL' },
        { key: 'doc-basic-3', name: 'Phiếu đóng gói hàng hóa (Packing List)', file: 'Packing_List.pdf', status: 'WAITING_APPROVAL' },
        { key: 'doc-basic-4', name: 'Vận đơn hàng không (AWB)', file: 'HAWB_NEXLOG.pdf', status: 'WAITING_APPROVAL' }
      ]
    })
  });
  console.log('1.5 Khách tải lên 4 chứng từ:', uploadDocsRes.status, uploadDocsRes.data?.message || uploadDocsRes.data);

  // 1.6 Dispatcher duyệt toàn bộ chứng từ
  const approveDocsRes = await request(`/orders/${orderId}/approve-web-docs`, {
    method: 'POST',
    token: dispatcherAuth.token,
    body: JSON.stringify({
      documents: [
        { key: 'doc-basic-1', name: 'Tờ khai hải quan điện tử', file: 'To_khai_VNACCS.pdf', status: 'APPROVED' },
        { key: 'doc-basic-2', name: 'Hóa đơn thương mại (Invoice)', file: 'Commercial_Invoice.pdf', status: 'APPROVED' },
        { key: 'doc-basic-3', name: 'Phiếu đóng gói hàng hóa (Packing List)', file: 'Packing_List.pdf', status: 'APPROVED' },
        { key: 'doc-basic-4', name: 'Vận đơn hàng không (AWB)', file: 'HAWB_NEXLOG.pdf', status: 'APPROVED' }
      ]
    })
  });
  console.log('1.6 Dispatcher duyệt toàn bộ chứng từ:', approveDocsRes.status, approveDocsRes.data?.message || approveDocsRes.data);

  // 1.7 Dispatcher gửi hợp đồng mẫu & Khách ký HĐ
  const sendContractRes = await request(`/orders/${orderId}/send-contract`, {
    method: 'POST',
    token: dispatcherAuth.token,
    body: JSON.stringify({
      custom_terms: ['Bảo hiểm nguyên seal 100%', 'Thời gian giao tối đa 4 giờ sau khi lấy hàng'],
      contract_details: { price_amount: 2500000, truck_model: 'Xe tải 2.5 tấn' }
    })
  });
  console.log('1.7 Dispatcher gửi hợp đồng:', sendContractRes.status, sendContractRes.data?.message || sendContractRes.data);

  // 1.8 Ký hợp đồng vận tải (tải lên file HĐ có chữ ký)
  const signContractRes = await request(`/orders/${orderId}/contract-file`, {
    method: 'POST',
    token: dispatcherAuth.token,
    body: JSON.stringify({
      file_name: 'Hop_dong_van_tai_NEXLOG_signed.pdf',
      file_data: 'data:application/pdf;base64,JVBERi0xLjQK...',
      file_size: '450 KB'
    })
  });
  console.log('1.8 Tải lên hợp đồng đã ký & kích hoạt đơn:', signContractRes.status, signContractRes.data?.message || signContractRes.data);

  console.log('\n--- [GIAI ĐOẠN 2]: Dispatcher Lập Chuyến & Gán Xe / Tài Xế ---');
  // Lấy xe tải và tài xế
  const fleetRes = await request('/dispatcher/fleet/trucks', { token: dispatcherAuth.token });
  const driversRes = await request('/dispatcher/fleet/drivers', { token: dispatcherAuth.token });
  const trucksList = fleetRes.data?.trucks || [];
  const driversList = driversRes.data?.drivers || [];
  const truck = trucksList.find(t => t.status === 'Available' || t.status === 'AVAILABLE') || trucksList[0];
  const driver = driversList.find(d => d.name === 'Nguyễn Văn Lái' || d.user_id === 11) || driversList[0];
  console.log(`   -> Chọn xe: ${truck?.plate_number || truck?.plate} (${truck?.model}), Tài xế ID ${driver?.id}: ${driver?.name || 'Driver'}`);

  // Tạo chuyến qua API chuẩn /dispatcher/trips
  const createTripPayload = {
    order_id: orderId,
    order_code: order.order_code,
    truck_id: truck?.id || 26,
    truck_plate: truck?.plate_number || truck?.plate || '29C-456.78',
    driver_id: driver?.id || 6,
    driver_name: driver?.name || 'Nguyễn Văn Lái',
    planned_distance: 42.5,
    planned_duration: 65,
    allocation_type: 'INTERNAL',
    stops: [
      {
        type: 'PICKUP',
        name: 'Kho ALS Nội Bài, Sóc Sơn, Hà Nội',
        address: 'Kho ALS Nội Bài, Sóc Sơn, Hà Nội',
        coords: { lat: 21.2212, lng: 105.8072 }
      },
      {
        type: 'DROPOFF',
        name: 'KCN Quế Võ 1, Phường Nam Sơn, TP Bắc Ninh',
        address: 'KCN Quế Võ 1, Phường Nam Sơn, TP Bắc Ninh',
        coords: { lat: 21.1782, lng: 106.0712 }
      }
    ]
  };
  const tripRes = await request('/dispatcher/trips', {
    method: 'POST',
    token: dispatcherAuth.token,
    body: JSON.stringify(createTripPayload)
  });
  console.log('2.1 Dispatcher lập chuyến qua /dispatcher/trips:', tripRes.status, tripRes.data?.message || tripRes.data);
  const trip = tripRes.data?.trip;
  const tripRawId = trip?.raw_id;
  const tripCode = trip?.id || trip?.trip_code;
  console.log(`   -> Trip Code: ${tripCode}, Raw DB ID: ${tripRawId}`);

  if (!tripRawId) {
    throw new Error('Không tạo được chuyến: ' + JSON.stringify(tripRes.data));
  }

  console.log('\n--- [GIAI ĐOẠN 3]: Driver PWA Thực Thi Chuyến Đi (4 Bước Điểm Dừng) ---');
  // 3.1 Driver accept chuyến
  const acceptRes = await request(`/driver/trips/${tripRawId}/accept`, {
    method: 'PATCH',
    token: driverAuth.token
  });
  console.log('3.1 Driver nhận chuyến:', acceptRes.status, acceptRes.data?.message || acceptRes.data);

  // Lấy chi tiết chuyến xe để biết danh sách các điểm dừng (stops)
  const tripDetailRes = await request(`/driver/trips/${tripRawId}`, {
    token: driverAuth.token
  });
  const tripStops = tripDetailRes.data?.trip?.trip_stops || tripDetailRes.data?.trip?.stops || [];
  console.log(`3.2 Danh sách điểm dừng (${tripStops.length} stops):`);
  for (const s of tripStops) {
    console.log(`    - Stop ${s.id}: ${s.stop_type || s.type} tại ${s.address || s.location?.address || s.location?.name}`);
  }

  const pickupStop = tripStops.find(s => (s.stop_type || s.type || '').toUpperCase() === 'PICKUP') || tripStops[0];
  const deliveryStop = tripStops.find(s => ['DROPOFF', 'DROP-OFF', 'DELIVERY'].includes((s.stop_type || s.type || '').toUpperCase())) || tripStops[tripStops.length - 1];

  if (pickupStop) {
    console.log('\n--- Thực thi tại Điểm Lấy Hàng (Stop Pickup): ---');
    // Step 1: Arrive
    const arrRes = await request(`/driver/trips/${tripRawId}/stops/${pickupStop.id}/arrive`, {
      method: 'POST',
      token: driverAuth.token,
      body: JSON.stringify({ latitude: 21.2212, longitude: 105.8072 })
    });
    console.log('3.3 Bước 1: Đến điểm lấy hàng (Arrive):', arrRes.status, arrRes.data?.message || arrRes.data);

    // Step 2: Start Loading
    const loadStartRes = await request(`/driver/trips/${tripRawId}/stops/${pickupStop.id}/event`, {
      method: 'POST',
      token: driverAuth.token,
      body: JSON.stringify({ event_type: 'LOADING_STARTED', latitude: 21.2212, longitude: 105.8072 })
    });
    console.log('3.4 Bước 2: Bắt đầu bốc hàng (Loading Started):', loadStartRes.status, loadStartRes.data?.message || loadStartRes.data);

    // Step 3: Done Loading
    const loadDoneRes = await request(`/driver/trips/${tripRawId}/stops/${pickupStop.id}/event`, {
      method: 'POST',
      token: driverAuth.token,
      body: JSON.stringify({ event_type: 'LOADING_COMPLETED', latitude: 21.2212, longitude: 105.8072 })
    });
    console.log('3.5 Bước 3: Hoàn thành bốc hàng (Loading Completed):', loadDoneRes.status, loadDoneRes.data?.message || loadDoneRes.data);

    // Step 4: Record Pickup (Chụp seal, chụp ảnh bốc hàng, số lượng và khối lượng hợp lệ) & Left Stop
    const pickupRecordRes = await request(`/driver/trips/${tripRawId}/stops/${pickupStop.id}/pickup`, {
      method: 'POST',
      token: driverAuth.token,
      body: JSON.stringify({
        seal_number: 'ALS-SEAL-88992',
        seal_photo_url: 'https://cloudinary.com/nexlog/seal_88992.jpg',
        cargo_photo_url: 'https://cloudinary.com/nexlog/cargo_pickup.jpg',
        loaded_packages: 8,
        loaded_weight: 850,
        latitude: 21.2212,
        longitude: 105.8072
      })
    });
    console.log('3.6 Bước 4: Chụp seal, bàn giao & Rời kho lấy hàng (Picked Up -> In Transit):', pickupRecordRes.status, pickupRecordRes.data?.message || pickupRecordRes.data);
  }

  console.log('\n--- [GIAI ĐOẠN 4]: Báo Cáo Sự Cố & Đổi Xe / Xử Lý Sự Cố Khẩn Cấp ---');
  // 4.1 Tài xế báo hỏng lốp / sự cố xe giữa đường
  const incidentReportRes = await request('/driver/incidents', {
    method: 'POST',
    token: driverAuth.token,
    body: JSON.stringify({
      trip_id: tripRawId,
      incident_type: 'VEHICLE_BREAKDOWN',
      severity: 'HIGH',
      description: 'Xe nổ lốp trước tại nút giao Quốc lộ 18, không tự khắc phục được',
      latitude: 21.1895,
      longitude: 105.9521,
      photo_url: 'https://cloudinary.com/nexlog/tire_puncture.jpg'
    })
  });
  console.log('4.1 Driver gửi báo cáo sự cố nổ lốp:', incidentReportRes.status, incidentReportRes.data?.message || incidentReportRes.data);
  const incident = incidentReportRes.data?.incident;
  const incidentId = incident?.id;

  if (incidentId) {
    // 4.2 Dispatcher / Manager xử lý sự cố (xác định bên có lỗi & phương án)
    const resolveIncRes = await request(`/manager/incidents/${incidentId}/resolve`, {
      method: 'POST',
      token: managerAuth.token,
      body: JSON.stringify({
        fault: 'Bên thứ ba (đinh tặc trên đường cao tốc)',
        solution: 'Đã cử đội cứu hộ lốp lưu động đến thay bánh sơ cua trong 25 phút',
        compensation_amount: 0,
        resolution_note: 'Đã thay lốp sơ cua, xe tiếp tục lộ trình bình thường'
      })
    });
    console.log('4.2 Manager giải quyết sự cố:', resolveIncRes.status, resolveIncRes.data?.message || resolveIncRes.data);
  }

  console.log('\n--- [GIAI ĐOẠN 5]: Thực thi tại Điểm Giao Hàng & Đóng Đơn (Delivered -> Completed) ---');
  if (deliveryStop) {
    // Step 1: Arrive Delivery
    const arrDelRes = await request(`/driver/trips/${tripRawId}/stops/${deliveryStop.id}/arrive`, {
      method: 'POST',
      token: driverAuth.token,
      body: JSON.stringify({ latitude: 21.1782, longitude: 106.0712 })
    });
    console.log('5.1 Đến điểm trả hàng (Arrive Delivery):', arrDelRes.status, arrDelRes.data?.message || arrDelRes.data);

    // Step 2: Unload Started
    const unloadStartRes = await request(`/driver/trips/${tripRawId}/stops/${deliveryStop.id}/event`, {
      method: 'POST',
      token: driverAuth.token,
      body: JSON.stringify({ event_type: 'UNLOADING_STARTED', latitude: 21.1782, longitude: 106.0712 })
    });
    console.log('5.2 Bắt đầu dỡ hàng:', unloadStartRes.status, unloadStartRes.data?.message || unloadStartRes.data);

    // Step 3: Unload Completed
    const unloadDoneRes = await request(`/driver/trips/${tripRawId}/stops/${deliveryStop.id}/event`, {
      method: 'POST',
      token: driverAuth.token,
      body: JSON.stringify({ event_type: 'UNLOADING_COMPLETED', latitude: 21.1782, longitude: 106.0712 })
    });
    console.log('5.3 Hoàn tất dỡ hàng:', unloadDoneRes.status, unloadDoneRes.data?.message || unloadDoneRes.data);

    // Step 4: Record Delivery (Chụp ảnh cắt seal + ảnh dỡ hàng + POD biên bản giao nhận có chữ ký)
    const delRecordRes = await request(`/driver/trips/${tripRawId}/stops/${deliveryStop.id}/delivery`, {
      method: 'POST',
      token: driverAuth.token,
      body: JSON.stringify({
        cut_seal_photo_url: 'https://cloudinary.com/nexlog/cut_seal_photo.jpg',
        unloaded_cargo_photo_url: 'https://cloudinary.com/nexlog/unloaded_cargo.jpg',
        pod_photo_url: 'https://cloudinary.com/nexlog/signed_pod_evidence.jpg',
        receiver_name: 'Nguyễn Văn Nhận',
        receiver_phone: '0988776655',
        notes: 'Giao hàng đủ 8 kiện nguyên đai nguyên kiện',
        latitude: 21.1782,
        longitude: 106.0712
      })
    });
    console.log('5.4 Chụp ảnh cắt seal, ảnh dỡ hàng & Tải POD có chữ ký (Giao hoàn tất):', delRecordRes.status, delRecordRes.data?.message || delRecordRes.data);
  }

  // 5.5 Dispatcher hoàn tất đóng chuyến
  const closeTripRes = await request(`/dispatcher/trips/${tripRawId}/status`, {
    method: 'PATCH',
    token: dispatcherAuth.token,
    body: JSON.stringify({ status: 'COMPLETED' })
  });
  console.log('5.5 Dispatcher hoàn tất đóng chuyến xe:', closeTripRes.status, closeTripRes.data?.message || closeTripRes.data);

  console.log('\n--- [GIAI ĐOẠN 6]: Nhận Hợp Đồng Bản Cứng & Xuất Hóa Đơn Kế Toán ---');
  // 6.1 Dispatcher xác nhận đã nhận bản cứng HĐ gốc qua bưu điện (với mã bưu điện chuẩn VNPost)
  const hardcopyRes = await request(`/orders/${orderId}/hardcopy-contract`, {
    method: 'PATCH',
    token: dispatcherAuth.token,
    body: JSON.stringify({
      postal_code: 'EM123456789VN',
      received_notes: 'Đã nhận bản cứng 2 liên có đóng dấu đỏ tròn công ty khách'
    })
  });
  console.log('6.1 Xác nhận nhận bản cứng HĐ gốc qua bưu điện:', hardcopyRes.status, hardcopyRes.data?.message || hardcopyRes.data);

  // 6.2 Xuất hóa đơn GTGT điện tử & bàn giao Kế toán thu nợ
  const invoiceRes = await request(`/orders/${orderId}/issue-invoice`, {
    method: 'PATCH',
    token: dispatcherAuth.token,
    body: JSON.stringify({
      invoice_number: 'INV-2026-00892',
      vat_rate: 8,
      tax_code: '0108899221',
      buyer_company: 'Công ty TNHH Sản Xuất E2E Test'
    })
  });
  console.log('6.2 Xuất hóa đơn điện tử cho kế toán:', invoiceRes.status, invoiceRes.data?.message || invoiceRes.data);

  // 6.3 Dispatcher đóng đơn hàng (CLOSED)
  const closeOrderRes = await request(`/orders/${orderId}/close`, {
    method: 'POST',
    token: dispatcherAuth.token,
    body: JSON.stringify({ note: 'Đơn hàng hoàn tất trọn vẹn luồng E2E' })
  });
  console.log('6.3 Đóng đơn hàng dứt điểm (CLOSED):', closeOrderRes.status, closeOrderRes.data?.message || closeOrderRes.data);

  console.log('\n=== KẾT THÚC TEST E2E TOÀN BỘ 6 GIAI ĐOẠN THÀNH CÔNG 100% ===');
}

runE2E().catch(err => {
  console.error('\n❌ TEST E2E GẶP LỖI:', err);
  process.exit(1);
});
