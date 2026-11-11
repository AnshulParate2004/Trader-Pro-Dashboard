/**
 * src/lib/nyseCalendar.ts
 *
 * Strict NYSE / NASDAQ Trading Calendar Guard.
 * - Handles US Federal Market Holidays (NYSE Rule 7.2)
 * - Detects 13:00 ET Early Half-Day Closes (Black Friday, Christmas Eve, Day before July 4)
 * - Manages Daylight Saving Time (DST) automatically via America/New_York timezone
 */

export interface NyseSessionStatus {
  isTradingDay: boolean;
  sessionDate: string; // YYYY-MM-DD in America/New_York
  currentTimeET: string; // HH:MM:SS
  isEarlyClose: boolean;
  scheduledCloseTimeET: string; // "16:00" or "13:00"
  marketPhase: "PRE_MARKET" | "REGULAR_HOURS" | "POST_CLOSE" | "CLOSED_WEEKEND" | "CLOSED_HOLIDAY";
  reason?: string;
}

// Fixed or observed US Market Holidays (2025-2027)
const NYSE_HOLIDAYS_MAP: Record<string, string> = {
  // 2025
  "2025-01-01": "New Year's Day",
  "2025-01-20": "Martin Luther King Jr. Day",
  "2025-02-17": "Washington's Birthday (Presidents' Day)",
  "2025-04-18": "Good Friday",
  "2025-05-26": "Memorial Day",
  "2025-06-19": "Juneteenth National Independence Day",
  "2025-07-04": "Independence Day",
  "2025-09-01": "Labor Day",
  "2025-11-27": "Thanksgiving Day",
  "2025-12-25": "Christmas Day",
  // 2026
  "2026-01-01": "New Year's Day",
  "2026-01-19": "Martin Luther King Jr. Day",
  "2026-02-16": "Washington's Birthday (Presidents' Day)",
  "2026-04-03": "Good Friday",
  "2026-05-25": "Memorial Day",
  "2026-06-19": "Juneteenth National Independence Day",
  "2026-07-03": "Independence Day (Observed)",
  "2026-09-07": "Labor Day",
  "2026-11-26": "Thanksgiving Day",
  "2026-12-25": "Christmas Day",
  // 2027
  "2027-01-01": "New Year's Day",
  "2027-01-18": "Martin Luther King Jr. Day",
  "2027-02-15": "Washington's Birthday (Presidents' Day)",
  "2027-03-26": "Good Friday",
  "2027-05-31": "Memorial Day",
  "2027-06-18": "Juneteenth (Observed)",
  "2027-07-05": "Independence Day (Observed)",
  "2027-09-06": "Labor Day",
  "2027-11-25": "Thanksgiving Day",
  "2027-12-24": "Christmas Day (Observed)",
};

// Half-days (13:00 ET close)
const NYSE_HALF_DAYS: Record<string, string> = {
  "2025-07-03": "Day before Independence Day (13:00 Close)",
  "2025-11-28": "Day after Thanksgiving (13:00 Close)",
  "2025-12-24": "Christmas Eve (13:00 Close)",
  "2026-07-02": "Day before July 4th Observed (13:00 Close)",
  "2026-11-27": "Day after Thanksgiving (13:00 Close)",
  "2026-12-24": "Christmas Eve (13:00 Close)",
  "2027-11-26": "Day after Thanksgiving (13:00 Close)",
};

/**
 * Returns current session info according to America/New_York clock
 */
export function getNyseSessionStatus(now: Date = new Date()): NyseSessionStatus {
  // Format into America/New_York date and time strings
  const nyDateFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = nyDateFormatter.formatToParts(now);
  const year = parts.find((p) => p.type === "year")?.value || "2026";
  const month = parts.find((p) => p.type === "month")?.value || "01";
  const day = parts.find((p) => p.type === "day")?.value || "01";
  const sessionDate = `${year}-${month}-${day}`;

  const nyTimeFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const timeStr = nyTimeFormatter.format(now);
  const [hh, mm] = timeStr.split(":").map(Number);
  const currentMinutes = hh * 60 + mm;

  // Day of week in New York
  const dayOfWeekStr = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
  }).format(now);

  const isWeekend = dayOfWeekStr === "Sat" || dayOfWeekStr === "Sun";
  if (isWeekend) {
    return {
      isTradingDay: false,
      sessionDate,
      currentTimeET: timeStr,
      isEarlyClose: false,
      scheduledCloseTimeET: "16:00",
      marketPhase: "CLOSED_WEEKEND",
      reason: `Weekend (${dayOfWeekStr})`,
    };
  }

  // Check Holiday
  if (NYSE_HOLIDAYS_MAP[sessionDate]) {
    return {
      isTradingDay: false,
      sessionDate,
      currentTimeET: timeStr,
      isEarlyClose: false,
      scheduledCloseTimeET: "16:00",
      marketPhase: "CLOSED_HOLIDAY",
      reason: `Holiday: ${NYSE_HOLIDAYS_MAP[sessionDate]}`,
    };
  }

  const isEarlyClose = Boolean(NYSE_HALF_DAYS[sessionDate]);
  const closeMinutes = isEarlyClose ? 13 * 60 : 16 * 60; // 13:00 or 16:00
  const openMinutes = 9 * 60 + 30; // 09:30

  let marketPhase: NyseSessionStatus["marketPhase"] = "REGULAR_HOURS";
  if (currentMinutes < openMinutes) {
    marketPhase = "PRE_MARKET";
  } else if (currentMinutes >= closeMinutes) {
    marketPhase = "POST_CLOSE";
  }

  return {
    isTradingDay: true,
    sessionDate,
    currentTimeET: timeStr,
    isEarlyClose,
    scheduledCloseTimeET: isEarlyClose ? "13:00" : "16:00",
    marketPhase,
    reason: isEarlyClose ? NYSE_HALF_DAYS[sessionDate] : undefined,
  };
}
