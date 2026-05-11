const express = require('express');
const router = express.Router();
const { Redis } = require('@upstash/redis');
require('dotenv').config({ path: '.env.development.local' });

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_KV_REST_API_URL,
    token: process.env.UPSTASH_REDIS_KV_REST_API_TOKEN,
});

// ==========================================
// 1. 提供后端 API：获取所有日志
// ==========================================
router.get('/api/logs', async (req, res) => {
    try {
        // 获取所有以 FactoryLog: 开头的键
        const keys = await redis.keys('FactoryLog:*');
        
        if (keys.length === 0) {
            return res.json({ success: true, data: [] });
        }

        // 批量获取对应的值
        const rawValues = await redis.mget(...keys);
        
        // 解析并组合数据
        const logs = keys.map((key, index) => {
            let parsedData = {};
            try {
                parsedData = typeof rawValues[index] === 'string' ? JSON.parse(rawValues[index]) : rawValues[index];
            } catch (e) {
                parsedData = { error: '解析失败', raw: rawValues[index] };
            }
            return {
                key: key,
                ...parsedData
            };
        });

        // 按时间倒序排列（最新的在最上面）
        logs.sort((a, b) => new Date(b.time.replace(/_/g, ' ').replace(/-/g, '/')) - new Date(a.time.replace(/_/g, ' ').replace(/-/g, '/')));

        res.json({ success: true, data: logs });
    } catch (error) {
        console.error('获取日志失败:', error);
        res.status(500).json({ success: false, msg: '数据库读取失败' });
    }
});

