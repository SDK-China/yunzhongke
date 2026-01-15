const express = require('express');
const axios = require('axios');
const router = express.Router();

// --- 配置区域 ---
const CONFIG = {
    visitorIdNos: [
        "MTMwMzIzMTk4NjAyMjgwODFY",
        "MTMwMzIyMTk4ODA2MjQyMDE4",
        "MTMwNDI1MTk4OTA4MjkwMzE0",
        "MjMwMjMwMjAwMzAxMDEyMTM1",
        "MTMxMTIxMTk4OTAxMDU1MDEx",
        "NDEwNDIzMTk4OTA3MjIxNTMw",
        "NDMyOTAxMTk4MjExMDUyMDE2",
        "NDEwOTIzMTk4ODA3MTkxMDFY",
        "MDMwNzE3Njg=",
        "NDMyOTAxMTk4MjExMDUyMDE2" // 兰斌 ID (根据你提供的源数据添加，用于测试)
    ],
    regPerson: "17614625112",
    acToken: "E5EF067A42A792436902EB275DCCA379812FF4A4A8A756BE0A1659704557309F"
};

// --- 工具函数 ---
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const getBeijingDayId = (ts) => Math.floor((parseInt(ts) + 28800000) / 86400000);
const getNowTs = () => new Date().getTime();

const getFormattedDate = (ts) => {
    if (!ts) return '';
    const d = new Date(parseInt(ts));
    const utc8 = new Date(d.getTime() + 28800000);
    const y = utc8.getUTCFullYear();
    const m = (utc8.getUTCMonth() + 1).toString().padStart(2, '0');
    const day = utc8.getUTCDate().toString().padStart(2, '0');
    return `${y}/${m}/${day}`;
};

