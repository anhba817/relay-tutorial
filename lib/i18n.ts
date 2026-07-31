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
    onThisPage: string;
    referenceDocs: string;
    openNav: string;
    closeNav: string;
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
  suggest: {
    // The select-and-suggest capture flow (feature 015).
    action: string;
    dialogTitle: string;
    selectedLabel: string;
    placeholder: string;
    counter: string; // {n} = characters remaining
    submit: string;
    cancel: string;
    submitting: string;
    thanks: string;
    errorInvalid: string;
    errorTooLong: string;
    errorRate: string;
    errorOffline: string;
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
      onThisPage: "On this page",
      referenceDocs: "Reference documents",
      openNav: "Series contents",
      closeNav: "Close contents",
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
    suggest: {
      action: "Suggest an improvement",
      dialogTitle: "Suggest an improvement",
      selectedLabel: "Selected text",
      placeholder: "What would make this passage better?",
      counter: "{n} characters left",
      submit: "Send suggestion",
      cancel: "Cancel",
      submitting: "Sending…",
      thanks: "Thank you — suggestion received!",
      errorInvalid: "That didn't go through — check the suggestion and try again.",
      errorTooLong: "The selection or suggestion is too long — try a shorter passage.",
      errorRate: "That's a lot of suggestions at once — please wait a minute and try again.",
      errorOffline: "We couldn't save your suggestion right now. Please try again later.",
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
      onThisPage: "Trên trang này",
      referenceDocs: "Tài liệu tham khảo",
      openNav: "Mục lục loạt bài",
      closeNav: "Đóng mục lục",
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
    suggest: {
      action: "Góp ý cải thiện",
      dialogTitle: "Góp ý cải thiện",
      selectedLabel: "Đoạn bạn đã chọn",
      placeholder: "Theo bạn, đoạn này nên viết lại thế nào?",
      counter: "còn {n} ký tự",
      submit: "Gửi góp ý",
      cancel: "Hủy",
      submitting: "Đang gửi…",
      thanks: "Cảm ơn bạn — góp ý đã được ghi nhận!",
      errorInvalid: "Gửi chưa thành công — bạn kiểm tra lại nội dung rồi thử lần nữa nhé.",
      errorTooLong: "Đoạn chọn hoặc phần góp ý dài quá — bạn thử chọn một đoạn ngắn hơn.",
      errorRate: "Bạn gửi hơi dồn dập — chờ một phút rồi gửi tiếp nhé.",
      errorOffline: "Hiện chưa lưu được góp ý của bạn. Bạn quay lại thử sau nhé.",
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
