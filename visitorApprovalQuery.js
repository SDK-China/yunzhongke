const express = require('express');
const axios = require('axios');
const router = express.Router();

// --- 1. 配置区域 (全面升级支持多厂区) ---
const CONFIGS = {
    'A08': {
        title: "A08 访客通 Pro",
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
            "NDMyOTAxMTk4MjExMDUyMDE2"
        ],
        regPerson: "17614625112",
        acToken: "E5EF067A42A792436902EB275DCCA379812FF4A4A8A756BE0A1659704557309F"
    },
    'Q01': {
        title: "Q01 访客通 Pro",
        visitorIdNos: [
            "MTMwMzIzMTk5MjEyMTY2NDM0",
            "MTMwMzIzMTk5ODA2MTQxMDU4",
            "MTMwMzIzMTk5MDAzMDc2NDE2",
            "MTMwMzIzMTk4OTA5MDQ2NDEx",
            "MDU4NDMzNDg=",
            "MTIwNDUxOTI=",
            "SzEzOTMxMihBKQ==",
            "NDMxMjIyMTk5NzEyMDUzMzEz",
            "NTIyNzMxMjAwMDAxMTAzNjEx",
            "MTMwMzIxMjAwMjA0MTY2MjE4",
            "NDUwMjIxMTk4OTA0MDUyNDNY",
            "NDIxMTgxMTk5MDAxMTc2MzFY",
            "NDQwOTgyMTk5NzEwMDgyNTk3",
            "NDExNTI0MjAwNTEyMTA3NjU2",
            "MDg5NjQ3MzI=",
            "MDYyNDg5MDE=",
            "SDAzODMzNTcy",
            "NTMyNDY5ODc0"
        ],
        regPerson: "15032325162",
        acToken: "53F44A99C6D8AADE22942CD9E1D803E8812FF4A4A8A756BE0A1659704557309F"
    }
};

// --- 2. 工具函数 ---
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const getBeijingDayId = (ts) => Math.floor((parseInt(ts) + 28800000) / 86400000);
const getNowTs = () => new Date().getTime();
const getBeijingTimeStr = () => {
    return new Date(new Date().getTime() + 28800000).toISOString().slice(11, 19);
};

const getFormattedDate = (ts) => {
    if (!ts) return '';
    const d = new Date(parseInt(ts));
    const utc8 = new Date(d.getTime() + 28800000);
    const m = (utc8.getUTCMonth() + 1).toString().padStart(2, '0');
    const day = utc8.getUTCDate().toString().padStart(2, '0');
    return `${m}/${day}`;
};

const getHeaders = () => ({
    "Host": "dingtalk.avaryholding.com:8443",
    "Connection": "keep-alive",
    "User-Agent": "Mozilla/5.0 (Linux; Android 13; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36",
    "Content-Type": "application/json",
    "Origin": "https://iw68lh.aliwork.com",
    "Referer": "https://iw68lh.aliwork.com/"
});

