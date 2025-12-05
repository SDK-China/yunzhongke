const express = require('express');
const axios = require('axios');
const router = express.Router();

// ================= 配置区域 =================
const CONFIG = {
    // 待查询的列表 (Base64编码的身份证号) - 与 visitorApprovalQuery.js 保持一致
    visitorIdNos: [
        "MTMwMzIzMTk4NjAyMjgwODFY", // 康伟强
        "MTMwMzIyMTk4ODA2MjQyMDE4", // 张强
        "MTMwNDI1MTk4OTA4MjkwMzE0", // 姜建龙
        "MjMwMjMwMjAwMzAxMDEyMTM1", // 孙德凯
        "MTMxMTIxMTk4OTAxMDU1MDEx", // 王菁
        "NDEwNDIzMTk4OTA3MjIxNTMw", // 田乐乐
        "MDMwNzE3Njg="              // 贾文选
    ],
    regPerson: "17614625112",
    acToken: "E5EF067A42A792436902EB275DCCA379812FF4A4A8A756BE0A1659704557309F",
    
    // 自动续期设置
    renewDays: 7,           // 每次续期总天数
    renewThreshold: 2,      // 阈值：如果 (最后日期 - 今天) <= 2天，则续期
    requestInterval: 50     // 每次发包间隔 (毫秒)
};

// ================= 数据模板区域 =================
// 提取出的完整表单数据 JSON 字符串 (未编码状态)
const FORM_TEMPLATE_JSON_STR = `[{"componentName":"SerialNumberField","fieldId":"serialNumberField_lxn9o9dx","label":"单号信息","fieldData":{}},{"componentName":"TextField","fieldId":"textField_lxn9o9e0","label":"申请类型","fieldData":{"value":"一般访客"}},{"componentName":"TextField","fieldId":"textField_ly2ugh3m","label":"申请人ID","fieldData":{"value":"17614625112"}},{"componentName":"TextField","fieldId":"textField_lydnpzas","label":"地区代码","fieldData":{"value":"QHD"}},{"componentName":"TextField","fieldId":"textField_ly3uw4as","label":"法人代码","fieldData":{"value":"1070"}},{"componentName":"TextField","fieldId":"textField_ly3uw4ar","label":"园区代码","fieldData":{"value":"QA"}},{"componentName":"TextField","fieldId":"textField_m2lk8mr2","label":"供应商code","fieldData":{"value":"VCN01135"}},{"componentName":"RadioField","fieldId":"radioField_m4g9sf7c","label":"是否外籍","fieldData":{"value":"否","text":"否"},"options":[{"defaultChecked":true,"syncLabelValue":true,"__sid":"item_m4g9skpu","text":"否","__sid__":"serial_m4g9skpu","value":"否","sid":"serial_m4g9skpu"}]},{"componentName":"SelectField","fieldId":"selectField_ly3o95xh","label":"到访园区","fieldData":{"value":"秦皇岛园区","text":"秦皇岛园区"},"options":[{"value":"秦皇岛园区","text":"秦皇岛园区"}]},{"componentName":"SelectField","fieldId":"selectField_ly3o95xf","label":"到访公司","fieldData":{"value":"宏启胜精密电子(秦皇岛)有限公司","text":"宏启胜精密电子(秦皇岛)有限公司"},"options":[{"value":"宏启胜精密电子(秦皇岛)有限公司","text":"宏启胜精密电子(秦皇岛)有限公司"}]},{"componentName":"SelectField","fieldId":"selectField_lxn9o9eb","label":"身份类型","fieldData":{"value":"生产服务（厂商）","text":"生产服务（厂商）"},"options":[{"value":"生产服务（厂商）","text":"生产服务（厂商）"}]},{"componentName":"SelectField","fieldId":"selectField_lxn9o9ed","label":"服务性质/到访事由","fieldData":{"value":"设备维护","text":"设备维护"},"options":[{"value":"设备维护","text":"设备维护"}]},{"componentName":"SelectField","fieldId":"selectField_lxn9o9ei","label":"到访区域","fieldData":{"value":"进入制造现场","text":"进入车间/管制区域"},"options":[{"defaultChecked":false,"syncLabelValue":false,"__sid":"item_m56iixss","text":"进入车间/管制区域","__sid__":"serial_m56iixsp","value":"进入制造现场","sid":"serial_khe7yak4"}]},{"componentName":"TextareaField","fieldId":"textareaField_lxn9o9eg","label":"服务/事由描述","fieldData":{"value":"设备维护与保养"}},{"componentName":"SelectField","fieldId":"selectField_lxn9o9em","label":"所属公司","fieldData":{"value":"VCN01135(昆山友景电路板测试有限公司)"},"options":[]},{"componentName":"TextField","fieldId":"textField_lxn9o9gc","label":"所属公司/单位名称","fieldData":{"value":"VCN01135(昆山友景电路板测试有限公司)"}},{"componentName":"RadioField","fieldId":"radioField_lzs3fswt","label":"是否为竞商？","fieldData":{"value":"否","text":"否"},"options":[{"defaultChecked":true,"syncLabelValue":true,"__sid":"item_lzs3ftx2","text":"否","__sid__":"serial_lzs3ftx2","value":"否","sid":"serial_lzs3ftx2"}]},{"componentName":"TableField","fieldId":"tableField_lxv44os5","label":"人员信息","fieldData":{"value":[]},"listNum":50},{"componentName":"TextField","fieldId":"textField_lxn9o9f9","label":"接待人工号","fieldData":{"value":"61990794"}},{"componentName":"TextField","fieldId":"textField_lxn9o9f7","label":"接待人员","fieldData":{"value":"王晗"}},{"componentName":"TextField","fieldId":"textField_lxn9o9fc","label":"接待部门","fieldData":{"value":"QA08設備五課"}},{"componentName":"TextField","fieldId":"textField_lxn9o9fe","label":"接待人联系方式","fieldData":{"value":"17531114022"}},{"componentName":"DateField","fieldId":"dateField_lxn9o9fh","label":"到访日期","fieldData":{"value":1765036800000},"format":"yyyy-MM-dd"},{"componentName":"TextField","fieldId":"textField_m4c5a419","label":"涉外签核","fieldData":{"value":"61990414"}},{"componentName":"TextField","fieldId":"textField_m4c5a41a","label":"门岗保安","fieldData":{"value":"15232353238"}}]`;

