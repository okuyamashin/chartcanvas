/**
 * DateChart - 日付チャートクラス
 * 時系列データ（X軸が日付）のチャートを管理するクラス
 */
class DateChart {
    /**
     * コンストラクタ
     * @param {ChartCanvas} chartCanvas - 親のChartCanvasインスタンス
     */
    constructor(chartCanvas) {
        this.chartCanvas = chartCanvas;
        
        // X軸の設定
        this.xAxisTitle = '';
        
        // Y軸（主軸）の設定
        this.yAxisTitle = '';
        this.yAxisScale = '';
        this.yAxisFormat = '#,##0';
        
        // 2軸の設定
        this.secondAxis = false;
        this.secondAxisTitle = '';
        this.secondAxisScale = '';
        this.secondAxisFormat = '#,##0';
        
        // データ系列を保持
        this.lines = [];
        this.bars = [];
    }

    /**
     * 線グラフを追加
     * @param {Object} options - 線グラフのオプション
     * @param {string} options.title - 系列のタイトル
     * @param {string} options.color - 線の色
     * @param {number} options.lineWidth - 線の太さ
     * @param {string} options.lineType - 線の種類（'solid', 'dashed', 'dotted'など）
     * @param {boolean} options.secondAxis - 副軸を使用するかどうか
     * @returns {LineSeries} LineSeriesインスタンス
     */
    addLine(options = {}) {
        const line = new LineSeries(this, options);
        this.lines.push(line);
        return line;
    }

    /**
     * 棒グラフを追加
     * @param {Object} options - 棒グラフのオプション
     * @param {string} options.title - 系列のタイトル
     * @param {string} options.color - 棒の色
     * @param {boolean} options.secondAxis - 副軸を使用するかどうか
     * @returns {BarSeries} BarSeriesインスタンス
     */
    addBar(options = {}) {
        const bar = new BarSeries(this, options);
        this.bars.push(bar);
        return bar;
    }

    /**
     * TSVローダーを取得
     * @param {string} url - TSVファイルのURL
     * @returns {TSVLoader} TSVLoaderインスタンス
     */
    tsvLoader(url) {
        return new TSVLoader(this, url);
    }

    /**
     * Y軸のスケールを計算
     * @param {boolean} isSecondAxis - 副軸かどうか
     * @returns {Object} スケール情報 {max, tickCount, labels}
     */
    calculateYAxisScale(isSecondAxis = false) {
        // 対象の系列を取得
        const targetSeries = [];
        
        // 線グラフと棒グラフの両方から対象系列を収集
        for (const line of this.lines) {
            if (line.secondAxis === isSecondAxis && line.data.length > 0) {
                targetSeries.push(line);
            }
        }
        for (const bar of this.bars) {
            if (bar.secondAxis === isSecondAxis && bar.data.length > 0) {
                targetSeries.push(bar);
            }
        }

        if (targetSeries.length === 0) {
            return { max: 0, tickCount: 0, labels: [] };
        }

        // データから最小値と最大値を取得
        let minValue = Infinity;
        let maxValue = -Infinity;

        for (const series of targetSeries) {
            for (const item of series.data) {
                const value = item.value;
                if (value < minValue) minValue = value;
                if (value > maxValue) maxValue = value;
            }
        }

        // データがない場合
        if (minValue === Infinity || maxValue === -Infinity) {
            return { max: 0, tickCount: 0, labels: [] };
        }

        // フォーマットを取得（パーセンテージ判定用）
        const format = isSecondAxis ? this.secondAxisFormat : this.yAxisFormat;
        const isPercentage = format.includes('%');

        // 最小値が0以上の場合: ゼロベース
        const rangeMin = minValue >= 0 ? 0 : minValue;
        const range = maxValue - rangeMin;

        // ラベル間隔を計算
        let tickInterval;
        let maxTickValue;

        if (isPercentage) {
            // パーセンテージの場合: 10%刻み
            tickInterval = 10;
            maxTickValue = Math.ceil(maxValue / 10) * 10;
            if (maxTickValue < 100) maxTickValue = 100;
        } else {
            // 通常の数値の場合
            if (range <= 30) {
                // 範囲が30以下の場合: 1刻み
                tickInterval = 1;
                maxTickValue = Math.ceil(maxValue);
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
                
                // 最大値を間隔の倍数に丸める
                maxTickValue = Math.ceil(maxValue / tickInterval) * tickInterval;
            }
        }

        // ラベルを生成
        const labels = [];
        let currentValue = rangeMin;
        
        while (currentValue <= maxTickValue) {
            labels.push(currentValue);
            currentValue += tickInterval;
        }

        // 最大値が含まれていない場合は追加
        if (labels[labels.length - 1] < maxValue) {
            labels.push(maxTickValue);
        }

        const result = {
            max: maxTickValue,
            tickCount: labels.length,
            labels: labels
        };

        return result;
    }
}

