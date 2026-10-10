import RuleCatalogPage from "./RuleCatalogPage";

export default function DrugIngredient() {
  return (
    <RuleCatalogPage
      title="Thuốc - Hoạt chất"
      type="drug-ingredient"
      fields={[
        {
          name: "drug_code",
          label: "Mã thuốc",
          required: true,
        },
        {
          name: "active_ingredient",
          label: "Tên hoạt chất",
          required: true,
        },
        {
          name: "active_ingredient_code",
          label: "Mã hoạt chất",
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