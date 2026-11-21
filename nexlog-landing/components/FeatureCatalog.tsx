"use client";
/* eslint-disable @next/next/no-img-element */

import { useState } from "react";
import Link from "next/link";
import { FEATURES_DATA, ROLE_FILTERS, type RoleGroup } from "@/data/features";

export function FeatureCatalog() {
  const [filter, setFilter] = useState<"all" | RoleGroup>("all");

  const items =
    filter === "all"
      ? FEATURES_DATA
      : FEATURES_DATA.filter((f) => f.roleGroup === filter);

  return (
    <div>
      {/* Role filter pills */}
      <div className="flex flex-wrap items-center justify-center gap-space-xs sm:gap-space-sm mb-space-xl">
        {ROLE_FILTERS.map((r) => {
          const active = filter === r.id;
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => setFilter(r.id)}
              className={`inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-label-lg text-label-lg transition-all cursor-pointer ${
                active
                  ? "bg-primary text-on-primary shadow-md"
                  : "bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-high hover:text-primary border border-outline-variant/40"
              }`}
            >
              <span className="material-symbols-outlined text-lg">{r.icon}</span>
              {r.label}
            </button>
          );
        })}
      </div>

      {/* Feature cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-gutter-lg">
        {items.map((f) => (
          <Link
            key={f.slug}
            href={`/tinh-nang/${f.slug}`}
            className="group bg-surface-container-lowest rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 border border-outline-variant/30 flex flex-col"
          >
            <div className="relative h-48 bg-surface-container-low overflow-hidden flex items-center justify-center">
              <img
                src={f.coverScreen}
                alt={f.title}
                loading="lazy"
                className={
                  f.roleGroup === "tai-xe"
                    ? "h-full w-auto py-3 object-contain group-hover:scale-105 transition-transform duration-500"
                    : "w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500"
                }
              />
              <span className="absolute top-space-sm left-space-sm px-2.5 py-1 rounded-full bg-primary/90 text-on-primary font-label-sm text-label-sm backdrop-blur-sm">
                {f.roleLabel}
              </span>
              <span className="absolute bottom-space-sm right-space-sm px-2.5 py-1 rounded-full bg-surface-container-lowest/90 text-primary font-data-mono text-label-sm font-semibold shadow-sm">
                {f.screens.length} ảnh màn hình
              </span>
            </div>
            <div className="p-space-lg flex-1 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-space-xs text-on-tertiary-container mb-space-xs">
                  <span className="material-symbols-outlined text-xl">{f.icon}</span>
                  <span className="font-label-sm text-label-sm uppercase tracking-wider font-bold">
                    Hướng dẫn & Giao diện
                  </span>
                </div>
                <h3 className="font-headline-md text-headline-md text-primary font-bold group-hover:text-secondary transition-colors">
                  {f.title}
                </h3>
                <p className="font-body-md text-body-md text-on-surface-variant mt-space-xs leading-relaxed">
                  {f.shortText}
                </p>
              </div>
              <div className="pt-space-md mt-space-md border-t border-outline-variant/30 flex items-center justify-between text-secondary font-label-lg text-label-lg font-bold">
                <span>Xem chi tiết tính năng</span>
                <span className="material-symbols-outlined text-lg group-hover:translate-x-1 transition-transform">
                  arrow_forward
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
