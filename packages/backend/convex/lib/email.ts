// Single Resend transport for all Theologia email. Pair with renderEmail
// (lib/emailTemplate.ts) for the shared branded layout. Throws on a non-2xx so
// callers see delivery failures rather than silently dropping mail.

export type SendEmailArgs = {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Override the default sender; domain must be verified in Resend. */
  from?: string;
};

const DEFAULT_FROM = "Theologia <hello@theologia.app>";

export async function sendEmail(args: SendEmailArgs): Promise<void> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: args.from ?? DEFAULT_FROM,
      to: args.to,
      subject: args.subject,
      html: args.html,
      text: args.text,
    }),
  });
  if (!res.ok) {
    throw new Error(`Resend failed: ${res.status} ${await res.text()}`);
  }
}
