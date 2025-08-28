function doPost(e) {
  try {
    // 스프레드시트 ID (실제 ID로 설정됨)
    const SHEET_ID = '1jh-qH6thRo_7Z1eexfjwHaW8ubc5HXmvklAD0WHhBWs';
    
    // 요청 데이터 파싱
    const data = JSON.parse(e.postData.contents);
    
    // 스프레드시트 열기
    const sheet = SpreadsheetApp.openById(SHEET_ID).getActiveSheet();
    
    // 삭제 요청인지 확인
    if (data.action === 'delete' && data.submissionId) {
      return handleDelete(sheet, data.submissionId);
    }
    
    // 일반 데이터 추가 요청
    return handleSubmission(sheet, data);
    
  } catch (error) {
    // 오류 응답
    return ContentService
      .createTextOutput(JSON.stringify({
        success: false,
        message: '오류: ' + error.toString()
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// 데이터 제출 처리
function handleSubmission(sheet, data) {
  // 헤더가 없으면 추가
  if (sheet.getLastRow() === 0) {
    const headers = [
      '제출일시', '제출ID', '기업명', '선정년도', '선정월', '설립일', 
      '투자일자', '투자금액', '입주유형', '후속투자', 
      '고용현황', '매출현황', '글로벌투자', '글로벌수출', '삭제상태', '삭제일시'
    ];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    
    // 헤더 스타일링
    const headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setBackground('#4285f4');
    headerRange.setFontColor('#ffffff');
    headerRange.setFontWeight('bold');
    headerRange.setHorizontalAlignment('center');
  }
  
  // 제출ID 사용 (서버에서 전송된 ID)
  const submissionId = data.submissionId;
  
  // 새 행 데이터 준비
  const newRow = [
    new Date().toLocaleString('ko-KR'),  // 제출일시
    submissionId,                        // 제출ID
    data.companyName || '',              // 기업명
    data.selectionYear || '',            // 선정년도
    data.selectionMonth || '',           // 선정월
    data.establishDate || '',            // 설립일
    data.investDate || '',               // 투자일자
    data.investAmount || '',             // 투자금액
    data.residencyType || '',            // 입주유형
    data.domesticFollowInvest || '',     // 후속투자
    data.domesticEmployment || '',       // 고용현황
    data.domesticRevenue || '',          // 매출현황
    data.globalInvestment || '',         // 글로벌투자
    data.globalExport || '',             // 글로벌수출
    '✅ 활성',                           // 삭제상태
    ''                                   // 삭제일시
  ];
  
  // 데이터 추가
  const newRowNumber = sheet.getLastRow() + 1;
  sheet.getRange(newRowNumber, 1, 1, newRow.length).setValues([newRow]);
  
  // 새 행 스타일링 (연한 녹색 배경)
  sheet.getRange(newRowNumber, 1, 1, newRow.length).setBackground('#e8f5e8');
  
  // 성공 응답
  return ContentService
    .createTextOutput(JSON.stringify({
      success: true,
      message: '데이터가 성공적으로 저장되었습니다.',
      submissionId: submissionId
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

// 삭제 처리 (소프트 삭제)
function handleDelete(sheet, submissionId) {
  const dataRange = sheet.getDataRange();
  const values = dataRange.getValues();
  
  // 헤더 행 제외하고 검색
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const rowSubmissionId = row[1]; // B열 (제출ID)
    
    if (rowSubmissionId === submissionId) {
      // 삭제 상태로 업데이트 (O열: 삭제상태, P열: 삭제일시)
      sheet.getRange(i + 1, 15).setValue('❌ 삭제됨'); // O열
      sheet.getRange(i + 1, 16).setValue(new Date().toLocaleString('ko-KR')); // P열
      
      // 행 배경색을 회색으로 변경 (시각적 표시)
      sheet.getRange(i + 1, 1, 1, sheet.getLastColumn()).setBackground('#f5f5f5');
      
      // 삭제된 행의 텍스트를 회색으로 변경
      sheet.getRange(i + 1, 1, 1, sheet.getLastColumn()).setFontColor('#888888');
      
      return ContentService
        .createTextOutput(JSON.stringify({
          success: true,
          message: '항목이 삭제 처리되었습니다. (데이터는 보존됨)'
        }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }
  
  // 해당 ID를 찾지 못한 경우
  return ContentService
    .createTextOutput(JSON.stringify({
      success: false,
      message: '해당 제출 항목을 찾을 수 없습니다.'
    }))
    .setMimeType(ContentService.MimeType.JSON);
}
