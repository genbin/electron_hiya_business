const {app, session, protocol, net, BrowserWindow} = require('electron');
const path = require('path');
const fs = require('fs').promises; // 用于异步文件操作

const {createMainWindow} = require('./business/lib');
const {config} = require("./business/global");
const log = require('electron-log'); // 可选，用于日志记录

app.commandLine.appendSwitch('lang', 'en-US');
app.whenReady().then(() => {
    log.info('App initialise...')
    const ses = session.defaultSession;
    let serverUrl = config['serverAddress'];
    if (config['isTest']) {
        serverUrl = config['testAddress'];
    }

    const fontMap = {
        [`${serverUrl}assets/assets/fonts/PingFangSC-Regular.otf`]: 'PingFangSC-Regular.otf',
        [`${serverUrl}assets/assets/fonts/PingFangSC-Medium.otf`]: 'PingFangSC-Medium.otf',
        [`${serverUrl}assets/assets/fonts/NotoSansSC-Regular.ttf`]: 'NotoSansSC-Regular.ttf'
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
                const fontPath = path.join(basePath, 'assets/fonts', requestedFontFileName);
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
    createMainWindow();
});

// Handle window all closed event
app.on('window-all-closed', () => {
    app.quit();
});

// Handle activate event
app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow();
    }
});

