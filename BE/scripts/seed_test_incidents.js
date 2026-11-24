require('dotenv').config();
const prisma = require('../config/prisma');

async function seedTestIncidents() {
  console.log('🚀 Bắt đầu tạo luồng dữ liệu mẫu cho cụm màn hình Xử lý sự cố...');

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
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const testIncidents = [
    {
      trip_id: 9n,
      type: 'TRAFFIC_ACCIDENT',
      description: 'Xe tải 29C-246.80 va chạm nhẹ với xe container tại Km 18 cao tốc Nội Bài - Bắc Ninh. Vỡ cụm đèn pha và móp cản trước, thùng xe và tem niêm phong vẫn nguyên vẹn.',
      photos: photosAccident,
      status: 'ESCALATED',
      reported_by: 15n,
      reported_time: twoHoursAgo,
      escalated_by: 1n,
      escalated_time: oneHourAgo,
      escalation_reason: 'Sự cố tai nạn trên cao tốc thuộc thẩm quyền Quản lý (BR-16). Điều phối đã điều xe thay thế 29H-767.99 đến sang tải để đảm bảo tiến độ, chuyển Quản lý phán quyết trách nhiệm lỗi và chi phí sửa chữa.',
      created_at: twoHoursAgo,
      updated_at: oneHourAgo
    },
    {
      trip_id: 12n,
      type: 'DAMAGED_LOST_CARGO',
      description: 'Tại điểm dỡ hàng kho ALS, phát hiện 3 kiện hàng linh kiện điện tử bị rách bao bì carton và móp góc do dằn xóc mạnh. Khách hàng đã lập biên bản bất thường.',
      photos: photosDamagedCargo,
      status: 'ESCALATED',
      reported_by: 16n,
      reported_time: oneHourAgo,
      escalated_by: 21n,
      escalated_time: now,
      escalation_reason: 'Khách hàng yêu cầu bồi thường 3 kiện hàng linh kiện hư hỏng. Chuyển Quản lý thẩm tra dữ liệu lộ trình GPS, xác minh lỗi thuộc về lái xe ALS hay quy cách đóng gói của khách hàng để duyệt mức bồi thường.',
      created_at: oneHourAgo,
      updated_at: now
    },
    {
      trip_id: 13n,
      type: 'CARGO_HELD',
      description: 'Đội QLTT và CSGT kiểm tra tải trọng và yêu cầu xuất trình tờ khai hải quan bản chính có dấu đỏ tại trạm cân QL18. Xe đang tạm thời bị giữ tại bãi kiểm tra.',
      photos: photosCargoHeld,
      status: 'ESCALATED',
      reported_by: 15n,
      reported_time: yesterday,
      escalated_by: 1n,
      escalated_time: yesterday,
      escalation_reason: 'Lô hàng có nguy cơ chậm bàn giao hơn 4 giờ. Cần Quản lý phê duyệt cử nhân viên chứng từ mang hồ sơ gốc ra làm việc trực tiếp với Đội QLTT.',
      created_at: yesterday,
      updated_at: yesterday
    },
    {
      trip_id: 9n,
      type: 'DAMAGED_LOST_CARGO',
      description: 'Kiện hàng vải dệt cao cấp bị ẩm mốc một phần góc do nước mưa thấm qua khe cửa thùng xe.',
      photos: photosDamagedCargo,
      status: 'RESOLVED',
      fault: 'COMPANY',
      reported_by: 16n,
      reported_time: yesterday,
      escalated_by: 1n,
      escalated_time: yesterday,
      escalation_reason: 'Hàng vải của khách hàng công ty Minh Phát bị ướt, cần Quản lý duyệt bồi thường.',
      resolved_by: 20n,
      resolved_time: yesterday,
      resolution_note: 'Quản lý đã thẩm tra hiện trường: Roăng cao su cửa sau xe bị lão hóa làm rò nước. Lỗi thuộc về bảo dưỡng kỹ thuật của Công ty (ALS). Đồng ý đền bù thiệt hại 12.000.000 VNĐ cho khách theo hợp đồng.',
      created_at: yesterday,
      updated_at: yesterday
    },
    {
      trip_id: 10n,
      type: 'ENGINE_BREAKDOWN',
      description: 'Xe nổ lốp phụ tại nút giao Sóc Sơn, tài xế không tự thay được do lốp dự phòng bị xẹp.',
      photos: photosAccident,
      status: 'RESOLVED',
      fault: 'COMPANY',
      reported_by: 15n,
      reported_time: yesterday,
      resolved_by: 1n,
      resolved_time: yesterday,
      resolution_note: 'Điều phối viên đã gọi đội vá lốp lưu động hỗ trợ xử lý trong 20 phút. Xe tiếp tục di chuyển và giao hàng đúng giờ cam kết.',
      created_at: yesterday,
      updated_at: yesterday
    }
  ];

  const insertedIncidents = await prisma.$transaction(
    testIncidents.map((inc) => prisma.incidents.create({ data: inc }))
  );

  console.log(`✅ Đã chèn thành công ${insertedIncidents.length} bản ghi sự cố mẫu:`);
  insertedIncidents.forEach((inc) => {
    console.log(` - [ID ${inc.id}] ${inc.type} | Trạng thái: ${inc.status} | Chuyến: TRIP-${inc.trip_id}`);
  });

  const resolvedMajorInc = insertedIncidents.find((i) => i.fault === 'COMPANY' && i.status === 'RESOLVED');
  if (resolvedMajorInc) {
    try {
      await prisma.compensation_claims.create({
        data: {
          incident_id: resolvedMajorInc.id,
          order_id: 1n,
          source: 'INCIDENT',
          amount: 12000000n,
          reason: 'Bồi thường vải dệt bị thấm nước theo phán quyết của Quản lý tại sự cố INC-' + resolvedMajorInc.id,
          status: 'PENDING',
          created_by: 20n,
          created_time: new Date()
        }
      });
      console.log(`✅ Đã tạo Yêu cầu bồi thường (Claim) liên kết cho sự cố [ID ${resolvedMajorInc.id}] với số tiền 12.000.000 VNĐ.`);
    } catch (claimErr) {
      console.warn('⚠️ Cảnh báo tạo claim liên kết:', claimErr.message);
    }
  }

  console.log('🎉 Hoàn tất luồng dữ liệu mẫu để kiểm thử!');
  await prisma.$disconnect();
  process.exit(0);
}

seedTestIncidents().catch(async (err) => {
  console.error('Fatal error:', err);
  await prisma.$disconnect();
  process.exit(1);
});
