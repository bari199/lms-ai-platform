-- Migration 017: In-app notifications

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,

    actor_id UUID
        REFERENCES users(id) ON DELETE SET NULL,

    course_id UUID
        REFERENCES courses(id) ON DELETE CASCADE,

    type VARCHAR(50) NOT NULL,

    title VARCHAR(200) NOT NULL,

    message TEXT NOT NULL,

    data JSONB NOT NULL DEFAULT '{}'::jsonb,

    is_read BOOLEAN NOT NULL DEFAULT FALSE,

    read_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT notifications_read_state_check
        CHECK (
            (is_read = FALSE AND read_at IS NULL)
            OR
            (is_read = TRUE AND read_at IS NOT NULL)
        )
);

-- User notification listing
CREATE INDEX idx_notifications_user_created
    ON notifications(user_id, created_at DESC);

-- Unread notification count
CREATE INDEX idx_notifications_user_unread
    ON notifications(user_id)
    WHERE is_read = FALSE;

-- Actor lookup
CREATE INDEX idx_notifications_actor
    ON notifications(actor_id)
    WHERE actor_id IS NOT NULL;