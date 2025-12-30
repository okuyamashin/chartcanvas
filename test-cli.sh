#!/bin/bash

# ChartCanvas CLI テストスクリプト
# 
# このスクリプトは、CLIツールのテストを実行します。
# 各テストケースは設定JSONとTSVファイルを使用してCLIを実行し、
# 結果を検証します。

set -e  # エラーが発生したら終了

# カラー出力用
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# テスト用ディレクトリ
TEST_DIR="test-cli-output"
CONFIG_DIR="test-cli-configs"
SAMPLE_DATA_DIR="docs/sample"

# テスト結果
PASSED=0
FAILED=0

# テスト出力ディレクトリを作成
mkdir -p "$TEST_DIR"
mkdir -p "$CONFIG_DIR"

# テストケースを実行
run_test() {
    local test_name="$1"
    local config_file="$2"
    local tsv_file="$3"
    local expected_exit_code="${4:-1}"  # デフォルトは失敗（未実装のため）
    
    echo -e "${YELLOW}[テスト] ${test_name}${NC}"
    
    # TSVファイルの存在確認
    if [ ! -f "$tsv_file" ]; then
        echo -e "${RED}  ✗ TSVファイルが見つかりません: ${tsv_file}${NC}"
        FAILED=$((FAILED + 1))
        return
    fi
    
    # 設定ファイルの存在確認
    if [ ! -f "$config_file" ]; then
        echo -e "${RED}  ✗ 設定ファイルが見つかりません: ${config_file}${NC}"
        FAILED=$((FAILED + 1))
        return
    fi
    
    # 出力ファイル名を生成
    local output_file="${TEST_DIR}/${test_name}.svg"
    
    # CLIを実行
    if cat "$tsv_file" | node cli.js -c "$config_file" > "$output_file" 2>&1; then
        exit_code=$?
    else
        exit_code=$?
    fi
    
    # 終了コードをチェック
    if [ "$exit_code" -eq "$expected_exit_code" ]; then
        echo -e "${GREEN}  ✓ 期待通りの終了コード: ${exit_code}${NC}"
        PASSED=$((PASSED + 1))
    else
        echo -e "${RED}  ✗ 予期しない終了コード: ${exit_code} (期待値: ${expected_exit_code})${NC}"
        echo "  出力の最後の10行:"
        tail -n 10 "$output_file" | sed 's/^/    /'
        FAILED=$((FAILED + 1))
    fi
}

# テストケース1: dateChart（線/棒 日付グラフ）
echo "=== テストケース1: dateChart（線/棒 日付グラフ） ==="
cat > "${CONFIG_DIR}/test-datechart.json" << 'EOF'
{
  "chart": {
    "width": 1024,
    "height": 600,
    "title": "売上・客数推移",
    "subtitle": "7日分のデータ"
  },
  "chartType": "dateChart",
  "dateChart": {
    "xAxisTitle": "日付",
    "yAxisTitle": "売上",
    "yAxisScale": "円",
    "yAxisFormat": "#,##0",
    "secondAxis": true,
    "secondAxisTitle": "客数",
    "secondAxisScale": "人",
    "secondAxisFormat": "#,##0",
    "dateFormat": "auto",
    "xGrid": false,
    "yGrid": false
  },
  "tsv": {
    "dateTitle": "日付",
    "commentTitle": "コメント",
    "series": [
      {
        "type": "line",
        "title": "売上",
        "column": "売上",
        "color": "red",
        "lineWidth": 2,
        "lineType": "solid",
        "secondAxis": false,
        "showMarkers": true
      },
      {
        "type": "bar",
        "title": "客数",
        "column": "客数",
        "color": "blue",
        "secondAxis": true
      }
    ]
  }
}
EOF
run_test "test-datechart" "${CONFIG_DIR}/test-datechart.json" "${SAMPLE_DATA_DIR}/data-7days.tsv" 0

# テストケース2: groupDateChart（グループ線 日付グラフ）
echo ""
echo "=== テストケース2: groupDateChart（グループ線 日付グラフ） ==="
cat > "${CONFIG_DIR}/test-groupdatechart.json" << 'EOF'
{
  "chart": {
    "width": 1024,
    "height": 600,
    "title": "店舗別売上推移"
  },
  "chartType": "groupDateChart",
  "dateChart": {
    "xAxisTitle": "日付",
    "yAxisTitle": "売上",
    "yAxisScale": "円",
    "yAxisFormat": "#,##0",
    "dateFormat": "auto",
    "xGrid": true,
    "yGrid": true
  },
  "tsv": {
    "dateTitle": "日付",
    "valueTitle": "売上",
    "groupTitle": "店舗名",
    "commentTitle": "コメント",
    "seriesType": "line",
    "seriesOptions": {
      "lineWidth": 2,
      "lineType": "solid",
      "showMarkers": true
    }
  }
}
EOF
run_test "test-groupdatechart" "${CONFIG_DIR}/test-groupdatechart.json" "${SAMPLE_DATA_DIR}/data.tsv" 0

# テストケース3: histogram（単一系列）
echo ""
echo "=== テストケース3: histogram（単一系列） ==="
cat > "${CONFIG_DIR}/test-histogram-single.json" << 'EOF'
{
  "chart": {
    "width": 1024,
    "height": 600,
    "title": "売上の分布"
  },
  "chartType": "histogram",
  "histogram": {
    "xAxisTitle": "売上",
    "yAxisTitle": "頻度",
    "xAxisFormat": "#,##0",
    "yAxisFormat": "#,##0",
    "curveMode": false,
    "xGrid": false,
    "yGrid": false
  },
  "tsv": {
    "valueTitle": "値"
  }
}
EOF
run_test "test-histogram-single" "${CONFIG_DIR}/test-histogram-single.json" "${SAMPLE_DATA_DIR}/data-histogram.tsv" 0

