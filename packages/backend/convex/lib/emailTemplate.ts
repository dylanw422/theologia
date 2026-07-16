// Shared email layout for every Theologia email. Callers supply only the body
// content (heading, paragraphs, an optional button); the branded chrome —
// parchment canvas, gold wordmark, footer — stays identical across all mail.
//
// Email HTML constraints drive the choices here: table-based layout, inline
// styles, web-safe fonts (Georgia for the serif brand voice, Arial for body),
// and a light "parchment" palette that survives Gmail/Outlook dark mode. Custom
// fonts (Fraunces/Inter) don't load reliably in mail, so we evoke them with
// system serifs.

export type EmailButton = { label: string; url: string };

export type EmailContent = {
  /** Hidden inbox-preview text shown next to the subject in most clients. */
  preheader?: string;
  heading: string;
  /** Body copy; each entry becomes its own paragraph. */
  paragraphs: string[];
  button?: EmailButton;
};

export type RenderedEmail = { html: string; text: string };

const COLORS = {
  canvas: "#e4d7bd", // outer parchment
  card: "#f6efdf", // inner card, lighter parchment
  ink: "#3a2e1e", // body text
  headline: "#1c1305", // headings + wordmark
  gold: "#c9a24e", // accents + button
  goldDeep: "#a8823a", // rules / dividers
  muted: "#8a7a5c", // footer + fine print
};

const SERIF = "Georgia, 'Times New Roman', Times, serif";
const SANS = "Arial, Helvetica, sans-serif";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function renderParagraphs(paragraphs: string[]): string {
  return paragraphs
    .map(
      (p) =>
        `<p style="margin:0 0 18px;font-family:${SANS};font-size:16px;line-height:1.62;color:${COLORS.ink};">${escapeHtml(
          p,
        )}</p>`,
    )
    .join("");
}

function renderButton(button: EmailButton): string {
  const label = escapeHtml(button.label);
  // Bulletproof-ish: a padded anchor. Outlook drops the radius but keeps the
  // solid gold block. A muted fallback link handles clients that mangle the CTA.
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 10px;">
      <tr>
        <td align="center" bgcolor="${COLORS.gold}" style="border-radius:3px;">
          <a href="${button.url}" target="_blank"
             style="display:inline-block;padding:14px 30px;font-family:${SANS};font-size:15px;font-weight:bold;letter-spacing:0.02em;color:${COLORS.headline};text-decoration:none;border-radius:3px;">
            ${label}
          </a>
        </td>
      </tr>
    </table>
    <p style="margin:6px 0 0;font-family:${SANS};font-size:12px;line-height:1.5;color:${COLORS.muted};">
      If the button doesn&#39;t work, paste this link into your browser:<br />
      <a href="${button.url}" target="_blank" style="color:${COLORS.goldDeep};word-break:break-all;">${escapeHtml(
        button.url,
      )}</a>
    </p>`;
}

export function renderEmail(content: EmailContent): RenderedEmail {
  const preheader = content.preheader
    ? `<span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;mso-hide:all;">${escapeHtml(
        content.preheader,
      )}</span>`
    : "";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light only" />
  <meta name="supported-color-schemes" content="light" />
  <title>Theologia</title>
</head>
<body style="margin:0;padding:0;background-color:${COLORS.canvas};">
  ${preheader}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${COLORS.canvas};">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;">
          <!-- Wordmark -->
          <tr>
            <td align="center" style="padding:8px 0 26px;">
              <span style="font-family:${SERIF};font-size:22px;letter-spacing:0.34em;text-transform:uppercase;color:${COLORS.headline};">Theologia</span>
              <div style="width:46px;height:2px;margin:14px auto 0;background-color:${COLORS.gold};"></div>
            </td>
          </tr>
          <!-- Card -->
          <tr>
            <td style="background-color:${COLORS.card};border-radius:6px;padding:44px 44px 40px;">
              <h1 style="margin:0 0 20px;font-family:${SERIF};font-weight:normal;font-size:30px;line-height:1.15;color:${COLORS.headline};">${escapeHtml(
                content.heading,
              )}</h1>
              ${renderParagraphs(content.paragraphs)}
              ${content.button ? renderButton(content.button) : ""}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td align="center" style="padding:26px 16px 8px;">
              <p style="margin:0;font-family:${SANS};font-size:12px;line-height:1.6;color:${COLORS.muted};">
                Theologia — study theology with the whole church in the room.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const textParts = [
    content.heading,
    "",
    ...content.paragraphs,
  ];
  if (content.button) {
    textParts.push("", `${content.button.label}: ${content.button.url}`);
  }
  textParts.push(
    "",
    "—",
    "Theologia — study theology with the whole church in the room.",
  );
  const text = textParts.join("\n");

  return { html, text };
}
