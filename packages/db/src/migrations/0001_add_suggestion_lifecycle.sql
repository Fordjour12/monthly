-- Add new fields to ai_suggestions table
ALTER TABLE ai_suggestions ADD COLUMN is_archived BOOLEAN DEFAULT FALSE NOT NULL;
ALTER TABLE ai_suggestions ADD COLUMN status TEXT DEFAULT 'active' NOT NULL CHECK (status IN ('draft', 'active', 'archived', 'applied'));
ALTER TABLE ai_suggestions ADD COLUMN metadata TEXT;
ALTER TABLE ai_suggestions ADD COLUMN effectiveness_score INTEGER DEFAULT 0;

-- Create new indexes for better performance
CREATE INDEX ai_suggestions_isArchived_idx ON ai_suggestions(is_archived);
CREATE INDEX ai_suggestions_status_idx ON ai_suggestions(status);
CREATE INDEX ai_suggestions_userTypeStatus_idx ON ai_suggestions(user_id, type, status);

-- Update existing records to have proper status based on is_applied
UPDATE ai_suggestions SET status = CASE 
  WHEN is_applied = 1 THEN 'applied'
  ELSE 'active'
END WHERE status = 'active';