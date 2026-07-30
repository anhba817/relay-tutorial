// The single source of every reader-facing chrome string, in both locales.
// Components never hardcode reader-facing text — they call t(locale).
// English routes are unprefixed; Vietnamese mirrors them under /vi (feature 004).

export type Locale = "en" | "vi";

export const locales: Locale[] = ["en", "vi"];

export const defaultLocale: Locale = "en";

export interface Dictionary {
  landing: {
    badge: string;
    pitch: string;
    roadAhead: string;
    youWillProduce: string;
  };
  shell: {
    part: string;
    chapter: string;
    youWillProduce: string;
    minutesNote: (minutes: number) => string;
    previous: string;
    next: string;
    backToContents: string;
    sourceDocs: string;
    contents: string;
    referencedBy: string;
  };
  badges: {
    forthcoming: string;
    englishOnly: string;
    englishDoc: string;
  };
  boxes: {
    why: string;
    trap: string;
    checkpoint: string;
    skipAhead: string;
    revised: string;
    forwardRef: string;
  };
  hint: {
    // Shown on the OTHER locale's landing, so it is written in THIS locale.
    readInThisLanguage: string;
    dismiss: string;
  };
  switcher: {
    // Accessible label for the link that switches TO this locale.
    switchToThisLanguage: string;
    label: string;
  };
}

export const dictionaries: Record<Locale, Dictionary> = {
  en: {
    landing: {
      badge: "a written tutorial series",
      pitch:
        "Build a real-time chat platform company from an empty directory — specs, code, deployment, and monitoring included.",
      roadAhead: "The road ahead",
      youWillProduce: "You will produce",
    },
    shell: {
      part: "Part",
      chapter: "Chapter",
      youWillProduce: "You will produce",
      minutesNote: (minutes) => `about ${minutes} minutes including the exercise`,
      previous: "Previous",
      next: "Next",
      backToContents: "← Back to the table of contents",
      sourceDocs: "Source",
      contents: "Contents",
      referencedBy: "Referenced in",
    },
    badges: {
      forthcoming: "forthcoming",
      englishOnly: "available in English only",
      englishDoc: "English",
    },
    boxes: {
      why: "Why",
      trap: "Trap",
      checkpoint: "Checkpoint",
      skipAhead: "Skip ahead",
      revised: "Revised",
      forwardRef: "Forward reference",
    },
    hint: {
      readInThisLanguage: "Read in English →",
      dismiss: "Dismiss",
    },
    switcher: {
      switchToThisLanguage: "Switch to English",
      label: "EN",
    },
  },
  vi: {
    landing: {
      badge: "một loạt bài hướng dẫn dạng viết",
      pitch:
        "Xây dựng một công ty nền tảng chat thời gian thực từ một thư mục trống — bao gồm đặc tả, mã nguồn, triển khai và giám sát.",
      roadAhead: "Chặng đường phía trước",
      youWillProduce: "Bạn sẽ tạo ra",
    },
    shell: {
      part: "Phần",
      chapter: "Chương",
      youWillProduce: "Bạn sẽ tạo ra",
      minutesNote: (minutes) => `khoảng ${minutes} phút, bao gồm bài tập`,
      previous: "Trước",
      next: "Tiếp theo",
      backToContents: "← Về mục lục",
      sourceDocs: "Tài liệu gốc",
      contents: "Mục lục",
      referencedBy: "Được tham chiếu trong",
    },
    badges: {
      forthcoming: "sắp ra mắt",
      englishOnly: "hiện chỉ có bản tiếng Anh",
      englishDoc: "tiếng Anh",
    },
    boxes: {
      why: "Tại sao",
      trap: "Cạm bẫy",
      checkpoint: "Điểm kiểm tra",
      skipAhead: "Đọc lướt",
      revised: "Đã cập nhật",
      forwardRef: "Tham chiếu phía trước",
    },
    hint: {
      readInThisLanguage: "Đọc bằng tiếng Việt →",
      dismiss: "Đóng",
    },
    switcher: {
      switchToThisLanguage: "Chuyển sang tiếng Việt",
      label: "VI",
    },
  },
};

export function t(locale: Locale): Dictionary {
  return dictionaries[locale];
}

/** `/vi` prefix decides the locale — no negotiation, no detection. */
export function localeFromPath(path: string): Locale {
  return path === "/vi" || path.startsWith("/vi/") ? "vi" : "en";
}

/** Prefix (or keep) a path for the given locale. */
export function localePath(locale: Locale, path: string): string {
  if (locale === "en") return path;
  return path === "/" ? "/vi" : `/vi${path}`;
}

/** The same logical page in the other locale — a pure prefix add/strip. */
export function counterpartPath(path: string): string {
  if (localeFromPath(path) === "vi") {
    const stripped = path.slice(3);
    return stripped === "" ? "/" : stripped;
  }
  return localePath("vi", path);
}
