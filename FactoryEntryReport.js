/**
 * FactoryEntryReport.js
 * 自动续期入厂申请脚本 (多厂区支持 + 完美克隆解析 + 严格顺位保持 + SPA极速界面 + 独立账号身份校验)
 * =========================================================================
 * 🛠️ 【更新说明】
 * - 🌟 新增“影分身”双轨独立检测：配置了专属接待人并开启 keepNormal 的人，系统会分别独立计算两者的到期时间！
 * - 🌟 新增“智能拼车”：如果多人指定了同一个专属接待人，系统会自动把他们合并到同一个包里发出！
 * - 🌟 新增“独立规则”：专属分身可以配置自己独有的 renewThreshold(阈值) 和 renewDays(天数)！
 * - 升级严谨熔断机制：只要有一人报错 或 >50%无记录，直接触发终极锁死，彻底杜绝异常环境疯狂发包。
 * - 绝对未修改或删除任何人物数据及注释。
 * =========================================================================
 */

const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const router = express.Router();

// --- 工具函数：Base64 解码 ---
const decode = (str) => Buffer.from(str, 'base64').toString('utf-8');

// --- 基础请求头 (移除了强绑定的 Cookie，改为动态传入) ---
const GLOBAL_HEADERS = {
    "Host": "iw68lh.aliwork.com",
    "content-type": "application/x-www-form-urlencoded",
    "sec-ch-ua-platform": "\"Android\"",
    "sec-ch-ua": "\"Chromium\";v=\"142\", \"Android WebView\";v=\"142\", \"Not_A Brand\";v=\"99\"",
    "sec-ch-ua-mobile": "?1",
    "x-requested-with": "XMLHttpRequest",
    "user-agent": "Mozilla/5.0 (Linux; Android 16; PJZ110 Build/BP2A.250605.015) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.7444.102 Mobile Safari/537.36",
    "accept": "application/json, text/json",
    "bx-v": "2.5.11",
    "origin": "https://iw68lh.aliwork.com",
    "sec-fetch-site": "same-origin",
    "sec-fetch-mode": "cors",
    "sec-fetch-dest": "empty",
    "referer": "https://iw68lh.aliwork.com/o/fk_ybfk?account=17614625112&company=%E5%AE%8F%E5%90%AF%E8%83%9C%E7%B2%BE%E5%AF%86%E7%94%B5%E5%AD%90(%E7%A7%A6%E7%9A%87%E5%B2%9B)%E6%9C%89%E9%99%90%E5%85%AC%E5%8F%B8&part=%E7%A7%A6%E7%9A%87%E5%B2%9B%E5%9B%AD%E5%8C%BA&applyType=%E4%B8%80%E8%88%AC%E8%AE%BF%E5%AE%A2",
    "accept-encoding": "gzip, deflate, br, zstd",
    "accept-language": "zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7"
};

