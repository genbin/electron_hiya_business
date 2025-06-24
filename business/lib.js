const {BrowserWindow, ipcMain, app, ipcRenderer,} = require('electron');
const path = require('path');
const fs = require('fs');
const yaml = require('js-yaml');
const {getMessage, printReceipt, savePrinters, getCurrentLocation, printTestPage} = require("./api");
const {config, shop, getConfig, writeFile} = require("./global");
const {screen} = require("electron");
const electron = require("electron");
const {autoUpdater} = require('electron-updater');
const log = require('electron-log'); // 可选，用于日志记录
const bonjour = require('bonjour')();
const { commandsToTry } = require('./cashDrawerCommands'); // <--- 新增引入

// 配置 autoUpdater 日志
autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = 'info';
log.info('App starting...')
const net = require('net');
let win;
// Create main window
function createMainWindow(isVisible) {
    const size = screen.getPrimaryDisplay().size;
    win = new BrowserWindow({
        height: size.height,
        width: size.width,
        minWidth: config["minWidth"],
        minHeight: config["minHeight"],
        title: getTitleVersion(),
        resizable: true,
        show: isVisible,
        fullscreenable: true,
        autoHideMenuBar: true,
        center: true,
        webPreferences: {
            additionalArguments: [],
            allowRunningInsecureContent: true,
            nodeIntegration: false, // Do not enable Node.js integration
            contextIsolation: true, // 启用隔离
            devTools: false,
            webSecurity: true, //禁用同源策略
            nativeWindowOpen: true, //是否使用原生的window.open()
            sandbox: false,
            preload: path.join(__dirname, '../preload.js')
        }
    });

    let serverUrl = config['serverAddress'];
    if (config['isTest']) {
        serverUrl = config['testAddress'];
    }
    win.loadURL(serverUrl).then(r => {
        _debug();

    }).catch((err) => {
        console.log(err);
    });

    win.on('show', () => {
    })

    win.on('close', (e) => {
        const choice = electron.dialog.showMessageBoxSync(win, {
            type: 'info',
            title: '提示',
            message: '确认退出?', // 稍微修改了下提示信息，更像一个问题
            buttons: ['最小化运行', '立即退出', '取消'], // 增加了 "取消" 按钮
            defaultId: 0, // "最小化运行" 仍然是默认
            cancelId: 2   // 将 "取消" 按钮设置为取消操作 (例如按 ESC 键会选中此项)
        });

        if (choice === 0) { // 用户选择 "最小化运行"
            e.preventDefault();
            win.minimize();
        } else if (choice === 2) { // 用户选择 "取消"
            e.preventDefault(); // 阻止窗口关闭
        }
        // 如果 choice === 1 ("立即退出")，则不执行 e.preventDefault()，窗口会正常关闭
    });

    // 自动更新事件监听
    autoUpdater.on('checking-for-update', () => {
        log.info('正在检查更新...');
        // 你可以发送消息到渲染进程，告知用户正在检查更新
        win.webContents.send('update-message', '正在检查更新...');
    });

    autoUpdater.on('update-available', (info) => {
        log.info('检测到新版本:', info.version);
        win.webContents.send('update-message', `检测到新版本 ${info.version}，正在下载...`);
        // 可以选择在这里提示用户，或者等待下载完成
    });

    autoUpdater.on('update-not-available', (info) => {
        log.info('当前已是最新版本。');
        win.webContents.send('update-message', '当前已是最新版本。');
    });

    autoUpdater.on('error', (err) => {
        log.error('自动更新出错: ' + err.message);
        // mainWindow.webContents.send('update-message', `更新出错: ${err.message}`);
    });

    autoUpdater.on('download-progress', (progressObj) => {
        let log_message = `下载速度: ${progressObj.bytesPerSecond} - 已下载 ${progressObj.percent.toFixed(2)}% (${progressObj.transferred}/${progressObj.total})`;
        log.info(log_message);
        // 更新渲染进程中的下载进度条
        win.webContents.send('update-download-progress', progressObj.percent);
    });

    autoUpdater.on('update-downloaded', (info) => {
        log.info('新版本下载完成，版本号:', info.version);
        // mainWindow.webContents.send('update-message', `新版本 ${info.version} 下载完成。即将重启应用以安装。`);

        // 提示用户重启应用以完成更新
        const dialogOpts = {
            type: 'info',
            buttons: ['立即重启', '稍后重启'],
            title: '应用更新',
            message: process.platform === 'win32' ? info.releaseNotes : info.releaseName,
            detail: '新版本已下载。重启应用程序以应用更新。'
        };

        electron.dialog.showMessageBox(win, dialogOpts).then((returnValue) => {
            if (returnValue.response === 0) { // "立即重启"
                autoUpdater.quitAndInstall();
            }
        });
    });

    // 处理来自浏览器内部的调用，保存shopCode，并开启打印
    let messageIntervalId = null;
    let checkPrinterIntervalId = null;
    ipcMain.on('save-user-login-data', (event, data) => {
        if (data != null && data.trim().length > 0) {
            shop['ownerId'] = data;
            /// 清除之前可能存在的interval, 防止多个interval同时运行
            if (messageIntervalId != null) {
                clearInterval(messageIntervalId);
            }
            if (checkPrinterIntervalId != null) {
                clearInterval(checkPrinterIntervalId);
            }

            /// 每10分钟，获取打印机，并写入数据库
            checkPrinterIntervalId = setInterval(function () {
                if (shop && shop['ownerId']) {
                    getSystemPrinters(shop['ownerId']);
                }
            }, 10 * 60 * 1000);

            /// 延迟20秒，开启打印小票
            _delayAndExecute(() => {
                messageIntervalId = setInterval(function () {
                    if (shop && shop['ownerId']) {
                        getMessage(shop['ownerId']);
                    }
                }, 1000);
            });
        }
    });

    const versionToNumber = (vString) => {
        if (typeof vString !== 'string' || !vString) {
            return 0; // Or handle as an error, or return a very small number
        }
        const parts = vString.split('.');
        const major = (parts[0] || '0').padStart(2, '0');
        const minor = (parts[1] || '0').padStart(2, '0');
        const patch = (parts[2] || '0').padStart(2, '0');
        return parseInt(`${major}${minor}${patch}`, 10);
    };

    /// 处理保存系统参数的事件
    ipcMain.on('save-system-data', (event, incomingVersionStr) => {
        if (!incomingVersionStr || typeof incomingVersionStr !== 'string') {
            log.warn(`Invalid or missing version received from renderer: ${incomingVersionStr}`);
            return;
        }

        const currentConfigFromFile = getConfig(); // Reads config.json
        const currentVersionInFileStr = currentConfigFromFile['ver'];

        const newVersionNum = versionToNumber(incomingVersionStr);
        const currentVersionInFileNum = versionToNumber(currentVersionInFileStr);

        log.info(`Received 'save-system-data'. Incoming version: ${incomingVersionStr} (parsed: ${newVersionNum}). Current version in config file: ${currentVersionInFileStr} (parsed: ${currentVersionInFileNum}).`);

        // Update window title immediately with the version string from renderer,
        // it will be corrected if update doesn't proceed.

        if (newVersionNum > currentVersionInFileNum) {
            log.info(`Incoming version ${incomingVersionStr} is newer. Updating configuration and reloading.`);

            const updatedConfigData = {...currentConfigFromFile, ver: incomingVersionStr};
            writeFile('config.json', JSON.stringify(updatedConfigData)); // Ensure writeFile returns a status or throws clearly
            config['ver'] = incomingVersionStr; // Update in-memory global config

            if (win) {
                log.info('Reloading window due to version update...');
                // win.webContents.reloadIgnoringCache();
            } else {
                log.warn('Window not available to reload.');
            }
        } else {
            log.info(`Incoming version ${incomingVersionStr} is not newer than current ${currentVersionInFileStr}. No configuration update or reload needed.`);
            // Ensure title reflects the actual current version from config if no update happened
            if (win && config['ver'] && win.getTitle() !== `${config['appTitle']} ${config['ver']}`) {
                log.info(`Correcting window title to actual current version: ${config['ver']}`);
                win.setTitle(getTitleVersion());
            }
        }
        if (win) {
            win.setTitle(getTitleVersion());
        }
    });

    ipcMain.on('clear-cache', (event) => {
        log.info('App is quitting. Clearing cache (excluding localStorage)...');
        const options = {
            storages: [
                'appcache',
                'cookies',
                'filesystem',
                'indexdb',
                'shadercache', // 通常与 WebGL 相关
                'websql',
                'serviceworkers',
                'cachestorage' // 用于 Cache API
            ],
            // quotas: ['temporary', 'persistent', 'syncable'] // 如果需要，也可以清除配额数据
        };
        electron.session.defaultSession.clearStorageData(options).then(() => {
            log.info('Browser storage (excluding localStorage) cleared successfully.');
        }).catch((err) => {
            log.error('Failed to clear browser storage on quit:', err);
        });
    });

    // 处理来自浏览器内部的调用，获取系统打印机
    ipcMain.on('check-system-printer', (event, data) => {
        console.log('check system printer ..... getSystemPrinter and saveTo server');
        if (data != null && data.trim().length > 0) {
            shop['ownerId'] = data;
            if (shop && shop['ownerId']) {
                getSystemPrinters(shop['ownerId']);
            }
        }
    });

    ipcMain.on('print-test-page', (event, printName, pageWidth) => {
        if (printName != null && printName.trim().length > 0) {
            printTestPage(printName, pageWidth);
        }
    });

    ipcMain.on('open-cash-drawer', (event, printerIp, openDrawerCommand) => {
        if (printerIp != null && printerIp.trim().length > 0) {
            openCashDrawer(printerIp, openDrawerCommand).then((isOpened) => {
                if (!isOpened) {
                } else {
                    log.info(`Cash drawer (${printerIp}) is opened successfully called.`);
                }
            });
        }
    });

    // 仅当应用已打包或强制了开发更新配置时才检查更新
    if (app.isPackaged || process.env.UPDATE_DEV || autoUpdater.forceDevUpdateConfig === true) {
        autoUpdater.checkForUpdatesAndNotify().then(r => {
            log.info('checkForUpdatesAndNotify called.');
        }).catch(err => {
            log.error('checkForUpdatesAndNotify error:', err);
        });
    } else {
        log.info('Skipping checkForUpdates: App is not packaged and dev update config is not forced.');
    }

    return win;
}

