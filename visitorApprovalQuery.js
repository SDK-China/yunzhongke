const express = require('express');
const axios = require('axios');
const router = express.Router();

// --- 配置区域 ---
const CONFIG = {
    // 待查询的列表
    visitorIdNos: [
        "MTMwMzIzMTk4NjAyMjgwODFY",
        "MTMwMzIyMTk4ODA2MjQyMDE4",
        "MTMwNDI1MTk4OTA4MjkwMzE0",
        "MjMwMjMwMjAwMzAxMDEyMTM1",
        "MTMxMTIxMTk4OTAxMDU1MDEx",
        "NDEwNDIzMTk4OTA3MjIxNTMw",
        "MDMwNzE3Njg="
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

// 辅助函数：判断记录类型
const getRecordType = (item, todayId) => {
    if (String(item.flowStatus) === '1') return 'PENDING';
    
    const startId = getBeijingDayId(item.rangeStart);
    const endId = getBeijingDayId(item.rangeEnd);

    if (endId < todayId) return 'HISTORY';
    if (startId > todayId) return 'FUTURE';
    return 'ACTIVE';
};

// --- 新功能路由：批量查询访客状态 (最终修复版) ---
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

    const now = new Date();
    const nowStr = new Date(now.getTime() + 28800000).toISOString().replace(/T/, ' ').replace(/\..+/, '');
    const todayDayId = getBeijingDayId(now.getTime());
    
    let outputLines = [];
    outputLines.push(`🕒 查询时间: ${nowStr}`);
    
    try {
        // 解码
        const decodedIds = CONFIG.visitorIdNos.map(encoded => Buffer.from(encoded, 'base64').toString('utf-8'));

        for (const id of decodedIds) {
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

                    // 1. 分组与合并
                    const groups = {};
                    records.forEach(item => {
                        const statusType = String(item.flowStatus) === '1' ? 'PENDING' : 'APPROVED';
                        const key = `${item.rPersonName || '未知'}_${statusType}`;
                        if (!groups[key]) groups[key] = [];
                        groups[key].push(item);
                    });

                    let mergedList = [];
                    Object.values(groups).forEach(groupList => {
                        groupList.sort((a, b) => b.dateStart - a.dateStart); // 倒序
                        
                        let currentRange = {
                            ...groupList[0],
                            rangeStart: groupList[0].dateStart,
                            rangeEnd: groupList[0].dateEnd
                        };

                        for (let i = 1; i < groupList.length; i++) {
                            const nextItem = groupList[i];
                            const diffDays = getBeijingDayId(currentRange.rangeStart) - getBeijingDayId(nextItem.dateEnd);
                            
                            if (diffDays <= 1) { 
                                currentRange.rangeStart = nextItem.dateStart;
                            } else {
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

                    // 2. 严格分类
                    let priorityList = [];
                    let historyList = [];

                    mergedList.forEach(item => {
                        const type = getRecordType(item, todayDayId);
                        const enhancedItem = { ...item, _type: type };
                        
                        if (type === 'HISTORY') {
                            historyList.push(enhancedItem);
                        } else {
                            priorityList.push(enhancedItem);
                        }
                    });

                    // 3. 排序: 
                    // 重点列表：按开始时间倒序（远的未来 -> 近的未来 -> 今天）
                    priorityList.sort((a, b) => b.rangeStart - a.rangeStart);
                    // 历史列表：按开始时间倒序（最近的历史 -> 远古历史）
                    historyList.sort((a, b) => b.rangeStart - a.rangeStart);

                    // 4. 打印输出
                    // 重点记录（全部显示，不限制数量）
                    priorityList.forEach(item => {
                        const startStr = getFormattedDate(item.rangeStart);
                        const endStr = getFormattedDate(item.rangeEnd);
                        // 如果是当年，去掉年份
                        const currentYear = new Date().getFullYear();
                        const displayStart = startStr.startsWith(currentYear) ? startStr.slice(5) : startStr;
                        const displayEnd = endStr.startsWith(currentYear) ? endStr.slice(5) : endStr;

                        let dateDisplay = (startStr === endStr) ? displayStart : `${displayStart}-${displayEnd}`;
                        
                        let icon = "⚪";
                        let statusText = "";
                        
                        if (item._type === 'PENDING') {
                            icon = "🟡";
                            statusText = " [审核中🔥]";
                        } else if (item._type === 'ACTIVE') {
                            icon = "🟢";
                            statusText = " [今日生效]";
                        } else if (item._type === 'FUTURE') {
                            icon = "🔵";
                            statusText = " [已预约]";
                        }

                        outputLines.push(`${icon} ${dateDisplay} | 审批:${item.rPersonName}${statusText}`);
                    });

                    // 历史记录（限制显示最近3条）
                    historyList.slice(0, 3).forEach(item => {
                        const startStr = getFormattedDate(item.rangeStart);
                        const endStr = getFormattedDate(item.rangeEnd);
                        const currentYear = new Date().getFullYear();
                        const displayStart = startStr.startsWith(currentYear) ? startStr.slice(5) : startStr;
                        const displayEnd = endStr.startsWith(currentYear) ? endStr.slice(5) : endStr;

                        let dateDisplay = (startStr === endStr) ? displayStart : `${displayStart}-${displayEnd}`;
                        
                        outputLines.push(`⚪ ${dateDisplay} | 审批:${item.rPersonName}`);
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


module.exports = router;