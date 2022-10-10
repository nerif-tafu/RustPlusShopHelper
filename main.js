
const RustPlus = require('@liamcottle/rustplus.js');
const { app, BrowserWindow } = require('electron')
if (require('electron-squirrel-startup')) return app.quit();
const dotenv = require('dotenv').config()
const commandLineArgs = require('command-line-args');
const commandLineUsage = require('command-line-usage');
const itemscraper = require('./itemscraper.js')
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
let shopPrefix = ''
let rustplus;
let itemIDs;
let currentUndercuts;
let currentOutOfStock;
let map = {};
let isRestarting = false
let checkForUndercutInterval;
let setTeamChatAlertInterval;

const options = commandLineArgs([
    { name: 'command', type: String, defaultOption: true },
    { name: 'config-file', type: String },
]);

let login = require('./login.js');

// Use sendRequestAsync for Rust+ and then set the timeout to run reset()
// Currently if the server goes down it wont try and send new requests.

preinit();

function reset(){
    if(isRestarting){ return; }
    var myDate = new Date().toTimeString().replace(/.*(\d{2}:\d{2}:\d{2}).*/, "$1");
    login.updateStatusText(`No server response at ${myDate}, retrying...`, 1)
    login.updateUndercutText([]);
    // Show error message that no server response
    isRestarting = true;
    clearInterval(checkForUndercutInterval);
    clearInterval(setTeamChatAlertInterval);
    console.log('Trying to reconnect to Rust+ server')
    map = {};
    currentUndercuts = [];
    currentOutOfStock = [];
    itemIDs = [];
    rustplus.disconnect();
    rustplus = null;
    setTimeout(startRustPlus,5000) // Might be incorrect, see note above
}

async function preinit(){
    app.whenReady().then(async function() { // Start Login page
        login.createWindow(startRustPlus);
    }).then(async function(){
        
        startRustPlus();
    })
}

async function startRustPlus(){        
    itemIDs = await itemscraper.fetchItemIDs(app, login.downloadingIDs)
    const serverFile = login.getServerFile(options);

    serverConfig = login.readConfig(serverFile)

    isRestarting = false;
    if (serverConfig.ip === undefined) { serverConfig.ip = '1.1.1.1' }
    if (serverConfig.port === undefined) { serverConfig.port = '11111'}
    
    rustplus = new RustPlus(serverConfig.ip, serverConfig.port, serverConfig.playerId, serverConfig.playerToken);
    shopPrefix = serverConfig.shopPrefix
    
    rustplus.addListener('error', reset)
    rustplus.connect()

    // wait until connected before sending commands
    rustplus.on('connected', () => {
        console.log('Connected to Rust+ server')
        setTimeout(login.enableShopViewContainer,2000); // So dirty, used to get around app not loading before command is sent
        // Send to Login page
        getMapInfo();
        checkForUndercutInterval = setInterval(checkForUndercut, 10000); // Every 1/2 minute check for undercut
        // setTeamChatAlertInterval = setInterval(setTeamChatAlert, 30000); // Every minute message teamchat
        // setInterval(testPlayerPosition, 1000); Used for debugging grid calculation code.
    });

    rustplus.on('message', (message) => {
        if(message.broadcast && message.broadcast.teamMessage && message.broadcast.teamMessage.message.message.includes('!undercut'))
        setTeamChatAlert();
    });

    rustplus.on('message', (message) => {
        if(message.broadcast && message.broadcast.teamMessage && message.broadcast.teamMessage.message.message.includes('!stock'))
        setTeamChatOutOfStock();
    });
    
}

async function getMapInfo(){

    rustplus.sendRequestAsync({
        getMap: {}, // get server info with a timeout of 2 seconds
    }, 2000).then((response) => {

        map.width = ( response.map.width - ( response.map.oceanMargin * 2 )) * 2;
        map.height = ( response.map.height - ( response.map.oceanMargin * 2 )) * 2; // Dont know why its 50 less in length
        map.gridSizeY = 74.074074074074074074074074074074 * 2;
        map.gridSizeX = 73.148148148148148148148148148148 * 2;
        map.gridCount = Math.floor(map.width / map.gridSizeY);

    }).catch((error) => {

        // AppError or Error('Timeout');
        console.log('failed to get map info')
        console.log(error)
        reset();
    })
}