const REQUEST_HEADERS = {
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
    "cookie": "tianshu_corp_user=ding2b4c83bec54a29c6f2c783f7214b6d69_FREEUSER; tianshu_csrf_token=e7daa879-7b83-40f7-8335-1a262747f2c9; c_csrf=e7daa879-7b83-40f7-8335-1a262747f2c9; cookie_visitor_id=zfGITZnn; cna=QhOGIdjbQ3ABASQOBEFsQ0YG; xlly_s=1; tianshu_app_type=APP_GRVPTEOQ6D4B7FLZFYNJ; JSESSIONID=BF2C6304A367F22183E99C3E5B5181C4; tfstk=gOZxf6D0ah_YmbR2H5blSie9vWyOMa2qeSyBjfcD57F8iJ8615qgycFzMIcmSS4-67N-GjmfQ1Fun54imlewXAw__tlG3a243co1t6qOx-yqEsPFbo36NgwrKxT1rqiRmR_At6jhqZ9SXsC3nq6jmbMZNxMXlE6-VAH6fcgjG36-CAAX5jN_FThrQAOXfhG5VAkB5ci_186-QbGsfqN_FTHZNf91kGhG5b-Tu6E2PQTVe3t72x3x1HG9XDqyxFGLhbtMyWMxkt2jwht_4PdnXxc1VBhaV5nIku6MWXnrwAHYDOYE_yDTCvnBhny8G7ZKRufyjfsyqkqd5-AnU0LfeTLw7qMrh42tpxCQDiM-tTfH7FuY8YhheTLw7qMreXXrUF8Zky5..; isg=BJCQbJGPzSIDPJDoHxPbfgneatziWXSjkwUE44pgG-BuxflvPmhTMY7zmMuAWSx7",
    "priority": "u=1, i"
};