// ==========================================
// A08 数据区 (维持原状，绝不改动旧有逻辑)
// ==========================================
const PERSON_DB = {
    // 康
    "MTMwMzIzMTk4NjAyMjgwODFY": [
        {"componentName":"SelectField","fieldId":"selectField_lxv44orx","label":"有效身份证件","fieldData":{"value":"身份证","text":"身份证"},"options":[{"defaultChecked":false,"syncLabelValue":true,"__sid":"item_lxjzgsg1","text":"身份证","__sid__":"serial_lxjzgsg0","value":"身份证","sid":"serial_lxjzgsg0"}]},
        {"componentName":"TextField","fieldId":"textField_lxv44ory","label":"证件号码","fieldData":{"value": decode("MTMwMzIzMTk4NjAyMjgwODFY")}},
        {"componentName":"TextField","fieldId":"textField_lxv44orw","label":"姓名","fieldData":{"value": decode("5bq35Lyf5by6")}},
        {"componentName":"SelectField","fieldId":"selectField_mbyjhot6","label":"区号","fieldData":{"value":"86","text":"+86"},"options":[{"defaultChecked":true,"syncLabelValue":false,"__sid":"item_megqe4lm","text":"+86","__sid__":"serial_megqe4ll","value":"86","sid":"serial_mbyjf8gm"}]},
        {"componentName":"TextField","fieldId":"textField_lxv44orz","label":"联系方式","fieldData":{"value": decode("MTMzMzMzNDgyMjg=")}},
        {"componentName":"ImageField","fieldId":"imageField_ly9i5k5q","label":"免冠照片","fieldData":{"value":[{"name":"mmexport1759201651500.jpg","previewUrl":"https://dingtalk.avaryholding.com:8443/dingplus/image/20250930/c2eb2f026b5f61b8d64af5a762a6baea.jpg","downloadUrl":"https://dingtalk.avaryholding.com:8443/dingplus/image/20250930/c2eb2f026b5f61b8d64af5a762a6baea.jpg","size":231994,"url":"https://dingtalk.avaryholding.com:8443/dingplus/image/20250930/c2eb2f026b5f61b8d64af5a762a6baea.jpg"}]}},
        {"componentName":"AttachmentField","fieldId":"attachmentField_lxv44osj","label":"身份证照片","fieldData":{"value":[{"name":"mmexport1759201635514.jpg","previewUrl":"/o/2FD66I71XJ8ZEMWKFG3O3BVDOJVN2TDZ9F6GMT5?appType=APP_GRVPTEOQ6D4B7FLZFYNJ&fileName=APP_GRVPTEOQ6D4B7FLZFYNJ_MkZENjZJNzFYSjhaRU1XS0ZHM08zQlZET0pWTjJURFo5RjZHTVM1.jpg&instId=&type=open&process=image/resize,m_fill,w_200,h_200,limit_0/quality,q_80","downloadUrl":"/o/2FD66I71XJ8ZEMWKFG3O3BVDOJVN2TDZ9F6GMT5?appType=APP_GRVPTEOQ6D4B7FLZFYNJ&fileName=APP_GRVPTEOQ6D4B7FLZFYNJ_MkZENjZJNzFYSjhaRU1XS0ZHM08zQlZET0pWTjJURFo5RjZHTVM1.jpg&instId=&type=download","size":1428463,"url":"/o/2FD66I71XJ8ZEMWKFG3O3BVDOJVN2TDZ9F6GMT5?appType=APP_GRVPTEOQ6D4B7FLZFYNJ&fileName=APP_GRVPTEOQ6D4B7FLZFYNJ_MkZENjZJNzFYSjhaRU1XS0ZHM08zQlZET0pWTjJURFo5RjZHTVM1.jpg&instId=&type=download","fileUuid":"APP_GRVPTEOQ6D4B7FLZFYNJ_MkZENjZJNzFYSjhaRU1XS0ZHM08zQlZET0pWTjJURFo5RjZHTVM1.jpg"}]}},
        {"componentName":"AttachmentField","fieldId":"attachmentField_lxv44osk","label":"社保/在职证明","fieldData":{"value":[{"name":"mmexport1759201655801.jpg","previewUrl":"/o/K7666JC1AK8ZSBVX8IJOP71PHGNL34I2AF6GMF5?appType=APP_GRVPTEOQ6D4B7FLZFYNJ&fileName=APP_GRVPTEOQ6D4B7FLZFYNJ_Szc2NjZKQzFBSzhaU0JWWDhJSk9QNzFQSEdOTDM0STJBRjZHTUU1.jpg&instId=&type=open&process=image/resize,m_fill,w_200,h_200,limit_0/quality,q_80","downloadUrl":"/o/K7666JC1AK8ZSBVX8IJOP71PHGNL34I2AF6GMF5?appType=APP_GRVPTEOQ6D4B7FLZFYNJ&fileName=APP_GRVPTEOQ6D4B7FLZFYNJ_Szc2NjZKQzFBSzhaU0JWWDhJSk9QNzFQSEdOTDM0STJBRjZHTUU1.jpg&instId=&type=download","size":304370,"url":"/o/K7666JC1AK8ZSBVX8IJOP71PHGNL34I2AF6GMF5?appType=APP_GRVPTEOQ6D4B7FLZFYNJ&fileName=APP_GRVPTEOQ6D4B7FLZFYNJ_Szc2NjZKQzFBSzhaU0JWWDhJSk9QNzFQSEdOTDM0STJBRjZHTUU1.jpg&instId=&type=download","fileUuid":"APP_GRVPTEOQ6D4B7FLZFYNJ_Szc2NjZKQzFBSzhaU0JWWDhJSk9QNzFQSEdOTDM0STJBRjZHTUU1.jpg"}]}},
        {"componentName":"AttachmentField","fieldId":"attachmentField_lxv44osn","label":"其他附件","fieldData":{"value":[]}}
    ],
    // 张
    "MTMwMzIyMTk4ODA2MjQyMDE4": [
        {"componentName":"SelectField","fieldId":"selectField_lxv44orx","label":"有效身份证件","fieldData":{"value":"身份证","text":"身份证"},"options":[{"defaultChecked":false,"syncLabelValue":true,"__sid":"item_lxjzgsg1","text":"身份证","__sid__":"serial_lxjzgsg0","value":"身份证","sid":"serial_lxjzgsg0"}]},
        {"componentName":"TextField","fieldId":"textField_lxv44ory","label":"证件号码","fieldData":{"value": decode("MTMwMzIyMTk4ODA2MjQyMDE4")}},
        {"componentName":"TextField","fieldId":"textField_lxv44orw","label":"姓名","fieldData":{"value": decode("5byg5by6")}},
        {"componentName":"SelectField","fieldId":"selectField_mbyjhot6","label":"区号","fieldData":{"value":"86","text":"+86"},"options":[{"defaultChecked":true,"syncLabelValue":false,"__sid":"item_megqe4lm","text":"+86","__sid__":"serial_megqe4ll","value":"86","sid":"serial_mbyjf8gm"}]},
        {"componentName":"TextField","fieldId":"textField_lxv44orz","label":"联系方式","fieldData":{"value": decode("MTc3MzM1MzIwNTc=") }},
        {"componentName":"ImageField","fieldId":"imageField_ly9i5k5q","label":"免冠照片","fieldData":{"value":[{"name":"mmexport1759201649607.jpg","previewUrl":"https://dingtalk.avaryholding.com:8443/dingplus/image/20250930/2e36796d55df6570b30814673dd79c7d.jpg","downloadUrl":"https://dingtalk.avaryholding.com:8443/dingplus/image/20250930/2e36796d55df6570b30814673dd79c7d.jpg","size":64695,"url":"https://dingtalk.avaryholding.com:8443/dingplus/image/20250930/2e36796d55df6570b30814673dd79c7d.jpg"}]}},
        {"componentName":"AttachmentField","fieldId":"attachmentField_lxv44osj","label":"身份证照片","fieldData":{"value":[{"name":"mmexport1759201639327.jpg","previewUrl":"/o/GNC66E91ZR7ZFLTH8OFEP46CB9JG3EUHDF6GMOB?appType=APP_GRVPTEOQ6D4B7FLZFYNJ&fileName=APP_GRVPTEOQ6D4B7FLZFYNJ_R05DNjZFOTFaUjdaRkxUSDhPRkVQNDZDQjlKRzNFVUhERjZHTU5C.jpg&instId=&type=open&process=image/resize,m_fill,w_200,h_200,limit_0/quality,q_80","downloadUrl":"/o/GNC66E91ZR7ZFLTH8OFEP46CB9JG3EUHDF6GMOB?appType=APP_GRVPTEOQ6D4B7FLZFYNJ&fileName=APP_GRVPTEOQ6D4B7FLZFYNJ_R05DNjZFOTFaUjdaRkxUSDhPRkVQNDZDQjlKRzNFVUhERjZHTU5C.jpg&instId=&type=download","size":531330,"url":"/o/GNC66E91ZR7ZFLTH8OFEP46CB9JG3EUHDF6GMOB?appType=APP_GRVPTEOQ6D4B7FLZFYNJ&fileName=APP_GRVPTEOQ6D4B7FLZFYNJ_R05DNjZFOTFaUjdaRkxUSDhPRkVQNDZDQjlKRzNFVUhERjZHTU5C.jpg&instId=&type=download","fileUuid":"APP_GRVPTEOQ6D4B7FLZFYNJ_R05DNjZFOTFaUjdaRkxUSDhPRkVQNDZDQjlKRzNFVUhERjZHTU5C.jpg"}]}},
        {"componentName":"AttachmentField","fieldId":"attachmentField_lxv44osk","label":"社保/在职证明","fieldData":{"value":[{"name":"mmexport1759201655801.jpg","previewUrl":"/o/LLF66FD1VJ8ZU56HEFRI4BPWPUBG22DMDF6GMO4?appType=APP_GRVPTEOQ6D4B7FLZFYNJ&fileName=APP_GRVPTEOQ6D4B7FLZFYNJ_TExGNjZGRDFWSjhaVTU2SEVGUkk0QlBXUFVCRzIyRE1ERjZHTU40.jpg&instId=&type=open&process=image/resize,m_fill,w_200,h_200,limit_0/quality,q_80","downloadUrl":"/o/LLF66FD1VJ8ZU56HEFRI4BPWPUBG22DMDF6GMO4?appType=APP_GRVPTEOQ6D4B7FLZFYNJ&fileName=APP_GRVPTEOQ6D4B7FLZFYNJ_TExGNjZGRDFWSjhaVTU2SEVGUkk0QlBXUFVCRzIyRE1ERjZHTU40.jpg&instId=&type=download","size":304370,"url":"/o/LLF66FD1VJ8ZU56HEFRI4BPWPUBG22DMDF6GMO4?appType=APP_GRVPTEOQ6D4B7FLZFYNJ&fileName=APP_GRVPTEOQ6D4B7FLZFYNJ_TExGNjZGRDFWSjhaVTU2SEVGUkk0QlBXUFVCRzIyRE1ERjZHTU40.jpg&instId=&type=download","fileUuid":"APP_GRVPTEOQ6D4B7FLZFYNJ_TExGNjZGRDFWSjhaVTU2SEVGUkk0QlBXUFVCRzIyRE1ERjZHTU40.jpg"}]}},
        {"componentName":"AttachmentField","fieldId":"attachmentField_lxv44osn","label":"其他附件","fieldData":{"value":[]}}
    ],
   // 姜 (已同步 2026-03-04 最新抓包数据)
    "MTMwNDI1MTk4OTA4MjkwMzE0": [
        {"componentName":"SelectField","fieldId":"selectField_lxv44orx","label":"有效身份证件","fieldData":{"value":"身份证","text":"身份证"},"options":[{"defaultChecked":false,"syncLabelValue":true,"__sid":"item_lxjzgsg1","text":"身份证","__sid__":"serial_lxjzgsg0","value":"身份证","sid":"serial_lxjzgsg0"}]},
        {"componentName":"TextField","fieldId":"textField_lxv44ory","label":"证件号码","fieldData":{"value": decode("MTMwNDI1MTk4OTA4MjkwMzE0")}},
        {"componentName":"TextField","fieldId":"textField_lxv44orw","label":"姓名","fieldData":{"value": decode("5aec5bu66b6Z")}},
        {"componentName":"SelectField","fieldId":"selectField_mbyjhot6","label":"区号","fieldData":{"value":"86","text":"+86"},"options":[{"defaultChecked":true,"syncLabelValue":false,"__sid":"item_megqe4lm","text":"+86","__sid__":"serial_megqe4ll","value":"86","sid":"serial_mbyjf8gm"}]},
        {"componentName":"TextField","fieldId":"textField_lxv44orz","label":"联系方式","fieldData":{"value": decode("MTMzMTUzOTY2MDc=") }}, // 已更新为 13315396607 的 Base64
        {"componentName":"ImageField","fieldId":"imageField_ly9i5k5q","label":"免冠照片","fieldData":{"value":[{"name":"mmexport1772611546795.jpg","previewUrl":"https://dingtalk.avaryholding.com:8443/dingplus/image/20260304/4a240b9a1d92ad988ee252d3eb83f583.jpg","downloadUrl":"https://dingtalk.avaryholding.com:8443/dingplus/image/20260304/4a240b9a1d92ad988ee252d3eb83f583.jpg","size":173548,"url":"https://dingtalk.avaryholding.com:8443/dingplus/image/20260304/4a240b9a1d92ad988ee252d3eb83f583.jpg"}]}},
        {"componentName":"AttachmentField","fieldId":"attachmentField_lxv44osj","label":"身份证照片","fieldData":{"value":[{"name":"mmexport1772611479286.jpg","previewUrl":"/o/W6D66371ZXN37V9ZHQY155MBLB4T2STL4RBMM88?appType=APP_GRVPTEOQ6D4B7FLZFYNJ&fileName=APP_GRVPTEOQ6D4B7FLZFYNJ_VzZENjYzNzFaWE4zN1Y5WkhRWTE1NU1CTEI0VDJTVEw0UkJNTTc4.jpg&instId=&type=open&process=image/resize,m_fill,w_200,h_200,limit_0/quality,q_80","downloadUrl":"/o/W6D66371ZXN37V9ZHQY155MBLB4T2STL4RBMM88?appType=APP_GRVPTEOQ6D4B7FLZFYNJ&fileName=APP_GRVPTEOQ6D4B7FLZFYNJ_VzZENjYzNzFaWE4zN1Y5WkhRWTE1NU1CTEI0VDJTVEw0UkJNTTc4.jpg&instId=&type=download","size":437235,"url":"/o/W6D66371ZXN37V9ZHQY155MBLB4T2STL4RBMM88?appType=APP_GRVPTEOQ6D4B7FLZFYNJ&fileName=APP_GRVPTEOQ6D4B7FLZFYNJ_VzZENjYzNzFaWE4zN1Y5WkhRWTE1NU1CTEI0VDJTVEw0UkJNTTc4.jpg&instId=&type=download","fileUuid":"APP_GRVPTEOQ6D4B7FLZFYNJ_VzZENjYzNzFaWE4zN1Y5WkhRWTE1NU1CTEI0VDJTVEw0UkJNTTc4.jpg"}]}},
        {"componentName":"AttachmentField","fieldId":"attachmentField_lxv44osk","label":"社保/在职证明","fieldData":{"value":[{"name":"2_在职证明.pdf","previewUrl":"/dingtalk/mobile/APP_GRVPTEOQ6D4B7FLZFYNJ/inst/preview?appType=APP_GRVPTEOQ6D4B7FLZFYNJ&fileName=APP_GRVPTEOQ6D4B7FLZFYNJ_UlpFNjY4NzFFOU8zSElNSU5ETEJDNFdXVkwzUTJZR1NBUkJNTTI1.pdf&fileSize=75650&downloadUrl=APP_GRVPTEOQ6D4B7FLZFYNJ_UlpFNjY4NzFFOU8zSElNSU5ETEJDNFdXVkwzUTJZR1NBUkJNTTI1.pdf","downloadUrl":"/o/RZE66871E9O3HIMINDLBC4WWVL3Q2YGSARBMM35?appType=APP_GRVPTEOQ6D4B7FLZFYNJ&fileName=APP_GRVPTEOQ6D4B7FLZFYNJ_UlpFNjY4NzFFOU8zSElNSU5ETEJDNFdXVkwzUTJZR1NBUkJNTTI1.pdf&instId=&type=download","size":75650,"url":"/o/RZE66871E9O3HIMINDLBC4WWVL3Q2YGSARBMM35?appType=APP_GRVPTEOQ6D4B7FLZFYNJ&fileName=APP_GRVPTEOQ6D4B7FLZFYNJ_UlpFNjY4NzFFOU8zSElNSU5ETEJDNFdXVkwzUTJZR1NBUkJNTTI1.pdf&instId=&type=download","fileUuid":"APP_GRVPTEOQ6D4B7FLZFYNJ_UlpFNjY4NzFFOU8zSElNSU5ETEJDNFdXVkwzUTJZR1NBUkJNTTI1.pdf"}]}},
        {"componentName":"AttachmentField","fieldId":"attachmentField_lxv44osn","label":"其他附件","fieldData":{"value":[]}}
    ],
    // 孙
    "MjMwMjMwMjAwMzAxMDEyMTM1": [
        {"componentName":"SelectField","fieldId":"selectField_lxv44orx","label":"有效身份证件","fieldData":{"value":"身份证","text":"身份证"},"options":[{"defaultChecked":false,"syncLabelValue":true,"__sid":"item_lxjzgsg1","text":"身份证","__sid__":"serial_lxjzgsg0","value":"身份证","sid":"serial_lxjzgsg0"}]},
        {"componentName":"TextField","fieldId":"textField_lxv44ory","label":"证件号码","fieldData":{"value": decode("MjMwMjMwMjAwMzAxMDEyMTM1")}},
        {"componentName":"TextField","fieldId":"textField_lxv44orw","label":"姓名","fieldData":{"value": decode("5a2Z5b635Yev")}},
        {"componentName":"SelectField","fieldId":"selectField_mbyjhot6","label":"区号","fieldData":{"value":"86","text":"+86"},"options":[{"defaultChecked":true,"syncLabelValue":false,"__sid":"item_megqe4lm","text":"+86","__sid__":"serial_megqe4ll","value":"86","sid":"serial_mbyjf8gm"}]},
        {"componentName":"TextField","fieldId":"textField_lxv44orz","label":"联系方式","fieldData":{"value": decode("MTc2MTQ2MjUxMTI=") }},
        {"componentName":"ImageField","fieldId":"imageField_ly9i5k5q","label":"免冠照片","fieldData":{"value":[{"name":"IMG20250729211344.jpg","previewUrl":"https://dingtalk.avaryholding.com:8443/dingplus/image/20250801/aa450e5d5330972eabce5ecbf019b577.jpg","downloadUrl":"https://dingtalk.avaryholding.com:8443/dingplus/image/20250801/aa450e5d5330972eabce5ecbf019b577.jpg","size":211900,"url":"https://dingtalk.avaryholding.com:8443/dingplus/image/20250801/aa450e5d5330972eabce5ecbf019b577.jpg"}]}},
        {"componentName":"AttachmentField","fieldId":"attachmentField_lxv44osj","label":"身份证照片","fieldData":{"value":[{"name":"mmexport1754011976476.jpg","previewUrl":"/o/MLF662B1O8JX9WDEEK8VLAGNM11H3JP5G5SDM1F?appType=APP_GRVPTEOQ6D4B7FLZFYNJ&fileName=APP_GRVPTEOQ6D4B7FLZFYNJ_TUxGNjYyQjFPOEpYOVdERUVLOFZMQUdOTTExSDNKUDVHNVNETTBG.jpg&instId=&type=open&process=image/resize,m_fill,w_200,h_200,limit_0/quality,q_80","downloadUrl":"/o/MLF662B1O8JX9WDEEK8VLAGNM11H3JP5G5SDM1F?appType=APP_GRVPTEOQ6D4B7FLZFYNJ&fileName=APP_GRVPTEOQ6D4B7FLZFYNJ_TUxGNjYyQjFPOEpYOVdERUVLOFZMQUdOTTExSDNKUDVHNVNETTBG.jpg&instId=&type=download","size":396211,"url":"/o/MLF662B1O8JX9WDEEK8VLAGNM11H3JP5G5SDM1F?appType=APP_GRVPTEOQ6D4B7FLZFYNJ&fileName=APP_GRVPTEOQ6D4B7FLZFYNJ_TUxGNjYyQjFPOEpYOVdERUVLOFZMQUdOTTExSDNKUDVHNVNETTBG.jpg&instId=&type=download","fileUuid":"APP_GRVPTEOQ6D4B7FLZFYNJ_TUxGNjYyQjFPOEpYOVdERUVLOFZMQUdOTTExSDNKUDVHNVNETTBG.jpg"},{"name":"mmexport1754011977805.jpg","previewUrl":"/o/EWE66Z916BJXCIPX9N5DOACQ111K3IS8G5SDM48?appType=APP_GRVPTEOQ6D4B7FLZFYNJ&fileName=APP_GRVPTEOQ6D4B7FLZFYNJ_RVdFNjZaOTE2QkpYQ0lQWDlONURPQUNRMTExSzNIUzhHNVNETTM4.jpg&instId=&type=open&process=image/resize,m_fill,w_200,h_200,limit_0/quality,q_80","downloadUrl":"/o/EWE66Z916BJXCIPX9N5DOACQ111K3IS8G5SDM48?appType=APP_GRVPTEOQ6D4B7FLZFYNJ&fileName=APP_GRVPTEOQ6D4B7FLZFYNJ_RVdFNjZaOTE2QkpYQ0lQWDlONURPQUNRMTExSzNIUzhHNVNETTM4.jpg&instId=&type=download","size":502357,"url":"/o/EWE66Z916BJXCIPX9N5DOACQ111K3IS8G5SDM48?appType=APP_GRVPTEOQ6D4B7FLZFYNJ&fileName=APP_GRVPTEOQ6D4B7FLZFYNJ_RVdFNjZaOTE2QkpYQ0lQWDlONURPQUNRMTExSzNIUzhHNVNETTM4.jpg&instId=&type=download","fileUuid":"APP_GRVPTEOQ6D4B7FLZFYNJ_RVdFNjZaOTE2QkpYQ0lQWDlONURPQUNRMTExSzNIUzhHNVNETTM4.jpg"}]}},
        {"componentName":"AttachmentField","fieldId":"attachmentField_lxv44osk","label":"社保/在职证明","fieldData":{"value":[{"name":"在职证明+-+孙德凯.pdf","previewUrl":"/dingtalk/mobile/APP_GRVPTEOQ6D4B7FLZFYNJ/inst/preview?appType=APP_GRVPTEOQ6D4B7FLZFYNJ&fileName=APP_GRVPTEOQ6D4B7FLZFYNJ_QjlDNjYwQzFNQkxYRDBOUzczVk1EN0pCTTJDUDM2Q0xINVNETUI0.pdf&fileSize=40638&downloadUrl=APP_GRVPTEOQ6D4B7FLZFYNJ_QjlDNjYwQzFNQkxYRDBOUzczVk1EN0pCTTJDUDM2Q0xINVNETUI0.pdf","downloadUrl":"/o/B9C660C1MBLXD0NS73VMD7JBM2CP37CLH5SDMC4?appType=APP_GRVPTEOQ6D4B7FLZFYNJ&fileName=APP_GRVPTEOQ6D4B7FLZFYNJ_QjlDNjYwQzFNQkxYRDBOUzczVk1EN0pCTTJDUDM2Q0xINVNETUI0.pdf&instId=&type=download","size":40638,"url":"/o/B9C660C1MBLXD0NS73VMD7JBM2CP37CLH5SDMC4?appType=APP_GRVPTEOQ6D4B7FLZFYNJ&fileName=APP_GRVPTEOQ6D4B7FLZFYNJ_QjlDNjYwQzFNQkxYRDBOUzczVk1EN0pCTTJDUDM2Q0xINVNETUI0.pdf&instId=&type=download","fileUuid":"APP_GRVPTEOQ6D4B7FLZFYNJ_QjlDNjYwQzFNQkxYRDBOUzczVk1EN0pCTTJDUDM2Q0xINVNETUI0.pdf"}]}},
        {"componentName":"AttachmentField","fieldId":"attachmentField_lxv44osn","label":"其他附件","fieldData":{"value":[]}}
    ],
    // 王
    "MTMxMTIxMTk4OTAxMDU1MDEx": [
        {"componentName":"SelectField","fieldId":"selectField_lxv44orx","label":"有效身份证件","fieldData":{"value":"身份证","text":"身份证"},"options":[{"defaultChecked":false,"syncLabelValue":true,"__sid":"item_lxjzgsg1","text":"身份证","__sid__":"serial_lxjzgsg0","value":"身份证","sid":"serial_lxjzgsg0"}]},
        {"componentName":"TextField","fieldId":"textField_lxv44ory","label":"证件号码","fieldData":{"value": decode("MTMxMTIxMTk4OTAxMDU1MDEx")}},
        {"componentName":"TextField","fieldId":"textField_lxv44orw","label":"姓名","fieldData":{"value": decode("546L6I+B")}},
        {"componentName":"SelectField","fieldId":"selectField_mbyjhot6","label":"区号","fieldData":{"value":"86","text":"+86"},"options":[{"defaultChecked":true,"syncLabelValue":false,"__sid":"item_megqe4lm","text":"+86","__sid__":"serial_megqe4ll","value":"86","sid":"serial_mbyjf8gm"}]},
        {"componentName":"TextField","fieldId":"textField_lxv44orz","label":"联系方式","fieldData":{"value": decode("MTUzNjk2OTc2NTY=") }},
        {"componentName":"ImageField","fieldId":"imageField_ly9i5k5q","label":"免冠照片","fieldData":{"value":[{"name":"mmexport1764079804080.jpg","previewUrl":"https://dingtalk.avaryholding.com:8443/dingplus/image/20251125/75283de0e118cb24adf4d5a0ed6bac6f.jpg","downloadUrl":"https://dingtalk.avaryholding.com:8443/dingplus/image/20251125/75283de0e118cb24adf4d5a0ed6bac6f.jpg","size":61062,"url":"https://dingtalk.avaryholding.com:8443/dingplus/image/20251125/75283de0e118cb24adf4d5a0ed6bac6f.jpg"}]}},
        {"componentName":"AttachmentField","fieldId":"attachmentField_lxv44osj","label":"身份证照片","fieldData":{"value":[{"name":"mmexport1764079249396.jpg","previewUrl":"/o/4UF66771OHS0AITWGDG6M7PX8ZY237GNKNEIM0D?appType=APP_GRVPTEOQ6D4B7FLZFYNJ&fileName=APP_GRVPTEOQ6D4B7FLZFYNJ_NFVGNjY3NzFPSFMwQUlUV0dERzZNN1BYOFpZMjM3R05LTkVJTVpD.jpg&instId=&type=open&process=image/resize,m_fill,w_200,h_200,limit_0/quality,q_80","downloadUrl":"/o/4UF66771OHS0AITWGDG6M7PX8ZY237GNKNEIM0D?appType=APP_GRVPTEOQ6D4B7FLZFYNJ&fileName=APP_GRVPTEOQ6D4B7FLZFYNJ_NFVGNjY3NzFPSFMwQUlUV0dERzZNN1BYOFpZMjM3R05LTkVJTVpD.jpg&instId=&type=download","size":173437,"url":"/o/4UF66771OHS0AITWGDG6M7PX8ZY237GNKNEIM0D?appType=APP_GRVPTEOQ6D4B7FLZFYNJ&fileName=APP_GRVPTEOQ6D4B7FLZFYNJ_NFVGNjY3NzFPSFMwQUlUV0dERzZNN1BYOFpZMjM3R05LTkVJTVpD.jpg&instId=&type=download","fileUuid":"APP_GRVPTEOQ6D4B7FLZFYNJ_NFVGNjY3NzFPSFMwQUlUV0dERzZNN1BYOFpZMjM3R05LTkVJTVpD.jpg"}]}},
        {"componentName":"AttachmentField","fieldId":"attachmentField_lxv44osk","label":"社保/在职证明","fieldData":{"value":[{"name":"在职证明.pdf","previewUrl":"/dingtalk/mobile/APP_GRVPTEOQ6D4B7FLZFYNJ/inst/preview?appType=APP_GRVPTEOQ6D4B7FLZFYNJ&fileName=APP_GRVPTEOQ6D4B7FLZFYNJ_TlNHNjZKQjFMSFcwMjAwQ0hRRFNNQ0oxTDlWODIyWlBLTkVJTUk0.pdf&fileSize=74505&downloadUrl=APP_GRVPTEOQ6D4B7FLZFYNJ_TlNHNjZKQjFMSFcwMjAwQ0hRRFNNQ0oxTDlWODIyWlBLTkVJTUk0.pdf","downloadUrl":"/o/NSG66JB1LHW0200CHQDSMCJ1L9V822ZPKNEIMJ4?appType=APP_GRVPTEOQ6D4B7FLZFYNJ&fileName=APP_GRVPTEOQ6D4B7FLZFYNJ_TlNHNjZKQjFMSFcwMjAwQ0hRRFNNQ0oxTDlWODIyWlBLTkVJTUk0.pdf&instId=&type=download","size":74505,"url":"/o/NSG66JB1LHW0200CHQDSMCJ1L9V822ZPKNEIMJ4?appType=APP_GRVPTEOQ6D4B7FLZFYNJ&fileName=APP_GRVPTEOQ6D4B7FLZFYNJ_TlNHNjZKQjFMSFcwMjAwQ0hRRFNNQ0oxTDlWODIyWlBLTkVJTUk0.pdf&instId=&type=download","fileUuid":"APP_GRVPTEOQ6D4B7FLZFYNJ_TlNHNjZKQjFMSFcwMjAwQ0hRRFNNQ0oxTDlWODIyWlBLTkVJTUk0.pdf"}]}},
        {"componentName":"AttachmentField","fieldId":"attachmentField_lxv44osn","label":"其他附件","fieldData":{"value":[]}}
    ],
    // 田
    "NDEwNDIzMTk4OTA3MjIxNTMw": [
        {"componentName":"SelectField","fieldId":"selectField_lxv44orx","label":"有效身份证件","fieldData":{"value":"身份证","text":"身份证"},"options":[{"defaultChecked":false,"syncLabelValue":true,"__sid":"item_lxjzgsg1","text":"身份证","__sid__":"serial_lxjzgsg0","value":"身份证","sid":"serial_lxjzgsg0"}]},
        {"componentName":"TextField","fieldId":"textField_lxv44ory","label":"证件号码","fieldData":{"value": decode("NDEwNDIzMTk4OTA3MjIxNTMw")}},
        {"componentName":"TextField","fieldId":"textField_lxv44orw","label":"姓名","fieldData":{"value": decode("55Sw5LmQ5LmQ")}},
        {"componentName":"SelectField","fieldId":"selectField_mbyjhot6","label":"区号","fieldData":{"value":"86","text":"+86"},"options":[{"defaultChecked":true,"syncLabelValue":false,"__sid":"item_megqe4lm","text":"+86","__sid__":"serial_megqe4ll","value":"86","sid":"serial_mbyjf8gm"}]},
        {"componentName":"TextField","fieldId":"textField_lxv44orz","label":"联系方式","fieldData":{"value": decode("MTM3MzM3NzE2NjE=") }},
        {"componentName":"ImageField","fieldId":"imageField_ly9i5k5q","label":"免冠照片","fieldData":{"value":[{"name":"mmexport1764077687246.jpg","previewUrl":"https://dingtalk.avaryholding.com:8443/dingplus/image/20251125/ce5e71ca5152f9308d11fa79274a2db4.jpg","downloadUrl":"https://dingtalk.avaryholding.com:8443/dingplus/image/20251125/ce5e71ca5152f9308d11fa79274a2db4.jpg","size":56562,"url":"https://dingtalk.avaryholding.com:8443/dingplus/image/20251125/ce5e71ca5152f9308d11fa79274a2db4.jpg"}]}},
        {"componentName":"AttachmentField","fieldId":"attachmentField_lxv44osj","label":"身份证照片","fieldData":{"value":[{"name":"mmexport1764077685696.jpg","previewUrl":"/o/JHC66Q81ACX0C1U5KH7TLBOPQLB83SQ8YMEIM52?appType=APP_GRVPTEOQ6D4B7FLZFYNJ&fileName=APP_GRVPTEOQ6D4B7FLZFYNJ_SkhDNjZRODFBQ1gwQzFVNUtIN1RMQk9QUUxCODNTUThZTUVJTTQy.jpg&instId=&type=open&process=image/resize,m_fill,w_200,h_200,limit_0/quality,q_80","downloadUrl":"/o/JHC66Q81ACX0C1U5KH7TLBOPQLB83SQ8YMEIM52?appType=APP_GRVPTEOQ6D4B7FLZFYNJ&fileName=APP_GRVPTEOQ6D4B7FLZFYNJ_SkhDNjZRODFBQ1gwQzFVNUtIN1RMQk9QUUxCODNTUThZTUVJTTQy.jpg&instId=&type=download","size":327697,"url":"/o/JHC66Q81ACX0C1U5KH7TLBOPQLB83SQ8YMEIM52?appType=APP_GRVPTEOQ6D4B7FLZFYNJ&fileName=APP_GRVPTEOQ6D4B7FLZFYNJ_SkhDNjZRODFBQ1gwQzFVNUtIN1RMQk9QUUxCODNTUThZTUVJTTQy.jpg&instId=&type=download","fileUuid":"APP_GRVPTEOQ6D4B7FLZFYNJ_SkhDNjZRODFBQ1gwQzFVNUtIN1RMQk9QUUxCODNTUThZTUVJTTQy.jpg"}]}},
        {"componentName":"AttachmentField","fieldId":"attachmentField_lxv44osk","label":"社保/在职证明","fieldData":{"value":[{"name":"mmexport1764077683551.jpg","previewUrl":"/o/R7C66W71JES0TS6GOMX304AK0SI23F2NZMEIMWL?appType=APP_GRVPTEOQ6D4B7FLZFYNJ&fileName=APP_GRVPTEOQ6D4B7FLZFYNJ_UjdDNjZXNzFKRVMwVFM2R09NWDMwNEFLMFNJMjNGMk5aTUVJTVZM.jpg&instId=&type=open&process=image/resize,m_fill,w_200,h_200,limit_0/quality,q_80","downloadUrl":"/o/R7C66W71JES0TS6GOMX304AK0SI23F2NZMEIMWL?appType=APP_GRVPTEOQ6D4B7FLZFYNJ&fileName=APP_GRVPTEOQ6D4B7FLZFYNJ_UjdDNjZXNzFKRVMwVFM2R09NWDMwNEFLMFNJMjNGMk5aTUVJTVZM.jpg&instId=&type=download","size":95823,"url":"/o/R7C66W71JES0TS6GOMX304AK0SI23F2NZMEIMWL?appType=APP_GRVPTEOQ6D4B7FLZFYNJ&fileName=APP_GRVPTEOQ6D4B7FLZFYNJ_UjdDNjZXNzFKRVMwVFM2R09NWDMwNEFLMFNJMjNGMk5aTUVJTVZM.jpg&instId=&type=download","fileUuid":"APP_GRVPTEOQ6D4B7FLZFYNJ_UjdDNjZXNzFKRVMwVFM2R09NWDMwNEFLMFNJMjNGMk5aTUVJTVZM.jpg"}]}},
        {"componentName":"AttachmentField","fieldId":"attachmentField_lxv44osn","label":"其他附件","fieldData":{"value":[]}}
    ],
    // 兰 (新增)
    "NDMyOTAxMTk4MjExMDUyMDE2": [
        {"componentName":"SelectField","fieldId":"selectField_lxv44orx","label":"有效身份证件","fieldData":{"value":"身份证","text":"身份证"},"options":[{"defaultChecked":false,"syncLabelValue":true,"__sid":"item_lxjzgsg1","text":"身份证","__sid__":"serial_lxjzgsg0","value":"身份证","sid":"serial_lxjzgsg0"}]},
        {"componentName":"TextField","fieldId":"textField_lxv44ory","label":"证件号码","fieldData":{"value": decode("NDMyOTAxMTk4MjExMDUyMDE2")}},
        {"componentName":"TextField","fieldId":"textField_lxv44orw","label":"姓名","fieldData":{"value": decode("5YWw5paM")}},
        {"componentName":"SelectField","fieldId":"selectField_mbyjhot6","label":"区号","fieldData":{"value":"86","text":"+86"},"options":[{"defaultChecked":true,"syncLabelValue":false,"__sid":"item_megqe4lm","text":"+86","__sid__":"serial_megqe4ll","value":"86","sid":"serial_mbyjf8gm"}]},
        {"componentName":"TextField","fieldId":"textField_lxv44orz","label":"联系方式","fieldData":{"value": decode("MTM0MTI5NTM1MzA=") }},
        {"componentName":"ImageField","fieldId":"imageField_ly9i5k5q","label":"免冠照片","fieldData":{"value":[{"name":"1000010214.jpg","previewUrl":"https://dingtalk.avaryholding.com:8443/dingplus/image/20251212/fd7e8c2de382ff60fa06a0b133726925.jpg","downloadUrl":"https://dingtalk.avaryholding.com:8443/dingplus/image/20251212/fd7e8c2de382ff60fa06a0b133726925.jpg","size":36681,"url":"https://dingtalk.avaryholding.com:8443/dingplus/image/20251212/fd7e8c2de382ff60fa06a0b133726925.jpg"}]}},
        {"componentName":"AttachmentField","fieldId":"attachmentField_lxv44osj","label":"身份证照片","fieldData":{"value":[{"name":"mmexport1765527972471.jpg","previewUrl":"/o/KPE66S71GVE1CFXGNA63M4ESVXGL3DBR4M2JMH?appType=APP_GRVPTEOQ6D4B7FLZFYNJ&fileName=APP_GRVPTEOQ6D4B7FLZFYNJ_S1BFNjZTNzFHVkUxQ0ZYR05BNjNNNEVTVlhHTDNEQlI0TTJKTUc$.jpg&instId=&type=open&process=image/resize,m_fill,w_200,h_200,limit_0/quality,q_80","downloadUrl":"/o/KPE66S71GVE1CFXGNA63M4ESVXGL3DBR4M2JMH?appType=APP_GRVPTEOQ6D4B7FLZFYNJ&fileName=APP_GRVPTEOQ6D4B7FLZFYNJ_S1BFNjZTNzFHVkUxQ0ZYR05BNjNNNEVTVlhHTDNEQlI0TTJKTUc$.jpg&instId=&type=download","size":214657,"url":"/o/KPE66S71GVE1CFXGNA63M4ESVXGL3DBR4M2JMH?appType=APP_GRVPTEOQ6D4B7FLZFYNJ&fileName=APP_GRVPTEOQ6D4B7FLZFYNJ_S1BFNjZTNzFHVkUxQ0ZYR05BNjNNNEVTVlhHTDNEQlI0TTJKTUc$.jpg&instId=&type=download","fileUuid":"APP_GRVPTEOQ6D4B7FLZFYNJ_S1BFNjZTNzFHVkUxQ0ZYR05BNjNNNEVTVlhHTDNEQlI0TTJKTUc$.jpg"}]}},
        {"componentName":"AttachmentField","fieldId":"attachmentField_lxv44osk","label":"社保/在职证明","fieldData":{"value":[{"name":"1_在职证明.pdf","previewUrl":"/dingtalk/mobile/APP_GRVPTEOQ6D4B7FLZFYNJ/inst/preview?appType=APP_GRVPTEOQ6D4B7FLZFYNJ&fileName=APP_GRVPTEOQ6D4B7FLZFYNJ_TUo5NjZBOTEwV0UxVlpBWUdKOTg0Q09GVTlBMjNVQlo0TTJKTUI%24.pdf&fileSize=71755&downloadUrl=APP_GRVPTEOQ6D4B7FLZFYNJ_TUo5NjZBOTEwV0UxVlpBWUdKOTg0Q09GVTlBMjNVQlo0TTJKTUI$.pdf","downloadUrl":"/o/MJ966A910WE1VZAYGJ984COFU9A23UBZ4M2JMC?appType=APP_GRVPTEOQ6D4B7FLZFYNJ&fileName=APP_GRVPTEOQ6D4B7FLZFYNJ_TUo5NjZBOTEwV0UxVlpBWUdKOTg0Q09GVTlBMjNVQlo0TTJKTUI$.pdf&instId=&type=download","size":71755,"url":"/o/MJ966A910WE1VZAYGJ984COFU9A23UBZ4M2JMC?appType=APP_GRVPTEOQ6D4B7FLZFYNJ&fileName=APP_GRVPTEOQ6D4B7FLZFYNJ_TUo5NjZBOTEwV0UxVlpBWUdKOTg0Q09GVTlBMjNVQlo0TTJKTUI$.pdf&instId=&type=download","fileUuid":"APP_GRVPTEOQ6D4B7FLZFYNJ_TUo5NjZBOTEwV0UxVlpBWUdKOTg0Q09GVTlBMjNVQlo0TTJKTUI$.pdf"}]}},
        {"componentName":"AttachmentField","fieldId":"attachmentField_lxv44osn","label":"其他附件","fieldData":{"value":[]}}
    ],
    // 卞 (新增)
    "NDEwOTIzMTk4ODA3MTkxMDFY": [
        {"componentName":"SelectField","fieldId":"selectField_lxv44orx","label":"有效身份证件","fieldData":{"value":"身份证","text":"身份证"},"options":[{"defaultChecked":false,"syncLabelValue":true,"__sid":"item_lxjzgsg1","text":"身份证","__sid__":"serial_lxjzgsg0","value":"身份证","sid":"serial_lxjzgsg0"}]},
        {"componentName":"TextField","fieldId":"textField_lxv44ory","label":"证件号码","fieldData":{"value": decode("NDEwOTIzMTk4ODA3MTkxMDFY")}},
        {"componentName":"TextField","fieldId":"textField_lxv44orw","label":"姓名","fieldData":{"value": decode("5Y2e5b2m5p2w")}},
        {"componentName":"SelectField","fieldId":"selectField_mbyjhot6","label":"区号","fieldData":{"value":"86","text":"+86"},"options":[{"defaultChecked":true,"syncLabelValue":false,"__sid":"item_megqe4lm","text":"+86","__sid__":"serial_megqe4ll","value":"86","sid":"serial_mbyjf8gm"}]},
        {"componentName":"TextField","fieldId":"textField_lxv44orz","label":"联系方式","fieldData":{"value": decode("MTM5NjI2NTAzNDI=") }},
        {"componentName":"ImageField","fieldId":"imageField_ly9i5k5q","label":"免冠照片","fieldData":{"value":[{"name":"1000010220.jpg","previewUrl":"https://dingtalk.avaryholding.com:8443/dingplus/image/20251212/11827a46930d5926a3f3dea1195e1868.jpg","downloadUrl":"https://dingtalk.avaryholding.com:8443/dingplus/image/20251212/11827a46930d5926a3f3dea1195e1868.jpg","size":99280,"url":"https://dingtalk.avaryholding.com:8443/dingplus/image/20251212/11827a46930d5926a3f3dea1195e1868.jpg"}]}},
        {"componentName":"AttachmentField","fieldId":"attachmentField_lxv44osj","label":"身份证照片","fieldData":{"value":[{"name":"mmexport1765528702605.jpg","previewUrl":"/o/17B66991SSD19XWDH8OL36ERD8202TD7AM2JML8?appType=APP_GRVPTEOQ6D4B7FLZFYNJ&fileName=APP_GRVPTEOQ6D4B7FLZFYNJ_MTdCNjY5OTFTU0QxOVhXREg4T0wzNkVSRDgyMDJURDdBTTJKTUs4.jpg&instId=&type=open&process=image/resize,m_fill,w_200,h_200,limit_0/quality,q_80","downloadUrl":"/o/17B66991SSD19XWDH8OL36ERD8202TD7AM2JML8?appType=APP_GRVPTEOQ6D4B7FLZFYNJ&fileName=APP_GRVPTEOQ6D4B7FLZFYNJ_MTdCNjY5OTFTU0QxOVhXREg4T0wzNkVSRDgyMDJURDdBTTJKTUs4.jpg&instId=&type=download","size":82147,"url":"/o/17B66991SSD19XWDH8OL36ERD8202TD7AM2JML8?appType=APP_GRVPTEOQ6D4B7FLZFYNJ&fileName=APP_GRVPTEOQ6D4B7FLZFYNJ_MTdCNjY5OTFTU0QxOVhXREg4T0wzNkVSRDgyMDJURDdBTTJKTUs4.jpg&instId=&type=download","fileUuid":"APP_GRVPTEOQ6D4B7FLZFYNJ_MTdCNjY5OTFTU0QxOVhXREg4T0wzNkVSRDgyMDJURDdBTTJKTUs4.jpg"}]}},
        {"componentName":"AttachmentField","fieldId":"attachmentField_lxv44osk","label":"社保/在职证明","fieldData":{"value":[{"name":"mmexport1765528683879.jpg","previewUrl":"/o/KPE66S71PVE1Y4UKO5DXL9ENNDCI25XDAM2JMD?appType=APP_GRVPTEOQ6D4B7FLZFYNJ&fileName=APP_GRVPTEOQ6D4B7FLZFYNJ_S1BFNjZTNzFQVkUxWTRVS081RFhMOUVOTkRDSTI1WERBTTJKTUM$.jpg&instId=&type=open&process=image/resize,m_fill,w_200,h_200,limit_0/quality,q_80","downloadUrl":"/o/KPE66S71PVE1Y4UKO5DXL9ENNDCI25XDAM2JMD?appType=APP_GRVPTEOQ6D4B7FLZFYNJ&fileName=APP_GRVPTEOQ6D4B7FLZFYNJ_S1BFNjZTNzFQVkUxWTRVS081RFhMOUVOTkRDSTI1WERBTTJKTUM$.jpg&instId=&type=download","size":95850,"url":"/o/KPE66S71PVE1Y4UKO5DXL9ENNDCI25XDAM2JMD?appType=APP_GRVPTEOQ6D4B7FLZFYNJ&fileName=APP_GRVPTEOQ6D4B7FLZFYNJ_S1BFNjZTNzFQVkUxWTRVS081RFhMOUVOTkRDSTI1WERBTTJKTUM$.jpg&instId=&type=download","fileUuid":"APP_GRVPTEOQ6D4B7FLZFYNJ_S1BFNjZTNzFQVkUxWTRVS081RFhMOUVOTkRDSTI1WERBTTJKTUM$.jpg"}]}},
        {"componentName":"AttachmentField","fieldId":"attachmentField_lxv44osn","label":"其他附件","fieldData":{"value":[]}}
    ],
    // 贾
    "MDMwNzE3Njg=": [
        {"componentName":"SelectField","fieldId":"selectField_lxv44orx","label":"有效身份证件","fieldData":{"value":"台胞证","text":"台胞证"},"options":[{"defaultChecked":false,"syncLabelValue":true,"__sid":"item_lxjzgsg3","text":"台胞证","__sid__":"serial_lxjzgsg2","value":"台胞证","sid":"serial_lxjzgsg2"}]},
        {"componentName":"TextField","fieldId":"textField_lxv44ory","label":"证件号码","fieldData":{"value": decode("MDMwNzE3Njg=") }},
        {"componentName":"TextField","fieldId":"textField_lxv44orw","label":"姓名","fieldData":{"value": decode("6LS+5paH6YCJ")}},
        {"componentName":"SelectField","fieldId":"selectField_mbyjhot6","label":"区号","fieldData":{"value":"86","text":"+86"},"options":[{"defaultChecked":true,"syncLabelValue":false,"__sid":"item_megqe4lm","text":"+86","__sid__":"serial_megqe4ll","value":"86","sid":"serial_mbyjf8gm"}]},
        {"componentName":"TextField","fieldId":"textField_lxv44orz","label":"联系方式","fieldData":{"value": decode("MTU2MjM0NTc2MjU=") }},
        {"componentName":"ImageField","fieldId":"imageField_ly9i5k5q","label":"免冠照片","fieldData":{"value":[{"name":"mmexport1760007547917.jpg","previewUrl":"https://dingtalk.avaryholding.com:8443/dingplus/image/20251010/652a6f0c65a2fb40cdccc4e4afbec59d.jpg","downloadUrl":"https://dingtalk.avaryholding.com:8443/dingplus/image/20251010/652a6f0c65a2fb40cdccc4e4afbec59d.jpg","size":144553,"url":"https://dingtalk.avaryholding.com:8443/dingplus/image/20251010/652a6f0c65a2fb40cdccc4e4afbec59d.jpg"}]}},
        {"componentName":"AttachmentField","fieldId":"attachmentField_lxv44osj","label":"身份证照片","fieldData":{"value":[{"name":"mmexport1760007546568.jpg","previewUrl":"/o/GI966BB1CS7ZB13YBTNJ95OVBJLY22F535KGM8L?appType=APP_GRVPTEOQ6D4B7FLZFYNJ&fileName=APP_GRVPTEOQ6D4B7FLZFYNJ_R0k5NjZCQjFDUzdaQjEzWUJUTko5NU9WQkpMWTIxRjUzNUtHTTdM.jpg&instId=&type=open&process=image/resize,m_fill,w_200,h_200,limit_0/quality,q_80","downloadUrl":"/o/GI966BB1CS7ZB13YBTNJ95OVBJLY22F535KGM8L?appType=APP_GRVPTEOQ6D4B7FLZFYNJ&fileName=APP_GRVPTEOQ6D4B7FLZFYNJ_R0k5NjZCQjFDUzdaQjEzWUJUTko5NU9WQkpMWTIxRjUzNUtHTTdM.jpg&instId=&type=download","size":302294,"url":"/o/GI966BB1CS7ZB13YBTNJ95OVBJLY22F535KGM8L?appType=APP_GRVPTEOQ6D4B7FLZFYNJ&fileName=APP_GRVPTEOQ6D4B7FLZFYNJ_R0k5NjZCQjFDUzdaQjEzWUJUTko5NU9WQkpMWTIxRjUzNUtHTTdM.jpg&instId=&type=download","fileUuid":"APP_GRVPTEOQ6D4B7FLZFYNJ_R0k5NjZCQjFDUzdaQjEzWUJUTko5NU9WQkpMWTIxRjUzNUtHTTdM.jpg"}]}},
        {"componentName":"AttachmentField","fieldId":"attachmentField_lxv44osk","label":"社保/在职证明","fieldData":{"value":[{"name":"在职证明+-+贾文选.pdf","previewUrl":"/dingtalk/mobile/APP_GRVPTEOQ6D4B7FLZFYNJ/inst/preview?appType=APP_GRVPTEOQ6D4B7FLZFYNJ&fileName=APP_GRVPTEOQ6D4B7FLZFYNJ_NENCNjY3NzFCOThaNEZMVkFaRkxaNkxNWEQ5MjJLTDczNUtHTThI.pdf&fileSize=35594&downloadUrl=APP_GRVPTEOQ6D4B7FLZFYNJ_NENCNjY3NzFCOThaNEZMVkFaRkxaNkxNWEQ5MjJLTDczNUtHTThI.pdf","downloadUrl":"/o/4CB66771B98Z4FLVAZFLZ6LMXD922KL735KGM9H?appType=APP_GRVPTEOQ6D4B7FLZFYNJ&fileName=APP_GRVPTEOQ6D4B7FLZFYNJ_NENCNjY3NzFCOThaNEZMVkFaRkxaNkxNWEQ5MjJLTDczNUtHTThI.pdf&instId=&type=download","size":35594,"url":"/o/4CB66771B98Z4FLVAZFLZ6LMXD922KL735KGM9H?appType=APP_GRVPTEOQ6D4B7FLZFYNJ&fileName=APP_GRVPTEOQ6D4B7FLZFYNJ_NENCNjY3NzFCOThaNEZMVkFaRkxaNkxNWEQ5MjJLTDczNUtHTThI.pdf&instId=&type=download","fileUuid":"APP_GRVPTEOQ6D4B7FLZFYNJ_NENCNjY3NzFCOThaNEZMVkFaRkxaNkxNWEQ5MjJLTDczNUtHTThI.pdf"}]}},
        {"componentName":"AttachmentField","fieldId":"attachmentField_lxv44osn","label":"其他附件","fieldData":{"value":[]}}
    ],
    // 林呈颖
    "MTAyNDE5NDY=": [
        {"componentName":"SelectField","fieldId":"selectField_lxv44orx","label":"有效身份证件","fieldData":{"value":"台胞证","text":"台胞证"},"options":[{"defaultChecked":false,"syncLabelValue":true,"__sid":"item_lxjzgsg3","text":"台胞证","__sid__":"serial_lxjzgsg2","value":"台胞证","sid":"serial_lxjzgsg2"}]},
        {"componentName":"TextField","fieldId":"textField_lxv44ory","label":"证件号码","fieldData":{"value": decode("MTAyNDE5NDY=") }},
        {"componentName":"TextField","fieldId":"textField_lxv44orw","label":"姓名","fieldData":{"value": decode("5p6X5ZGI6aKW")}},
        {"componentName":"SelectField","fieldId":"selectField_mbyjhot6","label":"区号","fieldData":{"value":"86","text":"+86"},"options":[{"defaultChecked":true,"syncLabelValue":false,"__sid":"item_megqe4lm","text":"+86","__sid__":"serial_megqe4ll","value":"86","sid":"serial_mbyjf8gm"}]},
        {"componentName":"TextField","fieldId":"textField_lxv44orz","label":"联系方式","fieldData":{"value": decode("MTc2MjU0MjU0MzY=") }},
        {"componentName":"ImageField","fieldId":"imageField_ly9i5k5q","label":"免冠照片","fieldData":{"value":[{"name":"1000059181.jpg","previewUrl":"https://dingtalk.avaryholding.com:8443/dingplus/image/20260228/c9a52920e292641fc7140d3def86b4a8.jpg","downloadUrl":"https://dingtalk.avaryholding.com:8443/dingplus/image/20260228/c9a52920e292641fc7140d3def86b4a8.jpg","size":70234,"url":"https://dingtalk.avaryholding.com:8443/dingplus/image/20260228/c9a52920e292641fc7140d3def86b4a8.jpg"}]}},
        {"componentName":"AttachmentField","fieldId":"attachmentField_lxv44osj","label":"身份证照片","fieldData":{"value":[{"name":"mmexport1772246998289.jpg","previewUrl":"/o/VXE662B1L6532TLHHLCIT4NOWPFE2QRE8Q5MMLF1?appType=APP_GRVPTEOQ6D4B7FLZFYNJ&fileName=APP_GRVPTEOQ6D4B7FLZFYNJ_VlhFNjYyQjFMNjUzMlRMSEhMQ0lUNE5PV1BGRTJRUkU4UTVNTUtGMQ$$.jpg&instId=&type=open&process=image/resize,m_fill,w_200,h_200,limit_0/quality,q_80","downloadUrl":"/o/VXE662B1L6532TLHHLCIT4NOWPFE2QRE8Q5MMLF1?appType=APP_GRVPTEOQ6D4B7FLZFYNJ&fileName=APP_GRVPTEOQ6D4B7FLZFYNJ_VlhFNjYyQjFMNjUzMlRMSEhMQ0lUNE5PV1BGRTJRUkU4UTVNTUtGMQ$$.jpg&instId=&type=download","size":117050,"url":"/o/VXE662B1L6532TLHHLCIT4NOWPFE2QRE8Q5MMLF1?appType=APP_GRVPTEOQ6D4B7FLZFYNJ&fileName=APP_GRVPTEOQ6D4B7FLZFYNJ_VlhFNjYyQjFMNjUzMlRMSEhMQ0lUNE5PV1BGRTJRUkU4UTVNTUtGMQ$$.jpg&instId=&type=download","fileUuid":"APP_GRVPTEOQ6D4B7FLZFYNJ_VlhFNjYyQjFMNjUzMlRMSEhMQ0lUNE5PV1BGRTJRUkU4UTVNTUtGMQ$$.jpg"}]}},
        {"componentName":"AttachmentField","fieldId":"attachmentField_lxv44osk","label":"社保/在职证明","fieldData":{"value":[{"name":"mmexport1772246999991.png","previewUrl":"/o/E2E66S91XN73AFP8JF0QM6Z3CKHO3THJ8Q5MMY11?appType=APP_GRVPTEOQ6D4B7FLZFYNJ&fileName=APP_GRVPTEOQ6D4B7FLZFYNJ_RTJFNjZTOTFYTjczQUZQOEpGMFFNNlozQ0tITzNUSEo4UTVNTVgxMQ$$.png&instId=&type=open&process=image/resize,m_fill,w_200,h_200,limit_0/quality,q_80","downloadUrl":"/o/E2E66S91XN73AFP8JF0QM6Z3CKHO3THJ8Q5MMY11?appType=APP_GRVPTEOQ6D4B7FLZFYNJ&fileName=APP_GRVPTEOQ6D4B7FLZFYNJ_RTJFNjZTOTFYTjczQUZQOEpGMFFNNlozQ0tITzNUSEo4UTVNTVgxMQ$$.png&instId=&type=download","size":123882,"url":"/o/E2E66S91XN73AFP8JF0QM6Z3CKHO3THJ8Q5MMY11?appType=APP_GRVPTEOQ6D4B7FLZFYNJ&fileName=APP_GRVPTEOQ6D4B7FLZFYNJ_RTJFNjZTOTFYTjczQUZQOEpGMFFNNlozQ0tITzNUSEo4UTVNTVgxMQ$$.png&instId=&type=download","fileUuid":"APP_GRVPTEOQ6D4B7FLZFYNJ_RTJFNjZTOTFYTjczQUZQOEpGMFFNNlozQ0tITzNUSEo4UTVNTVgxMQ$$.png"}]}},
        {"componentName":"AttachmentField","fieldId":"attachmentField_lxv44osn","label":"其他附件","fieldData":{"value":[]}}
    ],
    // 陈宏仁
    "MDczOTM0Njc=": [
        {"componentName":"SelectField","fieldId":"selectField_lxv44orx","label":"有效身份证件","fieldData":{"value":"台胞证","text":"台胞证"},"options":[{"defaultChecked":false,"syncLabelValue":true,"__sid":"item_lxjzgsg3","text":"台胞证","__sid__":"serial_lxjzgsg2","value":"台胞证","sid":"serial_lxjzgsg2"}]},
        {"componentName":"TextField","fieldId":"textField_lxv44ory","label":"证件号码","fieldData":{"value": decode("MDczOTM0Njc=") }},
        {"componentName":"TextField","fieldId":"textField_lxv44orw","label":"姓名","fieldData":{"value": decode("6ZmI5a6P5LuB")}},
        {"componentName":"SelectField","fieldId":"selectField_mbyjhot6","label":"区号","fieldData":{"value":"86","text":"+86"},"options":[{"defaultChecked":true,"syncLabelValue":false,"__sid":"item_megqe4lm","text":"+86","__sid__":"serial_megqe4ll","value":"86","sid":"serial_mbyjf8gm"}]},
        {"componentName":"TextField","fieldId":"textField_lxv44orz","label":"联系方式","fieldData":{"value": decode("MDczOTM0Njc=") }},
        {"componentName":"ImageField","fieldId":"imageField_ly9i5k5q","label":"免冠照片","fieldData":{"value":[{"name":"1000059194.jpg","previewUrl":"https://dingtalk.avaryholding.com:8443/dingplus/image/20260228/a0d9fc25135b0d479b278702c8c39cba.jpg","downloadUrl":"https://dingtalk.avaryholding.com:8443/dingplus/image/20260228/a0d9fc25135b0d479b278702c8c39cba.jpg","size":72773,"url":"https://dingtalk.avaryholding.com:8443/dingplus/image/20260228/a0d9fc25135b0d479b278702c8c39cba.jpg"}]}},
        {"componentName":"AttachmentField","fieldId":"attachmentField_lxv44osj","label":"身份证照片","fieldData":{"value":[{"name":"mmexport1772248145582.jpg","previewUrl":"/o/A9D66CC1ZZL3GWKMGUKY84Q1VCSW3STYSQ5MMJ?appType=APP_GRVPTEOQ6D4B7FLZFYNJ&fileName=APP_GRVPTEOQ6D4B7FLZFYNJ_QTlENjZDQzFaWkwzR1dLTUdVS1k4NFExVkNTVzNTVFlTUTVNTUk$.jpg&instId=&type=open&process=image/resize,m_fill,w_200,h_200,limit_0/quality,q_80","downloadUrl":"/o/A9D66CC1ZZL3GWKMGUKY84Q1VCSW3STYSQ5MMJ?appType=APP_GRVPTEOQ6D4B7FLZFYNJ&fileName=APP_GRVPTEOQ6D4B7FLZFYNJ_QTlENjZDQzFaWkwzR1dLTUdVS1k4NFExVkNTVzNTVFlTUTVNTUk$.jpg&instId=&type=download","size":130388,"url":"/o/A9D66CC1ZZL3GWKMGUKY84Q1VCSW3STYSQ5MMJ?appType=APP_GRVPTEOQ6D4B7FLZFYNJ&fileName=APP_GRVPTEOQ6D4B7FLZFYNJ_QTlENjZDQzFaWkwzR1dLTUdVS1k4NFExVkNTVzNTVFlTUTVNTUk$.jpg&instId=&type=download","fileUuid":"APP_GRVPTEOQ6D4B7FLZFYNJ_QTlENjZDQzFaWkwzR1dLTUdVS1k4NFExVkNTVzNTVFlTUTVNTUk$.jpg"}]}},
        {"componentName":"AttachmentField","fieldId":"attachmentField_lxv44osk","label":"社保/在职证明","fieldData":{"value":[{"name":"mmexport1772246999991.png","previewUrl":"/o/BO966PC16653TY08NOOJL6931NEN38DBTQ5MM9F1?appType=APP_GRVPTEOQ6D4B7FLZFYNJ&fileName=APP_GRVPTEOQ6D4B7FLZFYNJ_Qk85NjZQQzE2NjUzVFkwOE5PT0pMNjkzMU5FTjM3REJUUTVNTThGMQ$$.png&instId=&type=open&process=image/resize,m_fill,w_200,h_200,limit_0/quality,q_80","downloadUrl":"/o/BO966PC16653TY08NOOJL6931NEN38DBTQ5MM9F1?appType=APP_GRVPTEOQ6D4B7FLZFYNJ&fileName=APP_GRVPTEOQ6D4B7FLZFYNJ_Qk85NjZQQzE2NjUzVFkwOE5PT0pMNjkzMU5FTjM3REJUUTVNTThGMQ$$.png&instId=&type=download","size":123882,"url":"/o/BO966PC16653TY08NOOJL6931NEN38DBTQ5MM9F1?appType=APP_GRVPTEOQ6D4B7FLZFYNJ&fileName=APP_GRVPTEOQ6D4B7FLZFYNJ_Qk85NjZQQzE2NjUzVFkwOE5PT0pMNjkzMU5FTjM3REJUUTVNTThGMQ$$.png&instId=&type=download","fileUuid":"APP_GRVPTEOQ6D4B7FLZFYNJ_Qk85NjZQQzE2NjUzVFkwOE5PT0pMNjkzMU5FTjM3REJUUTVNTThGMQ$$.png"}]}},
        {"componentName":"AttachmentField","fieldId":"attachmentField_lxv44osn","label":"其他附件","fieldData":{"value":[]}}
    ],
    // 窦桂阳
    "NDIyMzI2MTk5NTA0Mjg2NDEx": [
        {"componentName":"SelectField","fieldId":"selectField_lxv44orx","label":"有效身份证件","fieldData":{"value":"身份证","text":"身份证"},"options":[{"defaultChecked":false,"syncLabelValue":true,"__sid":"item_lxjzgsg1","text":"身份证","__sid__":"serial_lxjzgsg0","value":"身份证","sid":"serial_lxjzgsg0"}]},
        {"componentName":"TextField","fieldId":"textField_lxv44ory","label":"证件号码","fieldData":{"value": decode("NDIyMzI2MTk5NTA0Mjg2NDEx")}},
        {"componentName":"TextField","fieldId":"textField_lxv44orw","label":"姓名","fieldData":{"value": decode("56qm5qGC6Ziz")}},
        {"componentName":"SelectField","fieldId":"selectField_mbyjhot6","label":"区号","fieldData":{"value":"86","text":"+86"},"options":[{"defaultChecked":true,"syncLabelValue":false,"__sid":"item_megqe4lm","text":"+86","__sid__":"serial_megqe4ll","value":"86","sid":"serial_mbyjf8gm"}]},
        {"componentName":"TextField","fieldId":"textField_lxv44orz","label":"联系方式","fieldData":{"value": decode("MTc3MDcxNTM3MTA=") }},
        {"componentName":"ImageField","fieldId":"imageField_ly9i5k5q","label":"免冠照片","fieldData":{"value":[{"name":"IMG_20260322_234120.png","previewUrl":"https://dingtalk.avaryholding.com:8443/dingplus/image/20260322/ffe9d2fcefe5a1804c8121b0190d7862.png","downloadUrl":"https://dingtalk.avaryholding.com:8443/dingplus/image/20260322/ffe9d2fcefe5a1804c8121b0190d7862.png","size":132385,"url":"https://dingtalk.avaryholding.com:8443/dingplus/image/20260322/ffe9d2fcefe5a1804c8121b0190d7862.png"}]}},
        {"componentName":"AttachmentField","fieldId":"attachmentField_lxv44osj","label":"身份证照片","fieldData":{"value":[{"name":"mmexport1774193578988.jpg","previewUrl":"/o/E2E66S91LI24L1K2H2XD54ZLK87L2F7DOX1NM8C?appType=APP_GRVPTEOQ6D4B7FLZFYNJ&fileName=APP_GRVPTEOQ6D4B7FLZFYNJ_RTJFNjZTOTFMSTI0TDFLMkgyWEQ1NFpMSzg3TDJFN0RPWDFOTTdD.jpg&instId=&type=open&process=image/resize,m_fill,w_200,h_200,limit_0/quality,q_80","downloadUrl":"/o/E2E66S91LI24L1K2H2XD54ZLK87L2F7DOX1NM8C?appType=APP_GRVPTEOQ6D4B7FLZFYNJ&fileName=APP_GRVPTEOQ6D4B7FLZFYNJ_RTJFNjZTOTFMSTI0TDFLMkgyWEQ1NFpMSzg3TDJFN0RPWDFOTTdD.jpg&instId=&type=download","size":467704,"url":"/o/E2E66S91LI24L1K2H2XD54ZLK87L2F7DOX1NM8C?appType=APP_GRVPTEOQ6D4B7FLZFYNJ&fileName=APP_GRVPTEOQ6D4B7FLZFYNJ_RTJFNjZTOTFMSTI0TDFLMkgyWEQ1NFpMSzg3TDJFN0RPWDFOTTdD.jpg&instId=&type=download","fileUuid":"APP_GRVPTEOQ6D4B7FLZFYNJ_RTJFNjZTOTFMSTI0TDFLMkgyWEQ1NFpMSzg3TDJFN0RPWDFOTTdD.jpg"}]}},
        {"componentName":"AttachmentField","fieldId":"attachmentField_lxv44osk","label":"社保/在职证明","fieldData":{"value":[{"name":"在职证明 - 蔻.pdf","previewUrl":"/dingtalk/mobile/APP_GRVPTEOQ6D4B7FLZFYNJ/inst/preview?appType=APP_GRVPTEOQ6D4B7FLZFYNJ&fileName=APP_GRVPTEOQ6D4B7FLZFYNJ_TTBCNjZPQzFWUDE0TjNEQk9MNlMxNzdaT1FUMTJTMU9PWDFOTUtO.pdf&fileSize=41267&downloadUrl=APP_GRVPTEOQ6D4B7FLZFYNJ_TTBCNjZPQzFWUDE0TjNEQk9MNlMxNzdaT1FUMTJTMU9PWDFOTUtO.pdf","downloadUrl":"/o/M0B66OC1VP14N3DBOL6S177ZOQT12S1OOX1NMLN?appType=APP_GRVPTEOQ6D4B7FLZFYNJ&fileName=APP_GRVPTEOQ6D4B7FLZFYNJ_TTBCNjZPQzFWUDE0TjNEQk9MNlMxNzdaT1FUMTJTMU9PWDFOTUtO.pdf&instId=&type=download","size":41267,"url":"/o/M0B66OC1VP14N3DBOL6S177ZOQT12S1OOX1NMLN?appType=APP_GRVPTEOQ6D4B7FLZFYNJ&fileName=APP_GRVPTEOQ6D4B7FLZFYNJ_TTBCNjZPQzFWUDE0TjNEQk9MNlMxNzdaT1FUMTJTMU9PWDFOTUtO.pdf&instId=&type=download","fileUuid":"APP_GRVPTEOQ6D4B7FLZFYNJ_TTBCNjZPQzFWUDE0TjNEQk9MNlMxNzdaT1FUMTJTMU9PWDFOTUtO.pdf"}]}},
        {"componentName":"AttachmentField","fieldId":"attachmentField_lxv44osn","label":"其他附件","fieldData":{"value":[]}}
    ]
};

