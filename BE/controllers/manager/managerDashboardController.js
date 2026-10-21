const supabase = require('../../config/supabase');

const getDashboardStats = async (req, res) => {
    try {
        // Thống kê doanh thu và đơn hàng
        const { data: orders, error: ordersErr } = await supabase
            .from('orders')
            .select('agreed_price, late_risk, waiting_too_long');

        if (ordersErr) throw ordersErr;

        const totalOrders = orders?.length || 0;
        const totalRevenue = (orders || []).reduce((acc, cur) => acc + Number(cur.agreed_price || 0), 0);
        const delayedOrders = (orders || []).filter(o => o.late_risk || o.waiting_too_long).length;

        const slaRate = totalOrders > 0 
            ? (((totalOrders - delayedOrders) / totalOrders) * 100).toFixed(1) 
            : "92.5";

        // Thống kê xe
        const { data: trucks, error: trucksErr } = await supabase
            .from('trucks')
            .select('status')
            .is('deleted_at', null);

        if (trucksErr) throw trucksErr;

        const totalTrucks = trucks?.length || 0;
        const onTripTrucks = (trucks || []).filter(t => t.status === 'ON_TRIP').length;
        const truckUtilization = totalTrucks > 0 
            ? ((onTripTrucks / totalTrucks) * 100).toFixed(1) 
            : "85.4";

        // Thống kê sự cố
        const { data: incidents, error: incidentsErr } = await supabase
            .from('incidents')
            .select('id, type');

        if (incidentsErr) throw incidentsErr;

        const totalIncidents = incidents?.length || 0;
        const incidentCountMap = {};
        (incidents || []).forEach(inc => {
            if (inc.type) {
                incidentCountMap[inc.type] = (incidentCountMap[inc.type] || 0) + 1;
            }
        });

        const incidentTypeMap = {
            'BREAKDOWN': 'Hỏng xe',
            'ACCIDENT': 'Tai nạn',
            'CARGO_DAMAGED': 'Hàng hóa hư hỏng',
            'CARGO_LOST': 'Thất thoát hàng',
            'ROAD_BAN': 'Cấm đường / Trễ tuyến',
            'FAILED_DELIVERY': 'Giao hàng thất bại',
            'HELD_BY_AUTHORITIES': 'Cơ quan chức năng giữ xe',
            'OTHER': 'Sự cố khác'
        };

        const incidentData = Object.entries(incidentCountMap).map(([type, count], idx) => ({
            key: String(idx + 1),
            type: incidentTypeMap[type] || type,
            rawType: type,
            count: Number(count),
            trend: Number(count) > 5 ? 'up' : 'down'
        }));

        // Khối lượng đơn của Dispatchers
        const { data: dispatchers, error: dispErr } = await supabase
            .from('users')
            .select('id, username, full_name, role_id')
            .or('role_id.eq.3,username.ilike.%disp%');

        if (dispErr) throw dispErr;

        const { data: allOrders } = await supabase
            .from('orders')
            .select('id, responsible_dispatcher_id, status');

        const activeStatuses = ['READY_FOR_PLANNING', 'PLANNED', 'ASSIGNED', 'IN_TRANSIT'];
        const dispatcherWorkload = (dispatchers || []).slice(0, 5).map(d => {
            const userOrders = (allOrders || []).filter(o => o.responsible_dispatcher_id === d.id);
            const count = userOrders.length;
            const active = userOrders.filter(o => activeStatuses.includes(o.status)).length;
            const percent = count > 0 ? Math.min(Math.round((active / count) * 100), 100) : 0;
            return {
                id: d.id,
                name: `${d.full_name || d.username} (${d.username})`,
                count,
                active,
                percent: percent || 50
            };
        });

        return res.json({
            stats: {
                revenue: totalRevenue,
                revenueFormatted: totalRevenue >= 1000000000 
                    ? `${(totalRevenue / 1000000000).toFixed(2)}B` 
                    : (totalRevenue >= 1000000 
                        ? `${(totalRevenue / 1000000).toFixed(0)}M` 
                        : `${totalRevenue.toLocaleString('vi-VN')}`),
                truckUtilization: totalTrucks > 0 ? ((onTripTrucks / totalTrucks) * 100).toFixed(1) : "0.0",
                totalTrucks,
                onTripTrucks,
                slaRate: totalOrders > 0 ? (((totalOrders - delayedOrders) / totalOrders) * 100).toFixed(1) : "100.0",
                totalOrders,
                delayedOrders,
                totalIncidents,
                incidentData,
                dispatcherWorkload
            }
        });
    } catch (error) {
        console.error("Dashboard Stats Error:", error);
        return res.status(500).json({ message: "Internal server error", error: error.message });
    }
};


module.exports = {
  getDashboardStats
};