import {
  Alert,
  Button,
  Card,
  DatePicker,
  Input,
  Pagination,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from "antd";

import {
  CheckCircleFilled,
  CloseCircleFilled,
  ExclamationCircleFilled,
  FileSearchOutlined,
  InfoCircleFilled,
  LoadingOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
} from "@ant-design/icons";

import { useQuery } from "@apollo/client/react";

import {
  useEffect,
  useRef,
  useState,
} from "react";

import type {
  CSSProperties,
} from "react";

import {
  useSearchParams,
} from "react-router-dom";

import dayjs from "dayjs";

import { gql } from "@apollo/client";

// Phân trang cần ORDER BY có khóa duy nhất: nếu chỉ sort ngày vào,
// các hồ sơ cùng ngày có thể đổi chỗ giữa các lần gọi LIMIT/OFFSET.
const GET_MEDICAL_CASES_STABLE = gql`
  query GetMedicalCasesStable(
    $limit: Int!
    $offset: Int!
    $where: core_medical_cases_bool_exp!
  ) {
    core_medical_cases(
      limit: $limit
      offset: $offset
      where: $where
      order_by: [{ ngay_vao: desc_nulls_last }, { id: desc }]
    ) {
      id
      ma_lk
      ma_bn
      ho_ten
      ma_the_bhyt
      gioi_tinh
      ma_loai_kcb
      treatment_group
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
    core_medical_cases_aggregate(where: $where) {
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

import CaseCheckResultsModal
  from "../components/CaseCheckResultsModal";

import {
  apiFetch,
} from "../api/apiClient";


// Danh mục bác sĩ công khám được backend tổng hợp từ XML3 (MA_NHOM=13).
type ExamDoctorItem = {
  code: string;
  name?: string | null;
  caseCount: number;
  maLks: string[];
};

// ======================================================
// TYPES
// ======================================================

interface MedicalCase {
  id: string;

  ma_lk?: string;
  ma_bn?: string;
  ho_ten?: string;

  ma_the_bhyt?: string;
  gioi_tinh?: string;

  ma_loai_kcb?: string;
  treatment_group?: string | null;

  ngay_vao?: string;
  ngay_ra?: string;
  ngay_ttoan?: string;

  t_tongchi?: number;
  t_bhtt?: number;
  t_bntt?: number;

  nam_qt?: number;
  thang_qt?: number;

  status?: string;

  error_count?: number;
}


interface QueryResult {
  core_medical_cases:
    MedicalCase[];

  core_medical_cases_aggregate: {
    aggregate: {
      count: number;

      sum: {
        t_tongchi?: number;
        t_bhtt?: number;
        t_bntt?: number;
      } | null;
    } | null;
  };
}


interface CheckProgress {
  processedCases: number;
  totalCases: number;
  remainingCases: number;
  percent: number;
  status: string;
}


// ======================================================
// FORMAT DATE
// ======================================================

function formatDate(
  value?: string
) {
  if (
    !value
  ) {
    return "";
  }

  return dayjs(
    value
  ).format(
    "DD/MM/YYYY HH:mm"
  );
}


// ======================================================
// FORMAT MONEY
// ======================================================

function formatMoney(
  value?: number
) {
  return new Intl.NumberFormat(
    "vi-VN"
  ).format(
    Number(
      value || 0
    )
  );
}


// ======================================================
// GENDER
// ======================================================

function renderGender(
  value?: string
) {
  if (
    String(
      value
    ) === "1"
  ) {
    return "Nam";
  }

  if (
    String(
      value
    ) === "2"
  ) {
    return "Nữ";
  }

  return (
    value ||
    ""
  );
}


// ======================================================
// STYLE
// ======================================================

const pageStyle:
  CSSProperties = {
    display:
      "flex",

    flexDirection:
      "column",

    // Gọn hơn bản cũ
    gap:
      10,

    /*
     * MainLayout:
     *
     * Header: 64px
     * Content padding: 24 + 24
     * Container padding: 24 + 24
     *
     * Tổng = 160px
     */
    height:
      "calc(100vh - 160px)",

    minHeight:
      0,

    overflow:
      "hidden",
  };


const panelStyle:
  CSSProperties = {
    borderRadius:
      14,

    border:
      "1px solid #edf0f5",

    boxShadow:
      "0 4px 18px rgba(15, 23, 42, 0.05)",

    background:
      "#ffffff",
  };


const statusTagStyle:
  CSSProperties = {
    display:
      "inline-flex",

    alignItems:
      "center",

    justifyContent:
      "center",

    gap:
      5,

    minWidth:
      86,

    margin:
      0,

    padding:
      "4px 10px",

    borderRadius:
      999,

    fontSize:
      13,

    fontWeight:
      700,

    cursor:
      "pointer",
  };


  
 
// const MEDGUARD_QUOTES = [
//   // TÌNH YÊU - SÂU LẮNG
//   "Có những người đi ngang đời ta, nhưng để lại thương nhớ rất lâu.",
//   "Đúng người, những ngày bình thường cũng trở nên đặc biệt.",
//   "Yêu thương thật lòng không cần ồn ào, chỉ cần bền bỉ.",
//   "Đôi khi, im lặng là câu trả lời rõ ràng nhất.",
//   "Không phải ai ta nhớ cũng là người ta nên quay về.",
//   "Tình yêu đẹp không phải không có giông bão, mà là cùng nhau vượt qua.",
//   "Có những lời chưa kịp nói, đã trở thành điều tiếc nuối.",
//   "Người thương bạn thật lòng sẽ thương cả những ngày bạn không rực rỡ.",
//   "Hạnh phúc đôi khi chỉ là có một người để kể chuyện mỗi ngày.",
//   "Thương một người là muốn họ bình yên, dù có mình hay không.",
//   "Có những cuộc gặp gỡ không kéo dài, nhưng đủ làm ta thay đổi.",
//   "Đừng vì cô đơn mà nắm nhầm một bàn tay.",
//   "Người ở lại lúc khó khăn mới hiểu hết hai chữ chân tình.",
//   "Tình yêu cần hai người vun đắp, không phải một người cố gắng.",
//   "Đôi khi, buông tay là cách cuối cùng để giữ lại sự bình yên.",

//   // CUỘC SỐNG - NHÂN SINH
//   "Cuộc đời không lấy đi tất cả, đôi khi chỉ đang dạy ta cách bắt đầu lại.",
//   "Trưởng thành là khi bình yên quý hơn những lời hơn thua.",
//   "Có những ngày không cần chiến thắng, chỉ cần không bỏ cuộc.",
//   "Đừng so sánh chương đầu của mình với chương cuối của người khác.",
//   "Không phải con đường nào khó đi cũng dẫn đến nơi sai.",
//   "Cuộc sống không cần hoàn hảo, chỉ cần mỗi ngày tốt hơn một chút.",
//   "Đi chậm không đáng sợ, đáng sợ là không còn muốn bước tiếp.",
//   "Người mạnh mẽ không phải người chưa từng khóc.",
//   "Bình yên là khi lòng mình không còn phải chứng minh điều gì.",
//   "Thời gian không chữa lành tất cả, nhưng dạy ta cách sống cùng những vết thương.",
//   "Một ngày bình thường cũng là món quà đáng quý.",
//   "Có những mất mát giúp ta nhận ra điều gì thật sự quan trọng.",
//   "Đừng đánh đổi sức khỏe và bình yên để chạy theo ánh nhìn người khác.",
//   "Không ai có thể quay lại bắt đầu, nhưng ai cũng có thể bắt đầu từ hôm nay.",
//   "Đời người ngắn lắm, hãy dành thời gian cho những điều xứng đáng.",

//   // BÀI HỌC - LÒNG NGƯỜI
//   "Lòng tốt cần có giới hạn, sự chân thành cần đặt đúng người.",
//   "Đừng đánh giá một người chỉ qua một khoảnh khắc.",
//   "Người hiểu bạn không cần quá nhiều lời giải thích.",
//   "Không phải ai mỉm cười với bạn cũng thật lòng với bạn.",
//   "Cách một người đối xử với người yếu thế nói lên nhiều điều về họ.",
//   "Đừng vì một người không tốt mà đánh mất lòng tin vào tất cả.",
//   "Có những bài học phải trả bằng nước mắt mới nhớ được.",
//   "Biết đủ là giàu, biết dừng là khôn.",
//   "Sống tử tế không bảo đảm mọi điều tốt đẹp, nhưng giúp lòng mình thanh thản.",
//   "Đừng hứa khi vui, đừng quyết định khi giận.",
//   "Một lời nói có thể sưởi ấm, cũng có thể làm tổn thương.",
//   "Sự tôn trọng không nằm ở lời nói, mà ở cách hành xử.",
//   "Người khôn ngoan biết khi nào nên nói và khi nào nên lắng nghe.",
//   "Đừng để một phút nóng giận phá hỏng nhiều năm vun đắp.",
//   "Nhân cách là điều còn lại khi không ai nhìn thấy.",

//   // NGHỊ LỰC - THÀNH CÔNG
//   "Có công mài sắt, có ngày nên kim.",
//   "Kiến tha lâu cũng đầy tổ.",
//   "Lửa thử vàng, gian nan thử sức.",
//   "Chớ thấy sóng cả mà ngã tay chèo.",
//   "Có chí thì nên.",
//   "Thất bại là mẹ thành công.",
//   "Đường dài mới biết ngựa hay.",
//   "Tích tiểu thành đại.",
//   "Năng nhặt chặt bị.",
//   "Thua keo này, bày keo khác.",
//   "Không ai thành công chỉ nhờ những ngày thuận lợi.",
//   "Mỗi bước nhỏ hôm nay là nền móng cho ngày mai.",
//   "Ngã xuống không đáng sợ, miễn là còn đủ can đảm đứng lên.",
//   "Đừng sợ bắt đầu lại, lần này bạn đã có kinh nghiệm.",
//   "Cây lớn cũng bắt đầu từ một hạt mầm.",

//   // CA DAO - TỤC NGỮ VIỆT NAM
//   "Uống nước nhớ nguồn.",
//   "Ăn quả nhớ kẻ trồng cây.",
//   "Lá lành đùm lá rách.",
//   "Thương người như thể thương thân.",
//   "Một cây làm chẳng nên non, ba cây chụm lại nên hòn núi cao.",
//   "Gần mực thì đen, gần đèn thì sáng.",
//   "Tốt gỗ hơn tốt nước sơn.",
//   "Đói cho sạch, rách cho thơm.",
//   "Đi một ngày đàng, học một sàng khôn.",
//   "Học thầy không tày học bạn.",
//   "Không thầy đố mày làm nên.",
//   "Một miếng khi đói bằng một gói khi no.",
//   "Ở hiền gặp lành.",
//   "Thuận vợ thuận chồng, tát Biển Đông cũng cạn.",
//   "Yêu nhau mấy núi cũng trèo, mấy sông cũng lội, mấy đèo cũng qua.",

//   // CHÂM NGÔN NGẮN - ĐÁNG SUY NGẪM
//   "Ít kỳ vọng hơn, nhiều bình yên hơn.",
//   "Thứ quý giá nhất đôi khi là những điều ta đang có.",
//   "Không phải điều gì mất đi cũng là mất mát.",
//   "Trân trọng hiện tại, vì ngày hôm nay sẽ không trở lại.",
//   "Học cách tha thứ, nhưng đừng quên bài học.",

// ];



// ======================================================
// COMPONENT
// ======================================================


export default function MedicalCases() {

  const [
    searchParams,
  ] =
    useSearchParams();


  // ====================================================
  // FIX TRANG - CHỈ TABLE ĐƯỢC SCROLL
  // ====================================================

  const tableAreaRef =
    useRef<
      HTMLDivElement |
      null
    >(
      null
    );


  const [
    tableScrollY,
    setTableScrollY,
  ] =
    useState(
      220
    );


  // ====================================================
  // KHÓA SCROLL BODY
  // ====================================================

  useEffect(
    () => {

      const html =
        document.documentElement;

      const body =
        document.body;


      const oldHtmlOverflow =
        html.style.overflow;

      const oldBodyOverflow =
        body.style.overflow;


      html.style.overflow =
        "hidden";

      body.style.overflow =
        "hidden";


      return () => {

        html.style.overflow =
          oldHtmlOverflow;

        body.style.overflow =
          oldBodyOverflow;

      };

    },
    []
  );


  // ====================================================
  // MODAL KẾT QUẢ
  // ====================================================

  const [
    resultCase,
    setResultCase,
  ] =
    useState<
      MedicalCase |
      null
    >(
      null
    );


  // Hồ sơ vừa đóng modal: lưu theo ID, không phụ thuộc vị trí dòng.
  const [lastViewedCase, setLastViewedCase] = useState<MedicalCase | null>(null);
  const lastTableScroll = useRef({ top: 0, left: 0 });

  function openCaseResults(record: MedicalCase) {
    // Hồ sơ tốt không mở modal, kể cả khi nhấn vào tên bệnh nhân.
    if (record.status === "OK") return;

    const body = tableAreaRef.current?.querySelector<HTMLElement>(
      ".medguard-case-table-fixed .ant-table-body"
    );
    if (body) {
      lastTableScroll.current.top = body.scrollTop;
      lastTableScroll.current.left = body.scrollLeft;
    }
    setResultCase(record);
  }

  function closeCaseResults() {
    if (resultCase) {
      setLastViewedCase(resultCase);
    }
    setResultCase(null);
    // Đợi React render xong mới phục hồi vị trí bảng.
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        const body = tableAreaRef.current?.querySelector<HTMLElement>(
          ".medguard-case-table-fixed .ant-table-body"
        );
        if (body) {
          body.scrollTop = lastTableScroll.current.top;
          body.scrollLeft = lastTableScroll.current.left;
        }
      });
    });
  }

  // ====================================================
  // PAYMENT DATE
  // ====================================================

  const [
    paymentDate,
    setPaymentDate,
  ] =
    useState<
      string |
      undefined
    >(
      undefined
    );


  const [
    clearingPaymentDate,
    setClearingPaymentDate,
  ] =
    useState(
      false
    );


  const clearPaymentTimer =
    useRef<
      ReturnType<
        typeof setTimeout
      > |
      null
    >(
      null
    );


  useEffect(
    () => {

      return () => {

        if (
          clearPaymentTimer.current
        ) {
          clearTimeout(
            clearPaymentTimer.current
          );
        }

      };

    },
    []
  );


  // ====================================================
  // CHECKING
  // ====================================================

  const [
    checking,
    setChecking,
  ] =
    useState(
      false
    );

// const [quoteIndex, setQuoteIndex] = useState(() =>
//   Math.floor(Math.random() * MEDGUARD_QUOTES.length)
// );

// useEffect(() => {
//   if (!checking) return;

//   // Chọn ngẫu nhiên một câu khi bắt đầu kiểm tra.
//   setQuoteIndex(
//     Math.floor(Math.random() * MEDGUARD_QUOTES.length)
//   );

//   const timer = window.setInterval(() => {
//     setQuoteIndex((previous) => {
//       const offset =
//         1 +
//         Math.floor(
//           Math.random() * (MEDGUARD_QUOTES.length - 1)
//         );

//       return (previous + offset) % MEDGUARD_QUOTES.length;
//     });
//   }, 5000);

//   return () => window.clearInterval(timer);
// }, [checking]);


  const [
    checkProgress,
    setCheckProgress,
  ] =
    useState<
      CheckProgress
    >({
      processedCases:
        0,

      totalCases:
        0,

      remainingCases:
        0,

      percent:
        0,

      status:
        "IDLE",
    });


  const [
    refreshing,
    setRefreshing,
  ] =
    useState(
      false
    );


  // ====================================================
  // PAGINATION
  // ====================================================

  const [
    page,
    setPage,
  ] =
    useState(
      1
    );


  const [
    pageSize,
    setPageSize,
  ] =
    useState(
      10
    );


  // ====================================================
  // FILTER
  // ====================================================

  const [
    maBn,
    setMaBn,
  ] =
    useState(
      ""
    );


  const [
    hoTen,
    setHoTen,
  ] =
    useState(
      ""
    );


  const [
    status,
    setStatus,
  ] =
    useState(
      "ALL"
    );


  // Hai chiều lọc độc lập: loại KCB BHYT và nhóm nghiệp vụ.
  const [examDoctorCode, setExamDoctorCode] = useState<string | undefined>();
  const [examDoctors, setExamDoctors] = useState<ExamDoctorItem[]>([]);
  const [examDoctorLoading, setExamDoctorLoading] = useState(true);
  const [examDoctorError, setExamDoctorError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function loadExamDoctors() {
      try {
        setExamDoctorLoading(true);
        const response = await apiFetch("/medical-cases/exam-doctors");
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const json = await response.json();
        const items: ExamDoctorItem[] = Array.isArray(json?.data)
          ? json.data
          : Array.isArray(json?.items)
            ? json.items
            : [];
        if (mounted) {
          setExamDoctors(items);
          setExamDoctorError(null);
        }
      } catch (err) {
        if (mounted) {
          setExamDoctorError(err instanceof Error ? err.message : "Lỗi kết nối");
          setExamDoctors([]);
        }
      } finally {
        if (mounted) setExamDoctorLoading(false);
      }
    }
    void loadExamDoctors();
    return () => { mounted = false; };
  }, []);

  const examDoctorByCode = new Map(examDoctors.map(d => [d.code, d]));
  const examDoctorByMaLk = new Map<string, ExamDoctorItem[]>();
  for (const doctor of examDoctors) {
    for (const maLk of doctor.maLks) {
      const current = examDoctorByMaLk.get(maLk) || [];
      current.push(doctor);
      examDoctorByMaLk.set(maLk, current);
    }
  }

  const [kcbType, setKcbType] = useState<string>("ALL");
  const [treatmentGroup, setTreatmentGroup] = useState<string>("ALL");

  const urlYear =
    searchParams.get(
      "year"
    );


  const urlMonth =
    searchParams.get(
      "month"
    );


  const [
    year,
    setYear,
  ] =
    useState<
      number |
      undefined
    >(
      urlYear &&
      !Number.isNaN(
        Number(
          urlYear
        )
      )
        ? Number(
            urlYear
          )
        : dayjs().year()
    );


  
const [month, setMonth] = useState<number | undefined>(() => {
  const currentMonth = dayjs().month() + 1;

  if (urlMonth) {
    const parsedMonth = Number(urlMonth);

    if (
      Number.isInteger(parsedMonth) &&
      parsedMonth >= 1 &&
      parsedMonth <= 12
    ) {
      return parsedMonth;
    }
  }

  return currentMonth;
});



  useEffect(
    () => {

      const yearParam =
        searchParams.get(
          "year"
        );


      const monthParam =
        searchParams.get(
          "month"
        );


      if (
        yearParam
      ) {

        const nextYear =
          Number(
            yearParam
          );


        if (
          !Number.isNaN(
            nextYear
          )
        ) {
          setYear(
            nextYear
          );
        }

      }


      
if (monthParam) {
  const nextMonth = Number(monthParam);

  if (
    Number.isInteger(nextMonth) &&
    nextMonth >= 1 &&
    nextMonth <= 12
  ) {
    setMonth(nextMonth);
  } else {
    setMonth(dayjs().month() + 1);
  }
} else {
  setMonth(dayjs().month() + 1);
}



      setPage(
        1
      );

    },
    [
      searchParams,
    ]
  );


  // ====================================================
  // GRAPHQL WHERE
  // ====================================================

  const where:
    Record<
      string,
      unknown
    > = {};


  if (
    maBn.trim()
  ) {
    where.ma_bn = {
      _ilike:
        `%${maBn.trim()}%`,
    };
  }


  if (
    hoTen.trim()
  ) {
    where.ho_ten = {
      _ilike:
        `%${hoTen.trim()}%`,
    };
  }


  if (
    status !==
    "ALL"
  ) {
    where.status = {
      _eq:
        status,
    };
  }


  // Lọc trên DB trước khi phân trang/tính tổng, không lọc trên 10 dòng hiện tại.
  if (kcbType !== "ALL") {
    where.ma_loai_kcb = { _eq: kcbType };
  }
  if (treatmentGroup !== "ALL") {
    where.treatment_group = { _eq: treatmentGroup };
  }

  // Lọc trên Hasura TRƯỚC LIMIT/OFFSET và aggregate.
  // Không áp bộ lọc khi chưa có danh sách chính xác từ API.
  if (examDoctorCode && !examDoctorLoading && !examDoctorError) {
    where.ma_lk = {
      _in: examDoctorByCode.get(examDoctorCode)?.maLks ?? [],
    };
  }

  if (
    year
  ) {
    where.nam_qt = {
      _eq:
        year,
    };
  }


  if (
    month
  ) {
    where.thang_qt = {
      _eq:
        month,
    };
  }


  if (
    paymentDate
  ) {

    const startDate =
      dayjs(
        paymentDate
      )
        .startOf(
          "day"
        )
        .format(
          "YYYY-MM-DDTHH:mm:ss"
        );


    const endDate =
      dayjs(
        paymentDate
      )
        .add(
          1,
          "day"
        )
        .startOf(
          "day"
        )
        .format(
          "YYYY-MM-DDTHH:mm:ss"
        );


    where.ngay_ttoan = {
      _gte:
        startDate,

      _lt:
        endDate,
    };
  }


  // ====================================================
  // QUERY
  // ====================================================

  const {
    data,
    loading,
    error,
    refetch,
  } =
    useQuery<
      QueryResult
    >(
      GET_MEDICAL_CASES_STABLE,
      {
        variables: {
          limit:
            pageSize,

          offset:
            (
              page -
              1
            ) *
            pageSize,

          where,
        },

        fetchPolicy:
          "network-only",
      }
    );


  // ====================================================
  // CHIỀU CAO TABLE: TÍNH THEO KHUNG HIỂN THỊ THỰC TẾ
  // Pagination nằm ở footer riêng, không bị table che
  // ====================================================
  useEffect(() => {
    let frame = 0;

    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const area = tableAreaRef.current;
        const content = area?.querySelector<HTMLElement>(
          ".medguard-case-table-content"
        );
        const body = content?.querySelector<HTMLElement>(".ant-table-body");
        const head = content?.querySelector<HTMLElement>(".ant-table-header");
        if (!area || !content) return;

        // AntD gắn scroll.y vào .ant-table-body; vị trí bắt đầu
        // phần body không thay đổi khi nội dung bảng được cập nhật.
        const top = body?.getBoundingClientRect().top ??
          (content.getBoundingClientRect().top + (head?.offsetHeight ?? 47));
        const bottom = content.getBoundingClientRect().bottom;
        const nextHeight = Math.max(48, Math.floor(bottom - top - 12));
        setTableScrollY(old => old === nextHeight ? old : nextHeight);
      });
    };

    const observer = new ResizeObserver(measure);
    if (tableAreaRef.current) observer.observe(tableAreaRef.current);
    const content = tableAreaRef.current?.querySelector<HTMLElement>(
      ".medguard-case-table-content"
    );
    if (content) observer.observe(content);
    window.addEventListener("resize", measure);
    measure();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [loading, page, pageSize]);


  // ====================================================
  // RUN CHECKS
  // ====================================================

  async function handleRunChecks() {

    try {

      if (
        !year
      ) {
        message.warning(
          "Vui lòng chọn năm cần kiểm tra."
        );

        return;
      }


      // Gửi bộ lọc vào backend, không chỉ lọc các dòng trên giao diện.
      // Không gửi ALL thành giá trị nhóm.

      if (kcbType !== "ALL") {
        message.warning("Kiểm tra theo loại KCB BHYT chưa được hỗ trợ tại backend. Hãy chọn Tất cả loại KCB.");
        return;
      }

      setChecking(
        true
      );


      setCheckProgress({
        processedCases:
          0,

        totalCases:
          0,

        remainingCases:
          0,

        percent:
          0,

        status:
          "RUNNING",
      });


      const response =
        await apiFetch(
          "/checks/run",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                year,

                month:
                  month ??
                  null,

                paymentDate:
                  paymentDate ??
                  null,
                treatmentGroup: treatmentGroup !== "ALL" ? treatmentGroup : null,
              }),
          }
        );


      let json:
        any =
        null;


      try {
        json =
          await response.json();
      } catch {
        json =
          null;
      }


      if (
        !response.ok ||
        !json?.success
      ) {
        throw new Error(
          json?.message ||
          "Không thể bắt đầu kiểm tra dữ liệu."
        );
      }


      const validation =
        json
          ?.data
          ?.validation;


      const checkRunId =
        validation
          ?.checkRunId;


      if (
        !checkRunId
      ) {
        throw new Error(
          "Backend không trả về checkRunId."
        );
      }


      const totalCases =
        Number(
          validation
            ?.totalCases ??
          0
        );


      setCheckProgress({
        processedCases:
          0,

        totalCases,

        remainingCases:
          totalCases,

        percent:
          0,

        status:
          "RUNNING",
      });


      await new Promise<
        void
      >(
        (
          resolve,
          reject
        ) => {

          let stopped =
            false;


          const poll =
            async () => {

              if (
                stopped
              ) {
                return;
              }


              try {

                const progressResponse =
                  await apiFetch(
                    `/checks/runs/${checkRunId}/progress`
                  );


                let progressJson:
                  any =
                  null;


                try {
                  progressJson =
                    await progressResponse.json();
                } catch {
                  progressJson =
                    null;
                }


                if (
                  !progressResponse.ok ||
                  !progressJson?.success
                ) {
                  throw new Error(
                    progressJson?.message ||
                    "Không lấy được tiến độ kiểm tra."
                  );
                }


                const progress =
                  progressJson
                    ?.data
                    ?.progress;


                if (
                  !progress
                ) {
                  window.setTimeout(
                    poll,
                    400
                  );

                  return;
                }


                setCheckProgress({
                  processedCases:
                    Number(
                      progress
                        .processedCases ??
                      0
                    ),

                  totalCases:
                    Number(
                      progress
                        .totalCases ??
                      0
                    ),

                  remainingCases:
                    Number(
                      progress
                        .remainingCases ??
                      0
                    ),

                  percent:
                    Number(
                      progress
                        .percent ??
                      0
                    ),

                  status:
                    String(
                      progress
                        .status ??
                      "RUNNING"
                    ),
                });


                if (
                  progress.status ===
                  "DONE"
                ) {

                  stopped =
                    true;


                  setCheckProgress({
                    processedCases:
                      Number(
                        progress
                          .totalCases ??
                        0
                      ),

                    totalCases:
                      Number(
                        progress
                          .totalCases ??
                        0
                      ),

                    remainingCases:
                      0,

                    percent:
                      100,

                    status:
                      "DONE",
                  });


                  resolve();

                  return;
                }


                if (
                  progress.status ===
                  "ERROR"
                ) {

                  stopped =
                    true;


                  reject(
                    new Error(
                      "Quá trình kiểm tra dữ liệu bị lỗi."
                    )
                  );

                  return;
                }


                window.setTimeout(
                  poll,
                  400
                );

              } catch (
                error
              ) {

                stopped =
                  true;


                reject(
                  error
                );

              }

            };


          void poll();

        }
      );


      message.success(
        "Kiểm tra dữ liệu hoàn tất."
      );


      await refetch();

    } catch (
      error
    ) {

      console.error(
        "Run checks error:",
        error
      );


      message.error(
        error instanceof
        Error
          ? error.message
          : "Kiểm tra dữ liệu thất bại."
      );

    } finally {

      setChecking(
        false
      );

    }
  }


  // ====================================================
  // QUERY ERROR
  // ====================================================

  if (
    error
  ) {
    return (
      <Alert
        type="error"

        showIcon

        message="Không tải được hồ sơ"

        description={
          error.message
        }
      />
    );
  }


  // ====================================================
  // DATA
  // ====================================================

  const cases =
    data
      ?.core_medical_cases ??
    [];


  const aggregate =
    data
      ?.core_medical_cases_aggregate
      ?.aggregate;


  const total =
    aggregate
      ?.count ??
    0;


  const totalAmount =
    aggregate
      ?.sum
      ?.t_tongchi ??
    0;


  const totalBhyt =
    aggregate
      ?.sum
      ?.t_bhtt ??
    0;


  const totalPatient =
    aggregate
      ?.sum
      ?.t_bntt ??
    0;


  // ====================================================
  // RESET
  // ====================================================

  function handleReset() {

    if (
      refreshing
    ) {
      return;
    }


    setRefreshing(
      true
    );


    setTimeout(
      () => {

        setMaBn(
          ""
        );


        setHoTen(
          ""
        );


        setStatus(
          "ALL"
        );
        setKcbType("ALL");
        setTreatmentGroup("ALL");
        setExamDoctorCode(undefined);


        setYear(dayjs().year());
setMonth(dayjs().month() + 1);


        setPaymentDate(
          undefined
        );


        setPage(
          1
        );


        setRefreshing(
          false
        );

      },
      800
    );
  }


  // ====================================================
  // STATUS
  // ====================================================

  function renderCaseStatus(
    statusValue:
      string |
      undefined,

    record:
      MedicalCase
  ) {

    if (
      statusValue ===
      "ERROR"
    ) {
      return (
        <Tag
          icon={
            <CloseCircleFilled />
          }

          color="error"

          style={
            statusTagStyle
          }

          onClick={() =>
            openCaseResults(
              record
            )
          }
        >
          Lỗi
        </Tag>
      );
    }


    if (
      statusValue ===
      "OK"
    ) {
      return (
        <Tag
          icon={
            <CheckCircleFilled />
          }

          color="success"

          style={{
            ...statusTagStyle,
            cursor: "default",
            pointerEvents: "none",
          }}
        >
          Tốt
        </Tag>
      );
    }


    if (
      statusValue ===
      "WARNING"
    ) {
      return (
        <Tag
          icon={
            <ExclamationCircleFilled />
          }

          color="warning"

          style={
            statusTagStyle
          }

          onClick={() =>
            openCaseResults(
              record
            )
          }
        >
          Cảnh báo
        </Tag>
      );
    }


    if (
      statusValue ===
      "INCOMPLETE"
    ) {
      return (
        <Tag
          icon={
            <InfoCircleFilled />
          }

          color="gold"

          style={{
            ...statusTagStyle,

            minWidth:
              140,
          }}

          onClick={() =>
            openCaseResults(
              record
            )
          }
        >
          Chưa đủ cấu hình
        </Tag>
      );
    }


    if (
      statusValue ===
      "CHECKING"
    ) {
      return (
        <Tag
          icon={
            <LoadingOutlined />
          }

          color="processing"

          style={{
            ...statusTagStyle,

            cursor:
              "default",
          }}
        >
          Đang kiểm tra
        </Tag>
      );
    }


    return (
      <Tag
        icon={
          <InfoCircleFilled />
        }

        style={{
          ...statusTagStyle,

          color:
            "#64748b",

          background:
            "#f8fafc",

          borderColor:
            "#e2e8f0",

          cursor:
            "default",
        }}
      >
        Chưa kiểm tra
      </Tag>
    );
  }


  // ====================================================
  // STATUS FILTER LABEL
  // ====================================================

  function statusFilterLabel(
    type:
      "OK" |
      "ERROR"
  ) {

    if (
      type ===
      "OK"
    ) {
      return (
        <Space
          size={
            7
          }
        >
          <CheckCircleFilled
            style={{
              color:
                "#52c41a",
            }}
          />

          <span>
            Tốt
          </span>
        </Space>
      );
    }


    return (
      <Space
        size={
          7
        }
      >
        <CloseCircleFilled
          style={{
            color:
              "#ff4d4f",
          }}
        />

        <span>
          Lỗi
        </span>
      </Space>
    );
  }


  // ====================================================
  // JSX
  // ====================================================

  return (
    <div
      style={
        pageStyle
      }
    >

      {/* ==================================================
          HEADER
      ================================================== */}

      <div
        style={{
          flexShrink:
            0,
        }}
      >

        <Typography.Title
          level={
            3
          }

          style={{
            margin:
              0,

            display:
              "flex",

            alignItems:
              "center",

            gap:
              8,

            fontSize:
              21,

            lineHeight:
              1.25,

            fontWeight:
              800,

            color:
              "#172033",
          }}
        >

          <FileSearchOutlined
            style={{
              color:
                "#1677ff",

              fontSize:
                20,
            }}
          />

          Danh sách hồ sơ

        </Typography.Title>


        <Typography.Text
          type="secondary"

          style={{
            display:
              "block",

            marginTop:
              2,

            fontSize:
              12,
          }}
        >
          Theo dõi và kiểm tra dữ liệu hồ sơ khám chữa bệnh BHYT
        </Typography.Text>

      </div>


      {/* ==================================================
          THỐNG KÊ
      ================================================== */}

      <div
        className="medguard-stat-grid"

        style={{
          display:
            "grid",

          gridTemplateColumns:
            "repeat(4, minmax(170px, 1fr))",

          gap:
            10,

          flexShrink:
            0,
        }}
      >

        {/* TỔNG HỒ SƠ */}

        <Card
          styles={{
            body: {
              padding:
                "10px 14px",
            },
          }}

          style={{
            ...panelStyle,

            borderLeft:
              "4px solid #ff4d4f",
          }}
        >

          <Typography.Text
            type="secondary"

            style={{
              fontSize:
                12,
            }}
          >
            Tổng hồ sơ
          </Typography.Text>


          <div
            style={{
              marginTop:
                2,

              fontSize:
                20,

              lineHeight:
                1.2,

              fontWeight:
                800,

              color:
                "#d4380d",
            }}
          >
            {total}
          </div>

        </Card>


        {/* TỔNG CHI */}

        <Card
          styles={{
            body: {
              padding:
                "10px 14px",
            },
          }}

          style={{
            ...panelStyle,

            borderLeft:
              "4px solid #1677ff",
          }}
        >

          <Typography.Text
            type="secondary"

            style={{
              fontSize:
                12,
            }}
          >
            Tổng chi
          </Typography.Text>


          <div
            style={{
              marginTop:
                2,

              fontSize:
                19,

              lineHeight:
                1.2,

              fontWeight:
                800,

              color:
                "#1677ff",
            }}
          >
            {
              formatMoney(
                totalAmount
              )
            }
          </div>

        </Card>


        {/* TỔNG BHYT */}

        <Card
          styles={{
            body: {
              padding:
                "10px 14px",
            },
          }}

          style={{
            ...panelStyle,

            borderLeft:
              "4px solid #faad14",
          }}
        >

          <Typography.Text
            type="secondary"

            style={{
              fontSize:
                12,
            }}
          >
            Tổng BHYT
          </Typography.Text>


          <div
            style={{
              marginTop:
                2,

              fontSize:
                19,

              lineHeight:
                1.2,

              fontWeight:
                800,

              color:
                "#d48806",
            }}
          >
            {
              formatMoney(
                totalBhyt
              )
            }
          </div>

        </Card>


        {/* TỔNG BNTT */}

        <Card
          styles={{
            body: {
              padding:
                "10px 14px",
            },
          }}

          style={{
            ...panelStyle,

            borderLeft:
              "4px solid #52c41a",
          }}
        >

          <Typography.Text
            type="secondary"

            style={{
              fontSize:
                12,
            }}
          >
            Tổng BNTT
          </Typography.Text>


          <div
            style={{
              marginTop:
                2,

              fontSize:
                19,

              lineHeight:
                1.2,

              fontWeight:
                800,

              color:
                "#389e0d",
            }}
          >
            {
              formatMoney(
                totalPatient
              )
            }
          </div>

        </Card>

      </div>


      {/* ==================================================
          FILTER
      ================================================== */}

{/* ==================================================
    MEDGUARD - MODERN FILTER PANEL
================================================== */}

<Card
  className="medguard-filter-panel"
  style={{
    ...panelStyle,
    flexShrink: 0,
    border: "1px solid #e3ebf6",
    borderRadius: 16,
    boxShadow: "0 4px 18px rgba(15,23,42,0.035)",
  }}
  styles={{
    body: {
      padding: "13px 16px 12px",
    },
  }}
>
  {/* HEADER */}
  <div
  style={{
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
    marginBottom: 5,
    flexWrap: "wrap",
  }}
>
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div
        style={{
          width: 26,
          height: 26,
          borderRadius: 7,
          background: "#eff6ff",
          color: "#1677ff",
          display: "grid",
          placeItems: "center",
          fontSize: 17,
        }}
      >
        <SearchOutlined />
      </div>

      <div>
        <Typography.Text
          strong
          style={{
            display: "block",
            fontSize: 14,
            color: "#14233b",
          }}
        >
          Bộ lọc hồ sơ
        </Typography.Text>

        <Typography.Text
          type="secondary"
          style={{ display: "block", fontSize: 11 }}
        >
          Tra cứu hồ sơ theo bệnh nhân, bác sĩ và thời gian
        </Typography.Text>
      </div>
    </div>

    {/* {examDoctorCode && (
      <Tag
        color="blue"
        style={{
          margin: 0,
          borderRadius: 8,
          padding: "4px 10px",
          fontWeight: 600,
        }}
      >
        Bác sĩ: {examDoctorByCode.get(examDoctorCode)?.name ||
          examDoctorCode}
      </Tag>
    )} */}
  </div>

  {examDoctorError && (
    <Alert
      type="warning"
      showIcon
      style={{ marginBottom: 12, borderRadius: 10 }}
      message="Không tải được danh sách bác sĩ công khám"
      description="Kiểm tra kết nối API bác sĩ công khám."
    />
  )}

  {/* HÀNG 1 - BỘ LỌC CHÍNH */}
  <div
    className="medguard-filter-grid"
    style={{
      display: "grid",
      gridTemplateColumns:
        "minmax(120px, 0.85fr) minmax(160px, 1.1fr) minmax(220px, 1.6fr) minmax(180px, 1.2fr) minmax(155px, 1fr)",
      gap: 10,
      alignItems: "end",
    }}
  >
    <div className="medguard-filter-field">
      <div className="medguard-filter-label">Mã bệnh nhân</div>
      <Input
        size="large"
        value={maBn}
        allowClear
        prefix={<SearchOutlined style={{ color: "#94a3b8" }} />}
        placeholder="Nhập mã BN"
        onChange={(e) => {
          setMaBn(e.target.value);
          setPage(1);
        }}
      />
    </div>

    <div className="medguard-filter-field">
      <div className="medguard-filter-label">Tên bệnh nhân</div>
      <Input
        size="large"
        value={hoTen}
        allowClear
        prefix={<SearchOutlined style={{ color: "#94a3b8" }} />}
        placeholder="Tìm họ và tên"
        onChange={(e) => {
          setHoTen(e.target.value);
          setPage(1);
        }}
      />
    </div>

    <div className="medguard-filter-field">
      <div className="medguard-filter-label">
        <span>Bác sĩ công khám</span>
        
      </div>

      <Select
        size="large"
        aria-label="Bác sĩ công khám"
        style={{ width: "100%" }}
        allowClear
        showSearch
        optionFilterProp="label"
        loading={examDoctorLoading}
        disabled={examDoctorLoading || !!examDoctorError}
        placeholder="Tất cả bác sĩ công khám"
        value={examDoctorCode}
        onChange={(code: string | undefined) => {
          setExamDoctorCode(code);
          setPage(1);
        }}
        options={examDoctors.map((d) => ({
          value: d.code,
          label: `${d.name?.trim() || d.code}`,
        }))}
      />
    </div>

    <div className="medguard-filter-field">
      <div className="medguard-filter-label">Nhóm hồ sơ</div>
      <Select
        size="large"
        value={treatmentGroup}
        style={{ width: "100%" }}
        onChange={(value: string) => {
          setTreatmentGroup(value);
          setPage(1);
        }}
        options={[
          { value: "ALL", label: "Tất cả nhóm KCB" },
          { value: "GENERAL", label: "Khám bệnh ngoại trú" },
          { value: "YHCT", label: "Bệnh án ngoại trú" },
        ]}
      />
    </div>

    <div className="medguard-filter-field">
      <div className="medguard-filter-label">Trạng thái</div>
      <Select
        size="large"
        value={status}
        style={{ width: "100%" }}
        onChange={(value: string) => {
          setStatus(value);
          setPage(1);
        }}
        options={[
          { value: "ALL", label: "Tất cả trạng thái" },
          { value: "OK", label: statusFilterLabel("OK") },
          { value: "ERROR", label: statusFilterLabel("ERROR") },
        ]}
      />
    </div>
  </div>

  {/* HÀNG 2 - THỜI GIAN VÀ THAO TÁC */}
  <div className="medguard-filter-actions-row">
    <div className="medguard-filter-date-fields">
      <div className="medguard-filter-field">
        <div className="medguard-filter-label">Năm</div>
        <Select
          size="large"
          allowClear
          placeholder="Năm"
          style={{ width: "100%" }}
          value={year}
          onChange={(value) => {
            setYear(value);
            setPage(1);
          }}
          options={[
            { value: 2026, label: "2026" },
            { value: 2025, label: "2025" },
            { value: 2024, label: "2024" },
          ]}
        />
      </div>

      <div className="medguard-filter-field">
        <div className="medguard-filter-label">Tháng</div>
        <Select
          size="large"
          allowClear
          placeholder="Tất cả tháng"
          style={{ width: "100%" }}
          value={month}
          onChange={(value) => {
            setMonth(value);
            setPage(1);
          }}
          options={Array.from({ length: 12 }, (_, i) => ({
            value: i + 1,
            label: `Tháng ${i + 1}`,
          }))}
        />
      </div>

      <div className="medguard-filter-field">
        <div className="medguard-filter-label">
          Ngày thanh toán
        </div>
        <DatePicker
          size="large"
          value={paymentDate ? dayjs(paymentDate) : null}
          format="DD/MM/YYYY"
          placeholder="Chọn ngày"
          allowClear
          disabled={clearingPaymentDate}
          style={{
            width: "100%",
            opacity: clearingPaymentDate ? 0.6 : 1,
          }}
          onChange={(date) => {
            if (clearPaymentTimer.current) {
              clearTimeout(clearPaymentTimer.current);
              clearPaymentTimer.current = null;
            }

            if (date) {
              setClearingPaymentDate(false);
              setPaymentDate(date.format("YYYY-MM-DD"));
            } else {
              setClearingPaymentDate(false);
              setPaymentDate(undefined);
            }

            setPage(1);
          }}
        />
      </div>
    </div>

    <div className="medguard-filter-buttons">
      <Button
        size="large"
        icon={<ReloadOutlined />}
        disabled={refreshing}
        loading={refreshing}
        onClick={handleReset}
        style={{
          borderRadius: 10,
          fontWeight: 600,
          minWidth: 115,
          height: 40,
        }}
      >
        Làm mới
      </Button>

      <Button
        size="large"
        type="primary"
        icon={
          checking
            ? <LoadingOutlined />
            : <SafetyCertificateOutlined />
        }
        loading={checking}
        onClick={handleRunChecks}
        style={{
          borderRadius: 10,
          fontWeight: 700,
          height: 40,
          minWidth: 170,
          background: "#1677ff",
          boxShadow: "0 4px 12px rgba(22,119,255,0.18)",
        }}
      >
        {checking ? "Đang kiểm tra..." : "Kiểm tra dữ liệu"}
      </Button>
    </div>
  </div>

  {/* THÔNG TIN BỘ LỌC */}
  {examDoctorCode && (
    <div className="medguard-filter-active">
      <InfoCircleFilled style={{ color: "#1677ff" }} />

      <span>
        Đang xem hồ sơ có công khám của BS{" "}
        <strong>
          {examDoctorByCode.get(examDoctorCode)?.name ||
            examDoctorCode}
        </strong>
      </span>

      <span style={{ color: "#64748b" }}>
        • {total.toLocaleString("vi-VN")} hồ sơ theo bộ lọc
      </span>

      <Button
        type="link"
        size="small"
        onClick={() => {
          setExamDoctorCode(undefined);
          setPage(1);
        }}
      >
        Bỏ lọc bác sĩ
      </Button>
    </div>
  )}
</Card>



      {/* ==================================================
          TABLE
      ================================================== */}

      <div
        ref={
          tableAreaRef
        }

        style={{
          flex:
            1,

          minHeight:
            0,

          overflow:
            "hidden",
        }}
      >

        <Card
          style={{
            ...panelStyle,

            height:
              "100%",

            overflow:
              "hidden",
          }}

          styles={{
            body: {
              padding:
                0,

              height:
                "100%",

              display:
                "flex",

              flexDirection:
                "column",

              overflow:
                "hidden",
            },
          }}
        >

          {/* ==============================================
              HEADER TABLE
          ============================================== */}

          <div
            className="medguard-case-table-header"
            style={{
              padding:
                "10px 14px",

              display:
                "flex",

              justifyContent:
                "space-between",

              alignItems:
                "center",

              borderBottom:
                "1px solid #f0f0f0",

              flexShrink:
                0,
            }}
          >

            <div>

              <Typography.Text
                strong

                style={{
                  fontSize:
                    14,
                }}
              >
                Hồ sơ khám chữa bệnh
              </Typography.Text>


              <Typography.Text
                type="secondary"

                style={{
                  marginLeft:
                    8,

                  fontSize:
                    11,
                }}
              >
                {total} hồ sơ
              </Typography.Text>

            </div>


            <Typography.Text
              type="secondary"

              style={{
                fontSize:
                  11,
              }}
            >
              {lastViewedCase
                ? `Vừa xem: ${lastViewedCase.ma_bn || "—"} - ${lastViewedCase.ho_ten || ""}`
                : "Hồ sơ có lỗi hoặc cảnh báo có thể bấm để xem chi tiết"}
            </Typography.Text>

          </div>


          {/* ==============================================
              CHỈ PHẦN TABLE ĐƯỢC CUỘN
          ============================================== */}

          <div
            className="medguard-case-table-content"
            style={{
              flex: 1,
              minHeight: 0,
              overflow: "hidden",
              position: "relative",
            }}
          >

            <Table<
              MedicalCase
            >
              className="medguard-case-table-fixed"

              // Bắt AntD tạo body mới khi chuyển trang, tránh giữ vị trí scroll cũ.
              key={`${page}-${pageSize}`}
              rowKey="id"

              loading={
                loading
              }

              dataSource={
                cases
              }

              size="middle"

              scroll={{
                x:
                  1750,

                y:
                  tableScrollY,
              }}

              rowClassName={(record) => {
                const classes: string[] = [];
                if (record.status === "ERROR") classes.push("medguard-row-error");
                if (record.status === "OK") classes.push("medguard-row-ok");
                if (record.id === lastViewedCase?.id) classes.push("medguard-row-last-viewed");
                return classes.join(" ");
              }}

              pagination={false}

              columns={[

                // =========================================
                // TRẠNG THÁI
                // =========================================

                {
                  title:
                    "Trạng thái",

                  dataIndex:
                    "status",

                  width:
                    145,

                  fixed:
                    "left",

                  render:
                    (
                      value,
                      record
                    ) =>
                      renderCaseStatus(
                        value,
                        record
                      ),
                },


                // =========================================
                // MÃ BN
                // =========================================

                {
                  title:
                    "Mã BN",

                  dataIndex:
                    "ma_bn",

                  width:
                    110,

                  render:
                    (
                      value
                    ) => (

                      <Typography.Text
                        strong
                      >
                        {value}
                      </Typography.Text>

                    ),
                },


                // =========================================
                // HỌ TÊN
                // =========================================

                {
                  title:
                    "Họ và tên",

                  dataIndex:
                    "ho_ten",

                  width:
                    190,

                  render:
                    (
                      value,
                      record
                    ) => (

                      record.status === "OK" ? (
                        <Typography.Text style={{ fontWeight: 600, color: "#334155" }}>
                          {value}
                        </Typography.Text>
                      ) : (
                        <Typography.Link
                          style={{ fontWeight: 600 }}
                          onClick={() => openCaseResults(record)}
                        >
                          {value}
                        </Typography.Link>
                      )

                    ),
                },


                {
                  title: "Bác sĩ công khám",
                  key: "exam_doctor",
                  width: 220,
                  render: (_: unknown, record: MedicalCase) => {
                    const doctors = examDoctorByMaLk.get(record.ma_lk || "") || [];
                    return doctors.length ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        {doctors.map(d => (
                          <Typography.Text key={d.code} style={{ fontSize: 12 }}>
                            {d.name?.trim() || d.code}
                          </Typography.Text>
                        ))}
                      </div>
                    ) : (
                      <Typography.Text type="secondary">—</Typography.Text>
                    );
                  },
                },

                // =========================================
                // =========================================
                // MÃ THẺ
                // =========================================

                {
                  title:
                    "Mã thẻ",

                  dataIndex:
                    "ma_the_bhyt",

                  width:
                    170,
                },


                // =========================================
                // GIỚI TÍNH
                // =========================================

                {
                  title:
                    "Giới tính",

                  dataIndex:
                    "gioi_tinh",

                  width:
                    90,

                  render:
                    renderGender,
                },


                // =========================================
                // LOẠI KCB
                // =========================================

                {
                  title:
                    "Loại KCB",

                  dataIndex:
                    "ma_loai_kcb",

                  width:
                    100,
                },


                // =========================================
                // NGÀY VÀO
                // =========================================

                {
                  title:
                    "Ngày vào",

                  dataIndex:
                    "ngay_vao",

                  width:
                    160,

                  render:
                    formatDate,
                },


                // =========================================
                // NGÀY RA
                // =========================================

                {
                  title:
                    "Ngày ra",

                  dataIndex:
                    "ngay_ra",

                  width:
                    160,

                  render:
                    formatDate,
                },


                // =========================================
                // TỔNG CHI
                // =========================================

                {
                  title:
                    "Tổng chi",

                  dataIndex:
                    "t_tongchi",

                  align:
                    "right",

                  width:
                    130,

                  render:
                    (
                      value
                    ) => (

                      <Typography.Text
                        strong
                      >
                        {
                          formatMoney(
                            value
                          )
                        }
                      </Typography.Text>

                    ),
                },


                // =========================================
                // BỆNH NHÂN TT
                // =========================================

                {
                  title:
                    "Bệnh nhân TT",

                  dataIndex:
                    "t_bntt",

                  align:
                    "right",

                  width:
                    130,

                  render:
                    formatMoney,
                },


                // =========================================
                // BẢO HIỂM TT
                // =========================================

                {
                  title:
                    "Bảo hiểm TT",

                  dataIndex:
                    "t_bhtt",

                  align:
                    "right",

                  width:
                    130,

                  render:
                    (
                      value
                    ) => (

                      <Typography.Text
                        style={{
                          color:
                            "#1677ff",

                          fontWeight:
                            600,
                        }}
                      >
                        {
                          formatMoney(
                            value
                          )
                        }
                      </Typography.Text>

                    ),
                },


                // =========================================
                // NGÀY THANH TOÁN
                // =========================================

                {
                  title:
                    "Ngày thanh toán",

                  dataIndex:
                    "ngay_ttoan",

                  width:
                    170,

                  render:
                    formatDate,
                },

              ]}
            />

          </div>

          <div className="medguard-case-pagination-footer">
            <Pagination
              current={page}
              pageSize={pageSize}
              total={total}
              showSizeChanger
              pageSizeOptions={["10", "50", "100"]}
              showTotal={value => `Tổng số: ${value}`}
              responsive
              onChange={(newPage, newPageSize) => {
                if (newPageSize !== pageSize) {
                  setPageSize(newPageSize);
                  setPage(1);
                } else {
                  setPage(newPage);
                }
              }}
            />
          </div>

        </Card>

      </div>


      {/* ==================================================
          STYLE
      ================================================== */}

      <style>
        {`

          /* ===============================================
             TABLE FIXED
          =============================================== */

          .medguard-case-table-fixed {
            min-height: 0;
          }


          .medguard-case-table-fixed
          .ant-spin-nested-loading,

          .medguard-case-table-fixed
          .ant-spin-container,

          .medguard-case-table-fixed
          .ant-table,

          .medguard-case-table-fixed
          .ant-table-container {
            min-height: 0;
          }


          /* ===============================================
             CHỈ BODY TABLE SCROLL
          =============================================== */

          .medguard-case-table-fixed
          .ant-table-body {
            overflow-y: auto !important;

            overscroll-behavior:
              contain;
          }


          /* ===============================================
             HEADER TABLE
          =============================================== */

          .medguard-case-table-fixed
          .ant-table-thead
          > tr
          > th {
            background:
              #f8fafc !important;

            color:
              #334155 !important;

            font-weight:
              700 !important;

            border-bottom:
              1px solid #e8edf3 !important;
          }


          /* ===============================================
             ROW
          =============================================== */

          .medguard-case-table-fixed
          .ant-table-tbody
          > tr
          > td {
            transition:
              background 0.18s ease;
          }


          .medguard-case-table-fixed
          .ant-table-tbody
          > tr:hover
          > td {
            background:
              #f5f9ff !important;
          }


          .medguard-case-table-fixed
          .medguard-row-error
          > td:first-child {
            box-shadow:
              inset 3px 0 0 #ff4d4f;
          }


          .medguard-case-table-fixed
          .medguard-row-ok
          > td:first-child {
            box-shadow:
              inset 3px 0 0 #52c41a;
          }


          /* Đánh dấu hồ sơ vừa đóng modal, ưu tiên cả khi di chuột. */
          .medguard-case-table-fixed
          .ant-table-tbody > tr.medguard-row-last-viewed > td,
          .medguard-case-table-fixed
          .ant-table-tbody > tr.medguard-row-last-viewed:hover > td {
            background: #e6f4ff !important;
            border-top: 1px solid #91caff;
            border-bottom: 1px solid #91caff !important;
          }
          .medguard-case-table-fixed
          .ant-table-tbody > tr.medguard-row-last-viewed > td:first-child {
            box-shadow: inset 4px 0 0 #1677ff !important;
          }

          /* Footer phân trang luôn nằm ngoài vùng scroll của bảng */
          .medguard-case-pagination-footer {
            flex: 0 0 auto;
            min-height: 58px;
            display: flex;
            justify-content: flex-end;
            align-items: center;
            padding: 8px 14px;
            background: #fff;
            border-top: 1px solid #edf0f5;
            position: relative;
            z-index: 2;
          }
          .medguard-case-pagination-footer .ant-pagination {
            margin: 0 !important;
          }
          @media (max-width: 700px) {
            .medguard-case-pagination-footer {
              justify-content: center;
              padding-inline: 6px;
            }
          }


          /* ===============================================
             SCROLLBAR TRONG TABLE
          =============================================== */

          .medguard-case-table-fixed
          .ant-table-body::-webkit-scrollbar {
            width:
              8px;

            height:
              8px;
          }


          .medguard-case-table-fixed
          .ant-table-body::-webkit-scrollbar-thumb {
            background:
              #cbd5e1;

            border-radius:
              999px;
          }


          .medguard-case-table-fixed
          .ant-table-body::-webkit-scrollbar-track {
            background:
              #f8fafc;
          }


          /* ===============================================
             RESPONSIVE
          =============================================== */

          @media (
            max-width:
              1100px
          ) {

            .medguard-stat-grid {
              grid-template-columns:
                repeat(
                  2,
                  minmax(
                    180px,
                    1fr
                  )
                ) !important;
            }

          }


          /* ===============================================
             REFRESH
          =============================================== */

          .medguard-refresh-spin {
            animation:
              medguardRefreshSpin
              0.75s
              linear
              infinite;
          }


          @keyframes medguardRefreshSpin {

            from {
              transform:
                rotate(0deg);
            }

            to {
              transform:
                rotate(360deg);
            }

          }


          /* ===============================================
             CHECKING OVERLAY
          =============================================== */

          .medguard-checking-screen {
            position:
              fixed;

            inset:
              0;

            z-index:
              99999;

            display:
              flex;

            align-items:
              center;

            justify-content:
              center;

            background:
              rgba(
                15,
                23,
                42,
                0.14
              );

            backdrop-filter:
              blur(4px);

            -webkit-backdrop-filter:
              blur(4px);
          }


          .medguard-checking-card {
            display:
              flex;

            flex-direction:
              column;

            align-items:
              center;

            justify-content:
              center;

            width:
              360px;

            padding:
              34px 38px 30px;

            border-radius:
              22px;

            background:
              rgba(
                255,
                255,
                255,
                0.97
              );

            border:
              1px solid
              rgba(
                255,
                255,
                255,
                0.8
              );

            box-shadow:
              0 28px 80px
              rgba(
                15,
                23,
                42,
                0.22
              );
          }


          .medguard-checking-orbit {
            position:
              relative;

            width:
              90px;

            height:
              90px;

            margin-bottom:
              20px;
          }


          .medguard-checking-ring {
            position:
              absolute;

            border-radius:
              50%;
          }


          .medguard-checking-ring-a {
            inset:
              0;

            border:
              4px solid
              rgba(
                22,
                119,
                255,
                0.12
              );

            border-top-color:
              #1677ff;

            border-right-color:
              #4096ff;

            animation:
              medguardCheckingSpin
              1.05s
              linear
              infinite;
          }


          .medguard-checking-ring-b {
            inset:
              11px;

            border:
              3px solid
              rgba(
                22,
                119,
                255,
                0.08
              );

            border-left-color:
              #91caff;

            border-bottom-color:
              #69b1ff;

            animation:
              medguardCheckingSpinReverse
              1.55s
              linear
              infinite;
          }


          .medguard-checking-core {
            position:
              absolute;

            inset:
              23px;

            display:
              flex;

            align-items:
              center;

            justify-content:
              center;

            border-radius:
              50%;

            color:
              #ffffff;

            font-size:
              24px;

            background:
              linear-gradient(
                135deg,
                #1677ff 0%,
                #4096ff 55%,
                #69b1ff 100%
              );

            box-shadow:
              0 10px 25px
              rgba(
                22,
                119,
                255,
                0.34
              );
          }


          .medguard-checking-title {
            font-size:
              19px;

            font-weight:
              800;

            color:
              #172033;
          }


          .medguard-checking-subtitle {
            margin-top:
              7px;

            font-size:
              13px;

            color:
              #64748b;
          }


          .medguard-checking-count {
            margin-top:
              16px;

            display:
              flex;

            align-items:
              baseline;

            justify-content:
              center;

            gap:
              5px;

            color:
              #334155;

            font-size:
              15px;

            font-weight:
              700;
          }


          .medguard-checking-count-current {
            color:
              #1677ff;

            font-size:
              18px;

            font-weight:
              800;
          }


          .medguard-checking-percent {
            margin-top:
              5px;

            color:
              #1677ff;

            font-size:
              28px;

            line-height:
              1.2;

            font-weight:
              800;
          }


          .medguard-checking-progress {
            position:
              relative;

            width:
              240px;

            height:
              7px;

            margin-top:
              15px;

            overflow:
              hidden;

            border-radius:
              999px;

            background:
              #e8eef7;
          }


          .medguard-checking-progress-bar {
            position:
              absolute;

            top:
              0;

            left:
              0;

            bottom:
              0;

            width:
              0%;

            border-radius:
              999px;

            background:
              linear-gradient(
                90deg,
                #1677ff,
                #4096ff,
                #69b1ff
              );

            transition:
              width 0.35s ease;
          }


          .medguard-checking-remaining {
            margin-top:
              9px;

            color:
              #64748b;

            font-size:
              12px;

            font-weight:
              500;
          }


          .medguard-checking-remaining strong {
            color:
              #334155;

            font-weight:
              800;
          }


          .medguard-checking-dots {
            display:
              flex;

            gap:
              6px;

            margin-top:
              15px;
          }


          .medguard-checking-dots span {
            width:
              7px;

            height:
              7px;

            border-radius:
              50%;

            background:
              #1677ff;

            animation:
              medguardCheckingDot
              1.2s
              ease-in-out
              infinite;
          }


          .medguard-checking-dots
          span:nth-child(2) {
            animation-delay:
              0.15s;
          }


          .medguard-checking-dots
          span:nth-child(3) {
            animation-delay:
              0.3s;
          }


          .medguard-checking-note {
            margin-top:
              10px;

            font-size:
              12px;

            color:
              #94a3b8;
          }


          @keyframes medguardCheckingSpin {

            from {
              transform:
                rotate(0deg);
            }

            to {
              transform:
                rotate(360deg);
            }

          }


          @keyframes medguardCheckingSpinReverse {

            from {
              transform:
                rotate(360deg);
            }

            to {
              transform:
                rotate(0deg);
            }

          }


          @keyframes medguardCheckingDot {

            0%,
            80%,
            100% {
              opacity:
                0.25;

              transform:
                translateY(0)
                scale(0.85);
            }

            40% {
              opacity:
                1;

              transform:
                translateY(-5px)
                scale(1);
            }

          }
            
/* ==================================================
   MEDGUARD - MODERN FILTER UI
================================================== */

.medguard-filter-panel {
  overflow: visible;
}

.medguard-filter-field {
  min-width: 0;
}

.medguard-filter-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
  color: #52647d;
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
}