const FORM_BASE = [
    {"componentName":"SerialNumberField","fieldId":"serialNumberField_lxn9o9dx","label":"单号信息","fieldData":{}},
    {"componentName":"TextField","fieldId":"textField_lxn9o9e0","label":"申请类型","fieldData":{"value":"一般访客"}},
    {"componentName":"TextField","fieldId":"textField_ly2ugh3m","label":"申请人ID","fieldData":{"value":"17614625112"}},
    {"componentName":"TextField","fieldId":"textField_lydnpzas","label":"地区代码","fieldData":{"value":"QHD"}},
    {"componentName":"TextField","fieldId":"textField_ly3uw4as","label":"法人代码","fieldData":{"value":"1070"}},
    {"componentName":"TextField","fieldId":"textField_ly3uw4ar","label":"园区代码","fieldData":{"value":"QA"}},
    {"componentName":"TextField","fieldId":"textField_m2lk8mr2","label":"供应商code","fieldData":{"value":"VCN01135"}},
    {"componentName":"RadioField","fieldId":"radioField_m4g9sf7c","label":"是否外籍","fieldData":{"value":"否","text":"否"},"options":[{"defaultChecked":true,"syncLabelValue":true,"__sid":"item_m4g9skpu","text":"否","__sid__":"serial_m4g9skpu","value":"否","sid":"serial_m4g9skpu"}]},
    {"componentName":"SelectField","fieldId":"selectField_ly3o95xh","label":"到访园区","fieldData":{"value":"秦皇岛园区","text":"秦皇岛园区"},"options":[{"value":"秦皇岛园区","text":"秦皇岛园区"}]},
    {"componentName":"SelectField","fieldId":"selectField_ly3o95xf","label":"到访公司","fieldData":{"value":"宏启胜精密电子(秦皇岛)有限公司","text":"宏启胜精密电子(秦皇岛)有限公司"},"options":[{"value":"宏启胜精密电子(秦皇岛)有限公司","text":"宏启胜精密电子(秦皇岛)有限公司"}]},
    {"componentName":"SelectField","fieldId":"selectField_lxn9o9eb","label":"身份类型","fieldData":{"value":"生产服务（厂商）","text":"生产服务（厂商）"},"options":[{"value":"生产服务（厂商）","text":"生产服务（厂商）"}]},
    {"componentName":"SelectField","fieldId":"selectField_lxn9o9ed","label":"服务性质/到访事由","fieldData":{"value":"设备维护","text":"设备维护"},"options":[{"value":"设备维护","text":"设备维护"}]},
    {"componentName":"SelectField","fieldId":"selectField_lxn9o9ei","label":"到访区域","fieldData":{"value":"进入制造现场","text":"进入车间/管制区域"},"options":[{"defaultChecked":false,"syncLabelValue":false,"__sid":"item_m56iixss","text":"进入车间/管制区域","__sid__":"serial_m56iixsp","value":"进入制造现场","sid":"serial_khe7yak4"}]},
    {"componentName":"TextareaField","fieldId":"textareaField_lxn9o9eg","label":"服务/事由描述","fieldData":{"value":"设备维护与保养"}},
    {"componentName":"SelectField","fieldId":"selectField_lxn9o9em","label":"所属公司","fieldData":{"value":"VCN01135(昆山友景电路板测试有限公司)"},"options":[]},
    {"componentName":"TextField","fieldId":"textField_lxn9o9gc","label":"所属公司/单位名称","fieldData":{"value":"VCN01135(昆山友景电路板测试有限公司)"}},
    {"componentName":"RadioField","fieldId":"radioField_lzs3fswt","label":"是否为竞商？","fieldData":{"value":"否","text":"否"},"options":[{"defaultChecked":true,"syncLabelValue":true,"__sid":"item_lzs3ftx2","text":"否","__sid__":"serial_lzs3ftx2","value":"否","sid":"serial_lzs3ftx2"}]}
];

