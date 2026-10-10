import RuleCatalogPage
  from "./RuleCatalogPage";


export default function ServiceIcd() {
  return (
    <RuleCatalogPage
      title="DVKT - ICD"

      type="service-icd"

      fields={[
        {
          name:
            "service_code",

          label:
            "Mã DVKT",

          required:
            true,
        },

        {
          name:
            "icd_code",

          label:
            "Mã ICD",

          required:
            true,
        },

        {
          name:
            "match_type",

          label:
            "Kiểu so khớp",

          type:
            "select",

          options: [
            {
              label:
                "Bắt đầu bằng",
              value:
                "PREFIX",
            },

            {
              label:
                "Chính xác",
              value:
                "EXACT",
            },

            {
              label:
                "Có chứa",
              value:
                "CONTAINS",
            },
          ],
        },

        {
          name:
            "active",

          label:
            "Hoạt động",

          type:
            "switch",
        },

        {
          name:
            "note",

          label:
            "Ghi chú",
        },
      ]}
    />
  );
}