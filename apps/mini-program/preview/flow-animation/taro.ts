const Taro = {
  getStorageSync(key: string) {
    const value = window.localStorage.getItem(key)
    return value === 'true' ? true : value
  },
  setStorageSync(key: string, value: unknown) {
    window.localStorage.setItem(key, String(value))
  },
  removeStorageSync(key: string) {
    window.localStorage.removeItem(key)
  },
  getSystemInfoSync() {
    return { reduceMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches }
  },
}

export default Taro
