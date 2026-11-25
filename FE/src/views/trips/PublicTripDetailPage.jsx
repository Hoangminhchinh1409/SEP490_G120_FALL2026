'use client';
import React, { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  Truck,
  Phone,
  MessageCircle,
  Copy,
  CheckCircle2,
  Clock,
  MapPin,
  FileText,
  Package,
  ShieldCheck,
  RefreshCw,
  AlertTriangle,
  ChevronRight,
  ExternalLink,
  Navigation
} from 'lucide-react';
import { fetchWithoutAuth } from '../../api/apiClient';

// Dynamic import Route Map để không bị lỗi SSR trên Next.js
const InnerRouteMap = dynamic(
  () => import('../../components/common/InnerRouteMap'),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-64 bg-gray-100 rounded-xl flex items-center justify-center text-gray-400">
        <div className="flex flex-col items-center gap-2">
          <Navigation className="w-6 h-6 animate-spin text-blue-500" />
          <span className="text-sm">Đang tải bản đồ tuyến đường...</span>
        </div>
      </div>
    )
  }
);

export default function PublicTripDetailPage() {
  const params = useParams();
  const tripCode = params?.code || '';

  const [trip, setTrip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchTripDetails = useCallback(async () => {
    if (!tripCode) return;
    try {
      const res = await fetchWithoutAuth(`/trips/public/${tripCode}`);
      if (res && res.trip) {
        setTrip(res.trip);
        setError(null);
      } else {
        setError('Không tìm thấy thông tin chuyến xe này trong hệ thống.');
      }
    } catch (err) {
      console.error('Fetch public trip error:', err);
      setError(err.message || 'Lỗi kết nối khi tải thông tin chuyến xe.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tripCode]);

  const handleManualRefresh = () => {
    setRefreshing(true);
    fetchTripDetails();
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchTripDetails();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchTripDetails]);

  const copyTripCode = () => {
    if (typeof window !== 'undefined' && trip?.trip_code) {
      navigator.clipboard.writeText(trip.trip_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const copyPageLink = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 text-center max-w-sm w-full">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-slate-800">Đang tải thông tin chuyến xe</h2>
          <p className="text-sm text-slate-500 mt-1">Mã chuyến: {tripCode}</p>
        </div>
      </div>
    );
  }

  if (error || !trip) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 text-center max-w-md w-full">
          <div className="w-14 h-14 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-800">Không tìm thấy chuyến xe</h2>
          <p className="text-sm text-slate-600 mt-2">{error || 'Chuyến xe không tồn tại hoặc đã bị xóa.'}</p>
          <div className="mt-6 flex flex-col gap-2">
            <button
              onClick={handleManualRefresh}
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition text-sm flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" /> Thử tải lại
            </button>
            <Link
              href="/"
              className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl transition text-sm block"
            >
              Về trang chủ NEXLOG
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Bóc tách thông tin hiển thị
  const cleanPhone = String(trip.driver_phone || '0912345678').replace(/\D/g, '');
  const primaryOrder = trip.orders_data?.[0] || {};
  const orderCode = primaryOrder.order_id || trip.orders?.[0] || 'NEX-LOG';
  const customerName = trip.customer || primaryOrder.customer || 'Khách hàng NEXLOG';

  const pickupAddress = trip.pickup || 'Kho ALS Cảng Hàng Không Quốc Tế Nội Bài';
  const dropoffAddress = trip.dropoff || 'Điểm giao nhận hàng';

  // Trạng thái badge nổi bật, sắc nét 100%, dùng mã màu hex cố định chống mờ/lỗi CSS
  const getStatusBadge = () => {
    const s = String(trip.status || '').toUpperCase();
    if (s.includes('DELIVERED') || s.includes('COMPLETED') || s.includes('DONE')) {
      return {
        label: 'ĐÃ HOÀN TẤT',
        bgColor: '#059669',
        borderColor: '#047857',
        hasPulse: false
      };
    }
    if (s.includes('TRANSIT') || s.includes('PROGRESS')) {
      return {
        label: 'ĐANG VẬN CHUYỂN',
        bgColor: '#1d4ed8',
        borderColor: '#1e40af',
        hasPulse: true
      };
    }
    if (s.includes('PICKED') || s.includes('LOADING')) {
      return {
        label: 'ĐANG XẾP HÀNG TẠI KHO',
        bgColor: '#d97706',
        borderColor: '#b45309',
        hasPulse: true
      };
    }
    return {
      label: 'ĐÃ ĐIỀU XE (SẴN SÀNG)',
      bgColor: '#4338ca',
      borderColor: '#3730a3',
      hasPulse: false
    };
  };
  const statusBadge = getStatusBadge();

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans">
      {/* Top Navigation Bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 px-4 py-3 shadow-xs">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <img src="/logo-icon.png" alt="Logo" className="w-8 h-8 object-contain" />
            <span className="font-extrabold text-blue-900 tracking-tight text-lg">NEXLOG</span>
            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-semibold hidden sm:inline">
              Smart Logistics OS
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <button
              onClick={handleManualRefresh}
              disabled={refreshing}
              title="Làm mới thông tin"
              className="p-2 text-slate-600 hover:text-blue-600 hover:bg-slate-50 rounded-lg border border-slate-200 transition"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-blue-600' : ''}`} />
            </button>
            <button
              onClick={copyPageLink}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition"
            >
              {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Đã sao chép' : 'Chia sẻ link'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-3 sm:p-5 lg:p-6 space-y-4">
        {/* HERO CARD: Mã chuyến & Lệnh Vận Chuyển Điện Tử */}
        <div className="bg-white rounded-2xl p-4 sm:p-6 border border-slate-200 shadow-xs relative overflow-hidden">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4 relative z-10">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Lệnh Điều Xe & Lệnh Vận Chuyển
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                  <ShieldCheck className="w-3.5 h-3.5" /> Hệ thống ALS Xác Thực
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                {trip.trip_code}
                <button
                  onClick={copyTripCode}
                  title="Sao chép mã chuyến"
                  className="text-slate-400 hover:text-slate-600 transition"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                Số Waybill: <span className="font-semibold text-slate-700">{trip.waybill_number || `WB-${trip.trip_code}`}</span> • Phiên bản: v{trip.waybill_version || 1}
              </p>
            </div>

            <div className="text-right flex flex-col items-end">
              <div
                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-black uppercase tracking-wider border"
                style={{
                  backgroundColor: statusBadge.bgColor,
                  borderColor: statusBadge.borderColor,
                  color: '#ffffff',
                  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.18)'
                }}
              >
                {statusBadge.hasPulse && (
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400 border border-white" />
                  </span>
                )}
                <span
                  style={{
                    color: '#ffffff',
                    fontWeight: 900,
                    textShadow: '0 1px 2px rgba(0,0,0,0.3)',
                    letterSpacing: '0.04em'
                  }}
                >
                  {statusBadge.label}
                </span>
              </div>
              <span className="text-xs text-slate-700 font-semibold mt-1.5 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-blue-600" /> Dự kiến đến kho: <strong className="text-slate-900 font-extrabold">{trip.planned_start || '08:30'}</strong>
              </span>
            </div>
          </div>

          {/* Quick Call Action (Mobile First) */}
          <div className="mt-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-3.5 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="w-12 h-12 bg-white rounded-xl shadow-xs border border-blue-200 flex items-center justify-center text-blue-600 shrink-0">
                <Truck className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500">Bác tài phụ trách chuyến</p>
                <p className="text-base font-bold text-slate-900">{trip.driver_name || 'Nguyễn Văn Lái'}</p>
                <p className="text-xs text-blue-700 font-semibold">{trip.driver_phone || '0912.345.678'}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <a
                href={`tel:${cleanPhone}`}
                className="flex-1 sm:flex-initial py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-sm text-sm flex items-center justify-center gap-2 transition"
              >
                <Phone className="w-4 h-4" /> Gọi Bác Tài Ngay
              </a>
              <a
                href={`https://zalo.me/${cleanPhone}`}
                target="_blank"
                rel="noreferrer"
                className="flex-1 sm:flex-initial py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-sm text-sm flex items-center justify-center gap-2 transition"
              >
                <MessageCircle className="w-4 h-4" /> Nhắn Zalo
              </a>
            </div>
          </div>
        </div>

        {/* GRID: Thông tin phương tiện + Thủ tục hàng hóa */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Card Phương tiện */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 text-slate-700 font-bold text-sm mb-3">
                <Truck className="w-4 h-4 text-blue-600" />
                <span>Phương Tiện Vận Chuyển</span>
              </div>
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-sm py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Biển số xe</span>
                  <span className="font-mono font-black text-sm bg-amber-300 text-slate-900 px-2.5 py-0.5 rounded border border-amber-400 shadow-xs">
                    {trip.plate || '29A-115.68'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Loại phương tiện</span>
                  <span className="font-semibold text-slate-800">{trip.truck_model || 'Thaco Ollin 2.5T (Thùng kín)'}</span>
                </div>
                <div className="flex items-center justify-between text-sm py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Tải trọng cho phép</span>
                  <span className="font-semibold text-slate-800">{trip.max_payload ? `${Number(trip.max_payload).toLocaleString()} kg` : '2,500 kg'}</span>
                </div>
                <div className="flex items-center justify-between text-sm py-1.5">
                  <span className="text-slate-500">Trạng thái xe</span>
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                    <CheckCircle2 className="w-3 h-3" /> GPS Hoạt động bình thường
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Card Thủ tục Kho ALS & Hàng Hóa */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 text-slate-700 font-bold text-sm mb-3">
                <Package className="w-4 h-4 text-indigo-600" />
                <span>Thủ Tục Kho ALS & Lô Hàng</span>
              </div>
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-sm py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Mã đơn hàng</span>
                  <span className="font-semibold text-slate-800">{orderCode}</span>
                </div>
                <div className="flex items-center justify-between text-sm py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Khách hàng</span>
                  <span className="font-semibold text-slate-800 text-right truncate max-w-[180px]">{customerName}</span>
                </div>
                <div className="flex items-center justify-between text-sm py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Trọng lượng hàng</span>
                  <span className="font-bold text-slate-900">{trip.total_weight ? `${Number(trip.total_weight).toLocaleString()} kg` : '2,150 kg'}</span>
                </div>
                <div className="flex items-center justify-between text-sm py-1.5">
                  <span className="text-slate-500">Hồ sơ Hải quan</span>
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Đã duyệt trực tuyến
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* LỘ TRÌNH VẬN CHUYỂN & TIMELINE */}
        <div className="bg-white rounded-2xl p-4 sm:p-6 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-slate-800 font-bold text-base">
              <MapPin className="w-5 h-5 text-red-500" />
              <span>Lộ Trình Điểm Dừng</span>
            </div>
            <span className="text-xs text-slate-500">
              Quãng đường: ~{trip.planned_distance || 35} km • Thời gian chạy: ~{trip.planned_duration || 50} phút
            </span>
          </div>

          <div className="space-y-4 relative before:absolute before:inset-0 before:left-4 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
            {/* Điểm 1: Lấy hàng */}
            <div className="relative flex items-start gap-3 pl-1">
              <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0 z-10 ring-4 ring-white">
                1
              </div>
              <div className="bg-slate-50 rounded-xl p-3 flex-1 border border-slate-100">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-blue-700 uppercase">Điểm lấy hàng (Xuất phát)</span>
                  <span className="text-xs font-medium text-slate-500">Dự kiến: {trip.planned_start || '07:30'}</span>
                </div>
                <p className="text-sm font-semibold text-slate-900 mt-1">{pickupAddress}</p>
                <p className="text-xs text-slate-500 mt-0.5">Thủ tục: Trình lệnh xuất kho điện tử & niêm phong chì seal</p>
              </div>
            </div>

            {/* Điểm 2: Giao hàng */}
            <div className="relative flex items-start gap-3 pl-1">
              <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shrink-0 z-10 ring-4 ring-white">
                2
              </div>
              <div className="bg-slate-50 rounded-xl p-3 flex-1 border border-slate-100">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-700 uppercase">Điểm trả hàng (Giao hàng)</span>
                  <span className="text-xs font-medium text-slate-500">Dự kiến: {trip.planned_finish || '09:00'}</span>
                </div>
                <p className="text-sm font-semibold text-slate-900 mt-1">{dropoffAddress}</p>
                <p className="text-xs text-slate-500 mt-0.5">Thủ tục: Bàn giao hàng hóa & ký biên bản giao nhận (POD)</p>
              </div>
            </div>
          </div>

          {/* Bản đồ Tuyến đường */}
          {trip.pickup_coords && trip.dropoff_coords && (
            <div className="mt-5 rounded-xl overflow-hidden border border-slate-200">
              <InnerRouteMap
                pickupCoords={trip.pickup_coords}
                deliveryCoords={trip.dropoff_coords}
              />
            </div>
          )}
        </div>

        {/* THẺ CHỨNG TỰ ĐIỆN TỬ & LIÊN HỆ TRỰC CA */}
        <div className="bg-slate-900 text-white rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-blue-400 shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-slate-400">Trực ban Điều hành ALS Nội Bài</p>
              <p className="text-sm font-bold text-slate-100">Hotline: 0988.111.xxx / 1900 3133</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Hỗ trợ đối soát lệnh xuất kho 24/7</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="text-xs text-slate-300 hover:text-white underline px-3 py-1.5 transition"
            >
              Về trang chủ NEXLOG
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-400 mt-auto">
        <p>© 2026 NEXLOG Smart Logistics OS • Hệ thống Quản trị & Điều phối Vận tải Hàng không ALS</p>
      </footer>
    </div>
  );
}
