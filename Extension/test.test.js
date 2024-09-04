const puppeteer = require('puppeteer');
require('dotenv').config();

const EXTENSION_PATH = __dirname;

let browser, page;

// create a delay function because puppeteer doesn't has one
function delay(time) {
  return new Promise(resolve => setTimeout(resolve, time));
}

// create login function that registers a user then log in 
async function Login() {
  await page.goto(`chrome-extension://${process.env.EXTENSION_ID}/popup.html`);
  await delay(500);

  await page.click('#signUp');
  await delay(500);

  await page.type('#firstName', 'test');
  await page.type('#lastName', 'test');
  await page.type('#email', process.env.Test_Email);
  await page.type('#password', process.env.Test_Password);
  await page.click('#signUp-form button[type="submit"]');
  
  await delay(2000);
  await page.click('#Login');
  await delay(500);

  await page.type('#email', process.env.Test_Email);
  await page.type('#password', process.env.Test_Password);
  await page.click('#login-form button[type="submit"]');
  await delay(500);

  try {
    await page.waitForSelector('#form-container', { state: 'attached', timeout: 10000 });
  } catch (e) {
    console.error('Error waiting for #form-container after login:', e);
    throw e;
  }

  const logoutButton = await page.$('#logout-button');
  expect(logoutButton).toBeTruthy();
}

// launch a new browser and open a new tab with given dimensions before executing each test
beforeEach(async () => {
  browser = await puppeteer.launch({
    headless: false,
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      '--start-maximized'
    ],
    defaultViewport: null
  });
  page = await browser.newPage();
  const dimensions = await page.evaluate(() => ({
    width: window.screen.availWidth,
    height: window.screen.availHeight
  }));

  await page.setViewport(dimensions);
});

// close browser after each test
afterEach(async () => {
  await browser.close();
  browser = undefined;
});

test('show active icon green before login', async () => {
  await page.goto('https://www.samsung.com');
  await delay(1000);

  const workerTarget = await browser.waitForTarget(
    target => target.type() === 'service_worker'
  );
  const worker = await workerTarget.worker();

  await worker.evaluate("chrome.action.openPopup()");
  await delay(3000);
}, 50000);

// use login function then go to a website to test the icon changing
test('show active icon green after login', async () => {
  await Login();
  await page.goto('https://www.samsung.com');
  await delay(1000);

  // wait for service_worker target to open the extension pop-up
  const workerTarget = await browser.waitForTarget(
    target => target.type() === 'service_worker'
  );
  const worker = await workerTarget.worker();

  await worker.evaluate("chrome.action.openPopup()");
  await delay(3000);
}, 50000);

test('highlight the products border before login', async () => {  
  await page.goto(process.env.TestLink);
  await delay(5000);

  const workerTarget = await browser.waitForTarget(
    target => target.type() === 'service_worker'
  );
  const worker = await workerTarget.worker();

  await worker.evaluate("chrome.action.openPopup()");
  await delay(5000);
}, 100000);

// use login function then go to a website to test the icon changing
test('highlight the products border after login', async () => {
  await Login();
  
  await page.goto(process.env.TestLink);
  await delay(5000);

  // wait for service_worker target to open the extension pop-up
  const workerTarget = await browser.waitForTarget(
    target => target.type() === 'service_worker'
  );
  const worker = await workerTarget.worker();

  await worker.evaluate("chrome.action.openPopup()");
  await delay(5000);
}, 100000);
