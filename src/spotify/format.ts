export function formatArtists(artists: readonly { readonly name: string }[]): string {
  return artists.map((a) => a.name).join(", ");
}

export function formatDuration(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

const COUNT_UNITS = ["", "K", "M", "B", "T"] as const;

export function formatCount(n: number, precision = 2): string {
  const digits = String(Math.trunc(Math.abs(n))).length;
  const unit = Math.min(Math.floor((digits - 1) / 3), COUNT_UNITS.length - 1);
  return `${(n / 10 ** (unit * 3)).toFixed(precision)}${COUNT_UNITS[unit] ?? ""}`;
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export type ReleaseDatePrecision = "year" | "month" | "day";

export function formatReleaseDate(date: string, precision: ReleaseDatePrecision): string {
  const [year = "", month = "", day = ""] = date.split("-");
  const monthName = MONTHS[Number(month) - 1] ?? month;
  switch (precision) {
    case "year":
      return year;
    case "month":
      return `${monthName} ${year}`;
    case "day":
      return `${monthName} ${Number(day)}, ${year}`;
    default: {
      const exhaustive: never = precision;
      throw new Error(`unhandled precision: ${String(exhaustive)}`);
    }
  }
}
