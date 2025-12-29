/**
 * ChartCanvas - メインクラス
 * グラフを作成・管理するためのクラス
 */
class ChartCanvas {
    /**
     * コンストラクタ
     * @param {HTMLElement} container - グラフを表示するDOM要素
     */
    constructor(container) {
        if (!container) {
            throw new Error('ChartCanvas requires a container element');
        }
        this.container = container;
        this.width = 1024;
        this.height = 600;
        // 日本語対応の等幅フォント（デフォルト）
        this.fontFamily = "'MS Gothic', 'MS PGothic', 'Courier New', Courier, 'Lucida Console', monospace";
        // フォントサイズごとのメトリクスをキャッシュ
        this.fontMetrics = {};
    }

    /**
     * フォントメトリクスを測定（高さ、半角幅、全角幅）
     * @param {number} fontSize - フォントサイズ
     * @returns {Object} {height, halfWidth, fullWidth}
     */
    measureFontMetrics(fontSize) {
        // キャッシュをチェック
        if (this.fontMetrics[fontSize]) {
            return this.fontMetrics[fontSize];
        }

        // 一時的なSVG要素を作成して測定
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        tempSvg.setAttribute('width', 1000);
        tempSvg.setAttribute('height', 1000);
        tempSvg.style.position = 'absolute';
        tempSvg.style.visibility = 'hidden';
        tempSvg.style.top = '-9999px';
        tempSvg.style.left = '-9999px';
        document.body.appendChild(tempSvg);

        // スタイルを追加
        const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
        style.textContent = `
            .measure-text {
                font-family: ${this.fontFamily};
                font-size: ${fontSize}px;
            }
        `;
        tempSvg.appendChild(style);

        // 半角文字（'M'）で幅を測定
        const halfText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        halfText.setAttribute('class', 'measure-text');
        halfText.setAttribute('x', 0);
        halfText.setAttribute('y', fontSize);
        halfText.textContent = 'M';
        tempSvg.appendChild(halfText);
        
        // 全角文字（'あ'）で幅を測定
        const fullText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        fullText.setAttribute('class', 'measure-text');
        fullText.setAttribute('x', 0);
        fullText.setAttribute('y', fontSize * 2);
        fullText.textContent = 'あ';
        tempSvg.appendChild(fullText);

        // DOMに追加してから測定（getBBox()はレンダリング後に動作）
        // 強制的に再描画を待つ
        void tempSvg.offsetHeight; // レイアウトを強制

        let halfWidth, fullWidth, height;
        try {
            halfWidth = halfText.getBBox().width;
            fullWidth = fullText.getBBox().width;
            const bbox = fullText.getBBox();
            height = bbox.height;
        } catch (e) {
            // getBBox()が失敗した場合のフォールバック
            // Canvas APIを使用して測定
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            ctx.font = `${fontSize}px ${this.fontFamily}`;
            const halfMetrics = ctx.measureText('M');
            const fullMetrics = ctx.measureText('あ');
            halfWidth = halfMetrics.width;
            fullWidth = fullMetrics.width;
            height = fontSize * 1.2; // 概算値
        }

        // 一時要素を削除
        document.body.removeChild(tempSvg);

        // メトリクスをキャッシュ
        const metrics = {
            height: height,
            halfWidth: halfWidth,
            fullWidth: fullWidth
        };
        this.fontMetrics[fontSize] = metrics;

        return metrics;
    }

    /**
     * テキストとフォントサイズから文字列のピクセル幅を取得
     * @param {string} text - 測定するテキスト
     * @param {number} fontSize - フォントサイズ
     * @returns {number} テキストのピクセル幅
     */
    getTextWidth(text, fontSize) {
        if (!text || text.length === 0) {
            return 0;
        }

        // Canvas APIを使用して正確に測定
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        ctx.font = `${fontSize}px ${this.fontFamily}`;
        const metrics = ctx.measureText(text);
        return metrics.width;
    }

    /**
     * グラフのサイズを設定
     * @param {number} width - 幅（デフォルト: 1024）
     * @param {number} height - 高さ（デフォルト: 600）
     * @returns {ChartCanvas} メソッドチェーン用にthisを返す
     */
    size(width, height) {
        if (width !== undefined) {
            this.width = width;
        }
        if (height !== undefined) {
            this.height = height;
        }
        return this;
    }

    /**
     * SVGを描画（現在は枠だけ）
     */
    render() {
        // 既存のSVGを削除
        const existingSvg = this.container.querySelector('svg');
        if (existingSvg) {
            existingSvg.remove();
        }

        // SVG要素を作成
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', this.width);
        svg.setAttribute('height', this.height);
        svg.setAttribute('viewBox', `0 0 ${this.width} ${this.height}`);
        svg.style.border = '1px solid #000';

        // 日本語対応の等幅フォントを設定（style要素を追加）
        const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
        style.textContent = `
            .chart-text {
                font-family: ${this.fontFamily};
            }
        `;
        svg.appendChild(style);

        // 枠を描画（矩形）
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', 0);
        rect.setAttribute('y', 0);
        rect.setAttribute('width', this.width);
        rect.setAttribute('height', this.height);
        rect.setAttribute('fill', 'none');
        rect.setAttribute('stroke', '#000');
        rect.setAttribute('stroke-width', '1');
        svg.appendChild(rect);

        // コンテナに追加
        this.container.appendChild(svg);
    }
}

// グローバルスコープに公開
window.ChartCanvas = ChartCanvas;

