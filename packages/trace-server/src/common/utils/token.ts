import * as crypto from 'crypto';

const SECRET = process.env.JWT_SECRET || 'tracega-dev-secret';
const ALGORITHM = 'HS256';

function base64UrlEncode(data: string): string {
  return Buffer.from(data).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function base64UrlDecode(str: string): string {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return Buffer.from(str, 'base64').toString('utf-8');
}

/**
 * 签发 JWT token
 */
export function signToken(payload: Record<string, any>, expiresIn: string = '7d'): string {
  const header = { alg: ALGORITHM, typ: 'JWT' };

  // 解析过期时间
  const expMap: Record<string, number> = { d: 86400, h: 3600, m: 60, s: 1 };
  const match = expiresIn.match(/^(\d+)([dhms])$/);
  const expiresSeconds = match ? parseInt(match[1]) * (expMap[match[2]] || 86400) : 86400 * 7;

  const now = Math.floor(Date.now() / 1000);
  const tokenPayload = { ...payload, iat: now, exp: now + expiresSeconds };

  const headerEncoded = base64UrlEncode(JSON.stringify(header));
  const payloadEncoded = base64UrlEncode(JSON.stringify(tokenPayload));
  const signature = crypto.createHmac('sha256', SECRET).update(`${headerEncoded}.${payloadEncoded}`).digest('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

  return `${headerEncoded}.${payloadEncoded}.${signature}`;
}

/**
 * 验证 JWT token，返回 payload
 */
export function verifyToken(token: string): Record<string, any> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [headerEncoded, payloadEncoded, signature] = parts;

    // 验证签名
    const expectedSignature = crypto
      .createHmac('sha256', SECRET)
      .update(`${headerEncoded}.${payloadEncoded}`)
      .digest('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

    // 使用 timing-safe 比较防止时序攻击
    const sigBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);
    if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
      return null;
    }

    // 解码并检查过期
    const payloadStr = base64UrlDecode(payloadEncoded);
    const payload = JSON.parse(payloadStr);

    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null; // token 已过期
    }

    return payload;
  } catch {
    return null;
  }
}
