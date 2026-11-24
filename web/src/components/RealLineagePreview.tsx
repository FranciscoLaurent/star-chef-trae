// 真实师承谱预览 —— 自动选取徒弟最多且可看（有照片）的真实师傅，
// 展示一条全真实档案的师承链。数据口径：全部来自 chefs.json（apprenticeMap），
// 不包含任何编造人物或统计数字；数字取自 meta 与运行时统计。

import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useData } from '../lib/useData';
import type { Chef, WebData } from '../lib/types';

const MAX_DISCIPLES = 6;

interface Pick {
  master: Chef;
  disciples: Chef[];
  photoCount: number;
}

/** 选取展示主角：徒弟真实照片数（≥2 张）为主，师傅本人有照片强加权——
 *  避免「本人无照的大众名」凭徒弟数量压过「本人有照且徒弟全照」的更完整样本 */
function pickLineage(data: WebData): Pick | null {
  const byId = new Map(data.chefs.map(c => [c.id, c] as const));
  let best: (Pick & { score: number }) | null = null;
  for (const [name, ids] of Object.entries(data.apprenticeMap)) {
    if (!ids.length) continue;
    // 排除「档案待补」的派生实体，只展示真实人物
    const master = data.chefs.find(c => c.name === name && !c.derived);
    if (!master) continue;
    const disciples = ids
      .map(id => byId.get(id))
      .filter((c): c is Chef => !!c)
      .sort((a, b) =>
        (Number(!!b.portrait && !b.derived) - Number(!!a.portrait && !a.derived)) ||
        (Number(!!a.derived) - Number(!!b.derived))
      );
    const photoCount = disciples.filter(d => d.portrait && !d.derived).length;
    if (photoCount < 2) continue;
    const score = photoCount * 2 + (master.portrait ? 5 : 0);
    if (!best || score > best.score) best = { master, disciples, photoCount, score };
  }
  return best;
}

/** 师承链展示（首页 §02） */
export default function RealLineagePreview() {
  const { data } = useData();

  const pick = useMemo(() => (data ? pickLineage(data) : null), [data]);
  if (!data || !pick) return null; // 数据未就绪或无符合口径的师承链时整块不渲染

  const { master, disciples } = pick;
  const shown = disciples.slice(0, MAX_DISCIPLES);
  const schoolName = master.school
    ? data.schools.find(s => s.key === master.school)?.subName || master.school
    : null;
  const masterMeta = [
    master.cuisine ? `${master.cuisine}菜` : null,
    schoolName,
    master.era,
    master.gen != null ? `第 ${master.gen} 代` : null,
  ].filter(Boolean).join(' · ');

  // 连线：列中心与徒弟网格严格对齐（6 列 = 列宽 15% + 列距 2% → 中心 7.5 + 17i）
  // 横杠端点至少延伸到中线 50，杜绝徒弟不足 4 列时横杠右端悬空在中线左侧
  const centers = shown.map((_, i) => 7.5 + 17 * i);
  const barLeft = Math.min(...centers, 50);
  const barRight = Math.max(...centers, 50);
  const path =
    `M 50 0 L 50 30 M ${barLeft} 30 H ${barRight} ` +
    centers.map(x => `M ${x} 30 L ${x} 60`).join(' ');

  return (
    <section className="real-lineage" aria-label="真实师承谱样例">
      <div className="section-head">
        <div className="num">§ 02</div>
        <h2>一张真实的<br /><em>谱</em>。</h2>
        <div className="right">来自真实公开档案的可溯师承链<br />全谱 {data.meta.withMaster} 位厨师录得师承出处 · 点开任一位读出处</div>
      </div>

      <div className="rlp-board">
        <Link to={`/chef/${master.id}`} className="rlp-master">
          <div className="rlp-photo rlp-photo--master">
            {master.portrait && (
              <img src={master.portrait} alt={master.name} loading="lazy"
                onLoad={e => { e.currentTarget.classList.add('is-loaded'); }}
                onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
            )}
            <span aria-hidden="true">{master.name.slice(0, 1)}</span>
          </div>
          <div className="rlp-master-info">
            <div className="rlp-tag">师承链主角 · 由数据自动选取</div>
            <div className="rlp-name">{master.name}</div>
            <div className="rlp-meta">{masterMeta || '档案待补'}</div>
            <div className="rlp-sub">门下可溯徒弟 {disciples.length} 位，师承关系来源于公开资料{master.verified ? '' : '（待核实）'}。</div>
          </div>
        </Link>

        <div className="rlp-tree" aria-hidden="true">
          <svg viewBox="0 0 100 60" preserveAspectRatio="none">
            <path d={path} fill="none" stroke="currentColor" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          </svg>
        </div>

        <div className="rlp-disciples">
          {shown.map(d => (
            <Link key={d.id} to={`/chef/${d.id}`} className="rlp-disciple">
              <div className="rlp-photo">
                {d.portrait && (
                  <img src={d.portrait} alt="" loading="lazy"
                    onLoad={e => { e.currentTarget.classList.add('is-loaded'); }}
                    onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                )}
                <span aria-hidden="true">{d.name.slice(0, 1)}</span>
              </div>
              <div className="rlp-d-name">{d.name}</div>
              <div className="rlp-d-meta">
                {[d.cuisine ? `${d.cuisine}菜` : null, d.gen != null ? `第 ${d.gen} 代` : null].filter(Boolean).join(' · ') || '档案待补'}
              </div>
            </Link>
          ))}
        </div>

        <div className="rlp-foot">
          <span className="rlp-note">以上人物与关系均来自公开可溯资料 · 全谱 {data.meta.withMaster} 位厨师录得师承出处</span>
          <Link className="cta" to="/lineage">在师承谱中看全部 <span className="arrow">→</span></Link>
        </div>
      </div>
    </section>
  );
}
