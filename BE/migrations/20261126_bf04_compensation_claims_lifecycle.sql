-- Migration: 20261126_bf04_compensation_claims_lifecycle.sql
-- Mở rộng bảng compensation_claims theo chuẩn vòng đời BF-04 (Figure 5)

-- 1. Cho phép Guest (không có user account) tự gửi Claim từ Tracking Page
ALTER TABLE compensation_claims
  ALTER COLUMN created_by DROP NOT NULL;

-- 2. Cho phép amount >= 0 (hỗ trợ tạo Claim nháp / từ chối)
ALTER TABLE compensation_claims
  DROP CONSTRAINT IF EXISTS compensation_claims_amount_check;

ALTER TABLE compensation_claims
  ADD CONSTRAINT compensation_claims_amount_check CHECK (amount >= 0);

-- 3. Mở rộng độ dài status & source cho các trạng thái BF-04
ALTER TABLE compensation_claims
  ALTER COLUMN status TYPE VARCHAR(30),
  ALTER COLUMN source TYPE VARCHAR(30);

-- 4. Bổ sung các cột nghiệp vụ BF-04
ALTER TABLE compensation_claims
  ADD COLUMN IF NOT EXISTS evidence_photos JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS submitted_by_name VARCHAR(150),
  ADD COLUMN IF NOT EXISTS submitted_by_phone VARCHAR(30),
  ADD COLUMN IF NOT EXISTS assessment_result TEXT,
  ADD COLUMN IF NOT EXISTS damage_percentage INT,
  ADD COLUMN IF NOT EXISTS outcome VARCHAR(50),
  ADD COLUMN IF NOT EXISTS approved_amount BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS contract_clause_ref VARCHAR(255),
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS contact_hotline VARCHAR(20) DEFAULT '1900 1234',
  ADD COLUMN IF NOT EXISTS called_by BIGINT REFERENCES users(id) ON DELETE NO ACTION ON UPDATE NO ACTION,
  ADD COLUMN IF NOT EXISTS called_at TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS call_note TEXT,
  ADD COLUMN IF NOT EXISTS call_contact_phone VARCHAR(30),
  ADD COLUMN IF NOT EXISTS paid_by BIGINT REFERENCES users(id) ON DELETE NO ACTION ON UPDATE NO ACTION,
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS payment_date DATE,
  ADD COLUMN IF NOT EXISTS transaction_code VARCHAR(100),
  ADD COLUMN IF NOT EXISTS payment_proof_url VARCHAR(500),
  ADD COLUMN IF NOT EXISTS payment_note TEXT,
  ADD COLUMN IF NOT EXISTS customer_confirmed_at TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS close_method VARCHAR(30);

-- 5. Index phục vụ job tự đóng sau 7 ngày (status = 'PAID' AND paid_at <= NOW() - 7 days)
CREATE INDEX IF NOT EXISTS idx_compensation_claims_status_paid_at
  ON compensation_claims (status, paid_at);
