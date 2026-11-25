# Sổ Chi Tiêu Gia Đình

Web app quản lý thu chi cho 2 người (vợ/chồng). Giao diện lấy từ bản design OpenDesign; dữ liệu nằm trong **Google Sheet**, đọc/ghi qua **Google Apps Script**. Không Firebase, không server, không thẻ, không hoá đơn.

## Tính năng

- Thu nhập có phân loại: lương, thưởng, kinh doanh, lãi/đầu tư, được tặng, khác, hoàn tiền.
- Yêu cầu chi cần **cả hai duyệt**; người gửi được tính là đã đồng ý.
- **Chi gấp**: cả hai có thể chi ngay khi yêu cầu đang chờ duyệt. Tiền trừ ngay, gắn nhãn `Chi gấp`; người còn lại xác nhận hoặc phản đối sau. Không giới hạn số tiền, không gửi email.
- **Huỷ sau khi đã duyệt**: cả hai đều huỷ được, bắt buộc ghi lý do.
- **Từ chối** có ô lý do (không bắt buộc).
- **Sổ vay chi tiết**: cho vay / đi vay, từng người, **không kỳ hạn hoặc có ngày hẹn**, thu/trả một phần, quá hạn. Khoản tiền tự ghi vào sổ thu/chi.
- **Lãi khoản vay**: ghi nhiều kỳ lãi; chọn **trả/thu lãi** (tạo giao dịch tiền mặt) hoặc **cộng vào gốc** (tăng số còn phải trả/thu). Sửa/xoá từng lần lãi.
- **Quên mật khẩu**: gửi **liên kết đặt lại một lần** qua email, hết hạn sau 15 phút; không gửi mật khẩu hiện tại.
- **Phân loại thu/chi** và **lọc theo nhóm** cho cả hai tab.
- **Tìm kiếm** theo tên món, lý do, ghi chú, người gửi; không phân biệt dấu.
- **Báo cáo tháng**: thu nhập thực, chi tiêu, chênh lệch, số dư cuối tháng, so tháng trước, xu hướng 6 tháng, theo người, dòng tiền vay và lãi cho vay/đi vay.
- **Ngân sách theo nhóm**: hạn mức tháng, thanh % và cảnh báo gần/vượt.
- **Ẩn số dư**: mặc định chỉ hiện `••••••`; bấm icon mắt để xem trong 20 giây rồi tự ẩn. Các khoản chờ duyệt/đã duyệt vẫn hiện bình thường.
- **Xuất CSV** thủ công (thu nhập, chi tiêu, vay nợ), không cần Google Drive.
- **PWA**: cài lên màn hình chính, có icon và cache giao diện.

## Kiến trúc

```
Web app (GitHub Pages)
    │  fetch (JSON, kèm token)
    ▼
Google Apps Script Web App  ──  Google Sheet
    - kiểm tra đăng nhập           members
    - khoá ghi (LockService)       incomes
    - trả JSON                     expenses
                                   loans
                                   loanPayments
                                   loanInterests
                                   budgets
```

- Không realtime: app chỉ hỏi **version** mỗi 60 giây; dữ liệu chỉ tải khi version đổi. Quay lại tab thì kiểm tra ngay.
- Đăng nhập bằng tài khoản lưu trong tab `members`. Token ký HMAC, hết hạn sau 30 ngày; đổi mật khẩu sẽ huỷ token cũ.
- Mọi thao tác ghi đều có trạng thái **Đang xử lý…**, khoá nút và chống ghi trùng.

## Cấu trúc file

```
index.html                 khung ứng dụng + các sheet/dialog
reset-password.html        trang đặt lại mật khẩu từ liên kết email
manifest.json              khai báo PWA
sw.js                      service worker (cache giao diện)
build.ps1                  đóng gói asset minified
assets/app.js              logic giao diện (source)
assets/app.css             giao diện (source)
assets/app.min.js          bản đóng gói production (app + api)
assets/app.min.css         bản CSS production
assets/api.js              ⚠️ nơi dán URL Apps Script (source)
assets/reset-password.js   logic trang đặt lại (source)
assets/reset-password.min.js
assets/favicon.svg         icon trình duyệt
assets/icon-192.png        icon PWA
assets/icon-512.png        icon PWA
assets/icon-maskable-512.png
apps-script/Code.gs        backend, dán vào Apps Script
.nojekyll                  để GitHub Pages không xử lý qua Jekyll
```

