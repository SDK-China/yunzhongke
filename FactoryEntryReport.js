const express = require('express');
const router = express.Router();

// 测试路由：供 Vercel Cron 调用
router.get('/test-cron', async (req, res) => {
    // 获取北京时间
    const beijingTime = new Date().toLocaleString('zh-CN', { 
        timeZone: 'Asia/Shanghai',
        hour12: false 
    });
    
    // 打印日志（在 Vercel 控制台查看）
    console.log(`[Cron Test] 定时任务成功触发！北京时间：${beijingTime}`);
    
    // 返回成功响应
    res.json({
        success: true,
        message: 'Vercel Cron 测试成功',
        executedAt: beijingTime
    });
});

// 手动测试接口（本地调试用）
router.get('/test-cron-manual', async (req, res) => {
    const beijingTime = new Date().toLocaleString('zh-CN', {
        timeZone: 'Asia/Shanghai',
        hour12: false
    });
    console.log('[Manual Test] 手动触发测试', beijingTime);

    // 只回一次 json
    res.json({
        message: '请访问 /api/test-cron 来模拟 Cron 触发',
        beijingTime          // 键名 beijingTime，值变量 beijingTimee
    });
});

module.exports = router;