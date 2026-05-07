/* ============================================================
 *  诡秘之主 · 序列人格测试 · 交互层
 * ============================================================ */

const state = {
  current: 0,
  answers: new Array(QUESTIONS.length).fill(null),
  lastTopRanked: null,
};

/* ---------- 预计算每个序列在所有题目中的最大可能得分 ---------- */
const MAX_POSSIBLE = (() => {
  const max = {};
  PATHWAYS.forEach((p) => (max[p.id] = 0));
  QUESTIONS.forEach((q) => {
    const localMax = {};
    q.o.forEach((opt) => {
      for (const [pid, w] of Object.entries(opt.w)) {
        localMax[pid] = Math.max(localMax[pid] || 0, w);
      }
    });
    for (const [pid, w] of Object.entries(localMax)) {
      max[pid] += w;
    }
  });
  return max;
})();

/* ---------- DOM 助手 ---------- */
const $ = (sel) => document.querySelector(sel);

function showView(id) {
  document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
  $(id).classList.add("active");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/* ---------- 渲染当前题目 ---------- */
function renderQuestion() {
  const q = QUESTIONS[state.current];
  $("#q-title").textContent = q.q;
  $("#q-index").textContent = String(state.current + 1);

  const pct = (state.current / QUESTIONS.length) * 100;
  $("#progress-fill").style.width = pct + "%";

  const optionsBox = $("#q-options");
  optionsBox.innerHTML = "";
  const labels = ["A", "B", "C", "D"];

  q.o.forEach((opt, idx) => {
    const div = document.createElement("div");
    div.className = "option" + (state.answers[state.current] === idx ? " selected" : "");
    div.innerHTML = `
      <div class="marker">${labels[idx]}</div>
      <div class="option-text">${opt.t}</div>
    `;
    div.addEventListener("click", () => selectOption(idx));
    optionsBox.appendChild(div);
  });

  $("#btn-prev").disabled = state.current === 0;
  // 重答上一题：仅在第二题及以后，且上一题已经作答过才可用
  $("#btn-redo-prev").disabled =
    state.current === 0 || state.answers[state.current - 1] == null;

  const isLast = state.current === QUESTIONS.length - 1;
  const nextBtn = $("#btn-next");
  nextBtn.textContent = isLast ? "查看结果 ▸" : "下一题 ›";
  nextBtn.disabled = state.answers[state.current] === null;
}

function selectOption(idx) {
  state.answers[state.current] = idx;
  renderQuestion();
  if (state.current < QUESTIONS.length - 1) {
    setTimeout(() => {
      state.current += 1;
      renderQuestion();
    }, 320);
  }
}

/* ---------- 计分 ---------- */
function computeScores() {
  const scores = {};
  PATHWAYS.forEach((p) => (scores[p.id] = 0));

  state.answers.forEach((ansIdx, qIdx) => {
    if (ansIdx == null) return;
    const opt = QUESTIONS[qIdx].o[ansIdx];
    for (const [pid, w] of Object.entries(opt.w)) {
      scores[pid] = (scores[pid] || 0) + w;
    }
  });

  const ranked = PATHWAYS.map((p) => {
    const score = scores[p.id] || 0;
    const max = MAX_POSSIBLE[p.id] || 1;
    const ratio = score / max;
    return { p, score, max, ratio };
  }).sort((a, b) => b.ratio - a.ratio);

  // 相对值（用于条形展示）：每个序列的 ratio 占榜首 ratio 的比
  const topRatio = ranked[0].ratio || 1;
  ranked.forEach((r) => (r.pct = Math.round((r.ratio / topRatio) * 100)));
  return ranked;
}

function levelOf(ratio) {
  for (const lv of SEQUENCE_LEVELS) {
    if (ratio >= lv.gte) return lv;
  }
  return SEQUENCE_LEVELS[SEQUENCE_LEVELS.length - 1];
}

/* 统一取得某途径某序列号的 {name, desc}，兼容
 *  - 新格式 { name: "...", desc: "..." }
 *  - 旧格式 直接的字符串名字（desc 为空）
 */
function getRank(pathwayId, level) {
  const r = (PATHWAY_RANKS[pathwayId] || [])[level];
  if (!r) return { name: "", desc: "" };
  if (typeof r === "string") return { name: r, desc: "" };
  return { name: r.name || "", desc: r.desc || "" };
}

/* ---------- 渲染结果 ---------- */
function renderResult() {
  const ranked = computeScores();
  state.lastTopRanked = ranked;
  const topItem = ranked[0];
  const top = topItem.p;
  const lv = levelOf(topItem.ratio);
  topItem.level = lv;

  // 主信息
  document.documentElement.style.setProperty("--aura", top.aura);

  // 序列 0 名（大字） & 序列 9 名（小字俗称） & 用户具名等级
  const seq0 = getRank(top.id, 0);
  const seq9 = getRank(top.id, 9);
  const userRank = getRank(top.id, lv.level);

  $("#result-name").textContent = seq0.name || top.name;
  $("#result-name").style.color = top.color;
  $("#result-name").style.textShadow = `0 0 30px ${top.aura}`;

  $("#result-alias").textContent = `（${seq9.name || top.name} 序列）`;
  $("#result-alias").style.color = top.color;
  $("#result-alias").style.opacity = "0.7";

  $("#result-path").textContent = top.path + " · " + top.element;
  $("#result-motto").textContent = "「" + top.motto + "」";

  // 序列等级徽章
  $("#seq-level-num").textContent = lv.level;
  $("#seq-level-num").style.color = top.color;
  $("#seq-level-num").style.background = top.aura.replace(/0?\.\d+\)/, "0.15)");
  $("#seq-level-num").style.textShadow = `0 0 16px ${top.aura}`;
  $("#seq-level-title").textContent = `序列${SEQUENCE_CN[lv.level]} · ${userRank.name || lv.title}`;
  $("#seq-level-title").style.color = top.color;
  $("#seq-level-desc").textContent = lv.desc;

  // 等级具体描述（新增）
  const rankDescEl = $("#rank-desc");
  if (userRank.desc) {
    rankDescEl.textContent = userRank.desc;
    rankDescEl.style.borderLeftColor = top.color;
    rankDescEl.style.color = "var(--text)";
  } else {
    rankDescEl.textContent = "";
  }

  // 特质药丸
  const row = $("#trait-row");
  row.innerHTML = "";
  top.traits.forEach((t) => {
    const span = document.createElement("span");
    span.className = "trait-pill";
    span.textContent = t;
    span.style.borderColor = top.color;
    span.style.color = top.color;
    span.style.background = top.aura.replace(/0?\.\d+\)/, "0.12)");
    row.appendChild(span);
  });

  $("#result-summary").textContent = top.summary;
  $("#result-analysis").textContent = top.analysis;
  $("#result-strengths").textContent = top.strengths;
  $("#result-weaknesses").textContent = top.weaknesses;
  $("#result-compat").textContent = top.compatibility;

  // Top5 列表（等级 + 进度条）
  const top5box = $("#top5-list");
  top5box.innerHTML = "";
  ranked.slice(0, 5).forEach((r, i) => {
    const lvr = levelOf(r.ratio);
    const seq0R = getRank(r.p.id, 0);
    const userRankR = getRank(r.p.id, lvr.level);
    const row = document.createElement("div");
    row.className = "top5-row";
    row.innerHTML = `
      <div class="top5-rank">${i + 1}</div>
      <div class="top5-name" style="color:${r.p.color}">${seq0R.name || r.p.name}</div>
      <div class="top5-bar"><div class="top5-bar-fill" style="width:${r.pct}%; background: linear-gradient(90deg, ${r.p.color}, ${r.p.color}aa)"></div></div>
      <div class="top5-pct">序列${SEQUENCE_CN[lvr.level]} · ${userRankR.name || lvr.title}</div>
    `;
    top5box.appendChild(row);
  });

  $("#progress-fill").style.width = "100%";
}

