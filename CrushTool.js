const express = require('express');
const router = express.Router();
const axios = require('axios');

// 从环境变量获取 GitHub 相关信息
const GITHUB_TOKEN = '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';
const GITHUB_OWNER = 'SDK-China';
const GITHUB_REPO = 'yunzhongke';
const DATA_FILE_PATH = 'data.json';

// 初始化变量
let b = 1;
let tecache = 1;
const k = 'SSFAdTQ65NyoVS';

// 从 GitHub 获取 data.json 文件内容并更新本地变量
async function getFileFromGitHub() {
    try {
        const response = await axios.get(
            `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${DATA_FILE_PATH}`,
            {
                headers: {
                    Authorization: `Bearer ${GITHUB_TOKEN}`
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
            await saveDataToGitHub();
        } else {
            console.error('Error getting file from GitHub:', error);
        }
    }
}

// 将数据保存到 GitHub 的 data.json 文件
async function saveDataToGitHub() {
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
                        Authorization: `Bearer ${GITHUB_TOKEN}`
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
                    Authorization: `Bearer ${GITHUB_TOKEN}`
                }
            }
        );
    } catch (error) {
        console.error('Error saving data to GitHub:', error);
    }
}

// 启动时从 GitHub 获取数据
getFileFromGitHub();

// 处理 POST 请求，用于更新 b 和 tecache 的值
router.post('/', async (req, res) => {
    const { newB, newTecache } = req.body;

    // 检查请求体中是否包含 newB 和 newTecache
    if (newB!== undefined && newTecache!== undefined) {
        // 更新 b 和 tecache 的值
        b = newB;
        tecache = newTecache;
        // 保存数据到 GitHub
        await saveDataToGitHub();
        res.json({ message: 'b and tecache values have been updated successfully.' });
    } else {
        res.status(400).json({ message: 'Both newB and newTecache are required in the request body.' });
    }
});

// 处理 GET 请求，用于返回 b、tecache 和 k 的值
router.get('/', async (req, res) => {
    // 从 GitHub 获取最新数据
    await getFileFromGitHub();
    res.json({ b, tecache, k });
});

module.exports = router;