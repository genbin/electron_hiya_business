const {app, session, protocol, net, BrowserWindow} = require('electron');
const path = require('path');
const fs = require('fs').promises; // 用于异步文件操作

const {createMainWindow} = require('./business/lib');
const {config} = require("./business/global");
const log = require('electron-log');
const electron = require("electron"); // 可选，用于日志记录

let loadingWindow;
let mainWindow;
function createAndLoadWindows() {
    // 1. 创建并显示加载窗口
    loadingWindow = new BrowserWindow({
        width: 400, // 您可以根据 loading.html 的设计调整尺寸
        height: 300,
        frame: false, // 可选：无边框窗口
        show: true,   // 立即显示
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
        }
    });

    loadingWindow.loadFile(path.join(__dirname, 'business/loading.html'));
    loadingWindow.on('closed', () => {
        loadingWindow = null;
    });

    // 2. 创建主内容窗口，初始隐藏
    mainWindow = new BrowserWindow({
        width: 1200, // 您的主窗口尺寸
        height: 800,
        show: false, // 关键：初始不显示
        webPreferences: {
            nodeIntegration: true, // 如果第三方页面或您的脚本需要
            contextIsolation: true,
            // preload: path.join(__dirname, 'preload.js')
        }
    });

    // 替换为您的第三方页面URL
    mainWindow = createMainWindow(false);

    // 3. 监听主窗口内容加载完成事件
    // mainWindow.once('ready-to-show', () => {
    //     mainWindow.show();
    // });
    //
    // mainWindow.webContents.on('dom-ready', () => {
    //     if (loadingWindow) {
    //         loadingWindow.close();
    //     }
    //     if (mainWindow) {
    //         mainWindow.show();
    //     }
    // });

    mainWindow.webContents.on('did-finish-load', () => {
        // 4. 当第三方页面加载完成后，关闭加载窗口并显示主窗口
        if (loadingWindow) {
            loadingWindow.close();
        }
        if (mainWindow) {
            mainWindow.show();
        }
    });

    mainWindow.on('closed', () => {
        log.info('App is quitting. Clearing cache...');
        // 访问默认会话并清除缓存
        electron.session.defaultSession.clearCache().then(() => {
            log.info('Browser cache cleared successfully.');
        }).catch((err) => {
            log.error('Failed to clear browser cache on quit:', err);
        });
        // 如果主窗口关闭时加载窗口可能还存在（例如，主窗口在加载完成前被关闭）
        if (loadingWindow) {
            loadingWindow.close();
        }
        app.quit();
    });
}

// 可以根据需要调整这个值，例如 1024 (1GB), 2048 (2GB), 4096 (4GB)
// 注意：设置过大而系统物理内存不足可能会导致负面影响
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=1024');
app.commandLine.appendSwitch('lang', 'en-US');
app.whenReady().then(() => {
    log.info('App initialise...')
    const ses = session.defaultSession;
    let serverUrl = config['serverAddress'];
    if (config['isTest']) {
        serverUrl = config['testAddress'];
    }

    /// FontAwesome暂时无法离线，内部不能通过file协议
    const fontMap = {
        [`${serverUrl}assets/assets/fonts/PingFangSC-Regular.otf`]: 'assets/fonts/PingFangSC-Regular.otf',
        [`${serverUrl}assets/assets/fonts/PingFangSC-Medium.otf`]: 'assets/fonts/PingFangSC-Medium.otf',
        [`${serverUrl}assets/assets/fonts/NotoSansSC-Regular.ttf`]: 'assets/fonts/NotoSansSC-Regular.ttf',
        // [`${serverUrl}assets/fonts/MaterialIcons-Regular.otf`]: 'assets/fonts/MaterialIcons-Regular.otf',
        [`${serverUrl}assets/packages/cupertino_icons/assets/CupertinoIcons.ttf`]: 'assets/fonts/CupertinoIcons.ttf',
        [`${serverUrl}favicon.png`]: 'assets/images/favicon.png',
    };

    // 使用 webRequest API 拦截特定字体请求
    const fontUrlPatterns = Object.keys(fontMap);
    log.info('[MainProcess] fontUrlPatterns to intercept:', fontUrlPatterns); // <--- 添加日志

    if (fontUrlPatterns.length > 0) {
        ses.webRequest.onBeforeRequest({urls: fontUrlPatterns}, async (details, callback) => {
            const originalUrl = details.url;
            log.info(`[webRequest] Intercepted font request: ${originalUrl}`);
            const requestedFontFileName = fontMap[originalUrl];

            if (requestedFontFileName) {
                const basePath = app.isPackaged ? process.resourcesPath : app.getAppPath();
                const fontPath = path.join(basePath, requestedFontFileName);
                try {
                    await fs.access(fontPath, fs.constants.R_OK);
                    log.info(`[webRequest] Redirecting to local font: file://${fontPath} for ${originalUrl}`);
                    callback({redirectURL: `file://${fontPath.replace(/\\/g, '/')}`}); // 确保是 file:/// 协议且路径正确
                    return;
                } catch (fileAccessError) {
                    log.info(`[webRequest] Local font file access error for ${fontPath} (requested by ${originalUrl}): ${fileAccessError.message}. Letting network handle.`);
                    // 让原始请求继续
                    callback({});
                    return;
                }
            }
            //理论上，由于 urls 过滤器，不应该到这里，除非 fontMap 逻辑有误
            callback({});
        });
    } else {
        log.warn('[MainProcess] No font URL patterns to intercept. fontMap might be empty or serverUrl is not set correctly.'); // <--- 添加日志
    }

    log.info('creating the main Window ...');
    createAndLoadWindows();
});

// Handle window all closed event
app.on('window-all-closed', () => {
    app.quit();
});

// Handle activate event
app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createAndLoadWindows();
    }
});