/* ---------- 复制分享文本 ---------- */
function copyShareText() {
  const ranked = state.lastTopRanked || computeScores();
  const top = ranked[0].p;
  const lv = ranked[0].level || levelOf(ranked[0].ratio);
  const lines = [];
  const seq0 = getRank(top.id, 0);
  const seq9 = getRank(top.id, 9);
  const userRank = getRank(top.id, lv.level);

  lines.push(`【诡秘之主 · 序列人格测试】`);
  lines.push(``);
  lines.push(`我的灵魂归属：${seq0.name || top.name}（${seq9.name || top.name} 序列）`);
  lines.push(`等级判定：序列${SEQUENCE_CN[lv.level]} · ${userRank.name || lv.title}`);
  lines.push(`「${top.motto}」`);
  if (userRank.desc) {
    lines.push(``);
    lines.push(userRank.desc);
  }
  lines.push(``);
  lines.push(`核心特质：${top.traits.join(" · ")}`);
  lines.push(``);
  lines.push(`Top 5 序列契合：`);
  ranked.slice(0, 5).forEach((r, i) => {
    const lvr = levelOf(r.ratio);
    const seq0R = getRank(r.p.id, 0);
    const userRankR = getRank(r.p.id, lvr.level);
    lines.push(`  ${i + 1}. ${seq0R.name || r.p.name}  序列${SEQUENCE_CN[lvr.level]} · ${userRankR.name || lvr.title}  ${r.pct}%`);
  });
  const text = lines.join("\n");

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(
      () => flashShareBtn("已复制 ✓"),
      () => fallbackCopy(text)
    );
  } else {
    fallbackCopy(text);
  }
}
function fallbackCopy(text) {
  const ta = document.createElement("textarea");
  ta.value = text;
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand("copy"); flashShareBtn("已复制 ✓"); }
  catch (e) { flashShareBtn("复制失败 ×"); }
  document.body.removeChild(ta);
}
function flashShareBtn(msg) {
  const btn = $("#btn-share");
  const old = btn.textContent;
  btn.textContent = msg;
  setTimeout(() => (btn.textContent = old), 1800);
}

