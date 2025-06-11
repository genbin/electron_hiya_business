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

// 配置 autoUpdater 日志
autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = 'info';
log.info('App starting...')

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
            devTools: true,
            webSecurity: true, //禁用同源策略
            // plugins: true, //是否支持插件
            nativeWindowOpen: true, //是否使用原生的window.open()
            // webviewTag: true, //是否启用 <webview> tag标签
            sandbox: false,
            preload: path.join(__dirname, '../preload.js')
        }
    });

    if (config['hasCache']) {
        let serverUrl = config['serverAddress'];
        if (config['isTest']) {
            serverUrl = config['testAddress'];
        }
        win.loadURL(serverUrl).then(r => {
            _debug();

        }).catch((err) => {
            console.log(err);
        });
    } else {
        win.webContents.session.clearCache().then(() => {
            let serverUrl = config['serverAddress'];
            if (config['isTest']) {
                serverUrl = config['testAddress'];
            }
            win.loadURL(serverUrl).then(r => {
                _debug();

            }).catch((err) => {
                console.log(err);
                electron.dialog.showMessageBoxSync(win, {
                    type: 'info',
                    title: '提示',
                    detail: err,
                    buttons: ['OK'],
                    defaultId: 0,
                    cancelId: 0
                });
            });
        });
    }

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

    // win.on('closed', (e) => {
    //     log.info('App is quitting. Clearing cache...');
    //     // 访问默认会话并清除缓存
    //     electron.session.defaultSession.clearCache().then(() => {
    //         log.info('Browser cache cleared successfully.');
    //     }).catch((err) => {
    //         log.error('Failed to clear browser cache on quit:', err);
    //     });
    // });

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
        log.info('App is quitting. Clearing cache...');
        electron.session.defaultSession.clearCache().then(() => {
            log.info('Browser cache cleared successfully.');
        }).catch((err) => {
            log.error('Failed to clear browser cache on quit:', err);
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

module.exports = {createMainWindow};