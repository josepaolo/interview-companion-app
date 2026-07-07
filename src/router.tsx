import { createBrowserRouter, Navigate } from "react-router-dom";
import { RequireAuth, AppLayout } from "@/components/app-shell";
import Landing from "@/pages/Landing";
import Auth from "@/pages/Auth";
import Dashboard from "@/pages/Dashboard";
import StudyBuilder from "@/pages/StudyBuilder";
import Responses from "@/pages/Responses";
import Transcript from "@/pages/Transcript";
import ParticipantIntro from "@/pages/ParticipantIntro";
import ParticipantChat from "@/pages/ParticipantChat";

export const router = createBrowserRouter([
  { path: "/", element: <Landing /> },
  { path: "/auth", element: <Auth /> },
  // Public participant flow (token-scoped, no account needed)
  { path: "/i/:token", element: <ParticipantIntro /> },
  { path: "/i/:token/chat", element: <ParticipantChat /> },
  // Researcher, auth-gated
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: "/dashboard", element: <Dashboard /> },
          { path: "/studies/:id", element: <StudyBuilder /> },
          { path: "/studies/:id/responses", element: <Responses /> },
          {
            path: "/studies/:id/sessions/:sessionId",
            element: <Transcript />,
          },
        ],
      },
    ],
  },
  { path: "*", element: <Navigate to="/" replace /> },
]);
