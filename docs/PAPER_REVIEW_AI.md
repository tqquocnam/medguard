# Đọc hồ sơ BHYT bằng AI qua API

Bổ sung ngày 16/11/2026 cho mục `/paper-review`. Mặc định hệ thống vẫn dùng Tesseract; chỉ gọi dịch vụ ngoài sau khi cấu hình `PAPER_REVIEW_READER=openai` và API key ở backend.

## Luồng tự động

1. Tải nhiều ảnh/PDF như trước. Backend chuẩn hóa từng trang, giữ màu cho AI và gửi ảnh đến OpenAI Responses API bằng kết nối HTTPS.
2. AI phân loại bảng kê/đơn thuốc/phiếu chỉ định/trang tiếp, trích xuất mã bệnh nhân, mã lượt, họ tên, ngày sinh, giới tính, ngày khám, cân nặng, ICD. Mỗi trường có trích đoạn và trạng thái đọc được / thực sự thiếu / chưa đọc chắc. Không tự điền giá trị cho trường mờ hoặc bị che.
3. Tự ghép theo **mã lượt hoặc số phiếu được in rõ + ngày khám**. Không dùng riêng mã bệnh nhân hay suy đoán từ thứ tự ảnh. Ngày sinh chỉ có năm không được tự đổi thành 01/01.
4. MedGuard chạy các rule thông tin/ICD đang bật, không để AI tự kết luận điều kiện thanh toán. Trang có định danh rõ, loại giấy đã xác định, các trường liên quan không mơ hồ và nhóm lượt phù hợp được chạy rule tự động, **không cần nhập tay hoặc tích xác nhận từng trang**.
5. Trường không rõ, ảnh bị che, thiếu dấu hiệu ghép hoặc mâu thuẫn dữ liệu vẫn được đưa ra xem lại. “AI đã đọc tự động” khác với “Người dùng đã xác nhận”; cột `confirmed` không bị tự đổi thành true.

Đây là tự động hóa theo đầu ra của mô hình, không phải chứng minh độ chính xác. AI có thể đọc sai cả khi không tự báo mơ hồ. Cần nghiệm thu độ chính xác trên hồ sơ scan thực tế trước khi đưa vào vận hành. Không bảo đảm tránh xuất toán.

## Bật trên Windows local đang dùng

1. Lấy code nhánh `feat/bhyt-paper-review`. Giữ cấu hình database và thư mục scan đang có.
2. Trong Hasura **Data → SQL**, dùng nguồn DB backend đang dùng và quyền owner, chạy toàn bộ `backend/migrations/20261116_paper_review_ai.sql`. Không cần track các bảng. Migration thêm cột phục vụ đọc lại và bảng `paper_review.ai_requests`; không xóa dữ liệu hồ sơ cũ.
3. Trong `backend/.env`, bổ sung/chỉnh các dòng sau (không thay toàn bộ file):

   ```dotenv
   PAPER_REVIEW_ENABLED=true
   PAPER_REVIEW_READER=openai
   OPENAI_API_KEY=YOUR_API_KEY_HERE
   PAPER_REVIEW_AI_MODEL=gpt-4.1
   PAPER_REVIEW_AI_DAILY_LIMIT=100
   ```

   Dùng API key thật của tài khoản có quyền truy cập model và quota. Không gửi key trong chat, không đặt trong `frontend/.env` hay biến `VITE_*`, không commit `.env`. Key dùng chung trên backend; giới hạn trang được tính riêng theo chi nhánh.

4. Giữ nguyên `PAPER_REVIEW_STORAGE` đang dùng (ví dụ `D:/MedGuardData/paper-review`); đổi thư mục này sẽ khiến không tìm thấy ảnh đã tải trước đó.
5. Dừng backend cũ. Trong terminal nhận được Poppler, chạy từ thư mục `backend`:

   ```powershell
   npm ci
   npm run build
   npm start
   ```

6. Frontend chạy `npm ci`, `npm run dev` từ thư mục `frontend`, tải lại trang. Màn hình cho biết đang dùng AI qua API. Kiểm tra cấu hình chỉ xác nhận key có trong env và Poppler chạy được; key sai/hết quota chỉ được phát hiện khi gọi API thật.
7. Chọn lô 7 ảnh đã tải, bấm **Đọc lại bằng AI**. Nút này gửi lại các trang chưa có sửa/xác nhận thủ công, giữ ID trang và dữ liệu cũ cho đến khi đọc lại thành công. Không cần xóa lô hoặc tải lại file trùng. Ảnh bạn đã sửa/ghi chú/xác nhận được bảo vệ; không bị worker ghi đè. File chờ được đánh dấu rõ reader (Tesseract/OpenAI); bật AI không tự gửi các file Tesseract đang chờ ra ngoài. Dùng nút đọc lại để chuyển các file chưa xử lý sang AI. Chờ file đang xử lý xong trước khi bấm.
8. Sau khi đọc xong, xem tên, định danh và phát hiện. Mở “Xem / sửa” để xem trích đoạn AI; phần sửa tay được thu gọn và chỉ dùng khi cần.

