import api from "./api";

export interface NotificationItem {
  id: string;
  user_id: string;
  actor_id: string | null;
  course_id: string | null;
  type: string;
  title: string;
  message: string;
  data: Record<string, unknown>;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

export const getNotifications = async (limit = 20, offset = 0) => {
  const response = await api.get("/notifications", {
    params: { limit, offset },
  });

  return response.data;
};

export const getUnreadNotificationCount = async () => {
  const response = await api.get("/notifications/unread-count");

  return response.data;
};

export const markNotificationAsRead = async (notificationId: string) => {
  const response = await api.patch(`/notifications/${notificationId}/read`);

  return response.data;
};

export const markAllNotificationsAsRead = async () => {
  const response = await api.patch("/notifications/read-all");

  return response.data;
};