.medguard-filter-panel .ant-input-affix-wrapper,
.medguard-filter-panel .ant-select-selector,
.medguard-filter-panel .ant-picker {
  border-color: #e1e8f2 !important;
  border-radius: 9px !important;
  background: #ffffff !important;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.medguard-filter-panel .ant-input-affix-wrapper:focus-within,
.medguard-filter-panel .ant-picker-focused,
.medguard-filter-panel .ant-select-focused .ant-select-selector {
  border-color: #1677ff !important;
  box-shadow: 0 0 0 3px rgba(22, 119, 255, 0.09) !important;
}

.medguard-filter-actions-row {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #f0f3f8;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 14px;
}

.medguard-filter-date-fields {
  display: grid;
  grid-template-columns: 110px 145px 190px;
  gap: 10px;
}

.medguard-filter-buttons {
  display: flex;
  align-items: center;
  gap: 9px;
  padding-bottom: 0;
}

.medguard-filter-active {
  margin-top: 11px;
  padding: 8px 12px;
  border-radius: 9px;
  background: #f3f8ff;
  border: 1px solid #e2edff;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  font-size: 12px;
  color: #334155;
}

@media (max-width: 1400px) {
  .medguard-filter-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
  }
}

@media (max-width: 1100px) {
  .medguard-filter-actions-row {
    flex-wrap: wrap;
  }

  .medguard-filter-buttons {
    margin-left: auto;
  }
}

