"use client";
import { useForm } from "@tanstack/react-form";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import z from "zod";

import { authClient } from "@/lib/auth-client";
import { api } from "@theologia/backend/convex/_generated/api";
import { useConvexAuth, useMutation } from "convex/react";

import FrameworkPicker from "./chat/framework-picker";
import styles from "./auth-form.module.css";

export default function SignUpForm() {
  const router = useRouter();
  const { isAuthenticated } = useConvexAuth();
  const setDefaultFramework = useMutation(api.userPreferences.setDefaultFramework);
  const [pendingFramework, setPendingFramework] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !pendingFramework) return;
    const framework = pendingFramework;
    setPendingFramework(null);
    setDefaultFramework({ framework }).catch(() => {
      toast.warning(
        "Account created, but we couldn't save your tradition — set it on your profile page.",
      );
    });
    router.push("/chat");
    toast.success("Account created");
  }, [isAuthenticated, pendingFramework, setDefaultFramework, router]);

  const form = useForm({
    defaultValues: { name: "", email: "", password: "", tradition: "" },
    onSubmit: async ({ value }) => {
      await authClient.signUp.email(
        { email: value.email, password: value.password, name: value.name },
        {
          onSuccess: () => {
            setPendingFramework(value.tradition);
          },
          onError: (error) => {
            toast.error(error.error.message || error.error.statusText);
          },
        },
      );
    },
    validators: {
      onSubmit: z.object({
        name: z.string().min(2, "Name must be at least 2 characters"),
        email: z.email("Invalid email address"),
        password: z.string().min(8, "Password must be at least 8 characters"),
        tradition: z.string().min(1, "Choose a tradition"),
      }),
    },
  });

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
      }}
    >
      <form.Field name="name">
        {(field) => (
          <div className={styles.field}>
            <label htmlFor={field.name} className={styles.label}>Name</label>
            <input
              id={field.name}
              name={field.name}
              type="text"
              autoComplete="name"
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
              className={styles.input}
              placeholder="Your name"
            />
            {field.state.meta.errors.map((error) => (
              <p key={error?.message} className={styles.error}>{error?.message}</p>
            ))}
          </div>
        )}
      </form.Field>

      <form.Field name="email">
        {(field) => (
          <div className={styles.field}>
            <label htmlFor={field.name} className={styles.label}>Email</label>
            <input
              id={field.name}
              name={field.name}
              type="email"
              autoComplete="email"
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
              className={styles.input}
              placeholder="you@example.com"
            />
            {field.state.meta.errors.map((error) => (
              <p key={error?.message} className={styles.error}>{error?.message}</p>
            ))}
          </div>
        )}
      </form.Field>

      <form.Field name="password">
        {(field) => (
          <div className={styles.field}>
            <label htmlFor={field.name} className={styles.label}>Password</label>
            <input
              id={field.name}
              name={field.name}
              type="password"
              autoComplete="new-password"
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
              className={styles.input}
              placeholder="••••••••"
            />
            {field.state.meta.errors.map((error) => (
              <p key={error?.message} className={styles.error}>{error?.message}</p>
            ))}
          </div>
        )}
      </form.Field>

      <form.Field name="tradition">
        {(field) => (
          <div className={styles.field}>
            <label htmlFor={field.name} className={styles.label}>Tradition</label>
            <FrameworkPicker
              framework={field.state.value}
              onFrameworkChange={(id) => field.handleChange(id)}
            />
            {field.state.meta.errors.map((error) => (
              <p key={error?.message} className={styles.error}>{error?.message}</p>
            ))}
          </div>
        )}
      </form.Field>

      <form.Subscribe
        selector={(state) => ({ canSubmit: state.canSubmit, isSubmitting: state.isSubmitting })}
      >
        {({ canSubmit, isSubmitting }) => (
          <button
            type="submit"
            className={styles.btnPrimary}
            disabled={!canSubmit || isSubmitting}
          >
            {isSubmitting ? "Creating account…" : "Create Account"}
          </button>
        )}
      </form.Subscribe>

      <p className={styles.switchText}>
        Already have an account?
        <Link href="/sign-in" className={styles.switchLink}>Sign in</Link>
      </p>
    </form>
  );
}
