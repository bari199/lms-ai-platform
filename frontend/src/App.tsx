import { useState } from "react";
import { Button } from "@/components/ui/button";
import MainLayout from "@/layouts/MainLayout";
import api from "@/services/api";

function App() {
  const [status, setStatus] = useState("Not tested");

  const testCoursesApi = async () => {
    setStatus("Loading courses...");

    try {
      const response = await api.get("/courses");
      const courses = response.data?.data?.courses;

      setStatus(
        `Success: ${Array.isArray(courses) ? courses.length : 0} courses received.`,
      );
    } catch (error) {
      console.error("Courses API test failed:", error);
      setStatus("API request failed. Check the browser console.");
    }
  };

  return (
    <MainLayout>
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
        <h1 className="text-3xl font-bold">LMS-AI Frontend</h1>

        <p className="text-muted-foreground">
          React, Tailwind CSS v4 and shadcn/ui
        </p>

        <Button onClick={() => alert("shadcn/ui Button is working!")}>
          Test Button
        </Button>

        <Button onClick={testCoursesApi}>Test Courses API</Button>

        <p role="status">{status}</p>
      </div>
    </MainLayout>
  );
}

export default App;
