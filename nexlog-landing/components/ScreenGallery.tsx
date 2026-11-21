"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useState } from "react";
import type { FeatureScreen } from "@/data/features";

export function ScreenGallery({ screens }: { screens: FeatureScreen[] }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  useEffect(() => {
    if (activeIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActiveIndex(null);
      if (e.key === "ArrowRight") setActiveIndex((i) => (i === null ? null : (i + 1) % screens.length));
      if (e.key === "ArrowLeft")
        setActiveIndex((i) => (i === null ? null : (i - 1 + screens.length) % screens.length));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeIndex, screens.length]);

  const allMobile = screens.every((s) => s.isMobile);

  return (
    <>
      <div
        className={
          allMobile
            ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-gutter-lg"
            : "grid grid-cols-1 md:grid-cols-2 gap-gutter-lg"
        }
      >
        {screens.map((screen, idx) => (
          <button
            key={screen.src}
            type="button"
            onClick={() => setActiveIndex(idx)}
            className="group text-left bg-surface-container-lowest rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 border border-outline-variant/30 flex flex-col cursor-pointer"
          >
            <div className="relative bg-surface-container-low p-space-md flex items-center justify-center overflow-hidden">
              <img
                src={screen.src}
                alt={screen.title}
                loading="lazy"
                className={
                  screen.isMobile
                    ? "h-80 w-auto rounded-2xl shadow-lg object-contain group-hover:scale-[1.02] transition-transform duration-300"
                    : "w-full h-56 sm:h-64 object-cover object-top rounded-lg shadow-sm group-hover:scale-[1.02] transition-transform duration-300"
                }
              />
              <span className="absolute bottom-space-sm right-space-sm inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/85 text-on-primary font-label-sm text-label-sm backdrop-blur-sm opacity-90 group-hover:opacity-100">
                <span className="material-symbols-outlined text-sm">zoom_in</span>
                Phóng to
              </span>
            </div>
            <div className="p-space-lg flex-1 flex flex-col">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-headline-sm text-headline-sm text-primary font-bold group-hover:text-secondary transition-colors">
                  {screen.title}
                </h3>
                <span className="font-data-mono text-label-sm text-outline shrink-0">
                  {String(idx + 1).padStart(2, "0")}/{String(screens.length).padStart(2, "0")}
                </span>
              </div>
              <p className="font-body-md text-body-md text-on-surface-variant mt-space-xs leading-relaxed">
                {screen.caption}
              </p>
            </div>
          </button>
        ))}
      </div>

      {activeIndex !== null && (
        <div
          className="fixed inset-0 z-50 bg-primary/90 backdrop-blur-sm flex items-center justify-center p-space-md sm:p-space-lg"
          role="dialog"
          aria-modal="true"
          onClick={() => setActiveIndex(null)}
        >
          <div
            className="relative max-w-6xl w-full max-h-[92vh] bg-surface-container-lowest rounded-2xl shadow-2xl overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-space-lg py-space-md border-b border-outline-variant/30">
              <div>
                <div className="font-headline-sm text-headline-sm text-primary font-bold">
                  {screens[activeIndex].title}
                </div>
                <div className="font-label-sm text-label-sm text-outline">
                  Ảnh {activeIndex + 1} / {screens.length} · Dùng phím ← / → để chuyển ảnh
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveIndex(null)}
                aria-label="Đóng"
                className="w-10 h-10 rounded-xl bg-surface-container-low hover:bg-surface-container-high text-primary flex items-center justify-center cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="relative flex-1 bg-surface-container-low flex items-center justify-center p-space-md overflow-auto">
              <img
                src={screens[activeIndex].src}
                alt={screens[activeIndex].title}
                className="max-h-[68vh] w-auto max-w-full rounded-lg shadow-lg object-contain"
              />
              {screens.length > 1 && (
                <>
                  <button
                    type="button"
                    aria-label="Ảnh trước"
                    onClick={() =>
                      setActiveIndex((activeIndex - 1 + screens.length) % screens.length)
                    }
                    className="absolute left-space-md top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-primary/85 hover:bg-primary text-on-primary shadow-lg flex items-center justify-center cursor-pointer"
                  >
                    <span className="material-symbols-outlined">chevron_left</span>
                  </button>
                  <button
                    type="button"
                    aria-label="Ảnh tiếp theo"
                    onClick={() => setActiveIndex((activeIndex + 1) % screens.length)}
                    className="absolute right-space-md top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-primary/85 hover:bg-primary text-on-primary shadow-lg flex items-center justify-center cursor-pointer"
                  >
                    <span className="material-symbols-outlined">chevron_right</span>
                  </button>
                </>
              )}
            </div>

            <div className="px-space-lg py-space-md bg-surface-container-lowest border-t border-outline-variant/30">
              <p className="font-body-md text-body-md text-on-surface-variant">
                {screens[activeIndex].caption}
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
