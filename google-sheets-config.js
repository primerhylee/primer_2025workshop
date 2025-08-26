// 구글 시트 연동 설정
// 이 파일은 구글 시트 API 키와 스프레드시트 ID를 관리합니다.

const GOOGLE_SHEETS_CONFIG = {
    // 구글 API 키 (Google Cloud Console에서 발급)
    API_KEY: 'YOUR_GOOGLE_API_KEY_HERE',
    
    // 구글 스프레드시트 ID (URL에서 추출)
    // https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit 에서 SPREADSHEET_ID 부분
    SPREADSHEET_ID: 'YOUR_SPREADSHEET_ID_HERE',
    
    // 시트 이름
    SHEET_NAME: '창업기업_데이터',
    
    // 헤더 행 (첫 번째 행에 들어갈 컬럼명)
    HEADERS: [
        '제출일시',
        '제출ID',
        '선정년도',
        '선정월',
        '창업기업명',
        '설립일',
        '투자일자',
        '투자금액',
        '총투자금액',
        '주식형태',
        '운영사지분율',
        '입주유형',
        'BI명',
        'BI주소',
        '입주예정여부',
        '입주예정일',
        '후속투자',
        '고용현황',
        '매출현황',
        '국내기타',
        '글로벌투자',
        '글로벌수출',
        '현지법인',
        '글로벌기타'
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
구글 시트 설정 방법:

1. Google Cloud Console (https://console.cloud.google.com/) 접속
2. 새 프로젝트 생성 또는 기존 프로젝트 선택
3. Google Sheets API 활성화
4. 사용자 인증 정보 → API 키 생성
5. 구글 시트 새로 만들기
6. 시트 URL에서 스프레드시트 ID 복사
7. 시트를 '링크가 있는 모든 사용자' 편집 권한으로 공유
8. 위의 YOUR_GOOGLE_API_KEY_HERE와 YOUR_SPREADSHEET_ID_HERE를 실제 값으로 교체

주의사항:
- API 키는 보안상 중요하므로 공개 저장소에 업로드하지 마세요
- 실제 운영시에는 환경변수나 별도 설정 파일로 관리하세요
*/
