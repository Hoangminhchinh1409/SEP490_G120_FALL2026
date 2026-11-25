/* eslint-disable @next/next/no-img-element */

"use client";
import React from "react";
import Link from "next/link";
import { NAV_ITEMS } from "./homePageData";

export default function HomeHeaderSection({
  activeSection,
  scrollToSection,
  onOpenConsultation,
}) {
  return (
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
            {NAV_ITEMS.map((navItem) => {
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
            onClick={onOpenConsultation}
            className="px-space-md py-space-sm rounded-xl font-label-lg text-label-lg text-on-primary bg-on-tertiary-container hover:bg-tertiary-container transition-all cursor-pointer font-bold shadow-sm"
          >
            Gửi yêu cầu
          </button>
        </div>
      </div>
    </header>
  );
}
