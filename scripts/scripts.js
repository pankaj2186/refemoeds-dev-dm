import {
  loadHeader,
  loadFooter,
  decorateButtons as libDecorateButtons,
  decorateIcons,
  decorateSections,
  decorateBlocks,
  decorateTemplateAndTheme,
  waitForFirstImage,
  loadSection,
  loadSections,
  loadBlocks,
  loadCSS,
  fetchPlaceholders,
  getMetadata,
  loadScript,
  toClassName,
  toCamelCase
} from './aem.js';
import { picture, source, img } from './dom-helpers.js';

import {
  getLanguage,
  formatDate,
  setPageLanguage,
  PATH_PREFIX,
  createSource,
  getHostname
} from './utils.js';


/**
 * Moves all the attributes from a given elmenet to another given element.
 * @param {Element} from the element to copy attributes from
 * @param {Element} to the element to copy attributes to
 */
export function moveAttributes(from, to, attributes) {
  if (!attributes) {
    // eslint-disable-next-line no-param-reassign
    attributes = [...from.attributes].map(({ nodeName }) => nodeName);
  }
  attributes.forEach((attr) => {
    const value = from.getAttribute(attr);
    if (value) {
      to.setAttribute(attr, value);
      from.removeAttribute(attr);
    }
  });
}

export function isAuthorEnvironment() {
  if(window?.location?.origin?.includes('author')){
    return true;
  }else{
    return false;
  }
  /*
  if(document.querySelector('*[data-aue-resource]') !== null){
    return true;
  }*/
  //return false;
}

/**
 * Move instrumentation attributes from a given element to another given element.
 * @param {Element} from the element to copy attributes from
 * @param {Element} to the element to copy attributes to
 */
export function moveInstrumentation(from, to) {
  moveAttributes(
    from,
    to,
    [...from.attributes]
      .map(({ nodeName }) => nodeName)
      .filter((attr) => attr.startsWith('data-aue-') || attr.startsWith('data-richtext-')),
  );
}

/**
 * load fonts.css and set a session storage flag
 */
async function loadFonts() {
  await loadCSS(`${window.hlx.codeBasePath}/styles/fonts.css`);
  try {
    if (!window.location.hostname.includes('localhost')) sessionStorage.setItem('fonts-loaded', 'true');
  } catch (e) {
    // do nothing
  }
}

/**
 * Return the placeholder file specific to language
 * @returns
 */
export async function fetchLanguagePlaceholders() {
  const langCode = getLanguage();
  try {
    // Try fetching placeholders with the specified language
    return await fetchPlaceholders(`${PATH_PREFIX}/${langCode}`);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`Error fetching placeholders for lang: ${langCode}. Will try to get en placeholders`, error);
    // Retry without specifying a language (using the default language)
    try {
      return await fetchPlaceholders(`${PATH_PREFIX}/en`);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Error fetching placeholders:', err);
    }
  }
  return {}; // default to empty object
}

/**
 * Builds all synthetic blocks in a container element.
 * @param {Element} main The container element
 */
function buildAutoBlocks() {
  try {
    // TODO: add auto block, if needed
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Auto Blocking failed', error);
  }
}

/**
 * Builds all synthetic blocks in a container element.
 * @param {Element} main The container element
 */