## Đóng gói &amp; dung lượng

App production dùng file minified, không tải source:

- `assets/app.min.js` — gộp `app.js` + `api.js`, minify.
- `assets/app.min.css` — CSS production đã lược style board/spec của OpenDesign.
- `assets/reset-password.min.js` — chỉ tải khi mở trang đặt lại.

Sau khi sửa `assets/app.js`, `assets/app.css`, `assets/api.js` hoặc `assets/reset-password.js`, chạy:

```powershell
powershell -ExecutionPolicy Bypass -File build.ps1
```

Rồi tăng `?v=` trong `index.html` / `reset-password.html` và `CACHE`/`SHELL` trong `sw.js`.

Dung lượng một lần mở đầu (không tính Google Fonts, icon cài PWA):

| Phần | Raw | Gzip |
|---|---:|---:|
| `index.html` | ~33 KB | ~5,6 KB |
| `app.min.css` | ~55 KB | ~9,8 KB |
| `app.min.js` | ~124 KB | ~34 KB |
| manifest + favicon | ~1,2 KB | ~0,6 KB |
| **Tổng** | **~213 KB** | **~50 KB** |

- `app.min.js` gzip ~34 KB, thấp hơn bản cũ ~37–39 KB.
- GitHub Pages đang trả gzip; nếu trình duyệt nhận Brotli thì tổng khoảng ~42 KB.
- SW chỉ cache shell tối thiểu (index, CSS/JS min, favicon, manifest), không cache icon PWA/reset page; lần mở sau lấy từ cache, gần như không tải lại asset từ GitHub.

## Cài đặt (khoảng 10 phút)

### 1. Tạo Google Sheet

1. Vào <https://sheets.google.com> → tạo bảng tính mới, đặt tên "Sổ Chi Tiêu".
2. Không cần tạo tab — script sẽ tự tạo `members`, `incomes`, `expenses`, `loans`, `loanPayments`, `loanInterests`, `budgets`.

### 2. Dán backend

1. Trong Sheet: **Extensions → Apps Script**.
2. Xoá nội dung mặc định, dán toàn bộ `apps-script/Code.gs`.
3. Bấm **Save** (Ctrl+S).
4. Nếu được hỏi quyền: **Review permissions → chọn tài khoản → Advanced → Go to project (unsafe) → Allow**. Cảnh báo "unsafe" là bình thường với script tự viết.
5. Cấp quyền gửi email: ở thanh chọn hàm phía trên, chọn `authorizeMail` → **Run** → **Allow**. Nếu bỏ qua, nút "Quên mật khẩu" sẽ báo lỗi uỷ quyền.

### 3. Deploy

1. **Deploy → New deployment**.
2. Chọn loại **Web app**.
3. Cấu hình:
   - **Execute as**: `Me`
   - **Who has access**: `Anyone`
4. Bấm **Deploy**, copy URL kết thúc bằng `/exec`.

> Phải chọn `Anyone`. App gọi từ trình duyệt, không có phiên Google. Việc chặn người lạ do token đăng nhập đảm nhiệm.

### 4. Nối web app với backend

Mở `assets/api.js`, thay dòng đầu:

```js
var API_URL = 'PASTE_APPS_SCRIPT_EXEC_URL';
```

bằng URL vừa copy. Sau đó mở `reset-password.html`, sửa `data-reset-endpoint` ở thẻ `<body>` bằng đúng URL `/exec` đó (trang đặt lại mật khẩu dùng fetch riêng).

Cuối cùng chạy `build.ps1` để đóng gói `app.min.js` với URL mới.

### 5. Chạy thử

