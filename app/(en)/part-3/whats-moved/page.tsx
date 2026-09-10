import type { Metadata } from "next";

import { Part3Map } from "@/components/reading/part3-map";

export const metadata: Metadata = {
  title: "Part 3 — what moved — Building Relay",
  description:
    "Part 3 was regrouped into eight movements and renumbered from 24 chapters to 26. " +
    "Every old address redirects; this page says what each old number means now.",
  alternates: {
    canonical: "/part-3/whats-moved",
    languages: {
      en: "/part-3/whats-moved",
      vi: "/vi/part-3/whats-moved",
    },
  },
};

export default function WhatsMoved() {
  return <Part3Map locale="en" />;
}
