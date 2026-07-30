
export const useFontLoader = (fonts: Record<string, string>) => {
    const injectFonts = () => {
        if (typeof document === 'undefined' || !fonts || typeof fonts !== 'object') return;

        const ensureStylesheetLink = (href: string) => {
            const existing = document.querySelector(`link[rel="stylesheet"][data-font-url="${href}"]`);
            if (existing) return;
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.setAttribute('data-font-url', href);
            link.href = href;
            document.head.appendChild(link);
        };

        const ensureFontFaceStyle = (name: string, srcUrl: string) => {
            const existing = document.querySelector(`style[data-font-url="${srcUrl}"]`);
            if (existing) return;
            const styleEl = document.createElement('style');
            styleEl.setAttribute('data-font-url', srcUrl);
            styleEl.textContent = `@font-face {\n  font-family: '${name}';\n  src: url('${srcUrl}');\n   font-style: normal;\n  font-display: swap;\n}`;
            document.head.appendChild(styleEl);
        };

        Object.entries(fonts).forEach(([name, url]) => {
            if (!name || !url) return;
            const isCss = /\.css(\?|$)/i.test(url) || /fonts\.googleapis\.com/.test(url);
            if (isCss) {
                ensureStylesheetLink(url);
            } else {
                ensureFontFaceStyle(name, url);
            }
        });
    };
    injectFonts();
};