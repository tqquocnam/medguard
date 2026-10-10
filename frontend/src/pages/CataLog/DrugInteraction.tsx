import RuleCatalogPage from "./RuleCatalogPage";

export default function DrugInteraction() {
  return (
    <RuleCatalogPage
      title="Tương tác thuốc"
      type="drug-interaction"
      fields={[
        {
          name: "ingredient_a",
          label: "Hoạt chất A",
          required: true,
        },
        {
          name: "ingredient_b",
          label: "Hoạt chất B",
          required: true,
        },
        {
          name: "severity",
          label: "Mức độ",
          type: "select",
          options: [
            {
              label: "Lỗi",
              value: "ERROR",
            },
            {
              label: "Cảnh báo",
              value: "WARNING",
            },
            {
              label: "Thông tin",
              value: "INFO",
            },
          ],
        },
        {
          name: "active",
          label: "Hoạt động",
          type: "switch",
        },
        {
          name: "description",
          label: "Mô tả",
        },
      ]}
    />
  );
}