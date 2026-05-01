import { parseSvg } from '../core/parser';

self.onmessage = async (e: MessageEvent<{ svgString: string; totalFrames: number }>) => {
  try {
    const { svgString, totalFrames } = e.data;
    const result = await parseSvg(svgString, totalFrames);
    self.postMessage({ type: 'success', result });
  } catch (err) {
    self.postMessage({ type: 'error', message: String(err) });
  }
};