// --- 3. 核心业务逻辑 ---
const fetchPersonData = async (id, headers, todayDayId, regPerson, acToken) => {
    const startTime = Date.now();
    const targetUrl = 'https://dingtalk.avaryholding.com:8443/dingplus/visitorConnector/visitorStatus';
    const idTail = id.length > 4 ? id.slice(-4) : id;
    
    const result = {
        name: '未知',
        idTail: idTail,
        success: false,
        priorityList: [],
        historyList: [],
        rawData: [],
        cost: 0
    };

    const body = { visitorIdNo: id, regPerson: regPerson, acToken: acToken };

    try {
        const response = await axios.post(targetUrl, body, { headers, timeout: 6000 });
        const resData = response.data;
        result.cost = Date.now() - startTime;

        if (resData.code === 200 && Array.isArray(resData.data)) {
            result.success = true;
            result.rawData = resData.data;
            
            if (resData.data.length > 0) {
                const records = resData.data;
                result.name = records[0].visitorName || '未知';

                const groups = {};
                records.forEach(item => {
                    const statusType = String(item.flowStatus) === '1' ? 'PENDING' : 'APPROVED';
                    const key = `${item.rPersonName || '未知'}_${statusType}`;
                    if (!groups[key]) groups[key] = [];
                    groups[key].push(item);
                });

                let mergedList = [];
                Object.values(groups).forEach(groupList => {
                    groupList.sort((a, b) => b.dateStart - a.dateStart);
                    let currentRange = { ...groupList[0], rangeStart: groupList[0].dateStart, rangeEnd: groupList[0].dateEnd };

                    for (let i = 1; i < groupList.length; i++) {
                        const nextItem = groupList[i];
                        const diffDays = getBeijingDayId(currentRange.rangeStart) - getBeijingDayId(nextItem.dateEnd);
                        const breakMerge = (getBeijingDayId(currentRange.rangeStart) >= todayDayId) && (getBeijingDayId(nextItem.dateEnd) < todayDayId);

                        if (diffDays <= 1 && !breakMerge) {
                            currentRange.rangeStart = nextItem.dateStart;
                        } else {
                            mergedList.push(currentRange);
                            currentRange = { ...nextItem, rangeStart: nextItem.dateStart, rangeEnd: nextItem.dateEnd };
                        }
                    }
                    mergedList.push(currentRange);
                });

                const approvedRanges = mergedList.filter(m => String(m.flowStatus) !== '1');
                mergedList = mergedList.filter(item => {
                    if (String(item.flowStatus) !== '1') return true;
                    const pStart = parseInt(item.rangeStart);
                    const pEnd = parseInt(item.rangeEnd);
                    return !approvedRanges.some(approved => {
                        const aStart = parseInt(approved.rangeStart);
                        const aEnd = parseInt(approved.rangeEnd);
                        return (aStart <= pEnd && aEnd >= pStart);
                    });
                });

                mergedList.forEach(item => {
                    const startId = getBeijingDayId(item.rangeStart);
                    const endId = getBeijingDayId(item.rangeEnd);
                    let type = 'ACTIVE';

                    if (endId < todayDayId) type = 'HISTORY'; 
                    else if (String(item.flowStatus) === '1') type = 'PENDING';
                    else if (startId > todayDayId) type = 'FUTURE';
                    else type = 'ACTIVE';
                    
                    const baseItem = { ...item, _type: type };

                    if (type === 'FUTURE' || type === 'PENDING') {
                        result.priorityList.push({ ...baseItem, _displayStart: item.rangeStart, _displayEnd: item.rangeEnd });
                    } else if (type === 'ACTIVE') {
                        result.priorityList.push({ ...baseItem, _displayStart: (startId < todayDayId) ? getNowTs() : item.rangeStart, _displayEnd: item.rangeEnd });
                    }

                    if (type === 'HISTORY') {
                        result.historyList.push({ ...baseItem, _displayStart: item.rangeStart, _displayEnd: item.rangeEnd });
                    } else if (type === 'ACTIVE' && startId < todayDayId) {
                        const yesterdayTs = getNowTs() - 86400000;
                        result.historyList.push({ ...baseItem, _displayStart: item.rangeStart, _displayEnd: yesterdayTs });
                    }
                });

                result.priorityList.sort((a, b) => b.rangeStart - a.rangeStart);
                result.historyList.sort((a, b) => b.rangeStart - a.rangeStart);
            }
        }
    } catch (err) {
        result.cost = Date.now() - startTime;
    }
    return result;
};

