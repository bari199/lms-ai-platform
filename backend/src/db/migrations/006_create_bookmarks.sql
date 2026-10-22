
CREATE TABLE bookmarks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    lecture_id UUID REFERENCES lectures(id),
    timestamp_seconds INT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_bookmarks_user_id
    ON bookmarks(user_id);

CREATE INDEX idx_bookmarks_lecture_id
    ON bookmarks(lecture_id);
