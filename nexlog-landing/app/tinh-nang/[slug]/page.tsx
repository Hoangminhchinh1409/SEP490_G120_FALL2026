import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { ScreenGallery } from "@/components/ScreenGallery";
import { FEATURES_DATA, getFeatureBySlug } from "@/data/features";
import { siteConfig } from "@/site.config";

export function generateStaticParams() {
  return FEATURES_DATA.map((f) => ({ slug: f.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const feature = getFeatureBySlug(slug);
  if (!feature) return { title: "Tính năng – NEXLOG" };
  return {
    title: `${feature.title} – NEXLOG`,
    description: feature.shortText,
  };
}

export default async function FeatureDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const idx = FEATURES_DATA.findIndex((f) => f.slug === slug);
  if (idx === -1) notFound();

  const feature = FEATURES_DATA[idx];
  const prevFeature = idx > 0 ? FEATURES_DATA[idx - 1] : null;
  const nextFeature = idx < FEATURES_DATA.length - 1 ? FEATURES_DATA[idx + 1] : null;

  return (
    <>
      <SiteHeader activePath="/tinh-nang" />
      <main className="w-full pt-20 bg-surface flex-1">
        {/* HERO */}
        <section className="relative w-full overflow-hidden bg-primary text-on-primary">
          <div className="absolute inset-0 bg-gradient-to-b from-primary via-primary-container to-primary" />
          <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-secondary-container/25 blur-3xl pointer-events-none" />
          <div className="relative z-10 max-w-7xl mx-auto px-margin-lg py-space-xl lg:py-16">
            <nav className="flex flex-wrap items-center gap-2 font-label-md text-label-md text-surface-dim mb-space-md">
              <Link href="/" className="hover:text-on-primary transition-colors">
                Trang chủ
              </Link>
              <span>/</span>
              <Link href="/tinh-nang" className="hover:text-on-primary transition-colors">
                Tính năng & Demo
              </Link>
              <span>/</span>
              <span className="text-on-tertiary-container font-semibold">{feature.title}</span>
            </nav>

            <div className="grid lg:grid-cols-12 gap-space-xl items-center">
              <div className="lg:col-span-7">
                <div className="inline-flex items-center gap-space-xs px-space-md py-1 rounded-full bg-surface-container-lowest/10 backdrop-blur-md mb-space-sm">
                  <span className="material-symbols-outlined text-base text-on-tertiary-container">
                    {feature.icon}
                  </span>
                  <span className="font-label-sm text-label-sm uppercase tracking-widest text-primary-fixed">
                    {feature.roleLabel}
                  </span>
                </div>
                <h1 className="font-headline-xl text-headline-xl md:font-display-lg md:text-display-lg font-extrabold tracking-tight">
                  {feature.title}
                </h1>
                <p className="font-body-lg text-body-lg text-surface-dim mt-space-md">
                  {feature.heroText}
                </p>
                <div className="mt-space-lg flex flex-wrap gap-space-sm">
                  <a
                    href="#giao-dien"
                    className="px-6 py-3 rounded-xl font-label-lg text-on-primary bg-on-tertiary-container hover:bg-tertiary-container shadow-lg transition-all font-bold inline-flex items-center gap-2"
                  >
                    <span className="material-symbols-outlined text-xl">photo_library</span>
                    Xem {feature.screens.length} ảnh giao diện
                  </a>
                  <a
                    href="#huong-dan"
                    className="px-5 py-3 rounded-xl font-label-lg text-on-primary bg-surface-container-lowest/20 hover:bg-surface-container-lowest/30 backdrop-blur-md transition-all font-semibold inline-flex items-center gap-2"
                  >
                    <span className="material-symbols-outlined text-xl">format_list_numbered</span>
                    Cách hoạt động
                  </a>
                </div>
              </div>

              <div className="lg:col-span-5">
                <div className="rounded-2xl bg-surface-container-lowest/10 backdrop-blur-md p-space-lg border border-on-primary/15">
                  <div className="font-label-sm text-label-sm uppercase tracking-widest text-on-tertiary-container font-bold mb-space-sm">
                    Điểm nổi bật
                  </div>
                  <ul className="flex flex-col gap-space-sm">
                    {feature.highlights.map((h) => (
                      <li key={h} className="flex items-start gap-space-xs font-body-md text-body-md text-surface-dim">
                        <span className="material-symbols-outlined text-on-tertiary-container text-xl shrink-0 mt-0.5">
                          check_circle
                        </span>
                        <span>{h}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* STEP-BY-STEP GUIDE */}
        <section id="huong-dan" className="w-full py-space-xl bg-surface-container-low scroll-mt-20">
          <div className="max-w-7xl mx-auto px-margin-lg">
            <div className="max-w-3xl mb-space-lg">
              <span className="font-label-sm text-label-sm uppercase tracking-widest text-secondary font-bold">
                Hướng dẫn chi tiết
              </span>
              <h2 className="font-headline-xl text-headline-xl text-primary font-bold tracking-tight mt-1">
                Cách tính năng hoạt động
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-gutter-lg">
              {feature.steps.map((s) => (
                <div
                  key={s.title}
                  className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm border border-outline-variant/30"
                >
                  <h3 className="font-headline-md text-headline-md text-primary font-bold">
                    {s.title}
                  </h3>
                  <p className="font-body-md text-body-md text-on-surface-variant mt-space-xs leading-relaxed">
                    {s.detail}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* SCREENSHOT GALLERY */}
        <section id="giao-dien" className="w-full py-space-xl bg-surface scroll-mt-20">
          <div className="max-w-7xl mx-auto px-margin-lg">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-space-sm mb-space-lg">
              <div>
                <span className="font-label-sm text-label-sm uppercase tracking-widest text-secondary font-bold">
                  Demo trực quan
                </span>
                <h2 className="font-headline-xl text-headline-xl text-primary font-bold tracking-tight mt-1">
                  Giao diện thực tế trên hệ thống
                </h2>
                <p className="font-body-md text-body-md text-on-surface-variant mt-1">
                  Bấm vào từng ảnh để phóng to toàn màn hình. Dữ liệu hiển thị trên ảnh là dữ liệu minh họa.
                </p>
              </div>
            </div>
            <ScreenGallery screens={feature.screens} />
          </div>
        </section>

        {/* PREV / NEXT NAVIGATION */}
        <section className="w-full py-space-xl bg-surface-container-low border-t border-outline-variant/30">
          <div className="max-w-7xl mx-auto px-margin-lg">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-md">
              {prevFeature ? (
                <Link
                  href={`/tinh-nang/${prevFeature.slug}`}
                  className="group bg-surface-container-lowest rounded-xl p-space-lg shadow-sm hover:shadow-md transition-all flex items-center gap-space-md"
                >
                  <span className="material-symbols-outlined text-secondary text-2xl group-hover:-translate-x-1 transition-transform">
                    arrow_back
                  </span>
                  <div>
                    <div className="font-label-sm text-label-sm uppercase text-outline">
                      Tính năng trước
                    </div>
                    <div className="font-headline-sm text-headline-sm text-primary font-bold group-hover:text-secondary">
                      {prevFeature.title}
                    </div>
                  </div>
                </Link>
              ) : (
                <div />
              )}
              {nextFeature ? (
                <Link
                  href={`/tinh-nang/${nextFeature.slug}`}
                  className="group bg-surface-container-lowest rounded-xl p-space-lg shadow-sm hover:shadow-md transition-all flex items-center justify-end text-right gap-space-md"
                >
                  <div>
                    <div className="font-label-sm text-label-sm uppercase text-outline">
                      Tính năng tiếp theo
                    </div>
                    <div className="font-headline-sm text-headline-sm text-primary font-bold group-hover:text-secondary">
                      {nextFeature.title}
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-secondary text-2xl group-hover:translate-x-1 transition-transform">
                    arrow_forward
                  </span>
                </Link>
              ) : (
                <div />
              )}
            </div>

            <div className="mt-space-lg flex flex-wrap items-center justify-center gap-space-sm">
              <Link
                href="/tinh-nang"
                className="px-5 py-2.5 rounded-xl font-label-lg text-primary bg-surface-container-lowest hover:bg-surface-container-high border border-outline-variant/40 transition-all font-bold inline-flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-lg">apps</span>
                Tất cả tính năng
              </Link>
              {siteConfig.contactEmail && (
                <a
                  href={`mailto:${siteConfig.contactEmail}`}
                  className="px-5 py-2.5 rounded-xl font-label-lg text-on-primary bg-on-tertiary-container hover:bg-tertiary-container transition-all font-bold inline-flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-lg">mail</span>
                  Liên hệ tư vấn
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
