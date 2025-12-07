/**
 * FactoryEntryReport.js
 * 自动续期入厂申请脚本 (智能追赶 + 模拟调试版)
 * 更新：Debug界面美化、增加全员模拟续期功能、日志优化。
 */

const express = require('express');
const axios = require('axios');
const router = express.Router();

// --- 工具函数：Base64 解码 ---
const decode = (str) => Buffer.from(str, 'base64').toString('utf-8');

// --- 配置区域 ---
const CONFIG = {
    // 基础请求头
    headers: {
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
        "accept-language": "zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7",
        "cookie": "tianshu_corp_user=ding2b4c83bec54a29c6f2c783f7214b6d69_FREEUSER; tianshu_csrf_token=e7daa879-7b83-40f7-8335-1a262747f2c9; c_csrf=e7daa879-7b83-40f7-8335-1a262747f2c9; cookie_visitor_id=zfGITZnn; cna=QhOGIdjbQ3ABASQOBEFsQ0YG; xlly_s=1; tianshu_app_type=APP_GRVPTEOQ6D4B7FLZFYNJ; JSESSIONID=BF2C6304A367F22183E99C3E5B5181C4; tfstk=gOZxf6D0ah_YmbR2H5blSie9vWyOMa2qeSyBjfcD57F8iJ8615qgycFzMIcmSS4-67N-GjmfQ1Fun54imlewXAw__tlG3a243co1t6qOx-yqEsPFbo36NgwrKxT1rqiRmR_At6jhqZ9SXsC3nq6jmbMZNxMXlE6-VAH6fcgjG36-CAAX5jN_FThrQAOXfhG5VAkB5ci_186-QbGsfqN_FTHZNf91kGhG5b-Tu6E2PQTVe3t72x3x1HG9XDqyxFGLhbtMyWMxkt2jwht_4PdnXxc1VBhaV5nIku6MWXnrwAHYDOYE_yDTCvnBhny8G7ZKRufyjfsyqkqd5-AnU0LfeTLw7qMrh42tpxCQDiM-tTfH7FuY8YhheTLw7qMreXXrUF8Zky5..; isg=BJCQbJGPzSIDPJDoHxPbfgneatziWXSjkwUE44pgG-BuxflvPmhTMY7zmMuAWSx7"
    },
    url: "https://iw68lh.aliwork.com/o/HW9663A19D6M1QDL6D7GNAO1L2ZC2NBXQHOXL3?_api=nattyFetch&_mock=false&_stamp=",
    csrf_token: "e7daa879-7b83-40f7-8335-1a262747f2c9",
    formUuid: "FORM-2768FF7B2C0D4A0AB692FD28DBA09FD57IHQ",
    appType: "APP_GRVPTEOQ6D4B7FLZFYNJ",
    
    // 查询配置
    query: {
        visitorIdNos: [
            "MTMwMzIzMTk4NjAyMjgwODFY", // 康
            "MTMwMzIyMTk4ODA2MjQyMDE4", // 张
            "MTMwNDI1MTk4OTA4MjkwMzE0", // 姜
            "MjMwMjMwMjAwMzAxMDEyMTM1", // 孙
            "MTMxMTIxMTk4OTAxMDU1MDEx", // 王
            "NDEwNDIzMTk4OTA3MjIxNTMw", // 田
            "MDMwNzE3Njg="              // 贾
        ],
        regPerson: "17614625112",
        acToken: "E5EF067A42A792436902EB275DCCA379812FF4A4A8A756BE0A1659704557309F",
        queryUrl: "https://dingtalk.avaryholding.com:8443/dingplus/visitorConnector/visitorStatus"
    }
};

