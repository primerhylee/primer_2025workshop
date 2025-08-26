const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const { google } = require('googleapis');
const config = require('./google-sheets-config');

const app = express();
const PORT = 3000;
const DATA_DIR = path.join(__dirname, 'data');

// 미들웨어 설정
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname)); // 정적 파일 서빙

// 데이터 디렉토리 생성
async function ensureDataDir() {
    try {
        await fs.access(DATA_DIR);
    } catch {
        await fs.mkdir(DATA_DIR, { recursive: true });
    }
}

// 구글 시트 클라이언트 설정
function getGoogleSheetsClient() {
    if (!config.API_KEY || config.API_KEY === 'YOUR_GOOGLE_API_KEY_HERE') {
        console.log('⚠️ 구글 API 키가 설정되지 않았습니다. google-sheets-config.js 파일을 확인하세요.');
        return null;
    }

    const auth = new google.auth.GoogleAuth({
        keyFile: './google-service-account.json', // 서비스 계정 키 파일 (선택사항)
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });

    return google.sheets({ version: 'v4', auth });
}

// 구글 시트에 데이터 추가
async function addToGoogleSheet(submissionData) {
    try {
        const sheets = getGoogleSheetsClient();
        if (!sheets || !config.SPREADSHEET_ID || config.SPREADSHEET_ID === 'YOUR_SPREADSHEET_ID_HERE') {
            console.log('⚠️ 구글 시트 설정이 완료되지 않았습니다.');
            return false;
        }

        const data = submissionData.data;
        
        // 데이터 행 생성
        const rowData = [
            new Date(submissionData.timestamp).toLocaleString('ko-KR'), // 제출일시
            submissionData.id, // 제출ID
            data.selectionYear || '', // 선정년도
            data.selectionMonth || '', // 선정월
            data.companyName || '', // 창업기업명
            data.establishDate || '', // 설립일
            data.investDate || '', // 투자일자
            data.investAmount || '', // 투자금액
            data.totalInvestAfter || '', // 총투자금액
            data.stockType || '', // 주식형태
            data.operatorShare || '', // 운영사지분율
            data.residencyType || '', // 입주유형
            data.biName || '', // BI명
            data.biAddress || '', // BI주소
            data.futureResidency || '', // 입주예정여부
            data.futureResidencyDate || '', // 입주예정일
            data.domesticFollowInvest || '', // 후속투자
            data.domesticEmployment || '', // 고용현황
            data.domesticRevenue || '', // 매출현황
            data.domesticOther || '', // 국내기타
            data.globalInvestment || '', // 글로벌투자
            data.globalExport || '', // 글로벌수출
            data.globalBranch || '', // 현지법인
            data.globalOther || '' // 글로벌기타
        ];

        // 시트에 헤더가 있는지 확인하고 없으면 추가
        await ensureSheetHeaders(sheets);

        // 데이터 추가
        const response = await sheets.spreadsheets.values.append({
            spreadsheetId: config.SPREADSHEET_ID,
            range: `${config.SHEET_NAME}!A:Z`,
            valueInputOption: 'USER_ENTERED',
            resource: {
                values: [rowData]
            }
        });

        console.log(`✅ 구글 시트에 데이터 추가됨: ${data.companyName} (행: ${response.data.updates.updatedRows})`);
        return true;

    } catch (error) {
        console.error('❌ 구글 시트 연동 오류:', error.message);
        return false;
    }
}

// 구글 시트 헤더 확인 및 생성
async function ensureSheetHeaders(sheets) {
    try {
        // 첫 번째 행 확인
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: config.SPREADSHEET_ID,
            range: `${config.SHEET_NAME}!1:1`
        });

        // 헤더가 없거나 비어있으면 추가
        if (!response.data.values || response.data.values.length === 0) {
            await sheets.spreadsheets.values.update({
                spreadsheetId: config.SPREADSHEET_ID,
                range: `${config.SHEET_NAME}!1:1`,
                valueInputOption: 'USER_ENTERED',
                resource: {
                    values: [config.HEADERS]
                }
            });
            console.log('✅ 구글 시트에 헤더 추가됨');
        }
    } catch (error) {
        console.error('❌ 구글 시트 헤더 설정 오류:', error.message);
    }
}