/**
 * LineSeries - 線グラフ系列クラス
 */
class LineSeries {
    constructor(dateChart, options = {}) {
        this.dateChart = dateChart;
        this.title = options.title || '';
        this.color = options.color || 'black';
        this.lineWidth = options.lineWidth || 2;
        this.lineType = options.lineType || 'solid';
        this.secondAxis = options.secondAxis || false;
        this.data = [];
    }

    /**
     * データを追加
     * @param {string} date - 日付（'YYYYMMDD'形式）
     * @param {number} value - 値
     * @param {string} tooltip - ツールチップテキスト（オプション）
     */
    addData(date, value, tooltip = '') {
        this.data.push({ date, value, tooltip });
    }
}

/**
 * BarSeries - 棒グラフ系列クラス
 */
class BarSeries {
    constructor(dateChart, options = {}) {
        this.dateChart = dateChart;
        this.title = options.title || '';
        this.color = options.color || 'blue';
        this.secondAxis = options.secondAxis || false;
        this.data = [];
    }

    /**
     * データを追加
     * @param {string} date - 日付（'YYYYMMDD'形式）
     * @param {number} value - 値
     * @param {string} tooltip - ツールチップテキスト（オプション）
     */
    addData(date, value, tooltip = '') {
        this.data.push({ date, value, tooltip });
    }

    /**
     * 比率データを追加（分子/分母で計算）
     * @param {string} date - 日付（'YYYYMMDD'形式）
     * @param {number} numerator - 分子
     * @param {number} denominator - 分母
     * @param {string} tooltip - ツールチップテキスト（オプション）
     */
    addRatioData(date, numerator, denominator, tooltip = '') {
        const value = denominator !== 0 ? numerator / denominator : 0;
        this.data.push({ date, value, tooltip });
    }
}

/**
 * TSVLoader - TSVローダークラス
 */
class TSVLoader {
    constructor(dateChart, url) {
        this.dateChart = dateChart;
        this.url = url;
        this.dateTitle = '';
        this.groupTitle = '';
        // 系列と列名のマッピング: Map<series, columnName> または Map<groupName, Map<series, columnName>>
        this.seriesMap = new Map();
        this.groupSeriesMap = new Map(); // グループ列がある場合用
    }

    /**
     * 系列と列名を紐づける
     * @param {LineSeries|BarSeries} series - 系列インスタンス
     * @param {string} columnName - TSVファイルの列名
     * @param {string} groupName - グループ名（オプション、グループ列がある場合）
     */
    addSeries(series, columnName, groupName = null) {
        if (groupName !== null && groupName !== undefined) {
            // グループ列がある場合
            if (!this.groupSeriesMap.has(groupName)) {
                this.groupSeriesMap.set(groupName, new Map());
            }
            this.groupSeriesMap.get(groupName).set(series, columnName);
        } else {
            // グループ列がない場合
            this.seriesMap.set(series, columnName);
        }
    }

