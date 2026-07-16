import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";

export const ogImageSize = { width: 1200, height: 630 } as const;
export const ogImageContentType = "image/png";
export const ogImageAlt =
  "Theologia — Study theology with the whole church in the room.";

const FRAMEWORKS =
  "REFORMED · LUTHERAN · WESLEYAN · ROMAN CATHOLIC · EASTERN ORTHODOX · BAPTIST +6 more";

// Google's CSS2 API returns a single subsetted @font-face (one url) when a
// `text` param is passed, which keeps the fetched font file small and the
// regex below simple.
async function loadGoogleFont(family: string, text: string, variant: string) {
  const css = await fetch(
    `https://fonts.googleapis.com/css2?family=${encodeURIComponent(`${family}:${variant}`)}&text=${encodeURIComponent(text)}`,
  ).then((res) => res.text());
  const url = css.match(/src: url\(([^)]+)\)/)?.[1];
  if (!url) throw new Error(`Could not resolve font URL for ${family}`);
  const res = await fetch(url);
  return res.arrayBuffer();
}

export async function renderOgImage() {
  const headline1 = "Study theology with";
  const headline2 = "the whole church";
  const headline3 = "in the room.";
  const eyebrow = "For serious students of theology";
  const fontText = `Theologia${headline1}${headline2}${headline3}${eyebrow}An AI Study Environment${FRAMEWORKS}`;

  // Fraunces is an optical-size variable font — the hero page renders it
  // with `font-optical-sizing: auto`, which resolves the `opsz` axis to
  // roughly the element's own font-size in px (clamped to the font's
  // 9..144 range). Satori has no such auto-resolution and no way to
  // vary an axis per element from a single registered font, so each
  // distinct on-screen size needs its own opsz-pinned fetch.
  //
  // Also pin SOFT/WONK: Google's CSS2 endpoint resolves unmentioned
  // axes to 0, not the font's authored defaults (SOFT=0, WONK=1).
  //
  // IMPORTANT: there is deliberately NO italic Fraunces here. The hero
  // page loads Fraunces via next/font without style:["italic"], so its
  // served CSS contains only font-style:normal faces — the headline's
  // <em> ("the whole church") is a browser-SYNTHESIZED oblique: roman
  // letterforms slanted ~14°, not the true Fraunces Italic (whose
  // cursive letterforms look like a different typeface). To match the
  // hero, the em line below uses this roman font plus a skewX
  // transform that emulates the browser's synthetic oblique.
  const [fresco, frauncesDisplayRoman, frauncesDisplayEm, frauncesWordmark, mono] =
    await Promise.all([
      readFile(path.join(process.cwd(), "public/school-of-athens.jpg")),
      loadGoogleFont("Fraunces", fontText, "opsz,wght,SOFT,WONK@76,400,0,1"),
      // The em line is roman too (see above), at the hero's
      // `.headline em` font-weight of 400.
      loadGoogleFont("Fraunces", fontText, "opsz,wght,SOFT,WONK@76,400,0,1"),
      loadGoogleFont("Fraunces", fontText, "opsz,wght,SOFT,WONK@32,500,0,1"),
      loadGoogleFont("Geist Mono", fontText, "wght@600"),
    ]);
  const frescoSrc = `data:image/jpeg;base64,${fresco.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          position: "relative",
          backgroundColor: "#0b0805",
        }}
      >
        <img
          src={frescoSrc}
          width={ogImageSize.width}
          height={ogImageSize.height}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            objectFit: "cover",
            objectPosition: "center 20%",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: "flex",
            backgroundImage:
              "linear-gradient(100deg, rgba(11,8,5,0.96) 0%, rgba(11,8,5,0.62) 38%, rgba(11,8,5,0.3) 68%, rgba(11,8,5,0.6) 100%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: "flex",
            backgroundImage:
              "linear-gradient(180deg, rgba(11,8,5,0.3) 0%, rgba(11,8,5,0) 26%, rgba(11,8,5,0.12) 55%, rgba(11,8,5,0.82) 100%)",
          }}
        />

        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            width: "100%",
            height: "100%",
            padding: "54px 64px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div
              style={{
                display: "flex",
                fontFamily: "FrauncesText",
                fontSize: 32,
                color: "#f1e8d6",
              }}
            >
              Theologia
            </div>
            <div
              style={{
                display: "flex",
                fontFamily: "Geist Mono",
                fontSize: 15,
                letterSpacing: 3,
                textTransform: "uppercase",
                color: "#c9a24e",
              }}
            >
              An AI Study Environment
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", maxWidth: 940 }}>
            <div
              style={{
                display: "flex",
                fontFamily: "Geist Mono",
                fontSize: 16,
                letterSpacing: 4,
                textTransform: "uppercase",
                color: "#c9a24e",
                marginBottom: 18,
              }}
            >
              {eyebrow}
            </div>
            <div
              style={{
                display: "flex",
                fontFamily: "FrauncesDisplay",
                fontWeight: 400,
                fontSize: 74,
                lineHeight: 1.05,
                color: "#f1e8d6",
              }}
            >
              {headline1}
            </div>
            <div
              style={{
                display: "flex",
                fontFamily: "FrauncesDisplayEm",
                fontWeight: 400,
                // Mimic the hero's synthesized italic: Chromium fakes
                // font-style:italic (when no italic face exists) by
                // slanting roman glyphs ~14° — same angle as the CSS
                // default for `font-style: oblique`.
                transform: "skewX(-14deg)",
                fontSize: 74,
                lineHeight: 1.05,
                color: "#e6c984",
              }}
            >
              {headline2}
            </div>
            <div
              style={{
                display: "flex",
                fontFamily: "FrauncesDisplay",
                fontWeight: 400,
                fontSize: 74,
                lineHeight: 1.05,
                color: "#f1e8d6",
              }}
            >
              {headline3}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              fontFamily: "Geist Mono",
              fontSize: 15,
              letterSpacing: 2,
              color: "#b9a886",
            }}
          >
            {FRAMEWORKS}
          </div>
        </div>
      </div>
    ),
    {
      ...ogImageSize,
      fonts: [
        { name: "FrauncesDisplay", data: frauncesDisplayRoman, weight: 400, style: "normal" },
        { name: "FrauncesDisplayEm", data: frauncesDisplayEm, weight: 400, style: "normal" },
        { name: "FrauncesText", data: frauncesWordmark, weight: 500, style: "normal" },
        { name: "Geist Mono", data: mono, weight: 600, style: "normal" },
      ],
    },
  );
}
