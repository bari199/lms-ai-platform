import { useEffect, useState } from "react";
import { Link } from "react-router";
import { useSelector } from "react-redux";
import type { RootState } from "@/store";
import api from "@/services/api";

interface Course {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  difficulty: string | null;
  thumbnail_url: string | null;
  price: number | string;
}

interface CourseCatalogResponse {
  courses: Course[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export default function CourseCatalogPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [page, setPage] = useState(1);

  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retryCount, setRetryCount] = useState(0);

  const user = useSelector((state: RootState) => state.auth.user);
  const [enrollingId, setEnrollingId] = useState("");
  const [enrollMessage, setEnrollMessage] = useState("");
  const [enrollSuccess, setEnrollSuccess] = useState(false);

  useEffect(() => {
    let active = true;

    async function fetchCourses() {
      setLoading(true);
      setError("");

      try {
        const response = await api.get("/courses", {
          params: {
            q: search.trim() || undefined,
            category: category.trim() || undefined,
            difficulty: difficulty || undefined,
            page,
          },
        });

        const result: CourseCatalogResponse | undefined = response.data?.data;

        if (!Array.isArray(result?.courses) || !result.pagination) {
          throw new Error("Unexpected courses API response.");
        }

        if (active) {
          setCourses(result.courses);
          setPagination(result.pagination);
        }
      } catch (err) {
        console.error("Failed to fetch courses:", err);

        if (active) {
          setError("Courses could not be loaded. Please try again.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void fetchCourses();

    return () => {
      active = false;
    };
  }, [search, category, difficulty, page, retryCount]);

  async function handleEnroll(courseId: string) {
    if (!user) {
      window.location.href = "/login";
      return;
    }

    if (!user.roles?.includes("student")) {
      setEnrollSuccess(false);
      setEnrollMessage("Only student accounts can enroll in courses.");
      return;
    }

    setEnrollingId(courseId);
    setEnrollMessage("");
    setEnrollSuccess(false);

    try {
      const response = await api.post(`/courses/${courseId}/enroll`);

      setEnrollSuccess(true);
      setEnrollMessage(response.data?.message || "Enrollment successful.");
    } catch (error) {
      console.error("Course enrollment failed:", error);

      setEnrollSuccess(false);
      setEnrollMessage(
        "Enrollment failed. Please check your login and try again.",
      );
    } finally {
      setEnrollingId("");
    }
  }

  function resetFilters() {
    setSearch("");
    setCategory("");
    setDifficulty("");
    setPage(1);
    setEnrollMessage("");
  }

  return (
    <main className="min-h-screen bg-background px-6 py-10 text-foreground">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8">
          <p className="mb-2 text-sm font-medium text-muted-foreground">
            LEARN SOMETHING NEW
          </p>

          <h1 className="text-3xl font-bold">Course Catalog</h1>

          <p className="mt-2 text-muted-foreground">
            Explore courses and find your next learning goal.
          </p>
        </header>

        <section
          aria-label="Course filters"
          className="mb-8 grid gap-4 rounded-xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          <input
            type="search"
            aria-label="Search courses"
            placeholder="Search courses..."
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            className="w-full rounded-lg border bg-background px-3 py-2"
          />

          <input
            type="text"
            aria-label="Filter by category"
            placeholder="Category (e.g. Programming)"
            value={category}
            onChange={(event) => {
              setCategory(event.target.value);
              setPage(1);
            }}
            className="w-full rounded-lg border bg-background px-3 py-2"
          />

          <select
            aria-label="Filter by difficulty"
            value={difficulty}
            onChange={(event) => {
              setDifficulty(event.target.value);
              setPage(1);
            }}
            className="w-full rounded-lg border bg-background px-3 py-2"
          >
            <option value="">All difficulty levels</option>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>

          <button
            type="button"
            onClick={resetFilters}
            className="rounded-lg border px-4 py-2 font-medium hover:bg-muted"
          >
            Clear filters
          </button>
        </section>

        <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {pagination.total} course(s) found
          </p>

          {loading && (
            <p role="status" className="text-sm text-muted-foreground">
              Loading courses...
            </p>
          )}
        </div>

        {error && (
          <div className="mb-6" role="alert">
            <p className="text-destructive">{error}</p>

            <button
              type="button"
              onClick={() => setRetryCount((count) => count + 1)}
              className="mt-2 underline"
            >
              Retry
            </button>
          </div>
        )}

        {!error && !loading && courses.length === 0 && (
          <p className="rounded-xl border p-8 text-center text-muted-foreground">
            No published courses match your filters.
          </p>
        )}

        {!error && courses.length > 0 && (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((course) => (
              <article
                key={course.id}
                className="overflow-hidden rounded-xl border bg-card text-card-foreground"
              >
                {course.thumbnail_url && (
                  <img
                    src={course.thumbnail_url}
                    alt=""
                    className="h-44 w-full object-cover"
                    loading="lazy"
                  />
                )}

                <div className="space-y-3 p-5">
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    {course.category && <span>{course.category}</span>}

                    {course.difficulty && <span>{course.difficulty}</span>}
                  </div>

                  <h2 className="text-xl font-semibold">{course.title}</h2>

                  <p className="text-sm text-muted-foreground">
                    {course.description || "No course description available."}
                  </p>

                  <p className="font-semibold">
                    {Number(course.price) === 0
                      ? "Free"
                      : Number.isFinite(Number(course.price))
                        ? `₹${Number(course.price).toLocaleString("en-IN")}`
                        : "Price unavailable"}
                  </p>

                  <button
                    type="button"
                    onClick={() => void handleEnroll(course.id)}
                    disabled={enrollingId !== ""}
                    className="w-full rounded-lg bg-primary px-4 py-2 font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {enrollingId === course.id
                      ? "Enrolling..."
                      : "Enroll in Course"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}

        {enrollMessage && (
          <p
            className={`mt-4 text-sm ${
              enrollSuccess ? "text-green-600" : "text-destructive"
            }`}
            role="status"
          >
            {enrollMessage}{" "}
            {enrollSuccess && (
              <Link to="/my-courses" className="underline">
                View My Courses
              </Link>
            )}
          </p>
        )}

        {!error && pagination.totalPages > 1 && (
          <nav
            aria-label="Course pagination"
            className="mt-8 flex items-center justify-center gap-4"
          >
            <button
              type="button"
              disabled={loading || page <= 1}
              onClick={() => setPage((current) => current - 1)}
              className="rounded-lg border px-4 py-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>

            <span className="text-sm" aria-live="polite">
              Page {pagination.page} of {pagination.totalPages}
            </span>

            <button
              type="button"
              disabled={loading || page >= pagination.totalPages}
              onClick={() => setPage((current) => current + 1)}
              className="rounded-lg border px-4 py-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </nav>
        )}
      </div>
    </main>
  );
}