```powershell
cd F:\Tools\Money
npx serve . -l 4173
```

Mở `http://localhost:4173`. Lần chạy đầu script tự tạo các tab và 2 tài khoản:

| Đăng nhập | Mật khẩu |
|---|---|
| `ongluatlangvang@gmail.com` | `luat123` |
| `thuonglt1210@gmail.com` | `thuong123` |

### 6. Đổi mật khẩu

Dùng **Quên mật khẩu** ở trang đăng nhập để nhận liên kết đặt lại; cách này không cần mở Sheet. Cột `password` trong tab `members` giờ lưu **hash**, không sửa tay.

> **Không đổi cột `id`** (`luat`, `thuong`) sau khi đã có dữ liệu — mọi khoản thu/chi tham chiếu theo id này. Cột `login` thì đổi thoải mái.

### 7. Đưa lên GitHub Pages

1. Tạo repo **public**, push toàn bộ thư mục lên nhánh `main`.
2. Repo → **Settings → Pages** → Source: **Deploy from a branch** → `main` / `/ (root)` → Save.
3. Mở `https://<username>.github.io/<repo>/` trên cả hai điện thoại. Trên Chrome/Android có nút **Cài app**; trên iPhone dùng **Thêm vào màn hình chính**.

Không cần cấu hình domain gì thêm — Apps Script không kiểm tra origin.

## Dữ liệu trong Sheet

**members**

| id | login | name | role | password (hash) | order |
|---|---|---|---|---|---|
| luat | ongluatlangvang@gmail.com | Luật | Chồng | `v1$...` | 1 |
| thuong | thuonglt1210@gmail.com | Thương | Vợ | `v1$...` | 2 |

Mật khẩu mặc định ban đầu là `luat123` / `thuong123`; sau lần chạy đầu script tự đổi cột `password` thành hash. Nên đặt lại mật khẩu ngay sau khi cài.

**incomes**: `id, amount, date, member, note, createdBy, createdAt, category, loanId`

**expenses**: `id, title, amount, category, reason, requester, created, status, agreed, approvedAt, purchasedAt, rejectedBy, rejectedAt, cancelledBy, cancelledAt, cancelReason, rejectNote, urgent, urgentAt, urgentBy, urgentAck, urgentAckAt, urgentAckNote, loanId`

**loans**: `id, type, person, amount, date, dueDate, note, createdBy, createdAt, updatedAt, cashId`

**loanPayments**: `id, loanId, amount, date, note, createdBy, createdAt, cashId`

**loanInterests**: `id, loanId, amount, date, note, mode, createdBy, createdAt, cashId`

**budgets**: `category, amount, updatedAt, updatedBy`

- `agreed` là JSON một ô: `{"luat":true,"thuong":null}`.
- `status`: `pending | approved | purchased | rejected | cancelled`.
- `urgent`: `1` và `urgentAck`: `ok | no | trống`.
- `category` của thu nhập: `salary, bonus, business, interest, gift, other_income, refund` (và `collect`, `borrow`, `loan_interest` do sổ vay tự sinh).
- `category` của chi: `home, utilities, food, transport, shopping, pets, health, education, gifts, entertainment, travel, other` (và `lend`, `repay`, `loan_interest` do sổ vay tự sinh).
- `loanInterests.mode`: `pay` (trả/thu lãi bằng tiền mặt) hoặc `capitalize` (cộng vào gốc).
- Số dư **không lưu**, app tính `tổng thu − tổng đã mua`, nên sửa/xoá là tự đúng lại.

### Nâng cấp từ bản cũ

Sau khi dán `Code.gs` mới, chạy một lần hàm **`setupSchema`** trong Apps Script editor. Hàm chỉ thêm cột/tab còn thiếu, không xoá dữ liệu cũ.

- Thu nhập cũ chưa có nhóm sẽ hiện **Thu nhập khác**; sửa lại nếu muốn báo cáo đẹp.
- Chi cũ chưa có nhóm sẽ hiện **Khác**.
- Tab `loanInterests` được tạo tự động; dữ liệu vay cũ giữ nguyên, chưa có lãi.
- Mật khẩu plaintext cũ tự đổi sang hash ở lần chạy đầu; token cũ hết hiệu lực nên cần đăng nhập lại một lần.

