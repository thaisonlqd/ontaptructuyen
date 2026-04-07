/**
 * HỆ THỐNG QUẢN LÝ ĐIỂM - THẦY THÁI SƠN
 * File: Code.gs (Bản Hoàn Chỉnh - Tích hợp Đổi mật khẩu)
 */

const SHEET_DATA = 'Data';
const SHEET_USER = 'DS_Hocsinh';

// --- CÁC HÀM TIỆN ÍCH ---
function safeString(str) {
  if (str === undefined || str === null) return "";
  let s = String(str).trim();
  if (s.length > 49000) return s.substring(0, 49000); 
  return s;
}

function safeNumber(num) {
  if (num === undefined || num === null || num === "") return 0;
  let n = parseFloat(String(num).replace(',', '.'));
  return isNaN(n) ? 0 : n;
}

function createJsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
                       .setMimeType(ContentService.MimeType.JSON);
}

// ==========================================
// 1. TIẾP NHẬN YÊU CẦU TỪ WEB (POST & GET)
// ==========================================
function doPost(e) {
  try {
    let data = {};
    if (e && e.postData && e.postData.contents) {
      try {
        data = JSON.parse(e.postData.contents);
      } catch (err) {
        data = e.parameter || {};
      }
    } else if (e && e.parameter) {
      data = e.parameter;
    } else {
      throw new Error("Không nhận được dữ liệu tải lên.");
    }

    const action = data.action || "submitExam"; 
    
    switch(action) {
      case "submitExam":        return handleSubmitExam(data); 
      case "updateScore":       return handleUpdateScore(data); 
      case "updateStudentInfo": return handleUpdateStudentInfo(data); 
      case "deleteScore":       return handleDeleteScore(data);
      case "changePassword":    return handleChangePassword(data); // [MỚI] Xử lý đổi mật khẩu
      default:                  throw new Error("Hành động không hợp lệ: " + action);
    }
  } catch(error) {
    return createJsonResponse({
      "status": "error", 
      "message": "Lỗi máy chủ doPost: " + error.message
    });
  }
}

function doGet(e) {
  try {
    const action = e.parameter.action;
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    if (action === "getUsers") {
      const sheetUser = ss.getSheetByName(SHEET_USER);
      if (!sheetUser) throw new Error("Không tìm thấy trang tính '" + SHEET_USER + "'");
      const userData = sheetUser.getDataRange().getDisplayValues(); 
      userData.shift(); 
      return createJsonResponse({"status": "success", "data": userData});
    }

    const sheetData = ss.getSheetByName(SHEET_DATA);
    if (!sheetData) throw new Error("Không tìm thấy trang tính '" + SHEET_DATA + "'");
    const allData = sheetData.getDataRange().getDisplayValues(); 
    const studentData = [];
    for (let i = 1; i < allData.length; i++) {
      let row = allData[i];
      row.push(i + 1); 
      studentData.push(row);
    }
    return createJsonResponse({"status": "success", "data": studentData});
  } catch (error) {
    return createJsonResponse({"status": "error", "message": "Lỗi máy chủ doGet: " + error.message});
  }
}

// ==========================================
// 2. CÁC HÀM XỬ LÝ CHỨC NĂNG CHÍNH
// ==========================================

/**
 * [MỚI] HỌC SINH ĐỔI MẬT KHẨU (Ghi vào sheet DS_Hocsinh)
 */
function handleChangePassword(data) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_USER);
    if (!sheet) throw new Error("Không tìm thấy trang tính người dùng.");

    const allData = sheet.getDataRange().getValues();
    const targetName = safeString(data.name);
    const targetClass = safeString(data.className);
    const targetUser = safeString(data.username); // Đây là giá trị từ s[4] (Cột E)
    const newPass = safeString(data.newPass);

    // Duyệt tìm học sinh phù hợp để đổi mật khẩu
    for (let i = 1; i < allData.length; i++) {
      const rowName = safeString(allData[i][1]); // Cột B
      const rowClass = safeString(allData[i][3]); // Cột D
      const rowUser = safeString(allData[i][4]); // Cột E

      // Kiểm tra khớp Tên + Lớp hoặc khớp Mã/SĐT (Username)
      if ((targetUser && rowUser === targetUser) || (rowName === targetName && rowClass === targetClass)) {
        // Ghi mật khẩu mới vào Cột F (Cột số 6)
        sheet.getRange(i + 1, 6).setValue(newPass);
        
        // Buộc lưu lại thay đổi ngay lập tức
        SpreadsheetApp.flush();
        
        return createJsonResponse({"status": "success", "message": "Đổi mật khẩu thành công!"});
      }
    }
    throw new Error("Không tìm thấy thông tin tài khoản trên hệ thống.");
  } catch (error) {
    return createJsonResponse({"status": "error", "message": error.message});
  }
}

