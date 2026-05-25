import * as SecureStore from 'expo-secure-store';

const SECURE_STORE_CHUNK_SIZE = 1800;

async function secureGetItem(key: string): Promise<string | null> {
  const chunkCount = await SecureStore.getItemAsync(`${key}_chunks`);
  if (!chunkCount) {
    return SecureStore.getItemAsync(key);
  }

  const count = Number.parseInt(chunkCount, 10);
  const chunks: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const chunk = await SecureStore.getItemAsync(`${key}_chunk_${i}`);
    if (chunk) chunks.push(chunk);
  }
  return chunks.join('');
}

async function secureSetItem(key: string, value: string): Promise<void> {
  await SecureStore.deleteItemAsync(key);
  const chunkKey = `${key}_chunks`;
  const existingChunks = await SecureStore.getItemAsync(chunkKey);
  if (existingChunks) {
    const count = Number.parseInt(existingChunks, 10);
    for (let i = 0; i < count; i += 1) {
      await SecureStore.deleteItemAsync(`${key}_chunk_${i}`);
    }
    await SecureStore.deleteItemAsync(chunkKey);
  }

  if (value.length <= SECURE_STORE_CHUNK_SIZE) {
    await SecureStore.setItemAsync(key, value);
    return;
  }

  const chunkCount = Math.ceil(value.length / SECURE_STORE_CHUNK_SIZE);
  await SecureStore.setItemAsync(chunkKey, String(chunkCount));
  for (let i = 0; i < chunkCount; i += 1) {
    const start = i * SECURE_STORE_CHUNK_SIZE;
    const chunk = value.slice(start, start + SECURE_STORE_CHUNK_SIZE);
    await SecureStore.setItemAsync(`${key}_chunk_${i}`, chunk);
  }
}

async function secureRemoveItem(key: string): Promise<void> {
  await SecureStore.deleteItemAsync(key);
  const chunkKey = `${key}_chunks`;
  const chunkCount = await SecureStore.getItemAsync(chunkKey);
  if (chunkCount) {
    const count = Number.parseInt(chunkCount, 10);
    for (let i = 0; i < count; i += 1) {
      await SecureStore.deleteItemAsync(`${key}_chunk_${i}`);
    }
    await SecureStore.deleteItemAsync(chunkKey);
  }
}

export const authStorage = {
  getItem: secureGetItem,
  setItem: secureSetItem,
  removeItem: secureRemoveItem,
};
