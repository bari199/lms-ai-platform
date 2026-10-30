ALTER TABLE quizzes
ADD COLUMN approval_status VARCHAR(20) NOT NULL DEFAULT 'approved';

ALTER TABLE quizzes
ADD CONSTRAINT quizzes_approval_status_check
CHECK (approval_status IN ('pending', 'approved', 'rejected'));