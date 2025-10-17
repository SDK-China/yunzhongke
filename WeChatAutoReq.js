const express = require('express');
const router = express.Router();
const axios = require('axios');

// 修复：准确计算北京时间的明天日期
function getBeijingTomorrowDate() {
    const now = new Date();
    const beijingOptions = { 
        timeZone: 'Asia/Shanghai',
        year: 'numeric',
        month: 'numeric',
        day: 'numeric'
    };
    const beijingDateStr = now.toLocaleDateString('zh-CN', beijingOptions);
    const [year, month, day] = beijingDateStr.split('/').map(Number);
    const beijingToday = new Date(year, month - 1, day);
    const beijingTomorrow = new Date(beijingToday);
    beijingTomorrow.setDate(beijingToday.getDate() + 1);
    return `${beijingTomorrow.getMonth() + 1}/${beijingTomorrow.getDate()}`;
}

// 获取当前北京时间并格式化为XXXX-XX-XX XX:XX:XX
function getFormattedBeijingTime() {
    return new Date().toLocaleString('zh-CN', { 
        timeZone: 'Asia/Shanghai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    }).replace(/\//g, '-'); // 将斜杠替换为连字符
}

// 施工进度接口（添加当前时间）
router.get('/construction-schedule', (req, res) => {
    try {
        const tomorrowDate = getBeijingTomorrowDate();
        const currentBeijingTime = getFormattedBeijingTime();
        
        // 构造包含当前时间的纯文本内容
        const textResponse = `A08厂
施工日期：${tomorrowDate}
①施工单位:友景
②工程名称:2F测试四线治具调试跟线
③施工人数：10人
④动火作业 ：不动
⑤预计完成进度:持续
⑥预计完成时间：持续
当前时间：${currentBeijingTime}
【本消息由Melody自动发送】`;
        res.setHeader('Content-Type', 'text/plain');
        res.send(textResponse);
    } catch (error) {
        console.error('微信自动请求功能错误:', error);
        res.status(500).send('Internal Server Error');
    }
});

module.exports = router;
