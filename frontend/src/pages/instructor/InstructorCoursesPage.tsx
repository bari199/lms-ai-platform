import { useEffect, useState } from "react";
import { Link } from "react-router";
import api from "@/services/api";

type InstructorCourse = {
  id: string;
  title: string;
  status: "pending" | "approved" | "rejected" | string;
};

export default function InstructorCoursesPage() {
  const [courses, setCourses] = useState<InstructorCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadCourses() {
      try {
        const response = await api.get("/courses/instructor/me");

        if (!cancelled && response.data?.success) {
          setCourses(response.data.data ?? []);
        }
      } catch (err) {
        console.error("Failed to load instructor courses:", err);

        if (!cancelled) {
          setError("Unable to load your courses. Please try again.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadCourses();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="min-h-screen bg-background px-6 py-10 text-foreground">
      <div className="mx-auto max-w-4xl">
        <Link to="/dashboard" className="text-sm underline">
          Back to Dashboard
        </Link>

        <h1 className="mt-5 text-3xl font-bold">My Courses</h1>

        {loading && <p className="mt-4">Loading courses...</p>}

        {error && (
          <p role="alert" className="mt-4 text-destructive">
            {error}
          </p>
        )}

        {!loading && !error && courses.length === 0 && (
          <p className="mt-4 text-muted-foreground">
            You haven't created any courses yet.
          </p>
        )}

        <div className="mt-6 space-y-4">
          {courses.map((course) => (
            <section key={course.id} className="rounded-xl border p-5">
              <h2 className="text-lg font-semibold">{course.title}</h2>

              <p className="mt-2">
                Status: <strong className="capitalize">{course.status}</strong>
              </p>

              {course.status === "pending" && (
                <p className="mt-2 text-muted-foreground">
                  Your course is waiting for admin approval. Content management
                  will be available after approval.
                </p>
              )}

              {course.status === "approved" && (
                <Link
                  to={`/instructor/courses/${course.id}/content`}
                  className="mt-4 inline-flex rounded-md bg-primary px-4 py-2 text-primary-foreground"
                >
                  Manage Content
                </Link>
              )}

              {course.status === "rejected" && (
                <p className="mt-2 text-destructive">
                  Your course was rejected. Please contact the admin.
                </p>
              )}
            </section>
          ))}
        </div>

        <Link
          to="/instructor/courses/new"
          className="mt-6 inline-flex rounded-md border px-4 py-2"
        >
          Create Another Course
        </Link>
      </div>
    </main>
  );
}