// --- 人员数据模板 (Base64加密处理) ---
const PERSON_DB = {
    // 康伟强
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
    // 张强
    "MTMwMzIyMTk4ODA2MjQyMDE4": [
        {"componentName":"SelectField","fieldId":"selectField_lxv44orx","label":"有效身份证件","fieldData":{"value":"身份证","text":"身份证"},"options":[{"defaultChecked":false,"syncLabelValue":true,"__sid":"item_lxjzgsg1","text":"身份证","__sid__":"serial_lxjzgsg0","value":"身份证","sid":"serial_lxjzgsg0"}]},
        {"componentName":"TextField","fieldId":"textField_lxv44ory","label":"证件号码","fieldData":{"value": decode("MTMwMzIyMTk4ODA2MjQyMDE4")}},
        {"componentName":"TextField","fieldId":"textField_lxv44orw","label":"姓名","fieldData":{"value": decode("5byg5by6")}},
        {"componentName":"SelectField","fieldId":"selectField_mbyjhot6","label":"区号","fieldData":{"value":"86","text":"+86"},"options":[{"defaultChecked":true,"syncLabelValue":false,"__sid":"item_megqe4lm","text":"+86","__sid__":"serial_megqe4ll","value":"86","sid":"serial_mbyjf8gm"}]},
        {"componentName":"TextField","fieldId":"textField_lxv44orz","label":"联系方式","fieldData":{"value": decode("MTc3MzM1MzIwNTc=")}},
        {"componentName":"ImageField","fieldId":"imageField_ly9i5k5q","label":"免冠照片","fieldData":{"value":[{"name":"mmexport1759201649607.jpg","previewUrl":"https://dingtalk.avaryholding.com:8443/dingplus/image/20250930/2e36796d55df6570b30814673dd79c7d.jpg","downloadUrl":"https://dingtalk.avaryholding.com:8443/dingplus/image/20250930/2e36796d55df6570b30814673dd79c7d.jpg","size":64695,"url":"https://dingtalk.avaryholding.com:8443/dingplus/image/20250930/2e36796d55df6570b30814673dd79c7d.jpg"}]}},
        {"componentName":"AttachmentField","fieldId":"attachmentField_lxv44osj","label":"身份证照片","fieldData":{"value":[{"name":"mmexport1759201639327.jpg","previewUrl":"/o/GNC66E91ZR7ZFLTH8OFEP46CB9JG3EUHDF6GMOB?appType=APP_GRVPTEOQ6D4B7FLZFYNJ&fileName=APP_GRVPTEOQ6D4B7FLZFYNJ_R05DNjZFOTFaUjdaRkxUSDhPRkVQNDZDQjlKRzNFVUhERjZHTU5C.jpg&instId=&type=open&process=image/resize,m_fill,w_200,h_200,limit_0/quality,q_80","downloadUrl":"/o/GNC66E91ZR7ZFLTH8OFEP46CB9JG3EUHDF6GMOB?appType=APP_GRVPTEOQ6D4B7FLZFYNJ&fileName=APP_GRVPTEOQ6D4B7FLZFYNJ_R05DNjZFOTFaUjdaRkxUSDhPRkVQNDZDQjlKRzNFVUhERjZHTU5C.jpg&instId=&type=download","size":531330,"url":"/o/GNC66E91ZR7ZFLTH8OFEP46CB9JG3EUHDF6GMOB?appType=APP_GRVPTEOQ6D4B7FLZFYNJ&fileName=APP_GRVPTEOQ6D4B7FLZFYNJ_R05DNjZFOTFaUjdaRkxUSDhPRkVQNDZDQjlKRzNFVUhERjZHTU5C.jpg&instId=&type=download","fileUuid":"APP_GRVPTEOQ6D4B7FLZFYNJ_R05DNjZFOTFaUjdaRkxUSDhPRkVQNDZDQjlKRzNFVUhERjZHTU5C.jpg"}]}},
        {"componentName":"AttachmentField","fieldId":"attachmentField_lxv44osk","label":"社保/在职证明","fieldData":{"value":[{"name":"mmexport1759201655801.jpg","previewUrl":"/o/LLF66FD1VJ8ZU56HEFRI4BPWPUBG22DMDF6GMO4?appType=APP_GRVPTEOQ6D4B7FLZFYNJ&fileName=APP_GRVPTEOQ6D4B7FLZFYNJ_TExGNjZGRDFWSjhaVTU2SEVGUkk0QlBXUFVCRzIyRE1ERjZHTU40.jpg&instId=&type=open&process=image/resize,m_fill,w_200,h_200,limit_0/quality,q_80","downloadUrl":"/o/LLF66FD1VJ8ZU56HEFRI4BPWPUBG22DMDF6GMO4?appType=APP_GRVPTEOQ6D4B7FLZFYNJ&fileName=APP_GRVPTEOQ6D4B7FLZFYNJ_TExGNjZGRDFWSjhaVTU2SEVGUkk0QlBXUFVCRzIyRE1ERjZHTU40.jpg&instId=&type=download","size":304370,"url":"/o/LLF66FD1VJ8ZU56HEFRI4BPWPUBG22DMDF6GMO4?appType=APP_GRVPTEOQ6D4B7FLZFYNJ&fileName=APP_GRVPTEOQ6D4B7FLZFYNJ_TExGNjZGRDFWSjhaVTU2SEVGUkk0QlBXUFVCRzIyRE1ERjZHTU40.jpg&instId=&type=download","fileUuid":"APP_GRVPTEOQ6D4B7FLZFYNJ_TExGNjZGRDFWSjhaVTU2SEVGUkk0QlBXUFVCRzIyRE1ERjZHTU40.jpg"}]}},
        {"componentName":"AttachmentField","fieldId":"attachmentField_lxv44osn","label":"其他附件","fieldData":{"value":[]}}
    ],
    // 姜建龙
    "MTMwNDI1MTk4OTA4MjkwMzE0": [
        {"componentName":"SelectField","fieldId":"selectField_lxv44orx","label":"有效身份证件","fieldData":{"value":"身份证","text":"身份证"},"options":[{"defaultChecked":false,"syncLabelValue":true,"__sid":"item_lxjzgsg1","text":"身份证","__sid__":"serial_lxjzgsg0","value":"身份证","sid":"serial_lxjzgsg0"}]},
        {"componentName":"TextField","fieldId":"textField_lxv44ory","label":"证件号码","fieldData":{"value": decode("MTMwNDI1MTk4OTA4MjkwMzE0")}},
        {"componentName":"TextField","fieldId":"textField_lxv44orw","label":"姓名","fieldData":{"value": decode("5aec5bu66b6Z")}},
        {"componentName":"SelectField","fieldId":"selectField_mbyjhot6","label":"区号","fieldData":{"value":"86","text":"+86"},"options":[{"defaultChecked":true,"syncLabelValue":false,"__sid":"item_megqe4lm","text":"+86","__sid__":"serial_megqe4ll","value":"86","sid":"serial_mbyjf8gm"}]},
        {"componentName":"TextField","fieldId":"textField_lxv44orz","label":"联系方式","fieldData":{"value": decode("MTM2MjU0MjIzNDY=")}},
        {"componentName":"ImageField","fieldId":"imageField_ly9i5k5q","label":"免冠照片","fieldData":{"value":[{"name":"mmexport1759201658197.jpg","previewUrl":"https://dingtalk.avaryholding.com:8443/dingplus/image/20250930/ec928e3f5759064c4e2e1bf9cfc30f14.jpg","downloadUrl":"https://dingtalk.avaryholding.com:8443/dingplus/image/20250930/ec928e3f5759064c4e2e1bf9cfc30f14.jpg","size":58436,"url":"https://dingtalk.avaryholding.com:8443/dingplus/image/20250930/ec928e3f5759064c4e2e1bf9cfc30f14.jpg"}]}},
        {"componentName":"AttachmentField","fieldId":"attachmentField_lxv44osj","label":"身份证照片","fieldData":{"value":[{"name":"mmexport1759201657241.jpg","previewUrl":"/o/U1B66W914K8ZZWUFFNE4PBZVZH2G28D8FF6GMV4?appType=APP_GRVPTEOQ6D4B7FLZFYNJ&fileName=APP_GRVPTEOQ6D4B7FLZFYNJ_VTFCNjZXOTE0SzhaWldVRkZORTRQQlpWWkgyRzI3RDhGRjZHTVU0.jpg&instId=&type=open&process=image/resize,m_fill,w_200,h_200,limit_0/quality,q_80","downloadUrl":"/o/U1B66W914K8ZZWUFFNE4PBZVZH2G28D8FF6GMV4?appType=APP_GRVPTEOQ6D4B7FLZFYNJ&fileName=APP_GRVPTEOQ6D4B7FLZFYNJ_VTFCNjZXOTE0SzhaWldVRkZORTRQQlpWWkgyRzI3RDhGRjZHTVU0.jpg&instId=&type=download","size":37638,"url":"/o/U1B66W914K8ZZWUFFNE4PBZVZH2G28D8FF6GMV4?appType=APP_GRVPTEOQ6D4B7FLZFYNJ&fileName=APP_GRVPTEOQ6D4B7FLZFYNJ_VTFCNjZXOTE0SzhaWldVRkZORTRQQlpWWkgyRzI3RDhGRjZHTVU0.jpg&instId=&type=download","fileUuid":"APP_GRVPTEOQ6D4B7FLZFYNJ_VTFCNjZXOTE0SzhaWldVRkZORTRQQlpWWkgyRzI3RDhGRjZHTVU0.jpg"}]}},
        {"componentName":"AttachmentField","fieldId":"attachmentField_lxv44osk","label":"社保/在职证明","fieldData":{"value":[{"name":"mmexport1759201655801.jpg","previewUrl":"/o/6AG66W814L8ZPWYU9EOKXB6NTR892OPBFF6GMQ5?appType=APP_GRVPTEOQ6D4B7FLZFYNJ&fileName=APP_GRVPTEOQ6D4B7FLZFYNJ_NkFHNjZXODE0TDhaUFdZVTlFT0tYQjZOVFI4OTJPUEJGRjZHTVA1.jpg&instId=&type=open&process=image/resize,m_fill,w_200,h_200,limit_0/quality,q_80","downloadUrl":"/o/6AG66W814L8ZPWYU9EOKXB6NTR892OPBFF6GMQ5?appType=APP_GRVPTEOQ6D4B7FLZFYNJ&fileName=APP_GRVPTEOQ6D4B7FLZFYNJ_NkFHNjZXODE0TDhaUFdZVTlFT0tYQjZOVFI4OTJPUEJGRjZHTVA1.jpg&instId=&type=download","size":304370,"url":"/o/6AG66W814L8ZPWYU9EOKXB6NTR892OPBFF6GMQ5?appType=APP_GRVPTEOQ6D4B7FLZFYNJ&fileName=APP_GRVPTEOQ6D4B7FLZFYNJ_NkFHNjZXODE0TDhaUFdZVTlFT0tYQjZOVFI4OTJPUEJGRjZHTVA1.jpg&instId=&type=download","fileUuid":"APP_GRVPTEOQ6D4B7FLZFYNJ_NkFHNjZXODE0TDhaUFdZVTlFT0tYQjZOVFI4OTJPUEJGRjZHTVA1.jpg"}]}},
        {"componentName":"AttachmentField","fieldId":"attachmentField_lxv44osn","label":"其他附件","fieldData":{"value":[]}}
    ],
    // 孙德凯
    "MjMwMjMwMjAwMzAxMDEyMTM1": [
        {"componentName":"SelectField","fieldId":"selectField_lxv44orx","label":"有效身份证件","fieldData":{"value":"身份证","text":"身份证"},"options":[{"defaultChecked":false,"syncLabelValue":true,"__sid":"item_lxjzgsg1","text":"身份证","__sid__":"serial_lxjzgsg0","value":"身份证","sid":"serial_lxjzgsg0"}]},
        {"componentName":"TextField","fieldId":"textField_lxv44ory","label":"证件号码","fieldData":{"value": decode("MjMwMjMwMjAwMzAxMDEyMTM1")}},
        {"componentName":"TextField","fieldId":"textField_lxv44orw","label":"姓名","fieldData":{"value": decode("5a2Z5b635Yev")}},
        {"componentName":"SelectField","fieldId":"selectField_mbyjhot6","label":"区号","fieldData":{"value":"86","text":"+86"},"options":[{"defaultChecked":true,"syncLabelValue":false,"__sid":"item_megqe4lm","text":"+86","__sid__":"serial_megqe4ll","value":"86","sid":"serial_mbyjf8gm"}]},
        {"componentName":"TextField","fieldId":"textField_lxv44orz","label":"联系方式","fieldData":{"value": decode("MTc2MTQ2MjUxMTI=")}},
        {"componentName":"ImageField","fieldId":"imageField_ly9i5k5q","label":"免冠照片","fieldData":{"value":[{"name":"IMG20250729211344.jpg","previewUrl":"https://dingtalk.avaryholding.com:8443/dingplus/image/20250801/aa450e5d5330972eabce5ecbf019b577.jpg","downloadUrl":"https://dingtalk.avaryholding.com:8443/dingplus/image/20250801/aa450e5d5330972eabce5ecbf019b577.jpg","size":211900,"url":"https://dingtalk.avaryholding.com:8443/dingplus/image/20250801/aa450e5d5330972eabce5ecbf019b577.jpg"}]}},
        {"componentName":"AttachmentField","fieldId":"attachmentField_lxv44osj","label":"身份证照片","fieldData":{"value":[{"name":"mmexport1754011976476.jpg","previewUrl":"/o/MLF662B1O8JX9WDEEK8VLAGNM11H3JP5G5SDM1F?appType=APP_GRVPTEOQ6D4B7FLZFYNJ&fileName=APP_GRVPTEOQ6D4B7FLZFYNJ_TUxGNjYyQjFPOEpYOVdERUVLOFZMQUdOTTExSDNKUDVHNVNETTBG.jpg&instId=&type=open&process=image/resize,m_fill,w_200,h_200,limit_0/quality,q_80","downloadUrl":"/o/MLF662B1O8JX9WDEEK8VLAGNM11H3JP5G5SDM1F?appType=APP_GRVPTEOQ6D4B7FLZFYNJ&fileName=APP_GRVPTEOQ6D4B7FLZFYNJ_TUxGNjYyQjFPOEpYOVdERUVLOFZMQUdOTTExSDNKUDVHNVNETTBG.jpg&instId=&type=download","size":396211,"url":"/o/MLF662B1O8JX9WDEEK8VLAGNM11H3JP5G5SDM1F?appType=APP_GRVPTEOQ6D4B7FLZFYNJ&fileName=APP_GRVPTEOQ6D4B7FLZFYNJ_TUxGNjYyQjFPOEpYOVdERUVLOFZMQUdOTTExSDNKUDVHNVNETTBG.jpg&instId=&type=download","fileUuid":"APP_GRVPTEOQ6D4B7FLZFYNJ_TUxGNjYyQjFPOEpYOVdERUVLOFZMQUdOTTExSDNKUDVHNVNETTBG.jpg"},{"name":"mmexport1754011977805.jpg","previewUrl":"/o/EWE66Z916BJXCIPX9N5DOACQ111K3IS8G5SDM48?appType=APP_GRVPTEOQ6D4B7FLZFYNJ&fileName=APP_GRVPTEOQ6D4B7FLZFYNJ_RVdFNjZaOTE2QkpYQ0lQWDlONURPQUNRMTExSzNIUzhHNVNETTM4.jpg&instId=&type=open&process=image/resize,m_fill,w_200,h_200,limit_0/quality,q_80","downloadUrl":"/o/EWE66Z916BJXCIPX9N5DOACQ111K3IS8G5SDM48?appType=APP_GRVPTEOQ6D4B7FLZFYNJ&fileName=APP_GRVPTEOQ6D4B7FLZFYNJ_RVdFNjZaOTE2QkpYQ0lQWDlONURPQUNRMTExSzNIUzhHNVNETTM4.jpg&instId=&type=download","size":502357,"url":"/o/EWE66Z916BJXCIPX9N5DOACQ111K3IS8G5SDM48?appType=APP_GRVPTEOQ6D4B7FLZFYNJ&fileName=APP_GRVPTEOQ6D4B7FLZFYNJ_RVdFNjZaOTE2QkpYQ0lQWDlONURPQUNRMTExSzNIUzhHNVNETTM4.jpg&instId=&type=download","fileUuid":"APP_GRVPTEOQ6D4B7FLZFYNJ_RVdFNjZaOTE2QkpYQ0lQWDlONURPQUNRMTExSzNIUzhHNVNETTM4.jpg"}]}},
        {"componentName":"AttachmentField","fieldId":"attachmentField_lxv44osk","label":"社保/在职证明","fieldData":{"value":[{"name":"在职证明+-+孙德凯.pdf","previewUrl":"/dingtalk/mobile/APP_GRVPTEOQ6D4B7FLZFYNJ/inst/preview?appType=APP_GRVPTEOQ6D4B7FLZFYNJ&fileName=APP_GRVPTEOQ6D4B7FLZFYNJ_QjlDNjYwQzFNQkxYRDBOUzczVk1EN0pCTTJDUDM2Q0xINVNETUI0.pdf&fileSize=40638&downloadUrl=APP_GRVPTEOQ6D4B7FLZFYNJ_QjlDNjYwQzFNQkxYRDBOUzczVk1EN0pCTTJDUDM2Q0xINVNETUI0.pdf","downloadUrl":"/o/B9C660C1MBLXD0NS73VMD7JBM2CP37CLH5SDMC4?appType=APP_GRVPTEOQ6D4B7FLZFYNJ&fileName=APP_GRVPTEOQ6D4B7FLZFYNJ_QjlDNjYwQzFNQkxYRDBOUzczVk1EN0pCTTJDUDM2Q0xINVNETUI0.pdf&instId=&type=download","size":40638,"url":"/o/B9C660C1MBLXD0NS73VMD7JBM2CP37CLH5SDMC4?appType=APP_GRVPTEOQ6D4B7FLZFYNJ&fileName=APP_GRVPTEOQ6D4B7FLZFYNJ_QjlDNjYwQzFNQkxYRDBOUzczVk1EN0pCTTJDUDM2Q0xINVNETUI0.pdf&instId=&type=download","fileUuid":"APP_GRVPTEOQ6D4B7FLZFYNJ_QjlDNjYwQzFNQkxYRDBOUzczVk1EN0pCTTJDUDM2Q0xINVNETUI0.pdf"}]}},
        {"componentName":"AttachmentField","fieldId":"attachmentField_lxv44osn","label":"其他附件","fieldData":{"value":[]}}
    ],
    // 王菁
    "MTMxMTIxMTk4OTAxMDU1MDEx": [
        {"componentName":"SelectField","fieldId":"selectField_lxv44orx","label":"有效身份证件","fieldData":{"value":"身份证","text":"身份证"},"options":[{"defaultChecked":false,"syncLabelValue":true,"__sid":"item_lxjzgsg1","text":"身份证","__sid__":"serial_lxjzgsg0","value":"身份证","sid":"serial_lxjzgsg0"}]},
        {"componentName":"TextField","fieldId":"textField_lxv44ory","label":"证件号码","fieldData":{"value": decode("MTMxMTIxMTk4OTAxMDU1MDEx")}},
        {"componentName":"TextField","fieldId":"textField_lxv44orw","label":"姓名","fieldData":{"value": decode("546L6I+B")}},
        {"componentName":"SelectField","fieldId":"selectField_mbyjhot6","label":"区号","fieldData":{"value":"86","text":"+86"},"options":[{"defaultChecked":true,"syncLabelValue":false,"__sid":"item_megqe4lm","text":"+86","__sid__":"serial_megqe4ll","value":"86","sid":"serial_mbyjf8gm"}]},
        {"componentName":"TextField","fieldId":"textField_lxv44orz","label":"联系方式","fieldData":{"value": decode("MTUzNjk2OTc2NTY=")}},
        {"componentName":"ImageField","fieldId":"imageField_ly9i5k5q","label":"免冠照片","fieldData":{"value":[{"name":"mmexport1764079804080.jpg","previewUrl":"https://dingtalk.avaryholding.com:8443/dingplus/image/20251125/75283de0e118cb24adf4d5a0ed6bac6f.jpg","downloadUrl":"https://dingtalk.avaryholding.com:8443/dingplus/image/20251125/75283de0e118cb24adf4d5a0ed6bac6f.jpg","size":61062,"url":"https://dingtalk.avaryholding.com:8443/dingplus/image/20251125/75283de0e118cb24adf4d5a0ed6bac6f.jpg"}]}},
        {"componentName":"AttachmentField","fieldId":"attachmentField_lxv44osj","label":"身份证照片","fieldData":{"value":[{"name":"mmexport1764079249396.jpg","previewUrl":"/o/4UF66771OHS0AITWGDG6M7PX8ZY237GNKNEIM0D?appType=APP_GRVPTEOQ6D4B7FLZFYNJ&fileName=APP_GRVPTEOQ6D4B7FLZFYNJ_NFVGNjY3NzFPSFMwQUlUV0dERzZNN1BYOFpZMjM3R05LTkVJTVpD.jpg&instId=&type=open&process=image/resize,m_fill,w_200,h_200,limit_0/quality,q_80","downloadUrl":"/o/4UF66771OHS0AITWGDG6M7PX8ZY237GNKNEIM0D?appType=APP_GRVPTEOQ6D4B7FLZFYNJ&fileName=APP_GRVPTEOQ6D4B7FLZFYNJ_NFVGNjY3NzFPSFMwQUlUV0dERzZNN1BYOFpZMjM3R05LTkVJTVpD.jpg&instId=&type=download","size":173437,"url":"/o/4UF66771OHS0AITWGDG6M7PX8ZY237GNKNEIM0D?appType=APP_GRVPTEOQ6D4B7FLZFYNJ&fileName=APP_GRVPTEOQ6D4B7FLZFYNJ_NFVGNjY3NzFPSFMwQUlUV0dERzZNN1BYOFpZMjM3R05LTkVJTVpD.jpg&instId=&type=download","fileUuid":"APP_GRVPTEOQ6D4B7FLZFYNJ_NFVGNjY3NzFPSFMwQUlUV0dERzZNN1BYOFpZMjM3R05LTkVJTVpD.jpg"}]}},
        {"componentName":"AttachmentField","fieldId":"attachmentField_lxv44osk","label":"社保/在职证明","fieldData":{"value":[{"name":"在职证明.pdf","previewUrl":"/dingtalk/mobile/APP_GRVPTEOQ6D4B7FLZFYNJ/inst/preview?appType=APP_GRVPTEOQ6D4B7FLZFYNJ&fileName=APP_GRVPTEOQ6D4B7FLZFYNJ_TlNHNjZKQjFMSFcwMjAwQ0hRRFNNQ0oxTDlWODIyWlBLTkVJTUk0.pdf&fileSize=74505&downloadUrl=APP_GRVPTEOQ6D4B7FLZFYNJ_TlNHNjZKQjFMSFcwMjAwQ0hRRFNNQ0oxTDlWODIyWlBLTkVJTUk0.pdf","downloadUrl":"/o/NSG66JB1LHW0200CHQDSMCJ1L9V822ZPKNEIMJ4?appType=APP_GRVPTEOQ6D4B7FLZFYNJ&fileName=APP_GRVPTEOQ6D4B7FLZFYNJ_TlNHNjZKQjFMSFcwMjAwQ0hRRFNNQ0oxTDlWODIyWlBLTkVJTUk0.pdf&instId=&type=download","size":74505,"url":"/o/NSG66JB1LHW0200CHQDSMCJ1L9V822ZPKNEIMJ4?appType=APP_GRVPTEOQ6D4B7FLZFYNJ&fileName=APP_GRVPTEOQ6D4B7FLZFYNJ_TlNHNjZKQjFMSFcwMjAwQ0hRRFNNQ0oxTDlWODIyWlBLTkVJTUk0.pdf&instId=&type=download","fileUuid":"APP_GRVPTEOQ6D4B7FLZFYNJ_TlNHNjZKQjFMSFcwMjAwQ0hRRFNNQ0oxTDlWODIyWlBLTkVJTUk0.pdf"}]}},
        {"componentName":"AttachmentField","fieldId":"attachmentField_lxv44osn","label":"其他附件","fieldData":{"value":[]}}
    ],
    // 田乐乐
    "NDEwNDIzMTk4OTA3MjIxNTMw": [
        {"componentName":"SelectField","fieldId":"selectField_lxv44orx","label":"有效身份证件","fieldData":{"value":"身份证","text":"身份证"},"options":[{"defaultChecked":false,"syncLabelValue":true,"__sid":"item_lxjzgsg1","text":"身份证","__sid__":"serial_lxjzgsg0","value":"身份证","sid":"serial_lxjzgsg0"}]},
        {"componentName":"TextField","fieldId":"textField_lxv44ory","label":"证件号码","fieldData":{"value": decode("NDEwNDIzMTk4OTA3MjIxNTMw")}},
        {"componentName":"TextField","fieldId":"textField_lxv44orw","label":"姓名","fieldData":{"value": decode("55Sw5LmQ5LmQ")}},
        {"componentName":"SelectField","fieldId":"selectField_mbyjhot6","label":"区号","fieldData":{"value":"86","text":"+86"},"options":[{"defaultChecked":true,"syncLabelValue":false,"__sid":"item_megqe4lm","text":"+86","__sid__":"serial_megqe4ll","value":"86","sid":"serial_mbyjf8gm"}]},
        {"componentName":"TextField","fieldId":"textField_lxv44orz","label":"联系方式","fieldData":{"value": decode("MTM3MzM3NzE2NjE=")}},
        {"componentName":"ImageField","fieldId":"imageField_ly9i5k5q","label":"免冠照片","fieldData":{"value":[{"name":"mmexport1764077687246.jpg","previewUrl":"https://dingtalk.avaryholding.com:8443/dingplus/image/20251125/ce5e71ca5152f9308d11fa79274a2db4.jpg","downloadUrl":"https://dingtalk.avaryholding.com:8443/dingplus/image/20251125/ce5e71ca5152f9308d11fa79274a2db4.jpg","size":56562,"url":"https://dingtalk.avaryholding.com:8443/dingplus/image/20251125/ce5e71ca5152f9308d11fa79274a2db4.jpg"}]}},
        {"componentName":"AttachmentField","fieldId":"attachmentField_lxv44osj","label":"身份证照片","fieldData":{"value":[{"name":"mmexport1764077685696.jpg","previewUrl":"/o/JHC66Q81ACX0C1U5KH7TLBOPQLB83SQ8YMEIM52?appType=APP_GRVPTEOQ6D4B7FLZFYNJ&fileName=APP_GRVPTEOQ6D4B7FLZFYNJ_SkhDNjZRODFBQ1gwQzFVNUtIN1RMQk9QUUxCODNTUThZTUVJTTQy.jpg&instId=&type=open&process=image/resize,m_fill,w_200,h_200,limit_0/quality,q_80","downloadUrl":"/o/JHC66Q81ACX0C1U5KH7TLBOPQLB83SQ8YMEIM52?appType=APP_GRVPTEOQ6D4B7FLZFYNJ&fileName=APP_GRVPTEOQ6D4B7FLZFYNJ_SkhDNjZRODFBQ1gwQzFVNUtIN1RMQk9QUUxCODNTUThZTUVJTTQy.jpg&instId=&type=download","size":327697,"url":"/o/JHC66Q81ACX0C1U5KH7TLBOPQLB83SQ8YMEIM52?appType=APP_GRVPTEOQ6D4B7FLZFYNJ&fileName=APP_GRVPTEOQ6D4B7FLZFYNJ_SkhDNjZRODFBQ1gwQzFVNUtIN1RMQk9QUUxCODNTUThZTUVJTTQy.jpg&instId=&type=download","fileUuid":"APP_GRVPTEOQ6D4B7FLZFYNJ_SkhDNjZRODFBQ1gwQzFVNUtIN1RMQk9QUUxCODNTUThZTUVJTTQy.jpg"}]}},
        {"componentName":"AttachmentField","fieldId":"attachmentField_lxv44osk","label":"社保/在职证明","fieldData":{"value":[{"name":"mmexport1764077683551.jpg","previewUrl":"/o/R7C66W71JES0TS6GOMX304AK0SI23F2NZMEIMWL?appType=APP_GRVPTEOQ6D4B7FLZFYNJ&fileName=APP_GRVPTEOQ6D4B7FLZFYNJ_UjdDNjZXNzFKRVMwVFM2R09NWDMwNEFLMFNJMjNGMk5aTUVJTVZM.jpg&instId=&type=open&process=image/resize,m_fill,w_200,h_200,limit_0/quality,q_80","downloadUrl":"/o/R7C66W71JES0TS6GOMX304AK0SI23F2NZMEIMWL?appType=APP_GRVPTEOQ6D4B7FLZFYNJ&fileName=APP_GRVPTEOQ6D4B7FLZFYNJ_UjdDNjZXNzFKRVMwVFM2R09NWDMwNEFLMFNJMjNGMk5aTUVJTVZM.jpg&instId=&type=download","size":95823,"url":"/o/R7C66W71JES0TS6GOMX304AK0SI23F2NZMEIMWL?appType=APP_GRVPTEOQ6D4B7FLZFYNJ&fileName=APP_GRVPTEOQ6D4B7FLZFYNJ_UjdDNjZXNzFKRVMwVFM2R09NWDMwNEFLMFNJMjNGMk5aTUVJTVZM.jpg&instId=&type=download","fileUuid":"APP_GRVPTEOQ6D4B7FLZFYNJ_UjdDNjZXNzFKRVMwVFM2R09NWDMwNEFLMFNJMjNGMk5aTUVJTVZM.jpg"}]}},
        {"componentName":"AttachmentField","fieldId":"attachmentField_lxv44osn","label":"其他附件","fieldData":{"value":[]}}
    ],
    // 贾文选
    "MDMwNzE3Njg=": [
        {"componentName":"SelectField","fieldId":"selectField_lxv44orx","label":"有效身份证件","fieldData":{"value":"台胞证","text":"台胞证"},"options":[{"defaultChecked":false,"syncLabelValue":true,"__sid":"item_lxjzgsg3","text":"台胞证","__sid__":"serial_lxjzgsg2","value":"台胞证","sid":"serial_lxjzgsg2"}]},
        {"componentName":"TextField","fieldId":"textField_lxv44ory","label":"证件号码","fieldData":{"value": decode("MDMwNzE3Njg=")}},
        {"componentName":"TextField","fieldId":"textField_lxv44orw","label":"姓名","fieldData":{"value": decode("6LS+5paH6YCJ")}},
        {"componentName":"SelectField","fieldId":"selectField_mbyjhot6","label":"区号","fieldData":{"value":"86","text":"+86"},"options":[{"defaultChecked":true,"syncLabelValue":false,"__sid":"item_megqe4lm","text":"+86","__sid__":"serial_megqe4ll","value":"86","sid":"serial_mbyjf8gm"}]},
        {"componentName":"TextField","fieldId":"textField_lxv44orz","label":"联系方式","fieldData":{"value": decode("MTU2MjM0NTc2MjU=")}},
        {"componentName":"ImageField","fieldId":"imageField_ly9i5k5q","label":"免冠照片","fieldData":{"value":[{"name":"mmexport1760007547917.jpg","previewUrl":"https://dingtalk.avaryholding.com:8443/dingplus/image/20251010/652a6f0c65a2fb40cdccc4e4afbec59d.jpg","downloadUrl":"https://dingtalk.avaryholding.com:8443/dingplus/image/20251010/652a6f0c65a2fb40cdccc4e4afbec59d.jpg","size":144553,"url":"https://dingtalk.avaryholding.com:8443/dingplus/image/20251010/652a6f0c65a2fb40cdccc4e4afbec59d.jpg"}]}},
        {"componentName":"AttachmentField","fieldId":"attachmentField_lxv44osj","label":"身份证照片","fieldData":{"value":[{"name":"mmexport1760007546568.jpg","previewUrl":"/o/GI966BB1CS7ZB13YBTNJ95OVBJLY22F535KGM8L?appType=APP_GRVPTEOQ6D4B7FLZFYNJ&fileName=APP_GRVPTEOQ6D4B7FLZFYNJ_R0k5NjZCQjFDUzdaQjEzWUJUTko5NU9WQkpMWTIxRjUzNUtHTTdM.jpg&instId=&type=open&process=image/resize,m_fill,w_200,h_200,limit_0/quality,q_80","downloadUrl":"/o/GI966BB1CS7ZB13YBTNJ95OVBJLY22F535KGM8L?appType=APP_GRVPTEOQ6D4B7FLZFYNJ&fileName=APP_GRVPTEOQ6D4B7FLZFYNJ_R0k5NjZCQjFDUzdaQjEzWUJUTko5NU9WQkpMWTIxRjUzNUtHTTdM.jpg&instId=&type=download","size":302294,"url":"/o/GI966BB1CS7ZB13YBTNJ95OVBJLY22F535KGM8L?appType=APP_GRVPTEOQ6D4B7FLZFYNJ&fileName=APP_GRVPTEOQ6D4B7FLZFYNJ_R0k5NjZCQjFDUzdaQjEzWUJUTko5NU9WQkpMWTIxRjUzNUtHTTdM.jpg&instId=&type=download","fileUuid":"APP_GRVPTEOQ6D4B7FLZFYNJ_R0k5NjZCQjFDUzdaQjEzWUJUTko5NU9WQkpMWTIxRjUzNUtHTTdM.jpg"}]}},
        {"componentName":"AttachmentField","fieldId":"attachmentField_lxv44osk","label":"社保/在职证明","fieldData":{"value":[{"name":"在职证明+-+贾文选.pdf","previewUrl":"/dingtalk/mobile/APP_GRVPTEOQ6D4B7FLZFYNJ/inst/preview?appType=APP_GRVPTEOQ6D4B7FLZFYNJ&fileName=APP_GRVPTEOQ6D4B7FLZFYNJ_NENCNjY3NzFCOThaNEZMVkFaRkxaNkxNWEQ5MjJLTDczNUtHTThI.pdf&fileSize=35594&downloadUrl=APP_GRVPTEOQ6D4B7FLZFYNJ_NENCNjY3NzFCOThaNEZMVkFaRkxaNkxNWEQ5MjJLTDczNUtHTThI.pdf","downloadUrl":"/o/4CB66771B98Z4FLVAZFLZ6LMXD922KL735KGM9H?appType=APP_GRVPTEOQ6D4B7FLZFYNJ&fileName=APP_GRVPTEOQ6D4B7FLZFYNJ_NENCNjY3NzFCOThaNEZMVkFaRkxaNkxNWEQ5MjJLTDczNUtHTThI.pdf&instId=&type=download","size":35594,"url":"/o/4CB66771B98Z4FLVAZFLZ6LMXD922KL735KGM9H?appType=APP_GRVPTEOQ6D4B7FLZFYNJ&fileName=APP_GRVPTEOQ6D4B7FLZFYNJ_NENCNjY3NzFCOThaNEZMVkFaRkxaNkxNWEQ5MjJLTDczNUtHTThI.pdf&instId=&type=download","fileUuid":"APP_GRVPTEOQ6D4B7FLZFYNJ_NENCNjY3NzFCOThaNEZMVkFaRkxaNkxNWEQ5MjJLTDczNUtHTThI.pdf"}]}},
        {"componentName":"AttachmentField","fieldId":"attachmentField_lxv44osn","label":"其他附件","fieldData":{"value":[]}}
    ]
};

