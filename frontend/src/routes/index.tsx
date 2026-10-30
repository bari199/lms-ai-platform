import { createBrowserRouter } from "react-router";
import App from "../App";
import CourseCatalogPage from "../pages/course-catalog/CourseCatalogPage";
import DashboardPage from "../pages/dashboard/DashboardPage";
import LoginPage from "../pages/auth/LoginPage";
import RegisterPage from "../pages/auth/RegisterPage";
import CreateCoursePage from "../pages/instructor/CreateCoursePage";
import AdminCoursesPage from "../pages/admin-panel/AdminCoursesPage";
import MyCoursesPage from "../pages/dashboard/MyCoursesPage";
import LectureLearningPage from "../pages/course-learning/LectureLearningPage";
import CourseContentManagerPage from "../pages/instructor/CourseContentManagerPage";
import InstructorCoursesPage from "../pages/instructor/InstructorCoursesPage";
import AssignmentManagementPage from "../pages/instructor/AssignmentManagementPage";
import InstructorQuizManagementPage from "../pages/instructor/InstructorQuizManagementPage";
import QuizAttemptPage from "../pages/quizzes/QuizAttemptPage";
import QuizResultPage from "../pages/quizzes/QuizResultPage";
export const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
  },
  {
    path: "/courses",
    element: <CourseCatalogPage />,
  },
  {
    path: "/register",
    element: <RegisterPage />,
  },
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "/dashboard",
    element: <DashboardPage />,
  },
  {
    path: "/instructor/courses/new",
    element: <CreateCoursePage />,
  },
  {
    path: "/instructor/courses",
    element: <InstructorCoursesPage />,
  },
  {
    path: "/instructor/courses/:id/assignments",
    element: <AssignmentManagementPage />,
  },
  {
    path: "/instructor/courses/:id/quizzes",
    element: <InstructorQuizManagementPage />,
  },
  { path: "/my-courses", element: <MyCoursesPage /> },
  {
    path: "/quizzes/:id/attempt",
    element: <QuizAttemptPage />,
  },
  {
    path: "/courses/:id/learn",
    element: <LectureLearningPage />,
  },
  {
    path: "/instructor/courses/:id/content",
    element: <CourseContentManagerPage />,
  },

  {
    path: "/quizzes/attempts/:attemptId/results",
    element: <QuizResultPage />,
  },
  { path: "/admin/courses", element: <AdminCoursesPage /> },
]);