    /**
     * TSVファイルを読み込む
     * @returns {Promise<void>}
     */
    async load() {
        if (!this.dateTitle) {
            throw new Error('dateTitle must be set');
        }
        if (this.seriesMap.size === 0 && this.groupSeriesMap.size === 0) {
            throw new Error('At least one series must be added using addSeries()');
        }

        // TSVファイルを読み込む
        const response = await fetch(this.url);
        if (!response.ok) {
            throw new Error(`Failed to load TSV file: ${response.status} ${response.statusText}`);
        }
        const text = await response.text();
        const lines = text.split('\n').filter(line => line.trim() !== '');

        if (lines.length === 0) {
            throw new Error('TSV file is empty');
        }

        // ヘッダー行を解析
        const headerLine = lines[0];
        const headers = headerLine.split('\t');
        
        // 列のインデックスを取得
        const dateIndex = headers.indexOf(this.dateTitle);
        if (dateIndex === -1) {
            throw new Error(`Date column "${this.dateTitle}" not found in TSV file`);
        }

        const groupIndex = this.groupTitle ? headers.indexOf(this.groupTitle) : -1;
        if (this.groupTitle && groupIndex === -1) {
            throw new Error(`Group column "${this.groupTitle}" not found in TSV file`);
        }

        // 系列と列名のマッピングから列のインデックスを取得
        const seriesColumnMap = new Map(); // Map<series, columnIndex>
        
        if (groupIndex >= 0) {
            // グループ列がある場合
            for (const [groupName, groupSeriesMap] of this.groupSeriesMap.entries()) {
                for (const [series, columnName] of groupSeriesMap.entries()) {
                    const columnIndex = headers.indexOf(columnName);
                    if (columnIndex === -1) {
                        throw new Error(`Column "${columnName}" not found in TSV file`);
                    }
                    // グループ名と系列の組み合わせをキーにする
                    const key = `${groupName}::${series}`;
                    seriesColumnMap.set(key, { series, columnIndex, groupName });
                }
            }
        } else {
            // グループ列がない場合
            for (const [series, columnName] of this.seriesMap.entries()) {
                const columnIndex = headers.indexOf(columnName);
                if (columnIndex === -1) {
                    throw new Error(`Column "${columnName}" not found in TSV file`);
                }
                seriesColumnMap.set(series, { series, columnIndex });
            }
        }

        // データを読み込んで系列に追加
        const dataBySeries = new Map(); // Map<series, Array<{date, value}>>

        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const columns = line.split('\t');
            const dateStr = columns[dateIndex]?.trim();
            if (!dateStr) continue;

            // 日付形式をYYYYMMDDに変換（YYYY-MM-DD形式をサポート）
            let dateFormatted = dateStr;
            if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
                dateFormatted = dateStr.replace(/-/g, '');
            }

            const groupName = groupIndex >= 0 ? (columns[groupIndex] || '').trim() : null;

            // 各系列に対してデータを追加
            for (const [key, { series, columnIndex, groupName: expectedGroupName }] of seriesColumnMap.entries()) {
                // グループ列がある場合、グループ名が一致する場合のみ処理
                if (groupIndex >= 0 && expectedGroupName !== groupName) {
                    continue;
                }

                if (columns.length <= columnIndex) {
                    continue; // 列数が足りない場合はスキップ
                }

                const valueStr = columns[columnIndex].trim();
                const value = parseFloat(valueStr);
                if (isNaN(value)) {
                    continue; // 数値でない場合はスキップ
                }

                if (!dataBySeries.has(series)) {
                    dataBySeries.set(series, []);
                }
                dataBySeries.get(series).push({ date: dateFormatted, value });
            }
        }

        // 各系列に対してデータを追加（日付でソート）
        for (const [series, data] of dataBySeries.entries()) {
            data.sort((a, b) => a.date.localeCompare(b.date));
            for (const item of data) {
                series.addData(item.date, item.value);
            }
        }
    }
}

// グローバルスコープに公開
window.DateChart = DateChart;
window.LineSeries = LineSeries;
window.BarSeries = BarSeries;
window.TSVLoader = TSVLoader;