function decorateButtons(main) {
  main.querySelectorAll('img').forEach((img) => {
    let altT = decodeURIComponent(img.alt);

    if (altT && altT.includes('https://delivery-')) {
      try {
        altT = JSON.parse(altT);
        const { altText, deliveryUrl } = altT;
        const url = new URL(deliveryUrl);
        const imgName = url.pathname.substring(url.pathname.lastIndexOf('/') + 1);
        const block = whatBlockIsThis(img);
        const bp = getMetadata(block);
        let breakpoints = [{ media: '(min-width: 600px)', width: '2000' }, { width: '750' }];
        if (bp) {
          const bps = bp.split('|');
          const bpS = bps.map((b) => b.split(',').map((p) => p.trim()));
          breakpoints = bpS.map((n) => {
            const obj = {};
            n.forEach((i) => {
              const t = i.split(/:(.*)/s);
              obj[t[0].trim()] = t[1].trim();
            });
            return obj;
          });
        } else {
          const format = getMetadata(imgName.toLowerCase().replace('.', '-'));
          const formats = format.split('|');
          const formatObj = {};
          formats.forEach((i) => {
            const [a, b] = i.split('=');
            formatObj[a] = b;
          });
          breakpoints = breakpoints.map((n) => (
            { ...n, ...formatObj }
          ));
        }
        const picture = createOptimizedPicture(deliveryUrl, altText, false, breakpoints);
        img.parentElement.replaceWith(picture);
      } catch (error) {
        img.setAttribute('style', 'border:5px solid red');
        img.setAttribute('data-asset-type', 'video');
        img.setAttribute('title', 'Update block to render video.');
      }
    }
  });
  libDecorateButtons(main);
}

/**
 * Decorates the main element.
 * @param {Element} main The main element
 */
// eslint-disable-next-line import/prefer-default-export
export async function decorateMain(main) {
  // hopefully forward compatible button decoration
  decorateButtons(main);
  decorateIcons(main);
  buildAutoBlocks(main);
  decorateSections(main);
  decorateBlocks(main);
  decorateDMImages(main);
}


async function renderWBDataLayer() {
  
  //const config = await fetchPlaceholders();
  const lastPubDateStr = getMetadata('published-time');
  const firstPubDateStr = getMetadata('content_date') || lastPubDateStr;
  const hostnameFromPlaceholders = await getHostname();
  window.wbgData.page = {
    pageInfo: {
      pageCategory: getMetadata('pagecategory'),
      channel: getMetadata('channel'),
      themecfreference: getMetadata('theme_cf_reference'),
      contentType: getMetadata('content_type'),
      pageUid: getMetadata('pageuid'),
      pageName: getMetadata('pagename'),
      hostName: hostnameFromPlaceholders ? hostnameFromPlaceholders : getMetadata('hostname'),
      pageFirstPub: formatDate(firstPubDateStr),
      pageLastMod: formatDate(lastPubDateStr),
      webpackage: '',
    },
  };
}

/**
 * Loads everything needed to get to LCP.
 * @param {Element} doc The container element
 */
async function loadEager(doc) {
  setPageLanguage();
  decorateTemplateAndTheme();
  renderWBDataLayer();
  const main = doc.querySelector('main');
  if (main) {
    await decorateMain(main);
    document.body.classList.add('appear');
    await loadSection(main.querySelector('.section'), waitForFirstImage);
  }

  try {
    /* if desktop (proxy for fast connection) or fonts already loaded, load fonts.css */
    if (window.innerWidth >= 900 || sessionStorage.getItem('fonts-loaded')) {
      loadFonts();
    }
  } catch (e) {
    // do nothing
  }
}

/**
 * Create section background image
 *
 * @param {*} doc
 */
// function decorateSectionImages(doc) {
//   const sectionImgContainers = doc.querySelectorAll('main .section[data-image]');
//   sectionImgContainers.forEach((sectionImgContainer) => {
//     const sectionImg = sectionImgContainer.dataset.image;
//     const sectionTabImg = sectionImgContainer.dataset.tabImage;
//     const sectionMobImg = sectionImgContainer.dataset.mobImage;
//     let defaultImgUrl = null;

//     const newPic = document.createElement('picture');
//     if (sectionImg) {
//       newPic.appendChild(createSource(sectionImg, 1920, '(min-width: 1024px)'));
//       defaultImgUrl = sectionImg;
//     }

//     if (sectionTabImg) {
//       newPic.appendChild(createSource(sectionTabImg, 1024, '(min-width: 768px)'));
//       defaultImgUrl = sectionTabImg;
//     }

//     if (sectionMobImg) {
//       newPic.appendChild(createSource(sectionTabImg, 600, '(max-width: 767px)'));
//       defaultImgUrl = sectionMobImg;
//     }