// --- 4. HTML 生成逻辑 ---
const generateCardHtml = (person) => {
    const searchKey = `${person.name} ${person.idTail}`.toUpperCase();
    const rawJsonStr = encodeURIComponent(JSON.stringify(person.rawData, null, 2));
    const updateTimeStr = getBeijingTimeStr();

    let statusBadge = '<span class="status-badge badge-gray">无记录</span>';
    const hasActive = person.priorityList.some(i => i._type === 'ACTIVE');
    const hasPending = person.priorityList.some(i => i._type === 'PENDING');
    const hasFuture = person.priorityList.some(i => i._type === 'FUTURE');

    if (hasActive) statusBadge = '<span class="status-badge badge-green">生效中</span>';
    else if (hasPending) statusBadge = '<span class="status-badge badge-yellow">审核中</span>';
    else if (hasFuture) statusBadge = '<span class="status-badge badge-blue">已预约</span>';
    else if (!person.success) statusBadge = '<span class="status-badge badge-red">失败</span>';

    const priorityHtml = person.priorityList.map(item => {
        const startStr = getFormattedDate(item._displayStart);
        const endStr = getFormattedDate(item._displayEnd);
        let tagClass = 'tag-gray', iconClass = 'dot-gray';
        let tagName = '记录';
        
        if (item._type === 'ACTIVE') { tagClass = 'tag-green'; iconClass = 'dot-green'; tagName = '今日'; }
        if (item._type === 'FUTURE') { tagClass = 'tag-blue'; iconClass = 'dot-blue'; tagName = '预约'; }
        if (item._type === 'PENDING') { tagClass = 'tag-yellow'; iconClass = 'dot-yellow'; tagName = '审核'; }
        
        return `
            <div class="row-item main-row">
                <div class="row-left">
                    <div class="dot ${iconClass}"></div>
                    <div class="time-range">${startStr} - ${endStr}</div>
                    <div class="mini-tag ${tagClass}">${tagName}</div>
                </div>
                <div class="row-right">
                    <div class="approver">${item.rPersonName}</div>
                </div>
            </div>`;
    }).join('');

    const historyHtml = person.historyList.length > 0 ? `
        <div class="history-box">
            <div class="history-trigger" onclick="toggleHistory(this)">
                <span>🕒 历史记录 (${person.historyList.length})</span>
                <span class="arrow">▼</span>
            </div>
            <div class="history-content">
                ${person.historyList.map(item => {
                    const startStr = getFormattedDate(item._displayStart);
                    const endStr = getFormattedDate(item._displayEnd);
                    const isPending = String(item.flowStatus) === '1';
                    return `
                    <div class="row-item history-row">
                        <div class="row-left">
                            <div class="dot ${isPending ? 'dot-yellow' : 'dot-gray-light'}"></div>
                            <div class="time-range">${startStr} - ${endStr}</div>
                            ${isPending ? '<span style="color:#f59e0b;font-size:10px;margin-left:4px">[审]</span>' : ''}
                        </div>
                    </div>`;
                }).join('')}
            </div>
        </div>
    ` : '';

    return `
        <div class="app-card fade-in" data-key="${searchKey}">
            <div class="card-header">
                <div class="header-user">
                    <div class="avatar">${person.name[0] || '?'}</div>
                    <div class="user-meta">
                        <div class="name">${person.name}</div>
                        <div class="id-no">ID: ${person.idTail}</div>
                    </div>
                </div>
                ${statusBadge}
            </div>
            
            <div class="card-body">
                ${priorityHtml || '<div class="empty-tip">暂无活跃记录</div>'}
                ${historyHtml}
            </div>

            <div class="card-footer">
                <div class="footer-meta">
                    <span class="icon-timer">⚡</span> ${person.cost}ms
                    <span class="sep">|</span>
                    ${updateTimeStr}
                </div>
                <div class="footer-btn" onclick="openRawModal('${person.name}', '${rawJsonStr}')">
                    JSON <span class="arrow-right">→</span>
                </div>
            </div>
        </div>
    `;
};

// --- 5. 路由接口 ---

// 卡片数据 API
router.get('/visitor-card-data', async (req, res) => {
    try {
        const encodedId = req.query.id;
        const loc = req.query.loc || 'A08';
        const config = CONFIGS[loc] || CONFIGS['A08'];

        if (!encodedId) return res.json({ html: '', hasActive: false });
        const id = Buffer.from(encodedId, 'base64').toString('utf-8');
        const headers = getHeaders();
        const todayDayId = getBeijingDayId(new Date().getTime());
        const person = await fetchPersonData(id, headers, todayDayId, config.regPerson, config.acToken);
        const html = generateCardHtml(person);
        res.json({ html, hasActive: person.priorityList.length > 0 });
    } catch (e) {
        res.json({ html: '<div class="app-card error">数据获取异常</div>', hasActive: false });
    }
});

