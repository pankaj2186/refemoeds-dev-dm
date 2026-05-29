import { getMetadata } from '../../scripts/aem.js';
import { isAuthorEnvironment, moveInstrumentation } from '../../scripts/scripts.js';

/* Video file extensions recognised for auto-detection */
const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.mov', '.ogg', '.m4v', '.avi'];

/**
 * Detect whether the first child div holds a video asset.
 *
 * On aem.live (published) — images become <picture> elements; videos stay
 * as <a href="./media_<hash>.mp4"> with the original extension preserved
 * through the media bus.
 *
 * In Universal Editor / author — images render as <picture>; videos stay
 * as <a href="…delivery…/urn:…/renditions/original/as/file.mp4">.
 *
 * @param {Element} assetDiv  The first child div of the hero block
 * @returns {'image'|'video'|'none'}
 */
function detectAssetType(assetDiv) {
  if (!assetDiv) return 'none';

  if (assetDiv.querySelector('picture')) return 'image';

  const link = assetDiv.querySelector('a[href]');
  if (link) {
    try {
      const url = new URL(link.href, window.location.origin);
      const pathname = url.pathname.toLowerCase();
      if (VIDEO_EXTENSIONS.some((ext) => pathname.endsWith(ext))) return 'video';

      const assetName = url.searchParams.get('assetname') || '';
      if (VIDEO_EXTENSIONS.some((ext) => assetName.toLowerCase().endsWith(ext))) return 'video';
    } catch (_) {
      // malformed URL — ignore
    }
  }

  return 'none';
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

  // --- Auto-detect asset type from the first child div ---
  const assetDiv = block.querySelector(':scope > div:first-child');
  const assetType = detectAssetType(assetDiv);

  if (assetType === 'video') {
    block.classList.add('hero-video');

    const videoLink = assetDiv.querySelector('a[href]');
    if (videoLink) {
      const videoUrl = videoLink.href;

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
        // Hide the original asset div (contains the raw link text)
        assetDiv.style.display = 'none';
      } else {
        // In-flow — replaces the image slot
        assetDiv.innerHTML = '';
        assetDiv.appendChild(video);
      }
    }
  }

  // --- Hide the text overlay div if it has no meaningful authored content ---
  const textDiv = block.querySelector(':scope > div:nth-child(2)');
  if (textDiv) {
    // Check for real content: headings, paragraphs with text, buttons, or links
    const hasHeading = textDiv.querySelector('h1, h2, h3, h4, h5, h6');
    const hasButton = textDiv.querySelector('.button-container');
    const hasText = [...textDiv.querySelectorAll('p')].some(
      (p) => !p.classList.contains('button-container') && p.textContent.trim().length > 0,
    );

    if (!hasHeading && !hasButton && !hasText) {
      textDiv.style.display = 'none';
    }
  }

  // --- Hide configuration-only divs ---
  [3, 4, 5, 6].forEach((n) => {
    const div = block.querySelector(`:scope > div:nth-child(${n})`);
    if (div) div.style.display = 'none';
  });
}
