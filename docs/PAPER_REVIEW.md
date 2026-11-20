# Rà soát hồ sơ BHYT — bản đầu

Menu **Rà soát hồ sơ BHYT**, đường dẫn `/paper-review`.

**Cập nhật 16/11: đã bổ sung chế độ AI qua OpenAI API.** Xem [PAPER_REVIEW_AI.md](PAPER_REVIEW_AI.md) để bật tự đọc/ghép/chạy rule và đọc lại lô đã tải. Các mô tả “OCR nội bộ / cần xác nhận mỗi trang” bên dưới áp dụng chế độ Tesseract mặc định. Bản code mới cần cả migration 20261115 và 20261116, kể cả giữ chế độ Tesseract.

## Đã thực hiện

- Tải nhiều PNG/JPEG/PDF vào một lô, tải lần lượt từng file. 20 MB/file, 500 trang/PDF, tối đa 1.000 file chờ mỗi chi nhánh. Chống trùng SHA-256 trong cùng lô.
- OCR Tesseract tiếng Việt + Anh tại backend; không gọi dịch vụ AI bên ngoài. PDF được raster từng trang bằng Poppler, cạnh dài 2.400 px. Một worker xử lý tuần tự, Tesseract giới hạn một thread.
- Hàng đợi PostgreSQL, lease/heartbeat, phục hồi file đang xử lý khi tiến trình dừng. File lỗi có nút thử lại; giữ các trang đã nhận diện/đã sửa khi thử lại.
- Gợi ý loại giấy và thông tin bệnh nhân/ICD theo nhãn. Mỗi trang mới **chưa xác nhận**, **chưa ghép ca**. Không tự ghép chỉ bằng mã bệnh nhân. Nút “Ghép gợi ý” chỉ áp dụng khi đọc được mã lượt/số phiếu **và** ngày khám hợp lệ; vẫn phải xác nhận trang.
- Chọn nhiều trang rồi ghép vào mã nhóm lượt khám; xem ảnh cạnh dữ liệu, sửa OCR, xác nhận nội dung, ghi chú và trạng thái xử lý. Bấm trường/phát hiện để tô các dòng OCR liên quan nếu có; vùng thiếu không có chữ để tô.
- Rule cấu hình theo chi nhánh: thiếu ngày sinh, giới tính, ICD; cân nặng mặc định tắt; khác thông tin giữa các giấy cùng ca; ICD trên đơn chưa có trong bảng kê cùng ca. Có kiểm tra định dạng ngày, giới tính, cân nặng, ICD.
- Chỉ báo **Lỗi** khi các trang liên quan đã được người dùng xác nhận. Trước đó là **Cần xác minh**. Trạng thái “Đã xử lý” không tự làm mất lỗi rule.
- Xuất Excel kết quả từng trang và ghi chú; lưu lịch sử sửa, chống ghi đè khi hai người sửa cùng trang.
- Cả SQL RLS và truy vấn API đều giới hạn chi nhánh. Ảnh xem trước được chuẩn hóa hướng EXIF/kích thước bởi Sharp, cùng tọa độ OCR; bản gốc vẫn giữ nguyên. Ảnh chỉ được trả qua API đăng nhập, không có static/public scan folder.

## Chưa thực hiện

- Đối chiếu tên thuốc/hàm lượng/số lượng/tiền và dịch vụ chi tiết giữa giấy tờ.
- Kết nối XML; kiểm tra tính phù hợp chỉ định/điều kiện thanh toán; đối chiếu hiệu lực ICD với danh mục.
- Nhận diện/xác thực chữ ký, tự động tách ảnh nhiều tờ chồng lên nhau, đọc chữ viết tay.
- Tự ghép toàn bộ giấy của 200–350 ca hoặc chứng nhận hồ sơ đủ giấy. Cần ghép và xác nhận nhóm lượt khám trong bản đầu.
- Chưa đo tải vận hành 200–350 ca/ngày trên VPS thật. Giới hạn file/hàng đợi không phải cam kết thông lượng.

