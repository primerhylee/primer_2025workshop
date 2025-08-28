// 구글 시트 연동 설정
// 이 파일은 구글 시트 API 키와 스프레드시트 ID를 관리합니다.

const GOOGLE_SHEETS_CONFIG = {
    // Google Apps Script 웹앱 URL (배포 후 받은 URL을 여기에 입력)
    APPS_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbwbI8u-ygWcHOw12XCIL4sWINIs8e0c_Ds_Tg1YEtHdv7Y3vZNWf3Xu4MvgvWRg0KWp/exec',
    
    // 기존 API 방식 설정 (사용하지 않음 - 주석 처리)
    // API_KEY: 'YOUR_GOOGLE_API_KEY_HERE',
    // SPREADSHEET_ID: 'YOUR_SPREADSHEET_ID_HERE',
    // SHEET_NAME: '창업기업_데이터',
    
    // 헤더 행 (Apps Script에서 자동으로 생성됨)
    HEADERS: [
        '제출일시',
        '기업명',
        '선정년도',
        '선정월',
        '설립일',
        '투자일자',
        '투자금액',
        '입주유형',
        '후속투자',
        '고용현황',
        '매출현황',
        '글로벌투자',
        '글로벌수출'
    ]
};

// 브라우저에서 사용할 수 있도록 전역 변수로 설정
if (typeof window !== 'undefined') {
    window.GOOGLE_SHEETS_CONFIG = GOOGLE_SHEETS_CONFIG;
}

// Node.js에서 사용할 수 있도록 모듈로 내보내기
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GOOGLE_SHEETS_CONFIG;
}

/*
Google Apps Script 연동 설정 방법:

🚀 더 쉽고 안전한 방법입니다!

1. 구글 시트 생성 (https://sheets.google.com)
2. 확장 프로그램 → Apps Script 클릭
3. 제공된 코드를 복사하여 붙여넣기
4. 스프레드시트 ID를 코드에 입력
5. 배포 → 새 배포 → 웹앱으로 배포
6. 웹앱 URL을 복사하여 APPS_SCRIPT_URL에 입력

장점:
✅ API 키 불필요 (보안 강화)
✅ 설정이 더 간단
✅ 구글에서 직접 관리
✅ 자동 권한 관리

자세한 설정 방법: http://localhost:3000/google-apps-script-setup.html
*/