// ==========================================
// 2. 提供后端 API：清空日志 (硬核防误触)
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
        <!-- 引入 Tailwind CSS 提供现代界面 -->
        <script src="https://cdn.tailwindcss.com"></script>
        <!-- 引入 Highlight.js 提供炫酷的 JSON 高亮 -->
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.8.0/styles/atom-one-dark.min.css">
        <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.8.0/highlight.min.js"></script>
        <style>
            body { background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
            .log-card { transition: all 0.2s ease; cursor: pointer; }
            .log-card:hover { transform: translateY(-2px); box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); border-color: #3b82f6; }
            .log-details { display: none; }
            .log-details.open { display: block; animation: slideDown 0.3s ease-out; }
            @keyframes slideDown { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
            pre { margin: 0; border-radius: 0.5rem; overflow-x: auto; }
            ::-webkit-scrollbar { width: 8px; height: 8px; }
            ::-webkit-scrollbar-track { background: #f1f1f1; border-radius: 4px; }
            ::-webkit-scrollbar-thumb { background: #c1c1c1; border-radius: 4px; }
            ::-webkit-scrollbar-thumb:hover { background: #a8a8a8; }
        </style>
    </head>
    <body class="p-4 md:p-8">
        <div class="max-w-7xl mx-auto">
            <!-- 头部 -->
            <div class="flex flex-col md:flex-row justify-between items-center mb-8 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <div>
                    <h1 class="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <span>📊</span> 系统运行日志中枢
                    </h1>
                    <p class="text-sm text-gray-500 mt-1">实时追踪 UI生成、自动续期及手动发送的数据包情况</p>
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

            <!-- 控制栏 / 过滤器 -->
            <div class="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-6 flex flex-wrap gap-4 items-center">
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
                    <input type="text" id="searchInput" onkeyup="renderLogs()" placeholder="输入厂区或关键字..." class="border border-gray-300 rounded-md px-3 py-1.5 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 w-48">
                </div>
                <div class="ml-auto text-sm text-gray-500 font-medium">
                    共找到 <span id="logCount" class="text-blue-600 font-bold text-lg">0</span> 条记录
                </div>
            </div>

            <!-- 日志列表展示区 -->
            <div id="logContainer" class="flex flex-col gap-4">
                <div class="text-center text-gray-400 py-10">加载中...</div>
            </div>
        </div>

        <script>
            let allLogs = [];

            // 获取当天的格式化字符串，用于区分今天和历史
            function getTodayStr() {
                return new Date().toISOString().split('T')[0];
            }

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

            function renderLogs() {
                const container = document.getElementById('logContainer');
                const timeFilter = document.getElementById('timeFilter').value;
                const actionFilter = document.getElementById('actionFilter').value;
                const searchTxt = document.getElementById('searchInput').value.toLowerCase();
                const todayStr = getTodayStr();

                // 核心过滤逻辑
                const filtered = allLogs.filter(log => {
                    // 1. 时间过滤 (严格执行历史区间逻辑)
                    const logDate = log.time.split('_')[0];
                    if (timeFilter === 'today' && logDate !== todayStr) return false;
                    if (timeFilter === 'history' && logDate === todayStr) return false;

                    // 2. 类型过滤
                    if (actionFilter !== 'all' && log.action !== actionFilter) return false;

                    // 3. 关键字过滤
                    if (searchTxt) {
                        const searchContent = (log.location + log.summary + log.action).toLowerCase();
                        if (!searchContent.includes(searchTxt)) return false;
                    }
                    return true;
                });

                document.getElementById('logCount').innerText = filtered.length;

                if (filtered.length === 0) {
                    container.innerHTML = '<div class="text-center text-gray-400 py-10 bg-white rounded-xl border border-dashed border-gray-300">没有匹配的日志记录</div>';
                    return;
                }

                container.innerHTML = filtered.map((log, i) => {
                    // 根据不同 action 设置徽章颜色
                    let badgeColor = "bg-gray-100 text-gray-700";
                    if(log.action === "自动续期") badgeColor = "bg-purple-100 text-purple-700 border border-purple-200";
                    if(log.action === "UI生成") badgeColor = "bg-blue-100 text-blue-700 border border-blue-200";
                    if(log.action === "手动发送") badgeColor = "bg-emerald-100 text-emerald-700 border border-emerald-200";

                    return \`
                    <div class="bg-white rounded-xl shadow-sm border border-gray-200 log-card overflow-hidden" onclick="toggleDetails(\${i})">
                        <div class="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div class="flex items-center gap-4">
                                <div class="px-3 py-1 rounded-full text-xs font-bold \${badgeColor}">
                                    \${log.action}
                                </div>
                                <div class="font-mono text-sm text-gray-500 bg-gray-50 px-2 py-1 rounded border border-gray-100">
                                    🕒 \${log.time.replace('_', ' ')}
                                </div>
                                <div class="font-bold text-gray-800 text-lg">
                                    🏢 \${log.location}
                                </div>
                            </div>
                            <div class="text-gray-600 text-sm font-medium">
                                \${log.summary}
                            </div>
                        </div>
                        
                        <div id="details-\${i}" class="log-details bg-gray-900 border-t border-gray-200">
                            <div class="p-4">
                                <div class="flex justify-between items-center mb-2">
                                    <span class="text-gray-400 text-xs font-mono">Payload Data (JSON)</span>
                                    <button onclick="copyJson(event, \${i})" class="text-gray-300 hover:text-white bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded text-xs transition">
                                        📄 复制代码
                                    </button>
                                </div>
                                <pre><code id="json-\${i}" class="language-json text-sm">\${JSON.stringify(log.data, null, 2)}</code></pre>
                            </div>
                        </div>
                    </div>
                    \`;
                }).join('');

                // 触发代码高亮渲染
                document.querySelectorAll('pre code').forEach((el) => {
                    hljs.highlightElement(el);
                });
            }

            function toggleDetails(index) {
                const el = document.getElementById('details-' + index);
                el.classList.toggle('open');
            }

            function copyJson(event, index) {
                event.stopPropagation(); // 阻止点击事件冒泡收起卡片
                const code = document.getElementById('json-' + index).innerText;
                navigator.clipboard.writeText(code).then(() => {
                    const btn = event.target;
                    const oldTxt = btn.innerText;
                    btn.innerText = '✅ 已复制';
                    btn.classList.add('bg-green-600');
                    setTimeout(() => {
                        btn.innerText = oldTxt;
                        btn.classList.remove('bg-green-600');
                    }, 2000);
                });
            }

            async function clearLogs() {
                const pwd = prompt("⚠️ 危险操作！\\n即将删除数据库中所有的日志记录，此操作不可逆！\\n\\n请输入确认密码：");
                if (!pwd) return;

                try {
                    const res = await fetch('/LogViewer/api/clear', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ pwd })
                    });
                    const json = await res.json();
                    alert(json.msg);
                    if (json.success) fetchLogs();
                } catch (e) {
                    alert('网络异常');
                }
            }

            // 初始化加载
            fetchLogs();
        </script>
    </body>
    </html>
    `;
    res.send(html);
});

module.exports = router;