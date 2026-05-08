import { load } from '@tauri-apps/plugin-store'
import { api } from './api'

const STORE_PATH = 'settings.json'

export async function initApiKey() {
  const store = await load(STORE_PATH)
  const key = await store.get<string>('apiKey')
  if (key) {
    await api.setApiKey(key)
  }
  return !!key
}

export async function saveApiKey(key: string) {
  await api.setApiKey(key)
  const store = await load(STORE_PATH)
  await store.set('apiKey', key)
  await store.save()
}
