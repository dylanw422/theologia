import AuthLayout from "@/components/auth-layout";
import SignUpForm from "@/components/sign-up-form";
import styles from "@/components/auth-layout.module.css";

export const metadata = {
  title: "Create Account — Theologia",
};

export default function SignUpPage() {
  return (
    <AuthLayout>
      <h1 className={styles.cardTitle}>Create account</h1>
      <SignUpForm />
    </AuthLayout>
  );
}
