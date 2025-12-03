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

// 辅助函数：获取北京时间下的“天数ID”
const getBeijingDayId = (ts) => {
    return Math.floor((parseInt(ts) + 28800000) / 86400000);
};

// 辅助函数：日期格式化 (MM/DD) - 极简模式
const getShortDate = (ts) => {
    if (!ts) return '';
    const d = new Date(parseInt(ts));
    const m = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    return `${m}/${day}`; // 只返回 12/05 这种格式
};

// 辅助函数：获取状态的大类
// 1=审核中, 其他(5,6,7...)=已通过/历史
const getStatusCategory = (status) => {
    return String(status) === '1' ? 'PENDING' : 'APPROVED';
};

// --- 新功能路由：批量查询访客状态 (高亮规范版) ---
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

    // 获取当前查询时间
    const now = new Date();
    const currentTs = now.getTime();
    const todayDayId = getBeijingDayId(currentTs);
    
    const timeStr = now.toLocaleString('zh-CN', { 
        timeZone: 'Asia/Shanghai',
        year: 'numeric', month: '2-digit', day: '2-digit', 
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false
    });
    
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

                    outputLines.push(`\n👤 ${visitorName} (${idTail})`);

                    // 1. 分组：按 "审批人 + 状态大类" 归类
                    // 注意：这里用 getStatusCategory，这样状态 5,6,7 可以混在一起合并
                    const groups = {};
                    records.forEach(item => {
                        const statusCat = getStatusCategory(item.flowStatus);
                        const key = `${item.rPersonName || '未知'}_${statusCat}`;
                        if (!groups[key]) groups[key] = [];
                        groups[key].push(item);
                    });

                    // 2. 组内合并
                    let allRanges = [];
                    Object.values(groups).forEach(groupList => {
                        groupList.sort((a, b) => b.dateStart - a.dateStart); // 倒序
                        
                        let currentRange = { ...groupList[0], rangeStart: groupList[0].dateStart, rangeEnd: groupList[0].dateEnd };

                        for (let i = 1; i < groupList.length; i++) {
                            const nextItem = groupList[i];
                            const diffDays = getBeijingDayId(currentRange.rangeStart) - getBeijingDayId(nextItem.dateEnd);
                            
                            if (diffDays <= 1) { // 连续
                                currentRange.rangeStart = nextItem.dateStart;
                            } else {
                                allRanges.push(currentRange);
                                currentRange = { ...nextItem, rangeStart: nextItem.dateStart, rangeEnd: nextItem.dateEnd };
                            }
                        }
                        allRanges.push(currentRange);
                    });

                    // 3. 全局排序
                    allRanges.sort((a, b) => b.rangeStart - a.rangeStart);

                    // 4. 筛选与展示
                    // 规则：显示所有[审核中]、所有[今日/未来有效]、以及最近的3条历史
                    let displayedCount = 0;
                    
                    allRanges.forEach(item => {
                        const startDayId = getBeijingDayId(item.rangeStart);
                        const endDayId = getBeijingDayId(item.rangeEnd);
                        const isPending = String(item.flowStatus) === '1';
                        
                        // 判断是否今日或未来
                        const isFuture = startDayId > todayDayId;
                        const isTodayActive = (todayDayId >= startDayId && todayDayId <= endDayId);
                        
                        // 筛选逻辑: 必须显示的 (审核中/今日/未来) OR 最近的3条历史
                        const isMustShow = isPending || isFuture || isTodayActive;
                        if (!isMustShow && displayedCount >= 3) return; // 超过3条历史就不显示了
                        if (!isMustShow) displayedCount++;

                        // 准备显示内容
                        const approver = item.rPersonName || '未知';
                        const startStr = getShortDate(item.rangeStart);
                        const endStr = getShortDate(item.rangeEnd);
                        
                        // 日期显示优化
                        let dateDisplay = (startStr === endStr) ? startStr : `${startStr}-${endStr}`;
                        
                        // 图标与状态逻辑
                        let icon = "⚪"; // 默认历史
                        let statusText = "";

                        if (isPending) {
                            icon = "🟡";
                            statusText = " [审核中🔥]";
                        } else if (isTodayActive) {
                            icon = "🟢"; // 今日有效
                            statusText = " [今日生效]";
                        } else if (isFuture) {
                            icon = "🔵"; // 未来预约
                            statusText = " [已预约/当日生效]";
                        }

                        // 格式化输出
                        outputLines.push(`${icon} ${dateDisplay} | 审批:${approver}${statusText}`);
                    });

                } else {
                    outputLines.push(`\n⚪ ${idTail} 无记录`);
                }

            } catch (reqErr) {
                outputLines.push(`\n❌ ${idTail} 查询失败`);
            }

            await delay(1);
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