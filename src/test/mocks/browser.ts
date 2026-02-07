import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';

// Setup MSW browser worker for development
export const worker = setupWorker(...handlers);