function _debug() {
    if (config['isDebug']) {
        win.openDevTools();
    }
}

function _delayAndExecute(callback) {
    setTimeout(callback, 20 * 1000);
}

///
function getVersionFromPubspec(projectRoot) {
    // 假设 pubspec.yaml 在项目根目录下
    // 您可能需要根据实际的项目结构调整此路径
    const pubspecPath = path.join(projectRoot, 'pubspec.yaml');
    try {
        if (fs.existsSync(pubspecPath)) {
            const fileContents = fs.readFileSync(pubspecPath, 'utf8');
            const doc = yaml.load(fileContents);
            return doc.version;
        } else {
            log.warn(`pubspec.yaml not found at: ${pubspecPath}`);
            return null;
        }
    } catch (e) {
        log.error(`Error reading or parsing pubspec.yaml at ${pubspecPath}:`, e);
        return null;
    }
}


function getSystemPrinters(shopCode) {
    /// 获取系统中的打印机，并写入文件printers.json, 写入剪贴板
    win.webContents.getPrintersAsync().then(printers => {
        try {
            let txt = JSON.stringify(printers, null, 2);
            if (shopCode != null && shopCode.trim().length > 0) {
                savePrinters(shopCode, txt);
            }
        } catch (err) {
            console.error('Error saving printers to JSON:', err);
        }
    });
}

