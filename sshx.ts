/**
 * sshx (https://sshx.io) live web-terminal links.
 *
 * A session URL looks like:  https://sshx.io/s/<id>#<encryption-key>
 * The fragment after `#` is the end-to-end encryption key, so ANYONE holding
 * the full link gets a real shell. Treat these links as secrets: never log
 * them in full and only show them to the VM owner / administrators.
 *
 * Shared by server routes and client components — keep it dependency-free.
 */

export const SSHX_INSTALL_CMD = "curl -sSf https://sshx.io/get | sh -s run";

/** Accepts official sshx.io session links. */
const SSHX_PATTERN = /^https:\/\/sshx\.io\/s\/[A-Za-z0-9_-]+(#[A-Za-z0-9_,-]+)?$/;

export function isValidSshxUrl(url: string): boolean {
  return SSHX_PATTERN.test(url.trim());
}

/** Safe-to-log form: keeps the session id, drops the encryption key. */
export function redactSshxUrl(url: string | null | undefined): string {
  if (!url) return "none";
  const hash = url.indexOf("#");
  return hash === -1 ? url : `${url.slice(0, hash)}#<key-hidden>`;
}
