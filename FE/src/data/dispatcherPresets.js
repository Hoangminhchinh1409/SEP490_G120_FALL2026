// Dữ liệu mẫu chuẩn hóa trích xuất từ adteck HNAE25090222.json và Thư mục Hồ sơ Lô 2
export const SAMPLE_ORDER_PRESETS = [
  {
    key: 'adtek_preset',
    name: 'Mẫu 1: Lô Hàng Công Ty ADTEK (BBGNH HNAE25090222)',
    description: 'Bên giao: ADTEK Bắc Ninh -> Bên nhận: Apex Nội Bài. 18 Pallet linh kiện viễn thông/cáp quang',
    data: {
      customer_name: 'ADTEK (VIET NAM) COMPANY LIMITED',
      customer_tax_code: '2300987654',
      customer_phone: '0977887918',
      customer_email: 'logistics@adtek.com.vn',
      pickup_address: 'Đường TS8, KCN Tiên Sơn, Phường Đồng Nguyên, TP. Từ Sơn, Tỉnh Bắc Ninh',
      delivery_address: 'Tầng 22, Tòa nhà Leadvisors, 643 Phạm Văn Đồng, P. Cổ Nhuế 1, Q. Bắc Từ Liêm, Hà Nội (Kho Apex - Ga Nội Bài NCTS)',
      hawb_code: 'HNAE25090222',
      factory_name: 'ADTEK FACTORY TIEN SON',
      cargo_type: 'VALUABLE',
      package_count: 18,
      package_unit: 'Pallet',
      length_cm: 120,
      width_cm: 100,
      height_cm: 160,
      weight_kg: 2850,
      is_stackable: true,
      agreed_price: 6500000,
      extra_fees_surcharge: 450000, // Phí lưu xe/chờ bốc dỡ phát sinh (doanh thu ALS, chịu thuế VAT)
      extra_fees_collection: 1200000, // Phí hạ bãi / nâng hạ tại cảng thu hộ ADTEK (cô lập VAT)
      order_notes: 'LƯU Ý: OP tại sân bay trước khi nhận hàng phải kiểm tra và đảm bảo thùng xe vẫn đang được niêm phong bằng chì và khóa Pad Lock. Chụp ảnh đầy đủ (SOP). Xe tải dự kiến: 29H-995.72, lái xe: Hồ Chí Học (008093002529) / Tạ Đức Hải (0977887918)',
      required_documents: ['CUSTOMS_DECLARATION', 'DELIVERY_ORDER', 'PACKING_LIST', 'COMMERCIAL_INVOICE'],
      truck_assigned_preview: '29H-995.72 (Xe Thaco ALS)',
      driver_assigned_preview: 'Hồ Chí Học & Tạ Đức Hải (2 tài xế luân chuyển)'
    }
  },
  {
    key: 'lo2_preset',
    name: 'Mẫu 2: Lô Hàng Âm Thanh Ánh Sáng (Lô 2 - Tờ Khai HQ 108187779340)',
    description: 'Hàng nhập khẩu Sound & Light: Tờ khai HQ 108187779340, Bill of Lading, CI/PL Sound Light, HĐMB SLVN010426, Bankslip',
    data: {
      customer_name: 'CÔNG TY TNHH ÂM THANH ÁNH SÁNG SLVN (SOUND LIGHT VN)',
      customer_tax_code: '01082051578',
      customer_phone: '0903456789',
      customer_email: 'import@soundlight.vn',
      pickup_address: 'Kho ALS Cảng Hàng Không Quốc Tế Nội Bài, Sóc Sơn, Hà Nội',
      delivery_address: 'Cụm Công nghiệp Lai Xá, Xã Kim Chung, Huyện Hoài Đức, Hà Nội',
      hawb_code: 'SLVN-2026-HQ7N',
      factory_name: 'KHO NGOẠI QUAN NỘI BÀI',
      cargo_type: 'FRAGILE',
      package_count: 42,
      package_unit: 'Kiện thùng gỗ (Cartons/Crates)',
      length_cm: 200,
      width_cm: 120,
      height_cm: 150,
      weight_kg: 1850,
      is_stackable: false,
      agreed_price: 5200000,
      extra_fees_surcharge: 300000, // Phí bốc xếp tăng ca
      extra_fees_collection: 2450000, // Chi phí nộp thuế HQ & Lệ phí hải quan thu hộ theo Bankslip YEL 29952
      order_notes: 'Hàng thiết bị âm thanh sân khấu điện tử có giá trị cao, dễ vỡ. Yêu cầu chằng buộc cẩn thận, không xếp chồng. Kiểm tra đối chiếu số Tờ khai 108187779340 và Ủy nhiệm chi nộp thuế trước khi xuất kho.',
      required_documents: ['CUSTOMS_DECLARATION', 'DELIVERY_ORDER', 'COMMERCIAL_INVOICE', 'PACKING_LIST', 'SALES_CONTRACT', 'BANK_SLIP'],
      truck_assigned_preview: '29H-767.99 (Thaco 2.5T)',
      driver_assigned_preview: 'Nguyễn Văn Đạt (1 tài xế)'
    }
  }
];

export const DOCUMENT_TYPES = [
  { key: 'CUSTOMS_DECLARATION', label: 'Tờ khai Hải quan thông quan (ToKhaiHQ)', description: 'Tờ khai điện tử phân luồng Xanh/Vàng/Đỏ (Mẫu Lô 2: 108187779340)', requiredDefault: true },
  { key: 'DELIVERY_ORDER', label: 'Lệnh giao hàng (D/O) & Vận đơn (Bill of Lading)', description: 'Vận đơn hàng không / đường biển cấp phát hàng (Mẫu Bill.pdf)', requiredDefault: true },
  { key: 'COMMERCIAL_INVOICE', label: 'Hóa đơn thương mại (Commercial Invoice - CI)', description: 'Chứng từ giá trị hàng hóa nhập khẩu (Mẫu CI PL SOUND LIGHT.pdf)', requiredDefault: true },
  { key: 'PACKING_LIST', label: 'Phiếu đóng gói hàng hóa (Packing List - PL)', description: 'Quy cách kiện, số pallet, kích thước chi tiết (Mẫu Packing List)', requiredDefault: true },
  { key: 'SALES_CONTRACT', label: 'Hợp đồng mua bán / Ngoại thương (Sales Contract)', description: 'Hợp đồng cơ sở pháp lý giao dịch (Mẫu HĐMB SLVN TT.pdf / SC SLVN010426.doc)', requiredDefault: false },
  { key: 'BANK_SLIP', label: 'Giấy nộp tiền thuế / Ủy nhiệm chi (Bankslip)', description: 'Chứng từ nộp thuế NK/VAT hoặc phí hải quan (Mẫu Bankslip YEL 29952.jpg)', requiredDefault: false },
  { key: 'BBGNH', label: 'Biên bản bàn giao nhận hàng (Proof of Cargo Receipt)', description: 'Biên bản hiện trường giao nhận có ký nhận nhà máy & xe (Mẫu Adtek BBGNH)', requiredDefault: false }
];
