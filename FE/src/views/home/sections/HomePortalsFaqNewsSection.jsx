/* eslint-disable @next/next/no-img-element */

"use client";
import React from "react";
import Link from "next/link";
import { SYSTEM_PORTALS, FAQ_ITEMS } from "./homePageData";

export default function HomePortalsFaqNewsSection({ blogs, blogsLoading }) {
  return (
    <>
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
              Phân tách rõ ràng không gian làm việc theo từng vai trò vận hành
              trong quy trình logistics.
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
      <section id="faq" className="w-full py-space-xl bg-surface scroll-mt-20">
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
    </>
  );
}