## Luồng nghiệp vụ

### Duyệt và mua

- Người gửi được tính là đã đồng ý ngay khi tạo yêu cầu.
- Người còn lại bấm Đồng ý → `approved`. Với 2 người chỉ cần một lần bấm.
- Bấm "Đã mua" → `purchased`, tiền bị trừ khỏi số dư.
- Sửa yêu cầu đã duyệt → quay về `pending`, phải duyệt lại.

### Chi gấp

- Cả hai bấm được **Chi gấp** trên yêu cầu đang `pending`.
- Tiền trừ ngay, `status=purchased`, `urgent=1`, ghi người chi.
- Người còn lại thấy banner ở Tổng quan, badge trên tab Chi tiêu; bấm **Xác nhận** hoặc **Có vấn đề** (bắt buộc lý do nếu phản đối).
- Phản đối **không hoàn tiền** — tiền đã chi thật; hai người tự sửa/xoá nếu cần.
- Sửa số tiền sau khi đã xác nhận → xác nhận bị reset để người kia xem lại.

### Huỷ và từ chối

- Đang chờ: chỉ người gửi huỷ được; lý do không bắt buộc.
- Đã duyệt (chưa mua): **cả hai** huỷ được; **bắt buộc** nhập lý do.
- Đã mua: không huỷ; sửa/xoá theo quyền hiện tại.
- Từ chối: người còn lại bấm Từ chối, có thể ghi lý do.

### Sổ vay

- **Cho vay**: tạo khoản vay → app tự ghi một khoản chi nhóm `Cho vay`, trừ số dư.
- **Đi vay**: app tự ghi một khoản thu nhóm `Đi vay`, cộng số dư.
- **Thời hạn**: chọn **Không kỳ hạn** (không cần ngày hẹn) hoặc **Có ngày hẹn** (bắt buộc hạn trả). Đổi được khi sửa khoản vay.
- **Thu nợ / Trả nợ**: ghi từng lần, app tự sinh khoản thu/chi tương ứng; số còn lại giảm theo gốc.
- **Lãi khoản vay**: bấm **Ghi lãi** trong chi tiết khoản vay, chọn:
  - **Trả lãi / Thu lãi**: tạo khoản chi/thu nhóm `loan_interest`, không giảm gốc.
  - **Cộng vào gốc**: tăng số còn phải trả/thu, không tạo giao dịch tiền mặt; có thể mở lại khoản đã tất toán.
  - Ghi được nhiều kỳ; sửa/xoá từng lần lãi. Lãi đi vay/cho vay hiện trong báo cáo tháng.
- Khoản tự sinh có nhãn `Khoản vay`; sửa/xoá phải vào tab **Vay nợ**, không sửa trực tiếp trong danh sách chi/thu.
- Số tiền/ngày vay chỉ sửa được khi chưa có lần trả nào; người/kỳ hạn/ghi chú sửa được.
- Không tự nhắc; chỉ hiện cảnh báo quá hạn/sắp đến hạn trong app.

### Đặt lại mật khẩu

- Bấm **Quên mật khẩu** ở trang đăng nhập, nhập đúng email tài khoản.
- Hệ thống gửi **liên kết một lần** đến email đó; liên kết hết hạn sau **15 phút**.
- Mở liên kết → nhập mật khẩu mới (ít nhất 8 ký tự) → đăng nhập lại. Mật khẩu cũ và các phiên cũ bị huỷ.
- Email không chứa mật khẩu hiện tại. Nếu không yêu cầu, bỏ qua email; mật khẩu không đổi.

### Phân loại, lọc, tìm kiếm

- Thanh lọc có 3 nút: Người, Thời gian, **Nhóm**.
- Nhóm được chia cụm: Chi tiêu / Nợ & tài sản; Thu nhập / Tiền vào khác.
- Ô tìm kiếm lọc ngay (debounce), không phân biệt dấu; kết hợp được với mọi bộ lọc và trạng thái.
- Nút "Xoá" xoá cả nhóm, thời gian, người và từ khoá.

