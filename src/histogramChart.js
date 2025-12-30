/**
 * HistogramChart - ヒストグラムチャートクラス
 * データの分布を表示するヒストグラムを管理するクラス
 */
class HistogramChart {
    /**
     * コンストラクタ
     * @param {ChartCanvas} chartCanvas - 親のChartCanvasインスタンス
     */
    constructor(chartCanvas) {
        this.chartCanvas = chartCanvas;
        
        // X軸の設定
        this.xAxisTitle = '';
        this.xAxisFormat = '#,##0';
        
        // Y軸の設定
        this.yAxisTitle = '頻度';
        this.yAxisFormat = '#,##0';
        
        // タイトルとサブタイトル
        this.title = '';
        this.subtitle = '';
        
        // ヒストグラムの設定
        this.binCount = null; // nullの場合は自動計算
        this.binWidth = null; // nullの場合は自動計算
        this.binAlignment = 'left'; // 'left', 'center', 'right'
        this.curveMode = false; // trueの場合、ベジェ曲線で描画
        
        // グリッド線の設定
        this.xGrid = false; // X軸のグリッド線を表示するか（デフォルト: false）
        this.yGrid = false; // Y軸のグリッド線を表示するか（デフォルト: false）
        
        // データ系列を保持（グループ別ヒストグラム対応）
        this.series = [];
    }

    /**
     * ヒストグラム系列を追加
     * @param {Object} options - 系列のオプション
     * @param {string} options.title - 系列のタイトル
     * @param {string} options.color - 棒の色
     * @param {number} options.opacity - 透明度（0.0-1.0、デフォルト: 0.7）
     * @returns {HistogramSeries} HistogramSeriesインスタンス
     */
    addSeries(options = {}) {
        const series = new HistogramSeries(this, options);
        this.series.push(series);
        return series;
    }

    /**
     * TSVローダーを作成（提案1: 生データ形式）
     * @param {string} url - TSVファイルのURL
     * @returns {HistogramTSVLoader} HistogramTSVLoaderインスタンス
     */
    tsvLoader(url) {
        return new HistogramTSVLoader(this, url);
    }

    /**
     * データの範囲を取得
     * @returns {Object} {min, max} データの最小値と最大値
     */
    getDataRange() {
        let min = Infinity;
        let max = -Infinity;

        for (const series of this.series) {
            for (const value of series.data) {
                if (value < min) min = value;
                if (value > max) max = value;
            }
        }

        if (min === Infinity) {
            return { min: 0, max: 100 };
        }

        return { min, max };
    }

    /**
     * X軸のスケールを計算（DateChartのY軸スケール計算と同様のロジック）
     * @param {number} min - データの最小値
     * @param {number} max - データの最大値
     * @returns {Object} {minTickValue, maxTickValue, tickInterval, labels} スケール情報
     */
    calculateXAxisScale(min, max) {
        const range = max - min;

        // ラベル間隔を計算
        let tickInterval;
        let minTickValue;
        let maxTickValue;

        if (range <= 30) {
            // 範囲が30以下の場合: 1刻み
            tickInterval = 1;
            minTickValue = Math.floor(min);
            maxTickValue = Math.ceil(max);
        } else {
            // 範囲が30超の場合: 10の倍数で間隔を調整
            // 適切な間隔を見つける（ラベル数が30個以下になるように）
            const idealTickCount = 10; // 理想的な目盛りの数
            const idealInterval = range / idealTickCount;
            
            // 10のべき乗で丸める
            const magnitude = Math.pow(10, Math.floor(Math.log10(idealInterval)));
            tickInterval = magnitude;
            
            // 間隔が小さすぎる場合は次のレベルに上げる
            if (idealInterval / magnitude > 5) {
                tickInterval = magnitude * 5;
            } else if (idealInterval / magnitude > 2) {
                tickInterval = magnitude * 2;
            }
            
            // 最小値を間隔の倍数に切り下げ、最大値を間隔の倍数に切り上げ
            minTickValue = Math.floor(min / tickInterval) * tickInterval;
            maxTickValue = Math.ceil(max / tickInterval) * tickInterval;
        }

        // ラベルを生成
        const labels = [];
        let currentValue = minTickValue;
        
        while (currentValue <= maxTickValue) {
            labels.push(currentValue);
            currentValue += tickInterval;
        }

        return {
            minTickValue,
            maxTickValue,
            tickInterval,
            labels
        };
    }

