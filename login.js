const { app, BrowserWindow, Menu, ipcMain } = require('electron')
const { register, listen } = require('push-receiver');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const express = require('express');
const ChromeLauncher = require('chrome-launcher');
const path = require('path');
const fs = require('fs');
const commandLineArgs = require('command-line-args');
const commandLineUsage = require('command-line-usage');
let win;
let startRustPlus;

const createWindow = (tempStartRustPlus) => {

  startRustPlus = tempStartRustPlus;

  win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: `${__dirname}/preload.js`,
    },
  })

  win.loadFile('src/index.html')

  // Something something IPC call
}

app.whenReady().then(() => {
  ipcMain.on('login-steam', loginSteam)
  ipcMain.on('new-Prefix', newPrefix)
  ipcMain.on('reset-steam-login',resetSteamLogin)
})

var expoPushToken = null;
var rustplusAuthToken = null;

const options = commandLineArgs([
  { name: 'command', type: String, defaultOption: true },
  { name: 'config-file', type: String },
]);

function updateStatusText(text,error){
  let value = {};
  value.text = text
  value.error = error
  win.webContents.send('updateStatusText',value);
}

function downloadingIDs(value){
  win.webContents.send('downloadingIDs',value);
}

function updateUndercutText(text){
  win.webContents.send('updateUndercutText',text);
}

function updateOutOfStockText(text){
  win.webContents.send('updateOutOfStockText',text);
}

function resetSteamLogin(){
  fs.stat(getConfigFile(options), function (err, stats) {
    console.log(stats);//here we got all information of file in stats variable
 
    if (err) {
        return console.error(err);
    }
 
    fs.unlink(getConfigFile(options),function(err){
         if(err) return console.log(err);
         console.log('file deleted successfully');
    });  
 });

 fs.stat(getServerFile(options), function (err, stats) {
  console.log(stats);//here we got all information of file in stats variable

  if (err) {
      return console.error(err);
  }

  fs.unlink(getServerFile(options),function(err){
       if(err) return console.log(err);
       console.log('file deleted successfully');
  });  
});

}

async function newPrefix (event, passedPrefix) {

  const options = commandLineArgs([
    { name: 'command', type: String, defaultOption: true },
    { name: 'config-file', type: String },
  ]);

  const serverFile = getServerFile(options);
  const prevServerFile = readConfig(serverFile)

  updateConfig(serverFile, {
      port: prevServerFile.port,
      ip: prevServerFile.ip,
      playerId: prevServerFile.playerId,
      playerToken: prevServerFile.playerToken,
      shopPrefix: passedPrefix,
  });
}

async function loginSteam (event, title) {

  const options = commandLineArgs([
    { name: 'command', type: String, defaultOption: true },
    { name: 'config-file', type: String },
]);

  const fcmCredentials = await register('976529667804');

  console.log("Fetching Expo Push Token");
  expoPushToken = await getExpoPushToken(fcmCredentials).catch((error) => {
      console.log("Failed to fetch Expo Push Token");
      console.log(error);
      process.exit(1);
  });

  // show expo push token to user
  console.log("Successfully fetched Expo Push Token");
  console.log("Expo Push Token: " + expoPushToken);

  console.log("Google Chrome is launching so you can link your Steam account with Rust+");
  rustplusAuthToken = await linkSteamWithRustPlus();

  console.log("Successfully linked Steam account with Rust+");
  console.log("Rust+ AuthToken: " + rustplusAuthToken);

  console.log("Registering with Rust Companion API");
    await registerWithRustPlus(rustplusAuthToken, expoPushToken).catch((error) => {
        console.log("Failed to register with Rust Companion API");
        console.log(error);
        process.exit(1);
    });
  console.log("Successfully registered with Rust Companion API.");

  // save to config
  const configFile = getConfigFile(options);
  updateConfig(configFile, {
      fcm_credentials: fcmCredentials,
      expo_push_token: expoPushToken,
      rustplus_auth_token: rustplusAuthToken,
  });
  console.log("FCM, Expo and Rust+ auth tokens have been saved to " + configFile);

  fcmListen(options);
}

async function fcmListen(options) {
  // Change electron view
  win.webContents.send('showServerPairContainer');
  
  // read config file
  const configFile = getConfigFile(options);
  const config = readConfig(configFile);

  // make sure fcm credentials are in config
  if(!config.fcm_credentials){
      console.error("FCM Credentials missing. Please run `fcm-register` first.");
      process.exit(1);
      return;
  }

  console.log("Listening for FCM Notifications");
  fcmClient = await listen(config.fcm_credentials, ({ notification, persistentId }) => {
      // parse notification body
      const body = JSON.parse(notification.data.body);

      // generate timestamp
      const timestamp = new Date().toLocaleString();

      // log timestamp the notification was received (in green colour)
      console.log('\x1b[32m%s\x1b[0m', `[${timestamp}] Notification Received`)

      // log notification body
      console.log(body);
      win.webContents.send('showShopViewContainer',body);

      const serverFile = getServerFile(options);
      updateConfig(serverFile, {
          port: body.port,
          ip: body.ip,
          playerId: body.playerId,
          playerToken: body.playerToken,
          shopPrefix: '',
      });
      // Setup rust+ communication with new details
      // 
      startRustPlus(); // This MIGHT not work idk
  });
}