# テストケース4: histogram（グループ別）
echo ""
echo "=== テストケース4: histogram（グループ別） ==="
cat > "${CONFIG_DIR}/test-histogram-group.json" << 'EOF'
{
  "chart": {
    "width": 1024,
    "height": 600,
    "title": "売上の分布（店舗別）",
    "subtitle": "各店舗の売上データの分布を比較"
  },
  "chartType": "histogram",
  "histogram": {
    "xAxisTitle": "売上",
    "yAxisTitle": "頻度",
    "xAxisFormat": "#,##0",
    "yAxisFormat": "#,##0",
    "curveMode": true,
    "xGrid": true,
    "yGrid": true
  },
  "tsv": {
    "valueTitle": "値",
    "groupTitle": "店舗名"
  }
}
EOF
run_test "test-histogram-group" "${CONFIG_DIR}/test-histogram-group.json" "${SAMPLE_DATA_DIR}/data-histogram-multi-store.tsv" 0

# テストケース5: 設定ファイルが見つからない場合
echo ""
echo "=== テストケース5: 設定ファイルが見つからない場合 ==="
if cat "${SAMPLE_DATA_DIR}/data-7days.tsv" | node cli.js -c "nonexistent.json" > "${TEST_DIR}/test-error-config-not-found.log" 2>&1; then
    exit_code=$?
else
    exit_code=$?
fi
if [ "$exit_code" -eq 1 ]; then
    echo -e "${GREEN}  ✓ 期待通りのエラー（終了コード: 1）${NC}"
    PASSED=$((PASSED + 1))
else
    echo -e "${RED}  ✗ 予期しない終了コード: ${exit_code} (期待値: 1)${NC}"
    FAILED=$((FAILED + 1))
fi

# テストケース6: 無効なJSON
echo ""
echo "=== テストケース6: 無効なJSON ==="
if echo 'invalid json' | node cli.js -j 'invalid json' > "${TEST_DIR}/test-error-invalid-json.log" 2>&1; then
    exit_code=$?
else
    exit_code=$?
fi
if [ "$exit_code" -eq 1 ]; then
    echo -e "${GREEN}  ✓ 期待通りのエラー（終了コード: 1）${NC}"
    PASSED=$((PASSED + 1))
else
    echo -e "${RED}  ✗ 予期しない終了コード: ${exit_code} (期待値: 1)${NC}"
    FAILED=$((FAILED + 1))
fi

# テストケース7: 必須項目が不足している場合
echo ""
echo "=== テストケース7: 必須項目が不足している場合 ==="
cat > "${CONFIG_DIR}/test-missing-field.json" << 'EOF'
{
  "chart": {
    "title": "テスト"
  }
}
EOF
if cat "${SAMPLE_DATA_DIR}/data-7days.tsv" | node cli.js -c "${CONFIG_DIR}/test-missing-field.json" > "${TEST_DIR}/test-error-missing-field.log" 2>&1; then
    exit_code=$?
else
    exit_code=$?
fi
if [ "$exit_code" -eq 1 ]; then
    echo -e "${GREEN}  ✓ 期待通りのエラー（終了コード: 1）${NC}"
    PASSED=$((PASSED + 1))
else
    echo -e "${RED}  ✗ 予期しない終了コード: ${exit_code} (期待値: 1)${NC}"
    FAILED=$((FAILED + 1))
fi

# テストケース8: ヘルプの表示
echo ""
echo "=== テストケース8: ヘルプの表示 ==="
if node cli.js --help > "${TEST_DIR}/test-help.log" 2>&1; then
    exit_code=$?
else
    exit_code=$?
fi
if [ "$exit_code" -eq 0 ]; then
    echo -e "${GREEN}  ✓ ヘルプが正常に表示されました（終了コード: 0）${NC}"
    PASSED=$((PASSED + 1))
else
    echo -e "${RED}  ✗ 予期しない終了コード: ${exit_code} (期待値: 0)${NC}"
    FAILED=$((FAILED + 1))
fi

# テストケース9: バージョンの表示
echo ""
echo "=== テストケース9: バージョンの表示 ==="
if node cli.js --version > "${TEST_DIR}/test-version.log" 2>&1; then
    exit_code=$?
else
    exit_code=$?
fi
if [ "$exit_code" -eq 0 ]; then
    echo -e "${GREEN}  ✓ バージョンが正常に表示されました（終了コード: 0）${NC}"
    PASSED=$((PASSED + 1))
else
    echo -e "${RED}  ✗ 予期しない終了コード: ${exit_code} (期待値: 0)${NC}"
    FAILED=$((FAILED + 1))
fi

# 結果を表示
echo ""
echo "=== テスト結果 ==="
echo -e "${GREEN}成功: ${PASSED}${NC}"
echo -e "${RED}失敗: ${FAILED}${NC}"
echo "合計: $((PASSED + FAILED))"

if [ "$FAILED" -eq 0 ]; then
    echo -e "${GREEN}すべてのテストが成功しました！${NC}"
    exit 0
else
    echo -e "${RED}一部のテストが失敗しました。${NC}"
    exit 1
fi

