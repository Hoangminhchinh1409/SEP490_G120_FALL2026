export const HIGHLIGHT_ITEMS = [
  {
    icon: "edit_document",
    title: "Đặt đơn trực tuyến",
    description:
      "Điền thông tin lô hàng, điểm lấy/giao, quy cách hàng hóa. Điều phối viên liên hệ chốt giá.",
  },
  {
    icon: "share_location",
    title: "Tra cứu hành trình",
    description:
      "Theo dõi đơn hàng bằng đường link bảo mật gửi qua email, không cần tạo tài khoản.",
  },
  {
    icon: "auto_awesome",
    title: "Quản lý chứng từ AI",
    description:
      "Nộp chứng từ trực tuyến, được gợi ý danh mục giấy tờ cần thiết bằng trợ lý AI.",
  },
  {
    icon: "view_in_ar",
    title: "Xếp hàng 3D & minh bạch",
    description:
      "Mô phỏng xếp kiện 3D trực quan, ghi nhận ảnh hàng, niêm phong và POD ở từng điểm dừng.",
  },
];

export const WORKFLOW_STEPS = [
  {
    step: "01",
    title: "Tiếp nhận đơn & chốt giá",
    badge: "Draft → Confirmed",
    description:
      "Khách gửi yêu cầu (nhập khẩu hoặc xuất khẩu). Điều phối viên thương lượng giá, duyệt chứng từ; sau khi khách ký hợp đồng vận chuyển, đơn được xác nhận.",
  },
  {
    step: "02",
    title: "Lập chuyến & gán xe",
    badge: "Confirmed → Assigned",
    description:
      "Hệ thống kiểm tra điều kiện tài xế (ca làm, giờ lái, bằng lái…) trước khi gán xe. Hết xe nội bộ sẽ chuyển sang nhà xe đối tác.",
  },
  {
    step: "03",
    title: "Bốc hàng & vận chuyển",
    badge: "Accepted → In Progress → In Transit",
    description:
      "Tài xế thực hiện chuỗi 4 bước tại mỗi điểm dừng: Đến nơi → Bắt đầu bốc → Bốc xong → Rời đi, kèm ảnh hàng và niêm phong.",
  },
  {
    step: "04",
    title: "Xử lý sự cố & bồi thường",
    badge: "Incident → Claim",
    description:
      "Xe hỏng giữa đường được đổi xe/tài xế ngay trên chuyến, tự cấp giấy vận tải mới và tính lại giờ đến dự kiến.",
  },
  {
    step: "05",
    title: "Giao hàng & đóng đơn",
    badge: "Delivered → Completed",
    description:
      "Tài xế chụp ảnh dỡ hàng và biên bản giao nhận có chữ ký. Đơn hoàn tất sau khi xác nhận giao thành công.",
  },
  {
    step: "06",
    title: "Hủy đơn",
    badge: "Cancelled",
    description:
      "Áp dụng bậc phí hủy theo hợp đồng khách hàng, tùy thời điểm hủy trước khi xe lăn bánh.",
  },
];

export const FEATURES = [
  {
    icon: "description",
    accent: false,
    title: "Đặt đơn & Trợ lý AI chứng từ",
    description:
      "Gửi yêu cầu báo giá không cần tài khoản, nộp chứng từ qua link bảo mật và được Google Gemini AI gợi ý đúng bộ hồ sơ xuất nhập khẩu.",
  },
  {
    icon: "deployed_code",
    accent: true,
    title: "Tính cước & Mô phỏng xếp hàng 3D",
    description:
      "Tính cước minh bạch theo cân nặng thực hoặc quy đổi, hệ thống gợi ý loại xe tối ưu và mô phỏng xếp kiện 3D trực quan bằng Three.js.",
  },
  {
    icon: "route",
    accent: false,
    title: "Lập chuyến & Điều phối thông minh",
    description:
      "Tự động kiểm tra 5 điều kiện an toàn của tài xế, kéo-thả thứ tự điểm dừng có dự báo giao thông và phát hành lệnh điều xe PDF.",
  },
  {
    icon: "satellite_alt",
    accent: false,
    title: "Giám sát GPS & Tra cứu hành trình",
    description:
      "Theo dõi vị trí xe, tốc độ, tình trạng giao thông và ETA thời gian thực trên bản đồ; khách hàng tra cứu đơn dễ dàng bằng link bảo mật.",
  },
  {
    icon: "verified_user",
    accent: true,
    title: "Xử lý sự cố & Bồi thường minh bạch",
    description:
      "Đổi xe khẩn cấp giữa đường kèm vận đơn phiên bản mới; xét duyệt bồi thường minh bạch dựa trên ảnh hiện trường và tua lại GPS.",
  },
  {
    icon: "smartphone",
    accent: false,
    title: "Ứng dụng Tài xế (Driver PWA)",
    description:
      "Ứng dụng web cài trên điện thoại, hoạt động ngay cả khi mất mạng trong kho kín, cảnh báo giới hạn 4 giờ lái liên tục và đăng ký ca làm.",
  },
];