/**
 * HỌC SINH NỘP BÀI THI
 */
function handleSubmitExam(data) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_DATA);
    if (!sheet) {
      SpreadsheetApp.getActiveSpreadsheet().insertSheet(SHEET_DATA);
      const newSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_DATA);
      newSheet.appendRow([
        "TG Bắt đầu", "TG Kết thúc", "Tổng thời gian", "Họ tên", "Lớp", "Trường", 
        "Thiết bị", "Vị trí", "TN khách quan", "TN Đúng-Sai", "Trạng thái", "Tự luận", 
        "Số câu đúng", "Tổng điểm", "HS_Code", "Mã Bài Làm", "Dữ liệu Tự luận"
      ]);
      return createJsonResponse({"status": "error", "message": "Hệ thống vừa khởi tạo dữ liệu. Hãy bấm nộp lại!"});
    }

    const generatedHsCode = "HS_" + new Date().getTime().toString().slice(-6);
    const rawDetailCode = safeString(data.detailCode || data.answersCode);
    const rawEncodedEssay = safeString(data.encodedEssay);

    const rowData = [
      safeString(data.timeStart),
      safeString(data.timeEnd),
      safeString(data.timeTaken),
      "'" + safeString(data.name || "Không tên"),
      "'" + safeString(data.className),
      "'" + safeString(data.school),
      safeString(data.deviceInfo),
      safeString(data.location),
      safeNumber(data.scoreTNLQ),
      safeNumber(data.scoreTF),
      "Đang chấm bài",
      0,
      "'" + safeString(data.correct),
      safeNumber(data.totalScore),
      generatedHsCode,
      rawDetailCode ? "'" + rawDetailCode : "",
      rawEncodedEssay ? "'" + rawEncodedEssay : ""
    ];

    sheet.appendRow(rowData);
    return createJsonResponse({"status": "success", "hsCode": generatedHsCode});
  } catch (err) {
    return createJsonResponse({"status": "error", "message": err.message});
  }
}

/**
 * GIÁO VIÊN CHẤM ĐIỂM TỰ LUẬN
 */
function handleUpdateScore(data) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_DATA);
    if (!sheet) throw new Error("Không tìm thấy dữ liệu.");
    const targetRowIndex = parseInt(data.rowIndex);
    const essayScore = safeNumber(data.scoreEssay !== undefined ? data.scoreEssay : data.scoreShort);
    const totalScore = safeNumber(data.totalScore !== undefined ? data.totalScore : data.scoreTotal);

    if (!isNaN(targetRowIndex) && targetRowIndex >= 2) {
      sheet.getRange(targetRowIndex, 11).setValue("Đã chấm");
      sheet.getRange(targetRowIndex, 12).setValue(essayScore);
      sheet.getRange(targetRowIndex, 14).setValue(totalScore);
      return createJsonResponse({"status": "success"});
    }
    throw new Error("Dòng không hợp lệ.");
  } catch (error) {
    return createJsonResponse({"status": "error", "message": error.message});
  }
}

/**
 * GIÁO VIÊN SỬA THÔNG TIN HÀNH CHÍNH
 */
function handleUpdateStudentInfo(data) {
  try {
    const rowIndex = parseInt(data.rowIndex);
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_DATA);
    if (isNaN(rowIndex) || rowIndex < 2) throw new Error("Vị trí không hợp lệ.");

    sheet.getRange(rowIndex, 4).setValue("'" + safeString(data.name));
    sheet.getRange(rowIndex, 5).setValue("'" + safeString(data.className));
    sheet.getRange(rowIndex, 6).setValue("'" + safeString(data.school));
    return createJsonResponse({"status": "success"});
  } catch (err) {
    return createJsonResponse({"status": "error", "message": err.message});
  }
}

/**
 * GIÁO VIÊN XÓA BÀI THI
 */
function handleDeleteScore(data) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_DATA);
    const allData = sheet.getDataRange().getValues();
    const targetHsCode = String(data.hsCode).trim();

    for (let i = allData.length - 1; i >= 1; i--) { 
      let colO = String(allData[i][14]).replace(/^'/, "").trim();
      if (colO === targetHsCode) {
        sheet.deleteRow(i + 1);
        return createJsonResponse({"status": "success"});
      }
    }
    throw new Error("Không tìm thấy bài thi.");
  } catch (error) {
    return createJsonResponse({"status": "error", "message": error.message});
  }
}