CREATE TABLE assignment_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id UUID REFERENCES assignments(id),
    user_id UUID REFERENCES users(id),
    file_url TEXT,
    submitted_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (assignment_id, user_id)
);

CREATE INDEX idx_assignment_submissions_assignment_id
    ON assignment_submissions(assignment_id);

CREATE INDEX idx_assignment_submissions_user_id
    ON assignment_submissions(user_id);
