"use client";

import { Authenticated, AuthLoading, Unauthenticated } from "convex/react";

import AuthLayout from "@/components/auth-layout";
import authStyles from "@/components/auth-layout.module.css";
import Loader from "@/components/loader";
import ProfilePage from "@/components/profile/profile-page";
import SignInForm from "@/components/sign-in-form";

export default function Profile() {
  return (
    <>
      <Authenticated>
        <ProfilePage />
      </Authenticated>
      <Unauthenticated>
        <AuthLayout>
          <h1 className={authStyles.cardTitle}>Welcome back</h1>
          <SignInForm />
        </AuthLayout>
      </Unauthenticated>
      <AuthLoading>
        <Loader />
      </AuthLoading>
    </>
  );
}
