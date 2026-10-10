import { XMLParser } from "fast-xml-parser";

const parser = new XMLParser({
  ignoreAttributes: false,
  trimValues: true,
  parseTagValue: false,
  parseAttributeValue: false,
});

function toArray<T>(value?: T | T[]): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

export function parseBhytXml(xmlText: string) {
  const outer = parser.parse(xmlText);

  const root = outer?.GIAMDINHHS;

  if (!root) {
    throw new Error("Không tìm thấy GIAMDINHHS");
  }

  const thongTinHoSo = root.THONGTINHOSO;

  const hoSoList = toArray(
    thongTinHoSo?.DANHSACHHOSO?.HOSO
  );

  const cases = hoSoList.map(
    (hoso: any, index: number) => {
      const fileList = toArray(hoso.FILEHOSO);

      const files = fileList.map((file: any) => {
        const type = String(file.LOAIHOSO || "");

        const base64 = String(
          file.NOIDUNGFILE || ""
        );

        const decodedXml = Buffer
          .from(base64, "base64")
          .toString("utf8");

        const decodedData =
          parser.parse(decodedXml);

        return {
          type,
          rawXml: decodedXml,
          data: decodedData,
        };
      });

      const xml1 = files.find(
        (item: any) =>
          item.type === "XML1"
      );

      const tongHop =
        xml1?.data?.TONG_HOP;

      return {
        index: index + 1,

        maLk:
          tongHop?.MA_LK,

        maBn:
          tongHop?.MA_BN,

        hoTen:
          tongHop?.HO_TEN,

        ngayVao:
          tongHop?.NGAY_VAO,

        ngayRa:
          tongHop?.NGAY_RA,

        tongChi:
          tongHop?.T_TONGCHI_BV,

        xmlTypes:
          files.map(
            (item: any) => item.type
          ),

        files,
      };
    }
  );

  return {
    facilityCode:
      root.THONGTINDONVI?.MACSKCB,

    createdDate:
      thongTinHoSo?.NGAYLAP,

    declaredTotal:
      Number(
        thongTinHoSo?.SOLUONGHOSO || 0
      ),

    actualTotal:
      cases.length,

    cases,
  };
}