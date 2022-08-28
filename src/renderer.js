const loginSteamButton = document.getElementById('loginSteamButton')
const startContainer = document.getElementById('startContainer')
const serverPairContainer = document.getElementById('serverPairContainer')
const shopViewContainer = document.getElementById('shopViewContainer')
const shopPrefixTxtbox = document.getElementById('shopPrefixTxtbox')
const reloginButton = document.getElementById('reloginButton')
const statusText = document.getElementById('statusText')
const shopHolderUndercuts = document.getElementById('ShopHolderUndercuts')
const ShopHolderOutOfStock = document.getElementById('ShopHolderOutOfStock')
const swapViewButton = document.getElementById('swapView')

currentView = 0;

// Change the text of statusText to match the current server upstate

shopPrefixTxtbox.addEventListener('input', (event) => {
    console.log('New prefix ',event.target.value)
    window.electronAPI.onNewPrefix(event.target.value)
})

reloginButton.addEventListener('click', () => {
    // Show Login Screen
    startContainer.style.display = 'flex';
    serverPairContainer.style.display = 'none';
    shopViewContainer.style.display = 'none';
    window.electronAPI.resetSteamLogin()
});

swapViewButton.addEventListener('click', () => {
    // Swap view between undercuts and out of stock
    if (currentView) {
        ShopHolderOutOfStock.style.display = 'none';
        shopHolderUndercuts.style.display = 'flex';
        swapViewButton.innerHTML = `View out of stock items (${ShopHolderOutOfStock.childElementCount})`;
        currentView = !currentView
    } else {
        ShopHolderOutOfStock.style.display = 'flex';
        shopHolderUndercuts.style.display = 'none';
        swapViewButton.innerHTML = `View undercut items (${shopHolderUndercuts.childElementCount})`;
        currentView = !currentView
    }
});

loginSteamButton.addEventListener('click', () => {
    window.electronAPI.loginSteam()
})

window.electronAPI.onShowServerPairContainer((_event, value) => {
    console.log('Login success, ready for pair')
    startContainer.style.display = 'none';
    serverPairContainer.style.display = 'flex';
    shopViewContainer.style.display = 'none';
})

window.electronAPI.onShowShopViewContainer((_event, value) => {
    shopPrefixTxtbox.value = value;
    startContainer.style.display = 'none';
    serverPairContainer.style.display = 'none';
    shopViewContainer.style.display = 'flex';
})



window.electronAPI.onUpdateUndercutText((_event, undercutList) => {
    shopHolderUndercuts.innerHTML = "";
    undercutList.forEach(undercut => {
        let newUndercut = document.createElement("h3");
        newUndercut.innerHTML = undercut.title + '<br /> <span class="bold">' + undercut.theirratio + "</span> " + "<br />" + undercut.ownedShopText
        shopHolderUndercuts.appendChild(newUndercut);
    });

    if (!currentView) {
        
        swapViewButton.innerHTML = `View out of stock items (${ShopHolderOutOfStock.childElementCount})`;
    }
    
})

window.electronAPI.onUpdateOutOfStockText((_event, outOfStockList) => {
    ShopHolderOutOfStock.innerHTML = "";
    outOfStockList.forEach(outOfStockItem => {
        let newOutOfStock = document.createElement("h3");
        newOutOfStock.innerHTML = '<span class="bold">' + outOfStockItem.itemName + "</span>" + " is currently out of stock in " + outOfStockItem.shopName 
        ShopHolderOutOfStock.appendChild(newOutOfStock);
    });

    if (currentView) {   
        swapViewButton.innerHTML = `View undercut items (${shopHolderUndercuts.childElementCount})`;
    }
})

window.electronAPI.onUpdateStatusText((_event, value) => {
    statusText.innerHTML = value.text
    value.error ? statusText.style.borderColor = "red" : statusText.style.borderColor = "green" 
})

window.electronAPI.onDownloadingIDs((_event, value) => {
    loginSteamButton.innerHTML = value.text
    loginSteamButton.disabled = value.disabled
})


