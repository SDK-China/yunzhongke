const express = require('express');
const router = express.Router();
const axios = require('axios');
const bodyParser = require('body-parser');

// 使用 body-parser 中间件解析 JSON 请求体
router.use(bodyParser.json());

const GITHUB_OWNER = 'SDK-China';
const GITHUB_REPO = 'yunzhongke';
const DATA_FILE_PATH = 'data.json';

// 初始化变量
let b = 1;
let tecache = 1;
const k = 'SSFAdTQ65NyoVS';

// 从 GitHub 获取 data.json 文件内容并更新本地变量
async function getFileFromGitHub(token) {
    try {
        const response = await axios.get(
            `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${DATA_FILE_PATH}`,
            {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        );
        const content = Buffer.from(response.data.content, 'base64').toString('utf8');
        const { b: storedB, tecache: storedTecache } = JSON.parse(content);
        b = storedB;
        tecache = storedTecache;
    } catch (error) {
        if (error.response && error.response.status === 404) {
            // 如果文件不存在，使用默认值并保存到 GitHub
            await saveDataToGitHub(token);
        } else {
            console.error('Error getting file from GitHub:', error);
        }
    }
}

// 将数据保存到 GitHub 的 data.json 文件
async function saveDataToGitHub(token) {
    try {
        const content = JSON.stringify({ b, tecache });
        const base64Content = Buffer.from(content).toString('base64');

        // 先获取文件的当前 SHA 值（如果文件存在）
        let sha = null;
        try {
            const shaResponse = await axios.get(
                `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${DATA_FILE_PATH}`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                }
            );
            sha = shaResponse.data.sha;
        } catch (shaError) {
            if (shaError.response && shaError.response.status!== 404) {
                console.error('Error getting SHA from GitHub:', shaError);
                return;
            }
        }

        const data = {
            message: 'Update b and tecache values',
            content: base64Content
        };
        if (sha) {
            data.sha = sha;
        }

        await axios.put(
            `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${DATA_FILE_PATH}`,
            data,
            {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        );
    } catch (error) {
        console.error('Error saving data to GitHub:', error);
    }
}

// 处理 POST 请求，用于更新 b 和 tecache 的值
router.post('/', async (req, res) => {
    const { newB, newTecache, token } = req.body;

    // 检查请求体中是否包含 newB、newTecache 和 token
    if (newB!== undefined && newTecache!== undefined && token) {
        // 更新 b 和 tecache 的值
        b = newB;
        tecache = newTecache;
        // 保存数据到 GitHub
        await saveDataToGitHub(token);
        res.json({ message: 'b and tecache values have been updated successfully.' });
    } else {
        res.status(400).json({ message: 'Both newB, newTecache and token are required in the request body.' });
    }
});

// 处理 GET 请求，用于返回 b、tecache 和 k 的值
router.get('/', async (req, res) => {
    const token = req.query.token;
    if (!token) {
        return res.status(400).json({ message: 'Token is required in the query string.' });
    }
    // 从 GitHub 获取最新数据
    await getFileFromGitHub(token);
    res.json({ b, tecache, k });
});

module.exports = router;