// ================= 加密数据区域 (保护隐私) =================
// 包含所有人员的敏感信息，全部为 Base64 编码
const ENCRYPTED_DATA = [
    {
        id: "MTMwMzIzMTk4NjAyMjgwODFY",
        name: "5bq35Lyf5by6", // 康伟强
        phone: "MTMzMzMzNDgyMjg=",
        img: {
            name: "bW1leHBvcnQxNzU5MjAxNjUxNTAwLmpwZw==",
            url: "aHR0cHM6Ly9kaW5ndGFsay5hdmFyeWhvbGRpbmcuY29tOjg0NDMvZGluZ3BsdXMvaW1hZ2UvMjAyNTA5MzAvYzJlYjJmMDI2YjVmNjFiOGQ2NGFmNWE3NjJhNmJhZWEuanBn",
            size: 231994
        },
        idImg: [{
            name: "bW1leHBvcnQxNzU5MjAxNjM1NTE0LmpwZw==",
            url: "L28vMkZENjZJNzFYSjhaRU1XS0ZHM08zQlZET0pWTjJURFo5RjZHTVM1P2FwcFR5cGU9QVBQX0dSVlBURU9RNkQ0QjdGTFpGWU5KJmZpbGVOYW1lPUFQUF9HUlZQVEVPUTZENEI3RkxaRllOSl9Na1pFTmpaSk56RllTamhhUlUxWFMwWkhNM08zQlZET0pWTjJURFo5RjZHTVMxLmpwZyZpbnN0SWQ9JnR5cGU9ZG93bmxvYWQ=",
            size: 1428463
        }],
        jobProof: {
            name: "bW1leHBvcnQxNzU5MjAxNjU1ODAxLmpwZw==",
            url: "L28vSzc2NjZKQzFBSzhaU0JWWDhJSk9QNzFQSEdOTDM0STJBRjZHTUU1P2FwcFR5cGU9QVBQX0dSVlBURU9RNkQ0QjdGTFpGWU5KJmZpbGVOYW1lPUFQUF9HUlZQVEVPUTZENEI3RkxaRllOSl9TemMyTmpaS1F6RkJTemhhVTBKV1dEaEpTazlRTXpGUVNFZE9URE0wU1RKS1FqWkhUVVUxLmpwZyZpbnN0SWQ9JnR5cGU9ZG93bmxvYWQ=",
            size: 304370
        }
    },
    {
        id: "MTMwMzIyMTk4ODA2MjQyMDE4",
        name: "5byg5by6", // 张强
        phone: "MTc3MzM1MzIwNTc=",
        img: {
            name: "bW1leHBvcnQxNzU5MjAxNjQ5NjA3LmpwZw==",
            url: "aHR0cHM6Ly9kaW5ndGFsay5hdmFyeWhvbGRpbmcuY29tOjg0NDMvZGluZ3BsdXMvaW1hZ2UvMjAyNTA5MzAvMmUzNjc5NmQ1NWRmNjU3MGIzMDgxNDY3M2RkNzljN2QuanBn",
            size: 64695
        },
        idImg: [{
            name: "bW1leHBvcnQxNzU5MjAxNjM5MzI3LmpwZw==",
            url: "L28vR05DNjZFOTFaUjdaRkxUSDhPRkVQNDZDQjlKRzNFVUhERjZHTU9CP2FwcFR5cGU9QVBQX0dSVlBURU9RNkQ0QjdGTFpGWU5KJmZpbGVOYW1lPUFQUF9HUlZQVEVPUTZENEI3RkxaRllOSl9SMDVETmpaR1JUVXhabEl3Wmtac1ZFRklPRTlHUlZBME5rTkRRMkpLUnpORlZVaEVSalZIVFU1Qy5qcGcmaW5zdElkPSZ0eXBlPWRvd25sb2Fk",
            size: 531330
        }],
        jobProof: {
            name: "bW1leHBvcnQxNzU5MjAxNjU1ODAxLmpwZw==",
            url: "L28vTExGNjZGRDFWSjhaVTU2SEVGUkk0QlBXUFVCRzIyRE1ERjZHTU40P2FwcFR5cGU9QVBQX0dSVlBURU9RNkQ0QjdGTFpGWU5KJmZpbGVOYW1lPUFQUF9HUlZQVEVPUTZENEI3RkxaRllOSl9URXhHTmpaR1JERldTa2hhVlRVMldFVkdVa2swUWxCWFVGVkNsek15UkUxRVJqWkhUVTQwLmpwZyZpbnN0SWQ9JnR5cGU9ZG93bmxvYWQ=",
            size: 304370
        }
    },
    {
        id: "MTMwNDI1MTk4OTA4MjkwMzE0",
        name: "5aeQ5bu66b6Z", // 姜建龙
        phone: "MTM2MjU0MjIzNDY=",
        img: {
            name: "bW1leHBvcnQxNzU5MjAxNjU4MTk3LmpwZw==",
            url: "aHR0cHM6Ly9kaW5ndGFsay5hdmFyeWhvbGRpbmcuY29tOjg0NDMvZGluZ3BsdXMvaW1hZ2UvMjAyNTA5MzAvZWM5MjhlM2Y1NzU5MDY0YzRlMmUxYmY5Y2ZjMzBmMTQuanBn",
            size: 58436
        },
        idImg: [{
            name: "bW1leHBvcnQxNzU5MjAxNjU3MjQxLmpwZw==",
            url: "L28vVTFCNjZXOTE0SzhaWldVRkZORTRQQlpWWkgyRzI3RDhGRjZHTVU0P2FwcFR5cGU9QVBQX0dSVlBURU9RNkQ0QjdGTFpGWU5KJmZpbGVOYW1lPUFQUF9HUlZQVEVPUTZENEI3RkxaRllOSl9WVEZDTmpaX09URTBTemhhV2xkVlJrWk9SVFJRUWxwV1draHpSekkyUjFkRUl6UkVoU1oySFRVME1D5qcGcmaW5zdElkPSZ0eXBlPWRvd25sb2Fk",
            size: 37638
        }],
        jobProof: {
            name: "bW1leHBvcnQxNzU5MjAxNjU1ODAxLmpwZw==",
            url: "L28vNkFHNjZXODE0TDhaUFdZVTlFT0tYQjZOVFI4OTJPUEJGRjZHTVE1P2FwcFR5cGU9QVBQX0dSVlBURU9RNkQ0QjdGTFpGWU5KJmZpbGVOYW1lPUFQUF9HUlZQVEVPUTZENEI3RkxaRllOSl9Oa0ZITmpaWFdERTRURGhhVUZkWlZUbGZUMHRZUWpaT1ZGSTRPVEl3VUVKR1JqWkhUVlV4LmpwZyZpbnN0SWQ9JnR5cGU9ZG93bmxvYWQ=",
            size: 304370
        }
    },
    {
        id: "MjMwMjMwMjAwMzAxMDEyMTM1",
        name: "5a2Z5b635Yev", // 孙德凯
        phone: "MTc2MTQ2MjUxMTI=",
        img: {
            name: "SU1HMjAyNTA3MjkyMTEzNDQuanBn",
            url: "aHR0cHM6Ly9kaW5ndGFsay5hdmFyeWhvbGRpbmcuY29tOjg0NDMvZGluZ3BsdXMvaW1hZ2UvMjAyNTA4MDEvYWE0NTBlNWQ1MzMwOTcyZWFiY2U1ZWNiZjAxOWI1NzcuanBn",
            size: 211900
        },
        idImg: [
            {
                name: "bW1leHBvcnQxNzU0MDExOTc2NDc2LmpwZw==",
                url: "L28vTUxGNjYyQjFPOEpYOVdERUVLOFZMQUdOTTExSDNKUDVHNVNETTBGP2FwcFR5cGU9QVBQX0dSVlBURU9RNkQ0QjdGTFpGWU5KJmZpbGVOYW1lPUFQUF9HUlZQVEVPUTZENEI3RkxaRllOSl9UVXhHTmpZMk1rSXhQMEpZT1ZkRVJRVkxPRlpNUVVkT1RFZElNMHBXTlZjMU5RVk5UVEJHLmpwZyZpbnN0SWQ9JnR5cGU9ZG93bmxvYWQ=",
                size: 396211
            },
            {
                name: "bW1leHBvcnQxNzU0MDExOTc3ODA1LmpwZw==",
                url: "L28vRVdFNjZaOTE2QkpYQ0lQWDlONURPQUNRMTExSzNIUzhHNVNETTM4P2FwcFR5cGU9QVBQX0dSVlBURU9RNkQ0QjdGTFpGWU5KJmZpbGVOYW1lPUFQUF9HUlZQVEVPUTZENEI3RkxaRllOSl9SVmRGTmpaYU9URTJRa3BZUTBsUVdEbE9OVVJQUVVOUk1URXhLek5JVXpoSE5WTkZUVU00LmpwZyZpbnN0SWQ9JnR5cGU9ZG93bmxvYWQ=",
                size: 502357
            }
        ],
        jobProof: {
            name: "5Zyo6IGM6K+B5piOKy0r5a2Z5b635YevLnBkZg==",
            url: "L28vQjlDNjYwQzFNQkxYRDBOUzczVk1EN0pCTTJDUDM2Q0xINVNETUM0P2FwcFR5cGU9QVBQX0dSVlBURU9RNkQ0QjdGTFpGWU5KJmZpbGVOYW1lPUFQUF9HUlZQVEVPUTZENEI3RkxaRllOSl9RamxETmpZd016Rk5Ra3hZUkRCT1V6YzNWa01FTjBwQ1RUSkRVRE0yUTB4SU5WTkZUVUkwLnBkZiZpbnN0SWQ9JnR5cGU9ZG93bmxvYWQ=",
            size: 40638
        }
    },
    {
        id: "MTMxMTIxMTk4OTAxMDU1MDEx",
        name: "546L6I+B", // 王菁
        phone: "MTUzNjk2OTc2NTY=",
        img: {
            name: "bW1leHBvcnQxNzY0MDc5ODA0MDgwLmpwZw==",
            url: "aHR0cHM6Ly9kaW5ndGFsay5hdmFyeWhvbGRpbmcuY29tOjg0NDMvZGluZ3BsdXMvaW1hZ2UvMjAyNTExMjUvNzUyODNkZTBlMTE4Y2IyNGFkZjRkNWEwZWQ2YmFjNmYuanBn",
            size: 61062
        },
        idImg: [{
            name: "bW1leHBvcnQxNzY0MDc5MjQ5Mzk2LmpwZw==",
            url: "L28vNFVGNjY3NzFPSFMwQUlUV0dERzZNN1BYOFpZMjM3R05LTkVJTVpDP2FwcFR5cGU9QVBQX0dSVlBURU9RNkQ0QjdGTFpGWU5KJmZpbGVOYW1lPUFQUF9HUlZQVEVPUTZENEI3RkxaRllOSl9ORlZHTmpZMzN6RlBTRk13UVVsVVZUZEVSelpOTjFCW9GZaeU1qTTNSMDVMVGtWS1RZwWk1aQy5qcGcmaW5zdElkPSZ0eXBlPWRvd25sb2Fk",
            size: 173437
        }],
        jobProof: {
            name: "5Zyo6IGM6K+B5piOLnBkZg==",
            url: "L28vTlNHNjZKQjFMSFcwMjAwQ0hRRFNNQ0oxTDlWODIyWlBLTkVJTUo0P2FwcFR5cGU9QVBQX0dSVlBURU9RNkQ0QjdGTFpGWU5KJmZpbGVOYW1lPUFQUF9HUlZQVEVPUTZENEI3RkxaRllOSl9UbG5ITmpZkpRakZNU0Z4TXpBeU1EQkRTRkZFUjBWTkZ6c3hURExWMhJNMldGcExUa1ZKVFVrMC5wZGYmaW5zdElkPSZ0eXBlPWRvd25sb2Fk",
            size: 74505
        }
    },
    {
        id: "NDEwNDIzMTk4OTA3MjIxNTMw",
        name: "55Sw5LmQ5LmQ", // 田乐乐
        phone: "MTM3MzM3NzE2NjE=",
        img: {
            name: "bW1leHBvcnQxNzY0MDc3Njg3MjQ2LmpwZw==",
            url: "aHR0cHM6Ly9kaW5ndGFsay5hdmFyeWhvbGRpbmcuY29tOjg0NDMvZGluZ3BsdXMvaW1hZ2UvMjAyNTExMjUvY2U1ZTcxY2E1MTUyZjkzMDhkMTFmYTc5Mjc0YTJkYjQuanBn",
            size: 56562
        },
        idImg: [{
            name: "bW1leHBvcnQxNzY0MDc3Njg1Njk2LmpwZw==",
            url: "L28vSkhDNjZRODFBQ1gwQzFVNUtIN1RMQk9QUUxCODNTUThZTUVJTTQyP2FwcFR5cGU9QVBQX0dSVlBURU9RNkQ0QjdGTFpGWU5KJmZpbGVOYW1lPUFQUF9HUlZQVEVPUTZENEI3RkxaRllOSl9Ta2hETmpaUk9ERkJRMVl3UXpGVk5VdElOMVJNUWs5UVVVeENPRE5UVVRYWVRVRkpUVFF5LmpwZyZpbnN0SWQ9JnR5cGU9ZG93bmxvYWQ=",
            size: 327697
        }],
        jobProof: {
            name: "bW1leHBvcnQxNzY0MDc3NjgzNTUxLmpwZw==",
            url: "L28vUjdDNjZXNzFKRVMwVFM2R09NWDMwNEFLMFNJMjNGMk5aTUVJTVZMP2FwcFR5cGU9QVBQX0dSVlBURU9RNkQ0QjdGTFpGWU5KJmZpbGVOYW1lPUFQUF9HUlZQVEVPUTZENEI3RkxaRllOSl9VamRETmpZX056RktSVXN3VkZNMlIwOU5XRE13TkVGTE1GTkpNalRHMmt1YVRVRkpUVlpNLmpwZyZpbnN0SWQ9JnR5cGU9ZG93bmxvYWQ=",
            size: 95823
        }
    },
    {
        id: "MDMwNzE3Njg=",
        name: "6LS+5paH6YCJ", // 贾文选
        phone: "MTU2MjM0NTc2MjU=",
        img: {
            name: "bW1leHBvcnQxNzYwMDA3NTQ3OTE3LmpwZw==",
            url: "aHR0cHM6Ly9kaW5ndGFsay5hdmFyeWhvbGRpbmcuY29tOjg0NDMvZGluZ3BsdXMvaW1hZ2UvMjAyNTEwMTAvNjUyYTZmMGM2NWEyZmI0MGNkY2NjNTRlNGFmYmVjNTlkLmpwZw==",
            size: 144553
        },
        idImg: [{
            name: "bW1leHBvcnQxNzYwMDA3NTQ2NTY4LmpwZw==",
            url: "L28vR0k5NjZCQjFDUzdaQjEzWUJUTko5NU9WQkpMWTIxRjUzNUtHTThMP2FwcFR5cGU9QVBQX0dSVlBURU9RNkQ0QjdGTFpGWU5KJmZpbGVOYW1lPUFQUF9HUlZQVEVPUTZENEI3RkxaRllOSl9SMGs1TmpaQ1FqRkRVelRhUWpFeldVSlVUbmt5T1RWRFVrcE1XVEl4UmpVek5VdEhUVGRNLmpwZyZpbnN0SWQ9JnR5cGU9ZG93bmxvYWQ=",
            size: 302294
        }],
        jobProof: {
            name: "5Zyo6IGM6K+B5piOKy0r6LS+5paH6YCJLnBkZg==",
            url: "L28vNENCNjY3NzFCOThaNEZMVkFaRkxaNkxNWEQ5MjJLTDczNUtHTTlIP2FwcFR5cGU9QVBQX0dSVlBURU9RNkQ0QjdGTFpGWU5KJmZpbGVOYW1lPUFQUF9HUlZQVEVPUTZENEI3RkxaRllOSl9ORU5DTmpZMzN6RkNPREhhTkVaTVZrRmFSa3hhTmt4TldFUTVNakpMVERjek5VdEhUVGhJLnBkZiZpbnN0SWQ9JnR5cGU9ZG93bmxvYWQ=",
            size: 35594
        }
    }
];

