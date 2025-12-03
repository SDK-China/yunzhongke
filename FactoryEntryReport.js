const express = require('express');
const axios = require('axios');
const router = express.Router();

// --- 配置区域 ---
const CONFIG = {
    // 待查询的身份证列表
    visitorIdNos: [
        "13032319860228081X",
        "130322198806242018",
        "130425198908290314",
        "230230200301012135",
        "131121198901055011",
        "410423198907221530",
        "03071768"
    ],
    // 其他固定参数
    regPerson: "17614625112",
    acToken: "E5EF067A42A792436902EB275DCCA379812FF4A4A8A756BE0A1659704557309F"
};

// 辅助函数：延迟 (防止请求过快)
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// 辅助函数：格式化日期 (毫秒 -> YYYY/MM/DD)
const formatDate = (ts) => {
    if (!ts) return '--';
    const d = new Date(parseInt(ts));
    return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
};

// --- 新功能路由：批量查询访客状态 (简洁版) ---
// 访问地址: 域名/FactoryEntryReport/visitor-status
router.get('/visitor-status', async (req, res) => {
    const targetUrl = 'https://dingtalk.avaryholding.com:8443/dingplus/visitorConnector/visitorStatus';
    
    // 复刻请求头
    const headers = {
        "Host": "dingtalk.avaryholding.com:8443",
        "Connection": "keep-alive",
        "sec-ch-ua-platform": "\"Android\"",
        "User-Agent": "Mozilla/5.0 (Linux; Android 16; PJZ110 Build/BP2A.250605.015) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.7444.102 Mobile Safari/537.36",
        "Accept": "application/json, text/json",
        "sec-ch-ua": "\"Chromium\";v=\"142\", \"Android WebView\";v=\"142\", \"Not_A Brand\";v=\"99\"",
        "Content-Type": "application/json",
        "sec-ch-ua-mobile": "?1",
        "Origin": "https://iw68lh.aliwork.com",
        "X-Requested-With": "mark.via",
        "Sec-Fetch-Site": "cross-site",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Storage-Access": "active",
        "Referer": "https://iw68lh.aliwork.com/o/fkxt_index_app/FORM-AA91D5970CA048008FF29690F451EA1DDXJH?account=17614625112",
        "Accept-Encoding": "gzip, deflate, br, zstd",
        "Accept-Language": "zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7"
    };

    let outputLines = [];
    outputLines.push(`🕒 查询时间：${new Date().toLocaleString('zh-CN', {timeZone: 'Asia/Shanghai'})}`);
    outputLines.push(''); // 空行

    try {
        for (const id of CONFIG.visitorIdNos) {
            const body = {
                visitorIdNo: id,
                regPerson: CONFIG.regPerson,
                acToken: CONFIG.acToken
            };

            const idTail = id.length > 4 ? id.slice(-4) : id; // 获取身份证后四位

            try {
                const response = await axios.post(targetUrl, body, { headers, timeout: 8000 });
                const resData = response.data;

                if (resData.code === 200 && Array.isArray(resData.data) && resData.data.length > 0) {
                    const records = resData.data;
                    const visitorName = records[0].visitorName || '未知';

                    // 标题行：姓名 + 身份证尾号
                    outputLines.push(`👤 ${visitorName} (${idTail})`);

                    // 遍历记录
                    records.forEach(item => {
                        const approver = item.rPersonName || '未知';
                        const start = formatDate(item.dateStart);
                        const end = formatDate(item.dateEnd);
                        const isPending = String(item.flowStatus) === "1"; // 状态1为审核中

                        // 格式： 审批:王晗 | 2025/12/3-2026/12/3 [审核中]
                        let line = `   - 审批: ${approver} | ${start} 至 ${end}`;
                        if (isPending) {
                            line += ` 🔥[审核中]`;
                        }
                        outputLines.push(line);
                    });
                    outputLines.push(''); // 每个有记录的人之间加个空行，方便阅读

                } else {
                    // 无记录的情况，尽量简洁
                    outputLines.push(`⚪ ...${idTail} 无记录`);
                }

            } catch (reqErr) {
                outputLines.push(`❌ ...${idTail} 查询出错`);
            }

            // 延迟 300ms
            await delay(1);
        }

        // 最终输出
        res.header('Content-Type', 'text/plain; charset=utf-8');
        res.send(outputLines.join('\n'));

    } catch (err) {
        console.error('System Error:', err);
        res.status(500).send('Internal Server Error');
    }
});

// --- 原有的测试路由 (保持不变) ---
router.get('/test-cron', async (req, res) => {
    const beijingTime = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false });
    console.log(`[Cron Test] 定时任务成功触发！北京时间：${beijingTime}`);
    res.json({ success: true, message: 'Vercel Cron 测试成功', executedAt: beijingTime });
});

router.get('/test-cron-manual', async (req, res) => {
    res.json({ message: '请访问 /test-cron 来模拟 Cron 触发' });
});

module.exports = router;