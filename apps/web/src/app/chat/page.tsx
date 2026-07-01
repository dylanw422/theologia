"use client";

import { Authenticated, AuthLoading, Unauthenticated } from "convex/react";

import AuthLayout from "@/components/auth-layout";
import authStyles from "@/components/auth-layout.module.css";
import ChatApp from "@/components/chat/chat-app";
import Loader from "@/components/loader";
import SignInForm from "@/components/sign-in-form";

export default function ChatPage() {
  return (
    <>
      <Authenticated>
        <ChatApp />
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
