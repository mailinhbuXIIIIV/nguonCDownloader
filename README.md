# nguonCDownloader
## Sử dụng để tải phim trực tiếp từ [nguonC](http://phim.nguonc.com)

***

##### Yêu cầu: trên máy cài NodeJS: [Link tải](https://nodejs.org/en) và ffmpeg: [Link tải](https://www.ffmpeg.org/)
***
#### 1. Sau khi đã cài đặt xong 2 phần mềm trên, tải toàn bộ repo về và đưa vào Google Chrome dưới dạng extension (*Settings -> Extension -> Load Unpacked*).
#### 2. Mở extension bằng cách ghim lên trên thanh công cụ và bấm vào icon -> Open Side Panel.
#### 3. Nhập slug của phim (thường là tên phim không dấu, ngăn cách bằng dấu - VD: dia-nguc-doc-than). Trong trường hợp không tìm thấy slug của phim có thể lên [nguonC](http://phim.nguonc.com) tra cứu.
#### 4. Sau khi nhập xong nhấn **tìm kiếm**. Chọn phim muốn tải xuống, chọn tập muốn tải xuống (có thể nhiều hơn 1 tập). Điền đường dẫn tới thư mục muốn tải VD: C://Download (mặc định bỏ trống sẽ tải theo thiết lập của trình duyệt).
#### 5. Chọn **Bắt đầu lấy file download**
#### 6. Chờ extension lấy link tải.
##### *Lưu ý: nếu đang xem dở phim/thấy một trang web hiện ra mà không đóng lại ngay, hãy vào trang web bấm nút để xem tiếp phim. Khi đó trang web sẽ tự đóng và extension sẽ chạy tiếp*
#### 7. Một file mặc định download.js sẽ được tải về máy. Trong file chứa các file segment sẵn sàng tải xuống.
#### 8. Tải phim bằng cách sử dụng NodeJS trong terminal với lệnh `node đường_dẫn/download.js` (VD: `node /Users/Downloads/download.js`). Khi đó phim sẽ được tải về và hiện trạng thái trên terminal.

### Lưu ý 2: Trong trường hợp sau khi tải xong 1 bộ => tìm kiếm bộ khác => tải xuống, gặp tình trạng link vẫn như cũ thì hãy thử vào Extension ấn reload (hình mũi tên vòng tròn) và thử lại.
