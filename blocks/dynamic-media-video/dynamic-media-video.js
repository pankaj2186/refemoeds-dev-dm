let dmViewerPromise;

/**
 * Decorate the dm-video block.
 * @param {Element} block The block root element.
 */
export default async function decorate(block) {
 
  <div class="dm-video-player"></div>

  if (!window.dmviewers || !window.dmviewers.VideoViewer) {
    console.error('DM VideoViewer not available on window.dmviewers');
    return;
  }
  /*
  // Extract data from the block HTML
  const poster = block.querySelector('.dm-video-poster')?.textContent?.trim();
  const dash = block.querySelector('.dm-video-dash')?.textContent?.trim();
  const hls = block.querySelector('.dm-video-hls')?.textContent?.trim();

  // Create a container for the DM viewer
  const playerContainer = block.querySelector('.dm-video-player') || document.createElement('div');
  playerContainer.id = playerContainer.id || `dm-video-${crypto.randomUUID()}`;
  if (!playerContainer.isConnected) {
    block.appendChild(playerContainer);
  }

  const params = {
    posterimage: poster || '',
    sources: {},
  };

  if (dash) params.sources.DASH = dash;
  if (hls) params.sources.HLS = hls;

  // Instantiate viewer
  const s7videoviewer = new window.dmviewers.VideoViewer({
    containerId: playerContainer.id,
    params,
  });

  s7videoviewer.init();
  */
}
