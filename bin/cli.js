#!/usr/bin/env node
/**
 * codebaton — 跨 AI 编程工具接力协议
 * 命令：init（生成三件套）/ handoff（自动起草交接）/ board（终端看板）
 * 零依赖，Node >= 16
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const TEMPLATES_DIR = path.join(__dirname, '..', 'templates');
const FILES = ['AGENTS.md', 'TASKS.md', 'HANDOFF.md'];

const c = {
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
};

function git(args, cwd) {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
  } catch (e) {
    return null;
  }
}

function detectStack(dir) {
  const hints = [];
  if (fs.existsSync(path.join(dir, 'package.json'))) hints.push('Node.js（验证命令建议：npm test / npm run build）');
  if (fs.existsSync(path.join(dir, 'pom.xml'))) hints.push('Java Maven（验证命令建议：mvn -pl <模块> -am compile）');
  if (fs.existsSync(path.join(dir, 'go.mod'))) hints.push('Go（验证命令建议：go build ./... && go test ./...）');
  if (fs.existsSync(path.join(dir, 'requirements.txt')) || fs.existsSync(path.join(dir, 'pyproject.toml')))
    hints.push('Python（验证命令建议：pytest）');
  if (fs.existsSync(path.join(dir, 'Cargo.toml'))) hints.push('Rust（验证命令建议：cargo test）');
  return hints;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

// ---------- init ----------

function cmdInit(targetDir) {
  targetDir = path.resolve(targetDir || process.cwd());
  if (!fs.existsSync(targetDir)) {
    console.error(c.red(`✗ 目录不存在：${targetDir}`));
    process.exit(1);
  }
  const projectName = path.basename(targetDir);
  const isGit = git(['rev-parse', '--is-inside-work-tree'], targetDir) === 'true';
  if (!isGit) {
    console.log(c.yellow('⚠ 当前目录不是 git 仓库。三件套已可用，但跨工具接力的状态层靠 git，建议尽快 git init 并提交。'));
  }

  let created = 0, skipped = 0;
  for (const name of FILES) {
    const dest = path.join(targetDir, name);
    if (fs.existsSync(dest)) {
      console.log(c.yellow(`↷ ${name} 已存在，跳过（不覆盖）`));
      skipped++;
      continue;
    }
    const tpl = fs.readFileSync(path.join(TEMPLATES_DIR, name), 'utf8');
    fs.writeFileSync(dest, tpl.replace(/\{\{PROJECT_NAME\}\}/g, projectName));
    console.log(c.green(`✓ 生成 ${name}`));
    created++;
  }

  const hints = detectStack(targetDir);
  console.log('');
  console.log(c.bold(`完成：新建 ${created} 个，跳过 ${skipped} 个。`));
  console.log('');
  console.log('下一步（三处占位符填完才算生效）：');
  console.log('  1. AGENTS.md   — 项目一句话定位、构建/验证命令、红线');
  if (hints.length) console.log(c.dim(`     检测到：${hints.join('；')}`));
  console.log('  2. TASKS.md    — 把想做的事写进"⬜ 待办"');
  console.log('  3. HANDOFF.md  — 当前状态（新项目可基本留空）');
  console.log('');
  console.log('之后的工作流：');
  console.log('  · 任何 agent 工具开工前，第一句话：' + c.cyan('"读 AGENTS.md、TASKS.md、HANDOFF.md，继续进行中任务"'));
  console.log('  · 换工具/收尾前，运行 ' + c.cyan('npx codebaton handoff') + ' 起草交接，让 agent 合并进 HANDOFF.md');
  console.log('  · npx codebaton board 随时看任务面板');
}

// ---------- handoff ----------

function cmdHandoff(targetDir) {
  targetDir = path.resolve(targetDir || process.cwd());
  if (git(['rev-parse', '--is-inside-work-tree'], targetDir) !== 'true') {
    console.error(c.red('✗ 当前目录不是 git 仓库，handoff 依赖 git 收集状态。'));
    process.exit(1);
  }
  const branch = git(['rev-parse', '--abbrev-ref', 'HEAD'], targetDir) || '(未知)';
  const status = git(['status', '--porcelain'], targetDir) || '';
  const log = git(['log', '--oneline', '-5'], targetDir) || '(无提交)';
  const diffStat = git(['diff', 'HEAD', '--stat'], targetDir) || '(无未提交改动)';

  const statusLines = status
    ? status.split('\n').map((l) => '  - ' + l).join('\n')
    : '  （工作区干净，无未提交改动）';

  const draft = `## 交接草稿（codebaton handoff 自动生成于 ${today()}）

- 当前分支：\`${branch}\`
- 未提交改动：${status ? status.split('\n').length + ' 个文件' : '无'}
${statusLines}
- 最近提交：
${log.split('\n').map((l) => '  - ' + l).join('\n')}
- 改动统计：
${diffStat.split('\n').map((l) => '  ' + l).join('\n')}

> 请当前 agent 在此基础上补全并合并进 HANDOFF.md：本轮做了什么、关键决定及原因、踩过的坑、下一步（按优先级）。补全后删除本段。
`;

  const draftPath = path.join(targetDir, 'HANDOFF.draft.md');
  fs.writeFileSync(draftPath, draft);
  console.log(c.green(`✓ 交接草稿已写入 ${path.relative(process.cwd(), draftPath) || draftPath}`));
  console.log('');
  console.log('把它交给当前 agent，说：');
  console.log(c.cyan('  "读 HANDOFF.draft.md，结合本轮会话补全交接（做了什么/为什么/坑/下一步），合并进 HANDOFF.md 后删除草稿"'));
  console.log('');
  console.log(c.dim('—— 交接草稿内容 ——'));
  console.log(draft);
}

// ---------- board ----------

const SECTIONS = [
  { key: '🔨 进行中', label: '🔨 进行中' },
  { key: '👀 待用户验证', label: '👀 待用户验证' },
  { key: '⬜ 待办', label: '⬜ 待办' },
  { key: '✅ 最近完成', label: '✅ 最近完成' },
];

function cmdBoard(targetDir) {
  targetDir = path.resolve(targetDir || process.cwd());
  const tasksPath = path.join(targetDir, 'TASKS.md');
  if (!fs.existsSync(tasksPath)) {
    console.error(c.red('✗ 未找到 TASKS.md，先运行 npx codebaton init'));
    process.exit(1);
  }
  const lines = fs.readFileSync(tasksPath, 'utf8').split('\n');
  const buckets = {};
  let current = null;
  for (const line of lines) {
    const sec = SECTIONS.find((s) => line.startsWith('## ') && line.includes(s.key));
    if (sec) { current = sec.key; buckets[current] = []; continue; }
    if (current) {
      const t = line.trim();
      if (t && !t.startsWith('>')) buckets[current].push(t.replace(/^- /, ''));
    }
  }
  console.log(c.bold(`📋 任务看板（${path.basename(targetDir)}）\n`));
  for (const sec of SECTIONS) {
    const items = buckets[sec.key] || [];
    console.log(c.bold(sec.label) + c.dim(` (${items.length})`));
    if (!items.length) console.log(c.dim('  （空）'));
    for (const it of items.slice(0, 6)) {
      console.log('  · ' + (it.length > 72 ? it.slice(0, 72) + '…' : it));
    }
    if (items.length > 6) console.log(c.dim(`  …共 ${items.length} 条`));
    console.log('');
  }
}

// ---------- 入口 ----------

const HELP = `
${c.bold('codebaton')} — 跨 AI 编程工具接力协议（ZCode / DeepSeek / Kimi / MiniMax / Claude Code …）

用法：
  npx codebaton init [目录]     生成三件套（AGENTS.md / TASKS.md / HANDOFF.md，已存在的不覆盖）
  npx codebaton handoff [目录]  用 git 事实自动起草交接，交给当前 agent 合并进 HANDOFF.md
  npx codebaton board [目录]    终端渲染 TASKS.md 任务看板

理念：会话不能跨工具迁移，文件可以。谁收尾，谁写交接。
`;

const [, , cmd, ...rest] = process.argv;
switch (cmd) {
  case 'init': cmdInit(rest[0]); break;
  case 'handoff': cmdHandoff(rest[0]); break;
  case 'board': cmdBoard(rest[0]); break;
  case undefined:
  case '-h':
  case '--help':
  case 'help':
    console.log(HELP); break;
  default:
    console.error(c.red(`未知命令：${cmd}`));
    console.log(HELP);
    process.exit(1);
}
