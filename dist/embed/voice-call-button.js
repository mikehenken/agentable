const R = globalThis, B = R.ShadowRoot && (R.ShadyCSS === void 0 || R.ShadyCSS.nativeShadow) && "adoptedStyleSheets" in Document.prototype && "replace" in CSSStyleSheet.prototype, V = /* @__PURE__ */ Symbol(), G = /* @__PURE__ */ new WeakMap();
let ut = class {
  constructor(t, s, e) {
    if (this._$cssResult$ = !0, e !== V) throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");
    this.cssText = t, this.t = s;
  }
  get styleSheet() {
    let t = this.o;
    const s = this.t;
    if (B && t === void 0) {
      const e = s !== void 0 && s.length === 1;
      e && (t = G.get(s)), t === void 0 && ((this.o = t = new CSSStyleSheet()).replaceSync(this.cssText), e && G.set(s, t));
    }
    return t;
  }
  toString() {
    return this.cssText;
  }
};
const wt = (r) => new ut(typeof r == "string" ? r : r + "", void 0, V), St = (r, ...t) => {
  const s = r.length === 1 ? r[0] : t.reduce((e, i, n) => e + ((o) => {
    if (o._$cssResult$ === !0) return o.cssText;
    if (typeof o == "number") return o;
    throw Error("Value passed to 'css' function must be a 'css' function result: " + o + ". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.");
  })(i) + r[n + 1], r[0]);
  return new ut(s, r, V);
}, Et = (r, t) => {
  if (B) r.adoptedStyleSheets = t.map((s) => s instanceof CSSStyleSheet ? s : s.styleSheet);
  else for (const s of t) {
    const e = document.createElement("style"), i = R.litNonce;
    i !== void 0 && e.setAttribute("nonce", i), e.textContent = s.cssText, r.appendChild(e);
  }
}, J = B ? (r) => r : (r) => r instanceof CSSStyleSheet ? ((t) => {
  let s = "";
  for (const e of t.cssRules) s += e.cssText;
  return wt(s);
})(r) : r;
const { is: xt, defineProperty: Ct, getOwnPropertyDescriptor: Pt, getOwnPropertyNames: kt, getOwnPropertySymbols: Tt, getPrototypeOf: Ot } = Object, N = globalThis, X = N.trustedTypes, Mt = X ? X.emptyScript : "", Ut = N.reactiveElementPolyfillSupport, C = (r, t) => r, H = { toAttribute(r, t) {
  switch (t) {
    case Boolean:
      r = r ? Mt : null;
      break;
    case Object:
    case Array:
      r = r == null ? r : JSON.stringify(r);
  }
  return r;
}, fromAttribute(r, t) {
  let s = r;
  switch (t) {
    case Boolean:
      s = r !== null;
      break;
    case Number:
      s = r === null ? null : Number(r);
      break;
    case Object:
    case Array:
      try {
        s = JSON.parse(r);
      } catch {
        s = null;
      }
  }
  return s;
} }, K = (r, t) => !xt(r, t), Q = { attribute: !0, type: String, converter: H, reflect: !1, useDefault: !1, hasChanged: K };
Symbol.metadata ??= /* @__PURE__ */ Symbol("metadata"), N.litPropertyMetadata ??= /* @__PURE__ */ new WeakMap();
let A = class extends HTMLElement {
  static addInitializer(t) {
    this._$Ei(), (this.l ??= []).push(t);
  }
  static get observedAttributes() {
    return this.finalize(), this._$Eh && [...this._$Eh.keys()];
  }
  static createProperty(t, s = Q) {
    if (s.state && (s.attribute = !1), this._$Ei(), this.prototype.hasOwnProperty(t) && ((s = Object.create(s)).wrapped = !0), this.elementProperties.set(t, s), !s.noAccessor) {
      const e = /* @__PURE__ */ Symbol(), i = this.getPropertyDescriptor(t, e, s);
      i !== void 0 && Ct(this.prototype, t, i);
    }
  }
  static getPropertyDescriptor(t, s, e) {
    const { get: i, set: n } = Pt(this.prototype, t) ?? { get() {
      return this[s];
    }, set(o) {
      this[s] = o;
    } };
    return { get: i, set(o) {
      const h = i?.call(this);
      n?.call(this, o), this.requestUpdate(t, h, e);
    }, configurable: !0, enumerable: !0 };
  }
  static getPropertyOptions(t) {
    return this.elementProperties.get(t) ?? Q;
  }
  static _$Ei() {
    if (this.hasOwnProperty(C("elementProperties"))) return;
    const t = Ot(this);
    t.finalize(), t.l !== void 0 && (this.l = [...t.l]), this.elementProperties = new Map(t.elementProperties);
  }
  static finalize() {
    if (this.hasOwnProperty(C("finalized"))) return;
    if (this.finalized = !0, this._$Ei(), this.hasOwnProperty(C("properties"))) {
      const s = this.properties, e = [...kt(s), ...Tt(s)];
      for (const i of e) this.createProperty(i, s[i]);
    }
    const t = this[Symbol.metadata];
    if (t !== null) {
      const s = litPropertyMetadata.get(t);
      if (s !== void 0) for (const [e, i] of s) this.elementProperties.set(e, i);
    }
    this._$Eh = /* @__PURE__ */ new Map();
    for (const [s, e] of this.elementProperties) {
      const i = this._$Eu(s, e);
      i !== void 0 && this._$Eh.set(i, s);
    }
    this.elementStyles = this.finalizeStyles(this.styles);
  }
  static finalizeStyles(t) {
    const s = [];
    if (Array.isArray(t)) {
      const e = new Set(t.flat(1 / 0).reverse());
      for (const i of e) s.unshift(J(i));
    } else t !== void 0 && s.push(J(t));
    return s;
  }
  static _$Eu(t, s) {
    const e = s.attribute;
    return e === !1 ? void 0 : typeof e == "string" ? e : typeof t == "string" ? t.toLowerCase() : void 0;
  }
  constructor() {
    super(), this._$Ep = void 0, this.isUpdatePending = !1, this.hasUpdated = !1, this._$Em = null, this._$Ev();
  }
  _$Ev() {
    this._$ES = new Promise((t) => this.enableUpdating = t), this._$AL = /* @__PURE__ */ new Map(), this._$E_(), this.requestUpdate(), this.constructor.l?.forEach((t) => t(this));
  }
  addController(t) {
    (this._$EO ??= /* @__PURE__ */ new Set()).add(t), this.renderRoot !== void 0 && this.isConnected && t.hostConnected?.();
  }
  removeController(t) {
    this._$EO?.delete(t);
  }
  _$E_() {
    const t = /* @__PURE__ */ new Map(), s = this.constructor.elementProperties;
    for (const e of s.keys()) this.hasOwnProperty(e) && (t.set(e, this[e]), delete this[e]);
    t.size > 0 && (this._$Ep = t);
  }
  createRenderRoot() {
    const t = this.shadowRoot ?? this.attachShadow(this.constructor.shadowRootOptions);
    return Et(t, this.constructor.elementStyles), t;
  }
  connectedCallback() {
    this.renderRoot ??= this.createRenderRoot(), this.enableUpdating(!0), this._$EO?.forEach((t) => t.hostConnected?.());
  }
  enableUpdating(t) {
  }
  disconnectedCallback() {
    this._$EO?.forEach((t) => t.hostDisconnected?.());
  }
  attributeChangedCallback(t, s, e) {
    this._$AK(t, e);
  }
  _$ET(t, s) {
    const e = this.constructor.elementProperties.get(t), i = this.constructor._$Eu(t, e);
    if (i !== void 0 && e.reflect === !0) {
      const n = (e.converter?.toAttribute !== void 0 ? e.converter : H).toAttribute(s, e.type);
      this._$Em = t, n == null ? this.removeAttribute(i) : this.setAttribute(i, n), this._$Em = null;
    }
  }
  _$AK(t, s) {
    const e = this.constructor, i = e._$Eh.get(t);
    if (i !== void 0 && this._$Em !== i) {
      const n = e.getPropertyOptions(i), o = typeof n.converter == "function" ? { fromAttribute: n.converter } : n.converter?.fromAttribute !== void 0 ? n.converter : H;
      this._$Em = i;
      const h = o.fromAttribute(s, n.type);
      this[i] = h ?? this._$Ej?.get(i) ?? h, this._$Em = null;
    }
  }
  requestUpdate(t, s, e, i = !1, n) {
    if (t !== void 0) {
      const o = this.constructor;
      if (i === !1 && (n = this[t]), e ??= o.getPropertyOptions(t), !((e.hasChanged ?? K)(n, s) || e.useDefault && e.reflect && n === this._$Ej?.get(t) && !this.hasAttribute(o._$Eu(t, e)))) return;
      this.C(t, s, e);
    }
    this.isUpdatePending === !1 && (this._$ES = this._$EP());
  }
  C(t, s, { useDefault: e, reflect: i, wrapped: n }, o) {
    e && !(this._$Ej ??= /* @__PURE__ */ new Map()).has(t) && (this._$Ej.set(t, o ?? s ?? this[t]), n !== !0 || o !== void 0) || (this._$AL.has(t) || (this.hasUpdated || e || (s = void 0), this._$AL.set(t, s)), i === !0 && this._$Em !== t && (this._$Eq ??= /* @__PURE__ */ new Set()).add(t));
  }
  async _$EP() {
    this.isUpdatePending = !0;
    try {
      await this._$ES;
    } catch (s) {
      Promise.reject(s);
    }
    const t = this.scheduleUpdate();
    return t != null && await t, !this.isUpdatePending;
  }
  scheduleUpdate() {
    return this.performUpdate();
  }
  performUpdate() {
    if (!this.isUpdatePending) return;
    if (!this.hasUpdated) {
      if (this.renderRoot ??= this.createRenderRoot(), this._$Ep) {
        for (const [i, n] of this._$Ep) this[i] = n;
        this._$Ep = void 0;
      }
      const e = this.constructor.elementProperties;
      if (e.size > 0) for (const [i, n] of e) {
        const { wrapped: o } = n, h = this[i];
        o !== !0 || this._$AL.has(i) || h === void 0 || this.C(i, void 0, n, h);
      }
    }
    let t = !1;
    const s = this._$AL;
    try {
      t = this.shouldUpdate(s), t ? (this.willUpdate(s), this._$EO?.forEach((e) => e.hostUpdate?.()), this.update(s)) : this._$EM();
    } catch (e) {
      throw t = !1, this._$EM(), e;
    }
    t && this._$AE(s);
  }
  willUpdate(t) {
  }
  _$AE(t) {
    this._$EO?.forEach((s) => s.hostUpdated?.()), this.hasUpdated || (this.hasUpdated = !0, this.firstUpdated(t)), this.updated(t);
  }
  _$EM() {
    this._$AL = /* @__PURE__ */ new Map(), this.isUpdatePending = !1;
  }
  get updateComplete() {
    return this.getUpdateComplete();
  }
  getUpdateComplete() {
    return this._$ES;
  }
  shouldUpdate(t) {
    return !0;
  }
  update(t) {
    this._$Eq &&= this._$Eq.forEach((s) => this._$ET(s, this[s])), this._$EM();
  }
  updated(t) {
  }
  firstUpdated(t) {
  }
};
A.elementStyles = [], A.shadowRootOptions = { mode: "open" }, A[C("elementProperties")] = /* @__PURE__ */ new Map(), A[C("finalized")] = /* @__PURE__ */ new Map(), Ut?.({ ReactiveElement: A }), (N.reactiveElementVersions ??= []).push("2.1.2");
const W = globalThis, tt = (r) => r, I = W.trustedTypes, et = I ? I.createPolicy("lit-html", { createHTML: (r) => r }) : void 0, pt = "$lit$", g = `lit$${Math.random().toFixed(9).slice(2)}$`, ft = "?" + g, Rt = `<${ft}>`, y = document, k = () => y.createComment(""), T = (r) => r === null || typeof r != "object" && typeof r != "function", q = Array.isArray, Ht = (r) => q(r) || typeof r?.[Symbol.iterator] == "function", L = `[ 	
\f\r]`, E = /<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g, st = /-->/g, rt = />/g, $ = RegExp(`>|${L}(?:([^\\s"'>=/]+)(${L}*=${L}*(?:[^ 	
\f\r"'\`<>=]|("|')|))|$)`, "g"), it = /'/g, nt = /"/g, vt = /^(?:script|style|textarea|title)$/i, It = (r) => (t, ...s) => ({ _$litType$: r, strings: t, values: s }), x = It(1), b = /* @__PURE__ */ Symbol.for("lit-noChange"), p = /* @__PURE__ */ Symbol.for("lit-nothing"), ot = /* @__PURE__ */ new WeakMap(), m = y.createTreeWalker(y, 129);
function gt(r, t) {
  if (!q(r) || !r.hasOwnProperty("raw")) throw Error("invalid template strings array");
  return et !== void 0 ? et.createHTML(t) : t;
}
const Nt = (r, t) => {
  const s = r.length - 1, e = [];
  let i, n = t === 2 ? "<svg>" : t === 3 ? "<math>" : "", o = E;
  for (let h = 0; h < s; h++) {
    const a = r[h];
    let l, u, d = -1, c = 0;
    for (; c < a.length && (o.lastIndex = c, u = o.exec(a), u !== null); ) c = o.lastIndex, o === E ? u[1] === "!--" ? o = st : u[1] !== void 0 ? o = rt : u[2] !== void 0 ? (vt.test(u[2]) && (i = RegExp("</" + u[2], "g")), o = $) : u[3] !== void 0 && (o = $) : o === $ ? u[0] === ">" ? (o = i ?? E, d = -1) : u[1] === void 0 ? d = -2 : (d = o.lastIndex - u[2].length, l = u[1], o = u[3] === void 0 ? $ : u[3] === '"' ? nt : it) : o === nt || o === it ? o = $ : o === st || o === rt ? o = E : (o = $, i = void 0);
    const f = o === $ && r[h + 1].startsWith("/>") ? " " : "";
    n += o === E ? a + Rt : d >= 0 ? (e.push(l), a.slice(0, d) + pt + a.slice(d) + g + f) : a + g + (d === -2 ? h : f);
  }
  return [gt(r, n + (r[s] || "<?>") + (t === 2 ? "</svg>" : t === 3 ? "</math>" : "")), e];
};
class O {
  constructor({ strings: t, _$litType$: s }, e) {
    let i;
    this.parts = [];
    let n = 0, o = 0;
    const h = t.length - 1, a = this.parts, [l, u] = Nt(t, s);
    if (this.el = O.createElement(l, e), m.currentNode = this.el.content, s === 2 || s === 3) {
      const d = this.el.content.firstChild;
      d.replaceWith(...d.childNodes);
    }
    for (; (i = m.nextNode()) !== null && a.length < h; ) {
      if (i.nodeType === 1) {
        if (i.hasAttributes()) for (const d of i.getAttributeNames()) if (d.endsWith(pt)) {
          const c = u[o++], f = i.getAttribute(d).split(g), v = /([.?@])?(.*)/.exec(c);
          a.push({ type: 1, index: n, name: v[2], strings: f, ctor: v[1] === "." ? Lt : v[1] === "?" ? Dt : v[1] === "@" ? jt : z }), i.removeAttribute(d);
        } else d.startsWith(g) && (a.push({ type: 6, index: n }), i.removeAttribute(d));
        if (vt.test(i.tagName)) {
          const d = i.textContent.split(g), c = d.length - 1;
          if (c > 0) {
            i.textContent = I ? I.emptyScript : "";
            for (let f = 0; f < c; f++) i.append(d[f], k()), m.nextNode(), a.push({ type: 2, index: ++n });
            i.append(d[c], k());
          }
        }
      } else if (i.nodeType === 8) if (i.data === ft) a.push({ type: 2, index: n });
      else {
        let d = -1;
        for (; (d = i.data.indexOf(g, d + 1)) !== -1; ) a.push({ type: 7, index: n }), d += g.length - 1;
      }
      n++;
    }
  }
  static createElement(t, s) {
    const e = y.createElement("template");
    return e.innerHTML = t, e;
  }
}
function w(r, t, s = r, e) {
  if (t === b) return t;
  let i = e !== void 0 ? s._$Co?.[e] : s._$Cl;
  const n = T(t) ? void 0 : t._$litDirective$;
  return i?.constructor !== n && (i?._$AO?.(!1), n === void 0 ? i = void 0 : (i = new n(r), i._$AT(r, s, e)), e !== void 0 ? (s._$Co ??= [])[e] = i : s._$Cl = i), i !== void 0 && (t = w(r, i._$AS(r, t.values), i, e)), t;
}
class zt {
  constructor(t, s) {
    this._$AV = [], this._$AN = void 0, this._$AD = t, this._$AM = s;
  }
  get parentNode() {
    return this._$AM.parentNode;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  u(t) {
    const { el: { content: s }, parts: e } = this._$AD, i = (t?.creationScope ?? y).importNode(s, !0);
    m.currentNode = i;
    let n = m.nextNode(), o = 0, h = 0, a = e[0];
    for (; a !== void 0; ) {
      if (o === a.index) {
        let l;
        a.type === 2 ? l = new M(n, n.nextSibling, this, t) : a.type === 1 ? l = new a.ctor(n, a.name, a.strings, this, t) : a.type === 6 && (l = new Bt(n, this, t)), this._$AV.push(l), a = e[++h];
      }
      o !== a?.index && (n = m.nextNode(), o++);
    }
    return m.currentNode = y, i;
  }
  p(t) {
    let s = 0;
    for (const e of this._$AV) e !== void 0 && (e.strings !== void 0 ? (e._$AI(t, e, s), s += e.strings.length - 2) : e._$AI(t[s])), s++;
  }
}
class M {
  get _$AU() {
    return this._$AM?._$AU ?? this._$Cv;
  }
  constructor(t, s, e, i) {
    this.type = 2, this._$AH = p, this._$AN = void 0, this._$AA = t, this._$AB = s, this._$AM = e, this.options = i, this._$Cv = i?.isConnected ?? !0;
  }
  get parentNode() {
    let t = this._$AA.parentNode;
    const s = this._$AM;
    return s !== void 0 && t?.nodeType === 11 && (t = s.parentNode), t;
  }
  get startNode() {
    return this._$AA;
  }
  get endNode() {
    return this._$AB;
  }
  _$AI(t, s = this) {
    t = w(this, t, s), T(t) ? t === p || t == null || t === "" ? (this._$AH !== p && this._$AR(), this._$AH = p) : t !== this._$AH && t !== b && this._(t) : t._$litType$ !== void 0 ? this.$(t) : t.nodeType !== void 0 ? this.T(t) : Ht(t) ? this.k(t) : this._(t);
  }
  O(t) {
    return this._$AA.parentNode.insertBefore(t, this._$AB);
  }
  T(t) {
    this._$AH !== t && (this._$AR(), this._$AH = this.O(t));
  }
  _(t) {
    this._$AH !== p && T(this._$AH) ? this._$AA.nextSibling.data = t : this.T(y.createTextNode(t)), this._$AH = t;
  }
  $(t) {
    const { values: s, _$litType$: e } = t, i = typeof e == "number" ? this._$AC(t) : (e.el === void 0 && (e.el = O.createElement(gt(e.h, e.h[0]), this.options)), e);
    if (this._$AH?._$AD === i) this._$AH.p(s);
    else {
      const n = new zt(i, this), o = n.u(this.options);
      n.p(s), this.T(o), this._$AH = n;
    }
  }
  _$AC(t) {
    let s = ot.get(t.strings);
    return s === void 0 && ot.set(t.strings, s = new O(t)), s;
  }
  k(t) {
    q(this._$AH) || (this._$AH = [], this._$AR());
    const s = this._$AH;
    let e, i = 0;
    for (const n of t) i === s.length ? s.push(e = new M(this.O(k()), this.O(k()), this, this.options)) : e = s[i], e._$AI(n), i++;
    i < s.length && (this._$AR(e && e._$AB.nextSibling, i), s.length = i);
  }
  _$AR(t = this._$AA.nextSibling, s) {
    for (this._$AP?.(!1, !0, s); t !== this._$AB; ) {
      const e = tt(t).nextSibling;
      tt(t).remove(), t = e;
    }
  }
  setConnected(t) {
    this._$AM === void 0 && (this._$Cv = t, this._$AP?.(t));
  }
}
class z {
  get tagName() {
    return this.element.tagName;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  constructor(t, s, e, i, n) {
    this.type = 1, this._$AH = p, this._$AN = void 0, this.element = t, this.name = s, this._$AM = i, this.options = n, e.length > 2 || e[0] !== "" || e[1] !== "" ? (this._$AH = Array(e.length - 1).fill(new String()), this.strings = e) : this._$AH = p;
  }
  _$AI(t, s = this, e, i) {
    const n = this.strings;
    let o = !1;
    if (n === void 0) t = w(this, t, s, 0), o = !T(t) || t !== this._$AH && t !== b, o && (this._$AH = t);
    else {
      const h = t;
      let a, l;
      for (t = n[0], a = 0; a < n.length - 1; a++) l = w(this, h[e + a], s, a), l === b && (l = this._$AH[a]), o ||= !T(l) || l !== this._$AH[a], l === p ? t = p : t !== p && (t += (l ?? "") + n[a + 1]), this._$AH[a] = l;
    }
    o && !i && this.j(t);
  }
  j(t) {
    t === p ? this.element.removeAttribute(this.name) : this.element.setAttribute(this.name, t ?? "");
  }
}
class Lt extends z {
  constructor() {
    super(...arguments), this.type = 3;
  }
  j(t) {
    this.element[this.name] = t === p ? void 0 : t;
  }
}
class Dt extends z {
  constructor() {
    super(...arguments), this.type = 4;
  }
  j(t) {
    this.element.toggleAttribute(this.name, !!t && t !== p);
  }
}
class jt extends z {
  constructor(t, s, e, i, n) {
    super(t, s, e, i, n), this.type = 5;
  }
  _$AI(t, s = this) {
    if ((t = w(this, t, s, 0) ?? p) === b) return;
    const e = this._$AH, i = t === p && e !== p || t.capture !== e.capture || t.once !== e.once || t.passive !== e.passive, n = t !== p && (e === p || i);
    i && this.element.removeEventListener(this.name, this, e), n && this.element.addEventListener(this.name, this, t), this._$AH = t;
  }
  handleEvent(t) {
    typeof this._$AH == "function" ? this._$AH.call(this.options?.host ?? this.element, t) : this._$AH.handleEvent(t);
  }
}
class Bt {
  constructor(t, s, e) {
    this.element = t, this.type = 6, this._$AN = void 0, this._$AM = s, this.options = e;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  _$AI(t) {
    w(this, t);
  }
}
const Vt = W.litHtmlPolyfillSupport;
Vt?.(O, M), (W.litHtmlVersions ??= []).push("3.3.2");
const Kt = (r, t, s) => {
  const e = s?.renderBefore ?? t;
  let i = e._$litPart$;
  if (i === void 0) {
    const n = s?.renderBefore ?? null;
    e._$litPart$ = i = new M(t.insertBefore(k(), n), n, void 0, s ?? {});
  }
  return i._$AI(r), i;
};
const Z = globalThis;
let P = class extends A {
  constructor() {
    super(...arguments), this.renderOptions = { host: this }, this._$Do = void 0;
  }
  createRenderRoot() {
    const t = super.createRenderRoot();
    return this.renderOptions.renderBefore ??= t.firstChild, t;
  }
  update(t) {
    const s = this.render();
    this.hasUpdated || (this.renderOptions.isConnected = this.isConnected), super.update(t), this._$Do = Kt(s, this.renderRoot, this.renderOptions);
  }
  connectedCallback() {
    super.connectedCallback(), this._$Do?.setConnected(!0);
  }
  disconnectedCallback() {
    super.disconnectedCallback(), this._$Do?.setConnected(!1);
  }
  render() {
    return b;
  }
};
P._$litElement$ = !0, P.finalized = !0, Z.litElementHydrateSupport?.({ LitElement: P });
const Wt = Z.litElementPolyfillSupport;
Wt?.({ LitElement: P });
(Z.litElementVersions ??= []).push("4.2.2");
const qt = (r) => (t, s) => {
  s !== void 0 ? s.addInitializer(() => {
    customElements.define(r, t);
  }) : customElements.define(r, t);
};
const Zt = { attribute: !0, type: String, converter: H, reflect: !1, hasChanged: K }, Ft = (r = Zt, t, s) => {
  const { kind: e, metadata: i } = s;
  let n = globalThis.litPropertyMetadata.get(i);
  if (n === void 0 && globalThis.litPropertyMetadata.set(i, n = /* @__PURE__ */ new Map()), e === "setter" && ((r = Object.create(r)).wrapped = !0), n.set(s.name, r), e === "accessor") {
    const { name: o } = s;
    return { set(h) {
      const a = t.get.call(this);
      t.set.call(this, h), this.requestUpdate(o, a, r, !0, h);
    }, init(h) {
      return h !== void 0 && this.C(o, void 0, r, h), h;
    } };
  }
  if (e === "setter") {
    const { name: o } = s;
    return function(h) {
      const a = this[o];
      t.call(this, h), this.requestUpdate(o, a, r, !0, h);
    };
  }
  throw Error("Unsupported decorator location: " + e);
};
function F(r) {
  return (t, s) => typeof s == "object" ? Ft(r, t, s) : ((e, i, n) => {
    const o = i.hasOwnProperty(n);
    return i.constructor.createProperty(n, e), o ? Object.getOwnPropertyDescriptor(i, n) : void 0;
  })(r, t, s);
}
function Y(r) {
  return F({ ...r, state: !0, attribute: !1 });
}
const bt = { ATTRIBUTE: 1 }, _t = (r) => (...t) => ({ _$litDirective$: r, values: t });
let $t = class {
  constructor(t) {
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  _$AT(t, s, e) {
    this._$Ct = t, this._$AM = s, this._$Ci = e;
  }
  _$AS(t, s) {
    return this.update(t, s);
  }
  update(t, s) {
    return this.render(...s);
  }
};
const at = _t(class extends $t {
  constructor(r) {
    if (super(r), r.type !== bt.ATTRIBUTE || r.name !== "class" || r.strings?.length > 2) throw Error("`classMap()` can only be used in the `class` attribute and must be the only part in the attribute.");
  }
  render(r) {
    return " " + Object.keys(r).filter((t) => r[t]).join(" ") + " ";
  }
  update(r, [t]) {
    if (this.st === void 0) {
      this.st = /* @__PURE__ */ new Set(), r.strings !== void 0 && (this.nt = new Set(r.strings.join(" ").split(/\s/).filter((e) => e !== "")));
      for (const e in t) t[e] && !this.nt?.has(e) && this.st.add(e);
      return this.render(t);
    }
    const s = r.element.classList;
    for (const e of this.st) e in t || (s.remove(e), this.st.delete(e));
    for (const e in t) {
      const i = !!t[e];
      i === this.st.has(e) || this.nt?.has(e) || (i ? (s.add(e), this.st.add(e)) : (s.remove(e), this.st.delete(e)));
    }
    return b;
  }
});
const mt = "important", Yt = " !" + mt, Gt = _t(class extends $t {
  constructor(r) {
    if (super(r), r.type !== bt.ATTRIBUTE || r.name !== "style" || r.strings?.length > 2) throw Error("The `styleMap` directive must be used in the `style` attribute and must be the only part in the attribute.");
  }
  render(r) {
    return Object.keys(r).reduce((t, s) => {
      const e = r[s];
      return e == null ? t : t + `${s = s.includes("-") ? s : s.replace(/(?:^(webkit|moz|ms|o)|)(?=[A-Z])/g, "-$&").toLowerCase()}:${e};`;
    }, "");
  }
  update(r, [t]) {
    const { style: s } = r.element;
    if (this.ft === void 0) return this.ft = new Set(Object.keys(t)), this.render(t);
    for (const e of this.ft) t[e] == null && (this.ft.delete(e), e.includes("-") ? s.removeProperty(e) : s[e] = null);
    for (const e in t) {
      const i = t[e];
      if (i != null) {
        this.ft.add(e);
        const n = typeof i == "string" && i.endsWith(Yt);
        e.includes("-") || n ? s.setProperty(e, n ? i.slice(0, -11) : i, n ? mt : "") : s[e] = i;
      }
    }
    return b;
  }
}), D = "0.1.0", lt = "__voiceKernel__";
function Jt() {
  const r = /* @__PURE__ */ new Set();
  let t = null, s = !1;
  const e = {
    state: "idle",
    level: 0,
    lastTranscript: ""
  };
  let i = { ...e };
  function n() {
    return i;
  }
  function o() {
    i = { ...e };
    const a = i;
    for (const l of r)
      try {
        l(a);
      } catch (u) {
        console.error("[voiceKernel] subscriber threw", u);
      }
  }
  return {
    get state() {
      return e.state;
    },
    get level() {
      return e.level;
    },
    get lastTranscript() {
      return e.lastTranscript;
    },
    get errorMessage() {
      return e.errorMessage;
    },
    async start() {
      if (!t) {
        console.warn("[voiceKernel] start called before implementation registered");
        return;
      }
      if (s) {
        console.info("[voiceKernel] start() ignored — a session is already starting");
        return;
      }
      if (!(e.state !== "idle" && e.state !== "error")) {
        s = !0;
        try {
          await t.start();
        } finally {
          s = !1;
        }
      }
    },
    async stop() {
      t && (s = !1, e.state !== "idle" && await t.stop());
    },
    getSnapshot: n,
    async toggle() {
      e.state === "idle" || e.state === "error" ? await this.start() : await this.stop();
    },
    subscribe(a) {
      r.add(a);
      try {
        a(n());
      } catch (l) {
        console.error("[voiceKernel] initial subscriber call threw", l);
      }
      return () => {
        r.delete(a);
      };
    },
    _setImpl(a) {
      t = a;
    },
    _clearImpl() {
      t = null;
    },
    _publish(a) {
      for (const l of Object.keys(a)) {
        const u = a[l];
        u === void 0 ? delete e[l] : e[l] = u;
      }
      o();
    }
  };
}
function Xt() {
  if (typeof window > "u")
    throw new Error("[voiceKernel] cannot install in a non-browser environment");
  const r = window[lt];
  if (r)
    return r.version !== D && console.warn(
      `[voiceKernel] version mismatch: existing=${r.version} new=${D}; using existing`
    ), r;
  const t = {
    version: D,
    voice: Jt()
  };
  return window[lt] = t, t;
}
function U() {
  return Xt();
}
const j = "0.1.0", ct = "__agentablePageSession__", Qt = 64;
function te() {
  return `ps_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
function ee() {
  return `pt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}
function se(r) {
  const t = r ?? te(), s = /* @__PURE__ */ new Set(), e = /* @__PURE__ */ new Set(), i = /* @__PURE__ */ new Set(), n = [];
  let o = null, h = "idle", a = {
    sessionId: t,
    participantIds: [],
    chatSurfaceCount: 0,
    transcriptCount: 0,
    voiceSessionId: null,
    connectionState: "idle"
  };
  function l() {
    a = {
      sessionId: t,
      participantIds: [...s],
      chatSurfaceCount: e.size,
      transcriptCount: n.length,
      voiceSessionId: o,
      connectionState: h
    };
  }
  function u(c) {
    for (n.push(c); n.length > Qt; )
      n.shift();
    l();
  }
  const d = {
    sessionId: t,
    join(c) {
      c.trim() && (s.add(c), l());
    },
    leave(c) {
      s.delete(c), l();
    },
    registerChatSurface(c) {
      return c.trim() ? (e.add(c), l(), () => {
        e.delete(c), l();
      }) : () => {
      };
    },
    publishTranscript(c) {
      const f = {
        id: c.id ?? ee(),
        role: c.role,
        text: c.text,
        timestamp: c.timestamp,
        source: c.source
      };
      u(f);
      for (const v of i)
        try {
          v(f);
        } catch (At) {
          console.error("[pageSession] transcript subscriber threw", At);
        }
      return f;
    },
    subscribeTranscripts(c) {
      i.add(c);
      for (const f of n)
        try {
          c(f);
        } catch (v) {
          console.error("[pageSession] transcript replay threw", v);
        }
      return () => {
        i.delete(c);
      };
    },
    getBufferedTranscripts() {
      return [...n];
    },
    getSnapshot() {
      return a;
    },
    setVoiceSessionId(c) {
      o = c, l();
    },
    setConnectionState(c) {
      h = c, l();
    }
  };
  return l(), d;
}
function re() {
  if (typeof window > "u")
    throw new Error("[pageSession] cannot install in a non-browser environment");
  const r = window[ct];
  if (r)
    return r.version !== j && console.warn(
      `[pageSession] version mismatch: existing=${r.version} new=${j}; using existing`
    ), r;
  const t = {
    version: j,
    session: se()
  };
  return window[ct] = t, t;
}
function ht() {
  return re().session;
}
let dt = 0;
function ie(r) {
  return dt += 1, `widget-${r.replace(/[^a-z0-9-]/gi, "").slice(0, 24) || "widget"}-${dt.toString(36)}`;
}
function ne(r) {
  const t = ie(r);
  return {
    participantId: t,
    join() {
      ht().join(t);
    },
    leave() {
      ht().leave(t);
    }
  };
}
var yt = Object.defineProperty, oe = Object.getOwnPropertyDescriptor, ae = (r, t, s) => t in r ? yt(r, t, { enumerable: !0, configurable: !0, writable: !0, value: s }) : r[t] = s, S = (r, t, s, e) => {
  for (var i = e > 1 ? void 0 : e ? oe(t, s) : t, n = r.length - 1, o; n >= 0; n--)
    (o = r[n]) && (i = (e ? o(t, s, i) : o(i)) || i);
  return e && i && yt(t, s, i), i;
}, le = (r, t, s) => ae(r, t + "", s);
const ce = 0.05;
function he(r) {
  return 0.5 + Math.min(1, r * 3);
}
let _ = class extends P {
  _unsubscribe = null;
  _previousState = "idle";
  _pageSession = null;
  constructor() {
    super(), this.variant = "nav", this.disabled = !1, this._state = "idle", this._level = 0, this._errorMessage = "";
  }
  connectedCallback() {
    super.connectedCallback(), this._pageSession = ne("voice-call-button"), this._pageSession.join(), this._unsubscribe?.();
    const r = U();
    this._unsubscribe = r.voice.subscribe((t) => {
      this._state = t.state, this._level = t.level, this._errorMessage = t.errorMessage ?? "";
    });
  }
  disconnectedCallback() {
    super.disconnectedCallback(), this._unsubscribe?.(), this._unsubscribe = null, this._pageSession?.leave(), this._pageSession = null;
  }
  updated(r) {
    r.has("_state") && this._state !== this._previousState && (this._dispatchStateChange(), this._state === "listening" && this._previousState === "connecting" && this._dispatchEvent("landi:call-started", { timestamp: (/* @__PURE__ */ new Date()).toISOString() }), this._state === "idle" && this._previousState !== "idle" && this._dispatchEvent("landi:call-ended", { timestamp: (/* @__PURE__ */ new Date()).toISOString() }), this._state === "error" && this._errorMessage && this._dispatchEvent("landi:call-error", {
      message: this._errorMessage,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    }), this._previousState = this._state);
  }
  /** Public API — start the call (no-op if active). */
  async start() {
    await U().voice.start();
  }
  /** Public API — end the call (no-op if idle). */
  async stop() {
    await U().voice.stop();
  }
  /** Public API — toggle based on current state. */
  async toggle() {
    await U().voice.toggle();
  }
  _dispatchStateChange() {
    this._dispatchEvent("landi:call-state-changed", {
      state: this._state,
      level: this._level,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  }
  _dispatchEvent(r, t) {
    this.dispatchEvent(
      new CustomEvent(r, { detail: t, bubbles: !0, composed: !0 })
    );
  }
  _onClick = (r) => {
    r.preventDefault(), !this.disabled && this.toggle();
  };
  _statusLabel() {
    switch (this._state) {
      case "connecting":
        return "Connecting";
      case "listening":
        return "Listening";
      case "speaking":
        return "Speaking";
      case "error":
        return "Tap to retry";
      default:
        return "";
    }
  }
  render() {
    const r = this._state !== "idle" && this._state !== "error", t = at({
      halo: !0,
      // No `idle` class — idle is intentionally static (no halo).
      listening: this._state === "listening",
      speaking: this._state === "speaking",
      error: this._state === "error"
    }), s = at({
      chip: !0,
      listening: this._state === "listening",
      speaking: this._state === "speaking",
      error: this._state === "error"
    }), e = this._statusLabel(), i = r ? `End call (${e})` : "Start voice call";
    return x`
      <button
        part="button"
        type="button"
        ?disabled=${this.disabled}
        aria-label=${i}
        aria-pressed=${r ? "true" : "false"}
        @click=${this._onClick}
      >
        <span class="icon-wrap" part="icon-wrap" aria-hidden="true">
          ${this._state === "connecting" ? x`<span class="spinner" part="spinner"></span>` : x`
                <span class=${t} part="halo"></span>
                <svg
                  class="icon"
                  part="icon"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2Z"
                  />
                </svg>
              `}
        </span>
        <span class="label" part="label"><slot>Talk with our AI</slot></span>
        ${e ? x`
              <span class=${s} part="chip" role="status" aria-live="polite">
                ${this._state === "listening" && this._level > ce ? x`<span
                      class="level-dot"
                      part="level-dot"
                      style=${Gt({ transform: `scale(${he(this._level).toFixed(2)})` })}
                    ></span>` : null}
                ${e}
              </span>
            ` : null}
        <span class="visually-hidden" aria-live="polite">
          ${this._state === "error" && this._errorMessage ? this._errorMessage : ""}
        </span>
      </button>
    `;
  }
};
le(_, "styles", St`:host {
      display: inline-flex;
      box-sizing: border-box;
      /* Brand tokens — host page can override any of these. All raw values
         (colors, font sizes, spacing, radii) live in this block; component
         body rules consume tokens only, per web-components-ui §3.1. */
      --landi-vcb-color-primary: var(--landi-color-primary, #0d7377);
      --landi-vcb-color-accent: var(--landi-color-accent, #c9a227);
      --landi-vcb-color-error: var(--landi-color-error, #b04545);
      --landi-vcb-color-surface: var(--landi-color-surface-translucent, rgba(255, 255, 255, 0.1));
      --landi-vcb-color-surface-hover: var(--landi-color-surface-translucent-hover, rgba(255, 255, 255, 0.2));
      --landi-vcb-color-border: var(--landi-color-border-translucent, rgba(255, 255, 255, 0.15));
      --landi-vcb-color-border-hover: var(--landi-color-border-translucent-hover, rgba(255, 255, 255, 0.3));
      --landi-vcb-color-text: var(--landi-color-text-on-dark, #ffffff);
      --landi-vcb-radius: var(--landi-radius-pill, 9999px);
      --landi-vcb-radius-hero: var(--landi-radius-pill, 9999px);
      --landi-vcb-font-family: var(--landi-font-family, 'Inter', system-ui, sans-serif);
      --landi-vcb-shadow-hero: var(--landi-shadow-cta, 0 8px 24px -8px rgba(0, 0, 0, 0.3));
      --landi-vcb-motion-scale: var(--landi-motion-scale, 1);

      /* Hero CTA defaults: brand primary with accent. Tenants override via
         the --landi-color-* tokens or the --landi-vcb-* overrides below. */
      --landi-vcb-cta-bg: var(--landi-color-cta-background, var(--landi-vcb-color-primary));
      --landi-vcb-cta-bg-hover: var(--landi-color-cta-background-hover,
        color-mix(in srgb, var(--landi-vcb-color-primary) 88%, white));
      --landi-vcb-cta-border: var(--landi-color-cta-border,
        color-mix(in srgb, var(--landi-vcb-color-accent) 40%, transparent));

      /* Chip status badge tokens. */
      --landi-vcb-chip-surface: var(--landi-color-chip-surface, rgba(255, 255, 255, 0.12));
      --landi-vcb-chip-font-size: var(--landi-font-size-chip, 0.6875rem);
      --landi-vcb-chip-tracking: var(--landi-letter-spacing-chip, 0.025em);

      /* Halo animation durations. Tunable per state so embedders can match
         their brand pacing (e.g. slower for "calm", faster for "energetic"). */
      --landi-vcb-halo-duration-listening: var(--landi-motion-halo-listening, 1.4s);
      --landi-vcb-halo-duration-speaking: var(--landi-motion-halo-speaking, 0.9s);
    }

    button {
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 0.625rem;
      border: 1px solid var(--landi-vcb-color-border);
      background: var(--landi-vcb-color-surface);
      color: var(--landi-vcb-color-text);
      font-family: var(--landi-vcb-font-family);
      font-weight: 500;
      backdrop-filter: blur(8px);
      transition: background-color 220ms ease, border-color 220ms ease, transform 220ms ease;
    }

    button:hover:not(:disabled) {
      background: var(--landi-vcb-color-surface-hover);
      border-color: var(--landi-vcb-color-border-hover);
    }

    button:focus-visible {
      outline: 2px solid var(--landi-vcb-color-accent);
      outline-offset: 2px;
    }

    button:disabled {
      cursor: not-allowed;
      opacity: 0.5;
    }

    /* Variant: nav — compact pill */:host([variant='nav']) button {
      padding: 0.625rem 1rem;
      border-radius: var(--landi-vcb-radius);
      font-size: 0.875rem;
    }

    /* Variant: hero — larger CTA, deeper padding, drop shadow.
       Token-driven: accent-on-primary by default. */:host([variant='hero']) button {
      padding: 1rem 2rem;
      border-radius: var(--landi-vcb-radius-hero);
      font-size: 1rem;
      box-shadow: var(--landi-vcb-shadow-hero);
      background: var(--landi-vcb-cta-bg);
      border-color: var(--landi-vcb-cta-border);
    }:host([variant='hero']) button:hover:not(:disabled) {
      background: var(--landi-vcb-cta-bg-hover);
    }.icon-wrap {
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 1rem;
      height: 1rem;
    }:host([variant='hero']).icon-wrap {
      width: 1.25rem;
      height: 1.25rem;
    }.icon {
      color: var(--landi-vcb-color-accent);
      width: 100%;
      height: 100%;
    }

    /* Pulse halo. Reserved for *active* states only — idle is static, per
       the "premium, calm" brand identity. A perpetual idle pulse on a
       marketing nav burns battery and undermines tone. */.halo {
      position: absolute;
      inset: 0;
      border-radius: var(--landi-vcb-radius);
      background: var(--landi-vcb-color-accent);
      opacity: 0;
      transform: scale(0.6);
      pointer-events: none;
    }.halo.listening {
      background: var(--landi-vcb-color-primary);
      opacity: 0.4;
      animation: halo-ping var(--landi-vcb-halo-duration-listening) cubic-bezier(0, 0, 0.2, 1) infinite;
    }.halo.speaking {
      opacity: 0.5;
      animation: halo-ping var(--landi-vcb-halo-duration-speaking) cubic-bezier(0, 0, 0.2, 1) infinite;
    }.halo.error {
      background: var(--landi-vcb-color-error);
      opacity: 0.4;
    }

    @keyframes halo-ping {
      0% {
        transform: scale(0.6);
        opacity: 0.6;
      }
      80%,
      100% {
        transform: scale(1.6);
        opacity: 0;
      }
    }

    @media (prefers-reduced-motion: reduce) {.halo {
        animation: none !important;
        opacity: 0.4;
      }
      button {
        transition: none;
      }
    }.chip {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      padding: 0.125rem 0.5rem;
      border-radius: var(--landi-vcb-radius);
      font-size: var(--landi-vcb-chip-font-size);
      font-weight: 500;
      letter-spacing: var(--landi-vcb-chip-tracking);
      text-transform: uppercase;
      background: var(--landi-vcb-chip-surface);
      color: var(--landi-vcb-color-text);
    }.chip.listening {
      background: color-mix(in srgb, var(--landi-vcb-color-primary) 30%, transparent);
    }.chip.speaking {
      background: color-mix(in srgb, var(--landi-vcb-color-accent) 30%, transparent);
    }.chip.error {
      background: color-mix(in srgb, var(--landi-vcb-color-error) 30%, transparent);
    }

    /* Spinner for connecting state */.spinner {
      width: 0.875rem;
      height: 0.875rem;
      border: 2px solid currentColor;
      border-top-color: transparent;
      border-radius: var(--landi-vcb-radius);
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }

    @media (prefers-reduced-motion: reduce) {.spinner {
        animation-duration: 2s;
      }
    }.level-dot {
      width: 0.375rem;
      height: 0.375rem;
      border-radius: var(--landi-vcb-radius);
      background: var(--landi-vcb-color-primary);
      transition: transform 80ms ease-out;
    }.visually-hidden {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }
  `);
S([
  F({ type: String, reflect: !0 })
], _.prototype, "variant", 2);
S([
  F({ type: Boolean, reflect: !0 })
], _.prototype, "disabled", 2);
S([
  Y()
], _.prototype, "_state", 2);
S([
  Y()
], _.prototype, "_level", 2);
S([
  Y()
], _.prototype, "_errorMessage", 2);
_ = S([
  qt("voice-call-button")
], _);
export {
  _ as VoiceCallButtonElement
};
//# sourceMappingURL=voice-call-button.js.map
