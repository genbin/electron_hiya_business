const {PosPrinter} = require("electron-pos-printer");
const {config, shop, getConfig} = require("./global");
const path = require("path");
const fs = require("fs");
const {readFileSync} = require("node:fs");
const {request} = require("node:https");
let api;
let host = `http://${config['serverApiHost']}`;
api = {
    "getMessage": `${host}/nxcloud-app-bff/nxcloud/nxcloud-app-bff/PrintQueueApi/getMessage`,
    "saveSysSetting": `${host}/nxcloud-app-bff/nxcloud/nxcloud-app-bff/SysSettingApi/saveSysSetting`
};

function getMessage(shopCode) {
    console.info('getMessage is called %s', shopCode);
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
                    // console.info('print receipt %o', data.data);
                    _printItWithData(data.data[i]['printerName'], data.data[i]['printContent']);
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

// 打印机，打印小票
// 打印机配置options，放到方法体中。打印过程改成同步方法。放置频繁更换打印机出现的参数混乱。
async function printReceipt(printName, printData) {
    var options = {
        preview: false,               //  width of content body
        silent: true,
        copies: 1,                    // Number of copies to print
        printerName: '',        // printerName: string, check with webContent.getPrinters()
        openCashDrawer: true, // Open the cash drawer after printing
        drawerNumber: 1, // Specify drawer number, default is 1
        timeOutPerLine: 1000,
        pageSize: '80mm'  // page size
    }
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

function _printItWithData(printerName = '', printContent) {
    if (printContent !== null && printContent.trim() !== ''
        && printerName !== null && printerName.trim() !== '') {
        printReceipt(printerName, printContent);
    }
}

function printTestPage(printerName = '') {
    var printContent = `[
        {"type":"text","value":"${printerName}","style":{ "fontWeight": "500", "textAlign": "center", "fontSize": "24px" }},
        {"type":"text","value":"Test status: Passed","style":{ "fontWeight": "700", "textAlign": "left", "fontSize": "24px" }},
        {"type":"text","value":"<br>","style":{}},{"type":"text","value":"2025-05-21 14:39:09","style":{"textAlign":"center"}},
        { "type": "text", "value": "<br>", "style": {} }
    ]`;
    if (printerName !== null && printerName.trim() !== '') {
        printReceipt(printerName, printContent);
    }
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

function formatDate(timestamp) {
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
}

module.exports = {getMessage, printReceipt, savePrinters, getCurrentLocation, openLogFile, printTestPage};
