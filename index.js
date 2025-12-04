const express = require('express'); // 关键修正：必须引入 express
const cors = require('cors');
const bodyParser = require('body-parser');

// --- 引入各功能模块 ---
const crushToolRouter = require('./CrushTool');             // 原有新功能
const weChatAutoReqRouter = require('./WeChatAutoReq');     // 微信自动请求
const factoryEntryReportRouter = require('./FactoryEntryReport'); // 入厂报备(访客状态)
const visitorApprovalQueryRouter = require('./visitorApprovalQuery'); // 引入查询功能路由
const yunZhongKeRouter = require('./YunZhongKe');           // 云中客转链 (从index拆分)

const app = express();
const port = process.env.PORT || 3000;

// --- 全局中间件 ---
app.use(cors());
app.use(bodyParser.json());

// --- 路由注册 ---

// 1. 云中客功能 (挂载在根路径，保持原有 /convert 接口地址不变)
// 访问地址: /convert
app.use('/', yunZhongKeRouter);

// 2. CrushTool 功能
// 访问地址: /CrushTool/...
app.use('/CrushTool', crushToolRouter);

// 3. 微信自动请求功能
// 访问地址: /WeChatAutoReq/...
app.use('/WeChatAutoReq', weChatAutoReqRouter);

// 4. 入厂报备功能 (包含 visitor-status 和 test-cron)
// 访问地址: /FactoryEntryReport/...
app.use('/FactoryEntryReport', factoryEntryReportRouter);

// 引入访客查询功能路由
app.use('/visitorApprovalQuery', visitorApprovalQueryRouter);

// --- 根路由测试 (可选) ---
app.get('/', (req, res) => {
    res.send('YunZhongKe Server is running.');
});

// --- 启动服务器 ---
// 适配 Vercel Serverless 环境
if (process.env.NODE_ENV !== 'production') {
    app.listen(port, () => {
        console.log(`Server is running locally at http://localhost:${port}`);
    });
}

module.exports = app;