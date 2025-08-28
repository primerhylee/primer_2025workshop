const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');

// Google Apps Script 설정 로드
let appsScriptConfig = null;
try {
    appsScriptConfig = require('./google-sheets-config');
    if (appsScriptConfig.APPS_SCRIPT_URL && appsScriptConfig.APPS_SCRIPT_URL !== 'YOUR_WEBAPP_URL_HERE') {
        console.log('✅ Google Apps Script 연동이 설정되었습니다.');
    }
} catch (error) {
    console.log('⚠️  Google Sheets 설정 파일을 찾을 수 없습니다:', error.message);
}

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

// Google Apps Script 웹앱으로 데이터 전송
async function sendToAppsScript(submissionData) {
    try {
        if (!appsScriptConfig || !appsScriptConfig.APPS_SCRIPT_URL || 
            appsScriptConfig.APPS_SCRIPT_URL === 'YOUR_WEBAPP_URL_HERE') {
            console.log('⚠️  Google Apps Script URL이 설정되지 않았습니다.');
            return false;
        }

        console.log('📤 Google Apps Script로 데이터 전송 중...');
        
        const response = await fetch(appsScriptConfig.APPS_SCRIPT_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                ...submissionData.data,
                submissionId: submissionData.id
            })
        });

        const result = await response.json();
        
        if (result.success) {
            console.log('✅ Google Apps Script 전송 완료:', result.message);
            return true;
        } else {
            console.error('❌ Google Apps Script 오류:', result.message);
            return false;
        }

    } catch (error) {
        console.error('❌ Google Apps Script 연동 오류:', error.message);
        return false;
    }
}

// 제출 목록 업데이트
async function updateSubmissionsList() {
    try {
        const files = await fs.readdir(DATA_DIR);
        const submissionFiles = files.filter(file => file.startsWith('submission_') && file.endsWith('.json'));
        
        const submissions = [];
        for (const file of submissionFiles) {
            try {
                const filePath = path.join(DATA_DIR, file);
                const content = await fs.readFile(filePath, 'utf8');
                const submission = JSON.parse(content);
                submissions.push({
                    id: submission.id,
                    companyName: submission.data.companyName || '미입력',
                    selectionYear: submission.data.selectionYear || '미입력',
                    timestamp: submission.timestamp,
                    submittedAt: submission.submittedAt
                });
            } catch (error) {
                console.error(`파일 읽기 오류 (${file}):`, error.message);
            }
        }
        
        // 최신순으로 정렬
        submissions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        // 목록 파일 저장
        await fs.writeFile(
            path.join(DATA_DIR, 'submissions_list.json'),
            JSON.stringify(submissions, null, 2)
        );
        
        console.log(`📋 제출 목록 업데이트됨: ${submissions.length}개 항목`);
    } catch (error) {
        console.error('❌ 제출 목록 업데이트 오류:', error.message);
    }
}

// API 라우트들
app.post('/api/submit-form', async (req, res) => {
    try {
        const data = req.body;
        const timestamp = Date.now();
        const id = `${timestamp}_${Math.random().toString(36).substr(2, 9)}`;
        
        const submission = {
            id,
            timestamp,
            submittedAt: new Date().toISOString(),
            data
        };
        
        // 로컬 파일에 저장
        const filename = `submission_${id}.json`;
        const filepath = path.join(DATA_DIR, filename);
        await fs.writeFile(filepath, JSON.stringify(submission, null, 2));
        
        // 제출 목록 업데이트
        await updateSubmissionsList();
        
        console.log(`새로운 제출 저장됨: ${data.companyName || '미입력'} (${id})`);
        
        // Google Apps Script로 전송 (비동기)
        sendToAppsScript(submission).then(result => {
            if (result) {
                console.log('Google Apps Script 전송 성공');
            }
        }).catch(error => {
            console.error('Google Apps Script 전송 실패:', error.message);
        });
        
        res.json({
            success: true,
            message: '제출이 완료되었습니다.',
            submissionId: id
        });
        
    } catch (error) {
        console.error('❌ 제출 처리 오류:', error.message);
        res.status(500).json({
            success: false,
            message: '서버 오류가 발생했습니다.'
        });
    }
});

