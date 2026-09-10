import type { NextConfig } from "next";
import createMDX from "@next/mdx";

const nextConfig: NextConfig = {
  pageExtensions: ["ts", "tsx", "md", "mdx"],
  // Minimal production server for the Docker image (docker-compose.yml).
  output: "standalone",
  async redirects() {
    // THE RENUMBERED PART-3 ADDRESSES, DERIVED FROM `chapter-map.json`.
    //
    // Twenty-one moved addresses, two locales, forty-two permanent redirects. The
    // map's `was_url` is the source; `check-redirects.py` compares this block with it
    // and fails on a drift in either direction, so this is generated rather than kept.
    //
    // NOT 48, WHICH THE TASK ASKED FOR. That was 24 old chapters times two locales,
    // and three of the 24 kept their address exactly — chapters 1, 2 and 7. A redirect
    // whose source equals its destination is a loop, so the arithmetic would have
    // shipped three of them.
    //
    // PERMANENT, because the old numbers are never coming back: a chapter's position
    // is what this feature removed from every reference in the series.
    return [
      { source: "/part-3/chapter-03/the-outbox", destination: "/part-3/chapter-05/the-outbox", permanent: true },
      { source: "/vi/part-3/chapter-03/the-outbox", destination: "/vi/part-3/chapter-05/the-outbox", permanent: true },
      { source: "/part-3/chapter-04/jetstream-and-the-first-consumer", destination: "/part-3/chapter-06/jetstream-and-the-first-consumer", permanent: true },
      { source: "/vi/part-3/chapter-04/jetstream-and-the-first-consumer", destination: "/vi/part-3/chapter-06/jetstream-and-the-first-consumer", permanent: true },
      { source: "/part-3/chapter-13/the-endpoints-and-the-instruments", destination: "/part-3/chapter-08/the-endpoints-and-the-instruments", permanent: true },
      { source: "/vi/part-3/chapter-13/the-endpoints-and-the-instruments", destination: "/vi/part-3/chapter-08/the-endpoints-and-the-instruments", permanent: true },
      { source: "/part-3/chapter-15/the-channel-a-customer-controls", destination: "/part-3/chapter-09/the-channel-a-customer-controls", permanent: true },
      { source: "/vi/part-3/chapter-15/the-channel-a-customer-controls", destination: "/vi/part-3/chapter-09/the-channel-a-customer-controls", permanent: true },
      { source: "/part-3/chapter-16/what-a-user-sees", destination: "/part-3/chapter-10/what-a-user-sees", permanent: true },
      { source: "/vi/part-3/chapter-16/what-a-user-sees", destination: "/vi/part-3/chapter-10/what-a-user-sees", permanent: true },
      { source: "/part-3/chapter-17/the-sender-a-message-never-had", destination: "/part-3/chapter-11/the-sender-a-message-never-had", permanent: true },
      { source: "/vi/part-3/chapter-17/the-sender-a-message-never-had", destination: "/vi/part-3/chapter-11/the-sender-a-message-never-had", permanent: true },
      { source: "/part-3/chapter-18/the-message-that-never-arrived", destination: "/part-3/chapter-12/the-message-that-never-arrived", permanent: true },
      { source: "/vi/part-3/chapter-18/the-message-that-never-arrived", destination: "/vi/part-3/chapter-12/the-message-that-never-arrived", permanent: true },
      { source: "/part-3/chapter-19/who-is-allowed-to-see-it", destination: "/part-3/chapter-13/who-is-allowed-to-see-it", permanent: true },
      { source: "/vi/part-3/chapter-19/who-is-allowed-to-see-it", destination: "/vi/part-3/chapter-13/who-is-allowed-to-see-it", permanent: true },
      { source: "/part-3/chapter-20/the-membership-that-changed", destination: "/part-3/chapter-14/the-membership-that-changed", permanent: true },
      { source: "/vi/part-3/chapter-20/the-membership-that-changed", destination: "/vi/part-3/chapter-14/the-membership-that-changed", permanent: true },
      { source: "/part-3/chapter-21/the-frame-nobody-may-send", destination: "/part-3/chapter-15/the-frame-nobody-may-send", permanent: true },
      { source: "/vi/part-3/chapter-21/the-frame-nobody-may-send", destination: "/vi/part-3/chapter-15/the-frame-nobody-may-send", permanent: true },
      { source: "/part-3/chapter-22/the-sixth-connection", destination: "/part-3/chapter-16/the-sixth-connection", permanent: true },
      { source: "/vi/part-3/chapter-22/the-sixth-connection", destination: "/vi/part-3/chapter-16/the-sixth-connection", permanent: true },
      { source: "/part-3/chapter-23/the-words-somebody-wants-back", destination: "/part-3/chapter-17/the-words-somebody-wants-back", permanent: true },
      { source: "/vi/part-3/chapter-23/the-words-somebody-wants-back", destination: "/vi/part-3/chapter-17/the-words-somebody-wants-back", permanent: true },
      { source: "/part-3/chapter-24/the-message-that-is-not-only-text", destination: "/part-3/chapter-18/the-message-that-is-not-only-text", permanent: true },
      { source: "/vi/part-3/chapter-24/the-message-that-is-not-only-text", destination: "/vi/part-3/chapter-18/the-message-that-is-not-only-text", permanent: true },
      { source: "/part-3/chapter-05/webhooks-that-survive-the-customer", destination: "/part-3/chapter-19/webhooks-that-survive-the-customer", permanent: true },
      { source: "/vi/part-3/chapter-05/webhooks-that-survive-the-customer", destination: "/vi/part-3/chapter-19/webhooks-that-survive-the-customer", permanent: true },
      { source: "/part-3/chapter-06/when-to-stop-trying", destination: "/part-3/chapter-20/when-to-stop-trying", permanent: true },
      { source: "/vi/part-3/chapter-06/when-to-stop-trying", destination: "/vi/part-3/chapter-20/when-to-stop-trying", permanent: true },
      { source: "/part-3/chapter-09/the-email-nobody-was-sending", destination: "/part-3/chapter-21/the-email-nobody-was-sending", permanent: true },
      { source: "/vi/part-3/chapter-09/the-email-nobody-was-sending", destination: "/vi/part-3/chapter-21/the-email-nobody-was-sending", permanent: true },
      { source: "/part-3/chapter-08/limits-you-can-see-coming", destination: "/part-3/chapter-22/limits-you-can-see-coming", permanent: true },
      { source: "/vi/part-3/chapter-08/limits-you-can-see-coming", destination: "/vi/part-3/chapter-22/limits-you-can-see-coming", permanent: true },
      { source: "/part-3/chapter-10/quotas-and-what-they-cost", destination: "/part-3/chapter-23/quotas-and-what-they-cost", permanent: true },
      { source: "/vi/part-3/chapter-10/quotas-and-what-they-cost", destination: "/vi/part-3/chapter-23/quotas-and-what-they-cost", permanent: true },
      { source: "/part-3/chapter-11/counting-a-connection", destination: "/part-3/chapter-24/counting-a-connection", permanent: true },
      { source: "/vi/part-3/chapter-11/counting-a-connection", destination: "/vi/part-3/chapter-24/counting-a-connection", permanent: true },
      { source: "/part-3/chapter-12/milestone-the-isolation-gauntlet", destination: "/part-3/chapter-25/milestone-the-isolation-gauntlet", permanent: true },
      { source: "/vi/part-3/chapter-12/milestone-the-isolation-gauntlet", destination: "/vi/part-3/chapter-25/milestone-the-isolation-gauntlet", permanent: true },
      { source: "/part-3/chapter-14/errors-that-resolve-and-an-outsider", destination: "/part-3/chapter-26/errors-that-resolve-and-an-outsider", permanent: true },
      { source: "/vi/part-3/chapter-14/errors-that-resolve-and-an-outsider", destination: "/vi/part-3/chapter-26/errors-that-resolve-and-an-outsider", permanent: true },
    ];
  },
};

const withMDX = createMDX({
  options: {
    // String form + serializable options: required by Turbopack. Dual shiki
    // themes ride the site's light/dark switch via CSS in globals.css.
    //
    // GFM is not on by default: @mdx-js parses CommonMark, in which a pipe
    // table is just a paragraph full of pipes. Chapters 3.4 and 3.5 have real
    // tables, so the extension has to be asked for. remark-gfm was already a
    // dependency here — the reference-doc renderer (components/docs/doc-article
    // .tsx) passes it to react-markdown, which is why /docs tables rendered and
    // chapter tables did not.
    remarkPlugins: ["remark-gfm"],
    rehypePlugins: [
      [
        "rehype-pretty-code",
        {
          theme: { light: "github-light", dark: "github-dark" },
          keepBackground: false,
        },
      ],
    ],
  },
});

export default withMDX(nextConfig);