/* ============================================================
 *  下载分享图：用 canvas 画出 1080x1620 的精美海报
 * ============================================================ */

function hexToRgba(hex, alpha) {
  const m = hex.replace("#", "");
  const full = m.length === 3 ? m.split("").map((c) => c + c).join("") : m;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function wrapText(ctx, text, maxWidth) {
  const lines = [];
  let line = "";
  for (const ch of text) {
    if (ch === "\n") {
      lines.push(line);
      line = "";
      continue;
    }
    const test = line + ch;
    if (ctx.measureText(test).width > maxWidth && line.length > 0) {
      lines.push(line);
      line = ch;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

async function generateShareImage() {
  const ranked = state.lastTopRanked || computeScores();
  const topItem = ranked[0];
  const top = topItem.p;
  const lv = topItem.level || levelOf(topItem.ratio);
  const seq0 = getRank(top.id, 0);
  const seq9 = getRank(top.id, 9);
  const userRank = getRank(top.id, lv.level);
  const seq0Name = seq0.name || top.name;
  const seq9Name = seq9.name || top.name;
  const userRankName = userRank.name || lv.title;

  const W = 1080, H = 1620;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");

  // ===== 背景：深色 + 双层径向高光 =====
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#0c0e1c");
  bg.addColorStop(1, "#04050a");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // 顶部主光晕（pathway 颜色）
  const glow1 = ctx.createRadialGradient(W / 2, 240, 50, W / 2, 240, 700);
  glow1.addColorStop(0, hexToRgba(top.color, 0.35));
  glow1.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glow1;
  ctx.fillRect(0, 0, W, H);

  // 底部冷光
  const glow2 = ctx.createRadialGradient(W / 2, H - 200, 100, W / 2, H - 200, 600);
  glow2.addColorStop(0, "rgba(94,96,206,0.18)");
  glow2.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glow2;
  ctx.fillRect(0, 0, W, H);

  // 内框
  ctx.strokeStyle = hexToRgba(top.color, 0.35);
  ctx.lineWidth = 2;
  ctx.strokeRect(40, 40, W - 80, H - 80);
  ctx.strokeStyle = hexToRgba(top.color, 0.15);
  ctx.lineWidth = 1;
  ctx.strokeRect(56, 56, W - 112, H - 112);

  // ===== 顶部小标题 =====
  ctx.fillStyle = "#a8a496";
  ctx.font = "300 22px 'PingFang SC','Microsoft YaHei',serif";
  ctx.textAlign = "center";
  ctx.fillText("⛧  L O R D   O F   M Y S T E R I E S  ⛧", W / 2, 110);
  ctx.fillStyle = "#d4af37";
  ctx.font = "500 28px 'PingFang SC','Microsoft YaHei',serif";
  ctx.fillText("诡秘之主 · 序列人格测试", W / 2, 150);

  // ===== 装饰 · 发光菱形（替代图标位置） =====
  {
    const cx = W / 2, cy = 400;
    // 光晕
    const glow = ctx.createRadialGradient(cx, cy, 10, cx, cy, 220);
    glow.addColorStop(0, hexToRgba(top.color, 0.45));
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(cx - 240, cy - 160, 480, 320);

    // 装饰长横线
    ctx.strokeStyle = hexToRgba(top.color, 0.5);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - 200, cy);
    ctx.lineTo(cx - 36, cy);
    ctx.moveTo(cx + 36, cy);
    ctx.lineTo(cx + 200, cy);
    ctx.stroke();

    // 中心菱形
    ctx.shadowColor = top.color;
    ctx.shadowBlur = 24;
    ctx.fillStyle = top.color;
    ctx.beginPath();
    ctx.moveTo(cx, cy - 22);
    ctx.lineTo(cx + 18, cy);
    ctx.lineTo(cx, cy + 22);
    ctx.lineTo(cx - 18, cy);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;

    // 内嵌小菱形（深色描边）
    ctx.strokeStyle = "#1a1814";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx, cy - 10);
    ctx.lineTo(cx + 8, cy);
    ctx.lineTo(cx, cy + 10);
    ctx.lineTo(cx - 8, cy);
    ctx.closePath();
    ctx.stroke();
  }

  // ===== "你的灵魂归属于" =====
  ctx.fillStyle = "#a8a496";
  ctx.font = "300 22px 'PingFang SC','Microsoft YaHei',serif";
  ctx.fillText("Y O U R   S O U L   B E L O N G S   T O", W / 2, 580);

  // ===== 序列名（特大号，发光） =====
  ctx.shadowColor = top.color;
  ctx.shadowBlur = 30;
  ctx.fillStyle = top.color;
  ctx.font = "600 120px 'Cormorant Garamond','Songti SC',serif";
  ctx.fillText(seq0Name, W / 2, 700);
  ctx.shadowBlur = 0;

  // 序列 9 俗称（小字括号）
  ctx.fillStyle = hexToRgba(top.color, 0.7);
  ctx.font = "italic 400 28px 'Cormorant Garamond','Songti SC',serif";
  ctx.fillText(`（${seq9Name} 序列）`, W / 2, 745);

  // 途径副标题
  ctx.fillStyle = "#a8a496";
  ctx.font = "400 20px 'PingFang SC','Microsoft YaHei',serif";
  ctx.fillText(top.path + "  ·  " + top.element, W / 2, 780);

  // 分割线
  ctx.strokeStyle = hexToRgba(top.color, 0.4);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(W / 2 - 120, 808);
  ctx.lineTo(W / 2 + 120, 808);
  ctx.stroke();

  // ===== 序列等级徽章 =====
  const badgeY = 870;
  // 圆形数字
  ctx.beginPath();
  ctx.arc(W / 2 - 200, badgeY, 44, 0, Math.PI * 2);
  ctx.fillStyle = hexToRgba(top.color, 0.15);
  ctx.fill();
  ctx.strokeStyle = top.color;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.shadowColor = top.color;
  ctx.shadowBlur = 15;
  ctx.fillStyle = top.color;
  ctx.font = "600 56px 'Cormorant Garamond',serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(lv.level), W / 2 - 200, badgeY);
  ctx.shadowBlur = 0;
  ctx.textBaseline = "alphabetic";

  // 等级标题（途径专属具名等级）
  ctx.textAlign = "left";
  ctx.fillStyle = top.color;
  ctx.font = "500 32px 'PingFang SC','Microsoft YaHei',serif";
  ctx.fillText(`序列${SEQUENCE_CN[lv.level]} · ${userRankName}`, W / 2 - 130, badgeY - 8);
  ctx.fillStyle = "#a8a496";
  ctx.font = "300 18px 'PingFang SC','Microsoft YaHei',serif";
  ctx.fillText(lv.title, W / 2 - 130, badgeY + 20);

  // ===== 名言 =====
  ctx.textAlign = "center";
  ctx.fillStyle = "#e8e6df";
  ctx.font = "italic 500 28px 'Cormorant Garamond','Songti SC',serif";
  const mottoLines = wrapText(ctx, "「" + top.motto + "」", W - 240);
  let mottoY = 970;
  mottoLines.forEach((line) => {
    ctx.fillText(line, W / 2, mottoY);
    mottoY += 42;
  });

  // ===== 特质药丸 =====
  ctx.font = "400 22px 'PingFang SC','Microsoft YaHei',serif";
  const traits = top.traits;
  const padding = 16;
  const pillH = 44;
  const gap = 14;
  const widths = traits.map((t) => ctx.measureText(t).width + padding * 2);
  const totalW = widths.reduce((a, b) => a + b, 0) + gap * (traits.length - 1);
  let pillX = W / 2 - totalW / 2;
  const pillY = mottoY + 30;
  traits.forEach((t, i) => {
    const w = widths[i];
    ctx.fillStyle = hexToRgba(top.color, 0.12);
    ctx.strokeStyle = hexToRgba(top.color, 0.45);
    ctx.lineWidth = 1.5;
    roundRect(ctx, pillX, pillY, w, pillH, 22);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = top.color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(t, pillX + w / 2, pillY + pillH / 2 + 1);
    pillX += w + gap;
  });
  ctx.textBaseline = "alphabetic";

  // ===== 人格速写（summary） =====
  ctx.fillStyle = "#e8e6df";
  ctx.font = "italic 400 26px 'Cormorant Garamond','Songti SC',serif";
  ctx.textAlign = "center";
  const summaryLines = wrapText(ctx, top.summary, W - 240);
  let sy = pillY + pillH + 60;
  summaryLines.forEach((line) => {
    ctx.fillText(line, W / 2, sy);
    sy += 38;
  });

  // ===== Top 3 契合度 =====
  const top3 = ranked.slice(0, 3);
  ctx.fillStyle = hexToRgba(top.color, 0.7);
  ctx.font = "500 18px 'PingFang SC','Microsoft YaHei',serif";
  ctx.textAlign = "center";
  ctx.fillText("·  灵 魂 亲 缘 · T O P 3  ·", W / 2, sy + 60);

  let by = sy + 110;
  for (const r of top3) {
    const lvr = levelOf(r.ratio);
    // 名字
    ctx.textAlign = "left";
    ctx.fillStyle = r.p.color;
    ctx.font = "500 26px 'PingFang SC','Microsoft YaHei',serif";
    ctx.fillText(r.p.name, 180, by);

    // 序列等级
    ctx.fillStyle = "#a8a496";
    ctx.font = "300 18px 'PingFang SC','Microsoft YaHei',serif";
    ctx.fillText(`序列 ${lvr.level}`, 320, by);

    // 进度条
    const barX = 480, barY = by - 16, barW = 380, barH = 14;
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    roundRect(ctx, barX, barY, barW, barH, 7); ctx.fill();
    const fillW = Math.max(8, (barW * r.pct) / 100);
    const grad = ctx.createLinearGradient(barX, 0, barX + fillW, 0);
    grad.addColorStop(0, r.p.color);
    grad.addColorStop(1, hexToRgba(r.p.color, 0.6));
    ctx.fillStyle = grad;
    roundRect(ctx, barX, barY, fillW, barH, 7); ctx.fill();

    // 百分比
    ctx.textAlign = "right";
    ctx.fillStyle = r.p.color;
    ctx.font = "500 22px 'Cormorant Garamond','PingFang SC',serif";
    ctx.fillText(r.pct + "%", 900, by);

    by += 56;
  }

  // ===== 底部 footer =====
  ctx.textAlign = "center";
  ctx.fillStyle = "#6a6855";
  ctx.font = "300 18px 'PingFang SC','Microsoft YaHei',serif";
  ctx.fillText("基于网络小说《诡秘之主》22 序列设定 · 仅供娱乐与自我探索", W / 2, H - 90);
  ctx.fillStyle = hexToRgba(top.color, 0.5);
  ctx.font = "400 16px 'Cormorant Garamond',serif";
  ctx.fillText("L O R D   O F   M Y S T E R I E S    ·    S E Q U E N C E   T E S T", W / 2, H - 60);

  // ===== 触发下载 =====
  return canvas;
}

function roundRect(ctx, x, y, w, h, r) {
  if (r === undefined) r = 4;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

async function downloadShareImage() {
  const btn = $("#btn-download");
  const old = btn.textContent;
  btn.textContent = "正在生成…";
  btn.disabled = true;
  try {
    const canvas = await generateShareImage();
    const topRanked = state.lastTopRanked[0];
    const top = topRanked.p;
    const seq0 = getRank(top.id, 0);
    const userRank = getRank(top.id, topRanked.level.level);
    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `诡秘序列_${seq0.name || top.name}_序列${SEQUENCE_CN[topRanked.level.level]}_${userRank.name || ""}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      showToast("分享图已生成 ✓");
    }, "image/png");
  } catch (e) {
    console.error(e);
    showToast("生成失败，请重试 ×");
  } finally {
    btn.textContent = old;
    btn.disabled = false;
  }
}

function showToast(msg) {
  const t = document.createElement("div");
  t.className = "dl-toast";
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 1800);
}

/* ---------- 按钮事件 ---------- */
$("#btn-start").addEventListener("click", () => {
  state.current = 0;
  state.answers = new Array(QUESTIONS.length).fill(null);
  showView("#view-quiz");
  renderQuestion();
});

$("#btn-prev").addEventListener("click", () => {
  if (state.current > 0) {
    state.current -= 1;
    renderQuestion();
  }
});

$("#btn-redo-prev").addEventListener("click", () => {
  if (state.current === 0) return;
  state.current -= 1;
  state.answers[state.current] = null;
  renderQuestion();
});

$("#btn-next").addEventListener("click", () => {
  if (state.answers[state.current] == null) return;
  if (state.current < QUESTIONS.length - 1) {
    state.current += 1;
    renderQuestion();
  } else {
    renderResult();
    showView("#view-result");
  }
});

$("#btn-restart").addEventListener("click", () => {
  state.current = 0;
  state.answers = new Array(QUESTIONS.length).fill(null);
  $("#progress-fill").style.width = "0%";
  showView("#view-intro");
});

$("#btn-share").addEventListener("click", copyShareText);
$("#btn-download").addEventListener("click", downloadShareImage);

/* ---------- 键盘支持 ---------- */
document.addEventListener("keydown", (e) => {
  if (!$("#view-quiz").classList.contains("active")) return;
  const map = { a: 0, b: 1, c: 2, d: 3, "1": 0, "2": 1, "3": 2, "4": 3 };
  const idx = map[e.key.toLowerCase()];
  if (idx != null) {
    e.preventDefault();
    selectOption(idx);
  } else if (e.key === "ArrowLeft") {
    $("#btn-prev").click();
  } else if (e.key === "ArrowRight" || e.key === "Enter") {
    if (!$("#btn-next").disabled) $("#btn-next").click();
  } else if (e.key === "Backspace") {
    if (!$("#btn-redo-prev").disabled) {
      e.preventDefault();
      $("#btn-redo-prev").click();
    }
  }
});
