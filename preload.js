const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
    // Renderer to main
    loginSteam: () => ipcRenderer.send('login-steam'),
    resetSteamLogin: (prefix) => ipcRenderer.send('reset-steam-login'),

    // Main to renderer
    onUpdateUndercutText: (callback) => ipcRenderer.on('updateUndercutText', callback),
    onUpdateOutOfStockText: (callback) => ipcRenderer.on('updateOutOfStockText', callback),
    onShowServerPairContainer: (callback) => ipcRenderer.on('showServerPairContainer', callback),  
    onNewPrefix: (prefix) => ipcRenderer.send('new-Prefix', prefix),
    onShowShopViewContainer: (callback) => ipcRenderer.on('showShopViewContainer', callback),
    onUpdateStatusText: (callback) => ipcRenderer.on('updateStatusText',callback),
    onDownloadingIDs: (callback) => ipcRenderer.on('downloadingIDs',callback),
    
    
})

