
CREATE TABLE module_mastery_scores (
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    module_id UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
    mastery_score NUMERIC(5,2) NOT NULL
        CHECK (mastery_score >= 0 AND mastery_score <= 100),
    scored_attempts INT NOT NULL DEFAULT 0
        CHECK (scored_attempts >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (student_id, module_id)
);

CREATE INDEX idx_module_mastery_scores_module_id
    ON module_mastery_scores(module_id);
