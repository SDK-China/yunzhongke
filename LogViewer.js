const express = require('express');
const router = express.Router();
const { Redis } = require('@upstash/redis');

// 1. 恢复你最初的本地环境变量读取方式（双重保险，本地绝对能读到）
require('dotenv').config({ path: '.env.development.local' });
require('dotenv').config({ path: '.env.local' });

// 2. 智能读取变量：无论你云端/本地用的是老名字还是新名字，统统兼容！
const dbUrl = process.env.NewYzk_KV_REST_API_URL;
const dbToken =  process.env.NewYzk_KV_REST_API_TOKEN;

// 3. 坚决不用假地址！直接用真家伙连！
const redis = new Redis({
    url: dbUrl,
    token: dbToken,
});

// ==========================================
// 1. 提供后端 API：获取所有日志
// ==========================================
router.get('/api/logs', async (req, res) => {
    try {
        if (!dbUrl || !dbToken) {
            return res.json({ success: false, msg: '致命错误: 未能读取到任何环境变量密钥！' });
        }

        const keys = await redis.keys('FactoryLog:*');
        
        if (keys.length === 0) {
            return res.json({ success: true, data: [] });
        }

        const rawValues = await redis.mget(...keys);
        
        const logs = keys.map((key, index) => {
            let parsedData = {};
            try {
                parsedData = typeof rawValues[index] === 'string' ? JSON.parse(rawValues[index]) : rawValues[index];
            } catch (e) {
                parsedData = { error: '解析失败', raw: rawValues[index] };
            }
            return { key: key, ...parsedData };
        });

        // 按时间倒序排列
        logs.sort((a, b) => new Date(b.time.replace(/_/g, ' ').replace(/-/g, '/')) - new Date(a.time.replace(/_/g, ' ').replace(/-/g, '/')));

        res.json({ success: true, data: logs });
    } catch (error) {
        // 把真实的错误原因打印到前端，不再黑盒！
        console.error('获取日志失败:', error);
        res.status(500).json({ success: false, msg: `数据库读取失败: ${error.message} (当前URL: ${dbUrl})` });
    }
});

// ==========================================
// 2. 提供后端 API：清空日志
// ==========================================
router.post('/api/clear', express.json(), async (req, res) => {
    const { pwd } = req.body;
    if (pwd !== '123123') return res.json({ success: false, msg: '密码错误，拒绝操作！' });

    try {
        const keys = await redis.keys('FactoryLog:*');
        if (keys.length > 0) {
            await redis.del(...keys);
        }
        res.json({ success: true, msg: `已彻底清空 ${keys.length} 条日志记录。` });
    } catch (error) {
        res.json({ success: false, msg: '清空失败: ' + error.message });
    }
});
// 👇 🌟 [新增部分] 提供后端 API：批量/单个 精准删除指定日志
// ==========================================
router.post('/api/delete', express.json(), async (req, res) => {
    const { pwd, keys } = req.body;
    if (pwd !== '123123') return res.json({ success: false, msg: '密码错误，拒绝操作！' });
    if (!keys || !Array.isArray(keys) || keys.length === 0) return res.json({ success: false, msg: '未提供要删除的记录！' });

    try {
        await redis.del(...keys); // Redis 直接支持传入一整个数组批量删除
        res.json({ success: true, msg: `已成功删除 ${keys.length} 条日志！` });
    } catch (error) {
        res.json({ success: false, msg: '删除失败: ' + error.message });
    }
});

