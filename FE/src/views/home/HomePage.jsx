/* eslint-disable @next/next/no-img-element */

"use client";
import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { API_URL } from "@/src/api/apiConfig";
import { orderApi } from "@/src/api/orderApi";
import ConsultationBookingModal from "@/src/components/home/ConsultationBookingModal";

const HIGHLIGHT_ITEMS = [
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

const WORKFLOW_STEPS = [
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

const FEATURES = [
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

const SYSTEM_PORTALS = [
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

const FAQ_ITEMS = [
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

const SECTION_IDS = [
  "gioi-thieu",
  "quy-trinh",
  "tinh-nang",
  "he-thong",
  "faq",
  "lien-he",
];

const easeInOutCubic = (t) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

const getArticleTimestamp = (item) => {
  const raw = item?.publishedAt || item?.createdAt || item?.created_at;
  if (raw) {
    const ts = new Date(raw).getTime();
    if (!Number.isNaN(ts)) return ts;
  }
  return 0;
};

const formatInvoiceDateTime = (isoString) => {
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

const formatInvoiceDateOnly = (isoString) => {
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

export default function HomePage() {
  const [isConsultationOpen, setIsConsultationOpen] = useState(false);
  const [blogs, setBlogs] = useState([]);
  const [blogsLoading, setBlogsLoading] = useState(true);

  const [invoiceCode, setInvoiceCode] = useState("");
  const [taxCode, setTaxCode] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [captchaInput, setCaptchaInput] = useState("");
  const [captchaCode, setCaptchaCode] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaLoading, setCaptchaLoading] = useState(false);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [invoiceResult, setInvoiceResult] = useState(null);
  const [invoiceNotice, setInvoiceNotice] = useState(null);
  const [activeSection, setActiveSection] = useState("");
  const scrollRafRef = useRef(null);

  const cancelScrollAnimation = useCallback(() => {
    if (scrollRafRef.current !== null) {
      cancelAnimationFrame(scrollRafRef.current);
      scrollRafRef.current = null;
    }
  }, []);

  const scrollToSection = useCallback(
    (e, sectionId) => {
      if (e) e.preventDefault();
      cancelScrollAnimation();

      let targetY = 0;
      if (sectionId) {
        const el = document.getElementById(sectionId);
        if (!el) return;
        const headerOffset = 80;
        targetY = Math.max(
          0,
          el.getBoundingClientRect().top + window.scrollY - headerOffset
        );
      }

      window.history.replaceState(
        null,
        "",
        sectionId ? `#${sectionId}` : window.location.pathname
      );
      setActiveSection(sectionId || "");

      const prefersReducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches;
      if (prefersReducedMotion) {
        window.scrollTo(0, targetY);
        return;
      }

      const startY = window.scrollY;
      const distance = targetY - startY;
      if (Math.abs(distance) < 2) {
        window.scrollTo(0, targetY);
        return;
      }

      const duration = 650;
      let startTime = null;

      const step = (timestamp) => {
        if (startTime === null) startTime = timestamp;
        const elapsed = timestamp - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = easeInOutCubic(progress);
        window.scrollTo(0, startY + distance * eased);

        if (progress < 1) {
          scrollRafRef.current = requestAnimationFrame(step);
        } else {
          scrollRafRef.current = null;
        }
      };

      scrollRafRef.current = requestAnimationFrame(step);
    },
    [cancelScrollAnimation]
  );

  useEffect(() => {
    let ticking = false;
    const updateActiveSection = () => {
      ticking = false;
      if (window.scrollY < 160) {
        setActiveSection("");
        return;
      }
      if (
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 24
      ) {
        setActiveSection("lien-he");
        return;
      }
      for (let i = SECTION_IDS.length - 1; i >= 0; i -= 1) {
        const id = SECTION_IDS[i];
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= 130) {
          setActiveSection(id);
          return;
        }
      }
    };

    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(updateActiveSection);
      }
    };

    const onUserInterrupt = () => {
      cancelScrollAnimation();
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("wheel", onUserInterrupt, { passive: true });
    window.addEventListener("touchstart", onUserInterrupt, { passive: true });

    return () => {
      cancelScrollAnimation();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("wheel", onUserInterrupt);
      window.removeEventListener("touchstart", onUserInterrupt);
    };
  }, [cancelScrollAnimation]);

  const loadCaptcha = useCallback(async () => {
    setCaptchaLoading(true);
    try {
      const data = await orderApi.getPublicInvoiceCaptcha();
      setCaptchaCode(data?.captcha_code || "");
      setCaptchaToken(data?.captcha_token || "");
    } catch {
      setCaptchaCode("");
      setCaptchaToken("");
    } finally {
      setCaptchaLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    const initCaptcha = async () => {
      try {
        const data = await orderApi.getPublicInvoiceCaptcha();
        if (mounted) {
          setCaptchaCode(data?.captcha_code || "");
          setCaptchaToken(data?.captcha_token || "");
        }
      } catch {
        if (mounted) {
          setCaptchaCode("");
          setCaptchaToken("");
        }
      }
    };
    initCaptcha();
    return () => {
      mounted = false;
    };
  }, []);

  const handleRefreshCaptcha = () => {
    setCaptchaInput("");
    loadCaptcha();
  };

  const handleInvoiceSearch = async (e) => {
    e.preventDefault();
    if (!invoiceCode.trim() || !taxCode.trim()) {
      setInvoiceResult(null);
      setInvoiceNotice({
        type: "error",
        message:
          "Vui lòng nhập đầy đủ mã tra cứu / số hóa đơn và mã số thuế bên mua.",
      });
      return;
    }
    if (!captchaInput.trim() || !captchaToken) {
      setInvoiceResult(null);
      setInvoiceNotice({
        type: "error",
        message:
          "Vui lòng nhập mã xác thực (Captcha) hoặc bấm làm mới mã xác thực.",
      });
      return;
    }

    setInvoiceLoading(true);
    setInvoiceNotice(null);
    try {
      const data = await orderApi.lookupPublicInvoice({
        invoice_number: invoiceCode.trim(),
        tax_code: taxCode.trim(),
        from_date: fromDate || undefined,
        to_date: toDate || undefined,
        captcha_code: captchaInput.trim(),
        captcha_token: captchaToken,
      });
      setInvoiceResult(data?.invoice || null);
      setInvoiceNotice(null);
      setCaptchaInput("");
      loadCaptcha();
    } catch (err) {
      setInvoiceResult(null);
      setInvoiceNotice({
        type: "error",
        message:
          err?.message ||
          "Không thể tra cứu hóa đơn lúc này. Vui lòng thử lại sau.",
      });
      setCaptchaInput("");
      loadCaptcha();
    } finally {
      setInvoiceLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    const fetchLatestBlogs = async () => {
      try {
        const res = await fetch(`${API_URL}/blogs`);
        if (!res.ok) return;
        const data = await res.json();
        if (mounted && data?.success && Array.isArray(data.blogs)) {
          const sorted = [...data.blogs]
            .sort((a, b) => getArticleTimestamp(b) - getArticleTimestamp(a))
            .slice(0, 3);
          setBlogs(sorted);
        }
      } catch {
        // Bỏ qua khi backend chưa sẵn sàng để trang chủ vẫn hiển thị bình thường
      } finally {
        if (mounted) setBlogsLoading(false);
      }
    };

    fetchLatestBlogs();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <>
      <header className="fixed top-0 w-full z-50 bg-surface-container-lowest/90 backdrop-blur-xl shadow-[0_1px_8px_rgba(15,43,92,0.06)]">
        <div className="h-20 w-full px-margin-lg max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-space-lg">
            <a
              className="flex items-center gap-space-sm group"
              href="#"
              onClick={(e) => scrollToSection(e, null)}
            >
              <img
                src="/logo-icon.png"
                alt="Logo NEXLOG"
                className="w-9 h-9 object-contain"
              />
              <img
                src="/logo-text.png"
                alt="NEXLOG"
                className="h-7 w-auto object-contain"
              />
            </a>
            <nav className="hidden lg:flex items-center gap-space-lg ml-space-md">
              {[
                { id: "gioi-thieu", label: "Giới thiệu" },
                { id: "quy-trinh", label: "Quy trình" },
                { id: "tinh-nang", label: "Tính năng" },
                { id: "he-thong", label: "Hệ thống" },
                { id: "faq", label: "Hỏi đáp" },
              ].map((navItem) => {
                const isActive = activeSection === navItem.id;
                return (
                  <a
                    key={navItem.id}
                    href={`#${navItem.id}`}
                    onClick={(e) => scrollToSection(e, navItem.id)}
                    className={`relative py-1 font-label-lg text-label-lg transition-colors ${
                      isActive
                        ? "text-secondary font-bold"
                        : "text-on-surface-variant hover:text-secondary"
                    }`}
                  >
                    {navItem.label}
                    <span
                      className={`absolute left-0 right-0 -bottom-0.5 h-0.5 rounded-full bg-secondary transition-transform duration-300 origin-left ${
                        isActive ? "scale-x-100" : "scale-x-0"
                      }`}
                    />
                  </a>
                );
              })}
              <Link
                className="relative py-1 font-label-lg text-label-lg text-on-surface-variant hover:text-secondary transition-colors"
                href="/blog"
              >
                Tin tức
              </Link>
              <a
                href="#lien-he"
                onClick={(e) => scrollToSection(e, "lien-he")}
                className={`relative py-1 font-label-lg text-label-lg transition-colors ${
                  activeSection === "lien-he"
                    ? "text-secondary font-bold"
                    : "text-on-surface-variant hover:text-secondary"
                }`}
              >
                Liên hệ
                <span
                  className={`absolute left-0 right-0 -bottom-0.5 h-0.5 rounded-full bg-secondary transition-transform duration-300 origin-left ${
                    activeSection === "lien-he" ? "scale-x-100" : "scale-x-0"
                  }`}
                />
              </a>
            </nav>
          </div>

          <div className="flex items-center">
            <button
              type="button"
              onClick={() => setIsConsultationOpen(true)}
              className="px-space-md py-space-sm rounded-xl font-label-lg text-label-lg text-on-primary bg-on-tertiary-container hover:bg-tertiary-container transition-all cursor-pointer font-bold shadow-sm"
            >
              Gửi yêu cầu
            </button>
          </div>
        </div>
      </header>

      <main className="w-full pt-20 bg-surface min-h-screen">
        <div className="flex flex-col w-full">
          {/* 1. HERO SECTION */}
          <section className="relative w-full overflow-hidden bg-primary pb-space-xl text-on-primary">
            <div className="absolute inset-0 z-0">
              <img
                alt="Hệ thống điều phối vận tải thông minh NEXLOG"
                className="w-full h-full object-cover object-center opacity-35 scale-105"
                src="/nexlog-banner.png"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-primary/95 via-primary-container/85 to-primary" />
              <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-secondary-container/20 blur-3xl pointer-events-none" />
            </div>

            <div className="relative z-10 w-full px-margin-lg pt-space-xl pb-space-lg flex flex-col items-center max-w-7xl mx-auto">
              <div className="inline-flex items-center gap-space-xs px-space-md py-1 rounded-full bg-surface-container-lowest/10 backdrop-blur-md shadow-sm mb-space-md">
                <span className="w-2 h-2 rounded-full bg-on-tertiary-container animate-pulse" />
                <span className="font-label-sm text-label-sm uppercase tracking-widest text-primary-fixed">
                  Hệ thống điều phối vận tải thông minh
                </span>
              </div>

              <div className="text-center max-w-4xl mb-space-xl">
                <h1 className="font-headline-xl text-headline-xl md:font-display-lg md:text-display-lg text-on-primary tracking-tight font-extrabold">
                  Một nền tảng cho mọi{" "}
                  <span className="text-on-tertiary-container">
                    chuyến hàng của bạn
                  </span>
                </h1>
                <p className="font-body-lg text-body-lg text-surface-dim mt-space-sm max-w-2xl mx-auto">
                  NEXLOG kết nối khách hàng, điều phối viên và tài xế trên cùng
                  một hệ thống: đặt đơn, lập chuyến, giám sát GPS và tra cứu
                  hành trình theo thời gian thực.
                </p>
                <div className="mt-space-lg flex flex-wrap items-center justify-center gap-space-sm">
                  <button
                    type="button"
                    onClick={() => setIsConsultationOpen(true)}
                    className="px-6 py-3 rounded-xl font-label-lg text-on-primary bg-on-tertiary-container hover:bg-tertiary-container shadow-lg hover:shadow-xl transition-all cursor-pointer font-bold inline-flex items-center gap-2"
                  >
                    <span className="material-symbols-outlined text-xl">
                      assignment_add
                    </span>
                    <span>Gửi yêu cầu vận chuyển &amp; Báo giá</span>
                  </button>
                  <a
                    href="#quy-trinh"
                    onClick={(e) => scrollToSection(e, "quy-trinh")}
                    className="px-5 py-3 rounded-xl font-label-lg text-on-primary bg-surface-container-lowest/20 hover:bg-surface-container-lowest/30 backdrop-blur-md transition-all cursor-pointer font-semibold inline-flex items-center gap-2"
                  >
                    <span className="material-symbols-outlined text-xl">
                      route
                    </span>
                    <span>Xem quy trình vận chuyển</span>
                  </a>
                </div>
              </div>

              {/* Tra cứu hóa đơn điện tử (#tra-cuu-hoa-don) */}
              <form
                id="tra-cuu-hoa-don"
                onSubmit={handleInvoiceSearch}
                className="w-full max-w-4xl bg-surface-container-lowest text-on-surface rounded-xl shadow-2xl p-space-md md:p-space-lg mb-space-xl flex flex-col gap-space-md scroll-mt-24"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-xs pb-space-sm border-b border-surface-container">
                  <div className="flex items-center gap-space-xs">
                    <span className="material-symbols-outlined text-on-tertiary-container">
                      receipt_long
                    </span>
                    <div>
                      <h2 className="font-headline-sm text-headline-sm text-primary font-bold">
                        Tra cứu hóa đơn
                      </h2>
                      <p className="font-body-sm text-body-sm text-on-surface-variant">
                        Tra cứu &amp; Tải hóa đơn điện tử (e-Invoice) của dịch
                        vụ vận tải NEXLOG.
                      </p>
                    </div>
                  </div>
                  <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider hidden md:inline-block">
                    Thông tư 78 / NĐ-123
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md">
                  <div>
                    <label
                      htmlFor="invoice-code-input"
                      className="block font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-1"
                    >
                      Mã tra cứu hóa đơn / Số hóa đơn
                    </label>
                    <div className="relative flex items-center">
                      <span className="absolute left-space-md material-symbols-outlined text-outline text-lg pointer-events-none">
                        receipt_long
                      </span>
                      <input
                        id="invoice-code-input"
                        value={invoiceCode}
                        onChange={(e) => setInvoiceCode(e.target.value)}
                        className="w-full pl-10 pr-space-md py-2.5 rounded-lg bg-surface-container-low text-on-surface font-data-mono text-data-mono focus:outline-none focus:bg-surface-container-lowest shadow-inner"
                        placeholder="Nhập mã tra cứu hoặc số hóa đơn"
                        type="text"
                      />
                    </div>
                  </div>
                  <div>
                    <label
                      htmlFor="invoice-tax-input"
                      className="block font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-1"
                    >
                      Mã số thuế bên mua (MST)
                    </label>
                    <div className="relative flex items-center">
                      <span className="absolute left-space-md material-symbols-outlined text-outline text-lg pointer-events-none">
                        corporate_fare
                      </span>
                      <input
                        id="invoice-tax-input"
                        value={taxCode}
                        onChange={(e) => setTaxCode(e.target.value)}
                        className="w-full pl-10 pr-space-md py-2.5 rounded-lg bg-surface-container-low text-on-surface font-data-mono text-data-mono focus:outline-none focus:bg-surface-container-lowest shadow-inner"
                        placeholder="Nhập mã số thuế doanh nghiệp (10 hoặc 13 số)"
                        type="text"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md">
                  <div>
                    <span className="block font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-1">
                      Khoảng thời gian phát hành
                    </span>
                    <div className="grid grid-cols-2 gap-space-xs">
                      <input
                        aria-label="Từ ngày"
                        value={fromDate}
                        onChange={(e) => setFromDate(e.target.value)}
                        className="w-full px-space-sm py-2.5 rounded-lg bg-surface-container-low text-on-surface font-body-md text-body-md focus:outline-none focus:bg-surface-container-lowest"
                        type="date"
                      />
                      <input
                        aria-label="Đến ngày"
                        value={toDate}
                        onChange={(e) => setToDate(e.target.value)}
                        className="w-full px-space-sm py-2.5 rounded-lg bg-surface-container-low text-on-surface font-body-md text-body-md focus:outline-none focus:bg-surface-container-lowest"
                        type="date"
                      />
                    </div>
                  </div>
                  <div>
                    <label
                      htmlFor="invoice-captcha-input"
                      className="block font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-1"
                    >
                      Mã xác thực (Captcha)
                    </label>
                    <div className="flex items-center gap-space-xs">
                      <div className="relative flex-1 flex items-center">
                        <span className="absolute left-space-md material-symbols-outlined text-outline text-lg pointer-events-none">
                          security
                        </span>
                        <input
                          id="invoice-captcha-input"
                          value={captchaInput}
                          onChange={(e) => setCaptchaInput(e.target.value)}
                          className="w-full pl-10 pr-space-md py-2.5 rounded-lg bg-surface-container-low text-on-surface font-data-mono text-data-mono uppercase focus:outline-none focus:bg-surface-container-lowest shadow-inner"
                          placeholder="Nhập 6 ký tự"
                          maxLength={6}
                          type="text"
                        />
                      </div>
                      <div className="flex items-center gap-space-xs bg-surface-container-low px-space-sm py-2 rounded-lg border border-outline-variant/40">
                        <span className="font-data-mono text-headline-sm font-bold tracking-widest text-primary px-space-xs bg-surface-container-lowest rounded select-none min-w-[84px] text-center">
                          {captchaLoading ? "..." : captchaCode || "------"}
                        </span>
                        <button
                          onClick={handleRefreshCaptcha}
                          disabled={captchaLoading}
                          className="text-outline hover:text-primary transition-colors flex items-center justify-center p-1 rounded cursor-pointer disabled:opacity-50"
                          title="Đổi mã khác"
                          type="button"
                        >
                          <span className="material-symbols-outlined text-lg">
                            refresh
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <button
                  disabled={invoiceLoading}
                  className="w-full py-3.5 px-space-lg rounded-lg bg-on-tertiary-container hover:bg-tertiary-container active:scale-[0.99] text-on-primary font-headline-md text-headline-md font-bold uppercase tracking-wider flex items-center justify-center gap-space-xs shadow-md transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                  type="submit"
                >
                  <span className="material-symbols-outlined text-2xl">
                    search
                  </span>
                  <span>
                    {invoiceLoading ? "ĐANG TRA CỨU..." : "TRA CỨU HÓA ĐƠN"}
                  </span>
                </button>

                {invoiceNotice && (
                  <div
                    role="status"
                    className={`rounded-lg p-space-md font-body-sm text-body-sm flex items-start gap-space-xs border ${
                      invoiceNotice.type === "error"
                        ? "bg-error-container/30 text-error border-error/30"
                        : "bg-surface-container-low text-on-surface-variant border-surface-container-high"
                    }`}
                  >
                    <span className="material-symbols-outlined text-base shrink-0 mt-0.5">
                      {invoiceNotice.type === "error" ? "error" : "info"}
                    </span>
                    <span>{invoiceNotice.message}</span>
                  </div>
                )}

                {invoiceResult && (
                  <div
                    id="invoice-result-card"
                    className="mt-space-xs bg-surface-container-low rounded-lg p-space-md flex flex-col gap-space-sm border border-surface-container-high"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-xs pb-space-xs border-b border-surface-container">
                      <div className="flex items-center gap-space-xs flex-wrap">
                        <span className="material-symbols-outlined text-secondary">
                          receipt
                        </span>
                        <span className="font-headline-sm text-headline-sm text-primary font-bold">
                          Hóa đơn GTGT #{invoiceResult.invoice_number}
                        </span>
                        <span className="px-2 py-0.5 rounded text-label-sm font-label-sm bg-surface-container-high text-secondary font-semibold flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
                          {invoiceResult.status_label || "Đã phát hành"}
                        </span>
                      </div>
                      {invoiceResult.issued_at && (
                        <span className="font-label-sm text-label-sm text-on-surface-variant font-data-mono">
                          Phát hành: {formatInvoiceDateTime(invoiceResult.issued_at)}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-space-sm py-space-xs">
                      <div className="flex flex-col">
                        <span className="font-label-sm text-label-sm text-on-surface-variant uppercase">
                          Ngày lập / Mã đơn
                        </span>
                        <span className="font-data-mono text-body-md font-semibold text-on-surface">
                          {formatInvoiceDateOnly(invoiceResult.issued_at)} •{" "}
                          {invoiceResult.order_code}
                        </span>
                      </div>
                      <div className="flex flex-col md:col-span-2">
                        <span className="font-label-sm text-label-sm text-on-surface-variant uppercase">
                          Khách hàng / Doanh nghiệp (MST: {invoiceResult.tax_code})
                        </span>
                        <span className="font-body-md text-body-md font-semibold text-on-surface line-clamp-1">
                          {invoiceResult.customer_name}
                        </span>
                      </div>
                      <div className="flex flex-col md:text-right">
                        <span className="font-label-sm text-label-sm text-on-surface-variant uppercase">
                          Tổng tiền thanh toán (VAT {invoiceResult.vat_rate}%)
                        </span>
                        <span className="font-data-mono text-headline-sm font-bold text-on-tertiary-container">
                          {Math.round(
                            Number(invoiceResult.total_amount) || 0
                          ).toLocaleString("vi-VN")}{" "}
                          VNĐ
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-space-sm pt-space-xs border-t border-surface-container">
                      <span className="font-body-sm text-body-sm text-on-surface-variant">
                        Tiền hàng:{" "}
                        <strong className="text-on-surface">
                          {Math.round(
                            Number(invoiceResult.subtotal_amount) || 0
                          ).toLocaleString("vi-VN")}{" "}
                          VNĐ
                        </strong>{" "}
                        • Thuế GTGT:{" "}
                        <strong className="text-on-surface">
                          {Math.round(
                            Number(invoiceResult.vat_amount) || 0
                          ).toLocaleString("vi-VN")}{" "}
                          VNĐ
                        </strong>
                      </span>

                      <div className="flex flex-wrap items-center gap-space-sm">
                        <a
                          href={orderApi.getPublicInvoiceFileUrl(
                            invoiceResult.download_token,
                            "pdf"
                          )}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-space-xs px-space-md py-2 rounded-lg bg-surface-container-lowest text-primary font-label-md text-label-md font-semibold shadow-sm hover:bg-secondary-fixed transition-colors"
                        >
                          <span className="material-symbols-outlined text-base">
                            description
                          </span>
                          <span>Xem hóa đơn (PDF)</span>
                        </a>
                        <a
                          href={orderApi.getPublicInvoiceFileUrl(
                            invoiceResult.download_token,
                            "xml"
                          )}
                          download
                          className="inline-flex items-center gap-space-xs px-space-md py-2 rounded-lg bg-primary text-on-primary font-label-md text-label-md font-semibold shadow-sm hover:bg-primary-container transition-colors"
                        >
                          <span className="material-symbols-outlined text-base">
                            code
                          </span>
                          <span>Tải XML</span>
                        </a>
                      </div>
                    </div>
                  </div>
                )}
              </form>

              {/* 4 Quick Highlights */}
              <div className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-gutter">
                {HIGHLIGHT_ITEMS.map((item) => (
                  <div
                    key={item.title}
                    className="bg-surface-container-lowest/10 backdrop-blur-md rounded-xl p-space-md border border-surface-container-lowest/15 flex flex-col gap-space-xs"
                  >
                    <div className="w-10 h-10 rounded-lg bg-on-tertiary-container/20 text-on-tertiary-container flex items-center justify-center mb-1">
                      <span className="material-symbols-outlined text-2xl">
                        {item.icon}
                      </span>
                    </div>
                    <h3 className="font-headline-sm text-headline-sm font-bold text-on-primary">
                      {item.title}
                    </h3>
                    <p className="font-body-sm text-body-sm text-surface-dim leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* 2. GIỚI THIỆU DỰ ÁN (#gioi-thieu) */}
          <section
            id="gioi-thieu"
            className="w-full py-space-xl bg-surface-container-lowest scroll-mt-20"
          >
            <div className="w-full px-margin-lg max-w-5xl mx-auto text-center">
              <span className="font-label-sm text-label-sm uppercase tracking-widest text-secondary font-bold">
                Về dự án
              </span>
              <h2 className="font-headline-xl text-headline-xl text-primary font-bold tracking-tight mt-1">
                NEXLOG là gì?
              </h2>
              <div className="mt-space-md flex flex-col gap-space-sm font-body-lg text-body-lg text-on-surface-variant leading-relaxed">
                <p>
                  NEXLOG là hệ thống quản lý và điều phối vận tải đường bộ phục
                  vụ hoạt động logistics gắn với ga hàng hóa hàng không. Dự án
                  số hóa toàn bộ vòng đời của một đơn hàng, từ lúc tiếp nhận yêu
                  cầu, chốt giá, lập chuyến, vận chuyển cho đến giao hàng và xử
                  lý bồi thường.
                </p>
                <p>
                  Mục tiêu là giúp khách hàng luôn biết hàng của mình đang ở
                  đâu, giúp điều phối viên ra quyết định nhanh hơn và giúp tài
                  xế thao tác đơn giản ngay trên điện thoại.
                </p>
              </div>
            </div>
          </section>

          {/* 3. QUY TRÌNH VẬN CHUYỂN 6 GIAI ĐOẠN (#quy-trinh) */}
          <section
            id="quy-trinh"
            className="w-full py-space-xl bg-surface scroll-mt-20"
          >
            <div className="w-full px-margin-lg max-w-7xl mx-auto">
              <div className="text-center max-w-3xl mx-auto mb-space-xl">
                <span className="font-label-sm text-label-sm uppercase tracking-widest text-secondary font-bold">
                  Hành trình của một đơn hàng
                </span>
                <h2 className="font-headline-xl text-headline-xl text-primary font-bold tracking-tight mt-1">
                  Quy trình vận chuyển 6 giai đoạn
                </h2>
                <p className="font-body-lg text-body-lg text-on-surface-variant mt-space-xs">
                  Mỗi đơn hàng đi qua các trạng thái rõ ràng, giúp bạn luôn nắm
                  được tiến độ.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-gutter-lg">
                {WORKFLOW_STEPS.map((item) => (
                  <div
                    key={item.step}
                    className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm border border-surface-container-low flex flex-col gap-space-sm"
                  >
                    <div className="flex items-center justify-between gap-space-xs">
                      <span className="font-data-mono text-headline-md font-extrabold text-on-tertiary-container">
                        {item.step}
                      </span>
                      <span className="px-2.5 py-1 rounded-md bg-surface-container-low text-secondary font-data-mono text-label-sm font-semibold">
                        {item.badge}
                      </span>
                    </div>
                    <h3 className="font-headline-md text-headline-md text-primary font-bold">
                      {item.title}
                    </h3>
                    <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* 4. TÍNH NĂNG NỔI BẬT (#tinh-nang) */}
          <section
            id="tinh-nang"
            className="w-full py-space-xl bg-surface-container-lowest scroll-mt-20"
          >
            <div className="w-full px-margin-lg max-w-7xl mx-auto">
              <div className="text-center max-w-3xl mx-auto mb-space-xl">
                <span className="font-label-sm text-label-sm uppercase tracking-widest text-secondary font-bold">
                  Khám phá chi tiết
                </span>
                <h2 className="font-headline-xl text-headline-xl text-primary font-bold tracking-tight mt-1">
                  Tính năng nổi bật của NEXLOG
                </h2>
                <p className="font-body-lg text-body-lg text-on-surface-variant mt-space-xs">
                  Các phân hệ nghiệp vụ cốt lõi được tích hợp đồng bộ trên cùng
                  một nền tảng.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-gutter-lg">
                {FEATURES.map((feature) => (
                  <div
                    key={feature.title}
                    className="group bg-surface rounded-xl p-space-lg shadow-sm hover:shadow-xl transition-all duration-300 border border-surface-container-low flex flex-col"
                  >
                    <div
                      className={`w-14 h-14 rounded-lg flex items-center justify-center transition-all mb-space-md ${
                        feature.accent
                          ? "bg-tertiary-fixed text-on-tertiary-fixed-variant group-hover:bg-on-tertiary-container group-hover:text-on-primary"
                          : "bg-surface-container-high text-primary group-hover:bg-primary group-hover:text-on-primary"
                      }`}
                    >
                      <span className="material-symbols-outlined text-3xl">
                        {feature.icon}
                      </span>
                    </div>
                    <h3 className="font-headline-md text-headline-md text-primary font-bold mb-space-xs group-hover:text-secondary transition-colors">
                      {feature.title}
                    </h3>
                    <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* 5. MỘT HỆ THỐNG, BỐN CỔNG THÔNG TIN (#he-thong) */}
          <section
            id="he-thong"
            className="w-full py-space-xl bg-primary-container text-on-primary relative overflow-hidden scroll-mt-20"
          >
            <div className="absolute -bottom-20 -left-20 w-80 h-80 rounded-full bg-secondary/20 blur-3xl pointer-events-none" />
            <div className="absolute -top-20 -right-20 w-96 h-96 rounded-full bg-on-tertiary-container/10 blur-3xl pointer-events-none" />

            <div className="w-full px-margin-lg max-w-7xl mx-auto relative z-10">
              <div className="flex flex-col items-center text-center max-w-3xl mx-auto mb-space-xl">
                <span className="font-label-sm text-label-sm uppercase tracking-widest text-secondary-fixed font-bold mb-1">
                  Vai trò trong hệ thống
                </span>
                <h2 className="font-headline-xl text-headline-xl text-on-primary font-bold tracking-tight">
                  Một hệ thống, bốn cổng thông tin
                </h2>
                <p className="font-body-lg text-body-lg text-surface-dim mt-space-xs">
                  Phân tách rõ ràng không gian làm việc theo từng vai trò vận
                  hành trong quy trình logistics.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-gutter-lg">
                {SYSTEM_PORTALS.map((portal) => (
                  <div
                    key={portal.title}
                    className="bg-surface-container-lowest/10 backdrop-blur-md rounded-xl p-space-lg text-center flex flex-col items-center hover:bg-surface-container-lowest/15 transition-all shadow-lg"
                  >
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center mb-space-sm ${
                        portal.highlight
                          ? "bg-on-tertiary-container/20 text-on-tertiary-container"
                          : "bg-secondary-fixed-dim/20 text-secondary-fixed-dim"
                      }`}
                    >
                      <span className="material-symbols-outlined text-3xl">
                        {portal.icon}
                      </span>
                    </div>
                    <h3 className="font-headline-md text-headline-md text-on-primary font-bold">
                      {portal.title}
                    </h3>
                    <p className="font-body-sm text-body-sm text-surface-dim mt-space-xs leading-relaxed">
                      {portal.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* 6. CÂU HỎI THƯỜNG GẶP (#faq) */}
          <section
            id="faq"
            className="w-full py-space-xl bg-surface scroll-mt-20"
          >
            <div className="w-full px-margin-lg max-w-4xl mx-auto">
              <div className="text-center mb-space-xl">
                <span className="font-label-sm text-label-sm uppercase tracking-widest text-secondary font-bold">
                  Giải đáp nhanh
                </span>
                <h2 className="font-headline-xl text-headline-xl text-primary font-bold tracking-tight mt-1">
                  Câu hỏi thường gặp
                </h2>
              </div>

              <div className="flex flex-col gap-space-sm">
                {FAQ_ITEMS.map((faq) => (
                  <details
                    key={faq.question}
                    className="group bg-surface-container-lowest rounded-xl shadow-sm border border-surface-container-low"
                  >
                    <summary className="list-none cursor-pointer flex items-center justify-between gap-space-md p-space-lg font-headline-sm text-headline-sm text-primary font-bold">
                      <span>{faq.question}</span>
                      <span className="material-symbols-outlined text-secondary transition-transform group-open:rotate-180 shrink-0">
                        expand_more
                      </span>
                    </summary>
                    <p className="px-space-lg pb-space-lg font-body-md text-body-md text-on-surface-variant leading-relaxed">
                      {faq.answer}
                    </p>
                  </details>
                ))}
              </div>
            </div>
          </section>

          {/* 7. TIN TỨC PHỔ BIẾN (Dữ liệu thật từ API /blogs) */}
          {!blogsLoading && blogs.length > 0 && (
            <section className="w-full py-space-xl bg-surface-container-lowest">
              <div className="w-full px-margin-lg max-w-7xl mx-auto">
                <div className="flex items-center justify-between mb-space-lg">
                  <div>
                    <span className="font-label-sm text-label-sm uppercase tracking-widest text-secondary font-bold">
                      Thị trường &amp; Vận hành
                    </span>
                    <h2 className="font-headline-xl text-headline-xl text-primary font-bold tracking-tight mt-1">
                      Tin Tức Phổ Biến
                    </h2>
                  </div>
                  <Link
                    className="hidden sm:inline-flex items-center gap-space-xs font-label-lg text-label-lg text-secondary font-semibold hover:text-primary transition-colors"
                    href="/blog"
                  >
                    <span>Xem tất cả tin tức</span>
                    <span className="material-symbols-outlined text-base">
                      arrow_forward
                    </span>
                  </Link>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter-lg">
                  {blogs.map((article) => (
                    <article
                      key={article.id}
                      className="group bg-surface rounded-xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 border border-surface-container-low flex flex-col"
                    >
                      <div className="relative h-48 overflow-hidden bg-surface-container">
                        <img
                          alt={article.title || "Tin tức NEXLOG"}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          src={article.image || "/nexlog-banner.png"}
                        />
                        <div className="absolute top-space-sm left-space-sm px-space-sm py-1 rounded bg-primary text-on-primary font-data-mono text-label-sm font-bold">
                          {article.publishDate || "Vừa cập nhật"}
                        </div>
                      </div>
                      <div className="p-space-lg flex-1 flex flex-col justify-between">
                        <div>
                          {article.category && (
                            <span className="font-label-sm text-label-sm text-on-tertiary-container uppercase font-bold tracking-wide">
                              {article.category}
                            </span>
                          )}
                          <h3 className="font-headline-sm text-headline-sm font-bold text-primary mt-1 mb-space-sm group-hover:text-secondary transition-colors line-clamp-2">
                            {article.title}
                          </h3>
                          {article.summary && (
                            <p className="font-body-sm text-body-sm text-on-surface-variant line-clamp-3">
                              {article.summary}
                            </p>
                          )}
                        </div>
                        <div className="pt-space-md">
                          <Link
                            className="font-label-md text-label-md text-secondary font-semibold group-hover:text-on-tertiary-container inline-flex items-center gap-1 transition-colors"
                            href={`/blog?id=${article.id}`}
                          >
                            Tìm hiểu thêm{" "}
                            <span className="material-symbols-outlined text-sm">
                              arrow_forward
                            </span>
                          </Link>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            </section>
          )}
        </div>
      </main>

      <footer
        id="lien-he"
        className="w-full bg-primary text-surface-container-high scroll-mt-20"
      >
        <div className="w-full px-margin-lg max-w-7xl mx-auto py-space-xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-lg pb-space-xl border-b border-surface-container-lowest/15">
            <div className="max-w-2xl flex flex-col gap-space-xs">
              <span className="font-label-sm text-label-sm uppercase tracking-widest text-secondary-fixed font-bold">
                Liên hệ
              </span>
              <h2 className="font-headline-xl text-headline-xl text-on-primary font-bold tracking-tight">
                Bạn muốn tìm hiểu thêm?
              </h2>
              <p className="font-body-md text-body-md text-surface-dim">
                Liên hệ với đội ngũ NEXLOG để được tư vấn hoặc gửi yêu cầu vận
                chuyển trực tuyến ngay trên hệ thống.
              </p>
              <a
                href="mailto:nexlogcustomerservice@gmail.com"
                className="inline-flex items-center gap-space-xs font-body-md text-body-md text-secondary-fixed hover:text-on-primary transition-colors mt-1 w-fit"
              >
                <span className="material-symbols-outlined text-base">
                  mail
                </span>
                <span>nexlogcustomerservice@gmail.com</span>
              </a>
            </div>

            <div className="shrink-0">
              <button
                type="button"
                onClick={() => setIsConsultationOpen(true)}
                className="px-6 py-3 rounded-xl font-label-lg text-on-primary bg-on-tertiary-container hover:bg-tertiary-container shadow-lg transition-all cursor-pointer font-bold inline-flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-xl">
                  assignment_add
                </span>
                <span>Gửi yêu cầu vận chuyển</span>
              </button>
            </div>
          </div>

          <div className="pt-space-md flex flex-col sm:flex-row items-center justify-between gap-space-sm text-surface-dim font-label-sm text-label-sm">
            <p>NEXLOG – Hệ thống điều phối vận tải thông minh</p>
            <p>© 2026 NEXLOG. All rights reserved.</p>
          </div>
        </div>
      </footer>

      <div className="fixed bottom-space-lg right-space-lg z-50">
        <button
          aria-label="Hỗ trợ trực tuyến"
          onClick={() => setIsConsultationOpen(true)}
          className="w-14 h-14 rounded-full bg-on-tertiary-container text-on-primary shadow-xl hover:bg-tertiary-container flex items-center justify-center transition-all cursor-pointer hover:scale-105"
          type="button"
        >
          <span className="material-symbols-outlined text-2xl">chat</span>
        </button>
      </div>

      {isConsultationOpen && (
        <ConsultationBookingModal
          open={isConsultationOpen}
          onCancel={() => setIsConsultationOpen(false)}
        />
      )}
    </>
  );
}
