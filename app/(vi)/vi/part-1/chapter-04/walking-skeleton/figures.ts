// Hình minh họa chương 1.4 (feature 017). Mã mermaid sống ở đây, không bao
// giờ nằm trong page.mdx. Tên service, tên frame, tên lệnh giữ nguyên tiếng Anh.

export const figFrameworkBoundary = `flowchart LR
    subgraph apiSide["services/api — NestJS (ADR-15)"]
      mod["AppModule<br/>đồ thị module · DI"]
      ctl["HealthController"]
      mw["middleware request-id"]
      flt["filter lỗi theo protocol"]
      mod --> ctl
      mod --> mw
      mod --> flt
    end
    subgraph gwSide["services/gateway — không framework, do quyết định"]
      serve["serve() của service-kit<br/>node:http trần"]
    end
    kit["@relay/service-kit<br/>logger · request id<br/>(một mái nhà, cho cả hai bên)"]
    kit --> apiSide
    kit --> gwSide
    note["Framework phục vụ mặt tiền CRUD rộng<br/>và dừng bước trước cửa gateway:<br/>phần cơ khí socket không nhận thêm lớp nào<br/>chen giữa code và đường truyền (ADR-15)"]
    gwSide ~~~ note`;

export const figSkeletonMap = `flowchart TB
    api["API service ✓ ĐANG ĐỨNG — một ứng dụng NestJS (ADR-15)<br/>/healthz · X-Request-Id · log JSON<br/>(nắm REST; writer duy nhất của Postgres — ADR-04)"]
    gw["Gateway service ✓ ĐANG ĐỨNG — không framework, do quyết định (ADR-15)<br/>/healthz + bảng công bố protocol<br/>(tiếp nhận WebSocket; không bao giờ ghi DB — ADR-05)"]
    whk["Webhook dispatcher<br/>(Phần 3 →)"]
    ing["Analytics ingester<br/>(Phần 5 →)"]
    mws["Media worker<br/>(Phần 4 →)"]
    dash["Dashboard<br/>(Phần 5 →)"]
    api ~~~ gw
    whk ~~~ ing
    mws ~~~ dash`;

export const figRequestThread = `flowchart LR
    req["curl /healthz"]
    svc["service<br/>đóng dấu một UUID mới"]
    header["header phản hồi<br/>X-Request-Id: 639c…e9a"]
    logline["dòng log (stdout, JSON)<br/>{ …, request_id: 639c…e9a, status: 200 }"]
    grep["grep 639c…e9a *.log<br/>→ trọn câu chuyện của một request<br/>(NFR-OBS-06: truy vết trong vài phút)"]
    req --> svc
    svc --> header
    svc --> logline
    header --> grep
    logline --> grep`;

export const figPartOneComplete = `flowchart LR
    ch1["1.1 workspace<br/>part1-ch1"]
    ch2["1.2 hạ tầng<br/>part1-ch2"]
    ch3["1.3 protocol<br/>part1-ch3"]
    ch4["1.4 bộ khung<br/>part1-ch4"]
    done["Phần 1 ✓<br/>Phần 2 thêm chi tiết:<br/>session, gửi tin, thứ tự"]
    ch1 --> ch2 --> ch3 --> ch4 --> done`;
