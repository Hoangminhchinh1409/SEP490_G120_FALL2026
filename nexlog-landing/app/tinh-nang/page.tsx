import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { FeatureCatalog } from "@/components/FeatureCatalog";
import { END_TO_END_FLOW, FEATURES_DATA } from "@/data/features";
import { siteConfig } from "@/site.config";

export const metadata: Metadata = {
  title: "Tính năng & Hướng dẫn giao diện – NEXLOG",
  description:
    "Khám phá chi tiết các tính năng nổi bật của NEXLOG kèm hướng dẫn vận hành và ảnh giao diện thực tế.",
};

export default function FeaturesOverviewPage() {
  const totalScreens = FEATURES_DATA.reduce((sum, f) => sum + f.screens.length, 0);

  return (
    <>
      <SiteHeader activePath="/tinh-nang" />
      <main className="w-full pt-20 bg-surface flex-1">
        {/* HERO */}
        <section className="relative w-full overflow-hidden bg-primary text-on-primary">
          <div className="absolute inset-0 bg-gradient-to-b from-primary via-primary-container to-primary" />
          <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-secondary-container/25 blur-3xl pointer-events-none" />
          <div className="relative z-10 max-w-7xl mx-auto px-margin-lg py-space-xl lg:py-16">
            <nav className="flex items-center gap-2 font-label-md text-label-md text-surface-dim mb-space-md">
              <Link href="/" className="hover:text-on-primary transition-colors">
                Trang chủ
              </Link>
              <span>/</span>
              <span className="text-on-tertiary-container font-semibold">Tính năng & Demo</span>
            </nav>
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-space-xs px-space-md py-1 rounded-full bg-surface-container-lowest/10 backdrop-blur-md mb-space-sm">
                <span className="w-2 h-2 rounded-full bg-on-tertiary-container" />
                <span className="font-label-sm text-label-sm uppercase tracking-widest text-primary-fixed">
                  {FEATURES_DATA.length} nhóm tính năng · {totalScreens} ảnh giao diện thực tế
                </span>
              </div>
              <h1 className="font-headline-xl text-headline-xl md:font-display-lg md:text-display-lg font-extrabold tracking-tight">
                Khám phá tính năng <span className="text-on-tertiary-container">NEXLOG</span>
              </h1>
              <p className="font-body-lg text-body-lg text-surface-dim mt-space-sm">
                Chọn một tính năng bên dưới để xem hướng dẫn hoạt động từng bước và ảnh giao diện trực quan của hệ thống.
              </p>
            </div>
          </div>
        </section>

        {/* CATALOG */}
        <section className="w-full py-space-xl bg-surface">
          <div className="max-w-7xl mx-auto px-margin-lg">
            <FeatureCatalog />
          </div>
        </section>

        {/* END-TO-END FLOW */}
        <section className="w-full py-space-xl bg-surface-container-low">
          <div className="max-w-7xl mx-auto px-margin-lg">
            <div className="text-center max-w-3xl mx-auto mb-space-xl">
              <span className="font-label-sm text-label-sm uppercase tracking-widest text-secondary font-bold">
                Toàn cảnh vận hành
              </span>
              <h2 className="font-headline-xl text-headline-xl text-primary font-bold tracking-tight mt-1">
                Luồng nghiệp vụ xuyên suốt 9 bước
              </h2>
              <p className="font-body-lg text-body-lg text-on-surface-variant mt-space-xs">
                Cách các phân hệ Khách hàng, Điều phối viên, Tài xế và Quản lý phối hợp nhịp nhàng trên một đơn hàng.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-space-md">
              {END_TO_END_FLOW.map((item) => (
                <div
                  key={item.step}
                  className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm border border-outline-variant/30 flex gap-space-md"
                >
                  <div className="w-10 h-10 rounded-xl bg-primary text-on-primary font-data-mono font-bold flex items-center justify-center shrink-0">
                    {String(item.step).padStart(2, "0")}
                  </div>
                  <div>
                    <div className="font-label-sm text-label-sm uppercase tracking-wider text-on-tertiary-container font-bold">
                      {item.actor}
                    </div>
                    <h3 className="font-headline-sm text-headline-sm text-primary font-bold mt-0.5">
                      {item.title}
                    </h3>
                    <p className="font-body-md text-body-md text-on-surface-variant mt-1 leading-relaxed">
                      {item.detail}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="w-full py-space-xl bg-surface">
          <div className="max-w-4xl mx-auto px-margin-lg text-center">
            <h2 className="font-headline-lg text-headline-lg text-primary font-bold">
              Cần tư vấn thêm hoặc xem bản chạy thử?
            </h2>
            <p className="font-body-lg text-body-lg text-on-surface-variant mt-space-xs">
              Liên hệ với đội ngũ NEXLOG để được hỗ trợ chi tiết theo nhu cầu vận tải của bạn.
            </p>
            <div className="mt-space-lg flex flex-wrap justify-center gap-space-sm">
              {siteConfig.contactEmail && (
                <a
                  href={`mailto:${siteConfig.contactEmail}`}
                  className="px-6 py-3 rounded-xl font-label-lg text-on-primary bg-on-tertiary-container hover:bg-tertiary-container transition-all font-bold inline-flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-xl">mail</span>
                  {siteConfig.contactEmail}
                </a>
              )}
              <Link
                href="/"
                className="px-6 py-3 rounded-xl font-label-lg text-primary bg-surface-container-high hover:bg-surface-container-highest transition-all font-bold inline-flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-xl">arrow_back</span>
                Quay về trang chủ
              </Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
