"use client";
import React, { useMemo } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Tag } from 'antd';

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

export default function ManagerAnalyticsChartsSection({
  dashboardData,
  period,
  displayPeriod
}) {
  const router = useRouter();

  // Tầng 3: Biểu đồ Dwell Time (Horizontal Bar)
  const dwellOptions = useMemo(() => {
    const list = dashboardData.dwellTimeByLocationChart;
    return {
      chart: {
        type: 'bar',
        toolbar: { show: false },
        fontFamily: 'inherit',
        animations: {
          enabled: true,
          easing: 'easeinout',
          speed: 850,
          animateGradually: {
            enabled: true,
            delay: 120
          },
          dynamicAnimation: {
            enabled: true,
            speed: 350
          }
        }
      },
      plotOptions: {
        bar: {
          horizontal: true,
          barHeight: '50%',
          distributed: true,
          borderRadius: 6
        }
      },
      colors: list.map((item) => (item.avgMinutes > 60 ? '#EF4444' : '#2563EB')),
      xaxis: {
        categories: list.map((item) => item.locationName),
        labels: {
          formatter: (val) => `${val}'`,
          style: { fontSize: '11px', fontWeight: 600 }
        }
      },
      yaxis: {
        labels: {
          maxWidth: 180,
          style: { fontSize: '11px', fontWeight: 600 }
        }
      },
      annotations: {
        xaxis: [
          {
            x: 60,
            borderColor: '#DC2626',
            strokeDashArray: 4,
            label: {
              text: 'Ngưỡng 60 phút',
              orientation: 'horizontal',
              style: {
                color: '#fff',
                background: '#DC2626',
                fontSize: '10px',
                fontWeight: 700
              }
            }
          }
        ]
      },
      legend: { show: false },
      tooltip: {
        y: {
          formatter: (val) => `${val} phút (${val > 60 ? 'VƯỢT ĐỊNH MỨC' : 'ĐẠT CHUẨN'})`
        }
      }
    };
  }, [dashboardData.dwellTimeByLocationChart]);

  const dwellSeries = useMemo(() => [
    {
      name: 'Thời gian dừng TB',
      data: dashboardData.dwellTimeByLocationChart.map((item) => item.avgMinutes)
    }
  ], [dashboardData.dwellTimeByLocationChart]);

  // Tầng 3: Lịch trễ theo nguyên nhân (Grouped Bar Chart)
  const lateStopsOptions = useMemo(() => {
    const list = dashboardData.lateStopsByCauseChart;
    return {
      chart: {
        type: 'bar',
        toolbar: { show: false },
        fontFamily: 'inherit',
        animations: {
          enabled: true,
          easing: 'easeinout',
          speed: 850,
          animateGradually: {
            enabled: true,
            delay: 120
          },
          dynamicAnimation: {
            enabled: true,
            speed: 350
          }
        }
      },
      plotOptions: {
        bar: {
          columnWidth: '45%',
          distributed: true,
          borderRadius: 6
        }
      },
      colors: list.map((item) => item.color || '#3B82F6'),
      xaxis: {
        categories: list.map((item) => item.cause),
        labels: { style: { fontSize: '11px', fontWeight: 600 } }
      },
      yaxis: {
        title: { text: 'Số điểm dừng trễ > 30p', style: { fontSize: '11px' } }
      },
      legend: { show: false },
      dataLabels: {
        enabled: true,
        style: { fontSize: '11px', fontWeight: 800 }
      }
    };
  }, [dashboardData.lateStopsByCauseChart]);

  const lateStopsSeries = useMemo(() => [
    {
      name: 'Số điểm trễ',
      data: dashboardData.lateStopsByCauseChart.map((item) => item.count)
    }
  ], [dashboardData.lateStopsByCauseChart]);

  // Tầng 4: Biểu đồ Sự cố theo loại (Donut Chart)
  const incidentsDonutOptions = useMemo(() => {
    const list = dashboardData.incidentsByTypeChart;
    return {
      chart: {
        type: 'donut',
        fontFamily: 'inherit',
        animations: {
          enabled: true,
          easing: 'easeinout',
          speed: 950,
          animateGradually: {
            enabled: true,
            delay: 150
          },
          dynamicAnimation: {
            enabled: true,
            speed: 400
          }
        },
        events: {
          dataPointSelection: () => {
            router.push('/manager/incidents');
          }
        }
      },
      labels: list.map((item) => item.label),
      colors: list.map((item) => item.color),
      legend: {
        position: 'bottom',
        fontSize: '11px',
        fontWeight: 600
      },
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
        y: {
          formatter: (val) => `${val} vụ (Bấm để xem chi tiết)`
        }
      }
    };
  }, [dashboardData.incidentsByTypeChart, router]);

  const incidentsDonutSeries = useMemo(() => {
    return dashboardData.incidentsByTypeChart.map((item) => item.count);
  }, [dashboardData.incidentsByTypeChart]);

  // Tầng 4: Xu hướng Doanh thu & Đơn hàng (Composed Area & Column Chart)
  const trendOptions = useMemo(() => {
    const list = dashboardData.revenueTrendChart;
    return {
      chart: {
        type: 'line',
        toolbar: { show: false },
        fontFamily: 'inherit',
        animations: {
          enabled: true,
          easing: 'easeinout',
          speed: 1000,
          animateGradually: {
            enabled: true,
            delay: 150
          },
          dynamicAnimation: {
            enabled: true,
            speed: 400
          }
        }
      },
      stroke: {
        width: [0, 3],
        curve: 'smooth'
      },
      plotOptions: {
        bar: {
          columnWidth: '35%',
          borderRadius: 4
        }
      },
      colors: ['#2563EB', '#10B981'],
      xaxis: {
        categories: list.map((item) => item.date),
        labels: { style: { fontSize: '11px', fontWeight: 600 } }
      },
      yaxis: [
        {
          title: { text: 'Doanh thu', style: { color: '#2563EB', fontSize: '11px' } },
          labels: {
            formatter: (val) => `${(val / 1000000).toFixed(0)} tr`,
            style: { fontSize: '10px' }
          }
        },
        {
          opposite: true,
          title: { text: 'Số đơn hoàn thành', style: { color: '#10B981', fontSize: '11px' } },
          labels: {
            formatter: (val) => `${val}`,
            style: { fontSize: '10px' }
          }
        }
      ],
      legend: {
        position: 'top',
        horizontalAlign: 'right',
        fontSize: '11px',
        fontWeight: 600
      }
    };
  }, [dashboardData.revenueTrendChart]);

  const trendSeries = useMemo(() => {
    const list = dashboardData.revenueTrendChart;
    return [
      {
        name: 'Doanh thu (VNĐ)',
        type: 'column',
        data: list.map((item) => item.revenue)
      },
      {
        name: 'Đơn giao thành công',
        type: 'line',
        data: list.map((item) => item.orders)
      }
    ];
  }, [dashboardData.revenueTrendChart]);

  return (
    <>
      {/* TẦNG 3: PHÂN TÍCH ĐIỂM NGHẼN & LỊCH TRỄ (2 BIỂU ĐỒ CỘT) */}
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-xs font-extrabold uppercase tracking-wider text-on-surface-variant flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            Phân tích Điểm nghẽn Vận tải &amp; Lịch trễ
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Biểu đồ 1: Dwell Time theo Kho (Horizontal Bar) */}
          <div className="p-5 bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/30 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h4 className="text-sm font-extrabold text-primary">
                  Thời gian ở điểm (TB) – Kho lâu nhất (Dwell Time)
                </h4>
                <p className="text-[11px] text-on-surface-variant mt-0.5">
                  Đo thời gian (Left - Arrived) tại từng kho. Cột vượt 60 phút cảnh báo Đỏ.
                </p>
              </div>
              <Tag color="red" className="font-bold">
                Định mức: 60 phút
              </Tag>
            </div>

            {dashboardData.dwellTimeByLocationChart && dashboardData.dwellTimeByLocationChart.length > 0 ? (
              <div className="w-full">
                <Chart key={`dwell-${period}`} options={dwellOptions} series={dwellSeries} type="bar" height={220} width="100%" />
              </div>
            ) : (
              <div className="py-12 text-center text-on-surface-variant text-xs italic bg-surface-container-low/40 rounded-xl my-2">
                <span className="material-symbols-outlined text-[32px] text-on-surface-variant/40 mb-1 block">warehouse</span>
                Chưa có dữ liệu điểm dừng kho bãi trong kỳ này
              </div>
            )}

            <div className="flex items-center justify-between text-[11px] text-on-surface-variant pt-2 border-t border-surface-container">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded bg-blue-600"></span>
                Đạt chuẩn (&le;60 phút)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded bg-error"></span>
                Nút thắt cổ chai (&gt;60 phút)
              </span>
            </div>
          </div>

          {/* Biểu đồ 2: Lịch trễ theo nguyên nhân (Stacked / Grouped Bar) */}
          <div className="p-5 bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/30 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h4 className="text-sm font-extrabold text-primary">
                  Lịch trễ theo nguyên nhân (Late Stops by Cause)
                </h4>
                <p className="text-[11px] text-on-surface-variant mt-0.5">
                  Điểm dừng trễ &gt; 30 phút chia theo 3 nhóm nguyên nhân chính.
                </p>
              </div>
              <span className="text-xs font-bold text-amber-600 flex items-center gap-1">
                <span className="material-symbols-outlined text-[15px]">warning</span>
                Trễ &gt; 30 phút
              </span>
            </div>

            <div className="w-full">
              <Chart key={`late-${period}`} options={lateStopsOptions} series={lateStopsSeries} type="bar" height={220} width="100%" />
            </div>

            <div className="flex items-center justify-around text-[11px] text-on-surface-variant pt-2 border-t border-surface-container">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span> Đi đường lâu
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-blue-600"></span> Ở điểm lâu
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-red-600"></span> Sự cố vận tải
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* TẦNG 4: GIÁM SÁT RỦI RO & XU HƯỚNG (DONUT & COMPOSED CHART) */}
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-xs font-extrabold uppercase tracking-wider text-on-surface-variant flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-error"></span>
            Giám sát Rủi ro Sự cố &amp; Nhịp điệu Vận hành
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Donut Chart: Sự cố theo loại (1 cột) */}
          <div className="p-5 bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/30 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-1">
              <h4 className="text-sm font-extrabold text-primary">
                Sự cố theo loại (Incidents)
              </h4>
              <Link
                href="/manager/incidents"
                className="text-xs text-secondary font-bold hover:underline flex items-center gap-0.5"
              >
                <span>Chi tiết</span>
                <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
              </Link>
            </div>
            <p className="text-[11px] text-on-surface-variant mb-2">
              Bấm lát cắt để lọc danh sách sự cố.
            </p>

            {dashboardData.incidentsByTypeChart && dashboardData.incidentsByTypeChart.some((i) => i.count > 0) ? (
              <div className="w-full flex justify-center my-1">
                <Chart
                  key={`incidents-${period}`}
                  options={incidentsDonutOptions}
                  series={incidentsDonutSeries}
                  type="donut"
                  height={240}
                  width="100%"
                />
              </div>
            ) : (
              <div className="py-14 text-center text-on-surface-variant text-xs italic bg-surface-container-low/40 rounded-xl my-2">
                <span className="material-symbols-outlined text-[32px] text-emerald-500 mb-1 block">verified_user</span>
                Không có sự cố vận tải nào trong {displayPeriod}
              </div>
            )}

            <div className="text-[11px] text-center text-on-surface-variant font-medium pt-2 border-t border-surface-container">
              Dữ liệu báo cáo hiện trường &amp; biên bản giám định
            </div>
          </div>

          {/* Composed Chart: Xu hướng Doanh thu & Đơn hàng trong kỳ (2 cột) */}
          <div className="lg:col-span-2 p-5 bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/30 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-1">
              <div>
                <h4 className="text-sm font-extrabold text-primary">
                  Xu hướng Doanh thu &amp; Đơn hàng Hoàn thành
                </h4>
                <p className="text-[11px] text-on-surface-variant mt-0.5">
                  Nhịp điệu biến động sản lượng và doanh thu theo các mốc thời gian trong {displayPeriod}.
                </p>
              </div>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary/10 text-primary text-xs font-bold">
                <span className="material-symbols-outlined text-[14px]">insights</span>
                Doanh thu &amp; Sản lượng
              </span>
            </div>

            <div className="w-full">
              <Chart key={`trend-${period}`} options={trendOptions} series={trendSeries} type="line" height={240} width="100%" />
            </div>

            <div className="flex items-center justify-between text-[11px] text-on-surface-variant pt-2 border-t border-surface-container">
              <span>Cột xanh: Doanh thu thực tế (VNĐ)</span>
              <span>Đường xanh lá: Số lượng đơn giao hoàn tất</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