function enableShopViewContainer(){

  const serverFile = getServerFile(options);
  const prefixTemp = readConfig(serverFile).shopPrefix;
  win.webContents.send('showShopViewContainer', prefixTemp);
}

async function registerWithRustPlus(authToken, expoPushToken) {
  return axios.post('https://companion-rust.facepunch.com:443/api/push/register', {
      AuthToken: authToken,
      DeviceId: 'rustplus.js',
      PushKind: 0,
      PushToken: expoPushToken,
  })
}

async function getExpoPushToken(credentials) {
  const response = await axios.post('https://exp.host/--/api/v2/push/getExpoPushToken', {
      deviceId: uuidv4(),
      experienceId: '@facepunch/RustCompanion',
      appId: 'com.facepunch.rust.companion',
      deviceToken: credentials.fcm.token,
      type: 'fcm',
      development: false
  });

  return response.data.data.expoPushToken;
}

async function linkSteamWithRustPlus() {
  return new Promise( async (resolve, reject) => {
      const app = express();

      // register pair web page
      app.get('/', (req, res) => {
          res.sendFile(path.join(`${__dirname}` + '/src/pair.html'));
      });

      // register callback
      app.get('/callback', async (req, res) => {
          // we no longer need the Google Chrome instance
          await ChromeLauncher.killAll();

          // get token from callback
          const authToken = req.query.token;
          if (authToken) {
              res.send('Steam Account successfully linked with rustplus.js, you can now close this window and go back to the console.');
              resolve(authToken)
          } else {
              res.status(400).send('Token missing from request!');
              reject(new Error('Token missing from request!'))
          }

          // we no longer need the express web server
          server.close()
      });

      /**
       * Start the express server before Google Chrome is launched.
       * If the port is updated, make sure to also update it in pair.html
       */
      const port = 3000;

      try {
        server.close();
        await ChromeLauncher.killAll();
      } catch (error) {
        console.log('Couldnt close tab')
      }
        
      
      server = app.listen(port, async () => {
          /**
           * FIXME: Google Chrome is launched with Web Security disabled.
           * This is bad, but it allows us to modify the window object of other domains, such as Rust+
           * By doing so, we can inject a custom ReactNativeWebView.postMessage handler to capture Rust+ auth data.
           *
           * Rust+ recently changed the login flow, which no longer sends auth data in the URL callback.
           * Auth data is now sent to a ReactNativeWebView.postMessage handler, which is available to the Rust+ app since
           * it is a ReactNative app.
           *
           * We don't have access to ReactNative, but we can emulate the behaviour by registering our own window objects.
           * However, to do so we need to disable Web Security to be able to manipulate the window of other origins.
           */
          
          await ChromeLauncher.launch({
              startingUrl: `http://localhost:${port}`,
              chromeFlags: [
                  '--disable-web-security', // allows us to manipulate rust+ window
                  '--disable-popup-blocking', // allows us to open rust+ login from our main window
                  '--disable-site-isolation-trials', // required for --disable-web-security to work
                  '--user-data-dir=/tmp/temporary-chrome-profile-dir-rustplus', // create a new chrome profile for pair.js
              ],
              handleSIGINT: false, // handled manually in shutdown
          }).catch((error) => {
              console.log(error);
              console.log("pair.js failed to launch Google Chrome. Do you have it installed?");
              process.exit(1);
          });
      });
  });
}


function getConfigFile(options) {
  return options['config-file'] || app.getPath('userData') + '\\rustplus.config.json';
}

function getServerFile(options) {
  return options['config-file'] || app.getPath('userData') + '\\rustplusserver.config.json';
}

/**
* Reads config file, or returns empty config on error
*/
function readConfig(configFile) {
  try {
      return JSON.parse(fs.readFileSync(configFile));
  } catch (err) {
      return {};
  }
}

/**
* Merges new config into existing config and saves to config file
* @param configFile
* @param config
*/
function updateConfig(configFile, config) {
  // get current config
  const currentConfig = readConfig(configFile);

  // merge config into current config
  const updatedConfig = {...currentConfig, ...config};

  // convert to pretty json
  const json = JSON.stringify(updatedConfig, null, 2);

  // save updated config to config file
  fs.writeFileSync(configFile, json, "utf8");
}

module.exports = { createWindow, getServerFile, readConfig, enableShopViewContainer, updateStatusText, updateUndercutText, updateOutOfStockText, downloadingIDs }