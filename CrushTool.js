const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

// 定义存储数据的文件路径
const dataFilePath = path.join(__dirname, 'data.json');

// 初始化变量
let b;
let tecache;
const k = 'SSFAdTQ65NyoVS';

// 读取文件中的数据
function readDataFromFile() {
    try {
        const data = fs.readFileSync(dataFilePath, 'utf8');
        const { b: storedB, tecache: storedTecache } = JSON.parse(data);
        b = storedB;
        tecache = storedTecache;
    } catch (error) {
        // 如果文件不存在或读取失败，使用默认值
        b = 1;
        tecache = 1;
        saveDataToFile();
    }
}
// 将数据保存到文件
function saveDataToFile() {
    const data = JSON.stringify({ b, tecache });
    fs.writeFileSync(dataFilePath, data, 'utf8');
}

// 启动时读取数据
readDataFromFile();

// 处理 POST 请求，用于更新 b 和 tecache 的值
router.post('/', (req, res) => {
    const { newB, newTecache } = req.body;

    // 检查请求体中是否包含 newB 和 newTecache
    if (newB!== undefined && newTecache!== undefined) {
        // 更新 b 和 tecache 的值
        b = newB;
        tecache = newTecache;
        // 保存数据到文件
        saveDataToFile();
        res.json({ message: 'b and tecache values have been updated successfully.' });
    } else {
        res.status(400).json({ message: 'Both newB and newTecache are required in the request body.' });
    }
});

// 处理 GET 请求，用于返回 b、tecache 和 k 的值
router.get('/', (req, res) => {
    // 读取文件中的最新数据
    readDataFromFile();
    res.json({ b, tecache, k });
});

module.exports = router;