const supabase = require("../config/supabase");

// 1. DASHBOARD: Thống kê tổng quan
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

// 2. FLEET: Lấy danh sách đội xe & tài xế
const getVehicles = async (req, res) => {
    try {
        const { data: trucksResult, error: trucksErr } = await supabase
            .from('trucks')
            .select(`
                id, 
                plate_number, 
                payload_kg, 
                status, 
                box_length_cm, 
                box_width_cm, 
                box_height_cm,
                inspection_expiry,
                insurance_expiry
            `)
            .is('deleted_at', null)
            .order('id', { ascending: true });

        if (trucksErr) throw trucksErr;

        const { data: driversResult, error: driversErr } = await supabase
            .from('driver_profiles')
            .select(`
                id, 
                user_id, 
                license_class, 
                license_expiry, 
                status,
                user:users(full_name, phone)
            `)
            .order('id', { ascending: true });

        if (driversErr) throw driversErr;

        const formattedDrivers = (driversResult || []).map(dp => ({
            id: dp.id,
            user_id: dp.user_id,
            name: dp.user?.full_name || 'Tài xế',
            phone: dp.user?.phone || '',
            license: dp.license_class,
            expiry: dp.license_expiry,
            status: dp.status
        }));

        return res.json({ 
            trucks: trucksResult || [],
            drivers: formattedDrivers
        });
    } catch (error) {
        console.error("Get Vehicles Error:", error);
        return res.status(500).json({ message: "Internal server error", error: error.message });
    }
};

// Thêm tài xế mới
const createDriver = async (req, res) => {
    try {
        const { name, phone, license, expiry } = req.body;
        if (!name || !phone) {
            return res.status(400).json({ message: "Tên và số điện thoại là bắt buộc" });
        }

        const username = `driver_${phone.slice(-4)}_${Math.floor(Math.random() * 100)}`;
        const { data: newUser, error: userErr } = await supabase
            .from('users')
            .insert({
                username,
                full_name: name,
                phone,
                role_id: 4,
                status: 'ACTIVE'
            })
            .select('id, full_name, phone')
            .single();

        if (userErr) throw userErr;

        const licenseNumber = `GPLX-${phone.slice(-6)}`;
        const { data: newProfile, error: profileErr } = await supabase
            .from('driver_profiles')
            .insert({
                user_id: newUser.id,
                license_number: licenseNumber,
                license_class: license || 'B2',
                license_expiry: expiry ? new Date(expiry).toISOString() : null,
                status: 'ACTIVE'
            })
            .select('*')
            .single();

        if (profileErr) throw profileErr;

        return res.status(201).json({
            message: "Thêm tài xế thành công",
            driver: {
                id: newProfile.id,
                name: newUser.full_name,
                phone: newUser.phone,
                license: newProfile.license_class,
                expiry: newProfile.license_expiry,
                status: newProfile.status
            }
        });
    } catch (error) {
        console.error("Create Driver Error:", error);
        return res.status(500).json({ message: "Không thể thêm tài xế", error: error.message });
    }
};

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

// 4. VENDORS: Lấy danh sách nhà cung cấp & hợp đồng
const getVendors = async (req, res) => {
    try {
        const { data: vendorsList, error: vErr } = await supabase
            .from('vendors')
            .select(`
                id, 
                company_name, 
                approval_status, 
                contact_person, 
                phone,
                truck_types,
                transport_contracts(id, contract_number, valid_to, status)
            `)
            .order('id', { ascending: false });

        if (vErr) throw vErr;

        const formattedVendors = (vendorsList || []).map(v => {
            const tc = Array.isArray(v.transport_contracts) ? v.transport_contracts[0] : v.transport_contracts;
            return {
                id: v.id,
                name: v.company_name,
                status: v.approval_status,
                contact_person: v.contact_person,
                phone: v.phone,
                truck_types: v.truck_types,
                contract_id: tc?.id || null,
                contractId: tc?.contract_number || `HD-${v.id}-2026`,
                expiry: tc?.valid_to || null,
                contract_status: tc?.status || 'INACTIVE'
            };
        });

        const totalVendors = vendorsList?.length || 0;
        const approvedVendors = (vendorsList || []).filter(v => v.approval_status === 'APPROVED').length;
        const pendingVendors = (vendorsList || []).filter(v => v.approval_status === 'PENDING').length;

        const { count: totalContracts } = await supabase
            .from('transport_contracts')
            .select('*', { count: 'exact', head: true });

        const { count: activeContracts } = await supabase
            .from('transport_contracts')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'ACTIVE');

        return res.json({ 
            vendors: formattedVendors,
            stats: {
                totalVendors,
                approvedVendors,
                pendingVendors,
                totalContracts: totalContracts || 0,
                activeContracts: activeContracts || 0
            }
        });
    } catch (error) {
        console.error("Get Vendors Error:", error);
        return res.status(500).json({ message: "Internal server error", error: error.message });
    }
};

