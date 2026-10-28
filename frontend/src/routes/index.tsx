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
  { path: "/my-courses", element: <MyCoursesPage /> },
  {
    path: "/courses/:id/learn",
    element: <LectureLearningPage />,
  },
  {
    path: "/instructor/courses/:id/content",
    element: <CourseContentManagerPage />,
  },
  { path: "/admin/courses", element: <AdminCoursesPage /> },
]);
