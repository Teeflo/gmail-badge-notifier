/**
 * Handles audio playback requests from the service worker.
 */
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === 'play' && message.src) {
    try {
      const audio = new Audio(message.src);
      audio.play().catch((e) => console.error('Failed to play sound', e));
    } catch (e) {
      console.error('Failed to play sound', e);
    }
  }
});
