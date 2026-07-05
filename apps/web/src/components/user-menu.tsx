"use client";

import { api } from "@theologia/backend/convex/_generated/api";
import { Button } from "@theologia/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@theologia/ui/components/dropdown-menu";
import { useAction, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { authClient } from "@/lib/auth-client";

import styles from "./user-menu.module.css";

export default function UserMenu() {
  const router = useRouter();
  const user = useQuery(api.auth.getCurrentUser);
  const subscription = useQuery(api.polar.getCurrentSubscription);

  // Pre-fetch the customer portal URL for subscribers so the menu never
  // opens with a missing/pop-in "Manage Subscription" entry.
  const generatePortalUrl = useAction(api.polar.generateCustomerPortalUrl);
  const [portalUrl, setPortalUrl] = useState<string | null>(null);
  const hasSubscription = Boolean(subscription);
  useEffect(() => {
    if (!hasSubscription) {
      setPortalUrl(null);
      return;
    }
    let cancelled = false;
    void generatePortalUrl({}).then(
      ({ url }) => {
        if (!cancelled) setPortalUrl(url);
      },
      () => {
        // Portal link stays unavailable; the menu stays closed rather than
        // opening incomplete.
      },
    );
    return () => {
      cancelled = true;
    };
  }, [hasSubscription, generatePortalUrl]);

  // The menu only opens once everything it will show is ready: auth +
  // subscription resolved, and (for subscribers) the portal URL fetched.
  const ready =
    user !== undefined &&
    subscription !== undefined &&
    (!hasSubscription || portalUrl !== null);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger disabled={!ready} render={<Button variant="outline" />}>
        {user?.name}
      </DropdownMenuTrigger>
      <DropdownMenuContent className={styles.content}>
        <DropdownMenuGroup>
          <DropdownMenuLabel className={styles.label}>
            My Account
          </DropdownMenuLabel>
          <DropdownMenuSeparator className={styles.separator} />
          <div className={styles.email}>{user?.email}</div>
          {portalUrl ? (
            <DropdownMenuItem
              className={styles.item}
              render={<a href={portalUrl} target="_blank" rel="noreferrer" />}
            >
              Manage Subscription
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem
            className={`${styles.item} ${styles.signOut}`}
            onClick={() => {
              authClient.signOut({
                fetchOptions: {
                  onSuccess: () => {
                    router.push("/");
                  },
                },
              });
            }}
          >
            Sign Out
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
