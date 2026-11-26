-- Migration: 20261126_add_incident_cargo_affected.sql
-- Bổ sung cột cargo_affected cho bảng incidents (WF4 - TC_IC_03-06 / UI-37 / BUG-SYS-25)

ALTER TABLE incidents
  ADD COLUMN IF NOT EXISTS cargo_affected BOOLEAN DEFAULT NULL;
