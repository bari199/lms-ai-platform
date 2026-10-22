CREATE TABLE assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID REFERENCES courses(id),
    title VARCHAR(200),
    instructions TEXT,
    rubric JSONB,
    due_date TIMESTAMPTZ
);
