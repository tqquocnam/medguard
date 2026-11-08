let latestPaymentDate: string | undefined;

export function getImportPaymentDate() {
  return latestPaymentDate;
}

export function setImportPaymentDate(value: string | undefined) {
  latestPaymentDate = value;
}

function normalizePaymentDate(value: string): string | undefined {
  const text = value.trim();

  // XML BHYT: YYYYMMDD, YYYYMMDDHHmm hoặc YYYYMMDDHHmmss.
  const compact = /^(\d{4})(\d{2})(\d{2})(?:\d{4}|\d{6})?$/.exec(text);

  // Hỗ trợ thêm YYYY-MM-DD và thời gian đi kèm.
  const separated = /^(\d{4})-(\d{2})-(\d{2})(?:$|[T\s])/.exec(text);

  const match = compact ?? separated;

  if (!match) return undefined;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const checked = new Date(Date.UTC(year, month - 1, day));

  if (
    checked.getUTCFullYear() !== year ||
    checked.getUTCMonth() !== month - 1 ||
    checked.getUTCDate() !== day
  ) {
    return undefined;
  }

  return `${match[1]}-${match[2]}-${match[3]}`;
}

export async function readXmlPaymentDate(file: File): Promise<string | undefined> {
  let latest: string | undefined;

  function inspectXml(content: string, depth = 0) {
    if (depth > 3) return;

    const document = new DOMParser().parseFromString(
      content.replace(/^\uFEFF/, ""),
      "application/xml",
    );

    if (document.getElementsByTagName("parsererror").length > 0) {
      return;
    }

    for (const element of Array.from(document.getElementsByTagName("*"))) {
      const name = element.localName.toUpperCase();

      if (name === "NGAY_TTOAN") {
        const date = normalizePaymentDate(element.textContent ?? "");

        if (date && (!latest || date > latest)) {
          latest = date;
        }
      }

      if (name !== "NOIDUNGFILE") continue;

      // XML được lồng trực tiếp thì vòng lặp hiện tại đã đọc được.
      if (element.children.length > 0) continue;

      const value = element.textContent?.trim();

      if (!value) continue;

      // Một số file chứa XML trong CDATA.
      if (value.startsWith("<")) {
        inspectXml(value, depth + 1);
        continue;
      }

      try {
        const binary = window.atob(value.replace(/\s/g, ""));
        const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));

        inspectXml(new TextDecoder("utf-8").decode(bytes), depth + 1);
      } catch {
        // Không dùng nội dung không giải mã được làm ngày mặc định.
      }
    }
  }

  inspectXml(await file.text());

  return latest;
}
