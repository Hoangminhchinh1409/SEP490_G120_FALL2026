const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { Zalo, LoginQRCallbackEventType } = require('zca-js');

const SESSION_PATH = path.join(__dirname, '../config/zalo_session.json');
const QR_PATH = path.join(__dirname, '../zalo_qr.png');

async function runLogin() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📱 HỆ THỐNG ĐĂNG NHẬP ZALO QUA MÃ QR (NEXLOG BOT)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Đang kết nối đến máy chủ Zalo để khởi tạo mã QR...');

  const zalo = new Zalo({ logging: false });

  try {
    const api = await zalo.loginQR({}, (event) => {
      if (event.type === LoginQRCallbackEventType.QRCodeGenerated) {
        const base64Data = event.data.image.replace(/^data:image\/png;base64,/, '');
        fs.writeFileSync(QR_PATH, base64Data, 'base64');
        console.log('\n✅ Đã tạo mã QR đăng nhập thành công!');
        console.log(`📁 File mã QR lưu tại: ${QR_PATH}`);
        console.log('🚀 Đang tự động mở ảnh mã QR trên màn hình của bạn...');
        
        // Mở ảnh mã QR trên Windows
        exec(`start "" "${QR_PATH}"`);

        console.log('\n👉 BƯỚC TIẾP THEO:');
        console.log('1. Mở ứng dụng Zalo trên điện thoại của bạn.');
        console.log('2. Bấm vào biểu tượng [Quét mã QR] ở góc trên bên phải.');
        console.log('3. Hướng camera quét mã QR vừa mở trên màn hình.');
        console.log('4. Bấm "Đăng nhập" trên điện thoại để xác nhận.\n');
        console.log('⏳ Đang chờ bạn xác nhận trên điện thoại...');
      } else if (event.type === LoginQRCallbackEventType.QRCodeScanned) {
        console.log('📲 Đã quét mã thành công! Vui lòng bấm [Đăng nhập] trên điện thoại...');
      } else if (event.type === LoginQRCallbackEventType.GotLoginInfo) {
        // Lưu thông tin session vào config
        fs.mkdirSync(path.dirname(SESSION_PATH), { recursive: true });
        fs.writeFileSync(SESSION_PATH, JSON.stringify(event.data, null, 2), 'utf8');
        console.log('\n🎉 ĐÃ ĐĂNG NHẬP THÀNH CÔNG VÀ LƯU SESSION TỰ ĐỘNG!');
      } else if (event.type === LoginQRCallbackEventType.QRCodeExpired) {
        console.log('⚠️ Mã QR đã hết hạn. Vui lòng chạy lại lệnh để lấy mã mới.');
      } else if (event.type === LoginQRCallbackEventType.QRCodeDeclined) {
        console.log('❌ Bạn đã bấm từ chối đăng nhập trên điện thoại.');
      }
    });

    // Sau khi đăng nhập thành công, liệt kê danh sách nhóm Zalo
    console.log('\n🔍 Đang tải danh sách các nhóm Zalo của bạn...');
    try {
      const groupsRes = await api.getAllGroups();
      const groupIds = Object.keys(groupsRes?.gridVerMap || {});
      console.log('\n📋 DANH SÁCH NHÓM ZALO CỦA BẠN:');
      console.log('---------------------------------------------------------');
      if (groupIds.length > 0) {
        for (let i = 0; i < groupIds.length; i += 20) {
          const chunk = groupIds.slice(i, i + 20);
          const info = await api.getGroupInfo(chunk);
          const map = info?.gridInfoMap || {};
          Object.values(map).forEach((g, idx) => {
            console.log(`${i + idx + 1}. Tên nhóm: "${g.name || 'Không tên'}" | ID: ${g.groupId}`);
          });
        }
      } else {
        console.log('(Chưa tìm thấy nhóm nào hoặc tài khoản chưa tham gia nhóm chat)');
      }
      console.log('---------------------------------------------------------');
      console.log('👉 Hãy copy ID của nhóm bạn muốn gửi tin nhắn vào biến ZALO_OPS_GROUP_ID trong BE/.env nhé!\n');
    } catch (gErr) {
      console.log('Không lấy được danh sách nhóm:', gErr.message);
    }

    // Xóa file QR tạm
    if (fs.existsSync(QR_PATH)) {
      try { fs.unlinkSync(QR_PATH); } catch (_) {}
    }

    console.log('Hoàn tất! Bạn có thể đóng cửa sổ này.');
    process.exit(0);
  } catch (err) {
    console.error('Lỗi trong quá trình đăng nhập:', err.message);
    process.exit(1);
  }
}

runLogin();