// Phê duyệt nhà cung cấp / Hợp đồng
const approveVendor = async (req, res) => {
    try {
        const { id } = req.params;

        await supabase
            .from('vendors')
            .update({ approval_status: 'APPROVED', updated_at: new Date().toISOString() })
            .eq('id', id);

        await supabase
            .from('transport_contracts')
            .update({ status: 'ACTIVE', updated_at: new Date().toISOString() })
            .eq('vendor_id', id);

        return res.json({ message: "Phê duyệt đối tác và hợp đồng thành công" });
    } catch (error) {
        console.error("Approve Vendor Error:", error);
        return res.status(500).json({ message: "Phê duyệt thất bại", error: error.message });
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

// 6. BLOGS: Quản lý bản tin & báo cáo chuyên ngành
const getBlogs = async (req, res) => {
    try {
        const { data: blogsList, error: bErr } = await supabase
            .from('blogs')
            .select('*')
            .order('id', { ascending: false });

        if (bErr) throw bErr;

        const totalBlogs = blogsList?.length || 0;
        const publishedBlogs = (blogsList || []).filter(b => b.status === 'PUBLISHED').length;
        const draftBlogs = (blogsList || []).filter(b => b.status === 'DRAFT').length;
        const pendingBlogs = (blogsList || []).filter(b => b.status === 'PENDING').length;
        const totalViews = (blogsList || []).reduce((sum, b) => sum + Number(b.views || 0), 0);

        const formatted = (blogsList || []).map(b => ({
            id: b.id,
            title: b.title,
            summary: b.summary,
            content: b.content,
            category: b.category,
            author: b.author,
            authorInitial: b.author_initial,
            authorColor: b.author_color,
            views: b.views,
            status: b.status,
            statusLabel: b.status_label,
            image: b.image_url,
            publishDate: b.published_at ? new Date(b.published_at).toLocaleDateString('vi-VN') : null
        }));

        return res.json({
            blogs: formatted,
            stats: {
                totalBlogs,
                publishedBlogs,
                draftBlogs,
                pendingBlogs,
                totalViews
            }
        });
    } catch (error) {
        console.error("Get Blogs Error:", error);
        return res.status(500).json({ message: "Internal server error", error: error.message });
    }
};

const createBlog = async (req, res) => {
    try {
        const { title, summary, content, category, author, status, image } = req.body;
        const initial = (author || 'Q').charAt(0).toUpperCase();
        const statusText = status || 'PUBLISHED';
        const statusLabel = statusText === 'DRAFT' ? 'Bản nháp' : (statusText === 'PENDING' ? 'Chờ duyệt xuất bản' : 'Đã xuất bản');

        const { data: newBlog, error } = await supabase
            .from('blogs')
            .insert({
                title,
                summary: summary || '',
                content: content || '',
                category: category || 'Thị trường & Vận hành',
                author: author || 'Nguyễn Quản Lý',
                author_initial: initial,
                author_color: 'bg-secondary text-white',
                views: 0,
                status: statusText,
                status_label: statusLabel,
                image_url: image || null,
                published_at: statusText === 'PUBLISHED' ? new Date().toISOString() : null
            })
            .select('id, title, category, status, published_at')
            .single();

        if (error) throw error;

        return res.status(201).json({
            message: "Tạo bài viết thành công",
            blog: {
                ...newBlog,
                publishDate: newBlog.published_at ? new Date(newBlog.published_at).toLocaleDateString('vi-VN') : null
            }
        });
    } catch (error) {
        console.error("Create Blog Error:", error);
        return res.status(500).json({ message: "Lỗi tạo bài viết", error: error.message });
    }
};

const approveBlog = async (req, res) => {
    try {
        const { id } = req.params;
        const { error } = await supabase
            .from('blogs')
            .update({
                status: 'PUBLISHED',
                status_label: 'Đã xuất bản',
                published_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq('id', id);

        if (error) throw error;
        return res.json({ message: "Duyệt xuất bản bài viết thành công" });
    } catch (error) {
        console.error("Approve Blog Error:", error);
        return res.status(500).json({ message: "Duyệt bài viết thất bại", error: error.message });
    }
};

const deleteBlog = async (req, res) => {
    try {
        const { id } = req.params;
        const { error } = await supabase.from('blogs').delete().eq('id', id);
        if (error) throw error;
        return res.json({ message: "Xoá bài viết thành công" });
    } catch (error) {
        console.error("Delete Blog Error:", error);
        return res.status(500).json({ message: "Xoá bài viết thất bại", error: error.message });
    }
};

const updateBlog = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, summary, content, category, author, status, image } = req.body;
        const updatePayload = { updated_at: new Date().toISOString() };
        if (title !== undefined) updatePayload.title = title;
        if (summary !== undefined) updatePayload.summary = summary;
        if (content !== undefined) updatePayload.content = content;
        if (category !== undefined) updatePayload.category = category;
        if (author !== undefined) {
            updatePayload.author = author;
            updatePayload.author_initial = author.charAt(0).toUpperCase();
        }
        if (status !== undefined) {
            updatePayload.status = status;
            updatePayload.status_label = status === 'DRAFT' ? 'Bản nháp' : (status === 'PENDING' ? 'Chờ duyệt xuất bản' : 'Đã xuất bản');
            if (status === 'PUBLISHED') updatePayload.published_at = new Date().toISOString();
        }
        if (image !== undefined) updatePayload.image_url = image;

        const { data: updatedBlog, error } = await supabase
            .from('blogs')
            .update(updatePayload)
            .eq('id', id)
            .select('id, title, category, status, published_at')
            .single();

        if (error || !updatedBlog) {
            return res.status(404).json({ message: "Không tìm thấy bài viết để cập nhật" });
        }

        return res.json({
            message: "Cập nhật bài viết thành công",
            blog: {
                ...updatedBlog,
                publishDate: updatedBlog.published_at ? new Date(updatedBlog.published_at).toLocaleDateString('vi-VN') : null
            }
        });
    } catch (error) {
        console.error("Update Blog Error:", error);
        return res.status(500).json({ message: "Lỗi cập nhật bài viết", error: error.message });
    }
};

module.exports = {
    getDashboardStats,
    getVehicles,
    createDriver,
    getOrders,
    reassignOrder,
    getVendors,
    approveVendor,
    getApprovals,
    decideApproval,
    getBlogs,
    createBlog,
    updateBlog,
    approveBlog,
    deleteBlog
};