// --- 表单基础结构 ---
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
    // 这里插入 DateField
    {"componentName":"TextField","fieldId":"textField_m4c5a419","label":"涉外签核","fieldData":{"value":"61990414"}},
    {"componentName":"TextField","fieldId":"textField_m4c5a41a","label":"门岗保安","fieldData":{"value":"15232353238"}}
];

// 辅助函数：延迟
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// 辅助函数：北京时间天数ID (用于比较)
const getBeijingDayId = (ts) => Math.floor((parseInt(ts) + 28800000) / 86400000);

// 辅助函数：格式化日期字符串 (假定输入为UTC时间戳+8小时偏移)
const getFormattedDate = (ts) => {
    const date = new Date(parseInt(ts) + 28800000);
    return date.toISOString().split('T')[0];
};

// 1. 查询所有人的状态
const getAllStatuses = async () => {
    console.log("🔍 开始批量查询人员状态...");
    const statuses = {};
    const decodedIds = CONFIG.query.visitorIdNos.map(id => decode(id));
    const promises = [];

    for (const id of decodedIds) {
        const idMask = id.substring(0, 4) + "****" + id.substring(id.length - 4);
        
        // 创建 Promise 但不等待它完成（立即推入数组）
        const p = (async () => {
            try {
                const res = await axios.post(CONFIG.query.queryUrl, {
                    visitorIdNo: id,
                    regPerson: CONFIG.query.regPerson,
                    acToken: CONFIG.query.acToken
                });
                
                if (res.data.code === 200 && res.data.data) {
                    let maxEnd = 0;
                    res.data.data.forEach(record => {
                        const end = parseInt(record.dateEnd || record.rangeEnd);
                        if (end > maxEnd) maxEnd = end;
                    });
                    statuses[id] = maxEnd;
                    console.log(`   [${idMask}] 最新记录结束时间: ${getFormattedDate(maxEnd)}`);
                } else {
                    console.log(`   [${idMask}] 无记录或查询失败`);
                    statuses[id] = 0;
                }
            } catch (e) {
                console.error(`   [${idMask}] 查询出错: ${e.message}`);
                statuses[id] = 0;
            }
        })();
        
        promises.push(p);
        await delay(50);
    }
    
    await Promise.all(promises);
    return statuses;
};

