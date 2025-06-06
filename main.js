const { app, session, protocol, net, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs').promises; // 用于异步文件操作

const {createMainWindow} = require('./business/lib');

app.commandLine.appendSwitch('lang', 'en-US');
// 确保在会话使用协议处理器之前注册特权方案
const schemesToHandle = ['http', 'https'];
protocol.registerSchemesAsPrivileged(
    schemesToHandle.map(scheme => ({
        scheme: scheme,
        privileges: {
            standard: true,
            secure: scheme === 'https',
            bypassCSP: true,
            allowServiceWorkers: true,
            supportFetchAPI: true,
            corsEnabled: true,
            stream: true
        }
    }))
);
app.whenReady().then(async () => {
    const partition = 'persist:example'
    const ses = session.fromPartition(partition)

    if (!ses) {
        console.error(`Error: Session for partition "${partition}" is null or undefined.`);
        // 考虑是否在此处退出或采取其他错误处理措施
        // app.quit();
        return;
    }
    if (!ses.protocol) {
        console.error(`Error: ses.protocol for partition "${partition}" is null or undefined.`);
        // app.quit();
        return;
    }

    // 定义一个映射：第三方 Web 请求的字体 URL -> 本地字体文件名
    // 您需要通过浏览器开发者工具查看第三方 Web 应用实际请求的字体 URL
    const fontMap = {
        'http://60.205.204.131:9082/assets/assets/fonts/PingFangSC-Regular.otf': 'PingFangSC-Regular.otf',
        'http://60.205.204.131:9082/assets/assets/fonts/PingFangSC-Medium.otf': 'PingFangSC-Medium.otf'
    };

    const handleFontRequest = async (request, callback) => {
        const originalUrl = request.url;
        try {
            const requestedFontFileName = fontMap[originalUrl];

            if (requestedFontFileName) {
                const basePath = app.isPackaged ? process.resourcesPath : app.getAppPath();
                const fontPath = path.join(basePath, 'assets/fonts', requestedFontFileName);

                try {
                    await fs.access(fontPath, fs.constants.R_OK);
                    // console.log(`Serving local font: file://${fontPath} for ${originalUrl}`);
                    callback({ url: `file://${fontPath}` });
                } catch (fileAccessError) {
                    console.error(`Local font file access error for ${fontPath} (requested by ${originalUrl}): ${fileAccessError.message}. Falling back to network.`);
                    callback({ url: originalUrl });
                }
            } else {
                callback({ url: originalUrl });
            }
        } catch (error) {
            console.error(`Error in font protocol handler for ${originalUrl}: ${error.message}`);
            callback({ error: -3 }); // GENERIC_FAILURE
        }
    };

    // 注册 HTTP 协议处理器
    ses.protocol.registerHttpProtocol('http', handleFontRequest);

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