// --- 核心逻辑：获取并处理单人数据 ---
const fetchPersonData = async (id, headers, todayDayId) => {
    const targetUrl = 'https://dingtalk.avaryholding.com:8443/dingplus/visitorConnector/visitorStatus';
    const idTail = id.length > 4 ? id.slice(-4) : id;
    
    const result = {
        name: '未知',
        idTail: idTail,
        success: false,
        priorityList: [], // 存放：ACTIVE(截断后), FUTURE, PENDING
        historyList: [],  // 存放：完全过期的 HISTORY + ACTIVE(被截断的前半段)
        rawData: []       // 完整原始数据
    };

    const body = {
        visitorIdNo: id,
        regPerson: CONFIG.regPerson,
        acToken: CONFIG.acToken
    };

    try {
        const response = await axios.post(targetUrl, body, { headers, timeout: 8000 });
        const resData = response.data;

        if (resData.code === 200 && Array.isArray(resData.data)) {
            result.success = true;
            result.rawData = resData.data;
            
            if (resData.data.length > 0) {
                const records = resData.data;
                result.name = records[0].visitorName || '未知';

                // 1. 分组 (按 审批人_状态 分组)
                const groups = {};
                records.forEach(item => {
                    const statusType = String(item.flowStatus) === '1' ? 'PENDING' : 'APPROVED';
                    const key = `${item.rPersonName || '未知'}_${statusType}`;
                    if (!groups[key]) groups[key] = [];
                    groups[key].push(item);
                });

                // 2. 合并连续日期 (核心修复位置)
                let mergedList = [];
                Object.values(groups).forEach(groupList => {
                    groupList.sort((a, b) => b.dateStart - a.dateStart);
                    
                    let currentRange = {
                        ...groupList[0],
                        rangeStart: groupList[0].dateStart,
                        rangeEnd: groupList[0].dateEnd
                    };

                    for (let i = 1; i < groupList.length; i++) {
                        const nextItem = groupList[i];
                        const diffDays = getBeijingDayId(currentRange.rangeStart) - getBeijingDayId(nextItem.dateEnd);
                        
                        // --- 新增逻辑: 跨越“今天”界限时不合并 ---
                        // 如果上一条记录是“过去”，而当前记录是“今天或未来”，强制断开。
                        // 防止 14号(过期) 和 15号(今天) 被合并成一条，导致14号无法进入历史记录。
                        const rangeEndDay = getBeijingDayId(currentRange.rangeEnd);
                        const nextStartDay = getBeijingDayId(nextItem.dateStart);
                        const isCrossingToday = (nextStartDay < todayDayId) && (rangeEndDay >= todayDayId);
                        // 注意：因为列表是倒序的(日期大在前)，nextItem其实是日期较早的那个
                        // 所以判断逻辑是：current(日期大/今天) vs next(日期小/昨天)
                        // 如果 current >= today 且 next < today，则不合并
                        const breakMerge = (getBeijingDayId(currentRange.rangeStart) >= todayDayId) && (getBeijingDayId(nextItem.dateEnd) < todayDayId);

                        if (diffDays <= 1 && !breakMerge) {
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

                // --- 2.5 冲突去重 ---
                const approvedRanges = mergedList.filter(m => String(m.flowStatus) !== '1');
                mergedList = mergedList.filter(item => {
                    if (String(item.flowStatus) !== '1') return true;
                    const pStart = parseInt(item.rangeStart);
                    const pEnd = parseInt(item.rangeEnd);
                    const isCovered = approvedRanges.some(approved => {
                        const aStart = parseInt(approved.rangeStart);
                        const aEnd = parseInt(approved.rangeEnd);
                        return (aStart <= pEnd && aEnd >= pStart);
                    });
                    return !isCovered;
                });

                // 3. 分类与分裂处理
                mergedList.forEach(item => {
                    const startId = getBeijingDayId(item.rangeStart);
                    const endId = getBeijingDayId(item.rangeEnd);
                    let type = 'ACTIVE';

                    if (endId < todayDayId) {
                        type = 'HISTORY'; 
                    } else if (String(item.flowStatus) === '1') {
                        type = 'PENDING';
                    } else if (startId > todayDayId) {
                        type = 'FUTURE';
                    } else {
                        type = 'ACTIVE';
                    }
                    
                    const baseItem = { ...item, _type: type };

                    if (type === 'FUTURE' || type === 'PENDING') {
                        result.priorityList.push({
                            ...baseItem,
                            _displayStart: item.rangeStart,
                            _displayEnd: item.rangeEnd
                        });
                    } else if (type === 'ACTIVE') {
                        result.priorityList.push({
                            ...baseItem,
                            _displayStart: (startId < todayDayId) ? getNowTs() : item.rangeStart,
                            _displayEnd: item.rangeEnd
                        });
                    }

                    if (type === 'HISTORY') {
                        result.historyList.push({
                            ...baseItem,
                            _displayStart: item.rangeStart,
                            _displayEnd: item.rangeEnd
                        });
                    } else if (type === 'ACTIVE' && startId < todayDayId) {
                        const yesterdayTs = getNowTs() - 86400000;
                        result.historyList.push({
                            ...baseItem,
                            _displayStart: item.rangeStart,
                            _displayEnd: yesterdayTs
                        });
                    }
                });

                // 4. 排序
                result.priorityList.sort((a, b) => b.rangeStart - a.rangeStart);
                result.historyList.sort((a, b) => b.rangeStart - a.rangeStart);
            }
        }
    } catch (err) {
        // success false
    }
    return result;
};

const getHeaders = () => ({
    "Host": "dingtalk.avaryholding.com:8443",
    "Connection": "keep-alive",
    "User-Agent": "Mozilla/5.0 (Linux; Android 16; PJZ110 Build/BP2A.250605.015) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.7444.102 Mobile Safari/537.36",
    "Content-Type": "application/json",
    "Origin": "https://iw68lh.aliwork.com",
    "Referer": "https://iw68lh.aliwork.com/o/fkxt_index_app/FORM-AA91D5970CA048008FF29690F451EA1DDXJH?account=17614625112"
});

// --- 路由 1: 文本版 ---
router.get('/visitor-status-Wechat', async (req, res) => {
    const headers = getHeaders();
    const now = new Date();
    const nowStr = new Date(now.getTime() + 28800000).toISOString().replace(/T/, ' ').replace(/\..+/, '');
    const todayDayId = getBeijingDayId(now.getTime());
    
    let outputLines = [`🕒 查询时间: ${nowStr}`];

    try {
        const decodedIds = CONFIG.visitorIdNos.map(encoded => Buffer.from(encoded, 'base64').toString('utf-8'));
        const promises = [];
        for (const id of decodedIds) {
            promises.push(fetchPersonData(id, headers, todayDayId));
            await delay(50);
        }
        const results = await Promise.all(promises);

        results.forEach(person => {
            if (!person.success) {
                outputLines.push(`\n❌ ${person.idTail} 查询失败或无记录`);
                return;
            }
            const hasActive = person.priorityList.length > 0;
            outputLines.push(`\n👤 ${person.name} (${person.idTail})`);
            if (!hasActive) {
                outputLines.push(`⚪ 无有效记录`);
            } else {
                person.priorityList.forEach(item => {
                    const startStr = getFormattedDate(item._displayStart);
                    const endStr = getFormattedDate(item._displayEnd);
                    let dateDisplay = (startStr === endStr) ? startStr : `${startStr}-${endStr}`;

                    let icon = "⚪";
                    let statusText = "";
                    if (item._type === 'PENDING') { icon = "🟡"; statusText = " [审核中🔥]"; }
                    else if (item._type === 'ACTIVE') { icon = "🟢"; statusText = " [今日生效]"; }
                    else if (item._type === 'FUTURE') { icon = "🔵"; statusText = " [已预约]"; }

                    outputLines.push(`${icon} ${dateDisplay} | 审批:${item.rPersonName}${statusText}`);
                });
            }
        });

        res.header('Content-Type', 'text/plain; charset=utf-8');
        res.send(outputLines.join('\n'));

    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// --- 路由 2: 网页版 ---
router.get('/visitor-status', async (req, res) => {
    const headers = getHeaders();
    const todayDayId = getBeijingDayId(new Date().getTime());
    
    const decodedIds = CONFIG.visitorIdNos.map(encoded => Buffer.from(encoded, 'base64').toString('utf-8'));
    const promises = [];
    for (const id of decodedIds) {
        promises.push(fetchPersonData(id, headers, todayDayId));
        await delay(50);
    }
    const peopleData = await Promise.all(promises);
    const nowStr = new Date(new Date().getTime() + 28800000).toISOString().replace(/T/, ' ').slice(0, 16);

    const html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>访客状态看板</title>
    <style>
        :root { --primary: #3b82f6; --success: #10b981; --bg: #f3f4f6; --card-bg: #ffffff; --text-main: #1f2937; }
        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
        body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, Roboto, sans-serif; background-color: var(--bg); color: var(--text-main); padding-bottom: 50px;}
        
        .header { background: linear-gradient(135deg, #2563eb, #1d4ed8); color: white; padding: 20px 16px; position: sticky; top: 0; z-index: 10; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .header h1 { margin: 0; font-size: 18px; display: flex; justify-content: space-between; align-items: center; }
        .search-bar { margin-top: 15px; }
        .search-input { width: 100%; padding: 10px 15px; border-radius: 20px; border: none; background: rgba(255,255,255,0.2); color: white; outline: none; }
        .search-input::placeholder { color: rgba(255,255,255,0.7); }

        .container { padding: 16px; max-width: 600px; margin: 0 auto; }
        .card { background: var(--card-bg); border-radius: 12px; padding: 16px; margin-bottom: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
        
        .card-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #f0f0f0; padding-bottom: 10px; margin-bottom: 10px; }
        .user-info { display: flex; align-items: center; gap: 10px; }
        .avatar { width: 40px; height: 40px; background: #eff6ff; color: var(--primary); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; }
        .user-name { font-weight: 600; font-size: 16px; }
        .user-id { font-size: 12px; color: #6b7280; }
        
        .status-badge { font-size: 12px; padding: 4px 8px; border-radius: 4px; }
        .badge-active { background: #d1fae5; color: #065f46; }
        .badge-pending { background: #fef3c7; color: #92400e; }
        .badge-future { background: #dbeafe; color: #1e40af; }
        .badge-none { background: #f3f4f6; color: #6b7280; }

        .record-item { display: flex; gap: 10px; font-size: 14px; margin-bottom: 8px; }
        .record-tag { font-size: 10px; padding: 1px 4px; border-radius: 3px; color: white; margin-left: 5px; vertical-align: middle; }
        .tag-active { background: #10b981; }
        .tag-future { background: #3b82f6; }
        .tag-pending { background: #f59e0b; }

        .history-section { margin-top: 12px; padding-top: 8px; border-top: 1px dashed #e5e7eb; }
        .history-toggle { font-size: 12px; color: #9ca3af; text-align: center; padding: 5px; cursor: pointer; }
        .history-list { display: none; margin-top: 5px; opacity: 0.8; }
        .history-list.open { display: block; }

        .raw-btn { display: block; width: 100%; text-align: right; color: #6b7280; font-size: 11px; margin-top: 10px; cursor: pointer; border:none; background:none;}

        /* Modal Styles */
        .modal-overlay { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 100; backdrop-filter: blur(2px); }
        .modal-content { position: fixed; bottom: 0; left: 0; width: 100%; height: 85%; background: white; border-radius: 16px 16px 0 0; display: flex; flex-direction: column; animation: slideUp 0.3s ease-out; box-shadow: 0 -4px 10px rgba(0,0,0,0.1); }
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        
        .modal-header { padding: 12px 16px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center; background: #f9fafb; border-radius: 16px 16px 0 0; }
        .modal-title { font-weight: 600; font-size: 16px; }
        .modal-actions { display: flex; gap: 10px; }
        .btn-action { border: none; padding: 6px 12px; border-radius: 6px; font-size: 13px; cursor: pointer; font-weight: 500;}
        .btn-copy { background: #2563eb; color: white; }
        .btn-close { background: #e5e7eb; color: #374151; }

        .modal-body { flex: 1; overflow-y: auto; padding: 10px; background: #1f2937; color: #a7f3d0; font-family: monospace; font-size: 11px; white-space: pre-wrap; word-break: break-all; }
    </style>
</head>
<body>

<div class="header">
    <h1>A08访客通 <span style="font-size:14px" onclick="location.reload()">🔄</span></h1>
    <div style="font-size:12px; opacity:0.8; margin-top:4px;">最后更新: ${nowStr}</div>
    <div class="search-bar">
        <input type="text" class="search-input" placeholder="搜姓名或身份证后4位..." id="searchInput" onkeyup="filterList()">
    </div>
</div>

<div class="container" id="cardList">
    ${peopleData.map(person => {
        const searchKey = `${person.name} ${person.idTail}`.toUpperCase();
        const rawJsonStr = encodeURIComponent(JSON.stringify(person.rawData, null, 2));

        let mainStatusHtml = '<span class="status-badge badge-none">无记录</span>';
        const hasActive = person.priorityList.some(i => i._type === 'ACTIVE');
        const hasPending = person.priorityList.some(i => i._type === 'PENDING');
        const hasFuture = person.priorityList.some(i => i._type === 'FUTURE');

        if (hasActive) {
            mainStatusHtml = '<span class="status-badge badge-active">生效中</span>';
        } else if (hasPending) {
            mainStatusHtml = '<span class="status-badge badge-pending">审核中</span>';
        } else if (hasFuture) {
            mainStatusHtml = '<span class="status-badge badge-future">已预约</span>';
        } else if (!person.success) {
            mainStatusHtml = '<span class="status-badge badge-none">查询失败</span>';
        }

        const priorityHtml = person.priorityList.map(item => {
            const startStr = getFormattedDate(item._displayStart);
            const endStr = getFormattedDate(item._displayEnd);
            let tag = '';
            let icon = '⚪';
            if (item._type === 'ACTIVE') { tag = '<span class="record-tag tag-active">今日生效</span>'; icon = '🟢'; }
            if (item._type === 'FUTURE') { tag = '<span class="record-tag tag-future">预约</span>'; icon = '🔵'; }
            if (item._type === 'PENDING') { tag = '<span class="record-tag tag-pending">审核中</span>'; icon = '🟡'; }
            return `<div class="record-item"><div>${icon}</div><div><div>${startStr}-${endStr} ${tag}</div><div style="font-size:12px;color:#6b7280">审批: ${item.rPersonName}</div></div></div>`;
        }).join('');

        const historyHtml = person.historyList.length > 0 ? `
            <div class="history-section">
                <div class="history-toggle" onclick="toggleHistory(this)">🕒 展开 ${person.historyList.length} 条历史记录</div>
                <div class="history-list">
                    ${person.historyList.map(item => {
                        const startStr = getFormattedDate(item._displayStart);
                        const endStr = getFormattedDate(item._displayEnd);
                        
                        // 修复逻辑：历史记录也要根据状态显示图标
                        let icon = '⚪';
                        let statusText = '';
                        if (String(item.flowStatus) === '1') { 
                            icon = '🟡'; 
                            statusText = ' [审核中]';
                        } else if (String(item.flowStatus) === '7' || String(item.flowStatus) === '5') {
                            icon = '⚪'; // 已过期或拒绝通常用灰色/白色
                        }
                        
                        return `<div class="record-item" style="opacity:0.6"><div>${icon}</div><div>${startStr}-${endStr}${statusText}</div></div>`;
                    }).join('')}
                </div>
            </div>
        ` : '';

        return `
            <div class="card" data-key="${searchKey}">
                <div class="card-header">
                    <div class="user-info">
                        <div class="avatar">${person.name[0]}</div>
                        <div><div class="user-name">${person.name}</div><div class="user-id">ID: ${person.idTail}</div></div>
                    </div>
                    ${mainStatusHtml}
                </div>
                <div>${priorityHtml || '<div style="text-align:center;color:#ccc;font-size:12px">暂无活跃记录</div>'}</div>
                ${historyHtml}
                
                <button class="raw-btn" onclick="openRawModal('${person.name}', '${rawJsonStr}')">📦 查看源数据</button>
            </div>
        `;
    }).join('')}
</div>

<div class="modal-overlay" id="rawModal" onclick="closeRawModal(event)">
    <div class="modal-content" onclick="event.stopPropagation()">
        <div class="modal-header">
            <span class="modal-title" id="modalTitle">源数据</span>
            <div class="modal-actions">
                <button class="btn-action btn-copy" onclick="copyModalContent()">📄 复制</button>
                <button class="btn-action btn-close" onclick="closeRawModal()">✖ 关闭</button>
            </div>
        </div>
        <div class="modal-body" id="modalBody"></div>
    </div>
</div>

<script>
    function filterList() {
        const val = document.getElementById('searchInput').value.toUpperCase();
        const cards = document.querySelectorAll('.card');
        cards.forEach(card => {
            const key = card.getAttribute('data-key');
            card.style.display = key.indexOf(val) > -1 ? '' : 'none';
        });
    }

    function toggleHistory(btn) {
        const list = btn.nextElementSibling;
        list.classList.toggle('open');
        btn.innerText = list.classList.contains('open') ? '⬆ 收起记录' : ('🕒 展开 ' + list.children.length + ' 条历史记录');
    }

    // Modal Logic
    const modal = document.getElementById('rawModal');
    const modalBody = document.getElementById('modalBody');
    const modalTitle = document.getElementById('modalTitle');

    function openRawModal(name, jsonStrEncoded) {
        const jsonStr = decodeURIComponent(jsonStrEncoded);
        modalTitle.innerText = name + ' - 源数据';
        modalBody.innerText = jsonStr;
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden'; // 防止背景滚动
    }

    function closeRawModal(e) {
        modal.style.display = 'none';
        document.body.style.overflow = '';
    }

    function copyModalContent() {
        const text = modalBody.innerText;
        navigator.clipboard.writeText(text).then(() => {
            const btn = document.querySelector('.btn-copy');
            const oldText = btn.innerText;
            btn.innerText = '✅ 成功';
            setTimeout(() => btn.innerText = oldText, 2000);
        });
    }
</script>
</body>
</html>
    `;
    res.send(html);
});

module.exports = router;