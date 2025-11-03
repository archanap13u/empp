-- Create ENUM type for location status
CREATE TYPE location_status AS ENUM ('active', 'paused');

-- Create location_history table
CREATE TABLE IF NOT EXISTS location_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    latitude DECIMAL(10, 8) NOT NULL CHECK (latitude >= -90 AND latitude <= 90),
    longitude DECIMAL(11, 8) NOT NULL CHECK (longitude >= -180 AND longitude <= 180),
    accuracy DECIMAL(10, 2),
    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status location_status NOT NULL DEFAULT 'active'
);

-- Create indexes
CREATE INDEX idx_location_history_user_id ON location_history(user_id);
CREATE INDEX idx_location_history_timestamp ON location_history(timestamp);
CREATE INDEX idx_location_history_user_timestamp ON location_history(user_id, timestamp);