// ================= 辅助函数 =================
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const getBeijingDayId = (ts) => {
    return Math.floor((parseInt(ts) + 28800000) / 86400000);
};

// 获取北京时间当前天ID
const getTodayId = () => getBeijingDayId(Date.now());

// 简单 Base64 解码函数
const safeDecode = (str) => {
    if (!str) return '';
    return Buffer.from(str, 'base64').toString('utf-8');
};

// 预处理：从 ENCRYPTED_DATA 中解密并构建 PEOPLE_DB
const PEOPLE_DB = {};

// 初始化函数：将加密配置转换为可用数据
const initPeopleDB = () => {
    try {
        // 辅助构建函数
        const buildRow = (id, name, phone, imgData, idImgList, jobProofData) => {
            // 处理身份证照片数组
            const idAttachments = idImgList.map(item => ({
                "name": safeDecode(item.name),
                "previewUrl": safeDecode(item.url), // 这里偷懒了，preview和download用同一个URL，原逻辑也是这样
                "downloadUrl": safeDecode(item.url),
                "size": item.size,
                "url": safeDecode(item.url),
                "fileUuid": safeDecode(item.url).split('fileName=')[1] ? safeDecode(item.url).split('fileName=')[1].split('&')[0] : ""
            }));

            // 处理在职证明
            const jobAttachments = [{
                "name": safeDecode(jobProofData.name),
                "previewUrl": safeDecode(jobProofData.url),
                "downloadUrl": safeDecode(jobProofData.url),
                "size": jobProofData.size,
                "url": safeDecode(jobProofData.url),
                "fileUuid": safeDecode(jobProofData.url).split('fileName=')[1] ? safeDecode(jobProofData.url).split('fileName=')[1].split('&')[0] : ""
            }];

            return [
                { "componentName": "SelectField", "fieldId": "selectField_lxv44orx", "label": "有效身份证件", "fieldData": { "value": (id.length > 10 && id.length < 15) ? "台胞证" : "身份证", "text": (id.length > 10 && id.length < 15) ? "台胞证" : "身份证" }, "options": [] },
                { "componentName": "TextField", "fieldId": "textField_lxv44ory", "label": "证件号码", "fieldData": { "value": id } },
                { "componentName": "TextField", "fieldId": "textField_lxv44orw", "label": "姓名", "fieldData": { "value": name } },
                { "componentName": "SelectField", "fieldId": "selectField_mbyjhot6", "label": "区号", "fieldData": { "value": "86", "text": "+86" }, "options": [] },
                { "componentName": "TextField", "fieldId": "textField_lxv44orz", "label": "联系方式", "fieldData": { "value": phone } },
                { "componentName": "ImageField", "fieldId": "imageField_ly9i5k5q", "label": "免冠照片", "fieldData": { "value": [{ "name": safeDecode(imgData.name), "previewUrl": safeDecode(imgData.url), "downloadUrl": safeDecode(imgData.url), "size": imgData.size, "url": safeDecode(imgData.url) }] } },
                { "componentName": "AttachmentField", "fieldId": "attachmentField_lxv44osj", "label": "身份证照片", "fieldData": { "value": idAttachments } },
                { "componentName": "AttachmentField", "fieldId": "attachmentField_lxv44osk", "label": "社保/在职证明", "fieldData": { "value": jobAttachments } },
                { "componentName": "AttachmentField", "fieldId": "attachmentField_lxv44osn", "label": "其他附件", "fieldData": { "value": [] } }
            ];
        };

        ENCRYPTED_DATA.forEach(person => {
            const realId = safeDecode(person.id);
            const realName = safeDecode(person.name);
            const realPhone = safeDecode(person.phone);
            
            // 构建 Row 并存入 DB
            PEOPLE_DB[realId] = buildRow(realId, realName, realPhone, person.img, person.idImg, person.jobProof);
        });
        
        console.log("✅ 敏感数据解密完成，PEOPLE_DB 初始化成功");

    } catch (e) {
        console.error("Init Error: Failed to build People DB", e);
    }
};

