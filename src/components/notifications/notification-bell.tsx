"use client";

import {
  KnockFeedProvider,
  KnockProvider,
  NotificationFeedPopover,
  NotificationIconButton,
} from "@knocklabs/react";
import "@knocklabs/react/dist/index.css";
import { useRef, useState } from "react";

/**
 * Header bell wired to Knock's hosted feed. Renders nothing when the public
 * key or feed channel id isn't configured so the header doesn't break in
 * environments without notifications wired up.
 */
export function NotificationBell({ userId }: { userId: string }) {
  const apiKey = process.env.NEXT_PUBLIC_KNOCK_PUBLIC_KEY;
  const feedChannelId = process.env.NEXT_PUBLIC_KNOCK_FEED_CHANNEL_ID;
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  if (!apiKey || !feedChannelId) return null;
  return (
    <KnockProvider apiKey={apiKey} userId={userId}>
      <KnockFeedProvider feedId={feedChannelId}>
        <NotificationIconButton
          ref={buttonRef}
          onClick={() => setIsOpen((s) => !s)}
        />
        <NotificationFeedPopover
          buttonRef={buttonRef}
          isVisible={isOpen}
          onClose={() => setIsOpen(false)}
        />
      </KnockFeedProvider>
    </KnockProvider>
  );
}
