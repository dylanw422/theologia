import AuthLayout from "@/components/auth-layout";
import SignInForm from "@/components/sign-in-form";
import styles from "@/components/auth-layout.module.css";

export const metadata = {
  title: "Sign In — Theologia",
};

export default function SignInPage() {
  return (
    <AuthLayout>
      <h1 className={styles.cardTitle}>Welcome back</h1>
      <SignInForm />
    </AuthLayout>
  );
}