    /**
     * ビンの設定を計算
     * @param {number} min - データの最小値
     * @param {number} max - データの最大値
     * @returns {Object} {binCount, binWidth, bins, xAxisScale} ビンの設定
     */
    calculateBins(min, max) {
        // ビン幅またはビン数が指定されている場合はそれを使用
        if (this.binWidth !== null) {
            const binCount = Math.ceil((max - min) / this.binWidth);
            const bins = [];
            for (let i = 0; i <= binCount; i++) {
                bins.push(min + i * this.binWidth);
            }
            // X軸スケールも計算
            const xAxisScale = this.calculateXAxisScale(min, max);
            return { binCount, binWidth: this.binWidth, bins, xAxisScale };
        }

        if (this.binCount !== null) {
            const binWidth = (max - min) / this.binCount;
            const bins = [];
            for (let i = 0; i <= this.binCount; i++) {
                bins.push(min + i * binWidth);
            }
            // X軸スケールも計算
            const xAxisScale = this.calculateXAxisScale(min, max);
            return { binCount: this.binCount, binWidth, bins, xAxisScale };
        }

        // 自動計算: X軸スケールを計算してから、ビンを設定
        const xAxisScale = this.calculateXAxisScale(min, max);
        
        // Sturgesの公式でビン数を計算
        let totalDataCount = 0;
        for (const series of this.series) {
            totalDataCount += series.data.length;
        }

        if (totalDataCount === 0) {
            // データがない場合、X軸スケールに基づいてビンを設定
            const range = xAxisScale.maxTickValue - xAxisScale.minTickValue;
            const defaultBinCount = Math.min(20, Math.max(10, Math.floor(range / xAxisScale.tickInterval)));
            const binWidth = range / defaultBinCount;
            const bins = [];
            for (let i = 0; i <= defaultBinCount; i++) {
                bins.push(xAxisScale.minTickValue + i * binWidth);
            }
            return { binCount: defaultBinCount, binWidth, bins, xAxisScale };
        }

        // Sturgesの公式でビン数を計算
        const binCount = Math.ceil(Math.log2(totalDataCount) + 1);
        
        // X軸スケールの範囲内でビンを設定
        const range = xAxisScale.maxTickValue - xAxisScale.minTickValue;
        const binWidth = range / binCount;
        const bins = [];
        for (let i = 0; i <= binCount; i++) {
            bins.push(xAxisScale.minTickValue + i * binWidth);
        }

        return { binCount, binWidth, bins, xAxisScale };
    }

    /**
     * データをビンに分類
     * @param {Array<number>} data - データ配列
     * @param {Array<number>} bins - ビンの境界値配列
     * @returns {Array<number>} 各ビンの頻度
     */
    binData(data, bins) {
        const frequencies = new Array(bins.length - 1).fill(0);

        for (const value of data) {
            // ビンに分類
            for (let i = 0; i < bins.length - 1; i++) {
                if (value >= bins[i] && (i === bins.length - 2 ? value <= bins[i + 1] : value < bins[i + 1])) {
                    frequencies[i]++;
                    break;
                }
            }
        }

        return frequencies;
    }

    /**
     * ベジェ曲線のポイントを計算
     * @param {Array<number>} frequencies - 各ビンの頻度
     * @param {Array<number>} bins - ビンの境界値配列
     * @returns {Array<Object>} 曲線のポイント配列 [{x, y}, ...]
     */
    calculateCurvePoints(frequencies, bins) {
        const points = [];
        
        // 各ビンの中心点と頻度からポイントを生成
        for (let i = 0; i < frequencies.length; i++) {
            const binMin = bins[i];
            const binMax = bins[i + 1];
            const binCenter = (binMin + binMax) / 2;
            const frequency = frequencies[i];
            
            points.push({
                x: binCenter,
                y: frequency
            });
        }
        
        return points;
    }