const FORM_TAIL = [
    {"componentName":"TextField","fieldId":"textField_lxn9o9f9","label":"接待人工号","fieldData":{"value":"61990794"}},
    {"componentName":"TextField","fieldId":"textField_lxn9o9f7","label":"接待人员","fieldData":{"value":"王晗"}},
    {"componentName":"TextField","fieldId":"textField_lxn9o9fc","label":"接待部门","fieldData":{"value":"QA08設備五課"}},
    {"componentName":"TextField","fieldId":"textField_lxn9o9fe","label":"接待人联系方式","fieldData":{"value":"17531114022"}},
    {"componentName":"TextField","fieldId":"textField_m4c5a419","label":"涉外签核","fieldData":{"value":"61990414"}},
    {"componentName":"TextField","fieldId":"textField_m4c5a41a","label":"门岗保安","fieldData":{"value":"15232353238"}}
];

const A08_TEMPLATE = [];
FORM_BASE.forEach(item => A08_TEMPLATE.push({ type: 'STATIC', item }));
A08_TEMPLATE.push({ type: 'INJECT_TABLE' });
FORM_TAIL.slice(0, 4).forEach(item => A08_TEMPLATE.push({ type: 'STATIC', item }));
A08_TEMPLATE.push({ 
    type: 'INJECT_DATE_TS', 
    template: {
        "componentName": "DateField",
        "fieldId": "dateField_lxn9o9fh",
        "label": "到访日期",
        "fieldData": { "value": 0 },
        "format": "yyyy-MM-dd"
    }
});
FORM_TAIL.slice(4).forEach(item => A08_TEMPLATE.push({ type: 'STATIC', item }));

