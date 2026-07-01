"use client";

import { useEffect, useRef } from "react";
import { useAdminNotifications } from "@/context/admin-notifications-context";

type MarkNotificationsReadOptions = {
  link?: string;
  type?: string;
};

/** Mark matching unread notifications as read when a platform page is visited. */
export function useMarkNotificationsOnVisit(options: MarkNotificationsReadOptions) {
  const { markReadMatching } = useAdminNotifications();
  const markedRef = useRef(false);

  useEffect(() => {
    if (markedRef.current) return;
    if (!options.link && !options.type) return;

    markedRef.current = true;
    void markReadMatching(options);
  }, [markReadMatching, options.link, options.type]);
}
