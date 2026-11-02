-- Migration 016: Course discussions

CREATE TABLE discussions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    course_id UUID NOT NULL
        REFERENCES courses(id) ON DELETE CASCADE,

    author_id UUID NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,

    parent_id UUID,

    title VARCHAR(200),

    content TEXT NOT NULL,

    is_pinned BOOLEAN NOT NULL DEFAULT FALSE,

    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT discussions_parent_fk
        FOREIGN KEY (parent_id)
        REFERENCES discussions(id)
        ON DELETE CASCADE,

    CONSTRAINT discussions_no_self_parent
        CHECK (parent_id IS NULL OR parent_id <> id),

    CONSTRAINT discussions_title_required_for_posts
        CHECK (parent_id IS NOT NULL OR title IS NOT NULL)
);

CREATE INDEX idx_discussions_course_created
    ON discussions(course_id, created_at DESC);

CREATE INDEX idx_discussions_author
    ON discussions(author_id);

CREATE INDEX idx_discussions_parent
    ON discussions(parent_id);

CREATE INDEX idx_discussions_pinned
    ON discussions(course_id, is_pinned)
    WHERE is_pinned = TRUE;