// 微信文本版 (保持之前的接口逻辑不变)
router.get('/visitor-status-Wechat', async (req, res) => {
    const loc = req.query.loc || 'A08';
    const config = CONFIGS[loc] || CONFIGS['A08'];
    const headers = getHeaders();
    const todayDayId = getBeijingDayId(new Date().getTime());
    let outputLines = [`[${loc}] 🕒 ${getBeijingTimeStr()}`];
    
    try {
        const decodedIds = config.visitorIdNos.map(encoded => Buffer.from(encoded, 'base64').toString('utf-8'));
        const promises = decodedIds.map(id => fetchPersonData(id, headers, todayDayId, config.regPerson, config.acToken));
        const results = await Promise.all(promises);
        results.sort((a, b) => (b.priorityList.length > 0 ? 1 : 0) - (a.priorityList.length > 0 ? 1 : 0));
        
        results.forEach(p => {
            if (!p.success) { outputLines.push(`\n❌ ${p.idTail} 失败`); return; }
            if (p.priorityList.length === 0) outputLines.push(`\n👤 ${p.name}\n⚪ 无记录`);
            else {
                outputLines.push(`\n👤 ${p.name}`);
                p.priorityList.forEach(i => {
                    const icon = i._type === 'PENDING' ? '🟡' : (i._type === 'ACTIVE' ? '🟢' : '🔵');
                    outputLines.push(`${icon} ${getFormattedDate(i._displayStart)}-${getFormattedDate(i._displayEnd)}`);
                });
            }
        });
        res.header('Content-Type', 'text/plain; charset=utf-8');
        res.send(outputLines.join('\n'));
    } catch (e) { res.status(500).send('Error'); }
});

