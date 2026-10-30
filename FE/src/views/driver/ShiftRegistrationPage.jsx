"use client";
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Form, DatePicker, TimePicker, Input, Button, Tag, message, Spin, Empty } from "antd";
import { Calendar, Clock, Plus, ChevronLeft, ChevronRight, CheckCircle2, AlertCircle, XCircle, CloudOff, Cloud } from "lucide-react";
import dayjs from "dayjs";
import "dayjs/locale/vi";
import { driverApi, queueOfflineAction } from "../../api/driverApi";

dayjs.locale("vi");

export default function ShiftRegistrationPage() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [shifts, setShifts] = useState([]);
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    return dayjs().startOf("week").add(1, "day"); // Thứ Hai
  });
  const [isOffline, setIsOffline] = useState(() => {
    if (typeof window !== "undefined" && typeof navigator !== "undefined") {
      return !navigator.onLine;
    }
    return false;
  });

  const weekEnd = useMemo(() => currentWeekStart.add(6, "day"), [currentWeekStart]);

  const fetchShifts = useCallback(async () => {
    try {
      setLoading(true);
      const fromStr = currentWeekStart.format("YYYY-MM-DD");
      const toStr = currentWeekStart.add(6, "day").format("YYYY-MM-DD");
      const res = await driverApi.getMyShifts({ from: fromStr, to: toStr });
      setShifts(res?.shifts || []);
    } catch (err) {
      console.error("fetchShifts error:", err);
      message.error(err.message || "Không thể tải danh sách ca làm việc");
    } finally {
      setLoading(false);
    }
  }, [currentWeekStart]);

  useEffect(() => {
    void fetchShifts();

    const handleOnline = () => {
      setIsOffline(false);
      void fetchShifts();
    };
    const handleOffline = () => setIsOffline(true);

    if (typeof window !== "undefined") {
      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
      }
    };
  }, [fetchShifts]);

  const handlePrevWeek = () => {
    setCurrentWeekStart((prev) => prev.subtract(1, "week"));
  };

  const handleNextWeek = () => {
    setCurrentWeekStart((prev) => prev.add(1, "week"));
  };

  const handleRegister = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);

      const dateStr = values.date.format("YYYY-MM-DD");

      // Ghép ngày làm việc với giờ bắt đầu & kết thúc theo đúng múi giờ địa phương (tránh lệch múi giờ UTC+7)
      let startDateTime = values.date
        .hour(values.timeRange[0].hour())
        .minute(values.timeRange[0].minute())
        .second(0);

      let endDateTime = values.date
        .hour(values.timeRange[1].hour())
        .minute(values.timeRange[1].minute())
        .second(0);

      // Nếu ca làm việc qua đêm (giờ kết thúc nhỏ hơn hoặc bằng giờ bắt đầu), tính sang ngày hôm sau
      if (endDateTime.isBefore(startDateTime) || endDateTime.isSame(startDateTime)) {
        endDateTime = endDateTime.add(1, "day");
      }

      const payload = {
        date: dateStr,
        start_time: startDateTime.toISOString(),
        end_time: endDateTime.toISOString(),
        note: values.note ? values.note.trim() : null
      };

      if (isOffline) {
        await queueOfflineAction({
          type: "REGISTER_SHIFT",
          payload: {
            ...payload,
            clientActionId: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : undefined
          }
        });
        message.warning("Mất kết nối mạng. Đăng ký ca đã được lưu ngoại tuyến và sẽ tự động gửi khi có mạng (BR-27)!");
        
        // Optimistic update: Thêm ngay ca này vào danh sách hiển thị với trạng thái 'Chờ duyệt'
        const optimisticShift = {
          id: `temp_${Date.now()}`,
          date: dateStr,
          start_time: startDateTime.toISOString(),
          end_time: endDateTime.toISOString(),
          note: values.note ? values.note.trim() : null,
          status: "Requested",
          isOfflinePending: true,
        };
        setShifts(prev => [optimisticShift, ...prev]);

        form.resetFields();
      } else {
        const res = await driverApi.registerShift(payload);
        message.success(res.message || "Đã gửi đăng ký ca. Vui lòng chờ Quản lý duyệt. (MSG77)");
        form.resetFields();
        fetchShifts();
      }
    } catch (err) {
      if (err.errorFields) return;
      message.error(err.message || "Không thể đăng ký ca làm việc");
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusTag = (status, rejectionReason) => {
    switch (status) {
      case "Approved":
        return <Tag color="success" className="font-bold flex items-center gap-1"><CheckCircle2 size={12}/> Đã duyệt</Tag>;
      case "Rejected":
        return (
          <div className="flex flex-col items-start gap-1">
            <Tag color="error" className="font-bold flex items-center gap-1"><XCircle size={12}/> Từ chối</Tag>
            {rejectionReason && (
              <span className="text-[11px] text-red-400 italic">Lý do: {rejectionReason}</span>
            )}
          </div>
        );
      case "Requested":
      default:
        return <Tag color="warning" className="font-bold flex items-center gap-1"><AlertCircle size={12}/> Chờ duyệt</Tag>;
    }
  };

  return (
    <div className="p-4 max-w-md mx-auto text-slate-100 min-h-screen">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-white flex items-center gap-2">
            <Calendar className="text-blue-500" size={24} /> Đăng ký Ca làm việc
          </h1>
          <p className="text-xs text-slate-400">Xem lịch và gửi đăng ký ca (UC-20 / BR-60)</p>
        </div>
        <div className="text-xs">
          {isOffline ? (
            <span className="flex items-center gap-1 text-amber-400 bg-amber-500/10 px-2 py-1 rounded-full border border-amber-500/30">
              <CloudOff size={12} /> Ngoại tuyến
            </span>
          ) : (
            <span className="flex items-center gap-1 text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-full border border-emerald-500/30">
              <Cloud size={12} /> Trực tuyến
            </span>
          )}
        </div>
      </div>

      {/* Week Selector */}
      <div className="bg-slate-800/80 backdrop-blur-md border border-slate-700/80 rounded-2xl p-3 mb-4 flex items-center justify-between shadow-lg">
        <button
          onClick={handlePrevWeek}
          className="p-2 hover:bg-slate-700 rounded-xl text-slate-300 transition-colors"
        >
          <ChevronLeft size={20} />
        </button>
        <div className="text-center">
          <span className="text-xs text-slate-400 uppercase tracking-wider block font-bold">Tuần</span>
          <span className="text-sm font-black text-white">
            {currentWeekStart.format("DD/MM")} - {weekEnd.format("DD/MM/YYYY")}
          </span>
        </div>
        <button
          onClick={handleNextWeek}
          className="p-2 hover:bg-slate-700 rounded-xl text-slate-300 transition-colors"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {/* New Shift Form */}
      <div className="bg-slate-800/90 border border-slate-700/80 rounded-3xl p-4 mb-5 shadow-xl text-slate-100">
        <h2 className="text-sm font-black text-white mb-3 flex items-center gap-2">
          <Plus size={16} className="text-blue-400" /> Đăng ký Ca mới
        </h2>

        <Form form={form} layout="vertical">
          <Form.Item
            name="date"
            label={<span className="text-xs font-bold text-slate-300">Ngày làm việc (*)</span>}
            rules={[{ required: true, message: "Vui lòng chọn ngày" }]}
          >
            <DatePicker
              className="w-full py-2 bg-slate-900 border-slate-700 text-white rounded-xl"
              disabledDate={(current) => current && current < dayjs().startOf("day")}
              placeholder="Chọn ngày làm việc (hôm nay trở đi)"
              format="DD/MM/YYYY"
            />
          </Form.Item>

          <Form.Item
            name="timeRange"
            label={
              <div className="flex items-center justify-between w-full">
                <span className="text-xs font-bold text-slate-300">Khung giờ ca (*)</span>
                <span className="text-[10px] text-blue-400 font-normal">Hỗ trợ ca xuyên đêm qua hôm sau</span>
              </div>
            }
            rules={[{ required: true, message: "Vui lòng chọn giờ bắt đầu và kết thúc" }]}
          >
            <TimePicker.RangePicker
              order={false}
              className="w-full py-2 bg-slate-900 border-slate-700 text-white rounded-xl"
              format="HH:mm"
              minuteStep={15}
              placeholder={["Giờ bắt đầu", "Giờ kết thúc"]}
            />
          </Form.Item>

          <Form.Item
            name="note"
            label={<span className="text-xs font-bold text-slate-300">Ghi chú (Tối đa 200 ký tự)</span>}
          >
            <Input.TextArea
              rows={2}
              maxLength={200}
              placeholder="Ghi chú thêm về tuyến đường mong muốn hoặc lý do..."
              className="bg-slate-900 border-slate-700 text-white rounded-xl placeholder-slate-500"
            />
          </Form.Item>

          <Button
            type="primary"
            size="large"
            loading={submitting}
            onClick={handleRegister}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 border-none font-black rounded-xl h-12 shadow-lg shadow-blue-600/30"
          >
            Gửi Đăng Ký Ca (BR-60)
          </Button>
        </Form>
      </div>

      {/* Registered Shifts List */}
      <div>
        <h2 className="text-sm font-black text-white mb-3 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Clock size={16} className="text-blue-400" /> Ca đã đăng ký trong tuần
          </span>
          <span className="text-xs text-slate-400 font-normal">
            {shifts.length} ca
          </span>
        </h2>

        {loading ? (
          <div className="text-center py-8">
            <Spin size="large" />
          </div>
        ) : shifts.length === 0 ? (
          <div className="bg-slate-800/40 border border-slate-800 rounded-2xl p-6 text-center">
            <Empty description={<span className="text-slate-400 text-xs">Chưa có ca làm việc nào trong tuần này</span>} />
          </div>
        ) : (
          <div className="space-y-3">
            {shifts.map((shift) => {
              const startT = dayjs(shift.start_time).format("HH:mm");
              const endT = dayjs(shift.end_time).format("HH:mm");
              const dateFormatted = dayjs(shift.date).format("dddd, DD/MM/YYYY");
              
              // Kiểm tra xem ca làm có kéo dài sang ngày hôm sau hay không
              const isOvernight =
                dayjs(shift.end_time).isAfter(dayjs(shift.start_time), "day") ||
                dayjs(shift.end_time).diff(dayjs(shift.start_time), "hour") >= 24;

              return (
                <div
                  key={shift.id}
                  className="bg-slate-800/90 border border-slate-700/80 p-3.5 rounded-2xl shadow-md transition-all hover:border-slate-600"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <span className="text-xs font-bold text-slate-300 block capitalize">
                        {dateFormatted}
                      </span>
                      <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                        <span className="text-sm font-black text-white">
                          {startT} - {endT}
                        </span>
                        {isOvernight && (
                          <span className="text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 px-1.5 py-0.2 rounded-md font-bold flex items-center gap-1">
                            🌙 Hôm sau (+1 ngày)
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {getStatusTag(shift.status, shift.rejection_reason)}
                      {shift.isOfflinePending && (
                        <span className="text-[10px] text-amber-400 font-bold bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                          Chờ đồng bộ
                        </span>
                      )}
                    </div>
                  </div>

                  {shift.note && (
                    <p className="text-xs text-slate-400 bg-slate-900/50 p-2 rounded-lg mt-1 italic">
                      &ldquo;{shift.note}&rdquo;
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
