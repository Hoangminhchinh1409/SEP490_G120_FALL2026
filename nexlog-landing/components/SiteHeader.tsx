/* eslint-disable @next/next/no-img-element */
import Link from "next/link";

const NAV = [
  { href: "/#gioi-thieu", label: "Giới thiệu" },
  { href: "/#quy-trinh", label: "Quy trình" },
  { href: "/tinh-nang", label: "Tính năng & Demo" },
  { href: "/#he-thong", label: "Hệ thống" },
  { href: "/#faq", label: "Hỏi đáp" },
  { href: "/#lien-he", label: "Liên hệ" },
];

export function SiteHeader({ activePath }: { activePath?: string }) {
  return (
    <header className="fixed top-0 w-full z-50 bg-surface-container-lowest/90 backdrop-blur-xl shadow-[0_1px_8px_rgba(15,43,92,0.06)]">
      <div className="h-20 w-full px-margin-lg flex items-center justify-between max-w-7xl mx-auto">
        <Link href="/" className="flex items-center gap-space-sm">
          <img src="/logo-icon.png" alt="Logo" className="w-9 h-9 object-contain" />
          <img src="/logo-text.png" alt="NEXLOG" className="h-7 w-auto object-contain" />
        </Link>
        <nav className="hidden lg:flex items-center gap-space-lg">
          {NAV.map((n) => {
            const isActive = activePath === n.href;
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`font-label-lg text-label-lg transition-colors ${
                  isActive
                    ? "text-secondary font-bold"
                    : "text-on-surface-variant hover:text-secondary"
                }`}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-space-sm">
          <Link
            href="/#lien-he"
            className="hidden sm:inline-flex px-space-md py-space-sm rounded-xl font-label-lg text-label-lg text-on-primary bg-on-tertiary-container hover:bg-tertiary-container transition-all font-bold"
          >
            Liên hệ
          </Link>
          <details className="lg:hidden relative">
            <summary className="list-none cursor-pointer w-10 h-10 rounded-lg bg-surface-container-low flex items-center justify-center text-primary">
              <span className="material-symbols-outlined">menu</span>
            </summary>
            <div className="absolute right-0 mt-2 w-60 rounded-xl bg-surface-container-lowest shadow-xl p-space-sm flex flex-col">
              {NAV.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  className="px-space-md py-space-sm rounded-lg font-label-lg text-label-lg text-on-surface hover:bg-surface-container-low"
                >
                  {n.label}
                </Link>
              ))}
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}
