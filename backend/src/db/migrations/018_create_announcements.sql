-- Migration 018: Course announcements

CREATE TABLE announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    course_id UUID NOT NULL
        REFERENCES courses(id) ON DELETE CASCADE,

    instructor_id UUID NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,

    title VARCHAR(200) NOT NULL,

    message TEXT NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT announcements_title_check
        CHECK (length(trim(title)) > 0),

    CONSTRAINT announcements_message_check
        CHECK (length(trim(message)) > 0)
);

CREATE INDEX idx_announcements_course_created
    ON announcements(course_id, created_at DESC);

CREATE INDEX idx_announcements_instructor
    ON announcements(instructor_id, created_at DESC);