// 立即执行初始化
initPeopleDB();

// 提交单个申请（核心发包函数）
const submitApplication = async (personId, targetDateTs) => {
    // 1. 获取人员数据 (此时 keys 已经是解密后的明文 ID)
    const personRow = PEOPLE_DB[personId];
    if (!personRow) return `❌ 未找到人员 ${personId} 的详细信息，无法填表`;

    // 2. 准备 Form 数据
    // 深拷贝模板
    const formData = JSON.parse(FORM_TEMPLATE_JSON_STR);
    
    // 2.1 填充人员信息 (TableField)
    const tableField = formData.find(f => f.fieldId === 'tableField_lxv44os5');
    if (tableField) {
        tableField.fieldData.value = [personRow]; // 只放当前这个人
    }

    // 2.2 修改到访日期 (DateField)
    const dateField = formData.find(f => f.fieldId === 'dateField_lxn9o9fh');
    if (dateField) {
        // 目标时间戳 (必须保留毫秒格式)
        dateField.fieldData.value = targetDateTs; 
    }

    // 3. 序列化并 URL 编码
    const jsonStr = JSON.stringify(formData);
    const encodedValue = encodeURIComponent(jsonStr);

    // 4. 拼接请求体 (Body)
    const bodyStr = `_csrf_token=e7daa879-7b83-40f7-8335-1a262747f2c9&formUuid=FORM-2768FF7B2C0D4A0AB692FD28DBA09FD57IHQ&appType=APP_GRVPTEOQ6D4B7FLZFYNJ&value=${encodedValue}&_schemaVersion=653`;

    // 5. 发送请求
    const url = "https://iw68lh.aliwork.com/o/HW9663A19D6M1QDL6D7GNAO1L2ZC2NBXQHOXL3?_api=nattyFetch&_mock=false&_stamp=" + Date.now();
    
    try {
        const response = await axios.post(url, bodyStr, {
            headers: REQUEST_HEADERS
        });
        
        // 简单判断结果，这里假设返回 JSON
        if (response.data && response.data.success) {
            return `✅ 提交成功`;
        } else {
            return `⚠️ 提交响应: ${JSON.stringify(response.data).slice(0, 100)}`;
        }
    } catch (e) {
        return `❌ 请求失败: ${e.message}`;
    }
};

