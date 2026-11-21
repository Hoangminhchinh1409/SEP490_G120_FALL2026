/* eslint-disable @next/next/no-img-element */
export function SiteFooter() {
  return (
    <footer className="w-full bg-primary text-surface-container-high mt-auto">
      <div className="max-w-7xl mx-auto px-margin-lg py-space-xl flex flex-col md:flex-row items-center justify-between gap-space-md">
        <div className="flex items-center gap-space-sm">
          <img src="/logo-icon.png" alt="" className="w-9 h-9 object-contain" />
          <div>
            <div className="font-headline-md text-headline-md text-on-primary">NEXLOG</div>
            <div className="font-body-sm text-body-sm text-surface-dim">
              Hệ thống điều phối vận tải thông minh
            </div>
          </div>
        </div>
        <p className="font-label-sm text-label-sm text-surface-dim text-center md:text-right">
          © 2026 NEXLOG. All rights reserved.
          <br />
          Trang này chỉ mang tính giới thiệu dự án.
        </p>
      </div>
    </footer>
  );
}