export const SYSTEM_PORTALS = [
  {
    icon: "admin_panel_settings",
    title: "Quản trị viên",
    description:
      "Quản lý tài khoản, phân quyền, cấu hình hệ thống, nhật ký hoạt động và chế độ bảo trì.",
    highlight: true,
  },
  {
    icon: "manage_accounts",
    title: "Quản lý",
    description:
      "Quản lý đội xe, duyệt sự cố – bồi thường, ca làm việc và theo dõi hiệu suất vận hành.",
    highlight: false,
  },
  {
    icon: "alt_route",
    title: "Điều phối viên",
    description:
      "Tiếp nhận đơn, lập chuyến, gán xe/tài xế và giám sát hành trình theo thời gian thực.",
    highlight: true,
  },
  {
    icon: "local_shipping",
    title: "Tài xế (PWA)",
    description:
      "Ứng dụng web cài trên điện thoại, hoạt động cả khi mất sóng trong kho kín và tự đồng bộ khi có mạng.",
    highlight: false,
  },
];

export const FAQ_ITEMS = [
  {
    question: "Tôi có cần tài khoản để đặt đơn hoặc tra cứu không?",
    answer:
      "Không. Bạn đặt đơn qua đường link do điều phối viên cung cấp hoặc gửi yêu cầu trực tiếp trên trang chủ và tra cứu hành trình bằng link bảo mật gửi qua email.",
  },
  {
    question: "Hệ thống nhận những loại hàng nào?",
    answer:
      "Hàng nhập khẩu và xuất khẩu, tối đa 4.000 kg mỗi đơn. Hệ thống không nhận hàng nguy hiểm.",
  },
  {
    question: "Giá cước được chốt như thế nào?",
    answer:
      "Điều phối viên thương lượng và nhập mức giá chốt. Sau khi bạn nộp đủ chứng từ và ký hợp đồng vận chuyển, đơn được xác nhận.",
  },
  {
    question: "Đơn có thể đi ghép với khách khác không?",
    answer:
      "Không. Chỉ các đơn của cùng một khách hàng (và khách đã đồng ý) mới có thể đi ghép; mỗi đơn luôn đi trọn vẹn trên một xe.",
  },
  {
    question: "Nếu hàng bị hư hỏng hoặc thất lạc thì sao?",
    answer:
      "Sự cố được ghi nhận kèm ảnh hiện trường và chuyển lên quản lý xem xét. Bạn có thể gửi khiếu nại bồi thường trong vòng 14 ngày sau khi đơn hoàn tất.",
  },
  {
    question: "Nếu người nhận từ chối nhận hàng?",
    answer:
      "Xe sẽ chuyển hàng về kho lưu giữ của đơn vị vận chuyển và đơn được xử lý theo ngoại lệ.",
  },
];

export const SECTION_IDS = [
  "gioi-thieu",
  "quy-trinh",
  "tinh-nang",
  "he-thong",
  "faq",
  "lien-he",
];

export const NAV_ITEMS = [
  { id: "gioi-thieu", label: "Giới thiệu" },
  { id: "quy-trinh", label: "Quy trình" },
  { id: "tinh-nang", label: "Tính năng" },
  { id: "he-thong", label: "Hệ thống" },
  { id: "faq", label: "Hỏi đáp" },
];

export const easeInOutCubic = (t) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

export const getArticleTimestamp = (item) => {
  const raw = item?.publishedAt || item?.createdAt || item?.created_at;
  if (raw) {
    const ts = new Date(raw).getTime();
    if (!Number.isNaN(ts)) return ts;
  }
  return 0;
};

export const formatInvoiceDateTime = (isoString) => {
  if (!isoString) return "";
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const formatInvoiceDateOnly = (isoString) => {
  if (!isoString) return "";
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};