// 2. 构造并发送申请
const submitApplication = async (groupDateTs, personIds) => {
    // 构造人员列表 TableField
    const tableRows = [];
    const names = [];
    
    personIds.forEach(id => {
        const idBase64 = Buffer.from(id).toString('base64');
        const personData = PERSON_DB[idBase64];
        if (personData) {
            tableRows.push(personData);
            names.push(personData[2].fieldData.value);
        } else {
            console.error(`❌ 未找到 ID 为 ${id} 的模板数据`);
        }
    });

    if (tableRows.length === 0) return null;

    // 组合完整表单
    const tableField = {
        "componentName": "TableField",
        "fieldId": "tableField_lxv44os5",
        "label": "人员信息",
        "fieldData": { "value": tableRows },
        "listNum": 50 // 属性修正
    };

    const dateField = {
        "componentName": "DateField",
        "fieldId": "dateField_lxn9o9fh",
        "label": "到访日期",
        "fieldData": { "value": groupDateTs },
        "format": "yyyy-MM-dd"
    };

    const finalForm = [
        ...FORM_BASE,
        tableField,
        ...FORM_TAIL.slice(0, 4), // 接待人信息
        dateField,
        ...FORM_TAIL.slice(4)     // 签核和保安
    ];

    // 序列化 + URL 编码
    const jsonStr = JSON.stringify(finalForm);
    const encodedValue = encodeURIComponent(jsonStr);
    
    const postData = `_csrf_token=${CONFIG.csrf_token}&formUuid=${CONFIG.formUuid}&appType=${CONFIG.appType}&value=${encodedValue}&_schemaVersion=653`;
    
    // 发送请求
    const targetDateStr = getFormattedDate(groupDateTs);
    const maskedNames = names.map(n => n.length > 1 ? n[0] + "*" + n.substring(2) : n).join(",");
    
    console.log(`🚀 正在为 [${names.join(', ')}] 提交申请 -> 日期: ${targetDateStr}`);

    try {
        const url = CONFIG.url + Date.now();
        const res = await axios.post(url, postData, { headers: CONFIG.headers });
        
        if (res.data && res.data.success === true) {
            const formInstId = res.data.content ? res.data.content.formInstId : "未知ID";
            console.log(`✅ [${targetDateStr}] 申请成功! 实例ID: ${formInstId}`);
            return { success: true, date: targetDateStr, names: names.join(" "), id: formInstId };
        } else {
            console.log(`❌ [${targetDateStr}] 申请可能失败:`, JSON.stringify(res.data).substring(0, 100));
            return { success: false, date: targetDateStr, names: names.join(" "), msg: "API返回失败" };
        }
    } catch (e) {
        console.error(`❌ [${targetDateStr}] 请求网络错误: ${e.message}`);
        return { success: false, date: targetDateStr, names: names.join(" "), msg: e.message };
    }
};