## Cài trên máy local hoặc VPS

1. Sao lưu DB như quy trình hiện có. Dùng tài khoản owner/admin chạy migration `backend/migrations/20261115_paper_review.sql` trên **đúng database backend dùng**. Migration yêu cầu `auth.branches`, `auth.users`, `auth.current_branch_id()` và role `medguard_branch` từ hệ thống hiện có. Chạy một lần; migration không xóa/sửa dữ liệu XML cũ. Không cần track bảng mới qua Hasura vì module dùng REST.

2. Cài OCR trên Ubuntu/Debian:

   ```bash
   sudo apt-get update
   sudo apt-get install -y tesseract-ocr tesseract-ocr-vie tesseract-ocr-eng poppler-utils
   tesseract --list-langs
   ```

   Phải có `vie` và `eng`. Trên Windows, cài Tesseract có hai bộ ngôn ngữ và Poppler rồi thêm thư mục chứa `tesseract`, `pdfinfo`, `pdftoppm` vào PATH của tiến trình Node. Khởi động lại terminal/service sau khi sửa PATH. Có thể dùng Dockerfile backend đã bổ sung các công cụ để tránh cài thủ công.

3. Cấu hình backend `.env` (không commit):

   ```dotenv
   # Ví dụ Linux. Trên Windows dùng đường dẫn tuyệt đối tương ứng.
   PAPER_REVIEW_STORAGE=/var/lib/medguard/paper-review
   PAPER_REVIEW_ENABLED=true
   ```

   Tạo thư mục và cấp quyền ghi riêng cho user chạy Node. Mặc định lưu `./data/paper-review` tương đối với thư mục khởi chạy backend. Giữ vị trí này ổn định qua lần triển khai; đặt ngoài source checkout khi chạy VPS. Có thể đặt `PAPER_REVIEW_ENABLED=false` để dừng nhận file/worker mới.

4. Build/restart backend và frontend theo quy trình triển khai hiện có. Dependency `sharp` và lockfile đã được cập nhật; cần chạy `npm ci` để cài:

   ```bash
   cd backend
   npm ci
   npm run build
   npm start
   ```

   Frontend: `cd frontend`, `npm ci`, `npm run build`. Restart backend bằng công cụ quản lý tiến trình đang dùng, không chạy thêm bản trùng cổng.

5. Docker backend: build lại image. Gắn volume bền vững tại `/app/data`. Nếu nhiều backend replica thì **phải dùng cùng storage mount** và giảm số replica/worker phù hợp, vì giới hạn tuần tự áp dụng theo từng tiến trình. Volume mới phải cho UID node quyền ghi. Docker Compose hiện tại chỉ quản lý PostgreSQL/Hasura và không tự triển khai API.

6. Kiểm tra reverse proxy cho phép request multipart ít nhất 21 MB và timeout tải file phù hợp; mỗi request UI chỉ gửi một file. Không tăng thành request chứa toàn bộ 350 ca.

## Sử dụng / nghiệm thu

