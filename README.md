# Sổ Chi Tiêu Gia Đình

Web app quản lý thu chi cho 2 người (vợ/chồng). Giao diện lấy từ bản design OpenDesign; dữ liệu nằm trong **Google Sheet**, đọc/ghi qua **Google Apps Script**. Không Firebase, không server, không thẻ, không hoá đơn.

## Kiến trúc

```
Web app (GitHub Pages hoặc localhost)
    │  fetch (JSON, kèm token)
    ▼
Google Apps Script Web App  ──  Google Sheet
    - kiểm tra đăng nhập           members
    - khoá ghi (LockService)       incomes
    - trả JSON                     expenses
```

- Không realtime: app tự tải lại mỗi **30 giây** khi tab đang mở.
- Đăng nhập bằng tài khoản lưu trong tab `members`. Token ký HMAC, hết hạn sau 30 ngày.
- **Bộ lọc** theo người và khoảng thời gian cho cả Thu nhập và Chi tiêu.
- **Quên mật khẩu**: gửi mật khẩu về đúng email của tài khoản.
- Mọi thao tác ghi đều có trạng thái **Đang xử lý…**, khoá nút và chống ghi trùng.

## Cấu trúc file

```
index.html                 khung ứng dụng + các sheet/dialog
assets/app.js              logic giao diện
assets/app.css             giao diện
assets/api.js              ⚠️ nơi dán URL Apps Script
assets/fonts/              Be Vietnam Pro (self-host)
apps-script/Code.gs        backend, dán vào Apps Script
.nojekyll                  để GitHub Pages không xử lý qua Jekyll
```

## Cài đặt (khoảng 10 phút)

### 1. Tạo Google Sheet

1. Vào <https://sheets.google.com> → tạo bảng tính mới, đặt tên "Sổ Chi Tiêu".
2. Không cần tạo tab — script sẽ tự tạo `members`, `incomes`, `expenses` ở lần chạy đầu.

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

bằng URL vừa copy. Xong.

### 5. Chạy thử

```powershell
cd F:\Tools\Money
npx serve . -l 4173
```

Mở `http://localhost:4173`. Lần chạy đầu script tự tạo 3 tab và 2 tài khoản:

| Đăng nhập | Mật khẩu |
|---|---|
| `ongluatlangvang@gmail.com` | `luat123` |
| `thuonglt1210@gmail.com` | `thuong123` |

### 6. Đổi mật khẩu

Mở Google Sheet → tab `members`, sửa cột `password`. Đổi luôn `name` và `role` nếu muốn.

> **Không đổi cột `id`** (`luat`, `thuong`) sau khi đã có dữ liệu — mọi khoản thu/chi tham chiếu theo id này. Cột `login` thì đổi thoải mái.

### 7. Đưa lên GitHub Pages

1. Tạo repo **public**, push toàn bộ thư mục lên nhánh `main`.
2. Repo → **Settings → Pages** → Source: **Deploy from a branch** → `main` / `/ (root)` → Save.
3. Mở `https://<username>.github.io/<repo>/` trên cả hai điện thoại, "Thêm vào màn hình chính".

Không cần cấu hình domain gì thêm — Apps Script không kiểm tra origin.

## Dữ liệu trong Sheet

**members**

| id | login | name | role | password | order |
|---|---|---|---|---|---|
| luat | ongluatlangvang@gmail.com | Luật | Chồng | luat123 | 1 |
| thuong | thuonglt1210@gmail.com | Thương | Vợ | thuong123 | 2 |

**incomes**: `id, amount, date, member, note, createdBy, createdAt`

**expenses**: `id, title, amount, category, reason, requester, created, status, agreed, approvedAt, purchasedAt, rejectedBy, rejectedAt, cancelledBy, cancelledAt`

- `agreed` là JSON một ô: `{"luat":true,"thuong":null}`.
- `status`: `pending | approved | purchased | rejected | cancelled`.
- Số dư **không lưu**, app tính `tổng thu − tổng đã mua`, nên sửa/xoá là tự đúng lại.

## Luồng nghiệp vụ

- Người gửi được tính là đã đồng ý ngay khi tạo yêu cầu.
- Người còn lại bấm Đồng ý → `approved`. Với 2 người chỉ cần một lần bấm.
- Bấm "Đã mua" → `purchased`, tiền bị trừ khỏi số dư.
- Số dư âm hiển thị `Đang vay` kèm cảnh báo đỏ.
- Sửa yêu cầu đã duyệt → quay về `pending`, phải duyệt lại.

## Chống ghi trùng và tốc độ

- Khi bấm Lưu/Gửi/Đồng ý, nút bị khoá ngay và hiện spinner `Đang xử lý…`; mọi nút khác trong cùng hộp thoại/thẻ cũng bị khoá. Bấm thêm không tạo thêm bản ghi.
- Mỗi khoản thu/chi có `id` do trình duyệt sinh ra. Server kiểm tra id: nếu đã tồn tại thì trả `ok` luôn, không ghi thêm — an toàn cả khi mạng retry.
- Sau khi ghi thành công, app cập nhật danh sách tại chỗ (không tải lại toàn bộ), nên cảm giác nhanh hơn. Dữ liệu của người kia vẫn được đồng bộ mỗi 30 giây.
- Request có timeout 30 giây; lỗi mạng hiện toast đỏ và mở khoá nút, không treo "Đang xử lý…" mãi.