// ==========================================
// Q01 自动化深度克隆解析区 (严格一致性保证)
// ==========================================
let Q01_PERSON_DB = {};
let Q01_ORIGINAL_ORDER = {}; // 核心：记录 bin 文件中的原生人物顺序
let Q01_TEMPLATE_JSON = null; // 核心：整个 JSON 树直接深拷贝
let Q01_URL_PARAMS = null;    // 核心：保存所有的外层发包参数

try {
    const binPath = path.join(__dirname, 'QA01_request_body.bin');
    if (fs.existsSync(binPath)) {
        const rawContent = fs.readFileSync(binPath, 'utf-8');
        Q01_URL_PARAMS = new URLSearchParams(rawContent);
        
        const valueStr = Q01_URL_PARAMS.get('value');
        if (valueStr) {
            Q01_TEMPLATE_JSON = JSON.parse(valueStr);
            
            Q01_TEMPLATE_JSON.forEach(item => {
                if (item.componentName === 'TableField' && item.label && item.label.includes('人员')) {
                    const peopleArrays = item.fieldData.value;
                    peopleArrays.forEach((personArr, index) => {
                        const idField = personArr.find(f => String(f.label).includes('证件号码'));
                        if (idField && idField.fieldData && idField.fieldData.value) {
                            const rawIdStr = String(idField.fieldData.value);
                            const base64Id = Buffer.from(rawIdStr).toString('base64');
                            Q01_PERSON_DB[base64Id] = personArr;
                            Q01_ORIGINAL_ORDER[base64Id] = index; // 【关键】锁死他们在抓包里的原生顺序！
                        }
                    });
                }
            });
            console.log(`✅ QA01_request_body.bin 解析成功，提取 ${Object.keys(Q01_PERSON_DB).length} 个人员原生配置`);
        }
    } else {
        console.warn("⚠️ 找不到 QA01_request_body.bin 文件，Q01 厂区组包功能将不可用！");
    }
} catch (e) {
    console.error("❌ 解析 QA01_request_body.bin 失败:", e.message);
}

// 辅助函数
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const getBeijingDayId = (ts) => Math.floor((parseInt(ts) + 28800000) / 86400000);
const getFormattedDate = (ts) => {
    const date = new Date(parseInt(ts) + 28800000);
    return date.toISOString().split('T')[0];
};

