export type RoleGroup = "khach-hang" | "dieu-phoi" | "quan-ly" | "tai-xe";

export interface FeatureScreen {
  src: string;
  title: string;
  caption: string;
  isMobile?: boolean;
}

export interface FeatureStep {
  title: string;
  detail: string;
}

export interface FeatureItem {
  slug: string;
  icon: string;
  roleGroup: RoleGroup;
  roleLabel: string;
  title: string;
  shortText: string;
  heroText: string;
  coverScreen: string;
  highlights: string[];
  steps: FeatureStep[];
  screens: FeatureScreen[];
}

export const ROLE_FILTERS: { id: "all" | RoleGroup; label: string; icon: string }[] = [
  { id: "all", label: "Tất cả", icon: "apps" },
  { id: "khach-hang", label: "Khách hàng", icon: "person" },
  { id: "dieu-phoi", label: "Điều phối viên", icon: "dashboard_customize" },
  { id: "tai-xe", label: "Tài xế (PWA)", icon: "smartphone" },
  { id: "quan-ly", label: "Quản lý", icon: "supervisor_account" },
];

export const FEATURES_DATA: FeatureItem[] = [
  {
    slug: "dat-don-va-chung-tu-ai",
    icon: "auto_awesome",
    roleGroup: "khach-hang",
    roleLabel: "Khách hàng & Điều phối",
    title: "Đặt đơn & Trợ lý AI chứng từ",
    shortText:
      "Gửi yêu cầu báo giá không cần tài khoản, nộp chứng từ qua link bảo mật và được Google Gemini AI gợi ý đúng bộ hồ sơ xuất nhập khẩu.",
    heroText:
      "Khách hàng có thể gửi yêu cầu vận chuyển ngay trên trang chủ và nộp bộ chứng từ qua đường link riêng. Trợ lý AI Google Gemini phân tích loại hàng hóa để đề xuất đầy đủ giấy tờ cần thiết, rút ngắn thời gian thông quan.",
    coverScreen: "/screens/10-ai-chung-tu.png",
    highlights: [
      "Đặt đơn và nộp chứng từ qua link bảo mật (token), không bắt buộc tạo tài khoản.",
      "Hỗ trợ cả chiều Nhập khẩu và Xuất khẩu, tối đa 4.000 kg mỗi đơn (không nhận hàng nguy hiểm).",
      "Google Gemini AI phân tích mô tả hàng hóa và tự tạo danh mục chứng từ cần nộp.",
      "Theo dõi tiến độ hoàn thiện hồ sơ theo thời gian thực và duyệt chứng từ trực tuyến.",
    ],
    steps: [
      {
        title: "1. Gửi yêu cầu vận chuyển & báo giá",
        detail:
          "Khách điền thông tin liên hệ, chiều nhập/xuất khẩu, điểm lấy hàng tại kho ALS, địa chỉ nhận hàng và loại xe dự kiến.",
      },
      {
        title: "2. Trợ lý AI đề xuất danh mục chứng từ",
        detail:
          "Điều phối viên mô tả lô hàng hoặc chọn nhóm hàng chuẩn; Google Gemini AI tự động gợi ý các loại giấy tờ cần thiết (Invoice, Packing List, AWB, C/O…).",
      },
      {
        title: "3. Khách hàng nộp chứng từ qua link riêng",
        detail:
          "Hệ thống gửi link nộp hồ sơ qua email. Khách tải tệp PDF/JPG cho từng mục và xem thanh tiến độ hoàn thiện ngay trên trình duyệt.",
      },
      {
        title: "4. Kiểm duyệt & hoàn tất tờ khai",
        detail:
          "Điều phối viên duyệt từng chứng từ và chuẩn bị tờ khai hải quan. Khi hồ sơ hợp lệ và hợp đồng được ký, đơn chuyển sang trạng thái sẵn sàng xếp xe.",
      },
    ],
    screens: [
      {
        src: "/screens/01-trang-chu.png",
        title: "Trang chủ & tiếp nhận yêu cầu",
        caption: "Giao diện công khai hỗ trợ gửi yêu cầu báo giá, tra cứu vận đơn và liên hệ hotline trực tiếp.",
      },
      {
        src: "/screens/02-gui-yeu-cau.png",
        title: "Form đăng ký nhận tư vấn & báo giá",
        caption: "Khách nhập thông tin doanh nghiệp, chiều nhập/xuất khẩu, điểm lấy – giao hàng và quy cách hàng hóa.",
      },
      {
        src: "/screens/04-nop-chung-tu.png",
        title: "Trang nộp chứng từ theo link riêng",
        caption: "Khách tải lên từng chứng từ theo danh mục đề xuất kèm thanh tiến độ hoàn thiện mà không cần đăng nhập.",
      },
      {
        src: "/screens/10-ai-chung-tu.png",
        title: "Trợ lý AI Google Gemini gợi ý chứng từ",
        caption: "Nhập mô tả hàng hóa bằng ngôn ngữ tự nhiên để AI phân tích và áp dụng danh mục chứng từ vào đơn chỉ với một lần bấm.",
      },
      {
        src: "/screens/12-duyet-chung-tu.png",
        title: "Kiểm duyệt hồ sơ chứng từ trực tuyến",
        caption: "Điều phối viên kiểm tra, duyệt hoặc yêu cầu bổ sung từng loại giấy tờ và đính kèm tờ khai hải quan.",
      },
    ],
  },
  {
    slug: "mo-phong-xep-hang-3d",
    icon: "view_in_ar",
    roleGroup: "dieu-phoi",
    roleLabel: "Điều phối & Khách hàng",
    title: "Tính cước & Mô phỏng xếp hàng 3D",
    shortText:
      "Tính cước minh bạch theo cân nặng thực hoặc quy đổi, hệ thống gợi ý loại xe tối ưu và mô phỏng xếp kiện 3D trực quan bằng Three.js.",
    heroText:
      "NEXLOG giúp tối ưu không gian thùng xe trước khi bốc hàng nhờ thuật toán xếp hàng 3D và gợi ý phương tiện phù hợp. Hợp đồng vận tải, giá cước và phụ phí được quản lý rõ ràng trên cùng một hồ sơ đơn.",
    coverScreen: "/screens/15-xep-hang-3d.png",
    highlights: [
      "Tính cước theo giá trị lớn hơn giữa cân nặng thực và cân quy đổi kích thước.",
      "Tự động so sánh xe khách chọn với loại xe hệ thống đề xuất kèm nhận định kỹ thuật.",
      "Mô phỏng xếp hàng 3D xoay 360° (thuật toán Extreme-Point, xếp theo lớp, LIFO) hiển thị trọng tâm sàn xe.",
      "Tự lập hợp đồng vận tải và ghi nhận minh bạch các phụ phí phát sinh (phí chờ, nâng hạ…).",
    ],
    steps: [
      {
        title: "1. Đánh giá phương án xe & lộ trình",
        detail:
          "Hệ thống phân tích kích thước, trọng lượng các kiện hàng để đề xuất tải trọng xe phù hợp và tính quãng đường dự kiến.",
      },
      {
        title: "2. Mô phỏng xếp kiện 3D trong thùng xe",
        detail:
          "Xem trước cách bố trí từng kiện hàng ở góc nhìn 360° (Trên/Cạnh/Trước), kiểm tra tỷ lệ chiếm dụng thể tích, tải trọng và nhận tư vấn bốc xếp từ AI.",
      },
      {
        title: "3. Lập hợp đồng vận tải & chốt giá",
        detail:
          "Tạo hợp đồng tự động theo phương án xe và mức cước đã thương lượng, gửi email cho khách ký và lưu bản scan.",
      },
      {
        title: "4. Quản lý tài chính & phụ phí",
        detail:
          "Theo dõi tổng tiền thanh toán dự kiến và các phụ phí minh bạch theo đúng điều khoản hợp đồng.",
      },
    ],
    screens: [
      {
        src: "/screens/15-xep-hang-3d.png",
        title: "Mô phỏng xếp hàng 3D lên thùng xe",
        caption: "Hiển thị trực quan các kiện hàng trong thùng xe bằng Three.js, hỗ trợ xoay 360°, báo cáo tải trọng và thể tích chiếm dụng.",
      },
      {
        src: "/screens/11-ho-so-don.png",
        title: "Hồ sơ đơn hàng & đề xuất phương tiện",
        caption: "So sánh xe khách chọn với xe hệ thống đề xuất, xem bản đồ lộ trình, giá cước chốt và nút mở mô phỏng 3D.",
      },
      {
        src: "/screens/13-hop-dong.png",
        title: "Hợp đồng vận tải điện tử",
        caption: "Tự động sinh hợp đồng theo hàng hóa và cước đã chốt, gửi email cho khách và lưu trữ bản ký đóng dấu.",
      },
      {
        src: "/screens/14-tai-chinh-phu-phi.png",
        title: "Quản lý tài chính & phụ phí",
        caption: "Tổng hợp giá cước thỏa thuận, phụ phí phát sinh và tổng thanh toán dự kiến cho từng đơn hàng.",
      },
    ],
  },
  {
    slug: "lap-chuyen-va-dieu-phoi",
    icon: "alt_route",
    roleGroup: "dieu-phoi",
    roleLabel: "Điều phối viên",
    title: "Lập chuyến & Điều phối thông minh",
    shortText:
      "Tự động kiểm tra 5 điều kiện an toàn của tài xế, kéo-thả thứ tự điểm dừng có dự báo giao thông và phát hành lệnh điều xe PDF.",
    heroText:
      "Tối ưu công tác lập chuyến hàng ngày: tập hợp các đơn đã đủ điều kiện, chọn đội xe nội bộ hoặc nhà xe đối tác, sắp xếp thứ tự điểm trả hàng theo tình trạng giao thông và gửi lệnh trực tiếp tới ứng dụng tài xế.",
    coverScreen: "/screens/17-chon-xe-tai-xe.png",
    highlights: [
      "Kiểm tra nghiêm ngặt 5 điều kiện tài xế: ca làm, giới hạn 10h/ngày – 48h/tuần, không trùng chuyến, thời gian nghỉ, hạng bằng lái.",
      "Hỗ trợ ghép điểm trả cùng khách hàng (khi được đồng ý) và kéo-thả sắp xếp thứ tự điểm dừng.",
      "Bản đồ VietMap hiển thị tình trạng giao thông trực tiếp và ước tính ETA tại từng điểm.",
      "Linh hoạt chuyển giao sang nhà xe đối tác khi đội xe nội bộ kín lịch; xuất Lệnh điều xe & Vận đơn PDF.",
    ],
    steps: [
      {
        title: "1. Theo dõi danh sách đơn sẵn sàng xếp xe",
        detail:
          "Hệ thống tự động gom các đơn đã duyệt chứng từ và ký hợp đồng vào hàng chờ lập chuyến, hiển thị tổng tải trọng cần phân bổ.",
      },
      {
        title: "2. Chọn xe, tài xế & thứ tự điểm dừng",
        detail:
          "Chọn xe nội bộ hoặc nhà xe đối tác, chọn 1–2 tài xế (hiển thị sẵn số giờ đã lái), kéo-thả thứ tự giao nhận kèm ETA trực tiếp.",
      },
      {
        title: "3. Giao xe, phát vận đơn & thông báo tài xế",
        detail:
          "Khi xác nhận tạo chuyến, hệ thống sinh Lệnh điều xe & Vận đơn (Waybill) có thể in/tải PDF và gửi thông báo ngay tới điện thoại tài xế.",
      },
    ],
    screens: [
      {
        src: "/screens/08-danh-sach-don.png",
        title: "Quản lý danh sách đơn hàng",
        caption: "Tìm kiếm theo mã đơn, mã HAWB, khách hàng; lọc theo trạng thái vận hành, xuất Excel và theo dõi số đơn sẵn sàng xếp xe.",
      },
      {
        src: "/screens/16-ke-hoach-chuyen.png",
        title: "Kế hoạch chuyến & phân bổ xe",
        caption: "Tổng hợp số đơn chờ xếp xe, xe tải và tài xế sẵn sàng cùng tổng tải trọng cần điều phối.",
      },
      {
        src: "/screens/17-chon-xe-tai-xe.png",
        title: "Chọn xe, tài xế & cấu hình điểm dừng",
        caption: "Chọn xe theo tải trọng, xem giờ lái của tài xế, kéo-thả thứ tự điểm trả và kiểm tra ETA trên bản đồ VietMap.",
      },
      {
        src: "/screens/20-van-don.png",
        title: "Lệnh điều xe & Vận đơn vận tải",
        caption: "Đầy đủ thông tin phiên bản vận đơn, xe, tài xế, lộ trình, chữ ký xác nhận và hỗ trợ in hoặc tải file PDF.",
      },
    ],
  },
  {
    slug: "giam-sat-gps-va-tra-cuu",
    icon: "share_location",
    roleGroup: "khach-hang",
    roleLabel: "Khách hàng & Điều phối",
    title: "Giám sát GPS & Tra cứu hành trình",
    shortText:
      "Theo dõi vị trí xe, tốc độ, tình trạng giao thông và ETA thời gian thực trên bản đồ; khách hàng tra cứu đơn dễ dàng bằng link bảo mật.",
    heroText:
      "Minh bạch hoàn toàn quá trình vận chuyển: điều phối viên giám sát toàn bộ đội xe đang chạy trên bản đồ trực tuyến, còn khách hàng theo dõi tiến độ lô hàng qua đường link riêng gửi về email.",
    coverScreen: "/screens/22-ban-do-gps.png",
    highlights: [
      "Bản đồ VietMap trực tuyến cập nhật vị trí GPS, tốc độ xe và mức độ ùn tắc giao thông.",
      "Tự động tính lại thời gian đến dự kiến (ETA) định kỳ và cảnh báo sớm các chuyến có nguy cơ trễ hẹn.",
      "Lưu đầy đủ mốc thời gian thực tế tại từng điểm dừng, số niêm phong chì và biên bản giao nhận (POD).",
      "Khách hàng tra cứu hành trình qua link bảo mật mà không cần đăng nhập; ảnh nhạy cảm được bảo vệ an toàn.",
    ],
    steps: [
      {
        title: "1. Giám sát toàn bộ chuyến đang chạy",
        detail:
          "Màn hình giám sát hiển thị số chuyến đang chạy, cảnh báo nguy cơ trễ hẹn (late-risk) và tiến độ thực tế so với kế hoạch.",
      },
      {
        title: "2. Theo dõi trực tiếp trên bản đồ GPS",
        detail:
          "Tìm chuyến theo biển số hoặc mã đơn để xem vị trí hiện tại, tốc độ, tình trạng giao thông và ETA còn lại.",
      },
      {
        title: "3. Đối chiếu hồ sơ điểm dừng & POD",
        detail:
          "Mỗi điểm dừng ghi nhận đủ 4 mốc (Đến nơi → Bắt đầu bốc → Bốc xong → Rời đi) cùng ảnh niêm phong và biên bản giao nhận.",
      },
      {
        title: "4. Khách hàng tra cứu bằng tracking link",
        detail:
          "Khách mở link nhận qua email để xem trạng thái đơn hàng, minh chứng giao nhận và thông tin liên hệ điều phối viên phụ trách.",
      },
    ],
    screens: [
      {
        src: "/screens/22-ban-do-gps.png",
        title: "Bản đồ theo dõi GPS trực tuyến",
        caption: "Theo dõi vị trí xe, tốc độ, tình trạng giao thông (thông thoáng / đông xe / ùn tắc) và ETA cập nhật liên tục.",
      },
      {
        src: "/screens/18-giam-sat-chuyen.png",
        title: "Bảng giám sát chuyến xe & cảnh báo trễ",
        caption: "Tổng quan các chuyến đang vận hành, cảnh báo sự cố khẩn cấp, nguy cơ trễ hẹn và nút xem chi tiết hoặc phát lại hành trình.",
      },
      {
        src: "/screens/19-chi-tiet-chuyen.png",
        title: "Hồ sơ chi tiết chuyến & ảnh POD",
        caption: "Hiển thị số niêm phong chì, lịch trình kế hoạch so với thực tế tại từng điểm dừng và bộ ảnh minh chứng giao nhận.",
      },
      {
        src: "/screens/05-theo-doi-don.png",
        title: "Trang tra cứu đơn công khai cho khách hàng",
        caption: "Khách xem các mốc tiến độ đơn hàng, thông tin POD và kênh hỗ trợ nhanh của điều phối viên phụ trách.",
      },
    ],
  },
  {
    slug: "su-co-va-boi-thuong",
    icon: "gavel",
    roleGroup: "quan-ly",
    roleLabel: "Điều phối & Quản lý",
    title: "Xử lý sự cố & Bồi thường minh bạch",
    shortText:
      "Đổi xe khẩn cấp giữa đường kèm vận đơn phiên bản mới; xét duyệt bồi thường minh bạch dựa trên ảnh hiện trường và tua lại GPS.",
    heroText:
      "Khi có sự cố phát sinh trên đường, NEXLOG giúp xử lý nhanh để không đứt gãy chuỗi cung ứng và đảm bảo quy trình giải quyết bồi thường rõ ràng, có đầy đủ bằng chứng cho cả khách hàng và doanh nghiệp.",
    coverScreen: "/screens/28-duyet-boi-thuong.png",
    highlights: [
      "Tài xế báo sự cố ngay trên ứng dụng kèm tối đa 5 ảnh hiện trường (hỏng xe, tai nạn, hàng hư hại…).",
      "Phát lệnh đổi xe/tài xế khẩn cấp ngay trên chuyến đang chạy, tự động tạo điểm trung chuyển và cấp lại Vận đơn mới.",
      "Sự cố hư hỏng/thất lạc được chuyển lên Quản lý xét duyệt cùng đầy đủ hợp đồng, ảnh niêm chì, POD và tua lại hành trình GPS.",
      "Khách hàng có quyền gửi yêu cầu khiếu nại bồi thường trong vòng 14 ngày kể từ khi đơn hoàn tất.",
    ],
    steps: [
      {
        title: "1. Tiếp nhận báo cáo sự cố hiện trường",
        detail:
          "Tài xế gửi báo cáo từ ứng dụng di động kèm ảnh chụp hiện trường; cảnh báo xuất hiện ngay trên bảng điều phối.",
      },
      {
        title: "2. Ứng phó nhanh & đổi xe giữa đường",
        detail:
          "Nếu xe gặp trục trặc kỹ thuật, điều phối viên phát lệnh đổi xe/tài xế thay thế, cấp vận đơn phiên bản mới và tính lại ETA.",
      },
      {
        title: "3. Leo thang lên Quản lý xét duyệt",
        detail:
          "Các sự cố liên quan đến hư hỏng, mất mát hàng hóa hoặc tai nạn được chuyển sang hàng chờ duyệt của Quản lý.",
      },
      {
        title: "4. Đối chiếu bằng chứng & phê duyệt bồi thường",
        detail:
          "Quản lý đối chiếu hợp đồng PDF, ảnh chụp lúc nhận hàng – niêm chì – giao hàng và tua lại GPS trước khi phê duyệt mức bồi thường.",
      },
    ],
    screens: [
      {
        src: "/screens/21-xu-ly-su-co.png",
        title: "Điều phối xử lý sự cố hiện trường",
        caption: "Theo dõi mức độ sự cố, xem biên bản giải quyết và phát lệnh đổi xe & cấp lại vận đơn khi cần thiết.",
      },
      {
        src: "/screens/27-manager-su-co.png",
        title: "Danh sách sự cố & yêu cầu bồi thường",
        caption: "Quản lý lọc theo phân loại sự cố, trạng thái xử lý và số tiền yêu cầu bồi thường.",
      },
      {
        src: "/screens/28-duyet-boi-thuong.png",
        title: "Màn hình xét duyệt bồi thường thiệt hại",
        caption: "Tổng hợp hợp đồng, bộ ảnh minh chứng đa chặng và tính năng tua lại hành trình GPS giúp quyết định minh bạch.",
      },
    ],
  },
  {
    slug: "ung-dung-tai-xe-pwa",
    icon: "smartphone",
    roleGroup: "tai-xe",
    roleLabel: "Tài xế (Driver PWA)",
    title: "Ứng dụng Tài xế (Driver PWA)",
    shortText:
      "Ứng dụng web cài trên điện thoại, hoạt động ngay cả khi mất mạng trong kho kín, cảnh báo giới hạn 4 giờ lái liên tục và đăng ký ca làm.",
    heroText:
      "Thiết kế tối ưu cho thao tác một tay trên điện thoại của tài xế. Ứng dụng hỗ trợ lưu hàng đợi ngoại tuyến khi vào khu vực kho kín mất sóng và tự động đồng bộ ngay khi có mạng trở lại.",
    coverScreen: "/screens/34-driver-home.png",
    highlights: [
      "Cài trực tiếp như ứng dụng di động (PWA), giao diện tối màu dễ nhìn khi lái xe ban đêm.",
      "Hoạt động ngoại tuyến (Offline Queue): lưu tới 50 thao tác khi mất sóng và tự đồng bộ khi có mạng.",
      "Cảnh báo giới hạn 4 giờ lái xe liên tục và nhắc nghỉ tối thiểu 15 phút đảm bảo an toàn giao thông.",
      "Cập nhật 4 bước tại mỗi điểm dừng, nhận thông báo chuyến mới tức thì và đăng ký ca làm cả tuần.",
    ],
    steps: [
      {
        title: "1. Nhận thông báo chuyến mới",
        detail:
          "Khi điều phối viên gán chuyến, tài xế nhận thông báo kèm nút mở nhanh chi tiết lộ trình và thông tin xe.",
      },
      {
        title: "2. Theo dõi giờ lái an toàn & trạng thái mạng",
        detail:
          "Màn hình chính luôn hiển thị thời gian lái liên tục còn lại và thanh trạng thái kết nối kèm nút Đồng bộ ngay.",
      },
      {
        title: "3. Thực thi lộ trình 4 bước tại điểm dừng",
        detail:
          "Tài xế bấm tuần tự: Đến nơi → Bắt đầu bốc → Bốc xong → Rời đi, kèm chụp ảnh hàng, niêm phong và POD.",
      },
      {
        title: "4. Đăng ký ca làm việc tuần",
        detail:
          "Chủ động chọn ca làm việc cho tuần tới trước 22:00 Chủ nhật, xem lịch chuyến theo ngày hoặc gửi báo nghỉ đột xuất.",
      },
    ],
    screens: [
      {
        src: "/screens/34-driver-home.png",
        title: "Trang chủ Driver PWA",
        caption: "Hiển thị thanh trạng thái mạng, đồng bộ ngoại tuyến và đồng hồ theo dõi giới hạn 4 giờ lái liên tục.",
        isMobile: true,
      },
      {
        src: "/screens/35-driver-chuyen.png",
        title: "Sổ quản lý chuyến xe",
        caption: "Phân nhóm chuyến sắp tới, lịch sử đã chạy và tìm kiếm nhanh theo mã chuyến hoặc biển số.",
        isMobile: true,
      },
      {
        src: "/screens/36-driver-chi-tiet.png",
        title: "Chi tiết chuyến & lộ trình điểm dừng",
        caption: "Xem rõ loại xe, giờ khởi hành dự kiến và thứ tự các điểm lấy hàng – giao hàng.",
        isMobile: true,
      },
      {
        src: "/screens/37-driver-ca-lam.png",
        title: "Đăng ký & xem lịch ca làm việc",
        caption: "Chọn ca cố định theo tuần, theo dõi các chuyến được phân công từng ngày hoặc báo nghỉ đột xuất.",
        isMobile: true,
      },
      {
        src: "/screens/38-driver-thong-bao.png",
        title: "Thông báo điều phối chuyến mới",
        caption: "Nhận thông báo tức thì khi có chuyến mới và chuyển thẳng vào màn hình nhận chuyến.",
        isMobile: true,
      },
    ],
  },
  {
    slug: "quan-tri-hieu-suat-va-doi-xe",
    icon: "monitoring",
    roleGroup: "quan-ly",
    roleLabel: "Quản lý & Điều hành",
    title: "Quản trị Hiệu suất, Đội xe & Ca trực",
    shortText:
      "Dashboard KPI doanh thu – SLA – độ đầy xe, cân tải điều phối viên, quản lý hạn bảo dưỡng đội xe, xếp ca trực tuần và nhà xe đối tác.",
    heroText:
      "Cung cấp bức tranh toàn diện cho ban quản lý: đo lường hiệu suất khai thác đội xe, phát hiện điểm nghẽn vận tải, cân bằng khối lượng công việc và quản lý chặt chẽ đội xe nội bộ lẫn nhà xe đối tác.",
    coverScreen: "/screens/25-manager-kpi.png",
    highlights: [
      "Dashboard KPI theo kỳ: doanh thu/km, SLA điều phối, tỷ lệ đơn hoàn hảo, độ đầy xe và km chạy rỗng.",
      "Cân bằng tải điều phối viên: phát hiện đơn bị đọng/quá hạn chứng từ và chuyển giao nhanh sang nhân sự khác.",
      "Quản lý đội xe toàn diện: nhắc hạn đăng kiểm, bảo dưỡng định kỳ theo km và hồ sơ hạng bằng lái tài xế.",
      "Ma trận ca trực tuần hỗ trợ tự động xếp lịch, cảnh báo vượt 10 giờ/ngày và quản lý nhà xe đối tác.",
    ],
    steps: [
      {
        title: "1. Theo dõi KPI & hiệu suất đội xe",
        detail:
          "Xem báo cáo doanh thu, tỷ lệ giao đúng giờ, đồng hồ hiệu suất sử dụng xe và phân tích nguyên nhân trễ hẹn.",
      },
      {
        title: "2. Cân tải khối lượng đơn hàng",
        detail:
          "Kiểm soát tải công việc của từng điều phối viên và điều chuyển các đơn bị gắn cờ để đảm bảo tiến độ.",
      },
      {
        title: "3. Quản lý đội xe, ca trực & đối tác",
        detail:
          "Theo dõi lịch bảo dưỡng xe, phê duyệt hoặc tự động xếp ca trực tuần và quản lý danh sách nhà xe liên kết.",
      },
    ],
    screens: [
      {
        src: "/screens/25-manager-kpi.png",
        title: "Dashboard tổng quan hiệu suất (KPI)",
        caption: "Các chỉ số doanh thu, SLA điều phối, tỷ lệ đơn hoàn hảo và đồng hồ đo mức sử dụng – độ đầy đội xe.",
      },
      {
        src: "/screens/07-dispatcher-dashboard.png",
        title: "Trung tâm giám sát điều phối vận tải",
        caption: "Biểu đồ doanh thu và số đơn theo tháng, tỷ lệ giao thành công và tình trạng chuyến đang chạy.",
      },
      {
        src: "/screens/26-can-tai-don.png",
        title: "Quản lý khối lượng đơn & cân tải điều phối",
        caption: "Theo dõi tải của từng điều phối viên và chuyển giao nhanh các đơn bị gắn cờ quá hạn.",
      },
      {
        src: "/screens/29-doi-xe.png",
        title: "Quản lý đội xe & bảo dưỡng định kỳ",
        caption: "Theo dõi trạng thái hoạt động, hạn đăng kiểm, lịch bảo dưỡng theo km và hồ sơ tài xế.",
      },
      {
        src: "/screens/30-lich-ca-truc.png",
        title: "Ma trận lịch ca trực tuần",
        caption: "Phân ca 7 ngày cho toàn bộ tài xế, phê duyệt ca đăng ký, tự động xếp lịch và cảnh báo vượt giờ lái.",
      },
      {
        src: "/screens/31-nha-xe-doi-tac.png",
        title: "Quản lý nhà xe đối tác & hợp đồng",
        caption: "Quản lý danh sách nhà xe thuê ngoài, trạng thái hợp tác, hợp đồng liên kết và kho bãi.",
      },
    ],
  },
];