## Bảo mật — nói thẳng

- Mật khẩu nằm **plaintext** trong tab `members`, đúng như bạn muốn. Đừng bật "Anyone with the link" cho Sheet; chỉ chia sẻ với 2 người.
- URL `/exec` nằm trong file JS công khai. Ai biết URL vẫn **không đọc/ghi được** nếu không có mật khẩu: mọi hành động đều kiểm tra token.
- Token ký HMAC bằng secret sinh tự động trong Script Properties, hết hạn 30 ngày.
- Sai mật khẩu 6 lần bị khoá 10 phút.
- Đây là mức bảo mật "đủ cho sổ gia đình", không phải ngân hàng. Đừng dùng mật khẩu bạn dùng ở chỗ khác.

## Giới hạn cần biết

| Điều | Thực tế |
|---|---|
| Realtime | Không. Tối đa 30 giây mới thấy thay đổi của người kia |
| Tốc độ | Mỗi thao tác 0,5–2 giây |
| Ghi đồng thời | `LockService` xếp hàng, không hỏng dữ liệu |
| Sửa tay Sheet | Được, nhưng **không xoá dòng tiêu đề**, không đổi `id`, `status` phải đúng 5 giá trị |
| Quota Apps Script | 6 phút mỗi lần chạy, 30 lần đồng thời. App không dùng trigger nên không tốn quota 90 phút/ngày |
| Giới hạn ô Sheet | 10 triệu ô — vài chục năm mới hết |

## Giới hạn GitHub Pages & Google (2026)

### GitHub Pages

| Hạng mục | Giới hạn |
|---|---|
| Dung lượng site | 1 GB |
| Băng thông | **100 GB/tháng** — giới hạn mềm |
| Build | 10 lần/giờ (deploy từ branch); không áp dụng nếu dùng GitHub Actions |
| Repo | Phải public với tài khoản Free |
| Mục đích | Không dùng cho web thương mại/SaaS |

Toàn bộ app chỉ **391 KB** (đã tính cả 12 file font). Một lượt mở đầu tải khoảng 300 KB; các lần sau lấy từ cache. 100 GB/tháng tương đương **~300.000 lượt mở đầu tiên/tháng** (~10.000 lượt/ngày). Hai người dùng không thể chạm tới.

Nếu vượt, GitHub không gửi hoá đơn: họ có thể trả `429`, hoặc gửi email đề nghị giảm tải.

### Google Sheet

| Hạng mục | Giới hạn |
|---|---|
| Ô mỗi bảng tính | 10 triệu ô |
| Ký tự mỗi ô | 50.000 |
| Dung lượng Drive | 15 GB (miễn phí) |

Tab `expenses` có 15 cột → 10 triệu ô tương đương **~666.000 dòng**. Với 2 người, vài chục năm mới tới.

### Google Apps Script (tài khoản Gmail)

| Hạng mục | Giới hạn |
|---|---|
| Thời gian mỗi lần chạy | 6 phút |
| Chạy đồng thời | 30 |
| Tổng thời gian trigger/ngày | 90 phút — app **không dùng trigger** |
| Email gửi đi | 100 người nhận/ngày (dùng cho Quên mật khẩu) |
| URL Fetch | 20.000/ngày — app không dùng |

App chỉ dùng web app request. Mỗi request đọc 3 tab và trả JSON, thường 0,5–2 giây. Poll 30 giây:

- 2 người mở 4 giờ/ngày: ~960 request/ngày.
- 2 người mở 8 giờ/ngày: ~1.920 request/ngày.

Ràng buộc thực tế là 6 phút/lần chạy và 30 request đồng thời — cả hai đều rất xa.

### Theo dõi

- GitHub: repo → **Insights → Traffic** (lượt xem 14 ngày gần nhất).
- Apps Script: **Executions** (nhật ký chạy, thời gian).
- Google Sheet: không cần theo dõi.

## Sửa backend sau này

Sửa `Code.gs` trong Apps Script → **Deploy → Manage deployments → biểu tượng bút chì → Version: New version → Deploy**. Làm vậy URL `/exec` giữ nguyên, không phải sửa `api.js`.

Nếu chọn "New deployment" mỗi lần thì URL đổi, phải dán lại vào `api.js`.

## Lỗi thường gặp

| Hiện tượng | Nguyên nhân |
|---|---|
| Nút Đăng nhập mờ, báo "Chưa dán URL Apps Script" | Chưa sửa `API_URL` trong `assets/api.js` |
| "Không kết nối được Google" | Deploy chưa để **Who has access: Anyone**, hoặc mạng chặn |
| "Google trả về dữ liệu không hợp lệ" | Đang mở nhầm URL `/dev` thay vì `/exec` |
| "Sai tên đăng nhập hoặc mật khẩu" | Xem lại cột `login` và `password` trong tab `members` |
| Đăng nhập được nhưng bảng trống | Chưa có dữ liệu; thêm khoản thu đầu tiên |
| Máy kia không thấy thay đổi | Đợi 30 giây, hoặc chuyển tab đi rồi quay lại để app tải lại |
| Apps Script báo "Authorization required" | Mở Apps Script, chạy thử một hàm bất kỳ rồi Allow |
| Sửa `Code.gs` nhưng app không đổi | Chưa deploy **New version** |
