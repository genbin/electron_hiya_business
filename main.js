const {app, BrowserWindow} = require('electron');
const {createMainWindow} = require('./business/lib');

app.commandLine.appendSwitch('lang', 'en-US');
app.whenReady().then(() => {
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

