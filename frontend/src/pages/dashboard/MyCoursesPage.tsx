import { useEffect, useState } from "react";
import { Link } from "react-router";
import api from "@/services/api";

interface Enrollment {
  enrollment_id: string;
  course_id: string;
  enrolled_at: string;
  progress_percentage: number | string;
  completed_at: string | null;
  title: string;
  description: string | null;
  category: string | null;
  difficulty: string | null;
  thumbnail_url: string | null;
  price: number | string;
}

export default function MyCoursesPage() {
  const [courses, setCourses] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadEnrollments() {
      try {
        const response = await api.get("/courses/enrollments/me");
        const enrollments = response.data?.enrollments;

        if (!Array.isArray(enrollments)) {
          throw new Error("Unexpected enrollment response.");
        }

        if (active) setCourses(enrollments);
      } catch (err) {
        console.error("Failed to load enrolled courses:", err);
        if (active) {
          setError("Could not load your courses. Please log in and try again.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadEnrollments();

    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="min-h-screen bg-background px-6 py-10 text-foreground">
      <div className="mx-auto max-w-6xl">
        <h1 className="text-3xl font-bold">My Courses</h1>
        <p className="mb-8 mt-2 text-muted-foreground">
          Continue learning from the courses you enrolled in.
        </p>

        {loading && <p role="status">Loading your courses...</p>}

        {error && (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        )}

        {!loading && !error && courses.length === 0 && (
          <div className="rounded-xl border p-8 text-center">
            <p>You haven't enrolled in any courses yet.</p>
            <Link to="/courses" className="mt-4 inline-block underline">
              Browse courses
            </Link>
          </div>
        )}

        {!loading && !error && courses.length > 0 && (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((course) => (
              <article
                key={course.enrollment_id}
                className="rounded-xl border bg-card p-5"
              >
                {course.thumbnail_url && (
                  <img
                    src={course.thumbnail_url}
                    alt=""
                    className="mb-4 h-40 w-full rounded-lg object-cover"
                  />
                )}

                <h2 className="text-xl font-semibold">{course.title}</h2>

                <Link
                  to={`/courses/${course.course_id}/learn`}
                  className="mt-4 inline-flex rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:opacity-90"
                >
                  Continue Learning
                </Link>

                <p className="mt-2 text-sm text-muted-foreground">
                  {course.description || "No course description available."}
                </p>

                <p className="mt-3 text-sm">
                  Progress: {Number(course.progress_percentage) || 0}%
                </p>

                <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-primary"
                    style={{
                      width: `${Math.min(100, Math.max(0, Number(course.progress_percentage) || 0))}%`,
                    }}
                  />
                </div>

                <p className="mt-3 text-xs text-muted-foreground">
                  Enrolled:{" "}
                  {new Date(course.enrolled_at).toLocaleDateString("en-IN")}
                </p>
              </article>
            ))}
          </div>
        )}

        <Link to="/courses" className="mt-8 inline-block underline">
          Browse more courses
        </Link>
      </div>
    </main>
  );
}
