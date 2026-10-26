# AI tutor setup

The AI tutor currently indexes lecture transcripts and answers student questions
with course-scoped retrieval. PDF and slide ingestion, summaries, quiz generation,
flashcards, and study plans are not part of this backend slice yet.

## Configuration

Set these variables in the backend environment:

- `OPENAI_API_KEY` for `text-embedding-3-small` embeddings (1536 dimensions)
- `ANTHROPIC_API_KEY` for generated answers
- `ANTHROPIC_MODEL` to a model enabled for the configured Anthropic account

Run the normal database migration command after deploying the code. Migration
`013_create_ai_tutor.sql` enables pgvector and creates chat and retrieval tables.

## API flow

1. An instructor with an approved course indexes its non-empty lecture transcripts:
   `POST /api/v1/ai/courses/:courseId/index`.
2. An enrolled student starts a course chat with
   `POST /api/v1/ai/chat/sessions` and `{ "course_id": "...", "mode": "intermediate" }`.
3. The student sends `{ "message": "..." }` to
   `POST /api/v1/ai/chat/sessions/:sessionId/messages`.
4. The student can change the explanation level with
   `PUT /api/v1/ai/chat/sessions/:sessionId/mode` and
   `{ "mode": "beginner" }` (or `intermediate` / `advanced`).

The chat response includes source lecture IDs, titles, excerpts, and citation
markers. Students must remain enrolled to create or continue a session. Indexing
is idempotent per lecture and should be repeated after transcript edits.
