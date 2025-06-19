const {PosPrinter} = require("electron-pos-printer");
const {config, shop, getConfig} = require("./global");
const path = require("path");
const fs = require("fs");
const {readFileSync} = require("node:fs");
const {request} = require("node:https");
const {openCashDrawer} = require("./lib");
const log = require("electron-log");
let api;
let host = `http://${config['serverApiHost']}`;
api = {
    "getMessage": `${host}/nxcloud-app-bff/nxcloud/nxcloud-app-bff/PrintQueueApi/getMessage`,
    "saveSysSetting": `${host}/nxcloud-app-bff/nxcloud/nxcloud-app-bff/SysSettingApi/saveSysSetting`
};

let counterOnMessage = 0;
function getMessage(shopCode) {
    counterOnMessage++;
    log.info('Messages (%s) is sent to printer In Shop(%s)', counterOnMessage, shopCode);
    fetch(api.getMessage, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Nxcloud-Owner': shopCode,
        },
        body: JSON.stringify({'count': 1})
    })
        .then(response => response.json())
        .then(data => {
            if (data.code === 0 && data.data != null) {
                for (let i = 0; i < data.data.length; i++) {
                    sendToPrinterWithData(data.data[i]['printerName'], data.data[i]['printWidth'], data.data[i]['printContent']);
                }
            }
            return data;
        })
        .catch((error) => {
            console.error('Error:', error);
        });
}

function savePrinters(shopCode, strPrinters) {
    if (shopCode !== null && shopCode.trim().length > 0) {
        var data = {
            'key': shopCode,
            'content': strPrinters
        };
        fetch(api.saveSysSetting, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Nxcloud-Owner': shopCode,
            },
            body: JSON.stringify(data)
        })
            .then(response => response.json())
            .then(data => {
                if (data.code === 0) {
                    console.info('printers is saved! shopCode is %s %s', shopCode, strPrinters);
                }
            })
            .catch((error) => {
                console.error('Error:', error);
            });

    }
}

function parsePageSizeString(pageSizeStr) {
    if (typeof pageSizeStr !== 'string') {
        console.error("Invalid input: pageSizeStr must be a string.");
        return null; // Or throw an error
    }

    // If the string does not contain '*', return the original string
    if (!pageSizeStr.includes('*')) {
        return pageSizeStr;
    }

    // Proceed with parsing if '*' is present
    const parts = pageSizeStr.split('*');
    if (parts.length !== 2) {
        console.error("Invalid pageSizeStr format for parsing. Expected two dimensions separated by '*'.");
        return null; // Or return the original string if that's preferred for this specific error
    }

    const widthStr = parts[0].toLowerCase().replace('mm', '').trim();
    const heightStr = parts[1].toLowerCase().replace('mm', '').trim();

    const width = parseInt(widthStr, 10);
    const height = parseInt(heightStr, 10);

    if (isNaN(width) || isNaN(height)) {
        console.error("Could not parse width or height from string parts.");
        return null; // Or return the original string
    }

    // Assuming the conversion from mm to the desired unit involves multiplying by 10
    return {
        "width": width * 10,
        "height": height * 10
    };
}

// 打印机，打印小票
// 打印机配置options，放到方法体中。打印过程改成同步方法。放置频繁更换打印机出现的参数混乱。
async function printReceipt(printName, pageWidth = '78mm', printData) {
    var receiptWidth = parsePageSizeString(pageWidth);
    console.log(`>>> printName %s, pageWidth: %s, receiptWidth: %s`, printName, pageWidth, receiptWidth);
    const options = {
        preview: config['printPreview'] ?? false,
        silent: true,
        margin: 'auto',
        timeOutPerLine: 400,
        copies: 1,
        printerName: '',
        openCashDrawer: true,
        drawerNumber: 0,
        margins: {
            top: 0,
            bottom: 0,
            right: 10,
            left: 10
        },
        dpi: {
            vertical: 15,
            horizontal: 15
        },
        pageSize: receiptWidth  // page size
    };
    options['printerName'] = printName;
    await PosPrinter.print(JSON.parse(printData), options).then(() => {
        console.info('print receipt is successful');
    }).catch();
}

