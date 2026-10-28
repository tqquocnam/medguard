
import { Select } from 'antd';
import { useEffect, useState } from 'react';

export type ExamDoctorOption = {
  code: string;
  name?: string | null;
  caseCount: number;
};

type Props = {
  value?: string;
  onChange: (code?: string) => void;
  loadDoctors: () => Promise<ExamDoctorOption[]>;
};

export default function ExamDoctorFilter({
  value,
  onChange,
  loadDoctors,
}: Props) {
  const [doctors, setDoctors] = useState<ExamDoctorOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);

    loadDoctors()
      .then((items) => {
        if (active) setDoctors(items);
      })
      .catch((err) =>
        console.error('Unable to load examination doctors:', err)
      )
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [loadDoctors]);

  return (
    <Select
      allowClear
      showSearch
      loading={loading}
      style={{
        minWidth: 230,
        width: '100%',
      }}
      placeholder="Tất cả bác sĩ khám"
      value={value || undefined}
      onChange={(v) => onChange(v || undefined)}
      optionFilterProp="label"
      options={doctors.map((d) => ({
        value: d.code,
        label: `${
          d.name?.trim() || d.code
        } (${d.caseCount} hồ sơ)`,
      }))}
    />
  );
}
