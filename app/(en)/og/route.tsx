import { ImageResponse } from "next/og";

// The one series preview image (1200×630), served at /og and declared as
// og:image/twitter:image via the shared metadata in lib/seo.ts — the ONLY
// image source on the site (feature 010, research R4). Colors are static hex
// approximations of the Violet Bloom palette (the image cannot read CSS tokens).
export const dynamic = "force-static";

export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "linear-gradient(135deg, #17121f 0%, #2b1e45 100%)",
        }}
      >
        <div
          style={{
            fontSize: 26,
            color: "#a78bfa",
            letterSpacing: 6,
            textTransform: "uppercase",
          }}
        >
          A build-it-yourself tutorial series
        </div>
        <div
          style={{
            fontSize: 100,
            fontWeight: 700,
            color: "#f5f3ff",
            marginTop: 18,
          }}
        >
          Building Relay
        </div>
        <div style={{ fontSize: 34, color: "#c4b5fd", marginTop: 26 }}>
          Chat infrastructure, decided out loud — English · Tiếng Việt
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