function getTitleVersion () {
    return `${config['appTitle']} [ver: m${app.getVersion()}.${config["ver"]}]`;
}

////////////////////////////////////////////////
//
//  通过打印机开钱箱部分
//
////////////////////////////////////////////////

/***
 * 向网络打印机发送原始字节命令。
 * @param {string} ipAddress 打印机的IP地址。
 * @param {number} port 打印机的端口号 (通常是 9100)。
 * @param {Buffer | Uint8Array | number[]} commandBytes 要发送的命令字节。
 * @returns {Promise<void>}
 */
function sendRawCommandToNetworkPrinter(ipAddress, port, commandBytes) {
    return new Promise((resolve, reject) => {
        const client = new net.Socket();
        const connectionTimeout = 5000; // 5秒连接超时

        const timer = setTimeout(() => {
            client.destroy();
            reject(new Error(`Connection attempt to ${ipAddress}:${port} timed out after ${connectionTimeout}ms`));
        }, connectionTimeout);

        client.connect(port, ipAddress, () => {
            clearTimeout(timer); // 清除连接超时计时器
            console.log(`Connected to printer at ${ipAddress}:${port}`);
            try {
                client.write(Buffer.from(commandBytes)); // 确保是 Buffer 类型
                client.end(() => {
                    console.log('Raw command sent and connection closed.');
                    resolve();
                });
            } catch (writeError) {
                console.error('Error writing to printer:', writeError);
                client.destroy();
                reject(writeError);
            }
        });

        client.on('error', (err) => {
            clearTimeout(timer);
            console.error('Printer connection error:', err.message);
            client.destroy(); // 确保socket被销毁
            reject(err);
        });

        // 可选：处理服务器端关闭连接的情况
        client.on('close', (hadError) => {
            clearTimeout(timer);
            if (hadError) {
                console.log('Connection closed due to a transmission error.');
            } else {
                console.log('Connection closed by the printer.');
            }
        });
    });
}

