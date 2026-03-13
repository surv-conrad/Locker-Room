import { toPng } from 'html-to-image';

export const exportAsImage = async (element: HTMLElement | null, filename: string) => {
  if (!element) return;
  try {
    const dataUrl = await toPng(element, {
      quality: 1.0,
      pixelRatio: 2, // High resolution for social media
      backgroundColor: '#0B0E14', // Match app background
      style: {
        // Ensure no scrollbars or weird overflow issues in the exported image
        overflow: 'hidden',
      },
      filter: (node) => {
        // Hide elements with the 'hide-on-export' class
        if (node instanceof HTMLElement && node.classList?.contains('hide-on-export')) {
          return false;
        }
        return true;
      }
    });
    
    const link = document.createElement('a');
    link.download = `${filename}.png`;
    link.href = dataUrl;
    link.click();
  } catch (err) {
    console.error('Failed to export image', err);
  }
};
