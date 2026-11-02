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

interface Certificate {
  id: string;
  course_id: string;
  certificate_url: string;
  issued_at: string;
}

export default function MyCoursesPage() {
  const [courses, setCourses] = useState<Enrollment[]>([]);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [downloadingId, setDownloadingId] = useState("");
  const [downloadError, setDownloadError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadData() {
      try {
        const [coursesResult, gamificationResult] = await Promise.allSettled([
          api.get("/courses/enrollments/me"),
          api.get("/gamification"),
        ]);

        if (coursesResult.status === "rejected") {
          throw coursesResult.reason;
        }

        const enrollments = coursesResult.value.data?.enrollments;

        if (!Array.isArray(enrollments)) {
          throw new Error("Unexpected enrollment response.");
        }

        if (active) {
          setCourses(enrollments);
        }

        if (gamificationResult.status === "fulfilled") {
          const certificateData = gamificationResult.value.data?.certificates;

          if (active && Array.isArray(certificateData)) {
            setCertificates(certificateData);
          }
        } else {
          console.error(
            "Failed to load certificates:",
            gamificationResult.reason,
          );
        }
      } catch (err) {
        console.error("Failed to load My Courses:", err);

        if (active) {
          setError("Could not load your courses. Please try again.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadData();

    return () => {
      active = false;
    };
  }, []);

  async function handleDownloadCertificate(certificateId: string) {
    setDownloadingId(certificateId);
    setDownloadError("");

    try {
      const response = await api.get(
        `/gamification/certificates/${certificateId}/download`,
        {
          responseType: "blob",
        },
      );

      const blob = new Blob([response.data], {
        type: "application/pdf",
      });

      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = downloadUrl;
      link.download = `certificate-${certificateId}.pdf`;

      document.body.appendChild(link);
      link.click();
      link.remove();

      URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error("Certificate download failed:", err);
      setDownloadError("Certificate download failed. Please try again.");
    } finally {
      setDownloadingId("");
    }
  }

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

        {downloadError && (
          <p role="alert" className="mb-4 text-sm text-destructive">
            {downloadError}
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
            {courses.map((course) => {
              const certificate = certificates.find(
                (item) => item.course_id === course.course_id,
              );

              const progress = Math.min(
                100,
                Math.max(0, Number(course.progress_percentage) || 0),
              );

              return (
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

                  <p className="mt-2 text-sm text-muted-foreground">
                    {course.description || "No course description available."}
                  </p>

                  <p className="mt-3 text-sm">Progress: {progress}%</p>

                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-primary"
                      style={{ width: `${progress}%` }}
                    />
                  </div>

                  {certificate ? (
                    <div className="mt-4 space-y-2">
                      <p className="text-sm font-medium text-green-600">
                        Course Completed
                      </p>

                      <p className="text-xs text-muted-foreground">
                        Certificate issued:{" "}
                        {new Date(certificate.issued_at).toLocaleDateString(
                          "en-IN",
                        )}
                      </p>

                      <button
                        type="button"
                        onClick={() =>
                          void handleDownloadCertificate(certificate.id)
                        }
                        disabled={downloadingId !== ""}
                        className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
                      >
                        {downloadingId === certificate.id
                          ? "Downloading..."
                          : "Download Certificate"}
                      </button>
                    </div>
                  ) : (
                    <div className="mt-4 space-y-2">
                      <Link
                        to={`/courses/${course.course_id}/learn`}
                        className="inline-flex rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:opacity-90"
                      >
                        Continue Learning
                      </Link>

                      <p className="text-xs text-muted-foreground">
                        Complete all course lectures to earn your certificate.
                      </p>
                    </div>
                  )}

                  <p className="mt-4 text-xs text-muted-foreground">
                    Enrolled:{" "}
                    {new Date(course.enrolled_at).toLocaleDateString("en-IN")}
                  </p>
                </article>
              );
            })}
          </div>
        )}

        <Link to="/courses" className="mt-8 inline-block underline">
          Browse more courses
        </Link>
      </div>
    </main>
  );
}
