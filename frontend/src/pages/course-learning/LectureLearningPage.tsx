import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import api from "@/services/api";

interface Lecture {
  id: string;
  module_id: string;
  title: string;
  video_url: string | null;
  duration_seconds: number | null;
  order_index: number;
  resource_urls: string[] | null;
}

interface CourseModule {
  id: string;
  title: string;
  order_index: number;
  lectures: Lecture[];
}

interface Course {
  id: string;
  title: string;
  description: string | null;
  modules: CourseModule[];
}

interface Progress {
  watched_seconds: number;
  is_completed: boolean;
}

interface Note {
  id: string;
  timestamp_seconds: number;
  content: string;
}

interface Bookmark {
  id: string;
  timestamp_seconds: number;
}

export default function LectureLearningPage() {
  const { id: courseId } = useParams();

  const [course, setCourse] = useState<Course | null>(null);
  const [activeLecture, setActiveLecture] = useState<Lecture | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [noteContent, setNoteContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadLectureData = useCallback(async (lecture: Lecture) => {
    setActiveLecture(lecture);
    setProgress(null);
    setNotes([]);
    setBookmarks([]);
    setError("");
    setMessage("");

    try {
      const [progressResponse, notesResponse, bookmarksResponse] =
        await Promise.all([
          api.get(`/lectures/${lecture.id}/progress`),
          api.get(`/lectures/${lecture.id}/notes`),
          api.get(`/lectures/${lecture.id}/bookmarks`),
        ]);

      setProgress(progressResponse.data?.data ?? null);
      setNotes(
        Array.isArray(notesResponse.data?.data) ? notesResponse.data.data : [],
      );
      setBookmarks(
        Array.isArray(bookmarksResponse.data?.data)
          ? bookmarksResponse.data.data
          : [],
      );
    } catch (err) {
      console.error("Failed to load lecture data:", err);
      setError("Could not load saved progress, notes, or bookmarks.");
    }
  }, []);

  useEffect(() => {
    let active = true;

    async function loadCourse() {
      try {
        const response = await api.get(`/courses/${courseId}`);
        const courseData = response.data?.data ?? response.data?.course;

        if (!courseData || !Array.isArray(courseData.modules)) {
          throw new Error("Unexpected course response.");
        }

        if (!active) return;

        setCourse(courseData);

        const firstLecture = courseData.modules
          .flatMap((module: CourseModule) => module.lectures)
          .find((lecture: Lecture) => Boolean(lecture.video_url));

        if (firstLecture) {
          await loadLectureData(firstLecture);
        } else {
          setMessage("This course does not have a video lecture yet.");
        }
      } catch (err) {
        console.error("Failed to load course:", err);
        if (active) setError("Could not load this course.");
      } finally {
        if (active) setLoading(false);
      }
    }

    if (courseId) void loadCourse();

    return () => {
      active = false;
    };
  }, [courseId, loadLectureData]);

  async function saveProgress(watchedSeconds: number, completed: boolean) {
    if (!activeLecture) return;

    try {
      await api.post(`/lectures/${activeLecture.id}/progress`, {
        watched_seconds: Math.floor(watchedSeconds),
        is_completed: completed,
      });

      setProgress((current) => ({
        watched_seconds: Math.floor(watchedSeconds),
        is_completed: completed || Boolean(current?.is_completed),
      }));
    } catch (err) {
      console.error("Failed to save lecture progress:", err);
      setError("Could not save lecture progress.");
    }
  }

  async function addNote() {
    if (!activeLecture || !noteContent.trim()) return;

    const video = document.querySelector<HTMLVideoElement>(
      "#course-lecture-video",
    );

    const timestamp = Math.floor(video?.currentTime ?? 0);

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await api.post(`/lectures/${activeLecture.id}/notes`, {
        timestamp_seconds: timestamp,
        content: noteContent.trim(),
      });

      const note = response.data?.data;

      if (note)
        setNotes((current) =>
          [...current, note].sort(
            (a, b) => a.timestamp_seconds - b.timestamp_seconds,
          ),
        );

      setNoteContent("");
      setMessage("Note saved.");
    } catch (err) {
      console.error("Failed to save note:", err);
      setError("Could not save your note.");
    } finally {
      setSaving(false);
    }
  }

  async function addBookmark() {
    if (!activeLecture) return;

    const video = document.querySelector<HTMLVideoElement>(
      "#course-lecture-video",
    );

    const timestamp = Math.floor(video?.currentTime ?? 0);

    setError("");
    setMessage("");

    try {
      const response = await api.post(
        `/lectures/${activeLecture.id}/bookmarks`,
        { timestamp_seconds: timestamp },
      );

      const bookmark = response.data?.data;

      if (bookmark) {
        setBookmarks((current) =>
          [...current, bookmark].sort(
            (a, b) => a.timestamp_seconds - b.timestamp_seconds,
          ),
        );
      }

      setMessage("Bookmark saved.");
    } catch (err) {
      console.error("Failed to save bookmark:", err);
      setError("Could not save bookmark.");
    }
  }

  function formatTime(seconds: number) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
  }

  if (loading) {
    return <main className="p-8">Loading course...</main>;
  }

  if (!course) {
    return (
      <main className="p-8">
        <p role="alert">{error || "Course not found."}</p>
        <Link to="/my-courses" className="underline">
          Back to My Courses
        </Link>
      </main>
    );
  }

  const modules = course.modules ?? [];

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground md:px-8">
      <div className="mx-auto max-w-7xl">
        <Link to="/my-courses" className="text-sm underline">
          ← My Courses
        </Link>

        <h1 className="mb-2 mt-4 text-3xl font-bold">{course.title}</h1>

        {course.description && (
          <p className="mb-6 text-muted-foreground">{course.description}</p>
        )}

        {message && (
          <p role="status" className="mb-4">
            {message}
          </p>
        )}
        {error && (
          <p role="alert" className="mb-4 text-destructive">
            {error}
          </p>
        )}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <section className="min-w-0">
            {activeLecture ? (
              <>
                <div className="overflow-hidden rounded-xl bg-black">
                  {activeLecture.video_url ? (
                    <video
                      id="course-lecture-video"
                      key={activeLecture.id}
                      className="aspect-video w-full"
                      controls
                      playsInline
                      preload="metadata"
                      src={activeLecture.video_url}
                      onLoadedMetadata={(event) => {
                        const savedSeconds = progress?.watched_seconds ?? 0;
                        const video = event.currentTarget;

                        if (
                          savedSeconds > 0 &&
                          Number.isFinite(video.duration) &&
                          savedSeconds < video.duration
                        ) {
                          video.currentTime = savedSeconds;
                        }
                      }}
                      onTimeUpdate={(event) => {
                        const video = event.currentTarget;

                        if (
                          Math.floor(video.currentTime) > 0 &&
                          Math.floor(video.currentTime) % 15 === 0
                        ) {
                          void saveProgress(video.currentTime, false);
                        }
                      }}
                      onEnded={(event) => {
                        void saveProgress(event.currentTarget.duration, true);
                      }}
                    />
                  ) : (
                    <p className="p-8 text-white">No video available.</p>
                  )}
                </div>

                <h2 className="mt-4 text-2xl font-semibold">
                  {activeLecture.title}
                </h2>

                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      const video = document.querySelector<HTMLVideoElement>(
                        "#course-lecture-video",
                      );
                      if (video) void saveProgress(video.currentTime, true);
                    }}
                    className="rounded-lg border px-4 py-2"
                  >
                    Mark as completed
                  </button>

                  <button
                    type="button"
                    onClick={() => void addBookmark()}
                    className="rounded-lg border px-4 py-2"
                  >
                    Bookmark current time
                  </button>
                </div>

                <section className="mt-8 rounded-xl border p-5">
                  <h3 className="text-lg font-semibold">Lecture notes</h3>

                  <textarea
                    value={noteContent}
                    onChange={(event) => setNoteContent(event.target.value)}
                    placeholder="Write a note about this moment in the lecture..."
                    rows={4}
                    className="mt-3 w-full rounded-lg border bg-background p-3"
                  />

                  <button
                    type="button"
                    disabled={saving || !noteContent.trim()}
                    onClick={() => void addNote()}
                    className="mt-3 rounded-lg bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50"
                  >
                    {saving ? "Saving..." : "Save note at current time"}
                  </button>

                  <ul className="mt-5 space-y-3">
                    {notes.map((note) => (
                      <li key={note.id} className="rounded-lg bg-muted p-3">
                        <button
                          type="button"
                          className="font-medium underline"
                          onClick={() => {
                            const video =
                              document.querySelector<HTMLVideoElement>(
                                "#course-lecture-video",
                              );
                            if (video)
                              video.currentTime = note.timestamp_seconds;
                          }}
                        >
                          {formatTime(note.timestamp_seconds)}
                        </button>
                        <p className="mt-1 whitespace-pre-wrap">
                          {note.content}
                        </p>
                      </li>
                    ))}
                    {notes.length === 0 && (
                      <li className="text-sm text-muted-foreground">
                        No notes for this lecture yet.
                      </li>
                    )}
                  </ul>
                </section>

                <section className="mt-6 rounded-xl border p-5">
                  <h3 className="text-lg font-semibold">Bookmarks</h3>
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {bookmarks.map((bookmark) => (
                      <li key={bookmark.id}>
                        <button
                          type="button"
                          className="rounded-lg border px-3 py-2 underline"
                          onClick={() => {
                            const video =
                              document.querySelector<HTMLVideoElement>(
                                "#course-lecture-video",
                              );
                            if (video) {
                              video.currentTime = bookmark.timestamp_seconds;
                            }
                          }}
                        >
                          {formatTime(bookmark.timestamp_seconds)}
                        </button>
                      </li>
                    ))}
                    {bookmarks.length === 0 && (
                      <li className="text-sm text-muted-foreground">
                        No bookmarks yet.
                      </li>
                    )}
                  </ul>
                </section>
              </>
            ) : (
              <p className="rounded-xl border p-8">
                {message || "No lecture is available for this course yet."}
              </p>
            )}
          </section>

          <aside className="rounded-xl border p-4">
            <h2 className="text-lg font-semibold">Course content</h2>

            <div className="mt-4 space-y-5">
              {modules.map((module) => (
                <section key={module.id}>
                  <h3 className="mb-2 font-medium">{module.title}</h3>

                  <ul className="space-y-2">
                    {module.lectures.map((lecture) => (
                      <li key={lecture.id}>
                        <button
                          type="button"
                          onClick={() => void loadLectureData(lecture)}
                          className={`w-full rounded-lg border p-3 text-left text-sm ${
                            activeLecture?.id === lecture.id
                              ? "border-primary bg-muted"
                              : ""
                          }`}
                        >
                          {lecture.title}
                          {lecture.id === activeLecture?.id &&
                            progress?.is_completed && (
                              <span className="ml-2">✓</span>
                            )}
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
