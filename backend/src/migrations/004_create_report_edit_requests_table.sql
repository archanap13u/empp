-- Create ENUM type for request status
CREATE TYPE request_status AS ENUM ('pending', 'approved', 'rejected');

-- Create report_edit_requests table
CREATE TABLE IF NOT EXISTS report_edit_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID NOT NULL REFERENCES daily_reports(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    status request_status NOT NULL DEFAULT 'pending',
    requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMP,
    rejection_reason TEXT,
    edit_deadline TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_report_edit_requests_report_id ON report_edit_requests(report_id);
CREATE INDEX idx_report_edit_requests_user_id ON report_edit_requests(user_id);
CREATE INDEX idx_report_edit_requests_status ON report_edit_requests(status);

-- Create unique constraint for pending requests
CREATE UNIQUE INDEX idx_report_edit_requests_pending
    ON report_edit_requests(report_id, status)
    WHERE status = 'pending';
