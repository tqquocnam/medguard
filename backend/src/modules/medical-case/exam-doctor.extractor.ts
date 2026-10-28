
export type Xml3Service = Record<string, unknown>;

export type ExamDoctor = {
  maLk: string;
  doctorCode: string;
  serviceCode: string | null;
  serviceName: string | null;
  orderTime: string | null;
};

const val = (value: unknown): string =>
  String(value ?? '').trim();

export function extractExamDoctors(
  maLk: string,
  rows: Xml3Service[]
): ExamDoctor[] {
  if (!maLk.trim()) {
    throw new Error('MA_LK is required');
  }

  const unique = new Map<string, ExamDoctor>();

  for (const row of rows) {
    // CHỈ LẤY CÔNG KHÁM
    if (val(row.MA_NHOM) !== '13') continue;

    const doctorCode =
      val(row.NGUOI_THUC_HIEN) ||
      val(row.MA_BAC_SI);

    if (!doctorCode) continue;

    const record: ExamDoctor = {
      maLk: maLk.trim(),
      doctorCode,
      serviceCode: val(row.MA_DICH_VU) || null,
      serviceName: val(row.TEN_DICH_VU) || null,
      orderTime: val(row.NGAY_YL) || null,
    };

    const key = [
      record.maLk,
      record.doctorCode,
      record.serviceCode || '',
      val(row.STT),
    ].join('::');

    unique.set(key, record);
  }

  return [...unique.values()];
}
