const express = require('express');
const axios = require('axios');
const router = express.Router();

// --- 1. 配置区域 (全面升级支持多厂区) ---
const CONFIGS = {
    'A08': {
        title: "A08 访客通 Pro V1.4",
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
            "NDMyOTAxMTk4MjExMDUyMDE2",
            "MTAyNDE5NDY=",
            "MDczOTM0Njc=",
            "NDIyMzI2MTk5NTA0Mjg2NDEx" // 窦
        ],
        regPerson: "17614625112",
        acToken: "E5EF067A42A792436902EB275DCCA379812FF4A4A8A756BE0A1659704557309F"
    },
    'Q01': {
        title: "QA01 访客通 Pro V1.4",
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
            "WjkwOTQwMSg3KQ==", //冼延浩 (新)
            "NDQxNDgxMTk4ODAzMTYwODky", //张远彬 (新)
            "MDcyMjg1Nzc=", //朱会民 (新)
            "NTMyNDY5ODc0",
            "NDIyMzI2MTk5NTA0Mjg2NDEx" //竇桂陽
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
    // 强制显示北京时间 HH:mm:ss
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

// --- 3. 核心业务逻辑 (内聚化分组逻辑，一人一卡) ---
const fetchPersonData = async (id, headers, todayDayId, regPerson, acToken) => {
    const startTime = Date.now();
    const targetUrl = 'https://dingtalk.avaryholding.com:8443/dingplus/visitorConnector/visitorStatus';
    const idTail = id.length > 4 ? id.slice(-4) : id;

    const result = {
        name: '未知',
        idTail: idTail,
        success: false,
        approverGroups: [], // 核心数据结构变为按接待人分组的数组
        globalStatus: { hasActive: false, hasPending: false, hasFuture: false, hasRejected: false },
        rawData: [], // 恢复全局 rawData
        cost: 0
    };

    const body = { visitorIdNo: id, regPerson: regPerson, acToken: acToken };

    try {
        const response = await axios.post(targetUrl, body, { headers, timeout: 8000 });
        const resData = response.data;
        result.cost = Date.now() - startTime;

        if (resData.code === 200 && Array.isArray(resData.data)) {
            result.success = true;
            result.rawData = resData.data; // 保持原始总数据

            if (resData.data.length > 0) {
                result.name = resData.data[0].visitorName || '未知';

                // 【改动】首先按接待人 (rPersonName) 将原始数据分堆
                const rawByApprover = {};
                resData.data.forEach(item => {
                    const approver = item.rPersonName || '未知接待人';
                    if (!rawByApprover[approver]) rawByApprover[approver] = [];
                    rawByApprover[approver].push(item);
                });

                // 对每个接待人的数据进行独立的梳理和合并
                for (const [approver, records] of Object.entries(rawByApprover)) {
                    const groupObj = {
                        approver: approver,
                        priorityList: [],
                        historyList: [],
                        rawData: records
                    };

                    const groups = {};
                    records.forEach(item => {
                        // 【改动1】增加拒绝状态的判断
                        let statusType = 'APPROVED';
                        if (String(item.flowStatus) === '1') statusType = 'PENDING';
                        if (String(item.flowStatus) === '3') statusType = 'REJECTED';

                        const key = statusType;
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

                    // 【改动2】排除 审核中(1) 和 拒绝(3)，其余才是真正的通过范围
                    const approvedRanges = mergedList.filter(m => String(m.flowStatus) !== '1' && String(m.flowStatus) !== '3');
                    mergedList = mergedList.filter(item => {
                        if (String(item.flowStatus) !== '1' && String(item.flowStatus) !== '3') return true;
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

                        // 【改动3】优先判断是否为拒绝
                        if (endId < todayDayId) type = 'HISTORY';
                        else if (String(item.flowStatus) === '3') type = 'REJECTED';
                        else if (String(item.flowStatus) === '1') type = 'PENDING';
                        else if (startId > todayDayId) type = 'FUTURE';
                        else type = 'ACTIVE';

                        const baseItem = { ...item, _type: type };

                        if (type === 'FUTURE' || type === 'PENDING' || type === 'REJECTED') {
                            groupObj.priorityList.push({ ...baseItem, _displayStart: item.rangeStart, _displayEnd: item.rangeEnd });
                        } else if (type === 'ACTIVE') {
                            groupObj.priorityList.push({ ...baseItem, _displayStart: (startId < todayDayId) ? getNowTs() : item.rangeStart, _displayEnd: item.rangeEnd });
                        }

                        if (type === 'HISTORY') {
                            groupObj.historyList.push({ ...baseItem, _displayStart: item.rangeStart, _displayEnd: item.rangeEnd });
                        } else if (type === 'ACTIVE' && startId < todayDayId) {
                            const yesterdayTs = getNowTs() - 86400000;
                            groupObj.historyList.push({ ...baseItem, _displayStart: item.rangeStart, _displayEnd: yesterdayTs });
                        }
                    });

                    // 给内部记录定义权重
                    const typeWeight = {
                        'ACTIVE': 4,
                        'PENDING': 3,
                        'FUTURE': 2,
                        'REJECTED': 1
                    };

                    groupObj.priorityList.sort((a, b) => {
                        // 优先按状态权重排，状态越重要越靠前
                        const weightDiff = typeWeight[b._type] - typeWeight[a._type];
                        if (weightDiff !== 0) return weightDiff;

                        // 如果状态一样（比如都是预约的），按时间最近的排在前面
                        return b.rangeStart - a.rangeStart;
                    });

                    groupObj.historyList.sort((a, b) => b.rangeStart - a.rangeStart);

                    // 记录全局状态，用于外层卡片Header显示
                    if (groupObj.priorityList.some(i => i._type === 'ACTIVE')) result.globalStatus.hasActive = true;
                    if (groupObj.priorityList.some(i => i._type === 'PENDING')) result.globalStatus.hasPending = true;
                    if (groupObj.priorityList.some(i => i._type === 'FUTURE')) result.globalStatus.hasFuture = true;
                    if (groupObj.priorityList.some(i => i._type === 'REJECTED')) result.globalStatus.hasRejected = true;

                    result.approverGroups.push(groupObj);
                }
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
    const updateTimeStr = getBeijingTimeStr();
    const rawJsonStr = encodeURIComponent(JSON.stringify(person.rawData, null, 2)); // 恢复总数据 JSON

    let statusBadge = '<span class="status-badge badge-gray">无记录</span>';
    if (person.globalStatus.hasActive) statusBadge = '<span class="status-badge badge-green">生效中</span>';
    else if (person.globalStatus.hasRejected) statusBadge = '<span class="status-badge badge-red">已拒绝</span>';
    else if (person.globalStatus.hasPending) statusBadge = '<span class="status-badge badge-yellow">审核中</span>';
    else if (person.globalStatus.hasFuture) statusBadge = '<span class="status-badge badge-blue">已预约</span>';
    else if (!person.success) statusBadge = '<span class="status-badge badge-red">失败</span>';

    // 组装内部数据块 HTML
    let bodyHtml = '';
    if (person.approverGroups.length === 0) {
        bodyHtml = '<div class="empty-tip">暂无任何记录</div>';
    } else {
        bodyHtml = person.approverGroups.map(group => {
            const priorityHtml = group.priorityList.map(item => {
                const startStr = getFormattedDate(item._displayStart);
                const endStr = getFormattedDate(item._displayEnd);
                let tagClass = 'tag-gray', iconClass = 'dot-gray';
                let tagName = '记录';

                if (item._type === 'ACTIVE') { tagClass = 'tag-green'; iconClass = 'dot-green'; tagName = '今日'; }
                if (item._type === 'FUTURE') { tagClass = 'tag-blue'; iconClass = 'dot-blue'; tagName = '预约'; }
                if (item._type === 'PENDING') { tagClass = 'tag-yellow'; iconClass = 'dot-yellow'; tagName = '审核'; }
                if (item._type === 'REJECTED') { tagClass = 'tag-red'; iconClass = 'dot-red'; tagName = '拒绝'; }

                return `
                    <div class="row-item main-row">
                        <div class="row-left">
                            <div class="dot ${iconClass}"></div>
                            <div class="time-range">${startStr} - ${endStr}</div>
                            <div class="mini-tag ${tagClass}">${tagName}</div>
                        </div>
                    </div>`;
            }).join('');

            const historyHtml = group.historyList.length > 0 ? `
                <div class="history-box">
                    <div class="history-trigger" onclick="toggleHistory(this)">
                        <span>🕒 历史记录 (${group.historyList.length})</span>
                        <span class="arrow">▼</span>
                    </div>
                    <div class="history-content">
                        ${group.historyList.map(item => {
                const startStr = getFormattedDate(item._displayStart);
                const endStr = getFormattedDate(item._displayEnd);
                const isPending = String(item.flowStatus) === '1';
                const isRejected = String(item.flowStatus) === '3';

                let historyDot = 'dot-gray-light';
                let historyTag = '';
                if (isPending) { historyDot = 'dot-yellow'; historyTag = '<span style="color:#f59e0b;font-size:10px;margin-left:4px">[审]</span>'; }
                if (isRejected) { historyDot = 'dot-red'; historyTag = '<span style="color:#ef4444;font-size:10px;margin-left:4px">[拒]</span>'; }

                return `
                            <div class="row-item history-row">
                                <div class="row-left">
                                    <div class="dot ${historyDot}"></div>
                                    <div class="time-range">${startStr} - ${endStr}</div>
                                    ${historyTag}
                                </div>
                            </div>`;
            }).join('')}
                    </div>
                </div>
            ` : '';

            return `
                <div class="approver-block">
                    <div class="approver-header">
                        <span class="approver-name">接待人: ${group.approver}</span>
                    </div>
                    ${priorityHtml || '<div class="empty-tip" style="padding:4px 0;">无活跃记录</div>'}
                    ${historyHtml}
                </div>
            `;
        }).join('');
    }

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
                ${bodyHtml}
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
        res.json({
            html,
            hasActive: person.globalStatus.hasActive,
            hasPending: person.globalStatus.hasPending,
            hasFuture: person.globalStatus.hasFuture
        });
    } catch (e) {
        res.json({ html: '<div class="app-card error">数据获取异常</div>', hasActive: false });
    }
});

// 微信文本版接口 (向下兼容)
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

        results.sort((a, b) => (b.globalStatus.hasActive ? 1 : 0) - (a.globalStatus.hasActive ? 1 : 0));

        results.forEach(p => {
            if (!p.success) { outputLines.push(`\n❌ ${p.idTail} 失败`); return; }
            if (p.approverGroups.length === 0) outputLines.push(`\n👤 ${p.name}\n⚪ 无记录`);
            else {
                outputLines.push(`\n👤 ${p.name}`);
                p.approverGroups.forEach(g => {
                    if (g.priorityList.length > 0) {
                        g.priorityList.forEach(i => {
                            let icon = '🔵';
                            if (i._type === 'PENDING') icon = '🟡';
                            else if (i._type === 'ACTIVE') icon = '🟢';
                            else if (i._type === 'REJECTED') icon = '🔴';
                            outputLines.push(`${icon} [${g.approver}] ${getFormattedDate(i._displayStart)}-${getFormattedDate(i._displayEnd)}`);
                        });
                    }
                });
            }
        });
        res.header('Content-Type', 'text/plain; charset=utf-8');
        res.send(outputLines.join('\n'));
    } catch (e) { res.status(500).send('Error'); }
});

// 网页主入口 (SPA 丝滑切换改版)
router.get('/visitor-status', async (req, res) => {
    // 提取两个厂区的关键配置传入前端
    const frontendConfigs = {
        'A08': { title: CONFIGS['A08'].title, ids: CONFIGS['A08'].visitorIdNos },
        'Q01': { title: CONFIGS['Q01'].title, ids: CONFIGS['Q01'].visitorIdNos }
    };
    const frontendConfigsScript = JSON.stringify(frontendConfigs);

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

        /* --- 顶部导航 --- */
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

        /* 厂区丝滑切换 Tab (无跳转刷新) */
        .tabs { display: flex; gap: 8px; margin-top: 12px; }
        .tab { 
            flex: 1; text-align: center; padding: 8px 0; background: #e2e8f0; 
            border-radius: 8px; color: #64748b; font-weight: 600; 
            cursor: pointer; font-size: 13px; transition: all 0.2s;
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

        .status-badge { padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; }
        .badge-green { background: #dcfce7; color: #166534; }
        .badge-yellow { background: #fef9c3; color: #854d0e; }
        .badge-blue { background: #dbeafe; color: #1e40af; }
        .badge-gray { background: #f1f5f9; color: #64748b; }
        .badge-red { background: #fee2e2; color: #991b1b; }

        /* --- 新增：接待人分块设计 --- */
        .card-body { padding: 12px 16px; }
        .approver-block {
            background: #f8fafc;
            border-radius: 10px;
            padding: 10px;
            margin-bottom: 10px;
            border: 1px solid #e2e8f0;
        }
        .approver-block:last-child { margin-bottom: 0; }
        .approver-header {
            display: flex; justify-content: space-between; align-items: center;
            margin-bottom: 8px; padding-bottom: 6px; border-bottom: 1px dashed #cbd5e1;
        }
        .approver-name { font-size: 13px; font-weight: 600; color: #334155; }

        .row-item { display: flex; justify-content: space-between; align-items: center; padding: 4px 0; }
        .row-left { display: flex; align-items: center; gap: 8px; }
        
        .dot { width: 8px; height: 8px; border-radius: 50%; }
        .dot-green { background: #22c55e; box-shadow: 0 0 0 2px #dcfce7; }
        .dot-blue { background: #3b82f6; box-shadow: 0 0 0 2px #dbeafe; }
        .dot-yellow { background: #eab308; box-shadow: 0 0 0 2px #fef9c3; }
        .dot-red { background: #ef4444; box-shadow: 0 0 0 2px #fee2e2; } 
        .dot-gray { background: #cbd5e1; }
        .dot-gray-light { background: #e2e8f0; }
        
        .time-range { font-size: 14px; font-weight: 500; color: #334155; font-family: monospace; letter-spacing: -0.5px; }
        
        .mini-tag { font-size: 10px; padding: 1px 5px; border-radius: 4px; transform: scale(0.9); }
        .tag-green { background: #22c55e; color: white; }
        .tag-blue { background: #3b82f6; color: white; }
        .tag-yellow { background: #eab308; color: white; }
        .tag-red { background: #ef4444; color: white; }
        .tag-gray { background: #f1f5f9; color: #64748b; }
        
        .empty-tip { text-align: center; color: #94a3b8; font-size: 12px; padding: 8px 0; }

        .history-box { margin-top: 8px; border-top: 1px dashed #e2e8f0; padding-top: 6px; }
        .history-trigger { font-size: 11px; color: #94a3b8; display: flex; justify-content: space-between; cursor: pointer; padding: 4px 0; }
        .history-content { display: none; margin-top: 4px; }
        .history-content.show { display: block; }
        .history-row { opacity: 0.6; padding: 2px 0; }
        .arrow { transition: transform 0.2s; }
        .history-trigger.active .arrow { transform: rotate(180deg); }

        .card-footer { 
            background: #f8fafc; border-top: 1px solid #f1f5f9; padding: 8px 16px; 
            display: flex; justify-content: space-between; align-items: center;
        }
        .footer-meta { font-size: 11px; color: #94a3b8; font-family: monospace; display: flex; align-items: center; }
        .sep { margin: 0 6px; color: #e2e8f0; }
        
        /* 恢复原版按钮样式 */
        .footer-btn { 
            font-size: 11px; font-weight: 600; color: var(--primary); 
            background: rgba(37, 99, 235, 0.08); padding: 4px 10px; border-radius: 6px; 
            cursor: pointer; display: flex; align-items: center; gap: 4px;
        }
        .footer-btn:active { background: rgba(37, 99, 235, 0.15); }

        /* 骨架屏 */
        .skeleton { animation: pulse-bg 1.5s infinite; background: #e2e8f0; border-radius: 4px; }
        .skeleton-text { height: 16px; width: 60%; margin-bottom: 6px; }
        .skeleton-circle { height: 40px; width: 40px; border-radius: 50%; }
        @keyframes pulse-bg { 0% { opacity: 0.6; } 50% { opacity: 1; } 100% { opacity: 0.6; } }

        /* Toast */
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

        /* Modal */
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
            <div class="live-dot"></div> <span id="mainTitle"></span>
        </div>
        <div class="btn-refresh" id="refreshBtn" onclick="manualRefresh()">🔄</div>
    </div>
    <div class="search-wrap">
        <input type="text" class="search-input" id="searchInput" placeholder="🔍 搜索姓名或身份证后4位..." onkeyup="filterList()">
    </div>
    
    <div class="tabs">
        <div id="tab-A08" class="tab active" onclick="switchTab('A08')">🏢 A08 厂区</div>
        <div id="tab-Q01" class="tab" onclick="switchTab('Q01')">🏢 Q01 厂区</div>
    </div>

    <div class="progress-bar-container">
        <div class="progress-bar" id="progressBar"></div>
    </div>
</div>

<div class="container" id="cardList">
    </div>

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
    const locConfigs = ${frontendConfigsScript};
    let currentLoc = 'A08';
    let idList = locConfigs[currentLoc].ids;
    
    // 核心并发锁：记录当前的请求批次，每次点击 Tab 切换就会 +1
    let currentFetchVersion = 0; 
    
    const INTERVAL = 120;
    let countDown = INTERVAL;
    let timer = null;

    window.onload = function() {
        updateTitleAndMeta();
        renderSkeletons();
        startLoop();
        loadData(true); 
    };

    function updateTitleAndMeta() {
        document.getElementById('mainTitle').innerText = locConfigs[currentLoc].title;
        document.title = locConfigs[currentLoc].title;
    }

    function renderSkeletons() {
        const container = document.getElementById('cardList');
        container.innerHTML = idList.map(function(id, idx) {
            return '<div class="app-card" id="wrapper-' + idx + '" style="padding:16px;">' +
                   '<div style="display:flex;gap:12px;align-items:center;">' +
                   '<div class="skeleton skeleton-circle"></div>' +
                   '<div style="flex:1">' +
                   '<div class="skeleton skeleton-text"></div>' +
                   '<div class="skeleton skeleton-text" style="width:40%"></div>' +
                   '</div></div></div>';
        }).join('');
    }

    // --- 丝滑切换核心逻辑 ---
    function switchTab(loc) {
        if (currentLoc === loc) return; // 点相同的无视
        
        currentLoc = loc;
        idList = locConfigs[loc].ids;
        currentFetchVersion++; // 锁住新批次，旧批次的网络响应即使回来了也会被直接丢弃！

        // 更新 UI Tab 状态
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.getElementById('tab-' + loc).classList.add('active');
        
        // 恢复搜索框并更新标题
        document.getElementById('searchInput').value = '';
        updateTitleAndMeta();

        // 瞬间清空老列表并加载骨架动画
        renderSkeletons();
        
        // 立即拉取新数据
        manualRefresh();
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

        let finished = 0;
        let hasErr = false;
        
        // 保存当前这波请求的版号，用于在网络回调时验证
        const thisVersion = currentFetchVersion; 

        // ======================
        // 核心修改区：严格 100ms 发一个，不等返回
        // ======================
        const delayMs = 100; // 发包间隔（毫秒）
        let sent = 0;

        const sendOne = () => {
            const index = sent;
            const id = idList[index];
            sent++;

            fetch('visitor-card-data?loc=' + currentLoc + '&id=' + encodeURIComponent(id))
                .then(r => r.json())
                .then(d => {
                    // 【防并发锁起效点】如果版本号已经对不上，说明用户已经切换了 Tab，直接静默抛弃该旧数据！
                    if (thisVersion !== currentFetchVersion) return; 

                    const wrapper = document.getElementById('wrapper-' + index);
                    if(wrapper && d.html) {
                        // 提取所有展开了的 history block
                        const openHistoryBlocks = Array.from(wrapper.querySelectorAll('.approver-header')).map((header, i) => {
                            const content = header.parentElement.querySelector('.history-content');
                            return (content && content.classList.contains('show')) ? i : -1;
                        }).filter(i => i !== -1);

                        wrapper.outerHTML = d.html.replace('app-card', 'app-card fade-in').replace('data-key=', 'id="wrapper-'+index+'" data-key=');
                        const newWrapper = document.getElementById('wrapper-' + index);
                        
                        if(newWrapper) {
                            // 把后端传过来的状态都存到 DOM 属性上
                            newWrapper.setAttribute('data-has-active', d.hasActive ? '1' : '0');
                            newWrapper.setAttribute('data-has-pending', d.hasPending ? '1' : '0');
                            newWrapper.setAttribute('data-has-future', d.hasFuture ? '1' : '0');
                            // 恢复展开状态
                            const blocks = newWrapper.querySelectorAll('.approver-block');
                            openHistoryBlocks.forEach(idx => {
                                if (blocks[idx]) {
                                    const t = blocks[idx].querySelector('.history-trigger');
                                    const c = blocks[idx].querySelector('.history-content');
                                    if(t && c) { t.classList.add('active'); c.classList.add('show'); }
                                }
                            });
                        }
                    }
                })
                .catch(() => { 
                    if (thisVersion === currentFetchVersion) hasErr = true; 
                })
                .finally(() => {
                    if (thisVersion !== currentFetchVersion) return; // 过期请求不纳入统计
                    
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
        };

        // 启动定时器：严格每隔 delayMs 发一个
        const timer = setInterval(() => {
            sendOne();
            if (sent >= idList.length) {
                clearInterval(timer);
            }
        }, delayMs);
    }

    function sortAndFilter() {
        const container = document.getElementById('cardList');
        const cards = Array.from(container.children);
        
        // 计算权重的辅助函数
        const getWeight = (card) => {
            if (card.getAttribute('data-has-active') === '1') return 3;
            if (card.getAttribute('data-has-pending') === '1') return 2;
            if (card.getAttribute('data-has-future') === '1') return 1;
            return 0; // 无记录、失败或已拒绝
        };

        cards.sort((a, b) => {
            return getWeight(b) - getWeight(a); // 权重高的在上面
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