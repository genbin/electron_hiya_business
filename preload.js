const {contextBridge, ipcRenderer} = require('electron');

// 处理来自flutter web的保存用户shopCode的请求：
contextBridge.exposeInMainWorld('saveUserLoginData', (data) => {
    ipcRenderer.send('save-user-login-data', data);
});

// 处理来自flutter web的浏览器中应用的版本：
contextBridge.exposeInMainWorld('saveSystemData', (data) => {
    ipcRenderer.send('save-system-data', data);
});

// 获取系统打印机
contextBridge.exposeInMainWorld('checkSystemPrinter', (data) => {
    ipcRenderer.send('check-system-printer', data);
});

// 打印测试页
contextBridge.exposeInMainWorld('printTestPage', (data, width) => {
    ipcRenderer.send('print-test-page', data, width);
});

/// 写在一起的方式, 未使用
contextBridge.exposeInMainWorld("printerApi", {
    saveSystemData: (data) => ipcRenderer.send('save-system-data', data),
    checkSystemPrinter: (data) => ipcRenderer.send('check-system-printer', data),
    printTestPage: (data, width) => ipcRenderer.send('print-test-page', data, width)
});

/// 消息的通讯部分
contextBridge.exposeInMainWorld("dartInterop", {
    registerUpdateMessageHandler: (callback) => {
        const handler = (_event, message) => callback(message);
        ipcRenderer.on('update-message', handler);
        return () => ipcRenderer.removeListener('update-message', handler);
    },
    registerDownloadProgressHandler: (callback) => {
        const handler = (_event, percent) => callback(percent);
        ipcRenderer.on('update-download-progress', handler);
        return () => ipcRenderer.removeListener('update-download-progress', handler);
    }
});
