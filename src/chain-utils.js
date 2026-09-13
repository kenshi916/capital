import { getAddress, parseUnits, formatUnits, keccak256 } from 'ethers';
export function escapeHTML(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }
export function safeURL(value) {
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : ''; } catch { return ''; }
}
export function amount(value, zero = false) {
  const text = String(value).trim();
  if (!/^\d+(\.\d{1,6})?$/.test(text)) throw new Error('Use a positive amount with up to six decimal places.');
  const result = parseUnits(text, 6);
  if (result < 0n || (!zero && result === 0n) || result > parseUnits('1000000000000', 6)) throw new Error('Enter an amount above zero and below one trillion test dollars.');
  return result;
}
export function dollars(value) {
  if (value == null) return '—';
  const [whole, fraction = ''] = formatUnits(value, 6).split('.');
  return Number(whole).toLocaleString('en-US') + '.' + fraction.padEnd(2, '0').slice(0, 2);
}
export function exactDollars(value) { return formatUnits(value, 6); }
export function address(value) { try { return getAddress(value.trim()); } catch { throw new Error('Enter a valid Ethereum wallet or contract address.'); } }
export function shortAddress(value) { return value ? `${value.slice(0, 6)}…${value.slice(-4)}` : 'Not connected'; }
export function normalizedCode(code, artifact) {
  const bytes = code.slice(2).split('');
  for (const refs of Object.values(artifact.immutableReferences || {})) for (const ref of refs) {
    for (let i = ref.start * 2; i < (ref.start + ref.length) * 2; i++) bytes[i] = '0';
  }
  return keccak256('0x' + bytes.join(''));
}
export function sameContract(code, artifact) {
  return code.length === artifact.deployedBytecode.length && normalizedCode(code, artifact) === normalizedCode(artifact.deployedBytecode, artifact);
}
