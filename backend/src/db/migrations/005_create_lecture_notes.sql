
CREATE TABLE lecture_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    lecture_id UUID NOT NULL REFERENCES lectures(id) ON DELETE CASCADE,
    timestamp_seconds INTEGER NOT NULL DEFAULT 0
        CHECK (timestamp_seconds >= 0),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_lecture_notes_student_id
    ON lecture_notes(student_id);

CREATE INDEX idx_lecture_notes_lecture_id
    ON lecture_notes(lecture_id);