/**
 * 暂时没用
 * 通过 mDNS/Bonjour 服务发现尝试获取网络打印机的IP地址。
 * @param {string} targetPrinterName 打印机名称或名称的一部分，用于匹配发现的服务。
 * @param {number} [timeout=7000] 发现操作的超时时间（毫秒）。
 * @returns {Promise<string|null>} 如果找到匹配打印机的IPv4地址则返回该地址，否则返回null。
 */
async function findPrinterIpByDiscovery(targetPrinterName, timeout = 15000) {
    return new Promise((resolveFn) => {
        let resolved = false;
        const browsers = [];
        let discoveryTimeoutId = null;

        // 包装 resolve 以确保清理
        const resolve = (value) => {
            if (discoveryTimeoutId) {
                clearTimeout(discoveryTimeoutId);
                discoveryTimeoutId = null;
            }
            if (!resolved) {
                resolved = true;
                stopDiscovery();
                resolveFn(value);
            }
        };

        const stopDiscovery = () => {
            browsers.forEach(browser => {
                try {
                    browser.stop();
                } catch (e) {
                    log.warn(`[MDNS] Error stopping a browser: ${e.message}`);
                }
            });
            browsers.length = 0; // 清空数组
            try {
                // bonjour 实例通常在应用退出时或不再需要时销毁
                // 如果频繁调用此函数，可以考虑在更高层级管理 bonjour 实例的生命周期
                // bonjour.destroy(); // 暂时注释掉，避免影响后续可能的调用
            } catch (e) {
                log.warn(`[MDNS] Error destroying bonjour instance: ${e.message}`);
            }
        };

        const handleFoundService = (service) => {
            if (resolved) return;

            log.info(`[MDNS] Found service: Name: ${service.name}, Type: ${service.type}, Host: ${service.host}, Addresses: ${service.addresses}, Port: ${service.port}`);

            const serviceNameLower = service.name ? service.name.toLowerCase() : '';
            const targetNameLower = targetPrinterName ? targetPrinterName.toLowerCase() : '';

            // 尝试匹配打印机名称 (这里使用简单的包含匹配，您可能需要更复杂的逻辑)
            if (serviceNameLower.includes(targetNameLower)) {
                if (service.addresses && service.addresses.length > 0) {
                    // 优先寻找 IPv4 地址
                    const ipv4Address = service.addresses.find(addr => net.isIPv4(addr));
                    if (ipv4Address) {
                        log.info(`[MDNS] Matched printer "${targetPrinterName}" with service "${service.name}". IP: ${ipv4Address}`);
                        resolve(ipv4Address);
                        return;
                    }
                    log.info(`[MDNS] Service "${service.name}" matched for "${targetPrinterName}" but no IPv4 address found in ${JSON.stringify(service.addresses)}.`);
                }
            }
        };

        // 常见的打印机服务类型
        const serviceTypes = ['ipp', 'pdl-datastream', 'printer']; // 'printer' 通常是 LPD

        serviceTypes.forEach(type => {
            try {
                const browser = bonjour.find({ type });
                browsers.push(browser);
                browser.on('up', handleFoundService); // 当服务上线或被发现时触发
                browser.on('error', (err) => {
                    log.error(`[MDNS] Browser error for type "${type}":`, err);
                });
            } catch (e) {
                log.error(`[MDNS] Failed to create mDNS browser for type "${type}": ${e.message}`);
            }
        });

        if (browsers.length === 0) {
            log.error("[MDNS] No mDNS browsers could be started. Bonjour might not be initialized correctly or no suitable network interfaces available.");
            resolve(null); // 如果没有浏览器启动，则无法发现
            return;
        }

        log.info(`[MDNS] Started discovery for services: ${serviceTypes.join(', ')} matching name part: "${targetPrinterName}". Timeout: ${timeout}ms`);

        discoveryTimeoutId = setTimeout(() => {
            if (!resolved) {
                log.warn(`[MDNS] Discovery for "${targetPrinterName}" timed out after ${timeout}ms.`);
                resolve(null); // 超时，未找到
            }
        }, timeout);
    });
}

