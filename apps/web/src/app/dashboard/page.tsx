"use client";

import { CheckoutLink, CustomerPortalLink } from "@convex-dev/polar/react";
import { api } from "@theologia/backend/convex/_generated/api";
import { buttonVariants } from "@theologia/ui/components/button";
import { Authenticated, AuthLoading, Unauthenticated, useQuery } from "convex/react";
import { useState } from "react";

import SignInForm from "@/components/sign-in-form";
import SignUpForm from "@/components/sign-up-form";
import UserMenu from "@/components/user-menu";

function DashboardContent() {
  const privateData = useQuery(api.privateData.get);
  const products = useQuery(api.polar.listAllProducts);
  const subscription = useQuery(api.polar.getCurrentSubscription);

  const product = products?.find((product: { isRecurring?: boolean }) => product.isRecurring);
  const hasActiveSubscription = Boolean(subscription);

  return (
    <div>
      <h1>Dashboard</h1>
      <p>privateData: {privateData?.message}</p>
      <p>Plan: {hasActiveSubscription ? "Active" : "Free"}</p>
      {subscription === undefined ? (
        <p>Loading subscription options...</p>
      ) : hasActiveSubscription ? (
        <CustomerPortalLink polarApi={api.polar} className={buttonVariants({ variant: "outline" })}>
          Manage Subscription
        </CustomerPortalLink>
      ) : products === undefined ? (
        <p>Loading subscription options...</p>
      ) : product ? (
        <CheckoutLink
          polarApi={api.polar}
          productIds={[product.id]}
          embed={false}
          className={buttonVariants({ variant: "default" })}
        >
          Upgrade
        </CheckoutLink>
      ) : (
        <p>No recurring plans available.</p>
      )}
      <UserMenu />
    </div>
  );
}

export default function DashboardPage() {
  const [showSignIn, setShowSignIn] = useState(false);

  return (
    <>
      <Authenticated>
        <DashboardContent />
      </Authenticated>
      <Unauthenticated>
        {showSignIn ? (
          <SignInForm onSwitchToSignUp={() => setShowSignIn(false)} />
        ) : (
          <SignUpForm onSwitchToSignIn={() => setShowSignIn(true)} />
        )}
      </Unauthenticated>
      <AuthLoading>
        <div>Loading...</div>
      </AuthLoading>
    </>
  );
}
