"use client";
import { useForm } from "@tanstack/react-form";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import z from "zod";

import { authClient } from "@/lib/auth-client";
import styles from "./auth-form.module.css";

export default function SignUpForm() {
  const router = useRouter();

  const form = useForm({
    defaultValues: { name: "", email: "", password: "" },
    onSubmit: async ({ value }) => {
      await authClient.signUp.email(
        { email: value.email, password: value.password, name: value.name },
        {
          onSuccess: () => {
            router.push("/dashboard");
            toast.success("Account created");
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
      }),
    },
  });

  return (
    <form
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
