import { useCallback, useEffect, useRef, useState } from "react";

import { Link, useParams } from "react-router";

import api from "@/services/api";

import { connectSocket } from "@/services/socket";
import { useSelector } from "react-redux";
import type { RootState } from "@/store";
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

interface Assignment {
  id: string;

  course_id: string;

  title: string;

  instructions: string | null;

  rubric: Record<string, unknown> | null;

  due_date: string | null;
}

interface AssignmentSubmission {
  id: string;

  assignment_id: string;

  file_url: string;

  submitted_at: string;

  grade: number | null;

  feedback: string | null;

  assignment_title: string;

  due_date: string | null;
}

interface Discussion {
  id: string;

  course_id: string;

  author_id: string;

  author_name?: string;

  parent_id: string | null;

  title: string | null;

  content: string;

  is_pinned: boolean;

  created_at: string;

  updated_at: string;
}

interface Quiz {
  id: string;

  title: string;

  module_id: string;

  is_ai_generated: boolean;

  approval_status: string;
}

interface Announcement {
  id: string;
  course_id: string;
  instructor_id: string;
  title: string;
  message: string;
  created_at: string;
}

interface ApiResponse<T> {
  data?: T;

  course?: T;
}

function getResponseData<T>(response: { data?: ApiResponse<T> | T }): T | null {
  const body = response.data;

  if (!body || typeof body !== "object") {
    return null;
  }

  if ("data" in body && body.data !== undefined) {
    return body.data as T;
  }

  return body as T;
}

