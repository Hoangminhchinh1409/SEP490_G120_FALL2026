/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { siteConfig } from "@/site.config";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { FEATURES_DATA } from "@/data/features";

const HIGHLIGHTS = [
  { icon: "assignment_add", title: "Đặt đơn qua link riêng", text: "Điền thông tin lô hàng, điểm lấy/giao, quy cách hàng hóa. Điều phối viên liên hệ chốt giá.", href: "/tinh-nang/dat-don-va-chung-tu-ai" },
  { icon: "share_location", title: "Tra cứu hành trình", text: "Theo dõi đơn hàng bằng đường link bảo mật gửi qua email, không cần tạo tài khoản.", href: "/tinh-nang/giam-sat-gps-va-tra-cuu" },
  { icon: "folder_managed", title: "Quản lý chứng từ AI", text: "Nộp chứng từ trực tuyến, được gợi ý danh mục giấy tờ cần thiết bằng trợ lý AI.", href: "/tinh-nang/dat-don-va-chung-tu-ai" },
  { icon: "view_in_ar", title: "Xếp hàng 3D & minh bạch", text: "Mô phỏng xếp kiện 3D trực quan, ghi nhận ảnh hàng, niêm phong và POD ở từng điểm dừng.", href: "/tinh-nang/mo-phong-xep-hang-3d" },
];

const STAGES = [
  { n: 1, icon: "request_quote", title: "Tiếp nhận đơn & chốt giá", status: "Draft → Confirmed", text: "Khách gửi yêu cầu (nhập khẩu hoặc xuất khẩu). Điều phối viên thương lượng giá, duyệt chứng từ; sau khi khách ký hợp đồng vận chuyển, đơn được xác nhận." },
  { n: 2, icon: "alt_route", title: "Lập chuyến & gán xe", status: "Confirmed → Assigned", text: "Hệ thống kiểm tra điều kiện tài xế (ca làm, giờ lái, bằng lái…) trước khi gán xe. Hết xe nội bộ sẽ chuyển sang nhà xe đối tác." },
  { n: 3, icon: "local_shipping", title: "Bốc hàng & vận chuyển", status: "Accepted → In Progress → In Transit", text: "Tài xế thực hiện chuỗi 4 bước tại mỗi điểm dừng: Đến nơi → Bắt đầu bốc → Bốc xong → Rời đi, kèm ảnh hàng và niêm phong." },
  { n: 4, icon: "report_problem", title: "Xử lý sự cố & bồi thường", status: "Incident → Claim", text: "Xe hỏng giữa đường được đổi xe/tài xế ngay trên chuyến, tự cấp giấy vận tải mới và tính lại giờ đến dự kiến." },
  { n: 5, icon: "task_alt", title: "Giao hàng & đóng đơn", status: "Delivered → Completed", text: "Tài xế chụp ảnh dỡ hàng và biên bản giao nhận có chữ ký. Đơn hoàn tất sau khi xác nhận giao thành công." },
  { n: 6, icon: "event_busy", title: "Hủy đơn", status: "Cancelled", text: "Áp dụng bậc phí hủy theo hợp đồng khách hàng, tùy thời điểm hủy trước khi xe lăn bánh." },
];

const ROLES = [
  { icon: "admin_panel_settings", title: "Quản trị viên", text: "Quản lý tài khoản, phân quyền, cấu hình hệ thống, nhật ký hoạt động và chế độ bảo trì.", href: "/tinh-nang" },
  { icon: "supervisor_account", title: "Quản lý", text: "Quản lý đội xe, duyệt sự cố – bồi thường, ca làm việc và theo dõi hiệu suất vận hành.", href: "/tinh-nang/quan-tri-hieu-suat-va-doi-xe" },
  { icon: "dashboard_customize", title: "Điều phối viên", text: "Tiếp nhận đơn, lập chuyến, gán xe/tài xế và giám sát hành trình theo thời gian thực.", href: "/tinh-nang/lap-chuyen-va-dieu-phoi" },
  { icon: "smartphone", title: "Tài xế (PWA)", text: "Ứng dụng web cài trên điện thoại, hoạt động cả khi mất sóng trong kho kín và tự đồng bộ khi có mạng.", href: "/tinh-nang/ung-dung-tai-xe-pwa" },
];

