// noinspection JSCheckFunctionSignatures

const {join} = require("node:path");
const {readFileSync} = require("node:fs");
const path = require("path");
const fs = require("fs");

var config;
var shop = {'ownerId': ''};
var deviceId;

/// 获取config，从文件中
function getConfig() {
    const CONFIG_FILE_PATH = join(__dirname, 'config.json');
    config = JSON.parse(readFileSync(CONFIG_FILE_PATH));
    getExistedDeviceUuid(config);
    return config;
}

function getExistedDeviceUuid(config) {
   if (config['deviceId'] === undefined ) {
      config['deviceId'] = genUuid();
      writeFile('config.json', JSON.stringify(config));
   }
   return config['deviceId'];
}

function genUuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

function writeFile(filePath, data) {
    try {
        const p = path.join(__dirname, filePath);
        fs.writeFileSync(p, data);
    } catch (err) {
        console.error(`Error writing to ${filePath}:`, err);
    }
}

getConfig();

module.exports = {config, shop, getConfig, writeFile};