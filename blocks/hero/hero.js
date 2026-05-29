import { getMetadata } from '../../scripts/aem.js';
import { isAuthorEnvironment, moveInstrumentation } from '../../scripts/scripts.js';

/* Video file extensions recognised for auto-detection */
const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.mov', '.ogg', '.m4v', '.avi'];

/**
 * Check whether a given <a> element points to a video file.
 * Works with both media-bus URLs (./media_<hash>.mp4) and
 * DM delivery URLs (…/renditions/original/as/file.mp4?assetname=file.mp4).
 *
 * @param {HTMLAnchorElement} link
 * @returns {boolean}
 */
function isVideoLink(link) {
  if (!link || !link.href) return false;
  try {
    const url = new URL(link.href, window.location.origin);
    const pathname = url.pathname.toLowerCase();
    if (VIDEO_EXTENSIONS.some((ext) => pathname.endsWith(ext))) return true;

    const assetName = url.searchParams.get('assetname') || '';
    if (VIDEO_EXTENSIONS.some((ext) => assetName.toLowerCase().endsWith(ext))) return true;
  } catch (_) {
    // malformed URL — not a video
  }
  return false;
}

/**
 * Find the first video link anywhere inside the block.
 * The reference field can place the <a> in div:nth-child(1) or
 * div:nth-child(2) depending on how UE serialises the content.
 *
 * @param {Element} block
 * @returns {HTMLAnchorElement|null}
 */
function findVideoLink(block) {
  const links = block.querySelectorAll('a[href]');
  for (const link of links) {
    if (isVideoLink(link)) return link;
  }
  return null;
}

/**
 * Remove every video-URL <a> from the block DOM.
 * Also removes the parent <p> if it becomes empty after the link is removed.
 *
 * @param {Element} block
 */
function removeVideoLinks(block) {
  block.querySelectorAll('a[href]').forEach((link) => {
    if (isVideoLink(link)) {
      const parent = link.parentElement;
      link.remove();
      // If the wrapping <p> is now empty, remove it too
      if (parent && parent.tagName === 'P' && parent.textContent.trim() === '') {
        parent.remove();
      }
    }
  });
}

/**
 * Check whether a div has meaningful authored content
 * (headings, paragraphs with real text, or button containers).
 *
 * @param {Element} div
 * @returns {boolean}
 */
function hasMeaningfulContent(div) {
  if (!div) return false;
  if (div.querySelector('h1, h2, h3, h4, h5, h6')) return true;
  if (div.querySelector('.button-container')) return true;

  const hasText = [...div.querySelectorAll('p')].some(
    (p) => !p.classList.contains('button-container') && p.textContent.trim().length > 0,
  );
  return hasText;
}

/**
 * Hero block decorator.
 * Supports both image and video backgrounds — asset type is auto-detected.
 * Video plays muted, looped, autoplayed with no controls (background video).
 *
 * DOM child-div order (matches model field order):
 *   1  image + imageAlt   (reference + text share same row)
 *   2  text               (richtext — headings, paragraphs, CTA)
 *   3  enableunderline
 *   4  herolayout
 *   5  ctastyle
 *   6  backgroundstyle
 *
 * @param {Element} block
 */
export default function decorate(block) {
  // --- Read configuration from authored DOM children ---
  const enableUnderline = block.querySelector(':scope div:nth-child(3) > div')?.textContent?.trim() || 'true';
  const layoutStyle = block.querySelector(':scope div:nth-child(4) > div')?.textContent?.trim() || 'overlay';
  const ctaStyle = block.querySelector(':scope div:nth-child(5) > div')?.textContent?.trim() || 'default';
  const backgroundStyle = block.querySelector(':scope div:nth-child(6) > div')?.textContent?.trim() || 'default';

  // --- Apply layout & theme classes ---
  if (layoutStyle) block.classList.add(layoutStyle);
  if (backgroundStyle) block.classList.add(backgroundStyle);
  if (enableUnderline.toLowerCase() === 'false') block.classList.add('removeunderline');

  // --- CTA styling ---
  const buttonContainer = block.querySelector('p.button-container');
  if (buttonContainer) {
    buttonContainer.classList.add(`cta-${ctaStyle}`);
  }

  const ctaStyleParagraph = block.querySelector('p[data-aue-prop="ctastyle"]');
  if (ctaStyleParagraph) {
    ctaStyleParagraph.style.display = 'none';
  }

  // --- Auto-detect video from any <a> in the block ---
  const videoLink = findVideoLink(block);

  if (videoLink) {
    block.classList.add('hero-video');
    const videoUrl = videoLink.href;

    // Remove ALL video-URL links from the DOM before building the player.
    // The link can appear in div:1 (asset slot) or div:2 (text content)
    // depending on how UE serialises the reference field.
    removeVideoLinks(block);

    // Create a plain HTML5 <video> — no controls, background behaviour
    const video = document.createElement('video');
    video.src = videoUrl;
    video.autoplay = true;
    video.loop = true;
    video.muted = true;
    video.playsInline = true;
    video.setAttribute('disablepictureinpicture', '');
    video.setAttribute('disableremoteplayback', '');
    video.className = 'hero-video-bg';

    const isBackgroundLayout = [
      'overlay',
      'image-background-text-left',
      'image-background-text-right',
    ].includes(layoutStyle);

    if (isBackgroundLayout) {
      // Absolute-positioned behind the text overlay
      block.prepend(video);
    } else {
      // In-flow — place in the first div (asset slot)
      const assetDiv = block.querySelector(':scope > div:first-child');
      if (assetDiv) {
        assetDiv.innerHTML = '';
        assetDiv.appendChild(video);
      }
    }
  }

  // --- Hide the text overlay div if it has no meaningful authored content ---
  const textDiv = block.querySelector(':scope > div:nth-child(2)');
  if (!hasMeaningfulContent(textDiv)) {
    if (textDiv) textDiv.style.display = 'none';
  }

  // --- Hide the asset div if it's empty (video was moved out, or no asset) ---
  const assetDiv = block.querySelector(':scope > div:first-child');
  if (assetDiv && assetDiv.textContent.trim() === '' && !assetDiv.querySelector('picture, video')) {
    assetDiv.style.display = 'none';
  }

  // --- Hide configuration-only divs ---
  [3, 4, 5, 6].forEach((n) => {
    const div = block.querySelector(`:scope > div:nth-child(${n})`);
    if (div) div.style.display = 'none';
  });
}
