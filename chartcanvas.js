/**
 * ChartCanvas - グラフライブラリ
 * 
 * 日付チャート（線グラフ・棒グラフ）を描画するためのライブラリです。
 * 1つのファイルをロードするだけで使用できます。
 * 
 * @version 1.0.0
 */

function normalizeDate(dateStr, dateFormat = 'auto') {
    if (!dateStr || typeof dateStr !== 'string') {
        return dateStr;
    }
    
    // 既にYYYYMMDD形式の場合
    if (dateStr.match(/^\d{8}$/)) {
        return dateStr;
    }
    
    // 日付形式を自動検出または指定された形式を使用
    let detectedFormat = dateFormat;
    if (dateFormat === 'auto') {
        if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
            detectedFormat = 'YYYY-MM-DD';
        } else if (dateStr.match(/^\d{4}\/\d{2}\/\d{2}$/)) {
            detectedFormat = 'YYYY/MM/DD';
        } else if (dateStr.match(/^\d{8}$/)) {
            detectedFormat = 'YYYYMMDD';
        } else {
            // 形式が不明な場合はそのまま返す
            return dateStr;
        }
    }
    
    // 形式に応じて変換
    if (detectedFormat === 'YYYY-MM-DD') {
        return dateStr.replace(/-/g, '');
    } else if (detectedFormat === 'YYYY/MM/DD') {
        return dateStr.replace(/\//g, '');
    } else if (detectedFormat === 'YYYYMMDD') {
        return dateStr;
    }
    
    // フォールバック: ハイフンとスラッシュを削除
    return dateStr.replace(/[-/]/g, '');
}

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
        this.showMarkers = options.showMarkers || false; // マーカーを表示するかどうか
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
        this.valueTitle = ''; // 値列名（autoMode用）
        this.groupTitle = '';
        this.commentTitle = ''; // コメント列名
        this.seriesType = 'line'; // 系列タイプ（'line' または 'bar'）
        this.seriesOptions = {}; // 系列オプション（lineWidth, lineType, showMarkersなど）
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

        // valueTitleとgroupTitleが設定されている場合、自動的に系列を作成するモード
        const autoMode = this.valueTitle && this.groupTitle;
        
        console.log('TSVLoader.load(): autoMode =', autoMode);
        console.log('TSVLoader.load(): this.valueTitle =', this.valueTitle);
        console.log('TSVLoader.load(): this.groupTitle =', this.groupTitle);

        if (!autoMode && this.seriesMap.size === 0 && this.groupSeriesMap.size === 0) {
            throw new Error('At least one series must be added using addSeries() or set valueTitle and groupTitle for auto mode');
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

        const commentIndex = this.commentTitle ? headers.indexOf(this.commentTitle) : -1;
        const valueIndex = autoMode ? headers.indexOf(this.valueTitle) : -1;
        
        if (autoMode && valueIndex === -1) {
            throw new Error(`Value column "${this.valueTitle}" not found in TSV file`);
        }

        // 系列と列名のマッピングから列のインデックスを取得
        const seriesColumnMap = new Map(); // Map<series, {columnIndex, groupName}>
        
        if (autoMode) {
            // autoModeの場合、グループごとに自動的に系列を作成
            // まず、すべてのグループ名を収集
            const groupNames = new Set();
            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;
                const columns = line.split('\t');
                if (groupIndex >= 0 && columns[groupIndex]) {
                    groupNames.add(columns[groupIndex].trim());
                }
            }
            
            console.log('autoMode: グループ名の収集完了', Array.from(groupNames));
            console.log('autoMode: valueIndex', valueIndex);
            
            // 各グループに対して系列を作成
            const colorPalette = ['red', 'blue', 'green', 'orange', 'purple', 'brown', 'pink', 'gray'];
            let colorIndex = 0;
            
            for (const groupName of groupNames) {
                let series;
                if (this.seriesType === 'bar') {
                    series = this.dateChart.addBar({
                        title: groupName,
                        color: colorPalette[colorIndex % colorPalette.length],
                        ...this.seriesOptions
                    });
                } else {
                    series = this.dateChart.addLine({
                        title: groupName,
                        color: colorPalette[colorIndex % colorPalette.length],
                        ...this.seriesOptions
                    });
                }
                colorIndex++;
                
                console.log('autoMode: 系列を作成', groupName, series);
                
                // 系列を直接キーとして使用し、グループ名は値の一部として保持
                seriesColumnMap.set(series, { columnIndex: valueIndex, groupName });
            }
            
            console.log('autoMode: seriesColumnMap.size', seriesColumnMap.size);
        } else if (groupIndex >= 0) {
            // グループ列がある場合（手動モード）
            for (const [groupName, groupSeriesMap] of this.groupSeriesMap.entries()) {
                for (const [series, columnName] of groupSeriesMap.entries()) {
                    const columnIndex = headers.indexOf(columnName);
                    if (columnIndex === -1) {
                        throw new Error(`Column "${columnName}" not found in TSV file`);
                    }
                    // 系列を直接キーとして使用
                    seriesColumnMap.set(series, { columnIndex, groupName });
                }
            }
        } else {
            // グループ列がない場合（手動モード）
            for (const [series, columnName] of this.seriesMap.entries()) {
                const columnIndex = headers.indexOf(columnName);
                if (columnIndex === -1) {
                    throw new Error(`Column "${columnName}" not found in TSV file`);
                }
                seriesColumnMap.set(series, { columnIndex });
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
            for (const [series, { columnIndex, groupName: expectedGroupName }] of seriesColumnMap.entries()) {
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
                
                // コメントを取得（コメント列が指定されている場合）
                const comment = (commentIndex >= 0 && columns[commentIndex]) ? columns[commentIndex].trim() : '';
                
                dataBySeries.get(series).push({ date: dateFormatted, value, comment });
            }
        }

        // 各系列に対してデータを追加（日付でソート）
        for (const [series, data] of dataBySeries.entries()) {
            data.sort((a, b) => a.date.localeCompare(b.date));
            
            // 日付を補完する（開始日から終了日までのすべての日付に対してデータを作成）
            if (data.length > 0) {
                const filledData = this.fillMissingDates(data);
                for (const item of filledData) {
                    series.addData(item.date, item.value, item.comment || '');
                }
            } else {
                // データがない場合はそのまま追加
                for (const item of data) {
                    series.addData(item.date, item.value, item.comment || '');
                }
            }
        }
    }

    /**
     * 日付の欠損を補完する（開始日から終了日までのすべての日付に対してデータを作成）
     * @param {Array<{date, value, comment}>} data - ソート済みのデータ配列
     * @returns {Array<{date, value, comment}>} 補完されたデータ配列
     */
    fillMissingDates(data) {
        if (data.length === 0) {
            return [];
        }

        const filledData = [];
        const startDate = data[0].date;
        const endDate = data[data.length - 1].date;

        // 開始日と終了日をDateオブジェクトに変換
        const start = this.parseDateToDate(startDate);
        const end = this.parseDateToDate(endDate);

        // データを日付文字列（YYYYMMDD）をキーとするMapに変換
        const dataMap = new Map();
        for (const item of data) {
            dataMap.set(item.date, item);
        }

        // 開始日から終了日までのすべての日付を生成
        const currentDate = new Date(start);
        let lastValue = null;
        let lastComment = '';

        while (currentDate <= end) {
            const dateStr = this.formatDateToString(currentDate);
            const existingData = dataMap.get(dateStr);

            if (existingData) {
                // データが存在する場合はその値を使用
                filledData.push({
                    date: dateStr,
                    value: existingData.value,
                    comment: existingData.comment || ''
                });
                lastValue = existingData.value;
                lastComment = existingData.comment || '';
            } else {
                // データが存在しない場合は前の値を使用（前の値の保持）
                if (lastValue !== null) {
                    filledData.push({
                        date: dateStr,
                        value: lastValue,
                        comment: ''
                    });
                }
            }

            // 次の日へ
            currentDate.setDate(currentDate.getDate() + 1);
        }

        return filledData;
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
     * Dateオブジェクトを日付文字列（YYYYMMDD形式）に変換
     * @param {Date} date - Dateオブジェクト
     * @returns {string} 日付文字列（'YYYYMMDD'形式）
     */
    formatDateToString(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}${month}${day}`;
    }
}

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
        
        // 補助線の設定
        this.showMeanLine = false; // 平均線を表示するか（デフォルト: false）
        this.showMedianLine = false; // 中央値線を表示するか（デフォルト: false）
        this.meanLineColor = 'red'; // 平均線の色（デフォルト: red）
        this.medianLineColor = 'blue'; // 中央値線の色（デフォルト: blue）
        this.meanLineStyle = 'dashed'; // 平均線のスタイル（'solid', 'dashed', 'dotted'）
        this.medianLineStyle = 'dashed'; // 中央値線のスタイル（'solid', 'dashed', 'dotted'）
        this.meanLineWidth = 2; // 平均線の幅（デフォルト: 2）
        this.medianLineWidth = 2; // 中央値線の幅（デフォルト: 2）
        
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
     * すべての系列のデータを結合して取得
     * @returns {Array<number>} すべてのデータ値の配列
     */
    getAllData() {
        const allData = [];
        for (const series of this.series) {
            allData.push(...series.data);
        }
        return allData;
    }

    /**
     * 平均値を計算
     * @returns {number|null} 平均値（データがない場合はnull）
     */
    calculateMean() {
        const allData = this.getAllData();
        if (allData.length === 0) {
            return null;
        }
        const sum = allData.reduce((acc, val) => acc + val, 0);
        return sum / allData.length;
    }

    /**
     * 中央値を計算
     * @returns {number|null} 中央値（データがない場合はnull）
     */
    calculateMedian() {
        const allData = this.getAllData();
        if (allData.length === 0) {
            return null;
        }
        
        // データをソート
        const sorted = [...allData].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        
        if (sorted.length % 2 === 0) {
            // 偶数の場合、中央の2つの値の平均
            return (sorted[mid - 1] + sorted[mid]) / 2;
        } else {
            // 奇数の場合、中央の値
            return sorted[mid];
        }
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
        this.rawData = []; // 全カラムのデータ（オブジェクトの配列、通常モードの場合）
        
        // lazyLoad用のプロパティ
        this.lazyLoad = false; // lazyLoadモードかどうか
        this.tsvLoader = null; // HistogramTSVLoaderへの参照
        this.tsvUrl = ''; // TSVファイルのURL
        this.valueIndex = -1; // 値列のインデックス
        this.groupIndex = -1; // グループ列のインデックス（-1の場合はグループなし）
        this.groupName = ''; // グループ名（グループ別ヒストグラムの場合）
        this.totalDataCount = 0; // 全データ件数（lazyLoadモードの場合）
        this.headers = []; // TSVファイルのヘッダー行（全カラム情報）
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
        this.dataThreshold = 10000; // データ件数の閾値（この値を超えるとlazyLoadモード）
        this.headers = []; // TSVファイルのヘッダー行（全カラム情報）
        
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
        this.headers = headers; // ヘッダー情報を保存
        const valueIndex = headers.indexOf(this.valueTitle);
        
        if (valueIndex === -1) {
            throw new Error(`Column "${this.valueTitle}" not found in TSV file`);
        }

        // グループ列のインデックスを取得（提案3対応用、後で実装）
        const groupIndex = this.groupTitle ? headers.indexOf(this.groupTitle) : -1;

        // データ件数をカウント（数値として有効な行のみ）
        let dataCount = 0;
        for (let i = 1; i < lines.length; i++) {
            const columns = lines[i].split('\t');
            if (columns.length <= valueIndex) {
                continue;
            }
            const valueStr = columns[valueIndex].trim();
            const value = parseFloat(valueStr);
            if (!isNaN(value)) {
                if (groupIndex === -1) {
                    dataCount++;
                } else {
                    const groupName = columns[groupIndex]?.trim() || '';
                    if (groupName) {
                        dataCount++;
                    }
                }
            }
        }

        // データ件数が閾値を超える場合はlazyLoadモード
        const useLazyLoad = dataCount > this.dataThreshold;

        // 提案1: 生データ形式（グループ列がない場合）
        if (groupIndex === -1) {
            // 単一の系列を作成
            const series = this.histogramChart.addSeries({
                title: this.histogramChart.title || 'データ',
                color: this.seriesColors[0],
                opacity: 0.7
            });

            if (useLazyLoad) {
                // lazyLoadモード: メタデータだけを保存
                series.lazyLoad = true;
                series.tsvLoader = this;
                series.tsvUrl = this.url;
                series.valueIndex = valueIndex;
                series.groupIndex = -1;
                series.totalDataCount = dataCount;
                series.headers = headers; // ヘッダー情報を保存
                // データは保持しない（ヒストグラムの描画には統計情報だけが必要）
                // 統計情報を計算するために、サンプルデータを読み込む（最初の1000件）
                const sampleSize = Math.min(1000, lines.length - 1);
                for (let i = 1; i <= sampleSize; i++) {
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
            } else {
                // 通常モード: 全データを読み込む
                series.headers = headers; // ヘッダー情報を保存
                for (let i = 1; i < lines.length; i++) {
                    const columns = lines[i].split('\t');
                    if (columns.length <= valueIndex) {
                        continue;
                    }

                    const valueStr = columns[valueIndex].trim();
                    const value = parseFloat(valueStr);
                    if (!isNaN(value)) {
                        series.addData(value);
                        // 全カラムのデータを保存
                        const rowData = {};
                        headers.forEach((header, index) => {
                            rowData[header] = columns[index]?.trim() || '';
                        });
                        series.rawData.push(rowData);
                    }
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

            if (useLazyLoad) {
                // lazyLoadモード: メタデータだけを保存
                series.lazyLoad = true;
                series.tsvLoader = this;
                series.tsvUrl = this.url;
                series.valueIndex = valueIndex;
                series.groupIndex = groupIndex;
                series.groupName = groupName;
                series.totalDataCount = values.length;
                series.headers = headers; // ヘッダー情報を保存
                // サンプルデータを読み込む（最初の1000件）
                const sampleSize = Math.min(1000, values.length);
                for (let i = 0; i < sampleSize; i++) {
                    series.addData(values[i]);
                }
            } else {
                // 通常モード: 全データを読み込む
                series.headers = headers; // ヘッダー情報を保存
                // グループ別ヒストグラムの場合、全カラムのデータを再読み込み
                for (let i = 1; i < lines.length; i++) {
                    const columns = lines[i].split('\t');
                    if (columns.length <= valueIndex) {
                        continue;
                    }

                    const valueStr = columns[valueIndex].trim();
                    const value = parseFloat(valueStr);
                    if (isNaN(value)) {
                        continue;
                    }

                    const rowGroupName = columns[groupIndex]?.trim() || '';
                    if (rowGroupName !== groupName) {
                        continue;
                    }

                    series.addData(value);
                    // 全カラムのデータを保存
                    const rowData = {};
                    headers.forEach((header, index) => {
                        rowData[header] = columns[index]?.trim() || '';
                    });
                    series.rawData.push(rowData);
                }
            }

            colorIndex++;
        }
    }

    /**
     * 指定された範囲のデータを読み込む（lazyLoadモード用）
     * @param {number} minValue - 最小値
     * @param {number} maxValue - 最大値
     * @param {HistogramSeries} series - 系列
     * @returns {Promise<Array<Object>>} 該当するデータのオブジェクト配列（全カラムを含む）
     */
    async loadDataInRange(minValue, maxValue, series) {
        // TSVファイルを読み込む
        const response = await fetch(this.url);
        if (!response.ok) {
            throw new Error(`Failed to load TSV file: ${response.status} ${response.statusText}`);
        }

        const text = await response.text();
        const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);

        if (lines.length === 0) {
            return [];
        }

        const result = [];
        const valueIndex = series.valueIndex;
        const groupIndex = series.groupIndex;
        const headers = series.headers || this.headers;

        // データ行を解析
        for (let i = 1; i < lines.length; i++) {
            const columns = lines[i].split('\t');
            if (columns.length <= valueIndex) {
                continue;
            }

            // グループ別ヒストグラムの場合、グループ名をチェック
            if (groupIndex !== -1) {
                const groupName = columns[groupIndex]?.trim() || '';
                if (groupName !== series.groupName) {
                    continue;
                }
            }

            const valueStr = columns[valueIndex].trim();
            const value = parseFloat(valueStr);
            if (isNaN(value)) {
                continue;
            }

            // 範囲内のデータのみを追加
            if (value >= minValue && value <= maxValue) {
                // 全カラムを含むオブジェクトを作成
                const rowData = {};
                headers.forEach((header, index) => {
                    rowData[header] = columns[index]?.trim() || '';
                });
                result.push(rowData);
            }
        }

        return result;
    }
}

/**
 * PieChart - 円グラフチャートクラス
 * 円グラフを管理するクラス
 */
class PieChart {
    /**
     * コンストラクタ
     * @param {ChartCanvas} chartCanvas - 親のChartCanvasインスタンス
     */
    constructor(chartCanvas) {
        this.chartCanvas = chartCanvas;
        
        // タイトルとサブタイトル
        this.title = '';
        this.subtitle = '';
        
        // データとラベル
        this.data = []; // 各セグメントの値
        this.labels = []; // 各セグメントのカテゴリ名
        
        // ラベルの設定
        this.labelFormat = 'category-percentage'; // デフォルト: カテゴリ名とパーセンテージ
        this.labelPosition = 'auto'; // デフォルト: 自動選択
        this.labelThreshold = 5; // 小さいセグメントと判定する閾値（パーセンテージ）
        
        // 「その他」カテゴリの設定
        this.othersCategoryEnabled = false;
        this.othersCategoryThreshold = 5; // パーセンテージ
        this.othersCategoryLabel = 'その他';
        
        // 凡例の設定
        this.legendVisible = true; // デフォルト: 表示
        
        // 色の設定（モノクロームを除く）
        this.colors = ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#FF6384', '#FF6B9D', '#C44569', '#F8B500', '#00D2FF', '#5E60CE'];
        
        // 円グラフの描画設定
        this.startAngle = 0; // 開始角度（度、デフォルト: 0度 = 真北から開始）
        this.innerRadius = 0; // 内側の半径（ドーナツグラフ用、0の場合は通常の円グラフ）
        this.padding = 10; // セグメント間のパディング（度）
        
        // ラベルの角度オフセット（180度付近の衝突回避用）
        this.labelAngleOffsets = []; // 各セグメントのラベル角度オフセット（度）
    }

    /**
     * データとラベルを設定
     * @param {Array<number>} data - データの配列（各セグメントの値）
     * @param {Array<string>} labels - ラベルの配列（各セグメントのカテゴリ名）
     * @returns {PieChart} メソッドチェーン用にthisを返す
     */
    setData(data, labels) {
        if (!Array.isArray(data) || !Array.isArray(labels)) {
            throw new Error('data and labels must be arrays');
        }
        if (data.length !== labels.length) {
            throw new Error('data and labels must have the same length');
        }
        
        // 値が0以上の数値のみをフィルタリング
        const validData = [];
        const validLabels = [];
        for (let i = 0; i < data.length; i++) {
            const value = parseFloat(data[i]);
            if (!isNaN(value) && value >= 0) {
                validData.push(value);
                validLabels.push(labels[i]);
            }
        }
        
        // 割合の多い順にソート（降順）
        // 「その他」カテゴリは最後に配置
        const combined = validData.map((value, index) => ({
            value: value,
            label: validLabels[index],
            index: index,
            isOthers: validLabels[index] === this.othersCategoryLabel || validLabels[index] === 'Others' || validLabels[index] === 'その他'
        }));
        
        // 値の大きい順にソート（「その他」は最後に）
        combined.sort((a, b) => {
            // 「その他」カテゴリは常に最後
            if (a.isOthers && !b.isOthers) return 1;
            if (!a.isOthers && b.isOthers) return -1;
            // 両方とも「その他」でない場合、値の大きい順
            if (!a.isOthers && !b.isOthers) return b.value - a.value;
            // 両方とも「その他」の場合、値の大きい順
            return b.value - a.value;
        });
        
        // ソート後のデータとラベルを設定
        this.data = combined.map(item => item.value);
        this.labels = combined.map(item => item.label);
        
        // ラベルの角度オフセットをリセット
        this.labelAngleOffsets = new Array(this.data.length).fill(0);
        
        return this;
    }

    /**
     * ラベルの表示形式を設定
     * @param {string} format - ラベルの表示形式
     * @returns {PieChart} メソッドチェーン用にthisを返す
     */
    setLabelFormat(format) {
        const validFormats = ['category', 'percentage', 'value', 'category-percentage', 'category-value', 'category-value-percentage'];
        if (!validFormats.includes(format)) {
            throw new Error(`Invalid label format: ${format}. Valid formats: ${validFormats.join(', ')}`);
        }
        this.labelFormat = format;
        return this;
    }

    /**
     * ラベルの配置方法を設定
     * @param {string} position - ラベルの配置方法
     * @returns {PieChart} メソッドチェーン用にthisを返す
     */
    setLabelPosition(position) {
        const validPositions = ['auto', 'arc-center', 'leader-line'];
        if (!validPositions.includes(position)) {
            throw new Error(`Invalid label position: ${position}. Valid positions: ${validPositions.join(', ')}`);
        }
        this.labelPosition = position;
        return this;
    }

    /**
     * 小さいセグメントと判定する閾値を設定
     * @param {number} threshold - 閾値（パーセンテージ、0〜100）
     * @returns {PieChart} メソッドチェーン用にthisを返す
     */
    setLabelThreshold(threshold) {
        if (typeof threshold !== 'number' || threshold < 0 || threshold > 100) {
            throw new Error('threshold must be a number between 0 and 100');
        }
        this.labelThreshold = threshold;
        return this;
    }

    /**
     * 「その他」カテゴリにまとめる機能を設定
     * @param {boolean} enabled - 「その他」カテゴリにまとめる機能を有効にするか
     * @param {number} threshold - 閾値（パーセンテージ、0〜100、オプション）
     * @param {string} label - 「その他」カテゴリのラベル（オプション）
     * @returns {PieChart} メソッドチェーン用にthisを返す
     */
    setOthersCategory(enabled, threshold, label) {
        this.othersCategoryEnabled = enabled;
        if (threshold !== undefined) {
            if (typeof threshold !== 'number' || threshold < 0 || threshold > 100) {
                throw new Error('threshold must be a number between 0 and 100');
            }
            this.othersCategoryThreshold = threshold;
        }
        if (label !== undefined) {
            this.othersCategoryLabel = label;
        }
        return this;
    }

    /**
     * 凡例の表示/非表示を設定
     * @param {boolean} visible - 凡例を表示するかどうか
     * @returns {PieChart} メソッドチェーン用にthisを返す
     */
    setLegendVisible(visible) {
        this.legendVisible = visible;
        return this;
    }

    /**
     * タイトルを設定
     * @param {string} title - グラフのタイトル
     * @returns {PieChart} メソッドチェーン用にthisを返す
     */
    setTitle(title) {
        this.title = title || '';
        return this;
    }

    /**
     * サブタイトルを設定
     * @param {string} subtitle - グラフのサブタイトル
     * @returns {PieChart} メソッドチェーン用にthisを返す
     */
    setSubtitle(subtitle) {
        this.subtitle = subtitle || '';
        return this;
    }

    /**
     * TSVローダーを作成
     * @param {string} url - TSVファイルのURL
     * @returns {PieTsvLoader} PieTsvLoaderインスタンス
     */
    tsvLoader(url) {
        return new PieTsvLoader(this, url);
    }

    /**
     * データの合計値を計算
     * @returns {number} データの合計値
     */
    getTotal() {
        return this.data.reduce((sum, value) => sum + value, 0);
    }

    /**
     * 各セグメントのパーセンテージを計算
     * @returns {Array<number>} 各セグメントのパーセンテージの配列
     */
    getPercentages() {
        const total = this.getTotal();
        if (total === 0) {
            return this.data.map(() => 0);
        }
        return this.data.map(value => (value / total) * 100);
    }

    /**
     * セグメントの角度を計算
     * @returns {Array<Object>} 各セグメントの角度情報の配列 [{startAngle, endAngle, percentage}, ...]
     */
    getSegmentAngles() {
        const total = this.getTotal();
        if (total === 0) {
            return [];
        }
        
        const percentages = this.getPercentages();
        const angles = [];
        let currentAngle = this.startAngle;
        
        for (let i = 0; i < this.data.length; i++) {
            const percentage = percentages[i];
            const angle = (percentage / 100) * 360;
            const startAngle = currentAngle;
            const endAngle = currentAngle + angle;
            
            angles.push({
                startAngle,
                endAngle,
                percentage,
                index: i
            });
            
            currentAngle = endAngle;
        }
        
        return angles;
    }

    /**
     * ラベルのテキストを生成
     * @param {number} index - セグメントのインデックス
     * @returns {string} ラベルのテキスト
     */
    getLabelText(index) {
        if (index < 0 || index >= this.labels.length) {
            return '';
        }
        
        const label = this.labels[index];
        const value = this.data[index];
        const percentage = this.getPercentages()[index];
        
        switch (this.labelFormat) {
            case 'category':
                return label;
            case 'percentage':
                return `${percentage.toFixed(1)}%`;
            case 'value':
                return value.toLocaleString();
            case 'category-percentage':
                return `${label} (${percentage.toFixed(1)}%)`;
            case 'category-value':
                return `${label}: ${value.toLocaleString()}`;
            case 'category-value-percentage':
                return `${label}: ${value.toLocaleString()} (${percentage.toFixed(1)}%)`;
            default:
                return `${label} (${percentage.toFixed(1)}%)`;
        }
    }

    /**
     * セグメントが小さいかどうかを判定
     * @param {number} index - セグメントのインデックス
     * @returns {boolean} 小さいセグメントかどうか
     */
    isSmallSegment(index) {
        const percentage = this.getPercentages()[index];
        return percentage <= this.labelThreshold;
    }

    /**
     * ラベルの配置方法を決定（自動選択の場合）
     * @param {number} index - セグメントのインデックス
     * @returns {string} ラベルの配置方法（'arc-center' または 'leader-line'）
     */
    determineLabelPosition(index) {
        if (this.labelPosition !== 'auto') {
            return this.labelPosition;
        }
        
        // 自動選択: セグメントが小さい場合は引出線を使用
        if (this.isSmallSegment(index)) {
            return 'leader-line';
        }
        
        return 'arc-center';
    }

    /**
     * ラベルの位置とサイズを計算
     * @param {number} centerX - 円グラフの中心X座標
     * @param {number} centerY - 円グラフの中心Y座標
     * @param {number} radius - 円グラフの半径
     * @param {number} fontSize - フォントサイズ
     * @param {Function} getTextWidth - テキスト幅を取得する関数
     * @param {number} index - セグメントのインデックス
     * @returns {Object} ラベルの位置とサイズ情報 {x, y, width, height, angle}
     */
    calculateLabelBounds(centerX, centerY, radius, fontSize, getTextWidth, index) {
        const segmentAngles = this.getSegmentAngles();
        if (index < 0 || index >= segmentAngles.length) {
            return null;
        }

        const segment = segmentAngles[index];
        const labelText = this.getLabelText(index);
        const labelPosition = this.determineLabelPosition(index);
        
        // ラベルの幅と高さを計算
        const labelWidth = getTextWidth(labelText, fontSize);
        const labelHeight = fontSize * 1.2; // フォントサイズの1.2倍を高さとする
        
        // ラベルの位置を計算
        const midAngleDeg = (segment.startAngle + segment.endAngle) / 2;
        const midAngleRad = ((midAngleDeg - 90) * Math.PI) / 180; // SVG座標系用に調整
        
        let labelX, labelY, labelRadius;
        
        if (labelPosition === 'arc-center') {
            labelRadius = radius + 20; // 円の外側に配置
        } else {
            labelRadius = radius + 30; // 引出線の場合、少し外側に
        }
        
        labelX = centerX + labelRadius * Math.cos(midAngleRad);
        labelY = centerY + labelRadius * Math.sin(midAngleRad);
        
        return {
            x: labelX,
            y: labelY,
            width: labelWidth,
            height: labelHeight,
            angle: midAngleDeg,
            index: index,
            text: labelText
        };
    }

    /**
     * 2つのラベルのバウンディングボックスが重なっているかチェック
     * @param {Object} label1 - ラベル1の情報 {x, y, width, height}
     * @param {Object} label2 - ラベル2の情報 {x, y, width, height}
     * @param {number} padding - ラベル間の最小間隔（ピクセル、デフォルト: 5）
     * @returns {boolean} 重なっている場合true
     */
    checkLabelCollision(label1, label2, padding = 5) {
        if (!label1 || !label2) {
            return false;
        }
        
        // ラベル1のバウンディングボックス（中央揃えを考慮）
        const label1Left = label1.x - label1.width / 2;
        const label1Right = label1.x + label1.width / 2;
        const label1Top = label1.y - label1.height / 2;
        const label1Bottom = label1.y + label1.height / 2;
        
        // ラベル2のバウンディングボックス（中央揃えを考慮）
        const label2Left = label2.x - label2.width / 2;
        const label2Right = label2.x + label2.width / 2;
        const label2Top = label2.y - label2.height / 2;
        const label2Bottom = label2.y + label2.height / 2;
        
        // パディングを考慮した衝突判定
        // 2つの矩形が重なっているかチェック
        const horizontalOverlap = !(label1Right + padding < label2Left || label2Right + padding < label1Left);
        const verticalOverlap = !(label1Bottom + padding < label2Top || label2Bottom + padding < label1Top);
        
        return horizontalOverlap && verticalOverlap;
    }

    /**
     * すべてのラベルの衝突をチェック
     * @param {number} centerX - 円グラフの中心X座標
     * @param {number} centerY - 円グラフの中心Y座標
     * @param {number} radius - 円グラフの半径
     * @param {number} fontSize - フォントサイズ
     * @param {Function} getTextWidth - テキスト幅を取得する関数
     * @returns {Array} 衝突しているラベルのペアの配列 [{label1, label2}, ...]
     */
    checkAllLabelCollisions(centerX, centerY, radius, fontSize, getTextWidth) {
        const collisions = [];
        const labelBounds = [];
        
        // すべてのラベルの位置とサイズを計算
        for (let i = 0; i < this.data.length; i++) {
            const bounds = this.calculateLabelBounds(centerX, centerY, radius, fontSize, getTextWidth, i);
            if (bounds) {
                labelBounds.push(bounds);
            }
        }
        
        // すべてのラベルペアについて衝突をチェック
        for (let i = 0; i < labelBounds.length; i++) {
            for (let j = i + 1; j < labelBounds.length; j++) {
                if (this.checkLabelCollision(labelBounds[i], labelBounds[j])) {
                    collisions.push({
                        label1: labelBounds[i],
                        label2: labelBounds[j]
                    });
                }
            }
        }
        
        return collisions;
    }

    /**
     * 350度（北北西）付近のラベル衝突を解決するため、小さいカテゴリを「その他」にまとめる
     * @param {number} centerX - 円グラフの中心X座標
     * @param {number} centerY - 円グラフの中心Y座標
     * @param {number} radius - 円グラフの半径
     * @param {number} fontSize - フォントサイズ
     * @param {Function} getTextWidth - テキスト幅を取得する関数
     * @param {number} maxIterations - 最大繰り返し回数（デフォルト: 10）
     * @param {string} othersLabel - 「その他」カテゴリのラベル（デフォルト: "その他"）
     * @param {number} angleRange - 350度付近の角度範囲（デフォルト: 20度、つまり340度〜360度と0度〜20度）
     * @returns {Object} 処理結果 {success: boolean, iterations: number, originalData: Array, originalLabels: Array}
     */
    resolve350DegreeCollisions(centerX, centerY, radius, fontSize, getTextWidth, maxIterations = 10, othersLabel = 'その他', angleRange = 20) {
        // 元のデータを保存
        const originalData = [...this.data];
        const originalLabels = [...this.labels];
        
        let iterations = 0;
        let hasCollisions = true;
        
        while (hasCollisions && iterations < maxIterations) {
            iterations++;
            
            // すべてのラベルの衝突をチェック
            const allCollisions = this.checkAllLabelCollisions(centerX, centerY, radius, fontSize, getTextWidth);
            
            // 350度付近（340度〜360度、0度〜20度）の衝突を特定
            const segmentAngles = this.getSegmentAngles();
            const collisionsIn350Range = allCollisions.filter(collision => {
                const angle1 = collision.label1.angle;
                const angle2 = collision.label2.angle;
                
                // 角度を0〜360度の範囲に正規化
                const normalizeAngle = (angle) => {
                    while (angle < 0) angle += 360;
                    while (angle >= 360) angle -= 360;
                    return angle;
                };
                
                const normAngle1 = normalizeAngle(angle1);
                const normAngle2 = normalizeAngle(angle2);
                
                // 350度付近の範囲をチェック（340度〜360度、0度〜20度）
                const isIn350Range = (angle) => {
                    return (angle >= 360 - angleRange) || (angle <= angleRange);
                };
                
                return isIn350Range(normAngle1) || isIn350Range(normAngle2);
            });
            
            // 350度付近に衝突がない場合は終了
            if (collisionsIn350Range.length === 0) {
                hasCollisions = false;
                break;
            }
            
            // 衝突しているラベルの中で、最も小さいセグメントを特定
            const segmentsToMerge = new Set();
            collisionsIn350Range.forEach(collision => {
                const index1 = collision.label1.index;
                const index2 = collision.label2.index;
                
                // パーセンテージが小さい方を「その他」にまとめる対象とする
                const percentage1 = this.getPercentages()[index1];
                const percentage2 = this.getPercentages()[index2];
                
                if (percentage1 < percentage2) {
                    segmentsToMerge.add(index1);
                } else {
                    segmentsToMerge.add(index2);
                }
            });
            
            // まとめるセグメントがない場合は終了
            if (segmentsToMerge.size === 0) {
                hasCollisions = false;
                break;
            }
            
            // 「その他」カテゴリにまとめる
            this.mergeToOthersCategory(Array.from(segmentsToMerge), othersLabel);
            
            // データを再構築（ソートし直すため）
            // setDataを呼び出すことで、データが再度ソートされ、角度が再計算される
            this.setData(this.data, this.labels);
        }
        
        return {
            success: !hasCollisions,
            iterations: iterations,
            originalData: originalData,
            originalLabels: originalLabels
        };
    }

    /**
     * 指定されたインデックスのセグメントを「その他」カテゴリにまとめる
     * @param {Array<number>} indices - まとめるセグメントのインデックス配列
     * @param {string} othersLabel - 「その他」カテゴリのラベル
     */
    mergeToOthersCategory(indices, othersLabel) {
        if (indices.length === 0) {
            return;
        }
        
        // インデックスを降順にソート（後ろから削除するため）
        const sortedIndices = [...indices].sort((a, b) => b - a);
        
        // 「その他」カテゴリの値を計算
        let othersValue = 0;
        const mergedLabels = [];
        
        sortedIndices.forEach(index => {
            othersValue += this.data[index];
            mergedLabels.push(this.labels[index]);
        });
        
        // セグメントを削除（後ろから削除することでインデックスがずれないようにする）
        sortedIndices.forEach(index => {
            this.data.splice(index, 1);
            this.labels.splice(index, 1);
        });
        
        // 「その他」カテゴリを追加
        // 既に「その他」カテゴリが存在する場合は値を追加、存在しない場合は新規追加
        const othersIndex = this.labels.indexOf(othersLabel);
        if (othersIndex >= 0) {
            this.data[othersIndex] += othersValue;
        } else {
            // 「その他」カテゴリを最後に追加（最小値として扱われるように）
            this.data.push(othersValue);
            this.labels.push(othersLabel);
        }
    }

    /**
     * 元のデータに戻す
     * @param {Array<number>} originalData - 元のデータ配列
     * @param {Array<string>} originalLabels - 元のラベル配列
     */
    restoreOriginalData(originalData, originalLabels) {
        this.data = [...originalData];
        this.labels = [...originalLabels];
        this.labelAngleOffsets = new Array(this.data.length).fill(0);
    }

    /**
     * 180度（真南）付近のラベル衝突を解決するため、右側のラベルを右にずらす
     * @param {number} centerX - 円グラフの中心X座標
     * @param {number} centerY - 円グラフの中心Y座標
     * @param {number} radius - 円グラフの半径
     * @param {number} fontSize - フォントサイズ
     * @param {Function} getTextWidth - テキスト幅を取得する関数
     * @param {number} maxIterations - 最大繰り返し回数（デフォルト: 20）
     * @param {number} angleRange - 180度付近の角度範囲（デフォルト: 30度、つまり165度〜195度）
     * @param {number} stepAngle - 1回の調整でずらす角度（度、デフォルト: 2度）
     * @returns {Object} 処理結果 {success: boolean, iterations: number}
     */
    resolve180DegreeCollisions(centerX, centerY, radius, fontSize, getTextWidth, maxIterations = 20, angleRange = 30, stepAngle = 2) {
        // ラベルの角度オフセットをリセット
        this.labelAngleOffsets = new Array(this.data.length).fill(0);
        
        let iterations = 0;
        let hasCollisions = true;
        
        while (hasCollisions && iterations < maxIterations) {
            iterations++;
            
            // すべてのラベルの衝突をチェック（オフセットを考慮）
            const allCollisions = this.checkAllLabelCollisionsWithOffsets(centerX, centerY, radius, fontSize, getTextWidth);
            
            // 180度付近（165度〜195度）の衝突を特定
            const collisionsIn180Range = allCollisions.filter(collision => {
                const angle1 = collision.label1.angle + (this.labelAngleOffsets[collision.label1.index] || 0);
                const angle2 = collision.label2.angle + (this.labelAngleOffsets[collision.label2.index] || 0);
                
                // 角度を0〜360度の範囲に正規化
                const normalizeAngle = (angle) => {
                    while (angle < 0) angle += 360;
                    while (angle >= 360) angle -= 360;
                    return angle;
                };
                
                const normAngle1 = normalizeAngle(angle1);
                const normAngle2 = normalizeAngle(angle2);
                
                // 180度付近の範囲をチェック（165度〜195度）
                const isIn180Range = (angle) => {
                    const diff = Math.abs(angle - 180);
                    return diff <= angleRange / 2 || diff >= 360 - angleRange / 2;
                };
                
                return isIn180Range(normAngle1) || isIn180Range(normAngle2);
            });
            
            // 180度付近に衝突がない場合は終了
            if (collisionsIn180Range.length === 0) {
                hasCollisions = false;
                break;
            }
            
            // 衝突しているラベルの中で、角度が大きい方（右側）を右にずらす
            collisionsIn180Range.forEach(collision => {
                const index1 = collision.label1.index;
                const index2 = collision.label2.index;
                
                const angle1 = collision.label1.angle + (this.labelAngleOffsets[index1] || 0);
                const angle2 = collision.label2.angle + (this.labelAngleOffsets[index2] || 0);
                
                // 角度を0〜360度の範囲に正規化
                const normalizeAngle = (angle) => {
                    while (angle < 0) angle += 360;
                    while (angle >= 360) angle -= 360;
                    return angle;
                };
                
                const normAngle1 = normalizeAngle(angle1);
                const normAngle2 = normalizeAngle(angle2);
                
                // 180度からの距離を計算（180度に近いほど優先）
                const dist1 = Math.min(Math.abs(normAngle1 - 180), Math.abs(normAngle1 - 180 + 360), Math.abs(normAngle1 - 180 - 360));
                const dist2 = Math.min(Math.abs(normAngle2 - 180), Math.abs(normAngle2 - 180 + 360), Math.abs(normAngle2 - 180 - 360));
                
                // 角度が大きい方（右側、時計回り）を右にずらす
                // 180度に近い方を優先的にずらす
                if (normAngle1 > normAngle2 || (dist1 < dist2 && normAngle1 >= 180)) {
                    // index1を右にずらす（角度を増やす）
                    this.labelAngleOffsets[index1] = (this.labelAngleOffsets[index1] || 0) + stepAngle;
                } else {
                    // index2を右にずらす（角度を増やす）
                    this.labelAngleOffsets[index2] = (this.labelAngleOffsets[index2] || 0) + stepAngle;
                }
            });
        }
        
        return {
            success: !hasCollisions,
            iterations: iterations
        };
    }

    /**
     * オフセットを考慮したすべてのラベルの衝突をチェック
     * @param {number} centerX - 円グラフの中心X座標
     * @param {number} centerY - 円グラフの中心Y座標
     * @param {number} radius - 円グラフの半径
     * @param {number} fontSize - フォントサイズ
     * @param {Function} getTextWidth - テキスト幅を取得する関数
     * @returns {Array} 衝突しているラベルのペアの配列 [{label1, label2}, ...]
     */
    checkAllLabelCollisionsWithOffsets(centerX, centerY, radius, fontSize, getTextWidth) {
        const collisions = [];
        const labelBounds = [];
        
        // すべてのラベルの位置とサイズを計算（オフセットを考慮）
        for (let i = 0; i < this.data.length; i++) {
            const bounds = this.calculateLabelBounds(centerX, centerY, radius, fontSize, getTextWidth, i);
            if (bounds) {
                // 角度オフセットを適用
                const offset = this.labelAngleOffsets[i] || 0;
                const adjustedAngle = bounds.angle + offset;
                
                // オフセット後の位置を再計算
                const adjustedAngleRad = ((adjustedAngle - 90) * Math.PI) / 180;
                const labelPosition = this.determineLabelPosition(i);
                const labelRadius = labelPosition === 'arc-center' ? radius + 20 : radius + 30;
                
                bounds.x = centerX + labelRadius * Math.cos(adjustedAngleRad);
                bounds.y = centerY + labelRadius * Math.sin(adjustedAngleRad);
                bounds.angle = adjustedAngle;
                
                labelBounds.push(bounds);
            }
        }
        
        // すべてのラベルペアについて衝突をチェック
        for (let i = 0; i < labelBounds.length; i++) {
            for (let j = i + 1; j < labelBounds.length; j++) {
                if (this.checkLabelCollision(labelBounds[i], labelBounds[j])) {
                    collisions.push({
                        label1: labelBounds[i],
                        label2: labelBounds[j]
                    });
                }
            }
        }
        
        return collisions;
    }
}

/**
 * PieTsvLoader - 円グラフ用TSVローダークラス
 */
class PieTsvLoader {
    constructor(pieChart, url) {
        this.pieChart = pieChart;
        this.url = url;
        this.categoryTitle = ''; // カテゴリ名列の列名
        this.valueTitle = ''; // 値列の列名
        this.groupTitle = ''; // グループ列の列名（複数の円グラフを並べる場合）
    }

    /**
     * TSVファイルを読み込んでデータを追加
     * @returns {Promise<void>}
     */
    async load() {
        if (!this.categoryTitle || !this.valueTitle) {
            throw new Error('categoryTitle and valueTitle must be set before calling load()');
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
        const categoryIndex = headers.indexOf(this.categoryTitle);
        const valueIndex = headers.indexOf(this.valueTitle);
        
        if (categoryIndex === -1) {
            throw new Error(`Column "${this.categoryTitle}" not found in TSV file`);
        }
        if (valueIndex === -1) {
            throw new Error(`Column "${this.valueTitle}" not found in TSV file`);
        }

        // グループ列のインデックスを取得（複数の円グラフを並べる場合）
        const groupIndex = this.groupTitle ? headers.indexOf(this.groupTitle) : -1;

        // 単一の円グラフの場合
        if (groupIndex === -1) {
            const data = [];
            const labels = [];
            
            for (let i = 1; i < lines.length; i++) {
                const columns = lines[i].split('\t');
                if (columns.length <= Math.max(categoryIndex, valueIndex)) {
                    continue;
                }
                
                const category = columns[categoryIndex]?.trim() || '';
                const valueStr = columns[valueIndex].trim();
                const value = parseFloat(valueStr);
                
                if (!isNaN(value) && value >= 0 && category) {
                    data.push(value);
                    labels.push(category);
                }
            }
            
            this.pieChart.setData(data, labels);
            return;
        }

        // 複数の円グラフを並べる場合（グループ別）
        // グループごとのデータを収集
        const dataByGroup = new Map(); // Map<groupName, {data: [], labels: []}>
        
        for (let i = 1; i < lines.length; i++) {
            const columns = lines[i].split('\t');
            if (columns.length <= Math.max(categoryIndex, valueIndex, groupIndex)) {
                continue;
            }
            
            const category = columns[categoryIndex]?.trim() || '';
            const valueStr = columns[valueIndex].trim();
            const value = parseFloat(valueStr);
            const groupName = columns[groupIndex]?.trim() || '';
            
            if (!isNaN(value) && value >= 0 && category && groupName) {
                if (!dataByGroup.has(groupName)) {
                    dataByGroup.set(groupName, { data: [], labels: [] });
                }
                
                const groupData = dataByGroup.get(groupName);
                groupData.data.push(value);
                groupData.labels.push(category);
            }
        }

        // グループごとに円グラフを作成
        // 注意: この実装では、最初のグループのデータのみを現在のPieChartに設定
        // 複数の円グラフを並べる場合は、ChartCanvas側で複数のPieChartを作成する必要がある
        const sortedGroupNames = Array.from(dataByGroup.keys()).sort();
        if (sortedGroupNames.length > 0) {
            const firstGroup = dataByGroup.get(sortedGroupNames[0]);
            this.pieChart.setData(firstGroup.data, firstGroup.labels);
        }
    }
}

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
     * 円グラフチャートを追加
     * @returns {PieChart} PieChartインスタンス
     */
    addPieChart() {
        const pieChart = new PieChart(this);
        if (!this.pieCharts) {
            this.pieCharts = [];
        }
        this.pieCharts.push(pieChart);
        return pieChart;
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

        // 円グラフがある場合は円グラフを描画
        if (this.pieCharts && this.pieCharts.length > 0) {
            this.renderPieCharts(svg);
        } else if (this.histogramCharts && this.histogramCharts.length > 0) {
            // ヒストグラムがある場合はヒストグラムを描画
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

    /**
     * 円グラフを描画
     * @param {SVGElement} svg - SVG要素
     */
    renderPieCharts(svg) {
        if (!this.pieCharts || this.pieCharts.length === 0) {
            return;
        }

        // 単一の円グラフの場合
        if (this.pieCharts.length === 1) {
            const pieChart = this.pieCharts[0];
            this.renderSinglePieChart(svg, pieChart);
        } else {
            // 複数の円グラフを横並びに表示
            this.renderMultiplePieCharts(svg);
        }
    }

    /**
     * 複数の円グラフを横並びに描画
     * @param {SVGElement} svg - SVG要素
     */
    renderMultiplePieCharts(svg) {
        const pieChartsCount = this.pieCharts.length;
        const fontSize = ChartCanvas.FONT_SIZE_NORMAL;
        
        // すべての円グラフのラベルを収集して、色のマッピングを作成
        const labelColorMap = this.createLabelColorMap();
        
        // 各円グラフに色を割り当て
        for (const pieChart of this.pieCharts) {
            this.assignColorsToPieChart(pieChart, labelColorMap);
        }
        
        // 各円グラフのラベルを含めた実際の描画領域を計算
        const margin = 40;
        const labelSpacing = 20; // ラベルを含めた描画領域間のスペース
        const titleHeight = fontSize + 5; // タイトルの高さ
        
        // まず、各円グラフのラベルを含めた実際の幅を計算
        const chartBounds = [];
        for (let i = 0; i < pieChartsCount; i++) {
            const pieChart = this.pieCharts[i];
            const bounds = this.calculatePieChartBounds(pieChart, fontSize, titleHeight);
            chartBounds.push(bounds);
        }
        
        // 全描画領域の合計幅を計算
        const totalBoundsWidth = chartBounds.reduce((sum, bounds) => sum + bounds.width, 0);
        const totalSpacing = labelSpacing * (pieChartsCount - 1);
        const totalWidth = totalBoundsWidth + totalSpacing;
        
        // 中央に配置するための開始位置を計算
        const startX = (this.width - totalWidth) / 2;
        
        // 各円グラフを描画
        let currentX = startX;
        for (let i = 0; i < pieChartsCount; i++) {
            const pieChart = this.pieCharts[i];
            const bounds = chartBounds[i];
            const chartCenterX = currentX + bounds.width / 2;
            
            this.renderSinglePieChartAtPosition(svg, pieChart, chartCenterX, bounds.width, bounds.radius);
            
            // 次のグラフの位置を更新（ラベルを含めた幅 + スペース）
            currentX += bounds.width + labelSpacing;
        }
    }

    /**
     * 単一の円グラフを描画
     * @param {SVGElement} svg - SVG要素
     * @param {PieChart} pieChart - PieChartインスタンス
     */
    renderSinglePieChart(svg, pieChart) {
        if (!pieChart.data || pieChart.data.length === 0) {
            return;
        }

        const fontSize = ChartCanvas.FONT_SIZE_NORMAL;
        const metrics = this.measureFontMetrics(fontSize);
        
        // タイトルとサブタイトルの高さを計算
        let titleHeight = 0;
        if (pieChart.title) {
            titleHeight += fontSize + 5;
        }
        if (pieChart.subtitle) {
            titleHeight += fontSize + 5;
        }
        
        // 円グラフの描画領域を計算
        const margin = 40;
        const centerX = this.width / 2;
        const availableHeight = this.height - titleHeight - margin * 2;
        const availableWidth = this.width - margin * 2;
        
        // ラベルの表示方法に応じて円グラフのサイズを調整
        const labelPadding = 80; // ラベルのための余白
        const maxRadius = Math.min(availableWidth / 2 - labelPadding, availableHeight / 2 - labelPadding);
        const radius = Math.max(50, maxRadius); // 最小半径50px
        
        // 円グラフの中心座標
        const centerY = titleHeight + margin + (availableHeight / 2);
        
        // 350度付近のラベル衝突を解決（小さいカテゴリを「その他」にまとめる）
        const collisionResult = pieChart.resolve350DegreeCollisions(
            centerX,
            centerY,
            radius,
            fontSize,
            this.getTextWidth.bind(this),
            10,  // 最大繰り返し回数
            'その他',  // 「その他」のラベル
            20   // 350度付近の角度範囲（20度）
        );
        
        if (collisionResult.iterations > 0) {
            console.log(`350度付近の衝突を解決: ${collisionResult.iterations}回の繰り返しで${collisionResult.success ? '成功' : '部分的な解決'}`);
        }
        
        // 180度付近（真南）のラベル衝突を解決（右側のラベルを右にずらす）
        const collision180Result = pieChart.resolve180DegreeCollisions(
            centerX,
            centerY,
            radius,
            fontSize,
            this.getTextWidth.bind(this),
            20,  // 最大繰り返し回数
            30,  // 180度付近の角度範囲（30度）
            2    // 1回の調整でずらす角度（2度）
        );
        
        if (collision180Result.iterations > 0) {
            console.log(`180度付近の衝突を解決: ${collision180Result.iterations}回の繰り返しで${collision180Result.success ? '成功' : '部分的な解決'}`);
        }
        
        // セグメントの角度を再計算（衝突解決後のデータで）
        const segmentAngles = pieChart.getSegmentAngles();
        
        // まず、すべての円弧を描画
        for (let i = 0; i < segmentAngles.length; i++) {
            const segment = segmentAngles[i];
            
            // SVGの座標系ではY軸が下向きなので、角度を調整
            // 真北（0度）から時計回りに開始するため、-90度オフセットを適用
            const startAngleDeg = segment.startAngle;
            const endAngleDeg = segment.endAngle;
            
            // 度をラジアンに変換（SVG座標系用に調整：真北を0度として時計回り）
            const startAngleRad = ((startAngleDeg - 90) * Math.PI) / 180;
            const endAngleRad = ((endAngleDeg - 90) * Math.PI) / 180;
            
            // 色を取得（「その他」カテゴリはグレー、それ以外はモノクロームを除く色）
            let color;
            const label = pieChart.labels[i];
            const isOthers = label === 'その他' || label === 'Others';
            
            if (isOthers) {
                // 「その他」カテゴリはグレー
                color = '#808080'; // グレー
            } else {
                // それ以外はモノクロームを除く色を使用
                color = pieChart.colors[i % pieChart.colors.length];
            }
            
            // 開始点と終了点の座標を計算
            const startX = centerX + radius * Math.cos(startAngleRad);
            const startY = centerY + radius * Math.sin(startAngleRad);
            const endX = centerX + radius * Math.cos(endAngleRad);
            const endY = centerY + radius * Math.sin(endAngleRad);
            
            // 円弧の角度差を計算
            let angleDiff = endAngleDeg - startAngleDeg;
            if (angleDiff < 0) {
                angleDiff += 360;
            }
            
            // 大きな円弧かどうかを判定（180度を超える場合）
            const largeArcFlag = angleDiff > 180 ? 1 : 0;
            
            // SVGパスを生成
            // M: 中心点に移動
            // L: 開始点まで線を引く
            // A: 円弧を描く（半径、半径、回転、大きな円弧フラグ、時計回り、終了点）
            // Z: パスを閉じる（中心点に戻る）
            const pathData = `M ${centerX} ${centerY} L ${startX} ${startY} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${endX} ${endY} Z`;
            
            // パス要素を作成
            const path = VirtualDOM.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', pathData);
            path.setAttribute('fill', color);
            path.setAttribute('stroke', '#fff');
            path.setAttribute('stroke-width', '2');
            svg.appendChild(path);
        }
        
        // 次に、すべてのラベルを描画（円弧の上に表示されるように）
        for (let i = 0; i < segmentAngles.length; i++) {
            const segment = segmentAngles[i];
            
            // ラベルを描画
            const labelPosition = pieChart.determineLabelPosition(i);
            if (labelPosition === 'arc-center') {
                // 外縁の円弧の中心にラベルを配置（角度オフセットを適用）
                let midAngleDeg = (segment.startAngle + segment.endAngle) / 2;
                const angleOffset = pieChart.labelAngleOffsets[i] || 0;
                midAngleDeg += angleOffset; // 角度オフセットを適用
                const midAngleRad = ((midAngleDeg - 90) * Math.PI) / 180; // SVG座標系用に調整
                const labelRadius = radius + 20; // 円の外側に配置
                const labelX = centerX + labelRadius * Math.cos(midAngleRad);
                const labelY = centerY + labelRadius * Math.sin(midAngleRad);
                
                const labelText = VirtualDOM.createElementNS('http://www.w3.org/2000/svg', 'text');
                labelText.setAttribute('class', 'chart-text');
                labelText.setAttribute('x', labelX);
                labelText.setAttribute('y', labelY);
                labelText.setAttribute('text-anchor', 'middle');
                labelText.setAttribute('dominant-baseline', 'middle');
                labelText.setAttribute('style', `font-size: ${fontSize}px;`);
                labelText.textContent = pieChart.getLabelText(i);
                svg.appendChild(labelText);
            } else if (labelPosition === 'leader-line') {
                // 引出線（リーダーライン）を出すタイプ（角度オフセットを適用）
                let midAngleDeg = (segment.startAngle + segment.endAngle) / 2;
                const angleOffset = pieChart.labelAngleOffsets[i] || 0;
                midAngleDeg += angleOffset; // 角度オフセットを適用
                const midAngleRad = ((midAngleDeg - 90) * Math.PI) / 180; // SVG座標系用に調整
                const labelRadius = radius + 30; // 円の外側に配置
                const labelX = centerX + labelRadius * Math.cos(midAngleRad);
                const labelY = centerY + labelRadius * Math.sin(midAngleRad);
                
                // 引出線を描画
                const lineStartX = centerX + radius * Math.cos(midAngleRad);
                const lineStartY = centerY + radius * Math.sin(midAngleRad);
                const lineEndX = labelX;
                const lineEndY = labelY;
                
                const line = VirtualDOM.createElementNS('http://www.w3.org/2000/svg', 'line');
                line.setAttribute('x1', lineStartX);
                line.setAttribute('y1', lineStartY);
                line.setAttribute('x2', lineEndX);
                line.setAttribute('y2', lineEndY);
                line.setAttribute('stroke', '#333');
                line.setAttribute('stroke-width', '1');
                svg.appendChild(line);
                
                // ラベルを描画
                const labelText = VirtualDOM.createElementNS('http://www.w3.org/2000/svg', 'text');
                labelText.setAttribute('class', 'chart-text');
                labelText.setAttribute('x', labelX);
                labelText.setAttribute('y', labelY);
                labelText.setAttribute('text-anchor', 'middle');
                labelText.setAttribute('dominant-baseline', 'middle');
                labelText.setAttribute('style', `font-size: ${fontSize}px;`);
                labelText.textContent = pieChart.getLabelText(i);
                svg.appendChild(labelText);
            }
        }
        
        // 凡例は描画しない（ラベルで情報を表示するため）
    }

    /**
     * 円グラフのラベルを含めた描画領域の幅を計算
     * @param {PieChart} pieChart - PieChartインスタンス
     * @param {number} fontSize - フォントサイズ
     * @param {number} titleHeight - タイトルの高さ
     * @returns {Object} 描画領域の情報 {width, height, centerX, centerY, radius}
     */
    calculatePieChartBounds(pieChart, fontSize, titleHeight) {
        if (!pieChart.data || pieChart.data.length === 0) {
            return { width: 0, height: 0, centerX: 0, centerY: 0, radius: 0 };
        }
        
        const margin = 40;
        const availableHeight = this.height - titleHeight - margin * 2;
        
        // 仮の中心位置でラベルの位置を計算（幅を計算するため）
        // 中心を0として計算し、後でオフセットを追加
        const tempCenterX = 0;
        const tempCenterY = titleHeight + margin + (availableHeight / 2);
        
        // ラベルの表示方法に応じて円グラフのサイズを調整
        const labelPadding = 80; // ラベルのための余白
        // 仮の幅を大きめに設定して、ラベルの範囲を正確に計算
        const tempAvailableWidth = 1000; // 仮の幅（後で調整）
        const tempMaxRadius = Math.min(tempAvailableWidth / 2 - labelPadding, availableHeight / 2 - labelPadding);
        const tempRadius = Math.max(50, tempMaxRadius);
        
        // すべてのラベルの位置を計算して、最も左と右の位置を取得
        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;
        let maxY = -Infinity;
        
        const segmentAngles = pieChart.getSegmentAngles();
        for (let i = 0; i < segmentAngles.length; i++) {
            const segment = segmentAngles[i];
            const labelPosition = pieChart.determineLabelPosition(i);
            
            let midAngleDeg = (segment.startAngle + segment.endAngle) / 2;
            const angleOffset = pieChart.labelAngleOffsets[i] || 0;
            midAngleDeg += angleOffset;
            const midAngleRad = ((midAngleDeg - 90) * Math.PI) / 180;
            
            const labelRadius = labelPosition === 'arc-center' ? tempRadius + 20 : tempRadius + 30;
            const labelX = tempCenterX + labelRadius * Math.cos(midAngleRad);
            const labelY = tempCenterY + labelRadius * Math.sin(midAngleRad);
            
            const labelText = pieChart.getLabelText(i);
            const labelWidth = this.getTextWidth(labelText, fontSize);
            const labelHeight = fontSize * 1.2;
            
            // ラベルのバウンディングボックスを計算
            const labelLeft = labelX - labelWidth / 2;
            const labelRight = labelX + labelWidth / 2;
            const labelTop = labelY - labelHeight / 2;
            const labelBottom = labelY + labelHeight / 2;
            
            minX = Math.min(minX, labelLeft);
            maxX = Math.max(maxX, labelRight);
            minY = Math.min(minY, labelTop);
            maxY = Math.max(maxY, labelBottom);
        }
        
        // 円グラフ自体の範囲も考慮
        const circleLeft = tempCenterX - tempRadius;
        const circleRight = tempCenterX + tempRadius;
        const circleTop = tempCenterY - tempRadius;
        const circleBottom = tempCenterY + tempRadius;
        
        minX = Math.min(minX, circleLeft);
        maxX = Math.max(maxX, circleRight);
        minY = Math.min(minY, circleTop);
        maxY = Math.max(maxY, circleBottom);
        
        // マージンを追加
        const padding = 20;
        const width = (maxX - minX) + padding * 2;
        const height = (maxY - minY) + padding * 2;
        
        // 半径は、利用可能な高さから計算した最大半径を使う
        // ラベルを含めた幅から計算すると小さくなりすぎるため
        // 高さは固定なので、そこから最大半径を計算
        const actualMaxRadius = availableHeight / 2 - labelPadding;
        const actualRadius = Math.max(50, actualMaxRadius);
        
        return {
            width: width,
            height: height,
            centerX: (minX + maxX) / 2,
            centerY: (minY + maxY) / 2,
            radius: actualRadius,
            minX: minX,
            maxX: maxX,
            minY: minY,
            maxY: maxY
        };
    }

    /**
     * すべての円グラフのラベルを収集して、色のマッピングを作成
     * @returns {Map<string, string>} ラベル名から色へのマッピング
     */
    createLabelColorMap() {
        const labelColorMap = new Map();
        const allLabels = new Set();
        
        // すべての円グラフのラベルを収集
        for (const pieChart of this.pieCharts) {
            if (pieChart.labels) {
                for (const label of pieChart.labels) {
                    allLabels.add(label);
                }
            }
        }
        
        // ラベルをソートして、順番に色を割り当て
        const sortedLabels = Array.from(allLabels).sort();
        const defaultColors = ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#FF6384', '#FF6B9D', '#C44569', '#F8B500', '#00D2FF', '#5E60CE'];
        
        for (let i = 0; i < sortedLabels.length; i++) {
            const label = sortedLabels[i];
            const color = defaultColors[i % defaultColors.length];
            labelColorMap.set(label, color);
        }
        
        return labelColorMap;
    }

    /**
     * 円グラフに色を割り当て
     * @param {PieChart} pieChart - PieChartインスタンス
     * @param {Map<string, string>} labelColorMap - ラベル名から色へのマッピング
     */
    assignColorsToPieChart(pieChart, labelColorMap) {
        if (!pieChart.labels) {
            return;
        }
        
        // 各ラベルに対応する色を設定
        pieChart.assignedColors = [];
        for (const label of pieChart.labels) {
            const color = labelColorMap.get(label) || '#808080'; // デフォルトはグレー
            pieChart.assignedColors.push(color);
        }
    }

    /**
     * 指定された位置に単一の円グラフを描画
     * @param {SVGElement} svg - SVG要素
     * @param {PieChart} pieChart - PieChartインスタンス
     * @param {number} centerX - 円グラフの中心X座標
     * @param {number} chartWidth - 円グラフの描画領域の幅
     * @param {number} radius - 円グラフの半径（オプション、指定されない場合は計算）
     */
    renderSinglePieChartAtPosition(svg, pieChart, centerX, chartWidth, radius = null) {
        if (!pieChart.data || pieChart.data.length === 0) {
            return;
        }

        const fontSize = ChartCanvas.FONT_SIZE_NORMAL;
        const metrics = this.measureFontMetrics(fontSize);
        
        // タイトルとサブタイトルの高さを計算
        let titleHeight = 0;
        if (pieChart.title) {
            titleHeight += fontSize + 5;
        }
        if (pieChart.subtitle) {
            titleHeight += fontSize + 5;
        }
        
        // 円グラフの描画領域を計算
        const margin = 40;
        const availableHeight = this.height - titleHeight - margin * 2;
        
        // 半径が指定されていない場合は計算
        if (radius === null) {
            const availableWidth = chartWidth - margin * 2;
            // ラベルの表示方法に応じて円グラフのサイズを調整
            const labelPadding = 80; // ラベルのための余白
            const maxRadius = Math.min(availableWidth / 2 - labelPadding, availableHeight / 2 - labelPadding);
            radius = Math.max(50, maxRadius); // 最小半径50px
        }
        
        // 円グラフの中心座標
        const centerY = titleHeight + margin + (availableHeight / 2);
        
        // タイトルを描画
        if (pieChart.title) {
            const titleText = VirtualDOM.createElementNS('http://www.w3.org/2000/svg', 'text');
            titleText.setAttribute('class', 'chart-text');
            titleText.setAttribute('x', centerX);
            titleText.setAttribute('y', fontSize + 5);
            titleText.setAttribute('text-anchor', 'middle');
            titleText.setAttribute('style', `font-size: ${fontSize}px; font-weight: bold;`);
            titleText.textContent = pieChart.title;
            svg.appendChild(titleText);
        }
        
        // サブタイトルを描画
        if (pieChart.subtitle) {
            const subtitleText = VirtualDOM.createElementNS('http://www.w3.org/2000/svg', 'text');
            subtitleText.setAttribute('class', 'chart-text');
            subtitleText.setAttribute('x', centerX);
            subtitleText.setAttribute('y', fontSize * 2 + 10);
            subtitleText.setAttribute('text-anchor', 'middle');
            subtitleText.setAttribute('style', `font-size: ${fontSize}px;`);
            subtitleText.textContent = pieChart.subtitle;
            svg.appendChild(subtitleText);
        }
        
        // 350度付近のラベル衝突を解決（小さいカテゴリを「その他」にまとめる）
        const collisionResult = pieChart.resolve350DegreeCollisions(
            centerX,
            centerY,
            radius,
            fontSize,
            this.getTextWidth.bind(this),
            10,  // 最大繰り返し回数
            'その他',  // 「その他」のラベル
            20   // 350度付近の角度範囲（20度）
        );
        
        if (collisionResult.iterations > 0) {
            console.log(`350度付近の衝突を解決: ${collisionResult.iterations}回の繰り返しで${collisionResult.success ? '成功' : '部分的な解決'}`);
        }
        
        // 180度付近（真南）のラベル衝突を解決（右側のラベルを右にずらす）
        const collision180Result = pieChart.resolve180DegreeCollisions(
            centerX,
            centerY,
            radius,
            fontSize,
            this.getTextWidth.bind(this),
            20,  // 最大繰り返し回数
            30,  // 180度付近の角度範囲（30度）
            2    // 1回の調整でずらす角度（2度）
        );
        
        if (collision180Result.iterations > 0) {
            console.log(`180度付近の衝突を解決: ${collision180Result.iterations}回の繰り返しで${collision180Result.success ? '成功' : '部分的な解決'}`);
        }
        
        // セグメントの角度を再計算（衝突解決後のデータで）
        const segmentAngles = pieChart.getSegmentAngles();
        
        // まず、すべての円弧を描画
        for (let i = 0; i < segmentAngles.length; i++) {
            const segment = segmentAngles[i];
            
            // SVGの座標系ではY軸が下向きなので、角度を調整
            // 真北（0度）から時計回りに開始するため、-90度オフセットを適用
            const startAngleDeg = segment.startAngle;
            const endAngleDeg = segment.endAngle;
            
            // 度をラジアンに変換（SVG座標系用に調整：真北を0度として時計回り）
            const startAngleRad = ((startAngleDeg - 90) * Math.PI) / 180;
            const endAngleRad = ((endAngleDeg - 90) * Math.PI) / 180;
            
            // 色を取得（割り当てられた色を使用）
            let color;
            const label = pieChart.labels[i];
            const isOthers = label === 'その他' || label === 'Others';
            
            if (isOthers) {
                // 「その他」カテゴリはグレー
                color = '#808080'; // グレー
            } else if (pieChart.assignedColors && pieChart.assignedColors[i]) {
                // 割り当てられた色を使用
                color = pieChart.assignedColors[i];
            } else {
                // フォールバック: デフォルトの色を使用
                color = pieChart.colors[i % pieChart.colors.length];
            }
            
            // 開始点と終了点の座標を計算
            const startX = centerX + radius * Math.cos(startAngleRad);
            const startY = centerY + radius * Math.sin(startAngleRad);
            const endX = centerX + radius * Math.cos(endAngleRad);
            const endY = centerY + radius * Math.sin(endAngleRad);
            
            // 円弧の角度差を計算
            let angleDiff = endAngleDeg - startAngleDeg;
            if (angleDiff < 0) {
                angleDiff += 360;
            }
            
            // 大きな円弧かどうかを判定（180度を超える場合）
            const largeArcFlag = angleDiff > 180 ? 1 : 0;
            
            // SVGパスを生成
            // M: 中心点に移動
            // L: 開始点まで線を引く
            // A: 円弧を描く（半径、半径、回転、大きな円弧フラグ、時計回り、終了点）
            // Z: パスを閉じる（中心点に戻る）
            const pathData = `M ${centerX} ${centerY} L ${startX} ${startY} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${endX} ${endY} Z`;
            
            // パス要素を作成
            const path = VirtualDOM.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', pathData);
            path.setAttribute('fill', color);
            path.setAttribute('stroke', '#fff');
            path.setAttribute('stroke-width', '2');
            svg.appendChild(path);
        }
        
        // 次に、すべてのラベルを描画（円弧の上に表示されるように）
        for (let i = 0; i < segmentAngles.length; i++) {
            const segment = segmentAngles[i];
            
            // ラベルを描画
            const labelPosition = pieChart.determineLabelPosition(i);
            if (labelPosition === 'arc-center') {
                // 外縁の円弧の中心にラベルを配置（角度オフセットを適用）
                let midAngleDeg = (segment.startAngle + segment.endAngle) / 2;
                const angleOffset = pieChart.labelAngleOffsets[i] || 0;
                midAngleDeg += angleOffset; // 角度オフセットを適用
                const midAngleRad = ((midAngleDeg - 90) * Math.PI) / 180; // SVG座標系用に調整
                const labelRadius = radius + 20; // 円の外側に配置
                const labelX = centerX + labelRadius * Math.cos(midAngleRad);
                const labelY = centerY + labelRadius * Math.sin(midAngleRad);
                
                const labelText = VirtualDOM.createElementNS('http://www.w3.org/2000/svg', 'text');
                labelText.setAttribute('class', 'chart-text');
                labelText.setAttribute('x', labelX);
                labelText.setAttribute('y', labelY);
                labelText.setAttribute('text-anchor', 'middle');
                labelText.setAttribute('dominant-baseline', 'middle');
                labelText.setAttribute('style', `font-size: ${fontSize}px;`);
                labelText.textContent = pieChart.getLabelText(i);
                svg.appendChild(labelText);
            } else if (labelPosition === 'leader-line') {
                // 引出線（リーダーライン）を出すタイプ（角度オフセットを適用）
                let midAngleDeg = (segment.startAngle + segment.endAngle) / 2;
                const angleOffset = pieChart.labelAngleOffsets[i] || 0;
                midAngleDeg += angleOffset; // 角度オフセットを適用
                const midAngleRad = ((midAngleDeg - 90) * Math.PI) / 180; // SVG座標系用に調整
                const labelRadius = radius + 30; // 円の外側に配置
                const labelX = centerX + labelRadius * Math.cos(midAngleRad);
                const labelY = centerY + labelRadius * Math.sin(midAngleRad);
                
                // 引出線を描画
                const lineStartX = centerX + radius * Math.cos(midAngleRad);
                const lineStartY = centerY + radius * Math.sin(midAngleRad);
                const lineEndX = labelX;
                const lineEndY = labelY;
                
                const line = VirtualDOM.createElementNS('http://www.w3.org/2000/svg', 'line');
                line.setAttribute('x1', lineStartX);
                line.setAttribute('y1', lineStartY);
                line.setAttribute('x2', lineEndX);
                line.setAttribute('y2', lineEndY);
                line.setAttribute('stroke', '#333');
                line.setAttribute('stroke-width', '1');
                svg.appendChild(line);
                
                // ラベルを描画
                const labelText = VirtualDOM.createElementNS('http://www.w3.org/2000/svg', 'text');
                labelText.setAttribute('class', 'chart-text');
                labelText.setAttribute('x', labelX);
                labelText.setAttribute('y', labelY);
                labelText.setAttribute('text-anchor', 'middle');
                labelText.setAttribute('dominant-baseline', 'middle');
                labelText.setAttribute('style', `font-size: ${fontSize}px;`);
                labelText.textContent = pieChart.getLabelText(i);
                svg.appendChild(labelText);
            }
        }
        
        // 凡例は描画しない（ラベルで情報を表示するため）
    }

    /**
     * 円グラフの凡例を描画
     * @param {SVGElement} svg - SVG要素
     * @param {PieChart} pieChart - PieChartインスタンス
     */
    renderPieChartLegend(svg, pieChart) {
        const legendFontSize = ChartCanvas.FONT_SIZE_NORMAL;
        const legendMargin = 20;
        const legendStartY = this.height - 100; // 下から100px上に配置
        const legendItemHeight = 25;
        const iconWidth = 20;
        const iconHeight = 12;
        const iconLabelGap = 10;
        const legendPadding = 10;

        // 凡例項目を収集
        const legendItems = [];
        for (let i = 0; i < pieChart.labels.length; i++) {
            legendItems.push({
                title: pieChart.labels[i],
                color: pieChart.colors[i % pieChart.colors.length]
            });
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
        const legendAreaX = (this.width - legendAreaWidth) / 2; // 中央に配置
        const legendX = legendAreaX + legendPadding;

        // 凡例項目を描画
        let currentY = legendStartY;
        for (const item of legendItems) {
            const iconX = legendX;
            const iconY = currentY - iconHeight / 2;

            // 円グラフのアイコンを描画（小さな円）
            const circle = VirtualDOM.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('cx', iconX + iconWidth / 2);
            circle.setAttribute('cy', iconY + iconHeight / 2);
            circle.setAttribute('r', iconHeight / 2);
            circle.setAttribute('fill', item.color);
            circle.setAttribute('stroke', '#fff');
            circle.setAttribute('stroke-width', '1');
            svg.appendChild(circle);

            // ラベルを描画
            const labelX = iconX + iconWidth + iconLabelGap;
            const labelY = currentY;
            const labelText = VirtualDOM.createElementNS('http://www.w3.org/2000/svg', 'text');
            labelText.setAttribute('class', 'chart-text');
            labelText.setAttribute('x', labelX);
            labelText.setAttribute('y', labelY);
            labelText.setAttribute('dominant-baseline', 'middle');
            labelText.setAttribute('style', `font-size: ${legendFontSize}px;`);
            labelText.textContent = item.title;
            svg.appendChild(labelText);

            currentY += legendItemHeight;
        }
    }
}

// グローバルスコープに公開
window.ChartCanvas = ChartCanvas;
window.DateChart = DateChart;
window.LineSeries = LineSeries;
window.BarSeries = BarSeries;
window.TSVLoader = TSVLoader;
window.normalizeDate = normalizeDate;
window.HistogramChart = HistogramChart;
window.HistogramSeries = HistogramSeries;
window.HistogramTSVLoader = HistogramTSVLoader;
window.PieChart = PieChart;
window.PieTsvLoader = PieTsvLoader;
