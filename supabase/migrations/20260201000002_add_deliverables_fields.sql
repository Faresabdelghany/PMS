-- ============================================
-- Add Deliverables Fields Migration
-- Migration: 20260201000002_add_deliverables_fields
-- ============================================

-- Create enums for deliverable and payment status
CREATE TYPE deliverable_status AS ENUM ('pending', 'in_progress', 'completed');
CREATE TYPE payment_status AS ENUM ('unpaid', 'invoiced', 'paid');

-- Add currency field to projects table
ALTER TABLE projects ADD COLUMN currency TEXT DEFAULT 'USD';

-- Add new fields to project_deliverables table
ALTER TABLE project_deliverables
  ADD COLUMN value DECIMAL(12,2),
  ADD COLUMN status deliverable_status DEFAULT 'pending' NOT NULL,
  ADD COLUMN payment_status payment_status DEFAULT 'unpaid' NOT NULL;

-- Add index for faster queries on deliverable status
CREATE INDEX idx_project_deliverables_status ON project_deliverables(status);
CREATE INDEX idx_project_deliverables_payment_status ON project_deliverables(payment_status);