function testPlayerPosition(){
    // Follow player movement
    rustplus.getTeamInfo(msg => {
        playerx = msg.response.teamInfo.members[0].x
        playery = msg.response.teamInfo.members[0].y

        displayPosX = Math.floor((playerx / map.gridSizeX));
        displayPosY = Math.floor((playery / map.gridSizeX));

        console.log(`x: ${displayPosX} y: ${displayPosY}`)
        console.log(`There are ${map.gridCount} grids for a size of ${map.width} by ${map.height}\n`)
    })
}

function getGridFromXY(x, y){
    firstChar = String.fromCharCode(65 + (Math.floor((x / map.gridSizeX)) % 26));
    secondCharValue = ~~(Math.floor(x / map.gridSizeX) / 26);
    secondChar='';
    if(secondCharValue > 0){
        secondChar = String.fromCharCode(64 + secondCharValue)
    }
    ygrid = map.gridCount - Math.floor(y / map.gridSizeX);

    return (`${secondChar}${firstChar}${ygrid}`);
}

async function setTeamChatAlert(){
    if (!map) { return; }
    if (currentUndercuts.length === 0) { 
        rustplus.sendTeamMessage(`Currently not being undercut.`);
    } else {
        for await (const undercutItem of currentUndercuts) {
            title = `You are getting undercut by \"${undercutItem.enemyShop.shopName}\" @ ${getGridFromXY(undercutItem.enemyShop.xpos,undercutItem.enemyShop.ypos)}`;
            theirratio = `${lookupItemIDName(undercutItem.enemyShop.itemId)} for ${(undercutItem.enemyShop.costPerItem / undercutItem.enemyShop.quantity).toFixed(2)} ${lookupItemIDName(undercutItem.enemyShop.currencyId)}`;
    
            console.log(title)
            console.log(theirratio);
            await delay(5000)
            rustplus.sendTeamMessage(`${title}. ${theirratio}.`);         
        }
        /**
        currentUndercuts.forEach(undercutItem => {
            title = `You are getting undercut by \"${undercutItem.enemyShop.shopName}\" @ ${getGridFromXY(undercutItem.enemyShop.xpos,undercutItem.enemyShop.ypos)}`;
            theirratio = `${lookupItemIDName(undercutItem.enemyShop.itemId)} for ${(undercutItem.enemyShop.costPerItem / undercutItem.enemyShop.quantity).toFixed(2)} ${lookupItemIDName(undercutItem.enemyShop.currencyId)}`;
    
            console.log(title)
            console.log(theirratio);
            await delay(3000)
            rustplus.sendTeamMessage(`${title}. ${theirratio}.`);
        });
        */
    }
}

async function setTeamChatOutOfStock(){
    if (!map) { return; }
    if (currentOutOfStock.length === 0) { 
        rustplus.sendTeamMessage(`Currently nothing out of stock.`);
    } else {
        console.log(currentOutOfStock)
        for await (const outOfStockItem of currentOutOfStock) {
            await delay(5000)
            rustplus.sendTeamMessage(`Your ${outOfStockItem.itemName} are out of stock in ${outOfStockItem.shopName}.`);
        }
        /**
        currentOutOfStock.forEach(outOfStockItem => {
            await delay(3000)
            rustplus.sendTeamMessage(`Your ${outOfStockItem.itemName} are out of stock in ${outOfStockItem.shopName}.`);
        });
        */
    }
}

