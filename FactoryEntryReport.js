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

// 辅助函数：延迟
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// 辅助函数：只获取日期字符串 YYYY/MM/DD
const getDateStr = (ts) => {
    if (!ts) return '';
    const d = new Date(parseInt(ts));
    const year = d.getFullYear();
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    return `${year}/${month}/${day}`;
};

// --- 新功能路由：批量查询访客状态 (极简版) ---
router.get('/visitor-status', async (req, res) => {
    const targetUrl = 'https://dingtalk.avaryholding.com:8443/dingplus/visitorConnector/visitorStatus';
    
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

    // 获取当前查询时间 (简短格式)
    const now = new Date();
    const timeStr = `${now.getMonth() + 1}/${now.getDate()} ${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    let outputLines = [];
    outputLines.push(`🕒 查询时间: ${timeStr}`);
    
    try {
        for (const id of CONFIG.visitorIdNos) {
            const body = {
                visitorIdNo: id,
                regPerson: CONFIG.regPerson,
                acToken: CONFIG.acToken
            };

            const idTail = id.length > 4 ? id.slice(-4) : id;

            try {
                const response = await axios.post(targetUrl, body, { headers, timeout: 8000 });
                const resData = response.data;

                if (resData.code === 200 && Array.isArray(resData.data) && resData.data.length > 0) {
                    const records = resData.data;
                    const visitorName = records[0].visitorName || '未知';

                    // 姓名行
                    outputLines.push(`\n👤 ${visitorName} (${idTail})`);

                    // 记录行 (最多显示最近5条，防止过长)
                    records.slice(0, 5).forEach(item => {
                        const approver = item.rPersonName || '未知';
                        const start = getDateStr(item.dateStart);
                        const end = getDateStr(item.dateEnd);
                        const isPending = String(item.flowStatus) === "1"; 

                        // 如果开始结束是同一天，只显示一个日期
                        let dateDisplay = (start === end) ? start : `${start}-${end.slice(5)}`; // 跨天时结束日期不显示年份

                        // 状态标签
                        let statusTag = isPending ? " 🔥[审核中]" : "";

                        // 极简格式: • 日期 | 审批:人 [状态]
                        outputLines.push(`• ${dateDisplay} | 审批:${approver}${statusTag}`);
                    });

                } else {
                    // 无记录不显示，或者显示极简信息，这里选择显示极简信息证明查过了
                    outputLines.push(`\n⚪ ${idTail} 无记录`);
                }

            } catch (reqErr) {
                outputLines.push(`\n❌ ${idTail} 查询失败`);
            }

            await delay(300);
        }

        res.header('Content-Type', 'text/plain; charset=utf-8');
        res.send(outputLines.join('\n'));

    } catch (err) {
        console.error('System Error:', err);
        res.status(500).send('Server Error');
    }
});

// --- 测试路由 ---
router.get('/test-cron', async (req, res) => {
    const beijingTime = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false });
    console.log(`[Cron Test] Triggered at ${beijingTime}`);
    res.json({ success: true, executedAt: beijingTime });
});

router.get('/test-cron-manual', async (req, res) => {
    res.json({ message: 'Use /test-cron' });
});

module.exports = router;