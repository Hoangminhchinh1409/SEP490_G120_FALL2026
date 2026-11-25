"use client";
import React from "react";

export default function HomeFooterSection({ onOpenConsultation }) {
  return (
    <>
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
                onClick={onOpenConsultation}
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
          onClick={onOpenConsultation}
          className="w-14 h-14 rounded-full bg-on-tertiary-container text-on-primary shadow-xl hover:bg-tertiary-container flex items-center justify-center transition-all cursor-pointer hover:scale-105"
          type="button"
        >
          <span className="material-symbols-outlined text-2xl">chat</span>
        </button>
      </div>
    </>
  );
}
