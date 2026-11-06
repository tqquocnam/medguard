import RuleCatalogPage from "./RuleCatalogPage";

export default function DrugIcdInteractions() {
  return (
    <RuleCatalogPage
      title="Tương tác thuốc - ICD"
      type="drug-icd-interactions"
      fields={[
        {
          name: "active_ingredient",
          label: "Hoạt chất",
          required: true,
        },
        {
          name: "icd_code",
          label: "Mã ICD",
          required: true,
        },
        {
          name: "icd_name",
          label: "Tên ICD",
        },
        {
          name: "match_type",
          label: "Cách khớp ICD",
          type: "select",
          required: true,
          options: [
            {
              label: "Chính xác",
              value: "EXACT",
            },
            {
              label: "Theo nhóm ICD (Ví dụ N20 gồm N20.0)",
              value: "PREFIX",
            },
          ],
        },
        {
          name: "note",
          label: "Nội dung cảnh báo",
          required: true,
        },
        {
          name: "active",
          label: "Hoạt động",
          type: "switch",
        },
      ]}
    />
  );
}