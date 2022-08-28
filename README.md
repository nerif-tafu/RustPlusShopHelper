# RustPlusShopHelper
This is a helper app for [Rust](https://store.steampowered.com/app/252490/Rust/) the game. It monitors every shop on a compatible [Rust+](https://rust.facepunch.com/companion) linked server and checks to see if anyone is undercutting you or if your items have sold out. 

Right now you can only pair and monitor one server at a time. This may be changed in the future, but currently I have no use for it. If someone uses this program and wants this implemented, please [open an issue](https://github.com/nerif-tafu/rustplusplus/issues) on this Github page.

And as always, *[Hopshop on top](https://www.reddit.com/r/playrust/comments/m5sjkz/these_absolute_legends_built_a_107_shop_mall/)*.

![App Preview](https://i.imgur.com/nFp6uNT.png)


## Installing the program

Head over to the releases tab and download the latest version available. Run the install.exe file and open the newly installed "RustPlusShopHelper" from your start menu.

## How to use

One the program is open it will first download every item ID in the game, this may take some time as it has to grab all the data from rustlabs.com with an extremely poorly written scraper. After this has done you will be able to login with your Steam login. Login data is handled through the steam servers directly and never touches the app. If you are curious you can read the login code in the [login.js](https://github.com/nerif-tafu/RustPlusShopHelper/blob/main/login.js) file.

After you login with Steam you will be asked to pair with a Rust server. Do to this, login to a Rust server, press the **"RUST+"** button in the ESC menu and then press **"PAIR WITH SERVER"**. 

![How to pair](https://i.imgur.com/yUNS18M.png)

If all was successful you should have been brought to the main information screen. This can be confirmed by seeing a green status update saying something like "*Checked for updates*". **On this screen you will need to enter the prefix for your shops in the lowest most textbox.** This prefix is a unique identifier that you will name all your shops, in the example below you can see that I have used the prefix "HopShop |" (*Please note that prefix is case sensitive*). When a shop with your prefix is found, it will compare against every other shop that does not have this prefix for price undercuts.

![In game prefix](https://i.imgur.com/QuesqQg.png)

You can use the in-game chat commands `!undercut` to display  any shops that are undercutting your prices as well as `!stock` to check if any of your items are out of stock.
## Setting up the development environment
If you would like to make changes or additions you can setup the project using the following steps:

    gh repo clone nerif-tafu/RustPlusShopHelper
    npm install
    npm start
If you would like to build an .exe installer all you have to do is run:

    npm run make
This will create an installer .exe in `.\RustPlusShopHelper\out\make\squirrel.windows\x64\Setup.exe`

