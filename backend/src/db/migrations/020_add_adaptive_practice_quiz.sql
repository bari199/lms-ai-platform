ALTER TABLE quizzes
ADD COLUMN is_adaptive_practice BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE quizzes
ADD COLUMN created_for_student_id UUID
REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE quizzes
ADD COLUMN difficulty_level VARCHAR(30);

ALTER TABLE quizzes
ADD CONSTRAINT quizzes_adaptive_practice_check
CHECK (
    (
        is_adaptive_practice = FALSE
        AND created_for_student_id IS NULL
        AND difficulty_level IS NULL
    )
    OR
    (
        is_adaptive_practice = TRUE
        AND created_for_student_id IS NOT NULL
        AND difficulty_level IN (
            'beginner',
            'intermediate',
            'advanced',
            'advanced_challenge'
        )
    )
);

CREATE INDEX idx_quizzes_adaptive_student
ON quizzes(created_for_student_id)
WHERE is_adaptive_practice = TRUE;