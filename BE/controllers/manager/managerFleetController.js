const supabase = require('../../config/supabase');

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


module.exports = {
  getVehicles,
  createDriver,
  getVendors,
  approveVendor
};