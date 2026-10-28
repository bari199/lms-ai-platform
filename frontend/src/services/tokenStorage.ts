let accessToken: string | null = null;
let refreshToken: string | null = null;

export function setAccessToken(token: string) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}

export function clearAccessToken() {
  accessToken = null;
}

export function setRefreshToken(token: string) {
  refreshToken = token;
}

export function getRefreshToken() {
  return refreshToken;
}

export function clearRefreshToken() {
  refreshToken = null;
}

export function clearTokens() {
  accessToken = null;
  refreshToken = null;
}