export default function LectureLearningPage() {
  const { id: courseId } = useParams();

  const videoRef = useRef<HTMLVideoElement>(null);

  const lastSavedSecondRef = useRef(-1);

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

  const [downloadingKey, setDownloadingKey] = useState<string | null>(null);

  const [assignments, setAssignments] = useState<Assignment[]>([]);

  const [assignmentFiles, setAssignmentFiles] = useState<
    Record<string, File | null>
  >({});

  const [submittingAssignmentId, setSubmittingAssignmentId] = useState<
    string | null
  >(null);

  const [assignmentMessages, setAssignmentMessages] = useState<
    Record<string, string>
  >({});

  const [assignmentResults, setAssignmentResults] = useState<
    AssignmentSubmission[]
  >([]);

  const [discussions, setDiscussions] = useState<Discussion[]>([]);

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [announcementsLoading, setAnnouncementsLoading] = useState(true);
  const [announcementsError, setAnnouncementsError] = useState("");

  const [discussionTitle, setDiscussionTitle] = useState("");

  const [discussionContent, setDiscussionContent] = useState("");

  const [discussionLoading, setDiscussionLoading] = useState(false);

  const [discussionMessage, setDiscussionMessage] = useState("");

  const [quizzes, setQuizzes] = useState<Quiz[]>([]);

  const currentUser = useSelector((state: RootState) => state.auth.user);

  const isInstructor = currentUser?.roles.includes("instructor") ?? false;

  const [deletingDiscussionId, setDeletingDiscussionId] = useState<
    string | null
  >(null);

  const loadLectureData = useCallback(async (lecture: Lecture) => {
    setActiveLecture(lecture);

    setProgress(null);

    setNotes([]);

    setBookmarks([]);

    setNoteContent("");

    setError("");

    setMessage("");

    lastSavedSecondRef.current = -1;

    try {
      const [progressResponse, notesResponse, bookmarksResponse] =
        await Promise.all([
          api.get(`/lectures/${lecture.id}/progress`),

          api.get(`/lectures/${lecture.id}/notes`),

          api.get(`/lectures/${lecture.id}/bookmarks`),
        ]);

      const progressData = getResponseData<Progress>(progressResponse);

      const notesData = getResponseData<Note[]>(notesResponse);

      const bookmarksData = getResponseData<Bookmark[]>(bookmarksResponse);

      setProgress(
        progressData && typeof progressData.watched_seconds === "number"
          ? progressData
          : null,
      );

      setNotes(
        Array.isArray(notesData)
          ? [...notesData].sort(
              (a, b) => a.timestamp_seconds - b.timestamp_seconds,
            )
          : [],
      );

      setBookmarks(
        Array.isArray(bookmarksData)
          ? [...bookmarksData].sort(
              (a, b) => a.timestamp_seconds - b.timestamp_seconds,
            )
          : [],
      );
    } catch (err) {
      console.error("Failed to load lecture data:", err);

      setError("Could not load saved progress, notes, or bookmarks.");
    }
  }, []);

  // Load the course discussion list when the course changes.
  useEffect(() => {
    if (!courseId) return;

    let cancelled = false;

    const loadDiscussions = async () => {
      setDiscussionLoading(true);
      setDiscussionMessage("");

      try {
        const response = await api.get(`/discussions/courses/${courseId}`);
        const data = getResponseData<Discussion[]>(response);

        if (!cancelled) {
          setDiscussions(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        console.error("Failed to load discussions:", err);
        if (!cancelled) {
          setDiscussionMessage("Could not load discussions.");
        }
      } finally {
        if (!cancelled) {
          setDiscussionLoading(false);
        }
      }
    };

    void loadDiscussions();

    return () => {
      cancelled = true;
    };
  }, [courseId]);

  // Connect to the course room and listen for real-time discussion changes.
  useEffect(() => {
    if (!courseId) return;

    let active = true;

    try {
      const socket = connectSocket();

      const refreshDiscussions = async () => {
        try {
          const response = await api.get(`/discussions/courses/${courseId}`);
          const data = getResponseData<Discussion[]>(response);

          if (active) {
            setDiscussions(Array.isArray(data) ? data : []);
          }
        } catch (err) {
          console.error("Failed to refresh discussions:", err);
        }
      };

      const handleDiscussionChange = (discussion: Discussion) => {
        if (discussion?.course_id === courseId) {
          void refreshDiscussions();
        }
      };

      const handleDiscussionDelete = (data: { id: string }) => {
        if (!data?.id) return;

        setDiscussions((previous) =>
          previous.filter((discussion) => discussion.id !== data.id),
        );
        void refreshDiscussions();
      };

      const joinRoom = () => {
        if (!active) return;

        socket.emit(
          "discussion:join",
          courseId,
          (result: { success: boolean; message?: string }) => {
            if (!result.success) {
              console.error("Discussion room join failed:", result.message);
            }
          },
        );
      };

      // Register listeners before joining, so no event is missed.
      socket.on("discussion:created", handleDiscussionChange);
      socket.on("discussion:replied", handleDiscussionChange);
      socket.on("discussion:updated", handleDiscussionChange);
      socket.on("discussion:pinned", handleDiscussionChange);
      socket.on("discussion:deleted", handleDiscussionDelete);
      socket.on("connect", joinRoom);

      if (socket.connected) {
        joinRoom();
      }

      return () => {
        active = false;
        socket.off("connect", joinRoom);
        socket.off("discussion:created", handleDiscussionChange);
        socket.off("discussion:replied", handleDiscussionChange);
        socket.off("discussion:updated", handleDiscussionChange);
        socket.off("discussion:pinned", handleDiscussionChange);
        socket.off("discussion:deleted", handleDiscussionDelete);

        if (socket.connected) {
          socket.emit("discussion:leave", courseId);
        }
      };
    } catch (err) {
      console.error("Discussion socket connection failed:", err);
      return () => {
        active = false;
      };
    }
  }, [courseId]);

  useEffect(() => {
    let cancelled = false;

    async function loadCourse() {
      setLoading(true);

      setError("");

      setMessage("");

      try {
        if (!courseId) {
          throw new Error("Course ID is missing.");
        }

        const response = await api.get(`/courses/${courseId}`);

        const responseBody = response.data;

        const courseData = (responseBody?.data ??
          responseBody?.course ??
          responseBody) as Course;

        if (!courseData || !Array.isArray(courseData.modules)) {
          throw new Error("Unexpected course response.");
        }

        const normalizedCourse: Course = {
          ...courseData,

          modules: courseData.modules.map((module) => ({
            ...module,

            lectures: Array.isArray(module.lectures) ? module.lectures : [],
          })),
        };

        // Load assignments and quizzes independently

        try {
          const response = await api.get("/assignments");

          const assignmentData = getResponseData<Assignment[]>(response);

          if (!cancelled) {
            setAssignments(
              Array.isArray(assignmentData)
                ? assignmentData.filter(
                    (assignment) => assignment.course_id === courseId,
                  )
                : [],
            );
          }
        } catch (err) {
          console.error("Failed to load assignments:", err);
        }

        try {
          const response = await api.get("/assignments/results/me");

          const results = getResponseData<AssignmentSubmission[]>(response);

          if (!cancelled) {
            setAssignmentResults(Array.isArray(results) ? results : []);
          }
        } catch (err) {
          console.error("Failed to load assignment results:", err);
        }

        try {
          const response = await api.get(`/quizzes/courses/${courseId}`);

          const quizData = getResponseData<Quiz[]>(response);

          if (!cancelled) {
            setQuizzes(Array.isArray(quizData) ? quizData : []);
          }
        } catch (err) {
          console.error("Failed to load quizzes:", err);
        }

        if (cancelled) return;

        setCourse(normalizedCourse);

        const firstLecture = normalizedCourse.modules

          .flatMap((module) => module.lectures)

          .find((lecture) => Boolean(lecture.video_url));

        if (firstLecture) {
          await loadLectureData(firstLecture);
        } else {
          setActiveLecture(null);

          setMessage("This course does not have a video lecture yet.");
        }
      } catch (err) {
        console.error("Failed to load course:", err);

        if (!cancelled) {
          setError("Could not load this course.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadCourse();

    return () => {
      cancelled = true;
    };
  }, [courseId, loadLectureData]);

  useEffect(() => {
    if (!courseId) {
      setAnnouncementsLoading(false);
      return;
    }

    let cancelled = false;

    async function loadAnnouncements() {
      setAnnouncementsLoading(true);
      setAnnouncementsError("");

      try {
        const response = await api.get(`/courses/${courseId}/announcements`);

        const data = getResponseData<Announcement[]>(response);

        if (!cancelled) {
          setAnnouncements(Array.isArray(data) ? data : []);
        }
      } catch (error) {
        console.error("Failed to load announcements:", error);

        if (!cancelled) {
          setAnnouncementsError("Could not load course announcements.");
        }
      } finally {
        if (!cancelled) {
          setAnnouncementsLoading(false);
        }
      }
    }

    void loadAnnouncements();

    return () => {
      cancelled = true;
    };
  }, [courseId]);

  const deleteDiscussion = async (discussionId: string) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this discussion? Its replies will also be deleted.",
    );

    if (!confirmed) return;

    try {
      setDeletingDiscussionId(discussionId);
      setDiscussionMessage("");

      await api.delete(`/discussions/${discussionId}`);

      // Reload discussions to reflect the deletion of the discussion
      // and all its replies.
      const response = await api.get(`/discussions/courses/${courseId}`);
      const data = getResponseData<Discussion[]>(response);

      setDiscussions(Array.isArray(data) ? data : []);
      setDiscussionMessage("Discussion deleted successfully.");
    } catch (error) {
      console.error("Failed to delete discussion:", error);
      setDiscussionMessage("Could not delete discussion. Please try again.");
    } finally {
      setDeletingDiscussionId(null);
    }
  };

  async function saveProgress(watchedSeconds: number, completed: boolean) {
    if (!activeLecture) return;

    const safeSeconds = Math.max(0, Math.floor(watchedSeconds));

    try {
      await api.post(`/lectures/${activeLecture.id}/progress`, {
        watched_seconds: safeSeconds,

        is_completed: completed,
      });

      setProgress((current) => ({
        watched_seconds: Math.max(current?.watched_seconds ?? 0, safeSeconds),

        is_completed: completed || Boolean(current?.is_completed),
      }));

      setError("");
    } catch (err) {
      console.error("Failed to save lecture progress:", err);

      setError("Could not save lecture progress.");
    }
  }

  async function addNote() {
    if (!activeLecture || !noteContent.trim()) return;

    const timestamp = Math.floor(videoRef.current?.currentTime ?? 0);

    setSaving(true);

    setError("");

    setMessage("");

    try {
      const response = await api.post(`/lectures/${activeLecture.id}/notes`, {
        timestamp_seconds: timestamp,

        content: noteContent.trim(),
      });

      const note = getResponseData<Note>(response);

      if (note) {
        setNotes((current) =>
          [...current, note].sort(
            (a, b) => a.timestamp_seconds - b.timestamp_seconds,
          ),
        );
      } else {
        const notesResponse = await api.get(
          `/lectures/${activeLecture.id}/notes`,
        );

        const notesData = getResponseData<Note[]>(notesResponse);

        if (Array.isArray(notesData)) {
          setNotes(
            [...notesData].sort(
              (a, b) => a.timestamp_seconds - b.timestamp_seconds,
            ),
          );
        }
      }

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

    const timestamp = Math.floor(videoRef.current?.currentTime ?? 0);

    setError("");

    setMessage("");

    try {
      const response = await api.post(
        `/lectures/${activeLecture.id}/bookmarks`,

        { timestamp_seconds: timestamp },
      );

      const bookmark = getResponseData<Bookmark>(response);

      if (bookmark) {
        setBookmarks((current) =>
          [...current, bookmark].sort(
            (a, b) => a.timestamp_seconds - b.timestamp_seconds,
          ),
        );
      } else {
        const bookmarksResponse = await api.get(
          `/lectures/${activeLecture.id}/bookmarks`,
        );

        const bookmarksData = getResponseData<Bookmark[]>(bookmarksResponse);

        if (Array.isArray(bookmarksData)) {
          setBookmarks(
            [...bookmarksData].sort(
              (a, b) => a.timestamp_seconds - b.timestamp_seconds,
            ),
          );
        }
      }

      setMessage("Bookmark saved.");
    } catch (err) {
      console.error("Failed to save bookmark:", err);

      setError("Could not save bookmark.");
    }
  }

  async function downloadResource(lectureId: string, resourceKey: string) {
    if (downloadingKey) return;

    setDownloadingKey(resourceKey);

    setError("");

    setMessage("");

    try {
      const response = await api.get(
        `/courses/lectures/${lectureId}/resources/download`,

        {
          params: { key: resourceKey },
        },
      );

      const downloadUrl = getResponseData<{ url: string }>(response)?.url;

      if (typeof downloadUrl !== "string" || !downloadUrl.trim()) {
        throw new Error("Download URL was not returned.");
      }

      const link = document.createElement("a");

      link.href = downloadUrl;

      link.target = "_blank";

      link.rel = "noopener noreferrer";

      link.click();

      setMessage("Your resource download link is ready.");
    } catch (err) {
      console.error("Resource download failed:", err);

      setError("Could not download this resource. Please try again.");
    } finally {
      setDownloadingKey(null);
    }
  }

  async function createDiscussion() {
    if (!courseId || !discussionTitle.trim() || !discussionContent.trim()) {
      setDiscussionMessage("Please enter a title and message.");
      return;
    }

    setDiscussionLoading(true);
    setDiscussionMessage("");

    try {
      await api.post("/discussions", {
        courseId,
        title: discussionTitle.trim(),
        content: discussionContent.trim(),
      });

      setDiscussionTitle("");
      setDiscussionContent("");
      setDiscussionMessage("Discussion posted successfully!");

      const response = await api.get(`/discussions/courses/${courseId}`);
      const data = getResponseData<Discussion[]>(response);
      setDiscussions(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to create discussion:", err);
      setDiscussionMessage("Could not post discussion. Please try again.");
    } finally {
      setDiscussionLoading(false);
    }
  }

  async function submitAssignment(assignmentId: string) {
    const file = assignmentFiles[assignmentId];

    const resultsResponse = await api.get("/assignments/results/me");

    const results = getResponseData<AssignmentSubmission[]>(resultsResponse);

    setAssignmentResults(Array.isArray(results) ? results : []);

    if (!file) {
      setAssignmentMessages((current) => ({
        ...current,

        [assignmentId]: "Please select a file first.",
      }));

      return;
    }

    const allowedExtensions = [".pdf", ".zip", ".js", ".ts", ".py", ".txt"];

    const extension = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();

    if (!allowedExtensions.includes(extension)) {
      setAssignmentMessages((current) => ({
        ...current,

        [assignmentId]: "File type not supported.",
      }));

      return;
    }

    const formData = new FormData();

    formData.append("file", file);

    setSubmittingAssignmentId(assignmentId);

    setAssignmentMessages((current) => ({
      ...current,

      [assignmentId]: "",
    }));

    try {
      await api.post(`/assignments/${assignmentId}/submit`, formData);

      setAssignmentMessages((current) => ({
        ...current,

        [assignmentId]: "Assignment submitted successfully!",
      }));

      setAssignmentFiles((current) => ({
        ...current,

        [assignmentId]: null,
      }));
    } catch (err) {
      console.error("Assignment submission failed:", err);

      setAssignmentMessages((current) => ({
        ...current,

        [assignmentId]: "Could not submit assignment. Please try again.",
      }));
    } finally {
      setSubmittingAssignmentId(null);
    }
  }

  function formatTime(seconds: number) {
    const safeSeconds = Math.max(0, Math.floor(seconds));

    const hours = Math.floor(safeSeconds / 3600);

    const minutes = Math.floor((safeSeconds % 3600) / 60);

    const remainingSeconds = safeSeconds % 60;

    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, "0")}:${String(
        remainingSeconds,
      ).padStart(2, "0")}`;
    }

    return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
  }

  function seekTo(seconds: number) {
    const video = videoRef.current;

    if (video) {
      video.currentTime = seconds;
    }
  }

  if (loading) {
    return <main className="p-8">Loading course...</main>;
  }

  if (!course) {
    return (
      <main className="p-8">
        <p role="alert" className="mb-4 text-destructive">
          {error || "Course not found."}
        </p>

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
        <section className="mb-6 space-y-4 rounded-xl border bg-card p-5">
          <div>
            <h2 className="text-xl font-semibold">Course Announcements</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Important updates from your instructor.
            </p>
          </div>

          {announcementsLoading ? (
            <p className="text-sm text-muted-foreground">
              Loading announcements...
            </p>
          ) : announcementsError ? (
            <p role="alert" className="text-sm text-destructive">
              {announcementsError}
            </p>
          ) : announcements.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No announcements published yet.
            </p>
          ) : (
            <div className="space-y-3">
              {announcements.map((announcement) => (
                <article
                  key={announcement.id}
                  className="rounded-lg border p-4"
                >
                  <h3 className="font-semibold">{announcement.title}</h3>

                  <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                    {announcement.message}
                  </p>

                  <p className="mt-3 text-xs text-muted-foreground">
                    Published:{" "}
                    {new Date(announcement.created_at).toLocaleString()}
                  </p>
                </article>
              ))}
            </div>
          )}
        </section>

        {message && (
          <p role="status" className="mb-4 text-sm">
            {message}
          </p>
        )}

        {error && (
          <p role="alert" className="mb-4 text-sm text-destructive">
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
                      ref={videoRef}
                      key={activeLecture.id}
                      id="course-lecture-video"
                      className="aspect-video w-full"
                      controls
                      playsInline
                      preload="metadata"
                      src={activeLecture.video_url}
                      onLoadedMetadata={(event) => {
                        const video = event.currentTarget;

                        const savedSeconds = progress?.watched_seconds ?? 0;

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

                        const currentSecond = Math.floor(video.currentTime);

                        if (
                          currentSecond > 0 &&
                          currentSecond % 15 === 0 &&
                          currentSecond !== lastSavedSecondRef.current
                        ) {
                          lastSavedSecondRef.current = currentSecond;

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

                {progress?.is_completed && (
                  <p className="mt-2 text-sm text-green-600">
                    ✓ Lecture completed
                  </p>
                )}

                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      if (videoRef.current) {
                        void saveProgress(videoRef.current.currentTime, true);
                      }
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

                {activeLecture.resource_urls &&
                  activeLecture.resource_urls.length > 0 && (
                    <section className="mt-6 rounded-xl border p-5">
                      <h3 className="text-lg font-semibold">
                        Lecture Resources
                      </h3>

                      <p className="mt-1 text-sm text-muted-foreground">
                        {activeLecture.resource_urls.length} resource file
                        {activeLecture.resource_urls.length === 1
                          ? ""
                          : "s"}{" "}
                        available.
                      </p>

                      <ul className="mt-3 space-y-3">
                        {activeLecture.resource_urls.map((resourceKey) => {
                          const fileName =
                            resourceKey.split("/").pop() ?? "Resource file";

                          return (
                            <li
                              key={resourceKey}
                              className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted p-3"
                            >
                              <div className="min-w-0">
                                <p className="break-all text-sm font-medium">
                                  {fileName}
                                </p>

                                <p className="text-xs text-muted-foreground">
                                  Lecture PDF / Slides
                                </p>
                              </div>

                              <button
                                type="button"
                                disabled={downloadingKey !== null}
                                onClick={() =>
                                  void downloadResource(
                                    activeLecture.id,

                                    resourceKey,
                                  )
                                }
                                className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
                              >
                                {downloadingKey === resourceKey
                                  ? "Preparing..."
                                  : "Download"}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </section>
                  )}

                <section className="mt-8 rounded-xl border p-5">
                  <h3 className="text-lg font-semibold">Lecture Notes</h3>

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
                          onClick={() => seekTo(note.timestamp_seconds)}
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
                          onClick={() => seekTo(bookmark.timestamp_seconds)}
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
            <h2 className="text-lg font-semibold">Course Content</h2>

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
                          <span>{lecture.title}</span>

                          {activeLecture?.id === lecture.id &&
                            progress?.is_completed && (
                              <span className="ml-2 text-green-600">✓</span>
                            )}
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}

              {modules.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No course modules available.
                </p>
              )}
            </div>
          </aside>
        </div>
      </div>

      <div className="mx-auto mt-8 max-w-7xl px-4 md:px-8">
        <section className="rounded-xl border bg-card p-5">
          <div className="mb-5">
            <h2 className="text-xl font-semibold">Course Discussions</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Ask questions and discuss this course with other learners.
            </p>
          </div>

          <div className="space-y-3">
            <input
              type="text"
              value={discussionTitle}
              onChange={(event) => setDiscussionTitle(event.target.value)}
              placeholder="Discussion title"
              maxLength={200}
              className="w-full rounded-lg border bg-background p-3"
            />
            <textarea
              value={discussionContent}
              onChange={(event) => setDiscussionContent(event.target.value)}
              placeholder="Write your question or message..."
              rows={4}
              className="w-full rounded-lg border bg-background p-3"
            />
            <button
              type="button"
              onClick={() => void createDiscussion()}
              disabled={
                discussionLoading ||
                !discussionTitle.trim() ||
                !discussionContent.trim()
              }
              className="rounded-lg bg-primary px-5 py-2 text-primary-foreground disabled:opacity-50"
            >
              {discussionLoading ? "Please wait..." : "Post Discussion"}
            </button>
            {discussionMessage && (
              <p role="status" className="text-sm text-muted-foreground">
                {discussionMessage}
              </p>
            )}
          </div>

          <div className="mt-6 space-y-4">
            {discussionLoading && discussions.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Loading discussions...
              </p>
            )}
            {!discussionLoading && discussions.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No discussions yet. Start the first discussion!
              </p>
            )}
            {discussions.map((discussion) => (
              <article key={discussion.id} className="rounded-lg border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">
                    {discussion.author_name || "Course member"}
                  </p>
                  <div className="flex items-center gap-2">
                    {discussion.is_pinned && (
                      <span className="rounded-full bg-muted px-2 py-1 text-xs">
                        Pinned
                      </span>
                    )}

                    <span className="text-xs text-muted-foreground">
                      {new Date(discussion.created_at).toLocaleString()}
                    </span>

                    {(currentUser?.id === discussion.author_id ||
                      isInstructor) && (
                      <button
                        type="button"
                        onClick={() => deleteDiscussion(discussion.id)}
                        disabled={deletingDiscussionId === discussion.id}
                        className="rounded-md px-2 py-1 text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {deletingDiscussionId === discussion.id
                          ? "Deleting..."
                          : "Delete"}
                      </button>
                    )}
                  </div>
                </div>
                {discussion.title && (
                  <h3 className="mt-3 font-semibold">{discussion.title}</h3>
                )}
                <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                  {discussion.content}
                </p>
                {discussion.parent_id && (
                  <p className="mt-2 text-xs text-muted-foreground">Reply</p>
                )}
              </article>
            ))}
          </div>
        </section>
      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        {/* Assignments */}

        <section className="rounded-xl border bg-card p-5">
          <h2 className="text-xl font-semibold">Assignments</h2>

          <div className="mt-4 space-y-3">
            {assignments.map((assignment) => (
              <article key={assignment.id} className="rounded-lg border p-4">
                <h3 className="font-medium">{assignment.title}</h3>

                {assignment.instructions && (
                  <p className="mt-2 text-sm text-muted-foreground">
                    {assignment.instructions}
                  </p>
                )}

                {(() => {
                  const submission = assignmentResults.find(
                    (result) => result.assignment_id === assignment.id,
                  );

                  if (!submission) {
                    return (
                      <p className="mt-3 text-sm text-muted-foreground">
                        Status: Not submitted
                      </p>
                    );
                  }

                  return (
                    <div className="mt-4 rounded-lg bg-muted p-4">
                      <p className="font-medium text-green-600">✓ Submitted</p>

                      <p className="mt-2 text-sm">
                        Submitted at:{" "}
                        {new Date(submission.submitted_at).toLocaleString()}
                      </p>

                      <p className="mt-2 text-sm font-medium">
                        {submission.grade === null
                          ? "Status: Pending Review"
                          : `Grade: ${submission.grade}/100`}
                      </p>

                      {submission.feedback && (
                        <div className="mt-3">
                          <p className="text-sm font-medium">
                            Instructor Feedback
                          </p>

                          <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                            {submission.feedback}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })()}

                <div className="mt-4 space-y-3">
                  <input
                    type="file"
                    accept=".pdf,.zip,.js,.ts,.py,.txt"
                    onChange={(event) => {
                      const file = event.target.files?.[0] ?? null;

                      setAssignmentFiles((current) => ({
                        ...current,

                        [assignment.id]: file,
                      }));

                      setAssignmentMessages((current) => ({
                        ...current,

                        [assignment.id]: "",
                      }));
                    }}
                    className="block w-full text-sm"
                  />

                  <button
                    type="button"
                    disabled={submittingAssignmentId === assignment.id}
                    onClick={() => void submitAssignment(assignment.id)}
                    className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
                  >
                    {submittingAssignmentId === assignment.id
                      ? "Submitting..."
                      : "Submit Assignment"}
                  </button>

                  {assignmentMessages[assignment.id] && (
                    <p role="status" className="text-sm text-muted-foreground">
                      {assignmentMessages[assignment.id]}
                    </p>
                  )}
                </div>

                <p className="mt-3 text-xs text-muted-foreground">
                  Due date:{" "}
                  {assignment.due_date
                    ? new Date(assignment.due_date).toLocaleDateString()
                    : "No deadline"}
                </p>
              </article>
            ))}

            {assignments.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No assignments available yet.
              </p>
            )}
          </div>
        </section>

        {/* Quizzes */}

        <section className="rounded-xl border bg-card p-5">
          <h2 className="text-xl font-semibold">Quizzes</h2>

          <div className="mt-4 space-y-3">
            {quizzes.map((quiz) => (
              <article key={quiz.id} className="rounded-lg border p-4">
                <h3 className="font-medium">{quiz.title}</h3>

                <p className="mt-2 text-xs text-muted-foreground">
                  {quiz.is_ai_generated
                    ? "AI Generated Quiz"
                    : "Instructor Created Quiz"}
                </p>

                <Link
                  to={`/quizzes/${quiz.id}/attempt`}
                  className="mt-3 inline-block rounded-lg bg-primary px-4 py-2 text-primary-foreground"
                >
                  Start Quiz
                </Link>
              </article>
            ))}

            {quizzes.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No approved quizzes available yet.
              </p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