### Ẩn số dư

- Mặc định số dư ở Tổng quan và “Số dư cuối tháng” ở Báo cáo đều đang ẩn (`••••••`).
- Bấm icon mắt cạnh số dư để xem; sau **20 giây** tự ẩn lại. Chuyển sang tab khác hoặc ẩn cửa sổ trình duyệt cũng ẩn ngay.
- Chỉ số dư bị ẩn. Các khoản “Chờ duyệt”, “Đã duyệt, chưa mua”, thu nhập, chi tiêu và ngân sách vẫn hiện bình thường.
- Khi số dư âm, pill **Chi vượt thu** vẫn hiện; dòng cảnh báo số tiền chỉ hiện khi mở mắt.

### Ngân sách và báo cáo

- Ngân sách là hạn mức **mỗi tháng**, áp dụng lặp lại; chỉ áp cho nhóm chi tiêu, bỏ qua cho vay/trả nợ.
- Báo cáo tách **thu nhập thực** và **tiền vào khác**, **chi tiêu** và **nợ & tài sản**; số dư cuối tháng tính đến hết tháng đang chọn.
- Xuất CSV tải về máy, có BOM cho Excel, chặn công thức Excel.

## Chống ghi trùng và tốc độ

- Khi bấm Lưu/Gửi/Đồng ý, nút bị khoá ngay và hiện spinner `Đang xử lý…`; mọi nút khác trong cùng hộp thoại/thẻ cũng bị khoá. Bấm thêm không tạo thêm bản ghi.
- Mỗi khoản thu/chi/khoản vay/lần trả có `id` do trình duyệt sinh ra. Server kiểm tra id: nếu đã tồn tại thì trả `ok` luôn, không ghi thêm.
- Sau khi ghi thành công, app cập nhật danh sách tại chỗ; người kia thấy khi version đổi.
- Request có timeout 30 giây; lỗi mạng hiện toast đỏ và mở khoá nút.

## Bảo mật — nói thẳng

- Mật khẩu lưu dạng **hash** `v1$salt$hmac` trong cột `password`; không lưu plaintext. Dữ liệu plaintext cũ được tự động migrate ở lần chạy đầu (token cũ sẽ hết hiệu lực một lần).
- URL `/exec` nằm trong file JS công khai. Ai biết URL vẫn **không đọc/ghi được** nếu không có mật khẩu: mọi hành động đều kiểm tra token.
- Token ký HMAC bằng secret sinh tự động trong Script Properties, hết hạn 30 ngày; đổi mật khẩu huỷ token cũ.
- Không xoá `TOKEN_SECRET` trong Script Properties: secret này cũng là pepper của hash mật khẩu. Nếu mất, phải đặt lại mật khẩu qua liên kết Quên mật khẩu.
- Liên kết đặt lại mật khẩu dùng token ngẫu nhiên, chỉ dùng một lần, hết hạn sau 15 phút; token cũ bị vô hiệu khi mật khẩu đổi. Email chỉ gửi liên kết, không gửi mật khẩu hiện tại.
- Sai mật khẩu 6 lần bị khoá 10 phút.
- Đây là mức bảo mật "đủ cho sổ gia đình", không phải ngân hàng. Đừng dùng mật khẩu bạn dùng ở chỗ khác.

## Giới hạn cần biết

| Điều | Thực tế |
|---|---|
| Realtime | Không. Tối đa 60 giây mới thấy thay đổi của người kia |
| Tốc độ | Mỗi thao tác 0,5–4 giây; `list` đọc 7 tab |
| Ghi đồng thời | `LockService` khoá mọi thao tác ghi |
| Sửa tay Sheet | Được, nhưng **không xoá dòng tiêu đề**, không đổi `id`, `status` phải đúng 5 giá trị; cột `password` là hash, không sửa tay |
| Quota Apps Script | 6 phút mỗi lần chạy, 30 lần đồng thời. App không dùng trigger định kỳ |
| Giới hạn ô Sheet | 10 triệu ô — tab `expenses` 24 cột tương đương ~400.000 dòng |
| Email | Chỉ dùng cho Quên mật khẩu (gửi liên kết đặt lại); app không gửi email chi gấp |

