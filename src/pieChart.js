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

