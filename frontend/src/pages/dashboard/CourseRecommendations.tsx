import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import api from "@/services/api";

interface RecommendedCourse {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  difficulty: string | null;
  thumbnail_url: string | null;
  price: number | string;
  related_quiz_average: number | string | null;
  performance_priority: number | string;
}

export default function CourseRecommendations() {
  const [courses, setCourses] = useState<RecommendedCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [enrollingId, setEnrollingId] = useState("");
  const [message, setMessage] = useState("");

  const loadRecommendations = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await api.get("/courses/recommendations");
      const data = response.data?.data;

      if (!Array.isArray(data)) {
        throw new Error("Invalid recommendation response");
      }

      setCourses(data);
    } catch (err) {
      console.error("Failed to load recommendations:", err);
      setError("Recommendations could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRecommendations();
  }, [loadRecommendations]);

  async function handleEnroll(courseId: string) {
    setEnrollingId(courseId);
    setMessage("");

    try {
      const response = await api.post(`/courses/${courseId}/enroll`);
      setMessage(response.data?.message || "Enrollment successful.");

      setCourses((previous) =>
        previous.filter((course) => course.id !== courseId),
      );
    } catch (err) {
      console.error("Recommendation enrollment failed:", err);
      setMessage("Enrollment failed. Please try again.");
    } finally {
      setEnrollingId("");
    }
  }

  return (
    <section className="mt-8 rounded-xl border bg-card p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Recommended for You</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Courses selected using your quiz performance and learning profile.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadRecommendations()}
          disabled={loading}
          className="rounded-md border px-3 py-2 text-sm hover:bg-muted disabled:opacity-50"
        >
          Refresh
        </button>
      </div>

      {loading && (
        <p role="status" className="text-sm text-muted-foreground">
          Finding courses for you...
        </p>
      )}

      {error && (
        <div role="alert">
          <p className="text-sm text-destructive">{error}</p>
          <button
            type="button"
            onClick={() => void loadRecommendations()}
            className="mt-2 text-sm underline"
          >
            Try again
          </button>
        </div>
      )}

      {!loading && !error && courses.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No recommendations available right now. Complete some quizzes and
          explore more courses to improve your recommendations.
        </p>
      )}

      {!loading && !error && courses.length > 0 && (
        <div className="grid gap-5 sm:grid-cols-2">
          {courses.map((course) => (
            <article
              key={course.id}
              className="overflow-hidden rounded-lg border"
            >
              {course.thumbnail_url && (
                <img
                  src={course.thumbnail_url}
                  alt=""
                  loading="lazy"
                  className="h-40 w-full object-cover"
                />
              )}

              <div className="space-y-3 p-4">
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  {course.category && <span>{course.category}</span>}
                  {course.difficulty && <span>{course.difficulty}</span>}
                </div>

                <h3 className="font-semibold">{course.title}</h3>

                <p className="line-clamp-2 text-sm text-muted-foreground">
                  {course.description || "No description available."}
                </p>

                {course.related_quiz_average !== null && (
                  <p className="text-sm">
                    Related quiz average:{" "}
                    <strong>
                      {Number(course.related_quiz_average).toFixed(1)}%
                    </strong>
                  </p>
                )}

                <p className="font-medium">
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
                  className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
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

      {message && (
        <p role="status" className="mt-4 text-sm">
          {message}{" "}
          {message.toLowerCase().includes("successful") && (
            <Link to="/my-courses" className="underline">
              View My Courses
            </Link>
          )}
        </p>
      )}
    </section>
  );
}