@media (max-width: 780px) {
  .medguard-filter-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  }

  .medguard-filter-date-fields {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    width: 100%;
  }

  .medguard-filter-buttons {
    width: 100%;
    justify-content: flex-end;
  }
}

@media (max-width: 520px) {
  .medguard-filter-grid {
    grid-template-columns: 1fr !important;
  }

  .medguard-filter-date-fields {
    grid-template-columns: 1fr;
  }

  .medguard-filter-buttons {
    flex-direction: column;
    align-items: stretch;
  }

  .medguard-filter-buttons .ant-btn {
    width: 100%;
  }
}
  
/* ============================================
   MEDGUARD - COMPACT FILTER
   Thu gọn bộ lọc, tăng chiều cao TABLE
============================================ */

.medguard-filter-panel .ant-card-body {
  padding: 8px 12px !important;
}

/* Thu nhỏ các ô */
.medguard-filter-panel .ant-input-affix-wrapper,
.medguard-filter-panel .ant-select-single,
.medguard-filter-panel .ant-select-selector,
.medguard-filter-panel .ant-picker {
  min-height: 30px !important;
  height: 30px !important;
  font-size: 12px !important;
  border-radius: 7px !important;
}

.medguard-filter-panel .ant-select-single .ant-select-selector {
  display: flex;
  align-items: center;
  padding-inline: 9px !important;
}