// ================= 路由区域 =================

// 测试路由
router.get('/test-cron', async (req, res) => {
    const beijingTime = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false });
    console.log(`[Cron Test] Triggered at ${beijingTime}`);
    res.json({ success: true, executedAt: beijingTime });
});

router.get('/test-cron-manual', async (req, res) => {
    res.json({ message: 'Use /test-cron' });
});

// --- 自动续期路由 ---
// router.get('/auto-visitor-renew', async (req, res) => {
//     const statusUrl = 'https://dingtalk.avaryholding.com:8443/dingplus/visitorConnector/visitorStatus';
//     const statusHeaders = {
//         "Content-Type": "application/json",
//         "User-Agent": "Mozilla/5.0 (Linux; Android 16; PJZ110 Build/BP2A.250605.015) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.7444.102 Mobile Safari/537.36"
//     };

//     let logs = [];
//     const log = (msg) => {
//         const time = new Date().toLocaleTimeString('zh-CN', { timeZone: 'Asia/Shanghai' });
//         logs.push(`[${time}] ${msg}`);
//         console.log(`[AutoRenew] ${msg}`);
//     };

//     log("开始执行自动续期检查...");

//     try {
//         const todayId = getTodayId();
//         const decodedIds = CONFIG.visitorIdNos.map(encoded => Buffer.from(encoded, 'base64').toString('utf-8'));