app.get('/api/submissions', async (req, res) => {
    try {
        const files = await fs.readdir(DATA_DIR);
        const submissionFiles = files.filter(file => file.startsWith('submission_') && file.endsWith('.json'));
        
        const submissions = [];
        for (const file of submissionFiles) {
            try {
                const content = await fs.readFile(path.join(DATA_DIR, file), 'utf8');
                const submission = JSON.parse(content);
                submissions.push(submission);
            } catch (error) {
                console.error(`파일 읽기 오류: ${file}`, error.message);
            }
        }
        
        // 최신순 정렬
        submissions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        res.json({
            success: true,
            submissions
        });
        
    } catch (error) {
        console.error('❌ 제출 목록 조회 오류:', error.message);
        res.status(500).json({
            success: false,
            message: '서버 오류가 발생했습니다.'
        });
    }
});

app.get('/api/submission/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const filepath = path.join(DATA_DIR, `submission_${id}.json`);
        
        const content = await fs.readFile(filepath, 'utf8');
        const submission = JSON.parse(content);
        
        res.json({
            success: true,
            submission
        });
        
    } catch (error) {
        console.error('❌ 제출 조회 오류:', error.message);
        res.status(404).json({
            success: false,
            message: '해당 제출을 찾을 수 없습니다.'
        });
    }
});

app.delete('/api/submission/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const filepath = path.join(DATA_DIR, `submission_${id}.json`);
        
        // 파일 존재 여부 확인
        let fileExists = true;
        try {
            await fs.access(filepath);
        } catch (error) {
            fileExists = false;
            console.log(`⚠️ 파일이 이미 삭제됨: ${id}`);
        }
        
        // Google Apps Script에 삭제 요청 전송
        if (appsScriptConfig && appsScriptConfig.APPS_SCRIPT_URL && 
            appsScriptConfig.APPS_SCRIPT_URL !== 'YOUR_WEBAPP_URL_HERE') {
            
            try {
                console.log('📤 Google Apps Script로 삭제 요청 전송 중...');
                
                const response = await fetch(appsScriptConfig.APPS_SCRIPT_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        action: 'delete',
                        submissionId: id
                    })
                });

                const result = await response.json();
                
                if (result.success) {
                    console.log('✅ Google Apps Script 삭제 처리 완료:', result.message);
                } else {
                    console.log('⚠️ Google Apps Script에서 항목을 찾을 수 없음 (이미 삭제되었을 수 있음):', result.message);
                }
            } catch (error) {
                console.error('❌ Google Apps Script 삭제 요청 실패:', error.message);
            }
        }
        
        // 로컬 파일이 존재하면 삭제
        if (fileExists) {
            try {
                await fs.unlink(filepath);
                console.log(`✅ 로컬 파일 삭제 완료: ${id}`);
            } catch (error) {
                console.log(`⚠️ 로컬 파일 삭제 실패 (이미 삭제됨): ${id}`);
            }
        }
        
        await updateSubmissionsList();
        
        console.log(`🗑️ 제출 삭제 처리 완료: ${id}`);
        
        res.json({
            success: true,
            message: '제출이 삭제되었습니다. (구글 시트에는 삭제 표시만 됨)'
        });
        
    } catch (error) {
        console.error('❌ 제출 삭제 오류:', error.message);
        res.status(500).json({
            success: false,
            message: '서버 오류가 발생했습니다.'
        });
    }
});

app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: '서버가 정상 작동 중입니다.',
        timestamp: new Date().toISOString(),
        appsScriptConfigured: !!(appsScriptConfig && appsScriptConfig.APPS_SCRIPT_URL && appsScriptConfig.APPS_SCRIPT_URL !== 'YOUR_WEBAPP_URL_HERE')
    });
});

// 팀 리스트 조회 API
app.get('/api/teams', async (req, res) => {
    try {
        const teamListPath = path.join(__dirname, 'team-list.json');
        const teamListData = await fs.readFile(teamListPath, 'utf8');
        const teams = JSON.parse(teamListData);
        
        res.json({
            success: true,
            teams: teams
        });
        
    } catch (error) {
        console.error('❌ 팀 리스트 조회 오류:', error.message);
        res.status(500).json({
            success: false,
            message: '팀 리스트를 불러올 수 없습니다.'
        });
    }
});

