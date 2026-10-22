
CREATE TABLE lecture_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    lecture_id UUID NOT NULL REFERENCES lectures(id) ON DELETE CASCADE,
    watched_seconds INTEGER NOT NULL DEFAULT 0
        CHECK (watched_seconds >= 0),
    is_completed BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_student_lecture_progress
        UNIQUE (student_id, lecture_id)
);

CREATE INDEX idx_lecture_progress_student_id
    ON lecture_progress(student_id);

CREATE INDEX idx_lecture_progress_lecture_id
    ON lecture_progress(lecture_id);
