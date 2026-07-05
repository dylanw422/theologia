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
import { CustomerPortalLink } from "@convex-dev/polar/react";
import { useQuery } from "convex/react";
import { useRouter } from "next/navigation";

import { authClient } from "@/lib/auth-client";

export default function UserMenu() {
  const router = useRouter();
  const user = useQuery(api.auth.getCurrentUser);
  const subscription = useQuery(api.polar.getCurrentSubscription);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" />}>{user?.name}</DropdownMenuTrigger>
      <DropdownMenuContent className="bg-card">
        <DropdownMenuGroup>
          <DropdownMenuLabel>My Account</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem>{user?.email}</DropdownMenuItem>
          {subscription ? (
            <DropdownMenuItem>
              <CustomerPortalLink
                polarApi={{
                  generateCustomerPortalUrl: api.polar.generateCustomerPortalUrl,
                }}
              >
                Manage Subscription
              </CustomerPortalLink>
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem
            variant="destructive"
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