.medguard-filter-panel .ant-input {
  font-size: 12px !important;
}

.medguard-filter-panel .ant-picker-input > input {
  font-size: 12px !important;
}

/* Nhãn bộ lọc */
.medguard-filter-label {
  font-size: 10px !important;
  margin-bottom: 3px !important;
}

/* Khoảng cách hai hàng */
.medguard-filter-grid {
  gap: 7px !important;
}

.medguard-filter-actions-row {
  margin-top: 7px !important;
  padding-top: 7px !important;
  gap: 8px !important;
}

.medguard-filter-date-fields {
  gap: 7px !important;
}

/* Thu nhỏ nút thao tác */
.medguard-filter-buttons .ant-btn {
  height: 30px !important;
  min-height: 30px !important;
  padding: 0 11px !important;
  font-size: 12px !important;
  border-radius: 7px !important;
}

/* Thu nhỏ thông báo lọc */
.medguard-filter-active {
  margin-top: 6px !important;
  padding: 5px 9px !important;
  font-size: 11px !important;
}

/* Thu gọn tiêu đề của bộ lọc */
.medguard-filter-panel .ant-card-body > div:first-child {
  margin-bottom: 6px !important;
}

/* Thanh tiêu đề bảng */
.medguard-case-table-header {
  padding: 7px 12px !important;
}

