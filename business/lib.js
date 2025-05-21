const {BrowserWindow, ipcMain, app, } = require('electron');
const path = require('path');
const fs = require('fs');
const {getMessage, printReceipt, savePrinters, getCurrentLocation} = require("./api");
const {config, shop, getConfig, writeFile} = require("./global");
const {screen} = require("electron");
const electron = require("electron");
const { autoUpdater } = require('electron-updater');
const log = require('electron-log'); // 可选，用于日志记录

// 配置 autoUpdater 日志
autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = 'info';
log.info('App starting...')

let win;

// Create main window
function createMainWindow() {
    const size = screen.getPrimaryDisplay().size;
    win = new BrowserWindow({
        height: size.height,
        width: size.width,
        minWidth: config["minWidth"],
        minHeight: config["minHeight"],
        title: `${config['appTitle']} ${config['ver']}`,
        resizable: true,
        fullscreenable: true,
        autoHideMenuBar: true,
        center: true,
        webPreferences: {
            additionalArguments: [],
            allowRunningInsecureContent: true,
            nodeIntegration: false, // Do not enable Node.js integration
            contextIsolation: true, // 启用隔离
            devTools: true,
            webSecurity: false, //禁用同源策略
            // plugins: true, //是否支持插件
            nativeWindowOpen: true, //是否使用原生的window.open()
            // webviewTag: true, //是否启用 <webview> tag标签
            sandbox: true,
            preload: path.join(__dirname, '../preload.js')
        }
    });

    win.webContents.session.clearCache().then(() => {
        let serverUrl = config['serverAddress'];
        if (config['isTest']) {
            serverUrl = config['testAddress'];
        }
        win.loadURL(serverUrl).then(r => {
            _debug();

        }).catch((err) => {
            console.log(err);
        });
    });


    win.on('show', () => {})

    win.on('close', (e) => {
        const choice = electron.dialog.showMessageBoxSync(win, {
            type: 'info',
            title: '提示',
            message: '确认退出',
            buttons: ['最小化运行', '立即退出'],
            defaultId: 0,
            cancelId:0
        });
        if (choice === 0) {
            e.preventDefault();
            win.minimize();
        }
    })

    win.on('closed', (e) => {
        // win.close();
    });

    // 应用准备好后，检查更新
    autoUpdater.checkForUpdatesAndNotify().then(r => {});

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

        dialog.showMessageBox(win, dialogOpts).then((returnValue) => {
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
                    _getSystemPrinters(shop['ownerId']);
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

    ipcMain.on('check-system-printer', (event, data) => {
        console.log('check system printer ..... getSystemPrinter and saveTo server');
        if (data != null && data.trim().length > 0) {
            shop['ownerId'] = data;
            if (shop && shop['ownerId']) {
                _getSystemPrinters(shop['ownerId']);
            }
        }
    });
}

function _debug() {
    if (config['isDebug']) {
        win.openDevTools();
    }
}

function _delayAndExecute(callback) {
    setTimeout(callback, 20*1000);
}

function _getSystemPrinters(shopCode) {
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

module.exports = {createMainWindow};