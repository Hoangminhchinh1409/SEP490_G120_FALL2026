const supabase = require('../../config/supabase');

/**
 * Controller Quản lý Ca làm việc Tài xế dành cho Manager (UC-20 V2 - Screen 25)
 * - Tài xế đăng ký ca từ PWA với status = 'Requested'
 * - Manager xem danh sách, Duyệt (Approve) hoặc Từ chối (Reject) (gửi MSG80)
 * - Manager tự thêm ca (mặc định Approved)
 * - Cảnh báo BR-34: Vượt 10h/ngày hoặc 48h/tuần
 * - Ràng buộc BR-08: Không chồng lấn ca cùng ngày
 */
const managerShiftController = {
  // 1. Lấy danh sách ca làm việc theo tuần / ngày / trạng thái / tài xế
  getShifts: async (req, res) => {
    try {
      const { from, to, status, driver_id } = req.query;

      let query = supabase
        .from('driver_shifts')
        .select(`
          id,
          driver_id,
          date,
          start_time,
          end_time,
          status,
          note,
          rejection_reason,
          created_by,
          registered_by,
          reviewed_by,
          reviewed_at,
          created_at,
          updated_at,
          driver_profiles (
            id,
            license_number,
            license_class,
            users (
              id,
              full_name,
              phone,
              username
            )
          )
        `)
        .order('date', { ascending: true })
        .order('start_time', { ascending: true });

      if (from) {
        query = query.gte('date', from);
      }
      if (to) {
        query = query.lte('date', to);
      }
      if (status && status !== 'ALL') {
        query = query.eq('status', status);
      }
      if (driver_id) {
        query = query.eq('driver_id', driver_id);
      }

      const { data, error } = await query;
      if (error) throw error;

      const formatted = (data || []).map(s => {
        const dp = s.driver_profiles;
        const u = dp?.users;
        
        let startH = 0;
        let endH = 0;
        let durationHours = 0;
        try {
          const st = new Date(s.start_time);
          const et = new Date(s.end_time);
          durationHours = Math.max(0, Number(((et - st) / (1000 * 60 * 60)).toFixed(1)));
        } catch (e) {
          durationHours = 8;
        }

        return {
          id: s.id,
          driver_id: s.driver_id,
          driver_name: u?.full_name || u?.username || `Tài xế #${s.driver_id}`,
          driver_phone: u?.phone || '',
          driver_username: u?.username || '',
          license_class: dp?.license_class || '',
          license_number: dp?.license_number || '',
          date: s.date,
          start_time: s.start_time,
          end_time: s.end_time,
          duration_hours: durationHours,
          status: s.status, // 'Requested', 'Approved', 'Rejected'
          note: s.note,
          rejection_reason: s.rejection_reason,
          reviewed_at: s.reviewed_at,
          created_at: s.created_at
        };
      });

      return res.json({
        total: formatted.length,
        shifts: formatted
      });
    } catch (error) {
      console.error('getShifts Error:', error);
      return res.status(500).json({ message: 'Lỗi khi lấy danh sách ca làm việc', error: error.message });
    }
  },

  // 2. Phê duyệt ca làm việc (Approve - UC-20 V2)
  approveShift: async (req, res) => {
    try {
      const { id } = req.params;
      const reviewerId = req.user?.id || null;

      // Lấy thông tin ca hiện tại
      const { data: existing, error: getErr } = await supabase
        .from('driver_shifts')
        .select('*, driver_profiles(users(full_name))')
        .eq('id', id)
        .single();

      if (getErr || !existing) {
        return res.status(404).json({ message: 'Không tìm thấy ca làm việc' });
      }

      // Cập nhật trạng thái sang Approved
      const { data: updated, error: updateErr } = await supabase
        .from('driver_shifts')
        .update({
          status: 'Approved',
          reviewed_by: reviewerId,
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (updateErr) throw updateErr;

      // Kiểm tra cảnh báo BR-34 (Tổng giờ lái trong ngày có vượt 10h không)
      let warningMessage = null;
      try {
        const { data: dayShifts } = await supabase
          .from('driver_shifts')
          .select('start_time, end_time')
          .eq('driver_id', existing.driver_id)
          .eq('date', existing.date)
          .eq('status', 'Approved');

        let totalHours = 0;
        (dayShifts || []).forEach(sh => {
          const diff = (new Date(sh.end_time) - new Date(sh.start_time)) / (1000 * 60 * 60);
          if (diff > 0) totalHours += diff;
        });

        if (totalHours > 10) {
          warningMessage = `Cảnh báo BR-34: Tổng giờ làm việc trong ngày ${existing.date} của tài xế đạt ${totalHours.toFixed(1)}h, vượt quá giới hạn an toàn 10 giờ/ngày.`;
        }
      } catch (err) {
        console.warn('BR-34 check warning:', err.message);
      }

      return res.json({
        message: 'Đã phê duyệt ca làm việc thành công (MSG80).',
        warning: warningMessage,
        shift: updated
      });
    } catch (error) {
      console.error('approveShift Error:', error);
      return res.status(500).json({ message: 'Lỗi khi duyệt ca làm việc', error: error.message });
    }
  },

  // 3. Từ chối ca làm việc (Reject - UC-20 V2)
  rejectShift: async (req, res) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const reviewerId = req.user?.id || null;

      const { data: updated, error } = await supabase
        .from('driver_shifts')
        .update({
          status: 'Rejected',
          rejection_reason: reason || 'Quản lý không phê duyệt ca này',
          reviewed_by: reviewerId,
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      return res.json({
        message: 'Đã từ chối ca làm việc thành công (MSG80).',
        shift: updated
      });
    } catch (error) {
      console.error('rejectShift Error:', error);
      return res.status(500).json({ message: 'Lỗi khi từ chối ca làm việc', error: error.message });
    }
  },

  // 4. Manager trực tiếp thêm ca làm việc cho tài xế (mặc định Approved)
  createShift: async (req, res) => {
    try {
      const { driver_id, date, start_time, end_time, note } = req.body;
      const creatorId = req.user?.id || null;

      if (!driver_id || !date || !start_time || !end_time) {
        return res.status(400).json({ message: 'Tài xế, ngày và khoảng thời gian bắt đầu - kết thúc là bắt buộc' });
      }

      // Format ISO times
      let isoStart = start_time;
      let isoEnd = end_time;
      if (!start_time.includes('T')) {
        isoStart = `${date}T${start_time}:00+07:00`;
      }
      if (!end_time.includes('T')) {
        isoEnd = `${date}T${end_time}:00+07:00`;
      }

      // BR-08: Kiểm tra ca làm việc chồng lấn
      const { data: existingShifts } = await supabase
        .from('driver_shifts')
        .select('id, start_time, end_time, status')
        .eq('driver_id', driver_id)
        .eq('date', date)
        .neq('status', 'Rejected');

      const newStartMs = new Date(isoStart).getTime();
      const newEndMs = new Date(isoEnd).getTime();

      const hasOverlap = (existingShifts || []).some(s => {
        const curStart = new Date(s.start_time).getTime();
        const curEnd = new Date(s.end_time).getTime();
        return Math.max(newStartMs, curStart) < Math.min(newEndMs, curEnd);
      });

      if (hasOverlap) {
        return res.status(400).json({ 
          message: 'Lỗi BR-08: Tài xế này đã có ca làm việc khác chồng lấn thời gian trong ngày này.' 
        });
      }

      const { data: newShift, error } = await supabase
        .from('driver_shifts')
        .insert({
          driver_id,
          date,
          start_time: isoStart,
          end_time: isoEnd,
          note: note || 'Ca trực do Quản lý tạo',
          status: 'Approved',
          created_by: creatorId,
          registered_by: creatorId,
          reviewed_by: creatorId,
          reviewed_at: new Date().toISOString()
        })
        .select(`
          *,
          driver_profiles (
            users (full_name, phone)
          )
        `)
        .single();

      if (error) throw error;

      // Kiểm tra cảnh báo BR-34
      let warningMessage = null;
      try {
        const { data: dayShifts } = await supabase
          .from('driver_shifts')
          .select('start_time, end_time')
          .eq('driver_id', driver_id)
          .eq('date', date)
          .eq('status', 'Approved');

        let totalHours = 0;
        (dayShifts || []).forEach(sh => {
          const diff = (new Date(sh.end_time) - new Date(sh.start_time)) / (1000 * 60 * 60);
          if (diff > 0) totalHours += diff;
        });

        if (totalHours > 10) {
          warningMessage = `Cảnh báo BR-34: Ca làm việc đã lưu nhưng tổng giờ làm việc trong ngày của tài xế đạt ${totalHours.toFixed(1)}h, vượt quá 10 giờ/ngày.`;
        }
      } catch (err) {
        console.warn('BR-34 check warning:', err.message);
      }

      return res.status(201).json({
        message: 'Tạo ca làm việc cho tài xế thành công.',
        warning: warningMessage,
        shift: newShift
      });
    } catch (error) {
      console.error('createShift Error:', error);
      return res.status(500).json({ message: 'Lỗi khi tạo ca làm việc', error: error.message });
    }
  },

  // 5. Xóa hoặc hủy ca làm việc
  deleteShift: async (req, res) => {
    try {
      const { id } = req.params;
      const { error } = await supabase
        .from('driver_shifts')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return res.json({ message: 'Đã xóa ca làm việc thành công.' });
    } catch (error) {
      console.error('deleteShift Error:', error);
      return res.status(500).json({ message: 'Lỗi khi xóa ca làm việc', error: error.message });
    }
  }
};

module.exports = managerShiftController;
