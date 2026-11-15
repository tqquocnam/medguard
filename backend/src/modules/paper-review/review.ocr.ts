import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, stat } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
sharp.concurrency(1);
sharp.cache(false);
import { extract, type OcrResult, type OcrLine } from "./review.engine.js";
const execute = promisify(execFile);
export const storageRoot = path.resolve(process.env.PAPER_REVIEW_STORAGE || "./data/paper-review");
export const fileDirectory = (branch: string, id: string) => path.join(storageRoot, branch, id);
export async function command(bin: string, args: string[], timeout = 120000): Promise<string> {
  const { stdout } = await execute(bin, args, {
    timeout,
    maxBuffer: 12 * 1024 * 1024,
    env: { ...process.env, OMP_THREAD_LIMIT: "1" },
    encoding: "utf8",
  });
  return stdout;
}
let capabilityCache: { at: number; value: { ready: boolean; message: string } } | undefined;
export async function capabilities() {
  if (capabilityCache && Date.now() - capabilityCache.at < 30000) return capabilityCache.value;
  let value;
  try {
    const langs = await command("tesseract", ["--list-langs"], 10000);
    if (!/^vie\s*$/m.test(langs) || !/^eng\s*$/m.test(langs)) throw new Error("Missing language");
    await command("pdfinfo", ["-v"], 10000);
    await command("pdftoppm", ["-v"], 10000);
    value = {
      ready: process.env.PAPER_REVIEW_ENABLED !== "false",
      message:
        process.env.PAPER_REVIEW_ENABLED === "false"
          ? "Chức năng đang tắt trên máy chủ."
          : "OCR nội bộ sẵn sàng (Việt + Anh).",
    };
  } catch {
    value = {
      ready: false,
      message: "Máy chủ cần Tesseract (vie + eng) và Poppler. Xem docs/PAPER_REVIEW.md.",
    };
  }
  capabilityCache = { at: Date.now(), value };
  return value;
}
export function parseTsv(tsv: string): OcrResult {
  if (!tsv.startsWith("level\tpage_num\t")) throw new Error("OCR không trả dữ liệu TSV hợp lệ.");
  let width = 1,
    height = 1;
  const lines = new Map<string, OcrLine>();
  let total = 0,
    count = 0;
  for (const row of tsv.split("\n").slice(1)) {
    const c = row.split("\t");
    if (c.length < 12) continue;
    if (c[0] === "1") {
      width = +c[8]! || 1;
      height = +c[9]! || 1;
    }
    const text = c.slice(11).join("\t").trim();
    if (c[0] !== "5" || !text) continue;
    const confidence = Math.max(0, +c[10]! || 0),
      x = +c[6]!,
      y = +c[7]!,
      w = +c[8]!,
      h = +c[9]!;
    const key = c.slice(1, 5).join("-"),
      previous = lines.get(key);
    if (previous) {
      const right = Math.max(previous.x + previous.width, x + w),
        bottom = Math.max(previous.y + previous.height, y + h);
      previous.x = Math.min(previous.x, x);
      previous.y = Math.min(previous.y, y);
      previous.width = right - previous.x;
      previous.height = bottom - previous.y;
      previous.text += " " + text;
      previous.confidence = Math.min(previous.confidence, confidence);
    } else lines.set(key, { text, confidence, x, y, width: w, height: h });
    total += confidence;
    count++;
  }
  return {
    text: [...lines.values()].map((l) => l.text).join("\n"),
    confidence: count ? total / count : 0,
    width,
    height,
    lines: [...lines.values()],
  };
}
export async function pageCount(source: string, mime: string): Promise<number> {
  if (mime !== "application/pdf") return 1;
  const info = await command("pdfinfo", [source], 30000);
  const count = Number(/^Pages:\s+(\d+)/m.exec(info)?.[1]);
  if (!Number.isInteger(count) || count < 1 || count > 500)
    throw new Error("PDF phải có từ 1 đến 500 trang; hãy chia file lớn thành nhiều phần.");
  return count;
}
export async function recognizePage(dir: string, mime: string, page: number) {
  await mkdir(dir, { recursive: true, mode: 0o700 });
  const source = path.join(dir, "original");
  const imageName = `page-${page}.png`;
  const image = path.join(dir, imageName);
  if (mime === "application/pdf") {
    await command("pdftoppm", [
      "-f",
      String(page),
      "-l",
      String(page),
      "-singlefile",
      "-scale-to",
      "2400",
      "-png",
      source,
      path.join(dir, `page-${page}`),
    ]);
  } else {
    // Normalize EXIF orientation and dimensions before OCR. Preview uses the same pixels.
    await sharp(source, { limitInputPixels: 40000000, failOn: "error" })
      .rotate()
      .resize({ width: 2400, height: 2400, fit: "inside" })
      .grayscale()
      .normalize()
      .sharpen()
      .png()
      .toFile(image);
  }
  if ((await stat(image)).size > 40 * 1024 * 1024) throw new Error("Ảnh trang quá lớn.");
  let result = parseTsv(
    await command("tesseract", [
      image,
      "stdout",
      "-l",
      "vie+eng",
      "--psm",
      "3",
      "-c",
      "tessedit_create_tsv=1",
    ]),
  );
  // Sparse/column layouts and uniform blocks need different segmentation. Keep one
  // coherent reading of the page; never merge candidates from overlapping sheets.
  const score = (ocr: OcrResult) => {
    const parsed = extract(ocr);
    return (
      (parsed.documentType !== "UNKNOWN" ? 3 : 0) +
      Object.values(parsed.fields).filter(Boolean).length
    );
  };
  if (score(result) < 5) {
    const alternative = parseTsv(
      await command("tesseract", [
        image,
        "stdout",
        "-l",
        "vie+eng",
        "--psm",
        "6",
        "-c",
        "tessedit_create_tsv=1",
      ]),
    );
    if (alternative.confidence >= 40 && score(alternative) > score(result)) result = alternative;
  }
  if (result.width * result.height > 40000000)
    throw new Error("Ảnh quá lớn (tối đa 40 megapixel).");
  return { imageName, ocr: result };
}