// ==========================================
// 全局总枢纽配置 (🌟 解决账号跨区报错的核心区域)
// ==========================================
const LOC_CONFIGS = {
    'A08': {
        // A08 的门禁阈值
        renewThreshold: 2, 
        renewDays: 7,
        title: "A08 厂区",
        enabled: true,

        // 👇 A08 账号身份凭证 (原封不动)
        csrf_token: "e7daa879-7b83-40f7-8335-1a262747f2c9",
        cookie: "tianshu_corp_user=ding2b4c83bec54a29c6f2c783f7214b6d69_FREEUSER; tianshu_csrf_token=e7daa879-7b83-40f7-8335-1a262747f2c9; c_csrf=e7daa879-7b83-40f7-8335-1a262747f2c9; cookie_visitor_id=zfGITZnn; cna=QhOGIdjbQ3ABASQOBEFsQ0YG; xlly_s=1; tianshu_app_type=APP_GRVPTEOQ6D4B7FLZFYNJ; JSESSIONID=BF2C6304A367F22183E99C3E5B5181C4; tfstk=gOZxf6D0ah_YmbR2H5blSie9vWyOMa2qeSyBjfcD57F8iJ8615qgycFzMIcmSS4-67N-GjmfQ1Fun54imlewXAw__tlG3a243co1t6qOx-yqEsPFbo36NgwrKxT1rqiRmR_At6jhqZ9SXsC3nq6jmbMZNxMXlE6-VAH6fcgjG36-CAAX5jN_FThrQAOXfhG5VAkB5ci_186-QbGsfqN_FTHZNf91kGhG5b-Tu6E2PQTVe3t72x3x1HG9XDqyxFGLhbtMyWMxkt2jwht_4PdnXxc1VBhaV5nIku6MWXnrwAHYDOYE_yDTCvnBhny8G7ZKRufyjfsyqkqd5-AnU0LfeTLw7qMrh42tpxCQDiM-tTfH7FuY8YhheTLw7qMreXXrUF8Zky5..; isg=BJCQbJGPzSIDPJDoHxPbfgneatziWXSjkwUE44pgG-BuxflvPmhTMY7zmMuAWSx7",
        // 🔪 新增：明确 A08 厂区大部队的常规接待人 (用于精准过滤普通组记录)
        normalReceptionistId: "61990794", // 王晗的工号
        query: {
            visitorIdNos: [
                "MTMwMzIzMTk4NjAyMjgwODFY",  //康
                "MTMwMzIyMTk4ODA2MjQyMDE4", //张
                "MjMwMjMwMjAwMzAxMDEyMTM1", //孙
                "MTMxMTIxMTk4OTAxMDU1MDEx",  //王
                // "NDEwNDIzMTk4OTA3MjIxNTMw", //田
                // "NDMyOTAxMTk4MjExMDUyMDE2", //兰（凌嘉）
                // "NDEwOTIzMTk4ODA3MTkxMDFY", //卞（凌嘉）
                // "MDMwNzE3Njg", //贾
                "MTMwNDI1MTk4OTA4MjkwMzE0", //姜
                // "MTAyNDE5NDY=", //林
                // "MDczOTM0Njc=", //陈
                "NDIyMzI2MTk5NTA0Mjg2NDEx" // 窦
            ],
            regPerson: "17614625112",
            acToken: "E5EF067A42A792436902EB275DCCA379812FF4A4A8A756BE0A1659704557309F",
            queryUrl: "https://dingtalk.avaryholding.com:8443/dingplus/visitorConnector/visitorStatus"
        },
        personDb: PERSON_DB,
        
        // 【新增功能】：支持在这里配置专属的接待人信息
        customReceptionists: {
            // 康伟强
            "MTMwMzIzMTk4NjAyMjgwODFY": {
                receptionistId: "A2449801",
                receptionistName: "龚旭明",
                receptionDepartment: "QA01設備五課",
                receptionistPhone: "17703340319",
                visitReason: "设备维护与保养",
                keepNormal: true,             // 🌟 核心：设为 true，系统就会为他发一份指定的包，再跟大部队发一份原始包！
                renewThreshold: 1,            // 独立：剩2天时触发专属包
                renewDays: 2                  // 独立：一次续2天
            },
            // 张强
            "MTMwMzIyMTk4ODA2MjQyMDE4": {
                receptionistId: "A2449801",
                receptionistName: "龚旭明",
                receptionDepartment: "QA01設備五課",
                receptionistPhone: "17703340319",
                visitReason: "设备维护与保养",
                keepNormal: true,           // 🌟 核心：设为 true，同样双开！
                renewThreshold: 1,            // 独立：剩2天时触发专属包
                renewDays: 2               // 独立：一次续2天
            },
            //  姜建龙
            "MTMwNDI1MTk4OTA4MjkwMzE0": {
                receptionistId: "A2449801",
                receptionistName: "龚旭明",
                receptionDepartment: "QA01設備五課",
                receptionistPhone: "17703340319",
                visitReason: "设备维护与保养",
                keepNormal: false,           // 🌟 核心：设为 true，同样双开！
                renewThreshold: 1,            // 独立：剩2天时触发专属包
                renewDays: 2                  // 独立：一次续2天
            },
            // 王菁
            // "MTMxMTIxMTk4OTAxMDU1MDEx": {
            //     receptionistId: "A2449801",
            //     receptionistName: "龚旭明",
            //     receptionDepartment: "QA01設備五課",
            //     receptionistPhone: "17703340319",
            //     visitReason: "设备维护与保养",
            //     keepNormal: true,           // 🌟 核心：设为 true，同样双开！
            //     renewThreshold: 2,            // 独立：剩2天时触发专属包
            //     renewDays: 2                  // 独立：一次续2天
            // },
            //  孙德凯
            "MjMwMjMwMjAwMzAxMDEyMTM1": {
                receptionistId: "A2449801",
                receptionistName: "龚旭明",
                receptionDepartment: "QA01設備五課",
                receptionistPhone: "17703340319",
                visitReason: "设备维护与保养",
                keepNormal: true,           // 🌟 核心：设为 true，同样双开！
                renewThreshold: 1,            // 独立：剩2天时触发专属包
                renewDays: 2                  // 独立：一次续2天
            },
            
        },

        // A08 的独立老组包逻辑 (已加入指定接待人合并支持)
        buildPayload: (idsBase64, targetTs, locConfig, customConfig = null) => {
            const tableRows = idsBase64.map(id => locConfig.personDb[id]).filter(Boolean);
            const finalForm = [];
            
            A08_TEMPLATE.forEach(block => {
                if (block.type === 'STATIC') {
                    // 修复：必须进行深拷贝，否则会污染内存里的全局模板
                    finalForm.push(JSON.parse(JSON.stringify(block.item)));
                } else if (block.type === 'INJECT_TABLE') {
                    finalForm.push({
                        "componentName": "TableField", "fieldId": "tableField_lxv44os5",
                        "label": "人员信息", "fieldData": { "value": tableRows }, "listNum": 50
                    });
                } else if (block.type === 'INJECT_DATE_TS') {
                    finalForm.push({ ...block.template, fieldData: { value: targetTs } });
                }
            });

            // 👇 【新增】如果传入了指定接待人配置，拦截并覆写 A08 的外层表单参数
            if (customConfig) {
                finalForm.forEach(item => {
                    if (item.label && String(item.label).includes('接待人工号') && customConfig.receptionistId) item.fieldData.value = customConfig.receptionistId;
                    else if (item.label && String(item.label).includes('接待人员') && customConfig.receptionistName) item.fieldData.value = customConfig.receptionistName;
                    else if (item.label && String(item.label).includes('接待部门') && customConfig.receptionDepartment) item.fieldData.value = customConfig.receptionDepartment;
                    else if (item.label && String(item.label).includes('接待人联系方式') && customConfig.receptionistPhone) item.fieldData.value = customConfig.receptionistPhone;
                    else if (item.label && String(item.label).includes('服务/事由描述') && customConfig.visitReason) item.fieldData.value = customConfig.visitReason;
                });
            }

            const jsonStr = JSON.stringify(finalForm, null, 2);
            // 👇 强制绑定该账号独有的 Token
            const _token = locConfig.csrf_token || 'e7daa879-7b83-40f7-8335-1a262747f2c9';
            const fullPostBody = `_csrf_token=${_token}&formUuid=FORM-2768FF7B2C0D4A0AB692FD28DBA09FD57IHQ&appType=APP_GRVPTEOQ6D4B7FLZFYNJ&value=${encodeURIComponent(JSON.stringify(finalForm))}&_schemaVersion=653`;
            return { jsonStr, fullPostBody };
        }
    },
    'Q01': {
        title: "Q01 厂区",
        // Q01 的门禁阈值
        renewThreshold: 2, 
        renewDays: 7,
        enabled: true,

        // 👇【修复点】独立账号配置，解决 API 报错
        csrf_token: "5581e41f-8c38-48d4-bea4-20d1f96af4db",
        cookie: "tianshu_corp_user=ding2b4c83bec54a29c6f2c783f7214b6d69_FREEUSER; tianshu_csrf_token=5581e41f-8c38-48d4-bea4-20d1f96af4db; c_csrf=5581e41f-8c38-48d4-bea4-20d1f96af4db; cookie_visitor_id=o5TLBWJ6; cna=KDksIgUMMBsCARuACb+fM//A; xlly_s=1; tianshu_app_type=APP_GRVPTEOQ6D4B7FLZFYNJ; JSESSIONID=5BF894CE5AFD8107A9C6124F8753BEB5; tfstk=gTlIf86UsykasoYp2M8NcrQKR6PevFR2Vaa-o4CFyWFpNgUbJ7orypYWNqngzWuJx0G7XcqKUDRHw8ijx0wk-ur8V0u-LFR2g203Z7nW0IRVHeDw8DaRwzLR6yzk7ypCdudzZ7K2bO58KINoAceYPk395zzz2un8eVCT-lU827n8XRUYuMF8w0L_6zzlJwUdwPBT8lE8w7n-WFauXyF8w0395zv_rtaGPouBPqRW4aBBtvE1w_h_5nNKRi1Lo34UdogUuOXi1i2QD2E1aHjKKrrQkjKNKrwIJjNE_HpZRlHKwWlpb_ijfxFswR7JVyHKlj2mwhsr4srb5yX5EkC75o865TXlaj5nMewO5_eLSPzw5F6rtJUg5o865TXupP4i3FT1UXf..; isg=BOzsBAulqRjsL70mvTB0y-TYtsgepZBPSDBScUYpsid4UGNbQrR-3bOndF_PIcin",

        // 🔪 新增：明确Q01 厂区大部队的常规接待人 (用于精准过滤普通组记录)
        // normalReceptionistId: "61990794", // 王晗的工号

        // Q01 全局通用接待人配置 (未指定专属接待人的人员将默认使用这个)
        // receptionistId: "82100751",    // 工号
        // receptionistName: "张宏敏",       // 姓名
        // receptionDepartment:"P2電測檢驗組",  //接待部门
        // receptionistPhone:"18733454885",  //接待人联系方式
        // visitReason: "治具调试",     // 事由描述

        // 【新增功能】：支持在这里配置专属的接待人信息
        customReceptionists: {
            // 示例：给某个身份证指定一个专用的接待人：
            // "MTMwMzIzMTk5MjEyMTY2NDM0": {
            //     receptionistId: "12345678",
            //     receptionistName: "专属张宏敏",
            //     receptionDepartment: "P2特殊测试组",
            //     receptionistPhone: "13888888888",
            //     visitReason: "特殊机台维护",
            //     keepNormal: true
            // }
        },

        query: {
            visitorIdNos: [
                // "MTMwMzIzMTk5MjEyMTY2NDM0",  //张江路
                // "MTMwMzIzMTk5ODA2MTQxMDU4", //刘宏飞
                // "MTMwMzIzMTk5MDAzMDc2NDE2", //张江宽
                // "MTMwMzIzMTk4OTA5MDQ2NDEx", //付海超
                "MDU4NDMzNDg=", //张道玄
                "MTIwNDUxOTI=", //张乃文
                "SzEzOTMxMihBKQ==", //陈毅鸿
                // "NDMxMjIyMTk5NzEyMDUzMzEz", //向林  
                "NTIyNzMxMjAwMDAxMTAzNjEx", //王煊廷
                "MTMwMzIxMjAwMjA0MTY2MjE4", //邵相辉 
                // "NDUwMjIxMTk4OTA0MDUyNDNY", //曾静 
                // "NDIxMTgxMTk5MDAxMTc2MzFY", //余新旺 
                // "NDQwOTgyMTk5NzEwMDgyNTk3", //周勇驰 
                "NDExNTI0MjAwNTEyMTA3NjU2", //杨瑞 
                // "MDg5NjQ3MzI=", //赖彦翔 
                // "MDYyNDg5MDE=", //马可为
                "WjkwOTQwMSg3KQ==", //冼延浩 (新)
                "NDQxNDgxMTk4ODAzMTYwODky", //张远彬 (新)
                "MDcyMjg1Nzc=", //朱会民 (新)
                // "NTMyNDY5ODc0" //Denis Gerassimenko
                "NDIyMzI2MTk5NTA0Mjg2NDEx" //竇桂陽
            ],
            regPerson: "15032325162",
            acToken: "53F44A99C6D8AADE22942CD9E1D803E8812FF4A4A8A756BE0A1659704557309F",
            queryUrl: "https://dingtalk.avaryholding.com:8443/dingplus/visitorConnector/visitorStatus"
        },
        personDb: Q01_PERSON_DB,
        
        // Q01 专有完美克隆组包逻辑 (加入了独立接待人支持)
        buildPayload: (idsBase64, targetTs, locConfig, customConfig = null) => {
            if (!Q01_TEMPLATE_JSON || !Q01_URL_PARAMS) throw new Error("QA01 模板未成功加载，无法生成合法报文！");

            const dateStr = getFormattedDate(targetTs);

            // 1. 严格排序
            const sortedIds = [...idsBase64].sort((a, b) => {
                const indexA = Q01_ORIGINAL_ORDER[a] ?? 999;
                const indexB = Q01_ORIGINAL_ORDER[b] ?? 999;
                return indexA - indexB;
            });
            const finalTable = sortedIds.map(id => locConfig.personDb[id]).filter(Boolean);

            // 2. 深度克隆抓包来的原生 JSON 树
            const finalForm = JSON.parse(JSON.stringify(Q01_TEMPLATE_JSON));

            // 获取要注入的接待人信息：优先使用传入的指定配置(customConfig)，若无则降级使用全厂区通用配置
            const recId = customConfig ? customConfig.receptionistId : locConfig.receptionistId;
            const recName = customConfig ? customConfig.receptionistName : locConfig.receptionistName;
            const recDept = customConfig ? customConfig.receptionDepartment : locConfig.receptionDepartment;
            const recPhone = customConfig ? customConfig.receptionistPhone : locConfig.receptionistPhone;
            const vReason = customConfig ? customConfig.visitReason : locConfig.visitReason;

            // 3. 精准注入更新的数据
            finalForm.forEach(item => {
                if (item.componentName === 'TableField' && item.label && item.label.includes('人员')) {
                    item.fieldData.value = finalTable;
                } else if (item.componentName === 'DateField' && String(item.label).includes('日期')) {
                    item.fieldData.value = targetTs;
                } else if (item.componentName === 'TextField' && String(item.label).includes('日期')) {
                    item.fieldData.value = dateStr;
                }
                // 拦截并替换 QA01 的接待人信息
                else if (item.label && String(item.label).includes('接待人工号') && recId) {
                    item.fieldData.value = recId;
                } else if (item.label && String(item.label).includes('接待人员') && recName) {
                    item.fieldData.value = recName;
                } else if (item.label && String(item.label).includes('服务/事由描述') && vReason) {
                    item.fieldData.value = vReason;
                } else if (item.label && String(item.label).includes('接待部门') && recDept) {
                    item.fieldData.value = recDept;
                }else if (item.label && String(item.label).includes('接待人联系方式') && recPhone) {
                    item.fieldData.value = recPhone;
                }
            });

            // 4. 重建 URL Encoded 发包主体
            const parts = [];
            for (const [key, val] of Q01_URL_PARAMS.entries()) {
                if (key === 'value') {
                    parts.push(`${key}=${encodeURIComponent(JSON.stringify(finalForm)).replace(/%20/g, '+')}`);
                } else if (key === '_csrf_token' && locConfig.csrf_token) {
                    // 👇 强制覆盖为本账号对应的 Token
                    parts.push(`${key}=${encodeURIComponent(locConfig.csrf_token)}`); 
                } else {
                    parts.push(`${key}=${encodeURIComponent(val)}`); 
                }
            }

            return {
                jsonStr: JSON.stringify(finalForm, null, 2),
                fullPostBody: parts.join('&')
            };
        }
    }
};

// --- 后端 API 逻辑 ---

const checkSingleStatus = async (id, queryConfig) => {
    const idMask = id.substring(0, 4) + "****" + id.substring(id.length - 4);
    let result = { id, success: false, hasData: false, records: [] };

    try {
        const res = await axios.post(queryConfig.queryUrl, {
            visitorIdNo: id,
            regPerson: queryConfig.regPerson,
            acToken: queryConfig.acToken
        });
        
        if (res.data && res.data.code === 200) {
            result.success = true;
            if (res.data.data && Array.isArray(res.data.data)) {
                result.records = res.data.data;
                if (result.records.length > 0) result.hasData = true;
            }
        } else {
            const errCode = res.data ? res.data.code : 'UNKNOWN';
            console.error(`   [${idMask}] API错误: Code ${errCode}`);
        }
    } catch (e) {
        console.error(`   [${idMask}] 网络/请求出错: ${e.message}`);
    }
    return result;
};

const getAllStatuses = async (queryConfig) => {
    const statusMap = {};
    const decodedIds = queryConfig.visitorIdNos.map(id => decode(id));
    
    const promises = [];
    for (const id of decodedIds) {
        promises.push(checkSingleStatus(id, queryConfig));
        await delay(80);
    }

    const results = await Promise.all(promises);
    const stats = { total: decodedIds.length, success: 0, error: 0, hasData: 0, noData: 0 };

    results.forEach(r => {
        statusMap[r.id] = r.records || [];
        if (r.success) {
            stats.success++;
            if (r.hasData) stats.hasData++;
            else stats.noData++;
        } else {
            stats.error++;
        }
    });
    return { statusMap, stats };
};

// 🌟 严谨铁壁熔断机制
// 🌟 魔鬼级“一触即死”铁壁熔断机制 (宁可错杀，绝不放过)
const checkSafeToRun = (stats) => {
    // 1. 只要有 1 个人查询失败（网络崩溃、Token失效等），全员连坐锁死！(原有机制保留)
    if (stats.error > 0) {
        return { safe: false, reason: `【连坐熔断】请求报错或Cookie失效 (共失败 ${stats.error} 人)` };
    }
    
    // 2. 无配置人员，直接跳过
    if (stats.total === 0) {
        return { safe: false, reason: "配置名单为空，无需运行" };
    }
    
    // 3. 🔪 新增的魔鬼限制：只要有 1 个人查不到记录（没有时间），立刻全部锁死！
    if (stats.noData > 0) {
        return { safe: false, reason: `【连坐熔断】发现 ${stats.noData} 人没有任何历史入厂记录/时间！已触发一票否决，全厂区停止自动续期！` };
    }
    
    // 如果能活到这里，说明所有人既没有报错，又都有历史记录，安全放行！
    return { safe: true, reason: "状态完美正常" };
};

// 👇 传入了 locConfig 以提取它对应的专属 Cookie
const submitApplication = async (reqTask, locConfig) => {
    const { targetDate, people, encodedBody } = reqTask;
    
    // 👇 组装带有该厂区专属身份校验的请求头
    const reqHeaders = { ...GLOBAL_HEADERS };
    if (locConfig.cookie) {
        reqHeaders.cookie = locConfig.cookie;
    }

    try {
        const url = "https://iw68lh.aliwork.com/o/HW9663A19D6M1QDL6D7GNAO1L2ZC2NBXQHOXL3?_api=nattyFetch&_mock=false&_stamp=" + Date.now();
        const res = await axios.post(url, encodedBody, { headers: reqHeaders });
        
        if (res.data && res.data.success === true) {
            const formInstId = res.data.content ? res.data.content.formInstId : "未知ID";
            return { success: true, date: targetDate, names: people, id: formInstId };
        } else {
            // 👇 BUG终结者：极度详细的错误日志
            const errorMsg = JSON.stringify(res.data);
            return { success: false, date: targetDate, names: people, msg: `API拒绝请求: ${errorMsg}` };
        }
    } catch (e) {
        return { success: false, date: targetDate, names: people, msg: `网络或代码崩溃: ${e.message}` };
    }
};

