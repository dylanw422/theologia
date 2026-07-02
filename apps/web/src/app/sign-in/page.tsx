import { redirect } from "next/navigation";

import AuthLayout from "@/components/auth-layout";
import SignInForm from "@/components/sign-in-form";
import styles from "@/components/auth-layout.module.css";
import { isAuthenticated } from "@/lib/auth-server";

export const metadata = {
  title: "Sign In — Theologia",
};

export default async function SignInPage() {
  if (await isAuthenticated()) redirect("/chat");

  return (
    <AuthLayout>
      <h1 className={styles.cardTitle}>Welcome back</h1>
      <SignInForm />
    </AuthLayout>
  );
}