// 网页主入口 (支持前端丝滑无刷新切换)
router.get('/visitor-status', async (req, res) => {
    // 把两份配置都压入前端页面中，供纯前端进行快速切换
    const allIdLists = {
        A08: CONFIGS['A08'].visitorIdNos,
        Q01: CONFIGS['Q01'].visitorIdNos
    };
    const allTitles = {
        A08: CONFIGS['A08'].title,
        Q01: CONFIGS['Q01'].title
    };

    const html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>访客通 Pro</title>
    <style>
        :root {
            --primary: #2563eb;
            --bg-body: #f1f5f9;
            --bg-card: #ffffff;
            --text-main: #0f172a;
            --text-sub: #64748b;
            --shadow-card: 0 4px 6px -1px rgba(0,0,0,0.05), 0 10px 15px -3px rgba(0,0,0,0.05);
            --radius: 16px;
        }

        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; user-select: none; }
        body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif; background: var(--bg-body); color: var(--text-main); padding-bottom: 80px; }

        /* --- 顶部导航 (Glassmorphism) --- */
        .navbar {
            position: sticky; top: 0; z-index: 100;
            background: rgba(255, 255, 255, 0.85);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border-bottom: 1px solid rgba(0,0,0,0.05);
            padding: 12px 16px;
        }
        .nav-content { display: flex; justify-content: space-between; align-items: center; height: 44px; }
        .nav-title { font-size: 18px; font-weight: 700; color: #1e293b; display: flex; align-items: center; gap: 8px; }
        .live-dot { width: 8px; height: 8px; background: #22c55e; border-radius: 50%; box-shadow: 0 0 8px #22c55e; animation: pulse 2s infinite; }
        @keyframes pulse { 0% { opacity: 0.5; transform: scale(0.9); } 50% { opacity: 1; transform: scale(1.1); } 100% { opacity: 0.5; transform: scale(0.9); } }
        
        /* 刷新倒计时进度条 */
        .progress-bar-container { position: absolute; bottom: 0; left: 0; width: 100%; height: 2px; background: transparent; }
        .progress-bar { height: 100%; background: var(--primary); width: 100%; transition: width 1s linear; }

        .btn-refresh { 
            width: 36px; height: 36px; border-radius: 50%; background: #eff6ff; color: var(--primary); 
            display: flex; align-items: center; justify-content: center; font-size: 18px; cursor: pointer; transition: all 0.2s;
        }
        .btn-refresh:active { transform: scale(0.9); background: #dbeafe; }
        .spin { animation: rotate 0.8s infinite linear; }
        @keyframes rotate { to { transform: rotate(360deg); } }

        /* 搜索框 */
        .search-wrap { margin-top: 10px; }
        .search-input {
            width: 100%; height: 36px; border-radius: 10px; border: none; background: #e2e8f0; 
            padding: 0 12px; font-size: 14px; outline: none; transition: background 0.2s;
        }
        .search-input:focus { background: #cbd5e1; }

        /* 厂区纯前端无刷新切换 Tab */
        .tabs { display: flex; gap: 8px; margin-top: 12px; }
        .tab { 
            flex: 1; text-align: center; padding: 8px 0; background: #e2e8f0; 
            border-radius: 8px; color: #64748b; font-weight: 600; cursor: pointer;
            text-decoration: none; font-size: 13px; transition: all 0.2s;
            border: 1px solid transparent;
        }
        .tab.active { 
            background: #fff; color: var(--primary); 
            box-shadow: 0 2px 4px rgba(0,0,0,0.05); 
            border-color: #cbd5e1;
        }

        /* --- 容器 --- */
        .container { padding: 16px; max-width: 600px; margin: 0 auto; }

        /* --- 卡片设计 --- */
        .app-card {
            background: var(--bg-card); border-radius: var(--radius); 
            box-shadow: var(--shadow-card); margin-bottom: 16px; 
            overflow: hidden; transition: transform 0.2s; border: 1px solid rgba(255,255,255,0.5);
        }
        .fade-in { animation: fadeIn 0.4s ease-out; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

        .card-header { padding: 14px 16px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #f1f5f9; }
        .header-user { display: flex; align-items: center; gap: 12px; }
        .avatar { 
            width: 42px; height: 42px; border-radius: 50%; background: #eff6ff; color: var(--primary); 
            font-weight: 700; display: flex; align-items: center; justify-content: center; font-size: 18px;
            border: 2px solid #fff; box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        }
        .user-meta .name { font-weight: 600; font-size: 16px; color: #334155; }
        .user-meta .id-no { font-size: 12px; color: #94a3b8; margin-top: 2px; }

        /* 状态标签 */
        .status-badge { padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; }
        .badge-green { background: #dcfce7; color: #166534; }
        .badge-yellow { background: #fef9c3; color: #854d0e; }
        .badge-blue { background: #dbeafe; color: #1e40af; }
        .badge-gray { background: #f1f5f9; color: #64748b; }
        .badge-red { background: #fee2e2; color: #991b1b; }

        .card-body { padding: 12px 16px; }
        .row-item { display: flex; justify-content: space-between; align-items: center; padding: 6px 0; }
        .row-left { display: flex; align-items: center; gap: 8px; }
        .dot { width: 8px; height: 8px; border-radius: 50%; }
        .dot-green { background: #22c55e; box-shadow: 0 0 0 2px #dcfce7; }
        .dot-blue { background: #3b82f6; box-shadow: 0 0 0 2px #dbeafe; }
        .dot-yellow { background: #eab308; box-shadow: 0 0 0 2px #fef9c3; }
        .dot-gray { background: #cbd5e1; }
        .dot-gray-light { background: #e2e8f0; }
        
        .time-range { font-size: 14px; font-weight: 500; color: #334155; font-family: monospace; letter-spacing: -0.5px; }
        .mini-tag { font-size: 10px; padding: 1px 5px; border-radius: 4px; transform: scale(0.9); }
        .tag-green { background: #22c55e; color: white; }
        .tag-blue { background: #3b82f6; color: white; }
        .tag-yellow { background: #eab308; color: white; }
        
        .approver { font-size: 12px; color: #94a3b8; }
        .empty-tip { text-align: center; color: #cbd5e1; font-size: 12px; padding: 8px 0; }

        /* 历史区域 */
        .history-box { margin-top: 10px; border-top: 1px dashed #e2e8f0; padding-top: 8px; }
        .history-trigger { font-size: 11px; color: #94a3b8; display: flex; justify-content: space-between; cursor: pointer; padding: 4px 0; }
        .history-content { display: none; margin-top: 4px; }
        .history-content.show { display: block; }
        .history-row { opacity: 0.6; padding: 4px 0; }
        .arrow { transition: transform 0.2s; }
        .history-trigger.active .arrow { transform: rotate(180deg); }

        /* 底部 Footer */
        .card-footer { 
            background: #f8fafc; border-top: 1px solid #f1f5f9; padding: 8px 16px; 
            display: flex; justify-content: space-between; align-items: center;
        }
        .footer-meta { font-size: 11px; color: #94a3b8; font-family: monospace; display: flex; align-items: center; }
        .sep { margin: 0 6px; color: #e2e8f0; }
        .footer-btn { 
            font-size: 11px; font-weight: 600; color: var(--primary); 
            background: rgba(37, 99, 235, 0.08); padding: 4px 10px; border-radius: 6px; 
            cursor: pointer; display: flex; align-items: center; gap: 4px;
        }
        .footer-btn:active { background: rgba(37, 99, 235, 0.15); }

        /* 骨架屏 Loading */
        .skeleton { animation: pulse-bg 1.5s infinite; background: #e2e8f0; border-radius: 4px; }
        .skeleton-text { height: 16px; width: 60%; margin-bottom: 6px; }
        .skeleton-circle { height: 40px; width: 40px; border-radius: 50%; }
        @keyframes pulse-bg { 0% { opacity: 0.6; } 50% { opacity: 1; } 100% { opacity: 0.6; } }

        /* 强提示 Toast */
        .toast-wrap { 
            position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%); 
            z-index: 999; display: flex; flex-direction: column; gap: 8px; pointer-events: none; 
        }
        .toast { 
            background: rgba(15, 23, 42, 0.9); backdrop-filter: blur(4px); color: white; 
            padding: 10px 24px; border-radius: 30px; font-size: 13px; font-weight: 500;
            box-shadow: 0 10px 15px -3px rgba(0,0,0,0.2); 
            opacity: 0; transform: translateY(20px); transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .toast.show { opacity: 1; transform: translateY(0); }

        /* 弹窗 */
        .modal-mask { position: fixed; inset: 0; background: rgba(0,0,0,0.4); backdrop-filter: blur(2px); z-index: 200; display: none; opacity: 0; transition: opacity 0.2s;}
        .modal-mask.show { opacity: 1; }
        .modal-panel { 
            position: fixed; bottom: 0; left: 0; width: 100%; height: 70vh; background: #fff; 
            border-radius: 20px 20px 0 0; transform: translateY(100%); transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
            z-index: 201; display: flex; flex-direction: column; box-shadow: 0 -10px 40px rgba(0,0,0,0.1);
        }
        .modal-panel.show { transform: translateY(0); }
        .modal-header { padding: 16px; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center; font-weight: 600; }
        .modal-body { flex: 1; overflow: auto; padding: 16px; background: #1e293b; color: #86efac; font-family: monospace; font-size: 11px; white-space: pre-wrap; word-break: break-all; }
        .btn-close { padding: 6px 12px; background: #f1f5f9; border-radius: 6px; font-size: 12px; border:none; color: #334155; }
        .btn-copy { padding: 6px 12px; background: #eff6ff; border-radius: 6px; font-size: 12px; border:none; color: var(--primary); margin-right: 8px;}

    </style>
</head>
<body>

<div class="navbar">
    <div class="nav-content">
        <div class="nav-title">
            <div class="live-dot"></div> <span id="navTitleText"></span>
        </div>
        <div class="btn-refresh" id="refreshBtn" onclick="manualRefresh()">🔄</div>
    </div>
    <div class="search-wrap">
        <input type="text" class="search-input" id="searchInput" placeholder="🔍 搜索姓名或身份证后4位..." onkeyup="filterList()">
    </div>
    
    <div class="tabs">
        <div class="tab active" data-loc="A08" onclick="switchLoc('A08')">🏢 A08 厂区</div>
        <div class="tab" data-loc="Q01" onclick="switchLoc('Q01')">🏢 Q01 厂区</div>
    </div>

    <div class="progress-bar-container">
        <div class="progress-bar" id="progressBar"></div>
    </div>
</div>

<div class="container" id="cardList"></div>

<div class="toast-wrap" id="toastWrap"></div>

<div class="modal-mask" id="modalMask" onclick="closeRawModal()"></div>
<div class="modal-panel" id="modalPanel">
    <div class="modal-header">
        <span id="modalTitle">源数据</span>
        <div>
            <button class="btn-copy" onclick="copyData()">复制数据</button>
            <button class="btn-close" onclick="closeRawModal()">关闭</button>
        </div>
    </div>
    <div class="modal-body" id="modalBody"></div>
</div>

<script>
    // 后端一次性注入配置，前端丝滑切换
    const ALL_ID_LISTS = ${JSON.stringify(allIdLists)};
    const ALL_TITLES = ${JSON.stringify(allTitles)};
    
    let currentLoc = "A08";
    let idList = ALL_ID_LISTS[currentLoc];
    
    const INTERVAL = 10;
    let countDown = INTERVAL;
    let timer = null;
    
    // 会话锁：防止快速点击切换时，旧厂区的数据回调冲刷掉新厂区的列表
    let currentSession = Date.now(); 

    window.onload = function() {
        // 初始化标题
        document.getElementById('navTitleText').innerText = ALL_TITLES[currentLoc];
        document.title = ALL_TITLES[currentLoc];
        
        renderSkeletons();
        startLoop();
        loadData(true); // 首次加载视为自动，静默
    };

    // 真正的丝滑核心逻辑：点击按钮只在前端换数据
    function switchLoc(newLoc) {
        if (newLoc === currentLoc) return; // 重复点击无效
        
        currentLoc = newLoc;
        idList = ALL_ID_LISTS[currentLoc];
        
        // 更新标题
        document.getElementById('navTitleText').innerText = ALL_TITLES[currentLoc];
        document.title = ALL_TITLES[currentLoc];
        
        // 切换高亮按钮
        document.querySelectorAll('.tab').forEach(el => {
            if (el.getAttribute('data-loc') === currentLoc) {
                el.classList.add('active');
            } else {
                el.classList.remove('active');
            }
        });

        // 切换时清空搜索框
        document.getElementById('searchInput').value = '';

        // 秒清空并加载骨架动画，视觉上最丝滑
        renderSkeletons();

        // 重新拉取新厂区数据
        manualRefresh();
    }

    function renderSkeletons() {
        const container = document.getElementById('cardList');
        container.innerHTML = idList.map((id, idx) => \`
            <div class="app-card" id="wrapper-\${idx}" style="padding:16px;">
                <div style="display:flex;gap:12px;align-items:center;">
                    <div class="skeleton skeleton-circle"></div>
                    <div style="flex:1">
                        <div class="skeleton skeleton-text"></div>
                        <div class="skeleton skeleton-text" style="width:40%"></div>
                    </div>
                </div>
            </div>
        \`).join('');
    }

    function startLoop() {
        if(timer) clearInterval(timer);
        timer = setInterval(() => {
            countDown--;
            updateProgress();
            if (countDown <= 0) {
                loadData(true); 
                countDown = INTERVAL;
            }
        }, 1000);
        updateProgress();
    }

    function updateProgress() {
        const pct = (countDown / INTERVAL) * 100;
        document.getElementById('progressBar').style.width = pct + '%';
    }

    function manualRefresh() {
        const btn = document.getElementById('refreshBtn');
        btn.classList.add('spin');
        setTimeout(() => btn.classList.remove('spin'), 800);
        
        countDown = INTERVAL;
        updateProgress();
        loadData(false); 
    }

    function loadData(isAuto) {
        if(isAuto) {
            showToast("⚡ 自动同步数据中...");
        } else {
            showToast("🚀 正在刷新数据...");
        }

        // 刷新会话锁标识。旧的回调只要看到 currentSession != mySession 就会默默放弃，绝不串场！
        const mySession = Date.now();
        currentSession = mySession;

        let finished = 0;
        let hasErr = false;

        idList.forEach((id, index) => {
            fetch('visitor-card-data?loc=' + currentLoc + '&id=' + encodeURIComponent(id))
                .then(r => r.json())
                .then(d => {
                    // 【绝对防御】如果这期间用户点击了别的厂区，这波回来的数据直接丢掉
                    if (currentSession !== mySession) return; 

                    const wrapper = document.getElementById('wrapper-' + index);
                    if(wrapper && d.html) {
                        const wasOpen = wrapper.querySelector('.history-content.show') ? true : false;
                        wrapper.outerHTML = d.html.replace('app-card', 'app-card fade-in').replace('id="wrapper-'+index+'"', 'id="wrapper-'+index+'"');
                        const newWrapper = document.querySelector('[data-key="'+ d.html.match(/data-key="([^"]+)"/)[1] +'"]');
                        if(newWrapper) {
                            newWrapper.id = 'wrapper-' + index;
                            newWrapper.setAttribute('data-has-active', d.hasActive ? '1' : '0');
                            if(wasOpen) {
                                const t = newWrapper.querySelector('.history-trigger');
                                const c = newWrapper.querySelector('.history-content');
                                if(t && c) { t.classList.add('active'); c.classList.add('show'); }
                            }
                        }
                    }
                })
                .catch(() => { 
                    if (currentSession !== mySession) return;
                    hasErr = true; 
                })
                .finally(() => {
                    if (currentSession !== mySession) return;
                    finished++;
                    if(finished === idList.length) {
                        sortAndFilter();
                        if(isAuto) {
                            showToast("✅ 自动更新完毕");
                        } else {
                            if(!hasErr) showToast("✅ 刷新成功");
                            else showToast("⚠️ 部分数据获取失败");
                        }
                    }
                });
        });
    }

    function sortAndFilter() {
        const container = document.getElementById('cardList');
        const cards = Array.from(container.children);
        cards.sort((a, b) => {
            const vA = parseInt(a.getAttribute('data-has-active') || '0');
            const vB = parseInt(b.getAttribute('data-has-active') || '0');
            return vB - vA;
        });
        cards.forEach(c => container.appendChild(c));
        filterList();
    }

    function filterList() {
        const key = document.getElementById('searchInput').value.toUpperCase();
        document.querySelectorAll('.app-card').forEach(card => {
            const dataKey = card.getAttribute('data-key') || '';
            card.style.display = dataKey.indexOf(key) > -1 ? '' : 'none';
        });
    }

    function showToast(msg) {
        const wrap = document.getElementById('toastWrap');
        const div = document.createElement('div');
        div.className = 'toast';
        div.innerText = msg;
        wrap.appendChild(div);
        
        requestAnimationFrame(() => {
            div.classList.add('show');
            setTimeout(() => {
                div.classList.remove('show');
                setTimeout(() => div.remove(), 300);
            }, 2500);
        });
    }

    function toggleHistory(el) {
        el.classList.toggle('active');
        const content = el.nextElementSibling;
        content.classList.toggle('show');
    }

    // Modal Logic
    const mask = document.getElementById('modalMask');
    const panel = document.getElementById('modalPanel');
    const body = document.getElementById('modalBody');
    const title = document.getElementById('modalTitle');

    function openRawModal(name, jsonEnc) {
        mask.style.display = 'block';
        setTimeout(() => mask.classList.add('show'), 10);
        panel.classList.add('show');
        title.innerText = name + " - 源数据";
        body.innerText = decodeURIComponent(jsonEnc);
        document.body.style.overflow = 'hidden';
    }

    function closeRawModal() {
        mask.classList.remove('show');
        panel.classList.remove('show');
        setTimeout(() => {
            mask.style.display = 'none';
            document.body.style.overflow = '';
        }, 300);
    }

    function copyData() {
        navigator.clipboard.writeText(body.innerText).then(() => {
            showToast("📋 已复制到剪贴板");
        });
    }
</script>
</body>
</html>
    `;
    res.send(html);
});

module.exports = router;