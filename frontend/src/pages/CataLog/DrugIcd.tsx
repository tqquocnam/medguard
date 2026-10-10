import RuleCatalogPage from "./RuleCatalogPage";

export default function DrugIcd() {
  return (
    <RuleCatalogPage
      title="Thuốc - ICD"
      type="drug-icd"
      fields={[
        {
          name: "drug_code",
          label: "Mã thuốc",
          required: true,
        },
        {
          name: "icd_code",
          label: "Mã ICD",
          required: true,
        },
        {
          name: "match_type",
          label: "Kiểu so khớp",
          type: "select",
          options: [
            {
              label: "Bắt đầu bằng",
              value: "PREFIX",
            },
            {
              label: "Chính xác",
              value: "EXACT",
            },
            {
              label: "Có chứa",
              value: "CONTAINS",
            },
          ],
        },
        {
          name: "active",
          label: "Hoạt động",
          type: "switch",
        },
        {
          name: "note",
          label: "Ghi chú",
        },
      ]}
    />
  );
}