/**
 * 暂时没用
 * 尝试根据打印机名称获取其IP地址 (使用Electron内置API)。
 * @param {import('electron').WebContents} webContents - 发起请求的webContents实例。
 * @param {string} targetPrinterName 目标打印机的名称。
 * @returns {Promise<string|null>} 打印机的IP地址，如果找到则返回字符串，否则返回null。
 */
async function getPrinterIpByName(webContents, targetPrinterName) {
    if (!webContents) {
        log.error('getPrinterIpByName: webContents is required.');
        console.error('getPrinterIpByName: webContents is required.');
        return null;
    }
    if (!targetPrinterName || targetPrinterName.trim() === '') {
        log.error('getPrinterIpByName: Printer name is required.');
        console.error('getPrinterIpByName: Printer name is required.');
        return null;
    }

    try {
        const printers = await webContents.getPrintersAsync();
        const targetPrinter = printers.find(p => p.name === targetPrinterName || p.deviceId === targetPrinterName);

        if (targetPrinter) {
            log.info(`Found printer details for "${targetPrinterName}": ${JSON.stringify(targetPrinter)}`);

            // device-uri 示例: "socket://192.168.1.123:9100", "ipp://hostname/ipp/print"
            const deviceURI = targetPrinter.options?.['device-uri'];

            if (deviceURI && typeof deviceURI === 'string') {
                // 正则表达式尝试从常见的网络打印机URI格式中提取IP地址
                // 支持 socket://, ipp://, http://, https:// 等协议头
                const ipRegex = /(?:[a-zA-Z]+:\/\/)?([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3})/;
                const match = deviceURI.match(ipRegex);

                if (match && match[1]) {
                    log.info(`Extracted IP "${match[1]}" from URI "${deviceURI}" for printer "${targetPrinterName}"`);
                    return match[1];
                } else {
                    // 检查 deviceURI 本身是否就是一个 IP 地址 (不常见，但可能)
                    const directIpRegex = /^([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3})$/;
                    if (directIpRegex.test(deviceURI)) {
                        log.info(`Device URI "${deviceURI}" appears to be a direct IP for printer "${targetPrinterName}"`);
                        return deviceURI;
                    }
                    log.warn(`Could not parse a valid IP address from device-uri: "${deviceURI}" for printer "${targetPrinterName}". It might be a hostname, USB/serial port, or an unrecognized format.`);
                }
            } else {
                log.warn(`No 'device-uri' found in options for printer "${targetPrinterName}".`);
            }
        } else {
            log.warn(`Printer with name or deviceId "${targetPrinterName}" not found.`);
        }
    } catch (error) {
        log.error(`Error in getPrinterIpByName for "${targetPrinterName}":`, error);
        console.error(`Error in getPrinterIpByName for "${targetPrinterName}":`, error);
    }
    return null; // IP not found or an error occurred
}

async function openCashDrawer(printerIp, openDrawerCommandKey) {
    const printerPort = 9100;
    if (!printerIp || !openDrawerCommandKey) {
        log.error(`Could not determine IP for printer "${printerIp}". Cannot open cash drawer.`);
        return false; // 表示未能执行打开操作
    }
    const openDrawerCommand = commandsToTry.get(openDrawerCommandKey);

    if (!openDrawerCommand) {
        log.error(`Unknown cash drawer command key: '${openDrawerCommandKey}'. Cannot open cash drawer.`);
        return false; // 表示命令键无效
    }

    await sendRawCommandToNetworkPrinter(printerIp, printerPort, openDrawerCommand);
    log.info(`Successfully sent command '${printerIp}'`);
}

module.exports = {createMainWindow};