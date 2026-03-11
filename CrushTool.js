const express = require('express');
const router = express.Router();
const bodyParser = require('body-parser');
const { Redis } = require('@upstash/redis');

// 🍓 1. 引入 dotenv，让它读取 Vercel 拉取下来的本地环境变量文件
// 如果你拉取的文件名是 .env.local，请将下面改成 '.env.local'
require('dotenv').config({ path: '.env.development.local' }); 

router.use(bodyParser.json());

// 🍓 2. 魔法初始化：手动指定 Vercel 提供的环境变量名，确保万无一失！
const redis = new Redis({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_KV_REST_API_TOKEN,
});

// 常量
const k = 'SSFAdTQ65NyoVS';

// ==========================================
// 🚀 处理 POST 请求：用于更新 b 和 tecache 的值
// ==========================================
router.post('/', async (req, res) => {
    const { newB, newTecache, token } = req.body;

    if (newB !== undefined && newTecache !== undefined && token) {
        try {
            // 👠 写入数据
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
    const token = req.query.token; 
    if (!token) {
        return res.status(400).json({ message: 'Token is required in the query string.' });
    }
    
    try {
        // 👠 读取数据
        let b = await redis.get('app_b_value');
        if (b === null) b = 1; 

        let tecache = await redis.get('app_tecache_value');
        if (tecache === null) tecache = 1;

        res.json({ b, tecache, k });
    } catch (error) {
        console.error('Redis 读取失败:', error);
        res.json({ b: 1, tecache: 1, k }); 
    }
});

module.exports = router;