//     const newImg = document.createElement('img');
//     newImg.src = defaultImgUrl;
//     newImg.alt = '';
//     newImg.className = 'sec-img';
//     newImg.loading = 'lazy';
//     newImg.width = '768';
//     newImg.height = '100%';

//     if (defaultImgUrl) {
//       newPic.appendChild(newImg);
//       sectionImgContainer.prepend(newPic);
//     }
//   });
// }

/**
 * Loads everything that doesn't need to be delayed.
 * @param {Element} doc The container element
 */
async function loadLazy(doc) {
  const main = doc.querySelector('main');
  await loadSections(main);
  //decorateSectionImages(doc);
  const { hash } = window.location;
  const element = hash ? doc.getElementById(hash.substring(1)) : false;
  if (hash && element) element.scrollIntoView();
  //decorateSectionImages(doc);
  loadHeader(doc.querySelector('header'));
  loadFooter(doc.querySelector('footer'));

  loadCSS(`${window.hlx.codeBasePath}/styles/lazy-styles.css`);
  loadFonts();
}

function isDMOpenAPIUrl(src) {
  return /^(https?:\/\/(.*)\/adobe\/assets\/urn:aaid:aem:(.*))/gm.test(src);
}

export function getMetadataUrl(url) {
  try {
    // Pattern to match: /adobe/assets/urn:aaid:aem:[uuid]
    // UUID format: 8-4-4-4-12 hexadecimal characters
    const urnPattern = /(\/adobe\/assets\/urn:aaid:aem:[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i;
    const match = url.match(urnPattern);
    
    if (!match) {
      return null;
    }
    
    // Extract the base URL (protocol + hostname)
    const urlObj = new URL(url);
    const baseUrl = `${urlObj.protocol}//${urlObj.hostname}`;
    
    // Construct the metadata URL
    return `${baseUrl}${match[1]}/metadata`;
  } catch (error) {
    console.error('Error creating metadata URL:', error);
    return null;
  }
}

/**
 * Decorates Dynamic Media images by modifying their URLs to include specific parameters
 * and creating a <picture> element with different sources for different image formats and sizes.
 *
 * @param {HTMLElement} main - The main container element that includes the links to be processed.
 */
export async function decorateDMImages(main) {
  const links = Array.from(main.querySelectorAll('a[href]'));
  
  for (const a of links) {
     if (isDMOpenAPIUrl(a.href)) {

      // add code to read the toggle flag
       const isGifFile = a.href.toLowerCase().endsWith('.gif');
       const containsOriginal = a.href.includes('/original/');
 
       if (!containsOriginal || isGifFile) {
         const blockBeingDecorated = whatBlockIsThis(a);
         let blockName = '';
         let rotate = '';
         let flip = '';
         let crop = '';
         let preset = '';
 
         if(blockBeingDecorated){
             blockName = Array.from(blockBeingDecorated.classList).find(className => className !== 'block');
         }
         const videoExtensions = ['.mp4', '.mov', '.webm', '.ogg', '.m4v', '.mkv'];
         const isVideoAsset = videoExtensions.some(ext => a.href.toLowerCase().includes(ext));
         if (isVideoAsset || blockName === 'video') continue;
         
         if(blockName && blockName === 'dm-openapi'){
             const rotateEl = blockBeingDecorated.querySelector('[data-aue-prop="rotate"]');
             if (rotateEl) {
               rotate = rotateEl.textContent.trim();
               console.log("rotate :"+rotate);
               rotateEl.parentElement.remove(); // Remove the property div
             }
             const flipEl = blockBeingDecorated.querySelector('[data-aue-prop="flip"]');
             if (flipEl) {
               flip = flipEl.textContent.trim();
               console.log("flip :"+flip);
               flipEl.parentElement.remove(); 
             }
             const cropEl = blockBeingDecorated.querySelector('[data-aue-prop="crop"]');
             if (cropEl) {
               crop = cropEl.textContent.trim();
               console.log("crop :"+crop);
               cropEl.parentElement.remove(); 
             }
             const presetEl = blockBeingDecorated.querySelector('[data-aue-prop="preset"]');
             if (presetEl) {
               preset = presetEl.textContent.trim();
               console.log("preset :"+preset);
               presetEl.parentElement.remove(); 
             }
         }
         let metadataUrl = getMetadataUrl(a.href);
           
        if (metadataUrl) {
             try {
               const response = await fetch(metadataUrl);
               if (!response.ok) {
                 console.error(`Failed to fetch metadata: ${response.status}`);
                 continue;
               }
               
               const metadata = await response.json();
               const smartcrops = metadata?.repositoryMetadata?.smartcrops;
               
               if (smartcrops) {
                 const pic = document.createElement('picture');
                  const originalUrl = new URL(a.href);
                 // Get base URL with extension
                 const baseUrl = a.href.split('?')[0];
                 
                 // Check if original URL has query parameters to determine separator
                 const hasQueryParams = originalUrl?.toString().includes('?');
                 const paramSeparator = hasQueryParams ? '&' : '?';
                 
                  
                 // Dynamically determine crop order from JSON (largest to smallest width)
                 const cropOrder = Object.keys(smartcrops).sort((a, b) => {
                   const widthA = parseInt(smartcrops[a].width, 10);
                   const widthB = parseInt(smartcrops[b].width, 10);
                   return widthB - widthA;
                 });
                 
                 // Find the largest crop for fallback
                 const largestCropWidth = Math.max(...cropOrder.map(cropName => {
                  const crop = smartcrops[cropName];
                  return crop ? parseInt(crop.width, 10) : 0;
                }));
                const extraLargeBreakpoint = Math.max(largestCropWidth + 1, 1920);

                 
                 // Create source sets (one for each smartcrop size)
                 // Build parameter string for rotate, flip, and crop
                 const advanceModifierParams = `${rotate ? '&rotate=' + rotate : ''}${flip ? '&flip=' + flip.toLowerCase() : ''}${crop ? '&crop=' + crop.toLowerCase() : ''}${preset ? '&preset=' + preset : ''}`;
                 
                // Add source for extra large screens WITHOUT smartcrop FIRST
                // This will be used for screens >= extraLargeBreakpoint (e.g., 1920px+)
                const sourceWebpExtraLarge = document.createElement('source');
                sourceWebpExtraLarge.type = "image/webp";
                // No smartcrop parameter - uses original full-size image
                sourceWebpExtraLarge.srcset = `${originalUrl}${paramSeparator}quality=85&preferwebp=true${advanceModifierParams}`;
                sourceWebpExtraLarge.media = `(min-width: ${extraLargeBreakpoint}px)`;
                pic.appendChild(sourceWebpExtraLarge);  


                 cropOrder.forEach((cropName, index) => {
                   const crop = smartcrops[cropName];
                   if (crop) {
                     const minWidth = parseInt(crop.width, 10);
                     // Since baseUrl has no query params, always use ? for first param
                     const smartcropParam = `${paramSeparator}smartcrop=${cropName}`;
                     
                     // Create source with type attribute based on URL extension
                     const sourceWebp = document.createElement('source');
                     sourceWebp.type = "image/webp";
                     sourceWebp.srcset = `${originalUrl}${smartcropParam}&quality=85&preferwebp=true${advanceModifierParams}`;
                     // Smallest crop (first in order) has no media query (default), others use min-width based on width property
                     if (minWidth > 0) {
                       sourceWebp.media = `(min-width: ${minWidth}px)`;
                     }
                     pic.appendChild(sourceWebp);
                   }
                 });
                 
                 // Use smallest crop as fallback for img element
                 const fallbackUrl = `${originalUrl}${paramSeparator}quality=85&preferwebp=true${advanceModifierParams}`;
                 
                 const img = document.createElement('img');
                 img.loading = 'lazy';
                 img.src = fallbackUrl;
                 
                 if (a.href !== a.title) {
                   img.setAttribute('alt', a.title || '');
                 } else {
                   img.setAttribute('alt', '');
                 }
                 
                 pic.appendChild(img);
                 a.replaceWith(pic);
               }
             } catch (error) {
               console.error('Error fetching or processing metadata:', error);
             }
        }
 
         /*
         const url = new URL(a.href);
         if (url.hostname.endsWith('.adobeaemcloud.com')) {
           const pictureEl = picture(
           source({ 
               srcset: `${hrefWOExtn}.webp?width=1400&quality=85&preferwebp=true${rotate ? '&rotate=' + rotate : ''}${flip ? '&flip=' + flip.toLowerCase() : ''}${crop ? '&crop=' + crop.toLowerCase() : ''}`, 
               type: 'image/webp', 
               media: '(min-width: 992px)' 
           }),
           source({ 
               srcset: `${hrefWOExtn}.webp?width=1320&quality=85&preferwebp=true${rotate ? '&rotate=' + rotate : ''}${flip ? '&flip=' + flip.toLowerCase() : ''}${crop ? '&crop=' + crop.toLowerCase() : ''}`, 
               type: 'image/webp', 
               media: '(min-width: 768px)' 
           }),
           source({ 
               srcset: `${hrefWOExtn}.webp?width=780&quality=85&preferwebp=true${rotate ? '&rotate=' + rotate : ''}${flip ? '&flip=' + flip.toLowerCase() : ''}${crop ? '&crop=' + crop.toLowerCase() : ''}`, 
               type: 'image/webp', 
               media: '(min-width: 320px)' 
           }),
           source({ 
               srcset: `${hrefWOExtn}.webp?width=1400&quality=85${rotate ? '&rotate=' + rotate : ''}${flip ? '&flip=' + flip.toLowerCase() : ''}${crop ? '&crop=' + crop.toLowerCase() : ''}`, 
               media: '(min-width: 992px)' 
           }),
           source({ 
               srcset: `${hrefWOExtn}.webp?width=1320&quality=85${rotate ? '&rotate=' + rotate : ''}${flip ? '&flip=' + flip.toLowerCase() : ''}${crop ? '&crop=' + crop.toLowerCase() : ''}`, 
               media: '(min-width: 768px)' 
           }),
           source({ 
               srcset: `${hrefWOExtn}.webp?width=780&quality=85${rotate ? '&rotate=' + rotate : ''}${flip ? '&flip=' + flip.toLowerCase() : ''}${crop ? '&crop=' + crop.toLowerCase() : ''}`, 
               media: '(min-width: 320px)' 
           }),
           img({ 
               src: `${hrefWOExtn}.webp?width=1400&quality=85${rotate ? '&rotate=' + rotate : ''}${flip ? '&flip=' + flip.toLowerCase() : ''}${crop ? '&crop=' + crop.toLowerCase() : ''}`, 
               alt: a.innerText,
               loading:'lazy'
           }),
         );
         
         
         a.replaceWith(pictureEl);
         }
         */
       }
     }
   }
 }

function whatBlockIsThis(element) {
  let currentElement = element;

  while (currentElement.parentElement) {
    if (currentElement.parentElement.classList.contains('block')) return currentElement.parentElement;
    currentElement = currentElement.parentElement;
    if (currentElement.classList.length > 0) return currentElement.classList[0];
  }
  return null;
}

/**
 * remove the adujusts the auto images
 * @param {Element} main The container element
 */
function adjustAutoImages(main) {
  const pictureElement = main.querySelector('div > p > picture');
  if (pictureElement) {
    const pElement = pictureElement.parentElement;
    pElement.className = 'auto-image-container';
  }
}

/**
 * Loads everything that happens a lot later,
 * without impacting the user experience.
 */
function loadDelayed() {
  // eslint-disable-next-line import/no-cycle
  window.setTimeout(() => import('./delayed.js'), 3000);
  // load anything that can be postponed to the latest here
}

async function loadPage() {
  window.wbgData ||= {};
  await loadEager(document);
  await loadLazy(document);
  loadDelayed();
}

loadPage();