//         for (const id of decodedIds) {
//             // 1. 查询状态
//             let maxEndDate = 0;
//             let visitorName = "未知";

//             try {
//                 const response = await axios.post(statusUrl, {
//                     visitorIdNo: id,
//                     regPerson: CONFIG.regPerson,
//                     acToken: CONFIG.acToken
//                 }, { headers: statusHeaders, timeout: 5000 });

//                 if (response.data.code === 200 && response.data.data && response.data.data.length > 0) {
//                     const records = response.data.data;
//                     visitorName = records[0].visitorName;
                    
//                     // 找出最后一天的日期 (无论是审核中还是通过)
//                     records.forEach(r => {
//                         if (r.rangeEnd > maxEndDate) maxEndDate = r.rangeEnd;
//                     });
//                 } else {
//                     log(`⚪ ${id} 无申请记录`);
//                     continue; // 没记录就不管了，还是你想首次申请？假设只做续期
//                 }
//             } catch (err) {
//                 log(`❌ 查询 ${id} 状态失败`);
//                 continue;
//             }

//             // 2. 判断是否需要续期
//             // 逻辑: (LastDate - Today) <= 2 days
//             const lastDayId = getBeijingDayId(maxEndDate);
//             const diffDays = lastDayId - todayId;

//             log(`👤 ${visitorName}: 到期日 ${new Date(maxEndDate).toLocaleDateString()}, 剩余 ${diffDays} 天`);

//             if (diffDays <= CONFIG.renewThreshold) {
//                 log(`⚡ 触发续期流程 (剩余天数 <= ${CONFIG.renewThreshold})`);
                