const STATS = [
  { value: "48", label: "Use case" },
  { value: "19", label: "Phân hệ chức năng" },
  { value: "4", label: "Cổng thông tin" },
  { value: "7", label: "Tích hợp bên ngoài" },
  { value: "5", label: "Tác vụ nền tự động" },
];

const TECH = [
  { icon: "web", title: "Giao diện", text: "Next.js (App Router), React, responsive trên máy tính và điện thoại." },
  { icon: "dns", title: "Máy chủ", text: "Node.js & Express, REST API, kiến trúc 3 tầng dạng modular monolith." },
  { icon: "database", title: "Dữ liệu", text: "PostgreSQL 16 với 36 bảng dữ liệu, lưu trữ trên Supabase." },
  { icon: "hub", title: "Tích hợp", text: "VietMap / Google Maps, Cloudinary, GPS xe, Google Gemini AI, Three.js 3D, Email." },
];

const FAQ = [
  { q: "Tôi có cần tài khoản để đặt đơn hoặc tra cứu không?", a: "Không. Bạn đặt đơn qua đường link do điều phối viên cung cấp và tra cứu hành trình bằng link bảo mật gửi qua email." },
  { q: "Hệ thống nhận những loại hàng nào?", a: "Hàng nhập khẩu và xuất khẩu, tối đa 4.000 kg mỗi đơn. Hệ thống không nhận hàng nguy hiểm." },
  { q: "Giá cước được chốt như thế nào?", a: "Điều phối viên thương lượng và nhập mức giá chốt. Sau khi bạn nộp đủ chứng từ và ký hợp đồng vận chuyển, đơn được xác nhận." },
  { q: "Đơn có thể đi ghép với khách khác không?", a: "Không. Chỉ các đơn của cùng một khách hàng (và khách đã đồng ý) mới có thể đi ghép; mỗi đơn luôn đi trọn vẹn trên một xe." },
  { q: "Nếu hàng bị hư hỏng hoặc thất lạc thì sao?", a: "Sự cố được ghi nhận kèm ảnh hiện trường và chuyển lên quản lý xem xét. Bạn có thể gửi khiếu nại bồi thường trong vòng 14 ngày sau khi đơn hoàn tất." },
  { q: "Nếu người nhận từ chối nhận hàng?", a: "Xe sẽ chuyển hàng về kho lưu giữ của đơn vị vận chuyển và đơn được xử lý theo ngoại lệ." },
];

function SectionHeader({ eyebrow, title, text }: { eyebrow: string; title: string; text?: string }) {
  return (
    <div className="text-center max-w-3xl mx-auto mb-space-xl">
      <span className="font-label-sm text-label-sm uppercase tracking-widest text-secondary font-bold">{eyebrow}</span>
      <h2 className="font-headline-xl text-headline-xl text-primary font-bold tracking-tight mt-1">{title}</h2>
      {text && <p className="font-body-lg text-body-lg text-on-surface-variant mt-space-xs">{text}</p>}
    </div>
  );
}

