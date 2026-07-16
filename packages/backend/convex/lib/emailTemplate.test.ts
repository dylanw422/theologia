import { describe, expect, test } from "vitest";

import { renderEmail } from "./emailTemplate";

describe("renderEmail", () => {
  test("wraps the body content in the branded layout", () => {
    const { html } = renderEmail({
      heading: "You're in.",
      paragraphs: ["Welcome to the beta."],
      button: { label: "Enter Theologia", url: "https://theologia.app/x" },
    });

    // Shared chrome
    expect(html).toContain("Theologia");
    expect(html).toMatch(/^<!DOCTYPE html>/i);
    // Body content
    expect(html).toContain("You're in.");
    expect(html).toContain("Welcome to the beta.");
    // Button
    expect(html).toContain("Enter Theologia");
    expect(html).toContain('href="https://theologia.app/x"');
  });

  test("renders multiple paragraphs as separate blocks", () => {
    const { html } = renderEmail({
      heading: "Hi",
      paragraphs: ["First line.", "Second line."],
    });

    expect(html).toContain("First line.");
    expect(html).toContain("Second line.");
  });

  test("produces a plaintext alternative with heading, body, and link", () => {
    const { text } = renderEmail({
      heading: "You're in.",
      paragraphs: ["Welcome to the beta."],
      button: { label: "Enter Theologia", url: "https://theologia.app/x" },
    });

    expect(text).toContain("You're in.");
    expect(text).toContain("Welcome to the beta.");
    expect(text).toContain("https://theologia.app/x");
    expect(text).not.toContain("<");
  });

  test("escapes HTML in caller-supplied content", () => {
    const { html } = renderEmail({
      heading: "Hi <there>",
      paragraphs: ["Tags & <script>alert(1)</script> should be inert."],
    });

    expect(html).toContain("Hi &lt;there&gt;");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>alert(1)</script>");
  });

  test("omits the button block when no button is given", () => {
    const { html } = renderEmail({
      heading: "No CTA",
      paragraphs: ["Just text."],
    });

    expect(html).not.toContain("paste this link");
    expect(html).toContain("Just text.");
  });
});
