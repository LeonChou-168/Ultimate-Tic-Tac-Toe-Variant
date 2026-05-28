import { randomInt } from 'node:crypto';

const ROOM_ID_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const RECONNECT_TOKEN_ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

function randomFromAlphabet(alphabet: string, length: number): string {
  let value = '';

  for (let index = 0; index < length; index += 1) {
    value += alphabet[randomInt(0, alphabet.length)] ?? alphabet[0] ?? 'A';
  }

  return value;
}

export function generateRoomId(length = 6): string {
  return randomFromAlphabet(ROOM_ID_ALPHABET, length);
}

export function generateReconnectToken(length = 24): string {
  return randomFromAlphabet(RECONNECT_TOKEN_ALPHABET, length);
}
