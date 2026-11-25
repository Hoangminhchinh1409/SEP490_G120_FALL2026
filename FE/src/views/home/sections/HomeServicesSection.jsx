"use client";
import React from "react";
import { WORKFLOW_STEPS, FEATURES } from "./homePageData";

export default function HomeServicesSection() {
  return (
    <>
      {/* 2. GIỚI THIỆU DỰ ÁN (#gioi-thieu) */}
      <section
        id="gioi-thieu"
        className="w-full py-space-xl bg-surface-container-lowest scroll-mt-20"
      >
        <div className="w-full px-margin-lg max-w-5xl mx-auto text-center">
          <span className="font-label-sm text-label-sm uppercase tracking-widest text-secondary font-bold">
            Về dự án
          </span>
          <h2 className="font-headline-xl text-headline-xl text-primary font-bold tracking-tight mt-1">
            NEXLOG là gì?
          </h2>
          <div className="mt-space-md flex flex-col gap-space-sm font-body-lg text-body-lg text-on-surface-variant leading-relaxed">
            <p>
              NEXLOG là hệ thống quản lý và điều phối vận tải đường bộ phục vụ
              hoạt động logistics gắn với ga hàng hóa hàng không. Dự án số hóa
              toàn bộ vòng đời của một đơn hàng, từ lúc tiếp nhận yêu cầu, chốt
              giá, lập chuyến, vận chuyển cho đến giao hàng và xử lý bồi thường.
            </p>
            <p>
              Mục tiêu là giúp khách hàng luôn biết hàng của mình đang ở đâu,
              giúp điều phối viên ra quyết định nhanh hơn và giúp tài xế thao
              tác đơn giản ngay trên điện thoại.
            </p>
          </div>
        </div>
      </section>

      {/* 3. QUY TRÌNH VẬN CHUYỂN 6 GIAI ĐOẠN (#quy-trinh) */}
      <section
        id="quy-trinh"
        className="w-full py-space-xl bg-surface scroll-mt-20"
      >
        <div className="w-full px-margin-lg max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-space-xl">
            <span className="font-label-sm text-label-sm uppercase tracking-widest text-secondary font-bold">
              Hành trình của một đơn hàng
            </span>
            <h2 className="font-headline-xl text-headline-xl text-primary font-bold tracking-tight mt-1">
              Quy trình vận chuyển 6 giai đoạn
            </h2>
            <p className="font-body-lg text-body-lg text-on-surface-variant mt-space-xs">
              Mỗi đơn hàng đi qua các trạng thái rõ ràng, giúp bạn luôn nắm được
              tiến độ.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-gutter-lg">
            {WORKFLOW_STEPS.map((item) => (
              <div
                key={item.step}
                className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm border border-surface-container-low flex flex-col gap-space-sm"
              >
                <div className="flex items-center justify-between gap-space-xs">
                  <span className="font-data-mono text-headline-md font-extrabold text-on-tertiary-container">
                    {item.step}
                  </span>
                  <span className="px-2.5 py-1 rounded-md bg-surface-container-low text-secondary font-data-mono text-label-sm font-semibold">
                    {item.badge}
                  </span>
                </div>
                <h3 className="font-headline-md text-headline-md text-primary font-bold">
                  {item.title}
                </h3>
                <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. TÍNH NĂNG NỔI BẬT (#tinh-nang) */}
      <section
        id="tinh-nang"
        className="w-full py-space-xl bg-surface-container-lowest scroll-mt-20"
      >
        <div className="w-full px-margin-lg max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-space-xl">
            <span className="font-label-sm text-label-sm uppercase tracking-widest text-secondary font-bold">
              Khám phá chi tiết
            </span>
            <h2 className="font-headline-xl text-headline-xl text-primary font-bold tracking-tight mt-1">
              Tính năng nổi bật của NEXLOG
            </h2>
            <p className="font-body-lg text-body-lg text-on-surface-variant mt-space-xs">
              Các phân hệ nghiệp vụ cốt lõi được tích hợp đồng bộ trên cùng một
              nền tảng.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-gutter-lg">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="group bg-surface rounded-xl p-space-lg shadow-sm hover:shadow-xl transition-all duration-300 border border-surface-container-low flex flex-col"
              >
                <div
                  className={`w-14 h-14 rounded-lg flex items-center justify-center transition-all mb-space-md ${
                    feature.accent
                      ? "bg-tertiary-fixed text-on-tertiary-fixed-variant group-hover:bg-on-tertiary-container group-hover:text-on-primary"
                      : "bg-surface-container-high text-primary group-hover:bg-primary group-hover:text-on-primary"
                  }`}
                >
                  <span className="material-symbols-outlined text-3xl">
                    {feature.icon}
                  </span>
                </div>
                <h3 className="font-headline-md text-headline-md text-primary font-bold mb-space-xs group-hover:text-secondary transition-colors">
                  {feature.title}
                </h3>
                <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
