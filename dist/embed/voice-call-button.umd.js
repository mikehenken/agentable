(function(p,f){typeof exports=="object"&&typeof module<"u"?f(exports):typeof define=="function"&&define.amd?define(["exports"],f):(p=typeof globalThis<"u"?globalThis:p||self,f(p.VoiceCallButton={}))})(this,(function(p){"use strict";const f=globalThis,L=f.ShadowRoot&&(f.ShadyCSS===void 0||f.ShadyCSS.nativeShadow)&&"adoptedStyleSheets"in Document.prototype&&"replace"in CSSStyleSheet.prototype,z=Symbol(),J=new WeakMap;let Y=class{constructor(t,e,s){if(this._$cssResult$=!0,s!==z)throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");this.cssText=t,this.t=e}get styleSheet(){let t=this.o;const e=this.t;if(L&&t===void 0){const s=e!==void 0&&e.length===1;s&&(t=J.get(e)),t===void 0&&((this.o=t=new CSSStyleSheet).replaceSync(this.cssText),s&&J.set(e,t))}return t}toString(){return this.cssText}};const _t=i=>new Y(typeof i=="string"?i:i+"",void 0,z),mt=(i,...t)=>{const e=i.length===1?i[0]:t.reduce((s,r,n)=>s+(o=>{if(o._$cssResult$===!0)return o.cssText;if(typeof o=="number")return o;throw Error("Value passed to 'css' function must be a 'css' function result: "+o+". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.")})(r)+i[n+1],i[0]);return new Y(e,i,z)},$t=(i,t)=>{if(L)i.adoptedStyleSheets=t.map(e=>e instanceof CSSStyleSheet?e:e.styleSheet);else for(const e of t){const s=document.createElement("style"),r=f.litNonce;r!==void 0&&s.setAttribute("nonce",r),s.textContent=e.cssText,i.appendChild(s)}},G=L?i=>i:i=>i instanceof CSSStyleSheet?(t=>{let e="";for(const s of t.cssRules)e+=s.cssText;return _t(e)})(i):i;const{is:yt,defineProperty:At,getOwnPropertyDescriptor:wt,getOwnPropertyNames:Et,getOwnPropertySymbols:St,getPrototypeOf:Ct}=Object,U=globalThis,Q=U.trustedTypes,xt=Q?Q.emptyScript:"",kt=U.reactiveElementPolyfillSupport,S=(i,t)=>i,H={toAttribute(i,t){switch(t){case Boolean:i=i?xt:null;break;case Object:case Array:i=i==null?i:JSON.stringify(i)}return i},fromAttribute(i,t){let e=i;switch(t){case Boolean:e=i!==null;break;case Number:e=i===null?null:Number(i);break;case Object:case Array:try{e=JSON.parse(i)}catch{e=null}}return e}},V=(i,t)=>!yt(i,t),X={attribute:!0,type:String,converter:H,reflect:!1,useDefault:!1,hasChanged:V};Symbol.metadata??=Symbol("metadata"),U.litPropertyMetadata??=new WeakMap;let A=class extends HTMLElement{static addInitializer(t){this._$Ei(),(this.l??=[]).push(t)}static get observedAttributes(){return this.finalize(),this._$Eh&&[...this._$Eh.keys()]}static createProperty(t,e=X){if(e.state&&(e.attribute=!1),this._$Ei(),this.prototype.hasOwnProperty(t)&&((e=Object.create(e)).wrapped=!0),this.elementProperties.set(t,e),!e.noAccessor){const s=Symbol(),r=this.getPropertyDescriptor(t,s,e);r!==void 0&&At(this.prototype,t,r)}}static getPropertyDescriptor(t,e,s){const{get:r,set:n}=wt(this.prototype,t)??{get(){return this[e]},set(o){this[e]=o}};return{get:r,set(o){const l=r?.call(this);n?.call(this,o),this.requestUpdate(t,l,s)},configurable:!0,enumerable:!0}}static getPropertyOptions(t){return this.elementProperties.get(t)??X}static _$Ei(){if(this.hasOwnProperty(S("elementProperties")))return;const t=Ct(this);t.finalize(),t.l!==void 0&&(this.l=[...t.l]),this.elementProperties=new Map(t.elementProperties)}static finalize(){if(this.hasOwnProperty(S("finalized")))return;if(this.finalized=!0,this._$Ei(),this.hasOwnProperty(S("properties"))){const e=this.properties,s=[...Et(e),...St(e)];for(const r of s)this.createProperty(r,e[r])}const t=this[Symbol.metadata];if(t!==null){const e=litPropertyMetadata.get(t);if(e!==void 0)for(const[s,r]of e)this.elementProperties.set(s,r)}this._$Eh=new Map;for(const[e,s]of this.elementProperties){const r=this._$Eu(e,s);r!==void 0&&this._$Eh.set(r,e)}this.elementStyles=this.finalizeStyles(this.styles)}static finalizeStyles(t){const e=[];if(Array.isArray(t)){const s=new Set(t.flat(1/0).reverse());for(const r of s)e.unshift(G(r))}else t!==void 0&&e.push(G(t));return e}static _$Eu(t,e){const s=e.attribute;return s===!1?void 0:typeof s=="string"?s:typeof t=="string"?t.toLowerCase():void 0}constructor(){super(),this._$Ep=void 0,this.isUpdatePending=!1,this.hasUpdated=!1,this._$Em=null,this._$Ev()}_$Ev(){this._$ES=new Promise(t=>this.enableUpdating=t),this._$AL=new Map,this._$E_(),this.requestUpdate(),this.constructor.l?.forEach(t=>t(this))}addController(t){(this._$EO??=new Set).add(t),this.renderRoot!==void 0&&this.isConnected&&t.hostConnected?.()}removeController(t){this._$EO?.delete(t)}_$E_(){const t=new Map,e=this.constructor.elementProperties;for(const s of e.keys())this.hasOwnProperty(s)&&(t.set(s,this[s]),delete this[s]);t.size>0&&(this._$Ep=t)}createRenderRoot(){const t=this.shadowRoot??this.attachShadow(this.constructor.shadowRootOptions);return $t(t,this.constructor.elementStyles),t}connectedCallback(){this.renderRoot??=this.createRenderRoot(),this.enableUpdating(!0),this._$EO?.forEach(t=>t.hostConnected?.())}enableUpdating(t){}disconnectedCallback(){this._$EO?.forEach(t=>t.hostDisconnected?.())}attributeChangedCallback(t,e,s){this._$AK(t,s)}_$ET(t,e){const s=this.constructor.elementProperties.get(t),r=this.constructor._$Eu(t,s);if(r!==void 0&&s.reflect===!0){const n=(s.converter?.toAttribute!==void 0?s.converter:H).toAttribute(e,s.type);this._$Em=t,n==null?this.removeAttribute(r):this.setAttribute(r,n),this._$Em=null}}_$AK(t,e){const s=this.constructor,r=s._$Eh.get(t);if(r!==void 0&&this._$Em!==r){const n=s.getPropertyOptions(r),o=typeof n.converter=="function"?{fromAttribute:n.converter}:n.converter?.fromAttribute!==void 0?n.converter:H;this._$Em=r;const l=o.fromAttribute(e,n.type);this[r]=l??this._$Ej?.get(r)??l,this._$Em=null}}requestUpdate(t,e,s,r=!1,n){if(t!==void 0){const o=this.constructor;if(r===!1&&(n=this[t]),s??=o.getPropertyOptions(t),!((s.hasChanged??V)(n,e)||s.useDefault&&s.reflect&&n===this._$Ej?.get(t)&&!this.hasAttribute(o._$Eu(t,s))))return;this.C(t,e,s)}this.isUpdatePending===!1&&(this._$ES=this._$EP())}C(t,e,{useDefault:s,reflect:r,wrapped:n},o){s&&!(this._$Ej??=new Map).has(t)&&(this._$Ej.set(t,o??e??this[t]),n!==!0||o!==void 0)||(this._$AL.has(t)||(this.hasUpdated||s||(e=void 0),this._$AL.set(t,e)),r===!0&&this._$Em!==t&&(this._$Eq??=new Set).add(t))}async _$EP(){this.isUpdatePending=!0;try{await this._$ES}catch(e){Promise.reject(e)}const t=this.scheduleUpdate();return t!=null&&await t,!this.isUpdatePending}scheduleUpdate(){return this.performUpdate()}performUpdate(){if(!this.isUpdatePending)return;if(!this.hasUpdated){if(this.renderRoot??=this.createRenderRoot(),this._$Ep){for(const[r,n]of this._$Ep)this[r]=n;this._$Ep=void 0}const s=this.constructor.elementProperties;if(s.size>0)for(const[r,n]of s){const{wrapped:o}=n,l=this[r];o!==!0||this._$AL.has(r)||l===void 0||this.C(r,void 0,n,l)}}let t=!1;const e=this._$AL;try{t=this.shouldUpdate(e),t?(this.willUpdate(e),this._$EO?.forEach(s=>s.hostUpdate?.()),this.update(e)):this._$EM()}catch(s){throw t=!1,this._$EM(),s}t&&this._$AE(e)}willUpdate(t){}_$AE(t){this._$EO?.forEach(e=>e.hostUpdated?.()),this.hasUpdated||(this.hasUpdated=!0,this.firstUpdated(t)),this.updated(t)}_$EM(){this._$AL=new Map,this.isUpdatePending=!1}get updateComplete(){return this.getUpdateComplete()}getUpdateComplete(){return this._$ES}shouldUpdate(t){return!0}update(t){this._$Eq&&=this._$Eq.forEach(e=>this._$ET(e,this[e])),this._$EM()}updated(t){}firstUpdated(t){}};A.elementStyles=[],A.shadowRootOptions={mode:"open"},A[S("elementProperties")]=new Map,A[S("finalized")]=new Map,kt?.({ReactiveElement:A}),(U.reactiveElementVersions??=[]).push("2.1.2");const D=globalThis,tt=i=>i,R=D.trustedTypes,et=R?R.createPolicy("lit-html",{createHTML:i=>i}):void 0,st="$lit$",b=`lit$${Math.random().toFixed(9).slice(2)}$`,it="?"+b,Pt=`<${it}>`,m=document,C=()=>m.createComment(""),x=i=>i===null||typeof i!="object"&&typeof i!="function",j=Array.isArray,Tt=i=>j(i)||typeof i?.[Symbol.iterator]=="function",K=`[ 	
\f\r]`,k=/<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g,rt=/-->/g,nt=/>/g,$=RegExp(`>|${K}(?:([^\\s"'>=/]+)(${K}*=${K}*(?:[^ 	
\f\r"'\`<>=]|("|')|))|$)`,"g"),ot=/'/g,at=/"/g,lt=/^(?:script|style|textarea|title)$/i,Ot=i=>(t,...e)=>({_$litType$:i,strings:t,values:e}),P=Ot(1),g=Symbol.for("lit-noChange"),u=Symbol.for("lit-nothing"),ct=new WeakMap,y=m.createTreeWalker(m,129);function ht(i,t){if(!j(i)||!i.hasOwnProperty("raw"))throw Error("invalid template strings array");return et!==void 0?et.createHTML(t):t}const Mt=(i,t)=>{const e=i.length-1,s=[];let r,n=t===2?"<svg>":t===3?"<math>":"",o=k;for(let l=0;l<e;l++){const a=i[l];let c,d,h=-1,v=0;for(;v<a.length&&(o.lastIndex=v,d=o.exec(a),d!==null);)v=o.lastIndex,o===k?d[1]==="!--"?o=rt:d[1]!==void 0?o=nt:d[2]!==void 0?(lt.test(d[2])&&(r=RegExp("</"+d[2],"g")),o=$):d[3]!==void 0&&(o=$):o===$?d[0]===">"?(o=r??k,h=-1):d[1]===void 0?h=-2:(h=o.lastIndex-d[2].length,c=d[1],o=d[3]===void 0?$:d[3]==='"'?at:ot):o===at||o===ot?o=$:o===rt||o===nt?o=k:(o=$,r=void 0);const _=o===$&&i[l+1].startsWith("/>")?" ":"";n+=o===k?a+Pt:h>=0?(s.push(c),a.slice(0,h)+st+a.slice(h)+b+_):a+b+(h===-2?l:_)}return[ht(i,n+(i[e]||"<?>")+(t===2?"</svg>":t===3?"</math>":"")),s]};class T{constructor({strings:t,_$litType$:e},s){let r;this.parts=[];let n=0,o=0;const l=t.length-1,a=this.parts,[c,d]=Mt(t,e);if(this.el=T.createElement(c,s),y.currentNode=this.el.content,e===2||e===3){const h=this.el.content.firstChild;h.replaceWith(...h.childNodes)}for(;(r=y.nextNode())!==null&&a.length<l;){if(r.nodeType===1){if(r.hasAttributes())for(const h of r.getAttributeNames())if(h.endsWith(st)){const v=d[o++],_=r.getAttribute(h).split(b),I=/([.?@])?(.*)/.exec(v);a.push({type:1,index:n,name:I[2],strings:_,ctor:I[1]==="."?Ht:I[1]==="?"?Rt:I[1]==="@"?Nt:N}),r.removeAttribute(h)}else h.startsWith(b)&&(a.push({type:6,index:n}),r.removeAttribute(h));if(lt.test(r.tagName)){const h=r.textContent.split(b),v=h.length-1;if(v>0){r.textContent=R?R.emptyScript:"";for(let _=0;_<v;_++)r.append(h[_],C()),y.nextNode(),a.push({type:2,index:++n});r.append(h[v],C())}}}else if(r.nodeType===8)if(r.data===it)a.push({type:2,index:n});else{let h=-1;for(;(h=r.data.indexOf(b,h+1))!==-1;)a.push({type:7,index:n}),h+=b.length-1}n++}}static createElement(t,e){const s=m.createElement("template");return s.innerHTML=t,s}}function w(i,t,e=i,s){if(t===g)return t;let r=s!==void 0?e._$Co?.[s]:e._$Cl;const n=x(t)?void 0:t._$litDirective$;return r?.constructor!==n&&(r?._$AO?.(!1),n===void 0?r=void 0:(r=new n(i),r._$AT(i,e,s)),s!==void 0?(e._$Co??=[])[s]=r:e._$Cl=r),r!==void 0&&(t=w(i,r._$AS(i,t.values),r,s)),t}class Ut{constructor(t,e){this._$AV=[],this._$AN=void 0,this._$AD=t,this._$AM=e}get parentNode(){return this._$AM.parentNode}get _$AU(){return this._$AM._$AU}u(t){const{el:{content:e},parts:s}=this._$AD,r=(t?.creationScope??m).importNode(e,!0);y.currentNode=r;let n=y.nextNode(),o=0,l=0,a=s[0];for(;a!==void 0;){if(o===a.index){let c;a.type===2?c=new O(n,n.nextSibling,this,t):a.type===1?c=new a.ctor(n,a.name,a.strings,this,t):a.type===6&&(c=new Bt(n,this,t)),this._$AV.push(c),a=s[++l]}o!==a?.index&&(n=y.nextNode(),o++)}return y.currentNode=m,r}p(t){let e=0;for(const s of this._$AV)s!==void 0&&(s.strings!==void 0?(s._$AI(t,s,e),e+=s.strings.length-2):s._$AI(t[e])),e++}}class O{get _$AU(){return this._$AM?._$AU??this._$Cv}constructor(t,e,s,r){this.type=2,this._$AH=u,this._$AN=void 0,this._$AA=t,this._$AB=e,this._$AM=s,this.options=r,this._$Cv=r?.isConnected??!0}get parentNode(){let t=this._$AA.parentNode;const e=this._$AM;return e!==void 0&&t?.nodeType===11&&(t=e.parentNode),t}get startNode(){return this._$AA}get endNode(){return this._$AB}_$AI(t,e=this){t=w(this,t,e),x(t)?t===u||t==null||t===""?(this._$AH!==u&&this._$AR(),this._$AH=u):t!==this._$AH&&t!==g&&this._(t):t._$litType$!==void 0?this.$(t):t.nodeType!==void 0?this.T(t):Tt(t)?this.k(t):this._(t)}O(t){return this._$AA.parentNode.insertBefore(t,this._$AB)}T(t){this._$AH!==t&&(this._$AR(),this._$AH=this.O(t))}_(t){this._$AH!==u&&x(this._$AH)?this._$AA.nextSibling.data=t:this.T(m.createTextNode(t)),this._$AH=t}$(t){const{values:e,_$litType$:s}=t,r=typeof s=="number"?this._$AC(t):(s.el===void 0&&(s.el=T.createElement(ht(s.h,s.h[0]),this.options)),s);if(this._$AH?._$AD===r)this._$AH.p(e);else{const n=new Ut(r,this),o=n.u(this.options);n.p(e),this.T(o),this._$AH=n}}_$AC(t){let e=ct.get(t.strings);return e===void 0&&ct.set(t.strings,e=new T(t)),e}k(t){j(this._$AH)||(this._$AH=[],this._$AR());const e=this._$AH;let s,r=0;for(const n of t)r===e.length?e.push(s=new O(this.O(C()),this.O(C()),this,this.options)):s=e[r],s._$AI(n),r++;r<e.length&&(this._$AR(s&&s._$AB.nextSibling,r),e.length=r)}_$AR(t=this._$AA.nextSibling,e){for(this._$AP?.(!1,!0,e);t!==this._$AB;){const s=tt(t).nextSibling;tt(t).remove(),t=s}}setConnected(t){this._$AM===void 0&&(this._$Cv=t,this._$AP?.(t))}}class N{get tagName(){return this.element.tagName}get _$AU(){return this._$AM._$AU}constructor(t,e,s,r,n){this.type=1,this._$AH=u,this._$AN=void 0,this.element=t,this.name=e,this._$AM=r,this.options=n,s.length>2||s[0]!==""||s[1]!==""?(this._$AH=Array(s.length-1).fill(new String),this.strings=s):this._$AH=u}_$AI(t,e=this,s,r){const n=this.strings;let o=!1;if(n===void 0)t=w(this,t,e,0),o=!x(t)||t!==this._$AH&&t!==g,o&&(this._$AH=t);else{const l=t;let a,c;for(t=n[0],a=0;a<n.length-1;a++)c=w(this,l[s+a],e,a),c===g&&(c=this._$AH[a]),o||=!x(c)||c!==this._$AH[a],c===u?t=u:t!==u&&(t+=(c??"")+n[a+1]),this._$AH[a]=c}o&&!r&&this.j(t)}j(t){t===u?this.element.removeAttribute(this.name):this.element.setAttribute(this.name,t??"")}}class Ht extends N{constructor(){super(...arguments),this.type=3}j(t){this.element[this.name]=t===u?void 0:t}}class Rt extends N{constructor(){super(...arguments),this.type=4}j(t){this.element.toggleAttribute(this.name,!!t&&t!==u)}}class Nt extends N{constructor(t,e,s,r,n){super(t,e,s,r,n),this.type=5}_$AI(t,e=this){if((t=w(this,t,e,0)??u)===g)return;const s=this._$AH,r=t===u&&s!==u||t.capture!==s.capture||t.once!==s.once||t.passive!==s.passive,n=t!==u&&(s===u||r);r&&this.element.removeEventListener(this.name,this,s),n&&this.element.addEventListener(this.name,this,t),this._$AH=t}handleEvent(t){typeof this._$AH=="function"?this._$AH.call(this.options?.host??this.element,t):this._$AH.handleEvent(t)}}class Bt{constructor(t,e,s){this.element=t,this.type=6,this._$AN=void 0,this._$AM=e,this.options=s}get _$AU(){return this._$AM._$AU}_$AI(t){w(this,t)}}const It=D.litHtmlPolyfillSupport;It?.(T,O),(D.litHtmlVersions??=[]).push("3.3.2");const Lt=(i,t,e)=>{const s=e?.renderBefore??t;let r=s._$litPart$;if(r===void 0){const n=e?.renderBefore??null;s._$litPart$=r=new O(t.insertBefore(C(),n),n,void 0,e??{})}return r._$AI(i),r};const W=globalThis;let M=class extends A{constructor(){super(...arguments),this.renderOptions={host:this},this._$Do=void 0}createRenderRoot(){const t=super.createRenderRoot();return this.renderOptions.renderBefore??=t.firstChild,t}update(t){const e=this.render();this.hasUpdated||(this.renderOptions.isConnected=this.isConnected),super.update(t),this._$Do=Lt(e,this.renderRoot,this.renderOptions)}connectedCallback(){super.connectedCallback(),this._$Do?.setConnected(!0)}disconnectedCallback(){super.disconnectedCallback(),this._$Do?.setConnected(!1)}render(){return g}};M._$litElement$=!0,M.finalized=!0,W.litElementHydrateSupport?.({LitElement:M});const zt=W.litElementPolyfillSupport;zt?.({LitElement:M}),(W.litElementVersions??=[]).push("4.2.2");const Vt=i=>(t,e)=>{e!==void 0?e.addInitializer(()=>{customElements.define(i,t)}):customElements.define(i,t)};const Dt={attribute:!0,type:String,converter:H,reflect:!1,hasChanged:V},jt=(i=Dt,t,e)=>{const{kind:s,metadata:r}=e;let n=globalThis.litPropertyMetadata.get(r);if(n===void 0&&globalThis.litPropertyMetadata.set(r,n=new Map),s==="setter"&&((i=Object.create(i)).wrapped=!0),n.set(e.name,i),s==="accessor"){const{name:o}=e;return{set(l){const a=t.get.call(this);t.set.call(this,l),this.requestUpdate(o,a,i,!0,l)},init(l){return l!==void 0&&this.C(o,void 0,i,l),l}}}if(s==="setter"){const{name:o}=e;return function(l){const a=this[o];t.call(this,l),this.requestUpdate(o,a,i,!0,l)}}throw Error("Unsupported decorator location: "+s)};function q(i){return(t,e)=>typeof e=="object"?jt(i,t,e):((s,r,n)=>{const o=r.hasOwnProperty(n);return r.constructor.createProperty(n,s),o?Object.getOwnPropertyDescriptor(r,n):void 0})(i,t,e)}function Z(i){return q({...i,state:!0,attribute:!1})}const dt={ATTRIBUTE:1},ut=i=>(...t)=>({_$litDirective$:i,values:t});let pt=class{constructor(t){}get _$AU(){return this._$AM._$AU}_$AT(t,e,s){this._$Ct=t,this._$AM=e,this._$Ci=s}_$AS(t,e){return this.update(t,e)}update(t,e){return this.render(...e)}};const vt=ut(class extends pt{constructor(i){if(super(i),i.type!==dt.ATTRIBUTE||i.name!=="class"||i.strings?.length>2)throw Error("`classMap()` can only be used in the `class` attribute and must be the only part in the attribute.")}render(i){return" "+Object.keys(i).filter(t=>i[t]).join(" ")+" "}update(i,[t]){if(this.st===void 0){this.st=new Set,i.strings!==void 0&&(this.nt=new Set(i.strings.join(" ").split(/\s/).filter(s=>s!=="")));for(const s in t)t[s]&&!this.nt?.has(s)&&this.st.add(s);return this.render(t)}const e=i.element.classList;for(const s of this.st)s in t||(e.remove(s),this.st.delete(s));for(const s in t){const r=!!t[s];r===this.st.has(s)||this.nt?.has(s)||(r?(e.add(s),this.st.add(s)):(e.remove(s),this.st.delete(s)))}return g}});const ft="important",Kt=" !"+ft,Wt=ut(class extends pt{constructor(i){if(super(i),i.type!==dt.ATTRIBUTE||i.name!=="style"||i.strings?.length>2)throw Error("The `styleMap` directive must be used in the `style` attribute and must be the only part in the attribute.")}render(i){return Object.keys(i).reduce((t,e)=>{const s=i[e];return s==null?t:t+`${e=e.includes("-")?e:e.replace(/(?:^(webkit|moz|ms|o)|)(?=[A-Z])/g,"-$&").toLowerCase()}:${s};`},"")}update(i,[t]){const{style:e}=i.element;if(this.ft===void 0)return this.ft=new Set(Object.keys(t)),this.render(t);for(const s of this.ft)t[s]==null&&(this.ft.delete(s),s.includes("-")?e.removeProperty(s):e[s]=null);for(const s in t){const r=t[s];if(r!=null){this.ft.add(s);const n=typeof r=="string"&&r.endsWith(Kt);s.includes("-")||n?e.setProperty(s,n?r.slice(0,-11):r,n?ft:""):e[s]=r}}return g}}),F="0.1.0",bt="__voiceKernel__";function qt(){const i=new Set;let t=null,e=!1;const s={state:"idle",level:0,lastTranscript:""};let r={...s};function n(){return r}function o(){r={...s};const a=r;for(const c of i)try{c(a)}catch(d){console.error("[voiceKernel] subscriber threw",d)}}return{get state(){return s.state},get level(){return s.level},get lastTranscript(){return s.lastTranscript},get errorMessage(){return s.errorMessage},async start(){if(!t){console.warn("[voiceKernel] start called before implementation registered");return}if(e){console.info("[voiceKernel] start() ignored — a session is already starting");return}if(!(s.state!=="idle"&&s.state!=="error")){e=!0;try{await t.start()}finally{e=!1}}},async stop(){t&&(e=!1,s.state!=="idle"&&await t.stop())},getSnapshot:n,async toggle(){s.state==="idle"||s.state==="error"?await this.start():await this.stop()},subscribe(a){i.add(a);try{a(n())}catch(c){console.error("[voiceKernel] initial subscriber call threw",c)}return()=>{i.delete(a)}},_setImpl(a){t=a},_clearImpl(){t=null},_publish(a){for(const c of Object.keys(a)){const d=a[c];d===void 0?delete s[c]:s[c]=d}o()}}}function Zt(){if(typeof window>"u")throw new Error("[voiceKernel] cannot install in a non-browser environment");const i=window[bt];if(i)return i.version!==F&&console.warn(`[voiceKernel] version mismatch: existing=${i.version} new=${F}; using existing`),i;const t={version:F,voice:qt()};return window[bt]=t,t}function B(){return Zt()}var gt=Object.defineProperty,Ft=Object.getOwnPropertyDescriptor,Jt=(i,t,e)=>t in i?gt(i,t,{enumerable:!0,configurable:!0,writable:!0,value:e}):i[t]=e,E=(i,t,e,s)=>{for(var r=s>1?void 0:s?Ft(t,e):t,n=i.length-1,o;n>=0;n--)(o=i[n])&&(r=(s?o(t,e,r):o(r))||r);return s&&r&&gt(t,e,r),r},Yt=(i,t,e)=>Jt(i,t+"",e);const Gt=.05;function Qt(i){return .5+Math.min(1,i*3)}p.VoiceCallButtonElement=class extends M{_unsubscribe=null;_previousState="idle";constructor(){super(),this.variant="nav",this.disabled=!1,this._state="idle",this._level=0,this._errorMessage=""}connectedCallback(){super.connectedCallback(),this._unsubscribe?.();const t=B();this._unsubscribe=t.voice.subscribe(e=>{this._state=e.state,this._level=e.level,this._errorMessage=e.errorMessage??""})}disconnectedCallback(){super.disconnectedCallback(),this._unsubscribe?.(),this._unsubscribe=null}updated(t){t.has("_state")&&this._state!==this._previousState&&(this._dispatchStateChange(),this._state==="listening"&&this._previousState==="connecting"&&this._dispatchEvent("landi:call-started",{timestamp:new Date().toISOString()}),this._state==="idle"&&this._previousState!=="idle"&&this._dispatchEvent("landi:call-ended",{timestamp:new Date().toISOString()}),this._state==="error"&&this._errorMessage&&this._dispatchEvent("landi:call-error",{message:this._errorMessage,timestamp:new Date().toISOString()}),this._previousState=this._state)}async start(){await B().voice.start()}async stop(){await B().voice.stop()}async toggle(){await B().voice.toggle()}_dispatchStateChange(){this._dispatchEvent("landi:call-state-changed",{state:this._state,level:this._level,timestamp:new Date().toISOString()})}_dispatchEvent(t,e){this.dispatchEvent(new CustomEvent(t,{detail:e,bubbles:!0,composed:!0}))}_onClick=t=>{t.preventDefault(),!this.disabled&&this.toggle()};_statusLabel(){switch(this._state){case"connecting":return"Connecting";case"listening":return"Listening";case"speaking":return"Speaking";case"error":return"Tap to retry";default:return""}}render(){const t=this._state!=="idle"&&this._state!=="error",e=vt({halo:!0,listening:this._state==="listening",speaking:this._state==="speaking",error:this._state==="error"}),s=vt({chip:!0,listening:this._state==="listening",speaking:this._state==="speaking",error:this._state==="error"}),r=this._statusLabel(),n=t?`End call (${r})`:"Start voice call";return P`
      <button
        part="button"
        type="button"
        ?disabled=${this.disabled}
        aria-label=${n}
        aria-pressed=${t?"true":"false"}
        @click=${this._onClick}
      >
        <span class="icon-wrap" part="icon-wrap" aria-hidden="true">
          ${this._state==="connecting"?P`<span class="spinner" part="spinner"></span>`:P`
                <span class=${e} part="halo"></span>
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
        ${r?P`
              <span class=${s} part="chip" role="status" aria-live="polite">
                ${this._state==="listening"&&this._level>Gt?P`<span
                      class="level-dot"
                      part="level-dot"
                      style=${Wt({transform:`scale(${Qt(this._level).toFixed(2)})`})}
                    ></span>`:null}
                ${r}
              </span>
            `:null}
        <span class="visually-hidden" aria-live="polite">
          ${this._state==="error"&&this._errorMessage?this._errorMessage:""}
        </span>
      </button>
    `}},Yt(p.VoiceCallButtonElement,"styles",mt`
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
  `),E([q({type:String,reflect:!0})],p.VoiceCallButtonElement.prototype,"variant",2),E([q({type:Boolean,reflect:!0})],p.VoiceCallButtonElement.prototype,"disabled",2),E([Z()],p.VoiceCallButtonElement.prototype,"_state",2),E([Z()],p.VoiceCallButtonElement.prototype,"_level",2),E([Z()],p.VoiceCallButtonElement.prototype,"_errorMessage",2),p.VoiceCallButtonElement=E([Vt("voice-call-button")],p.VoiceCallButtonElement),Object.defineProperty(p,Symbol.toStringTag,{value:"Module"})}));
//# sourceMappingURL=voice-call-button.umd.js.map