export const END_TO_END_FLOW = [
  { step: 1, title: "Tiếp nhận đơn hàng", actor: "Khách hàng / Điều phối", detail: "Gửi yêu cầu báo giá trên web hoặc tạo đơn trực tiếp." },
  { step: 2, title: "Nộp & duyệt chứng từ (AI)", actor: "Khách hàng & Điều phối", detail: "Trợ lý AI gợi ý hồ sơ; khách nộp qua link riêng để duyệt." },
  { step: 3, title: "Chốt giá & ký hợp đồng", actor: "Điều phối & Khách hàng", detail: "Lập hợp đồng vận tải, ký xác nhận và thống nhất phụ phí." },
  { step: 4, title: "Xếp xe & mô phỏng 3D", actor: "Điều phối viên", detail: "Kiểm tra điều kiện tài xế, xếp hàng 3D và tối ưu điểm dừng." },
  { step: 5, title: "Tạo chuyến & phát vận đơn", actor: "Hệ thống & Điều phối", detail: "Xuất lệnh điều xe PDF và gửi thông báo tới ứng dụng tài xế." },
  { step: 6, title: "Vận chuyển & giám sát GPS", actor: "Tài xế & Điều phối", detail: "Cập nhật 4 bước điểm dừng, theo dõi vị trí và ETA trực tuyến." },
  { step: 7, title: "Xử lý sự cố & bồi thường", actor: "Tài xế, Điều phối, Quản lý", detail: "Đổi xe khẩn cấp nếu cần; xét duyệt bồi thường bằng minh chứng." },
  { step: 8, title: "Giao hàng, POD & đóng đơn", actor: "Tài xế & Khách hàng", detail: "Chụp ảnh giao nhận có chữ ký; khách xem trạng thái hoàn tất." },
  { step: 9, title: "Đo lường hiệu suất KPI", actor: "Quản lý", detail: "Theo dõi doanh thu, SLA, cân tải điều phối, đội xe và ca trực." },
];

export function getFeatureBySlug(slug: string): FeatureItem | undefined {
  return FEATURES_DATA.find((f) => f.slug === slug);
}
