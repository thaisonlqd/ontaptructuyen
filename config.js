// ==========================================
// 1. CẤU HÌNH HỆ THỐNG (THAY ĐỔI TẠI ĐÂY)
// ==========================================
const CONFIG = {
    // Mật khẩu đăng nhập dành cho giáo viên và học sinh
    ADMIN_PASS: "12341234",
    USER_PASS: "123456",
    
    // Năm học hiển thị
    SCHOOL_YEAR: "2025-2026",
    
    // Khai báo danh sách các trường và link Apps Script tương ứng
    SCHOOLS: {
		"thi_sinh_tu_do": {
            name: "Dành cho HỌC SINH TỰ DO",
            scriptUrl: "https://script.google.com/macros/s/AKfycbwhUFO95RvHgEHyIGNPst6UKItSiUpQjh0GErGBNzSdhxdznDV_iqyvtCLrDGYcFz0v/exec"
        },
        "le_quy_don": {
            name: "THCS Lê Quý Đôn",
            scriptUrl: "https://script.google.com/macros/s/AKfycbxImktN_8RZ_9So_rapGU5i7q5cyKypWfH8MRF0K0wabN0F3pGE1m8iYEn0LLUm4Qfk/exec"
        },
        "thcs_tomau": {
            name: "TH&THCS Tô Mậu",
            scriptUrl: "https://script.google.com/macros/s/AKfycbzxeaGF2LTTJVfPHOSaBjNgILuUqUWJabUNGjbFhc_u80a1O1gTlZKUgdbjS8I9i4NN/exec"
        }
        // Có thể copy thêm các trường khác vào đây, nhớ thêm dấu phẩy ở cuối block trên
    }
};

// ==========================================
// 2. KIỂM TRA QUYỀN TRUY CẬP (BẢO MẬT)
// ==========================================
function checkAccess() {
    const name = sessionStorage.getItem('exam_name');
    const schoolKey = sessionStorage.getItem('exam_school'); // Bây giờ lưu key (VD: le_quy_don) thay vì tên
    
    // Kiểm tra xem trường đã chọn có hợp lệ trong danh sách CONFIG.SCHOOLS không
    if (!name || !schoolKey || !CONFIG.SCHOOLS[schoolKey]) {
        alert("⚠️ Vui lòng nhập thông tin đầy đủ và hợp lệ trước khi bắt đầu làm bài!");
        window.location.href = "index.html"; 
        return;
    }

    if (!sessionStorage.getItem('startTime')) {
        const now = new Date();
        sessionStorage.setItem('startTime', now.toLocaleString('vi-VN'));
        sessionStorage.setItem('startTimeMs', now.getTime()); 
    }
}

// ==========================================
// 3. TÍNH TOÁN THỜI GIAN LÀM BÀI
// ==========================================
function calculateTimeElapsed() {
    const startMs = sessionStorage.getItem('startTimeMs');
    if (!startMs) return "Không xác định";
    
    const endMs = new Date().getTime();
    const diffSeconds = Math.floor((endMs - parseInt(startMs)) / 1000);
    
    const minutes = Math.floor(diffSeconds / 60);
    const seconds = diffSeconds % 60;
    
    return `${minutes} phút ${seconds} giây`;
}

function getDeviceInfo() {
    const userAgent = navigator.userAgent;
    if (userAgent.includes("Windows")) return "Máy tính (Windows)";
    if (userAgent.includes("Mac")) return "Máy tính (Mac/Apple)";
    if (userAgent.includes("Android")) return "Điện thoại (Android)";
    if (userAgent.includes("iPhone") || userAgent.includes("iPad")) return "Điện thoại (iOS)";
    return "Thiết bị khác";
}

// ==========================================
// 4. GỬI DỮ LIỆU BÀI THI LÊN GOOGLE SHEETS
// ==========================================
async function submitExamData(results) {
    // 1. Lấy thông tin trường từ session
    const schoolKey = sessionStorage.getItem('exam_school');
    const schoolData = CONFIG.SCHOOLS[schoolKey];

    // 2. Kiểm tra xem trường này đã có link Web App chưa
    if (!schoolData || !schoolData.scriptUrl || schoolData.scriptUrl.includes("THAY_LINK")) {
        console.error("Lỗi: Chưa cấu hình scriptUrl cho trường này trong config.js");
        return { status: "error", message: "Hệ thống chưa được kết nối với máy chủ của trường!" };
    }

    // Đóng gói dữ liệu gửi đi
    const payload = {
        action: "submitExam", // Thêm action để Code.gs biết là nộp bài
        timeStart: sessionStorage.getItem('startTime') || new Date().toLocaleString('vi-VN'),
        timeEnd: new Date().toLocaleString('vi-VN'),
        timeTaken: calculateTimeElapsed(), 
        name: sessionStorage.getItem('exam_name'),
        className: sessionStorage.getItem('exam_class'),
        school: schoolData.name, // Gửi TÊN TRƯỜNG thực tế lên Google Sheet (VD: "THCS Lê Quý Đôn")
        deviceInfo: getDeviceInfo(),
        location: "Trình duyệt Web",
        
        // Dữ liệu điểm số
        scoreTNLQ: results.scoreTNLQ || 0,
        scoreTF: results.scoreTF || 0,
        scoreShort: results.scoreShort || 0,
        essay: results.essay || "Đã nộp",
        correct: results.correctCount || 0,
        totalScore: results.totalScore || 0,
        
        // MÃ HÓA BÀI LÀM
        answersCode: results.answersCode || "" 
    };

    try {
        // Sử dụng đúng link scriptUrl của trường đã chọn
        await fetch(schoolData.scriptUrl, {
            method: 'POST',
            mode: 'no-cors', 
            headers: { 
                'Content-Type': 'text/plain;charset=utf-8' 
            },
            body: JSON.stringify(payload)
        });
        
        sessionStorage.removeItem('startTime');
        sessionStorage.removeItem('startTimeMs');

        return { status: "success" };
    } catch (error) {
        console.error("Lỗi khi nộp bài:", error);
        return { status: "error", message: "Đường truyền mạng không ổn định. Vui lòng thử nộp lại!" };
    }
}

// ==========================================
// 5. ĐĂNG XUẤT
// ==========================================
function clearSession() {
    sessionStorage.clear();
    window.location.href = "index.html";
}