## Đồng bộ khi có thay đổi

Không tải toàn bộ dữ liệu định kỳ. Mỗi lần ghi, backend tăng một biến `DATA_VERSION` trong Script Properties. Client:

1. Mở app → tải dữ liệu một lần, lưu version.
2. Mỗi 60 giây (chỉ khi tab đang hiện) → gọi `version`, chỉ một con số.
3. Version khác → mới gọi `list` tải dữ liệu.
4. Quay lại tab hoặc cửa sổ được focus → kiểm tra ngay.
5. Sau khi tự ghi, client lấy version từ response nên không tự trigger tải lại.

## Bản thiết kế OpenDesign

Bản thiết kế tương tác nằm ngoài repo app, trong project OpenDesign:

```
F:\Design\Opendesign\2e3ad7a9-9d99-4aec-ac26-836579970b90
```

- `index.html` chạy toàn bộ giao diện với dữ liệu mẫu qua `assets/demo-api.js` (không gọi Google Sheet).
- `reset-password.html` là trang đặt lại mật khẩu; bản demo dùng token `demo`.
- `screens.html` là bộ khung mobile/desktop; `components.html` là thư viện thành phần.
- `index.html?signedout=1` xem màn hình đăng nhập; `index.html?as=luat` xem góc nhìn Luật.
- Project design dùng **source** `assets/app.js`, `assets/app.css`; production dùng bản minified.
- Khi sửa giao diện: sửa source trong repo app, chép `index.html`, `assets/app.js`, `assets/app.css` sang project design; đổi import trong `app.js` thành `./demo-api.js?v=...`; sau đó chạy `build.ps1` cho production.
- CSS design có thêm style board/spec cho `screens.html`/`components.html`; CSS production đã lược các style đó.

## PWA

- `manifest.json` + 3 icon; `sw.js` cache shell tối thiểu (index, CSS/JS min, favicon, manifest), không cache API/icon/reset page.
- Lần mở sau, SW trả index từ cache trước để giảm tải GitHub; khi deploy bản mới, SW cài cache mới ở lần mở kế tiếp.
- Chỉ đăng ký service worker trên HTTPS (GitHub Pages). Localhost không đăng ký để tránh cache bản đang sửa.
- Khi cập nhật giao diện: chạy `build.ps1`, tăng `?v=` trong `index.html` + `reset-password.html`, đổi `CACHE`/`SHELL` trong `sw.js`. Người dùng tải lại là nhận bản mới.

## Xuất CSV

- Nút **Xuất CSV** trong tab Báo cáo; chọn Thu nhập, Chi tiêu hoặc Vay nợ.
- File tải về máy, không gửi lên server, không cần Google Drive.
- Có BOM UTF-8 cho Excel; ô bắt đầu bằng `= + - @` được thêm `'` để chặn công thức.

## Giới hạn GitHub Pages & Google (2026)

### GitHub Pages

| Hạng mục | Giới hạn |
|---|---|
| Dung lượng site | 1 GB |
| Băng thông | **100 GB/tháng** — giới hạn mềm |
| Build | 10 lần/giờ (deploy từ branch) |
| Repo | Phải public với tài khoản Free |
| Mục đích | Không dùng cho web thương mại/SaaS |

Toàn bộ app khoảng **355 KB**, không còn font tự host; một lượt mở đầu tải khoảng 330 KB, các lần sau lấy từ cache. 100 GB/tháng tương đương hàng trăm nghìn lượt mở — hai người dùng không thể chạm tới.

### Google Sheet

| Hạng mục | Giới hạn |
|---|---|
| Ô mỗi bảng tính | 10 triệu ô |
| Ký tự mỗi ô | 50.000 |
| Dung lượng Drive | 15 GB (miễn phí) |