Không cần cài thêm npm dependency cho phần API. Poppler vẫn cần cho PDF; chế độ OpenAI không yêu cầu Tesseract để đọc ảnh. Chuyển lại `PAPER_REVIEW_READER=tesseract` rồi restart để đọc nội bộ, nhưng các kết quả AI đã lưu vẫn giữ nguồn của chúng; job OpenAI đang chờ sẽ tạm dừng cho tới khi bật lại reader OpenAI.

## Kiểm soát phí và phục hồi

- Mặc định tối đa **100 lượt gọi/ngày/chi nhánh**, theo ngày Việt Nam, lưu trong PostgreSQL. Chỉ tăng `PAPER_REVIEW_AI_DAILY_LIMIT` sau khi đã thử lô nhỏ và xem mức sử dụng trên tài khoản API. Ví dụ 350 ca × 7 trang = 2.450 lượt đọc lần đầu; đọc lại/lỗi/retry có thể phát sinh thêm.
- Một lượt gọi cho mỗi lần thử đọc một trang. Lượt thất bại, kể cả lỗi tiền xử lý trước khi gửi API, cũng tính vào giới hạn để chặn phát sinh thêm. Khi hết mức ngày, file báo lỗi và không gọi thêm API; sau khi có quota hoặc đổi giới hạn, dùng “Thử lại”. Giới hạn mặc định chưa đủ cho vận hành 200–350 ca/ngày.
- UI hiển thị số lượt và token đã ghi nhận cho ngày hiện tại. Token của phản hồi lỗi/timeout/từ chối có thể chưa được ghi nhận đầy đủ; nhà cung cấp có thể vẫn tính phí. Đây không phải bộ giới hạn tiền tuyệt đối hay hóa đơn. Cần kiểm tra usage/budget trên tài khoản API.
- Timeout yêu cầu AI là 90 giây. Không tự gọi lại trong adapter. Hàng đợi có lease/heartbeat; đọc lại được đánh dấu bằng token để khi tiến trình khởi động lại, trang đã hoàn thành cùng đợt không bị gửi lại không cần thiết. Sự cố đúng thời điểm sau khi nhà cung cấp xử lý nhưng trước khi lưu kết quả vẫn có thể dẫn đến gọi lại/tính phí thêm.
- Request dùng `store:false`. Điều này không đồng nghĩa cam kết không có lưu giữ dữ liệu tại nhà cung cấp; áp dụng điều kiện/tùy chọn tài khoản API thực tế. Ảnh bệnh nhân được gửi đến OpenAI ở chế độ này.
- `paper_review.ai_requests` lưu số lượt, model, file/trang và token thành công; không lưu API key. Bảng áp dụng RLS theo chi nhánh. Khi sao lưu database cần bao gồm bảng này để không mất bộ đếm trong ngày.

## Phạm vi còn lại

Phần AI này tự đọc thông tin cơ bản/ICD và tự chạy rule tương ứng. Chưa đối chiếu chi tiết thuốc, số lượng, dịch vụ, chữ ký, XML hoặc xác nhận quyền lợi thanh toán. Trang cuối không có dấu hiệu định danh có thể vẫn cần ghép thủ công. Chưa đo thông lượng 200–350 ca/ngày hoặc độ chính xác trên lô scan thật bằng API key của đơn vị.

## Kiểm thử

```bash
cd backend
node --import tsx --test tests/paper-review.test.ts tests/paper-review.ai.test.ts
npm run build
```

Integration test chỉ dùng DB PostgreSQL mới, tạm thời (`medguard_review_ai_test`), mock nhà cung cấp để kiểm tra payload/schema, auto grouping/rule, reprocess, bảo vệ sửa tay, quota và RLS; không có phí API và không dùng dữ liệu bệnh nhân. Kiểm thử không chứng minh chất lượng nhận diện của model thật.

Kết quả kiểm tra bản ngày 16/11: 19 unit test và 2 integration test (luồng Tesseract và luồng AI giả lập) đều qua; build backend/frontend và lint riêng trang PaperReview cũng qua. Chưa chạy API thật, chưa đánh giá chất lượng nhận diện ảnh thật hoặc kiểm thử trực quan trình duyệt cho các thay đổi AI. Frontend vẫn có cảnh báo bundle lớn từ build hiện tại.
