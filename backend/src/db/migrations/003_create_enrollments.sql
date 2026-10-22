
CREATE TABLE enrollments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    progress_percentage NUMERIC(5, 2) NOT NULL DEFAULT 0,
    completed_at TIMESTAMPTZ,
    CONSTRAINT unique_student_course UNIQUE (student_id, course_id),
    CONSTRAINT valid_progress_percentage
        CHECK (progress_percentage >= 0 AND progress_percentage <= 100)
);

CREATE INDEX idx_enrollments_student_id
    ON enrollments(student_id);

CREATE INDEX idx_enrollments_course_id
    ON enrollments(course_id);