const calculatePlan = (idStatusMap, locConfig) => {
    const nowMs = Date.now();
    const todayObj = new Date(nowMs + 28800000);
    todayObj.setUTCHours(0, 0, 0, 0);
    const todayStartTs = todayObj.getTime() - 28800000;
    const todayId = getBeijingDayId(nowMs);

    const virtualUsers = [];
    let globalMaxEndTs = 0; 
    let minEndTs = Infinity; 
    const summary = [];

    // 1. 第一遍循环：解析所有人的历史记录，填充 virtualUsers (这里就是之前被不小心删掉的部分)
    for (const [id, records] of Object.entries(idStatusMap)) {
        const idBase64 = Buffer.from(id).toString('base64');
        const personInfo = locConfig.personDb[idBase64];
        
        if (!personInfo) {
            console.warn(`[Warn] 找不到人员详细数据 (ID Base64: ${idBase64})，跳过。`);
            continue; 
        }

        const nameField = personInfo.find(f => f.label === '姓名');
        const name = nameField && nameField.fieldData ? nameField.fieldData.value : "未知";
        
        const customConf = locConfig.customReceptionists && locConfig.customReceptionists[idBase64];
        const trackNormal = !customConf || customConf.keepNormal; // 是否需要发普通单
        const trackCustom = !!customConf;                         // 是否需要发专属单

        const getMaxEnd = (filterFn) => {
            let max = 0;
            records.forEach(r => {
                if (filterFn(r)) {
                    const end = parseInt(r.dateEnd || r.rangeEnd);
                    if (end > max) max = end;
                }
            });
            return max;
        };

        // 处理普通轨迹：严格只认大部队统帅的记录！
        if (trackNormal) {
            const maxEndTs = getMaxEnd(r => {
                if (locConfig.normalReceptionistId) {
                    return r.rPerson === locConfig.normalReceptionistId;
                }
                return !customConf || r.rPerson !== customConf.receptionistId; 
            });
            virtualUsers.push({ idBase64, type: 'normal', maxEndTs, customConf: null, name });
        }

        // 处理专属轨迹 (只查挂在专属工号下的记录)
        if (trackCustom) {
            const maxEndTs = getMaxEnd(r => r.rPerson === customConf.receptionistId);
            virtualUsers.push({ idBase64, type: 'custom', maxEndTs, customConf, name: name + " ⭐" });
        }
    }

    // 👇 【大部队追赶机制核心算法】 👇
    const normalUsers = virtualUsers.filter(vu => vu.type === 'normal');
    let normalMaxCurrent = Math.max(...normalUsers.map(vu => vu.maxEndTs));
    if (!isFinite(normalMaxCurrent) || normalMaxCurrent < todayStartTs - 86400000) {
        normalMaxCurrent = todayStartTs - 86400000;
    }
    
    const normalThreshold = locConfig.renewThreshold !== undefined ? locConfig.renewThreshold : 2;
    const normalAddDays = locConfig.renewDays !== undefined ? locConfig.renewDays : 7;
    const normalLeaderDiff = getBeijingDayId(normalMaxCurrent) - todayId;
    
    let normalGroupTarget = normalMaxCurrent;
    if (normalMaxCurrent === 0 || normalLeaderDiff < 0 || normalLeaderDiff <= normalThreshold) {
        normalGroupTarget = Math.max(normalMaxCurrent, todayStartTs) + (normalAddDays * 86400000);
    }
    // 👆 新增结束 👆

    // 2. 第二遍循环：构建界面信息，并确定每个人的个人目标边界 targetEndTs
    virtualUsers.forEach(vu => {
        let currentEndTs = vu.maxEndTs;
        if (currentEndTs < todayStartTs) currentEndTs = todayStartTs - 86400000;

        if (currentEndTs > globalMaxEndTs) globalMaxEndTs = currentEndTs;
        if (currentEndTs < minEndTs) minEndTs = currentEndTs;

        const lastDayId = getBeijingDayId(currentEndTs);
        const diff = lastDayId - todayId;
        
        const threshold = vu.customConf && vu.customConf.renewThreshold !== undefined ? vu.customConf.renewThreshold : (locConfig.renewThreshold !== undefined ? locConfig.renewThreshold : 2);
        const addDays = vu.customConf && vu.customConf.renewDays !== undefined ? vu.customConf.renewDays : (locConfig.renewDays !== undefined ? locConfig.renewDays : 7);

        let statusText = `正常 (剩 ${diff} 天)`;
        let statusClass = "success";
        let needRenew = false;

        if (vu.maxEndTs === 0) { 
            statusText = "无记录 (需补齐)"; 
            statusClass = "expired"; 
            needRenew = true;
        } 
        else if (diff < 0) { 
            statusText = `已过期 ${Math.abs(diff)} 天`; 
            statusClass = "expired"; 
            needRenew = true;
        } 
        else if (diff <= threshold) { 
            statusText = `即将过期 (剩 ${diff} 天)`; 
            statusClass = "warning"; 
            needRenew = true;
        }

        if (vu.type === 'custom') {
            statusText += ` [专属接待: ${vu.customConf.receptionistName}${vu.customConf.keepNormal ? ' ➕ 双开大单' : ''}] (规则: <=${threshold}天续${addDays}天)`;
        }

        const rawId = decode(vu.idBase64);
        const idMask = rawId.substring(0, 4) + "****" + rawId.substring(rawId.length - 4);

        summary.push({
            name: vu.name,
            idMask: idMask,
            lastDate: vu.maxEndTs === 0 ? "无记录" : getFormattedDate(vu.maxEndTs),
            status: statusText,
            class: statusClass
        });
        
        vu.currentEndTs = currentEndTs;
        const baseLineTs = Math.max(currentEndTs, todayStartTs);
        
        // 🎯 【强制追赶对齐机制】
        if (vu.type === 'normal') {
            vu.targetEndTs = Math.max(currentEndTs, normalGroupTarget);
        } else {
            vu.targetEndTs = needRenew ? baseLineTs + (addDays * 86400000) : currentEndTs;
        }
    });

    let globalTargetTs = Math.max(...virtualUsers.map(vu => vu.targetEndTs));
    if (globalTargetTs < todayStartTs || !isFinite(globalTargetTs)) globalTargetTs = todayStartTs;

    const requests = [];
    let cursorTs = Math.max(minEndTs + 86400000, todayStartTs);
    if (!isFinite(cursorTs)) cursorTs = todayStartTs;
    let dayCount = 1;

    // 3. 核心拆包：把当天需要续期的人，按指定的接待人进行全自动拼车合并
    while (cursorTs <= globalTargetTs) {
        const todaysVirtuals = virtualUsers.filter(vu => vu.currentEndTs < cursorTs && cursorTs <= vu.targetEndTs);
        
        if (todaysVirtuals.length > 0) {
            const normalGroup = [];
            const specialGroupsMap = {}; 

            todaysVirtuals.forEach(vu => {
                if (vu.type === 'normal') {
                    normalGroup.push(vu);
                } else {
                    const recId = vu.customConf.receptionistId || 'unknown';
                    if (!specialGroupsMap[recId]) specialGroupsMap[recId] = [];
                    specialGroupsMap[recId].push(vu);
                }
            });

            const pushRequest = (vuGroup, isCustom) => {
                if (vuGroup.length === 0) return;
                
                const idsBase64 = vuGroup.map(v => v.idBase64);
                const names = vuGroup.map(v => v.name);
                const customConf = isCustom ? vuGroup[0].customConf : null;

                const { jsonStr, fullPostBody } = locConfig.buildPayload(idsBase64, cursorTs, locConfig, customConf);

                let displayPeople = names.join(", ");
                if (isCustom && customConf && customConf.receptionistName) {
                    displayPeople += ` (🚀 独立专单 -> 接待人: ${customConf.receptionistName})`;
                }

                requests.push({
                    ts: cursorTs,
                    dayIndex: dayCount++,
                    targetDate: getFormattedDate(cursorTs),
                    people: displayPeople,
                    rawJson: jsonStr,
                    encodedBody: fullPostBody
                });
            };

            pushRequest(normalGroup, false);
            
            Object.values(specialGroupsMap).forEach(sgGroup => {
                pushRequest(sgGroup, true);
            });
        }
        cursorTs += 86400000;
    }

    return { summary, requests, targetDate: getFormattedDate(globalTargetTs) };
};

// ==========================================
// 路由接口区域
// ==========================================

router.post('/generate-payload', express.json(), (req, res) => {
    // 1. 接收前端传来的范围时间戳 (startTs, endTs)
    const { loc, ids, startTs, endTs } = req.body;
    const locConfig = LOC_CONFIGS[loc];
    if (!locConfig) return res.json({ error: "厂区配置错误" });
    
    try {
        const normalGroup = [];
        const specialGroupsMap = {};

        ids.forEach(idBase64 => {
            const personInfo = locConfig.personDb[idBase64];
            if (!personInfo) return;
            
            const nameField = personInfo.find(f => f.label === '姓名');
            const name = nameField && nameField.fieldData ? nameField.fieldData.value : idBase64;
            
            const customConf = locConfig.customReceptionists && locConfig.customReceptionists[idBase64];
            const trackNormal = !customConf || customConf.keepNormal; 
            const trackCustom = !!customConf;                         

            if (trackNormal) {
                normalGroup.push({ idBase64, name, customConf: null });
            }
            if (trackCustom) {
                const recId = customConf.receptionistId || 'unknown';
                if (!specialGroupsMap[recId]) specialGroupsMap[recId] = [];
                specialGroupsMap[recId].push({ idBase64, name: name + " ⭐", customConf });
            }
        });

        const requests = [];
        let currentTs = parseInt(startTs);
        const targetEnd = parseInt(endTs);

        // 2. 按天数循环生成数据包（如果开始和结束是一天，就只循环一次）
        while (currentTs <= targetEnd) {
            const targetDateStr = getFormattedDate(currentTs);

            const pushReq = (group, isCustom) => {
                if (group.length === 0) return;
                const groupIds = group.map(g => g.idBase64);
                const names = group.map(g => g.name);
                const customConf = isCustom ? group[0].customConf : null;

                const { jsonStr, fullPostBody } = locConfig.buildPayload(groupIds, currentTs, locConfig, customConf);

                let displayPeople = names.join(", ");
                if (isCustom && customConf && customConf.receptionistName) {
                    displayPeople += ` (🚀 独立专单 -> 接待人: ${customConf.receptionistName})`;
                } else {
                    displayPeople += ` (🏢 常规大部队拼车)`;
                }

                requests.push({
                    targetDate: targetDateStr,
                    people: displayPeople,
                    rawJson: jsonStr,
                    encodedBody: fullPostBody
                });
            };

            pushReq(normalGroup, false);
            Object.values(specialGroupsMap).forEach(sg => pushReq(sg, true));
            
            currentTs += 86400000; // 递增一天
        }

        // 3. 构建包含“一键发送”按钮的 UI 头部并渲染
        let finalHtml = '';
        if (requests.length > 0) {
            finalHtml += `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; background: linear-gradient(to right, #eff6ff, #e0e7ff); padding:12px 18px; border-radius:10px; border:1px solid #bfdbfe; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
                <div style="color:#1e40af; font-size: 0.95rem;">
                    <strong style="font-size: 1.1rem;">✨ 报文就绪</strong><br>
                    共生成 <b>${requests.length}</b> 个数据包，点击右侧即可自动化批量提交
                </div>
                <button onclick="sendAllBatch(this, '${loc}')" style="background: linear-gradient(135deg, #3b82f6, #2563eb); color: white; border: none; padding: 10px 20px; border-radius: 8px; font-size: 0.95rem; font-weight: bold; cursor: pointer; box-shadow: 0 4px 6px rgba(37,99,235,0.25); transition: all 0.2s ease;">
                    🚀 一键发送全部
                </button>
            </div>
            `;
        }
        finalHtml += renderRequests(requests, loc);

        res.json({ html: finalHtml });

    } catch (e) {
        res.json({ error: "生成失败: " + e.message });
    }
});

// --- [新增] 安全手动发送接口 (后端硬核校验密码，前端无法绕过) ---
router.post('/manual-send', express.json(), async (req, res) => {
    const { loc, targetDate, people, encodedBody, pwd } = req.body;
    
    // 哼！密码写死在后端，就算愚蠢的人类把前端翻个底朝天也拿不到！
    if (pwd !== '123123') {
        return res.json({ success: false, msg: "密码错误！！！" });
    }

    const locConfig = LOC_CONFIGS[loc];
    if (!locConfig) return res.json({ success: false, msg: "厂区配置不存在！" });

    try {
        const reqTask = { targetDate, people, encodedBody };
        const result = await submitApplication(reqTask, locConfig);
        res.json(result);
    } catch (e) {
        res.json({ success: false, msg: "后端执行异常: " + e.message });
    }
});

