"use client";

import { CheckCircle2 } from "lucide-react";

export default function AuthSplitLayout({ children }) {
  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 flex flex-col">
      <main className="flex-1 flex items-center justify-center p-4 sm:p-8 relative overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-400/20 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-cyan-400/20 rounded-full blur-[120px] pointer-events-none" />

        <div className="w-full max-w-5xl bg-white/80 backdrop-blur-xl border border-white/50 rounded-3xl shadow-[0_8px_40px_rgba(0,0,0,0.08)] overflow-hidden flex flex-col md:flex-row relative z-10">
          <div
            className="md:w-5/12 p-10 flex flex-col justify-between relative overflow-hidden hidden md:flex"
            style={{
              backgroundImage:
                'url("https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?q=80&w=2070&auto=format&fit=crop")',
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-blue-600/40 to-blue-900/60 z-0"></div>
            <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] mix-blend-overlay z-0"></div>

            <div className="relative z-10">
              <div className="inline-flex items-center gap-3 bg-white px-4 py-2.5 rounded-2xl shadow-lg border border-white/50 backdrop-blur-md mb-8">
                <div className="w-10 h-10 flex items-center justify-center shrink-0">
                  <img src="/logo-icon.png" alt="NEXLOG Logo" className="w-full h-full object-contain" />
                </div>
                <div className="flex flex-col justify-center">
                  <img src="/logo-text.png" alt="NEXLOG" className="h-6 w-auto object-contain object-left" />
                  <span className="text-[9px] text-slate-400 font-bold tracking-widest uppercase leading-none mt-0.5">
                    LOGISTICS OS
                  </span>
                </div>
              </div>

              <h1 className="text-4xl font-bold mb-4 text-white leading-tight drop-shadow-sm">
                Hệ thống Điều phối Vận tải Thông minh
              </h1>
              <p className="text-blue-100 text-lg mb-12 font-medium">
                Smart Logistics Tracking and Dispatch System
              </p>

              <ul className="space-y-5">
                {[
                  "Quản lý đơn hàng hiệu quả & tối ưu",
                  "Theo dõi trạng thái theo thời gian thực",
                  "Đồng bộ Offline-First cho tài xế",
                ].map((text) => (
                  <li key={text} className="flex items-center gap-3.5 text-blue-50">
                    <div className="bg-blue-400/30 p-1 rounded-full border border-blue-400/50">
                      <CheckCircle2 className="w-5 h-5 text-white shrink-0" />
                    </div>
                    <span className="font-medium text-white">{text}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="relative z-10 text-sm text-blue-200/80 font-semibold tracking-wide">
              © {new Date().getFullYear()} NEXLOG SYSTEM.
            </div>
          </div>

          <div className="w-full md:w-7/12 p-8 sm:p-12 md:p-16 flex flex-col justify-center bg-white">
            <div className="max-w-md w-full mx-auto">{children}</div>
          </div>
        </div>
      </main>
    </div>
  );
}