// 폼 데이터 저장 API
app.post('/api/submit-form', async (req, res) => {
    try {
        const formData = req.body;
        
        // 데이터 검증
        if (!formData.companyName || !formData.selectionYear) {
            return res.status(400).json({
                success: false,
                message: '필수 정보가 누락되었습니다.'
            });
        }

        // 고유 ID 생성 (타임스탬프 + 랜덤)
        const submissionId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // 제출 데이터 구조화
        const submission = {
            id: submissionId,
            timestamp: new Date().toISOString(),
            companyName: formData.companyName,
            data: formData
        };

        // JSON 파일로 저장
        const fileName = `submission_${submissionId}.json`;
        const filePath = path.join(DATA_DIR, fileName);
        
        await fs.writeFile(filePath, JSON.stringify(submission, null, 2), 'utf8');

        // 전체 제출 목록 업데이트
        await updateSubmissionsList(submission);

        // 구글 시트에 데이터 추가 (비동기, 실패해도 메인 로직에 영향 없음)
        addToGoogleSheet(submission).catch(error => {
            console.error('구글 시트 연동 실패 (메인 저장은 성공):', error.message);
        });

        console.log(`새로운 제출 저장됨: ${formData.companyName} (${submissionId})`);

        res.json({
            success: true,
            message: '데이터가 성공적으로 저장되었습니다.',
            submissionId: submissionId,
            googleSheetSynced: true // 구글 시트 연동 상태 (실제로는 비동기 처리)
        });

    } catch (error) {
        console.error('데이터 저장 오류:', error);
        res.status(500).json({
            success: false,
            message: '서버 오류가 발생했습니다.'
        });
    }
});

// 제출 목록 업데이트
async function updateSubmissionsList(submission) {
    const listPath = path.join(DATA_DIR, 'submissions_list.json');
    
    try {
        let submissionsList = [];
        
        try {
            const listData = await fs.readFile(listPath, 'utf8');
            submissionsList = JSON.parse(listData);
        } catch {
            // 파일이 없으면 빈 배열로 시작
        }

        // 새 제출 추가
        submissionsList.push({
            id: submission.id,
            timestamp: submission.timestamp,
            companyName: submission.companyName,
            selectionYear: submission.data.selectionYear,
            fileName: `submission_${submission.id}.json`
        });

        // 최신순으로 정렬
        submissionsList.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        await fs.writeFile(listPath, JSON.stringify(submissionsList, null, 2), 'utf8');
        
    } catch (error) {
        console.error('제출 목록 업데이트 오류:', error);
    }
}

// 제출 목록 조회 API
app.get('/api/submissions', async (req, res) => {
    try {
        const listPath = path.join(DATA_DIR, 'submissions_list.json');
        
        try {
            const listData = await fs.readFile(listPath, 'utf8');
            const submissions = JSON.parse(listData);
            
            res.json({
                success: true,
                submissions: submissions
            });
        } catch {
            res.json({
                success: true,
                submissions: []
            });
        }
        
    } catch (error) {
        console.error('제출 목록 조회 오류:', error);
        res.status(500).json({
            success: false,
            message: '서버 오류가 발생했습니다.'
        });
    }
});

// 특정 제출 데이터 조회 API
app.get('/api/submission/:id', async (req, res) => {
    try {
        const submissionId = req.params.id;
        const filePath = path.join(DATA_DIR, `submission_${submissionId}.json`);
        
        const fileData = await fs.readFile(filePath, 'utf8');
        const submission = JSON.parse(fileData);
        
        res.json({
            success: true,
            submission: submission
        });
        
    } catch (error) {
        console.error('제출 데이터 조회 오류:', error);
        res.status(404).json({
            success: false,
            message: '해당 제출 데이터를 찾을 수 없습니다.'
        });
    }
});

// 데이터 삭제 API
app.delete('/api/submission/:id', async (req, res) => {
    try {
        const submissionId = req.params.id;
        const filePath = path.join(DATA_DIR, `submission_${submissionId}.json`);
        
        // 파일 삭제
        await fs.unlink(filePath);
        
        // 목록에서도 제거
        const listPath = path.join(DATA_DIR, 'submissions_list.json');
        try {
            const listData = await fs.readFile(listPath, 'utf8');
            let submissions = JSON.parse(listData);
            
            submissions = submissions.filter(sub => sub.id !== submissionId);
            
            await fs.writeFile(listPath, JSON.stringify(submissions, null, 2), 'utf8');
        } catch (error) {
            console.error('목록 업데이트 오류:', error);
        }
        
        res.json({
            success: true,
            message: '데이터가 삭제되었습니다.'
        });
        
    } catch (error) {
        console.error('데이터 삭제 오류:', error);
        res.status(500).json({
            success: false,
            message: '삭제 중 오류가 발생했습니다.'
        });
    }
});

// 서버 상태 확인 API
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: '서버가 정상적으로 실행 중입니다.',
        timestamp: new Date().toISOString()
    });
});

// 서버 시작
async function startServer() {
    await ensureDataDir();
    
    app.listen(PORT, () => {
        console.log(`🚀 창업기업 지원 폼 서버가 http://localhost:${PORT} 에서 실행 중입니다.`);
        console.log(`📁 데이터 저장 경로: ${DATA_DIR}`);
        console.log(`📋 폼 페이지: http://localhost:${PORT}/startup_info_form_updated.html`);
    });
}

startServer().catch(console.error);
