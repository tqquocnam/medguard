import { gql } from "@apollo/client";

export const GET_MEDICAL_CASES = gql`
  query GetMedicalCases(
    $limit: Int!
    $offset: Int!
    $where: core_medical_cases_bool_exp!
  ) {
    core_medical_cases(
      limit: $limit
      offset: $offset
      where: $where
      order_by: {
        created_at: desc
      }
    ) {
      id
      ma_lk
      ma_bn
      ho_ten
      ma_the_bhyt
      gioi_tinh
      ma_loai_kcb
      ngay_vao
      ngay_ra
      ngay_ttoan
      t_tongchi
      t_bhtt
      t_bntt
      nam_qt
      thang_qt
      status
      error_count
    }

    core_medical_cases_aggregate(
      where: $where
    ) {
      aggregate {
        count

        sum {
          t_tongchi
          t_bhtt
          t_bntt
        }
      }
    }
  }
`;