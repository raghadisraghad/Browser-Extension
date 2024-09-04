const { chromium } = require('playwright');
require('dotenv').config();
const fs = require('fs');

(async () => {
    let browser, page; 
    const userDataDir = process.env.UserGoogleACcount;

    browser = await chromium.launchPersistentContext(userDataDir, {
        headless: true
    });
    page = await browser.newPage();
    
    await page.goto(process.env.PageUrl);

    // each load contains 20 data
    for (let i = 0; i < 3; i++) {
        await page.click('button:has-text("Show")');
        await page.waitForTimeout(1000);
    }

    const tableData = await page.evaluate(() => {
        const table = document.querySelector('table');
        if (!table) return null;

        const rows = Array.from(table.querySelectorAll('tr'));
        return rows.map(row => {
            const cells = Array.from(row.querySelectorAll('td, th'));
            return cells[1] ? cells[1].innerText.trim() : '';
        });
    });

    const filteredData = tableData
        .filter(name => name.endsWith('.ma') || name.endsWith('.com'))
        .map(name => {
            const cleanedName = name.slice(2).trim();
            return cleanedName ? `https://www.${cleanedName}` : '';
        })
        .slice(0, 51);
        
    fs.writeFile('Docs/e_commerce_websites_list.md', JSON.stringify(filteredData, null, 2), (err) => {
        if (err) {
            console.error('Error writing file:', err);
        } else {
            console.log('Data successfully saved to filteredData.json');
        }
    });

    await browser.close();
})();