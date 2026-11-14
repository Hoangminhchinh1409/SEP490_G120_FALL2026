-- Migration: 20261112_incident_compensation_redesign.sql
-- Thêm các trường phục vụ quy trình xét duyệt bồi thường & đóng sự cố (Role: Manager)

ALTER TABLE incidents 
  ADD COLUMN IF NOT EXISTS damage_percentage INT,
  ADD COLUMN IF NOT EXISTS goods_handling_method VARCHAR(50),
  ADD COLUMN IF NOT EXISTS contract_clause_ref VARCHAR(255),
  ADD COLUMN IF NOT EXISTS proposed_compensation_amount BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS approved_compensation_amount BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS contact_hotline VARCHAR(20) DEFAULT '1900 1234',
  ADD COLUMN IF NOT EXISTS payment_proof_url VARCHAR(500),
  ADD COLUMN IF NOT EXISTS incident_lat DECIMAL(9, 6),
  ADD COLUMN IF NOT EXISTS incident_lng DECIMAL(9, 6),
  ADD COLUMN IF NOT EXISTS is_on_route BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS route_deviation_km DECIMAL(5, 2),
  ADD COLUMN IF NOT EXISTS closed_by BIGINT,
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ(6);

-- Đảm bảo cột status chấp nhận độ dài lớn hơn (PENDING_APPROVAL, ESCALATED_TO_MANAGER, APPROVED, REJECTED, DONE)
ALTER TABLE incidents ALTER COLUMN status TYPE VARCHAR(30);

