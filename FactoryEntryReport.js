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

// 辅助函数：获取北京时间下的“天数ID” (用于判断日期连续和比较)
// 计算方式：(时间戳 + 8小时时区偏移) / 一天的毫秒数，向下取整
const getBeijingDayId = (ts) => {
    return Math.floor((parseInt(ts) + 28800000) / 86400000);
};

// 辅助函数：日期格式化 (YYYY/MM/DD)
const getFormattedDate = (ts) => {
    if (!ts) return '';
    const d = new Date(parseInt(ts));
    // 强制使用北京时间计算年月日
    const utc8 = new Date(d.getTime() + 28800000); 
    const y = utc8.getUTCFullYear();
    const m = (utc8.getUTCMonth() + 1).toString().padStart(2, '0');
    const day = utc8.getUTCDate().toString().padStart(2, '0');
    return `${y}/${m}/${day}`;
};

// 辅助函数：判断记录类型 (PENDING=审核中, ACTIVE=今日有效, FUTURE=未来, HISTORY=历史)
const getRecordType = (item, todayId) => {
    if (String(item.flowStatus) === '1') return 'PENDING'; // 审核中
    
    const startId = getBeijingDayId(item.rangeStart || item.dateStart);
    const endId = getBeijingDayId(item.rangeEnd || item.dateEnd);

    // 如果结束时间早于今天，是历史
    if (endId < todayId) return 'HISTORY';
    
    // 如果开始时间晚于今天，是未来预约
    if (startId > todayId) return 'FUTURE';
    
    // 剩下的就是包含今天的（今日有效）
    return 'ACTIVE';
};

// --- 新功能路由：批量查询访客状态 (分层置顶版) ---
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

    // 获取当前查询时间 (YYYY/MM/DD HH:mm:ss)
    const now = new Date();
    // 简单粗暴转北京时间字符串
    const nowStr = new Date(now.getTime() + 28800000).toISOString().replace(/T/, ' ').replace(/\..+/, '');
    const todayDayId = getBeijingDayId(now.getTime());
    
    let outputLines = [];
    outputLines.push(`🕒 查询时间: ${nowStr}`);
    
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

                    // --- 1. 分组与合并逻辑 ---
                    // 按照 "审批人_状态类型" 分组 (例如: 王晗_APPROVED, 王晗_PENDING)
                    const groups = {};
                    records.forEach(item => {
                        // 状态分类：1是审核中，其他都视为通过/历史(APPROVED)
                        const statusType = String(item.flowStatus) === '1' ? 'PENDING' : 'APPROVED';
                        const key = `${item.rPersonName || '未知'}_${statusType}`;
                        if (!groups[key]) groups[key] = [];
                        groups[key].push(item);
                    });

                    // 组内合并连续日期
                    let mergedList = [];
                    Object.values(groups).forEach(groupList => {
                        // 按开始时间倒序排列 (最新的在前)
                        groupList.sort((a, b) => b.dateStart - a.dateStart);
                        
                        let currentRange = {
                            ...groupList[0],
                            rangeStart: groupList[0].dateStart,
                            rangeEnd: groupList[0].dateEnd
                        };

                        for (let i = 1; i < groupList.length; i++) {
                            const nextItem = groupList[i];
                            // 检查是否连续: 上一个区间的开始天 - 下一个记录的结束天 <= 1
                            const diffDays = getBeijingDayId(currentRange.rangeStart) - getBeijingDayId(nextItem.dateEnd);
                            
                            if (diffDays <= 1) { 
                                // 连续或重叠，合并：更新开始时间为更早的时间
                                currentRange.rangeStart = nextItem.dateStart;
                            } else {
                                // 不连续，归档当前区间，开启新区间
                                mergedList.push(currentRange);
                                currentRange = { 
                                    ...nextItem, 
                                    rangeStart: nextItem.dateStart, 
                                    rangeEnd: nextItem.dateEnd 
                                };
                            }
                        }
                        mergedList.push(currentRange);
                    });

                    // --- 2. 分类显示逻辑 ---
                    // 我们把合并后的记录分成两堆：重点关注(Active/Future/Pending) 和 历史(History)
                    let priorityList = [];
                    let historyList = [];

                    mergedList.forEach(item => {
                        const type = getRecordType(item, todayDayId);
                        if (type === 'HISTORY') {
                            historyList.push(item);
                        } else {
                            priorityList.push({ ...item, _type: type });
                        }
                    });

                    // 排序：重点列表按时间正序(离现在最近的在前)或倒序均可，这里按倒序(最远的未来在最上，或者最近的在最上)
                    // 建议：重点列表按时间倒序(最新的在上面)
                    priorityList.sort((a, b) => b.rangeStart - a.rangeStart);
                    // 历史列表按时间倒序
                    historyList.sort((a, b) => b.rangeStart - a.rangeStart);

                    // --- 3. 打印输出 ---
                    
                    // 打印重点关注区
                    if (priorityList.length > 0) {
                        priorityList.forEach(item => {
                            const startStr = getFormattedDate(item.rangeStart);
                            const endStr = getFormattedDate(item.rangeEnd);
                            let dateDisplay = (startStr === endStr) ? startStr.slice(5) : `${startStr.slice(5)}-${endStr.slice(5)}`;
                            
                            let icon = "";
                            let statusText = "";
                            
                            if (item._type === 'PENDING') {
                                icon = "🟡"; // 黄色等待
                                statusText = " [审核中🔥]";
                            } else if (item._type === 'ACTIVE') {
                                icon = "🟢"; // 绿色通行
                                statusText = " [今日有效]";
                            } else if (item._type === 'FUTURE') {
                                icon = "🔵"; // 蓝色预约
                                statusText = " [已预约]";
                            }

                            outputLines.push(`${icon} ${dateDisplay} | 审批:${item.rPersonName}${statusText}`);
                        });
                    }

                    // 打印历史记录区 (如果有重点记录，历史记录稍微隔开一点)
                    const maxHistory = 3; // 只显示最近3条历史
                    if (historyList.length > 0) {
                        // 如果上面有内容，加个虚线分隔，更清晰
                        // if (priorityList.length > 0) outputLines.push(`   --- 历史记录 (最近${maxHistory}条) ---`);
                        
                        historyList.slice(0, maxHistory).forEach(item => {
                            const startStr = getFormattedDate(item.rangeStart);
                            const endStr = getFormattedDate(item.rangeEnd);
                            let dateDisplay = (startStr === endStr) ? startStr.slice(5) : `${startStr.slice(5)}-${endStr.slice(5)}`;
                            
                            // 历史记录用灰色圆圈，不显示状态文字，保持简洁
                            outputLines.push(`⚪ ${dateDisplay} | 审批:${item.rPersonName}`);
                        });
                    }

                } else {
                    outputLines.push(`\n⚪ ${idTail} 无记录`);
                }

            } catch (reqErr) {
                outputLines.push(`\n❌ ${idTail} 查询失败`);
            }

            // 稍微延迟
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