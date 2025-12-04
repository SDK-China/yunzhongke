const express = require('express');
const axios = require('axios');
const router = express.Router();


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