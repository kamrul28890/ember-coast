import { decide, assessTrade, proposeTrade } from './ai.mjs';
self.onmessage = ({ data }) => {
  try {
    const result = data.operation === 'assess' ? assessTrade(data.view, data.offer) : data.operation === 'propose' ? proposeTrade(data.view) : decide(data.view, data.options);
    self.postMessage({ id: data.id, result });
  } catch (error) { self.postMessage({ id: data.id, error: error.message }); }
};
