/**
 * AsyncStorage, behind one module.
 *
 * The key-value store is the only native dependency the shell needs, and routing
 * it through a named bridge keeps the rest of the code free of its import. It
 * also gives one place to state the rule that matters: nothing stored here is
 * evidence. It is a cache and a flag, and the record lives on the chain.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export const AsyncStorageBridge = {
  getItem: (key: string) => AsyncStorage.getItem(key),
  setItem: (key: string, value: string) => AsyncStorage.setItem(key, value),
  removeItem: (key: string) => AsyncStorage.removeItem(key),
};
