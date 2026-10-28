import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { useSelector } from "react-redux";
import axios from "axios";
import api from "@/services/api";
import type { RootState } from "@/store";

interface PendingCourse {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  difficulty: string | null;
  price: number | string;
  instructor_id: string;
  created_at?: string;
}

export default function AdminCoursesPage() {
  const user = useSelector((state: RootState) => state.auth.user);
  const isAdmin = user?.roles?.includes("admin") ?? false;

  const [courses, setCourses] = useState<PendingCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewingId, setReviewingId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadPendingCourses = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await api.get("/admin/courses/pending");
      const data = response.data?.data;

      if (!Array.isArray(data)) {
        throw new Error("Unexpected pending courses response.");
      }

      setCourses(data);
    } catch (err) {
      console.error("Failed to load pending courses:", err);
      setError(
        axios.isAxiosError(err)
          ? err.response?.data?.message || "Could not load pending courses."
          : "Could not load pending courses.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) {
      void loadPendingCourses();
    } else {
      setLoading(false);
    }
  }, [isAdmin, loadPendingCourses]);

  async function reviewCourse(
    courseId: string,
    decision: "approved" | "rejected",
  ) {
    if (!isAdmin || reviewingId) return;

    setReviewingId(courseId);
    setError("");
    setMessage("");

    try {
      const response = await api.post(`/courses/${courseId}/approve`, {
        decision,
      });

      if (!response.data?.course) {
        throw new Error("Unexpected course review response.");
      }

      setCourses((current) =>
        current.filter((course) => course.id !== courseId),
      );

      setMessage(
        decision === "approved"
          ? "Course approved successfully."
          : "Course rejected successfully.",
      );
    } catch (err) {
      console.error("Course review failed:", err);
      setError(
        axios.isAxiosError(err)
          ? err.response?.data?.message || "Course review failed."
          : "Course review failed.",
      );
    } finally {
      setReviewingId("");
    }
  }

  if (!isAdmin) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-12">
        <h1 className="text-2xl font-bold">Admin access required</h1>
        <p className="mt-2 text-muted-foreground">
          Sign in with an admin account to review courses.
        </p>
        <Link to="/dashboard" className="mt-4 inline-block underline">
          Back to Dashboard
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background px-6 py-10 text-foreground">
      <div className="mx-auto max-w-5xl">
        <Link
          to="/dashboard"
          className="mb-6 inline-block text-sm text-muted-foreground hover:underline"
        >
          Back to Dashboard
        </Link>

        <h1 className="text-3xl font-bold">Course Approval</h1>
        <p className="mt-2 text-muted-foreground">
          Review courses submitted by instructors.
        </p>

        {message && (
          <p role="status" className="mt-5 text-sm text-green-600">
            {message}
          </p>
        )}

        {error && (
          <div className="mt-5" role="alert">
            <p className="text-sm text-destructive">{error}</p>
            <button
              type="button"
              onClick={() => void loadPendingCourses()}
              className="mt-2 text-sm underline"
            >
              Retry
            </button>
          </div>
        )}

        {loading && (
          <p role="status" className="mt-6">
            Loading pending courses...
          </p>
        )}

        {!loading && !error && courses.length === 0 && (
          <p className="mt-6 rounded-xl border p-6 text-muted-foreground">
            There are no pending courses to review.
          </p>
        )}

        <div className="mt-6 space-y-4">
          {courses.map((course) => (
            <article key={course.id} className="rounded-xl border bg-card p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1 space-y-2">
                  <h2 className="text-xl font-semibold">{course.title}</h2>

                  <p className="text-sm text-muted-foreground">
                    {course.description || "No description provided."}
                  </p>

                  <p className="text-sm">
                    Category: {course.category || "Not specified"}
                  </p>

                  <p className="text-sm">
                    Difficulty: {course.difficulty || "Not specified"}
                  </p>

                  <p className="text-sm">
                    Price:{" "}
                    {Number(course.price) === 0
                      ? "Free"
                      : `₹${Number(course.price).toLocaleString("en-IN")}`}
                  </p>

                  <p className="break-all text-xs text-muted-foreground">
                    Instructor ID: {course.instructor_id}
                  </p>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={Boolean(reviewingId)}
                    onClick={() => void reviewCourse(course.id, "approved")}
                    className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
                  >
                    {reviewingId === course.id ? "Saving..." : "Approve"}
                  </button>

                  <button
                    type="button"
                    disabled={Boolean(reviewingId)}
                    onClick={() => void reviewCourse(course.id, "rejected")}
                    className="rounded-lg border px-4 py-2 text-sm disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}
