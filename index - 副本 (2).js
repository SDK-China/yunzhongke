const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const axios = require('axios');
const FormData = require('form-data');
const newFeatureRouter = require('./CrushTool'); // 引入新功能路由
const app = express();
const port = 3000;

app.use(cors());
app.use(bodyParser.json());

const mm_values = [
    "mm_6251734910_3088250085_115721950295",
    "mm_6251734910_3088250085_115724250112",
    "mm_6251734910_3088250085_115718550467",
    "mm_6251734910_3088250085_115724250112",
    "mm_6251734910_3088250085_115720650395",
    "mm_6251734910_3088250085_115719100432",
    "mm_6251734910_3088250085_115723300209",
    "mm_6251734910_3088250085_115719900422",
    "mm_6251734910_3088250085_115718300483",
    "mm_6251734910_3088250085_115719150443",
    "mm_6251734910_3088250085_115722650244"
];

app.post('/convert', async (req, res) => {
    const { temp_url, apitoken } = req.body;

    if (!temp_url || !apitoken) {
        return res.status(400).json({ message: 'temp_url and apitoken are required' });
    }

    const random_mm_value = mm_values[Math.floor(Math.random() * mm_values.length)];

    const formData = new FormData();
    formData.append('type', '2');
    formData.append('apitoken', 'ku_apitoken_39340_aef39472ad583b2fb9b8a37a53a3d592');
    formData.append('tpwd', temp_url);
    formData.append('no_coupon', '0');
    formData.append('coupon_force', 'Y');
    formData.append('tkl_tag_l', 'suiji');
    formData.append('tkl_tag_r', 'suiji');
    formData.append('use_custom_link', '0');
    formData.append('pid', random_mm_value);
    formData.append('rid', '');

    const headers = {
        ...formData.getHeaders(),
        "Host": "cms.iyunzk.com",
        "Sec-Ch-Ua": "\"Not A(Brand\";v=\"99\", \"Android WebView\";v=\"121\", \"Chromium\";v=\"121\"",
        "Sec-Ch-Ua-Platform": "\"Android\"",
        "Sec-Ch-Ua-Mobile": "?1",
        "User-Agent": "Mozilla/5.0 (Linux; Android 14; 23127PN0CC Build/UKQ1.230804.001) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.6167.165 Mobile Safari/537.36",
        "Origin": "https://ku.iyunzk.com",
        "X-Requested-With": "com.mmbox.xbrowser",
        "Sec-Fetch-Site": "same-site",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Dest": "empty",
        "Referer": "https://ku.iyunzk.com/",
        "Accept-Encoding": "gzip, deflate, br, zstd",
        "Accept-Language": "zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7"
    };

    try {
        const response = await axios.post('https://cms.iyunzk.com/ku_api/tool/tklAnalysis', formData, { headers, timeout: 10000 });

        if (response.status === 200 && response.data && response.data.data) {
            const tk_short_url = response.data.data.tk_short_url;
            res.json({ tk_short_url });
        } else {
            res.status(500).json({ message: 'Error: Invalid response from server' });
        }
    } catch (error) {
        console.error('请求错误:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// 使用新功能路由
app.use('/CrushTool', newFeatureRouter);


app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});

