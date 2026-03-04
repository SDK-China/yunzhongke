const express = require('express');
const router = express.Router();
const axios = require('axios');

// 准确计算北京时间的明天日期
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
    }).replace(/\//g, '-');
}

// 施工进度接口（支持多厂区动态路由）
// 访问链接示例： 
// A08厂: /construction-schedule/a08
// A01厂: /construction-schedule/a01
router.get('/construction-schedule/:factory', (req, res) => {
    try {
        // 获取 URL 中的厂区参数并转换为小写，防止大小写导致匹配失败
        const factory = req.params.factory.toLowerCase(); 
        const tomorrowDate = getBeijingTomorrowDate();
        const currentBeijingTime = getFormattedBeijingTime();
        
        let textResponse = '';

        // 根据不同厂区生成不同模板
        if (factory === 'a08') {
            textResponse = `A08厂
施工日期：${tomorrowDate}
①施工单位:友景
②工程名称:2F测试四线治具调试跟线
③施工人数：10人
④动火作业 ：不动
⑤预计完成进度:持续
⑥预计完成时间：持续
当前时间：${currentBeijingTime}
【本消息由Melody自动发送】`;

        } else if (factory === 'a01') {
            textResponse = `A01厂：施工日：${tomorrowDate}
①施工单位：友景
②施工项目：3F电测设备异常处理跟进工作  
③施工人数：6人
④动火作业 ：否
⑤预计完成进度:持续
⑥预计完成时间：持续
当前时间：${currentBeijingTime}
【本消息由Melody自动发送】`;

        } else {
            // 如果访问了不存在的厂区后缀
            return res.status(404).send('未找到该厂区的报备信息配置，请检查链接后缀是否为 a08 或 a01。');
        }

        // 设置响应头并发送纯文本
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.send(textResponse);

    } catch (error) {
        console.error('微信自动请求功能错误:', error);
        res.status(500).send('Internal Server Error');
    }
});

// 为了兼容老版本，如果依然有人访问不带后缀的旧链接，可以直接重定向到 A08 或给个提示
router.get('/construction-schedule', (req, res) => {
    res.redirect('construction-schedule/a08');
});

module.exports = router;