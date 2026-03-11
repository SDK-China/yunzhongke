const express = require('express');
const router = express.Router();
const bodyParser = require('body-parser');

// 🍓 引入刚才安装的 Upstash Redis 钥匙！
const { Redis } = require('@upstash/redis');

// 使用 body-parser 中间件解析 JSON 请求体
router.use(bodyParser.json());

// 🍓 魔法初始化！它会自动去读 Vercel 帮你配置好的环境变量，完全不用你操心密码！
const redis = Redis.fromEnv();

// 常量（这个不需要存数据库，直接写死就行）
const k = 'SSFAdTQ65NyoVS';

// ==========================================
// 🚀 处理 POST 请求：用于更新 b 和 tecache 的值
// ==========================================
router.post('/', async (req, res) => {
    const { newB, newTecache, token } = req.body;

    // 检查请求体参数 (这里就不校验 token 了，因为你换 Redis 也不需要 GitHub Token 了，但我先留着防止你前端报错)
    if (newB !== undefined && newTecache !== undefined && token) {
        try {
            // 👠 写入数据：就是这么简单粗暴！瞬间落盘永久保存！
            await redis.set('app_b_value', newB);
            await redis.set('app_tecache_value', newTecache);
            
            res.json({ message: 'b and tecache values have been updated successfully in Redis.' });
        } catch (error) {
            console.error('Redis 写入失败:', error);
            res.status(500).json({ message: 'Failed to save data to Redis.' });
        }
    } else {
        res.status(400).json({ message: 'Both newB, newTecache and token are required in the request body.' });
    }
});

// ==========================================
// 🚀 处理 GET 请求：用于返回 b、tecache 和 k 的值
// ==========================================
router.get('/', async (req, res) => {
    const token = req.query.token; // 虽然没用了，但为了兼容你前端的逻辑先留着
    if (!token) {
        return res.status(400).json({ message: 'Token is required in the query string.' });
    }
    
    try {
        // 👠 读取数据：0.01秒的极致体验！
        // 注意：如果 Redis 里还没存过，redis.get 会返回 null，所以我们要给个默认值 1
        let b = await redis.get('app_b_value');
        if (b === null) b = 1; 

        let tecache = await redis.get('app_tecache_value');
        if (tecache === null) tecache = 1;

        res.json({ b, tecache, k });
    } catch (error) {
        console.error('Redis 读取失败:', error);
        // 如果读取报错了（比如网络问题），给个默认值保底，防止前端崩溃
        res.json({ b: 1, tecache: 1, k }); 
    }
});

module.exports = router;