/**
 * 核心逻辑：计算统一发包计划 (Catch-up Strategy)
 * 返回结构: { summary: [], requests: [] }
 */
const calculatePlan = (idStatusMap) => {
    const nowMs = Date.now();
    const todayObj = new Date(nowMs + 28800000);
    todayObj.setUTCHours(0, 0, 0, 0);
    const todayStartTs = todayObj.getTime() - 28800000;
    const todayId = getBeijingDayId(nowMs);

    const validUsers = [];
    const summary = [];
    
    let maxNextStartTs = 0; // 记录最晚的起始时间

    // 1. 分析所有人状态
    for (const [id, lastDateTs] of Object.entries(idStatusMap)) {
        const idBase64 = Buffer.from(id).toString('base64');
        const personInfo = PERSON_DB[idBase64];
        const name = personInfo ? personInfo[2].fieldData.value : "未知人员";

        let nextStartTs = 0;
        let formattedLastDate = "无记录";
        let statusText = "";
        let statusClass = "";
        let needsRenew = false;
        let lastDayId = 0;

        // 计算下一次起始时间
        if (lastDateTs === 0) {
            // 【修正1】无记录的新用户，从“今天”开始申请
            lastDayId = todayId; 
            nextStartTs = todayStartTs; 
            formattedLastDate = "新用户/无记录";
        } else {
            lastDayId = getBeijingDayId(lastDateTs);
            const d = new Date(lastDateTs + 28800000);
            d.setUTCDate(d.getUTCDate() + 1);
            d.setUTCHours(0,0,0,0);
            nextStartTs = d.getTime() - 28800000;
            formattedLastDate = getFormattedDate(lastDateTs);
        }

        const diff = lastDayId - todayId;

        // 判断是否需要续期 (<=2天)
        if (diff < 0) {
            statusText = `已过期 ${Math.abs(diff)} 天`;
            statusClass = "expired";
            needsRenew = true;
        } else if (diff <= 2) {
            statusText = `即将到期 (剩 ${diff} 天)`;
            statusClass = "warning";
            needsRenew = true;
        } else {
            statusText = `正常 (剩 ${diff} 天)`;
            statusClass = "success";
        }

        summary.push({
            name,
            idMask: id.substring(0, 4) + "***" + id.substring(id.length - 4),
            lastDate: formattedLastDate,
            status: statusText,
            class: statusClass,
            renew: needsRenew
        });

        if (needsRenew) {
            validUsers.push({ id, nextStartTs });
            if (nextStartTs > maxNextStartTs) {
                maxNextStartTs = nextStartTs;
            }
        }
    }

    if (validUsers.length === 0) {
        return { summary, requests: [] };
    }

    const requests = [];

    // 2. 生成计划：追赶 + 齐射
    const minNextStartTs = Math.min(...validUsers.map(u => u.nextStartTs));
    
    // 【修正2】循环游标必须从“今天”开始
    let cursorTs = Math.max(minNextStartTs, todayStartTs);
    
    // 结束时间是 基准线 + 6天 (共7天齐射)
    const effectiveMaxStart = Math.max(maxNextStartTs, todayStartTs);
    const endTs = effectiveMaxStart + (6 * 86400000); 

    let dayCount = 1;

    while (cursorTs <= endTs) {
        const todaysGroup = validUsers
            .filter(u => u.nextStartTs <= cursorTs)
            .map(u => u.id);
        
        if (todaysGroup.length > 0) {
            const personNames = todaysGroup.map(pid => {
                const pidBase64 = Buffer.from(pid).toString('base64');
                return PERSON_DB[pidBase64] ? PERSON_DB[pidBase64][2].fieldData.value : pid;
            }).join(", ");

            const tableRows = [];
            todaysGroup.forEach(pid => {
                const idBase64 = Buffer.from(pid).toString('base64');
                if (PERSON_DB[idBase64]) tableRows.push(PERSON_DB[idBase64]);
            });

            if (tableRows.length > 0) {
                const finalForm = [
                    ...FORM_BASE,
                    {
                        "componentName": "TableField",
                        "fieldId": "tableField_lxv44os5",
                        "label": "人员信息",
                        "fieldData": { "value": tableRows },
                        "listNum": 50
                    },
                    ...FORM_TAIL.slice(0, 4), 
                    {
                        "componentName": "DateField",
                        "fieldId": "dateField_lxn9o9fh",
                        "label": "到访日期",
                        "fieldData": { "value": cursorTs },
                        "format": "yyyy-MM-dd"
                    },
                    ...FORM_TAIL.slice(4)     
                ];

                const jsonStr = JSON.stringify(finalForm, null, 2); 
                const encodedValue = encodeURIComponent(JSON.stringify(finalForm));
                const fullPostBody = `_csrf_token=${CONFIG.csrf_token}&formUuid=${CONFIG.formUuid}&appType=${CONFIG.appType}&value=${encodedValue}&_schemaVersion=653`;

                requests.push({
                    ts: cursorTs,
                    dayIndex: dayCount++,
                    targetDate: getFormattedDate(cursorTs),
                    people: personNames,
                    ids: todaysGroup, 
                    rawJson: jsonStr,
                    encodedBody: fullPostBody
                });
            }
        }

        cursorTs += 86400000;
    }

    return { summary, requests };
};

