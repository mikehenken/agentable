const H = globalThis, j = H.ShadowRoot && (H.ShadyCSS === void 0 || H.ShadyCSS.nativeShadow) && "adoptedStyleSheets" in Document.prototype && "replace" in CSSStyleSheet.prototype, B = /* @__PURE__ */ Symbol(), J = /* @__PURE__ */ new WeakMap();
let lt = class {
  constructor(t, s, e) {
    if (this._$cssResult$ = !0, e !== B) throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");
    this.cssText = t, this.t = s;
  }
  get styleSheet() {
    let t = this.o;
    const s = this.t;
    if (j && t === void 0) {
      const e = s !== void 0 && s.length === 1;
      e && (t = J.get(s)), t === void 0 && ((this.o = t = new CSSStyleSheet()).replaceSync(this.cssText), e && J.set(s, t));
    }
    return t;
  }
  toString() {
    return this.cssText;
  }
};
const _t = (r) => new lt(typeof r == "string" ? r : r + "", void 0, B), $t = (r, ...t) => {
  const s = r.length === 1 ? r[0] : t.reduce((e, i, n) => e + ((o) => {
    if (o._$cssResult$ === !0) return o.cssText;
    if (typeof o == "number") return o;
    throw Error("Value passed to 'css' function must be a 'css' function result: " + o + ". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.");
  })(i) + r[n + 1], r[0]);
  return new lt(s, r, B);
}, mt = (r, t) => {
  if (j) r.adoptedStyleSheets = t.map((s) => s instanceof CSSStyleSheet ? s : s.styleSheet);
  else for (const s of t) {
    const e = document.createElement("style"), i = H.litNonce;
    i !== void 0 && e.setAttribute("nonce", i), e.textContent = s.cssText, r.appendChild(e);
  }
}, Y = j ? (r) => r : (r) => r instanceof CSSStyleSheet ? ((t) => {
  let s = "";
  for (const e of t.cssRules) s += e.cssText;
  return _t(s);
})(r) : r;
const { is: yt, defineProperty: At, getOwnPropertyDescriptor: wt, getOwnPropertyNames: Et, getOwnPropertySymbols: St, getPrototypeOf: xt } = Object, I = globalThis, G = I.trustedTypes, Ct = G ? G.emptyScript : "", kt = I.reactiveElementPolyfillSupport, x = (r, t) => r, R = { toAttribute(r, t) {
  switch (t) {
    case Boolean:
      r = r ? Ct : null;
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
} }, V = (r, t) => !yt(r, t), Q = { attribute: !0, type: String, converter: R, reflect: !1, useDefault: !1, hasChanged: V };
Symbol.metadata ??= /* @__PURE__ */ Symbol("metadata"), I.litPropertyMetadata ??= /* @__PURE__ */ new WeakMap();
let y = class extends HTMLElement {
  static addInitializer(t) {
    this._$Ei(), (this.l ??= []).push(t);
  }
  static get observedAttributes() {
    return this.finalize(), this._$Eh && [...this._$Eh.keys()];
  }
  static createProperty(t, s = Q) {
    if (s.state && (s.attribute = !1), this._$Ei(), this.prototype.hasOwnProperty(t) && ((s = Object.create(s)).wrapped = !0), this.elementProperties.set(t, s), !s.noAccessor) {
      const e = /* @__PURE__ */ Symbol(), i = this.getPropertyDescriptor(t, e, s);
      i !== void 0 && At(this.prototype, t, i);
    }
  }
  static getPropertyDescriptor(t, s, e) {
    const { get: i, set: n } = wt(this.prototype, t) ?? { get() {
      return this[s];
    }, set(o) {
      this[s] = o;
    } };
    return { get: i, set(o) {
      const l = i?.call(this);
      n?.call(this, o), this.requestUpdate(t, l, e);
    }, configurable: !0, enumerable: !0 };
  }
  static getPropertyOptions(t) {
    return this.elementProperties.get(t) ?? Q;
  }
  static _$Ei() {
    if (this.hasOwnProperty(x("elementProperties"))) return;
    const t = xt(this);
    t.finalize(), t.l !== void 0 && (this.l = [...t.l]), this.elementProperties = new Map(t.elementProperties);
  }
  static finalize() {
    if (this.hasOwnProperty(x("finalized"))) return;
    if (this.finalized = !0, this._$Ei(), this.hasOwnProperty(x("properties"))) {
      const s = this.properties, e = [...Et(s), ...St(s)];
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
      for (const i of e) s.unshift(Y(i));
    } else t !== void 0 && s.push(Y(t));
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
    return mt(t, this.constructor.elementStyles), t;
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
      const n = (e.converter?.toAttribute !== void 0 ? e.converter : R).toAttribute(s, e.type);
      this._$Em = t, n == null ? this.removeAttribute(i) : this.setAttribute(i, n), this._$Em = null;
    }
  }
  _$AK(t, s) {
    const e = this.constructor, i = e._$Eh.get(t);
    if (i !== void 0 && this._$Em !== i) {
      const n = e.getPropertyOptions(i), o = typeof n.converter == "function" ? { fromAttribute: n.converter } : n.converter?.fromAttribute !== void 0 ? n.converter : R;
      this._$Em = i;
      const l = o.fromAttribute(s, n.type);
      this[i] = l ?? this._$Ej?.get(i) ?? l, this._$Em = null;
    }
  }
  requestUpdate(t, s, e, i = !1, n) {
    if (t !== void 0) {
      const o = this.constructor;
      if (i === !1 && (n = this[t]), e ??= o.getPropertyOptions(t), !((e.hasChanged ?? V)(n, s) || e.useDefault && e.reflect && n === this._$Ej?.get(t) && !this.hasAttribute(o._$Eu(t, e)))) return;
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
        const { wrapped: o } = n, l = this[i];
        o !== !0 || this._$AL.has(i) || l === void 0 || this.C(i, void 0, n, l);
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
y.elementStyles = [], y.shadowRootOptions = { mode: "open" }, y[x("elementProperties")] = /* @__PURE__ */ new Map(), y[x("finalized")] = /* @__PURE__ */ new Map(), kt?.({ ReactiveElement: y }), (I.reactiveElementVersions ??= []).push("2.1.2");
const K = globalThis, X = (r) => r, N = K.trustedTypes, tt = N ? N.createPolicy("lit-html", { createHTML: (r) => r }) : void 0, ct = "$lit$", f = `lit$${Math.random().toFixed(9).slice(2)}$`, ht = "?" + f, Pt = `<${ht}>`, m = document, k = () => m.createComment(""), P = (r) => r === null || typeof r != "object" && typeof r != "function", W = Array.isArray, Tt = (r) => W(r) || typeof r?.[Symbol.iterator] == "function", z = `[ 	
\f\r]`, E = /<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g, et = /-->/g, st = />/g, _ = RegExp(`>|${z}(?:([^\\s"'>=/]+)(${z}*=${z}*(?:[^ 	
\f\r"'\`<>=]|("|')|))|$)`, "g"), rt = /'/g, it = /"/g, dt = /^(?:script|style|textarea|title)$/i, Ot = (r) => (t, ...s) => ({ _$litType$: r, strings: t, values: s }), S = Ot(1), b = /* @__PURE__ */ Symbol.for("lit-noChange"), p = /* @__PURE__ */ Symbol.for("lit-nothing"), nt = /* @__PURE__ */ new WeakMap(), $ = m.createTreeWalker(m, 129);
function pt(r, t) {
  if (!W(r) || !r.hasOwnProperty("raw")) throw Error("invalid template strings array");
  return tt !== void 0 ? tt.createHTML(t) : t;
}
const Mt = (r, t) => {
  const s = r.length - 1, e = [];
  let i, n = t === 2 ? "<svg>" : t === 3 ? "<math>" : "", o = E;
  for (let l = 0; l < s; l++) {
    const a = r[l];
    let c, d, h = -1, u = 0;
    for (; u < a.length && (o.lastIndex = u, d = o.exec(a), d !== null); ) u = o.lastIndex, o === E ? d[1] === "!--" ? o = et : d[1] !== void 0 ? o = st : d[2] !== void 0 ? (dt.test(d[2]) && (i = RegExp("</" + d[2], "g")), o = _) : d[3] !== void 0 && (o = _) : o === _ ? d[0] === ">" ? (o = i ?? E, h = -1) : d[1] === void 0 ? h = -2 : (h = o.lastIndex - d[2].length, c = d[1], o = d[3] === void 0 ? _ : d[3] === '"' ? it : rt) : o === it || o === rt ? o = _ : o === et || o === st ? o = E : (o = _, i = void 0);
    const v = o === _ && r[l + 1].startsWith("/>") ? " " : "";
    n += o === E ? a + Pt : h >= 0 ? (e.push(c), a.slice(0, h) + ct + a.slice(h) + f + v) : a + f + (h === -2 ? l : v);
  }
  return [pt(r, n + (r[s] || "<?>") + (t === 2 ? "</svg>" : t === 3 ? "</math>" : "")), e];
};
class T {
  constructor({ strings: t, _$litType$: s }, e) {
    let i;
    this.parts = [];
    let n = 0, o = 0;
    const l = t.length - 1, a = this.parts, [c, d] = Mt(t, s);
    if (this.el = T.createElement(c, e), $.currentNode = this.el.content, s === 2 || s === 3) {
      const h = this.el.content.firstChild;
      h.replaceWith(...h.childNodes);
    }
    for (; (i = $.nextNode()) !== null && a.length < l; ) {
      if (i.nodeType === 1) {
        if (i.hasAttributes()) for (const h of i.getAttributeNames()) if (h.endsWith(ct)) {
          const u = d[o++], v = i.getAttribute(h).split(f), M = /([.?@])?(.*)/.exec(u);
          a.push({ type: 1, index: n, name: M[2], strings: v, ctor: M[1] === "." ? Ht : M[1] === "?" ? Rt : M[1] === "@" ? Nt : L }), i.removeAttribute(h);
        } else h.startsWith(f) && (a.push({ type: 6, index: n }), i.removeAttribute(h));
        if (dt.test(i.tagName)) {
          const h = i.textContent.split(f), u = h.length - 1;
          if (u > 0) {
            i.textContent = N ? N.emptyScript : "";
            for (let v = 0; v < u; v++) i.append(h[v], k()), $.nextNode(), a.push({ type: 2, index: ++n });
            i.append(h[u], k());
          }
        }
      } else if (i.nodeType === 8) if (i.data === ht) a.push({ type: 2, index: n });
      else {
        let h = -1;
        for (; (h = i.data.indexOf(f, h + 1)) !== -1; ) a.push({ type: 7, index: n }), h += f.length - 1;
      }
      n++;
    }
  }
  static createElement(t, s) {
    const e = m.createElement("template");
    return e.innerHTML = t, e;
  }
}
function A(r, t, s = r, e) {
  if (t === b) return t;
  let i = e !== void 0 ? s._$Co?.[e] : s._$Cl;
  const n = P(t) ? void 0 : t._$litDirective$;
  return i?.constructor !== n && (i?._$AO?.(!1), n === void 0 ? i = void 0 : (i = new n(r), i._$AT(r, s, e)), e !== void 0 ? (s._$Co ??= [])[e] = i : s._$Cl = i), i !== void 0 && (t = A(r, i._$AS(r, t.values), i, e)), t;
}
class Ut {
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
    const { el: { content: s }, parts: e } = this._$AD, i = (t?.creationScope ?? m).importNode(s, !0);
    $.currentNode = i;
    let n = $.nextNode(), o = 0, l = 0, a = e[0];
    for (; a !== void 0; ) {
      if (o === a.index) {
        let c;
        a.type === 2 ? c = new O(n, n.nextSibling, this, t) : a.type === 1 ? c = new a.ctor(n, a.name, a.strings, this, t) : a.type === 6 && (c = new It(n, this, t)), this._$AV.push(c), a = e[++l];
      }
      o !== a?.index && (n = $.nextNode(), o++);
    }
    return $.currentNode = m, i;
  }
  p(t) {
    let s = 0;
    for (const e of this._$AV) e !== void 0 && (e.strings !== void 0 ? (e._$AI(t, e, s), s += e.strings.length - 2) : e._$AI(t[s])), s++;
  }
}
class O {
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
    t = A(this, t, s), P(t) ? t === p || t == null || t === "" ? (this._$AH !== p && this._$AR(), this._$AH = p) : t !== this._$AH && t !== b && this._(t) : t._$litType$ !== void 0 ? this.$(t) : t.nodeType !== void 0 ? this.T(t) : Tt(t) ? this.k(t) : this._(t);
  }
  O(t) {
    return this._$AA.parentNode.insertBefore(t, this._$AB);
  }
  T(t) {
    this._$AH !== t && (this._$AR(), this._$AH = this.O(t));
  }
  _(t) {
    this._$AH !== p && P(this._$AH) ? this._$AA.nextSibling.data = t : this.T(m.createTextNode(t)), this._$AH = t;
  }
  $(t) {
    const { values: s, _$litType$: e } = t, i = typeof e == "number" ? this._$AC(t) : (e.el === void 0 && (e.el = T.createElement(pt(e.h, e.h[0]), this.options)), e);
    if (this._$AH?._$AD === i) this._$AH.p(s);
    else {
      const n = new Ut(i, this), o = n.u(this.options);
      n.p(s), this.T(o), this._$AH = n;
    }
  }
  _$AC(t) {
    let s = nt.get(t.strings);
    return s === void 0 && nt.set(t.strings, s = new T(t)), s;
  }
  k(t) {
    W(this._$AH) || (this._$AH = [], this._$AR());
    const s = this._$AH;
    let e, i = 0;
    for (const n of t) i === s.length ? s.push(e = new O(this.O(k()), this.O(k()), this, this.options)) : e = s[i], e._$AI(n), i++;
    i < s.length && (this._$AR(e && e._$AB.nextSibling, i), s.length = i);
  }
  _$AR(t = this._$AA.nextSibling, s) {
    for (this._$AP?.(!1, !0, s); t !== this._$AB; ) {
      const e = X(t).nextSibling;
      X(t).remove(), t = e;
    }
  }
  setConnected(t) {
    this._$AM === void 0 && (this._$Cv = t, this._$AP?.(t));
  }
}
class L {
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
    if (n === void 0) t = A(this, t, s, 0), o = !P(t) || t !== this._$AH && t !== b, o && (this._$AH = t);
    else {
      const l = t;
      let a, c;
      for (t = n[0], a = 0; a < n.length - 1; a++) c = A(this, l[e + a], s, a), c === b && (c = this._$AH[a]), o ||= !P(c) || c !== this._$AH[a], c === p ? t = p : t !== p && (t += (c ?? "") + n[a + 1]), this._$AH[a] = c;
    }
    o && !i && this.j(t);
  }
  j(t) {
    t === p ? this.element.removeAttribute(this.name) : this.element.setAttribute(this.name, t ?? "");
  }
}
class Ht extends L {
  constructor() {
    super(...arguments), this.type = 3;
  }
  j(t) {
    this.element[this.name] = t === p ? void 0 : t;
  }
}
class Rt extends L {
  constructor() {
    super(...arguments), this.type = 4;
  }
  j(t) {
    this.element.toggleAttribute(this.name, !!t && t !== p);
  }
}
class Nt extends L {
  constructor(t, s, e, i, n) {
    super(t, s, e, i, n), this.type = 5;
  }
  _$AI(t, s = this) {
    if ((t = A(this, t, s, 0) ?? p) === b) return;
    const e = this._$AH, i = t === p && e !== p || t.capture !== e.capture || t.once !== e.once || t.passive !== e.passive, n = t !== p && (e === p || i);
    i && this.element.removeEventListener(this.name, this, e), n && this.element.addEventListener(this.name, this, t), this._$AH = t;
  }
  handleEvent(t) {
    typeof this._$AH == "function" ? this._$AH.call(this.options?.host ?? this.element, t) : this._$AH.handleEvent(t);
  }
}
class It {
  constructor(t, s, e) {
    this.element = t, this.type = 6, this._$AN = void 0, this._$AM = s, this.options = e;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  _$AI(t) {
    A(this, t);
  }
}
const Lt = K.litHtmlPolyfillSupport;
Lt?.(T, O), (K.litHtmlVersions ??= []).push("3.3.2");
const zt = (r, t, s) => {
  const e = s?.renderBefore ?? t;
  let i = e._$litPart$;
  if (i === void 0) {
    const n = s?.renderBefore ?? null;
    e._$litPart$ = i = new O(t.insertBefore(k(), n), n, void 0, s ?? {});
  }
  return i._$AI(r), i;
};
const q = globalThis;
let C = class extends y {
  constructor() {
    super(...arguments), this.renderOptions = { host: this }, this._$Do = void 0;
  }
  createRenderRoot() {
    const t = super.createRenderRoot();
    return this.renderOptions.renderBefore ??= t.firstChild, t;
  }
  update(t) {
    const s = this.render();
    this.hasUpdated || (this.renderOptions.isConnected = this.isConnected), super.update(t), this._$Do = zt(s, this.renderRoot, this.renderOptions);
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
C._$litElement$ = !0, C.finalized = !0, q.litElementHydrateSupport?.({ LitElement: C });
const Dt = q.litElementPolyfillSupport;
Dt?.({ LitElement: C });
(q.litElementVersions ??= []).push("4.2.2");
const jt = (r) => (t, s) => {
  s !== void 0 ? s.addInitializer(() => {
    customElements.define(r, t);
  }) : customElements.define(r, t);
};
const Bt = { attribute: !0, type: String, converter: R, reflect: !1, hasChanged: V }, Vt = (r = Bt, t, s) => {
  const { kind: e, metadata: i } = s;
  let n = globalThis.litPropertyMetadata.get(i);
  if (n === void 0 && globalThis.litPropertyMetadata.set(i, n = /* @__PURE__ */ new Map()), e === "setter" && ((r = Object.create(r)).wrapped = !0), n.set(s.name, r), e === "accessor") {
    const { name: o } = s;
    return { set(l) {
      const a = t.get.call(this);
      t.set.call(this, l), this.requestUpdate(o, a, r, !0, l);
    }, init(l) {
      return l !== void 0 && this.C(o, void 0, r, l), l;
    } };
  }
  if (e === "setter") {
    const { name: o } = s;
    return function(l) {
      const a = this[o];
      t.call(this, l), this.requestUpdate(o, a, r, !0, l);
    };
  }
  throw Error("Unsupported decorator location: " + e);
};
function Z(r) {
  return (t, s) => typeof s == "object" ? Vt(r, t, s) : ((e, i, n) => {
    const o = i.hasOwnProperty(n);
    return i.constructor.createProperty(n, e), o ? Object.getOwnPropertyDescriptor(i, n) : void 0;
  })(r, t, s);
}
function F(r) {
  return Z({ ...r, state: !0, attribute: !1 });
}
const ut = { ATTRIBUTE: 1 }, vt = (r) => (...t) => ({ _$litDirective$: r, values: t });
let ft = class {
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
const ot = vt(class extends ft {
  constructor(r) {
    if (super(r), r.type !== ut.ATTRIBUTE || r.name !== "class" || r.strings?.length > 2) throw Error("`classMap()` can only be used in the `class` attribute and must be the only part in the attribute.");
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
const bt = "important", Kt = " !" + bt, Wt = vt(class extends ft {
  constructor(r) {
    if (super(r), r.type !== ut.ATTRIBUTE || r.name !== "style" || r.strings?.length > 2) throw Error("The `styleMap` directive must be used in the `style` attribute and must be the only part in the attribute.");
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
        const n = typeof i == "string" && i.endsWith(Kt);
        e.includes("-") || n ? s.setProperty(e, n ? i.slice(0, -11) : i, n ? bt : "") : s[e] = i;
      }
    }
    return b;
  }
}), D = "0.1.0", at = "__voiceKernel__";
function qt() {
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
    for (const c of r)
      try {
        c(a);
      } catch (d) {
        console.error("[voiceKernel] subscriber threw", d);
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
      } catch (c) {
        console.error("[voiceKernel] initial subscriber call threw", c);
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
      for (const c of Object.keys(a)) {
        const d = a[c];
        d === void 0 ? delete e[c] : e[c] = d;
      }
      o();
    }
  };
}
function Zt() {
  if (typeof window > "u")
    throw new Error("[voiceKernel] cannot install in a non-browser environment");
  const r = window[at];
  if (r)
    return r.version !== D && console.warn(
      `[voiceKernel] version mismatch: existing=${r.version} new=${D}; using existing`
    ), r;
  const t = {
    version: D,
    voice: qt()
  };
  return window[at] = t, t;
}
function U() {
  return Zt();
}
var gt = Object.defineProperty, Ft = Object.getOwnPropertyDescriptor, Jt = (r, t, s) => t in r ? gt(r, t, { enumerable: !0, configurable: !0, writable: !0, value: s }) : r[t] = s, w = (r, t, s, e) => {
  for (var i = e > 1 ? void 0 : e ? Ft(t, s) : t, n = r.length - 1, o; n >= 0; n--)
    (o = r[n]) && (i = (e ? o(t, s, i) : o(i)) || i);
  return e && i && gt(t, s, i), i;
}, Yt = (r, t, s) => Jt(r, t + "", s);
const Gt = 0.05;
function Qt(r) {
  return 0.5 + Math.min(1, r * 3);
}
let g = class extends C {
  _unsubscribe = null;
  _previousState = "idle";
  constructor() {
    super(), this.variant = "nav", this.disabled = !1, this._state = "idle", this._level = 0, this._errorMessage = "";
  }
  connectedCallback() {
    super.connectedCallback(), this._unsubscribe?.();
    const r = U();
    this._unsubscribe = r.voice.subscribe((t) => {
      this._state = t.state, this._level = t.level, this._errorMessage = t.errorMessage ?? "";
    });
  }
  disconnectedCallback() {
    super.disconnectedCallback(), this._unsubscribe?.(), this._unsubscribe = null;
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
    const r = this._state !== "idle" && this._state !== "error", t = ot({
      halo: !0,
      // No `idle` class — idle is intentionally static (no halo).
      listening: this._state === "listening",
      speaking: this._state === "speaking",
      error: this._state === "error"
    }), s = ot({
      chip: !0,
      listening: this._state === "listening",
      speaking: this._state === "speaking",
      error: this._state === "error"
    }), e = this._statusLabel(), i = r ? `End call (${e})` : "Start voice call";
    return S`
      <button
        part="button"
        type="button"
        ?disabled=${this.disabled}
        aria-label=${i}
        aria-pressed=${r ? "true" : "false"}
        @click=${this._onClick}
      >
        <span class="icon-wrap" part="icon-wrap" aria-hidden="true">
          ${this._state === "connecting" ? S`<span class="spinner" part="spinner"></span>` : S`
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
        ${e ? S`
              <span class=${s} part="chip" role="status" aria-live="polite">
                ${this._state === "listening" && this._level > Gt ? S`<span
                      class="level-dot"
                      part="level-dot"
                      style=${Wt({ transform: `scale(${Qt(this._level).toFixed(2)})` })}
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
Yt(g, "styles", $t`
    :host {
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

    /* Variant: nav — compact pill */
    :host([variant='nav']) button {
      padding: 0.625rem 1rem;
      border-radius: var(--landi-vcb-radius);
      font-size: 0.875rem;
    }

    /* Variant: hero — larger CTA, deeper padding, drop shadow.
       Token-driven: accent-on-primary by default. */
    :host([variant='hero']) button {
      padding: 1rem 2rem;
      border-radius: var(--landi-vcb-radius-hero);
      font-size: 1rem;
      box-shadow: var(--landi-vcb-shadow-hero);
      background: var(--landi-vcb-cta-bg);
      border-color: var(--landi-vcb-cta-border);
    }

    :host([variant='hero']) button:hover:not(:disabled) {
      background: var(--landi-vcb-cta-bg-hover);
    }

    .icon-wrap {
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 1rem;
      height: 1rem;
    }

    :host([variant='hero']) .icon-wrap {
      width: 1.25rem;
      height: 1.25rem;
    }

    .icon {
      color: var(--landi-vcb-color-accent);
      width: 100%;
      height: 100%;
    }

    /* Pulse halo. Reserved for *active* states only — idle is static, per
       the "premium, calm" brand identity. A perpetual idle pulse on a
       marketing nav burns battery and undermines tone. */
    .halo {
      position: absolute;
      inset: 0;
      border-radius: var(--landi-vcb-radius);
      background: var(--landi-vcb-color-accent);
      opacity: 0;
      transform: scale(0.6);
      pointer-events: none;
    }

    .halo.listening {
      background: var(--landi-vcb-color-primary);
      opacity: 0.4;
      animation: halo-ping var(--landi-vcb-halo-duration-listening) cubic-bezier(0, 0, 0.2, 1) infinite;
    }

    .halo.speaking {
      opacity: 0.5;
      animation: halo-ping var(--landi-vcb-halo-duration-speaking) cubic-bezier(0, 0, 0.2, 1) infinite;
    }

    .halo.error {
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

    @media (prefers-reduced-motion: reduce) {
      .halo {
        animation: none !important;
        opacity: 0.4;
      }
      button {
        transition: none;
      }
    }

    .chip {
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
    }

    .chip.listening {
      background: color-mix(in srgb, var(--landi-vcb-color-primary) 30%, transparent);
    }

    .chip.speaking {
      background: color-mix(in srgb, var(--landi-vcb-color-accent) 30%, transparent);
    }

    .chip.error {
      background: color-mix(in srgb, var(--landi-vcb-color-error) 30%, transparent);
    }

    /* Spinner for connecting state */
    .spinner {
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

    @media (prefers-reduced-motion: reduce) {
      .spinner {
        animation-duration: 2s;
      }
    }

    .level-dot {
      width: 0.375rem;
      height: 0.375rem;
      border-radius: var(--landi-vcb-radius);
      background: var(--landi-vcb-color-primary);
      transition: transform 80ms ease-out;
    }

    .visually-hidden {
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
w([
  Z({ type: String, reflect: !0 })
], g.prototype, "variant", 2);
w([
  Z({ type: Boolean, reflect: !0 })
], g.prototype, "disabled", 2);
w([
  F()
], g.prototype, "_state", 2);
w([
  F()
], g.prototype, "_level", 2);
w([
  F()
], g.prototype, "_errorMessage", 2);
g = w([
  jt("voice-call-button")
], g);
export {
  g as VoiceCallButtonElement
};
//# sourceMappingURL=voice-call-button.js.map
