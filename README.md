# Upwind — "Không khí của bạn đến từ đâu"

*(trước đây là Borealis)*. Muốn đổi tên thì sửa `appName` trong `js/config.js` và thẻ `<title>` trong `index.html`.

## Tính năng cho người dùng

| Tính năng | Mô tả |
|---|---|
| **Mi ubicación / My location** | Lấy vị trí GPS rồi chọn ô grid tương ứng. Nếu người dùng ở ngoài vùng của khu vực đang xem, app sẽ báo cho họ biết. |
| **Lưu địa điểm** | Lưu tối đa 6 nơi cho mỗi khu vực, như nhà hay trường của con, vào `localStorage`. Lần sau mở app sẽ vào thẳng địa điểm đầu tiên trong danh sách. |
| **Cảnh báo ô nhiễm đang tới** | Dựa vào 4 mốc forecast trong 24 giờ tới cùng trajectory của từng mốc. Nếu AQI ở chỗ người dùng sẽ vượt ngưỡng (hoặc tăng từ 20 trở lên) và path đi qua trong phạm vi khoảng 1.5 ô, app hiện *"Pollution is heading your way (origin: …)"*. Nếu không có path đi qua thì hiện "Air will get worse". |
| **Mấy giờ ra ngoài được** | Hiển thị 5 mốc (bây giờ và 24 giờ tới), mỗi mốc ghi Good, Limit hoặc Avoid theo hồ sơ sức khoẻ, đánh dấu khung giờ tốt nhất và kèm lời khuyên. Bấm vào một mốc là map nhảy tới thời điểm đó. |
| **Hồ sơ sức khoẻ** | Có 3 lựa chọn: Everyone, Asthma/kids/seniors/pregnancy, Outdoor workers. Mỗi hồ sơ có ngưỡng riêng: nhóm nhạy cảm bị cảnh báo khi AQI trên 100, còn người bình thường khi trên 150. |
| **EN / ES** | Toàn bộ giao diện có tiếng Anh và tiếng Tây Ban Nha, tên mức AQI dùng theo thuật ngữ của EPA và AirNow. App tự chọn theo ngôn ngữ của trình duyệt, hoặc mở bằng `?lang=es`. |

Ngưỡng của từng hồ sơ nằm trong `PROFILES` ở `js/foryou.js`. Toàn bộ chữ trên giao diện nằm trong `js/i18n.js`.

Bản viết lại toàn bộ frontend. Chạy tĩnh trên web: không có bước build và không cần API key. Chỉ phụ thuộc vào **D3 v7** (đã kèm trong `vendor/`).

## Chạy thử

```bash
cd upwind
python3 -m http.server 8000
# mở http://localhost:8000
```

> Code dùng ES modules nên phải mở qua HTTP. Mở trực tiếp bằng `file://` sẽ không chạy.

Nếu không tìm thấy file board nào, app tự chuyển sang **demo data**. Demo data có cùng format với backend và trên badge hiện chữ "Demo".

## Deploy lên Athena / Artemis

Copy cả thư mục vào `public_html/`, đặt **cạnh** 2 thư mục dữ liệu đang có:

```
public_html/
├── index.html  css/  js/  vendor/  data/
├── board_archive2/   board_2025-05-01_1200-1800.json, evaluation_2025-05-01_1200-1800.csv, ...
└── forecast/         board_2025-05-02_0000-0600.json, ...
```

## Khu vực (Kern · LA + Orange)

Nút chọn khu vực nằm ở góc trên bên trái. Cũng có thể mở thẳng bằng link `?region=kern` hoặc `?region=laoc`.
Mỗi khu vực có grid, thư mục dữ liệu, ranh giới và danh sách địa danh riêng (xem `js/regions.js`).

| Khu vực | Grid (tâm ô, kinh độ 0–360) | Số ô | Thư mục dữ liệu |
|---|---|---|---|
| Kern | lon 239.75–242.25, lat 34.75–35.75, bước 0.25° | 11×5 | `board_archive2/`, `forecast/` |
| LA + Orange | lon 241.0–242.5, lat 33.5–34.75, bước 0.25° | 7×6 | `la_oc/board_archive/`, `la_oc/forecast/` |

