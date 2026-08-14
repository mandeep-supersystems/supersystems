-- Run this in your PostgreSQL database to add the customer_pos column
ALTER TABLE project.projects
    ADD COLUMN IF NOT EXISTS customer_pos JSONB DEFAULT '[]';