/* Hàng bảng gọn hơn để hiện thêm hồ sơ */
.medguard-case-table-fixed .ant-table-tbody > tr > td {
  padding-top: 9px !important;
  padding-bottom: 9px !important;
}

.medguard-case-table-fixed .ant-table-thead > tr > th {
  padding-top: 9px !important;
  padding-bottom: 9px !important;
}
  
@keyframes medguard-quote-fade {
  from {
    opacity: 0;
    transform: translateY(5px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}




        `}
      </style>


      {/* ==================================================
          MODAL CHI TIẾT
      ================================================== */}

      <CaseCheckResultsModal
        open={
          resultCase !==
          null
        }

        caseId={
          resultCase
            ?.id ??
          null
        }

        patientCode={
          resultCase
            ?.ma_bn ??
          ""
        }

        patientName={
          resultCase
            ?.ho_ten ??
          ""
        }

        treatmentGroup={resultCase?.treatment_group}

        onClose={closeCaseResults}
      />


      {/* ==================================================
          OVERLAY CHECKING
      ================================================== */}

      {
        checking && (

          <div
            className="medguard-checking-screen"
          >

            <div
              className="medguard-checking-card"
            >

              <div
                className="medguard-checking-orbit"
              >

                <div
                  className="
                    medguard-checking-ring
                    medguard-checking-ring-a
                  "
                />


                <div
                  className="
                    medguard-checking-ring
                    medguard-checking-ring-b
                  "
                />


                <div
                  className="medguard-checking-core"
                >
                  <SafetyCertificateOutlined />
                </div>

              </div>


              <div
                className="medguard-checking-title"
              >
                Đang kiểm tra dữ liệu
              </div>


              <div
                className="medguard-checking-subtitle"
              >
                Hệ thống đang đối chiếu hồ sơ BHYT
              </div>


              <div
                className="medguard-checking-count"
              >

                <span
                  className="medguard-checking-count-current"
                >
                  {
                    checkProgress
                      .processedCases
                  }
                </span>


                <span>
                  /
                </span>


                <span>
                  {
                    checkProgress
                      .totalCases
                  }
                </span>


                <span>
                  hồ sơ
                </span>

              </div>


              <div
                className="medguard-checking-percent"
              >
                {
                  Math.max(
                    0,

                    Math.min(
                      100,

                      checkProgress
                        .percent
                    )
                  )
                }
                %
              </div>


              <div
                className="medguard-checking-progress"
              >

                <div
                  className="medguard-checking-progress-bar"

                  style={{
                    width:
                      `${Math.max(
                        0,

                        Math.min(
                          100,

                          checkProgress
                            .percent
                        )
                      )}%`,
                  }}
                />

              </div>


             
{/* <div
  className="medguard-checking-remaining"
  style={{
    padding: "8px 14px",
    minHeight: 54,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
  }}
>
  <span
    key={quoteIndex}
    style={{
      color: "#475569",
      fontSize: 12,
      fontWeight: 600,
      fontStyle: "italic",
      lineHeight: 1.6,
      animation: "medguard-quote-fade 0.5s ease",
    }}
  >
    “{MEDGUARD_QUOTES[quoteIndex]}”
  </span>
</div> */}



              <div
                className="medguard-checking-dots"
              >
                <span />
                <span />
                <span />
              </div>


              <div
                className="medguard-checking-note"
              >
                Vui lòng chờ trong giây lát
              </div>

            </div>

          </div>

        )
      }

    </div>
  );
}