    /**
     * ベジェ曲線のパスを生成（Cubic Bezier）
     * @param {Array<Object>} points - 曲線のポイント配列 [{x, y}, ...]
     * @param {number} dataRangeMin - データ範囲の最小値
     * @param {number} dataRangeMax - データ範囲の最大値
     * @param {number} plotWidth - 描画エリアの幅
     * @param {number} plotHeight - 描画エリアの高さ
     * @param {number} originX - 原点のX座標
     * @param {number} originY - 原点のY座標
     * @param {number} maxFrequency - 最大頻度
     * @returns {string} SVGパス文字列
     */
    generateBezierPath(points, dataRangeMin, dataRangeMax, plotWidth, plotHeight, originX, originY, maxFrequency) {
        if (points.length === 0) return '';
        
        const dataRange = dataRangeMax - dataRangeMin;
        let path = '';
        
        // 最初のポイントに移動
        const firstPoint = points[0];
        const firstXRatio = dataRange > 0 ? (firstPoint.x - dataRangeMin) / dataRange : 0;
        const firstX = originX + firstXRatio * plotWidth;
        const firstYRatio = maxFrequency > 0 ? firstPoint.y / maxFrequency : 0;
        const firstY = originY - firstYRatio * plotHeight;
        path += `M ${firstX} ${firstY}`;
        
        if (points.length === 1) {
            return path;
        }
        
        // 各ポイント間をベジェ曲線で結ぶ
        for (let i = 0; i < points.length - 1; i++) {
            const p0 = points[Math.max(0, i - 1)];
            const p1 = points[i];
            const p2 = points[i + 1];
            const p3 = points[Math.min(points.length - 1, i + 2)];
            
            // 現在のポイントの座標
            const x1Ratio = dataRange > 0 ? (p1.x - dataRangeMin) / dataRange : 0;
            const x1 = originX + x1Ratio * plotWidth;
            const y1Ratio = maxFrequency > 0 ? p1.y / maxFrequency : 0;
            const y1 = originY - y1Ratio * plotHeight;
            
            // 次のポイントの座標
            const x2Ratio = dataRange > 0 ? (p2.x - dataRangeMin) / dataRange : 0;
            const x2 = originX + x2Ratio * plotWidth;
            const y2Ratio = maxFrequency > 0 ? p2.y / maxFrequency : 0;
            const y2 = originY - y2Ratio * plotHeight;
            
            // 制御点を計算（Catmull-Romスプライン風のベジェ曲線）
            const t = 0.3; // 滑らかさのパラメータ
            const dx1 = (p2.x - p0.x) * t;
            const dy1 = (p2.y - p0.y) * t;
            const dx2 = (p3.x - p1.x) * t;
            const dy2 = (p3.y - p1.y) * t;
            
            // 制御点1（p1から出る方向）
            const cp1xRatio = dataRange > 0 ? (p1.x + dx1 - dataRangeMin) / dataRange : 0;
            const cp1x = originX + cp1xRatio * plotWidth;
            const cp1yRatio = maxFrequency > 0 ? (p1.y + dy1) / maxFrequency : 0;
            const cp1y = originY - cp1yRatio * plotHeight;
            
            // 制御点2（p2に入る方向）
            const cp2xRatio = dataRange > 0 ? (p2.x - dx2 - dataRangeMin) / dataRange : 0;
            const cp2x = originX + cp2xRatio * plotWidth;
            const cp2yRatio = maxFrequency > 0 ? (p2.y - dy2) / maxFrequency : 0;
            const cp2y = originY - cp2yRatio * plotHeight;
            
            // ベジェ曲線を追加
            path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x2} ${y2}`;
        }
        
        return path;
    }
}

/**
 * HistogramSeries - ヒストグラム系列クラス
 */
class HistogramSeries {
    constructor(histogramChart, options = {}) {
        this.histogramChart = histogramChart;
        this.title = options.title || '';
        this.color = options.color || 'blue';
        this.opacity = options.opacity !== undefined ? options.opacity : 0.7;
        this.data = []; // 生データの配列
    }

    /**
     * データを追加
     * @param {number} value - 値
     */
    addData(value) {
        if (typeof value !== 'number' || isNaN(value)) {
            return; // 数値でない場合はスキップ
        }
        this.data.push(value);
    }

    /**
     * 複数のデータを一度に追加
     * @param {Array<number>} values - 値の配列
     */
    addDataArray(values) {
        for (const value of values) {
            this.addData(value);
        }
    }
}

/**
 * HistogramTSVLoader - ヒストグラム用TSVローダークラス（提案1: 生データ形式）
 */
class HistogramTSVLoader {
    constructor(histogramChart, url) {
        this.histogramChart = histogramChart;
        this.url = url;
        this.valueTitle = ''; // 値列の列名
        this.groupTitle = ''; // グループ列の列名（提案3対応用、後で実装）
        
        // 自動モード用の設定
        this.autoMode = false;
        this.seriesColors = ['blue', 'red', 'green', 'orange', 'purple', 'brown', 'pink', 'gray'];
    }

    /**
     * TSVファイルを読み込んでデータを追加
     * @returns {Promise<void>}
     */
    async load() {
        if (!this.valueTitle) {
            throw new Error('valueTitle must be set before calling load()');
        }

        // TSVファイルを読み込む
        const response = await fetch(this.url);
        if (!response.ok) {
            throw new Error(`Failed to load TSV file: ${response.status} ${response.statusText}`);
        }

        const text = await response.text();
        const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);

        if (lines.length === 0) {
            throw new Error('TSV file is empty');
        }

        // ヘッダー行を解析
        const headers = lines[0].split('\t');
        const valueIndex = headers.indexOf(this.valueTitle);
        
        if (valueIndex === -1) {
            throw new Error(`Column "${this.valueTitle}" not found in TSV file`);
        }

        // グループ列のインデックスを取得（提案3対応用、後で実装）
        const groupIndex = this.groupTitle ? headers.indexOf(this.groupTitle) : -1;

        // 提案1: 生データ形式（グループ列がない場合）
        if (groupIndex === -1) {
            // 単一の系列にすべてのデータを追加
            const series = this.histogramChart.addSeries({
                title: this.histogramChart.title || 'データ',
                color: this.seriesColors[0],
                opacity: 0.7
            });

            // データ行を解析
            for (let i = 1; i < lines.length; i++) {
                const columns = lines[i].split('\t');
                if (columns.length <= valueIndex) {
                    continue;
                }

                const valueStr = columns[valueIndex].trim();
                const value = parseFloat(valueStr);
                if (!isNaN(value)) {
                    series.addData(value);
                }
            }

            return;
        }

        // 提案3: グループ別ヒストグラム
        // グループごとのデータを収集
        const dataByGroup = new Map(); // Map<groupName, Array<number>>
        
        for (let i = 1; i < lines.length; i++) {
            const columns = lines[i].split('\t');
            if (columns.length <= valueIndex) {
                continue;
            }

            const valueStr = columns[valueIndex].trim();
            const value = parseFloat(valueStr);
            if (isNaN(value)) {
                continue; // 数値でない場合はスキップ
            }

            const groupName = columns[groupIndex]?.trim() || '';
            if (!groupName) {
                continue; // グループ名がない場合はスキップ
            }

            if (!dataByGroup.has(groupName)) {
                dataByGroup.set(groupName, []);
            }
            dataByGroup.get(groupName).push(value);
        }

        // グループごとに系列を作成してデータを追加
        const sortedGroupNames = Array.from(dataByGroup.keys()).sort();
        let colorIndex = 0;

        for (const groupName of sortedGroupNames) {
            const values = dataByGroup.get(groupName);
            
            // 系列を作成
            const series = this.histogramChart.addSeries({
                title: groupName,
                color: this.seriesColors[colorIndex % this.seriesColors.length],
                opacity: 0.7
            });

            // データを追加
            for (const value of values) {
                series.addData(value);
            }

            colorIndex++;
        }
    }
}

