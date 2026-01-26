import { Bell } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Notification, TrainingMaterial } from "@shared/schema";

interface NotificationWithMaterial extends Notification {
  material?: TrainingMaterial;
}

export function NotificationBadge() {
  const { data: notifications = [] } = useQuery<NotificationWithMaterial[]>({
    queryKey: ["/api/notifications"],
  });

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const deleteNotificationMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      await apiRequest("DELETE", `/api/notifications/${notificationId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/notifications/read-all");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
  });

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button 
          size="icon" 
          variant="ghost" 
          className="relative"
          data-testid="button-notifications"
        >
          <Bell className="h-6 w-6" />
          {unreadCount > 0 && (
            <Badge 
              className="absolute -top-1 -right-1 h-6 w-6 flex items-center justify-center p-0 text-xs bg-accent text-accent-foreground animate-pulse"
              data-testid="badge-notification-count"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-4 border-b">
          <h4 className="font-semibold text-lg">알림</h4>
          {unreadCount > 0 && (
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => markAllAsReadMutation.mutate()}
              data-testid="button-mark-all-read"
            >
              모두 읽음
            </Button>
          )}
        </div>
        <ScrollArea className="h-80">
          {notifications.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">
              새로운 알림이 없습니다
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 hover-elevate cursor-pointer ${
                    !notification.isRead ? "bg-primary/5" : ""
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    // 클릭 시 알림 삭제
                    deleteNotificationMutation.mutate(notification.id);
                  }}
                  data-testid={`notification-item-${notification.id}`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-2 h-2 mt-2 rounded-full flex-shrink-0 ${
                      notification.isRead ? "bg-muted" : "bg-accent"
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">새 교육자료 등록</p>
                      <p className="text-sm text-muted-foreground truncate">
                        {notification.material?.title || "새로운 교육자료가 등록되었습니다"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(notification.createdAt).toLocaleDateString("ko-KR")}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