**Bên backend:** chạy lại pipeline hiện tại (gồm OpenWeather, Aurora, pathfinder) với dải lat/lon của LA + Orange ở bảng trên, rồi ghi kết quả vào `la_oc/...`. Tên file giữ nguyên như Kern. Pipeline không cần sửa gì khác vì paper đã ghi là dải toạ độ có thể đổi được.
Ranh giới chính thức (TIGER/Line, FIPS 06037 cho LA và 06059 cho Orange) đặt vào `data/la_oc.geojson`. Nếu không có file này, app dùng outline gần đúng, chỉ có phần đất liền và không có đảo Catalina.
Muốn thêm khu vực khác thì thêm một mục vào `REGIONS` trong `js/regions.js` và một mục vào `CONFIG.regions`.

## Kết nối với backend: chỉ cần sửa `js/config.js`

| Key | Ý nghĩa |
|---|---|
| `regions.<id>.archiveDir/forecastDir` | Thư mục board quan trắc và board dự báo của từng khu vực |
| `boardFile(date, slot)` | Tên file board, mặc định `board_YYYY-MM-DD_HHMM-HHMM.json` |
| `evalFile(date, slot)` | Tên file trajectory. **Sửa cho đúng tên file backend đang ghi ra.** Nhận CSV (cột `lon`,`lat`, dòng đầu là origin) hoặc JSON |
| `slots` | 4 khung 6 giờ. `label` là chữ hiển thị trên UI, `start`/`end` dùng để ghép tên file |
| `daysBack`, `forecastDays`, `endDate` | Số ngày cần load. `endDate: null` = hôm nay |
| `regions.<id>.outlineGeoJSON` | Đường dẫn GeoJSON ranh giới chính thức. Nếu không có, app dùng outline gần đúng |
| `basemaps`, `defaultBasemap` | Nền vệ tinh (Esri) hoặc nền tối (CARTO). `dim` là độ làm tối ảnh, `fieldAlpha` là độ đậm lớp AQI |
| `links` | Link About team / Source code / Paper / Poster |

Format board được đọc đúng như Figure 6 trong paper: `board[].center`, `weather["10u_wind_change"|"10v_wind_change"]`, `pollution.avg.{co,no,no2,o3,so2,pm2_5,pm10}`. Kinh độ kiểu 0–360 (239.75) được tự đổi sang −120.25. Nếu board có sẵn key `path` / `origin` thì app dùng luôn và không cần file CSV.

## Cấu trúc code

```
js/config.js    cấu hình (chỉ cần sửa file này)
js/foryou.js    hồ sơ sức khoẻ, địa điểm đã lưu, giờ tốt nhất, cảnh báo
js/i18n.js      chữ tiếng Anh / Tây Ban Nha
js/store.js     localStorage an toàn (có fallback khi bị chặn)
js/regions.js   grid, ranh giới, địa danh của từng khu vực
js/data.js      load + chuẩn hoá board/CSV, nội suy bicubic (không gian) và tuyến tính (thời gian)
js/aqi.js       US EPA AQI từ nồng độ µg/m³ + bảng màu EPA
js/map.js       slippy map trên canvas (d3-zoom): tile CARTO, field AQI, isoline, path, origin
js/wind.js      hạt gió chuyển động
js/panel.js     panel chi tiết, chart AQI theo thời gian, legend, tooltip
js/timeline.js  thanh thời gian: play, kéo thả, vùng forecast
js/demo.js      dữ liệu demo (cùng format với backend; Kern + LA/OC có mô hình riêng)
```

## Lưu ý về số liệu

- Field `aqi` của OpenWeather là **thang 1–5**, không phải US AQI. App tự tính US AQI từ nồng độ theo breakpoint của EPA (PM2.5 dùng bản sửa đổi 2024), rồi lấy max của các sub-index.
- EPA quy định thời gian lấy trung bình riêng cho từng chất (24 h cho PM, 8 h cho O₃ và CO, 1 h cho NO₂ và SO₂). App áp các breakpoint đó lên trung bình 6 giờ của backend, nên trong báo cáo nên ghi rõ điều này.
- NO không có chỉ số AQI nên được hiển thị bằng nồng độ thô.