// --- SPA 极速单页面 Debug 界面 ---
router.get('/debug', async (req, res) => {
    const locs = Object.keys(LOC_CONFIGS).filter(k => LOC_CONFIGS[k].enabled);
    if (locs.length === 0) return res.status(404).send("没有开启的厂区配置");

    try {
        const allLocData = {};
        
        const fetchPromises = locs.map(async loc => {
            const locConfig = LOC_CONFIGS[loc];
            const { statusMap: realStatusMap, stats } = await getAllStatuses(locConfig.query);
            const safetyCheck = checkSafeToRun(stats);
            const realPlan = calculatePlan(realStatusMap, locConfig);

            const simulatedStatusMap = {};
            locConfig.query.visitorIdNos.forEach(idBase64 => {
                 simulatedStatusMap[decode(idBase64)] = []; // 模拟0记录直接传空数组
            });
            const simulatedPlan = calculatePlan(simulatedStatusMap, locConfig);
            
            allLocData[loc] = { locConfig, stats, safetyCheck, realPlan, simulatedPlan };
        });

        await Promise.all(fetchPromises);

        const tabsHtml = locs.map((loc, i) => 
            `<button class="tab loc-tab ${i === 0 ? 'active' : ''}" onclick="switchLoc('${loc}', this)">🏢 ${LOC_CONFIGS[loc].title}</button>`
        ).join('');

        const contentsHtml = locs.map((loc, i) => {
            const data = allLocData[loc];
            const { locConfig, stats, safetyCheck, realPlan, simulatedPlan } = data;
            
            const safetyBadge = safetyCheck.safe 
                ? `<span style="background:#ecfdf5; color:#059669; padding:4px 8px; border-radius:4px; border:1px solid #a7f3d0; font-size:0.8rem;">✅ 安全 (Ready)</span>`
                : `<span style="background:#fef2f2; color:#dc2626; padding:4px 8px; border-radius:4px; border:1px solid #fecaca; font-size:0.8rem;">❌ 熔断 (BLOCKED)</span>`;

            let realQueueHTML = '';
            if (safetyCheck.safe) {
                realQueueHTML = `
                    <h3 style="font-size:0.9rem; margin-bottom:10px; color:#374151;">🚀 待发送队列 (${realPlan.requests.length})</h3>
                    ${renderRequests(realPlan.requests, loc)}
                `;
            } else {
                realQueueHTML = `
                    <div class="blocked-overlay">
                        <div style="font-size:1.5rem; margin-bottom:10px;">⛔</div>
                        <div style="font-weight:bold; font-size:1.1rem; margin-bottom:5px;">队列已被安全拦截</div>
                        <div style="font-size:0.85rem; opacity:0.8;">${safetyCheck.reason}<br>本次执行<b>绝对不会</b>发送任何请求。</div>
                    </div>
                `;
            }

            return `
            <div id="content-${loc}" class="loc-content ${i === 0 ? 'active' : ''}">
                <h1><span>🔧 [${locConfig.title}] 自动续期调试</span> ${safetyBadge}</h1>

                ${!safetyCheck.safe ? `<div class="error-banner">⛔ 熔断警告: ${safetyCheck.reason}</div>` : ''}

                <div class="card">
                    <h2><span>📊 实时状态 (推演至: ${realPlan.targetDate})</span></h2>
                    
                    <div class="stat-grid">
                        <div class="stat-item"><div class="stat-val">${stats.total}</div>总查询人数</div>
                        <div class="stat-item"><div class="stat-val" style="color:#059669">${stats.success}</div>接口成功</div>
                        <div class="stat-item"><div class="stat-val" style="color:#dc2626">${stats.error}</div>接口报错</div>
                        <div class="stat-item"><div class="stat-val">${stats.noData}</div>查询无记录</div>
                    </div>

                    <div class="table-wrapper">
                        <table>
                            <thead>
                                <tr><th>姓名/轨迹</th><th>有效期止</th><th>状态</th></tr>
                            </thead>
                            <tbody>
                                ${realPlan.summary.map(item => `
                                <tr>
                                    <td><strong>${item.name}</strong><br><span style="font-size:0.7rem;color:#999">${item.idMask}</span></td>
                                    <td>${item.lastDate}</td>
                                    <td><span class="status-badge ${item.class}">${item.status}</span></td>
                                </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                    
                    ${realQueueHTML}
                </div>

                <div class="card" style="border-top: 4px solid #10b981;">
                    <h2>🛠️ 自定义报文生成器</h2>
                    <div style="margin-bottom: 10px; font-size: 0.85rem; color: #4b5563;">
                        自由选择人员和日期，生成特定组合的提交报文用于测试或手动发送。
                    </div>
                    <div style="display:flex; flex-direction:column; gap:10px; margin-bottom:15px;">
                        <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                            <strong>📅 起止日期:</strong> 
                            <input type="date" id="customStartDate-${loc}" style="padding:6px; border-radius:4px; border:1px solid #ccc; flex:1; min-width:120px;">
                            <span style="color:#64748b; font-weight:bold;">至</span>
                            <input type="date" id="customEndDate-${loc}" style="padding:6px; border-radius:4px; border:1px solid #ccc; flex:1; min-width:120px;">
                        </div>
                        <div>
                            <strong>👥 选择人员:</strong>
                            <div style="display:flex; flex-wrap:wrap; gap:8px; margin-top:8px; background:#f9fafb; padding:10px; border-radius:6px; border:1px solid #e5e7eb;">
                                ${Object.keys(locConfig.personDb).map(base64Id => {
                                    const info = locConfig.personDb[base64Id];
                                    const nameField = info.find(f=>f.label==='姓名');
                                    let name = nameField && nameField.fieldData ? nameField.fieldData.value : base64Id;
                                    const isActive = locConfig.query.visitorIdNos.includes(base64Id);
                                    
                                    // 界面提示专属人员
                                    const hasCustom = locConfig.customReceptionists && locConfig.customReceptionists[base64Id];
                                    if(hasCustom) name += " ⭐";

                                    return `<label style="font-size:0.85rem; display:flex; align-items:center; gap:4px; ${isActive?'':'opacity:0.5;'}"><input type="checkbox" class="person-cb-${loc}" value="${base64Id}" ${isActive?'checked':''}>${name} ${isActive?'':'(停用)'}</label>`;
                                }).join('')}
                            </div>
                        </div>
                        <button onclick="generateCustom('${loc}')" style="padding:8px 15px; background:#10b981; color:white; border:none; border-radius:6px; cursor:pointer; font-weight:bold; align-self:flex-start;">⚡ 立即生成报文</button>
                    </div>
                    <div id="customResult-${loc}" style="display:none;"></div>
                </div>

                <div class="card" style="border-top: 4px solid #9333ea;">
                    <h2>🔮 全员无记录模拟 (Force Sync)</h2>
                    <p style="font-size:0.8rem; color:#666; margin-bottom:10px;">假设数据库清空，系统将从“今天”开始生成完整对齐计划。（此区域仅为逻辑验证，不受熔断影响）</p>
                    ${renderRequests(simulatedPlan.requests, loc)}
                </div>
            </div>
            `;
        }).join('');

        const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0">
            <title>申请插件调试面板</title>
            <style>
                    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #f3f4f6; padding: 10px; color: #1f2937; margin:0; }
                    .container { max-width: 1000px; margin: 0 auto; }
                    .card { background: #fff; padding: 15px; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 20px; }
                    
                    h1 { margin: 10px 0 20px 0; color: #111827; font-size: 1.2rem; border-left: 4px solid #3b82f6; padding-left: 10px; display: flex; align-items: center; justify-content: space-between; }
                    h2 { margin-top: 0; color: #4b5563; font-size: 1rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; }
                    
                    .tabs { display: flex; gap: 8px; margin-bottom: 20px; position: sticky; top: 0; z-index: 100; background: #f3f4f6; padding: 10px 0; }
                    .tab { flex: 1; text-align: center; padding: 12px 0; background: #e5e7eb; border-radius: 8px; color: #374151; font-weight: bold; cursor: pointer; transition: 0.2s; border: none;}
                    .tab.active { background: #3b82f6; color: white; box-shadow: 0 2px 4px rgba(59,130,246,0.3); }
                    .loc-content { display: none; }
                    .loc-content.active { display: block; animation: fadeIn 0.3s ease; }
                    
                    @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
                    
                    .table-wrapper { overflow-x: auto; margin-bottom: 15px; border-radius: 8px; border: 1px solid #e5e7eb; }
                    table { width: 100%; border-collapse: collapse; min-width: 500px; }
                    th, td { text-align: left; padding: 10px; border-bottom: 1px solid #e5e7eb; font-size: 0.9rem; }
                    th { background: #f9fafb; font-weight: 600; color: #6b7280; }
                    tr:last-child td { border-bottom: none; }
                    
                    .status-badge { padding: 2px 8px; border-radius: 99px; font-size: 0.75rem; font-weight: 600; white-space: nowrap; }
                    .expired { background: #fee2e2; color: #991b1b; }
                    .warning { background: #fef3c7; color: #92400e; }
                    .success { background: #d1fae5; color: #065f46; }
                    
                    .request-item { background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; margin-bottom: 10px; overflow: hidden; }
                    .req-header { padding: 12px; background: #f9fafb; display: flex; flex-direction: column; cursor: pointer; user-select: none; transition: background 0.2s; }
                    .req-header:hover { background: #f3f4f6; }
                    .req-header-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px; }
                    .req-header-people { font-size: 0.85rem; color: #6b7280; }
                    
                    .code-section { border-top: 1px solid #e5e7eb; }
                    
                    /* 华丽的动作条和按钮样式 (全新紧凑排版) */
                    .code-toolbar { display: flex; justify-content: space-between; align-items: center; background: #f3f4f6; border-bottom: 1px solid #e5e7eb; padding-right: 12px; }
                    .code-tabs { display: flex; }
                    .tab-btn { padding: 10px 15px; font-size: 0.8rem; cursor: pointer; color: #6b7280; border-right: 1px solid #e5e7eb; background: transparent; border-top: none; border-bottom: none; border-left: none; outline: none; }
                    .tab-btn.active { background: #fff; color: #3b82f6; font-weight: 600; border-bottom: 2px solid #3b82f6; margin-bottom: -1px; }
                    
                    .send-btn { background: linear-gradient(135deg, #ef4444, #dc2626); color: white; border: none; padding: 6px 14px; border-radius: 6px; font-size: 0.85rem; font-weight: bold; cursor: pointer; transition: all 0.2s ease; box-shadow: 0 2px 4px rgba(239, 68, 68, 0.2); }
                    .send-btn:hover { transform: translateY(-1px); box-shadow: 0 4px 8px rgba(239, 68, 68, 0.3); }
                    .send-btn:active { transform: translateY(0); box-shadow: none; }
                    .send-btn:disabled { background: #9ca3af; cursor: not-allowed; box-shadow: none; transform: none; }
                    
                    .code-tabs { display: flex; background: #f3f4f6; border-bottom: 1px solid #e5e7eb; }
                    .tab-btn { padding: 8px 15px; font-size: 0.8rem; cursor: pointer; color: #6b7280; border-right: 1px solid #e5e7eb; background: #f3f4f6; border: none; }
                    .tab-btn.active { background: #fff; color: #3b82f6; font-weight: 600; border-bottom: 2px solid #3b82f6; }
                    .code-content { padding: 0; position: relative; display: none; }
                    .code-content.active { display: block; }
                    
                    pre { margin: 0; padding: 15px; overflow-x: auto; font-family: Consolas, monospace; font-size: 0.75rem; line-height: 1.4; color: #d4d4d4; background: #1e1e1e; max-height: 300px; }
                    .copy-btn { position: absolute; top: 10px; right: 10px; background: rgba(255,255,255,0.2); color: #fff; border: 1px solid rgba(255,255,255,0.3); padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 0.7rem; }
                    
                    details > summary { list-style: none; }
                    details > summary::marker { display: none; }
                    .error-banner { background: #fee2e2; border: 1px solid #fca5a5; color: #b91c1c; padding: 15px; border-radius: 8px; margin-bottom: 15px; font-weight: bold; font-size: 0.9rem; }
                    .stat-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 15px; font-size: 0.8rem; color: #666; background: #f9fafb; padding: 10px; border-radius: 8px; }
                    .stat-item { text-align: center; }
                    .stat-val { font-weight: bold; font-size: 1rem; color: #111827; }
                    .blocked-overlay { background: #f3f4f6; border: 2px dashed #d1d5db; border-radius: 8px; padding: 30px; text-align: center; color: #4b5563; }
                    
                    @media (min-width: 600px) {
                        .req-header { flex-direction: row; justify-content: space-between; align-items: center; }
                        .req-header-top { margin-bottom: 0; min-width: 150px; }
                    }
                </style>
                <script>
                function switchLoc(loc, btn) {
                    document.querySelectorAll('.loc-content').forEach(el => el.classList.remove('active'));
                    document.querySelectorAll('.loc-tab').forEach(el => el.classList.remove('active'));
                    document.getElementById('content-' + loc).classList.add('active');
                    btn.classList.add('active');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }

                function copyText(btn, text) {
                    navigator.clipboard.writeText(decodeURIComponent(text)).then(() => {
                        const original = btn.innerText; btn.innerText = 'Copied!'; setTimeout(() => btn.innerText = original, 2000);
                    });
                }

                function switchTab(btn, index) {
                    const parent = btn.closest('.code-section');
                    parent.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                    parent.querySelectorAll('.code-content').forEach(c => c.classList.remove('active'));
                    btn.classList.add('active');
                    parent.querySelectorAll('.code-content')[index].classList.add('active');
                }

                async function generateCustom(loc) {
                    const startInput = document.getElementById('customStartDate-' + loc).value;
                    let endInput = document.getElementById('customEndDate-' + loc).value;
                    
                    if (!startInput) return alert('至少需要选择一个开始日期哦！');
                    
                    let isSingleDay = false;
                    if (!endInput) {
                        endInput = startInput; // 没选结束日期，默认与开始日期一致
                        isSingleDay = true;
                    }
                    
                    const startTs = new Date(startInput + 'T00:00:00+08:00').getTime();
                    const endTs = new Date(endInput + 'T00:00:00+08:00').getTime();
                    
                    if (startTs > endTs) return alert('结束日期不能早于开始日期哦！');
                    
                    const cbs = document.querySelectorAll('.person-cb-' + loc + ':checked');
                    const ids = Array.from(cbs).map(cb => cb.value);
                    if (ids.length === 0) return alert('请至少选择一个人');
                    
                    const btn = document.querySelector('#content-' + loc + ' button[onclick^="generateCustom"]');
                    const oldText = btn.innerText;
                    btn.innerText = "数据生成中...";
                    
                    try {
                        const res = await fetch('generate-payload', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ loc, ids, startTs, endTs })
                        });
                        const data = await res.json();
                        
                        if (data.error) {
                            alert(data.error);
                        } else {
                            const resultDiv = document.getElementById('customResult-' + loc);
                            resultDiv.innerHTML = data.html;
                            
                            // 👇 直接在结果区域的顶部动态插入一个“弱提示”黄色小横幅，安全且直观
                            if (isSingleDay) {
                                resultDiv.insertAdjacentHTML('afterbegin', '<div style="background:#fef9c3; color:#b45309; padding:8px; border-radius:6px; margin-bottom:10px; font-size:0.85rem; text-align:center; border:1px solid #fde047;">ℹ️ 未选择结束日期，已默认生成单日（1天）的报文</div>');
                            }
                            
                            resultDiv.querySelectorAll('details').forEach(d => d.open = true);
                            resultDiv.style.display = 'block';
                        }
                    } catch (err) {
                        alert("网络错误：" + err.message);
                    } finally {
                        btn.innerText = oldText;
                    }
                }

                // 👇 新增的一键批量发送核心逻辑
                async function sendAllBatch(mainBtn, loc) {
                    const container = document.getElementById('customResult-' + loc);
                    const btns = Array.from(container.querySelectorAll('.batch-send-btn'));
                    if(btns.length === 0) return alert('没有找到可发送的数据包');
                    
                    const pwd = prompt("⚠️ 批量发送确认\\n即将为您自动发送这 " + btns.length + " 个数据包。\\n为了防止触发风控，每个请求之间会强制间隔 0.6 秒。\\n\\n请输入操作密码：");
                    if(!pwd) return;
                    
                    mainBtn.innerText = "🚀 队列自动发送中...";
                    mainBtn.disabled = true;
                    mainBtn.style.opacity = "0.7";
                    
                    for(let i=0; i<btns.length; i++) {
                        const b = btns[i];
                        b.innerText = "发送中...";
                        b.style.background = "linear-gradient(135deg, #f59e0b, #d97706)";
                        
                        try {
                            const res = await fetch('manual-send', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    loc: b.getAttribute('data-loc'),
                                    targetDate: b.getAttribute('data-date'),
                                    people: b.getAttribute('data-people'),
                                    encodedBody: decodeURIComponent(b.getAttribute('data-encoded')),
                                    pwd: pwd
                                })
                            });
                            const data = await res.json();
                            if(data.success) {
                                b.innerText = "✅ 成功";
                                b.style.background = "linear-gradient(135deg, #10b981, #059669)";
                            } else {
                                b.innerText = "❌ 失败: " + data.msg;
                                b.style.background = "linear-gradient(135deg, #ef4444, #dc2626)";
                            }
                        } catch(e) {
                            b.innerText = "❌ 网络异常";
                            b.style.background = "linear-gradient(135deg, #ef4444, #dc2626)";
                        }
                        
                        // 强制排队等待，保证日期顺序 100% 正确且防封锁
                        await new Promise(r => setTimeout(r, 600)); 
                    }
                    
                    mainBtn.innerText = "✅ 批量发送完成";
                    mainBtn.style.background = "linear-gradient(135deg, #10b981, #059669)";
                    mainBtn.style.opacity = "1";
                }

                async function sendPayload(event, loc, targetDate, people, encodedBodyURI) {
                    event.preventDefault(); 
                    event.stopPropagation();
                    
                    // 👠 看好了！本小姐全换成了双引号拼接，不会再有波浪线了！
                    const pwd = prompt("⚠️ 危险操作确认\\n即将为 [" + loc + "] 的 [" + people + "] 提交 [" + targetDate + "] 的入厂申请。\\n\\n请输入操作密码：");
                    if (!pwd) return; 

                    const btn = event.target;
                    const originalText = btn.innerText;
                    btn.innerText = "正在发送中...";
                    btn.style.background = "linear-gradient(135deg, #f59e0b, #d97706)";
                    btn.disabled = true;

                    try {
                        const res = await fetch('manual-send', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                loc: loc,
                                targetDate: targetDate,
                                people: people,
                                encodedBody: decodeURIComponent(encodedBodyURI),
                                pwd: pwd
                            })
                        });
                        const data = await res.json();
                        
                        if (data.success) {
                            alert("✅ 发送成功！\\n实例ID: " + data.id);
                            btn.innerText = "已发送成功";
                            btn.style.background = "linear-gradient(135deg, #10b981, #059669)";
                        } else {
                            alert("❌ 发送失败！\\n原因: " + data.msg);
                            btn.innerText = originalText;
                            btn.style.background = "linear-gradient(135deg, #ef4444, #dc2626)";
                            btn.disabled = false;
                        }
                    } catch (e) {
                        alert("❌ 网络异常: " + e.message);
                        btn.innerText = originalText;
                        btn.style.background = "linear-gradient(135deg, #ef4444, #dc2626)";
                        btn.disabled = false;
                    }
                }
                </script>
        </head>
        <body>
            <div class="container">
                <div class="tabs">
                    ${tabsHtml}
                </div>
                ${contentsHtml}
            </div>
        </body>
        </html>
        `;
        res.send(html);
    } catch (err) {
        console.error(err);
        res.status(500).send(`Debug Error: ${err.message}`);
    }
});

function renderRequests(requests, loc) {
    if (requests.length === 0) return '<div style="padding:15px; text-align:center; color:#999; border:1px dashed #ddd; border-radius:8px; font-size:0.8rem;">无需发送数据包</div>';
    return requests.map((req, i) => `
    <div class="request-item">
        <details>
            <summary class="req-header">
                <div class="req-header-top"><strong>📅 ${req.targetDate}</strong></div>
                <div class="req-header-people">👥 ${req.people}</div>
            </summary>
            <div class="code-section">
                <div class="code-toolbar">
                    <div class="code-tabs">
                        <button class="tab-btn active" onclick="switchTab(this, 0)">Raw JSON</button>
                        <button class="tab-btn" onclick="switchTab(this, 1)">Encoded Body</button>
                    </div>
                    <button class="send-btn batch-send-btn" 
                            data-loc="${loc}" 
                            data-date="${req.targetDate}" 
                            data-people="${req.people}" 
                            data-encoded="${encodeURIComponent(req.encodedBody).replace(/'/g, "%27")}"
                            onclick="sendPayload(event, '${loc}', '${req.targetDate}', '${req.people}', '${encodeURIComponent(req.encodedBody).replace(/'/g, "%27")}')">
                        🚀 确认发送该包
                    </button>
                </div>
                <div class="code-content active">
                    <button class="copy-btn" onclick="copyText(this, '${encodeURIComponent(req.rawJson).replace(/'/g, "%27")}')">Copy</button>
                    <pre style="color:#a5d6ff;">${req.rawJson}</pre>
                </div>
                <div class="code-content">
                    <button class="copy-btn" onclick="copyText(this, '${encodeURIComponent(req.encodedBody).replace(/'/g, "%27")}')">Copy</button>
                    <pre style="color:#ffae57; white-space:pre-wrap; word-break:break-all;">${req.encodedBody}</pre>
                </div>
            </div>
        </details>
    </div>`).join('');
}

// --- 主逻辑路由 (一次遍历运行所有启用的厂区) ---
router.get('/auto-renew', async (req, res) => {
    const logs = [];
    const log = (msg) => { console.log(msg); logs.push(msg); };
    const allResults = [];
    
    try {
        log("=== 🚀 开始自动续期流程 ===");
        
        const locFilter = req.query.loc; 
        const locsToRun = locFilter ? [locFilter] : Object.keys(LOC_CONFIGS);

        for (const loc of locsToRun) {
            const locConfig = LOC_CONFIGS[loc];
            if (!locConfig || !locConfig.enabled) continue;
            
            log(`\n====== [${locConfig.title}] 开始执行 ======`);
            
            const { statusMap, stats } = await getAllStatuses(locConfig.query);
            const safetyCheck = checkSafeToRun(stats);
            
            if (!safetyCheck.safe) {
                log(`⛔ [严重] ${loc} 安全熔断触发，终止该厂区执行！原因: ${safetyCheck.reason}`);
                continue; 
            }

            const plan = calculatePlan(statusMap, locConfig);
            
            if (plan.requests.length === 0) {
                log(`✨ ${loc} 所有人员状态正常(已对齐)，无需续期。`);
                continue;
            }

            log(`📝 ${loc} 计划生成完成: 目标推演至 ${plan.targetDate}, 共 ${plan.requests.length} 个请求包`);

            const submitPromises = [];
            for (const reqTask of plan.requests) {
                log(`🚀 正在为 [${reqTask.people}] 提交申请 -> 日期: ${reqTask.targetDate}`);
                // 👇 将 locConfig 传给引擎，以便附带不同的 Cookie 凭证
                submitPromises.push(submitApplication(reqTask, locConfig).then(r => { 
                    if(r) { 
                        r.loc = loc; 
                        allResults.push(r); 
                        if(!r.success) {
                            log(`❌ [${loc}] ${reqTask.targetDate} 失败: ${r.msg}`);
                        } else {
                            log(`✅ [${loc}] ${reqTask.targetDate} 成功! 实例ID: ${r.id}`);
                        }
                    } 
                }));
                await delay(200); 
            }
            
            await Promise.all(submitPromises);
        }

        log("\n=== 🏁 流程结束 ===");
        
        let report = "📊 自动续期执行报告\n========================\n";
        allResults.forEach((r, idx) => {
            const icon = r.success ? "✅" : "❌";
            report += `${icon} [${r.loc}] 日期: ${r.date}\n`;
            report += `    人员: ${r.names}\n`;
            report += `    结果: ${r.success ? "成功 (" + r.id + ")" : "失败 (" + r.msg + ")"}\n`;
            report += "------------------------\n";
        });
        
        if (allResults.length === 0) {
            report += "✅ 所有厂区状态均正常，未发生实际提交操作。\n========================\n";
        }
        
        report += "\n🔍 系统日志:\n" + logs.join('\n');
        res.type('text/plain').send(report);

    } catch (err) {
        console.error(err);
        res.status(500).send("Server Error: " + err.message);
    }
});

module.exports = router;