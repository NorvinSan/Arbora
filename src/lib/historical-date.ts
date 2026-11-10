// Date is a historical string, not a JS Date (which cannot represent all years
// and loses precision for dates recorded only as year or month).
export function isValidHistoricalDate(value: string, fullDate = false) {
  if (!value) return true;
  const match = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/.exec(value);
  if (!match || (fullDate && !match[3])) return false;
  const year = Number(match[1]);
  const month = match[2] ? Number(match[2]) : null;
  const day = match[3] ? Number(match[3]) : null;
  if (year < 1 || (month !== null && (month < 1 || month > 12))) return false;
  if (day === null) return true;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return month !== null && day >= 1 && day <= days[month - 1];
}

export type DateQualifier = "exact" | "approximate" | "before" | "after";

export function historicalDateParts(date: string, qualifier: DateQualifier) {
  const [year, month, day] = date ? date.split("-").map(Number) : [];
  return { year: year ?? null, month: month ?? null, day: day ?? null, qualifier: year ? qualifier : null };
}

export function formatHistoricalDate(year: number | null, month: number | null, day: number | null, qualifier: string | null) {
  if (year === null) return "Fecha desconocida";
  const value = [day, month].filter((part) => part !== null).map((part) => String(part).padStart(2, "0"))
    .concat(String(year).padStart(4, "0")).join("/");
  const prefix = { exact: "", approximate: "Aprox. ", before: "Antes de ", after: "Después de " }[qualifier ?? "exact"] ?? "";
  return prefix + value;
}