//                 // 计算起始日期：最后一天的 次日 00:00:00
//                 // 注意：maxEndDate 是时间戳。
//                 // 算法：取 maxEndDate 的日期部分，加 1 天
//                 const lastDateObj = new Date(maxEndDate + 28800000); // 伪装成 UTC 处理北京时间
//                 lastDateObj.setUTCDate(lastDateObj.getUTCDate() + 1);
//                 lastDateObj.setUTCHours(0, 0, 0, 0);
//                 const startDateTs = lastDateObj.getTime() - 28800000; // 还原回真实时间戳

//                 // 3. 循环提交 CONFIG.renewDays 天
//                 for (let i = 0; i < CONFIG.renewDays; i++) {
//                     const targetTs = startDateTs + (i * 86400000); // + i 天
//                     const targetDateStr = new Date(targetTs + 28800000).toISOString().split('T')[0];
                    
//                     log(`   > 正在申请: ${targetDateStr} ...`);
                    
//                     const result = await submitApplication(id, targetTs);
//                     log(`     结果: ${result}`);

//                     await delay(CONFIG.requestInterval);
//                 }
//             } else {
//                 log(`   ✓ 无需续期`);
//             }
            
//             await delay(100); // 人员间隔
//         }

//         res.header('Content-Type', 'text/plain; charset=utf-8');
//         res.send(logs.join('\n'));

//     } catch (err) {
//         console.error(err);
//         res.status(500).send("System Error: " + err.message);
//     }
// });

// ================= 新增：调试用接口 (粘贴在 module.exports 之前) =================

router.get('/debug-body', async (req, res) => {
    try {
        // 1. 模拟数据：取配置里的第一个人 (康伟强)
        const testIdEncoded = CONFIG.visitorIdNos[0]; 
        const testId = Buffer.from(testIdEncoded, 'base64').toString('utf-8');
        
        // 2. 模拟场景：假设"查询到的最后日期"是今天
        const mockLastDate = new Date(); 
        mockLastDate.setHours(0,0,0,0);
        const mockLastDateTs = mockLastDate.getTime();

        // 3. 计算逻辑：生成"次日"的时间戳 (保持原有逻辑一致)
        const lastDateObj = new Date(mockLastDateTs + 28800000); 
        lastDateObj.setUTCDate(lastDateObj.getUTCDate() + 1); // +1 天
        lastDateObj.setUTCHours(0, 0, 0, 0);
        const targetTs = lastDateObj.getTime() - 28800000;

        // 4. 获取该人员的详细信息
        const personRow = PEOPLE_DB[testId];
        if (!personRow) return res.send(`❌ 错误：在数据库中找不到 ID 为 ${testId} 的人。`);

        // 5. 准备表单
        // 深拷贝模板，防止修改原数据
        const formData = JSON.parse(FORM_TEMPLATE_JSON_STR);
        
        // 5.1 填充人员 (TableField)
        const tableField = formData.find(f => f.fieldId === 'tableField_lxv44os5');
        if (tableField) {
            tableField.fieldData.value = [personRow]; 
        }

        // 5.2 修改时间 (DateField) -> 设置为计算出的"次日"
        const dateField = formData.find(f => f.fieldId === 'dateField_lxn9o9fh');
        if (dateField) {
            dateField.fieldData.value = targetTs; 
        }

        // 6. 核心步骤：生成 JSON 并转 URL 编码
        const jsonStr = JSON.stringify(formData);
        const encodedValue = encodeURIComponent(jsonStr);

        // 7. 拼接最终的 Body 字符串 (模拟 request.hcy 的格式)
        const fullBody = `_csrf_token=e7daa879-7b83-40f7-8335-1a262747f2c9&formUuid=FORM-2768FF7B2C0D4A0AB692FD28DBA09FD57IHQ&appType=APP_GRVPTEOQ6D4B7FLZFYNJ&value=${encodedValue}&_schemaVersion=653`;

        // 8. 格式化输出
        const output = [];
        output.push(`🛠️ [调试模式] 请求体生成演示`);
        output.push(`----------------------------------------`);
        // 注意：personRow[2] 是姓名 component
        output.push(`👤 模拟人员: ${personRow[2].fieldData.value} (${testId})`);
        output.push(`📅 模拟最后日期: ${new Date(mockLastDateTs).toLocaleDateString()} (假设这是系统查到的最后一天)`);
        output.push(`🚀 生成申请日期: ${new Date(targetTs).toLocaleDateString()} (这是自动计算出的次日)`);
        output.push(`🔢 原始时间戳: ${targetTs}`);
        output.push(`----------------------------------------`);
        output.push(`📋 最终生成的 POST Body (已 URL 编码):`);
        output.push(``);
        output.push(fullBody);

        res.header('Content-Type', 'text/plain; charset=utf-8');
        res.send(output.join('\n'));

    } catch (err) {
        res.status(500).send("调试接口出错: " + err.message);
    }
});

module.exports = router;