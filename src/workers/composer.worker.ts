import { composeProject } from '../core/composer';
import type { Project } from '../types';

self.onmessage = (e: MessageEvent<{ project: Project; format: 'lottie' | 'css' }>) => {
  try {
    const { project, format } = e.data;
    if (format === 'lottie') {
      const result = composeProject(project);
      self.postMessage({ type: 'success', format, result });
    } else if (format === 'css') {
      import('../core/composer/cssExport').then(({ exportCssKeyframes }) => {
        const result = exportCssKeyframes(project);
        self.postMessage({ type: 'success', format, result });
      });
    }
  } catch (err) {
    self.postMessage({ type: 'error', message: String(err) });
  }
};
