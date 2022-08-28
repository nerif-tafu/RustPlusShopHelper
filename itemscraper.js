async function fetchItemIDs(apppass, downloadingIDs){
    const app = apppass
    const axios = require("axios");
    const cheerio = require('cheerio');
    const rustLabsItemList = 'https://rustlabs.com/group=itemlist';
    const rustLabsURL = 'https://rustlabs.com';
    const fs = require('fs/promises');
    const fd = require('fs');

    const links = [];
    const idsToStore = [];
    const { data  } = await axios.get(rustLabsItemList);

    $ = cheerio.load(data);
    linkObjects = $('a[class=pad]');


    
    linkObjects.each((index, element) => { // Get links for all items in game.
        links.push(rustLabsURL + $(element).attr('href'));
    });

    console.log('Fetched',links.length,'links')

    if (!fd.existsSync(app.getPath('userData') + '\\itemid.json')) {
        await fs.writeFile(app.getPath('userData') + '\\itemid.json', '{}', 'utf8');
    }

    let rawdata = await fs.readFile(app.getPath('userData') + '\\itemid.json')

    if (JSON.parse(rawdata).ItemCount == links.length) { 
        console.log('Item list did not change.'); 
        return JSON.parse(rawdata).itemList; 
    } else {
        console.log('Item list different from saved.')
        let item = {}
        item.text = 'Item list different from saved. Standby';
        item.disabled = 1
        downloadingIDs(item)
    }

    for (let index = 0; index < links.length; index++) {
        const link = links[index];

        const { data } = await axios.get(link);
        $ = cheerio.load(data);
        const identifierID = $('#right-column > div > table > tbody > tr:nth-child(1) > td:nth-child(2)').text();
        const NameOfItem = $('#left-column > div.info-block > div.text-column > h1').text();

        idsToStore.push({
            identifier: identifierID,
            name: NameOfItem
        });

        console.log('Got',NameOfItem,'id',identifierID,'in index',index)
        let item = {}
        item.text = `Downloaded ${index} item IDs out of ${links.length}`;
        item.disabled = 1
        downloadingIDs(item)
    }

    fs.writeFile(app.getPath('userData') + '\\itemid.json', JSON.stringify({ItemCount: links.length, itemList: idsToStore}), 'utf8');
    let item = {}
    item.text = `Login to Steam`;
    item.disabled = 0
    downloadingIDs(item)
    return idsToStore;
}

module.exports = { fetchItemIDs };