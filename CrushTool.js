const express = require('express');
const router = express.Router();
const bodyParser = require('body-parser');
const { Redis } = require('@upstash/redis');

require('dotenv').config({ path: '.env.development.local' }); 

router.use(bodyParser.json());

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_KV_REST_API_URL,
  token: process.env.UPSTASH_REDIS_KV_REST_API_TOKEN,
});

const k = 'SSFAdTQ65NyoVS';

// ==========================================
// 🚀 处理 POST 请求：合并存储为一条键值对
// ==========================================
router.post('/', async (req, res) => {
    const { newB, newTecache, token } = req.body;

    // 前端传参格式不变
    if (newB !== undefined && newTecache !== undefined && token) {
        try {
            // 👠 写入数据：将两个值打包成一个 JSON 对象，只存入一个叫 'app_config_data' 的键中
            await redis.set('app_config_data', { 
                b: newB, 
                tecache: newTecache 
            });
            
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
// 🚀 处理 GET 请求：读取一条键值并解包，返回原格式
// ==========================================
router.get('/', async (req, res) => {
    const token = req.query.token; 
    if (!token) {
        return res.status(400).json({ message: 'Token is required in the query string.' });
    }
    
    try {
        // 👠 读取数据：只读一次 'app_config_data'
        let config = await redis.get('app_config_data');
        
        // 解析数据并设置保底默认值（如果数据库是空的或者字段不存在，就给默认值 1）
        let b = config && config.b !== undefined ? config.b : 1;
        let tecache = config && config.tecache !== undefined ? config.tecache : 1;

        // 返回给前端的数据结构与之前完全一模一样，前端零感知！
        res.json({ b, tecache, k });
    } catch (error) {
        console.error('Redis 读取失败:', error);
        res.json({ b: 1, tecache: 1, k }); 
    }
});

module.exports = router;