function getCurrentLocation(callback) {
    getConfig();
    // Check if the API key is available in the config
    if (!config['googleMapsApiKey']) {
        console.error('Google Maps API key is missing in config.');
        callback(new Error('Google Maps API key is missing in config.'), null);
        return;
    }

    const apiKey = config['googleMapsApiKey'];
    const url = `https://www.googleapis.com/geolocation/v1/geolocate?key=${apiKey}`;

    const options = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
    };

    const req = request(url, options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
            data += chunk;
        });

        res.on('end', () => {
            try {
                const response = JSON.parse(data);
                if (response.location) {
                    const location = {
                        latitude: response.location.lat,
                        longitude: response.location.lng,
                        accuracy: response.accuracy
                    };
                    callback(null, location);
                } else if (response.error) {
                    callback(new Error(`Google Maps API Error: ${response.error.message}`), null);
                } else {
                    callback(new Error('Unexpected response from Google Maps API.'), null);
                }
            } catch (error) {
                callback(error, null);
            }
        });
    });

    req.on('error', (error) => {
        callback(error, null);
    });

    // Send an empty JSON body as per the API requirements
    req.write('{}');
    req.end();
}

function sendToPrinterWithData(printerName = '', pageWidth = '78mm', printContent) {
    if (printContent !== null && printContent.trim() !== ''
        && printerName !== null && printerName.trim() !== '') {
        printReceipt(printerName, pageWidth, printContent).then((value) => {
            log.info(' printer(%s) has printed a receipt(%s) successfully', printerName, pageWidth);
        });
    }
}

/// 测试小票
function printTestPage(printerName = '', pageWidth = '78mm') {
    const formattedDateTime = getFormattedCurrentDateTime();
    /// 打印78mm的测试小票
    var printContent = `[
        {"type":"text","value":"${printerName}", "style":{"fontSize": "20px", "padding-left": "5px", "padding-right": "5px","font-family": "微软雅黑"}},
        {"type":"text","value":"Test status: Passed", "style":{"fontSize": "20px", "padding-left": "5px", "padding-right": "5px","font-family": "微软雅黑"} },
        {"type":"text","value":"<br>", "style":{}}, 
        {"type":"text","value":"${formattedDateTime}", "style":{ "textAlign": "left", "padding-left": "5px", "padding-right": "5px","font-family": "微软雅黑"} },
        { "type": "text", "value": "<br>", "style": {} }
    ]`;
    /// 宽度小于50mm时，例如打印40mm*30mm, 测试小票
    if (pageWidth.split('*')[0].replace('mm', '').trim() <= 50) {
        printContent = `[
        {"type":"text","value":"${printerName}", "style":{"fotnSize": "10px", "textAlign": "left", "padding-left": "1px", "padding-right": "5px","font-family": "微软雅黑"}},
        {"type":"text","value":"Test status: Passed", "style":{"fotnSize": "10px", "textAlign": "left", "padding-left": "1px", "padding-right": "5px","font-family": "微软雅黑"} },
        {"type":"text","value":"<br>", "style":{}}, 
        {"type":"text","value":"${formattedDateTime}", "style":{ "textAlign": "left", "padding-left": "5px", "padding-right": "5px","font-family": "微软雅黑"} },
        { "type": "text", "value": "<br>", "style": {} }
    ]`;
    }
    if (printerName !== null && printerName.trim() !== '') {
        printReceipt(printerName, pageWidth, printContent).then(r => {
            // openCashDrawer(printerName).then();
            console.info('>>> %s is printed OK.', printerName);
        });
    }
}


/// 获得当前日期时间
function getFormattedCurrentDateTime() {
    const now = new Date();

    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0'); // Months are 0-indexed
    const day = now.getDate().toString().padStart(2, '0');

    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const seconds = now.getSeconds().toString().padStart(2, '0');

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

function openLogFile() {
    const date = new Date();
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const fileName = `receipt-${year}-${month}-${day}.csv`;
    const filePath = path.join(__dirname, fileName);
    if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, '');
    }
    return fileName;
}

module.exports = {
    getMessage,
    printReceipt,
    savePrinters,
    getCurrentLocation,
    openLogFile,
    printTestPage
};