// --- 调试接口 (包含实际状态分析和全员失效模拟) ---
router.get('/debug', async (req, res) => {
    try {
        // 1. 获取真实状态并计算
        const realStatusMap = await getAllStatuses();
        const realPlan = calculatePlan(realStatusMap);

        // 2. 生成模拟状态（假设所有人都没有记录/已过期）
        const simulatedStatusMap = {};
        CONFIG.query.visitorIdNos.forEach(idBase64 => {
             // 模拟状态：0 表示无记录，强制从今天开始申请
             simulatedStatusMap[decode(idBase64)] = 0;
        });
        const simulatedPlan = calculatePlan(simulatedStatusMap);

        const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <title>申请插件调试面板 (Smart Sync)</title>
            <style>
                body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #f0f2f5; padding: 20px; color: #333; }
                .container { max-width: 1100px; margin: 0 auto; }
                .card { background: #fff; padding: 25px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); margin-bottom: 25px; }
                
                h1 { margin: 0 0 20px 0; color: #1f2937; font-size: 1.5rem; border-left: 5px solid #3b82f6; padding-left: 15px; }
                h2 { margin-top: 0; color: #4b5563; font-size: 1.2rem; display: flex; align-items: center; gap: 10px; }
                
                table { width: 100%; border-collapse: separate; border-spacing: 0; margin-bottom: 20px; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; }
                th, td { text-align: left; padding: 12px 15px; border-bottom: 1px solid #e5e7eb; }
                th { background: #f9fafb; font-weight: 600; color: #6b7280; font-size: 0.9rem; }
                tr:last-child td { border-bottom: none; }
                
                .status-badge { padding: 4px 10px; border-radius: 99px; font-size: 0.8rem; font-weight: 600; }
                .expired { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; }
                .warning { background: #fffbeb; color: #d97706; border: 1px solid #fde68a; }
                .success { background: #ecfdf5; color: #059669; border: 1px solid #a7f3d0; }
                
                .request-item { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; margin-bottom: 12px; overflow: hidden; }
                .req-header { padding: 12px 15px; display: flex; justify-content: space-between; align-items: center; cursor: pointer; user-select: none; }
                .req-header:hover { background: #f3f4f6; }
                .req-header strong { color: #111827; }
                .req-header span { color: #6b7280; font-size: 0.9rem; }
                
                .code-container { border-top: 1px solid #e5e7eb; background: #282c34; padding: 15px; position: relative; }
                .code-block { color: #abb2bf; font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace; font-size: 0.85rem; margin: 0; white-space: pre-wrap; word-break: break-all; }
                .json-block { color: #98c379; }
                .url-block { color: #61afef; }
                
                .copy-btn { position: absolute; top: 10px; right: 10px; background: rgba(255,255,255,0.1); color: #fff; border: 1px solid rgba(255,255,255,0.2); padding: 5px 10px; border-radius: 4px; cursor: pointer; font-size: 0.75rem; transition: background 0.2s; }
                .copy-btn:hover { background: rgba(255,255,255,0.2); }
                
                details > summary { list-style: none; }
                details > summary::marker { display: none; }
                
                .sim-banner { background: #e0f2fe; color: #0369a1; padding: 15px; border-radius: 8px; margin-bottom: 20px; font-weight: 500; border: 1px solid #bae6fd; }
                .tag-real { background: #dbeafe; color: #1e40af; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; margin-right: 5px; }
                .tag-sim { background: #f3e8ff; color: #6b21a8; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; margin-right: 5px; }
            </style>
            <script>
                function copyText(btn, text) {
                    navigator.clipboard.writeText(text).then(() => {
                        const original = btn.innerText;
                        btn.innerText = 'Copied!';
                        setTimeout(() => btn.innerText = original, 2000);
                    });
                }
            </script>
        </head>
        <body>
            <div class="container">
                <h1>🔧 申请插件高级调试面板</h1>

                <div class="card">
                    <h2><span class="tag-real">LIVE</span> 实时状态概览</h2>
                    <p style="color:#666; font-size: 0.9rem; margin-bottom: 15px;">基于从服务器查询到的最新数据。</p>
                    <table>
                        <thead>
                            <tr>
                                <th>姓名</th>
                                <th>ID (Masked)</th>
                                <th>最新有效日期</th>
                                <th>状态</th>
                                <th>操作</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${realPlan.summary.map(item => `
                            <tr>
                                <td><strong>${item.name}</strong></td>
                                <td>${item.idMask}</td>
                                <td>${item.lastDate}</td>
                                <td><span class="status-badge ${item.class}">${item.status}</span></td>
                                <td>${item.renew ? '🔴 待续期' : '⚪ 跳过'}</td>
                            </tr>
                            `).join('')}
                        </tbody>
                    </table>
                    
                    <h3>待发送队列 (${realPlan.requests.length})</h3>
                    ${renderRequests(realPlan.requests)}
                </div>

                <div class="card" style="border-top: 4px solid #9333ea;">
                    <h2><span class="tag-sim">SIMULATION</span> 全员强制续期模拟 (假设无记录)</h2>
                    <div class="sim-banner">
                        💡 场景说明：假设数据库中所有人员记录丢失或过期，系统将从“今天”开始生成完整补齐计划。此数据仅用于测试，不会发送。
                    </div>
                    
                    <h3>生成的模拟数据包 (${simulatedPlan.requests.length})</h3>
                    ${renderRequests(simulatedPlan.requests)}
                </div>
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

// 辅助渲染函数
function renderRequests(requests) {
    if (requests.length === 0) return '<div style="padding:20px; text-align:center; color:#999; border:1px dashed #ddd; border-radius:8px;">暂无数据包生成</div>';
    
    return requests.map(req => `
    <div class="request-item">
        <details>
            <summary class="req-header">
                <div>
                    <strong>[Day ${req.dayIndex}] ${req.targetDate}</strong>
                    <span style="margin-left:10px;">👥 ${req.people}</span>
                </div>
                <span>▼ 展开详情</span>
            </summary>
            
            <div class="code-container">
                <button class="copy-btn" onclick='copyText(this, ${JSON.stringify(req.rawJson)})'>Copy JSON</button>
                <div style="margin-bottom:5px; font-weight:bold; color:#fff;">原始 JSON:</div>
                <pre class="code-block json-block">${req.rawJson}</pre>
            </div>
            
            <div class="code-container" style="border-top:1px solid #444;">
                <button class="copy-btn" onclick='copyText(this, "${req.encodedBody}")'>Copy Encoded</button>
                <div style="margin-bottom:5px; font-weight:bold; color:#fff;">URL Encoded Body (Ready to Send):</div>
                <pre class="code-block url-block">${req.encodedBody}</pre>
            </div>
        </details>
    </div>
    `).join('');
}

// --- 主逻辑路由 ---
router.get('/auto-renew', async (req, res) => {
    const logs = [];
    // 简单的内存日志
    const log = (msg) => { console.log(msg); logs.push(msg); };
    
    // 结构化结果数组
    const results = [];
    
    try {
        log("=== 🚀 开始自动续期流程 (Smart Catch-up Fixed) ===");
        
        const idStatusMap = await getAllStatuses();
        const plan = calculatePlan(idStatusMap);
        
        if (plan.requests.length === 0) {
            log("✨ 所有人员状态正常，无需续期。");
            res.type('text/plain').send("✅ Status OK: No renewal needed.\n\n" + logs.join('\n'));
            return;
        }

        log(`📝 计划生成完成，共 ${plan.requests.length} 个请求包，开始执行...`);

        for (const reqTask of plan.requests) {
            // 串行执行以保证顺序和日志清晰
            const result = await submitApplication(reqTask.ts, reqTask.ids);
            if (result) results.push(result);
            // 稍微长一点的延迟防止并发过快
            await delay(1000); 
        }

        log("=== 🏁 流程结束 ===");
        
        // 构造漂亮的返回报告
        let report = "📊 自动续期执行报告\n========================\n";
        results.forEach((r, idx) => {
            const icon = r.success ? "✅" : "❌";
            report += `${icon} [Batch ${idx+1}] 日期: ${r.date}\n`;
            report += `    人员: ${r.names}\n`;
            report += `    状态: ${r.success ? "成功 (" + r.id + ")" : "失败 (" + r.msg + ")"}\n`;
            report += "------------------------\n";
        });
        
        report += "\n🔍 系统日志:\n" + logs.join('\n');

        res.type('text/plain').send(report);

    } catch (err) {
        console.error(err);
        res.status(500).send("Server Error: " + err.message);
    }
});

module.exports = router;