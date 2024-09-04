// list of product's css selectors
const productPageSelectors = [
    'div.product-main-image img',
    'div.gallery img',
    '.-ptxs.-pbs img',
    'div.pdp-info-left img',                   // aliexpress
    'div.product-image img',
    '.pd-header-gallery.non-title img',         // electroplanet
    '.gallery-placeholder img',                 // electroplanet
    '.bloc__product-image.hidden-xs-down img',  // decathlon
    '.image-col.wt-order-xs-1.wt-mb-lg-6 img',  // etsy
    '.pip-product__left-top img',               // ikea
    '.l-fp-subgrid__media img',                 // cdiscount
    '.product-block-images.col-lg-6 img',      // ultrapc
    '.product-intro__gallery img',             // shein
    '.cover-frame img',                        // shein
    'div.nov-head img',                        // mtlnovel
    '.swiper-wrapper img',                     // les mobiles
    '.product-item img',                       // ubuy
    '.ProductDetailsHeader-module__detailContainer___rxkiz img', // xbox
    'main#content .product-carousel img',      // marjane
    '.pp-left-column.col-xs-12.col-sm-5.col-md-5 img', // iris
    '.ed__p-rvw__g-cntnr.ln__vr--16 img',     // numeriques
    '.product-media img',                      // kitea
    '.row.no-margin.main-info img',            // lcwaikiki
    'div.goods-container img',                 // oraimo
    '.component-wrap.zero-top.zero-btm img',   // LG
    '.product-detail-view__main-content img',  // zara
    '.BookPage__leftColumn img',                // goodreads
    '.image-section img',                      // hp
    '.post-inner img',                         // promotion au maroc
    '.card__section.card__section--tight img', // techspace
    '.f-productPageMain__visualAndDetails img', // fnac
    '.threadItemCard-gallery img',              // dealabs
    '[role="gallery"] img',                     // Role attribute for gallery
    '[data_gallery_role="gallery"] img',        // Custom data attribute for gallery
    '.product__gallery img',                    // biougnach
    '.product media img',                      // uno
    '.m-product-preview__gallery img',         // teepublic
    '.product-page img',                      // electrobousfiha
    '.productDetail img',                     // virgin
    '#product-image img'                      // iherb
];

async function fetchWebsites() {
    return new Promise((resolve, reject) => {
        // retrieve websites list from local storage
        chrome.storage.local.get(['Websites'], (result) => {
            // check any error from chrome.runtime for service worker
            if (chrome.runtime.lastError) {
                console.error("Error getting websites from storage:", chrome.runtime.lastError);
                reject(chrome.runtime.lastError);
                return;
            }
            // return the websites list if no error occurred
            resolve(result.Websites);
        });
    });
}

async function updateIcon(tabId, changeInfo, tab) {
    if (changeInfo.status === 'complete') {
        try {
            // after the page is loaded fetch the website list
            // check if the current visited url.hostname is included in the retrieved websites list
            const websites = await fetchWebsites();
            const currentUrl = new URL(tab.url);
            const currentHost = `https://${currentUrl.hostname}`;
            const status = websites.includes(currentHost);

            /* console.log('Current URL:', currentHost);
            console.log('Websites:', websites); */

            // change icon if the url is included
            const icon = status ? 'icons/active.png' : 'icons/default.png';
            chrome.action.setIcon({ path: icon, tabId });
            chrome.storage.local.set({ Status: status , TabUrl: currentUrl}, () => {});
        } catch (error) {
            console.error('Failed to update icon:', error);
        }
    }
}

async function highlightProducts(tabId, changeInfo, tab) {
    if (changeInfo.status === 'complete') {        
        try {
            // after the page is loaded fetch the website list
            // check if the current visited url.hostname is included in the retrieved websites list
            const websites = await fetchWebsites();
            const currentUrl = new URL(tab.url);
            const currentHost = `https://${currentUrl.hostname}`;
            const include = websites.includes(currentHost);
            
            // if the url included in websites list execute a script that uses the productPageSelectors
            if (include) {
                chrome.scripting.executeScript({
                    target: { tabId: tabId },
                    func: (selectors) => {
                        // if any selector from the productPageSelectors is in the current page it will save the selected elements in an array
                        let products = [];
                        selectors.forEach(selector => {
                            const elements = document.querySelectorAll(selector);
                            products = products.concat(Array.from(elements));
                        });
                        // it will update all saved element by adding a highlighted border
                        if (products.length > 0) {
                            const userConfirmed = confirm('Do you want to highlight the products?');
                            if (userConfirmed) {
                                products.forEach(product => {
                                    product.style.border = '3px dashed #00FF00';
                                    product.style.boxShadow = '0 0 10px #00FF00';
                                });
                            }
                        }
                    },
                    args: [productPageSelectors]
                });
            }
        } catch (error) {
            console.error('Failed to highlight products:', error);
        }
    }
}

let isListening = false;

function checkAuthTokenAndAddListeners() {
    // retrieve the authentication token from local storage to check if user logged in
    chrome.storage.local.get(['AuthToken'], (result) => {
        if (result.AuthToken && !isListening) {
            // if user logged in but there is no listeners yet it will add listeners on both functions (updateIcon,highlightProducts)
            chrome.tabs.onUpdated.addListener(updateIcon);
            chrome.tabs.onUpdated.addListener(highlightProducts);
            isListening = true;
        } else if (!result.AuthToken && isListening) {
            // if user logged out but there is still listeners from when they were logged in it will remove listeners on both functions (updateIcon,highlightProducts)
            chrome.tabs.onUpdated.removeListener(updateIcon);
            chrome.tabs.onUpdated.removeListener(highlightProducts);
            isListening = false;
        }
    });
}

checkAuthTokenAndAddListeners();
chrome.storage.onChanged.addListener(() => {
    checkAuthTokenAndAddListeners();
});