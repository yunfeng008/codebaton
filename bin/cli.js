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
  console.log('  · 任何 agent 工具开工，第一句话：' + c.cyan('按 AGENTS.md 接手'));
  console.log(c.dim('    （AGENTS.md 已写明开工前必读 TASKS.md / HANDOFF.md，一句话够用；npx codebaton brief 取口令）'));
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

// ---------- brief（开工口令）----------

function cmdBrief() {
  const line = '按 AGENTS.md 接手';
  console.log('开工口令（发给任意 agent 工具的第一句话）：\n');
  console.log(c.bold('  ' + line) + '\n');
  let copied = false;
  try {
    const cp = process.platform === 'darwin' ? 'pbcopy' : process.platform === 'win32' ? 'clip' : 'wl-copy';
    execFileSync(cp, { input: line, stdio: ['pipe', 'ignore', 'ignore'] });
    copied = true;
  } catch { /* 无剪贴板工具也不影响 */ }
  if (copied) console.log(c.dim('（已复制到剪贴板）\n'));
  console.log('为什么一句话就够：AGENTS.md 里已写明"开工前先读 TASKS.md 和 HANDOFF.md"，');
  console.log('协议住在文件里，口令只负责叫门。');
  console.log(c.dim('若某工具不自动读 AGENTS.md，用完整版："读 AGENTS.md、TASKS.md、HANDOFF.md，继续进行中任务"'));
}

// ---------- dig（猝死考古口令）----------

function cmdDig() {
  const lines = [
    '按 AGENTS.md 接手，但上一工具疑似中途断掉、可能有半成品改动。先考古再动手：',
    '1. 跑 AGENTS.md 里的最小验证命令（如 mvn -pl <模块> -am compile / npm test），记下报错位置——半截改动会自己暴露在报错里',
    '2. git log --oneline -5 与 git diff 看最近提交和未提交改动',
    '3. 读 TASKS.md「进行中」条目的口径，与改动对照，推断改到哪一步、还差什么',
    '4. 输出：① 断点位置 ② 推断的意图 ③ 完成计划 ④ 拿不准的问题清单；等我确认后再改代码',
  ];
  const prompt = lines.join('\n');
  console.log('考古口令（上一工具没写交接就断了时，发给接手工具）：\n');
  console.log(c.bold(prompt) + '\n');
  let copied = false;
  try {
    const cp = process.platform === 'darwin' ? 'pbcopy' : process.platform === 'win32' ? 'clip' : 'wl-copy';
    execFileSync(cp, { input: prompt, stdio: ['pipe', 'ignore', 'ignore'] });
    copied = true;
  } catch { /* 无剪贴板工具也不影响 */ }
  if (copied) console.log(c.dim('（已复制到剪贴板）\n'));
  console.log('适用场景：会话 token 用完/崩溃，没来得及跑 handoff。');
  console.log('预防胜于考古：每完成一个小步骤就跑验证命令 + commit，把半成品窗口压到分钟级。');
}

// ---------- check（三件套健康检查）----------

function cmdCheck(targetDir) {
  targetDir = path.resolve(targetDir || process.cwd());
  console.log(c.bold(`🩺 三件套健康检查（${path.basename(targetDir)}）\n`));
  let problems = 0;

  // 1. 存在性
  const missing = FILES.filter((f) => !fs.existsSync(path.join(targetDir, f)));
  if (missing.length) {
    console.log(c.red(`✗ 缺少文件：${missing.join('、')}（先跑 npx codebaton init）`));
    problems += missing.length;
    console.log('');
    return;
  }
  console.log(c.green('✓ AGENTS.md / TASKS.md / HANDOFF.md 齐全'));

  // 2. 占位符是否已填
  const agents = fs.readFileSync(path.join(targetDir, 'AGENTS.md'), 'utf8');
  const phCount = (agents.match(/【占位[：:]/g) || []).length;
  if (phCount) {
    console.log(c.yellow(`⚠ AGENTS.md 还有 ${phCount} 处【占位】未填——新工具读到的是空协议`));
    problems++;
  } else {
    console.log(c.green('✓ AGENTS.md 占位符已填完'));
  }

  // 3. git 基线与新鲜度
  if (git(['rev-parse', '--is-inside-work-tree'], targetDir) !== 'true') {
    console.log(c.yellow('⚠ 不是 git 仓库：三件套没有基线，接手方无法对账（协议要求 git 作状态层）'));
    problems++;
    console.log('');
    return;
  }
  const porcelain = git(['status', '--porcelain'], targetDir) || '';
  const untracked = FILES.filter((f) => porcelain.split('\n').some((l) => l.startsWith('??') && l.trim().endsWith(f)));
  if (untracked.length) {
    console.log(c.yellow(`⚠ ${untracked.join('、')} 未提交入库——没有基线，agent 改文档将无法 diff 对账（dkkfly-boot 的教训）`));
    problems++;
  } else {
    console.log(c.green('✓ 三件套已入 git 基线'));
    const docHash = git(['log', '-1', '--format=%H', '--', 'TASKS.md', 'HANDOFF.md'], targetDir);
    const headHash = git(['rev-parse', 'HEAD'], targetDir);
    if (docHash && headHash && docHash !== headHash) {
      const behind = parseInt(git(['rev-list', '--count', docHash + '..' + headHash], targetDir) || '0', 10);
      const docDate = git(['log', '-1', '--format=%cs', '--', 'TASKS.md', 'HANDOFF.md'], targetDir);
      if (behind > 0) {
        const level = behind >= 10 ? c.red : behind >= 3 ? c.yellow : c.dim;
        console.log(level(`⚠ 三件套最后更新于 ${docDate}，已落后 HEAD ${behind} 个提交——文档可能过期，建议收尾时跑 npx codebaton handoff`));
        if (behind >= 10) problems++;
      } else {
        console.log(c.green('✓ 三件套与 HEAD 同步'));
      }
    }
  }

  console.log('');
  console.log(problems ? c.yellow(`发现 ${problems} 类问题，见上。`) : c.green('一切正常。'));
}

// ---------- 入口 ----------

const HELP = `
${c.bold('codebaton')} — 跨 AI 编程工具接力协议（ZCode / DeepSeek / Kimi / MiniMax / Claude Code …）

用法：
  npx codebaton init [目录]     生成三件套（AGENTS.md / TASKS.md / HANDOFF.md，已存在的不覆盖）
  npx codebaton brief           开工口令：一句话让任意工具接手（自动复制到剪贴板）
  npx codebaton dig             考古口令：上一工具猝死没写交接时，让接手者先定位半成品再动手
  npx codebaton check [目录]    三件套健康检查：齐全性/占位符/git 基线/文档是否落后提交
  npx codebaton handoff [目录]  用 git 事实自动起草交接，交给当前 agent 合并进 HANDOFF.md
  npx codebaton board [目录]    终端渲染 TASKS.md 任务看板

理念：会话不能跨工具迁移，文件可以。谁收尾，谁写交接。
`;

const [, , cmd, ...rest] = process.argv;
switch (cmd) {
  case 'init': cmdInit(rest[0]); break;
  case 'brief': cmdBrief(); break;
  case 'dig': cmdDig(); break;
  case 'check': cmdCheck(rest[0]); break;
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