function Icon({ name, className = "" }: { name: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{name}</span>;
}

export default function Home() {
  const featured = FEATURES_DATA.slice(0, 6);

  return (
    <>
      <SiteHeader activePath="/" />

      <main className="w-full pt-20 bg-surface">
        {/* HERO */}
        <section className="relative w-full overflow-hidden bg-primary text-on-primary">
          <div className="absolute inset-0 bg-gradient-to-b from-primary via-primary-container to-primary" />
          <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-secondary-container/25 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-on-tertiary-container/15 blur-3xl pointer-events-none" />
          <div className="relative z-10 max-w-7xl mx-auto px-margin-lg py-space-xl lg:py-24 grid lg:grid-cols-2 gap-space-xl items-center">
            <div>
              <div className="inline-flex items-center gap-space-xs px-space-md py-1 rounded-full bg-surface-container-lowest/10 backdrop-blur-md mb-space-md">
                <span className="w-2 h-2 rounded-full bg-on-tertiary-container animate-pulse" />
                <span className="font-label-sm text-label-sm uppercase tracking-widest text-primary-fixed">Hệ thống điều phối vận tải thông minh</span>
              </div>
              <h1 className="font-headline-xl text-headline-xl md:font-display-lg md:text-display-lg tracking-tight font-extrabold uppercase">
                Một nền tảng cho mọi <span className="text-on-tertiary-container">chuyến hàng</span> của bạn
              </h1>
              <p className="font-body-lg text-body-lg text-surface-dim mt-space-md max-w-xl">
                NEXLOG kết nối khách hàng, điều phối viên và tài xế trên cùng một hệ thống: đặt đơn, lập chuyến, giám sát GPS và tra cứu hành trình theo thời gian thực.
              </p>
              <div className="mt-space-lg flex flex-wrap gap-space-sm">
                <Link
                  href="/tinh-nang"
                  className="px-6 py-3 rounded-xl font-label-lg text-on-primary bg-on-tertiary-container hover:bg-tertiary-container shadow-lg transition-all font-bold inline-flex items-center gap-2"
                >
                  <Icon name="stars" className="text-xl" />
                  Xem tính năng & giao diện
                </Link>
                {siteConfig.appUrl ? (
                  <a href={siteConfig.appUrl} className="px-5 py-3 rounded-xl font-label-lg text-on-primary bg-surface-container-lowest/20 hover:bg-surface-container-lowest/30 backdrop-blur-md transition-all font-semibold inline-flex items-center gap-2">
                    <Icon name="open_in_new" className="text-xl" />
                    Truy cập hệ thống
                  </a>
                ) : (
                  <a href="#quy-trinh" className="px-5 py-3 rounded-xl font-label-lg text-on-primary bg-surface-container-lowest/20 hover:bg-surface-container-lowest/30 backdrop-blur-md transition-all font-semibold inline-flex items-center gap-2">
                    <Icon name="route" className="text-xl" />
                    Xem quy trình vận chuyển
                  </a>
                )}
              </div>
            </div>
            <div className="relative">
              <div className="rounded-2xl bg-surface-container-lowest p-space-lg shadow-2xl">
                <img src="/nexlog-banner.png" alt="NEXLOG – Next Logistics" className="w-full h-auto rounded-xl" />
              </div>
            </div>
          </div>
        </section>

        {/* HIGHLIGHTS */}
        <section className="w-full py-space-xl bg-surface">
          <div className="max-w-7xl mx-auto px-margin-lg grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-gutter-lg">
            {HIGHLIGHTS.map((h) => (
              <Link
                key={h.title}
                href={h.href}
                className="group bg-surface-container-lowest rounded-xl p-space-lg shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between"
              >
                <div>
                  <div className="w-14 h-14 rounded-lg bg-surface-container-high flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-on-primary transition-all mb-space-md">
                    <Icon name={h.icon} className="text-3xl" />
                  </div>
                  <h3 className="font-headline-md text-headline-md text-primary font-bold mb-space-xs group-hover:text-secondary transition-colors">
                    {h.title}
                  </h3>
                  <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">{h.text}</p>
                </div>
                <span className="mt-space-md inline-flex items-center gap-1 font-label-md text-label-md text-secondary font-semibold">
                  Xem hướng dẫn
                  <Icon name="arrow_forward" className="text-base group-hover:translate-x-1 transition-transform" />
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* ABOUT */}
        <section id="gioi-thieu" className="w-full py-space-xl bg-surface-container-low scroll-mt-20">
          <div className="max-w-7xl mx-auto px-margin-lg grid lg:grid-cols-2 gap-space-xl items-center">
            <div>
              <span className="font-label-sm text-label-sm uppercase tracking-widest text-secondary font-bold">Về dự án</span>
              <h2 className="font-headline-xl text-headline-xl text-primary font-bold tracking-tight mt-1">NEXLOG là gì?</h2>
              <p className="font-body-lg text-body-lg text-on-surface-variant mt-space-sm">
                NEXLOG là hệ thống quản lý và điều phối vận tải đường bộ phục vụ hoạt động logistics gắn với ga hàng hóa hàng không. Dự án số hóa toàn bộ vòng đời của một đơn hàng, từ lúc tiếp nhận yêu cầu, chốt giá, lập chuyến, vận chuyển cho đến giao hàng và xử lý bồi thường.
              </p>
              <p className="font-body-lg text-body-lg text-on-surface-variant mt-space-sm">
                Mục tiêu là giúp khách hàng luôn biết hàng của mình đang ở đâu, giúp điều phối viên ra quyết định nhanh hơn và giúp tài xế thao tác đơn giản ngay trên điện thoại.
              </p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-space-md">
              {STATS.map((s) => (
                <div key={s.label} className="bg-primary-container text-on-primary rounded-xl p-space-lg text-center shadow-lg">
                  <div className="font-display-lg-mobile text-display-lg-mobile font-extrabold text-on-tertiary-container">{s.value}</div>
                  <div className="font-label-md text-label-md text-surface-dim mt-1">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* WORKFLOW */}
        <section id="quy-trinh" className="w-full py-space-xl bg-surface scroll-mt-20">
          <div className="max-w-7xl mx-auto px-margin-lg">
            <SectionHeader
              eyebrow="Hành trình của một đơn hàng"
              title="Quy trình vận chuyển 6 giai đoạn"
              text="Mỗi đơn hàng đi qua các trạng thái rõ ràng, giúp bạn luôn nắm được tiến độ."
            />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-gutter-lg">
              {STAGES.map((s) => (
                <div key={s.n} className="relative bg-surface-container-lowest rounded-xl p-space-lg shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col">
                  <div className="flex items-center justify-between mb-space-md">
                    <div className="w-12 h-12 rounded-lg bg-tertiary-fixed text-on-tertiary-fixed-variant flex items-center justify-center">
                      <Icon name={s.icon} className="text-3xl" />
                    </div>
                    <span className="font-display-lg-mobile text-display-lg-mobile font-extrabold text-surface-container-highest">{String(s.n).padStart(2, "0")}</span>
                  </div>
                  <h3 className="font-headline-md text-headline-md text-primary font-bold">{s.title}</h3>
                  <span className="inline-block self-start mt-space-xs px-2 py-0.5 rounded bg-surface-container-high text-secondary font-data-mono text-label-sm font-semibold">{s.status}</span>
                  <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed mt-space-sm">{s.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FEATURES (CLICKABLE TO DETAIL PAGES) */}
        <section id="tinh-nang" className="w-full py-space-xl bg-primary-container text-on-primary relative overflow-hidden scroll-mt-20">
          <div className="absolute -bottom-20 -left-20 w-80 h-80 rounded-full bg-secondary/20 blur-3xl pointer-events-none" />
          <div className="absolute -top-20 -right-20 w-96 h-96 rounded-full bg-on-tertiary-container/10 blur-3xl pointer-events-none" />
          <div className="relative z-10 max-w-7xl mx-auto px-margin-lg">
            <div className="text-center max-w-3xl mx-auto mb-space-xl">
              <span className="font-label-sm text-label-sm uppercase tracking-widest text-on-tertiary-container font-bold">
                Khám phá chi tiết
              </span>
              <h2 className="font-headline-xl text-headline-xl text-on-primary font-bold tracking-tight mt-1">
                Tính năng nổi bật của NEXLOG
              </h2>
              <p className="font-body-lg text-body-lg text-surface-dim mt-space-xs">
                Bấm vào từng tính năng để xem hướng dẫn hoạt động và ảnh giao diện thực tế trên hệ thống.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-gutter-lg">
              {featured.map((f) => (
                <Link
                  key={f.slug}
                  href={`/tinh-nang/${f.slug}`}
                  className="group bg-surface-container-lowest/10 backdrop-blur-md rounded-xl p-space-lg hover:bg-surface-container-lowest/18 border border-on-primary/10 hover:border-on-tertiary-container/60 transition-all shadow-lg flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-space-sm">
                      <div className="w-12 h-12 rounded-full bg-on-tertiary-container/20 text-on-tertiary-container flex items-center justify-center">
                        <Icon name={f.icon} className="text-3xl" />
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full bg-surface-container-lowest/10 text-surface-dim font-label-sm text-label-sm">
                        {f.screens.length} ảnh demo
                      </span>
                    </div>
                    <h3 className="font-headline-sm text-headline-sm text-on-primary font-bold group-hover:text-on-tertiary-container transition-colors">
                      {f.title}
                    </h3>
                    <p className="font-body-md text-body-md text-surface-dim mt-space-xs leading-relaxed">
                      {f.shortText}
                    </p>
                  </div>
                  <div className="mt-space-md pt-space-sm border-t border-on-primary/10 flex items-center justify-between font-label-md text-label-md text-on-tertiary-container font-bold">
                    <span>Xem hướng dẫn & giao diện</span>
                    <Icon name="arrow_forward" className="text-lg group-hover:translate-x-1 transition-transform" />
                  </div>
                </Link>
              ))}
            </div>
            <div className="mt-space-xl text-center">
              <Link
                href="/tinh-nang"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-label-lg text-on-primary bg-on-tertiary-container hover:bg-tertiary-container shadow-lg transition-all font-bold"
              >
                <Icon name="photo_library" className="text-xl" />
                Xem tất cả {FEATURES_DATA.length} tính năng & luồng nghiệp vụ
              </Link>
            </div>
          </div>
        </section>

        {/* SYSTEM */}
        <section id="he-thong" className="w-full py-space-xl bg-surface scroll-mt-20">
          <div className="max-w-7xl mx-auto px-margin-lg flex flex-col gap-space-xl">
            <div>
              <SectionHeader eyebrow="Vai trò trong hệ thống" title="Một hệ thống, bốn cổng thông tin" />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-gutter-lg">
                {ROLES.map((r) => (
                  <Link
                    key={r.title}
                    href={r.href}
                    className="group bg-surface-container-lowest rounded-xl p-space-lg shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between"
                  >
                    <div>
                      <div className="w-12 h-12 rounded-lg bg-surface-container-high text-primary group-hover:bg-primary group-hover:text-on-primary transition-all flex items-center justify-center mb-space-sm">
                        <Icon name={r.icon} className="text-3xl" />
                      </div>
                      <h3 className="font-headline-md text-headline-md text-primary font-bold group-hover:text-secondary transition-colors">
                        {r.title}
                      </h3>
                      <p className="font-body-md text-body-md text-on-surface-variant mt-space-xs">{r.text}</p>
                    </div>
                    <span className="mt-space-md inline-flex items-center gap-1 font-label-md text-label-md text-secondary font-semibold">
                      Xem giao diện
                      <Icon name="arrow_forward" className="text-base group-hover:translate-x-1 transition-transform" />
                    </span>
                  </Link>
                ))}
              </div>
            </div>
            <div>
              <SectionHeader eyebrow="Nền tảng kỹ thuật" title="Công nghệ phía sau NEXLOG" />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-gutter-lg">
                {TECH.map((t) => (
                  <div key={t.title} className="bg-surface-container-low rounded-xl p-space-lg">
                    <div className="flex items-center gap-space-xs text-secondary mb-space-xs">
                      <Icon name={t.icon} />
                      <span className="font-headline-sm text-headline-sm font-bold text-primary uppercase tracking-wider">{t.title}</span>
                    </div>
                    <p className="font-body-md text-body-md text-on-surface-variant">{t.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="w-full py-space-xl bg-surface-container-low scroll-mt-20">
          <div className="max-w-3xl mx-auto px-margin-lg">
            <SectionHeader eyebrow="Giải đáp nhanh" title="Câu hỏi thường gặp" />
            <div className="flex flex-col gap-space-sm">
              {FAQ.map((f) => (
                <details key={f.q} className="group bg-surface-container-lowest rounded-xl shadow-sm">
                  <summary className="list-none cursor-pointer flex items-center justify-between gap-space-md p-space-lg font-headline-sm text-headline-sm text-primary font-bold">
                    {f.q}
                    <Icon name="expand_more" className="text-secondary transition-transform group-open:rotate-180" />
                  </summary>
                  <p className="px-space-lg pb-space-lg font-body-md text-body-md text-on-surface-variant leading-relaxed">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* CONTACT */}
        <section id="lien-he" className="w-full py-space-xl bg-surface scroll-mt-20">
          <div className="max-w-4xl mx-auto px-margin-lg text-center">
            <SectionHeader
              eyebrow="Liên hệ"
              title="Bạn muốn tìm hiểu thêm?"
              text="Xem mã nguồn và tài liệu của dự án hoặc liên hệ với nhóm phát triển."
            />
            <div className="flex flex-wrap justify-center gap-space-sm">
              <a href={siteConfig.repoUrl} target="_blank" rel="noopener noreferrer" className="px-6 py-3 rounded-xl font-label-lg text-on-primary bg-primary hover:bg-primary-container transition-all font-bold inline-flex items-center gap-2">
                <Icon name="code" className="text-xl" />
                Xem dự án trên GitHub
              </a>
              {siteConfig.contactEmail && (
                <a href={`mailto:${siteConfig.contactEmail}`} className="px-6 py-3 rounded-xl font-label-lg text-on-primary bg-on-tertiary-container hover:bg-tertiary-container transition-all font-bold inline-flex items-center gap-2">
                  <Icon name="mail" className="text-xl" />
                  {siteConfig.contactEmail}
                </a>
              )}
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
