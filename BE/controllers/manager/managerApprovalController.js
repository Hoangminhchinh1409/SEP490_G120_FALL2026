const supabase = require('../../config/supabase');

// 3. ORDERS: Lấy danh sách đơn hàng & danh sách Dispatchers
const getOrders = async (req, res) => {
    try {
        const { data: ordersData, error: ordersErr } = await supabase
            .from('orders')
            .select(`
                id, 
                order_code, 
                status, 
                responsible_dispatcher_id, 
                agreed_price, 
                created_at, 
                ready_for_planning_at, 
                waiting_too_long, 
                late_risk, 
                dispatcher:users!orders_responsible_dispatcher_id_fkey(username, full_name)
            `)
            .order('id', { ascending: false });

        if (ordersErr) throw ordersErr;

        const { data: dispatchersData, error: dispErr } = await supabase
            .from('users')
            .select('id, username, full_name, role_id')
            .or('role_id.eq.3,username.ilike.%disp%')
            .order('id', { ascending: true });

        if (dispErr) throw dispErr;

        const activeStatuses = ['READY_FOR_PLANNING', 'PLANNED', 'ASSIGNED', 'IN_TRANSIT'];
        const formattedOrders = (ordersData || []).map(o => ({
            id: o.id,
            order_code: o.order_code,
            status: o.status,
            responsible_dispatcher_id: o.responsible_dispatcher_id,
            agreed_price: o.agreed_price,
            created_at: o.created_at,
            ready_for_planning_at: o.ready_for_planning_at,
            waiting_too_long: o.waiting_too_long,
            late_risk: o.late_risk,
            dispatcher_username: o.dispatcher?.username || null,
            dispatcher_name: o.dispatcher?.full_name || null
        }));

        const formattedDispatchers = (dispatchersData || []).map(d => {
            const active_orders = (ordersData || []).filter(
                o => o.responsible_dispatcher_id === d.id && activeStatuses.includes(o.status)
            ).length;
            return {
                id: d.id,
                username: d.username,
                full_name: d.full_name,
                active_orders
            };
        });

        return res.json({ 
            orders: formattedOrders,
            dispatchers: formattedDispatchers
        });
    } catch (error) {
        console.error("Get Orders Error:", error);
        return res.status(500).json({ message: "Internal server error", error: error.message });
    }
};

// Chuyển giao đơn hàng sang Dispatcher khác
const reassignOrder = async (req, res) => {
    try {
        const { id } = req.params;
        const { newDispatcherId } = req.body;

        if (!newDispatcherId) {
            return res.status(400).json({ message: "Vui lòng chọn điều phối viên mới" });
        }

        const { data: updatedOrder, error } = await supabase
            .from('orders')
            .update({ 
                responsible_dispatcher_id: newDispatcherId, 
                updated_at: new Date().toISOString() 
            })
            .eq('id', id)
            .select('id, order_code, responsible_dispatcher_id')
            .single();

        if (error || !updatedOrder) {
            return res.status(404).json({ message: "Không tìm thấy đơn hàng" });
        }

        return res.json({ 
            message: "Chuyển giao đơn hàng thành công", 
            order: updatedOrder 
        });
    } catch (error) {
        console.error("Reassign Order Error:", error);
        return res.status(500).json({ message: "Chuyển giao thất bại", error: error.message });
    }
};


// 5. APPROVALS: Lấy danh sách các yêu cầu / sự cố cần duyệt
const getApprovals = async (req, res) => {
    try {
        const { data: incidentsList, error: incErr } = await supabase
            .from('incidents')
            .select(`
                id, 
                trip_id,
                type,
                fault,
                status,
                description,
                compensation_claims(id, amount, status, reason),
                driver:driver_profiles!incidents_reported_by_fkey(user:users(full_name))
            `)
            .order('id', { ascending: false });

        if (incErr) throw incErr;

        const formatted = (incidentsList || []).map(i => {
            const claim = Array.isArray(i.compensation_claims) ? i.compensation_claims[0] : i.compensation_claims;
            return {
                id: i.id,
                code: `INC-${String(i.id).padStart(3, '0')}`,
                tripId: i.trip_id ? `TRIP-${i.trip_id}` : 'TRIP-998',
                type: i.type,
                fault: i.fault,
                status: i.status,
                description: i.description,
                claim_id: claim?.id || null,
                cost: Number(claim?.amount || 0),
                claim_status: claim?.status || 'PENDING',
                claim_reason: claim?.reason || null,
                requester_name: i.driver?.user?.full_name || 'Tài xế'
            };
        });

        const totalIncidents = incidentsList?.length || 0;
        const pendingApprovals = formatted.filter(r => ['REPORTED', 'ESCALATED'].includes(r.status) || r.claim_status === 'PENDING').length;
        const approvedCount = formatted.filter(r => r.status === 'RESOLVED' || r.claim_status === 'APPROVED').length;
        const totalClaimAmount = formatted.reduce((sum, r) => sum + r.cost, 0);

        return res.json({ 
            requests: formatted,
            stats: {
                totalIncidents,
                pendingApprovals,
                approvedCount,
                totalClaimAmount
            }
        });
    } catch (error) {
        console.error("Get Approvals Error:", error);
        return res.status(500).json({ message: "Internal server error", error: error.message });
    }
};

// Quyết định phê duyệt hoặc từ chối bồi thường sự cố
const decideApproval = async (req, res) => {
    try {
        const { id } = req.params;
        const { action, reason, note } = req.body;
        const userId = req.user?.id || null;

        const isApprove = action === 'APPROVE' || action === 'Approve';
        const claimStatus = isApprove ? 'APPROVED' : 'REJECTED';
        const incidentStatus = isApprove ? 'RESOLVED' : 'CLOSED';
        const decisionComment = note || reason || (isApprove ? 'Phê duyệt bồi thường' : 'Từ chối bồi thường');

        // Cập nhật bồi thường
        await supabase
            .from('compensation_claims')
            .update({
                status: claimStatus,
                decided_by: userId,
                decided_at: new Date().toISOString(),
                decision_comment: decisionComment,
                updated_at: new Date().toISOString()
            })
            .or(`incident_id.eq.${id},id.eq.${id}`);

        // Cập nhật sự cố
        await supabase
            .from('incidents')
            .update({
                status: incidentStatus,
                resolution_note: decisionComment,
                resolved_by: userId,
                resolved_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq('id', id);

        return res.json({ 
            message: isApprove ? "Đã phê duyệt bồi thường thành công" : "Đã từ chối bồi thường thành công" 
        });
    } catch (error) {
        console.error("Decide Approval Error:", error);
        return res.status(500).json({ message: "Xử lý phê duyệt thất bại", error: error.message });
    }
};


module.exports = {
  getOrders,
  reassignOrder,
  getApprovals,
  decideApproval
};