require('dotenv').config();
const supabase = require('../config/supabase');

async function seedTestIncidents() {
  console.log('🚀 Bắt đầu tạo luồng dữ liệu mẫu cho cụm màn hình Xử lý sự cố...');

  // Danh sách ảnh mẫu Cloudinary / CDN logistics chuẩn nét
  const photosAccident = [
    'https://images.unsplash.com/photo-1543465077-db45d34b88a5?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1590362891991-f776e747a588?auto=format&fit=crop&w=800&q=80'
  ];

  const photosDamagedCargo = [
    'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1578575437130-527eed3abbec?auto=format&fit=crop&w=800&q=80'
  ];

  const photosCargoHeld = [
    'https://images.unsplash.com/photo-1586528116493-a029325540fa?auto=format&fit=crop&w=800&q=80'
  ];

  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
  const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

  const testIncidents = [
    // 1. Sự cố Tai nạn giao thông (TRAFFIC_ACCIDENT) - Đang chờ Quản lý xử lý (ESCALATED)
    {
      trip_id: 9,
      type: 'TRAFFIC_ACCIDENT',
      description: 'Xe tải 29C-246.80 va chạm nhẹ với xe container tại Km 18 cao tốc Nội Bài - Bắc Ninh. Vỡ cụm đèn pha và móp cản trước, thùng xe và tem niêm phong vẫn nguyên vẹn.',
      photos: photosAccident,
      status: 'ESCALATED',
      reported_by: 15, // Tài xế Nguyễn Tấn Tài
      reported_time: twoHoursAgo,
      escalated_by: 1,  // Dispatcher1
      escalated_time: oneHourAgo,
      escalation_reason: 'Sự cố tai nạn trên cao tốc thuộc thẩm quyền Quản lý (BR-16). Điều phối đã điều xe thay thế 29H-767.99 đến sang tải để đảm bảo tiến độ, chuyển Quản lý phán quyết trách nhiệm lỗi và chi phí sửa chữa.',
      created_at: twoHoursAgo,
      updated_at: oneHourAgo
    },

    // 2. Sự cố Hàng hư hỏng / mất (DAMAGED_LOST_CARGO) - Đang chờ Quản lý xử lý (ESCALATED)
    {
      trip_id: 12,
      type: 'DAMAGED_LOST_CARGO',
      description: 'Tại điểm dỡ hàng kho ALS, phát hiện 3 kiện hàng linh kiện điện tử bị rách bao bì carton và móp góc do dằn xóc mạnh. Khách hàng đã lập biên bản bất thường.',
      photos: photosDamagedCargo,
      status: 'ESCALATED',
      reported_by: 16, // Tài xế Đỗ Duy Hải
      reported_time: oneHourAgo,
      escalated_by: 21, // Dispatcher Chi
      escalated_time: now.toISOString(),
      escalation_reason: 'Khách hàng yêu cầu bồi thường 3 kiện hàng linh kiện hư hỏng. Chuyển Quản lý thẩm tra dữ liệu lộ trình GPS, xác minh lỗi thuộc về lái xe ALS hay quy cách đóng gói của khách hàng để duyệt mức bồi thường.',
      created_at: oneHourAgo,
      updated_at: now.toISOString()
    },

    // 3. Sự cố Hàng bị giữ bởi cơ quan chức năng (CARGO_HELD) - Đang chờ Quản lý xử lý (ESCALATED)
    {
      trip_id: 13,
      type: 'CARGO_HELD',
      description: 'Đội QLTT và CSGT kiểm tra tải trọng và yêu cầu xuất trình tờ khai hải quan bản chính có dấu đỏ tại trạm cân QL18. Xe đang tạm thời bị giữ tại bãi kiểm tra.',
      photos: photosCargoHeld,
      status: 'ESCALATED',
      reported_by: 15,
      reported_time: yesterday,
      escalated_by: 1,
      escalated_time: yesterday,
      escalation_reason: 'Lô hàng có nguy cơ chậm bàn giao hơn 4 giờ. Cần Quản lý phê duyệt cử nhân viên chứng từ mang hồ sơ gốc ra làm việc trực tiếp với Đội QLTT.',
      created_at: yesterday,
      updated_at: yesterday
    },

    // 4. Sự cố Hàng hư hỏng đã được Quản lý phán quyết & đóng (RESOLVED)
    {
      trip_id: 9,
      type: 'DAMAGED_LOST_CARGO',
      description: 'Kiện hàng vải dệt cao cấp bị ẩm mốc một phần góc do nước mưa thấm qua khe cửa thùng xe.',
      photos: photosDamagedCargo,
      status: 'RESOLVED',
      fault: 'COMPANY',
      reported_by: 16,
      reported_time: yesterday,
      escalated_by: 1,
      escalated_time: yesterday,
      escalation_reason: 'Hàng vải của khách hàng công ty Minh Phát bị ướt, cần Quản lý duyệt bồi thường.',
      resolved_by: 20, // Manager Sơn
      resolved_time: yesterday,
      resolution_note: 'Quản lý đã thẩm tra hiện trường: Roăng cao su cửa sau xe bị lão hóa làm rò nước. Lỗi thuộc về bảo dưỡng kỹ thuật của Công ty (ALS). Đồng ý đền bù thiệt hại 12.000.000 VNĐ cho khách theo hợp đồng.',
      created_at: yesterday,
      updated_at: yesterday
    },

    // 5. Sự cố Hỏng xe thông thường đã được Dispatcher xử lý tại chỗ (RESOLVED)
    {
      trip_id: 10,
      type: 'ENGINE_BREAKDOWN',
      description: 'Xe nổ lốp phụ tại nút giao Sóc Sơn, tài xế không tự thay được do lốp dự phòng bị xẹp.',
      photos: photosAccident,
      status: 'RESOLVED',
      fault: 'COMPANY',
      reported_by: 15,
      reported_time: yesterday,
      resolved_by: 1, // Dispatcher1
      resolved_time: yesterday,
      resolution_note: 'Điều phối viên đã gọi đội vá lốp lưu động hỗ trợ xử lý trong 20 phút. Xe tiếp tục di chuyển và giao hàng đúng giờ cam kết.',
      created_at: yesterday,
      updated_at: yesterday
    }
  ];

  // Chèn vào bảng incidents
  const { data: insertedIncidents, error: incError } = await supabase
    .from('incidents')
    .insert(testIncidents)
    .select();

  if (incError) {
    console.error('❌ Lỗi khi chèn dữ liệu sự cố mẫu:', incError);
    process.exit(1);
  }

  console.log(`✅ Đã chèn thành công ${insertedIncidents.length} bản ghi sự cố mẫu:`);
  insertedIncidents.forEach((inc) => {
    console.log(` - [ID ${inc.id}] ${inc.type} | Trạng thái: ${inc.status} | Chuyến: TRIP-${inc.trip_id}`);
  });

  // Tạo thêm 1 bản ghi compensation_claim liên kết với sự cố đã RESOLVED (bản ghi số 4)
  const resolvedMajorInc = insertedIncidents.find((i) => i.fault === 'COMPANY' && i.status === 'RESOLVED');
  if (resolvedMajorInc) {
    const { data: claimData, error: claimError } = await supabase
      .from('compensation_claims')
      .insert({
        incident_id: resolvedMajorInc.id,
        order_id: 1, // Order mẫu
        source: 'INCIDENT',
        amount: 12000000,
        reason: 'Bồi thường vải dệt bị thấm nước theo phán quyết của Quản lý tại sự cố INC-' + resolvedMajorInc.id,
        status: 'PENDING',
        created_by: 20, // Manager
        created_at: new Date().toISOString()
      })
      .select();

    if (claimError) {
      console.warn('⚠️ Cảnh báo tạo claim liên kết:', claimError.message);
    } else {
      console.log(`✅ Đã tạo Yêu cầu bồi thường (Claim) liên kết cho sự cố [ID ${resolvedMajorInc.id}] với số tiền 12.000.000 VNĐ.`);
    }
  }

  console.log('🎉 Hoàn tất luồng dữ liệu mẫu để kiểm thử!');
  process.exit(0);
}

seedTestIncidents().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});

