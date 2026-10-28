import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link, useNavigate } from "react-router";

import api from "@/services/api";
import { clearTokens, getAccessToken } from "@/services/tokenStorage";
import { clearAuth, setUser } from "@/store/authSlice";
import type { AppDispatch, RootState } from "@/store";

type InstructorCourse = {
  id: string;
  title: string;
  status: "pending" | "approved" | "rejected" | string;
  created_at?: string;
};

export default function DashboardPage() {
  const user = useSelector((state: RootState) => state.auth.user);
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();

  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState("");

  const [instructorCourses, setInstructorCourses] = useState<
    InstructorCourse[]
  >([]);
  const [coursesLoading, setCoursesLoading] = useState(false);
  const [coursesError, setCoursesError] = useState("");

  const isInstructor = user?.roles?.includes("instructor") ?? false;
  const isAdmin = user?.roles?.includes("admin") ?? false;
  const isStudent = user?.roles?.includes("student") ?? false;

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      if (!getAccessToken()) {
        return;
      }

      try {
        const response = await api.get("/auth/me");

        if (!cancelled && response.data?.success && response.data?.data) {
          dispatch(setUser(response.data.data));
        }
      } catch (error) {
        console.error("Failed to restore user profile:", error);
      }
    }

    void loadProfile();

    return () => {
      cancelled = true;
    };
  }, [dispatch]);

  useEffect(() => {
    if (!isInstructor || !getAccessToken()) {
      setInstructorCourses([]);
      setCoursesLoading(false);
      setCoursesError("");
      return;
    }

    let cancelled = false;

    async function loadInstructorCourses() {
      setCoursesLoading(true);
      setCoursesError("");

      try {
        const response = await api.get("/courses/instructor/me");

        if (!cancelled && response.data?.success) {
          setInstructorCourses(response.data.data ?? []);
        }
      } catch (error) {
        console.error("Failed to load instructor courses:", error);

        if (!cancelled) {
          setCoursesError(
            "Failed to load your courses. Please refresh the page.",
          );
        }
      } finally {
        if (!cancelled) {
          setCoursesLoading(false);
        }
      }
    }

    void loadInstructorCourses();

    return () => {
      cancelled = true;
    };
  }, [isInstructor]);

  async function handleLogout() {
    if (loggingOut) {
      return;
    }

    setLoggingOut(true);
    setError("");

    try {
      await api.post("/auth/logout");
    } catch (error) {
      console.error("Logout API request failed:", error);
      setError(
        "The logout request failed. Your local session will still be cleared.",
      );
    } finally {
      clearTokens();
      dispatch(clearAuth());
      navigate("/login", { replace: true });
      setLoggingOut(false);
    }
  }

  return (
    <main className="min-h-screen bg-background px-6 py-10 text-foreground">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-3xl font-bold">Dashboard</h1>

          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="rounded-md border px-4 py-2 text-sm disabled:opacity-50"
          >
            {loggingOut ? "Signing out..." : "Logout"}
          </button>
        </div>

        {error && (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {error}
          </p>
        )}

        <p className="mt-4 text-muted-foreground">
          Welcome back, {user?.full_name ?? "User"}!
        </p>

        <section className="mt-8 rounded-xl border bg-card p-6">
          <h2 className="text-xl font-semibold">Your Account</h2>

          <p className="mt-3 text-sm">
            <span className="font-medium">Name:</span>{" "}
            {user?.full_name ?? "Not available"}
          </p>

          <p className="mt-2 text-sm">
            <span className="font-medium">Email:</span>{" "}
            {user?.email ?? "Not available"}
          </p>

          <p className="mt-2 text-sm">
            <span className="font-medium">Role:</span>{" "}
            {user?.roles?.join(", ") || "Not available"}
          </p>
        </section>

        <section className="mt-6 flex flex-wrap gap-3">
          {isAdmin && (
            <Link
              to="/admin/courses"
              className="inline-flex items-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              Review Pending Courses
            </Link>
          )}

          {isInstructor && (
            <>
              <Link
                to="/instructor/courses/new"
                className="inline-flex rounded-md bg-primary px-4 py-2 text-primary-foreground"
              >
                Create Course
              </Link>

              <Link
                to="/instructor/courses"
                className="inline-flex items-center rounded-md border px-4 py-2 text-sm hover:bg-muted"
              >
                My Courses &amp; Approval Status
              </Link>
            </>
          )}

          <Link
            to="/courses"
            className="inline-flex items-center rounded-md border px-4 py-2 hover:bg-muted"
          >
            Browse Courses
          </Link>

          {isStudent && (
            <Link
              to="/my-courses"
              className="inline-flex items-center rounded-md border px-4 py-2 hover:bg-muted"
            >
              My Courses
            </Link>
          )}
        </section>

        {isInstructor && (
          <section className="mt-8 rounded-xl border bg-card p-6">
            <h2 className="text-xl font-semibold">My Courses</h2>

            {coursesLoading && (
              <p className="mt-3 text-sm text-muted-foreground">
                Loading your courses...
              </p>
            )}

            {coursesError && (
              <p role="alert" className="mt-3 text-sm text-destructive">
                {coursesError}
              </p>
            )}

            {!coursesLoading &&
              !coursesError &&
              instructorCourses.length === 0 && (
                <p className="mt-3 text-sm text-muted-foreground">
                  You haven't created any courses yet.
                </p>
              )}

            {!coursesLoading && instructorCourses.length > 0 && (
              <div className="mt-4 space-y-4">
                {instructorCourses.map((course) => (
                  <div key={course.id} className="rounded-lg border p-4">
                    <h3 className="font-medium">{course.title}</h3>

                    <p className="mt-2 text-sm">
                      Status:{" "}
                      <span className="font-semibold capitalize">
                        {course.status}
                      </span>
                    </p>

                    {course.status === "pending" && (
                      <p className="mt-2 text-sm text-muted-foreground">
                        Your course is awaiting admin approval. You can manage
                        its content after approval.
                      </p>
                    )}

                    {course.status === "rejected" && (
                      <p className="mt-2 text-sm text-destructive">
                        Your course was rejected. Please contact the admin for
                        further instructions.
                      </p>
                    )}

                    {course.status === "approved" && (
                      <Link
                        to={`/instructor/courses/${course.id}/content`}
                        className="mt-3 inline-flex rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
                      >
                        Manage Content
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
