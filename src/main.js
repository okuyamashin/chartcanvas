/**
 * 仮想DOM要素クラス（DOMなし環境用）
 */
class VirtualSVGElement {
    constructor(tagName, namespace = 'http://www.w3.org/2000/svg') {
        this.tagName = tagName;
        this.namespace = namespace;
        this.attributes = {};
        this.children = [];
        this.textContent = '';
    }

    setAttribute(name, value) {
        this.attributes[name] = String(value);
    }

    getAttribute(name) {
        return this.attributes[name];
    }

    appendChild(child) {
        this.children.push(child);
        return child;
    }

    cloneNode(deep) {
        const clone = new VirtualSVGElement(this.tagName, this.namespace);
        Object.assign(clone.attributes, this.attributes);
        clone.textContent = this.textContent;
        if (deep) {
            for (const child of this.children) {
                clone.appendChild(child.cloneNode(true));
            }
        }
        return clone;
    }

    toXMLString() {
        let xml = `<${this.tagName}`;
        for (const [name, value] of Object.entries(this.attributes)) {
            const escapedValue = String(value).replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            xml += ` ${name}="${escapedValue}"`;
        }
        if (this.children.length === 0 && !this.textContent) {
            xml += '/>';
        } else {
            xml += '>';
            if (this.textContent) {
                xml += this.textContent.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            }
            for (const child of this.children) {
                xml += child.toXMLString();
            }
            xml += `</${this.tagName}>`;
        }
        return xml;
    }
}

/**
 * 仮想DOM API（DOMなし環境用）
 */
const VirtualDOM = {
    createElementNS(namespace, tagName) {
        // ブラウザ環境でdocumentが存在する場合は、実際のDOM要素を使用
        if (typeof document !== 'undefined' && document && document.createElementNS) {
            return document.createElementNS(namespace, tagName);
        }
        // DOMなし環境の場合は仮想DOM要素を使用
        return new VirtualSVGElement(tagName, namespace);
    }
};

/**
 * ChartCanvas - メインクラス
 * グラフを作成・管理するためのクラス
 */
class ChartCanvas {
    // フォントサイズの定数
    static FONT_SIZE_NORMAL = 14;  // 普通の大きさ
    static FONT_SIZE_SMALL = 10;    // 小さい大きさ
    /**
     * コンストラクタ
     * @param {HTMLElement|null} container - グラフを表示するDOM要素（nullの場合はDOMなしモード）
     */
    constructor(container = null) {
        this.container = container;
        this.isHeadlessMode = !container;
        this.width = 1024;
        this.height = 600;
        // タイトル
        this.title = '';
        // サブタイトル
        this.subtitle = '';
        // 日本語対応の等幅フォント（デフォルト）
        this.fontFamily = "'MS Gothic', 'MS PGothic', 'Courier New', Courier, 'Lucida Console', monospace";
        // フォントサイズごとのメトリクスをキャッシュ
        this.fontMetrics = {};
    }

    /**
     * フォントメトリクスを測定（高さ、半角幅、全角幅）
     * スタンドアロン対応のため固定値を使用
     * @param {number} fontSize - フォントサイズ
     * @returns {Object} {height, halfWidth, fullWidth}
     */
    measureFontMetrics(fontSize) {
        // キャッシュをチェック
        if (this.fontMetrics[fontSize]) {
            return this.fontMetrics[fontSize];
        }

        // 固定値を使用（等幅フォントの一般的な特性に基づく）
        // 半角文字: fontSize * 0.6
        // 全角文字: fontSize * 1.0
        // 高さ: fontSize * 1.2
        const metrics = {
            height: fontSize * 1.2,
            halfWidth: fontSize * 0.6,
            fullWidth: fontSize * 1.0
        };
        
        // メトリクスをキャッシュ
        this.fontMetrics[fontSize] = metrics;

        return metrics;
    }

    /**
     * テキストとフォントサイズから文字列のピクセル幅を取得
     * スタンドアロン対応のため簡易計算を使用
     * @param {string} text - 測定するテキスト
     * @param {number} fontSize - フォントサイズ
     * @returns {number} テキストのピクセル幅
     */
    getTextWidth(text, fontSize) {
        if (!text || text.length === 0) {
            return 0;
        }

        // 固定値を使用した簡易計算
        // 半角文字: fontSize * 0.6
        // 全角文字: fontSize * 1.0
        const metrics = this.measureFontMetrics(fontSize);
        let width = 0;
        
        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            const charCode = char.charCodeAt(0);
            // 半角文字の判定（ASCII文字、半角カナなど）
            if (charCode <= 0x007F || (charCode >= 0xFF61 && charCode <= 0xFF9F)) {
                width += metrics.halfWidth;
            } else {
                // 全角文字
                width += metrics.fullWidth;
            }
        }
        
