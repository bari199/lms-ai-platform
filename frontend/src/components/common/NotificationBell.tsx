import { useEffect, useState } from "react";
import { Bell, CheckCheck } from "lucide-react";
import {
  getNotifications,
  getUnreadNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  type NotificationItem,
} from "@/services/notifications";

export default function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadUnreadCount = async () => {
    try {
      const response = await getUnreadNotificationCount();
      setUnreadCount(response.data.count);
    } catch (err) {
      console.error("Failed to load unread count:", err);
    }
  };

  const loadNotifications = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await getNotifications();
      setNotifications(response.data);
      await loadUnreadCount();
    } catch (err) {
      console.error("Failed to load notifications:", err);
      setError("Unable to load notifications.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadUnreadCount();
  }, []);

  const toggleNotifications = () => {
    const nextState = !isOpen;
    setIsOpen(nextState);

    if (nextState) {
      void loadNotifications();
    }
  };

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await markNotificationAsRead(notificationId);

      setNotifications((current) =>
        current.map((notification) =>
          notification.id === notificationId
            ? {
                ...notification,
                is_read: true,
                read_at: new Date().toISOString(),
              }
            : notification,
        ),
      );

      setUnreadCount((count) => Math.max(0, count - 1));
    } catch (err) {
      console.error("Failed to mark notification as read:", err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await markAllNotificationsAsRead();

      setNotifications((current) =>
        current.map((notification) => ({
          ...notification,
          is_read: true,
          read_at: notification.read_at ?? new Date().toISOString(),
        })),
      );

      setUnreadCount(0);
    } catch (err) {
      console.error("Failed to mark all as read:", err);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={toggleNotifications}
        aria-label="Notifications"
        aria-expanded={isOpen}
        className="relative rounded-full p-2 transition hover:bg-muted"
      >
        <Bell className="size-5" />

        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-xs text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 z-50 mt-2 w-80 rounded-xl border bg-background shadow-lg sm:w-96">
          <div className="flex items-center justify-between border-b p-4">
            <h3 className="font-semibold">Notifications</h3>

            <button
              type="button"
              onClick={handleMarkAllAsRead}
              disabled={unreadCount === 0}
              className="flex items-center gap-1 text-xs text-primary disabled:opacity-50"
            >
              <CheckCheck className="size-4" />
              Mark all as read
            </button>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <p className="p-6 text-center text-sm text-muted-foreground">
                Loading notifications...
              </p>
            ) : error ? (
              <p className="p-6 text-center text-sm text-destructive">
                {error}
              </p>
            ) : notifications.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">
                No notifications yet.
              </p>
            ) : (
              notifications.map((notification) => (
                <button
                  key={notification.id}
                  type="button"
                  onClick={() =>
                    !notification.is_read &&
                    void handleMarkAsRead(notification.id)
                  }
                  className={`block w-full border-b p-4 text-left transition hover:bg-muted/50 ${
                    notification.is_read ? "opacity-70" : "bg-muted/30"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-medium">{notification.title}</p>

                    {!notification.is_read && (
                      <span className="mt-1 size-2 shrink-0 rounded-full bg-primary" />
                    )}
                  </div>

                  <p className="mt-1 text-sm text-muted-foreground">
                    {notification.message}
                  </p>

                  <p className="mt-2 text-xs text-muted-foreground">
                    {new Date(notification.created_at).toLocaleString()}
                  </p>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
