"use client";

import { useEffect } from "react";
import { useUser, useOrganization } from "@clerk/nextjs";
import posthog from "posthog-js";

let initialized = false;

function initPostHog() {
  if (initialized) return;
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return;
  posthog.init(key, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
    capture_pageview: true,
    capture_pageleave: true,
    persistence: "localStorage+cookie",
  });
  initialized = true;
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const { user, isLoaded: userLoaded } = useUser();
  const { organization } = useOrganization();

  useEffect(() => {
    initPostHog();
  }, []);

  useEffect(() => {
    if (!initialized || !userLoaded) return;
    if (user) {
      posthog.identify(user.id, {
        email: user.primaryEmailAddress?.emailAddress,
        name: user.fullName,
      });
      if (organization) {
        posthog.group("organization", organization.id, {
          name: organization.name,
        });
      }
    } else {
      posthog.reset();
    }
  }, [user, userLoaded, organization]);

  return <>{children}</>;
}
