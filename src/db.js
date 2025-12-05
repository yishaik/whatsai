import { get, set } from 'idb-keyval';

export const idbGet = async (key) => {
  return await get(key);
};

export const idbSet = async (key, value) => {
  return await set(key, value);
};

export const idbReady = () => {
  // The library is always ready
  return Promise.resolve();
};