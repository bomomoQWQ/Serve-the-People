#!/usr/bin/env bash
set -euo pipefail

# ─── 为人民服务 · 安装脚本 ───

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "========================================"
echo "  为人民服务 · Serve the People"
echo "  OpenCode 插件安装"
echo "========================================"
echo ""

# ─── 检查 Bun ───
if ! command -v bun &> /dev/null; then
  echo "Error: 需要 Bun (https://bun.sh)"
  echo "  安装: curl -fsSL https://bun.sh/install | bash"
  exit 1
fi
echo "[OK] Bun $(bun --version)"

# ─── 检查 OpenCode ───
OPENCODE_CONFIG=""
if command -v opencode &> /dev/null; then
  echo "[OK] OpenCode 已安装"
  # 搜索配置文件
  for candidate in "$HOME/.config/opencode/opencode.jsonc" "$HOME/.opencode.json" "./.opencode/opencode.jsonc"; do
    if [ -f "$candidate" ]; then
      OPENCODE_CONFIG="$candidate"
      break
    fi
  done
  if [ -z "$OPENCODE_CONFIG" ]; then
    echo "[WARN] 未找到 OpenCode 配置文件，将创建默认文件"
    OPENCODE_CONFIG="$HOME/.config/opencode/opencode.jsonc"
  fi
else
  echo "[WARN] 未检测到 OpenCode CLI"
  echo "  请先安装 OpenCode: https://opencode.ai/docs"
  echo "  安装完成后重新运行此脚本"
fi
echo ""

# ─── 安装依赖 + 构建 ───
echo "=> 安装依赖..."
bun install
echo ""

echo "=> 构建..."
bun run build
echo ""

# ─── 检查构建产物 ───
if [ ! -f "dist/index.js" ]; then
  echo "Error: 构建失败，未生成 dist/index.js"
  exit 1
fi
echo "[OK] 构建成功 (dist/index.js)"

# ─── 注册到 OpenCode ───
if [ -n "$OPENCODE_CONFIG" ]; then
  CONFIG_DIR="$(dirname "$OPENCODE_CONFIG")"
  mkdir -p "$CONFIG_DIR"

  PLUGIN_PATH="$SCRIPT_DIR"

  if [ -f "$OPENCODE_CONFIG" ]; then
    # 检查是否已注册
    if grep -q "$PLUGIN_PATH" "$OPENCODE_CONFIG" 2>/dev/null; then
      echo "[OK] 插件已在 OpenCode 配置中注册"
    else
      echo "=> 注册插件到 $OPENCODE_CONFIG"
      # Detect OS for sed compatibility
      if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' 's/"plugin"\s*:\s*\[/"plugin": ["'"$PLUGIN_PATH"'", /' "$OPENCODE_CONFIG" 2>/dev/null || {
          echo "[WARN] sed failed, writing new config"
          cat > "$OPENCODE_CONFIG" << EOF
{ "plugin": ["$PLUGIN_PATH"] }
EOF
        }
      else
        sed -i 's/"plugin"\s*:\s*\[/"plugin": ["'"$PLUGIN_PATH"'", /' "$OPENCODE_CONFIG" 2>/dev/null || {
          echo "[WARN] sed failed, writing new config"
          cat > "$OPENCODE_CONFIG" << EOF
{ "plugin": ["$PLUGIN_PATH"] }
EOF
        }
      fi
      echo "[OK] 已注册（如 sed 失败已创建新文件）"
    fi
  else
    echo "=> 创建 OpenCode 配置文件 $OPENCODE_CONFIG"
    cat > "$OPENCODE_CONFIG" << EOF
{
  "plugin": ["$PLUGIN_PATH"]
}
EOF
    echo "[OK] 配置已创建"
  fi
fi
echo ""

# ─── 完成 ───
echo "========================================"
echo "  安装完成！"
echo ""
echo "  重启 OpenCode 后即可使用以下 Agent:"
echo "  - guowuyuan (国务院)"
echo "  - fagaiwei  (发改委)"
echo "  - jianwei   (国家监委)"
echo "  - shenjishu (审计署)"
echo "  - danganju  (档案局)"
echo "  - kejibu    (科技部)"
echo "  - gongxinbu (工信部)"
echo "  - yingjibu  (应急管理部)"
echo "  - zhujianbu (住建部)"
echo "  - jiaoyubu  (教育部)"
echo "  - oracle    (技术顾问)"
echo "  - librarian (文档搜索)"
echo "  - explore   (代码搜索)"
echo ""
echo "  模型配置: 编辑项目根目录的 .opencode/serve-the-people.jsonc"
echo "  插件注册: $OPENCODE_CONFIG"
echo "========================================"