1. Mở menu, kiểm tra trạng thái sẵn sàng (migration, OCR). Tạo lô và chọn nhiều file, chờ tải xong trước khi đóng trang. Có thể rời trang sau đó; worker tiếp tục ở backend.
2. Scan mỗi mặt giấy riêng, đủ góc, không chồng giấy. Dùng PDF scan 200–300 dpi; thử một lô nhỏ 5–10 ca trước.
3. Chọn các trang cùng lượt khám, nhập mã nhóm duy nhất (mã lượt + ngày). Không dùng riêng mã bệnh nhân nếu có nhiều lượt.
4. Mở từng trang, kiểm tra/sửa các thông tin, chọn đúng loại giấy, xác nhận. “Trang tiếp / trang ký” được miễn rule thiếu thông tin đầu trang; vẫn phải ghép ca và xác nhận.
5. Không điền thêm thông tin lấy từ giấy khác vào một trường thực sự trống trên giấy đang kiểm tra. Ghi chú nguồn và đánh dấu cần bổ sung. Nếu giấy có ngày sai vẫn nhập đúng như giấy để rule phát hiện.
6. Kiểm tra lỗi và đối chiếu ảnh. Xuất Excel. Rule không xác nhận tính hợp lệ thanh toán hay bảo đảm không bị xuất toán.
7. Đăng nhập chi nhánh khác: không thấy lô/ảnh/kết quả chi nhánh trước. Kiểm tra API ảnh/file/page với ID bên kia phải trả 404. Tải lại cùng file trong cùng lô được bỏ qua.
8. Thử dừng backend giữa OCR rồi chạy lại: sau khi lease hết hạn (2 phút), file được lấy lại, tối đa 3 lần claim tự động; nút thử lại đặt lại số lần sau khi sửa lỗi máy chủ.

## Vận hành dữ liệu

Sao lưu đồng thời PostgreSQL (schema `paper_review`) và thư mục `PAPER_REVIEW_STORAGE`; DB không chứa bytes ảnh gốc. Chỉ sao lưu DB sẽ không khôi phục ảnh được. Không đưa hồ sơ/ảnh/OCR hoặc bản sao DB lên GitHub. `.gitignore` đã bỏ qua `backend/data/`.

Xóa lô trong UI xóa trang, metadata và file của lô khi không còn file chờ/đang xử lý. Lịch sử sửa trong `paper_review.audit` vẫn được giữ để truy vết (có thể chứa thông tin bệnh nhân), cần áp dụng chính sách lưu/xóa hồ sơ của đơn vị. Nếu lỗi hệ thống file, có thể còn thư mục mồ côi cần quản trị viên dọn sau khi kiểm tra. Không có dọn file tự động theo thời gian trong bản đầu.

## Kiểm thử

```bash
cd backend
node --import tsx --test tests/paper-review.test.ts
npm run build
```

Các test tập trung vào tránh kết luận lỗi từ OCR chưa xác nhận, ghép lượt, ICD theo chuyên khoa, ngày không hợp lệ, rule cân nặng và tọa độ OCR. Test tích hợp riêng dùng PostgreSQL tạm với dữ liệu giả, không chạy trên DB bệnh nhân.

## Kết quả kiểm tra bản triển khai đầu

- Build backend/frontend và lint riêng trang mới đã qua.
- 9 unit test và 1 integration test trên PostgreSQL tạm đã qua: PDF nhiều trang, JPEG chuẩn hóa, chống trùng, xác thực, RLS hai chi nhánh, ghép gợi ý, sửa có version, lưu lịch sử, Excel, phục hồi lease và xóa lô.
- Đã thử OCR tại chỗ trên 7 ảnh tham chiếu: vẫn thiếu nhiều trường; ảnh nghiêng/chồng giấy không đủ tin cậy để dùng hoàn toàn tự động. Không đưa ảnh hay dữ liệu OCR thực tế vào repository.
- Chưa hoàn tất kiểm thử trực quan bằng trình duyệt: Chromium trong môi trường kiểm thử bị chặn khởi chạy socket hệ thống. Cần mở giao diện thực tế để nghiệm thu màn hình và thử lô scan rõ trước khi đưa vào vận hành.
- Chưa chạy migration hoặc thay đổi dữ liệu trên máy local/VPS của người dùng.

Integration test dành riêng cho PostgreSQL tạm và database mới tên `medguard_review_test`; cần user có quyền tạo schema/role và OCR đã cài:

```bash
TEST_DATABASE_URL=postgres://test_user@localhost:5432/medguard_review_test node --import tsx --test tests/paper-review.integration.ts
```

Không chạy integration test trên database đang dùng thật.