        return width;
    }

    /**
     * 日付チャートを追加
     * @returns {DateChart} DateChartインスタンス
     */
    addDateChart() {
        const dateChart = new DateChart(this);
        if (!this.dateCharts) {
            this.dateCharts = [];
        }
        this.dateCharts.push(dateChart);
        return dateChart;
    }

    /**
     * ヒストグラムチャートを追加
     * @returns {HistogramChart} HistogramChartインスタンス
     */
    addHistogram() {
        const histogramChart = new HistogramChart(this);
        if (!this.histogramCharts) {
            this.histogramCharts = [];
        }
        this.histogramCharts.push(histogramChart);
        return histogramChart;
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
        // 既存のSVGを削除（DOMモードの場合のみ）
        if (this.container) {
            const existingSvg = this.container.querySelector('svg');
            if (existingSvg) {
                existingSvg.remove();
            }
        }

        // SVG要素を作成
        const svg = VirtualDOM.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', this.width);
        svg.setAttribute('height', this.height);
        svg.setAttribute('viewBox', `0 0 ${this.width} ${this.height}`);

        // 日本語対応の等幅フォントを設定（style要素を追加）
        const style = VirtualDOM.createElementNS('http://www.w3.org/2000/svg', 'style');
        style.textContent = `
            .chart-text {
                font-family: ${this.fontFamily};
            }
        `;
        svg.appendChild(style);

        // タイトルとサブタイトルを描画
        const fontSize = ChartCanvas.FONT_SIZE_NORMAL;
        const centerX = this.width / 2;
        let yPos = fontSize + 10; // 上から少し下に配置

        // タイトルを描画
        if (this.title) {
            const titleText = VirtualDOM.createElementNS('http://www.w3.org/2000/svg', 'text');
            titleText.setAttribute('class', 'chart-text');
            titleText.setAttribute('x', centerX);
            titleText.setAttribute('y', yPos);
            titleText.setAttribute('text-anchor', 'middle');
            titleText.setAttribute('style', `font-size: ${fontSize}px;`);
            titleText.textContent = this.title;
            svg.appendChild(titleText);
            yPos += fontSize + 5; // タイトルの下にスペース
        }

        // サブタイトルを描画
        if (this.subtitle) {
            const subtitleText = VirtualDOM.createElementNS('http://www.w3.org/2000/svg', 'text');
            subtitleText.setAttribute('class', 'chart-text');
            subtitleText.setAttribute('x', centerX);
            subtitleText.setAttribute('y', yPos);
            subtitleText.setAttribute('text-anchor', 'middle');
            subtitleText.setAttribute('style', `font-size: ${fontSize}px;`);
            subtitleText.textContent = this.subtitle;
            svg.appendChild(subtitleText);
        }

        // 凡例を描画
        this.renderLegend(svg);

        // ヒストグラムがある場合はヒストグラムを描画
        if (this.histogramCharts && this.histogramCharts.length > 0) {
            const plotArea = this.calculateHistogramPlotArea();
            this.renderHistogram(svg, plotArea);
        } else {
            // 日付チャートがある場合は日付チャートを描画
            const plotArea = this.calculatePlotArea();
            if (plotArea) {
                this.renderPlotAreaOrigin(svg, plotArea);
                
                // X軸スケールを描画
                this.renderXAxis(svg, plotArea);
                
                // Y軸スケールを描画
                this.renderYAxis(svg, plotArea);
                
                // 右スケール（副軸）を描画
                this.renderRightYAxis(svg, plotArea);

                // グリッド線を描画（軸の後、データ系列の前）
                this.renderDateChartGrid(svg, plotArea);

                // 棒グラフを描画（先に追加した系列が上に来るように、先に描画する）
                this.renderBars(svg, plotArea);

                // 線グラフを描画（先に追加した系列が上に来るように、後に描画する）
                this.renderLines(svg, plotArea);
            }
        }

        // コンテナに追加（DOMモードの場合のみ）
        if (this.container) {
            this.container.appendChild(svg);
        }
        
        // 現在のSVG要素を保存（後で取得できるように）
        this.currentSvg = svg;
    }

    /**
     * 現在のSVG要素を取得
     * @returns {SVGElement|VirtualSVGElement|null} SVG要素
     */
    getSVGElement() {
        if (this.container) {
            return this.container.querySelector('svg') || this.currentSvg || null;
        }
        return this.currentSvg || null;
    }

    /**
     * SVGを文字列として取得
     * @returns {string} SVGの文字列表現
     */
    getSVGString() {
        const svg = this.getSVGElement();
        if (!svg) {
            return '';
        }
        
        // SVG要素をクローン
        const clonedSvg = svg.cloneNode(true);
        
        // XML文字列に変換
        let svgString;
        if (clonedSvg instanceof VirtualSVGElement) {
            // 仮想DOM要素の場合は直接XML文字列を生成
            svgString = clonedSvg.toXMLString();
        } else if (typeof XMLSerializer !== 'undefined') {
            // ブラウザ環境の場合はXMLSerializerを使用
            const serializer = new XMLSerializer();
            svgString = serializer.serializeToString(clonedSvg);
        } else {
            // フォールバック: 手動でXML文字列を構築
            svgString = clonedSvg.outerHTML || '';
        }
        
        // XML宣言を追加
        return '<?xml version="1.0" encoding="UTF-8"?>\n' + svgString;
    }

    /**
     * SVGをファイルとしてダウンロード
     * @param {string} filename - ファイル名（デフォルト: 'chart.svg'）
     */
    downloadSVG(filename = 'chart.svg') {
        const svgString = this.getSVGString();
        if (!svgString) {
            console.error('SVGが生成されていません。先にrender()を呼び出してください。');
            return;
        }
        
        // Blobを作成
        const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        
        // ダウンロードリンクを作成してクリック
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // URLを解放
        URL.revokeObjectURL(url);
    }

    /**
     * SVGをサーバーにアップロード
     * @param {string} filename - サーバー側のファイル名（デフォルト: 'chart.svg'）
     * @returns {Promise<string>} アップロード結果のメッセージ
     */
    async uploadSVG(filename = 'chart.svg') {
        const svgString = this.getSVGString();
        if (!svgString) {
            throw new Error('SVGが生成されていません。先にrender()を呼び出してください。');
        }
        
        // FormDataを作成
        const formData = new FormData();
        const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
        formData.append('svg', blob, filename);
        
        // サーバーにアップロード
        const response = await fetch('/upload-svg', {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`アップロードに失敗しました: ${response.status} ${errorText}`);
        }
        
        const result = await response.json();
        return result.message || 'アップロード成功';
    }

    /**
     * 数値をフォーマット（カンマ区切りなど）
     * @param {number} value - 数値
     * @param {string} format - フォーマット文字列（例: '#,##0', '#,##0%'）
     * @returns {string} フォーマットされた文字列
     */
    formatNumber(value, format) {
        if (format === undefined || format === '') {
            return String(value);
        }

        // パーセンテージの場合
        if (format.includes('%')) {
            const percentage = value * 100;
            const numFormat = format.replace('%', '');
            const formatted = this.formatNumber(percentage, numFormat);
            return formatted + '%';
        }

        // カンマ区切りの処理
        let formatted = String(Math.round(value));
        
        // カンマ区切りを追加
        if (format.includes(',')) {
            formatted = formatted.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        }

        return formatted;
    }

    /**
     * 描画エリアの位置を計算
     * @returns {Object} 描画エリアの情報 {originX, originY, topRightX, topRightY, width, height}
     */
    calculatePlotArea() {
        if (!this.dateCharts || this.dateCharts.length === 0) {
            return null;
        }

        const fontSize = ChartCanvas.FONT_SIZE_NORMAL;
        const metrics = this.measureFontMetrics(fontSize);
        const leftMargin = 20;
        const bottomMargin = 20;
        const topMargin = 10; // 上のマージン（タイトルの上）
        const tickLineLength = 5;
        const titleMargin = 20; // 描画エリアとタイトルのマージン
        const legendMargin = 20; // 凡例の右マージン
        const legendScaleGap = 20; // 凡例とスケールの間のマージン

        const dateChart = this.dateCharts[0];

        // Y軸のスケールを取得
        const primaryScale = dateChart.calculateYAxisScale(false);
        const secondaryScale = dateChart.secondAxis ? 
            dateChart.calculateYAxisScale(true) : null;

        // Y軸のラベルをフォーマットして最大幅を計算
        let maxYLabelWidth = 0;
        const yAxisFormat = dateChart.yAxisFormat || '#,##0';
        
        for (const label of primaryScale.labels) {
            const formatted = this.formatNumber(label, yAxisFormat);
            const width = this.getTextWidth(formatted, fontSize);
            if (width > maxYLabelWidth) {
                maxYLabelWidth = width;
            }
        }

        // 副軸がある場合も考慮
        let maxRightScaleLabelWidth = 0;
        if (secondaryScale) {
            const secondAxisFormat = dateChart.secondAxisFormat || '#,##0';
            for (const label of secondaryScale.labels) {
                const formatted = this.formatNumber(label, secondAxisFormat);
                const width = this.getTextWidth(formatted, fontSize);
                if (width > maxRightScaleLabelWidth) {
                    maxRightScaleLabelWidth = width;
                }
            }
        }

        // 凡例の左端を計算
        const legendFontSize = ChartCanvas.FONT_SIZE_NORMAL;
        const legendItemHeight = 25;
        const iconWidth = 30;
        const iconLabelGap = 10;
        const legendPadding = 10;
        
        // 凡例項目を収集して最大ラベル幅を計算
        const legendItems = [];
        for (const dc of this.dateCharts) {
            for (const line of dc.lines) {
                if (line.title) legendItems.push({ title: line.title });
            }
            for (const bar of dc.bars) {
                if (bar.title) legendItems.push({ title: bar.title });
            }
        }
        
        let maxLegendLabelWidth = 0;
        for (const item of legendItems) {
            const width = this.getTextWidth(item.title, legendFontSize);
            if (width > maxLegendLabelWidth) {
                maxLegendLabelWidth = width;
            }
        }
        
        const legendAreaWidth = iconWidth + iconLabelGap + maxLegendLabelWidth + legendPadding * 2;
        const legendLeftX = this.width - legendAreaWidth - legendMargin;

        // 原点のX座標: 左端から、左マージン + 最大ラベル幅 + 目盛り線の長さ
        const originX = leftMargin + maxYLabelWidth + tickLineLength;

        // 原点のY座標: 下端から、下マージン + 文字の高さ（1行目）+ 文字の高さ（2行目）+ ラベルと目盛り線の間隔 + 目盛り線の高さ
        const labelMargin = 5; // ラベルと目盛り線の間隔
        const originY = this.height - bottomMargin - metrics.height * 2 - labelMargin - tickLineLength;

        // 右上(1,1)のX座標を計算
        let topRightX;
        if (secondaryScale) {
            // 右スケールがある場合: 凡例の左端 - 凡例とスケールの間のマージン - 右スケールの最大ラベル幅 - 目盛り線の長さ
            topRightX = legendLeftX - legendScaleGap - maxRightScaleLabelWidth - tickLineLength;
        } else {
            // 右スケールがない場合: 凡例の左端 - 凡例の左のマージン
            topRightX = legendLeftX - legendMargin;
        }

        // 右上(1,1)のY座標を計算
        // 上のマージン + タイトル文字の高さ + サブタイトル文字の高さ + 描画エリアとタイトルのマージン
        let topRightY = topMargin;
        if (this.title) {
            topRightY += metrics.height;
            if (this.subtitle) {
                topRightY += fontSize + 5; // タイトルとサブタイトルの間隔（fontSize + 5px）
            }
        }
        if (this.subtitle && !this.title) {
            topRightY += metrics.height;
        }
        topRightY += titleMargin;

        return {
            originX,
            originY,
            topRightX,
            topRightY,
            width: topRightX - originX,
            height: originY - topRightY
        };
    }

    /**
     * 描画エリアの原点と右上を計算（バツは描画しない）
     * @param {SVGElement} svg - SVG要素
     * @param {Object} plotArea - 描画エリアの情報
     */
    renderPlotAreaOrigin(svg, plotArea) {
        // バツの描画は削除
    }

    /**
     * 日付文字列（YYYYMMDD形式）をDateオブジェクトに変換
     * @param {string} dateStr - 日付文字列（'YYYYMMDD'形式）
     * @returns {Date} Dateオブジェクト
     */
    parseDateToDate(dateStr) {
        const year = parseInt(dateStr.substring(0, 4), 10);
        const month = parseInt(dateStr.substring(4, 6), 10) - 1; // 月は0始まり
        const day = parseInt(dateStr.substring(6, 8), 10);
        return new Date(year, month, day);
    }

    /**
     * 日付が日曜日かどうかを判定
     * @param {string} dateStr - 日付文字列（'YYYYMMDD'形式）
     * @returns {boolean} 日曜日の場合true
     */
    isSunday(dateStr) {
        const date = this.parseDateToDate(dateStr);
        return date.getDay() === 0; // 0が日曜日
    }

    /**
     * 日付が月初の1日かどうかを判定
     * @param {string} dateStr - 日付文字列（'YYYYMMDD'形式）
     * @returns {boolean} 月初の1日の場合true
     */
    isFirstDayOfMonth(dateStr) {
        const day = dateStr.substring(6, 8);
        return day === '01';
    }

    /**
     * 日付文字列（YYYYMMDD形式）をyyyy/MM/dd形式に変換
     * @param {string} dateStr - 日付文字列（'YYYYMMDD'形式）
     * @returns {string} yyyy/MM/dd形式の日付文字列
     */
    formatDateToYYYYMMDD(dateStr) {
        // YYYY-MM-DD形式またはYYYY/MM/DD形式の場合は正規化
        let normalized = dateStr;
        if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
            normalized = dateStr.replace(/-/g, '');
        } else if (dateStr.match(/^\d{4}\/\d{2}\/\d{2}$/)) {
            normalized = dateStr.replace(/\//g, '');
        }
        
        // YYYYMMDD形式を期待
        if (normalized.match(/^\d{8}$/)) {
            const year = normalized.substring(0, 4);
            const month = normalized.substring(4, 6);
            const day = normalized.substring(6, 8);
            return `${year}/${month}/${day}`;
        }
        
        // フォールバック: そのまま返す
        return dateStr;
    }

    /**
     * 3ヶ月データ用に表示する日付をフィルタリング
     * @param {string[]} sortedDates - ソート済みの日付配列
     * @returns {string[]} フィルタリングされた日付配列
     */
    filterDatesForThreeMonths(sortedDates) {
        if (sortedDates.length === 0) {
            return [];
        }

        const filteredDates = [];
        const firstDate = sortedDates[0];
        const lastDate = sortedDates[sortedDates.length - 1];

        // 最初の日は必ず追加
        filteredDates.push(firstDate);

        // 中間の日付をフィルタリング
        for (let i = 1; i < sortedDates.length - 1; i++) {
            const date = sortedDates[i];
            // 月初の1日または日曜日の場合は追加
            if (this.isFirstDayOfMonth(date) || this.isSunday(date)) {
                filteredDates.push(date);
            }
        }

        // 最後の日は必ず追加（最初の日と同じでない場合）
        if (lastDate !== firstDate) {
            filteredDates.push(lastDate);
        }

        return filteredDates;
    }

    /**
     * 1年データ用に表示する日付をフィルタリング
     * @param {string[]} sortedDates - ソート済みの日付配列
     * @returns {string[]} フィルタリングされた日付配列
     */
    filterDatesForOneYear(sortedDates) {
        if (sortedDates.length === 0) {
            return [];
        }

        const filteredDates = [];
        const firstDate = sortedDates[0];
        const lastDate = sortedDates[sortedDates.length - 1];

        // 最初の日は必ず追加
        filteredDates.push(firstDate);

        // 中間の日付をフィルタリング
        for (let i = 1; i < sortedDates.length - 1; i++) {
            const date = sortedDates[i];
            // 月初の1日のみを追加（月毎）
            if (this.isFirstDayOfMonth(date)) {
                filteredDates.push(date);
            }
        }

        // 最後の日は必ず追加（最初の日と同じでない場合）
        if (lastDate !== firstDate) {
            filteredDates.push(lastDate);
        }

        return filteredDates;
    }

    /**
     * X軸スケールを描画
     * @param {SVGElement} svg - SVG要素
     * @param {Object} plotArea - 描画エリアの情報
     */
    renderXAxis(svg, plotArea) {
        if (!plotArea || !this.dateCharts || this.dateCharts.length === 0) {
            return;
        }

        const dateChart = this.dateCharts[0];
        const tickLineLength = 5; // 目盛り線の長さ
        const fontSize = ChartCanvas.FONT_SIZE_SMALL;
        const labelMargin = 5; // ラベルと目盛り線の間隔

        // X軸の線を描画: (0,0)から(1,0)へ
        const xAxisLine = VirtualDOM.createElementNS('http://www.w3.org/2000/svg', 'line');
        xAxisLine.setAttribute('x1', plotArea.originX);
        xAxisLine.setAttribute('y1', plotArea.originY);
        xAxisLine.setAttribute('x2', plotArea.topRightX);
        xAxisLine.setAttribute('y2', plotArea.originY);
        xAxisLine.setAttribute('stroke', '#000');
        xAxisLine.setAttribute('stroke-width', '1');
        svg.appendChild(xAxisLine);

        // X軸のスケールラベルを計算（すべての系列から日付を収集）
        const dateSet = new Set();
        for (const line of dateChart.lines) {
            for (const item of line.data) {
                dateSet.add(item.date);
            }
        }
        for (const bar of dateChart.bars) {
            for (const item of bar.data) {
                dateSet.add(item.date);
            }
        }

        if (dateSet.size === 0) {
            return; // データがない場合は何も描画しない
        }

        // 日付をソート
        const sortedDates = Array.from(dateSet).sort();

        // 各ラベルの位置を計算して目盛り線を描画
        const minDate = sortedDates[0];
        const maxDate = sortedDates[sortedDates.length - 1];
        const minDateValue = this.parseDate(minDate);
        const maxDateValue = this.parseDate(maxDate);
        const dateRange = maxDateValue - minDateValue;
        
        // 日付の範囲を拡張して、最初と最後の日付に余裕を持たせる
        // 最初の日付の0.5日前から最後の日付の0.5日後までの範囲でマッピング
        const extendedMinDateValue = minDateValue - 0.5;
        const extendedMaxDateValue = maxDateValue + 0.5;
        const extendedDateRange = extendedMaxDateValue - extendedMinDateValue;

        // データの期間に応じてフィルタリング
        let datesToRender = sortedDates;
        if (dateRange >= 60 && dateRange <= 120) {
            // 3ヶ月データ（60日〜120日）の場合は月初の1日と日曜日を表示
            datesToRender = this.filterDatesForThreeMonths(sortedDates);
        } else if (dateRange > 120) {
            // 1年データ（120日超）の場合は月初の1日のみを表示（月毎）
            datesToRender = this.filterDatesForOneYear(sortedDates);
        }

        // 各日付ごとに目盛り線とラベルを描画
        let prevYear = '';
        let prevMonth = '';

        for (let i = 0; i < datesToRender.length; i++) {
            const date = datesToRender[i];
            const dateValue = this.parseDate(date);
            
            // 日付をYYYYMMDD形式に正規化
            let normalizedDate = date;
            if (date.match(/^\d{4}-\d{2}-\d{2}$/)) {
                normalizedDate = date.replace(/-/g, '');
            } else if (date.match(/^\d{4}\/\d{2}\/\d{2}$/)) {
                normalizedDate = date.replace(/\//g, '');
            }
            
            const year = normalizedDate.substring(0, 4);
            const month = normalizedDate.substring(4, 6);
            const day = normalizedDate.substring(6, 8);
            
            // 描画エリア内での位置を計算（拡張された範囲で0.0から1.0の範囲）
            const ratio = extendedDateRange > 0 ? (dateValue - extendedMinDateValue) / extendedDateRange : 0;
            
            // 実際のX座標を計算
            const x = plotArea.originX + ratio * plotArea.width;

            // 目盛り線を描画
            const tickLine = VirtualDOM.createElementNS('http://www.w3.org/2000/svg', 'line');
            tickLine.setAttribute('x1', x);
            tickLine.setAttribute('y1', plotArea.originY);
            tickLine.setAttribute('x2', x);
            tickLine.setAttribute('y2', plotArea.originY + tickLineLength);
            tickLine.setAttribute('stroke', '#000');
            tickLine.setAttribute('stroke-width', '1');
            svg.appendChild(tickLine);

            // ラベルを描画
            let firstLineText = day; // 1段目: 常に日付のみ
            let secondLineText = ''; // 2段目: 最初、年・月の変わり目のみ

            if (i === 0) {
                // 最初の日付: 2段目に年/月/日
                secondLineText = `${year}/${month}/${day}`;
            } else {
                // 年が変わった場合: 2段目に年/月/日
                if (year !== prevYear) {
                    secondLineText = `${year}/${month}/${day}`;
                }
                // 月が変わった場合: 2段目に月/日
                else if (month !== prevMonth) {
                    secondLineText = `${month}/${day}`;
                }
                // 同じ年・月の場合: 2段目は何も書かない
            }

            // 1段目（日付のみ）を描画
            const firstLineElement = VirtualDOM.createElementNS('http://www.w3.org/2000/svg', 'text');
            firstLineElement.setAttribute('class', 'chart-text');
            firstLineElement.setAttribute('x', x);
            firstLineElement.setAttribute('y', plotArea.originY + tickLineLength + labelMargin + fontSize);
            firstLineElement.setAttribute('text-anchor', 'middle');
            firstLineElement.setAttribute('style', `font-size: ${fontSize}px;`);
            firstLineElement.textContent = firstLineText;
            svg.appendChild(firstLineElement);

            // 2段目（年/月/日または月/日）を描画（変わり目と最初のみ）
            if (secondLineText) {
                const secondLineElement = VirtualDOM.createElementNS('http://www.w3.org/2000/svg', 'text');
                secondLineElement.setAttribute('class', 'chart-text');
                secondLineElement.setAttribute('x', x);
                secondLineElement.setAttribute('y', plotArea.originY + tickLineLength + labelMargin + fontSize * 2);
                secondLineElement.setAttribute('text-anchor', 'middle');
                secondLineElement.setAttribute('style', `font-size: ${fontSize}px;`);
                secondLineElement.textContent = secondLineText;
                svg.appendChild(secondLineElement);
            }

            prevYear = year;
            prevMonth = month;
        }
    }

    /**
     * Y軸スケールを描画
     * @param {SVGElement} svg - SVG要素
     * @param {Object} plotArea - 描画エリアの情報
     */
    renderYAxis(svg, plotArea) {
        if (!plotArea || !this.dateCharts || this.dateCharts.length === 0) {
            return;
        }

        const dateChart = this.dateCharts[0];
        const tickLineLength = 5; // 目盛り線の長さ
        const fontSize = ChartCanvas.FONT_SIZE_SMALL;
        const labelMargin = 5; // ラベルと目盛り線の間隔

        // Y軸の線を描画: (0,0)から(0,1)へ
        const yAxisLine = VirtualDOM.createElementNS('http://www.w3.org/2000/svg', 'line');
        yAxisLine.setAttribute('x1', plotArea.originX);
        yAxisLine.setAttribute('y1', plotArea.originY);
        yAxisLine.setAttribute('x2', plotArea.originX);
        yAxisLine.setAttribute('y2', plotArea.topRightY);
        yAxisLine.setAttribute('stroke', '#000');
        yAxisLine.setAttribute('stroke-width', '1');
        svg.appendChild(yAxisLine);

        // Y軸のスケールを取得（主軸）
        const primaryScale = dateChart.calculateYAxisScale(false);
        const yAxisFormat = dateChart.yAxisFormat || '#,##0';
        const plotHeight = plotArea.height;

        // 各ラベルの位置を計算して目盛り線とラベルを描画
        for (const labelValue of primaryScale.labels) {
            // ラベルの値を0からmaxまでの範囲で正規化（0.0から1.0）
            const ratio = primaryScale.max > 0 ? labelValue / primaryScale.max : 0;
            
            // 実際のY座標を計算（下から上に向かって）
            // 原点が下なので、1.0 - ratioで反転
            const y = plotArea.originY - ratio * plotHeight;

            // 目盛り線を描画（Y軸の左側に短い線）
            const tickLine = VirtualDOM.createElementNS('http://www.w3.org/2000/svg', 'line');
            tickLine.setAttribute('x1', plotArea.originX);
            tickLine.setAttribute('y1', y);
            tickLine.setAttribute('x2', plotArea.originX - tickLineLength);
            tickLine.setAttribute('y2', y);
            tickLine.setAttribute('stroke', '#000');
            tickLine.setAttribute('stroke-width', '1');
            svg.appendChild(tickLine);

            // ラベルを描画（目盛り線の左側）
            const formattedLabel = this.formatNumber(labelValue, yAxisFormat);
            const labelText = VirtualDOM.createElementNS('http://www.w3.org/2000/svg', 'text');
            labelText.setAttribute('class', 'chart-text');
            labelText.setAttribute('x', plotArea.originX - tickLineLength - labelMargin);
            labelText.setAttribute('y', y);
            labelText.setAttribute('text-anchor', 'end');
            labelText.setAttribute('dominant-baseline', 'middle');
            labelText.setAttribute('style', `font-size: ${fontSize}px;`);
            labelText.textContent = formattedLabel;
            svg.appendChild(labelText);
        }

        // Y軸の単位を表示（(0,1)の上の延長線上、サブタイトルと同じY座標）
        if (dateChart.yAxisScale) {
            // サブタイトルのY座標を計算
            const topMargin = 10;
            let subtitleY = fontSize + topMargin;
            if (this.title) {
                subtitleY += fontSize + 5;
            }

            const unitText = VirtualDOM.createElementNS('http://www.w3.org/2000/svg', 'text');
            unitText.setAttribute('class', 'chart-text');
            unitText.setAttribute('x', plotArea.originX);
            unitText.setAttribute('y', subtitleY);
            unitText.setAttribute('text-anchor', 'end');
            unitText.setAttribute('style', `font-size: ${fontSize}px;`);
            unitText.textContent = `(${dateChart.yAxisScale})`;
            svg.appendChild(unitText);
        }
    }

    /**
     * 右スケール（副軸）を描画
     * @param {SVGElement} svg - SVG要素
     * @param {Object} plotArea - 描画エリアの情報
     */
    renderRightYAxis(svg, plotArea) {
        if (!plotArea || !this.dateCharts || this.dateCharts.length === 0) {
            return;
        }

        const dateChart = this.dateCharts[0];
        
        // 副軸が有効でない場合は何も描画しない
        if (!dateChart.secondAxis) {
            return;
        }

        const tickLineLength = 5; // 目盛り線の長さ
        const fontSize = ChartCanvas.FONT_SIZE_SMALL;
        const labelMargin = 5; // ラベルと目盛り線の間隔

        // 右スケールの線を描画: (1,0)から(1,1)へ
        const rightYAxisLine = VirtualDOM.createElementNS('http://www.w3.org/2000/svg', 'line');
        rightYAxisLine.setAttribute('x1', plotArea.topRightX);
        rightYAxisLine.setAttribute('y1', plotArea.originY);
        rightYAxisLine.setAttribute('x2', plotArea.topRightX);
        rightYAxisLine.setAttribute('y2', plotArea.topRightY);
        rightYAxisLine.setAttribute('stroke', '#000');
        rightYAxisLine.setAttribute('stroke-width', '1');
        svg.appendChild(rightYAxisLine);

        // 右スケールのスケールを取得（副軸）
        const secondaryScale = dateChart.calculateYAxisScale(true);
        const secondAxisFormat = dateChart.secondAxisFormat || '#,##0';
        const plotHeight = plotArea.height;

        // 各ラベルの位置を計算して目盛り線とラベルを描画
        for (const labelValue of secondaryScale.labels) {
            // ラベルの値を0からmaxまでの範囲で正規化（0.0から1.0）
            const ratio = secondaryScale.max > 0 ? labelValue / secondaryScale.max : 0;
            
            // 実際のY座標を計算（下から上に向かって）
            // 原点が下なので、1.0 - ratioで反転
            const y = plotArea.originY - ratio * plotHeight;

            // 目盛り線を描画（右スケールの右側に短い線）
            const tickLine = VirtualDOM.createElementNS('http://www.w3.org/2000/svg', 'line');
            tickLine.setAttribute('x1', plotArea.topRightX);
            tickLine.setAttribute('y1', y);
            tickLine.setAttribute('x2', plotArea.topRightX + tickLineLength);
            tickLine.setAttribute('y2', y);
            tickLine.setAttribute('stroke', '#000');
            tickLine.setAttribute('stroke-width', '1');
            svg.appendChild(tickLine);

            // ラベルを描画（目盛り線の右側）
            const formattedLabel = this.formatNumber(labelValue, secondAxisFormat);
            const labelText = VirtualDOM.createElementNS('http://www.w3.org/2000/svg', 'text');
            labelText.setAttribute('class', 'chart-text');
            labelText.setAttribute('x', plotArea.topRightX + tickLineLength + labelMargin);
            labelText.setAttribute('y', y);
            labelText.setAttribute('text-anchor', 'start');
            labelText.setAttribute('dominant-baseline', 'middle');
            labelText.setAttribute('style', `font-size: ${fontSize}px;`);
            labelText.textContent = formattedLabel;
            svg.appendChild(labelText);
        }

        // 右スケールの単位を表示（(1,1)の上の延長線上、サブタイトルと同じY座標）
        if (dateChart.secondAxisScale) {
            // サブタイトルのY座標を計算
            const topMargin = 10;
            let subtitleY = fontSize + topMargin;
            if (this.title) {
                subtitleY += fontSize + 5;
            }

            const unitText = VirtualDOM.createElementNS('http://www.w3.org/2000/svg', 'text');
            unitText.setAttribute('class', 'chart-text');
            unitText.setAttribute('x', plotArea.topRightX);
            unitText.setAttribute('y', subtitleY);
            unitText.setAttribute('text-anchor', 'start');
            unitText.setAttribute('style', `font-size: ${fontSize}px;`);
            unitText.textContent = `(${dateChart.secondAxisScale})`;
            svg.appendChild(unitText);
        }
    }

    /**
     * DateChartのグリッド線を描画
     * @param {SVGElement} svg - SVG要素
     * @param {Object} plotArea - 描画エリアの情報
     */
    renderDateChartGrid(svg, plotArea) {
        if (!plotArea || !this.dateCharts || this.dateCharts.length === 0) {
            return;
        }

        const dateChart = this.dateCharts[0];
        const gridColor = '#e0e0e0'; // 薄いグレー
        const gridStrokeWidth = 1;
        const gridDashArray = '2,2'; // 破線

        // X軸のグリッド線を描画
        if (dateChart.xGrid) {
            // X軸のスケールラベル位置にグリッド線を描画
            const dateSet = new Set();
            for (const line of dateChart.lines) {
                for (const item of line.data) {
                    dateSet.add(item.date);
                }
            }
            for (const bar of dateChart.bars) {
                for (const item of bar.data) {
                    dateSet.add(item.date);
                }
            }

            if (dateSet.size > 0) {
                const sortedDates = Array.from(dateSet).sort();
                const minDate = sortedDates[0];
                const maxDate = sortedDates[sortedDates.length - 1];
                const minDateValue = this.parseDate(minDate);
                const maxDateValue = this.parseDate(maxDate);
                const extendedMinDateValue = minDateValue - 0.5;
                const extendedMaxDateValue = maxDateValue + 0.5;
                const extendedDateRange = extendedMaxDateValue - extendedMinDateValue;

                // データの期間に応じてフィルタリング
                const dateRange = maxDateValue - minDateValue;
                let datesToRender = sortedDates;
                if (dateRange >= 60 && dateRange <= 120) {
                    datesToRender = this.filterDatesForThreeMonths(sortedDates);
                } else if (dateRange > 120) {
                    datesToRender = this.filterDatesForOneYear(sortedDates);
                }

                for (const date of datesToRender) {
                    const dateValue = this.parseDate(date);
                    const ratio = extendedDateRange > 0 ? (dateValue - extendedMinDateValue) / extendedDateRange : 0;
                    const x = plotArea.originX + ratio * plotArea.width;

                    const gridLine = VirtualDOM.createElementNS('http://www.w3.org/2000/svg', 'line');
                    gridLine.setAttribute('x1', x);
                    gridLine.setAttribute('y1', plotArea.topRightY);
                    gridLine.setAttribute('x2', x);
                    gridLine.setAttribute('y2', plotArea.originY);
                    gridLine.setAttribute('stroke', gridColor);
                    gridLine.setAttribute('stroke-width', gridStrokeWidth);
                    gridLine.setAttribute('stroke-dasharray', gridDashArray);
                    svg.appendChild(gridLine);
                }
            }
        }

        // Y軸のグリッド線を描画（主軸）
        if (dateChart.yGrid) {
            const primaryScale = dateChart.calculateYAxisScale(false);
            const plotHeight = plotArea.height;

            for (const labelValue of primaryScale.labels) {
                const ratio = primaryScale.max > 0 ? labelValue / primaryScale.max : 0;
                const y = plotArea.originY - ratio * plotHeight;

                const gridLine = VirtualDOM.createElementNS('http://www.w3.org/2000/svg', 'line');
                gridLine.setAttribute('x1', plotArea.originX);
                gridLine.setAttribute('y1', y);
                gridLine.setAttribute('x2', plotArea.topRightX);
                gridLine.setAttribute('y2', y);
                gridLine.setAttribute('stroke', gridColor);
                gridLine.setAttribute('stroke-width', gridStrokeWidth);
                gridLine.setAttribute('stroke-dasharray', gridDashArray);
                svg.appendChild(gridLine);
            }
        }
    }

    /**
     * 日付をグループ化（連続する日付をグループ化）
     * @param {string[]} dates - 日付の配列（'YYYYMMDD'形式）
     * @returns {Array<Array<string>>} グループ化された日付の配列
     */
    groupDates(dates) {
        if (dates.length === 0) {
            return [];
        }

        // 最初の日付を正規化
        let firstDate = dates[0];
        if (firstDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
            firstDate = firstDate.replace(/-/g, '');
        } else if (firstDate.match(/^\d{4}\/\d{2}\/\d{2}$/)) {
            firstDate = firstDate.replace(/\//g, '');
        }
        
        const groups = [];
        let currentGroup = [dates[0]];
        let currentYear = firstDate.substring(0, 4);
        let currentMonth = firstDate.substring(4, 6);

        for (let i = 1; i < dates.length; i++) {
            const date = dates[i];
            // 日付を正規化
            let normalizedDate = date;
            if (date.match(/^\d{4}-\d{2}-\d{2}$/)) {
                normalizedDate = date.replace(/-/g, '');
            } else if (date.match(/^\d{4}\/\d{2}\/\d{2}$/)) {
                normalizedDate = date.replace(/\//g, '');
            }
            const year = normalizedDate.substring(0, 4);
            const month = normalizedDate.substring(4, 6);
            const prevDate = dates[i - 1];
            const prevDateValue = this.parseDate(prevDate);
            const currentDateValue = this.parseDate(date);

            // 連続する日付で、同じ年・月の場合は同じグループ
            if (currentDateValue === prevDateValue + 1 && year === currentYear && month === currentMonth) {
                currentGroup.push(date);
            } else {
                // 新しいグループを開始
                groups.push(currentGroup);
                currentGroup = [date];
                currentYear = year;
                currentMonth = month;
            }
        }
        groups.push(currentGroup);

        return groups;
    }

    /**
     * 日付グループのラベルを2段でフォーマット
     * @param {string[]} dateGroup - 日付のグループ（'YYYYMMDD'形式の配列）
     * @returns {Object} {firstLine: string, secondLine: string} 1行目と2行目のラベル
     */
    formatDateGroupLabelTwoLines(dateGroup) {
        if (dateGroup.length === 0) {
            return { firstLine: '', secondLine: '' };
        }

        const firstDate = dateGroup[0];
        // 日付を正規化
        let normalizedFirstDate = firstDate;
        if (firstDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
            normalizedFirstDate = firstDate.replace(/-/g, '');
        } else if (firstDate.match(/^\d{4}\/\d{2}\/\d{2}$/)) {
            normalizedFirstDate = firstDate.replace(/\//g, '');
        }
        const firstYear = normalizedFirstDate.substring(0, 4);
        const firstMonth = normalizedFirstDate.substring(4, 6);
        const firstDay = normalizedFirstDate.substring(6, 8);

        // 1行目: 最初の日付の年/月/日
        const firstLine = `${firstYear}/${firstMonth}/${firstDay}`;
        
        // 2行目: 2つ目以降の日付（日付のみ2桁）
        let secondLine = '';
        let prevYear = firstYear;
        let prevMonth = firstMonth;

        for (let i = 1; i < dateGroup.length; i++) {
            const date = dateGroup[i];
            // 日付を正規化
            let normalizedDate = date;
            if (date.match(/^\d{4}-\d{2}-\d{2}$/)) {
                normalizedDate = date.replace(/-/g, '');
            } else if (date.match(/^\d{4}\/\d{2}\/\d{2}$/)) {
                normalizedDate = date.replace(/\//g, '');
            }
            const year = normalizedDate.substring(0, 4);
            const month = normalizedDate.substring(4, 6);
            const day = normalizedDate.substring(6, 8);

            // 年が変わった場合
            if (year !== prevYear) {
                secondLine += (secondLine ? ' ' : '') + `${year}/${month}/${day}`;
                prevYear = year;
                prevMonth = month;
            }
            // 月が変わった場合
            else if (month !== prevMonth) {
                secondLine += (secondLine ? ' ' : '') + `${month}/${day}`;
                prevMonth = month;
            }
            // 同じ年・月の場合: 日付だけ2桁
            else {
                secondLine += (secondLine ? ' ' : '') + day;
            }
        }

        return { firstLine, secondLine };
    }

    /**
     * 日付文字列（YYYYMMDD形式）を数値に変換
     * @param {string} dateStr - 日付文字列（'YYYYMMDD'形式）
     * @returns {number} 日付の数値表現（基準日からの経過日数）
     */
    parseDate(dateStr) {
        // 日付をYYYYMMDD形式に正規化
        let normalizedDate = dateStr;
        if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
            normalizedDate = dateStr.replace(/-/g, '');
        } else if (dateStr.match(/^\d{4}\/\d{2}\/\d{2}$/)) {
            normalizedDate = dateStr.replace(/\//g, '');
        }
        
        // YYYYMMDD形式を解析
        const year = parseInt(normalizedDate.substring(0, 4), 10);
        const month = parseInt(normalizedDate.substring(4, 6), 10) - 1; // 月は0始まり
        const day = parseInt(normalizedDate.substring(6, 8), 10);
        
        // Dateオブジェクトを作成して、基準日（2000-01-01）からの経過日数に変換
        const date = new Date(year, month, day);
        const baseDate = new Date(2000, 0, 1); // 基準日: 2000-01-01
        const diffTime = date.getTime() - baseDate.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        
        return diffDays;
    }

    /**
     * 線グラフを描画
     * @param {SVGElement} svg - SVG要素
     * @param {Object} plotArea - 描画エリアの情報
     */
    renderLines(svg, plotArea) {
        if (!plotArea || !this.dateCharts || this.dateCharts.length === 0) {
            return;
        }

        const dateChart = this.dateCharts[0];

        // すべての日付を収集してX軸の範囲を計算
        const dateSet = new Set();
        for (const line of dateChart.lines) {
            for (const item of line.data) {
                dateSet.add(item.date);
            }
        }

        if (dateSet.size === 0) {
            return; // データがない場合は何も描画しない
        }

        // 日付をソート
        const sortedDates = Array.from(dateSet).sort();
        const minDate = sortedDates[0];
        const maxDate = sortedDates[sortedDates.length - 1];
        const minDateValue = this.parseDate(minDate);
        const maxDateValue = this.parseDate(maxDate);

        // 日付の範囲を拡張して、最初と最後の日付に余裕を持たせる
        const extendedMinDateValue = minDateValue - 0.5;
        const extendedMaxDateValue = maxDateValue + 0.5;
        const extendedDateRange = extendedMaxDateValue - extendedMinDateValue;

        // Y軸のスケールを取得（主軸と副軸）
        const primaryScale = dateChart.calculateYAxisScale(false);
        const secondaryScale = dateChart.secondAxis ? 
            dateChart.calculateYAxisScale(true) : null;

        // 線グラフを正順に描画（先に追加した系列が上に来るようにする）
        // つまり、lines配列を正順に処理する
        for (let i = 0; i < dateChart.lines.length; i++) {
            const line = dateChart.lines[i];
            
            if (line.data.length === 0) {
                continue; // データがない場合はスキップ
            }

            // データを日付でソート
            const sortedData = [...line.data].sort((a, b) => 
                a.date.localeCompare(b.date)
            );

            // データポイントの座標を計算
            const points = [];
            const scale = line.secondAxis ? secondaryScale : primaryScale;
            
            if (!scale || scale.max === 0) {
                continue; // スケールが無効な場合はスキップ
            }

            for (const item of sortedData) {
                const dateValue = this.parseDate(item.date);
                
                // X座標を計算（拡張された範囲で0.0から1.0の範囲）
                const xRatio = extendedDateRange > 0 ? 
                    (dateValue - extendedMinDateValue) / extendedDateRange : 0;
                const x = plotArea.originX + xRatio * plotArea.width;

                // Y座標を計算（値から0.0から1.0の範囲に正規化）
                const yRatio = scale.max > 0 ? item.value / scale.max : 0;
                // 原点が下なので、1.0 - yRatioで反転
                const y = plotArea.originY - yRatio * plotArea.height;

                points.push({ x, y, comment: item.tooltip || '', value: item.value, date: item.date });
            }

            if (points.length === 0) {
                continue; // ポイントがない場合はスキップ
            }

            // 線を描画（path要素を使用）
            const path = VirtualDOM.createElementNS('http://www.w3.org/2000/svg', 'path');
            
            // パスデータを生成
            let pathData = `M ${points[0].x} ${points[0].y}`;
            for (let j = 1; j < points.length; j++) {
                pathData += ` L ${points[j].x} ${points[j].y}`;
            }
            path.setAttribute('d', pathData);
            path.setAttribute('stroke', line.color || 'black');
            path.setAttribute('stroke-width', line.lineWidth || 2);
            path.setAttribute('fill', 'none');

            // 線の種類を設定
            if (line.lineType === 'dashed') {
                path.setAttribute('stroke-dasharray', '5,5');
            } else if (line.lineType === 'dotted') {
                path.setAttribute('stroke-dasharray', '2,2');
            }
            // 'solid'の場合は何も設定しない（デフォルト）

            svg.appendChild(path);

            // マーカーを描画（showMarkersがtrueの場合）
            if (line.showMarkers) {
                for (let j = 0; j < points.length; j++) {
                    const point = points[j];
                    this.renderMarker(svg, point.x, point.y, point.value, point.date, point.comment, line.color || 'black', dateChart);
                }
            }

            // コメントを描画
            for (let j = 0; j < points.length; j++) {
                const point = points[j];
                if (point.comment) {
                    this.renderComment(svg, plotArea, point.x, point.y, point.comment, line.color || 'black');
                }
            }
        }
    }

    /**
     * 棒グラフを描画
     * @param {SVGElement} svg - SVG要素
     * @param {Object} plotArea - 描画エリアの情報
     */
    renderBars(svg, plotArea) {
        if (!plotArea || !this.dateCharts || this.dateCharts.length === 0) {
            return;
        }

        const dateChart = this.dateCharts[0];

        // すべての日付を収集してX軸の範囲を計算
        const dateSet = new Set();
        for (const bar of dateChart.bars) {
            for (const item of bar.data) {
                dateSet.add(item.date);
            }
        }
        for (const line of dateChart.lines) {
            for (const item of line.data) {
                dateSet.add(item.date);
            }
        }

        if (dateSet.size === 0) {
            return; // データがない場合は何も描画しない
        }

        // 日付をソート
        const sortedDates = Array.from(dateSet).sort();
        const minDate = sortedDates[0];
        const maxDate = sortedDates[sortedDates.length - 1];
        const minDateValue = this.parseDate(minDate);
        const maxDateValue = this.parseDate(maxDate);

        // 日付の範囲を拡張して、最初と最後の日付に余裕を持たせる
        const extendedMinDateValue = minDateValue - 0.5;
        const extendedMaxDateValue = maxDateValue + 0.5;
        const extendedDateRange = extendedMaxDateValue - extendedMinDateValue;

        // Y軸のスケールを取得（主軸と副軸）
        const primaryScale = dateChart.calculateYAxisScale(false);
        const secondaryScale = dateChart.secondAxis ? 
            dateChart.calculateYAxisScale(true) : null;

        // 棒グラフの幅を計算（日付の間隔に基づく）
        const barWidth = plotArea.width / sortedDates.length * 0.6; // 60%の幅を使用

        // 棒グラフを正順に描画（先に追加した系列が上に来るようにする）
        // つまり、bars配列を正順に処理する
        for (let i = 0; i < dateChart.bars.length; i++) {
            const bar = dateChart.bars[i];
            
            if (bar.data.length === 0) {
                continue; // データがない場合はスキップ
            }

            // データを日付でソート
            const sortedData = [...bar.data].sort((a, b) => 
                a.date.localeCompare(b.date)
            );

            // スケールを取得
            const scale = bar.secondAxis ? secondaryScale : primaryScale;
            
            if (!scale || scale.max === 0) {
                continue; // スケールが無効な場合はスキップ
            }

            // 各データポイントに対して棒を描画
            for (const item of sortedData) {
                const dateValue = this.parseDate(item.date);
                
                // X座標を計算（拡張された範囲で0.0から1.0の範囲）
                const xRatio = extendedDateRange > 0 ? 
                    (dateValue - extendedMinDateValue) / extendedDateRange : 0;
                const x = plotArea.originX + xRatio * plotArea.width;

                // Y座標を計算（値から0.0から1.0の範囲に正規化）
                const yRatio = scale.max > 0 ? item.value / scale.max : 0;
                // 原点が下なので、1.0 - yRatioで反転
                const barTop = plotArea.originY - yRatio * plotArea.height;
                const barBottom = plotArea.originY;

                // 棒の幅の中心をX座標にする
                const barLeft = x - barWidth / 2;
                const barRight = x + barWidth / 2;

                // 棒を描画（rect要素を使用）
                const rect = VirtualDOM.createElementNS('http://www.w3.org/2000/svg', 'rect');
                rect.setAttribute('x', barLeft);
                rect.setAttribute('y', barTop);
                rect.setAttribute('width', barWidth);
                rect.setAttribute('height', barBottom - barTop);
                rect.setAttribute('fill', bar.color || 'blue');
                rect.setAttribute('fill-opacity', '0.7'); // 内部の透明度を70%に設定
                rect.setAttribute('stroke', 'none');

                // ツールチップを追加（2行表示）
                const title = VirtualDOM.createElementNS('http://www.w3.org/2000/svg', 'title');
                const yAxisFormat = bar.secondAxis ? (dateChart.secondAxisFormat || '#,##0') : (dateChart.yAxisFormat || '#,##0');
                const formattedValue = this.formatNumber(item.value, yAxisFormat);
                const formattedDate = this.formatDateToYYYYMMDD(item.date);
                
                // 1行目: 日付、2行目: 値（コメントがある場合は値 + コメント）
                let tooltipText = formattedDate;
                if (item.tooltip && item.tooltip.trim()) {
                    tooltipText += '\n' + formattedValue + ' ' + item.tooltip.trim();
                } else {
                    tooltipText += '\n' + formattedValue;
                }
                
                title.textContent = tooltipText;
                rect.appendChild(title);

                svg.appendChild(rect);

                // コメントを描画
                if (item.tooltip) {
                    this.renderComment(svg, plotArea, x, barTop, item.tooltip, bar.color || 'blue');
                }
            }
        }
    }

    /**
     * マーカーを描画（線グラフのデータポイントに丸を表示）
     * @param {SVGElement} svg - SVG要素
     * @param {number} x - X座標
     * @param {number} y - Y座標（データポイントの位置）
     * @param {number} value - 値
     * @param {string} date - 日付（'YYYYMMDD'形式）
     * @param {string} comment - コメントテキスト（オプション）
     * @param {string} color - 系列の色
     * @param {DateChart} dateChart - DateChartインスタンス（フォーマット用）
     */
    renderMarker(svg, x, y, value, date, comment, color, dateChart) {
        const markerRadius = 4; // マーカーの半径
        
        // マーカーの円を描画
        const circle = VirtualDOM.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', x);
        circle.setAttribute('cy', y);
        circle.setAttribute('r', markerRadius);
        circle.setAttribute('fill', color);
        circle.setAttribute('stroke', '#fff');
        circle.setAttribute('stroke-width', '1');
        
        // マウスオーバーでツールチップを表示（2行表示）
        const title = VirtualDOM.createElementNS('http://www.w3.org/2000/svg', 'title');
        const yAxisFormat = dateChart.yAxisFormat || '#,##0';
        const formattedValue = this.formatNumber(value, yAxisFormat);
        const formattedDate = this.formatDateToYYYYMMDD(date);
        
        // 1行目: 日付、2行目: 値（コメントがある場合は値 + コメント）
        let tooltipText = formattedDate;
        if (comment && comment.trim()) {
            tooltipText += '\n' + formattedValue + ' ' + comment.trim();
        } else {
            tooltipText += '\n' + formattedValue;
        }
        
        title.textContent = tooltipText;
        circle.appendChild(title);
        
        svg.appendChild(circle);
    }

    /**
     * コメントを描画
     * @param {SVGElement} svg - SVG要素
     * @param {Object} plotArea - 描画エリアの情報
     * @param {number} x - X座標
     * @param {number} y - Y座標（データポイントの位置）
     * @param {string} comment - コメントテキスト
     * @param {string} color - 系列の色
     */
    renderComment(svg, plotArea, x, y, comment, color) {
        if (!comment || comment.trim() === '') {
            return;
        }

        const fontSize = ChartCanvas.FONT_SIZE_SMALL;
        const metrics = this.measureFontMetrics(fontSize);
        const commentText = comment.trim();
        const textWidth = this.getTextWidth(commentText, fontSize);
        
        // コメントの位置を決定
        // デフォルトはデータポイントの上
        let commentX = x;
        let commentY = y - 10; // データポイントから10px上
        
        // グラフの上端に近い場合は下に表示
        const topMargin = 10;
        if (commentY < plotArea.topRightY + topMargin) {
            commentY = y + metrics.height + 5; // データポイントから下に表示
        }
        
        // グラフの左端に近い場合は右にずらす
        const leftMargin = 5;
        if (commentX < plotArea.originX + leftMargin) {
            commentX = plotArea.originX + leftMargin;
        }
        
        // グラフの右端に近い場合は左にずらす
        const rightMargin = 5;
        if (commentX + textWidth > plotArea.topRightX - rightMargin) {
            commentX = plotArea.topRightX - rightMargin - textWidth;
        }
        
        // コメントテキストを描画
        const commentElement = VirtualDOM.createElementNS('http://www.w3.org/2000/svg', 'text');
        commentElement.setAttribute('class', 'chart-text');
        commentElement.setAttribute('x', commentX);
        commentElement.setAttribute('y', commentY);
        commentElement.setAttribute('text-anchor', 'middle');
        commentElement.setAttribute('dominant-baseline', 'hanging');
        commentElement.setAttribute('style', `font-size: ${fontSize}px; fill: ${color};`);
        commentElement.textContent = commentText;
        svg.appendChild(commentElement);
    }

    /**
     * 凡例を描画
     * @param {SVGElement} svg - SVG要素
     */
    renderLegend(svg) {
        if (!this.dateCharts || this.dateCharts.length === 0) {
            return;
        }

        // 凡例の設定
        const legendFontSize = ChartCanvas.FONT_SIZE_NORMAL;
        const legendMargin = 20; // 右端からのマージン
        const legendStartY = 60; // 上から60px
        const legendItemHeight = 25; // 各凡例項目の高さ
        const iconWidth = 30; // アイコンの幅
        const iconHeight = 3; // 線グラフのアイコンの高さ（線の太さ）
        const iconBarWidth = 20; // 棒グラフのアイコンの幅
        const iconBarHeight = 12; // 棒グラフのアイコンの高さ
        const iconLabelGap = 10; // アイコンとラベルの間隔
        const legendPadding = 10; // 凡例エリアのパディング

        const metrics = this.measureFontMetrics(legendFontSize);

        // すべてのDateChartから系列を収集
        const legendItems = [];
        for (const dateChart of this.dateCharts) {
            // 線グラフの系列
            for (const line of dateChart.lines) {
                if (line.title) {
                    legendItems.push({
                        type: 'line',
                        title: line.title,
                        color: line.color,
                        lineWidth: line.lineWidth || 2,
                        lineType: line.lineType || 'solid'
                    });
                }
            }
            // 棒グラフの系列
            for (const bar of dateChart.bars) {
                if (bar.title) {
                    legendItems.push({
                        type: 'bar',
                        title: bar.title,
                        color: bar.color
                    });
                }
            }
        }

        if (legendItems.length === 0) {
            return; // 凡例項目がない場合は何も描画しない
        }

        // 最大のラベル幅を計算
        let maxLabelWidth = 0;
        for (const item of legendItems) {
            const labelWidth = this.getTextWidth(item.title, legendFontSize);
            if (labelWidth > maxLabelWidth) {
                maxLabelWidth = labelWidth;
            }
        }

        // 凡例エリアのサイズを計算
        const legendAreaWidth = iconWidth + iconLabelGap + maxLabelWidth + legendPadding * 2;
        const legendAreaHeight = legendItems.length * legendItemHeight + legendPadding * 2;
        // 右寄せ: 右端からマージン分引いた位置から凡例エリアの幅を引く
        const legendAreaX = this.width - legendAreaWidth - legendMargin;
        const legendAreaY = legendStartY - legendPadding;
        // 凡例項目の開始X位置（パディングを考慮）
        const legendX = legendAreaX + legendPadding;

        // 凡例項目を描画
        let currentY = legendStartY;
        for (const item of legendItems) {
            const iconX = legendX;
            const iconY = currentY - iconHeight / 2;

            if (item.type === 'line') {
                // 線グラフのアイコンを描画
                const line = VirtualDOM.createElementNS('http://www.w3.org/2000/svg', 'line');
                line.setAttribute('x1', iconX);
                line.setAttribute('y1', iconY);
                line.setAttribute('x2', iconX + iconWidth);
                line.setAttribute('y2', iconY);
                line.setAttribute('stroke', item.color);
                line.setAttribute('stroke-width', item.lineWidth);
                
                // 線の種類を設定
                if (item.lineType === 'dashed') {
                    line.setAttribute('stroke-dasharray', '5,5');
                } else if (item.lineType === 'dotted') {
                    line.setAttribute('stroke-dasharray', '2,2');
                }
                
                svg.appendChild(line);
            } else if (item.type === 'bar') {
                // 棒グラフのアイコンを描画
                const rect = VirtualDOM.createElementNS('http://www.w3.org/2000/svg', 'rect');
                rect.setAttribute('x', iconX);
                rect.setAttribute('y', iconY - iconBarHeight / 2);
                rect.setAttribute('width', iconBarWidth);
                rect.setAttribute('height', iconBarHeight);
                rect.setAttribute('fill', item.color);
                rect.setAttribute('stroke', 'none');
                svg.appendChild(rect);
            }

            // ラベルを描画
            const labelX = iconX + iconWidth + iconLabelGap;
            const labelY = currentY;
            const labelText = VirtualDOM.createElementNS('http://www.w3.org/2000/svg', 'text');
            labelText.setAttribute('class', 'chart-text');
            labelText.setAttribute('x', labelX);
            labelText.setAttribute('y', labelY);
            labelText.setAttribute('style', `font-size: ${legendFontSize}px;`);
            labelText.textContent = item.title;
            svg.appendChild(labelText);

            currentY += legendItemHeight;
        }
    }

    /**
     * ヒストグラム用の描画エリアを計算
     * @returns {Object} 描画エリアの情報
     */
    calculateHistogramPlotArea() {
        if (!this.histogramCharts || this.histogramCharts.length === 0) {
            return null;
        }

        const histogramChart = this.histogramCharts[0];
        const fontSize = ChartCanvas.FONT_SIZE_NORMAL;
        const metrics = this.measureFontMetrics(fontSize);
        const leftMargin = 20;
        const bottomMargin = 20;
        const topMargin = 10;
        const tickLineLength = 5;
        const titleMargin = 20;
        const legendMargin = 20;
        const legendScaleGap = 20;

        // データの範囲を取得
        const rawDataRange = histogramChart.getDataRange();
        const bins = histogramChart.calculateBins(rawDataRange.min, rawDataRange.max);
        
        // X軸スケールに基づいたデータ範囲を使用
        const dataRange = {
            min: bins.xAxisScale.minTickValue,
            max: bins.xAxisScale.maxTickValue
        };

        // Y軸のスケールを計算（頻度の最大値を取得）
        let maxFrequency = 0;
        for (const series of histogramChart.series) {
            const frequencies = histogramChart.binData(series.data, bins.bins);
            const seriesMax = Math.max(...frequencies, 0);
            if (seriesMax > maxFrequency) {
                maxFrequency = seriesMax;
            }
        }

        // Y軸のスケールを計算
        const yAxisScale = this.calculateYAxisScaleForHistogram(maxFrequency);
        const yAxisFormat = histogramChart.yAxisFormat || '#,##0';

        // Y軸のラベルの最大幅を計算
        let maxYLabelWidth = 0;
        for (const label of yAxisScale.labels) {
            const formatted = this.formatNumber(label, yAxisFormat);
            const width = this.getTextWidth(formatted, fontSize);
            if (width > maxYLabelWidth) {
                maxYLabelWidth = width;
            }
        }

        // 凡例の計算（ヒストグラム用）
        const legendItems = [];
        for (const hc of this.histogramCharts) {
            for (const series of hc.series) {
                if (series.title) {
                    legendItems.push({
                        type: 'histogram',
                        title: series.title,
                        color: series.color,
                        opacity: series.opacity
                    });
                }
            }
        }

        const legendFontSize = ChartCanvas.FONT_SIZE_NORMAL;
        const legendItemHeight = 25;
        const iconWidth = 20;
        const iconLabelGap = 10;
        const legendPadding = 10;

        let maxLegendLabelWidth = 0;
        for (const item of legendItems) {
            const width = this.getTextWidth(item.title, legendFontSize);
            if (width > maxLegendLabelWidth) {
                maxLegendLabelWidth = width;
            }
        }

        const legendAreaWidth = iconWidth + iconLabelGap + maxLegendLabelWidth + legendPadding * 2;
        const legendLeftX = this.width - legendAreaWidth - legendMargin;

        // 原点のX座標
        const originX = leftMargin + maxYLabelWidth + tickLineLength;

        // 原点のY座標
        const labelMargin = 5;
        const originY = this.height - bottomMargin - metrics.height * 2 - labelMargin - tickLineLength;

        // 右上のX座標
        const topRightX = legendLeftX - legendMargin;

        // 右上のY座標
        let topRightY = topMargin;
        if (this.title) {
            topRightY += metrics.height;
            if (this.subtitle) {
                topRightY += fontSize + 5;
            }
        }
        topRightY += titleMargin;

        return {
            originX,
            originY,
            topRightX,
            topRightY,
            dataRange,
            bins: bins.bins,
            binWidth: bins.binWidth,
            xAxisScale: bins.xAxisScale,
            yAxisScale,
            yAxisFormat
        };
    }

    /**
     * ヒストグラム用のY軸スケールを計算
     * @param {number} maxValue - 最大値
     * @returns {Object} {max, tickCount, labels}
     */
    calculateYAxisScaleForHistogram(maxValue) {
        if (maxValue === 0) {
            return { max: 10, tickCount: 6, labels: [0, 2, 4, 6, 8, 10] };
        }

        // 適切な間隔を計算
        const magnitude = Math.pow(10, Math.floor(Math.log10(maxValue)));
        const normalized = maxValue / magnitude;

        let tickInterval;
        if (normalized <= 1) {
            tickInterval = magnitude / 5;
        } else if (normalized <= 2) {
            tickInterval = magnitude / 5;
        } else if (normalized <= 5) {
            tickInterval = magnitude / 5;
        } else {
            tickInterval = magnitude / 5;
        }

        const maxTickValue = Math.ceil(maxValue / tickInterval) * tickInterval;
        const labels = [];
        let currentValue = 0;
        while (currentValue <= maxTickValue) {
            labels.push(currentValue);
            currentValue += tickInterval;
        }

        return {
            max: maxTickValue,
            tickCount: labels.length,
            labels
        };
    }

    /**
     * ヒストグラムを描画
     * @param {SVGElement} svg - SVG要素
     * @param {Object} plotArea - 描画エリアの情報
     */
    renderHistogram(svg, plotArea) {
        if (!plotArea || !this.histogramCharts || this.histogramCharts.length === 0) {
            return;
        }

        const histogramChart = this.histogramCharts[0];
        const fontSize = ChartCanvas.FONT_SIZE_NORMAL;
        const metrics = this.measureFontMetrics(fontSize);
        const tickLineLength = 5;
        const labelMargin = 5;

        // 描画エリアのサイズを計算
        const plotWidth = plotArea.topRightX - plotArea.originX;
        const plotHeight = plotArea.originY - plotArea.topRightY;

        // X軸とY軸を描画
        this.renderHistogramAxes(svg, plotArea, plotWidth, plotHeight);

        // グリッド線を描画（軸の後、データ系列の前）
        this.renderHistogramGrid(svg, plotArea, plotWidth, plotHeight);

        // 各系列のヒストグラムを描画
        let seriesIndex = 0;
        for (const series of histogramChart.series) {
            if (series.data.length === 0) {
                seriesIndex++;
                continue;
            }

            // binDataMapを更新するために系列を渡す
            const frequencies = histogramChart.binData(series.data, plotArea.bins, series);
            const maxFrequency = Math.max(...plotArea.yAxisScale.labels);
            const dataRange = plotArea.dataRange.max - plotArea.dataRange.min;

            if (histogramChart.curveMode) {
                // ベジェ曲線モード
                const points = histogramChart.calculateCurvePoints(frequencies, plotArea.bins);
                const pathString = histogramChart.generateBezierPath(
                    points,
                    plotArea.dataRange.min,
                    plotArea.dataRange.max,
                    plotWidth,
                    plotHeight,
                    plotArea.originX,
                    plotArea.originY,
                    maxFrequency
                );

                if (pathString) {
                    const path = VirtualDOM.createElementNS('http://www.w3.org/2000/svg', 'path');
                    path.setAttribute('d', pathString);
                    path.setAttribute('fill', 'none');
                    path.setAttribute('stroke', series.color);
                    path.setAttribute('stroke-width', 2);
                    path.setAttribute('opacity', series.opacity);
                    svg.appendChild(path);
                }
            } else {
                // 棒グラフモード
                const binWidth = plotArea.binWidth;
                for (let i = 0; i < frequencies.length; i++) {
                    const frequency = frequencies[i];
                    if (frequency === 0) continue;

                    const binMin = plotArea.bins[i];
                    const binMax = plotArea.bins[i + 1];

                    // X座標を計算（ビンの左端、X軸スケールに基づく）
                    const xRatio = dataRange > 0 ? (binMin - plotArea.dataRange.min) / dataRange : 0;
                    const x = plotArea.originX + xRatio * plotWidth;

                    // ビンの幅を計算（X軸スケールに基づく）
                    const binWidthRatio = dataRange > 0 ? (binMax - binMin) / dataRange : 0;
                    const barWidth = binWidthRatio * plotWidth;

                    // Y座標を計算（頻度から）
                    const yRatio = frequency / maxFrequency;
                    const barHeight = yRatio * plotHeight;
                    const y = plotArea.originY - barHeight;

                    // 矩形を描画
                    const rect = VirtualDOM.createElementNS('http://www.w3.org/2000/svg', 'rect');
                    rect.setAttribute('x', x);
                    rect.setAttribute('y', y);
                    rect.setAttribute('width', barWidth);
                    rect.setAttribute('height', barHeight);
                    rect.setAttribute('fill', series.color);
                    rect.setAttribute('opacity', series.opacity);
                    rect.setAttribute('stroke', series.color);
                    rect.setAttribute('stroke-width', 0.5);
                    svg.appendChild(rect);
                }
            }
        }
    }

    /**
     * ヒストグラムの軸を描画
     * @param {SVGElement} svg - SVG要素
     * @param {Object} plotArea - 描画エリアの情報
     * @param {number} plotWidth - 描画エリアの幅
     * @param {number} plotHeight - 描画エリアの高さ
     */
    renderHistogramAxes(svg, plotArea, plotWidth, plotHeight) {
        const histogramChart = this.histogramCharts[0];
        const fontSize = ChartCanvas.FONT_SIZE_NORMAL;
        const metrics = this.measureFontMetrics(fontSize);
        const tickLineLength = 5;
        const labelMargin = 5;

        // X軸の線を描画
        const xAxisLine = VirtualDOM.createElementNS('http://www.w3.org/2000/svg', 'line');
        xAxisLine.setAttribute('x1', plotArea.originX);
        xAxisLine.setAttribute('y1', plotArea.originY);
        xAxisLine.setAttribute('x2', plotArea.topRightX);
        xAxisLine.setAttribute('y2', plotArea.originY);
        xAxisLine.setAttribute('stroke', 'black');
        xAxisLine.setAttribute('stroke-width', 1);
        svg.appendChild(xAxisLine);

        // Y軸の線を描画
        const yAxisLine = VirtualDOM.createElementNS('http://www.w3.org/2000/svg', 'line');
        yAxisLine.setAttribute('x1', plotArea.originX);
        yAxisLine.setAttribute('y1', plotArea.originY);
        yAxisLine.setAttribute('x2', plotArea.originX);
        yAxisLine.setAttribute('y2', plotArea.topRightY);
        yAxisLine.setAttribute('stroke', 'black');
        yAxisLine.setAttribute('stroke-width', 1);
        svg.appendChild(yAxisLine);

        // X軸の目盛りとラベルを描画（X軸スケールに基づく）
        const xAxisFormat = histogramChart.xAxisFormat || '#,##0';
        const xAxisScale = plotArea.xAxisScale;
        const dataRange = plotArea.dataRange.max - plotArea.dataRange.min;

        for (const labelValue of xAxisScale.labels) {
            const xRatio = dataRange > 0 ? (labelValue - plotArea.dataRange.min) / dataRange : 0;
            const x = plotArea.originX + xRatio * plotWidth;

            // 目盛り線を描画
            const tickLine = VirtualDOM.createElementNS('http://www.w3.org/2000/svg', 'line');
            tickLine.setAttribute('x1', x);
            tickLine.setAttribute('y1', plotArea.originY);
            tickLine.setAttribute('x2', x);
            tickLine.setAttribute('y2', plotArea.originY + tickLineLength);
            tickLine.setAttribute('stroke', 'black');
            tickLine.setAttribute('stroke-width', 1);
            svg.appendChild(tickLine);

            // ラベルを描画
            const formatted = this.formatNumber(labelValue, xAxisFormat);
            const labelText = VirtualDOM.createElementNS('http://www.w3.org/2000/svg', 'text');
            labelText.setAttribute('class', 'chart-text');
            labelText.setAttribute('x', x);
            labelText.setAttribute('y', plotArea.originY + tickLineLength + labelMargin + metrics.height);
            labelText.setAttribute('text-anchor', 'middle');
            labelText.setAttribute('style', `font-size: ${fontSize}px;`);
            labelText.textContent = formatted;
            svg.appendChild(labelText);
        }

        // Y軸の目盛りとラベルを描画
        const yAxisFormat = plotArea.yAxisFormat;
        for (const label of plotArea.yAxisScale.labels) {
            const yRatio = label / plotArea.yAxisScale.max;
            const y = plotArea.originY - yRatio * plotHeight;

            // 目盛り線を描画
            const tickLine = VirtualDOM.createElementNS('http://www.w3.org/2000/svg', 'line');
            tickLine.setAttribute('x1', plotArea.originX);
            tickLine.setAttribute('y1', y);
            tickLine.setAttribute('x2', plotArea.originX - tickLineLength);
            tickLine.setAttribute('y2', y);
            tickLine.setAttribute('stroke', 'black');
            tickLine.setAttribute('stroke-width', 1);
            svg.appendChild(tickLine);

            // ラベルを描画
            const formatted = this.formatNumber(label, yAxisFormat);
            const labelWidth = this.getTextWidth(formatted, fontSize);
            const labelText = VirtualDOM.createElementNS('http://www.w3.org/2000/svg', 'text');
            labelText.setAttribute('class', 'chart-text');
            labelText.setAttribute('x', plotArea.originX - tickLineLength - labelMargin);
            labelText.setAttribute('y', y);
            labelText.setAttribute('text-anchor', 'end');
            labelText.setAttribute('dominant-baseline', 'middle');
            labelText.setAttribute('style', `font-size: ${fontSize}px;`);
            labelText.textContent = formatted;
            svg.appendChild(labelText);
        }

        // X軸のタイトルを描画
        if (histogramChart.xAxisTitle) {
            const xAxisTitleText = VirtualDOM.createElementNS('http://www.w3.org/2000/svg', 'text');
            xAxisTitleText.setAttribute('class', 'chart-text');
            xAxisTitleText.setAttribute('x', plotArea.originX + plotWidth / 2);
            xAxisTitleText.setAttribute('y', plotArea.originY + tickLineLength + labelMargin + metrics.height * 2 + 10);
            xAxisTitleText.setAttribute('text-anchor', 'middle');
            xAxisTitleText.setAttribute('style', `font-size: ${fontSize}px;`);
            xAxisTitleText.textContent = histogramChart.xAxisTitle;
            svg.appendChild(xAxisTitleText);
        }

        // Y軸のタイトルを描画
        if (histogramChart.yAxisTitle) {
            const yAxisTitleText = VirtualDOM.createElementNS('http://www.w3.org/2000/svg', 'text');
            yAxisTitleText.setAttribute('class', 'chart-text');
            yAxisTitleText.setAttribute('x', plotArea.originX - tickLineLength - labelMargin - 30);
            yAxisTitleText.setAttribute('y', plotArea.topRightY + plotHeight / 2);
            yAxisTitleText.setAttribute('text-anchor', 'middle');
            yAxisTitleText.setAttribute('transform', `rotate(-90 ${plotArea.originX - tickLineLength - labelMargin - 30} ${plotArea.topRightY + plotHeight / 2})`);
            yAxisTitleText.setAttribute('style', `font-size: ${fontSize}px;`);
            yAxisTitleText.textContent = histogramChart.yAxisTitle;
            svg.appendChild(yAxisTitleText);
        }

        // 凡例を描画
        this.renderHistogramLegend(svg);
    }

    /**
     * HistogramChartのグリッド線を描画
     * @param {SVGElement} svg - SVG要素
     * @param {Object} plotArea - 描画エリアの情報
     * @param {number} plotWidth - 描画エリアの幅
     * @param {number} plotHeight - 描画エリアの高さ
     */
    renderHistogramGrid(svg, plotArea, plotWidth, plotHeight) {
        if (!plotArea || !this.histogramCharts || this.histogramCharts.length === 0) {
            return;
        }

        const histogramChart = this.histogramCharts[0];
        const gridColor = '#e0e0e0'; // 薄いグレー
        const gridStrokeWidth = 1;
        const gridDashArray = '2,2'; // 破線

        // X軸のグリッド線を描画
        if (histogramChart.xGrid) {
            const xAxisScale = plotArea.xAxisScale;
            const dataRange = plotArea.dataRange.max - plotArea.dataRange.min;

            for (const labelValue of xAxisScale.labels) {
                const xRatio = dataRange > 0 ? (labelValue - plotArea.dataRange.min) / dataRange : 0;
                const x = plotArea.originX + xRatio * plotWidth;

                const gridLine = VirtualDOM.createElementNS('http://www.w3.org/2000/svg', 'line');
                gridLine.setAttribute('x1', x);
                gridLine.setAttribute('y1', plotArea.topRightY);
                gridLine.setAttribute('x2', x);
                gridLine.setAttribute('y2', plotArea.originY);
                gridLine.setAttribute('stroke', gridColor);
                gridLine.setAttribute('stroke-width', gridStrokeWidth);
                gridLine.setAttribute('stroke-dasharray', gridDashArray);
                svg.appendChild(gridLine);
            }
        }

        // Y軸のグリッド線を描画
        if (histogramChart.yGrid) {
            for (const label of plotArea.yAxisScale.labels) {
                const yRatio = label / plotArea.yAxisScale.max;
                const y = plotArea.originY - yRatio * plotHeight;

                const gridLine = VirtualDOM.createElementNS('http://www.w3.org/2000/svg', 'line');
                gridLine.setAttribute('x1', plotArea.originX);
                gridLine.setAttribute('y1', y);
                gridLine.setAttribute('x2', plotArea.topRightX);
                gridLine.setAttribute('y2', y);
                gridLine.setAttribute('stroke', gridColor);
                gridLine.setAttribute('stroke-width', gridStrokeWidth);
                gridLine.setAttribute('stroke-dasharray', gridDashArray);
                svg.appendChild(gridLine);
            }
        }
    }

    /**
     * ヒストグラムの凡例を描画
     * @param {SVGElement} svg - SVG要素
     */
    renderHistogramLegend(svg) {
        if (!this.histogramCharts || this.histogramCharts.length === 0) {
            return;
        }

        const legendFontSize = ChartCanvas.FONT_SIZE_NORMAL;
        const legendMargin = 20;
        const legendStartY = 60;
        const legendItemHeight = 25;
        const iconWidth = 20;
        const iconHeight = 12;
        const iconLabelGap = 10;
        const legendPadding = 10;

        const metrics = this.measureFontMetrics(legendFontSize);

        // 凡例項目を収集
        const legendItems = [];
        for (const hc of this.histogramCharts) {
            for (const series of hc.series) {
                if (series.title) {
                    legendItems.push({
                        type: 'histogram',
                        title: series.title,
                        color: series.color,
                        opacity: series.opacity
                    });
                }
            }
        }

        if (legendItems.length === 0) {
            return;
        }

        // 最大のラベル幅を計算
        let maxLabelWidth = 0;
        for (const item of legendItems) {
            const labelWidth = this.getTextWidth(item.title, legendFontSize);
            if (labelWidth > maxLabelWidth) {
                maxLabelWidth = labelWidth;
            }
        }

        // 凡例エリアのサイズを計算
        const legendAreaWidth = iconWidth + iconLabelGap + maxLabelWidth + legendPadding * 2;
        const legendAreaX = this.width - legendAreaWidth - legendMargin;
        const legendAreaY = legendStartY - legendPadding;
        const legendX = legendAreaX + legendPadding;

        // 凡例項目を描画
        let currentY = legendStartY;
        for (const item of legendItems) {
            const iconX = legendX;
            const iconY = currentY - iconHeight / 2;

            // ヒストグラムのアイコンを描画
            const rect = VirtualDOM.createElementNS('http://www.w3.org/2000/svg', 'rect');
            rect.setAttribute('x', iconX);
            rect.setAttribute('y', iconY);
            rect.setAttribute('width', iconWidth);
            rect.setAttribute('height', iconHeight);
            rect.setAttribute('fill', item.color);
            rect.setAttribute('opacity', item.opacity);
            rect.setAttribute('stroke', item.color);
            rect.setAttribute('stroke-width', 0.5);
            svg.appendChild(rect);

            // ラベルを描画
            const labelX = iconX + iconWidth + iconLabelGap;
            const labelY = currentY;
            const labelText = VirtualDOM.createElementNS('http://www.w3.org/2000/svg', 'text');
            labelText.setAttribute('class', 'chart-text');
            labelText.setAttribute('x', labelX);
            labelText.setAttribute('y', labelY);
            labelText.setAttribute('style', `font-size: ${legendFontSize}px;`);
            labelText.textContent = item.title;
            svg.appendChild(labelText);

            currentY += legendItemHeight;
        }
    }
}

// グローバルスコープに公開
window.ChartCanvas = ChartCanvas;

