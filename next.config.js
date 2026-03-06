// Polyfill browser-only APIs that pdfjs-dist (used by pdf-parse) expects during SSR
if (typeof globalThis.File === 'undefined') {
  globalThis.File = class File extends Blob {
    constructor(bits, name, opts) {
      super(bits, opts);
      this.name = name;
      this.lastModified = (opts && opts.lastModified) || Date.now();
    }
  };
}
if (typeof globalThis.DOMMatrix === 'undefined') {
  globalThis.DOMMatrix = class DOMMatrix {
    constructor() { this.a=1;this.b=0;this.c=0;this.d=1;this.e=0;this.f=0; }
    isIdentity = true;
    translate() { return new DOMMatrix(); }
    scale() { return new DOMMatrix(); }
    inverse() { return new DOMMatrix(); }
    multiply() { return new DOMMatrix(); }
    transformPoint(p) { return p || { x:0, y:0 }; }
  };
}
if (typeof globalThis.ImageData === 'undefined') {
  globalThis.ImageData = class ImageData {
    constructor(w, h) { this.width=w||0; this.height=h||0; this.data=new Uint8ClampedArray(this.width*this.height*4); }
  };
}
if (typeof globalThis.Path2D === 'undefined') {
  globalThis.Path2D = class Path2D { constructor() {} moveTo(){} lineTo(){} bezierCurveTo(){} rect(){} closePath(){} };
}

const webpack = require('webpack');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false, // avoids YouTube IFrame API null.src when mount→unmount→mount (see VideoPlayer)
  serverExternalPackages: ['pdf-parse', 'pdfjs-dist'],
  // Limit image optimizer exposure (GHSA-9g9p-9gw9-jx7f). Use only trusted domains.
  images: {
    domains: ['firebasestorage.googleapis.com'],
    remotePatterns: [], // Do not add untrusted remotePatterns to avoid DoS
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Inject File polyfill at the top of server bundles for Node.js 18 compatibility
      config.plugins.push(
        new webpack.BannerPlugin({
          banner: `if(typeof globalThis.File==='undefined'){globalThis.File=class File extends Blob{constructor(b,n,o){super(b,o);this.name=n;this.lastModified=(o&&o.lastModified)||Date.now();}}}`,
          raw: true,
        })
      );
    }
    return config;
  },
};

module.exports = nextConfig;
