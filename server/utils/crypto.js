import crypto from 'crypto';

export const cryptoNative = {
  randomUUID: () => crypto.randomUUID(),
  randomHex: (bytes = 32) => crypto.randomBytes(bytes).toString('hex'),
};
