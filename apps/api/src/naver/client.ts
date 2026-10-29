import { hash, truncates } from 'bcryptjs';

type RecordValue = Record<string, unknown>;
export function object(value: unknown): RecordValue {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new NaverCommerceError('INVALID_RESPONSE');
  return value as RecordValue;
}

export class NaverCommerceError extends Error {
  constructor(
    public readonly code: string,
    public readonly status?: number,
  ) {
    super(`네이버 API 연결 실패: ${code}`);
    this.name = 'NaverCommerceError';
  }
}

type Credentials = {
  clientId: string;
  clientSecret: string;
  type: 'SELF' | 'SELLER';
  accountId?: string;
};

export function credentialsFromEnv(env = process.env): Credentials {
  const clientId = env.NAVER_CLIENT_ID?.trim();
  const clientSecret = env.NAVER_CLIENT_SECRET?.trim();
  const type = env.NAVER_AUTH_TYPE?.trim();
  const accountId = env.NAVER_ACCOUNT_ID?.trim();
  if (
    !clientId ||
    !clientSecret ||
    (type !== 'SELF' && type !== 'SELLER') ||
    (type === 'SELLER' && !accountId)
  )
    throw new NaverCommerceError('MISSING_CONFIGURATION');
  return { clientId, clientSecret, type, accountId };
}

export async function createSignature(clientId: string, secret: string, timestamp: number) {
  const password = `${clientId}_${timestamp}`;
  if (truncates(password)) throw new NaverCommerceError('INVALID_CONFIGURATION');
  try {
    return Buffer.from(await hash(password, secret), 'utf8').toString('base64');
  } catch {
    throw new NaverCommerceError('INVALID_CONFIGURATION');
  }
}

export class NaverReadClient {
  #token?: { value: string; expiresAt: number };
  #pending?: Promise<string>;
  constructor(
    private readonly credentials: Credentials,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  async #call(path: string, init: RequestInit): Promise<{ status: number; data: unknown }> {
    try {
      const response = await this.fetcher(`https://api.commerce.naver.com/external${path}`, {
        ...init,
        redirect: 'error',
        signal: AbortSignal.timeout(15000),
      });
      const data: unknown = await response.json();
      return { status: response.status, data };
    } catch {
      throw new NaverCommerceError('NETWORK_OR_RESPONSE_ERROR');
    }
  }

  #error(status: number, data: unknown): NaverCommerceError {
    let code = 'API_ERROR';
    try {
      const raw = object(data).code;
      if (
        typeof raw === 'string' &&
        [
          'GW.AUTHN',
          'GW.IP_NOT_ALLOWED',
          'GW.RATE_LIMIT',
          'BadRequest',
          'NOT_FOUND',
          'FORBIDDEN',
        ].includes(raw)
      )
        code = raw;
    } catch {
      /* No raw response or remote message is surfaced. */
    }
    return new NaverCommerceError(status === 429 ? 'RATE_LIMIT' : code, status);
  }

  async #accessToken(): Promise<string> {
    if (this.#token && this.#token.expiresAt > Date.now() + 60000) return this.#token.value;
    if (this.#pending) return this.#pending;
    this.#pending = this.#issueToken();
    try {
      return await this.#pending;
    } finally {
      this.#pending = undefined;
    }
  }

  async #issueToken(): Promise<string> {
    const timestamp = Date.now();
    const sign = await createSignature(
      this.credentials.clientId,
      this.credentials.clientSecret,
      timestamp,
    );
    const body = new URLSearchParams({
      client_id: this.credentials.clientId,
      timestamp: String(timestamp),
      client_secret_sign: sign,
      grant_type: 'client_credentials',
      type: this.credentials.type,
    });
    if (this.credentials.type === 'SELLER') body.set('account_id', this.credentials.accountId!);
    const result = await this.#call('/v1/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (result.status !== 200) throw this.#error(result.status, result.data);
    const data = object(result.data);
    if (
      typeof data.access_token !== 'string' ||
      !data.access_token ||
      typeof data.expires_in !== 'number' ||
      !Number.isFinite(data.expires_in) ||
      data.expires_in <= 0
    )
      throw new NaverCommerceError('INVALID_TOKEN_RESPONSE');
    this.#token = { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
    return this.#token.value;
  }

  async #read(path: string, method: 'GET' | 'POST', body?: object): Promise<RecordValue> {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const token = await this.#accessToken();
      const result = await this.#call(path, {
        method,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      if (result.status === 200) return object(result.data);
      const error = this.#error(result.status, result.data);
      if (result.status === 401 && error.code === 'GW.AUTHN' && attempt === 0) {
        this.#token = undefined;
        continue;
      }
      throw error;
    }
    throw new NaverCommerceError('AUTH_RETRY_EXHAUSTED');
  }

  async listProducts(page = 1, size = 20, sellerCode?: string) {
    if (!Number.isInteger(page) || page < 1 || !Number.isInteger(size) || size < 1 || size > 100)
      throw new NaverCommerceError('INVALID_REQUEST');
    const data = await this.#read('/v1/products/search', 'POST', {
      page,
      size,
      orderType: 'NO',
      ...(sellerCode ? { searchKeywordType: 'SELLER_CODE', sellerManagementCode: sellerCode } : {}),
    });
    if (!Array.isArray(data.contents)) throw new NaverCommerceError('INVALID_PRODUCT_LIST');
    return data;
  }

  getOriginProduct(originProductNo: string) {
    if (!/^\d{1,20}$/.test(originProductNo)) throw new NaverCommerceError('INVALID_PRODUCT_ID');
    return this.#read(`/v2/products/origin-products/${originProductNo}`, 'GET');
  }
}
