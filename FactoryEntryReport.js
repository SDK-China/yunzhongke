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

// 辅助函数：格式化时间戳 (毫秒 -> 北京时间字符串)
const formatTime = (ts) => {
    if (!ts) return '未知时间';
    // 接口返回的是字符串时间戳，转为数字
    return new Date(parseInt(ts)).toLocaleString('zh-CN', { 
        timeZone: 'Asia/Shanghai', 
        hour12: false 
    });
};

// --- 新功能路由：批量查询访客状态 ---
// 访问地址: 域名/FactoryEntryReport/visitor-status
router.get('/visitor-status', async (req, res) => {
    const targetUrl = 'https://dingtalk.avaryholding.com:8443/dingplus/visitorConnector/visitorStatus';
    
    // 这里的 Headers 严格复刻了你的抓包数据
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

    // 初始化输出文本
    let outputText = `查询时间：${new Date().toLocaleString('zh-CN', {timeZone: 'Asia/Shanghai'})}\n`;
    outputText += `========================================\n\n`;

    try {
        // 遍历每一个身份证号
        for (const id of CONFIG.visitorIdNos) {
            const body = {
                visitorIdNo: id,
                regPerson: CONFIG.regPerson,
                acToken: CONFIG.acToken
            };

            // 记录后端日志
            console.log(`[Visitor Check] 正在查询: ${id}`);

            try {
                // 发起请求，设置10秒超时
                const response = await axios.post(targetUrl, body, { headers, timeout: 10000 });
                const resData = response.data;

                // 检查接口返回状态
                if (resData.code === 200 && Array.isArray(resData.data)) {
                    const records = resData.data;
                    
                    if (records.length > 0) {
                        outputText += `🆔 身份证尾号 [${id.slice(-4)}]: 找到 ${records.length} 条记录\n`;
                        
                        // 遍历该身份证下的每一条记录
                        records.forEach((item, index) => {
                            const name = item.visitorName || '未知';
                            const approver = item.rPersonName || '未知';
                            const timeRange = `${formatTime(item.dateStart)} 至 ${formatTime(item.dateEnd)}`;
                            
                            // 状态判断逻辑
                            let statusLabel = "";
                            if (String(item.flowStatus) === "1") {
                                statusLabel = "  🔥【审核中】"; // 重点高亮
                            } else {
                                // 可以在这里添加其他状态的判断，目前仅按需显示
                                // statusLabel = " [已通过/历史]";
                            }

                            // 格式化单行输出
                            outputText += `   ${index + 1}. 申请人: ${name} | 审批人: ${approver} | 时间: ${timeRange}${statusLabel}\n`;
                        });
                    } else {
                        outputText += `🆔 身份证尾号 [${id.slice(-4)}]: 无记录\n`;
                    }
                } else {
                    outputText += `🆔 身份证 [${id}]: 接口异常 (Code: ${resData.code})\n`;
                }

            } catch (reqErr) {
                console.error(`查询失败 ${id}:`, reqErr.message);
                outputText += `🆔 身份证 [${id}]: 请求超时或失败 (${reqErr.message})\n`;
            }

            outputText += "\n----------------------------------------\n"; // 分隔线

            // 延迟 300ms，避免触发频率限制
            await delay(300);
        }

        // 发送纯文本响应，浏览器会直接渲染文字
        res.header('Content-Type', 'text/plain; charset=utf-8');
        res.send(outputText);

    } catch (err) {
        console.error('总流程异常:', err);
        res.status(500).send('服务器内部错误');
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