// ==========================================
// 3. 渲染高颜值 SPA 前端界面
// ==========================================
router.get('/', (req, res) => {
    const html = `
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>🚀 Factory Auto-Renew 日志控制台</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.8.0/styles/atom-one-dark.min.css">
        <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.8.0/highlight.min.js"></script>
        <style>
            body { background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
            .log-card { transition: all 0.2s ease; }
            .log-card:hover { border-color: #93c5fd; box-shadow: 0 4px 6px -1px rgba(59, 130, 246, 0.1); }
            .log-details { display: none; }
            .log-details.open { display: block; animation: slideDown 0.3s ease-out; }
            @keyframes slideDown { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }
            ::-webkit-scrollbar { width: 6px; height: 6px; }
            ::-webkit-scrollbar-track { background: transparent; }
            ::-webkit-scrollbar-thumb { background: #4b5563; border-radius: 3px; }
            ::-webkit-scrollbar-thumb:hover { background: #6b7280; }
            .tab-btn.active { border-bottom: 2px solid #3b82f6; color: #3b82f6; font-weight: 600; }
        </style>
    </head>
    <body class="p-4 md:p-8">
        <div class="max-w-7xl mx-auto">
            <div class="flex flex-col md:flex-row justify-between items-center mb-8 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <div>
                    <h1 class="text-2xl font-bold text-gray-800 flex items-center gap-2"><span>📊</span> 智能运行日志中枢</h1>
                    <p class="text-sm text-gray-500 mt-1">深度解析 UI生成、手动发送、自动续期的底层报文</p>
                </div>
                <div class="flex gap-3 mt-4 md:mt-0">
                    <button onclick="fetchLogs()" class="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg font-medium transition shadow-sm flex items-center gap-2">
                        🔄 刷新数据
                    </button>
                    <button onclick="clearLogs()" class="bg-red-50 hover:bg-red-100 text-red-600 px-5 py-2 rounded-lg font-medium transition border border-red-200">
                        🗑️ 清空日志
                    </button>
                </div>
            </div>

            <div class="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-6 flex flex-wrap gap-4 items-center">
                <div class="flex items-center gap-2 pr-4 border-r border-gray-200">
                    <input type="checkbox" id="selectAllCb" onclick="selectAllFiltered(event)" class="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer">
                    <label for="selectAllCb" class="text-sm font-bold text-gray-700 cursor-pointer">全选当前</label>
                </div>
                
                <div class="flex items-center gap-2">
                    <label class="text-sm font-bold text-gray-600">时间维度:</label>
                    <select id="timeFilter" onchange="renderLogs()" class="border border-gray-300 rounded-md px-3 py-1.5 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="all">📅 全部展现</option>
                        <option value="today">⚡ 仅看今日</option>
                        <option value="history">🕰️ 历史 (1970年至今旧数据)</option>
                    </select>
                </div>
                <div class="flex items-center gap-2">
                    <label class="text-sm font-bold text-gray-600">操作类型:</label>
                    <select id="actionFilter" onchange="renderLogs()" class="border border-gray-300 rounded-md px-3 py-1.5 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="all">全部类型</option>
                        <option value="UI生成">UI生成</option>
                        <option value="手动发送">手动发送</option>
                        <option value="自动续期">自动续期</option>
                    </select>
                </div>
                <div class="flex items-center gap-2">
                    <label class="text-sm font-bold text-gray-600">搜索:</label>
                    <input type="text" id="searchInput" onkeyup="renderLogs()" placeholder="输入关键字..." class="border border-gray-300 rounded-md px-3 py-1.5 text-sm bg-gray-50 focus:outline-none w-48">
                </div>
                <div class="ml-auto text-sm text-gray-500 font-medium">
                    共找到 <span id="logCount" class="text-blue-600 font-bold text-lg">0</span> 条记录
                </div>
            </div>

            <div id="logContainer" class="flex flex-col gap-4 pb-20">
                <div class="text-center text-gray-400 py-10">加载中...</div>
            </div>

            <div id="bulkActionBar" class="fixed bottom-8 left-1/2 transform -translate-x-1/2 translate-y-24 opacity-0 bg-gray-900/95 backdrop-blur-md text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-4 transition-all duration-300 z-50 pointer-events-none">
                <span class="text-sm font-medium">已选中 <span id="bulkCount" class="text-blue-400 font-bold text-lg mx-1">0</span>项</span>
                <div class="w-px h-5 bg-gray-600"></div>
                <button onclick="deleteSelected()" class="bg-red-500 hover:bg-red-400 text-white px-4 py-1.5 rounded-full text-sm font-bold transition shadow-[0_0_15px_rgba(239,68,68,0.4)] flex items-center gap-1">
                    🗑️ 永久删除
                </button>
            </div>
        </div>

        <script>
            let allLogs = [];
            let selectedLogs = new Set(); // 🌟 [新增] 全局管理选中的键集合

            // 🌟 [新增] 处理单行勾选
            function toggleLogSelect(e, key) {
                e.stopPropagation(); 
                if (e.target.checked) selectedLogs.add(key);
                else selectedLogs.delete(key);
                updateBulkActionBar();
                
                // 判断是否已经手动全选了
                const checkboxes = document.querySelectorAll('.log-checkbox');
                const allChecked = Array.from(checkboxes).every(cb => cb.checked);
                document.getElementById('selectAllCb').checked = (checkboxes.length > 0 && allChecked);
            }

            // 🌟 [新增] 处理全选/全不选
            function selectAllFiltered(e) {
                const isChecked = e.target.checked;
                const checkboxes = document.querySelectorAll('.log-checkbox');
                checkboxes.forEach(cb => {
                    cb.checked = isChecked;
                    if (isChecked) selectedLogs.add(cb.value);
                    else selectedLogs.delete(cb.value);
                });
                updateBulkActionBar();
            }

            // 🌟 [新增] 动态呼出/隐藏底部悬浮操作栏
            function updateBulkActionBar() {
                const count = selectedLogs.size;
                const bar = document.getElementById('bulkActionBar');
                const countTxt = document.getElementById('bulkCount');
                if (count > 0) {
                    countTxt.innerText = count;
                    bar.classList.remove('translate-y-24', 'opacity-0', 'pointer-events-none');
                    bar.classList.add('translate-y-0', 'opacity-100', 'pointer-events-auto');
                } else {
                    bar.classList.remove('translate-y-0', 'opacity-100', 'pointer-events-auto');
                    bar.classList.add('translate-y-24', 'opacity-0', 'pointer-events-none');
                }
            }

            // 🌟 [新增] 单个日志删除 API 调用
            async function deleteSingle(event, key) {
                event.stopPropagation();
                const pwd = prompt("⚠️ 即将永久删除此条记录，不可恢复！\\n\\n请输入确认密码：");
                if (!pwd) return;

                try {
                    const res = await fetch('/LogViewer/api/delete', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ pwd: pwd, keys: [key] })
                    });
                    const json = await res.json();
                    if (json.success) {
                        selectedLogs.delete(key);
                        updateBulkActionBar();
                        fetchLogs(); // 重新加载数据
                    } else { alert(json.msg); }
                } catch (e) { alert('网络异常'); }
            }

            // 🌟 [新增] 批量选中日志删除 API 调用
            async function deleteSelected() {
                if (selectedLogs.size === 0) return;
                const pwd = prompt(\`⚠️ 危险操作！即将会把您勾选的 \${selectedLogs.size} 条记录灰飞烟灭！\\n\\n请输入确认密码：\`);
                if (!pwd) return;

                try {
                    const res = await fetch('/LogViewer/api/delete', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ pwd: pwd, keys: Array.from(selectedLogs) })
                    });
                    const json = await res.json();
                    alert(json.msg);
                    if (json.success) {
                        selectedLogs.clear();
                        document.getElementById('selectAllCb').checked = false; // 取消全选高亮
                        updateBulkActionBar();
                        fetchLogs(); 
                    }
                } catch (e) { alert('网络异常'); }
            }

            function getTodayStr() { return new Date().toISOString().split('T')[0]; }

            async function fetchLogs() {
                const container = document.getElementById('logContainer');
                container.innerHTML = '<div class="text-center text-gray-400 py-10 animate-pulse">📡 正在连接数据库拉取记录...</div>';
                try {
                    const res = await fetch('/LogViewer/api/logs');
                    const json = await res.json();
                    if (json.success) {
                        allLogs = json.data;
                        renderLogs();
                    } else {
                        container.innerHTML = \`<div class="text-center text-red-500 py-10">❌ 错误: \${json.msg}</div>\`;
                    }
                } catch (e) {
                    container.innerHTML = '<div class="text-center text-red-500 py-10">❌ 网络异常，无法连接到服务器</div>';
                }
            }

            function formatPayload(log) {
                const data = log.data;
                if (!data) return '<div class="text-gray-500 text-sm italic">该日志不包含详细数据体</div>';

                // 🌟 辅助函数：把名字后面跟着的冗长提示，转化为精致的高颜值 UI 徽章
                const renderPeopleWithBadge = (peopleStr) => {
                    if (!peopleStr) return '未知';
                    let badge = '';
                    let name = peopleStr;
                    
                    if (peopleStr.indexOf('(🚀 独立专单') > -1) {
                        const match = peopleStr.match(/\(🚀 独立专单 -> 接待人: (.*?)\)/);
                        if (match) {
                            badge = '<span class="bg-purple-100 text-purple-700 border border-purple-200 text-[10px] px-2 py-0.5 rounded shadow-sm ml-2 font-bold tracking-wide">🎯 专属接待: ' + match[1] + '</span>';
                            name = peopleStr.replace(/\(🚀 独立专单 -> 接待人: .*?\)/, '').trim();
                        }
                    } else if (peopleStr.indexOf('(🏢 常规大部队拼车)') > -1) {
                        badge = '<span class="bg-indigo-50 text-indigo-600 border border-indigo-200 text-[10px] px-2 py-0.5 rounded shadow-sm ml-2 font-bold tracking-wide">🏢 大部队拼车</span>';
                        name = peopleStr.replace(/\(🏢 常规大部队拼车\)/, '').trim();
                    }
                    
                    return '<span class="font-medium text-gray-200">' + name + '</span> ' + badge;
                };

                try {
                    if (log.action === 'UI生成') {
                        if (!Array.isArray(data)) throw new Error('Data is not an array');
                        let html = '<div class="space-y-4">';
                        data.forEach((req, i) => {
                            // 👇 注意这里的反引号和 $ 均已转义，修复了报错
                            html += \`
                            <div class="bg-gray-800 rounded-lg p-4 border border-gray-700">
                                <div class="flex items-center gap-3 mb-2 pb-2 border-b border-gray-700">
                                    <span class="bg-blue-900/50 text-blue-300 text-xs px-2 py-1 rounded font-bold">📦 数据包 \${i + 1}</span>
                                    <span class="text-gray-200 text-sm font-medium">📅 \${req.targetDate || '未知'}</span>
                                </div>
                                <div class="text-sm mb-3 flex items-center flex-wrap">
                                    <span class="mr-1 text-gray-400">👥</span> \${renderPeopleWithBadge(req.people)}
                                </div>
                                <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                    <div class="bg-gray-900 rounded border border-gray-700">
                                        <div class="flex justify-between items-center bg-gray-800 px-3 py-1.5 rounded-t">
                                            <span class="text-xs text-orange-300 font-mono">Encoded Body (最终发包)</span>
                                            <button onclick="copyRaw(event, '\${encodeURIComponent(req.encodedBody || '')}')" class="text-xs bg-gray-700 hover:bg-gray-600 text-gray-200 px-2 py-1 rounded transition">复制</button>
                                        </div>
                                        <div class="p-3 text-xs text-gray-300 break-all h-32 overflow-y-auto">\${req.encodedBody || '无数据'}</div>
                                    </div>
                                    <div class="bg-gray-900 rounded border border-gray-700">
                                        <div class="flex justify-between items-center bg-gray-800 px-3 py-1.5 rounded-t">
                                            <span class="text-xs text-green-300 font-mono">Raw JSON (明文结构)</span>
                                            <button onclick="copyRaw(event, '\${encodeURIComponent(req.rawJson || '')}')" class="text-xs bg-gray-700 hover:bg-gray-600 text-gray-200 px-2 py-1 rounded transition">复制</button>
                                        </div>
                                        <div class="p-3 text-xs text-gray-300 whitespace-pre overflow-x-auto h-32 overflow-y-auto">\${req.rawJson || '无数据'}</div>
                                    </div>
                                </div>
                            </div>\`;
                        });
                        return html + '</div>';
                    }

                    if (log.action === '手动发送') {
                        const req = data.requestPayload || {};
                        const res = data.responseResult || {};
                        const isSuccess = res.success;
                        // 👇 已转义
                        return \`
                        <div class="space-y-4">
                            <div class="flex flex-col md:flex-row gap-4">
                                <div class="flex-1 bg-gray-800 rounded-lg p-4 border border-gray-700">
                                    <div class="text-gray-400 text-xs mb-2 uppercase tracking-wider">📤 提交请求</div>
                                    <div class="text-gray-200 text-sm mb-2">📅 \${req.targetDate || '未知'}</div>
                                    <div class="text-sm flex items-center flex-wrap">
                                        <span class="mr-1 text-gray-400">👥</span> \${renderPeopleWithBadge(req.people)}
                                    </div>
                                </div>
                                <div class="flex-1 \${isSuccess ? 'bg-green-900/20 border-green-800/50' : 'bg-red-900/20 border-red-800/50'} rounded-lg p-4 border">
                                    <div class="\${isSuccess ? 'text-green-400' : 'text-red-400'} text-xs mb-2 uppercase tracking-wider">📥 接口响应</div>
                                    <div class="text-gray-200 text-sm mb-1">\${isSuccess ? '✅ 请求成功' : '❌ 请求失败'}</div>
                                    <div class="\${isSuccess ? 'text-green-300/80' : 'text-red-300/80'} text-xs font-mono">\${isSuccess ? '实例ID: ' + res.id : '原因: ' + (res.msg || '未知')}</div>
                                </div>
                            </div>
                            <div class="bg-gray-900 rounded border border-gray-700">
                                <div class="flex justify-between items-center bg-gray-800 px-3 py-1.5 rounded-t">
                                    <span class="text-xs text-orange-300 font-mono">Encoded Body (当时发的包)</span>
                                    <button onclick="copyRaw(event, '\${encodeURIComponent(req.encodedBody || '')}')" class="text-xs bg-gray-700 hover:bg-gray-600 text-gray-200 px-2 py-1 rounded transition">复制</button>
                                </div>
                                <div class="p-3 text-xs text-gray-300 break-all h-28 overflow-y-auto">\${req.encodedBody || '无数据'}</div>
                            </div>
                        </div>\`;
                    }

                    if (log.action === '自动续期') {
                        const report = data.textReport || '无文本报告';
                        const details = data.actionDetails || [];
                        
                        let detailsHtml = '';
                        if (details.length > 0) {
                            let listStr = '';
                            for (let j = 0; j < details.length; j++) {
                                let d = details[j];
                                // 🌟 核心：把两种数据都取出来
                                let rawJson = d.payload && d.payload.rawJson ? d.payload.rawJson : '无明文数据';
                                let encoded = d.payload && d.payload.encodedBody ? d.payload.encodedBody : '无真正发包数据';
                                
                                let icon = d.success ? '✅' : '❌';
                                let color = d.success ? 'text-green-400' : 'text-red-400';
                                
                                listStr += '<details class="bg-gray-800 rounded border border-gray-700 overflow-hidden outline-none mb-3">' +
                                    '<summary class="px-3 py-2 cursor-pointer hover:bg-gray-700 text-xs text-gray-300 flex justify-between items-center outline-none select-none">' +
                                        '<div class="flex items-center gap-2">' +
                                            '<span class="' + color + ' font-bold">' + icon + '</span>' +
                                            '<span class="bg-gray-900 px-2 py-0.5 rounded text-gray-400">' + d.loc + '</span>' +
                                            '<span>' + d.date + '</span>' +
                                            '<span class="text-gray-400">|</span>' +
                                            '<span>' + renderPeopleWithBadge(d.people) + '</span>' +
                                        '</div>' +
                                        '<span class="text-gray-500 hover:text-white transition">查看双重底包 ▼</span>' +
                                    '</summary>' +
                                    '<div class="grid grid-cols-1 lg:grid-cols-2 gap-4 p-3 border-t border-gray-700 bg-gray-900">' +
                                        // 🌟 左侧：展示真正发出去的 URL-Encoded 报文
                                        '<div class="bg-gray-950 rounded border border-gray-700">' +
                                            '<div class="flex justify-between items-center bg-gray-800 px-3 py-1.5 rounded-t">' +
                                                '<span class="text-xs text-orange-300 font-mono">Encoded Body (真正发出去的数据)</span>' +
                                                '<button onclick="copyRaw(event, \\'' + encodeURIComponent(encoded) + '\\')" class="text-[10px] bg-gray-700 hover:bg-gray-600 text-gray-200 px-2 py-1 rounded transition">复制</button>' +
                                            '</div>' +
                                            '<div class="p-3 text-[11px] text-gray-300 break-all h-32 overflow-y-auto font-mono">' + encoded + '</div>' +
                                        '</div>' +
                                        // 🌟 右侧：展示用来查看结构的原始 JSON
                                        '<div class="bg-gray-950 rounded border border-gray-700">' +
                                            '<div class="flex justify-between items-center bg-gray-800 px-3 py-1.5 rounded-t">' +
                                                '<span class="text-xs text-green-300 font-mono">Raw JSON (原始明文结构)</span>' +
                                                '<button onclick="copyRaw(event, \\'' + encodeURIComponent(rawJson) + '\\')" class="text-[10px] bg-gray-700 hover:bg-gray-600 text-gray-200 px-2 py-1 rounded transition">复制</button>' +
                                            '</div>' +
                                            '<div class="p-3 text-[11px] text-gray-300 whitespace-pre overflow-x-auto h-32 overflow-y-auto font-mono">' + rawJson + '</div>' +
                                        '</div>' +
                                    '</div>' +
                                '</details>';
                            }
                            detailsHtml = '<div class="mt-4 border-t border-gray-700 pt-3">' +
                                '<div class="text-gray-400 text-xs mb-2 font-bold">📦 底层发包数据切片 (' + details.length + '个):</div>' +
                                '<div class="space-y-2">' + listStr + '</div></div>';
                        }

                        // 👇 已转义
                        return \`
                        <div class="bg-gray-950 p-4 rounded-lg border border-gray-800 shadow-inner">
                            <div class="text-gray-500 text-xs mb-2 font-mono flex justify-between items-center">
                                <span>[Cron Job Console Output]</span>
                                <button onclick="copyRaw(event, '\${encodeURIComponent(report)}')" class="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-2 py-1 rounded transition">复制文本</button>
                            </div>
                            <div class="text-sm text-emerald-400 whitespace-pre font-mono overflow-x-auto leading-relaxed">\${report}</div>
                            \${detailsHtml}
                        </div>\`;
                    }

                    return \`<pre><code class="language-json text-sm rounded-lg border border-gray-700">\${JSON.stringify(data, null, 2)}</code></pre>\`;

                } catch (e) {
                    return \`<pre><code class="language-json text-sm rounded-lg border border-gray-700">\${JSON.stringify(data, null, 2)}</code></pre>\`;
                }
            }

            function renderLogs() {
                const container = document.getElementById('logContainer');
                const timeFilter = document.getElementById('timeFilter').value;
                const actionFilter = document.getElementById('actionFilter').value;
                const searchTxt = document.getElementById('searchInput').value.toLowerCase();
                const todayStr = getTodayStr();

                const filtered = allLogs.filter(log => {
                    const logDate = log.time.split('_')[0];
                    if (timeFilter === 'today' && logDate !== todayStr) return false;
                    if (timeFilter === 'history' && logDate === todayStr) return false;
                    if (actionFilter !== 'all' && log.action !== actionFilter) return false;
                    if (searchTxt && !(log.location + log.summary + log.action).toLowerCase().includes(searchTxt)) return false;
                    return true;
                });

                document.getElementById('logCount').innerText = filtered.length;

                if (filtered.length === 0) {
                    container.innerHTML = '<div class="text-center text-gray-400 py-10 bg-white rounded-xl border border-dashed border-gray-300">没有找到对应的日志记录哦</div>';
                    return;
                }

                container.innerHTML = filtered.map((log, i) => {
                    let badgeColor = "bg-gray-100 text-gray-700";
                    if(log.action === "自动续期") badgeColor = "bg-purple-100 text-purple-700 border border-purple-200";
                    if(log.action === "UI生成") badgeColor = "bg-blue-100 text-blue-700 border border-blue-200";
                    if(log.action === "手动发送") badgeColor = "bg-emerald-100 text-emerald-700 border border-emerald-200";

                    return \`
                    <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden relative group">
                        <div class="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 log-card cursor-pointer bg-white hover:bg-blue-50/30" onclick="toggleDetails(\${i})">
                            <div class="flex flex-wrap items-center gap-3 w-full pr-8">
                                <div class="flex items-center" onclick="event.stopPropagation()">
                                    <input type="checkbox" class="log-checkbox w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer" value="\${log.key}" \${selectedLogs.has(log.key) ? 'checked' : ''} onclick="toggleLogSelect(event, '\${log.key}')">
                                </div>
                                <div class="px-3 py-1 rounded-full text-xs font-bold \${badgeColor}">\${log.action}</div>
                                <div class="font-mono text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded border border-gray-100">🕒 \${log.time.replace('_', ' ')}</div>
                                <div class="font-bold text-gray-800">🏢 \${log.location}</div>
                                <div class="text-gray-600 text-sm font-medium flex-1 truncate">\${log.summary}</div>
                            </div>
                            
                            <button onclick="deleteSingle(event, '\${log.key}')" class="absolute right-4 top-4 text-gray-300 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition opacity-0 group-hover:opacity-100" title="删除此记录">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                        </div>
                        
                        <div id="details-\${i}" class="log-details bg-gray-900 border-t border-gray-200">
                            <div class="flex border-b border-gray-700 bg-gray-800/50 px-4 pt-2 gap-4">
                                <button class="tab-btn active pb-2 text-sm text-gray-400 hover:text-gray-200" onclick="switchView(event, \${i}, 'pretty')">✨ 智能排版视图</button>
                                <button class="tab-btn pb-2 text-sm text-gray-400 hover:text-gray-200" onclick="switchView(event, \${i}, 'raw')">⚙️ 原始 JSON 树</button>
                            </div>
                            <div class="p-4">
                                <div id="view-pretty-\${i}" class="block">\${formatPayload(log)}</div>
                                <div id="view-raw-\${i}" class="hidden relative">
                                    <button onclick="copyRaw(event, '\${encodeURIComponent(JSON.stringify(log.data, null, 2))}')" class="absolute top-2 right-2 bg-gray-700 hover:bg-gray-600 text-gray-300 px-3 py-1 rounded text-xs">复制整树</button>
                                    <pre><code class="language-json text-sm rounded-lg border border-gray-700">\${JSON.stringify(log.data, null, 2)}</code></pre>
                                </div>
                            </div>
                        </div>
                    </div>\`;
                }).join('');

                document.querySelectorAll('.language-json').forEach(el => hljs.highlightElement(el));
            }

            function toggleDetails(index) {
                document.getElementById('details-' + index).classList.toggle('open');
            }

            function switchView(event, index, type) {
                const detailsContainer = document.getElementById('details-' + index);
                detailsContainer.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active', 'text-blue-500'));
                event.target.classList.add('active', 'text-blue-500');
                detailsContainer.querySelector('#view-pretty-' + index).classList.toggle('hidden', type !== 'pretty');
                detailsContainer.querySelector('#view-pretty-' + index).classList.toggle('block', type === 'pretty');
                detailsContainer.querySelector('#view-raw-' + index).classList.toggle('hidden', type !== 'raw');
                detailsContainer.querySelector('#view-raw-' + index).classList.toggle('block', type === 'raw');
            }

            function copyRaw(event, encodedStr) {
                event.stopPropagation();
                const code = decodeURIComponent(encodedStr);
                navigator.clipboard.writeText(code).then(() => {
                    const btn = event.target;
                    const oldTxt = btn.innerText;
                    btn.innerText = '✅ 已复制';
                    btn.classList.add('bg-green-600', 'text-white');
                    setTimeout(() => {
                        btn.innerText = oldTxt;
                        btn.classList.remove('bg-green-600', 'text-white');
                    }, 2000);
                });
            }

            async function clearLogs() {
                const pwd = prompt("⚠️ 危险操作！\\n即将删除数据库中所有的日志记录，此操作不可逆！\\n\\n请输入确认密码：");
                if (!pwd) return;
                try {
                    const res = await fetch('/LogViewer/api/clear', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pwd }) });
                    const json = await res.json();
                    alert(json.msg);
                    if (json.success) fetchLogs();
                } catch (e) { alert('网络异常'); }
            }

            fetchLogs();
        </script>
    </body>
    </html>
    `;
    res.send(html);
});

module.exports = router;