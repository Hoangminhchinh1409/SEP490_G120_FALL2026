"use client";
import React, { useState, useEffect, useCallback } from "react";
import { Form, DatePicker, TimePicker, Input, Button, Tag, message, Spin, Empty, Card } from "antd";
import { Calendar, Clock, Plus, ChevronLeft, ChevronRight, CheckCircle2, AlertCircle, XCircle, CloudOff, Cloud } from "lucide-react";
import dayjs from "dayjs";
import { driverApi, queueOfflineAction } from "../../api/driverApi";

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

  const weekEnd = currentWeekStart.add(6, "day");

  const fetchShifts = useCallback(async () => {
    try {
      setLoading(true);
      const fromStr = currentWeekStart.format("YYYY-MM-DD");
      const toStr = weekEnd.format("YYYY-MM-DD");
      const res = await driverApi.getMyShifts({ from: fromStr, to: toStr });
      setShifts(res?.shifts || []);
    } catch (err) {
      console.error("fetchShifts error:", err);
      message.error(err.message || "Không thể tải danh sách ca làm việc");
    } finally {
      setLoading(false);
    }
  }, [currentWeekStart, weekEnd]);

  useEffect(() => {
    fetchShifts();

    const handleOnline = () => {
      setIsOffline(false);
      fetchShifts();
    };
    const handleOffline = () => setIsOffline(true);

    if (typeof window !== "undefined") {
      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);
    }
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
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
      const startTimeStr = values.timeRange[0].format("HH:mm:ss");
      const endTimeStr = values.timeRange[1].format("HH:mm:ss");

      const payload = {
        date: dateStr,
        start_time: `${dateStr}T${startTimeStr}Z`,
        end_time: `${dateStr}T${endTimeStr}Z`,
        note: values.note ? values.note.trim() : null
      };

      if (isOffline) {
        queueOfflineAction({
          type: "REGISTER_SHIFT",
          payload: {
            ...payload,
            clientActionId: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : undefined
          }
        });
        message.warning("Mất kết nối mạng. Đăng ký ca đã được lưu ngoại tuyến và sẽ tự động gửi khi có mạng (BR-27)!");
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
      <Card
        className="bg-slate-800/90 border border-slate-700/80 rounded-3xl mb-5 shadow-xl text-slate-100"
        bodyStyle={{ padding: "16px" }}
      >
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
            label={<span className="text-xs font-bold text-slate-300">Khung giờ ca (*)</span>}
            rules={[{ required: true, message: "Vui lòng chọn giờ bắt đầu và kết thúc" }]}
          >
            <TimePicker.RangePicker
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
      </Card>

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
                      <span className="text-sm font-black text-white">
                        {startT} - {endT}
                      </span>
                    </div>
                    {getStatusTag(shift.status, shift.rejection_reason)}
                  </div>

                  {shift.note && (
                    <p className="text-xs text-slate-400 bg-slate-900/50 p-2 rounded-lg mt-1 italic">
                      "{shift.note}"
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
