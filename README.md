lms-ai-platform/
│
├── backend/
│ ├── src/
│ │ ├── config/
│ │ │ ├── db.ts
│ │ │ ├── redis.ts
│ │ │ └── storage.ts
│ │ │
│ │ ├── db/
│ │ │ └── migrations/
│ │ │ ├── 001_create_core_tables.sql
│ │ │ ├── 002_create_refresh_token.sql
│ │ │ ├── 003_create_enrollment.sql
│ │ │ ├── 004_create_lecture_progress.sql
│ │ │ ├── 005_create_lecture_bookmarks.sql
│ │ │ ├── 006_create_lecture_notes.sql
│ │ │ ├── 007_create_assignments.sql
│ │ │ ├── 008_create_assignment_submission.sql
│ │ │ ├── 009_add_assignment_grading.sql
│ │ │ ├── 010_create_quizzes.sql
│ │ │ ├── 011_create_gamification.sql
│ │ │ ├── 012_create_module_mastery_scores.sql
│ │ │ └── 013_create_ai_tutor.sql
│ │ │
│ │ ├── jobs/
│ │ │ ├── recommendation.queue.ts
│ │ │ ├── recommendation.worker.ts
│ │ │ └── test-recommendation-job.ts
│ │ │
│ │ ├── middleware/
│ │ │ ├── assignment.upload.middleware.ts
│ │ │ ├── auth.middleware.ts
│ │ │ ├── role.middleware.ts
│ │ │ └── upload.middleware.ts
│ │ │
│ │ ├── modules/
│ │ │ ├── ai/
│ │ │ │ ├── ai.controller.ts
│ │ │ │ ├── ai.routes.ts
│ │ │ │ └── ai.service.ts
│ │ │ │
│ │ │ ├── auth/
│ │ │ │ ├── auth.controller.ts
│ │ │ │ ├── auth.routes.ts
│ │ │ │ └── auth.service.ts
│ │ │ │
│ │ │ ├── courses/
│ │ │ │ ├── assignment.controller.ts
│ │ │ │ ├── assignment.routes.ts
│ │ │ │ ├── assignment.service.ts
│ │ │ │ ├── bookmarks.routes.ts
│ │ │ │ ├── bookmarks.service.ts
│ │ │ │ ├── course.controller.ts
│ │ │ │ ├── course.routes.ts
│ │ │ │ ├── course.service.ts
│ │ │ │ ├── courses.storage.ts
│ │ │ │ ├── enrollment.routes.ts
│ │ │ │ ├── enrollment.service.ts
│ │ │ │ ├── notes.routes.ts
│ │ │ │ ├── notes.service.ts
│ │ │ │ ├── progress.routes.ts
│ │ │ │ ├── progress.service.ts
│ │ │ │ ├── quizzes.controller.ts
│ │ │ │ ├── quizzes.routes.ts
│ │ │ │ ├── quizzes.service.ts
│ │ │ │ ├── recommendations.service.ts
│ │ │ │ └── recommendation.service.ts.back
│ │ │ │
│ │ │ └── gamification/
│ │ │ ├── badges.service.ts
│ │ │ ├── certificate.service.ts
│ │ │ ├── gamification.controller.ts
│ │ │ ├── gamification.routes.ts
│ │ │ └── streaks.service.ts
│ │ │
│ │ └── server.ts
│ │
│ ├── package.json
│ ├── package-lock.json
│ └── tsconfig.json
│
├── docs/
│ └── ai-tutor.md
│
├── infra/
│ └── docker-compose.yml
│
└── .env
