const {contextBridge, ipcRenderer} = require('electron');

// 处理来自flutter web的获取打印机请求：
contextBridge.exposeInMainWorld('saveUserLoginData', (data) => {
    ipcRenderer.send('save-user-login-data', data);
});

// 获取系统打印机
contextBridge.exposeInMainWorld('checkSystemPrinter', (data) => {
    ipcRenderer.send('check-system-printer', data);
});

// 打印测试页
contextBridge.exposeInMainWorld('printTestPage', (data, width) => {
    ipcRenderer.send('print-test-page', data, width);
});

// 在你的渲染进程代码中
ipcRenderer.on('update-message', (event, message) => {
    console.log('收到更新消息:', message);
    // 在这里更新你的 UI，例如显示一个提示条或状态文本
    // document.getElementById('update-status').innerText = message;
});

ipcRenderer.on('update-download-progress', (event, percent) => {
    console.log('下载进度:', percent.toFixed(2) + '%');
    // 在这里更新你的 UI，例如更新一个进度条
    // document.getElementById('download-progress-bar').style.width = percent + '%';
});
