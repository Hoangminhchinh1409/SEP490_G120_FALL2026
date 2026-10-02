require("dotenv").config();
const { Pool } = require("pg");

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

const initDB = async () => {
    try {
        console.log("Starting Database Initialization...");

        // 1. Create Vehicles Table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS vehicles (
                id SERIAL PRIMARY KEY,
                plate_number VARCHAR(50) UNIQUE NOT NULL,
                type VARCHAR(50) NOT NULL,
                capacity NUMERIC NOT NULL,
                status VARCHAR(50) DEFAULT 'AVAILABLE',
                vendor_id INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log("Created table: vehicles");

        // 2. Create Vendors Table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS vendors (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                contact_name VARCHAR(100),
                phone VARCHAR(20),
                email VARCHAR(100),
                type VARCHAR(50) NOT NULL,
                status VARCHAR(20) DEFAULT 'ACTIVE',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log("Created table: vendors");

        // 3. Create Orders Table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS orders (
                id SERIAL PRIMARY KEY,
                tracking_code VARCHAR(100) UNIQUE NOT NULL,
                origin VARCHAR(255) NOT NULL,
                destination VARCHAR(255) NOT NULL,
                weight NUMERIC NOT NULL,
                status VARCHAR(50) DEFAULT 'PENDING',
                customer_name VARCHAR(100),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log("Created table: orders");

        // 4. Create Requests Table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS requests (
                id SERIAL PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                type VARCHAR(50) NOT NULL,
                description TEXT,
                amount NUMERIC DEFAULT 0,
                status VARCHAR(50) DEFAULT 'PENDING',
                requested_by INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log("Created table: requests");

        // Insert Mock Data (if tables are empty)
        const checkVehicles = await pool.query("SELECT COUNT(*) FROM vehicles");
        if (parseInt(checkVehicles.rows[0].count) === 0) {
            await pool.query(`
                INSERT INTO vendors (name, contact_name, phone, email, type, status) VALUES 
                ('Gara AutoCare', 'Nguyen Van A', '0987654321', 'gara@autocare.vn', 'MAINTENANCE', 'ACTIVE'),
                ('RentCar Pro', 'Le Thi B', '0123456789', 'contact@rentcar.vn', 'RENTAL', 'ACTIVE');
            `);
            
            await pool.query(`
                INSERT INTO vehicles (plate_number, type, capacity, status, vendor_id) VALUES 
                ('29H-123.45', 'Truck 5T', 5000, 'AVAILABLE', 1),
                ('29C-678.90', 'Truck 10T', 10000, 'ON_TRIP', NULL),
                ('30F-111.22', 'Van 2T', 2000, 'MAINTENANCE', 1);
            `);

            await pool.query(`
                INSERT INTO orders (tracking_code, origin, destination, weight, status, customer_name) VALUES 
                ('NEX-98765', 'Hanoi', 'Hai Phong', 2500, 'IN_TRANSIT', 'Samsung Bac Ninh'),
                ('NEX-54321', 'Bac Ninh', 'Noi Bai', 1200, 'PENDING', 'LG Display'),
                ('NEX-11223', 'Hai Phong', 'Hanoi', 5000, 'DELIVERED', 'VinFast');
            `);

            await pool.query(`
                INSERT INTO requests (title, type, description, amount, status, requested_by) VALUES 
                ('Bảo dưỡng định kỳ xe 29H-123.45', 'MAINTENANCE', 'Thay nhớt, kiểm tra phanh', 1500000, 'PENDING', 1),
                ('Đổ xăng chuyến Nội Bài', 'EXPENSE', 'Đổ xăng tại cây xăng Cầu Giấy', 500000, 'APPROVED', 1);
            `);
            console.log("Mock data inserted successfully!");
        }

        console.log("Database Initialization Completed!");
        process.exit(0);
    } catch (error) {
        console.error("Error initializing DB:", error);
        process.exit(1);
    }
};

initDB();
