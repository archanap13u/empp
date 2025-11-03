-- Create project_access_requests table (reusing request_status ENUM)
CREATE TABLE IF NOT EXISTS project_access_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status request_status NOT NULL DEFAULT 'pending',
    requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMP,
    rejection_reason TEXT
);

-- Create indexes
CREATE INDEX idx_project_access_requests_project_id ON project_access_requests(project_id);
CREATE INDEX idx_project_access_requests_user_id ON project_access_requests(user_id);
CREATE INDEX idx_project_access_requests_status ON project_access_requests(status);

-- Create unique constraint for pending requests
CREATE UNIQUE INDEX idx_project_access_requests_pending
    ON project_access_requests(project_id, user_id, status)
    WHERE status = 'pending';
