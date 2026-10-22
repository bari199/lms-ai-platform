import { pool } from "../../config/db.js";

interface CourseFilters {
  category?: string;
  difficulty?: string;
  q?: string;
  page?: string;
}

export const getPublishedCourses = async (filters: CourseFilters) => {
  const page = Math.max(1, Number.parseInt(filters.page || "1", 10) || 1);
  const limit = 10;
  const offset = (page - 1) * limit;

  const conditions: string[] = ["status = $1"];
  const values: unknown[] = ["approved"];

  if (filters.category?.trim()) {
    values.push(filters.category.trim());
    conditions.push(`category = $${values.length}`);
  }

  if (filters.difficulty?.trim()) {
    values.push(filters.difficulty.trim());
    conditions.push(`difficulty = $${values.length}`);
  }

  if (filters.q?.trim()) {
    values.push(`%${filters.q.trim()}%`);
    conditions.push(
      `(title ILIKE $${values.length} OR description ILIKE $${values.length})`,
    );
  }

  const whereClause = conditions.join(" AND ");

  const countResult = await pool.query(
    `SELECT COUNT(*)::int AS total
     FROM courses
     WHERE ${whereClause}`,
    values,
  );

  const listValues = [...values, limit, offset];

  const coursesResult = await pool.query(
    `SELECT id, title, description, category, difficulty,
            thumbnail_url, price, instructor_id, created_at
     FROM courses
     WHERE ${whereClause}
     ORDER BY created_at DESC
     LIMIT $${values.length + 1}
     OFFSET $${values.length + 2}`,
    listValues,
  );

  return {
    courses: coursesResult.rows,
    pagination: {
      page,
      limit,
      total: countResult.rows[0].total,
      totalPages: Math.ceil(countResult.rows[0].total / limit),
    },
  };
};

interface CreateCourseInput {
  title: string;
  description?: string;
  category?: string;
  difficulty?: string;
  thumbnail_url?: string;
  price?: number;
}

export const createCourse = async (
  instructorId: string,
  input: CreateCourseInput,
) => {
  const title = input.title?.trim();

  if (!title) {
    throw new Error("Course title is required");
  }

  const price = input.price ?? 0;

  if (!Number.isFinite(price) || price < 0) {
    throw new Error("Course price must be a non-negative number");
  }

  const result = await pool.query(
    `INSERT INTO courses
      (instructor_id, title, description, category, difficulty,
       thumbnail_url, price, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
     RETURNING id, instructor_id, title, description, category,
               difficulty, thumbnail_url, price, status, created_at`,
    [
      instructorId,
      title,
      input.description ?? null,
      input.category ?? null,
      input.difficulty ?? null,
      input.thumbnail_url ?? null,
      price,
    ],
  );

  return result.rows[0];
};

export const getCourseById = async (courseId: string) => {
  const courseResult = await pool.query(
    `SELECT id, instructor_id, title, description, category,
            difficulty, thumbnail_url, price, status, created_at
     FROM courses
     WHERE id = $1 AND status = 'approved'`,
    [courseId],
  );

  if (courseResult.rowCount !== 1) {
    return null;
  }

  const course = courseResult.rows[0];

  const modulesResult = await pool.query(
    `SELECT id, course_id, title, order_index
     FROM modules
     WHERE course_id = $1
     ORDER BY order_index ASC`,
    [courseId],
  );

  const moduleIds = modulesResult.rows.map((module) => module.id);

  let lectures: Array<{
    id: string;
    module_id: string;
    title: string;
    video_url: string | null;
    duration_seconds: number | null;
    order_index: number;
    resource_urls: string[] | null;
  }> = [];

  if (moduleIds.length > 0) {
    const lecturesResult = await pool.query(
      `SELECT id, module_id, title, video_url,
              duration_seconds, order_index, resource_urls
       FROM lectures
       WHERE module_id = ANY($1::uuid[])
       ORDER BY order_index ASC`,
      [moduleIds],
    );

    lectures = lecturesResult.rows;
  }

  const modules = modulesResult.rows.map((module) => ({
    ...module,
    lectures: lectures.filter((lecture) => lecture.module_id === module.id),
  }));

  return {
    ...course,
    modules,
  };
};

