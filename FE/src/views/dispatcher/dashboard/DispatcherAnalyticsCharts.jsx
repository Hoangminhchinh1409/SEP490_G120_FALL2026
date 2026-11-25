"use client";
import React, { useMemo } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Tag } from 'antd';

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

const getGaugeOptions = (label, color, subLabel) => ({
  chart: {
    type: 'radialBar',
    offsetY: -5,
    sparkline: { enabled: true },
    animations: {
      enabled: true,
      easing: 'easeinout',
      speed: 900
    }
  },
  plotOptions: {
    radialBar: {
      startAngle: -90,
      endAngle: 90,
      track: {
        background: '#E2E8F0',
        strokeWidth: '97%',
        margin: 5
      },
      dataLabels: {
        name: {
          show: true,
          fontSize: '12px',
          fontWeight: 700,
          color: '#64748B',
          offsetY: -35
        },
        value: {
          offsetY: -10,
          fontSize: '22px',
          fontWeight: 900,
          color: '#0F172A',
          formatter: (val) => `${val}%`
        }
      }
    }
  },
  fill: { colors: [color] },
  labels: [label],
  tooltip: {
    enabled: true,
    y: { formatter: (val) => `${val}% (${subLabel})` }
  }
});

export default function DispatcherAnalyticsCharts({ computed, periodMode, displayPeriod }) {
  const router = useRouter();

  const fleetReadyColor =
    computed.fleetReadyPercent >= 40
      ? '#10B981'
      : computed.fleetReadyPercent >= 15
        ? '#F59E0B'
        : '#EF4444';

  const pipelineChartOptions = useMemo(() => {
    const list = computed.pipelineCounts;
    return {
      chart: {
        type: 'bar',
        toolbar: { show: false },
        fontFamily: 'inherit'
      },
      plotOptions: {
        bar: {
          horizontal: true,
          barHeight: '55%',
          distributed: true,
          borderRadius: 6
        }
      },
      colors: list.map((item) => item.color),
      xaxis: {
        categories: list.map((item) => item.label),
        labels: { style: { fontSize: '11px', fontWeight: 600 } }
      },
      yaxis: {
        labels: { maxWidth: 165, style: { fontSize: '11px', fontWeight: 600 } }
      },
      legend: { show: false },
      dataLabels: {
        enabled: true,
        style: { fontSize: '11px', fontWeight: 700 }
      },
      tooltip: {
        y: { formatter: (val) => `${val} đơn` }
      }
    };
  }, [computed.pipelineCounts]);

  const pipelineSeries = useMemo(
    () => [
      {
        name: 'Số lượng đơn',
        data: computed.pipelineCounts.map((i) => i.count)
      }
    ],
    [computed.pipelineCounts]
  );

  const hubChartOptions = useMemo(() => {
    const list = computed.hubChartData;
    return {
      chart: { type: 'bar', toolbar: { show: false }, fontFamily: 'inherit' },
      plotOptions: {
        bar: { columnWidth: '45%', borderRadius: 6, distributed: true }
      },
      colors: ['#2563EB', '#0EA5E9', '#10B981', '#6366F1', '#F59E0B'],
      xaxis: {
        categories: list.map((item) => item.hubName),
        labels: { style: { fontSize: '11px', fontWeight: 600 } }
      },
      yaxis: {
        title: { text: 'Số đơn lấy hàng', style: { fontSize: '11px' } }
      },
      legend: { show: false },
      dataLabels: {
        enabled: true,
        style: { fontSize: '11px', fontWeight: 800 }
      },
      tooltip: {
        y: {
          formatter: (val, { dataPointIndex }) => {
            const w = list[dataPointIndex]?.weightKg || 0;
            return `${val} đơn · ${Math.round(w).toLocaleString('vi-VN')} kg`;
          }
        }
      }
    };
  }, [computed.hubChartData]);

  const hubSeries = useMemo(
    () => [
      {
        name: 'Số đơn',
        data: computed.hubChartData.map((item) => item.count)
      }
    ],
    [computed.hubChartData]
  );

  const incidentsDonutOptions = useMemo(() => {
    const list = computed.incidentsChart;
    return {
      chart: {
        type: 'donut',
        fontFamily: 'inherit',
        events: {
          dataPointSelection: () => {
            router.push('/dispatcher/incidents');
          }
        }
      },
      labels: list.map((item) => item.label),
      colors: list.map((item) => item.color),
      legend: { position: 'bottom', fontSize: '11px', fontWeight: 600 },
      plotOptions: {
        pie: {
          donut: {
            size: '68%',
            labels: {
              show: true,
              total: {
                show: true,
                label: 'Tổng sự cố',
                fontSize: '12px',
                fontWeight: 600,
                color: '#64748B',
                formatter: () => `${list.reduce((sum, item) => sum + item.count, 0)}`
              }
            }
          }
        }
      },
      tooltip: {
        y: { formatter: (val) => `${val} vụ (Bấm để xem chi tiết)` }
      }
    };
  }, [computed.incidentsChart, router]);

  const incidentsDonutSeries = useMemo(
    () => computed.incidentsChart.map((i) => i.count),
    [computed.incidentsChart]
  );

  const trendOptions = useMemo(() => {
    const list = computed.trendBuckets;
    return {
      chart: { type: 'line', toolbar: { show: false }, fontFamily: 'inherit' },
      stroke: { width: [0, 3], curve: 'smooth' },
      plotOptions: { bar: { columnWidth: '38%', borderRadius: 4 } },
      colors: ['#2563EB', '#10B981'],
      xaxis: {
        categories: list.map((item) => item.label),
        labels: { style: { fontSize: '11px', fontWeight: 600 } }
      },
      yaxis: [
        {
          title: { text: 'Doanh thu', style: { color: '#2563EB', fontSize: '11px' } },
          labels: {
            formatter: (val) => `${(val / 1_000_000).toFixed(0)} tr`,
            style: { fontSize: '10px' }
          }
        },
        {
          opposite: true,
          title: { text: 'Số lượng đơn', style: { color: '#10B981', fontSize: '11px' } },
          labels: {
            formatter: (val) => `${Math.round(val)}`,
            style: { fontSize: '10px' }
          }
        }
      ],
      legend: { position: 'top', horizontalAlign: 'right', fontSize: '11px', fontWeight: 600 }
    };
  }, [computed.trendBuckets]);

  const trendSeries = useMemo(
    () => [
      {
        name: 'Doanh thu (VNĐ)',
        type: 'column',
        data: computed.trendBuckets.map((i) => i.revenue)
      },
      {
        name: 'Số lượng đơn',
        type: 'line',
        data: computed.trendBuckets.map((i) => i.orders)
      }
    ],
    [computed.trendBuckets]
  );

  return (
    <>
      {/* TẦNG 2: 3 RADIAL GAUGES */}
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-xs font-extrabold uppercase tracking-wider text-on-surface-variant flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-secondary"></span>
            Chỉ số Sẵn sàng Đội xe &amp; Nhịp độ Điều phối (Radial Gauges)
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Gauge 1: Đội xe sẵn sàng */}
          <div className="p-5 bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/30 flex flex-col items-center justify-between text-center">
            <div className="w-full flex items-center justify-between text-xs font-bold text-on-surface-variant uppercase">
              <span>Xe sẵn sàng nhận chuyến</span>
              <Tag
                color={
                  computed.fleetReadyPercent >= 40
                    ? 'green'
                    : computed.fleetReadyPercent >= 15
                      ? 'gold'
                      : 'red'
                }
              >
                {computed.fleetReadyPercent >= 40
                  ? 'Đủ xe'
                  : computed.fleetReadyPercent >= 15
                    ? 'Cân đối'
                    : 'Thiếu xe'}
              </Tag>
            </div>
            <div className="my-2 w-full flex justify-center">
              <Chart
                key={`gauge-fleet-${computed.availableTrucks}-${computed.totalTrucks}`}
                options={getGaugeOptions('Xe sẵn sàng', fleetReadyColor, 'Xe Available ÷ Tổng đội xe')}
                series={[computed.fleetReadyPercent]}
                type="radialBar"
                height={180}
                width="100%"
              />
            </div>
            <div className="text-xs text-on-surface-variant font-medium">
              Hiện có {computed.availableTrucks} / {computed.totalTrucks} xe tải sẵn sàng
            </div>
          </div>

          {/* Gauge 2: Tiến độ đã điều phối */}
          <div className="p-5 bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/30 flex flex-col items-center justify-between text-center">
            <div className="w-full flex items-center justify-between text-xs font-bold text-on-surface-variant uppercase">
              <span>Tỷ lệ đơn đã điều xe</span>
              <Tag color="blue">
                {computed.dispatchedPercent >= 70 ? 'Nhanh chóng' : 'Cần xếp thêm'}
              </Tag>
            </div>
            <div className="my-2 w-full flex justify-center">
              <Chart
                key={`gauge-dispatch-${periodMode}-${computed.dispatchedPercent}`}
                options={getGaugeOptions('Đã gán xe', '#2563EB', 'Đơn đã gán ÷ Tổng đơn hợp lệ')}
                series={[computed.dispatchedPercent]}
                type="radialBar"
                height={180}
                width="100%"
              />
            </div>
            <div className="text-xs text-on-surface-variant font-medium">
              {computed.readyCount} đơn sẵn sàng · {computed.confirmedCount} đơn chờ chứng từ
            </div>
          </div>

          {/* Gauge 3: Tỷ lệ giao hoàn tất */}
          <div className="p-5 bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/30 flex flex-col items-center justify-between text-center">
            <div className="w-full flex items-center justify-between text-xs font-bold text-on-surface-variant uppercase">
              <span>Tỷ lệ giao hoàn tất</span>
              <Tag color={computed.deliveredRatePercent >= 60 ? 'green' : 'blue'}>
                {computed.deliveredRatePercent >= 60 ? 'Hiệu quả' : 'Đang vận hành'}
              </Tag>
            </div>
            <div className="my-2 w-full flex justify-center">
              <Chart
                key={`gauge-delivered-${periodMode}-${computed.deliveredRatePercent}`}
                options={getGaugeOptions('Hoàn tất', '#10B981', 'Delivered & Closed ÷ Tổng đơn')}
                series={[computed.deliveredRatePercent]}
                type="radialBar"
                height={180}
                width="100%"
              />
            </div>
            <div className="text-xs text-on-surface-variant font-medium">
              {computed.deliveredCount} đơn giao thành công trong kỳ
            </div>
          </div>
        </div>
      </div>

      {/* TẦNG 3: PHÂN BỐ TRẠNG THÁI & SẢN LƯỢNG THEO KHO */}
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-xs font-extrabold uppercase tracking-wider text-on-surface-variant flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            Phân tích Tiến độ Đơn hàng &amp; Lưu lượng Kho bãi
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Chart 1: Pipeline trạng thái */}
          <div className="p-5 bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/30 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h4 className="text-sm font-extrabold text-primary">
                  Phân bố Đơn hàng theo Trạng thái (Pipeline)
                </h4>
                <p className="text-[11px] text-on-surface-variant mt-0.5">
                  Số lượng đơn thực tế trên từng bước quy trình vận tải ALS.
                </p>
              </div>
              <Link
                href="/dispatcher/orders"
                className="text-xs text-secondary font-bold hover:underline flex items-center gap-0.5"
              >
                <span>Quản lý đơn</span>
                <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
              </Link>
            </div>

            {computed.pipelineCounts.length > 0 ? (
              <div className="w-full">
                <Chart
                  key={`pipeline-${periodMode}-${computed.totalAllOrders}`}
                  options={pipelineChartOptions}
                  series={pipelineSeries}
                  type="bar"
                  height={240}
                  width="100%"
                />
              </div>
            ) : (
              <div className="py-14 text-center text-on-surface-variant text-xs italic bg-surface-container-low/40 rounded-xl my-2">
                Chưa có dữ liệu đơn hàng trong kỳ {displayPeriod}
              </div>
            )}
          </div>

          {/* Chart 2: Sản lượng theo kho lấy */}
          <div className="p-5 bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/30 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h4 className="text-sm font-extrabold text-primary">
                  Top Kho / Điểm lấy hàng nhiều đơn nhất
                </h4>
                <p className="text-[11px] text-on-surface-variant mt-0.5">
                  Thống kê số lượng đơn và tổng tải trọng tại các điểm xuất phát chính.
                </p>
              </div>
              <Tag color="blue" className="font-bold">
                Top {computed.hubChartData.length} điểm
              </Tag>
            </div>

            {computed.hubChartData.length > 0 ? (
              <div className="w-full">
                <Chart
                  key={`hubs-${periodMode}-${computed.hubChartData.length}`}
                  options={hubChartOptions}
                  series={hubSeries}
                  type="bar"
                  height={240}
                  width="100%"
                />
              </div>
            ) : (
              <div className="py-14 text-center text-on-surface-variant text-xs italic bg-surface-container-low/40 rounded-xl my-2">
                Chưa có dữ liệu kho bãi trong kỳ {displayPeriod}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* TẦNG 4: RỦI RO SỰ CỐ & XU HƯỚNG DOANH THU */}
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-xs font-extrabold uppercase tracking-wider text-on-surface-variant flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-error"></span>
            Giám sát Sự cố Hiện trường &amp; Xu hướng Sản lượng
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Donut Chart: Sự cố theo loại */}
          <div className="p-5 bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/30 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-1">
              <h4 className="text-sm font-extrabold text-primary">
                Sự cố theo loại (Incidents)
              </h4>
              <Link
                href="/dispatcher/incidents"
                className="text-xs text-secondary font-bold hover:underline flex items-center gap-0.5"
              >
                <span>Chi tiết</span>
                <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
              </Link>
            </div>
            <p className="text-[11px] text-on-surface-variant mb-2">
              Bấm lát cắt để mở trang quản lý sự cố.
            </p>

            {computed.incidentsChart.length > 0 ? (
              <div className="w-full flex justify-center my-1">
                <Chart
                  key={`incidents-disp-${computed.incidentsChart.length}-${computed.openIncidentsCount}`}
                  options={incidentsDonutOptions}
                  series={incidentsDonutSeries}
                  type="donut"
                  height={235}
                  width="100%"
                />
              </div>
            ) : (
              <div className="py-14 text-center text-on-surface-variant text-xs italic bg-surface-container-low/40 rounded-xl my-2">
                <span className="material-symbols-outlined text-[32px] text-emerald-500 mb-1 block">
                  verified_user
                </span>
                Không có sự cố vận tải nào được ghi nhận
              </div>
            )}

            <div className="text-[11px] text-center text-on-surface-variant font-medium pt-2 border-t border-surface-container">
              Tổng hợp từ báo cáo tài xế và chuyến đang chạy
            </div>
          </div>

          {/* Composed Chart: Xu hướng doanh thu & đơn */}
          <div className="lg:col-span-2 p-5 bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/30 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-1">
              <div>
                <h4 className="text-sm font-extrabold text-primary">
                  Xu hướng Doanh thu &amp; Số lượng Đơn hàng
                </h4>
                <p className="text-[11px] text-on-surface-variant mt-0.5">
                  Biến động cước chốt và lượng đơn tiếp nhận trong {displayPeriod}.
                </p>
              </div>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary/10 text-primary text-xs font-bold">
                <span className="material-symbols-outlined text-[14px]">insights</span>
                Doanh thu &amp; Sản lượng
              </span>
            </div>

            <div className="w-full">
              <Chart
                key={`trend-disp-${periodMode}-${computed.totalAllOrders}`}
                options={trendOptions}
                series={trendSeries}
                type="line"
                height={240}
                width="100%"
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-on-surface-variant pt-2 border-t border-surface-container">
              <span>Cột xanh: Giá cước thực tế (VNĐ)</span>
              <span>Đường xanh lá: Số đơn phát sinh</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