// 팀 리스트 업데이트 API
app.put('/api/teams', async (req, res) => {
    try {
        const { teams } = req.body;
        
        if (!teams || !Array.isArray(teams)) {
            return res.status(400).json({
                success: false,
                message: '올바른 팀 데이터가 필요합니다.'
            });
        }
        
        const teamListPath = path.join(__dirname, 'team-list.json');
        await fs.writeFile(teamListPath, JSON.stringify(teams, null, 2), 'utf8');
        
        console.log('✅ 팀 리스트 업데이트 완료:', teams.length + '개 팀');
        
        res.json({
            success: true,
            message: '팀 리스트가 성공적으로 업데이트되었습니다.',
            count: teams.length
        });
        
    } catch (error) {
        console.error('❌ 팀 리스트 업데이트 오류:', error.message);
        res.status(500).json({
            success: false,
            message: '팀 리스트 업데이트에 실패했습니다.'
        });
    }
});

// 팀 리스트 초기값으로 복원 API
app.post('/api/teams/reset-to-defaults', async (req, res) => {
    try {
        // 초기 기본값 데이터 (정말 필요한 경우에만 사용)
        const defaultTeams = [
            { id: 1, teamName: "1번 반조", year: 2024, representative: "대표자명", email: "email@example.com", category: "카테고리", note: "비고", additionalEmail: "" },
            { id: 2, teamName: "2번 반조", year: 2024, representative: "대표자명", email: "email@example.com", category: "카테고리", note: "비고", additionalEmail: "" },
            { id: 3, teamName: "3번 반조", year: 2024, representative: "대표자명", email: "email@example.com", category: "카테고리", note: "비고", additionalEmail: "" },
            { id: 4, teamName: "4번 반조", year: 2024, representative: "대표자명", email: "email@example.com", category: "카테고리", note: "비고", additionalEmail: "" },
            { id: 5, teamName: "5번 반조", year: 2024, representative: "대표자명", email: "email@example.com", category: "카테고리", note: "비고", additionalEmail: "" },
            { id: 6, teamName: "6번 반조", year: 2024, representative: "대표자명", email: "email@example.com", category: "카테고리", note: "비고", additionalEmail: "" },
            { id: 7, teamName: "7번 반조", year: 2024, representative: "대표자명", email: "email@example.com", category: "카테고리", note: "비고", additionalEmail: "" },
            { id: 8, teamName: "8번 반조", year: 2024, representative: "대표자명", email: "email@example.com", category: "카테고리", note: "비고", additionalEmail: "" },
            { id: 9, teamName: "9번 반조", year: 2024, representative: "대표자명", email: "email@example.com", category: "카테고리", note: "비고", additionalEmail: "" },
            { id: 10, teamName: "10번 반조", year: 2024, representative: "대표자명", email: "email@example.com", category: "카테고리", note: "비고", additionalEmail: "" },
            { id: 11, teamName: "11번 반조", year: 2024, representative: "대표자명", email: "email@example.com", category: "카테고리", note: "비고", additionalEmail: "" },
            { id: 12, teamName: "12번 반조", year: 2024, representative: "대표자명", email: "email@example.com", category: "카테고리", note: "비고", additionalEmail: "" },
            { id: 13, teamName: "13번 반조", year: 2024, representative: "대표자명", email: "email@example.com", category: "카테고리", note: "비고", additionalEmail: "" },
            { id: 14, teamName: "14번 반조", year: 2024, representative: "대표자명", email: "email@example.com", category: "카테고리", note: "비고", additionalEmail: "" },
            { id: 15, teamName: "15번 반조", year: 2024, representative: "대표자명", email: "email@example.com", category: "카테고리", note: "비고", additionalEmail: "" },
            { id: 16, teamName: "16번 반조", year: 2024, representative: "대표자명", email: "email@example.com", category: "카테고리", note: "비고", additionalEmail: "" },
            { id: 17, teamName: "17번 반조", year: 2024, representative: "대표자명", email: "email@example.com", category: "카테고리", note: "비고", additionalEmail: "" },
            { id: 18, teamName: "18번 반조", year: 2024, representative: "대표자명", email: "email@example.com", category: "카테고리", note: "비고", additionalEmail: "" },
            { id: 19, teamName: "19번 반조", year: 2024, representative: "대표자명", email: "email@example.com", category: "카테고리", note: "비고", additionalEmail: "" },
            { id: 20, teamName: "20번 반조", year: 2024, representative: "대표자명", email: "email@example.com", category: "카테고리", note: "비고", additionalEmail: "" },
            { id: 21, teamName: "21번 반조", year: 2024, representative: "대표자명", email: "email@example.com", category: "카테고리", note: "비고", additionalEmail: "" },
            { id: 22, teamName: "22번 반조", year: 2024, representative: "대표자명", email: "email@example.com", category: "카테고리", note: "비고", additionalEmail: "" },
            { id: 23, teamName: "23번 반조", year: 2024, representative: "대표자명", email: "email@example.com", category: "카테고리", note: "비고", additionalEmail: "" },
            { id: 24, teamName: "24번 반조", year: 2024, representative: "대표자명", email: "email@example.com", category: "카테고리", note: "비고", additionalEmail: "" },
            { id: 25, teamName: "25번 반조", year: 2024, representative: "대표자명", email: "email@example.com", category: "카테고리", note: "비고", additionalEmail: "" },
            { id: 26, teamName: "26번 반조", year: 2024, representative: "대표자명", email: "email@example.com", category: "카테고리", note: "비고", additionalEmail: "" },
            { id: 27, teamName: "27번 반조", year: 2024, representative: "대표자명", email: "email@example.com", category: "카테고리", note: "비고", additionalEmail: "" },
            { id: 28, teamName: "28번 반조", year: 2024, representative: "대표자명", email: "email@example.com", category: "카테고리", note: "비고", additionalEmail: "" },
            { id: 29, teamName: "29번 반조", year: 2024, representative: "대표자명", email: "email@example.com", category: "카테고리", note: "비고", additionalEmail: "" },
            { id: 30, teamName: "30번 반조", year: 2024, representative: "대표자명", email: "email@example.com", category: "카테고리", note: "비고", additionalEmail: "" },
            { id: 31, teamName: "31번 반조", year: 2024, representative: "대표자명", email: "email@example.com", category: "카테고리", note: "비고", additionalEmail: "" },
            { id: 32, teamName: "32번 반조", year: 2024, representative: "대표자명", email: "email@example.com", category: "카테고리", note: "비고", additionalEmail: "" },
            { id: 33, teamName: "33번 반조", year: 2024, representative: "대표자명", email: "email@example.com", category: "카테고리", note: "비고", additionalEmail: "" },
            { id: 34, teamName: "34번 반조", year: 2024, representative: "대표자명", email: "email@example.com", category: "카테고리", note: "비고", additionalEmail: "" },
            { id: 35, teamName: "35번 반조", year: 2024, representative: "대표자명", email: "email@example.com", category: "카테고리", note: "비고", additionalEmail: "" }
        ];

        const teamListPath = path.join(__dirname, 'team-list.json');
        await fs.writeFile(teamListPath, JSON.stringify(defaultTeams, null, 2), 'utf8');
        
        console.log(`🔄 팀 리스트 초기값으로 복원 완료: ${defaultTeams.length}개 팀`);
        
        res.json({ 
            success: true, 
            message: '팀 리스트가 초기 기본값으로 복원되었습니다.',
            count: defaultTeams.length
        });
    } catch (error) {
        console.error('❌ 팀 리스트 초기값 복원 오류:', error.message);
        res.status(500).json({ 
            success: false, 
            message: '초기값 복원 중 오류가 발생했습니다.' 
        });
    }
});

// 서버 시작
async function startServer() {
    try {
        await ensureDataDir();
        
        app.listen(PORT, () => {
            console.log('🚀 창업기업 지원 폼 서버가 http://localhost:3000 에서 실행 중입니다.');
            console.log('📁 데이터 저장 경로:', DATA_DIR);
            console.log('📋 폼 페이지: http://localhost:3000/startup_info_form_updated.html');
            console.log('📊 대시보드: http://localhost:3000/dashboard.html');
            console.log('⚙️  Apps Script 설정: http://localhost:3000/google-apps-script-setup.html');
            
            if (appsScriptConfig && appsScriptConfig.APPS_SCRIPT_URL && appsScriptConfig.APPS_SCRIPT_URL !== 'YOUR_WEBAPP_URL_HERE') {
                console.log('✅ Google Apps Script 연동 활성화됨');
            } else {
                console.log('⚠️  Google Apps Script 연동이 설정되지 않았습니다.');
            }
        });
        
    } catch (error) {
        console.error('❌ 서버 시작 오류:', error.message);
        process.exit(1);
    }
}

startServer();