interface UpdateCourseInput {
  title?: string;
  description?: string;
  category?: string;
  difficulty?: string;
  thumbnail_url?: string;
  price?: number;
}

export const updateCourse = async (
  courseId: string,
  instructorId: string,
  input: UpdateCourseInput,
) => {
  const allowedFields = [
    "title",
    "description",
    "category",
    "difficulty",
    "thumbnail_url",
    "price",
  ] as const;

  const updates: string[] = [];
  const values: unknown[] = [];

  for (const field of allowedFields) {
    if (input[field] !== undefined) {
      const value = input[field];

      if (field === "title" && (typeof value !== "string" || !value.trim())) {
        throw new Error("Course title cannot be empty");
      }

      if (
        field === "price" &&
        (typeof value !== "number" || !Number.isFinite(value) || value < 0)
      ) {
        throw new Error("Course price must be a non-negative number");
      }

      values.push(
        field === "title" && typeof value === "string" ? value.trim() : value,
      );

      updates.push(`${field} = $${values.length}`);
    }
  }

  if (updates.length === 0) {
    throw new Error("At least one field is required to update");
  }

  values.push(courseId, instructorId);

  const result = await pool.query(
    `UPDATE courses
     SET ${updates.join(", ")}
     WHERE id = $${values.length - 1}
       AND instructor_id = $${values.length}
     RETURNING id, instructor_id, title, description, category,
               difficulty, thumbnail_url, price, status, created_at`,
    values,
  );

  return result.rows[0] ?? null;
};

interface CreateModuleInput {
  title: string;
  order_index: number;
}

export const createCourseModule = async (
  courseId: string,
  instructorId: string,
  input: CreateModuleInput,
) => {
  const title = input.title?.trim();
  const orderIndex = input.order_index;

  if (!title) {
    throw new Error("Module title is required");
  }

  if (!Number.isInteger(orderIndex) || orderIndex < 1) {
    throw new Error("Module order_index must be a positive integer");
  }

  const result = await pool.query(
    `INSERT INTO modules (course_id, title, order_index)
     SELECT id, $3, $4
     FROM courses
     WHERE id = $1 AND instructor_id = $2
     RETURNING id, course_id, title, order_index`,
    [courseId, instructorId, title, orderIndex],
  );

  return result.rows[0] ?? null;
};

interface CreateLectureInput {
  title: string;
  video_url?: string;
  transcript?: string;
  duration_seconds?: number;
  order_index: number;
  resource_urls?: string[];
}

export const createModuleLecture = async (
  moduleId: string,
  instructorId: string,
  input: CreateLectureInput,
) => {
  const title = input.title?.trim();

  if (!title) {
    throw new Error("Lecture title is required");
  }

  if (!Number.isInteger(input.order_index) || input.order_index < 1) {
    throw new Error("Lecture order_index must be a positive integer");
  }

  if (
    input.duration_seconds !== undefined &&
    (!Number.isInteger(input.duration_seconds) || input.duration_seconds < 0)
  ) {
    throw new Error("Duration must be a non-negative integer");
  }

  if (
    input.resource_urls !== undefined &&
    (!Array.isArray(input.resource_urls) ||
      !input.resource_urls.every((url) => typeof url === "string"))
  ) {
    throw new Error("resource_urls must be an array of strings");
  }

  const result = await pool.query(
    `INSERT INTO lectures
      (module_id, title, video_url, transcript, duration_seconds,
       order_index, resource_urls)
     SELECT m.id, $3, $4, $5, $6, $7, $8
     FROM modules m
     JOIN courses c ON c.id = m.course_id
     WHERE m.id = $1 AND c.instructor_id = $2
     RETURNING id, module_id, title, video_url, transcript,
               duration_seconds, order_index, resource_urls`,
    [
      moduleId,
      instructorId,
      title,
      input.video_url ?? null,
      input.transcript ?? null,
      input.duration_seconds ?? null,
      input.order_index,
      input.resource_urls ?? null,
    ],
  );

  return result.rows[0] ?? null;
};

export async function reviewCourse(
  courseId: string,
  decision: "approved" | "rejected",
) {
  const result = await pool.query(
    `UPDATE courses
     SET status = $2
     WHERE id = $1 AND status = 'pending'
     RETURNING id, title, status, instructor_id`,
    [courseId, decision],
  );

  return result.rows[0] ?? null;
}