function checkForUndercut(){      

    // Add last checked time and date when this ran.

    rustplus.sendRequestAsync({
        getMapMarkers: {}, // get server info with a timeout of 2 seconds
    }, 2000).then((response) => {

        allShops = response.mapMarkers.markers;

        let ownedShopListings = [];
        let enemyShopListings = [];

        allShops.forEach(currentShop => {
            if(currentShop.type !== 3) { return; } // Skip any map markers that are not shops

            if(currentShop.name.includes(shopPrefix)) { // If the shop is owned by us.
                currentShop.sellOrders.forEach(sellOrder => {
                    sellOrder.shopName = currentShop.name;
                });            
                ownedShopListings = ownedShopListings.concat(currentShop.sellOrders);
            } else { // If the shop is an enemy shop.
                currentShop.sellOrders.forEach(sellOrder => {
                    sellOrder.shopName = currentShop.name;
                    sellOrder.xpos = currentShop.x;
                    sellOrder.ypos = currentShop.y;
                });
                enemyShopListings = enemyShopListings.concat(currentShop.sellOrders);
            }
        });


        const serverFile = login.getServerFile(options);
        serverConfig = login.readConfig(serverFile)
        shopPrefix = serverConfig.shopPrefix

        

        let tempUndercuts = [];
        let tempOutOfStock = [];
        console.log('Looking for undercuts at', Date())
        var myDate = new Date().toTimeString().replace(/.*(\d{2}:\d{2}:\d{2}).*/, "$1");
        login.updateStatusText(`Checked for updates at ${myDate}`, 0)


        ownedShopListings.forEach(ownedShopListing => {
            
            if (ownedShopListing.amountInStock === 0 && shopPrefix !== '') {
                let outOfStockItem = {}
                outOfStockItem.itemName = lookupItemIDName(ownedShopListing.itemId);
                outOfStockItem.shopName = ownedShopListing.shopName;
                tempOutOfStock.push(outOfStockItem)
            }
            
            enemyShopListings.forEach(enemyShopListing => { // If there is a shop listing in enemyshop with the same itemID and currencyID
                if (ownedShopListing.itemId !== enemyShopListing.itemId || ownedShopListing.currencyId !== enemyShopListing.currencyId) { return; }
                if ((ownedShopListing.costPerItem / ownedShopListing.quantity) < (enemyShopListing.costPerItem / enemyShopListing.quantity)) { return; }
                if (enemyShopListing.amountInStock === 0) { return; };
                tempUndercuts.push({
                    ownedShop: ownedShopListing,
                    enemyShop: enemyShopListing
                })
            });
        });

        currentUndercuts = tempUndercuts;
        currentOutOfStock = tempOutOfStock;
        login.updateOutOfStockText(tempOutOfStock)
        sendElectronUndercuts(currentUndercuts)

        return true;

    }).catch((error) => {
        console.log('failed to get map markers')
        console.log(error)
        reset();
    })
}

function sendElectronUndercuts(currentUndercuts){
    if (!map) { return; }
    if (!currentUndercuts) { return; }

    messagesToSend = []
    
    currentUndercuts.forEach(undercutItem => {
        title = `You are getting undercut by \"${undercutItem.enemyShop.shopName}\" @ ${getGridFromXY(undercutItem.enemyShop.xpos,undercutItem.enemyShop.ypos)}`;
        theirratio = `${lookupItemIDName(undercutItem.enemyShop.itemId)} for ${(undercutItem.enemyShop.costPerItem / undercutItem.enemyShop.quantity).toFixed(2)} ${lookupItemIDName(undercutItem.enemyShop.currencyId)}`;
        ownedShopText = `In your shop "${undercutItem.ownedShop.shopName}"`
        let message = {};
        message.title = title;
        message.theirratio = theirratio;
        message.ownedShopText = ownedShopText;
        messagesToSend.push(message)
    });

    // Call renderer method with messageToSend
    login.updateUndercutText(messagesToSend);
}

function lookupItemIDName(passedID){
    let returnName = "N/A ITEM";
    itemIDs.forEach(item => {
        if (item.identifier == passedID){
            returnName = item.name;
        }
    });
    return returnName;
}

// connect to rust server

module.exports = { startRustPlus }