Tab `expenses` có 24 cột → 10 triệu ô tương đương **~400.000 dòng**. Với 2 người, vài chục năm mới tới.

### Google Apps Script (tài khoản Gmail)

| Hạng mục | Giới hạn |
|---|---|
| Thời gian mỗi lần chạy | 6 phút |
| Chạy đồng thời | 30 |
| Tổng thời gian trigger/ngày | 90 phút — app **không dùng trigger** |
| Email gửi đi | 100 người nhận/ngày (chỉ Quên mật khẩu) |
| URL Fetch | 20.000/ngày — app không dùng |

App chỉ dùng web app request. Mỗi 60 giây client chỉ gọi `version` (một con số, không đọc Sheet); chỉ khi version đổi mới gọi `list` đọc 7 tab và trả JSON.

- 2 người mở 4 giờ/ngày: ~480 lần kiểm tra version/ngày + vài lần tải dữ liệu.
- 2 người mở 8 giờ/ngày: ~960 lần kiểm tra version/ngày + vài lần tải dữ liệu.

Ràng buộc thực tế là 6 phút/lần chạy và 30 request đồng thời — cả hai đều rất xa.

### Theo dõi

- GitHub: repo → **Insights → Traffic**.
- Apps Script: **Executions**.
- Google Sheet: không cần theo dõi.

## Sửa backend sau này

Sửa `Code.gs` trong Apps Script → **Deploy → Manage deployments → biểu tượng bút chì → Version: New version → Deploy**. URL `/exec` giữ nguyên.

Nếu thêm cột/tab mới, chạy **`setupSchema`** một lần trong editor. Nếu chọn "New deployment" mỗi lần thì URL đổi, phải dán lại vào `api.js`.

## Lỗi thường gặp

| Hiện tượng | Nguyên nhân |
|---|---|
| Nút Đăng nhập mờ, báo "Chưa dán URL Apps Script" | Chưa sửa `API_URL` trong `assets/api.js` |
| "Không kết nối được Google" | Deploy chưa để **Who has access: Anyone**, hoặc mạng chặn |
| "Google trả về dữ liệu không hợp lệ" | Đang mở nhầm URL `/dev` thay vì `/exec` |
| "Sai tên đăng nhập hoặc mật khẩu" | Xem lại cột `login`; nếu quên mật khẩu, dùng **Quên mật khẩu** |
| Đăng nhập được nhưng bảng trống | Chưa có dữ liệu; thêm khoản thu đầu tiên |
| Máy kia không thấy thay đổi | Đợi 60 giây, hoặc chuyển tab đi rồi quay lại |
| Apps Script báo "Authorization required" | Mở Apps Script, chạy thử một hàm bất kỳ rồi Allow |
| Sửa `Code.gs` nhưng app không đổi | Chưa deploy **New version** |
| Thiếu cột/tab sau khi cập nhật | Chạy `setupSchema` trong Apps Script editor |
| Khoản vay không sửa được số tiền | Đã có lần trả/thu; xoá khoản vay rồi tạo lại |
| Khoản chi/thu tự sinh không sửa được | Thuộc sổ vay; sửa trong tab **Vay nợ** |
| Ghi lãi xong không thấy trong sổ thu/chi | Chọn **Cộng vào gốc** thì không tạo giao dịch tiền mặt; số còn lại tăng |
| Số còn phải trả/thu tăng sau khi ghi lãi | Lãi đang ở chế độ **Cộng vào gốc**; xoá lần lãi nếu nhập nhầm |
| Liên kết đặt lại báo hết hạn/đã dùng | Liên kết chỉ dùng một lần trong 15 phút; yêu cầu liên kết mới |
| PWA không hiện nút cài | Phải mở bằng HTTPS (GitHub Pages), không dùng `file://` |
| Sau khi cập nhật, app vẫn giao diện cũ | Xoá cache/đóng app, hoặc tăng `?v=` và `CACHE` trong `sw.js` |
