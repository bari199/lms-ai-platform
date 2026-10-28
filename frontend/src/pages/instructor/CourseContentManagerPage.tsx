import { useEffect, useState, type FormEvent, type ChangeEvent } from "react";
import { useParams, useNavigate } from "react-router";
import axios from "axios";
import api from "@/services/api";

type Lecture = {
  id: string;
  title: string;
  order_index: number;
  video_url?: string | null;
};

type Module = {
  id: string;
  title: string;
  order_index: number;
  lectures?: Lecture[];
};

type ApiResponse<T> = {
  success: boolean;
  data: T;
  message?: string;
};

type CourseContentResponse = {
  success: boolean;
  data: {
    modules?: Module[];
  };
};

function getErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.message || fallback;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
}

function getNextOrder(items: { order_index: number }[]): number {
  return Math.max(0, ...items.map((item) => item.order_index)) + 1;
}

export default function CourseContentManagerPage() {
  const { id: courseId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [modules, setModules] = useState<Module[]>([]);
  const [selectedModuleId, setSelectedModuleId] = useState("");

  const [moduleTitle, setModuleTitle] = useState("");
  const [moduleOrder, setModuleOrder] = useState("1");

  const [lectureTitle, setLectureTitle] = useState("");
  const [lectureOrder, setLectureOrder] = useState("1");
  const [videoFile, setVideoFile] = useState<File | null>(null);

  const [editingModuleId, setEditingModuleId] = useState("");
  const [editingModuleTitle, setEditingModuleTitle] = useState("");
  const [editingModuleOrder, setEditingModuleOrder] = useState("1");

  const [loading, setLoading] = useState(false);
  const [loadingContent, setLoadingContent] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const lectures = modules.flatMap((module) =>
    (module.lectures ?? []).map((lecture) => ({
      ...lecture,
      moduleId: module.id,
      moduleTitle: module.title,
      moduleOrder: module.order_index,
    })),
  );

  const selectedModule = modules.find(
    (module) => module.id === selectedModuleId,
  );

  useEffect(() => {
    if (!courseId) {
      setLoadingContent(false);
      return;
    }

    let cancelled = false;

    async function loadCourseContent() {
      setLoadingContent(true);
      setError("");

      try {
        const response = await api.get<CourseContentResponse>(
          `/courses/${courseId}/manage`,
        );

        if (!response.data?.success) {
          throw new Error("Failed to load course content.");
        }

        if (cancelled) return;

        const existingModules = [...(response.data.data?.modules ?? [])]
          .map((module) => ({
            ...module,
            lectures: [...(module.lectures ?? [])].sort(
              (a, b) => a.order_index - b.order_index,
            ),
          }))
          .sort((a, b) => a.order_index - b.order_index);

        setModules(existingModules);
        setSelectedModuleId(existingModules[0]?.id ?? "");
        setModuleOrder(String(getNextOrder(existingModules)));
        setLectureOrder(
          String(getNextOrder(existingModules[0]?.lectures ?? [])),
        );
      } catch (err) {
        if (!cancelled) {
          setError(
            getErrorMessage(err, "Failed to load existing course content."),
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingContent(false);
        }
      }
    }

    void loadCourseContent();

    return () => {
      cancelled = true;
    };
  }, [courseId]);

  function clearNotifications() {
    setError("");
    setMessage("");
  }

  function handleModuleSelection(moduleId: string) {
    setSelectedModuleId(moduleId);

    const module = modules.find((item) => item.id === moduleId);

    setLectureOrder(String(getNextOrder(module?.lectures ?? [])));
    clearNotifications();
  }

  async function handleCreateModule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!courseId || loading) return;

    const title = moduleTitle.trim();
    const order = Number(moduleOrder);

    if (!title || !Number.isInteger(order) || order < 1) {
      setError("Enter a valid module title and order.");
      setMessage("");
      return;
    }

    setLoading(true);
    clearNotifications();

    try {
      const response = await api.post<ApiResponse<Module>>(
        `/courses/${courseId}/modules`,
        {
          title,
          order_index: order,
        },
      );

      const createdModule = response.data?.data;

      if (!response.data?.success || !createdModule?.id) {
        throw new Error("Module creation failed.");
      }

      const newModule: Module = {
        ...createdModule,
        lectures: createdModule.lectures ?? [],
      };

      setModules((current) =>
        [...current, newModule].sort((a, b) => a.order_index - b.order_index),
      );

      setSelectedModuleId(newModule.id);
      setModuleTitle("");
      setModuleOrder(
        String(Math.max(order + 1, getNextOrder([...modules, newModule]))),
      );
      setLectureOrder("1");

      setMessage("Module created successfully.");
    } catch (err) {
      setError(getErrorMessage(err, "Failed to create module."));
    } finally {
      setLoading(false);
    }
  }

  function startEditingModule(module: Module) {
    setEditingModuleId(module.id);
    setEditingModuleTitle(module.title);
    setEditingModuleOrder(String(module.order_index));
    clearNotifications();
  }

  function cancelEditingModule() {
    setEditingModuleId("");
    setEditingModuleTitle("");
    setEditingModuleOrder("1");
  }

  async function handleUpdateModule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editingModuleId || loading) return;

    const title = editingModuleTitle.trim();
    const order = Number(editingModuleOrder);

    if (!title || !Number.isInteger(order) || order < 1) {
      setError("Enter a valid module title and order.");
      setMessage("");
      return;
    }

    setLoading(true);
    clearNotifications();

    try {
      const response = await api.put<ApiResponse<Module>>(
        `/courses/modules/${editingModuleId}`,
        {
          title,
          order_index: order,
        },
      );

      if (!response.data?.success) {
        throw new Error("Module update failed.");
      }

      const updatedModule = response.data.data;

      setModules((current) =>
        current
          .map((module) =>
            module.id === editingModuleId
              ? {
                  ...module,
                  title: updatedModule?.title ?? title,
                  order_index: updatedModule?.order_index ?? order,
                }
              : module,
          )
          .sort((a, b) => a.order_index - b.order_index),
      );

      setMessage("Module updated successfully.");
      cancelEditingModule();
    } catch (err) {
      setError(getErrorMessage(err, "Failed to update module."));
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteModule(module: Module) {
    if (loading) return;

    const confirmed = window.confirm(
      `Delete module "${module.title}"? Its lectures may also be affected.`,
    );

    if (!confirmed) return;

    setLoading(true);
    clearNotifications();

    try {
      const response = await api.delete<ApiResponse<unknown>>(
        `/courses/modules/${module.id}`,
      );

      if (!response.data?.success) {
        throw new Error("Module deletion failed.");
      }

      const remainingModules = modules.filter((item) => item.id !== module.id);

      setModules(remainingModules);

      if (selectedModuleId === module.id) {
        const nextModule = remainingModules[0];

        setSelectedModuleId(nextModule?.id ?? "");
        setLectureOrder(String(getNextOrder(nextModule?.lectures ?? [])));
      }

      if (editingModuleId === module.id) {
        cancelEditingModule();
      }

      setMessage("Module deleted successfully.");
    } catch (err) {
      setError(getErrorMessage(err, "Failed to delete module."));
    } finally {
      setLoading(false);
    }
  }

  function handleVideoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;

    clearNotifications();

    if (!file) {
      setVideoFile(null);
      return;
    }

    if (!file.type.startsWith("video/")) {
      setVideoFile(null);
      event.target.value = "";
      setError("Please select a valid video file.");
      return;
    }

    setVideoFile(file);
  }

  async function handleUploadLecture(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (loading) return;

    if (!selectedModuleId) {
      setError("Please select a module.");
      setMessage("");
      return;
    }

    if (!videoFile) {
      setError("Please select a video file.");
      setMessage("");
      return;
    }

    const title = lectureTitle.trim();
    const order = Number(lectureOrder);

    if (!title || !Number.isInteger(order) || order < 1) {
      setError("Enter a valid lecture title and order.");
      setMessage("");
      return;
    }

    setLoading(true);
    clearNotifications();

    try {
      const formData = new FormData();

      formData.append("title", title);
      formData.append("order_index", String(order));
      formData.append("video", videoFile);

      const response = await api.post<ApiResponse<Lecture>>(
        `/courses/modules/${selectedModuleId}/video`,
        formData,
      );

      const createdLecture = response.data?.data;

      if (!response.data?.success || !createdLecture?.id) {
        throw new Error("Lecture video upload failed.");
      }

      setModules((current) =>
        current.map((module) =>
          module.id === selectedModuleId
            ? {
                ...module,
                lectures: [
                  ...(module.lectures ?? []).filter(
                    (lecture) => lecture.id !== createdLecture.id,
                  ),
                  createdLecture,
                ].sort((a, b) => a.order_index - b.order_index),
              }
            : module,
        ),
      );

      setLectureTitle("");
      setLectureOrder(String(order + 1));
      setVideoFile(null);

      const fileInput = document.getElementById(
        "lecture-video",
      ) as HTMLInputElement | null;

      if (fileInput) {
        fileInput.value = "";
      }

      setMessage("Lecture created and video uploaded successfully.");
    } catch (err) {
      setError(getErrorMessage(err, "Failed to upload lecture video."));
    } finally {
      setLoading(false);
    }
  }

  if (!courseId) {
    return (
      <main className="p-6">
        <p role="alert">Course ID is missing.</p>

        <button
          type="button"
          onClick={() => navigate("/instructor/courses/new")}
          className="mt-4 rounded-lg border px-4 py-2"
        >
          Back to Create Course
        </button>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground sm:px-6 sm:py-10">
      <div className="mx-auto max-w-3xl space-y-8">
        <button
          type="button"
          onClick={() => navigate("/instructor/courses/new")}
          className="text-sm text-muted-foreground hover:underline"
        >
          ← Back to Create Course
        </button>

        <header>
          <h1 className="text-3xl font-bold">Course Content Manager</h1>

          <p className="mt-2 text-sm text-muted-foreground">
            Create, edit, and delete modules, and upload lecture videos to
            MinIO.
          </p>

          <p className="mt-1 break-all text-xs text-muted-foreground">
            Course ID: {courseId}
          </p>
        </header>

        {error && (
          <p
            role="alert"
            className="rounded-lg border border-destructive p-3 text-sm"
          >
            {error}
          </p>
        )}

        {message && (
          <p role="status" className="rounded-lg border p-3 text-sm">
            {message}
          </p>
        )}

        {loadingContent ? (
          <section className="rounded-xl border bg-card p-6" aria-live="polite">
            Loading course content...
          </section>
        ) : (
          <>
            <section className="space-y-4 rounded-xl border bg-card p-6">
              <h2 className="text-xl font-semibold">1. Create Module</h2>

              <form onSubmit={handleCreateModule} className="space-y-4">
                <div>
                  <label
                    htmlFor="module-title"
                    className="mb-2 block font-medium"
                  >
                    Module title
                  </label>

                  <input
                    id="module-title"
                    type="text"
                    required
                    maxLength={200}
                    value={moduleTitle}
                    onChange={(event) => setModuleTitle(event.target.value)}
                    placeholder="Introduction"
                    className="w-full rounded-lg border bg-background px-3 py-2"
                  />
                </div>

                <div>
                  <label
                    htmlFor="module-order"
                    className="mb-2 block font-medium"
                  >
                    Module order
                  </label>

                  <input
                    id="module-order"
                    type="number"
                    min="1"
                    step="1"
                    required
                    value={moduleOrder}
                    onChange={(event) => setModuleOrder(event.target.value)}
                    className="w-full rounded-lg border bg-background px-3 py-2"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-lg bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50"
                >
                  {loading ? "Please wait..." : "Create Module"}
                </button>
              </form>
            </section>

            <section className="space-y-4 rounded-xl border bg-card p-6">
              <h2 className="text-xl font-semibold">2. Manage Modules</h2>

              {modules.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No modules found. Create your first module above.
                </p>
              ) : (
                <div className="space-y-3">
                  {modules.map((module) => (
                    <div
                      key={module.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4"
                    >
                      <div className="min-w-0">
                        <p className="break-words font-medium">
                          {module.order_index}. {module.title}
                        </p>

                        <p className="text-sm text-muted-foreground">
                          {module.lectures?.length ?? 0} lectures
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => startEditingModule(module)}
                          disabled={loading}
                          className="rounded-md border px-3 py-2 text-sm hover:bg-muted disabled:opacity-50"
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          onClick={() => void handleDeleteModule(module)}
                          disabled={loading}
                          className="rounded-md border border-destructive px-3 py-2 text-sm text-destructive hover:bg-destructive/10 disabled:opacity-50"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {editingModuleId && (
                <form
                  onSubmit={handleUpdateModule}
                  className="space-y-4 border-t pt-4"
                >
                  <h3 className="font-semibold">Edit Module</h3>

                  <div>
                    <label
                      htmlFor="edit-module-title"
                      className="mb-2 block text-sm font-medium"
                    >
                      Module title
                    </label>

                    <input
                      id="edit-module-title"
                      type="text"
                      required
                      maxLength={200}
                      value={editingModuleTitle}
                      onChange={(event) =>
                        setEditingModuleTitle(event.target.value)
                      }
                      className="w-full rounded-lg border bg-background px-3 py-2"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="edit-module-order"
                      className="mb-2 block text-sm font-medium"
                    >
                      Module order
                    </label>

                    <input
                      id="edit-module-order"
                      type="number"
                      min="1"
                      step="1"
                      required
                      value={editingModuleOrder}
                      onChange={(event) =>
                        setEditingModuleOrder(event.target.value)
                      }
                      className="w-full rounded-lg border bg-background px-3 py-2"
                    />
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <button
                      type="submit"
                      disabled={loading}
                      className="rounded-lg bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50"
                    >
                      {loading ? "Saving..." : "Save Changes"}
                    </button>

                    <button
                      type="button"
                      disabled={loading}
                      onClick={cancelEditingModule}
                      className="rounded-lg border px-4 py-2 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </section>

            <section className="space-y-4 rounded-xl border bg-card p-6">
              <h2 className="text-xl font-semibold">3. Upload Lecture Video</h2>

              <div>
                <label
                  htmlFor="module-select"
                  className="mb-2 block font-medium"
                >
                  Select a module
                </label>

                <select
                  id="module-select"
                  required
                  value={selectedModuleId}
                  onChange={(event) =>
                    handleModuleSelection(event.target.value)
                  }
                  className="w-full rounded-lg border bg-background px-3 py-2"
                >
                  <option value="">Choose a module</option>

                  {modules.map((module) => (
                    <option key={module.id} value={module.id}>
                      {module.order_index}. {module.title}
                    </option>
                  ))}
                </select>
              </div>

              <form onSubmit={handleUploadLecture} className="space-y-4">
                <div>
                  <label
                    htmlFor="lecture-title"
                    className="mb-2 block font-medium"
                  >
                    Lecture title
                  </label>

                  <input
                    id="lecture-title"
                    type="text"
                    required
                    maxLength={200}
                    value={lectureTitle}
                    onChange={(event) => setLectureTitle(event.target.value)}
                    placeholder="Getting started"
                    className="w-full rounded-lg border bg-background px-3 py-2"
                  />
                </div>

                <div>
                  <label
                    htmlFor="lecture-order"
                    className="mb-2 block font-medium"
                  >
                    Lecture order
                  </label>

                  <input
                    id="lecture-order"
                    type="number"
                    min="1"
                    step="1"
                    required
                    value={lectureOrder}
                    onChange={(event) => setLectureOrder(event.target.value)}
                    className="w-full rounded-lg border bg-background px-3 py-2"
                  />
                </div>

                <div>
                  <label
                    htmlFor="lecture-video"
                    className="mb-2 block font-medium"
                  >
                    Video file
                  </label>

                  <input
                    id="lecture-video"
                    type="file"
                    accept="video/*"
                    required
                    onChange={handleVideoChange}
                    className="w-full rounded-lg border bg-background px-3 py-2"
                  />

                  {videoFile && (
                    <p className="mt-2 break-all text-sm text-muted-foreground">
                      Selected: {videoFile.name} (
                      {(videoFile.size / (1024 * 1024)).toFixed(1)} MB)
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={
                    loading ||
                    !selectedModuleId ||
                    !videoFile ||
                    modules.length === 0
                  }
                  className="w-full rounded-lg bg-primary px-4 py-3 font-medium text-primary-foreground disabled:opacity-50"
                >
                  {loading ? "Uploading..." : "Create Lecture & Upload Video"}
                </button>
              </form>
            </section>

            <section className="rounded-xl border bg-card p-6">
              <h2 className="text-xl font-semibold">4. Uploaded Lectures</h2>

              {lectures.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  No lectures have been uploaded yet.
                </p>
              ) : (
                <div className="mt-4 space-y-4">
                  {modules
                    .filter((module) => (module.lectures?.length ?? 0) > 0)
                    .map((module) => (
                      <div key={module.id} className="space-y-2">
                        <h3 className="font-medium">
                          {module.order_index}. {module.title}
                        </h3>

                        <ul className="space-y-2">
                          {[...(module.lectures ?? [])]
                            .sort((a, b) => a.order_index - b.order_index)
                            .map((lecture) => (
                              <li
                                key={lecture.id}
                                className="rounded-lg border p-3"
                              >
                                <p className="font-medium">
                                  {lecture.order_index}. {lecture.title}
                                </p>

                                <p className="mt-1 text-xs text-muted-foreground">
                                  {lecture.video_url
                                    ? "Video uploaded"
                                    : "Lecture created"}
                                </p>
                              </li>
                            ))}
                        </ul>
                      </div>
                    ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
