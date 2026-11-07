const Store = {
  get: k => { try { return JSON.parse(localStorage.getItem(k)); } catch (_) { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} },
  del: k => { try { localStorage.removeItem(k); } catch (_) {} }
};

const Api = {
  async _do(req) {
    const r = await (await req).json();
    if (r.code === 'AUTH') { Store.del('token'); Store.del('G'); location.hash = '#login'; }
    return r;
  },
  get(action, params = {}) {
    const q = new URLSearchParams({ action, token: Store.get('token') || '', ...params });
    return this._do(fetch(GAS_URL + '?' + q));
  },
  post(action, body = {}) {
    return this._do(fetch(GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // wajib: hindari preflight CORS
      body: JSON.stringify({ action, token: Store.get('token') || '', ...body })
    }));
  }
};
