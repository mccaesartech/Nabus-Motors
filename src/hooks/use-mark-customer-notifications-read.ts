"use client";

import { useEffect, useRef } from "react";
import { useCustomerNotifications } from "@/context/customer-notifications-context";

type MarkCustomerNotificationsReadOptions = {
  link?: string;
  type?: string;
};

/** Mark matching unread customer notifications as read when a page is visited. */
export function useMarkCustomerNotificationsOnVisit(
  options: MarkCustomerNotificationsReadOptions
) {
  const { markReadMatching } = useCustomerNotifications();
  const markedRef = useRef(false);

  useEffect(() => {
    if (markedRef.current) return;
    if (!options.link && !options.type) return;

    markedRef.current = true;
    void markReadMatching(options);
  }, [markReadMatching, options.link, options.type]);
}
